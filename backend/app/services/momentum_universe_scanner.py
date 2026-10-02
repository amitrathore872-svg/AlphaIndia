"""
Alpha India — Momentum Universe Scanner & Live Breakout Monitor Service
Sprint 41 — Full NSE/BSE Universe Off-Market Sweep + Intraday Breakout Engine

Behaviour:
  OFF-MARKET (before 09:15 IST or after 15:30 IST):
    • Pulls ALL active companies from the `companies` DB table (full universe)
    • Scans each for the 10-condition momentum setup in parallel
    • Stocks that pass ≥ NEAR_BREAKOUT_THRESHOLD (default 7) conditions are
      upserted into `momentum_radar_watchlist` as active monitoring candidates

  MARKET HOURS (09:15–15:30 IST, weekdays):
    • Reads ONLY the active watchlist candidates (≥7/10 from prior night scan)
    • Re-scores them against today's live OHLCV
    • Stocks reaching ≥ BREAKOUT_TRIGGER_THRESHOLD (default 9) are flagged as
      `breakout_triggered = True` and can fire alerts
    • Results cached per 60-second cadence for real-time UI polling
"""

from __future__ import annotations

import concurrent.futures
import json
import logging
import math
import threading
import time
from datetime import datetime, timezone, date
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import pytz
from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.models.company import Company
from app.models.company_market_metrics import CompanyMarketMetrics
from app.models.momentum_radar_watchlist import MomentumRadarWatchlist
from app.services.market_data_service import MarketDataService
from app.services.momentum_screener_service import MomentumScreenerService

logger = logging.getLogger("alpha_india.momentum_universe")

IST = pytz.timezone("Asia/Kolkata")

# Thresholds
NEAR_BREAKOUT_THRESHOLD = 7    # ≥7/10 → promoted to watchlist after off-market scan
BREAKOUT_TRIGGER_THRESHOLD = 9  # ≥9/10 during market hours → breakout alert

# Universe scan disk cache
UNIVERSE_CACHE_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "momentum_universe_cache.json"

# In-memory state
_universe_scan_lock = threading.Lock()
_universe_scan_in_progress = False

_intraday_lock = threading.Lock()
_intraday_scan_in_progress = False

_INTRADAY_CACHE: Dict[str, Any] = {
    "timestamp": 0,
    "breakouts": [],
    "near_breakouts": [],
    "metadata": {},
}
INTRADAY_CACHE_TTL = 60  # seconds


# ──────────────────────────────────────────────
#  Market Hours Helper
# ──────────────────────────────────────────────

def is_market_hours() -> bool:
    """Returns True if current IST time is within NSE trading hours (Mon–Fri, 09:15–15:30)."""
    now_ist = datetime.now(IST)
    if now_ist.weekday() >= 5:  # Saturday=5, Sunday=6
        return False
    market_open = now_ist.replace(hour=9, minute=15, second=0, microsecond=0)
    market_close = now_ist.replace(hour=15, minute=30, second=0, microsecond=0)
    return market_open <= now_ist <= market_close


def is_off_market_window() -> bool:
    """Returns True during off-market window (18:00 IST onwards or before 09:00 IST)."""
    now_ist = datetime.now(IST)
    if now_ist.weekday() >= 5:  # weekends
        return True
    # Good window: 18:00 – 08:59 next day (avoids peak market-hours DB contention)
    hour = now_ist.hour
    return hour >= 18 or hour < 9


# ──────────────────────────────────────────────
#  Full Universe Off-Market Scanner
# ──────────────────────────────────────────────

class MomentumUniverseScanner:
    """
    Scans the complete NSE/BSE equity universe during off-market hours.
    Promotes ≥7/10 condition matches into the watchlist for live intraday monitoring.
    """

    # Batch sizing & institutional filters
    BATCH_SIZE = 50
    MAX_WORKERS = 12
    MIN_PRICE = 20.0                  # Discard penny stocks (CMP < Rs 20)
    MIN_MARKET_CAP_CR = 1000.0        # Discard micro-caps below Rs 1,000 Cr
    MIN_DAILY_TURNOVER_LAKHS = 50.0  # Discard illiquid stocks (< Rs 50 Lakhs daily turnover)
    MIN_VOLUME_SMA20 = 25000         # Discard illiquid stocks (< 25,000 shares 20d SMA volume)

    @classmethod
    def get_full_universe(cls, db: Session) -> List[Dict[str, Any]]:
        """
        Fetches active equities from `companies` table, pre-filtering out
        companies with known market cap < 1,000 Cr.
        Returns list of {symbol, company_name, sector, market_cap_cr} dicts.
        """
        try:
            # Query companies
            companies = (
                db.query(Company.symbol, Company.company, Company.sector, Company.market_cap)
                .filter(
                    Company.listing_status == "Active",
                    Company.security_type == "EQUITY",
                    Company.is_growth_eligible == True,
                )
                .order_by(Company.symbol)
                .all()
            )

            # Query CompanyMarketMetrics for accurate live Market Cap in Cr
            metric_rows = (
                db.query(CompanyMarketMetrics.symbol, CompanyMarketMetrics.market_cap)
                .filter(CompanyMarketMetrics.market_cap.isnot(None))
                .all()
            )
            metric_mcap_map = {m.symbol: m.market_cap for m in metric_rows}

            filtered_universe = []
            for row in companies:
                sym = row.symbol
                if not sym or len(sym) > 20:
                    continue

                # Determine Market Cap (Cr)
                mcap = metric_mcap_map.get(sym)
                if mcap is None and row.market_cap and row.market_cap not in ("Unknown", "None", ""):
                    try:
                        mcap = float(row.market_cap)
                    except (ValueError, TypeError):
                        mcap = None

                # Exclude micro-cap stocks with known market cap < 1,000 Cr
                if mcap is not None and mcap < cls.MIN_MARKET_CAP_CR:
                    continue

                filtered_universe.append({
                    "symbol": sym,
                    "company_name": row.company or sym,
                    "sector": row.sector or "Diversified",
                    "market_cap_cr": mcap,
                })

            logger.info(
                f"[UniverseScanner] Filtered universe to {len(filtered_universe)} stocks "
                f"(excluded companies with market cap < Rs {cls.MIN_MARKET_CAP_CR} Cr)"
            )
            return filtered_universe
        except Exception as e:
            logger.error(f"[UniverseScanner] Failed to fetch universe from DB: {e}")
            # Fallback to CORE_UNIVERSE from momentum screener
            return [
                {
                    "symbol": sym,
                    "company_name": sym,
                    "sector": MomentumScreenerService.SECTOR_MAP.get(sym, "Diversified"),
                    "market_cap_cr": None,
                }
                for sym in MomentumScreenerService.CORE_UNIVERSE
            ]

    @classmethod
    def run_full_universe_scan(cls, db: Session) -> Dict[str, Any]:
        """
        Full off-market universe sweep. Batches OHLCV downloads to avoid Yahoo Finance throttling.
        Returns all results and upserts ≥NEAR_BREAKOUT_THRESHOLD into DB watchlist.
        """
        t0 = time.time()
        universe = cls.get_full_universe(db)
        total_in_universe = len(universe)
        mcap_by_sym = {item["symbol"]: item.get("market_cap_cr") for item in universe}
        logger.info(f"[UniverseScanner] Starting institutional universe scan: {total_in_universe} companies")

        all_results: List[Dict[str, Any]] = []
        scanned_count = 0
        error_count = 0

        # Process in batches to preload OHLCV efficiently
        batches = [universe[i:i + cls.BATCH_SIZE] for i in range(0, len(universe), cls.BATCH_SIZE)]

        for batch_idx, batch in enumerate(batches):
            batch_symbols = [s["symbol"] for s in batch]
            # Pre-warm OHLCV cache for entire batch in one vectorized call
            try:
                MarketDataService.preload_universe_batch(batch_symbols, period="2y", interval="1d")
            except Exception as e:
                logger.warning(f"[UniverseScanner] Batch {batch_idx} preload warning: {e}")

            # Analyze batch in parallel
            with concurrent.futures.ThreadPoolExecutor(max_workers=cls.MAX_WORKERS) as executor:
                futures = {
                    executor.submit(
                        MomentumScreenerService.analyze_symbol,
                        item["symbol"],
                        item["company_name"],
                        item["sector"],
                    ): item["symbol"]
                    for item in batch
                }
                for future in concurrent.futures.as_completed(futures):
                    scanned_count += 1
                    try:
                        result = future.result(timeout=30)
                        if not result:
                            continue

                        sym = result["symbol"]
                        cmp = result.get("cmp") or 0.0
                        ind = result.get("indicators") or {}
                        vol_sma20 = ind.get("daily_volume_sma20") or 0.0
                        turnover_lakhs = round((cmp * vol_sma20) / 100000.0, 1)

                        # Filter 1: Penny stocks (CMP < Rs 20)
                        if cmp < cls.MIN_PRICE:
                            continue

                        # Filter 2: Illiquid stocks (volume SMA20 < 25k or daily turnover < Rs 50 Lakhs)
                        if vol_sma20 < cls.MIN_VOLUME_SMA20 or turnover_lakhs < cls.MIN_DAILY_TURNOVER_LAKHS:
                            continue

                        # Filter 3: Market Cap < 1,000 Cr
                        mcap = mcap_by_sym.get(sym)
                        if mcap is not None and mcap < cls.MIN_MARKET_CAP_CR:
                            continue

                        result["market_cap_cr"] = mcap
                        result["turnover_lakhs"] = turnover_lakhs
                        all_results.append(result)
                    except Exception as ex:
                        error_count += 1
                        logger.debug(f"[UniverseScanner] Symbol scan error: {ex}")

            logger.info(
                f"[UniverseScanner] Batch {batch_idx + 1}/{len(batches)} done "
                f"({scanned_count}/{total_in_universe} scanned, {len(all_results)} institutional candidates passed)"
            )
            # Small pause between batches to avoid rate-limiting
            time.sleep(0.5)

        # Sort by match_count desc, then conviction_score desc
        all_results.sort(key=lambda x: (x["match_count"], x["conviction_score"]), reverse=True)

        elapsed = round(time.time() - t0, 1)
        scan_date = date.today().isoformat()
        now_ts = time.time()

        # Segment results
        near_breakout = [r for r in all_results if r["match_count"] >= NEAR_BREAKOUT_THRESHOLD]
        perfect = [r for r in all_results if r["is_perfect_match"]]
        high_conviction = [r for r in all_results if r["match_count"] >= 8]

        metadata = {
            "universe_size": total_in_universe,
            "scanned_count": scanned_count,
            "valid_results": len(all_results),
            "near_breakout_count": len(near_breakout),
            "high_conviction_count": len(high_conviction),
            "perfect_10_count": len(perfect),
            "error_count": error_count,
            "scan_duration_seconds": elapsed,
            "scan_date": scan_date,
            "last_scan_time": datetime.now(IST).strftime("%Y-%m-%d %H:%M:%S IST"),
            "scan_type": "UNIVERSE_FULL",
            "near_breakout_threshold": NEAR_BREAKOUT_THRESHOLD,
            "min_mcap_cr": cls.MIN_MARKET_CAP_CR,
            "min_price": cls.MIN_PRICE,
            "min_turnover_lakhs": cls.MIN_DAILY_TURNOVER_LAKHS,
            "min_vol_sma20": cls.MIN_VOLUME_SMA20,
        }

        # Upsert near-breakout candidates into DB watchlist
        promoted_count = cls._upsert_watchlist_candidates(db, near_breakout, total_in_universe, scan_date)
        metadata["promoted_to_watchlist"] = promoted_count

        # Persist to disk cache
        cls._save_universe_cache(all_results, metadata, now_ts)

        logger.info(
            f"[UniverseScanner] ✅ Full universe scan complete: {scanned_count} scanned, "
            f"{len(near_breakout)} near-breakout, {promoted_count} promoted to watchlist, {elapsed}s"
        )

        # Trigger opportunity alerts for full universe findings
        try:
            from app.services.opportunity_alert_service import OpportunityAlertService
            OpportunityAlertService.scan_and_dispatch_opportunity_alerts(db=db, force_scan=False)
        except Exception as alert_err:
            logger.warning(f"[UniverseScanner] Opportunity alert dispatch notice: {alert_err}")

        return {"metadata": metadata, "results": all_results, "near_breakout": near_breakout}

    @classmethod
    def _upsert_watchlist_candidates(
        cls, db: Session, candidates: List[Dict[str, Any]], universe_size: int, scan_date: str
    ) -> int:
        """
        Upserts all ≥NEAR_BREAKOUT_THRESHOLD candidates into `momentum_radar_watchlist`.
        Deactivates old candidates from previous scan dates that are no longer qualifying.
        """
        promoted = 0
        try:
            # Deactivate stale candidates from previous dates that no longer qualify
            candidate_symbols = {c["symbol"] for c in candidates}
            (
                db.query(MomentumRadarWatchlist)
                .filter(
                    MomentumRadarWatchlist.promoted_date != scan_date,
                    MomentumRadarWatchlist.is_active_monitor == True,
                )
                .update({"is_active_monitor": False}, synchronize_session=False)
            )

            for candidate in candidates:
                sym = candidate["symbol"]
                existing = (
                    db.query(MomentumRadarWatchlist)
                    .filter(
                        MomentumRadarWatchlist.symbol == sym,
                        MomentumRadarWatchlist.promoted_date == scan_date,
                    )
                    .first()
                )
                ind = candidate.get("indicators", {})
                bp = candidate.get("trade_blueprint", {})

                row_data = dict(
                    company_name=candidate.get("company_name", sym),
                    sector=candidate.get("sector", "Diversified"),
                    match_count=candidate.get("match_count", 0),
                    conviction_score=candidate.get("conviction_score", 0),
                    conditions_passed=candidate.get("filters", {}),
                    cmp_at_scan=candidate.get("cmp"),
                    daily_rsi_at_scan=ind.get("daily_rsi"),
                    weekly_rsi_at_scan=ind.get("weekly_rsi"),
                    monthly_rsi_at_scan=ind.get("monthly_rsi"),
                    vol_surge_ratio_at_scan=ind.get("volume_surge_ratio"),
                    daily_bb_upper=ind.get("daily_bb_upper"),
                    weekly_bb_upper=ind.get("weekly_bb_upper"),
                    weekly_wma30=ind.get("weekly_wma30"),
                    weekly_wma50=ind.get("weekly_wma50"),
                    entry_trigger=bp.get("entry_trigger"),
                    stop_loss=bp.get("stop_loss"),
                    target_1=bp.get("target_1"),
                    target_2=bp.get("target_2"),
                    risk_reward=bp.get("risk_reward"),
                    scan_type="UNIVERSE_FULL",
                    universe_size=universe_size,
                    is_active_monitor=True,
                    breakout_triggered=False,
                    breakout_triggered_at=None,
                    intraday_cmp=None,
                    intraday_match_count=None,
                    scanned_at=datetime.now(timezone.utc),
                    promoted_date=scan_date,
                )

                if existing:
                    for k, v in row_data.items():
                        setattr(existing, k, v)
                else:
                    db.add(MomentumRadarWatchlist(symbol=sym, **row_data))
                promoted += 1

            db.commit()
        except Exception as e:
            logger.error(f"[UniverseScanner] Watchlist upsert error: {e}", exc_info=True)
            try:
                db.rollback()
            except Exception:
                pass

        return promoted

    @classmethod
    def _save_universe_cache(cls, results: List[Dict[str, Any]], metadata: Dict[str, Any], ts: float) -> None:
        try:
            UNIVERSE_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
            payload = {"timestamp": ts, "metadata": metadata, "results": results}
            with open(UNIVERSE_CACHE_PATH, "w", encoding="utf-8") as f:
                json.dump(payload, f, indent=2)
        except Exception as e:
            logger.warning(f"[UniverseScanner] Cache save error: {e}")

    @classmethod
    def load_universe_cache(cls) -> Optional[Dict[str, Any]]:
        """Load last off-market scan results from disk cache."""
        try:
            if UNIVERSE_CACHE_PATH.exists():
                with open(UNIVERSE_CACHE_PATH, "r", encoding="utf-8") as f:
                    data = json.load(f)
                return data
        except Exception as e:
            logger.warning(f"[UniverseScanner] Cache load error: {e}")
        return None

    @classmethod
    def apply_institutional_filters_to_cache(cls, db: Session) -> Dict[str, Any]:
        """
        Enriches and filters the disk cache and DB watchlist to ensure:
        1. Market cap >= 1,000 Cr (discards micro-caps < 1000 Cr)
        2. Non-penny stocks (CMP >= 20.0)
        3. Liquid stocks (20d SMA volume >= 25,000 and 20d turnover >= 50 Lakhs)
        """
        cache_data = cls.load_universe_cache()
        if not cache_data or not cache_data.get("results"):
            return {"status": "NO_CACHE", "valid_results": 0}

        results = cache_data["results"]
        metadata = cache_data.get("metadata", {})
        ts = cache_data.get("timestamp", time.time())

        syms = [r["symbol"] for r in results]
        companies = db.query(Company.symbol, Company.market_cap).filter(Company.symbol.in_(syms)).all()
        comp_map = {c.symbol: c.market_cap for c in companies}
        metrics = db.query(CompanyMarketMetrics.symbol, CompanyMarketMetrics.market_cap).filter(CompanyMarketMetrics.symbol.in_(syms)).all()
        metric_map = {m.symbol: m.market_cap for m in metrics}

        filtered_results = []
        for r in results:
            sym = r["symbol"]
            cmp = r.get("cmp") or 0.0
            ind = r.get("indicators") or {}
            vol_sma20 = ind.get("daily_volume_sma20") or 0.0
            turnover_lakhs = round((cmp * vol_sma20) / 100000.0, 1)

            # Filter penny stocks
            if cmp < cls.MIN_PRICE:
                continue

            # Filter illiquid stocks
            if vol_sma20 < cls.MIN_VOLUME_SMA20 or turnover_lakhs < cls.MIN_DAILY_TURNOVER_LAKHS:
                continue

            # Market cap lookup
            mcap = metric_map.get(sym)
            if mcap is None:
                c_mcap = comp_map.get(sym)
                if c_mcap and c_mcap not in ("Unknown", "None", ""):
                    try:
                        mcap = float(c_mcap)
                    except Exception:
                        mcap = None

            # Filter market cap < 1,000 Cr
            if mcap is not None and mcap < cls.MIN_MARKET_CAP_CR:
                continue

            r["market_cap_cr"] = mcap
            r["turnover_lakhs"] = turnover_lakhs
            filtered_results.append(r)

        filtered_results.sort(key=lambda x: (x.get("match_count", 0), x.get("conviction_score", 0)), reverse=True)
        near_breakout = [r for r in filtered_results if r.get("match_count", 0) >= NEAR_BREAKOUT_THRESHOLD]
        perfect = [r for r in filtered_results if r.get("is_perfect_match")]
        high_conviction = [r for r in filtered_results if r.get("match_count", 0) >= 8]

        metadata["valid_results"] = len(filtered_results)
        metadata["near_breakout_count"] = len(near_breakout)
        metadata["high_conviction_count"] = len(high_conviction)
        metadata["perfect_10_count"] = len(perfect)
        metadata["min_mcap_cr"] = cls.MIN_MARKET_CAP_CR
        metadata["min_price"] = cls.MIN_PRICE
        metadata["min_turnover_lakhs"] = cls.MIN_DAILY_TURNOVER_LAKHS
        metadata["min_vol_sma20"] = cls.MIN_VOLUME_SMA20

        # Sync DB watchlist
        scan_date = metadata.get("scan_date") or date.today().isoformat()
        promoted = cls._upsert_watchlist_candidates(db, near_breakout, metadata.get("universe_size", len(filtered_results)), scan_date)
        metadata["promoted_to_watchlist"] = promoted

        cls._save_universe_cache(filtered_results, metadata, ts)
        logger.info(f"[UniverseScanner] Re-filtered cache to {len(filtered_results)} institutional stocks, {len(near_breakout)} near-breakouts")
        return {"status": "SUCCESS", "valid_results": len(filtered_results), "near_breakout_count": len(near_breakout)}

    @classmethod
    def trigger_background_universe_scan(cls, db: Optional[Session] = None) -> Dict[str, str]:
        """Non-blocking background trigger for full universe scan."""
        global _universe_scan_in_progress
        with _universe_scan_lock:
            if _universe_scan_in_progress:
                return {"status": "ALREADY_RUNNING", "message": "Universe scan already in progress."}
            _universe_scan_in_progress = True

        def _worker():
            global _universe_scan_in_progress
            worker_db = SessionLocal()
            try:
                logger.info("[UniverseScanner] 🚀 Launching full universe background scan...")
                cls.run_full_universe_scan(db=worker_db)
                logger.info("[UniverseScanner] ✅ Background universe scan finished.")
            except Exception as e:
                logger.error(f"[UniverseScanner] Background scan error: {e}", exc_info=True)
            finally:
                worker_db.close()
                with _universe_scan_lock:
                    _universe_scan_in_progress = False

        t = threading.Thread(target=_worker, daemon=True, name="MomentumUniverseScanWorker")
        t.start()
        return {"status": "STARTED", "message": "Full universe scan launched in background."}

    @classmethod
    def is_scan_in_progress(cls) -> bool:
        with _universe_scan_lock:
            return _universe_scan_in_progress


# ──────────────────────────────────────────────
#  Intraday Breakout Monitor (Market Hours Only)
# ──────────────────────────────────────────────

class MomentumIntradayMonitor:
    """
    During market hours, re-scans only the active watchlist candidates.
    Flags those reaching ≥BREAKOUT_TRIGGER_THRESHOLD as live breakouts.
    Cached at 60-second cadence to allow real-time frontend polling.
    """

    MAX_WORKERS = 8

    @classmethod
    def get_active_watchlist(cls, db: Session) -> List[MomentumRadarWatchlist]:
        """Fetch today's active watchlist candidates."""
        today = date.today().isoformat()
        try:
            return (
                db.query(MomentumRadarWatchlist)
                .filter(
                    MomentumRadarWatchlist.is_active_monitor == True,
                    MomentumRadarWatchlist.promoted_date == today,
                )
                .order_by(MomentumRadarWatchlist.match_count.desc())
                .all()
            )
        except Exception as e:
            logger.error(f"[IntradayMonitor] Failed to fetch watchlist: {e}")
            return []

    @classmethod
    def run_intraday_scan(cls, db: Session, force: bool = False) -> Dict[str, Any]:
        """
        Re-scores all active watchlist candidates against current OHLCV.
        Returns breakout alerts and near-breakout status.
        Serves cached result if within TTL and not forced.
        """
        global _intraday_scan_in_progress

        now = time.time()
        if not force and _INTRADAY_CACHE["timestamp"] and (now - _INTRADAY_CACHE["timestamp"] < INTRADAY_CACHE_TTL):
            return {
                "status": "CACHED",
                "metadata": _INTRADAY_CACHE["metadata"],
                "breakouts": _INTRADAY_CACHE["breakouts"],
                "near_breakouts": _INTRADAY_CACHE["near_breakouts"],
            }

        with _intraday_lock:
            if _intraday_scan_in_progress and not force:
                return {
                    "status": "SCANNING",
                    "metadata": _INTRADAY_CACHE["metadata"],
                    "breakouts": _INTRADAY_CACHE["breakouts"],
                    "near_breakouts": _INTRADAY_CACHE["near_breakouts"],
                }
            _intraday_scan_in_progress = True

        t0 = time.time()
        watchlist = cls.get_active_watchlist(db)

        if not watchlist:
            with _intraday_lock:
                _intraday_scan_in_progress = False
            return {
                "status": "NO_WATCHLIST",
                "message": "No active watchlist candidates. Run off-market universe scan first.",
                "metadata": {},
                "breakouts": [],
                "near_breakouts": [],
            }

        symbols = [row.symbol for row in watchlist]
        symbol_meta = {row.symbol: row for row in watchlist}

        # Preload fresh OHLCV for watchlist batch
        try:
            MarketDataService.preload_universe_batch(symbols, period="1y", interval="1d")
        except Exception as e:
            logger.warning(f"[IntradayMonitor] OHLCV preload warning: {e}")

        # Re-score each watchlist symbol
        fresh_results: List[Dict[str, Any]] = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=cls.MAX_WORKERS) as executor:
            futures = {
                executor.submit(
                    MomentumScreenerService.analyze_symbol,
                    row.symbol,
                    row.company_name,
                    row.sector,
                ): row.symbol
                for row in watchlist
            }
            for future in concurrent.futures.as_completed(futures):
                try:
                    result = future.result(timeout=30)
                    if result:
                        fresh_results.append(result)
                except Exception as ex:
                    logger.debug(f"[IntradayMonitor] Re-score error: {ex}")

        # Categorize and update DB records
        breakouts: List[Dict[str, Any]] = []
        near_breakouts: List[Dict[str, Any]] = []

        for r in fresh_results:
            sym = r["symbol"]
            row = symbol_meta.get(sym)
            intraday_match = r["match_count"]

            if intraday_match >= BREAKOUT_TRIGGER_THRESHOLD:
                r["intraday_status"] = "BREAKOUT"
                r["prior_match_count"] = row.match_count if row else None
                breakouts.append(r)
            else:
                r["intraday_status"] = "MONITORING"
                r["prior_match_count"] = row.match_count if row else None
                near_breakouts.append(r)

            # Update DB record
            if row:
                try:
                    row.intraday_cmp = r.get("cmp")
                    row.intraday_match_count = intraday_match
                    row.last_intraday_check = datetime.now(timezone.utc)
                    if intraday_match >= BREAKOUT_TRIGGER_THRESHOLD and not row.breakout_triggered:
                        row.breakout_triggered = True
                        row.breakout_triggered_at = datetime.now(timezone.utc)
                except Exception:
                    pass

        try:
            db.commit()
        except Exception as e:
            logger.warning(f"[IntradayMonitor] DB commit error: {e}")

        breakouts.sort(key=lambda x: x["match_count"], reverse=True)
        near_breakouts.sort(key=lambda x: x["match_count"], reverse=True)

        elapsed = round(time.time() - t0, 2)
        metadata = {
            "watchlist_size": len(watchlist),
            "breakout_count": len(breakouts),
            "near_breakout_count": len(near_breakouts),
            "scan_duration_seconds": elapsed,
            "last_scan_time": datetime.now(IST).strftime("%Y-%m-%d %H:%M:%S IST"),
            "breakout_trigger_threshold": BREAKOUT_TRIGGER_THRESHOLD,
            "is_market_hours": is_market_hours(),
        }

        _INTRADAY_CACHE["timestamp"] = time.time()
        _INTRADAY_CACHE["breakouts"] = breakouts
        _INTRADAY_CACHE["near_breakouts"] = near_breakouts
        _INTRADAY_CACHE["metadata"] = metadata

        with _intraday_lock:
            _intraday_scan_in_progress = False

        logger.info(
            f"[IntradayMonitor] ✅ Intraday scan: {len(breakouts)} breakouts, "
            f"{len(near_breakout)} monitoring, {elapsed}s" if "near_breakout" in locals() else f"[IntradayMonitor] ✅ Intraday scan: {len(breakouts)} breakouts, {len(near_breakouts)} monitoring, {elapsed}s"
        )

        if breakouts:
            try:
                from app.services.opportunity_alert_service import OpportunityAlertService
                OpportunityAlertService.scan_and_dispatch_opportunity_alerts(db=db, force_scan=False)
            except Exception as alert_err:
                logger.warning(f"[IntradayMonitor] Opportunity alert dispatch notice: {alert_err}")

        return {
            "status": "SUCCESS",
            "metadata": metadata,
            "breakouts": breakouts,
            "near_breakouts": near_breakouts,
        }

    @classmethod
    def trigger_background_intraday_scan(cls, db: Optional[Session] = None) -> None:
        """Non-blocking background trigger for intraday re-scoring."""
        def _worker():
            worker_db = SessionLocal()
            try:
                cls.run_intraday_scan(db=worker_db, force=True)
            except Exception as e:
                logger.error(f"[IntradayMonitor] Background scan error: {e}")
            finally:
                worker_db.close()

        t = threading.Thread(target=_worker, daemon=True, name="MomentumIntradayScanWorker")
        t.start()

    @classmethod
    def get_watchlist_summary(cls, db: Session) -> Dict[str, Any]:
        """Returns watchlist stats and today's candidates for API consumption."""
        today = date.today().isoformat()
        try:
            all_active = (
                db.query(MomentumRadarWatchlist)
                .filter(
                    MomentumRadarWatchlist.is_active_monitor == True,
                    MomentumRadarWatchlist.promoted_date == today,
                )
                .order_by(MomentumRadarWatchlist.match_count.desc())
                .all()
            )

            breakout_triggered = [r for r in all_active if r.breakout_triggered]
            monitoring = [r for r in all_active if not r.breakout_triggered]

            # Fast mcap lookup for watchlist candidates
            syms = [r.symbol for r in all_active]
            mcap_map: Dict[str, Optional[float]] = {}
            if syms:
                metrics = (
                    db.query(CompanyMarketMetrics.symbol, CompanyMarketMetrics.market_cap)
                    .filter(CompanyMarketMetrics.symbol.in_(syms))
                    .all()
                )
                mcap_map = {m[0]: m[1] for m in metrics if m[1] is not None}
                comps = (
                    db.query(Company.symbol, Company.market_cap)
                    .filter(Company.symbol.in_(syms))
                    .all()
                )
                for s, mc in comps:
                    if s not in mcap_map and mc and mc not in ("Unknown", "None", ""):
                        try:
                            mcap_map[s] = float(mc)
                        except Exception:
                            pass

            def _row_to_dict(row: MomentumRadarWatchlist) -> Dict[str, Any]:
                return {
                    "id": row.id,
                    "symbol": row.symbol,
                    "company_name": row.company_name,
                    "sector": row.sector,
                    "market_cap_cr": mcap_map.get(row.symbol),
                    "match_count": row.match_count,
                    "conviction_score": row.conviction_score,
                    "conditions_passed": row.conditions_passed or {},
                    "cmp_at_scan": row.cmp_at_scan,
                    "intraday_cmp": row.intraday_cmp,
                    "intraday_match_count": row.intraday_match_count,
                    "daily_rsi_at_scan": row.daily_rsi_at_scan,
                    "weekly_rsi_at_scan": row.weekly_rsi_at_scan,
                    "monthly_rsi_at_scan": row.monthly_rsi_at_scan,
                    "vol_surge_ratio_at_scan": row.vol_surge_ratio_at_scan,
                    "entry_trigger": row.entry_trigger,
                    "stop_loss": row.stop_loss,
                    "target_1": row.target_1,
                    "target_2": row.target_2,
                    "risk_reward": row.risk_reward,
                    "breakout_triggered": row.breakout_triggered,
                    "breakout_triggered_at": row.breakout_triggered_at.isoformat() if row.breakout_triggered_at else None,
                    "last_intraday_check": row.last_intraday_check.isoformat() if row.last_intraday_check else None,
                    "scanned_at": row.scanned_at.isoformat() if row.scanned_at else None,
                    "scan_type": row.scan_type,
                    "universe_size": row.universe_size,
                    "promoted_date": row.promoted_date,
                }

            return {
                "today": today,
                "total_watchlist": len(all_active),
                "breakout_triggered_count": len(breakout_triggered),
                "monitoring_count": len(monitoring),
                "candidates": [_row_to_dict(r) for r in all_active],
                "breakouts": [_row_to_dict(r) for r in breakout_triggered],
            }
        except Exception as e:
            logger.error(f"[IntradayMonitor] Watchlist summary error: {e}")
            return {"today": today, "total_watchlist": 0, "candidates": [], "breakouts": []}

"""
Alpha India — Cup & Handle Orchestrator
========================================
Parallel universe scan with:
  - 16-thread concurrent yfinance fetching
  - Stale-while-revalidate in-memory + disk cache (TTL: 10 min)
  - Nifty 500 benchmark pre-fetch for RS comparison
  - Stage funnel waterfall analytics
  - Thread-safe non-blocking background scan pattern (mirrors MomentumScreenerService)
"""

from __future__ import annotations

import concurrent.futures
import json
import logging
import threading
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
import yfinance as yf
from sqlalchemy.orm import Session

from app.models.company import Company
from app.models.screener_growth_record import ScreenerGrowthRecord
from app.services.cup_handle.cup_handle_engine import analyze_symbol, SECTOR_MAP

logger = logging.getLogger("alpha_india.cup_handle.orchestrator")

# ---------------------------------------------------------------------------
# Cache configuration
# ---------------------------------------------------------------------------
DISK_CACHE_PATH = (
    Path(__file__).resolve().parent.parent.parent.parent
    / "data"
    / "cup_handle_cache.json"
)
CACHE_TTL_SECONDS = 600  # 10 minutes

_CACHE: Dict[str, Any] = {
    "timestamp": 0,
    "data": [],
    "metadata": {},
}
_scan_in_progress = False
_scan_lock = threading.Lock()


# ---------------------------------------------------------------------------
# Liquid NSE universe to scan (same core universe as Momentum Screener)
# ---------------------------------------------------------------------------
CORE_UNIVERSE: List[str] = [
    "AARTIIND", "ABB", "ABBOTINDIA", "ABCAPITAL", "ABFRL", "ACC", "ADANIENT", "ADANIPORTS",
    "ALKEM", "AMBUJACEM", "APOLLOHOSP", "APOLLOTYRE", "ASHOKLEY", "ASIANPAINT", "ASTRAL",
    "ATUL", "AUBANK", "AUROPHARMA", "AXISBANK", "BAJAJ-AUTO", "BAJAJFINSV", "BAJFINANCE",
    "BALKRISIND", "BALRAMCHIN", "BANDHANBNK", "BANKBARODA", "BATAINDIA", "BEL", "BHARATFORG",
    "BHEL", "BIOCON", "BOSCHLTD", "BPCL", "BRITANNIA", "BSOFT", "CANBK", "CANFINHOME",
    "CHAMBLFERT", "CHOLAFIN", "CIPLA", "COALINDIA", "COFORGE", "COLPAL", "CONCOR",
    "COROMANDEL", "CROMPTON", "CUMMINSIND", "DABUR", "DALBHARAT", "DEEPAKNTR", "DIVISLAB",
    "DIXON", "DLF", "DRREDDY", "EICHERMOT", "ESCORTS", "EXIDEIND", "FEDERALBNK", "GAIL",
    "GLENMARK", "GMRAIRPORT", "GNFC", "GODREJCP", "GODREJPROP", "GRANULES", "GRASIM",
    "HAL", "HAVELLS", "HCLTECH", "HDFCAMC", "HDFCBANK", "HDFCLIFE", "HEROMOTOCO", "HINDALCO",
    "HINDCOPPER", "HINDPETRO", "HINDUNILVR", "ICICIBANK", "ICICIGI", "ICICIPRULI", "IDEA",
    "IDFCFIRSTB", "IEX", "INDHOTEL", "INDIAMART", "INDIGO", "INDUSINDBK",
    "INDUSTOWER", "INFY", "IOC", "IPCALAB", "IRCTC", "ITC", "JINDALSTEL", "JKCEMENT",
    "JSWSTEEL", "JUBLFOOD", "KAYNES", "KOTAKBANK", "LALPATHLAB", "LAURUSLABS", "LICHSGFIN", "LT",
    "CYIENT", "LTTS", "LUPIN", "M&M", "M&MFIN", "MANAPPURAM", "MARICO", "MARUTI", "MAZDOCK",
    "MCX", "METROPOLIS", "MFSL", "MGL", "MOTHERSON", "MPHASIS", "MRF", "MUTHOOTFIN",
    "NATIONALUM", "NAUKRI", "NAVINFLUOR", "NESTLEIND", "NMDC", "NTPC", "OBEROIRLTY", "OFSS",
    "ONGC", "PAGEIND", "POONAWALLA", "PERSISTENT", "PETRONET", "PFC", "PIDILITIND", "PIIND", "PNB",
    "POLYCAB", "POWERGRID", "PVRINOX", "RAMCOCEM", "RBLBANK", "RECLTD", "RELIANCE", "SAIL",
    "SBICARD", "SBILIFE", "SBIN", "SHREECEM", "SHRIRAMFIN", "SIEMENS", "SRF", "SUNPHARMA",
    "SUNTV", "SUZLON", "SYNGENE", "TATACHEM", "TATACOMM", "TATACONSUM", "TIINDIA", "TATAPOWER",
    "TATASTEEL", "TCS", "TECHM", "TITAN", "TORNTPHARM", "TRENT", "TVSMOTOR", "UBL",
    "ULTRACEMCO", "UPL", "VEDL", "VOLTAS", "WIPRO", "ZEEL", "COCHINSHIP", "HUDCO",
    "IREDA", "BSE", "CDSL", "ANGELONE", "POLICYBZR", "JIOFIN", "KPITTECH", "TATAELXSI",
]


# ---------------------------------------------------------------------------
# Nifty 500 benchmark fetcher (cached for the session)
# ---------------------------------------------------------------------------
_nifty_close_cache: Optional[pd.Series] = None
_nifty_cache_ts: float = 0.0


def _fetch_nifty_close() -> Optional[pd.Series]:
    global _nifty_close_cache, _nifty_cache_ts
    now = time.time()
    if _nifty_close_cache is not None and (now - _nifty_cache_ts) < 3600:
        return _nifty_close_cache
    try:
        nf = yf.Ticker("^NSEI")
        nf_df = nf.history(period="1y", interval="1d")
        if not nf_df.empty:
            _nifty_close_cache = nf_df["Close"].dropna()
            _nifty_cache_ts = now
            return _nifty_close_cache
    except Exception as e:
        logger.warning(f"[CupHandle] Failed to fetch Nifty benchmark: {e}")
    return None


# ---------------------------------------------------------------------------
# Disk cache helpers
# ---------------------------------------------------------------------------

def _load_disk_cache() -> bool:
    try:
        if DISK_CACHE_PATH.exists():
            with open(DISK_CACHE_PATH, "r", encoding="utf-8") as f:
                cached = json.load(f)
            if cached and isinstance(cached, dict) and cached.get("data"):
                _CACHE["timestamp"] = cached.get("timestamp", 0)
                _CACHE["data"] = cached.get("data", [])
                _CACHE["metadata"] = cached.get("metadata", {})
                logger.info(
                    f"[CupHandle] Restored {len(_CACHE['data'])} patterns from disk cache."
                )
                return True
    except Exception as e:
        logger.warning(f"[CupHandle] Disk cache load error: {e}")
    return False


def _save_disk_cache() -> None:
    try:
        DISK_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(DISK_CACHE_PATH, "w", encoding="utf-8") as f:
            json.dump(_CACHE, f, indent=2)
    except Exception as e:
        logger.warning(f"[CupHandle] Disk cache save error: {e}")


# ---------------------------------------------------------------------------
# Stage funnel analytics
# ---------------------------------------------------------------------------

def compute_stage_funnel(results: List[Dict[str, Any]], total_scanned: int) -> Dict[str, Any]:
    """
    Waterfall attrition across all 8 detection stages.
    """
    total = max(1, total_scanned)
    stages = [
        {"id": "cup_geometry",         "label": "Stage 1 — Cup Geometry (U-shape, depth 15–50%, width ≥ 7w)"},
        {"id": "handle_geometry",      "label": "Stage 2 — Handle Geometry (drift 5–15%, upper half)"},
        {"id": "volume_signature",     "label": "Stage 3 — Volume Signature Score ≥ 10/20"},
        {"id": "trend_integrity",      "label": "Stage 4 — Trend Integrity (RSI zone ok)"},
        {"id": "base_quality",         "label": "Stage 5 — Base Quality (tight action < 3.5%)"},
        {"id": "relative_strength",    "label": "Stage 6 — Relative Strength (outperforms Nifty)"},
        {"id": "fundamentals",         "label": "Stage 7 — Fundamental Quality (revenue/PAT positive)"},
        {"id": "conviction_threshold", "label": "Stage 8 — AI Conviction Score ≥ 60/100"},
    ]

    waterfall = []
    waterfall.append({
        "stage_index": 0,
        "condition_id": "initial_universe",
        "condition_label": "NSE Liquid Universe Scanned",
        "candidates_in": total,
        "passed_count": total,
        "filtered_out_count": 0,
        "attrition_pct": 0.0,
        "retention_pct": 100.0,
        "cumulative_survival_pct": 100.0,
    })

    current = list(results)
    for idx, stage in enumerate(stages, start=1):
        sid = stage["id"]
        in_count = len(current)
        survivors = [r for r in current if r.get("stage_gates", {}).get(sid, False)]
        pass_count = len(survivors)
        filtered = in_count - pass_count
        attrition_pct = round((filtered / max(1, in_count)) * 100.0, 1)
        retention_pct = round((pass_count / max(1, in_count)) * 100.0, 1)
        cumulative = round((pass_count / total) * 100.0, 1)

        waterfall.append({
            "stage_index": idx,
            "condition_id": sid,
            "condition_label": stage["label"],
            "candidates_in": in_count,
            "passed_count": pass_count,
            "filtered_out_count": filtered,
            "attrition_pct": attrition_pct,
            "retention_pct": retention_pct,
            "cumulative_survival_pct": cumulative,
        })
        current = survivors

    # Independent pass rates
    independent = []
    for idx, stage in enumerate(stages, start=1):
        sid = stage["id"]
        passed = sum(1 for r in results if r.get("stage_gates", {}).get(sid, False))
        filtered = total - passed
        independent.append({
            "stage_index": idx,
            "condition_id": sid,
            "condition_label": stage["label"],
            "total_evaluated": total,
            "passed_count": passed,
            "filtered_out_count": filtered,
            "pass_rate_pct": round((passed / total) * 100.0, 1),
            "filter_rate_pct": round((filtered / total) * 100.0, 1),
        })

    final = waterfall[-1]["passed_count"] if waterfall else 0
    return {
        "summary": {
            "initial_universe": total,
            "final_matched_stocks": final,
            "total_filtered_out": total - final,
            "overall_survival_rate_pct": round((final / total) * 100.0, 1),
            "overall_attrition_pct": round(((total - final) / total) * 100.0, 1),
        },
        "sequential_waterfall": waterfall,
        "independent_conditions": independent,
    }


# ---------------------------------------------------------------------------
# Background scan worker
# ---------------------------------------------------------------------------

def trigger_background_scan(db: Optional[Session] = None) -> None:
    """Launches a non-blocking background scan if not already running."""
    global _scan_in_progress
    with _scan_lock:
        if _scan_in_progress:
            return
        _scan_in_progress = True

    def _worker():
        global _scan_in_progress
        try:
            logger.info("[CupHandle] Starting background scan...")
            from app.db.database import SessionLocal
            worker_db = SessionLocal()
            try:
                _execute_full_scan(db=worker_db)
            finally:
                worker_db.close()
            logger.info("[CupHandle] Background scan completed.")
        except Exception as e:
            logger.error(f"[CupHandle] Background scan error: {e}", exc_info=True)
        finally:
            with _scan_lock:
                _scan_in_progress = False

    t = threading.Thread(target=_worker, daemon=True, name="CupHandleScanWorker")
    t.start()


# ---------------------------------------------------------------------------
# Core scan entry-point
# ---------------------------------------------------------------------------

def scan_patterns(
    db: Optional[Session] = None,
    force_refresh: bool = False,
) -> Dict[str, Any]:
    """
    Returns all detected Cup & Handle patterns.
    Stale-while-revalidate pattern: always responds instantly from cache.
    """
    if not _CACHE["data"]:
        _load_disk_cache()

    now = time.time()
    has_cache = bool(_CACHE["data"])
    is_stale = (now - _CACHE.get("timestamp", 0)) > CACHE_TTL_SECONDS

    if has_cache and not force_refresh:
        if is_stale:
            trigger_background_scan(db=db)
        return {"metadata": _CACHE["metadata"], "patterns": _CACHE["data"]}

    if has_cache and force_refresh:
        trigger_background_scan(db=db)
        return {"metadata": _CACHE["metadata"], "patterns": _CACHE["data"]}

    # Cold start — synchronous scan
    return _execute_full_scan(db=db)


def _execute_full_scan(db: Optional[Session] = None) -> Dict[str, Any]:
    """
    Full parallel scan across the liquid NSE universe.
    Fetches Nifty benchmark once, then dispatches 16 concurrent threads.
    """
    t0 = time.time()
    now = t0

    # Pre-fetch Nifty for RS comparison
    nifty_close = _fetch_nifty_close()

    # Build symbol map
    symbols_map: Dict[str, Dict[str, str]] = {}
    for sym in CORE_UNIVERSE:
        symbols_map[sym] = {
            "company_name": sym,
            "sector": SECTOR_MAP.get(sym, "Diversified"),
        }

    if db:
        try:
            top_records = (
                db.query(ScreenerGrowthRecord)
                .filter(
                    ScreenerGrowthRecord.current_price != None,
                    ScreenerGrowthRecord.current_price > 60.0,
                    ScreenerGrowthRecord.market_cap != None,
                )
                .order_by(ScreenerGrowthRecord.market_cap.desc())
                .limit(40)
                .all()
            )
            for r in top_records:
                if r.symbol and r.symbol not in symbols_map:
                    symbols_map[r.symbol] = {
                        "company_name": r.company_name or r.symbol,
                        "sector": r.sector or SECTOR_MAP.get(r.symbol, "Diversified"),
                    }
        except Exception as e:
            logger.warning(f"[CupHandle] DB query for growth records failed: {e}")

    total_attempted = len(symbols_map)
    results: List[Dict[str, Any]] = []

    def _analyze(sym: str, meta: Dict[str, str]) -> Optional[Dict[str, Any]]:
        return analyze_symbol(
            symbol=sym,
            company_name=meta["company_name"],
            sector=meta["sector"],
            db=db,
            nifty_close=nifty_close,
        )

    with concurrent.futures.ThreadPoolExecutor(max_workers=16) as executor:
        futures = {
            executor.submit(_analyze, sym, meta): sym
            for sym, meta in symbols_map.items()
        }
        for future in concurrent.futures.as_completed(futures):
            try:
                result = future.result()
                if result is not None:
                    results.append(result)
            except Exception as ex:
                logger.debug(f"[CupHandle] Scan exception: {ex}")

    # Sort: conviction score desc, then breakout vol ratio desc
    results.sort(
        key=lambda x: (
            x.get("ai_conviction_score", 0),
            x.get("volume", {}).get("breakout_vol_ratio", 0),
        ),
        reverse=True,
    )

    elapsed = round(time.time() - t0, 2)

    elite_count = sum(1 for r in results if r.get("conviction_tier") == "ELITE")
    high_count = sum(1 for r in results if r.get("conviction_tier") == "HIGH CONVICTION")
    developing_count = sum(1 for r in results if r.get("conviction_tier") == "DEVELOPING")
    breakout_ready = sum(1 for r in results if r.get("volume", {}).get("breakout_confirmed", False))
    avg_score = (
        round(float(np.mean([r.get("ai_conviction_score", 0) for r in results])), 1)
        if results else 0.0
    )

    stage_funnel = compute_stage_funnel(results, total_attempted)

    metadata = {
        "total_scanned": total_attempted,
        "patterns_found": len(results),
        "elite_count": elite_count,
        "high_conviction_count": high_count,
        "developing_count": developing_count,
        "breakout_ready_count": breakout_ready,
        "avg_conviction_score": avg_score,
        "scan_duration_seconds": elapsed,
        "last_scan_time": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(now)),
        "stage_funnel": stage_funnel,
    }

    _CACHE["timestamp"] = now
    _CACHE["data"] = results
    _CACHE["metadata"] = metadata

    _save_disk_cache()

    return {"metadata": metadata, "patterns": results}

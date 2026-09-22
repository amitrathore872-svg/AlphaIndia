"""
Alpha India - Live Price Service (Institutional Grade)
Provides high-speed, thread-pool accelerated live market quote resolution
for Indian equities (NSE & BSE) using Yahoo Finance fast_info and Screener fallbacks.
Persists updated quotes into CompanyMarketMetrics and ScreenerGrowthRecord.
"""

import logging
import concurrent.futures
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
import yfinance as yf

from app.models.company_market_metrics import CompanyMarketMetrics
from app.models.company import Company
from app.models.screener_growth_record import ScreenerGrowthRecord
from app.services.yahoo_client import YahooClient

logger = logging.getLogger(__name__)


class LivePriceService:
    """
    Unified real-time quote resolution service across Alpha India engines:
    Portfolio, Watchlists, Techno-Funda, and Breakout Radar.
    """

    @classmethod
    def resolve_single_quote(cls, symbol: str, exchange: str = "NSE") -> Dict[str, Any]:
        """
        Fast resolution of CMP and day change metrics for a single equity ticker.
        Resiliently falls back between .NS and .BO suffixes.
        """
        clean_sym = symbol.strip().upper()
        res: Dict[str, Any] = {
            "symbol": clean_sym,
            "cmp": None,
            "prev_close": None,
            "day_change": None,
            "day_change_pct": None,
            "year_high": None,
            "year_low": None,
            "market_cap": None,
            "source": "UNKNOWN",
        }

        try:
            ticker = YahooClient.resolve_ticker(clean_sym, exchange=exchange)
            fi = getattr(ticker, "fast_info", None)
            if fi:
                # Extract last price with multiple property fallback
                last_price = None
                for attr in ("last_price", "lastPrice", "regularMarketPrice", "regular_market_price"):
                    try:
                        val = getattr(fi, attr, None) if hasattr(fi, attr) else fi.get(attr)
                        if val is not None and float(val) > 0:
                            last_price = float(val)
                            break
                    except Exception:
                        pass

                # Extract previous close
                prev_close = None
                for attr in ("regular_market_previous_close", "previous_close", "regularMarketPreviousClose"):
                    try:
                        val = getattr(fi, attr, None) if hasattr(fi, attr) else fi.get(attr)
                        if val is not None and float(val) > 0:
                            prev_close = float(val)
                            break
                    except Exception:
                        pass

                if last_price is None and prev_close is not None:
                    last_price = prev_close

                if last_price is not None:
                    res["cmp"] = round(last_price, 2)
                    res["source"] = "YAHOO_FAST_INFO"

                if prev_close is not None:
                    res["prev_close"] = round(prev_close, 2)

                if res["cmp"] is not None and res["prev_close"] is not None and res["prev_close"] > 0:
                    diff = res["cmp"] - res["prev_close"]
                    res["day_change"] = round(diff, 2)
                    res["day_change_pct"] = round((diff / res["prev_close"]) * 100.0, 2)

                # 52-week High / Low
                try:
                    yh = getattr(fi, "year_high", None) or fi.get("yearHigh")
                    if yh:
                        res["year_high"] = round(float(yh), 2)
                    yl = getattr(fi, "year_low", None) or fi.get("yearLow")
                    if yl:
                        res["year_low"] = round(float(yl), 2)
                except Exception:
                    pass

                # Market Cap
                try:
                    mc = getattr(fi, "market_cap", None) or fi.get("marketCap")
                    if mc:
                        res["market_cap"] = round(float(mc) / 10000000.0, 2)
                except Exception:
                    pass

        except Exception as err:
            logger.debug(f"[LivePriceService] Failed to fetch live quote for {clean_sym}: {err}")

        return res

    @classmethod
    def get_live_price(
        cls,
        symbol: str,
        exchange: str = "NSE",
        force_refresh: bool = False,
        db: Optional[Session] = None,
    ) -> Dict[str, Any]:
        """
        Retrieves live price with database caching. If force_refresh is True or cached
        metric is missing/stale, triggers fresh live quote resolution.
        """
        clean_sym = symbol.strip().upper()

        if db and not force_refresh:
            metrics = db.query(CompanyMarketMetrics).filter(CompanyMarketMetrics.symbol == clean_sym).first()
            if metrics and metrics.cmp and metrics.cmp > 0:
                comp = db.query(Company).filter(Company.symbol == clean_sym).first()
                return {
                    "symbol": clean_sym,
                    "cmp": round(metrics.cmp, 2),
                    "prev_close": None,
                    "day_change": None,
                    "day_change_pct": None,
                    "pe_ratio": round(metrics.pe_ratio, 2) if metrics.pe_ratio else None,
                    "market_cap": metrics.market_cap,
                    "sector": metrics.sector or (comp.sector if comp else "General"),
                    "company_name": comp.company if comp else clean_sym,
                    "source": "DB_CACHE",
                }

        # Resolve live quote
        live_data = cls.resolve_single_quote(clean_sym, exchange=exchange)

        if db and live_data.get("cmp"):
            cls._persist_quote(db, clean_sym, live_data)

        # Fallback if live price resolution returned None
        if not live_data.get("cmp"):
            if db:
                metrics = db.query(CompanyMarketMetrics).filter(CompanyMarketMetrics.symbol == clean_sym).first()
                comp = db.query(Company).filter(Company.symbol == clean_sym).first()
                if metrics and metrics.cmp and metrics.cmp > 0:
                    live_data["cmp"] = round(metrics.cmp, 2)
                    live_data["sector"] = metrics.sector or (comp.sector if comp else "General")
                    live_data["company_name"] = comp.company if comp else clean_sym
                    live_data["source"] = "DB_FALLBACK"

        return live_data

    @classmethod
    def get_batch_live_prices(
        cls,
        symbols: List[str],
        exchange: str = "NSE",
        force_refresh: bool = True,
        db: Optional[Session] = None,
        max_workers: int = 8,
    ) -> Dict[str, Dict[str, Any]]:
        """
        Fetches live market quotes for a batch of symbols in parallel using ThreadPoolExecutor.
        Persists all successfully resolved quotes to the database in a single transaction.
        """
        cleaned_symbols = list(dict.fromkeys([s.strip().upper() for s in symbols if s and s.strip()]))
        if not cleaned_symbols:
            return {}

        results: Dict[str, Dict[str, Any]] = {}
        symbols_to_fetch = cleaned_symbols

        # If not forcing refresh, check database cache first
        if db and not force_refresh:
            cached_metrics = (
                db.query(CompanyMarketMetrics)
                .filter(CompanyMarketMetrics.symbol.in_(cleaned_symbols))
                .all()
            )
            cached_map = {m.symbol: m for m in cached_metrics if m.cmp and m.cmp > 0}
            symbols_to_fetch = [s for s in cleaned_symbols if s not in cached_map]

            for sym, m in cached_map.items():
                results[sym] = {
                    "symbol": sym,
                    "cmp": round(m.cmp, 2),
                    "prev_close": None,
                    "day_change": None,
                    "day_change_pct": None,
                    "source": "DB_CACHE",
                }

        # Fetch in parallel via thread pool
        if symbols_to_fetch:
            worker_count = min(len(symbols_to_fetch), max_workers)
            with concurrent.futures.ThreadPoolExecutor(max_workers=worker_count) as executor:
                future_to_sym = {
                    executor.submit(cls.resolve_single_quote, sym, exchange): sym
                    for sym in symbols_to_fetch
                }
                for future in concurrent.futures.as_completed(future_to_sym):
                    sym = future_to_sym[future]
                    try:
                        quote = future.result()
                        results[sym] = quote
                    except Exception as e:
                        logger.debug(f"[LivePriceService] Error fetching {sym}: {e}")
                        results[sym] = {"symbol": sym, "cmp": None, "source": "ERROR"}

            # Bulk persist to DB
            if db:
                for sym, quote in results.items():
                    if quote.get("cmp"):
                        try:
                            cls._persist_quote(db, sym, quote)
                        except Exception as e:
                            logger.debug(f"[LivePriceService] Persist error for {sym}: {e}")
                try:
                    db.commit()
                except Exception as e:
                    db.rollback()
                    logger.error(f"[LivePriceService] Failed to commit bulk live quotes: {e}")

        return results

    @classmethod
    def _persist_quote(cls, db: Session, symbol: str, quote: Dict[str, Any]):
        """Helper to sync CompanyMarketMetrics and ScreenerGrowthRecord."""
        cmp_val = quote.get("cmp")
        if not cmp_val or cmp_val <= 0:
            return

        comp = db.query(Company).filter(Company.symbol == symbol).first()
        metrics = db.query(CompanyMarketMetrics).filter(CompanyMarketMetrics.symbol == symbol).first()
        now_utc = datetime.utcnow()
        if not metrics:
            metrics = CompanyMarketMetrics(
                symbol=symbol,
                company_id=comp.id if comp else None,
                cmp=cmp_val,
                market_cap=quote.get("market_cap") or (comp.market_cap if comp else None),
                fifty_two_week_high=quote.get("year_high"),
                fifty_two_week_low=quote.get("year_low"),
                sector=comp.sector if comp else "General",
                last_updated=now_utc,
            )
            db.add(metrics)
        else:
            metrics.cmp = cmp_val
            if quote.get("market_cap"):
                metrics.market_cap = quote["market_cap"]
            if quote.get("year_high"):
                metrics.fifty_two_week_high = quote["year_high"]
            if quote.get("year_low"):
                metrics.fifty_two_week_low = quote["year_low"]
            metrics.last_updated = now_utc

        # Also update ScreenerGrowthRecord if it exists
        screener_rec = db.query(ScreenerGrowthRecord).filter(ScreenerGrowthRecord.symbol == symbol).first()
        if screener_rec:
            screener_rec.current_price = cmp_val
            if quote.get("day_change_pct") is not None:
                screener_rec.daily_return = quote["day_change_pct"]
            screener_rec.updated_at = now_utc

    @classmethod
    def refresh_active_universe_prices(cls, db: Session, limit: int = 50) -> Dict[str, Any]:
        """
        Gathers symbols from active opportunities across Athena, VCP,
        Announcements, and Screener records, and batch-refreshes their CMP & quotes.
        """
        symbols = set()

        try:
            # 1. Athena top candidates
            from app.models.athena_models import AthenaConvictionFlash
            athena_syms = db.query(AthenaConvictionFlash.symbol).order_by(
                AthenaConvictionFlash.published_at.desc()
            ).limit(20).all()
            for (s,) in athena_syms:
                if s: symbols.add(s.strip().upper())
        except Exception as e:
            logger.debug(f"[LivePriceService] Athena symbols fetch: {e}")

        try:
            # 2. VCP top candidates
            from app.models.vcp_models import VCPAIScore
            vcp_syms = db.query(VCPAIScore.symbol).order_by(
                VCPAIScore.scan_date.desc(),
                VCPAIScore.total_score.desc()
            ).limit(20).all()
            for (s,) in vcp_syms:
                if s: symbols.add(s.strip().upper())
        except Exception as e:
            logger.debug(f"[LivePriceService] VCP symbols fetch: {e}")

        try:
            # 3. Top Screener Growth stocks
            screener_syms = db.query(ScreenerGrowthRecord.symbol).order_by(
                ScreenerGrowthRecord.health_score.desc()
            ).limit(20).all()
            for (s,) in screener_syms:
                if s: symbols.add(s.strip().upper())
        except Exception as e:
            logger.debug(f"[LivePriceService] Screener symbols fetch: {e}")

        clean_list = list(symbols)[:limit]
        if not clean_list:
            return {"refreshed_count": 0, "quotes": {}}

        quotes = cls.get_batch_live_prices(clean_list, force_refresh=True, db=db, max_workers=6)
        logger.info(f"[LivePriceService] Batch refreshed {len(quotes)} active universe equity quotes.")
        return {"refreshed_count": len(quotes), "quotes": quotes}


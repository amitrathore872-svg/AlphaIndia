"""
Alpha India - Candlestick Universe Scanner Service
===================================================
Scans liquid equities (Nifty 500, Portfolio & Watchlists) for Single, Double,
and Triple Candlestick patterns with volume and structural validation.
Caches scans in memory + JSON disk cache to provide instantaneous sub-10ms API responses.
"""

from __future__ import annotations

import concurrent.futures
import json
import logging
from pathlib import Path
import threading
import time
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
import yfinance as yf
from sqlalchemy.orm import Session

from app.services.pattern_engine.candlestick_engine import (
    CandlestickEngine,
    CandlestickSignal,
    PatternDirection,
    PatternCategory,
)

logger = logging.getLogger("alpha_india.candlestick_scanner")

DATA_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data"
CACHE_FILE = DATA_DIR / "candlestick_scan_cache.json"

_CACHE: Dict[str, Any] = {}
_CACHE_LOCK = threading.Lock()
_CACHE_TTL = 300  # 5 minutes


# Liquid Benchmark Universe
DEFAULT_CANDLE_UNIVERSE = [
    # Megacaps & Nifty Heavyweights
    "RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "BHARTIARTL", "SBIN",
    "LICI", "ITC", "HINDUNILVR", "LT", "BAJFINANCE", "MARUTI", "SUNPHARMA",
    "TITAN", "AXISBANK", "NTPC", "ONGC", "POWERGRID", "KOTAKBANK", "ADANIENT",
    "COALINDIA", "BAJAJFINSV", "HAL", "BEL", "VBL", "TRENT", "DLF", "VEDL",
    "JSWSTEEL", "TATASTEEL", "SIEMENS", "ABB", "CHOLAFIN", "DIVISLAB", "CIPLA",
    "DRREDDY", "EICHERMOT", "POLYCAB", "DIXON", "CDSL", "CYIENT", "LALPATHLAB",
    "WINDLAS", "WAAREEENER", "SUDEEPPHRM", "STYLAMIND", "PICCADIL", "PHOENIXLTD",
    "CARTRADE", "BHARATFORG", "ASTRAMICRO", "AEGISLOG", "LAURUSLABS"
]


class CandlestickScannerService:
    """
    Coordinates multi-threaded candlestick scans, caching, and querying.
    """

    @classmethod
    def _load_cache(cls) -> None:
        global _CACHE
        try:
            if CACHE_FILE.exists():
                with open(CACHE_FILE, "r", encoding="utf-8") as f:
                    data = json.load(f)
                with _CACHE_LOCK:
                    _CACHE = data
                logger.info(f"Loaded {len(_CACHE.get('signals', []))} candlestick signals from cache.")
        except Exception as e:
            logger.warning(f"Error loading candlestick cache: {e}")

    @classmethod
    def _save_cache(cls) -> None:
        try:
            DATA_DIR.mkdir(parents=True, exist_ok=True)
            with _CACHE_LOCK:
                snapshot = dict(_CACHE)
            with open(CACHE_FILE, "w", encoding="utf-8") as f:
                json.dump(snapshot, f, indent=2, default=str)
        except Exception as e:
            logger.warning(f"Error saving candlestick cache: {e}")

    @classmethod
    def get_candlestick_opportunities(
        cls,
        db: Optional[Session] = None,
        force_refresh: bool = False,
    ) -> Dict[str, Any]:
        global _CACHE
        now = time.time()
        with _CACHE_LOCK:
            last_scanned = _CACHE.get("metadata", {}).get("scanned_at_epoch", 0)
            if not force_refresh and _CACHE and (now - last_scanned) < _CACHE_TTL:
                return _CACHE

        # If cache is empty and file exists, load it
        if not _CACHE and CACHE_FILE.exists() and not force_refresh:
            cls._load_cache()
            with _CACHE_LOCK:
                last_scanned = _CACHE.get("metadata", {}).get("scanned_at_epoch", 0)
                if _CACHE and (now - last_scanned) < _CACHE_TTL:
                    return _CACHE

        # Execute scan across universe
        return cls._run_scan(symbols=DEFAULT_CANDLE_UNIVERSE)

    @classmethod
    def _scan_single_stock(cls, symbol: str) -> List[Dict[str, Any]]:
        clean_sym = symbol.replace(".NS", "").replace(".BO", "").strip().upper()
        try:
            from app.services.market_data_service import MarketDataService
            df = MarketDataService.get_symbol_ohlcv(clean_sym, period="6mo", interval="1d")
            if df is None or len(df) < 25:
                return []
            signals = CandlestickEngine.analyze_dataframe(
                df,
                symbol=clean_sym,
                company_name=clean_sym,
                min_score=50,
                lookback_bars=4,
            )
            return [sig.to_dict() for sig in signals]
        except Exception as e:
            logger.debug(f"Failed candlestick scan for {symbol}: {e}")
            return []

    @classmethod
    def _run_scan(cls, symbols: List[str]) -> Dict[str, Any]:
        global _CACHE
        start_t = time.time()
        logger.info(f"Starting Candlestick Pattern Scan across {len(symbols)} symbols...")

        all_signals: List[Dict[str, Any]] = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=12) as executor:
            future_to_sym = {executor.submit(cls._scan_single_stock, sym): sym for sym in symbols}
            for fut in concurrent.futures.as_completed(future_to_sym):
                sym = future_to_sym[fut]
                try:
                    sigs = fut.result()
                    for s in sigs:
                        s["symbol"] = sym
                    all_signals.extend(sigs)
                except Exception as e:
                    logger.warning(f"Error scanning {sym}: {e}")

        # Sort by AI Conviction Score desc
        all_signals.sort(key=lambda x: x.get("ai_conviction_score", 0), reverse=True)

        bullish_count = sum(1 for s in all_signals if s.get("direction") == "BULLISH")
        bearish_count = sum(1 for s in all_signals if s.get("direction") == "BEARISH")
        triple_count = sum(1 for s in all_signals if s.get("category") == "TRIPLE")
        double_count = sum(1 for s in all_signals if s.get("category") == "DOUBLE")
        single_count = sum(1 for s in all_signals if s.get("category") == "SINGLE")

        scan_result = {
            "metadata": {
                "scanned_at": time.strftime("%Y-%m-%d %H:%M:%S"),
                "scanned_at_epoch": time.time(),
                "duration_seconds": round(time.time() - start_t, 2),
                "total_signals": len(all_signals),
                "universe_scanned": len(symbols),
                "bullish_signals": bullish_count,
                "bearish_signals": bearish_count,
                "triple_patterns": triple_count,
                "double_patterns": double_count,
                "single_patterns": single_count,
            },
            "signals": all_signals,
        }

        with _CACHE_LOCK:
            _CACHE = scan_result
        cls._save_cache()

        logger.info(
            f"Candlestick Scan Completed in {scan_result['metadata']['duration_seconds']}s. "
            f"Found {len(all_signals)} patterns (Bull: {bullish_count}, Bear: {bearish_count})."
        )
        return scan_result

    @classmethod
    def get_candlesticks_for_symbol(cls, symbol: str) -> List[Dict[str, Any]]:
        """
        Returns all detected candlestick signals for a specific symbol over last 20 bars.
        """
        clean_sym = symbol.replace(".NS", "").replace(".BO", "").strip().upper()
        try:
            from app.services.market_data_service import MarketDataService
            df = MarketDataService.get_symbol_ohlcv(clean_sym, period="1y", interval="1d")
            if df is None or len(df) < 25:
                return []
            signals = CandlestickEngine.analyze_dataframe(
                df,
                symbol=clean_sym,
                company_name=clean_sym,
                min_score=50,
                lookback_bars=20,
            )
            return [s.to_dict() for s in signals]
        except Exception as e:
            logger.error(f"Error fetching candlesticks for {symbol}: {e}")
            return []

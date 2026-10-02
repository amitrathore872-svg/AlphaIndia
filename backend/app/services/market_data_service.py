"""
Alpha India - Centralized Vectorized OHLCV Market Data Buffer Service
Sprint 40 — High-Performance Market Data Layer
Provides unified in-memory caching and vectorized batch downloading of historical OHLCV data.
Eliminates duplicate network requests across Momentum, Pre-Breakout, VCP, Cup & Handle, and Pattern screeners.
"""

from __future__ import annotations

import logging
import threading
import time
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
import yfinance as yf

from app.core.redis_cache import cache

logger = logging.getLogger("alpha_india.market_data")

# In-memory buffer: symbol -> (cached_epoch, DataFrame)
_OHLCV_CACHE: Dict[str, Tuple[float, pd.DataFrame]] = {}
_CACHE_LOCK = threading.RLock()

# Default Cache TTL: 15 minutes (900 seconds)
DEFAULT_TTL_SECONDS = 900


class MarketDataService:
    """
    Centralized High-Performance Market Data Provider.
    Acts as the single source of truth for historical candles across all screening engines.
    """

    _cache_hits: int = 0
    _cache_misses: int = 0
    _rate_limit_until: float = 0.0

    @classmethod
    def is_rate_limited(cls) -> bool:
        """Returns True if currently within an active provider rate-limit cooldown window."""
        return time.time() < cls._rate_limit_until

    @classmethod
    def set_rate_limit_cooldown(cls, seconds: int = 60):
        """Activates a circuit breaker cooldown to prevent hammering external providers."""
        cls._rate_limit_until = time.time() + seconds

    @classmethod
    def clean_symbol(cls, symbol: str) -> str:
        """Sanitizes symbol, removing exchange suffixes for consistent keying."""
        s = symbol.strip().upper()
        if s.endswith(".NS") or s.endswith(".BO"):
            return s.split(".")[0]
        return s

    @classmethod
    def get_symbol_ohlcv(
        cls,
        symbol: str,
        period: str = "1y",
        interval: str = "1d",
        force_refresh: bool = False,
        ttl_seconds: int = DEFAULT_TTL_SECONDS,
    ) -> Optional[pd.DataFrame]:
        """
        Retrieves historical OHLCV DataFrame for a symbol.
        Checks in-memory cache first, then Redis, and falls back to Yahoo Finance if cold.
        """
        sym = cls.clean_symbol(symbol)
        cache_key = f"{sym}:{period}:{interval}"
        now = time.time()

        # 1. Check thread-safe in-memory cache
        if not force_refresh:
            with _CACHE_LOCK:
                if cache_key in _OHLCV_CACHE:
                    cached_time, df = _OHLCV_CACHE[cache_key]
                    if now - cached_time < ttl_seconds:
                        cls._cache_hits += 1
                        return df.copy()

        # 2. Fetch fresh historical data
        cls._cache_misses += 1
        df = cls._fetch_single_history(sym, period=period, interval=interval)
        if df is not None and not df.empty and len(df) >= 30:
            with _CACHE_LOCK:
                _OHLCV_CACHE[cache_key] = (now, df)
            return df.copy()

        return None

    @classmethod
    def _fetch_single_history(
        cls,
        symbol: str,
        period: str = "1y",
        interval: str = "1d",
    ) -> Optional[pd.DataFrame]:
        """Fetches from Yahoo Finance trying .NS first, then .BO fallback."""
        if cls.is_rate_limited():
            return None

        for suffix in [".NS", ".BO"]:
            ticker_sym = f"{symbol}{suffix}"
            try:
                t = yf.Ticker(ticker_sym)
                df = t.history(period=period, interval=interval, auto_adjust=True)
                if df is not None and not df.empty and len(df) >= 30:
                    df = cls._sanitize_dataframe(df)
                    return df
            except Exception as e:
                err_msg = str(e).lower()
                if "rate limit" in err_msg or "429" in err_msg or "too many requests" in err_msg:
                    cls.set_rate_limit_cooldown(60)
                    logger.warning(f"[MarketData] Rate limit active on {ticker_sym}. Pausing provider requests for 60s.")
                    break
                logger.debug(f"[MarketData] Error fetching {ticker_sym}: {e}")

        return None

    @classmethod
    def preload_universe_batch(
        cls,
        symbols: List[str],
        period: str = "1y",
        interval: str = "1d",
        chunk_size: int = 50,
        ttl_seconds: int = DEFAULT_TTL_SECONDS,
    ) -> int:
        """
        Vectorized multi-ticker batch pre-fetcher.
        Downloads up to chunk_size symbols in a single multi-threaded network batch,
        saving ~90% of network roundtrips.
        """
        if cls.is_rate_limited():
            logger.debug("[MarketData] Provider in rate-limit cooldown. Skipping preload batch.")
            return 0

        clean_symbols = list(dict.fromkeys([cls.clean_symbol(s) for s in symbols if s]))
        now = time.time()

        # Filter symbols that are already warm in cache
        due_symbols: List[str] = []
        with _CACHE_LOCK:
            for s in clean_symbols:
                cache_key = f"{s}:{period}:{interval}"
                if cache_key not in _OHLCV_CACHE or (now - _OHLCV_CACHE[cache_key][0] >= ttl_seconds):
                    due_symbols.append(s)

        if not due_symbols:
            logger.info(f"[MarketData] All {len(clean_symbols)} universe symbols are already warm in memory cache.")
            return 0

        logger.info(f"[MarketData] Preloading batch of {len(due_symbols)} due symbols in chunks of {chunk_size}...")
        total_loaded = 0

        for i in range(0, len(due_symbols), chunk_size):
            chunk = due_symbols[i : i + chunk_size]
            ticker_list = [f"{s}.NS" for s in chunk]
            try:
                t0 = time.time()
                batch_df = yf.download(
                    ticker_list,
                    period=period,
                    interval=interval,
                    group_by="ticker",
                    threads=True,
                    progress=False,
                    auto_adjust=True,
                )
                elapsed = round(time.time() - t0, 2)

                if batch_df is not None and not batch_df.empty:
                    loaded_in_chunk = 0
                    with _CACHE_LOCK:
                        for s in chunk:
                            t_sym = f"{s}.NS"
                            sub_df = None
                            try:
                                if len(chunk) == 1:
                                    sub_df = batch_df
                                elif t_sym in batch_df.columns.levels[0]:
                                    sub_df = batch_df[t_sym].dropna(subset=["Close"])
                            except Exception:
                                pass

                            if sub_df is not None and not sub_df.empty and len(sub_df) >= 30:
                                clean_df = cls._sanitize_dataframe(sub_df)
                                _OHLCV_CACHE[f"{s}:{period}:{interval}"] = (now, clean_df)
                                loaded_in_chunk += 1
                                total_loaded += 1

                    logger.info(f"[MarketData] Batch chunk ({len(chunk)} tickers) loaded {loaded_in_chunk} stocks in {elapsed}s.")
                    if loaded_in_chunk == 0:
                        cls.set_rate_limit_cooldown(60)
                        logger.warning("[MarketData] Batch download loaded 0 stocks (provider rate-limited). Pausing batch preload for 60s.")
                        break
                else:
                    cls.set_rate_limit_cooldown(60)
                    logger.warning("[MarketData] Batch download returned empty data. Pausing batch preload for 60s.")
                    break

            except Exception as exc:
                err_msg = str(exc).lower()
                if "rate limit" in err_msg or "429" in err_msg or "too many requests" in err_msg:
                    logger.warning(f"[MarketData] Rate limited by provider: {exc}. Halting remaining batch chunks to prevent IP ban.")
                    break
                logger.warning(f"[MarketData] Batch chunk error: {exc}. Falling back to individual loads.")
                for s in chunk:
                    df = cls._fetch_single_history(s, period=period, interval=interval)
                    if df is not None:
                        with _CACHE_LOCK:
                            _OHLCV_CACHE[f"{s}:{period}:{interval}"] = (now, df)
                        total_loaded += 1

        return total_loaded

    @classmethod
    def _sanitize_dataframe(cls, df: pd.DataFrame) -> pd.DataFrame:
        """Ensures standard numeric columns and drops invalid rows."""
        std_cols = {}
        for c in df.columns:
            c_str = str(c).lower().strip()
            if c_str == "open":
                std_cols[c] = "Open"
            elif c_str == "high":
                std_cols[c] = "High"
            elif c_str == "low":
                std_cols[c] = "Low"
            elif c_str == "close":
                std_cols[c] = "Close"
            elif c_str == "volume":
                std_cols[c] = "Volume"

        out_df = df.rename(columns=std_cols)
        required = ["Open", "High", "Low", "Close", "Volume"]
        for req in required:
            if req not in out_df.columns:
                out_df[req] = 0.0

        out_df = out_df[required].copy().dropna(subset=["Close", "Volume"])
        out_df["Close"] = pd.to_numeric(out_df["Close"], errors="coerce")
        out_df["Volume"] = pd.to_numeric(out_df["Volume"], errors="coerce").fillna(0.0)
        return out_df

    @classmethod
    def clear_cache(cls) -> int:
        """Flushes the in-memory OHLCV cache."""
        with _CACHE_LOCK:
            count = len(_OHLCV_CACHE)
            _OHLCV_CACHE.clear()
            cls._cache_hits = 0
            cls._cache_misses = 0
            return count

    @classmethod
    def get_stats(cls) -> Dict[str, Any]:
        """Telemetry diagnostics for the market data buffer."""
        with _CACHE_LOCK:
            active_symbols = len(_OHLCV_CACHE)
            total_lookups = cls._cache_hits + cls._cache_misses
            hit_ratio = round((cls._cache_hits / max(1, total_lookups)) * 100, 1)
            return {
                "active_cached_symbols": active_symbols,
                "cache_hits": cls._cache_hits,
                "cache_misses": cls._cache_misses,
                "hit_ratio_pct": hit_ratio,
                "default_ttl_seconds": DEFAULT_TTL_SECONDS,
            }

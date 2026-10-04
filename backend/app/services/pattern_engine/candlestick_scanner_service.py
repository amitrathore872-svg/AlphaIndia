"""
Alpha India - Candlestick Universe Scanner Service
===================================================
Institutional-grade scanner for Single, Double, and Triple Candlestick patterns
across the complete NSE Nifty 500 equity universe with volume and structural validation.
Caches scans in memory + JSON disk cache to provide instantaneous sub-10ms API responses.
"""

from __future__ import annotations

import concurrent.futures
import json
import logging
from pathlib import Path
import threading
import time
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
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
NIFTY500_CSV = DATA_DIR / "ind_nifty500list.csv"

_CACHE: Dict[str, Dict[str, Any]] = {}
_CACHE_LOCK = threading.Lock()
_CACHE_TTL = 14400  # 4 hours TTL

# Known inactive / unlisted / problematic tickers to exclude
EXCLUDED_TICKERS = {"BAGMANE", "DUMMYHEG"}

# Nifty 50 Benchmark Heavyweights
NIFTY_50_SYMBOLS = [
    "RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "BHARTIARTL", "SBIN",
    "LICI", "ITC", "HINDUNILVR", "LT", "BAJFINANCE", "HCLTECH", "MARUTI", "SUNPHARMA",
    "ADANIENT", "KOTAKBANK", "TITAN", "ONGC", "TATAMOTORS", "NTPC", "AXISBANK",
    "ADANIPORTS", "POWERGRID", "COALINDIA", "TATASTEEL", "M&M", "BAJAJFINSV", "SIEMENS",
    "ULTRACEMCO", "IOC", "BPCL", "ASIANPAINT", "HAL", "BEL", "NESTLEIND", "ZOMATO",
    "JSWSTEEL", "TRENT", "VBL", "GRASIM", "TECHM", "HINDALCO", "LTIM", "DLF",
    "EICHERMOT", "DIVISLAB", "CIPLA", "INDIGO", "APOLLOHOSP", "DRREDDY", "SHRIRAMFIN"
]

# Liquid Active F&O Equities (~180 symbols)
FNO_SYMBOLS = [
    "AARTIIND", "ABB", "ABBOTINDIA", "ABCAPITAL", "ABFRL", "ACC", "ADANIENT",
    "ADANIPORTS", "ALKEM", "AMBUJACEM", "APOLLOHOSP", "APOLLOTYRE", "ASHOKLEY",
    "ASIANPAINT", "ASTRAL", "ATUL", "AUBANK", "AUROPHARMA", "AXISBANK", "BAJAJ-AUTO",
    "BAJAJFINSV", "BAJFINANCE", "BALKRISIND", "BANDHANBNK", "BANKBARODA", "BATAINDIA",
    "BEL", "BHARATFORG", "BHARTIARTL", "BHEL", "BIOCON", "BOSCHLTD", "BPCL",
    "BRITANNIA", "BSOFT", "CANBK", "CANFINHOME", "CHAMBLFERT", "CHOLAFIN", "CIPLA",
    "COALINDIA", "COFORGE", "COLPAL", "CONCOR", "COROMANDEL", "CROMPTON", "CUMMINSIND",
    "CYIENT", "DABUR", "DALBHARAT", "DEEPAKNTR", "DIVISLAB", "DIXON", "DLF",
    "DRREDDY", "EICHERMOT", "ESCORTS", "EXIDEIND", "FEDERALBNK", "GAIL", "GLENMARK",
    "GMRINFRA", "GNFC", "GODREJCP", "GODREJPROP", "GRANULES", "GRASIM", "GUJGASLTD",
    "HAL", "HAVELLS", "HCLTECH", "HDFCAMC", "HDFCBANK", "HDFCLIFE", "HEROMOTOCO",
    "HINDALCO", "HINDCOPPER", "HINDPETRO", "HINDUNILVR", "ICICIBANK", "ICICIGI",
    "ICICIPRULI", "IDEA", "IDFCFIRSTB", "IEX", "INDHOTEL", "INDIACEM", "INDIAMART",
    "INDIGO", "INDUSINDBK", "INDUSTOWER", "INFY", "IOC", "IPCALAB", "IRCTC",
    "ITC", "JINDALSTEL", "JKCEMENT", "JSWSTEEL", "JUBLFOOD", "KOTAKBANK", "LALPATHLAB",
    "LAURUSLABS", "LICHSGFIN", "LICI", "LT", "LTIM", "LTTS", "LUPIN", "M&M",
    "M&MFIN", "MANAPPURAM", "MARICO", "MARUTI", "MCDOWELL-N", "MCX", "METROPOLIS",
    "MFSL", "MGL", "MOTHERSON", "MPHASIS", "MRF", "MUTHOOTFIN", "NATIONALUM",
    "NAVINFLUOR", "NESTLEIND", "NMDC", "NTPC", "OBEROIRLTY", "OFSS", "ONGC",
    "PAGEIND", "PEL", "PERSISTENT", "PETRONET", "PFC", "PIDILITIND", "PIIND",
    "PNB", "POLYCAB", "POWERGRID", "PVRINOX", "RAMCOCEM", "RBLBANK", "RECLTD",
    "RELIANCE", "SAIL", "SBICARD", "SBILIFE", "SBIN", "SHREECEM", "SHRIRAMFIN",
    "SIEMENS", "SRF", "SUNPHARMA", "SUNTV", "SYNGENE", "TATACHEM", "TATACOMM",
    "TATACONSUM", "TATAMOTORS", "TATAPOWER", "TATASTEEL", "TCS", "TECHM", "TITAN",
    "TORNTPHARM", "TRENT", "TVSMOTOR", "UBL", "ULTRACEMCO", "UPL", "VEDL", "VOLTAS",
    "WIPRO", "ZEEL", "ZOMATO"
]


class CandlestickScannerService:
    """
    Coordinates multi-threaded candlestick scans, caching, and querying across Nifty 500.
    """

    _nifty500_meta_cache: Dict[str, Dict[str, str]] = {}

    @classmethod
    def get_universe_symbols_and_meta(cls, universe: str = "NIFTY_500") -> Tuple[List[str], Dict[str, Dict[str, str]]]:
        """
        Loads clean symbols and company metadata based on requested universe scope.
        """
        # 1. Ensure Nifty 500 master list is loaded
        if not cls._nifty500_meta_cache:
            meta: Dict[str, Dict[str, str]] = {}
            if NIFTY500_CSV.exists():
                try:
                    df = pd.read_csv(NIFTY500_CSV)
                    for _, row in df.iterrows():
                        sym = str(row.get("Symbol", "")).strip().upper()
                        if sym and sym not in EXCLUDED_TICKERS:
                            cname = str(row.get("Company Name", sym)).strip()
                            sector = str(row.get("Industry", "Diversified")).strip()
                            meta[sym] = {"company_name": cname, "sector": sector}
                except Exception as e:
                    logger.warning(f"[CandlestickScanner] Error reading {NIFTY500_CSV}: {e}")

            cls._nifty500_meta_cache = meta

        all_meta = cls._nifty500_meta_cache
        u = universe.strip().upper() if universe else "NIFTY_500"

        if u == "NIFTY_50":
            syms = [s for s in NIFTY_50_SYMBOLS if s not in EXCLUDED_TICKERS]
            subset_meta = {s: all_meta.get(s, {"company_name": s, "sector": "Large Cap"}) for s in syms}
            return syms, subset_meta

        elif u == "FNO":
            syms = [s for s in FNO_SYMBOLS if s not in EXCLUDED_TICKERS]
            subset_meta = {s: all_meta.get(s, {"company_name": s, "sector": "Derivatives F&O"}) for s in syms}
            return syms, subset_meta

        else:  # Default to NIFTY_500
            syms = list(all_meta.keys())
            if not syms:
                # Fallback if CSV is not found
                syms = list(NIFTY_50_SYMBOLS)
                return syms, {s: {"company_name": s, "sector": "Diversified"} for s in syms}
            return syms, all_meta

    @classmethod
    def _get_cache_file_for_universe(cls, universe: str) -> Path:
        u = universe.strip().upper()
        if u == "NIFTY_500" or not u:
            return CACHE_FILE
        return DATA_DIR / f"candlestick_scan_cache_{u.lower()}.json"

    @classmethod
    def _load_cache(cls, universe: str = "NIFTY_500") -> Optional[Dict[str, Any]]:
        global _CACHE
        u = universe.strip().upper()
        cache_file = cls._get_cache_file_for_universe(u)
        try:
            if cache_file.exists():
                with open(cache_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                signals = data.get("signals", [])
                if len(signals) > 0:
                    with _CACHE_LOCK:
                        _CACHE[u] = data
                    logger.info(f"Loaded {len(signals)} candlestick signals from {cache_file.name}.")
                    return data
            
            # Resilient fallback: if NIFTY_500 is empty or missing, load FNO universe cache
            if u == "NIFTY_500":
                fno_file = DATA_DIR / "candlestick_scan_cache_fno.json"
                if fno_file.exists():
                    with open(fno_file, "r", encoding="utf-8") as f:
                        fno_data = json.load(f)
                    if len(fno_data.get("signals", [])) > 0:
                        logger.info(f"Loaded {len(fno_data['signals'])} signals from FNO cache as fallback for NIFTY_500.")
                        with _CACHE_LOCK:
                            _CACHE[u] = fno_data
                        return fno_data
        except Exception as e:
            logger.warning(f"Error loading candlestick cache for {u}: {e}")
        return None

    @classmethod
    def _save_cache(cls, universe: str, data: Dict[str, Any]) -> None:
        u = universe.strip().upper()
        # Never overwrite an existing populated cache with empty signals
        if len(data.get("signals", [])) == 0:
            logger.warning(f"Refusing to save empty candlestick cache for {u}.")
            return

        cache_file = cls._get_cache_file_for_universe(u)
        try:
            DATA_DIR.mkdir(parents=True, exist_ok=True)
            with _CACHE_LOCK:
                _CACHE[u] = data
            with open(cache_file, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, default=str)
            # If Nifty 500, also ensure CACHE_FILE is in sync for legacy callers
            if u == "NIFTY_500" and cache_file != CACHE_FILE:
                with open(CACHE_FILE, "w", encoding="utf-8") as f:
                    json.dump(data, f, indent=2, default=str)
        except Exception as e:
            logger.warning(f"Error saving candlestick cache for {u}: {e}")

    @classmethod
    def get_candlestick_opportunities(
        cls,
        universe: str = "NIFTY_500",
        db: Optional[Session] = None,
        force_refresh: bool = False,
    ) -> Dict[str, Any]:
        global _CACHE
        u = universe.strip().upper() if universe else "NIFTY_500"
        now = time.time()

        with _CACHE_LOCK:
            cached_data = _CACHE.get(u)
            if cached_data and not force_refresh:
                last_scanned = cached_data.get("metadata", {}).get("scanned_at_epoch", 0)
                if (now - last_scanned) < _CACHE_TTL:
                    return cached_data

        # Try loading from disk cache
        if not force_refresh:
            disk_data = cls._load_cache(u)
            if disk_data:
                last_scanned = disk_data.get("metadata", {}).get("scanned_at_epoch", 0)
                if (now - last_scanned) < _CACHE_TTL:
                    return disk_data

        # Execute scan across specified universe
        symbols, meta_map = cls.get_universe_symbols_and_meta(u)
        return cls._run_scan(symbols=symbols, meta_map=meta_map, universe_name=u)

    @classmethod
    def _scan_single_stock(cls, symbol: str, company_name: str, sector: str) -> List[Dict[str, Any]]:
        clean_sym = symbol.replace(".NS", "").replace(".BO", "").strip().upper()
        try:
            from app.services.market_data_service import MarketDataService
            df = MarketDataService.get_symbol_ohlcv(clean_sym, period="6mo", interval="1d")
            if df is None or len(df) < 25:
                return []
            signals = CandlestickEngine.analyze_dataframe(
                df,
                symbol=clean_sym,
                company_name=company_name,
                min_score=50,
                lookback_bars=4,
            )
            out: List[Dict[str, Any]] = []
            for sig in signals:
                d = sig.to_dict()
                d["symbol"] = clean_sym
                d["company_name"] = company_name
                d["sector"] = sector
                out.append(d)
            return out
        except Exception as e:
            logger.debug(f"Failed candlestick scan for {symbol}: {e}")
            return []

    @classmethod
    def _run_scan(cls, symbols: List[str], meta_map: Dict[str, Dict[str, str]], universe_name: str = "NIFTY_500") -> Dict[str, Any]:
        start_t = time.time()
        logger.info(f"Starting Candlestick Pattern Scan across {len(symbols)} symbols ({universe_name})...")

        # 1. Preload OHLCV data in high-performance vectorized chunks
        try:
            from app.services.market_data_service import MarketDataService
            MarketDataService.preload_universe_batch(symbols, period="6mo", interval="1d", chunk_size=50)
        except Exception as e:
            logger.warning(f"[CandlestickScanner] Preload batch warning: {e}")

        # 2. Multi-threaded scanning across equities
        all_signals: List[Dict[str, Any]] = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=16) as executor:
            future_to_sym = {
                executor.submit(
                    cls._scan_single_stock,
                    sym,
                    meta_map.get(sym, {}).get("company_name", sym),
                    meta_map.get(sym, {}).get("sector", "Diversified"),
                ): sym
                for sym in symbols
            }
            for fut in concurrent.futures.as_completed(future_to_sym):
                sym = future_to_sym[fut]
                try:
                    sigs = fut.result()
                    for s in sigs:
                        s["universe"] = universe_name
                    all_signals.extend(sigs)
                except Exception as e:
                    logger.warning(f"Error scanning {sym}: {e}")

        # Safeguard: if scan produced 0 signals (e.g. provider rate limit), do not overwrite with empty result
        if len(all_signals) == 0:
            existing = cls._load_cache(universe_name)
            if existing and len(existing.get("signals", [])) > 0:
                logger.warning(f"Scan produced 0 signals for {universe_name}. Preserving previous {len(existing['signals'])} signals.")
                return existing

        # Sort by AI Conviction Score desc
        all_signals.sort(key=lambda x: x.get("ai_conviction_score", 0), reverse=True)

        bullish_count = sum(1 for s in all_signals if s.get("direction") == "BULLISH")
        bearish_count = sum(1 for s in all_signals if s.get("direction") == "BEARISH")
        triple_count = sum(1 for s in all_signals if s.get("category") == "TRIPLE")
        double_count = sum(1 for s in all_signals if s.get("category") == "DOUBLE")
        single_count = sum(1 for s in all_signals if s.get("category") == "SINGLE")

        elite_count = sum(1 for s in all_signals if s.get("ai_conviction_score", 0) >= 90)
        high_conv_count = sum(1 for s in all_signals if 80 <= s.get("ai_conviction_score", 0) < 90)
        moderate_count = sum(1 for s in all_signals if 65 <= s.get("ai_conviction_score", 0) < 80)
        speculative_count = sum(1 for s in all_signals if s.get("ai_conviction_score", 0) < 65)

        avg_score = round(
            float(np.mean([s.get("ai_conviction_score", 0) for s in all_signals]))
            if all_signals else 0.0,
            1
        )

        scan_result = {
            "metadata": {
                "scanned_at": time.strftime("%Y-%m-%d %H:%M:%S"),
                "scanned_at_epoch": time.time(),
                "duration_seconds": round(time.time() - start_t, 2),
                "total_signals": len(all_signals),
                "universe_scanned": len(symbols),
                "universe_name": universe_name,
                "bullish_signals": bullish_count,
                "bearish_signals": bearish_count,
                "triple_patterns": triple_count,
                "double_patterns": double_count,
                "single_patterns": single_count,
                "elite_signals": elite_count,
                "high_conviction_signals": high_conv_count,
                "moderate_signals": moderate_count,
                "speculative_signals": speculative_count,
                "avg_conviction_score": avg_score,
            },
            "signals": all_signals,
        }

        cls._save_cache(universe_name, scan_result)

        logger.info(
            f"Candlestick Scan Completed in {scan_result['metadata']['duration_seconds']}s across {universe_name}. "
            f"Found {len(all_signals)} patterns (Elite: {elite_count}, High: {high_conv_count}, Bull: {bullish_count}, Bear: {bearish_count})."
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
            
            cname = clean_sym
            sector = "Diversified"
            if clean_sym in cls._nifty500_meta_cache:
                cname = cls._nifty500_meta_cache[clean_sym].get("company_name", clean_sym)
                sector = cls._nifty500_meta_cache[clean_sym].get("sector", "Diversified")

            signals = CandlestickEngine.analyze_dataframe(
                df,
                symbol=clean_sym,
                company_name=cname,
                min_score=50,
                lookback_bars=20,
            )
            res = []
            for s in signals:
                d = s.to_dict()
                d["symbol"] = clean_sym
                d["company_name"] = cname
                d["sector"] = sector
                res.append(d)
            return res
        except Exception as e:
            logger.error(f"Error fetching candlesticks for {symbol}: {e}")
            return []

    @classmethod
    def group_signals_by_stock(cls, signals: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Consolidates multiple pattern occurrences for each stock into a single institutional stock row.
        Attaches multi-pattern cluster bonuses, pattern lists, and selects the highest-conviction primary setup.
        """
        if not signals:
            return []

        from collections import defaultdict
        by_symbol: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        for s in signals:
            sym = s.get("symbol", "").strip().upper()
            if sym:
                by_symbol[sym].append(s)

        grouped_stocks: List[Dict[str, Any]] = []

        for sym, stock_patterns in by_symbol.items():
            # Sort patterns by AI conviction score desc, then volume surge ratio desc
            stock_patterns.sort(
                key=lambda x: (
                    x.get("ai_conviction_score", 0),
                    x.get("volume_surge_ratio", 0),
                    x.get("risk_reward", 0),
                ),
                reverse=True,
            )

            primary = stock_patterns[0]
            count = len(stock_patterns)

            # Multi-pattern cluster synergy bonus (+5 for 2 patterns, +8 for 3+ patterns)
            confluence_bonus = 8 if count >= 3 else (5 if count == 2 else 0)
            base_score = primary.get("ai_conviction_score", 60)
            final_score = int(np.clip(base_score + confluence_bonus, 10, 99))

            # Tier classification
            tier = "ELITE" if final_score >= 90 else ("HIGH" if final_score >= 80 else ("MODERATE" if final_score >= 65 else "SPECULATIVE"))

            # Distinct pattern names
            pattern_names = list(dict.fromkeys([p.get("pattern_name", "") for p in stock_patterns if p.get("pattern_name")]))
            max_vol = max([float(p.get("volume_surge_ratio", 1.0)) for p in stock_patterns])

            # Assemble conviction reasons
            reasons = list(primary.get("conviction_reasons", []))
            if count >= 2:
                reasons.insert(0, f"Multi-Pattern Cluster ({count} Setups: {', '.join(pattern_names[:3])})")

            # Determine dominant direction
            bulls = sum(1 for p in stock_patterns if p.get("direction") == "BULLISH")
            bears = sum(1 for p in stock_patterns if p.get("direction") == "BEARISH")
            dominant_direction = "BULLISH" if bulls > bears else ("BEARISH" if bears > bulls else primary.get("direction", "BULLISH"))

            # Assign volume confirmation level if not present
            vol_ratio = round(max_vol, 2)
            if vol_ratio >= 2.5:
                vol_level = "ULTRA_INSTITUTIONAL"
            elif vol_ratio >= 2.0:
                vol_level = "HEAVY"
            elif vol_ratio >= 1.5:
                vol_level = "EXPANSION"
            elif vol_ratio >= 1.2:
                vol_level = "ABOVE_AVG"
            elif vol_ratio < 0.8:
                vol_level = "ANEMIC_RISK"
            else:
                vol_level = "NORMAL"

            for p in stock_patterns:
                if not p.get("volume_confirmation_level"):
                    pv = float(p.get("volume_surge_ratio", 1.0))
                    if pv >= 2.5:
                        p["volume_confirmation_level"] = "ULTRA_INSTITUTIONAL"
                    elif pv >= 2.0:
                        p["volume_confirmation_level"] = "HEAVY"
                    elif pv >= 1.5:
                        p["volume_confirmation_level"] = "EXPANSION"
                    elif pv >= 1.2:
                        p["volume_confirmation_level"] = "ABOVE_AVG"
                    elif pv < 0.8:
                        p["volume_confirmation_level"] = "ANEMIC_RISK"
                    else:
                        p["volume_confirmation_level"] = "NORMAL"

            stock_item = dict(primary)
            stock_item.update({
                "patterns_count": count,
                "all_pattern_names": pattern_names,
                "multi_pattern_confluence": count >= 2,
                "confluence_bonus": confluence_bonus,
                "ai_conviction_score": final_score,
                "conviction_tier": tier,
                "volume_surge_ratio": vol_ratio,
                "volume_confirmation_level": vol_level,
                "conviction_reasons": reasons,
                "direction": dominant_direction,
                "patterns": stock_patterns,
            })
            grouped_stocks.append(stock_item)

        # Sort grouped stocks by AI conviction score desc, then volume surge ratio desc
        grouped_stocks.sort(
            key=lambda x: (
                x.get("ai_conviction_score", 0),
                x.get("volume_surge_ratio", 0),
                x.get("patterns_count", 1),
            ),
            reverse=True,
        )

        return grouped_stocks


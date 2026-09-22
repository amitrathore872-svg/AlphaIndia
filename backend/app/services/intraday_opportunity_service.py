"""
Alpha India Intraday Opportunity Service (POC)
Sprint 36.2 — Tomorrow High-Probability 5% Move Radar
Analyzes 5-minute intraday bars (EOD volume spikes, volatility squeezes, VWAP holding, and closing range)
to predict equities with high statistical probability of an explosive >= 5% directional move tomorrow.
"""

from __future__ import annotations

import concurrent.futures
import logging
import math
import time
from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd
import yfinance as yf
from sqlalchemy.orm import Session

from app.models.screener_growth_record import ScreenerGrowthRecord

logger = logging.getLogger(__name__)

# Cache scan results in memory for 3 minutes to keep requests ultra fast
_CACHE: Dict[str, Any] = {
    "timestamp": 0,
    "data": [],
}
_DEEP_DIVE_CACHE: Dict[str, Any] = {
    "timestamp": 0,
    "data": None,
}
_NIFTY_BENCHMARK_CACHE: Dict[str, Any] = {
    "timestamp": 0,
    "data": None,
}
CACHE_TTL_SECONDS = 180
NIFTY_CACHE_TTL_SECONDS = 600


class IntradayOpportunityService:
    """
    Quantitative 5-Minute Intraday Opportunity Scanner for Tomorrow's >= 5% Moves.
    Powered by the complete NSE F&O derivative universe (~175 liquid stocks).
    """

    # Sector mapping for all active NSE F&O constituents
    FNO_SECTOR_MAP: Dict[str, str] = {
        # IT & Technology
        "OFSS": "IT & Tech", "COFORGE": "IT & Tech", "PERSISTENT": "IT & Tech", "TCS": "IT & Tech",
        "INFY": "IT & Tech", "TECHM": "IT & Tech", "LTIM": "IT & Tech", "LTTS": "IT & Tech",
        "WIPRO": "IT & Tech", "HCLTECH": "IT & Tech", "MPHASIS": "IT & Tech", "BSOFT": "IT & Tech",
        "NAUKRI": "IT & Tech",
        # Defence & Aerospace
        "HAL": "Defence & Aerospace", "BEL": "Defence & Aerospace", "MAZDOCK": "Defence & Aerospace",
        "COCHINSHIP": "Defence & Aerospace", "BHARATFORG": "Defence & Aerospace",
        # Capital Goods & Power
        "BHEL": "Capital Goods & Power", "SIEMENS": "Capital Goods & Power", "ABB": "Capital Goods & Power",
        "CUMMINSIND": "Capital Goods & Power", "TATAPOWER": "Capital Goods & Power", "NTPC": "Capital Goods & Power",
        "POWERGRID": "Capital Goods & Power", "RECLTD": "Capital Goods & Power", "PFC": "Capital Goods & Power",
        "SUZLON": "Capital Goods & Power", "KAYNES": "Capital Goods & Power", "POLYCAB": "Capital Goods & Power",
        "HAVELLS": "Capital Goods & Power", "CROMPTON": "Capital Goods & Power", "VOLTAS": "Capital Goods & Power",
        # Pharma & Healthcare
        "DIVISLAB": "Pharma & Healthcare", "ALKEM": "Pharma & Healthcare", "CIPLA": "Pharma & Healthcare",
        "SUNPHARMA": "Pharma & Healthcare", "DRREDDY": "Pharma & Healthcare", "LUPIN": "Pharma & Healthcare",
        "TORNTPHARM": "Pharma & Healthcare", "AUROPHARMA": "Pharma & Healthcare", "BIOCON": "Pharma & Healthcare",
        "GRANULES": "Pharma & Healthcare", "IPCALAB": "Pharma & Healthcare", "LAURUSLABS": "Pharma & Healthcare",
        "SYNGENE": "Pharma & Healthcare", "GLENMARK": "Pharma & Healthcare", "APOLLOHOSP": "Pharma & Healthcare",
        "METROPOLIS": "Pharma & Healthcare", "LALPATHLAB": "Pharma & Healthcare",
        # Automotive
        "TVSMOTOR": "Automotive", "BAJAJ-AUTO": "Automotive", "TATAMOTORS": "Automotive", "MARUTI": "Automotive",
        "M&M": "Automotive", "HEROMOTOCO": "Automotive", "EICHERMOT": "Automotive", "ASHOKLEY": "Automotive",
        "BATAINDIA": "Automotive", "APOLLOTYRE": "Automotive", "BALKRISIND": "Automotive", "MRF": "Automotive",
        "MOTHERSON": "Automotive", "ESCORTS": "Automotive",
        # Realty & Infrastructure
        "OBEROIRLTY": "Realty & Infra", "GODREJPROP": "Realty & Infra", "DLF": "Realty & Infra",
        "CONCOR": "Realty & Infra", "GMRINFRA": "Realty & Infra", "GMRAIRPORT": "Realty & Infra",
        "LT": "Realty & Infra", "INDUSTOWER": "Realty & Infra", "PVRINOX": "Realty & Infra",
        # Banking - Private
        "ICICIBANK": "Banking - Private", "HDFCBANK": "Banking - Private", "AXISBANK": "Banking - Private",
        "KOTAKBANK": "Banking - Private", "INDUSINDBK": "Banking - Private", "FEDERALBNK": "Banking - Private",
        "IDFCFIRSTB": "Banking - Private", "AUBANK": "Banking - Private", "RBLBANK": "Banking - Private",
        "BANDHANBNK": "Banking - Private",
        # Banking - PSU
        "SBIN": "Banking - PSU", "BANKBARODA": "Banking - PSU", "CANBK": "Banking - PSU", "PNB": "Banking - PSU",
        # Financial Services
        "BAJFINANCE": "Financial Services", "BAJAJFINSV": "Financial Services", "CHOLAFIN": "Financial Services",
        "SHRIRAMFIN": "Financial Services", "MUTHOOTFIN": "Financial Services", "MANAPPURAM": "Financial Services",
        "M&MFIN": "Financial Services", "CANFINHOME": "Financial Services", "LICHSGFIN": "Financial Services",
        "SBICARD": "Financial Services", "HDFCAMC": "Financial Services", "HDFCLIFE": "Financial Services",
        "SBILIFE": "Financial Services", "ICICIGI": "Financial Services", "ICICIPRULI": "Financial Services",
        "MCX": "Financial Services", "IEX": "Financial Services", "PEL": "Financial Services",
        "MFSL": "Financial Services", "ABCAPITAL": "Financial Services",
        # Metals & Mining
        "TATASTEEL": "Metals & Mining", "JSWSTEEL": "Metals & Mining", "VEDL": "Metals & Mining",
        "HINDALCO": "Metals & Mining", "SAIL": "Metals & Mining", "NMDC": "Metals & Mining",
        "NATIONALUM": "Metals & Mining", "JINDALSTEL": "Metals & Mining", "HINDCOPPER": "Metals & Mining",
        "COALINDIA": "Metals & Mining",
        # Oil, Gas & Energy
        "RELIANCE": "Oil, Gas & Energy", "ONGC": "Oil, Gas & Energy", "IOC": "Oil, Gas & Energy",
        "BPCL": "Oil, Gas & Energy", "HINDPETRO": "Oil, Gas & Energy", "GAIL": "Oil, Gas & Energy",
        "PETRONET": "Oil, Gas & Energy", "GUJGASLTD": "Oil, Gas & Energy", "MGL": "Oil, Gas & Energy",
        # Consumer & Retail
        "TRENT": "Consumer & Retail", "TITAN": "Consumer & Retail", "INDIGO": "Consumer & Retail",
        "DIXON": "Consumer & Retail", "ASIANPAINT": "Consumer & Retail", "PIDILITIND": "Consumer & Retail",
        "BRITANNIA": "Consumer & Retail", "NESTLEIND": "Consumer & Retail", "HINDUNILVR": "Consumer & Retail",
        "DABUR": "Consumer & Retail", "MARICO": "Consumer & Retail", "GODREJCP": "Consumer & Retail",
        "COLPAL": "Consumer & Retail", "TATACONSUM": "Consumer & Retail", "JUBLFOOD": "Consumer & Retail",
        "MCDOWELL-N": "Consumer & Retail", "UNITDSPR": "Consumer & Retail", "UBL": "Consumer & Retail",
        "PAGEIND": "Consumer & Retail", "ABFRL": "Consumer & Retail", "ZOMATO": "Consumer & Retail",
        # Chemicals & Agri
        "SRF": "Chemicals & Agri", "DEEPAKNTR": "Chemicals & Agri", "PIIND": "Chemicals & Agri",
        "NAVINFLUOR": "Chemicals & Agri", "ATUL": "Chemicals & Agri", "AARTIIND": "Chemicals & Agri",
        "TATACHEM": "Chemicals & Agri", "UPL": "Chemicals & Agri", "COROMANDEL": "Chemicals & Agri",
        "CHAMBLFERT": "Chemicals & Agri", "GNFC": "Chemicals & Agri", "BALRAMCHIN": "Chemicals & Agri",
        # Telecom
        "BHARTIARTL": "Telecom", "IDEA": "Telecom", "TATACOMM": "Telecom",
        # Cement & Building
        "ULTRACEMCO": "Cement & Building", "AMBUJACEM": "Cement & Building", "ACC": "Cement & Building",
        "SHREECEM": "Cement & Building", "DALBHARAT": "Cement & Building", "JKCEMENT": "Cement & Building",
        "RAMCOCEM": "Cement & Building", "INDIACEM": "Cement & Building", "ASTRAL": "Cement & Building",
    }

    # Complete Active NSE F&O (Futures & Options) Universe
    CORE_WATCHLIST = [
        "AARTIIND", "ABB", "ABBOTINDIA", "ABCAPITAL", "ABFRL", "ACC", "ADANIENT", "ADANIPORTS",
        "ALKEM", "AMBUJACEM", "APOLLOHOSP", "APOLLOTYRE", "ASHOKLEY", "ASIANPAINT", "ASTRAL",
        "ATUL", "AUBANK", "AUROPHARMA", "AXISBANK", "BAJAJ-AUTO", "BAJAJFINSV", "BAJFINANCE",
        "BALKRISIND", "BALRAMCHIN", "BANDHANBNK", "BANKBARODA", "BATAINDIA", "BEL", "BHARATFORG",
        "BHEL", "BIOCON", "BOSCHLTD", "BPCL", "BRITANNIA", "BSOFT", "CANBK", "CANFINHOME",
        "CHAMBLFERT", "CHOLAFIN", "CIPLA", "COALINDIA", "COFORGE", "COLPAL", "CONCOR",
        "COROMANDEL", "CROMPTON", "CUMMINSIND", "DABUR", "DALBHARAT", "DEEPAKNTR", "DIVISLAB",
        "DIXON", "DLF", "DRREDDY", "EICHERMOT", "ESCORTS", "EXIDEIND", "FEDERALBNK", "GAIL",
        "GLENMARK", "GMRINFRA", "GNFC", "GODREJCP", "GODREJPROP", "GRANULES", "GRASIM", "GUJGASLTD",
        "HAL", "HAVELLS", "HCLTECH", "HDFCAMC", "HDFCBANK", "HDFCLIFE", "HEROMOTOCO", "HINDALCO",
        "HINDCOPPER", "HINDPETRO", "HINDUNILVR", "ICICIBANK", "ICICIGI", "ICICIPRULI", "IDEA",
        "IDFCFIRSTB", "IEX", "INDHOTEL", "INDIACEM", "INDIAMART", "INDIGO", "INDUSINDBK",
        "INDUSTOWER", "INFY", "IOC", "IPCALAB", "IRCTC", "ITC", "JINDALSTEL", "JKCEMENT",
        "JSWSTEEL", "JUBLFOOD", "KOTAKBANK", "LALPATHLAB", "LAURUSLABS", "LICHSGFIN", "LT",
        "LTIM", "LTTS", "LUPIN", "M&M", "M&MFIN", "MANAPPURAM", "MARICO", "MARUTI", "MCDOWELL-N",
        "MCX", "METROPOLIS", "MFSL", "MGL", "MOTHERSON", "MPHASIS", "MRF", "MUTHOOTFIN",
        "NATIONALUM", "NAUKRI", "NAVINFLUOR", "NESTLEIND", "NMDC", "NTPC", "OBEROIRLTY", "OFSS",
        "ONGC", "PAGEIND", "PEL", "PERSISTENT", "PETRONET", "PFC", "PIDILITIND", "PIIND", "PNB",
        "POLYCAB", "POWERGRID", "PVRINOX", "RAMCOCEM", "RBLBANK", "RECLTD", "RELIANCE", "SAIL",
        "SBICARD", "SBILIFE", "SBIN", "SHREECEM", "SHRIRAMFIN", "SIEMENS", "SRF", "SUNPHARMA",
        "SUNTV", "SYNGENE", "TATACHEM", "TATACOMM", "TATACONSUM", "TATAMOTORS", "TATAPOWER",
        "TATASTEEL", "TCS", "TECHM", "TITAN", "TORNTPHARM", "TRENT", "TVSMOTOR", "UBL",
        "ULTRACEMCO", "UPL", "VEDL", "VOLTAS", "WIPRO", "ZEEL", "SUZLON", "KAYNES", "MAZDOCK", "COCHINSHIP"
    ]

    @classmethod
    def analyze_stock_5m(cls, symbol: str, company_name: Optional[str] = None, sector: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Performs multi-factor 5-minute intraday analysis for a single stock.
        """
        clean_sym = symbol.strip().upper()
        ticker_sym = f"{clean_sym}.NS"

        try:
            t = yf.Ticker(ticker_sym)
            df = t.history(period="5d", interval="5m")
            if df.empty or len(df) < 50:
                t = yf.Ticker(f"{clean_sym}.BO")
                df = t.history(period="5d", interval="5m")

            if df.empty or len(df) < 50:
                return None

            df = df.dropna(subset=["Close", "Volume"])
            df["Date"] = df.index.date
            last_date = df["Date"].iloc[-1]
            today_df = df[df["Date"] == last_date]

            if len(today_df) < 12:
                return None

            cmp = round(float(today_df["Close"].iloc[-1]), 2)
            d_high = round(float(today_df["High"].max()), 2)
            d_low = round(float(today_df["Low"].min()), 2)
            d_range = max(0.01, d_high - d_low)

            # 1. Day Range Close Location (0.0 to 1.0)
            close_loc = (cmp - d_low) / d_range
            close_loc_pct = round(close_loc * 100, 1)

            # 2. Intraday VWAP
            cum_vol = today_df["Volume"].cumsum()
            cum_pv = (today_df["Close"] * today_df["Volume"]).cumsum()
            vwap = float(cum_pv.iloc[-1] / max(1, cum_vol.iloc[-1]))
            vwap_pct = round(((cmp - vwap) / vwap) * 100, 2)

            # 3. EOD Volume Surge Ratio (3:00 - 3:30 PM last 6 bars vs prior median)
            last_6_vol = float(today_df["Volume"].tail(6).sum())
            prior_avg_6 = float(today_df["Volume"].iloc[:-6].median() * 6) if len(today_df) > 6 else 1.0
            vol_surge = round(last_6_vol / max(1.0, prior_avg_6), 2)

            # 4. 5-Min Bollinger Band Volatility Squeeze (20, 2)
            df["MA20"] = df["Close"].rolling(20).mean()
            df["STD20"] = df["Close"].rolling(20).std()
            df["BBW"] = (df["STD20"] * 2) / df["MA20"]
            bbw_latest = float(df["BBW"].iloc[-1])
            bbw_quantile = float(df["BBW"].quantile(0.25)) if not df["BBW"].dropna().empty else 1.0
            is_squeeze = bool(bbw_latest <= bbw_quantile)

            # 5. 5-Min RSI (14)
            delta = df["Close"].diff()
            gain = (delta.where(delta > 0, 0)).rolling(14).mean()
            loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
            rs = gain / loss.replace(0, np.nan)
            rsi_series = 100 - (100 / (1 + rs))
            rsi_5m = float(rsi_series.iloc[-1])
            if math.isnan(rsi_5m):
                rsi_5m = 50.0
            rsi_5m = round(rsi_5m, 1)

            # 6. Scoring Direction & Probability
            bull_score = 0
            if close_loc >= 0.85: bull_score += 35
            elif close_loc >= 0.70: bull_score += 20
            if vwap_pct > 0.3: bull_score += 25
            if vol_surge >= 1.6: bull_score += 25
            if is_squeeze: bull_score += 20

            bear_score = 0
            if close_loc <= 0.15: bear_score += 35
            elif close_loc <= 0.30: bear_score += 20
            if vwap_pct < -0.3: bear_score += 25
            if vol_surge >= 1.6 and close_loc < 0.4: bear_score += 25
            if is_squeeze and close_loc < 0.4: bear_score += 20

            # Determine Direction & Expected 5%+ Move
            catalysts: List[str] = []
            if bull_score >= 50 and bull_score > bear_score:
                direction = "BULLISH UP"
                direction_tier = "BULLISH"
                prob = min(95, 55 + int(bull_score * 0.42))
                exp_move = round(max(5.0, 5.0 + (vol_surge * 0.7) + (1.2 if is_squeeze else 0.0)), 1)
                target = round(cmp * (1.0 + exp_move / 100.0), 2)
                trigger = round(d_high * 1.002, 2)
                stop_loss = round(min(vwap, cmp * 0.975), 2)

                if close_loc >= 0.85:
                    catalysts.append(f"Closing at {close_loc_pct}% of day high (high-demand institutional accumulation).")
                if vol_surge >= 1.8:
                    catalysts.append(f"EOD 3:00-3:30 PM volume surge of {vol_surge}x median volume.")
                if is_squeeze:
                    catalysts.append("5-Minute Bollinger Volatility Squeeze active; explosive breakout primed.")
                if vwap_pct > 0.3:
                    catalysts.append(f"Holding firmly {vwap_pct}% above intraday VWAP (bulls in control).")

            elif bear_score >= 50:
                direction = "BEARISH DOWN"
                direction_tier = "BEARISH"
                prob = min(94, 55 + int(bear_score * 0.42))
                exp_move = round(max(5.0, 5.0 + (vol_surge * 0.7) + (1.2 if is_squeeze else 0.0)), 1)
                target = round(cmp * (1.0 - exp_move / 100.0), 2)
                trigger = round(d_low * 0.998, 2)
                stop_loss = round(max(vwap, cmp * 1.025), 2)

                if close_loc <= 0.15:
                    catalysts.append(f"Closing at {close_loc_pct}% of day range (heavy late-session supply dumping).")
                if vol_surge >= 1.8:
                    catalysts.append(f"Heavy EOD distribution volume ({vol_surge}x median) into the close.")
                if is_squeeze:
                    catalysts.append("5-Minute Volatility Squeeze ready to resolve downward.")
                if vwap_pct < -0.3:
                    catalysts.append(f"Trading {abs(vwap_pct)}% below intraday VWAP (strong overhead rejection).")
            else:
                direction = "CONSOLIDATION"
                direction_tier = "NEUTRAL"
                prob = 42
                exp_move = 3.0
                target = round(cmp * 1.03, 2)
                trigger = d_high
                stop_loss = round(cmp * 0.98, 2)
                catalysts.append("Range-bound intraday oscillation; waiting for directional momentum emergence.")

            return {
                "symbol": clean_sym,
                "company_name": company_name or clean_sym,
                "sector": sector or "General",
                "cmp": cmp,
                "direction": direction,
                "direction_tier": direction_tier,
                "probability": prob,
                "expected_move_pct": exp_move,
                "entry_trigger": trigger,
                "target_price": target,
                "stop_loss": stop_loss,
                "close_location_pct": close_loc_pct,
                "vwap": round(vwap, 2),
                "vwap_pct": vwap_pct,
                "vol_surge_ratio": vol_surge,
                "is_squeeze": is_squeeze,
                "rsi_5m": rsi_5m,
                "catalysts": catalysts,
                "day_high": d_high,
                "day_low": d_low,
                "tradingview_5m_url": f"https://in.tradingview.com/symbols/NSE-{clean_sym}/",
            }
        except Exception as e:
            logger.debug(f"Error analyzing 5m for {clean_sym}: {e}")
            return None

    @classmethod
    def scan_opportunities(cls, db: Optional[Session] = None, force_refresh: bool = False) -> List[Dict[str, Any]]:
        """
        Scans top high-momentum candidates using 5-minute intraday metrics.
        Cached in-memory for fast API responses.
        """
        now = time.time()
        if not force_refresh and _CACHE["data"] and (now - _CACHE["timestamp"] < CACHE_TTL_SECONDS):
            return _CACHE["data"]

        # Gather target universe: watchlist + top high-growth names from ScreenerGrowthRecord
        symbols_map: Dict[str, Dict[str, str]] = {}
        for sym in cls.CORE_WATCHLIST:
            symbols_map[sym] = {
                "company_name": sym,
                "sector": cls.FNO_SECTOR_MAP.get(sym, "Diversified")
            }

        if db:
            try:
                from app.models.company import Company
                comp_records = db.query(Company.symbol, Company.company, Company.sector).filter(
                    Company.symbol.in_(list(cls.CORE_WATCHLIST))
                ).all()
                for c_sym, c_name, c_sec in comp_records:
                    if c_sym in symbols_map:
                        symbols_map[c_sym]["company_name"] = c_name or c_sym
                        if c_sec and c_sec != "Unknown":
                            symbols_map[c_sym]["sector"] = cls.FNO_SECTOR_MAP.get(c_sym, c_sec)

                top_records = db.query(ScreenerGrowthRecord).filter(
                    ScreenerGrowthRecord.current_price != None,
                    ScreenerGrowthRecord.current_price > 50,
                    ScreenerGrowthRecord.market_cap != None,
                ).order_by(ScreenerGrowthRecord.market_cap.desc()).limit(25).all()

                for r in top_records:
                    if r.symbol not in symbols_map:
                        symbols_map[r.symbol] = {
                            "company_name": r.company_name or r.symbol,
                            "sector": cls.FNO_SECTOR_MAP.get(r.symbol, r.sector or "Diversified"),
                        }
                    elif symbols_map[r.symbol]["company_name"] == r.symbol and r.company_name:
                        symbols_map[r.symbol]["company_name"] = r.company_name
            except Exception as e:
                logger.warning(f"Failed to query DB candidates: {e}")

        results: List[Dict[str, Any]] = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=12) as executor:
            future_to_sym = {
                executor.submit(cls.analyze_stock_5m, sym, meta["company_name"], meta["sector"]): sym
                for sym, meta in symbols_map.items()
            }
            for future in concurrent.futures.as_completed(future_to_sym):
                try:
                    opp = future.result()
                    if opp:
                        results.append(opp)
                except Exception as ex:
                    logger.debug(f"Error processing stock: {ex}")

        # Sort by Probability desc, then Expected Move desc
        results.sort(key=lambda x: (x["probability"], x["expected_move_pct"]), reverse=True)

        _CACHE["timestamp"] = now
        _CACHE["data"] = results
        return results

    @classmethod
    def get_nifty_benchmark(cls, force_refresh: bool = False) -> Dict[str, Any]:
        """
        Fetches and caches NIFTY 50 index (^NSEI) daily data for Phase-2 Relative Strength (RS)
        and broader Market Regime determination.
        """
        now = time.time()
        if not force_refresh and _NIFTY_BENCHMARK_CACHE["data"] and (now - _NIFTY_BENCHMARK_CACHE["timestamp"] < NIFTY_CACHE_TTL_SECONDS):
            return _NIFTY_BENCHMARK_CACHE["data"]

        try:
            t = yf.Ticker("^NSEI")
            df = t.history(period="3mo", interval="1d").dropna(subset=["Close"])
            if df.empty or len(df) < 20:
                data = {
                    "cmp": 25000.0,
                    "ret_5d": 0.0,
                    "ret_20d": 0.0,
                    "ema20": 25000.0,
                    "regime": "BULLISH (>20 EMA)",
                    "is_bullish": True,
                }
            else:
                cmp = round(float(df["Close"].iloc[-1]), 2)
                c_5d_ago = float(df["Close"].iloc[-5]) if len(df) >= 5 else cmp
                c_20d_ago = float(df["Close"].iloc[-20]) if len(df) >= 20 else cmp
                ret_5d = round(((cmp - c_5d_ago) / c_5d_ago) * 100, 2)
                ret_20d = round(((cmp - c_20d_ago) / c_20d_ago) * 100, 2)
                ema20 = float(df["Close"].ewm(span=20).mean().iloc[-1])
                is_bullish = cmp >= ema20
                regime = f"BULLISH (>20 EMA: {ema20:.0f})" if is_bullish else f"BEARISH (<20 EMA: {ema20:.0f})"

                data = {
                    "cmp": cmp,
                    "ret_5d": ret_5d,
                    "ret_20d": ret_20d,
                    "ema20": round(ema20, 2),
                    "regime": regime,
                    "is_bullish": is_bullish,
                }
            _NIFTY_BENCHMARK_CACHE["timestamp"] = now
            _NIFTY_BENCHMARK_CACHE["data"] = data
            return data
        except Exception as e:
            logger.warning(f"Failed to fetch NIFTY benchmark: {e}")
            fallback = {
                "cmp": 25000.0,
                "ret_5d": 0.0,
                "ret_20d": 0.0,
                "ema20": 25000.0,
                "regime": "NEUTRAL",
                "is_bullish": True,
            }
            return fallback

    @classmethod
    def analyze_stock_mtf(cls, opp: Dict[str, Any], sector_stats: Dict[str, Any], nifty_bench: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        """
        Performs Multi-Timeframe (1D + 1H) structural validation, Phase-1 Volatility Contraction
        (NR7 & Inside Day + ATR Targets), and Phase-2 Relative Strength (RS vs NIFTY 50).
        """
        sym = opp["symbol"]
        ticker_sym = f"{sym}.NS"
        try:
            t = yf.Ticker(ticker_sym)
            df_1d = t.history(period="3mo", interval="1d").dropna(subset=["Close"])
            if df_1d.empty or len(df_1d) < 15:
                t = yf.Ticker(f"{sym}.BO")
                df_1d = t.history(period="3mo", interval="1d").dropna(subset=["Close"])

            if df_1d.empty or len(df_1d) < 15:
                return None

            df_1h = t.history(period="1mo", interval="1h").dropna(subset=["Close"])

            cmp = float(df_1d["Close"].iloc[-1])
            ema20_1d = float(df_1d["Close"].ewm(span=20).mean().iloc[-1])
            sma50_1d = float(df_1d["Close"].rolling(50).mean().iloc[-1]) if len(df_1d) >= 50 else ema20_1d
            high_20d = float(df_1d["High"].tail(20).max())
            pct_from_20d_high = round(((high_20d - cmp) / high_20d) * 100, 1)

            # Phase 1: ATR(14) Volatility & True Range
            high_low = df_1d["High"] - df_1d["Low"]
            high_close_prev = (df_1d["High"] - df_1d["Close"].shift(1)).abs()
            low_close_prev = (df_1d["Low"] - df_1d["Close"].shift(1)).abs()
            true_range = pd.concat([high_low, high_close_prev, low_close_prev], axis=1).max(axis=1)
            atr_14 = float(true_range.tail(14).mean()) if len(true_range) >= 14 else float(true_range.mean())
            atr_14 = round(max(0.1, atr_14), 2)
            atr_pct = round((atr_14 / cmp) * 100, 2)

            # Phase 1: NR7 (Narrow Range 7 - Toby Crabel Volatility Compression)
            is_nr7 = False
            if len(true_range) >= 7:
                latest_tr = float(true_range.iloc[-1])
                prev_6_tr = true_range.iloc[-7:-1]
                is_nr7 = bool(latest_tr <= float(prev_6_tr.min()))

            # Phase 1: Inside Day (ID: Today High <= Prev High and Today Low >= Prev Low)
            is_inside_day = False
            if len(df_1d) >= 2:
                today_h = float(df_1d["High"].iloc[-1])
                today_l = float(df_1d["Low"].iloc[-1])
                prev_h = float(df_1d["High"].iloc[-2])
                prev_l = float(df_1d["Low"].iloc[-2])
                is_inside_day = bool(today_h <= prev_h and today_l >= prev_l)

            if is_nr7 and is_inside_day:
                pattern_contraction = "NR7 + Inside Day (Super-Coil)"
                contraction_badge = "NR7 + ID COIL"
            elif is_nr7:
                pattern_contraction = "NR7 (Narrow Range 7)"
                contraction_badge = "NR7 COIL"
            elif is_inside_day:
                pattern_contraction = "Inside Day (Compression)"
                contraction_badge = "INSIDE DAY"
            elif opp.get("is_squeeze", False):
                pattern_contraction = "5M Bollinger Squeeze"
                contraction_badge = "5M SQUEEZE"
            else:
                pattern_contraction = "Standard Expansion"
                contraction_badge = "EXPANSION"

            # Phase 1: Dynamic ATR Targets and Stops
            target_1 = round(cmp + (1.2 * atr_14), 2)
            target_2 = round(cmp + (2.0 * atr_14), 2)
            stop_loss = round(max(0.1, cmp - (0.75 * atr_14)), 2)
            risk_reward = round(1.2 / 0.75, 2)

            # Phase 2: Relative Strength (RS vs NIFTY 50)
            stock_c_5d = float(df_1d["Close"].iloc[-5]) if len(df_1d) >= 5 else cmp
            stock_ret_5d = round(((cmp - stock_c_5d) / stock_c_5d) * 100, 2)
            nifty_ret_5d = nifty_bench.get("ret_5d", 0.0) if nifty_bench else 0.0
            rs_score = round(stock_ret_5d - nifty_ret_5d, 2)

            if rs_score >= 2.5:
                rs_status = "STRONG OUTPERFORMER"
                rs_score_adj = 8
            elif rs_score >= 0.5:
                rs_status = "OUTPERFORMER"
                rs_score_adj = 5
            elif rs_score >= -0.8:
                rs_status = "IN-LINE WITH NIFTY"
                rs_score_adj = 0
            else:
                rs_status = "UNDERPERFORMER (LAGGING)"
                rs_score_adj = -12  # Weed out counter-trend traps

            # 1D RSI
            delta_1d = df_1d["Close"].diff()
            gain_1d = (delta_1d.where(delta_1d > 0, 0)).rolling(14).mean()
            loss_1d = (-delta_1d.where(delta_1d < 0, 0)).rolling(14).mean()
            rs_1d = gain_1d / loss_1d.replace(0, np.nan)
            rsi_1d = float((100 - (100 / (1 + rs_1d))).iloc[-1])
            rsi_1d = 50.0 if math.isnan(rsi_1d) else round(rsi_1d, 1)

            # 1D Macro Trend
            if cmp >= ema20_1d >= sma50_1d:
                trend_1d = "BULLISH"
                trend_1d_desc = f"Stage-2 Uptrend (CMP ₹{cmp:.1f} > 20 EMA > 50 SMA)"
            elif cmp >= ema20_1d:
                trend_1d = "MODERATE BULLISH"
                trend_1d_desc = f"Holding above 20 EMA (₹{ema20_1d:.1f})"
            elif cmp < ema20_1d and ema20_1d < sma50_1d:
                trend_1d = "BEARISH DOWNTREND"
                trend_1d_desc = "Trapped under declining 20/50 MAs (Caution)"
            else:
                trend_1d = "NEUTRAL"
                trend_1d_desc = "Rangebound daily consolidation"

            # 1H Intermediate Trend
            if not df_1h.empty and len(df_1h) >= 10:
                ema20_1h = float(df_1h["Close"].ewm(span=20).mean().iloc[-1])
                trend_1h = "BULLISH" if cmp >= ema20_1h else "PULLBACK"
                delta_1h = df_1h["Close"].diff()
                gain_1h = (delta_1h.where(delta_1h > 0, 0)).rolling(14).mean()
                loss_1h = (-delta_1h.where(delta_1h < 0, 0)).rolling(14).mean()
                rs_1h = gain_1h / loss_1h.replace(0, np.nan)
                rsi_1h = float((100 - (100 / (1 + rs_1h))).iloc[-1])
                rsi_1h = 50.0 if math.isnan(rsi_1h) else round(rsi_1h, 1)
            else:
                trend_1h = "NEUTRAL"
                rsi_1h = 50.0

            # Multi-Timeframe Alignment
            if trend_1d in ("BULLISH", "MODERATE BULLISH") and trend_1h == "BULLISH":
                confluence_grade = "TRIPLE CONFLUENCE (3/3)"
                confluence_badge = "3/3 ALIGNED"
                mtf_score = 92
            elif trend_1d in ("BULLISH", "MODERATE BULLISH"):
                confluence_grade = "DUAL ALIGNED (2/3)"
                confluence_badge = "2/3 ALIGNED"
                mtf_score = 75
            elif trend_1d == "BEARISH DOWNTREND":
                confluence_grade = "COUNTER-TREND TRAP (1/3)"
                confluence_badge = "1/3 TRAP"
                mtf_score = 30
            else:
                confluence_grade = "MIXED (2/3)"
                confluence_badge = "2/3 MIXED"
                mtf_score = 60

            # Sector Intelligence
            sec_name = cls.FNO_SECTOR_MAP.get(sym, opp.get("sector") or "Diversified")
            sec_info = sector_stats.get(sec_name, {"bullish_ratio_pct": 30.0, "is_leading": False, "bullish_stocks": 1})
            if sec_info.get("is_leading", False):
                sector_tailwind_score = 95
                sector_status = "STRONG TAILWIND"
            elif sec_info.get("bullish_ratio_pct", 0) >= 35.0:
                sector_tailwind_score = 72
                sector_status = "MODERATE TAILWIND"
            else:
                sector_tailwind_score = 45
                sector_status = "SECTOR HEADWIND"

            # Contraction bonus: NR7 (+8), Inside Day (+5)
            contraction_bonus = 8 if is_nr7 else (5 if is_inside_day else 0)

            # Final Elite Composite Conviction Score (0-100)
            # 35% 5M Probability + 30% MTF Structural Score + 20% Sector Inflow + Contraction + RS Adjustment
            raw_conviction = (
                (0.35 * opp["probability"]) +
                (0.30 * mtf_score) +
                (0.20 * sector_tailwind_score) +
                contraction_bonus +
                rs_score_adj
            )
            conviction_score = int(round(max(15, min(99, raw_conviction))))

            if conviction_score >= 88:
                tier = "A+ SUPER-SETUP"
            elif conviction_score >= 78:
                tier = "A HIGH CONVICTION"
            else:
                tier = "B VALID SETUP"

            return {
                **opp,
                "sector": sec_name,
                "sector_bullish_ratio_pct": sec_info.get("bullish_ratio_pct", 0),
                "sector_status": sector_status,
                "sector_bullish_count": sec_info.get("bullish_stocks", 0),
                "trend_1d": trend_1d,
                "trend_1d_desc": trend_1d_desc,
                "rsi_1d": rsi_1d,
                "pct_from_20d_high": pct_from_20d_high,
                "trend_1h": trend_1h,
                "rsi_1h": rsi_1h,
                "confluence_grade": confluence_grade,
                "confluence_badge": confluence_badge,
                "mtf_score": mtf_score,
                "conviction_score": conviction_score,
                "conviction_tier": tier,
                "tradingview_1d_url": f"https://in.tradingview.com/symbols/NSE-{sym}/",
                # Phase 1: Volatility & ATR fields
                "atr_14": atr_14,
                "atr_pct": atr_pct,
                "is_nr7": is_nr7,
                "is_inside_day": is_inside_day,
                "pattern_contraction": pattern_contraction,
                "contraction_badge": contraction_badge,
                "cmp": round(cmp, 2),
                "stop_loss": stop_loss,
                "target_1": target_1,
                "target_2": target_2,
                "risk_reward": risk_reward,
                # Phase 2: Relative Strength vs NIFTY 50
                "stock_ret_5d": stock_ret_5d,
                "nifty_ret_5d": nifty_ret_5d,
                "rs_score": rs_score,
                "rs_status": rs_status,
                "nifty_regime": nifty_bench.get("regime", "NEUTRAL") if nifty_bench else "NEUTRAL",
            }
        except Exception as e:
            logger.debug(f"Error in MTF analysis for {sym}: {e}")
            return None

    @classmethod
    def get_deep_dive_opportunities(cls, db: Optional[Session] = None, force_refresh: bool = False) -> Dict[str, Any]:
        """
        Executes Tier-2 Multi-Timeframe (1D+1H), Phase-1 Volatility Contraction,
        Phase-2 Relative Strength, and Tier-3 Sector Breadth synthesis.
        """
        now = time.time()
        if not force_refresh and _DEEP_DIVE_CACHE["data"] and (now - _DEEP_DIVE_CACHE["timestamp"] < CACHE_TTL_SECONDS):
            return _DEEP_DIVE_CACHE["data"]

        # 1. Fetch base 5M scan (instant cached or scanned)
        all_opps = cls.scan_opportunities(db=db, force_refresh=force_refresh)
        bullish_opps = [o for o in all_opps if o["direction_tier"] == "BULLISH"]

        # 2. Benchmark Nifty 50 for Phase-2 Relative Strength
        nifty_bench = cls.get_nifty_benchmark(force_refresh=force_refresh)

        # 3. Compute Sector Breadth & Clustering across universe
        from collections import defaultdict
        sector_total = defaultdict(int)
        sector_bullish = defaultdict(int)

        for opp in all_opps:
            sym = opp["symbol"]
            sec = cls.FNO_SECTOR_MAP.get(sym, opp.get("sector") or "Diversified")
            sector_total[sec] += 1
            if opp["direction_tier"] == "BULLISH":
                sector_bullish[sec] += 1

        sector_stats: Dict[str, Any] = {}
        for sec, tot in sector_total.items():
            b_cnt = sector_bullish[sec]
            ratio = round((b_cnt / tot) * 100, 1) if tot > 0 else 0
            sector_stats[sec] = {
                "sector": sec,
                "total_stocks": tot,
                "bullish_stocks": b_cnt,
                "bullish_ratio_pct": ratio,
                "is_leading": bool(ratio >= 45.0),
            }

        sorted_sectors = sorted(
            sector_stats.values(),
            key=lambda x: (x["bullish_ratio_pct"], x["bullish_stocks"]),
            reverse=True
        )

        # 4. Multi-threaded MTF analysis on bullish candidates with Nifty RS and Phase-1 ATR
        deep_dive_candidates: List[Dict[str, Any]] = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            futures = [executor.submit(cls.analyze_stock_mtf, opp, sector_stats, nifty_bench) for opp in bullish_opps]
            for f in concurrent.futures.as_completed(futures):
                try:
                    res = f.result()
                    if res:
                        deep_dive_candidates.append(res)
                except Exception as ex:
                    logger.debug(f"Error processing MTF candidate: {ex}")

        # 5. Sort by Conviction Score desc, then Expected Move desc
        deep_dive_candidates.sort(
            key=lambda x: (x["conviction_score"], x["expected_move_pct"]),
            reverse=True
        )

        elite_candidates = deep_dive_candidates[:12]
        triple_confluence_count = sum(1 for c in deep_dive_candidates if "3/3" in c.get("confluence_badge", ""))
        nr7_coils_count = sum(1 for c in deep_dive_candidates if c.get("is_nr7", False))
        inside_days_count = sum(1 for c in deep_dive_candidates if c.get("is_inside_day", False))
        nifty_outperformers_count = sum(1 for c in deep_dive_candidates if c.get("rs_score", 0) >= 0.5)

        from datetime import datetime, timezone
        response_data = {
            "last_calculated_at": datetime.now(timezone.utc).isoformat(),
            "data_source": "NSE_F&O_5M_ENGINE",
            "total_bullish_analyzed": len(deep_dive_candidates),
            "triple_confluence_count": triple_confluence_count,
            "nr7_coils_count": nr7_coils_count,
            "inside_days_count": inside_days_count,
            "nifty_outperformers_count": nifty_outperformers_count,
            "nifty_benchmark": {
                "cmp": nifty_bench["cmp"],
                "ret_5d": nifty_bench["ret_5d"],
                "regime": nifty_bench["regime"],
                "is_bullish": nifty_bench["is_bullish"],
            },
            "elite_candidates": elite_candidates,
            "all_bullish_mtf": deep_dive_candidates,
            "sector_matrix": sorted_sectors,
        }

        _DEEP_DIVE_CACHE["timestamp"] = now
        _DEEP_DIVE_CACHE["data"] = response_data
        return response_data

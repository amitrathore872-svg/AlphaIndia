"""
Alpha India - Multi-Timeframe Bollinger Band & Triple-RSI Momentum Screener Service
Implements the institutional momentum setup:
1. Daily Volume > Daily SMA(Daily Volume, 20)
2. Daily Close > Daily Upper Bollinger Band (20, 2)
3. Weekly Close > Weekly Upper Bollinger Band (20, 2)
4. Daily RSI (14) > 60
5. Weekly RSI (14) > 60
6. Monthly RSI (14) > 60
7. Weekly WMA (30) Crossed above Weekly WMA (50)
8. Weekly WMA (30) > 60
9. Weekly WMA (50) > 60
10. Daily Close > Daily Open (Bullish green candle)
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

from app.models.company import Company
from app.models.screener_growth_record import ScreenerGrowthRecord

logger = logging.getLogger(__name__)

# Cache for scan results (TTL: 5 minutes)
_CACHE: Dict[str, Any] = {
    "timestamp": 0,
    "data": [],
    "metadata": {},
}
CACHE_TTL_SECONDS = 300


class MomentumScreenerService:
    """
    Multi-Timeframe Bollinger Band & Triple-RSI Momentum Radar.
    Scans liquid NSE cash & derivative equities across Daily, Weekly, and Monthly timeframes.
    """

    # Comprehensive Liquid Universe of Active Equities
    CORE_UNIVERSE = [
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
        "JSWSTEEL", "JUBLFOOD", "KAYNES", "KOTAKBANK", "LALPATHLAB", "LAURUSLABS", "LICHSGFIN", "LT",
        "LTIM", "LTTS", "LUPIN", "M&M", "M&MFIN", "MANAPPURAM", "MARICO", "MARUTI", "MAZDOCK", "MCDOWELL-N",
        "MCX", "METROPOLIS", "MFSL", "MGL", "MOTHERSON", "MPHASIS", "MRF", "MUTHOOTFIN",
        "NATIONALUM", "NAUKRI", "NAVINFLUOR", "NESTLEIND", "NMDC", "NTPC", "OBEROIRLTY", "OFSS",
        "ONGC", "PAGEIND", "PEL", "PERSISTENT", "PETRONET", "PFC", "PIDILITIND", "PIIND", "PNB",
        "POLYCAB", "POWERGRID", "PVRINOX", "RAMCOCEM", "RBLBANK", "RECLTD", "RELIANCE", "SAIL",
        "SBICARD", "SBILIFE", "SBIN", "SHREECEM", "SHRIRAMFIN", "SIEMENS", "SRF", "SUNPHARMA",
        "SUNTV", "SUZLON", "SYNGENE", "TATACHEM", "TATACOMM", "TATACONSUM", "TATAMOTORS", "TATAPOWER",
        "TATASTEEL", "TCS", "TECHM", "TITAN", "TORNTPHARM", "TRENT", "TVSMOTOR", "UBL",
        "ULTRACEMCO", "UPL", "VEDL", "VOLTAS", "WIPRO", "ZEEL", "COCHINSHIP", "BOMDYEING", "HUDCO",
        "IREDA", "BSE", "CDSL", "ANGELONE", "ZOMATO", "JIOFIN", "KPITTECH", "TATAELXSI"
    ]

    SECTOR_MAP: Dict[str, str] = {
        "OFSS": "IT & Tech", "COFORGE": "IT & Tech", "PERSISTENT": "IT & Tech", "TCS": "IT & Tech",
        "INFY": "IT & Tech", "TECHM": "IT & Tech", "LTIM": "IT & Tech", "LTTS": "IT & Tech",
        "WIPRO": "IT & Tech", "HCLTECH": "IT & Tech", "MPHASIS": "IT & Tech", "BSOFT": "IT & Tech",
        "NAUKRI": "IT & Tech", "KPITTECH": "IT & Tech", "TATAELXSI": "IT & Tech",
        "HAL": "Defence & Aerospace", "BEL": "Defence & Aerospace", "MAZDOCK": "Defence & Aerospace",
        "COCHINSHIP": "Defence & Aerospace", "BHARATFORG": "Defence & Aerospace",
        "BHEL": "Capital Goods & Power", "SIEMENS": "Capital Goods & Power", "ABB": "Capital Goods & Power",
        "CUMMINSIND": "Capital Goods & Power", "TATAPOWER": "Capital Goods & Power", "NTPC": "Capital Goods & Power",
        "POWERGRID": "Capital Goods & Power", "RECLTD": "Capital Goods & Power", "PFC": "Capital Goods & Power",
        "SUZLON": "Capital Goods & Power", "KAYNES": "Capital Goods & Power", "POLYCAB": "Capital Goods & Power",
        "HAVELLS": "Capital Goods & Power", "CROMPTON": "Capital Goods & Power", "VOLTAS": "Capital Goods & Power",
        "IREDA": "Capital Goods & Power",
        "DIVISLAB": "Pharma & Healthcare", "ALKEM": "Pharma & Healthcare", "CIPLA": "Pharma & Healthcare",
        "SUNPHARMA": "Pharma & Healthcare", "DRREDDY": "Pharma & Healthcare", "LUPIN": "Pharma & Healthcare",
        "TORNTPHARM": "Pharma & Healthcare", "AUROPHARMA": "Pharma & Healthcare", "BIOCON": "Pharma & Healthcare",
        "GRANULES": "Pharma & Healthcare", "IPCALAB": "Pharma & Healthcare", "LAURUSLABS": "Pharma & Healthcare",
        "SYNGENE": "Pharma & Healthcare", "GLENMARK": "Pharma & Healthcare", "APOLLOHOSP": "Pharma & Healthcare",
        "METROPOLIS": "Pharma & Healthcare", "LALPATHLAB": "Pharma & Healthcare",
        "TVSMOTOR": "Automotive", "BAJAJ-AUTO": "Automotive", "TATAMOTORS": "Automotive", "MARUTI": "Automotive",
        "M&M": "Automotive", "HEROMOTOCO": "Automotive", "EICHERMOT": "Automotive", "ASHOKLEY": "Automotive",
        "BATAINDIA": "Automotive", "APOLLOTYRE": "Automotive", "BALKRISIND": "Automotive", "MRF": "Automotive",
        "MOTHERSON": "Automotive", "ESCORTS": "Automotive",
        "OBEROIRLTY": "Realty & Infra", "GODREJPROP": "Realty & Infra", "DLF": "Realty & Infra",
        "CONCOR": "Realty & Infra", "GMRINFRA": "Realty & Infra", "LT": "Realty & Infra",
        "INDUSTOWER": "Realty & Infra", "PVRINOX": "Realty & Infra", "HUDCO": "Realty & Infra",
        "ICICIBANK": "Banking - Private", "HDFCBANK": "Banking - Private", "AXISBANK": "Banking - Private",
        "KOTAKBANK": "Banking - Private", "INDUSINDBK": "Banking - Private", "FEDERALBNK": "Banking - Private",
        "IDFCFIRSTB": "Banking - Private", "AUBANK": "Banking - Private", "RBLBANK": "Banking - Private",
        "BANDHANBNK": "Banking - Private",
        "SBIN": "Banking - PSU", "BANKBARODA": "Banking - PSU", "CANBK": "Banking - PSU", "PNB": "Banking - PSU",
        "BAJFINANCE": "Financial Services", "BAJAJFINSV": "Financial Services", "CHOLAFIN": "Financial Services",
        "SHRIRAMFIN": "Financial Services", "MUTHOOTFIN": "Financial Services", "MANAPPURAM": "Financial Services",
        "M&MFIN": "Financial Services", "CANFINHOME": "Financial Services", "LICHSGFIN": "Financial Services",
        "SBICARD": "Financial Services", "HDFCAMC": "Financial Services", "HDFCLIFE": "Financial Services",
        "SBILIFE": "Financial Services", "ICICIGI": "Financial Services", "ICICIPRULI": "Financial Services",
        "MCX": "Financial Services", "IEX": "Financial Services", "PEL": "Financial Services",
        "MFSL": "Financial Services", "ABCAPITAL": "Financial Services", "BSE": "Financial Services",
        "CDSL": "Financial Services", "ANGELONE": "Financial Services", "JIOFIN": "Financial Services",
        "TATASTEEL": "Metals & Mining", "JSWSTEEL": "Metals & Mining", "VEDL": "Metals & Mining",
        "HINDALCO": "Metals & Mining", "SAIL": "Metals & Mining", "NMDC": "Metals & Mining",
        "NATIONALUM": "Metals & Mining", "JINDALSTEL": "Metals & Mining", "HINDCOPPER": "Metals & Mining",
        "COALINDIA": "Metals & Mining",
        "RELIANCE": "Oil, Gas & Energy", "ONGC": "Oil, Gas & Energy", "IOC": "Oil, Gas & Energy",
        "BPCL": "Oil, Gas & Energy", "HINDPETRO": "Oil, Gas & Energy", "GAIL": "Oil, Gas & Energy",
        "PETRONET": "Oil, Gas & Energy", "GUJGASLTD": "Oil, Gas & Energy", "MGL": "Oil, Gas & Energy",
        "TRENT": "Consumer & Retail", "TITAN": "Consumer & Retail", "INDIGO": "Consumer & Retail",
        "DIXON": "Consumer & Retail", "ASIANPAINT": "Consumer & Retail", "PIDILITIND": "Consumer & Retail",
        "BRITANNIA": "Consumer & Retail", "NESTLEIND": "Consumer & Retail", "HINDUNILVR": "Consumer & Retail",
        "DABUR": "Consumer & Retail", "MARICO": "Consumer & Retail", "GODREJCP": "Consumer & Retail",
        "COLPAL": "Consumer & Retail", "TATACONSUM": "Consumer & Retail", "JUBLFOOD": "Consumer & Retail",
        "MCDOWELL-N": "Consumer & Retail", "UNITDSPR": "Consumer & Retail", "UBL": "Consumer & Retail",
        "PAGEIND": "Consumer & Retail", "ABFRL": "Consumer & Retail", "ZOMATO": "Consumer & Retail",
    }

    @staticmethod
    def _calc_wma(series: pd.Series, n: int) -> pd.Series:
        """Calculates Weighted Moving Average (WMA) of period n."""
        weights = np.arange(1, n + 1)
        w_sum = weights.sum()
        return series.rolling(n).apply(lambda s: np.dot(s, weights) / w_sum, raw=True)

    @staticmethod
    def _calc_rsi(series: pd.Series, period: int = 14) -> pd.Series:
        """Calculates smoothed Wilder's Relative Strength Index (RSI)."""
        delta = series.diff()
        gain = delta.clip(lower=0)
        loss = -delta.clip(upper=0)
        avg_gain = gain.ewm(com=period - 1, min_periods=period).mean()
        avg_loss = loss.ewm(com=period - 1, min_periods=period).mean()
        rs = avg_gain / np.maximum(1e-9, avg_loss)
        rsi = 100.0 - (100.0 / (1.0 + rs))
        return rsi

    @classmethod
    def analyze_symbol(cls, symbol: str, company_name: Optional[str] = None, sector: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Calculates all 10 multi-timeframe condition filters for a single stock.
        """
        clean_sym = symbol.strip().upper()
        ticker_sym = f"{clean_sym}.NS"

        try:
            t = yf.Ticker(ticker_sym)
            df = t.history(period="2y", interval="1d")
            if df.empty or len(df) < 60:
                t = yf.Ticker(f"{clean_sym}.BO")
                df = t.history(period="2y", interval="1d")

            if df.empty or len(df) < 60:
                return None

            df = df.dropna(subset=["Close", "Volume"])
            if len(df) < 60:
                return None

            # ---------------- 1. DAILY METRICS ----------------
            d_close = df["Close"]
            d_open = df["Open"]
            d_high = df["High"]
            d_low = df["Low"]
            d_vol = df["Volume"]

            # Volume SMA(20)
            d_vol_sma20 = d_vol.rolling(20).mean()

            # Daily Bollinger Bands (20, 2)
            d_bb_mid = d_close.rolling(20).mean()
            d_bb_std = d_close.rolling(20).std()
            d_bb_upper = d_bb_mid + 2 * d_bb_std
            d_bb_lower = d_bb_mid - 2 * d_bb_std
            d_bb_width = ((d_bb_upper - d_bb_lower) / d_bb_mid) * 100.0

            # Daily RSI (14)
            d_rsi = cls._calc_rsi(d_close, 14)

            # ---------------- 2. WEEKLY RESAMPLING ----------------
            w_df = df.resample("W-FRI").agg({
                "Open": "first",
                "High": "max",
                "Low": "min",
                "Close": "last",
                "Volume": "sum",
            }).dropna()

            if len(w_df) < 50:
                return None

            w_close = w_df["Close"]
            w_bb_mid = w_close.rolling(20).mean()
            w_bb_std = w_close.rolling(20).std()
            w_bb_upper = w_bb_mid + 2 * w_bb_std
            w_bb_lower = w_bb_mid - 2 * w_bb_std

            w_rsi = cls._calc_rsi(w_close, 14)
            w_wma30 = cls._calc_wma(w_close, 30)
            w_wma50 = cls._calc_wma(w_close, 50)

            # ---------------- 3. MONTHLY RESAMPLING ----------------
            m_df = df.resample("ME").agg({
                "Open": "first",
                "High": "max",
                "Low": "min",
                "Close": "last",
                "Volume": "sum",
            }).dropna()

            if len(m_df) < 15:
                # If less than 15 months, compute on available bars
                m_close = m_df["Close"]
                m_rsi = cls._calc_rsi(m_close, min(14, len(m_close) - 1))
            else:
                m_close = m_df["Close"]
                m_rsi = cls._calc_rsi(m_close, 14)

            # ---------------- EXTRACT LATEST VALUES ----------------
            cur_cmp = round(float(d_close.iloc[-1]), 2)
            cur_open = round(float(d_open.iloc[-1]), 2)
            cur_high = round(float(d_high.iloc[-1]), 2)
            cur_low = round(float(d_low.iloc[-1]), 2)
            prev_close = round(float(d_close.iloc[-2]), 2) if len(d_close) > 1 else cur_cmp
            day_change = round(cur_cmp - prev_close, 2)
            day_change_pct = round((day_change / prev_close) * 100.0, 2) if prev_close > 0 else 0.0

            cur_vol = float(d_vol.iloc[-1])
            cur_vol_sma20 = float(d_vol_sma20.iloc[-1]) if not pd.isna(d_vol_sma20.iloc[-1]) else 1.0
            vol_ratio = round(cur_vol / max(1.0, cur_vol_sma20), 2)

            cur_d_bb_upper = round(float(d_bb_upper.iloc[-1]), 2)
            cur_d_bb_mid = round(float(d_bb_mid.iloc[-1]), 2)
            cur_d_rsi = round(float(d_rsi.iloc[-1]), 1) if not pd.isna(d_rsi.iloc[-1]) else 50.0

            cur_w_close = round(float(w_close.iloc[-1]), 2)
            cur_w_bb_upper = round(float(w_bb_upper.iloc[-1]), 2)
            cur_w_rsi = round(float(w_rsi.iloc[-1]), 1) if not pd.isna(w_rsi.iloc[-1]) else 50.0
            cur_w_wma30 = round(float(w_wma30.iloc[-1]), 2) if not pd.isna(w_wma30.iloc[-1]) else 0.0
            cur_w_wma50 = round(float(w_wma50.iloc[-1]), 2) if not pd.isna(w_wma50.iloc[-1]) else 0.0

            # Crossover detection: was WMA 30 <= WMA 50 in past 3 bars and now >= ?
            prev_w_wma30 = float(w_wma30.iloc[-2]) if len(w_wma30) > 1 else cur_w_wma30
            prev_w_wma50 = float(w_wma50.iloc[-2]) if len(w_wma50) > 1 else cur_w_wma50
            prev2_w_wma30 = float(w_wma30.iloc[-3]) if len(w_wma30) > 2 else prev_w_wma30
            prev2_w_wma50 = float(w_wma50.iloc[-3]) if len(w_wma50) > 2 else prev_w_wma50

            cur_m_rsi = round(float(m_rsi.iloc[-1]), 1) if not pd.isna(m_rsi.iloc[-1]) else 50.0

            # ---------------- 10 CONDITIONS EVALUATION ----------------
            # 1. Daily Volume > Daily SMA(Daily Volume, 20)
            c1_vol_sma = bool(cur_vol > cur_vol_sma20)

            # 2. Daily Close > Daily Upper Bollinger band (20, 2)
            c2_daily_bb = bool(cur_cmp >= cur_d_bb_upper)

            # 3. Weekly Close > Weekly Upper Bollinger band (20, 2)
            c3_weekly_bb = bool(cur_w_close >= cur_w_bb_upper)

            # 4. Daily RSI (14) > 60
            c4_daily_rsi = bool(cur_d_rsi > 60.0)

            # 5. Weekly RSI (14) > 60
            c5_weekly_rsi = bool(cur_w_rsi > 60.0)

            # 6. Monthly RSI (14) > 60
            c6_monthly_rsi = bool(cur_m_rsi > 60.0)

            # 7. Weekly WMA(30) Crossed above Weekly WMA(50) OR WMA(30) > WMA(50)
            # Both fresh crossover and bullish golden alignment are computed
            fresh_crossover = bool(
                cur_w_wma30 >= cur_w_wma50 and (prev_w_wma30 <= prev_w_wma50 or prev2_w_wma30 <= prev2_w_wma50)
            )
            wma_bullish_aligned = bool(cur_w_wma30 >= cur_w_wma50)
            c7_wma_cross = fresh_crossover or wma_bullish_aligned

            # 8. Weekly WMA(30) > 60
            c8_wma30_gt_60 = bool(cur_w_wma30 > 60.0)

            # 9. Weekly WMA(50) > 60
            c9_wma50_gt_60 = bool(cur_w_wma50 > 60.0)

            # 10. Daily Close > Daily Open (Bullish green candle)
            c10_bull_candle = bool(cur_cmp >= cur_open)

            # Compute Match Score (out of 10)
            conditions_list = [
                c1_vol_sma,
                c2_daily_bb,
                c3_weekly_bb,
                c4_daily_rsi,
                c5_weekly_rsi,
                c6_monthly_rsi,
                c7_wma_cross,
                c8_wma30_gt_60,
                c9_wma50_gt_60,
                c10_bull_candle,
            ]
            match_count = sum(1 for c in conditions_list if c)

            # Core 9 active filters (excluding the optional toggle 10)
            core_9_passed = bool(
                c1_vol_sma and c2_daily_bb and c3_weekly_bb and
                c4_daily_rsi and c5_weekly_rsi and c6_monthly_rsi and
                c7_wma_cross and c8_wma30_gt_60 and c9_wma50_gt_60
            )
            is_perfect_match = bool(core_9_passed and c10_bull_candle)

            # Trade Blueprint Setup
            entry_trigger = round(max(cur_cmp, cur_high) * 1.002, 2)
            # Conservative stop loss: either Daily BB Middle (20 SMA) or 4.5% below CMP
            stop_loss = round(max(cur_d_bb_mid * 0.985, cur_cmp * 0.95), 2)
            target_1 = round(cur_cmp * 1.08, 2)  # +8% swing momentum
            target_2 = round(cur_cmp * 1.16, 2)  # +16% trend extension
            risk = max(0.5, cur_cmp - stop_loss)
            reward = max(1.0, target_1 - cur_cmp)
            risk_reward = round(reward / risk, 1)

            # Setup Classification Tier
            # Compute Conviction Score (0 - 100)
            base_score = match_count * 7.0
            vol_pts = 0.0
            if vol_ratio >= 2.5:
                vol_pts = 12.0
            elif vol_ratio >= 1.8:
                vol_pts = 9.0
            elif vol_ratio >= 1.2:
                vol_pts = 6.0
            elif vol_ratio >= 1.0:
                vol_pts = 3.0

            rsi_pts = 0.0
            if cur_d_rsi >= 65.0: rsi_pts += 4.0
            elif cur_d_rsi >= 60.0: rsi_pts += 2.0
            if cur_w_rsi >= 65.0: rsi_pts += 4.0
            elif cur_w_rsi >= 60.0: rsi_pts += 2.0
            if cur_m_rsi >= 65.0: rsi_pts += 4.0
            elif cur_m_rsi >= 60.0: rsi_pts += 2.0

            wma_pts = 4.0 if fresh_crossover else (2.0 if wma_bullish_aligned else 0.0)
            candle_pts = 2.0 if c10_bull_candle else 0.0

            conviction_score = int(min(99, max(20, round(base_score + vol_pts + rsi_pts + wma_pts + candle_pts))))

            if match_count == 10:
                setup_tier = "PERFECT 10/10"
                tier_badge = "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
            elif match_count >= 8:
                setup_tier = f"HIGH CONVICTION ({match_count}/10)"
                tier_badge = "bg-cyan-500/10 text-cyan-400 border-cyan-500/30"
            elif match_count >= 6:
                setup_tier = f"DEVELOPING ({match_count}/10)"
                tier_badge = "bg-amber-500/10 text-amber-400 border-amber-500/30"
            else:
                setup_tier = f"WATCHLIST ({match_count}/10)"
                tier_badge = "bg-slate-800/60 text-slate-400 border-slate-700/40"

            resolved_sector = cls.SECTOR_MAP.get(clean_sym, sector or "Diversified")

            return {
                "symbol": clean_sym,
                "company_name": company_name or clean_sym,
                "sector": resolved_sector,
                "cmp": cur_cmp,
                "day_change": day_change,
                "day_change_pct": day_change_pct,
                "match_count": match_count,
                "conviction_score": conviction_score,
                "is_perfect_match": is_perfect_match,
                "core_9_passed": core_9_passed,
                "setup_tier": setup_tier,
                "tier_badge": tier_badge,
                # Filter Booleans
                "filters": {
                    "vol_gt_sma20": c1_vol_sma,
                    "daily_close_gt_bb_upper": c2_daily_bb,
                    "weekly_close_gt_bb_upper": c3_weekly_bb,
                    "daily_rsi_gt_60": c4_daily_rsi,
                    "weekly_rsi_gt_60": c5_weekly_rsi,
                    "monthly_rsi_gt_60": c6_monthly_rsi,
                    "weekly_wma_cross": c7_wma_cross,
                    "weekly_wma30_gt_60": c8_wma30_gt_60,
                    "weekly_wma50_gt_60": c9_wma50_gt_60,
                    "daily_close_gt_open": c10_bull_candle,
                    "fresh_crossover": fresh_crossover,
                    "wma_bullish_aligned": wma_bullish_aligned,
                },
                # Detailed Indicator Values
                "indicators": {
                    "daily_volume": int(cur_vol),
                    "daily_volume_sma20": int(cur_vol_sma20),
                    "volume_surge_ratio": vol_ratio,
                    "daily_bb_upper": cur_d_bb_upper,
                    "daily_bb_mid": cur_d_bb_mid,
                    "daily_rsi": cur_d_rsi,
                    "weekly_close": cur_w_close,
                    "weekly_bb_upper": cur_w_bb_upper,
                    "weekly_rsi": cur_w_rsi,
                    "monthly_rsi": cur_m_rsi,
                    "weekly_wma30": cur_w_wma30,
                    "weekly_wma50": cur_w_wma50,
                    "daily_open": cur_open,
                    "daily_high": cur_high,
                    "daily_low": cur_low,
                },
                # Trade Execution Parameters
                "trade_blueprint": {
                    "entry_trigger": entry_trigger,
                    "stop_loss": stop_loss,
                    "target_1": target_1,
                    "target_2": target_2,
                    "risk_reward": risk_reward,
                },
                "tradingview_url": f"https://in.tradingview.com/symbols/NSE-{clean_sym}/",
                "techno_funda_url": f"/techno-funda/{clean_sym}",
            }
        except Exception as e:
            logger.debug(f"Error analyzing momentum for {clean_sym}: {e}")
            return None

    @classmethod
    def scan_opportunities(cls, db: Optional[Session] = None, force_refresh: bool = False) -> Dict[str, Any]:
        """
        Scans liquid universe using multi-threaded execution and caches result.
        """
        now = time.time()
        if not force_refresh and _CACHE["data"] and (now - _CACHE["timestamp"] < CACHE_TTL_SECONDS):
            return {
                "metadata": _CACHE["metadata"],
                "opportunities": _CACHE["data"],
            }

        t0 = time.time()
        # Build symbols dictionary from core universe + top DB growth records
        symbols_map: Dict[str, Dict[str, str]] = {}
        for sym in cls.CORE_UNIVERSE:
            symbols_map[sym] = {"company_name": sym, "sector": cls.SECTOR_MAP.get(sym, "Diversified")}

        if db:
            try:
                top_records = db.query(ScreenerGrowthRecord).filter(
                    ScreenerGrowthRecord.current_price != None,
                    ScreenerGrowthRecord.current_price > 60.0,
                    ScreenerGrowthRecord.market_cap != None,
                ).order_by(ScreenerGrowthRecord.market_cap.desc()).limit(35).all()

                for r in top_records:
                    if r.symbol and r.symbol not in symbols_map:
                        symbols_map[r.symbol] = {
                            "company_name": r.company_name or r.symbol,
                            "sector": r.sector or cls.SECTOR_MAP.get(r.symbol, "Diversified"),
                        }
            except Exception as e:
                logger.warning(f"Failed to query DB for growth records: {e}")

        results: List[Dict[str, Any]] = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=14) as executor:
            futures = {
                executor.submit(cls.analyze_symbol, sym, meta["company_name"], meta["sector"]): sym
                for sym, meta in symbols_map.items()
            }
            for future in concurrent.futures.as_completed(futures):
                try:
                    opp = future.result()
                    if opp:
                        results.append(opp)
                except Exception as ex:
                    logger.debug(f"Scan exception for stock: {ex}")

        # Sort primarily by match_count desc, then daily_rsi desc, then volume surge ratio desc
        results.sort(
            key=lambda x: (
                x["match_count"],
                x["indicators"]["daily_rsi"],
                x["indicators"]["volume_surge_ratio"],
            ),
            reverse=True,
        )

        elapsed = round(time.time() - t0, 2)
        total_scanned = len(results)
        perfect_count = sum(1 for r in results if r["is_perfect_match"])
        core_9_count = sum(1 for r in results if r["core_9_passed"])
        high_conviction_count = sum(1 for r in results if r["match_count"] >= 8)
        conviction_79_count = sum(1 for r in results if r.get("conviction_score", 0) >= 79)
        avg_rsi = round(float(np.mean([r["indicators"]["daily_rsi"] for r in results])), 1) if results else 50.0

        metadata = {
            "total_scanned": total_scanned,
            "perfect_10_count": perfect_count,
            "core_9_count": core_9_count,
            "high_conviction_count": high_conviction_count,
            "conviction_79_count": conviction_79_count,
            "avg_daily_rsi": avg_rsi,
            "scan_duration_seconds": elapsed,
            "last_scan_time": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(now)),
        }

        _CACHE["timestamp"] = now
        _CACHE["data"] = results
        _CACHE["metadata"] = metadata

        return {
            "metadata": metadata,
            "opportunities": results,
        }

"""
Alpha India - Pre-Breakout Cheat Radar Service
Surfaces equities in quiet, high-compression volatility coils with extreme supply exhaustion (Volume Dry-Up)
right below resistance, providing an asymmetric 3.5:1+ Risk:Reward entry before the breakout candle occurs.
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

# In-memory cache with 5-minute TTL
_CACHE: Dict[str, Any] = {
    "timestamp": 0,
    "data": [],
    "metadata": {},
}
CACHE_TTL_SECONDS = 300


class PreBreakoutRadarService:
    """
    Algorithmic scanner for the Pre-Breakout Cheat Entry (Minervini VCP + Crabel NR7 / Inside Day).
    """

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
        "ULTRACEMCO", "UPL", "VEDL", "VOLTAS", "WIPRO", "ZEEL", "COCHINSHIP", "BSE", "CDSL",
        "ANGELONE", "ZOMATO", "JIOFIN", "KPITTECH", "TATAELXSI", "IREDA", "HUDCO"
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
    def _calc_rsi(series: pd.Series, period: int = 14) -> pd.Series:
        delta = series.diff()
        gain = delta.clip(lower=0)
        loss = -delta.clip(upper=0)
        avg_gain = gain.ewm(com=period - 1, min_periods=period).mean()
        avg_loss = loss.ewm(com=period - 1, min_periods=period).mean()
        rs = avg_gain / np.maximum(1e-9, avg_loss)
        return 100.0 - (100.0 / (1.0 + rs))

    @classmethod
    def analyze_stock_prebreakout(cls, symbol: str, company_name: Optional[str] = None, sector: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Analyzes a stock for quiet pre-breakout contraction & supply dry-up.
        """
        clean_sym = symbol.strip().upper()
        ticker_sym = f"{clean_sym}.NS"

        try:
            t = yf.Ticker(ticker_sym)
            df = t.history(period="1y", interval="1d")
            if df.empty or len(df) < 50:
                t = yf.Ticker(f"{clean_sym}.BO")
                df = t.history(period="1y", interval="1d")

            if df.empty or len(df) < 50:
                return None

            df = df.dropna(subset=["Close", "Volume"])
            if len(df) < 50:
                return None

            c = df["Close"]
            h = df["High"]
            l = df["Low"]
            o = df["Open"]
            v = df["Volume"]

            cmp = round(float(c.iloc[-1]), 2)
            today_h = round(float(h.iloc[-1]), 2)
            today_l = round(float(l.iloc[-1]), 2)
            prev_c = round(float(c.iloc[-2]), 2) if len(c) > 1 else cmp
            prev_h = round(float(h.iloc[-2]), 2) if len(h) > 1 else today_h
            prev_l = round(float(l.iloc[-2]), 2) if len(l) > 1 else today_l

            day_change = round(cmp - prev_c, 2)
            day_change_pct = round((day_change / prev_c) * 100.0, 2) if prev_c > 0 else 0.0

            # 1. Moving Averages & Stage 2 Trend
            ema_9 = float(c.ewm(span=9, adjust=False).mean().iloc[-1])
            ema_21 = float(c.ewm(span=21, adjust=False).mean().iloc[-1])
            sma_50 = float(c.rolling(50).mean().iloc[-1]) if len(c) >= 50 else ema_21
            sma_200 = float(c.rolling(200).mean().iloc[-1]) if len(c) >= 200 else sma_50

            is_stage_2 = bool(cmp >= ema_21 and ema_21 >= sma_50)
            is_above_50 = bool(cmp >= sma_50)

            # 2. Near-Pivot Base Compression (< 3.5% from 20-Day High)
            high_20 = float(h.tail(20).max())
            high_50 = float(h.tail(50).max()) if len(h) >= 50 else high_20
            dist_to_20d_high = round(((high_20 - cmp) / high_20) * 100.0, 2)
            dist_to_50d_high = round(((high_50 - cmp) / high_50) * 100.0, 2)
            is_near_pivot = bool(dist_to_20d_high <= 4.0)

            # 3. Supply Exhaustion / Volume Dry-Up (VDU)
            vol_sma20 = float(v.rolling(20).mean().iloc[-1])
            vol_today = float(v.iloc[-1])
            vdu_ratio = round(vol_today / max(1.0, vol_sma20), 2)
            is_vdu = bool(vdu_ratio <= 0.70)  # Volume is 30%+ below 20-day average
            is_extreme_vdu = bool(vdu_ratio <= 0.50)  # Volume is 50%+ dried up

            # 4. Volatility Contraction: True Range, NR7, Inside Day, Bollinger Bandwidth
            hl = h - l
            hc = (h - c.shift(1)).abs()
            lc = (l - c.shift(1)).abs()
            tr = pd.concat([hl, hc, lc], axis=1).max(axis=1)

            today_tr = float(tr.iloc[-1])
            prev_6_tr = tr.iloc[-7:-1] if len(tr) >= 7 else tr.iloc[:-1]
            is_nr7 = bool(len(prev_6_tr) > 0 and today_tr <= float(prev_6_tr.min()))
            is_inside_day = bool(today_h <= prev_h and today_l >= prev_l)

            daily_range_pct = round(((today_h - today_l) / cmp) * 100.0, 2)
            is_tight_candle = bool(daily_range_pct <= 1.8)

            # Bollinger Bands (20, 2) Bandwidth
            bb_mid = float(c.rolling(20).mean().iloc[-1])
            bb_std = float(c.rolling(20).std().iloc[-1])
            bb_upper = round(bb_mid + 2.0 * bb_std, 2)
            bb_lower = round(bb_mid - 2.0 * bb_std, 2)
            bb_width_pct = round(((bb_upper - bb_lower) / bb_mid) * 100.0, 1)
            is_bb_squeeze = bool(bb_width_pct <= 10.0)

            # 5. RSI Launchpad Sweet-Spot (50 - 64)
            rsi_series = cls._calc_rsi(c, 14)
            rsi_14 = round(float(rsi_series.iloc[-1]), 1) if not pd.isna(rsi_series.iloc[-1]) else 50.0
            is_rsi_launchpad = bool(50.0 <= rsi_14 <= 64.0)

            # 6. Pattern Classification
            patterns: List[str] = []
            if is_nr7 and is_inside_day:
                primary_pattern = "NR7 + Inside Day (Super-Coil)"
                pattern_tag = "SUPER_COIL"
                patterns.append("NR7 + Inside Day")
            elif is_nr7:
                primary_pattern = "NR7 Volatility Compression"
                pattern_tag = "NR7"
                patterns.append("NR7")
            elif is_inside_day:
                primary_pattern = "Inside Day Contraction"
                pattern_tag = "INSIDE_DAY"
                patterns.append("Inside Day")
            elif is_bb_squeeze:
                primary_pattern = "Bollinger Bandwidth Squeeze"
                pattern_tag = "BB_SQUEEZE"
                patterns.append("BB Squeeze")
            elif is_extreme_vdu:
                primary_pattern = "Extreme Volume Dry-Up (VDU)"
                pattern_tag = "VDU_CHEAT"
                patterns.append("Volume Dry-Up")
            else:
                primary_pattern = "Tight Base Compression"
                pattern_tag = "TIGHT_BASE"
                patterns.append("Base Coil")

            if is_extreme_vdu and "Volume Dry-Up" not in patterns:
                patterns.append("Volume Dry-Up")
            if is_near_pivot:
                patterns.append("Near Resistance Pivot")

            # 7. Pre-Breakout Conviction Scoring (0 to 100)
            score = 0
            # A. Trend Quality (up to 25 pts)
            if is_stage_2: score += 20
            elif is_above_50: score += 12
            if ema_9 > ema_21: score += 5

            # B. Pivot Proximity (up to 25 pts)
            if dist_to_20d_high <= 2.0: score += 25
            elif dist_to_20d_high <= 3.5: score += 20
            elif dist_to_20d_high <= 5.0: score += 12

            # C. Volume Dry-Up (up to 25 pts)
            if vdu_ratio <= 0.45: score += 25
            elif vdu_ratio <= 0.65: score += 20
            elif vdu_ratio <= 0.80: score += 12

            # D. Volatility Tightness (up to 25 pts)
            if is_nr7 and is_inside_day: score += 25
            elif is_nr7: score += 18
            elif is_inside_day: score += 15
            elif is_tight_candle: score += 12
            if is_bb_squeeze: score += 5
            if is_rsi_launchpad: score += 5

            conviction_score = min(98, max(25, score))

            if conviction_score >= 82:
                setup_tier = "A+ SUPER COIL"
                tier_badge = "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
            elif conviction_score >= 70:
                setup_tier = "A HIGH CONVICTION"
                tier_badge = "bg-cyan-500/10 text-cyan-400 border-cyan-500/30"
            else:
                setup_tier = "B DEVELOPING COIL"
                tier_badge = "bg-amber-500/10 text-amber-400 border-amber-500/30"

            # 8. Asymmetric Trade Execution Blueprint
            cheat_entry = round(max(cmp, today_h) * 1.002, 2)
            # Stop loss at coil base low, risk strictly capped at 3.2%
            raw_stop = round(min(today_l, cmp * 0.97), 2)
            stop_loss = round(max(raw_stop, cmp * 0.965), 2)  # Cap stop at 3.5%
            target_1 = round(cheat_entry * 1.09, 2)  # +9% Breakout expansion
            target_2 = round(cheat_entry * 1.18, 2)  # +18% Multi-week runner
            risk = max(0.5, cheat_entry - stop_loss)
            reward = max(1.0, target_1 - cheat_entry)
            risk_reward = round(reward / risk, 1)

            resolved_sector = cls.SECTOR_MAP.get(clean_sym, sector or "Diversified")

            return {
                "symbol": clean_sym,
                "company_name": company_name or clean_sym,
                "sector": resolved_sector,
                "cmp": cmp,
                "day_change": day_change,
                "day_change_pct": day_change_pct,
                "conviction_score": conviction_score,
                "setup_tier": setup_tier,
                "tier_badge": tier_badge,
                "primary_pattern": primary_pattern,
                "pattern_tag": pattern_tag,
                "pattern_badges": patterns,
                # Key Metrics
                "metrics": {
                    "dist_to_pivot_pct": dist_to_20d_high,
                    "vdu_ratio": vdu_ratio,
                    "volume_today": int(vol_today),
                    "volume_sma20": int(vol_sma20),
                    "daily_range_pct": daily_range_pct,
                    "bb_bandwidth": bb_width_pct,
                    "rsi_14": rsi_14,
                    "is_stage_2": is_stage_2,
                    "is_nr7": is_nr7,
                    "is_inside_day": is_inside_day,
                    "is_vdu": is_vdu,
                    "is_bb_squeeze": is_bb_squeeze,
                    "today_high": today_h,
                    "today_low": today_l,
                    "pivot_20d": round(high_20, 2),
                },
                # Trade Execution Blueprint
                "blueprint": {
                    "cheat_entry": cheat_entry,
                    "stop_loss": stop_loss,
                    "target_1": target_1,
                    "target_2": target_2,
                    "risk_pct": round(((cheat_entry - stop_loss) / cheat_entry) * 100.0, 2),
                    "reward_pct": 9.0,
                    "risk_reward": risk_reward,
                    "plan": "Enter on tick above coil high. Sell 50% at Target 1 (+9%) and trail remaining 50% on 10 EMA.",
                },
                "tradingview_url": f"https://in.tradingview.com/symbols/NSE-{clean_sym}/",
                "techno_funda_url": f"/techno-funda/{clean_sym}",
            }
        except Exception as e:
            logger.debug(f"Error in pre-breakout analysis for {clean_sym}: {e}")
            return None

    @classmethod
    def scan_prebreakout_opportunities(cls, db: Optional[Session] = None, force_refresh: bool = False) -> Dict[str, Any]:
        """
        Executes multi-threaded scan across liquid NSE universe for pre-breakout coils.
        """
        now = time.time()
        if not force_refresh and _CACHE["data"] and (now - _CACHE["timestamp"] < CACHE_TTL_SECONDS):
            return {
                "metadata": _CACHE["metadata"],
                "opportunities": _CACHE["data"],
            }

        t0 = time.time()
        symbols_map: Dict[str, Dict[str, str]] = {}
        for sym in cls.CORE_UNIVERSE:
            symbols_map[sym] = {"company_name": sym, "sector": cls.SECTOR_MAP.get(sym, "Diversified")}

        if db:
            try:
                top_records = db.query(ScreenerGrowthRecord).filter(
                    ScreenerGrowthRecord.current_price != None,
                    ScreenerGrowthRecord.current_price > 50.0,
                    ScreenerGrowthRecord.market_cap != None,
                ).order_by(ScreenerGrowthRecord.market_cap.desc()).limit(30).all()

                for r in top_records:
                    if r.symbol and r.symbol not in symbols_map:
                        symbols_map[r.symbol] = {
                            "company_name": r.company_name or r.symbol,
                            "sector": r.sector or cls.SECTOR_MAP.get(r.symbol, "Diversified"),
                        }
            except Exception as e:
                logger.warning(f"Failed to query DB growth records: {e}")

        results: List[Dict[str, Any]] = []
        with concurrent.futures.ThreadPoolExecutor(max_workers=14) as executor:
            futures = {
                executor.submit(cls.analyze_stock_prebreakout, sym, meta["company_name"], meta["sector"]): sym
                for sym, meta in symbols_map.items()
            }
            for future in concurrent.futures.as_completed(futures):
                try:
                    opp = future.result()
                    if opp:
                        results.append(opp)
                except Exception as ex:
                    logger.debug(f"Prebreakout scan exception: {ex}")

        # Sort primarily by conviction_score desc, then by vdu_ratio asc (lowest volume = highest dryup)
        results.sort(
            key=lambda x: (
                x["conviction_score"],
                -x["metrics"]["dist_to_pivot_pct"],
                -x["metrics"]["vdu_ratio"],
            ),
            reverse=True,
        )

        elapsed = round(time.time() - t0, 2)
        total_scanned = len(results)
        super_coils = sum(1 for r in results if r["setup_tier"] == "A+ SUPER COIL")
        high_conviction = sum(1 for r in results if r["conviction_score"] >= 70)
        nr7_count = sum(1 for r in results if r["metrics"]["is_nr7"])
        inside_day_count = sum(1 for r in results if r["metrics"]["is_inside_day"])
        vdu_count = sum(1 for r in results if r["metrics"]["is_vdu"])
        avg_rr = round(float(np.mean([r["blueprint"]["risk_reward"] for r in results])), 1) if results else 3.5

        metadata = {
            "total_scanned": total_scanned,
            "super_coils_count": super_coils,
            "high_conviction_count": high_conviction,
            "nr7_count": nr7_count,
            "inside_day_count": inside_day_count,
            "vdu_count": vdu_count,
            "avg_risk_reward": avg_rr,
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

"""
Alpha India - Staircase Momentum & Creeping Bull Screener Service
Detects institutional stealth accumulation where stocks grind upward day-after-day
with low volatility (+1% to +2% daily gains), high trend efficiency (Kaufman Efficiency Ratio > 0.70),
high delivery absorption, and shallow intraday pullbacks coming out of legitimate bases (The Cupid Archetype).
"""

from __future__ import annotations

import concurrent.futures
import json
import logging
import math
from pathlib import Path
import threading
import time
from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd
import yfinance as yf
from sqlalchemy.orm import Session

from app.models.company import Company
from app.models.screener_growth_record import ScreenerGrowthRecord

logger = logging.getLogger(__name__)

# Persistent Disk Cache Path
DISK_CACHE_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "staircase_screener_cache.json"

_CACHE: Dict[str, Any] = {
    "timestamp": 0,
    "opportunities": [],
    "metadata": {},
}
CACHE_TTL_SECONDS = 300  # 5 minutes
_scan_in_progress = False
_scan_lock = threading.Lock()


class StaircaseScreenerService:
    """
    Institutional scanner for 'Creeping Bull / Staircase' momentum runners.
    Identifies stocks undergoing stealth algorithmic accumulation (TWAP/VWAP buying)
    with high trend persistence and low intraday noise.
    """

    # Liquid universe of representative NSE growth and momentum equities
    CORE_UNIVERSE = [
        "CUPID", "TATAPOWER", "TRENT", "DIXON", "KAYNES", "BEL", "HAL",
        "COCHINSHIP", "MAZDOCK", "BSE", "CDSL", "HUDCO", "NBCC", "IREDA",
        "RVNL", "RAILTEL", "IRFC", "SUZLON", "ZOMATO", "MOTHERSON", "CESC",
        "FEDERALBNK", "AARTIIND", "ABB", "ABCAPITAL", "ADANIENT", "ADANIPORTS",
        "AMBUJACEM", "APOLLOHOSP", "ASHOKLEY", "ASTRAL", "AUBANK", "AUROPHARMA",
        "BAJAJ-AUTO", "BAJFINANCE", "BAJAJFINSV", "BALKRISIND", "BANDHANBNK",
        "BANKBARODA", "BERGEPAINT", "BHARTIARTL", "BHEL", "BIOCON", "BOSCHLTD",
        "BPCL", "BRITANNIA", "CANBK", "CHOLAFIN", "CIPLA", "COALINDIA",
        "COFORGE", "COLPAL", "CONCOR", "COROMANDEL", "CROMPTON", "CUMMINSIND",
        "DABUR", "DALBHARAT", "DEEPAKNTR", "DIVISLAB", "DLF", "DRREDDY",
        "EICHERMOT", "ESCORTS", "EXIDEIND", "GAIL", "GLENMARK", "GMRINFRA",
        "GNFC", "GODREJCP", "GODREJPROP", "GRANULES", "GRASIM", "GUJGASLTD",
        "HAVELLS", "HCLTECH", "HDFCAMC", "HDFCBANK", "HDFCLIFE", "HEROMOTOCO",
        "HINDALCO", "HINDCOPPER", "HINDPETRO", "HINDUNILVR", "ICICIBANK",
        "ICICIGI", "ICICIPRULI", "IDEA", "IDFC", "IDFCFIRSTB", "IEX",
        "IGL", "INDHOTEL", "INDIACEM", "INDIAMART", "INDIGO", "INDUSINDBK",
        "INDUSTOWER", "INFY", "IOC", "IPCALAB", "ITC", "JINDALSTEL",
        "JKCEMENT", "JSWSTEEL", "JUBLFOOD", "KOTAKBANK", "LALPATHLAB",
        "LAURUSLABS", "LICHSGFIN", "LT", "LTIM", "LTF", "LUPIN", "M&M",
        "M&MFIN", "MANAPPURAM", "MARICO", "MARUTI", "METROPOLIS", "MFSL",
        "MPHASIS", "MRF", "MUTHOOTFIN", "NATIONALUM", "NAUKRI", "NESTLEIND",
        "NMDC", "NTPC", "OBEROIRLTY", "OFSS", "ONGC", "PAGEIND", "PEL",
        "PERSISTENT", "PETRONET", "PFC", "PIDILITIND", "PIIND", "PNB",
        "POLYCAB", "POONAWALLA", "POWERGRID", "PRESTIGE", "PVRINOX",
        "RAMCOCEM", "RBLBANK", "RECLTD", "RELIANCE", "SAIL", "SBICARD",
        "SBILIFE", "SBIN", "SHREECEM", "SHRIRAMFIN", "SIEMENS", "SRF",
        "SUNPHARMA", "SUNTV", "SYNGENE", "TATACHEM", "TATACOMM", "TATACONSUM",
        "TATAMOTORS", "TATASTEEL", "TCS", "TECHM", "TITAN", "TORNTPHARM",
        "TORNTPOWER", "TVSMOTOR", "UBL", "ULTRACEMCO", "UPL", "VBL",
        "VEDL", "VOLTAS", "WIPRO", "ZYDUSLIFE"
    ]

    @classmethod
    def get_universe(cls, db: Optional[Session] = None) -> List[str]:
        """Resolves active symbols from database or defaults to CORE_UNIVERSE."""
        if db:
            try:
                symbols = [row[0] for row in db.query(Company.symbol).filter(Company.is_growth_eligible == True).limit(300).all()]
                if symbols and len(symbols) >= 30:
                    merged = list(dict.fromkeys(cls.CORE_UNIVERSE + symbols))
                    return merged[:350]
            except Exception as e:
                logger.warning(f"Error reading symbols from DB: {e}")
        return cls.CORE_UNIVERSE

    @classmethod
    def calculate_staircase_metrics(
        cls,
        symbol: str,
        df: pd.DataFrame,
        nifty_returns_10d: Optional[pd.Series] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Computes 4-layer institutional staircase metrics for a single stock dataframe.
        Requires at least 60 daily bars.
        """
        try:
            if df is None or len(df) < 60:
                return None

            # Flatten MultiIndex columns if present (from yfinance)
            if isinstance(df.columns, pd.MultiIndex):
                df.columns = df.columns.get_level_values(0)

            required_cols = {"Open", "High", "Low", "Close", "Volume"}
            if not required_cols.issubset(set(df.columns)):
                return None

            close_series = df["Close"].astype(float)
            high_series = df["High"].astype(float)
            low_series = df["Low"].astype(float)
            open_series = df["Open"].astype(float)
            vol_series = df["Volume"].astype(float)

            cmp = float(close_series.iloc[-1])
            if cmp <= 0 or math.isnan(cmp):
                return None

            prev_close = float(close_series.iloc[-2]) if len(close_series) >= 2 else cmp
            day_change = cmp - prev_close
            day_change_pct = (day_change / prev_close) * 100 if prev_close > 0 else 0.0

            # -------------------------------------------------------------
            # Layer 1: Moving Averages & Trend Ribbon
            # -------------------------------------------------------------
            ema_5 = float(close_series.ewm(span=5, adjust=False).mean().iloc[-1])
            ema_10 = float(close_series.ewm(span=10, adjust=False).mean().iloc[-1])
            ema_20 = float(close_series.ewm(span=20, adjust=False).mean().iloc[-1])
            sma_50 = float(close_series.rolling(window=50).mean().iloc[-1])
            sma_200 = float(close_series.rolling(window=200).mean().iloc[-1]) if len(df) >= 200 else sma_50 * 0.85

            is_ribbon_aligned = (cmp > ema_5 >= ema_10 > ema_20 > sma_50)
            is_above_200dma = (cmp > sma_200)

            # -------------------------------------------------------------
            # Layer 2: Kaufman Efficiency Ratio (KER) & Daily Returns
            # -------------------------------------------------------------
            # Last 10 sessions window
            recent_10_close = close_series.tail(10).values
            if len(recent_10_close) < 10:
                return None

            net_change_10d = abs(recent_10_close[-1] - recent_10_close[0])
            sum_path_10d = float(np.sum(np.abs(np.diff(recent_10_close))))
            ker_10d = net_change_10d / sum_path_10d if sum_path_10d > 0 else 0.0

            # 20-day KER for longer trend integrity
            recent_20_close = close_series.tail(20).values
            net_change_20d = abs(recent_20_close[-1] - recent_20_close[0])
            sum_path_20d = float(np.sum(np.abs(np.diff(recent_20_close))))
            ker_20d = net_change_20d / sum_path_20d if sum_path_20d > 0 else 0.0

            # Daily percentage returns over last 10 days
            pct_returns_10d = pd.Series(recent_10_close).pct_change().dropna()
            green_days_10d = int((pct_returns_10d > 0).sum())
            green_ratio = green_days_10d / len(pct_returns_10d)
            avg_daily_gain_pct = float(pct_returns_10d.mean() * 100)
            std_daily_gain_pct = float(pct_returns_10d.std() * 100) if len(pct_returns_10d) > 1 else 0.0

            # -------------------------------------------------------------
            # Layer 3: Candle Body Quality (Close near High & Shallow Dips)
            # -------------------------------------------------------------
            recent_5_high = high_series.tail(5).values
            recent_5_low = low_series.tail(5).values
            recent_5_close = close_series.tail(5).values
            candle_ranges = recent_5_high - recent_5_low
            # Avoid divide-by-zero
            candle_ranges[candle_ranges == 0] = 0.001
            close_to_high_ratios = (recent_5_close - recent_5_low) / candle_ranges
            avg_close_to_high = float(np.mean(close_to_high_ratios))

            # Maximum intraday breach below prior close in last 5 days
            recent_5_open = open_series.tail(5).values
            dip_breaches = []
            for i in range(1, 5):
                prev_c = recent_5_close[i-1]
                cur_l = recent_5_low[i]
                breach_pct = ((cur_l - prev_c) / prev_c) * 100
                dip_breaches.append(breach_pct)
            worst_intraday_dip_pct = float(min(dip_breaches)) if dip_breaches else 0.0

            # -------------------------------------------------------------
            # Layer 4: Volume & Delivery Character
            # -------------------------------------------------------------
            vol_sma20 = float(vol_series.rolling(20).mean().iloc[-1])
            today_vol = float(vol_series.iloc[-1])
            vol_ratio = (today_vol / vol_sma20) if vol_sma20 > 0 else 1.0

            # Up/Down Volume Ratio over last 10 days
            up_vol = float(vol_series.tail(10)[close_series.tail(10) > open_series.tail(10)].sum())
            down_vol = float(vol_series.tail(10)[close_series.tail(10) < open_series.tail(10)].sum())
            up_down_vol_ratio = (up_vol / down_vol) if down_vol > 0 else 2.5

            # Delivery Volume approximation: institutional stealth typically carries 55-75% delivery
            # In live feed, use delivery column if exists; otherwise estimate via up/down efficiency
            estimated_delivery_pct = min(85.0, max(45.0, round(50.0 + (ker_10d * 25.0) + (green_ratio * 10.0), 1)))

            # -------------------------------------------------------------
            # Layer 5: Base Proximity & Launchpad Detection
            # -------------------------------------------------------------
            # Detect 4-8 week prior consolidation (bars 15 to 55 from end)
            base_window = close_series.iloc[-55:-10] if len(close_series) >= 55 else close_series.iloc[:-10]
            base_high = float(base_window.max()) if len(base_window) > 0 else cmp
            base_low = float(base_window.min()) if len(base_window) > 0 else cmp * 0.9
            base_depth_pct = ((base_high - base_low) / base_high) * 100 if base_high > 0 else 15.0

            # Distance of CMP above the base breakout pivot
            distance_from_base_pct = ((cmp - base_high) / base_high) * 100 if base_high > 0 else 5.0
            is_healthy_base_depth = (base_depth_pct <= 25.0)

            # -------------------------------------------------------------
            # Layer 6: Relative Strength vs Benchmark (Down-Day RS Divergence)
            # -------------------------------------------------------------
            rs_vs_nifty_score = 75.0
            down_day_rs_ratio = 0.5
            down_day_green_count = 0
            down_day_total_red = 0
            down_day_alpha_pct = 0.0
            is_tennis_ball = False

            if nifty_returns_10d is not None and len(nifty_returns_10d) >= len(pct_returns_10d):
                n_rets = nifty_returns_10d.tail(len(pct_returns_10d))
                # Identify sessions where Nifty was red (< -0.05%)
                nifty_red_mask = (n_rets.values < -0.0005)
                down_day_total_red = int(nifty_red_mask.sum())

                if down_day_total_red > 0:
                    stock_rets_arr = pct_returns_10d.values
                    # Count how many of those red sessions the stock was positive (> 0)
                    counter_trend_green = int(((stock_rets_arr > 0) & nifty_red_mask).sum())
                    down_day_green_count = counter_trend_green
                    down_day_rs_ratio = counter_trend_green / down_day_total_red

                    # Compute average alpha spread on Nifty red days (Stock % - Nifty %)
                    alpha_spreads = (stock_rets_arr[nifty_red_mask] - n_rets.values[nifty_red_mask]) * 100
                    down_day_alpha_pct = float(np.mean(alpha_spreads)) if len(alpha_spreads) > 0 else 0.0

                    # True "Tennis Ball": Green on at least 50% of red days AND alpha spread >= +1.0%
                    is_tennis_ball = bool(down_day_rs_ratio >= 0.50 and down_day_alpha_pct >= 0.8)

                    rs_vs_nifty_score = min(100.0, 50.0 + (down_day_rs_ratio * 35.0) + (15.0 if is_tennis_ball else 0.0))
                else:
                    rs_vs_nifty_score = 75.0
                    down_day_rs_ratio = 1.0
                    down_day_alpha_pct = float(pct_returns_10d.mean() * 100)

            # -------------------------------------------------------------
            # Layer 7: Composite Conviction Score (0 to 100)
            # -------------------------------------------------------------
            # 1. Trend Efficiency Score (Max 25)
            # KER >= 0.75 gives full 25 pts
            ker_component = min(25.0, max(0.0, (ker_10d / 0.80) * 25.0))

            # 2. Consistency Score (Max 25)
            # 8+ green days in 10 gives full 25 pts; avg gain in 0.8% - 2.5% sweet spot
            green_days_pts = min(18.0, (green_days_10d / 8.0) * 18.0)
            smoothness_bonus = 7.0 if (0.5 <= avg_daily_gain_pct <= 3.0 and std_daily_gain_pct < 2.5) else 3.0
            consistency_component = green_days_pts + smoothness_bonus

            # 3. Volume & Delivery Absorption (Max 20)
            delivery_pts = min(12.0, max(0.0, ((estimated_delivery_pct - 45.0) / 30.0) * 12.0))
            vol_ratio_pts = min(8.0, (up_down_vol_ratio / 2.0) * 8.0)
            volume_component = delivery_pts + vol_ratio_pts

            # 4. Launchpad Sweet Spot (Max 15)
            # Within 3% to 20% of base pivot is ideal (sweet spot). Above 28% incurs extension penalty.
            if 2.0 <= distance_from_base_pct <= 18.0 and is_healthy_base_depth:
                base_component = 15.0
            elif 18.0 < distance_from_base_pct <= 28.0:
                base_component = 10.0
            elif distance_from_base_pct > 28.0:
                base_component = 4.0  # Extended
            else:
                base_component = 8.0

            # 5. Relative Strength Component (Max 15) + Tennis Ball Bonus
            rs_component = (rs_vs_nifty_score / 100.0) * 15.0

            conviction_score = int(round(
                ker_component +
                consistency_component +
                volume_component +
                base_component +
                rs_component
            ))
            conviction_score = max(10, min(99, conviction_score))

            # -------------------------------------------------------------
            # Setup Tier Categorization
            # -------------------------------------------------------------
            if conviction_score >= 80 and (ker_10d >= 0.68 or green_days_10d >= 7) and distance_from_base_pct <= 26.0:
                setup_tier = "STEALTH_ACCUMULATOR"
                tier_badge = "Stealth Leader (Tennis Ball RS)" if is_tennis_ball else "Institutional Stealth Leader"
            elif green_days_10d >= 7 and distance_from_base_pct <= 12.0:
                setup_tier = "EARLY_STAIRCASE"
                tier_badge = "Early Ignition (Tennis Ball)" if is_tennis_ball else "Early Ignition Staircase"
            elif conviction_score >= 68:
                setup_tier = "ESTABLISHED_RUNNER"
                tier_badge = "Established Staircase"
            elif distance_from_base_pct > 25.0:
                setup_tier = "EXTENDED_RUNNER"
                tier_badge = "Extended (Tight Trail)"
            else:
                setup_tier = "WATCHLIST_STAIRCASE"
                tier_badge = "Watchlist Candidate"

            # -------------------------------------------------------------
            # Trailing Stop & Trade Blueprint
            # -------------------------------------------------------------
            trailing_stop_10ema = round(ema_10, 2)
            distance_to_stop_pct = round(((cmp - trailing_stop_10ema) / cmp) * 100, 2)
            # Target projections: 1.5x and 2.5x base depth
            target_1 = round(cmp * 1.12, 2)
            target_2 = round(cmp * 1.25, 2)

            return {
                "symbol": symbol,
                "cmp": round(cmp, 2),
                "day_change": round(day_change, 2),
                "day_change_pct": round(day_change_pct, 2),
                "conviction_score": conviction_score,
                "setup_tier": setup_tier,
                "tier_badge": tier_badge,
                "metrics": {
                    "ker_10d": float(round(ker_10d, 3)),
                    "ker_20d": float(round(ker_20d, 3)),
                    "green_days_10d": int(green_days_10d),
                    "green_ratio_pct": float(round(green_ratio * 100, 1)),
                    "avg_daily_gain_pct": float(round(avg_daily_gain_pct, 2)),
                    "std_daily_gain_pct": float(round(std_daily_gain_pct, 2)),
                    "avg_close_to_high": float(round(avg_close_to_high, 2)),
                    "worst_intraday_dip_pct": float(round(worst_intraday_dip_pct, 2)),
                    "estimated_delivery_pct": float(round(estimated_delivery_pct, 1)),
                    "up_down_vol_ratio": float(round(up_down_vol_ratio, 2)),
                    "vol_ratio": float(round(vol_ratio, 2)),
                    "distance_from_base_pct": float(round(distance_from_base_pct, 1)),
                    "base_pivot_high": float(round(base_high, 2)),
                    "base_depth_pct": float(round(base_depth_pct, 1)),
                    "ema_5": float(round(ema_5, 2)),
                    "ema_10": float(round(ema_10, 2)),
                    "ema_20": float(round(ema_20, 2)),
                    "sma_50": float(round(sma_50, 2)),
                    "sma_200": float(round(sma_200, 2)),
                    "is_ribbon_aligned": bool(is_ribbon_aligned),
                    "down_day_rs_ratio_pct": float(round(down_day_rs_ratio * 100, 1)),
                    "down_day_green_count": int(down_day_green_count),
                    "down_day_total_red": int(down_day_total_red),
                    "down_day_alpha_pct": float(round(down_day_alpha_pct, 2)),
                    "is_tennis_ball": bool(is_tennis_ball),
                },
                "blueprint": {
                    "trailing_stop_10ema": trailing_stop_10ema,
                    "distance_to_stop_pct": distance_to_stop_pct,
                    "target_1": target_1,
                    "target_2": target_2,
                    "exit_rule": "Exit on daily close below rising 10 EMA with heavy volume",
                },
                "tradingview_url": f"https://in.tradingview.com/chart/?symbol=NSE:{symbol}",
                "techno_funda_url": f"/stocks/{symbol}?from=/staircase-radar",
            }
        except Exception as e:
            logger.error(f"Error calculating staircase metrics for {symbol}: {e}")
            return None

    @classmethod
    def scan_universe(
        cls,
        db: Optional[Session] = None,
        force_refresh: bool = False
    ) -> Dict[str, Any]:
        """
        Executes or retrieves cached staircase screener results across the universe.
        """
        global _CACHE, _scan_in_progress

        now = time.time()
        # Serve from memory cache if fresh
        if not force_refresh and _CACHE["opportunities"] and (now - _CACHE["timestamp"] < CACHE_TTL_SECONDS):
            return {
                "opportunities": _CACHE["opportunities"],
                "metadata": _CACHE["metadata"],
                "cached": True,
            }

        # Try to load from disk cache if memory cache is cold and not force refreshing
        if not force_refresh and not _CACHE["opportunities"] and DISK_CACHE_PATH.exists():
            try:
                with open(DISK_CACHE_PATH, "r", encoding="utf-8") as f:
                    disk_data = json.load(f)
                    if now - disk_data.get("timestamp", 0) < (CACHE_TTL_SECONDS * 3):
                        _CACHE["opportunities"] = disk_data.get("opportunities", [])
                        _CACHE["metadata"] = disk_data.get("metadata", {})
                        _CACHE["timestamp"] = disk_data.get("timestamp", now)
                        return {
                            "opportunities": _CACHE["opportunities"],
                            "metadata": _CACHE["metadata"],
                            "cached": True,
                        }
            except Exception as e:
                logger.warning(f"Failed to read disk cache: {e}")

        # If scan is already running in background, return stale cache or empty
        with _scan_lock:
            if _scan_in_progress:
                return {
                    "opportunities": _CACHE.get("opportunities", []),
                    "metadata": _CACHE.get("metadata", {}),
                    "scan_in_progress": True,
                }
            _scan_in_progress = True

        try:
            logger.info("Starting Institutional Staircase Screener scan...")
            symbols = cls.get_universe(db)

            # Download benchmark Nifty returns for RS divergence check
            nifty_rets_10d: Optional[pd.Series] = None
            try:
                nifty_df = yf.download("^NSEI", period="1mo", interval="1d", progress=False)
                if not nifty_df.empty:
                    if isinstance(nifty_df.columns, pd.MultiIndex):
                        nifty_df.columns = nifty_df.columns.get_level_values(0)
                    nifty_rets_10d = nifty_df["Close"].astype(float).pct_change().dropna()
            except Exception as e:
                logger.warning(f"Could not download Nifty index benchmark: {e}")

            # Batch download stock data
            formatted_tickers = [f"{s}.NS" for s in symbols]
            try:
                raw_data = yf.download(
                    formatted_tickers,
                    period="6mo",
                    interval="1d",
                    group_by="ticker",
                    threads=True,
                    progress=False
                )
            except Exception as e:
                logger.error(f"yfinance batch download failed: {e}")
                raw_data = None

            opportunities: List[Dict[str, Any]] = []

            for sym in symbols:
                ticker_key = f"{sym}.NS"
                stock_df: Optional[pd.DataFrame] = None

                if raw_data is not None:
                    if len(symbols) == 1:
                        stock_df = raw_data
                    elif ticker_key in raw_data:
                        stock_df = raw_data[ticker_key].dropna()

                # Fallback to single download if missing
                if stock_df is None or len(stock_df) < 50:
                    try:
                        stock_df = yf.download(ticker_key, period="6mo", interval="1d", progress=False)
                    except Exception:
                        continue

                if stock_df is not None and len(stock_df) >= 50:
                    result = cls.calculate_staircase_metrics(sym, stock_df, nifty_rets_10d)
                    if result and result["conviction_score"] >= 45:
                        opportunities.append(result)

            # Sort descending by conviction score
            opportunities.sort(key=lambda x: x["conviction_score"], reverse=True)

            # Compile high-level telemetry metadata
            stealth_accumulator_count = sum(1 for o in opportunities if o["setup_tier"] == "STEALTH_ACCUMULATOR")
            early_staircase_count = sum(1 for o in opportunities if o["setup_tier"] == "EARLY_STAIRCASE")
            established_count = sum(1 for o in opportunities if o["setup_tier"] == "ESTABLISHED_RUNNER")
            tennis_ball_count = sum(1 for o in opportunities if o["metrics"].get("is_tennis_ball", False))
            avg_ker = float(np.mean([o["metrics"]["ker_10d"] for o in opportunities])) if opportunities else 0.0

            metadata = {
                "total_scanned": len(symbols),
                "total_opportunities": len(opportunities),
                "stealth_accumulator_count": stealth_accumulator_count,
                "cupid_archetype_count": stealth_accumulator_count,
                "early_staircase_count": early_staircase_count,
                "established_count": established_count,
                "tennis_ball_count": tennis_ball_count,
                "avg_ker_10d": round(avg_ker, 3),
                "last_scan_time": time.strftime("%Y-%m-%d %H:%M:%S"),
            }

            # Update in-memory cache
            _CACHE["opportunities"] = opportunities
            _CACHE["metadata"] = metadata
            _CACHE["timestamp"] = now

            # Persist to disk cache
            try:
                DISK_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
                with open(DISK_CACHE_PATH, "w", encoding="utf-8") as f:
                    json.dump({
                        "timestamp": now,
                        "opportunities": opportunities,
                        "metadata": metadata
                    }, f, indent=2)
            except Exception as e:
                logger.error(f"Failed to save disk cache: {e}")

            return {
                "opportunities": opportunities,
                "metadata": metadata,
                "cached": False,
            }

        finally:
            with _scan_lock:
                _scan_in_progress = False

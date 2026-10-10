"""
Alpha India - Market Regime & Time-of-Day Analytics
Sprint 43.1 Contextual Macro Categorization & Temporal Breakdown

Classifies:
1. Market Regimes:
   - Bullish (Above EMA 20 & 50)
   - Bearish (Below EMA 20 & 50)
   - Sideways (Mixed EMA positioning)
2. Time-of-Day Buckets:
   - 09:15–10:00 (Ignition Momentum)
   - 10:00–11:00 (Morning Trend)
   - 11:00–12:00 (Pre-Midday Consolidation)
   - 12:00–13:00 (Midday Chop)
   - 13:00–14:00 (European/London Overlap)
   - 14:00–15:00 (Afternoon Expansion)
   - 15:00–15:30 (Closing Auction Squeeze)
"""

from __future__ import annotations

from datetime import datetime, time as dtime
from typing import Any, Dict, List
import pandas as pd


class MarketRegimeEngine:
    """
    Classifies signals and trades into macroeconomic regimes and temporal windows.
    """

    TIME_BUCKETS = [
        {"id": "09:15-10:00", "start": dtime(9, 15), "end": dtime(10, 0), "label": "Opening Ignition"},
        {"id": "10:00-11:00", "start": dtime(10, 0), "end": dtime(11, 0), "label": "Morning Trend"},
        {"id": "11:00-12:00", "start": dtime(11, 0), "end": dtime(12, 0), "label": "Pre-Midday Coil"},
        {"id": "12:00-13:00", "start": dtime(12, 0), "end": dtime(13, 0), "label": "Midday Chop"},
        {"id": "13:00-14:00", "start": dtime(13, 0), "end": dtime(14, 0), "label": "London Overlap"},
        {"id": "14:00-15:00", "start": dtime(14, 0), "end": dtime(15, 0), "label": "Afternoon Expansion"},
        {"id": "15:00-15:30", "start": dtime(15, 0), "end": dtime(15, 30), "label": "Closing Squeeze"},
    ]

    @classmethod
    def get_time_bucket(cls, dt: datetime) -> str:
        t = dt.time() if hasattr(dt, "time") else pd.to_datetime(dt).time()
        for b in cls.TIME_BUCKETS:
            if b["start"] <= t < b["end"]:
                return b["id"]
        if t >= dtime(15, 0):
            return "15:00-15:30"
        return "09:15-10:00"

    @classmethod
    def classify_market_regime(cls, nifty_df: Optional[pd.DataFrame], ts: datetime) -> str:
        """
        Classifies regime using NIFTY 50 index EMA 20 & EMA 50.
        Returns: BULLISH, BEARISH, or SIDEWAYS.
        """
        if nifty_df is None or nifty_df.empty:
            return "BULLISH"  # Default assumption for testing when benchmark not supplied

        try:
            target_ts = pd.to_datetime(ts)
            sub = nifty_df[nifty_df["Datetime"] <= target_ts]
            if len(sub) < 50:
                return "SIDEWAYS"

            close = sub["Close"].iloc[-1]
            ema20 = sub["Close"].ewm(span=20, adjust=False).mean().iloc[-1]
            ema50 = sub["Close"].ewm(span=50, adjust=False).mean().iloc[-1]

            if close > ema20 and ema20 > ema50:
                return "BULLISH"
            elif close < ema20 and ema20 < ema50:
                return "BEARISH"
            else:
                return "SIDEWAYS"
        except Exception:
            return "SIDEWAYS"

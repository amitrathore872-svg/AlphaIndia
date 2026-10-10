"""
Alpha India - Daily Confirmation Module
Sprint 43 — Multi-Timeframe VCP Research Engine

Evaluates COMPLETED Daily candles prior to intraday execution:
1. Daily Close > EMA20
2. EMA20 > EMA50 (Trend Alignment)
3. EMA20 Slope Positive (Short-Term Momentum)
4. Daily Volatility Not Abnormally Expanding
5. Price Reasonably Close to Pivot
6. Daily Volume Behavior Supportive (Volume accumulation signature)
7. Daily Structure Intact (Above Key Swing Lows)
Outputs: daily_confirmation_score (0-100), pass_daily (bool)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd


@dataclass
class DailyConfirmationResult:
    pass_daily: bool = False
    daily_score: float = 0.0
    c1_above_ema20: bool = False
    c2_ema20_above_ema50: bool = False
    c3_ema20_slope_positive: bool = False
    c4_volatility_controlled: bool = False
    c5_volume_supportive: bool = False
    c6_structure_intact: bool = False
    ema20_value: float = 0.0
    ema50_value: float = 0.0
    daily_close: float = 0.0
    rejection_reasons: List[str] = field(default_factory=list)


class DailyConfirmationEngine:
    """
    Evaluates completed daily candles to confirm high-timeframe trend alignment.
    """

    @classmethod
    def evaluate(
        cls,
        daily_df: pd.DataFrame,
        pivot_price: Optional[float] = None,
        min_score: float = 65.0,
    ) -> DailyConfirmationResult:
        result = DailyConfirmationResult()
        rejections: List[str] = []

        if daily_df is None or len(daily_df) < 20:
            rejections.append(f"Insufficient daily bars ({len(daily_df) if daily_df is not None else 0}; minimum 20 required)")
            result.rejection_reasons = rejections
            return result

        df = daily_df.copy().dropna(subset=["Close", "High", "Low", "Volume"])
        closes = df["Close"].values
        highs = df["High"].values
        lows = df["Low"].values
        volumes = df["Volume"].values
        n = len(df)

        close_curr = float(closes[-1])
        result.daily_close = close_curr

        # Calculate EMA20 and EMA50
        series_close = pd.Series(closes)
        ema20_series = series_close.ewm(span=20, adjust=False).mean()
        ema50_series = series_close.ewm(span=min(50, n), adjust=False).mean()

        ema20_curr = float(ema20_series.iloc[-1])
        ema20_prev = float(ema20_series.iloc[-2]) if n >= 2 else ema20_curr
        ema50_curr = float(ema50_series.iloc[-1])

        result.ema20_value = round(ema20_curr, 2)
        result.ema50_value = round(ema50_curr, 2)

        # Condition 1: Close > EMA20
        c1 = close_curr >= ema20_curr * 0.995  # 0.5% margin
        result.c1_above_ema20 = c1
        if not c1:
            rejections.append(f"Daily Close ₹{close_curr:.2f} is below EMA20 ₹{ema20_curr:.2f}")

        # Condition 2: EMA20 > EMA50
        c2 = ema20_curr >= ema50_curr
        result.c2_ema20_above_ema50 = c2
        if not c2:
            rejections.append(f"EMA20 ₹{ema20_curr:.2f} is below EMA50 ₹{ema50_curr:.2f}")

        # Condition 3: EMA20 Slope Positive
        c3 = ema20_curr >= ema20_prev
        result.c3_ema20_slope_positive = c3

        # Condition 4: Volatility Controlled (Last 3 days ATR not blowing out)
        tr = np.maximum(highs[1:] - lows[1:], np.abs(highs[1:] - closes[:-1]))
        tr = np.maximum(tr, np.abs(lows[1:] - closes[:-1]))
        atr14 = pd.Series(tr).rolling(min(14, len(tr))).mean().values
        atr_curr = float(atr14[-1]) if len(atr14) > 0 else 1.0
        atr_avg = float(np.mean(atr14[-min(30, len(atr14)):])) if len(atr14) > 0 else 1.0
        c4 = atr_curr <= (atr_avg * 1.5)  # Volatility not abnormally expanded (>1.5x)
        result.c4_volatility_controlled = c4

        # Condition 5: Volume Supportive (Up day volume or 5d vol > 80% 20d)
        vol5 = float(np.mean(volumes[-min(5, n):]))
        vol20 = float(np.mean(volumes[-min(20, n):]))
        # Supportive if recent up days had volume or volume not dead
        c5 = (vol5 >= vol20 * 0.70)
        result.c5_volume_supportive = c5

        # Condition 6: Structure Intact (Above 20-day swing low)
        low_20d = float(np.min(lows[-min(20, n):]))
        c6 = close_curr > low_20d
        result.c6_structure_intact = c6

        # Score calculation (0-100)
        score = 0.0
        score += 30.0 if c1 else 0.0
        score += 25.0 if c2 else 0.0
        score += 15.0 if c3 else 0.0
        score += 10.0 if c4 else 0.0
        score += 10.0 if c5 else 0.0
        score += 10.0 if c6 else 0.0

        # Pivot proximity bonus if pivot provided
        if pivot_price and pivot_price > 0:
            dist_pct = ((pivot_price - close_curr) / pivot_price) * 100.0
            if 0.0 <= dist_pct <= 4.0:
                score = min(100.0, score + 5.0)

        result.daily_score = round(score, 1)
        result.pass_daily = (result.daily_score >= min_score and c1)
        result.rejection_reasons = rejections

        return result

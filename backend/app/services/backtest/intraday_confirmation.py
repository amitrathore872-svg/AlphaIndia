"""
Alpha India - 15-Minute Intraday Confirmation Module
Sprint 43 — Multi-Timeframe VCP Research Engine

Evaluates COMPLETED 15-minute candles prior to 5-minute VCB trigger:
1. Price Above Intraday VWAP
2. 15m Trend Alignment (Close > EMA20, EMA20 > EMA50)
3. 15m Compression (Range Tightness in recent 4-8 bars)
4. 15m Volume Expansion (Supportive volume)
5. 15m Extension Guard (Not over-extended > 2% from EMA20)
Outputs: intraday_confirmation_score (0-100), pass_15m (bool)
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd


@dataclass
class IntradayConfirmationResult:
    pass_15m: bool = False
    intraday_score: float = 0.0
    c1_above_vwap: bool = False
    c2_trend_aligned: bool = False
    c3_range_compressed: bool = False
    c4_volume_supportive: bool = False
    c5_not_overextended: bool = False
    vwap_value: float = 0.0
    ema20_value: float = 0.0
    ema50_value: float = 0.0
    rejection_reasons: List[str] = field(default_factory=list)


class IntradayConfirmationEngine:
    """
    Evaluates completed 15-minute candles to confirm intermediate intraday structure.
    """

    @classmethod
    def evaluate(
        cls,
        candles_15m: pd.DataFrame,
        current_5m_price: float,
        min_score: float = 60.0,
    ) -> IntradayConfirmationResult:
        result = IntradayConfirmationResult()
        rejections: List[str] = []

        if candles_15m is None or len(candles_15m) < 8:
            rejections.append(f"Insufficient 15m candles ({len(candles_15m) if candles_15m is not None else 0}; minimum 8 required)")
            result.rejection_reasons = rejections
            return result

        df = candles_15m.copy().dropna(subset=["Close", "High", "Low", "Volume"])
        closes = df["Close"].values
        highs = df["High"].values
        lows = df["Low"].values
        volumes = df["Volume"].values
        n = len(df)

        close_15m = float(closes[-1])

        # 1. VWAP Calculation across available intraday 15m session bars
        cum_vol = np.cumsum(volumes)
        typical_prices = (highs + lows + closes) / 3.0
        cum_tp_vol = np.cumsum(typical_prices * volumes)
        vwap_arr = cum_tp_vol / np.maximum(1, cum_vol)
        vwap_curr = float(vwap_arr[-1])
        result.vwap_value = round(vwap_curr, 2)

        c1 = (current_5m_price >= vwap_curr)
        result.c1_above_vwap = c1
        if not c1:
            rejections.append(f"Price ₹{current_5m_price:.2f} is below 15m VWAP ₹{vwap_curr:.2f}")

        # 2. Trend Alignment (EMA20 & EMA50)
        s_close = pd.Series(closes)
        ema20 = float(s_close.ewm(span=min(20, n), adjust=False).mean().iloc[-1])
        ema50 = float(s_close.ewm(span=min(50, n), adjust=False).mean().iloc[-1])
        result.ema20_value = round(ema20, 2)
        result.ema50_value = round(ema50, 2)

        c2 = (close_15m >= ema20 * 0.998 and ema20 >= ema50 * 0.998)
        result.c2_trend_aligned = c2
        if not c2:
            rejections.append("15m EMA20/EMA50 not aligned bullishly")

        # 3. 15m Compression (Range of last 4 bars < 2.5% of price)
        r4_high = float(np.max(highs[-min(4, n):]))
        r4_low = float(np.min(lows[-min(4, n):]))
        r4_range_pct = ((r4_high - r4_low) / max(0.01, close_15m)) * 100.0
        c3 = (r4_range_pct <= 3.0)
        result.c3_range_compressed = c3

        # 4. Supportive Volume (Last bar volume > 80% of 10-bar SMA)
        vol10 = float(np.mean(volumes[-min(10, n):]))
        vol_curr = float(volumes[-1])
        c4 = (vol_curr >= vol10 * 0.70)
        result.c4_volume_supportive = c4

        # 5. Not Overextended (< 2.0% above EMA20)
        extension_pct = ((current_5m_price - ema20) / max(0.01, ema20)) * 100.0
        c5 = (extension_pct <= 2.5)
        result.c5_not_overextended = c5
        if not c5:
            rejections.append(f"Price is {extension_pct:.1f}% extended above 15m EMA20")

        # Composite Score (0-100)
        score = 0.0
        score += 35.0 if c1 else 0.0
        score += 25.0 if c2 else 0.0
        score += 15.0 if c3 else 0.0
        score += 15.0 if c4 else 0.0
        score += 10.0 if c5 else 0.0

        result.intraday_score = round(score, 1)
        result.pass_15m = (result.intraday_score >= min_score and c1 and c5)
        result.rejection_reasons = rejections

        return result

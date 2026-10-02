"""
Alpha India — Ascending Triangle Pattern Engine
=================================================
Definition:
  - Horizontal resistance (flat tops): multiple touches within 2% of same level
  - Rising support (higher lows): each pullback stays higher than prior
  - Volume contracts progressively through the triangle
  - Pattern width: 4–20 weeks minimum
  - Breakout: price closes above horizontal resistance on volume surge

AI Scoring (0–100):
  - Horizontal resistance quality (touch count, flatness)  : 0–30
  - Rising support quality (slope, consistency)            : 0–25
  - Volume contraction through pattern                     : 0–20
  - Pattern compactness (tight = better)                   : 0–15
  - Trend alignment                                        : 0–10
"""

from __future__ import annotations

from typing import Any, Dict, Optional

import numpy as np
import pandas as pd

from app.services.pattern_engine.pattern_core import (
    calc_rsi, calc_sma, vol_ratio, linear_regression_slope, conviction_tier_label
)


def detect_ascending_triangle(
    symbol: str,
    company_name: str,
    sector: str,
    exchange: str,
    d_close: pd.Series,
    d_high: pd.Series,
    d_low: pd.Series,
    d_open: pd.Series,
    d_volume: pd.Series,
    w_close: pd.Series,
    w_low: pd.Series,
    w_high: pd.Series,
    w_volume: pd.Series,
    m_close: pd.Series,
    nifty_close: Optional[pd.Series] = None,
) -> Optional[Dict[str, Any]]:
    """
    Detects Ascending Triangle on weekly bars.
    Uses daily bars for resistance touch precision.
    Returns None if no valid pattern found.
    """
    n_d = len(d_close)
    n_w = len(w_close)
    if n_d < 60 or n_w < 15:
        return None

    # Use last 120 daily bars (~6 months)
    scan_bars = min(120, n_d - 5)
    seg_high = d_high.iloc[-scan_bars:]
    seg_low = d_low.iloc[-scan_bars:]
    seg_close = d_close.iloc[-scan_bars:]
    seg_vol = d_volume.iloc[-scan_bars:]

    best: Optional[Dict[str, Any]] = None
    best_score = -1.0

    # Try multiple window sizes: 20, 40, 60, 80, 100 bars
    for window in [20, 30, 40, 60, 80]:
        if window > scan_bars - 5:
            continue

        seg_h = d_high.iloc[-(window + 5):-5]
        seg_l = d_low.iloc[-(window + 5):-5]
        seg_c = d_close.iloc[-(window + 5):-5]
        seg_v = d_volume.iloc[-(window + 5):-5]

        if len(seg_h) < 15:
            continue

        # ── Horizontal resistance: find the "resistance zone" ──
        # Cluster highs near the peak
        highs = seg_h.values
        resistance_level = np.percentile(highs, 90)  # Top 10% highs cluster

        # Count touches within 2% of resistance
        resistance_touches = int(np.sum(highs >= resistance_level * 0.98))
        if resistance_touches < 2:
            continue

        # Flatness of resistance: std of highs near resistance < 2%
        near_resistance = highs[highs >= resistance_level * 0.98]
        resistance_flatness = float(np.std(near_resistance) / max(resistance_level, 1e-9) * 100)
        if resistance_flatness > 3.0:
            continue

        # ── Rising support: linear regression of lows must be positive ──
        lows = seg_l.values
        slope = linear_regression_slope(pd.Series(lows), len(lows))
        if slope <= 0:
            continue

        # Higher lows confirmation: at least 2 consecutive higher lows
        local_lows = []
        for i in range(1, len(lows) - 1):
            if lows[i] <= lows[i - 1] and lows[i] <= lows[i + 1]:
                local_lows.append(lows[i])

        if len(local_lows) < 2:
            continue

        # Check higher lows trend
        higher_lows = sum(1 for i in range(1, len(local_lows)) if local_lows[i] > local_lows[i - 1])
        if higher_lows < max(1, len(local_lows) // 2):
            continue

        # ── Volume contraction through pattern ──
        first_half_vol = float(seg_v.iloc[:len(seg_v) // 2].mean())
        second_half_vol = float(seg_v.iloc[len(seg_v) // 2:].mean())
        vol_contracting = second_half_vol < first_half_vol * 0.85

        # Pattern height (distance from support to resistance)
        first_low = float(seg_l.iloc[0])
        pattern_height_pct = (resistance_level - first_low) / max(first_low, 1e-9) * 100

        # Current price position
        current = float(d_close.iloc[-1])
        pct_from_resistance = (current - resistance_level) / max(resistance_level, 1e-9) * 100

        # Must be approaching resistance or just broke out
        if pct_from_resistance < -8 or pct_from_resistance > 3:
            continue

        # ── Score ──
        score = 0.0

        # Resistance quality (0–30)
        score += min(30, resistance_touches * 6)
        score -= resistance_flatness * 3  # penalise flat spread

        # Rising support quality (0–25)
        score += min(25, higher_lows * 8)

        # Volume contraction (0–20)
        if vol_contracting: score += 20
        elif second_half_vol < first_half_vol: score += 10

        # Compactness (0–15): tighter triangle = better
        if pattern_height_pct < 15: score += 15
        elif pattern_height_pct < 25: score += 8
        else: score += 2

        # Proximity to breakout (0–10)
        if -2 <= pct_from_resistance <= 2: score += 10
        elif -5 <= pct_from_resistance <= 3: score += 5

        if score > best_score:
            best_score = score
            best = {
                "resistance_level": round(resistance_level, 2),
                "resistance_touches": resistance_touches,
                "resistance_flatness_pct": round(resistance_flatness, 2),
                "higher_lows": higher_lows,
                "support_slope": round(slope, 4),
                "vol_contracting": vol_contracting,
                "pattern_height_pct": round(pattern_height_pct, 2),
                "pct_from_resistance": round(pct_from_resistance, 2),
                "pattern_width_bars": window,
                "pattern_width_weeks": round(window / 5, 1),
                "raw_score": score,
            }

    if best is None or best["raw_score"] < 25:
        return None

    # ── RSI filters ──
    d_rsi_series = calc_rsi(d_close, 14)
    w_rsi_series = calc_rsi(w_close, 14)
    daily_rsi = round(float(d_rsi_series.iloc[-1]) if not pd.isna(d_rsi_series.iloc[-1]) else 50, 1)
    weekly_rsi = round(float(w_rsi_series.iloc[-1]) if not pd.isna(w_rsi_series.iloc[-1]) else 50, 1)

    if weekly_rsi < 42:
        return None

    sma200 = calc_sma(d_close, 200)
    price_vs_200 = (d_close.iloc[-1] - sma200.iloc[-1]) / max(sma200.iloc[-1], 1e-9) * 100 if len(sma200.dropna()) >= 10 else 0

    trend_score = 0.0
    if daily_rsi >= 50: trend_score += 5
    if weekly_rsi >= 52: trend_score += 5
    if price_vs_200 > 5: trend_score += 5 - min(5, abs(price_vs_200 - 15) * 0.2)

    ai_score = int(min(99, max(10, best["raw_score"] + trend_score)))
    if ai_score < 50:
        return None

    # ── Trade blueprint ──
    cmp = round(float(d_close.iloc[-1]), 2)
    prev_close = round(float(d_close.iloc[-2]), 2) if len(d_close) > 1 else cmp
    day_change = round(cmp - prev_close, 2)
    day_change_pct = round(day_change / max(prev_close, 1) * 100, 2)

    pivot = round(best["resistance_level"] * 1.001, 2)
    stop = round(d_low.iloc[-10:].min() * 0.98, 2)
    t1 = round(pivot * 1.12, 2)
    # Measured move: pattern height projected from breakout
    measured = best["pattern_height_pct"] / 100 * pivot
    t2 = round(pivot + measured, 2)
    risk = max(0.5, pivot - stop)
    reward = max(1.0, t1 - pivot)
    rr = round(reward / risk, 1)

    if rr < 1.5:
        return None

    tier, badge = conviction_tier_label(ai_score)
    v_ratio = vol_ratio(d_volume)

    return {
        "symbol": symbol, "company_name": company_name, "sector": sector, "exchange": exchange,
        "pattern_type": "ASCENDING_TRIANGLE", "pattern_label": "Ascending Triangle",
        "cmp": cmp, "day_change": day_change, "day_change_pct": day_change_pct,
        "pivot_buy_point": pivot, "stop_loss": stop, "target_1": t1, "target_2": t2, "risk_reward": rr,
        "pattern_depth_pct": best["pattern_height_pct"], "pattern_width_weeks": best["pattern_width_weeks"],
        "volume_ratio": v_ratio,
        "ai_conviction_score": ai_score, "conviction_tier": tier, "tier_badge": badge,
        "pattern_metrics": {
            "resistance_level": best["resistance_level"],
            "resistance_touches": best["resistance_touches"],
            "resistance_flatness_pct": best["resistance_flatness_pct"],
            "higher_lows_count": best["higher_lows"],
            "support_slope": best["support_slope"],
            "vol_contracting": best["vol_contracting"],
            "pct_from_resistance": best["pct_from_resistance"],
        },
        "daily_rsi": daily_rsi, "weekly_rsi": weekly_rsi,
        "price_vs_200d_sma": round(price_vs_200, 2),
        "tradingview_url": f"https://in.tradingview.com/symbols/NSE-{symbol}/",
        "techno_funda_url": f"/techno-funda/{symbol}",
    }

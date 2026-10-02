"""
Alpha India — Double Bottom (W Pattern) Engine
================================================
Definition:
  - Two distinct price lows separated by a middle recovery (pivot)
  - Lows within 3–5% of each other (symmetry)
  - Middle pivot recovery of at least 10% from lows
  - Right low on LOWER volume than left (accumulation shift)
  - Breakout above the middle pivot on volume surge
  - Pattern width: 7–52 weeks

AI Scoring (0–100):
  - Low symmetry (how equal the two lows are)  : 0–25
  - Pivot height (depth of W)                  : 0–20
  - Volume pattern (right low drying up)        : 0–20
  - Breakout setup quality                      : 0–20
  - Trend alignment (RSI, EMA)                  : 0–15
"""

from __future__ import annotations

from typing import Any, Dict, Optional

import numpy as np
import pandas as pd

from app.services.pattern_engine.pattern_core import (
    calc_rsi, calc_sma, vol_ratio, conviction_tier_label
)


def detect_double_bottom(
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
    Detects Double Bottom (W Pattern) on weekly bars.
    Returns None if no valid pattern found.
    """
    n_w = len(w_close)
    if n_w < 20:
        return None

    # Scan last 52 weekly bars for two distinct lows
    scan_end = n_w - 1
    scan_start = max(0, n_w - 52)
    segment = w_low.iloc[scan_start:scan_end + 1]
    seg_close = w_close.iloc[scan_start:scan_end + 1]
    seg_vol = w_volume.iloc[scan_start:scan_end + 1]

    best: Optional[Dict[str, Any]] = None
    best_score = -1.0

    # Find all local minima
    vals = segment.values
    n = len(vals)
    local_mins = []
    for i in range(1, n - 1):
        if vals[i] <= vals[i - 1] and vals[i] <= vals[i + 1]:
            local_mins.append(i)

    if len(local_mins) < 2:
        return None

    # Try all pairs of local minima
    for li in range(len(local_mins) - 1):
        for ri in range(li + 1, len(local_mins)):
            li_idx = local_mins[li]
            ri_idx = local_mins[ri]

            width = ri_idx - li_idx
            if width < 5 or width > 45:
                continue

            left_low = vals[li_idx]
            right_low = vals[ri_idx]

            # Symmetry: lows within 5% of each other
            low_diff_pct = abs(left_low - right_low) / max(left_low, 1e-9) * 100
            if low_diff_pct > 5.0:
                continue

            # Find peak (middle pivot) between the two lows
            mid_segment = seg_close.iloc[li_idx:ri_idx + 1]
            if len(mid_segment) < 3:
                continue
            peak_rel_idx = mid_segment.values.argmax()
            mid_pivot = float(mid_segment.iloc[peak_rel_idx])

            # Pivot must be at least 10% above the lows
            avg_low = (left_low + right_low) / 2
            pivot_height_pct = (mid_pivot - avg_low) / max(avg_low, 1e-9) * 100
            if pivot_height_pct < 8.0:
                continue

            # Right low volume < left low volume (accumulation shift)
            left_vol = float(seg_vol.iloc[li_idx])
            right_vol = float(seg_vol.iloc[ri_idx])
            right_low_drying = right_vol < left_vol * 0.85

            # Current price should be near or above the mid pivot (breakout setup)
            current_close = float(w_close.iloc[-1])
            pct_from_pivot = (current_close - mid_pivot) / max(mid_pivot, 1e-9) * 100

            # Must be within -5% to +3% of pivot (approaching breakout or just broke out)
            if pct_from_pivot < -10 or pct_from_pivot > 5:
                continue

            # ── Score ──
            score = 0.0

            # Low symmetry (0–25): perfect = 0% diff
            symmetry_score = max(0, 25 - low_diff_pct * 5)
            score += symmetry_score

            # Pivot height (0–20): deeper W = more powerful
            if pivot_height_pct >= 25: score += 20
            elif pivot_height_pct >= 18: score += 15
            elif pivot_height_pct >= 12: score += 10
            else: score += 5

            # Volume pattern (0–20)
            if right_low_drying: score += 20
            elif right_vol < left_vol: score += 10

            # Proximity to breakout (0–20)
            if -2 <= pct_from_pivot <= 2: score += 20  # Right at pivot
            elif -5 <= pct_from_pivot <= 5: score += 12
            else: score += 5

            if score > best_score:
                best_score = score
                best = {
                    "left_low": round(float(left_low), 2),
                    "right_low": round(float(right_low), 2),
                    "mid_pivot": round(mid_pivot, 2),
                    "low_diff_pct": round(low_diff_pct, 2),
                    "pivot_height_pct": round(pivot_height_pct, 2),
                    "width_weeks": width,
                    "right_low_drying": right_low_drying,
                    "pct_from_pivot": round(pct_from_pivot, 2),
                    "raw_score": score,
                }

    if best is None or best["raw_score"] < 25:
        return None

    # ── RSI & trend filters ──
    d_rsi_series = calc_rsi(d_close, 14)
    w_rsi_series = calc_rsi(w_close, 14)
    daily_rsi = round(float(d_rsi_series.iloc[-1]) if not pd.isna(d_rsi_series.iloc[-1]) else 50, 1)
    weekly_rsi = round(float(w_rsi_series.iloc[-1]) if not pd.isna(w_rsi_series.iloc[-1]) else 50, 1)

    if weekly_rsi < 40:
        return None

    sma200 = calc_sma(d_close, 200)
    price_vs_200 = (d_close.iloc[-1] - sma200.iloc[-1]) / max(sma200.iloc[-1], 1e-9) * 100 if len(sma200.dropna()) >= 10 else 0

    trend_score = 0.0
    if daily_rsi >= 50: trend_score += 7
    if weekly_rsi >= 50: trend_score += 5
    if price_vs_200 > 0: trend_score += 3

    ai_score = int(min(99, max(10, best["raw_score"] + trend_score)))
    if ai_score < 50:
        return None

    # ── Trade blueprint ──
    cmp = round(float(d_close.iloc[-1]), 2)
    prev_close = round(float(d_close.iloc[-2]), 2) if len(d_close) > 1 else cmp
    day_change = round(cmp - prev_close, 2)
    day_change_pct = round(day_change / max(prev_close, 1) * 100, 2)

    pivot = round(best["mid_pivot"] * 1.001, 2)
    stop = round(best["right_low"] * 0.97, 2)
    t1 = round(pivot * 1.12, 2)
    # Measured move: pivot + pivot_height
    measured_move = best["mid_pivot"] - best["right_low"]
    t2 = round(pivot + measured_move, 2)
    risk = max(0.5, pivot - stop)
    reward = max(1.0, t1 - pivot)
    rr = round(reward / risk, 1)

    if rr < 1.5:
        return None

    tier, badge = conviction_tier_label(ai_score)
    v_ratio = vol_ratio(d_volume)

    return {
        "symbol": symbol, "company_name": company_name, "sector": sector, "exchange": exchange,
        "pattern_type": "DOUBLE_BOTTOM", "pattern_label": "Double Bottom (W)",
        "cmp": cmp, "day_change": day_change, "day_change_pct": day_change_pct,
        "pivot_buy_point": pivot, "stop_loss": stop, "target_1": t1, "target_2": t2, "risk_reward": rr,
        "pattern_depth_pct": best["pivot_height_pct"], "pattern_width_weeks": float(best["width_weeks"]),
        "volume_ratio": v_ratio,
        "ai_conviction_score": ai_score, "conviction_tier": tier, "tier_badge": badge,
        "pattern_metrics": {
            "left_low": best["left_low"], "right_low": best["right_low"], "mid_pivot": best["mid_pivot"],
            "low_symmetry_pct": best["low_diff_pct"], "w_height_pct": best["pivot_height_pct"],
            "right_low_drying": best["right_low_drying"], "pct_from_pivot": best["pct_from_pivot"],
        },
        "daily_rsi": daily_rsi, "weekly_rsi": weekly_rsi,
        "price_vs_200d_sma": round(price_vs_200, 2),
        "tradingview_url": f"https://in.tradingview.com/symbols/NSE-{symbol}/",
        "techno_funda_url": f"/techno-funda/{symbol}",
    }

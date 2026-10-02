"""
Alpha India — Flat Base Pattern Engine
========================================
Definition:
  - Prior uptrend (stock above 200d SMA)
  - Consolidation of 5–52 weeks with depth < 15%
  - Volume contracts during base (drying up = institutional holding)
  - Price stays in upper 25% of 52-week range
  - Tight weekly closes (low standard deviation)
  - Pivot = top of base + 0.10% buffer

AI Scoring (0–100):
  - Tightness (depth < 5% = elite) : 0–30
  - Volume contraction             : 0–20
  - Price position (52w range)     : 0–15
  - Trend quality (RSI, EMA)       : 0–20
  - Base width (optimal 5–15 wks)  : 0–15
"""

from __future__ import annotations

from typing import Any, Dict, Optional

import numpy as np
import pandas as pd

from app.services.pattern_engine.pattern_core import (
    PatternResult, calc_rsi, calc_ema, calc_sma, vol_ratio, conviction_tier_label
)


def detect_flat_base(
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
    w_volume: pd.Series,
    m_close: pd.Series,
    nifty_close: Optional[pd.Series] = None,
) -> Optional[Dict[str, Any]]:
    """
    Detects Flat Base pattern on weekly bars.
    Returns None if no valid pattern found.
    """
    n_w = len(w_close)
    if n_w < 20:
        return None

    # ── Prior uptrend check ──
    sma200 = calc_sma(d_close, 200)
    if len(sma200.dropna()) < 10:
        return None
    price_vs_200 = (d_close.iloc[-1] - sma200.iloc[-1]) / max(sma200.iloc[-1], 1) * 100
    if price_vs_200 < -5:
        return None  # Downtrend — skip

    # ── Search for flat base in last 52 weekly bars ──
    best: Optional[Dict[str, Any]] = None
    best_score = -1.0

    for base_len in range(5, min(53, n_w)):
        seg_w = w_close.iloc[-base_len:]
        seg_vol = w_volume.iloc[-base_len:]

        base_high = float(seg_w.max())
        base_low = float(seg_w.min())
        depth_pct = (base_high - base_low) / max(base_high, 1e-9) * 100

        # Flat base: depth must be < 15%
        if depth_pct >= 15.0:
            break  # As we extend width, depth grows — stop

        # Base must be preceded by an uptrend (prior week high > base low by > 20%)
        prior_idx = max(0, n_w - base_len - 5)
        prior_high = float(w_close.iloc[prior_idx:n_w - base_len].max()) if n_w - base_len > prior_idx else base_high
        if prior_high <= base_low * 1.10:
            continue

        # Tightness: weekly std / mid
        base_mid = (base_high + base_low) / 2
        weekly_std_pct = float(seg_w.std()) / max(base_mid, 1e-9) * 100

        # Volume contraction during base
        pre_base_vol = float(w_volume.iloc[max(0, n_w - base_len - 8):n_w - base_len].mean()) if n_w - base_len > 0 else 0
        base_avg_vol = float(seg_vol.mean())
        vol_contracting = base_avg_vol < pre_base_vol * 0.80 if pre_base_vol > 0 else False

        # 52-week position
        high_52w = float(w_close.iloc[-52:].max()) if n_w >= 52 else base_high
        price_position_pct = (d_close.iloc[-1] - base_low) / max(high_52w - base_low, 1) * 100

        # ── Score ──
        score = 0.0

        # Tightness (0–30)
        if depth_pct <= 3:
            score += 30
        elif depth_pct <= 5:
            score += 24
        elif depth_pct <= 8:
            score += 18
        elif depth_pct <= 12:
            score += 12
        else:
            score += 5

        # Volume contraction (0–20)
        if vol_contracting:
            score += 20
        elif base_avg_vol < pre_base_vol * 0.95:
            score += 10

        # Price position in 52w range (0–15)
        if price_position_pct >= 75:
            score += 15
        elif price_position_pct >= 50:
            score += 8

        # Base width bonus (optimal 5–15 weeks)
        if 5 <= base_len <= 15:
            score += 10
        elif base_len <= 30:
            score += 5

        # Weekly std tightness bonus (0–10)
        if weekly_std_pct < 1.5:
            score += 10
        elif weekly_std_pct < 3:
            score += 5

        if score > best_score:
            best_score = score
            best = {
                "depth_pct": round(depth_pct, 2),
                "width_weeks": base_len,
                "base_high": round(base_high, 2),
                "base_low": round(base_low, 2),
                "weekly_std_pct": round(weekly_std_pct, 2),
                "vol_contracting": vol_contracting,
                "price_position_pct": round(price_position_pct, 2),
                "raw_score": score,
            }

    if best is None or best["raw_score"] < 20:
        return None

    # ── RSI filters ──
    d_rsi_series = calc_rsi(d_close, 14)
    w_rsi_series = calc_rsi(w_close, 14)
    daily_rsi = round(float(d_rsi_series.iloc[-1]) if not pd.isna(d_rsi_series.iloc[-1]) else 50, 1)
    weekly_rsi = round(float(w_rsi_series.iloc[-1]) if not pd.isna(w_rsi_series.iloc[-1]) else 50, 1)

    if weekly_rsi < 45:
        return None

    # Trend score (0–20)
    trend_score = 0.0
    if daily_rsi >= 55: trend_score += 8
    elif daily_rsi >= 45: trend_score += 4
    if weekly_rsi >= 55: trend_score += 8
    elif weekly_rsi >= 45: trend_score += 4
    if price_vs_200 > 10: trend_score += 4

    # Final AI score
    ai_score = int(min(99, max(10, best["raw_score"] + trend_score)))

    if ai_score < 50:
        return None

    # ── Trade blueprint ──
    cmp = round(float(d_close.iloc[-1]), 2)
    prev_close = round(float(d_close.iloc[-2]), 2) if len(d_close) > 1 else cmp
    day_change = round(cmp - prev_close, 2)
    day_change_pct = round(day_change / max(prev_close, 1) * 100, 2)

    pivot = round(best["base_high"] * 1.001, 2)
    stop = round(best["base_low"] * 0.97, 2)
    t1 = round(pivot * 1.10, 2)
    t2 = round(pivot * 1.20, 2)
    risk = max(0.5, pivot - stop)
    reward = max(1.0, t1 - pivot)
    rr = round(reward / risk, 1)

    if rr < 1.5:
        return None

    tier, badge = conviction_tier_label(ai_score)
    v_ratio = vol_ratio(d_volume)

    sma200_val = float(sma200.iloc[-1]) if not pd.isna(sma200.iloc[-1]) else cmp

    return {
        "symbol": symbol, "company_name": company_name, "sector": sector, "exchange": exchange,
        "pattern_type": "FLAT_BASE", "pattern_label": "Flat Base",
        "cmp": cmp, "day_change": day_change, "day_change_pct": day_change_pct,
        "pivot_buy_point": pivot, "stop_loss": stop, "target_1": t1, "target_2": t2, "risk_reward": rr,
        "pattern_depth_pct": best["depth_pct"], "pattern_width_weeks": float(best["width_weeks"]),
        "volume_ratio": v_ratio,
        "ai_conviction_score": ai_score, "conviction_tier": tier, "tier_badge": badge,
        "pattern_metrics": {
            "base_high": best["base_high"], "base_low": best["base_low"],
            "weekly_std_pct": best["weekly_std_pct"],
            "vol_contracting": best["vol_contracting"],
            "price_position_pct": best["price_position_pct"],
            "price_vs_200d_sma": round(price_vs_200, 2),
        },
        "daily_rsi": daily_rsi, "weekly_rsi": weekly_rsi,
        "price_vs_200d_sma": round(price_vs_200, 2),
        "tradingview_url": f"https://in.tradingview.com/symbols/NSE-{symbol}/",
        "techno_funda_url": f"/techno-funda/{symbol}",
    }

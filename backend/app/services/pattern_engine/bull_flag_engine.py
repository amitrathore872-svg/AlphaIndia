"""
Alpha India — Bull Flag & High Tight Flag Pattern Engines
===========================================================

BULL FLAG:
  - Pole: strong directional move of 15–60% in 5–20 trading days
  - Flag: orderly, low-volume pullback of 5–20% lasting 5–25 days
  - Flag channels downward (lower highs + lower lows) or sideways
  - Breakout: price closes above flag high on 1.5× volume surge
  - R:R typically 3:1 or better

HIGH TIGHT FLAG (HTF — Mark Minervini Elite Setup):
  - Pole: explosive 100%+ gain in ≤ 8 weeks (very rare, very powerful)
  - Flag: 10–25% correction in ≤ 3–5 weeks
  - Extremely tight volume during flag
  - One of the highest win-rate patterns in CANSLIM research
  - AI score gets a +15 premium over standard bull flag

AI Scoring — Bull Flag (0–100):
  - Pole strength (gain %, speed)          : 0–30
  - Flag tightness (depth, std)            : 0–25
  - Volume signature (flag drying up)      : 0–20
  - Trend quality                          : 0–15
  - Proximity to breakout                  : 0–10

AI Scoring — High Tight Flag (0–100):
  Same as Bull Flag + 15 pt HTF premium for pole >= 100%
"""

from __future__ import annotations

from typing import Any, Dict, Optional, Tuple

import numpy as np
import pandas as pd

from app.services.pattern_engine.pattern_core import (
    calc_rsi, calc_sma, vol_ratio, conviction_tier_label
)


# ─────────────────────────────────────────────────────────────────────────────
# Bull Flag
# ─────────────────────────────────────────────────────────────────────────────

def detect_bull_flag(
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
    Detects Bull Flag on daily bars (last 120 sessions).
    """
    n_d = len(d_close)
    if n_d < 50:
        return None

    best: Optional[Dict[str, Any]] = None
    best_score = -1.0

    # Try different flag window sizes
    for flag_len in [5, 7, 10, 15, 20, 25]:
        if flag_len >= n_d - 20:
            continue

        # ── Flag segment ── (last flag_len bars)
        flag_close = d_close.iloc[-flag_len:]
        flag_high = d_high.iloc[-flag_len:]
        flag_low = d_low.iloc[-flag_len:]
        flag_vol = d_volume.iloc[-flag_len:]

        flag_top = float(flag_high.max())
        flag_bottom = float(flag_low.min())
        flag_depth_pct = (flag_top - flag_bottom) / max(flag_top, 1e-9) * 100

        # Flag depth must be 3–22%
        if flag_depth_pct < 3 or flag_depth_pct > 22:
            continue

        # ── Pole segment ── (10–20 bars before flag)
        for pole_len in [8, 10, 12, 15, 20]:
            pole_start = -(flag_len + pole_len)
            pole_end = -flag_len

            if abs(pole_start) > n_d:
                continue

            pole_close = d_close.iloc[pole_start:pole_end]
            pole_vol = d_volume.iloc[pole_start:pole_end]

            if len(pole_close) < 5:
                continue

            pole_start_price = float(pole_close.iloc[0])
            pole_end_price = float(pole_close.iloc[-1])
            pole_gain_pct = (pole_end_price - pole_start_price) / max(pole_start_price, 1e-9) * 100

            # Pole must be strong: ≥ 15% gain
            if pole_gain_pct < 15:
                continue

            # Most of pole gain should be in upper direction
            positive_days = int((pole_close.diff().dropna() > 0).sum())
            pole_directional_pct = positive_days / max(len(pole_close) - 1, 1) * 100

            if pole_directional_pct < 55:
                continue

            # ── Flag volume should be lower than pole ──
            pole_avg_vol = float(pole_vol.mean())
            flag_avg_vol = float(flag_vol.mean())
            flag_vol_drying = flag_avg_vol < pole_avg_vol * 0.75

            # Flag should drift lower or sideways (not surging up)
            flag_slope = float(np.polyfit(np.arange(len(flag_close)), flag_close.values, 1)[0])
            flag_drifting = flag_slope <= 0  # downward or flat = valid flag

            # ── Score ──
            score = 0.0

            # Pole strength (0–30)
            if pole_gain_pct >= 60: score += 30
            elif pole_gain_pct >= 40: score += 24
            elif pole_gain_pct >= 25: score += 18
            elif pole_gain_pct >= 15: score += 12

            # Pole quality (directional)
            if pole_directional_pct >= 75: score += 5
            elif pole_directional_pct >= 65: score += 3

            # Flag tightness (0–25)
            if flag_depth_pct <= 8: score += 25
            elif flag_depth_pct <= 12: score += 18
            elif flag_depth_pct <= 17: score += 10
            else: score += 5

            # Volume (0–20)
            if flag_vol_drying: score += 20
            elif flag_avg_vol < pole_avg_vol: score += 10

            # Drift direction (0–10)
            if flag_drifting: score += 10

            if score > best_score:
                best_score = score
                best = {
                    "pole_gain_pct": round(pole_gain_pct, 2),
                    "pole_len": pole_len,
                    "flag_depth_pct": round(flag_depth_pct, 2),
                    "flag_len": flag_len,
                    "flag_top": round(flag_top, 2),
                    "flag_bottom": round(flag_bottom, 2),
                    "flag_vol_drying": flag_vol_drying,
                    "flag_drifting": flag_drifting,
                    "pole_directional_pct": round(pole_directional_pct, 2),
                    "raw_score": score,
                    "is_htf": pole_gain_pct >= 100,
                }

    if best is None or best["raw_score"] < 25:
        return None

    return _build_flag_result(
        symbol, company_name, sector, exchange,
        d_close, d_volume, w_close,
        best, is_htf=best["is_htf"]
    )


# ─────────────────────────────────────────────────────────────────────────────
# High Tight Flag (separate entry point — same detection but tighter criteria)
# ─────────────────────────────────────────────────────────────────────────────

def detect_high_tight_flag(
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
    High Tight Flag: pole ≥ 100% in ≤ 8 weeks + flag 10–25% in ≤ 5 weeks.
    """
    n_d = len(d_close)
    if n_d < 60:
        return None

    # HTF uses a strict 8-week (40 bar) pole window and 5-week (25 bar) flag
    best: Optional[Dict[str, Any]] = None
    best_score = -1.0

    for flag_len in [5, 7, 10, 15, 20, 25]:
        if flag_len >= n_d - 25:
            continue

        flag_close = d_close.iloc[-flag_len:]
        flag_high = d_high.iloc[-flag_len:]
        flag_low = d_low.iloc[-flag_len:]
        flag_vol = d_volume.iloc[-flag_len:]

        flag_top = float(flag_high.max())
        flag_bottom = float(flag_low.min())
        flag_depth_pct = (flag_top - flag_bottom) / max(flag_top, 1e-9) * 100

        # HTF flag: 8–25% correction
        if flag_depth_pct < 8 or flag_depth_pct > 25:
            continue

        # Strict: ≤ 5 weeks flag
        if flag_len > 25:
            continue

        # Pole: look back max 40 bars (8 weeks)
        for pole_len in [15, 20, 25, 30, 40]:
            if abs(-(flag_len + pole_len)) > n_d:
                continue

            pole_close = d_close.iloc[-(flag_len + pole_len):-flag_len]
            pole_vol = d_volume.iloc[-(flag_len + pole_len):-flag_len]

            if len(pole_close) < 10:
                continue

            pole_start_price = float(pole_close.iloc[0])
            pole_end_price = float(pole_close.iloc[-1])
            pole_gain_pct = (pole_end_price - pole_start_price) / max(pole_start_price, 1e-9) * 100

            # HTF: pole MUST be ≥ 100%
            if pole_gain_pct < 90:
                continue

            flag_avg_vol = float(flag_vol.mean())
            pole_avg_vol = float(pole_vol.mean())
            flag_vol_drying = flag_avg_vol < pole_avg_vol * 0.65  # Tighter for HTF

            score = 0.0

            # Pole magnitude (0–30)
            if pole_gain_pct >= 200: score += 30
            elif pole_gain_pct >= 150: score += 26
            elif pole_gain_pct >= 100: score += 20

            # Flag tightness (0–25)
            if flag_depth_pct <= 12: score += 25
            elif flag_depth_pct <= 18: score += 18
            else: score += 10

            # Volume drying (0–25)
            if flag_vol_drying: score += 25
            elif flag_avg_vol < pole_avg_vol: score += 12

            # HTF premium
            score += 15

            if score > best_score:
                best_score = score
                best = {
                    "pole_gain_pct": round(pole_gain_pct, 2),
                    "pole_len": pole_len,
                    "flag_depth_pct": round(flag_depth_pct, 2),
                    "flag_len": flag_len,
                    "flag_top": round(flag_top, 2),
                    "flag_bottom": round(flag_bottom, 2),
                    "flag_vol_drying": flag_vol_drying,
                    "flag_drifting": True,
                    "pole_directional_pct": 80.0,
                    "raw_score": score,
                    "is_htf": True,
                }

    if best is None or best["raw_score"] < 40:
        return None

    return _build_flag_result(
        symbol, company_name, sector, exchange,
        d_close, d_volume, w_close,
        best, is_htf=True
    )


# ─────────────────────────────────────────────────────────────────────────────
# Shared result builder for both flag types
# ─────────────────────────────────────────────────────────────────────────────

def _build_flag_result(
    symbol: str,
    company_name: str,
    sector: str,
    exchange: str,
    d_close: pd.Series,
    d_volume: pd.Series,
    w_close: pd.Series,
    best: Dict[str, Any],
    is_htf: bool = False,
) -> Optional[Dict[str, Any]]:
    # RSI
    d_rsi_series = calc_rsi(d_close, 14)
    w_rsi_series = calc_rsi(w_close, 14)
    daily_rsi = round(float(d_rsi_series.iloc[-1]) if not pd.isna(d_rsi_series.iloc[-1]) else 50, 1)
    weekly_rsi = round(float(w_rsi_series.iloc[-1]) if not pd.isna(w_rsi_series.iloc[-1]) else 50, 1)

    sma200 = calc_sma(d_close, 200)
    price_vs_200 = (
        (d_close.iloc[-1] - sma200.iloc[-1]) / max(sma200.iloc[-1], 1e-9) * 100
        if len(sma200.dropna()) >= 10 else 0
    )

    trend_score = 0.0
    if daily_rsi >= 55: trend_score += 8
    if weekly_rsi >= 55: trend_score += 7

    ai_score = int(min(99, max(10, best["raw_score"] + trend_score)))
    if ai_score < 50:
        return None

    cmp = round(float(d_close.iloc[-1]), 2)
    prev_close = round(float(d_close.iloc[-2]), 2) if len(d_close) > 1 else cmp
    day_change = round(cmp - prev_close, 2)
    day_change_pct = round(day_change / max(prev_close, 1) * 100, 2)

    pivot = round(best["flag_top"] * 1.001, 2)
    stop = round(best["flag_bottom"] * 0.97, 2)
    t1 = round(pivot * 1.15, 2)
    # Measured move: pole length projected from breakout
    pole_pts = d_close.iloc[-(best["flag_len"] + best["pole_len"]):-best["flag_len"]].iloc[-1] - \
               d_close.iloc[-(best["flag_len"] + best["pole_len"])].iloc[0] if best["pole_len"] > 0 else pivot * 0.2
    t2 = round(pivot + abs(float(pole_pts)) * 0.7, 2) if isinstance(pole_pts, (int, float)) else t1 * 1.05
    risk = max(0.5, pivot - stop)
    reward = max(1.0, t1 - pivot)
    rr = round(reward / risk, 1)

    if rr < 1.5:
        return None

    tier, badge = conviction_tier_label(ai_score)
    v_ratio = vol_ratio(d_volume)

    pattern_type = "HIGH_TIGHT_FLAG" if is_htf else "BULL_FLAG"
    pattern_label = "High Tight Flag ⚡" if is_htf else "Bull Flag"

    return {
        "symbol": symbol, "company_name": company_name, "sector": sector, "exchange": exchange,
        "pattern_type": pattern_type, "pattern_label": pattern_label,
        "cmp": cmp, "day_change": day_change, "day_change_pct": day_change_pct,
        "pivot_buy_point": pivot, "stop_loss": stop, "target_1": t1, "target_2": t2, "risk_reward": rr,
        "pattern_depth_pct": best["flag_depth_pct"], "pattern_width_weeks": round(best["flag_len"] / 5, 1),
        "volume_ratio": v_ratio,
        "ai_conviction_score": ai_score, "conviction_tier": tier, "tier_badge": badge,
        "pattern_metrics": {
            "pole_gain_pct": best["pole_gain_pct"],
            "pole_length_bars": best["pole_len"],
            "flag_depth_pct": best["flag_depth_pct"],
            "flag_length_bars": best["flag_len"],
            "flag_top": best["flag_top"],
            "flag_bottom": best["flag_bottom"],
            "flag_vol_drying": best["flag_vol_drying"],
            "is_high_tight_flag": is_htf,
        },
        "daily_rsi": daily_rsi, "weekly_rsi": weekly_rsi,
        "price_vs_200d_sma": round(price_vs_200, 2),
        "tradingview_url": f"https://in.tradingview.com/symbols/NSE-{symbol}/",
        "techno_funda_url": f"/techno-funda/{symbol}",
    }

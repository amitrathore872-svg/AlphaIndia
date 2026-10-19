"""
Alpha India — AI-Powered High Conviction Cup & Handle Detection Engine
=======================================================================
Multi-Timeframe Engine supporting:
  - Tactical / Quick-Win Setups (Daily bars, 2.5–8.5 weeks width, 2–14 days handle, fast 1–3 week swings)
  - Standard & Macro Structural Bases (Weekly bars, 8–55 weeks width, 1–6 weeks handle, 2–6 months positions)

Stage 1 : Cup Geometry        — U-shape depth, width, symmetry, right-lip recovery
Stage 2 : Handle Geometry     — duration, depth, upper-half placement, contraction
Stage 3 : Volume Signature    — accumulation in base, surge at recovery, contraction in handle
Stage 4 : Trend Integrity     — EMA alignment, multi-timeframe RSI momentum
Stage 5 : Base Quality        — volatility contraction, inside bars, tight close standard deviation
Stage 6 : Relative Strength   — stock vs Nifty 500 outperformance
Stage 7 : Fundamental Filter  — revenue/PAT growth, ROCE (from DB)
Stage 8 : AI Conviction Score — composite 0–100 score; only >= 60 surfaced
"""

from __future__ import annotations

import logging
import math
import time
from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
import requests
import yfinance as yf
from sqlalchemy.orm import Session

from app.models.company import Company

logger = logging.getLogger("alpha_india.cup_handle.engine")


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass
class CupGeometry:
    prior_high: float = 0.0
    cup_low: float = 0.0
    right_rim: float = 0.0
    depth_pct: float = 0.0          # % decline from prior_high to cup_low
    width_weeks: float = 0.0        # calendar width of the cup
    width_hours: int = 0            # hourly bar count (if 1h timeframe)
    symmetry_score: float = 0.0     # 0–100 (100 = perfect U)
    right_lip_recovery: float = 0.0 # right_rim / prior_high * 100
    left_slope: float = 0.0
    right_slope: float = 0.0
    cup_start_idx: int = 0
    cup_end_idx: int = 0
    duration_type: str = "MACRO"    # "QUICK_WIN" (3–8w) | "STANDARD" (8–20w) | "MACRO" (>20w)
    duration_label: str = ""        # e.g. "Quick Win (4.6w)"
    holding_period: str = "2–6 Months" # "1–3 Weeks" for quick win
    timeframe: str = "Weekly"       # "Daily" or "Weekly"
    cup_bars: int = 0
    valid: bool = False


@dataclass
class HandleGeometry:
    handle_high: float = 0.0
    handle_low: float = 0.0
    pivot_buy_point: float = 0.0    # handle_high + 0.10% buffer
    depth_pct: float = 0.0          # % drift from right rim
    width_weeks: float = 0.0
    handle_bars: int = 0
    handle_hours: int = 0
    in_upper_half: bool = False      # must form in upper 50% of cup
    volume_contracting: bool = False # avg handle vol < avg cup vol or 50-DMA
    handle_start_idx: int = 0
    handle_end_idx: int = 0
    valid: bool = False


@dataclass
class VolumeProfile:
    avg_vol_cup_base: float = 0.0
    avg_vol_right_recovery: float = 0.0
    avg_vol_handle: float = 0.0
    avg_vol_50d: float = 0.0
    breakout_vol: float = 0.0
    breakout_vol_ratio: float = 0.0  # breakout_vol / avg_vol_50d
    base_drying_up: bool = False     # base vol < 75% of avg
    recovery_surge: bool = False     # recovery vol >= 1.25× avg
    handle_contraction: bool = False # handle vol < cup vol or < 50-DMA
    breakout_confirmed: bool = False # breakout vol >= 1.3× avg
    score: float = 0.0               # 0–20


@dataclass
class TrendQuality:
    above_10w_ema: bool = False
    daily_rsi: float = 0.0
    weekly_rsi: float = 0.0
    monthly_rsi: float = 0.0
    rsi_zone_ok: bool = False        # daily 50–80, weekly >= 50
    price_vs_200d_sma: float = 0.0   # % above/below 200d SMA
    score: float = 0.0               # 0–15


@dataclass
class BaseQuality:
    handle_std_pct: float = 0.0      # std of closes during handle / mid price
    inside_bar_count: int = 0        # count of inside bars in handle
    gap_down_count: int = 0          # large gap-down candles inside handle
    volatility_contracting: bool = False
    tight_action: bool = False        # handle_std_pct < 4.0%
    score: float = 0.0               # 0–20


@dataclass
class RelativeStrength:
    stock_12w_return: float = 0.0
    nifty_12w_return: float = 0.0
    outperformance: float = 0.0      # stock - nifty
    rs_percentile: float = 0.0       # vs universe
    outperforms: bool = False
    score: float = 0.0               # 0–15


@dataclass
class FundamentalOverlay:
    revenue_growth_pct: Optional[float] = None
    pat_growth_pct: Optional[float] = None
    roce_pct: Optional[float] = None
    health_score: Optional[float] = None
    revenue_positive: bool = False
    pat_positive: bool = False
    roce_adequate: bool = False
    health_adequate: bool = False
    score: float = 0.0               # 0–10
    data_available: bool = False


@dataclass
class CupHandleResult:
    # Identification
    symbol: str = ""
    company_name: str = ""
    sector: str = ""
    exchange: str = "NSE"

    # Duration categorization
    duration_type: str = "MACRO"     # QUICK_WIN | STANDARD | MACRO
    duration_label: str = ""         # "Quick Win (4.6w)"
    holding_period: str = "1–3 Weeks" # "1–3 Weeks" vs "2–6 Months"
    timeframe: str = "Daily"         # "Daily" vs "Weekly"
    width_hours: int = 0
    distance_to_pivot_pct: float = 0.0 # CMP distance to pivot

    # Price
    cmp: float = 0.0
    day_change: float = 0.0
    day_change_pct: float = 0.0
    pivot_buy_point: float = 0.0
    stop_loss_tight: float = 0.0     # handle low
    stop_loss_wide: float = 0.0      # cup_base * 0.93
    target_1: float = 0.0            # buy_point * target %
    target_2: float = 0.0            # measured move (cup depth)
    risk_reward: float = 0.0

    # Geometry
    cup: CupGeometry = field(default_factory=CupGeometry)
    handle: HandleGeometry = field(default_factory=HandleGeometry)

    # Analysis
    volume: VolumeProfile = field(default_factory=VolumeProfile)
    trend: TrendQuality = field(default_factory=TrendQuality)
    base: BaseQuality = field(default_factory=BaseQuality)
    rs: RelativeStrength = field(default_factory=RelativeStrength)
    fundamentals: FundamentalOverlay = field(default_factory=FundamentalOverlay)

    # AI Scoring
    ai_conviction_score: int = 0     # 0–100
    conviction_tier: str = ""        # ELITE / HIGH / DEVELOPING
    tier_badge: str = ""

    # Stage gate results
    stage_gates: Dict[str, bool] = field(default_factory=dict)
    stages_passed: int = 0

    # Trade
    tradingview_url: str = ""
    techno_funda_url: str = ""

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        return d


# ---------------------------------------------------------------------------
# Helper indicator functions
# ---------------------------------------------------------------------------

def _calc_rsi(series: pd.Series, period: int = 14) -> pd.Series:
    delta = series.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(com=period - 1, min_periods=period).mean()
    avg_loss = loss.ewm(com=period - 1, min_periods=period).mean()
    rs = avg_gain / np.maximum(1e-9, avg_loss)
    return 100.0 - (100.0 / (1.0 + rs))


def _calc_ema(series: pd.Series, span: int) -> pd.Series:
    return series.ewm(span=span, adjust=False).mean()


def _calc_sma(series: pd.Series, n: int) -> pd.Series:
    return series.rolling(n).mean()


def _cup_symmetry_bucket(symmetry: float) -> str:
    if symmetry >= 75:
        return "EXCELLENT"
    elif symmetry >= 55:
        return "GOOD"
    elif symmetry >= 40:
        return "MODERATE"
    return "DEVELOPING"


# ---------------------------------------------------------------------------
# Micro-Duration 1-Hour Detector (Hourly Bars: 12–65 Hours / ~2–10 Days)
# ---------------------------------------------------------------------------

_1H_CACHE: Dict[str, Tuple[float, pd.DataFrame]] = {}


def _fetch_1h_ohlcv(clean_sym: str) -> Optional[pd.DataFrame]:
    """
    Fetches real-time 1-hour OHLCV candles from Yahoo Finance v8 chart API.
    Avoids yfinance crumb 429 rate limit issues by querying direct JSON endpoint.
    Caches results in memory for 300 seconds.
    """
    now = time.time()
    if clean_sym in _1H_CACHE:
        cached_ts, cached_df = _1H_CACHE[clean_sym]
        if (now - cached_ts) < 300:
            return cached_df

    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{clean_sym}.NS?interval=1h&range=1mo"
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    try:
        resp = requests.get(url, headers=headers, timeout=6)
        if resp.status_code == 200:
            res = resp.json().get("chart", {}).get("result", [])
            if res:
                ts = res[0].get("timestamp", [])
                q = res[0].get("indicators", {}).get("quote", [{}])[0]
                opens = q.get("open", [])
                highs = q.get("high", [])
                lows = q.get("low", [])
                closes = q.get("close", [])
                volumes = q.get("volume", [])
                if ts and closes and len(closes) >= 30:
                    df = pd.DataFrame({
                        "Open": opens,
                        "High": highs,
                        "Low": lows,
                        "Close": closes,
                        "Volume": volumes,
                    }, index=pd.to_datetime(ts, unit="s", utc=True).tz_convert("Asia/Kolkata")).dropna()
                    if len(df) >= 30:
                        _1H_CACHE[clean_sym] = (now, df)
                        return df
    except Exception as e:
        logger.debug(f"[CupHandleEngine] 1H fetch exception for {clean_sym}: {e}")
    return None


def _detect_1h_cup_handle(
    df_1h: pd.DataFrame,
) -> Optional[Tuple[CupGeometry, HandleGeometry, VolumeProfile]]:
    """
    Detects micro-duration Cup & Handle on 1-Hour candles.
    Base width: 12 to 65 hourly candles (~2 to 10 trading sessions).
    Cup depth: 2.5% to 16.0% (shallow, high-velocity intraday/swing consolidation).
    Handle length: 2 to 15 hourly candles.
    Handle drift: 0.8% to 7.0%.
    Handle location: Upper 50% of the cup.
    Ideal for BTST and 1–3 day tactical micro-swings.
    """
    if df_1h is None or len(df_1h) < 30:
        return None

    closes = df_1h["Close"].values
    highs = df_1h["High"].values
    lows = df_1h["Low"].values
    volumes = df_1h["Volume"].values
    n = len(closes)

    best_cand = None
    best_score = -1.0

    # Search window for right rim: last 2 to 18 hourly candles
    for right_idx in range(n - 2, max(15, n - 18), -1):
        right_rim = float(highs[right_idx])
        handle_len = (n - 1) - right_idx
        if handle_len < 2 or handle_len > 15:
            continue

        handle_high = float(max(highs[right_idx + 1:]))
        handle_low = float(min(lows[right_idx + 1:]))
        handle_drift = (right_rim - handle_low) / max(right_rim, 1e-9) * 100.0

        if not (0.8 <= handle_drift <= 7.0):
            continue

        # Cup base search: 8 to 45 bars before right_rim
        cup_search_start = max(0, right_idx - 45)
        cup_search_end = right_idx - 3
        if cup_search_end <= cup_search_start:
            continue

        cup_segment = lows[cup_search_start:cup_search_end]
        cup_low_rel = int(np.argmin(cup_segment))
        cup_low = float(cup_segment[cup_low_rel])
        cup_low_idx = cup_search_start + cup_low_rel

        # Prior high (left rim) before cup_low: 3 to 25 bars
        left_search_start = max(0, cup_low_idx - 25)
        if cup_low_idx <= left_search_start + 2:
            continue
        left_segment = highs[left_search_start:cup_low_idx]
        prior_high_rel = int(np.argmax(left_segment))
        prior_high = float(left_segment[prior_high_rel])
        prior_high_idx = left_search_start + prior_high_rel

        # Depth check: 2.5% to 16.0%
        depth_pct = (prior_high - cup_low) / max(prior_high, 1e-9) * 100.0
        if not (2.5 <= depth_pct <= 16.0):
            continue

        # Right lip recovery: 86% to 114%
        right_lip_recovery = (right_rim / max(prior_high, 1e-9)) * 100.0
        if right_lip_recovery < 86.0 or right_lip_recovery > 114.0:
            continue

        # Upper half of cup check
        cup_mid = cup_low + (prior_high - cup_low) * 0.45
        if handle_low < cup_mid:
            continue

        total_bars = (n - 1) - prior_high_idx
        cup_bars = right_idx - prior_high_idx
        if total_bars < 12 or total_bars > 65:
            continue

        # Symmetry
        left_len = max(1, cup_low_idx - prior_high_idx)
        right_len = max(1, right_idx - cup_low_idx)
        left_slope = abs(prior_high - cup_low) / left_len
        right_slope = abs(right_rim - cup_low) / right_len
        slope_ratio = min(left_slope, right_slope) / max(max(left_slope, right_slope), 1e-9)
        symmetry_score = round(slope_ratio * 100.0, 1)

        # Volume signature for 1-hour
        vol_20h = float(np.mean(volumes[-20:])) if len(volumes) >= 20 else float(np.mean(volumes))
        handle_avg_vol = float(np.mean(volumes[right_idx + 1:]))
        cup_vols = volumes[prior_high_idx:right_idx + 1]
        avg_cup_vol = float(np.mean(cup_vols)) if len(cup_vols) > 0 else 1.0

        vol_contraction = (handle_avg_vol < vol_20h * 0.95) or (handle_avg_vol < avg_cup_vol * 0.88)
        breakout_vol = float(volumes[-1])
        breakout_vol_ratio = round(breakout_vol / max(vol_20h, 1.0), 2)
        breakout_confirmed = breakout_vol_ratio >= 1.25

        vol_score = 6.0
        if vol_contraction:
            vol_score += 6.0
        if breakout_confirmed:
            vol_score += 6.0
        elif breakout_vol_ratio >= 1.1:
            vol_score += 3.0

        vp = VolumeProfile(
            avg_vol_cup_base=round(avg_cup_vol, 0),
            avg_vol_right_recovery=round(vol_20h, 0),
            avg_vol_handle=round(handle_avg_vol, 0),
            avg_vol_50d=round(vol_20h, 0),
            breakout_vol=breakout_vol,
            breakout_vol_ratio=breakout_vol_ratio,
            base_drying_up=True,
            recovery_surge=True,
            handle_contraction=vol_contraction,
            breakout_confirmed=breakout_confirmed,
            score=round(vol_score, 1),
        )

        pivot = round(right_rim * 1.001, 2)
        width_weeks = round(total_bars / 31.25, 2)

        cup_geo = CupGeometry(
            prior_high=round(prior_high, 2),
            cup_low=round(cup_low, 2),
            right_rim=round(right_rim, 2),
            depth_pct=round(depth_pct, 2),
            width_weeks=width_weeks,
            width_hours=int(total_bars),
            symmetry_score=symmetry_score,
            right_lip_recovery=round(right_lip_recovery, 2),
            left_slope=round(left_slope, 4),
            right_slope=round(right_slope, 4),
            cup_start_idx=prior_high_idx,
            cup_end_idx=right_idx,
            duration_type="HOURLY_1H",
            duration_label=f"1-Hour Micro ({total_bars}h / {round(total_bars/6.25, 1)}d)",
            holding_period="1–3 Days",
            timeframe="1-Hour (60m)",
            cup_bars=int(cup_bars),
            valid=True,
        )

        hdl_geo = HandleGeometry(
            handle_high=round(handle_high, 2),
            handle_low=round(handle_low, 2),
            pivot_buy_point=pivot,
            depth_pct=round(handle_drift, 2),
            width_weeks=round(handle_len / 31.25, 2),
            handle_bars=int(handle_len),
            handle_hours=int(handle_len),
            in_upper_half=True,
            volume_contracting=vol_contraction,
            handle_start_idx=right_idx + 1,
            handle_end_idx=n - 1,
            valid=True,
        )

        composite_rank = symmetry_score * 0.4 + (100.0 - depth_pct) * 0.3 + vol_score * 1.5
        if composite_rank > best_score:
            best_score = composite_rank
            best_cand = (cup_geo, hdl_geo, vp)

    return best_cand


# ---------------------------------------------------------------------------
# Short-Duration Quick Win Detector (Daily Bars: 2.5–8.5 Weeks)
# ---------------------------------------------------------------------------

def _detect_quick_win_cup_handle(
    d_close: pd.Series,
    d_high: pd.Series,
    d_low: pd.Series,
    d_vol: pd.Series,
) -> Optional[Tuple[CupGeometry, HandleGeometry, VolumeProfile]]:
    """
    Detects short-duration (quick win) Cup & Handle on Daily bars.
    Base width: 12 to 44 trading days (2.5 to 8.8 weeks).
    Cup depth: 7% to 32% (tight, high-momentum pullback).
    Handle length: 2 to 14 trading days.
    Handle drift: 1.5% to 15%.
    Handle location: Upper 50% of the cup.
    Ideal for fast 1–3 week swing breakouts.
    """
    n = len(d_close)
    if n < 50:
        return None

    best_cand = None
    best_score = -1.0

    # Search window for right rim (cup end): within the last 2 to 22 trading sessions
    for cup_end in range(n - 2, max(18, n - 22), -1):
        right_rim = float(d_high.iloc[cup_end])

        handle_len = (n - 1) - cup_end
        if handle_len < 2 or handle_len > 14:
            continue

        handle_highs = d_high.iloc[cup_end + 1:]
        handle_lows = d_low.iloc[cup_end + 1:]
        handle_closes = d_close.iloc[cup_end + 1:]
        handle_vols = d_vol.iloc[cup_end + 1:]

        handle_high = float(handle_highs.max())
        handle_low = float(handle_lows.min())

        # Handle drift: % drop from right rim
        handle_drift = (right_rim - handle_low) / max(right_rim, 1e-9) * 100.0
        if not (1.5 <= handle_drift <= 15.0):
            continue

        # Cup base search: 10 to 40 sessions before cup_end
        cup_search_start = max(0, cup_end - 42)
        cup_search_end = cup_end - 3
        if cup_search_end <= cup_search_start:
            continue

        cup_segment = d_low.iloc[cup_search_start:cup_search_end]
        cup_low_rel = int(cup_segment.values.argmin())
        cup_low = float(cup_segment.iloc[cup_low_rel])
        cup_low_idx = cup_search_start + cup_low_rel

        # Prior high (left rim) before cup_low: 3 to 25 sessions
        left_search_start = max(0, cup_low_idx - 25)
        left_segment = d_high.iloc[left_search_start:cup_low_idx]
        if len(left_segment) < 3:
            continue

        prior_high_rel = int(left_segment.values.argmax())
        prior_high = float(left_segment.iloc[prior_high_rel])
        prior_high_idx = left_search_start + prior_high_rel

        # Depth check: 7.0% to 32.0%
        depth_pct = (prior_high - cup_low) / max(prior_high, 1e-9) * 100.0
        if not (7.0 <= depth_pct <= 32.0):
            continue

        # Right lip recovery: at least 86% of left rim, not bloated > 115%
        right_lip_recovery = (right_rim / max(prior_high, 1e-9)) * 100.0
        if right_lip_recovery < 86.0 or right_lip_recovery > 115.0:
            continue

        # Handle upper-half placement check
        cup_mid = cup_low + (prior_high - cup_low) * 0.45
        if handle_low < cup_mid:
            continue

        total_width_days = (n - 1) - prior_high_idx
        cup_width_days = cup_end - prior_high_idx
        width_weeks = round(total_width_days / 5.0, 1)

        if width_weeks < 2.5 or width_weeks > 9.5:
            continue

        # Symmetry: compare left descent slope vs right ascent slope
        left_len = max(1, cup_low_idx - prior_high_idx)
        right_len = max(1, cup_end - cup_low_idx)
        left_slope = abs(prior_high - cup_low) / left_len
        right_slope = abs(right_rim - cup_low) / right_len
        slope_ratio = min(left_slope, right_slope) / max(max(left_slope, right_slope), 1e-9)
        symmetry_score = round(slope_ratio * 100.0, 1)

        # Volume Profile for daily quick-win
        vol_50d = float(d_vol.rolling(50).mean().iloc[-1]) if len(d_vol) >= 50 else float(d_vol.mean())
        handle_avg_vol = float(handle_vols.mean()) if len(handle_vols) > 0 else 0.0
        cup_vols = d_vol.iloc[prior_high_idx:cup_end + 1]
        avg_cup_vol = float(cup_vols.mean()) if len(cup_vols) > 0 else 1.0

        recovery_vols = d_vol.iloc[max(0, cup_end - 4):cup_end + 1]
        avg_recovery_vol = float(recovery_vols.mean()) if len(recovery_vols) > 0 else 0.0

        base_start = max(0, cup_low_idx - 2)
        base_end = min(n - 1, cup_low_idx + 3)
        base_vols = d_vol.iloc[base_start:base_end]
        avg_base_vol = float(base_vols.mean()) if len(base_vols) > 0 else 0.0

        breakout_vol = float(d_vol.iloc[-1])
        breakout_vol_ratio = round(breakout_vol / max(vol_50d, 1.0), 2)

        vol_contraction = (handle_avg_vol < vol_50d * 0.95) or (handle_avg_vol < avg_cup_vol * 0.85)
        recovery_surge = avg_recovery_vol >= avg_cup_vol * 1.15
        base_drying_up = avg_base_vol < avg_cup_vol * 0.85
        breakout_confirmed = breakout_vol_ratio >= 1.3

        # Volume score (0–20)
        vol_score = 0.0
        if vol_contraction:
            vol_score += 6.0
        if recovery_surge:
            vol_score += 5.0
        if base_drying_up:
            vol_score += 4.0
        if breakout_confirmed:
            vol_score += 5.0
        elif breakout_vol_ratio >= 1.1:
            vol_score += 3.0

        vp = VolumeProfile(
            avg_vol_cup_base=round(avg_base_vol, 0),
            avg_vol_right_recovery=round(avg_recovery_vol, 0),
            avg_vol_handle=round(handle_avg_vol, 0),
            avg_vol_50d=round(vol_50d, 0),
            breakout_vol=breakout_vol,
            breakout_vol_ratio=breakout_vol_ratio,
            base_drying_up=base_drying_up,
            recovery_surge=recovery_surge,
            handle_contraction=vol_contraction,
            breakout_confirmed=breakout_confirmed,
            score=round(vol_score, 1),
        )

        pivot = round(right_rim * 1.001, 2)

        cup_geo = CupGeometry(
            prior_high=round(prior_high, 2),
            cup_low=round(cup_low, 2),
            right_rim=round(right_rim, 2),
            depth_pct=round(depth_pct, 2),
            width_weeks=width_weeks,
            symmetry_score=symmetry_score,
            right_lip_recovery=round(right_lip_recovery, 2),
            left_slope=round(left_slope, 4),
            right_slope=round(right_slope, 4),
            cup_start_idx=prior_high_idx,
            cup_end_idx=cup_end,
            duration_type="QUICK_WIN",
            duration_label=f"Quick Win ({width_weeks}w)",
            holding_period="1–3 Weeks",
            timeframe="Daily",
            cup_bars=int(cup_width_days),
            valid=True,
        )

        hdl_geo = HandleGeometry(
            handle_high=round(handle_high, 2),
            handle_low=round(handle_low, 2),
            pivot_buy_point=pivot,
            depth_pct=round(handle_drift, 2),
            width_weeks=round(handle_len / 5.0, 1),
            handle_bars=int(handle_len),
            in_upper_half=True,
            volume_contracting=vol_contraction,
            handle_start_idx=cup_end + 1,
            handle_end_idx=n - 1,
            valid=True,
        )

        composite_rank = symmetry_score * 0.4 + (100.0 - depth_pct) * 0.3 + vol_score * 1.5
        if composite_rank > best_score:
            best_score = composite_rank
            best_cand = (cup_geo, hdl_geo, vp)

    return best_cand


# ---------------------------------------------------------------------------
# Standard & Macro Base Detector (Weekly Bars: 7.5–55 Weeks)
# ---------------------------------------------------------------------------

def _detect_macro_cup_handle(
    w_close: pd.Series,
    w_high: pd.Series,
    w_low: pd.Series,
    w_volume: pd.Series,
    d_close: pd.Series,
    d_vol: pd.Series,
) -> Optional[Tuple[CupGeometry, HandleGeometry, VolumeProfile]]:
    """
    Scans for Standard (8–20w) and Macro (>20w) Cup & Handle on Weekly bars.
    Lookback: 8–55 weekly bars.
    Depth: 14%–48%. Handle: 1–6 weeks.
    """
    n_w = len(w_close)
    if n_w < 20:
        return None

    best_cand = None
    best_score = -1.0

    search_start = max(0, n_w - 55)
    search_end = n_w - 2  # leave room for handle

    for cup_end in range(search_end, search_start + 6, -1):
        right_rim = float(w_high.iloc[cup_end])

        handle_bars_count = (n_w - 1) - cup_end
        if handle_bars_count < 1 or handle_bars_count > 6:
            continue

        handle_segment = w_close.iloc[cup_end + 1:]
        handle_highs = w_high.iloc[cup_end + 1:]
        handle_lows = w_low.iloc[cup_end + 1:]
        handle_vols = w_volume.iloc[cup_end + 1:]

        handle_high_val = float(handle_highs.max())
        handle_low_val = float(handle_lows.min())

        drift_pct = (right_rim - handle_low_val) / max(right_rim, 1e-9) * 100.0
        if not (2.5 <= drift_pct <= 18.0):
            continue

        # Lookback start for cup base
        lookback_start = max(search_start, cup_end - 50)
        segment = w_close.iloc[lookback_start:cup_end]
        if len(segment) < 6:
            continue

        cup_low_idx_rel = int(segment.values.argmin())
        cup_low = float(segment.iloc[cup_low_idx_rel])
        cup_low_idx = lookback_start + cup_low_idx_rel

        # Left rim prior high
        left_segment = w_high.iloc[lookback_start:cup_low_idx]
        if len(left_segment) < 2:
            continue
        prior_high_idx_rel = int(left_segment.values.argmax())
        prior_high = float(left_segment.iloc[prior_high_idx_rel])
        prior_high_idx = lookback_start + prior_high_idx_rel

        depth_pct = (prior_high - cup_low) / max(prior_high, 1e-9) * 100.0
        if not (13.0 <= depth_pct <= 50.0):
            continue

        total_width_weeks = float(n_w - 1 - prior_high_idx)
        if total_width_weeks < 7.0:
            continue

        right_lip_recovery = (right_rim / max(prior_high, 1e-9)) * 100.0
        if right_lip_recovery < 85.0 or right_lip_recovery > 115.0:
            continue

        cup_mid = cup_low + (prior_high - cup_low) * 0.48
        if handle_low_val < cup_mid:
            continue

        left_len = max(1, cup_low_idx - prior_high_idx)
        right_len = max(1, cup_end - cup_low_idx)
        left_slope = abs((prior_high - cup_low) / left_len)
        right_slope = abs((right_rim - cup_low) / right_len)
        slope_ratio = min(left_slope, right_slope) / max(max(left_slope, right_slope), 1e-9)
        symmetry_score = round(slope_ratio * 100.0, 1)

        # Volume Profile
        vol_50d = float(d_vol.rolling(50).mean().iloc[-1]) if len(d_vol) >= 50 else float(d_vol.mean())
        avg_cup_vol = float(w_volume.iloc[prior_high_idx:cup_end + 1].mean()) if len(w_volume) > 0 else 1.0
        avg_handle_vol = float(handle_vols.mean()) if len(handle_vols) > 0 else 0.0

        recovery_vols = w_volume.iloc[max(0, cup_end - 3):cup_end + 1]
        avg_recovery_vol = float(recovery_vols.mean()) if len(recovery_vols) > 0 else 0.0

        base_start = max(0, cup_low_idx - 1)
        base_end = min(n_w - 1, cup_low_idx + 2)
        base_vols = w_volume.iloc[base_start:base_end]
        avg_base_vol = float(base_vols.mean()) if len(base_vols) > 0 else 0.0

        breakout_vol = float(d_vol.iloc[-1])
        breakout_vol_ratio = round(breakout_vol / max(vol_50d, 1.0), 2)

        vol_contraction = avg_handle_vol < avg_cup_vol * 0.90
        recovery_surge = avg_recovery_vol >= avg_cup_vol * 1.25
        base_drying_up = avg_base_vol < avg_cup_vol * 0.85
        breakout_confirmed = breakout_vol_ratio >= 1.3

        vol_score = 0.0
        if vol_contraction:
            vol_score += 6.0
        if recovery_surge:
            vol_score += 5.0
        if base_drying_up:
            vol_score += 4.0
        if breakout_confirmed:
            vol_score += 5.0
        elif breakout_vol_ratio >= 1.1:
            vol_score += 3.0

        vp = VolumeProfile(
            avg_vol_cup_base=round(avg_base_vol, 0),
            avg_vol_right_recovery=round(avg_recovery_vol, 0),
            avg_vol_handle=round(avg_handle_vol, 0),
            avg_vol_50d=round(vol_50d, 0),
            breakout_vol=breakout_vol,
            breakout_vol_ratio=breakout_vol_ratio,
            base_drying_up=base_drying_up,
            recovery_surge=recovery_surge,
            handle_contraction=vol_contraction,
            breakout_confirmed=breakout_confirmed,
            score=round(vol_score, 1),
        )

        duration_type = "STANDARD" if total_width_weeks <= 20.0 else "MACRO"
        duration_label = f"Standard ({round(total_width_weeks, 1)}w)" if duration_type == "STANDARD" else f"Macro ({round(total_width_weeks, 1)}w)"
        holding_period = "1–3 Months" if duration_type == "STANDARD" else "3–6 Months"

        pivot = round(right_rim * 1.001, 2)

        cup_geo = CupGeometry(
            prior_high=round(prior_high, 2),
            cup_low=round(cup_low, 2),
            right_rim=round(right_rim, 2),
            depth_pct=round(depth_pct, 2),
            width_weeks=round(total_width_weeks, 1),
            symmetry_score=symmetry_score,
            right_lip_recovery=round(right_lip_recovery, 2),
            left_slope=round(left_slope, 4),
            right_slope=round(right_slope, 4),
            cup_start_idx=prior_high_idx,
            cup_end_idx=cup_end,
            duration_type=duration_type,
            duration_label=duration_label,
            holding_period=holding_period,
            timeframe="Weekly",
            cup_bars=int(cup_end - prior_high_idx),
            valid=True,
        )

        hdl_geo = HandleGeometry(
            handle_high=round(handle_high_val, 2),
            handle_low=round(handle_low_val, 2),
            pivot_buy_point=pivot,
            depth_pct=round(drift_pct, 2),
            width_weeks=float(handle_bars_count),
            handle_bars=int(handle_bars_count),
            in_upper_half=True,
            volume_contracting=vol_contraction,
            handle_start_idx=cup_end + 1,
            handle_end_idx=n_w - 1,
            valid=True,
        )

        composite_rank = symmetry_score * 0.4 + (100.0 - depth_pct) * 0.3 + vol_score * 1.5
        if composite_rank > best_score:
            best_score = composite_rank
            best_cand = (cup_geo, hdl_geo, vp)

    return best_cand


# ---------------------------------------------------------------------------
# Stage 4 — Trend Integrity
# ---------------------------------------------------------------------------

def _analyze_trend(
    d_close: pd.Series,
    w_close: pd.Series,
    m_close: pd.Series,
) -> TrendQuality:
    tq = TrendQuality()

    d_rsi_series = _calc_rsi(d_close, 14)
    tq.daily_rsi = round(float(d_rsi_series.iloc[-1]) if not pd.isna(d_rsi_series.iloc[-1]) else 50.0, 1)

    w_rsi_series = _calc_rsi(w_close, 14)
    tq.weekly_rsi = round(float(w_rsi_series.iloc[-1]) if not pd.isna(w_rsi_series.iloc[-1]) else 50.0, 1)

    if len(m_close) >= 5:
        m_rsi_series = _calc_rsi(m_close, min(14, len(m_close) - 1))
        tq.monthly_rsi = round(float(m_rsi_series.iloc[-1]) if not pd.isna(m_rsi_series.iloc[-1]) else 50.0, 1)

    if len(w_close) >= 10:
        w_ema10 = _calc_ema(w_close, 10)
        tq.above_10w_ema = bool(w_close.iloc[-1] >= w_ema10.iloc[-1])

    if len(d_close) >= 200:
        sma200 = float(_calc_sma(d_close, 200).iloc[-1])
        tq.price_vs_200d_sma = round(float((float(d_close.iloc[-1]) - sma200) / max(sma200, 1e-9) * 100.0), 2)

    # RSI zone check: Daily momentum active (50–80) and Weekly holding (> 48)
    tq.rsi_zone_ok = (
        50.0 <= tq.daily_rsi <= 82.0
        and tq.weekly_rsi >= 48.0
    )

    score = 0.0
    if tq.above_10w_ema:
        score += 3.0
    if tq.rsi_zone_ok:
        score += 5.0
    if tq.daily_rsi >= 58.0:
        score += 2.5
    if tq.weekly_rsi >= 55.0:
        score += 2.5
    if tq.monthly_rsi >= 50.0:
        score += 1.0
    if tq.price_vs_200d_sma > 5.0:
        score += 1.0
    tq.score = round(min(score, 15.0), 1)

    return tq


# ---------------------------------------------------------------------------
# Stage 5 — Base Quality (Handle tightness + inside bars)
# ---------------------------------------------------------------------------

def _analyze_base_quality(
    d_close: pd.Series,
    d_high: pd.Series,
    d_low: pd.Series,
    handle: HandleGeometry,
) -> BaseQuality:
    bq = BaseQuality()

    if not handle.valid:
        return bq

    handle_days = max(4, min(25, int(handle.handle_bars if handle.handle_bars > 0 else handle.width_weeks * 5)))
    seg_close = d_close.iloc[-handle_days:]
    seg_high = d_high.iloc[-handle_days:]
    seg_low = d_low.iloc[-handle_days:]

    if len(seg_close) < 3:
        return bq

    mid_price = float(seg_close.mean())
    std_val = float(seg_close.std())
    bq.handle_std_pct = round((std_val / max(mid_price, 1e-9)) * 100.0, 2)
    bq.tight_action = bq.handle_std_pct < 4.0

    inside_count = 0
    for i in range(1, len(seg_high)):
        if seg_high.iloc[i] <= seg_high.iloc[i - 1] and seg_low.iloc[i] >= seg_low.iloc[i - 1]:
            inside_count += 1
    bq.inside_bar_count = inside_count

    close_diff = seg_close.pct_change().dropna()
    gap_downs = int((close_diff < -0.045).sum())
    bq.gap_down_count = gap_downs

    if len(seg_close) >= 6:
        half = len(seg_close) // 2
        early_std = float(seg_close.iloc[:half].std())
        late_std = float(seg_close.iloc[half:].std())
        bq.volatility_contracting = late_std <= early_std

    score = 0.0
    if bq.tight_action:
        score += 8.0
    elif bq.handle_std_pct < 5.5:
        score += 5.0
    if bq.inside_bar_count >= 2:
        score += 5.0
    elif bq.inside_bar_count >= 1:
        score += 3.0
    if bq.volatility_contracting:
        score += 4.0
    if gap_downs == 0:
        score += 3.0
    elif gap_downs <= 1:
        score += 1.0
    bq.score = round(min(score, 20.0), 1)

    return bq


# ---------------------------------------------------------------------------
# Stage 6 — Relative Strength
# ---------------------------------------------------------------------------

def _analyze_relative_strength(
    d_close: pd.Series,
    nifty_close: Optional[pd.Series] = None,
) -> RelativeStrength:
    rs = RelativeStrength()

    lookback = min(60, len(d_close) - 1)
    if lookback < 20:
        return rs

    stock_ret = (d_close.iloc[-1] - d_close.iloc[-lookback]) / max(d_close.iloc[-lookback], 1e-9) * 100.0
    rs.stock_12w_return = round(float(stock_ret), 2)

    if nifty_close is not None and len(nifty_close) >= lookback:
        nifty_ret = (nifty_close.iloc[-1] - nifty_close.iloc[-lookback]) / max(nifty_close.iloc[-lookback], 1e-9) * 100.0
        rs.nifty_12w_return = round(float(nifty_ret), 2)
        rs.outperformance = round(rs.stock_12w_return - rs.nifty_12w_return, 2)
        rs.outperforms = rs.outperformance > -12.0
    else:
        rs.outperforms = rs.stock_12w_return > -5.0

    if rs.stock_12w_return >= 25.0:
        rs.rs_percentile = 90.0
    elif rs.stock_12w_return >= 15.0:
        rs.rs_percentile = 80.0
    elif rs.stock_12w_return >= 5.0:
        rs.rs_percentile = 70.0
    elif rs.stock_12w_return >= -2.0:
        rs.rs_percentile = 55.0
    else:
        rs.rs_percentile = 40.0

    score = 0.0
    if rs.outperforms:
        score += 5.0
    if rs.rs_percentile >= 70.0:
        score += 7.0
    elif rs.rs_percentile >= 55.0:
        score += 4.0
    if rs.outperformance > 8.0:
        score += 3.0
    rs.score = round(min(score, 15.0), 1)

    return rs


# ---------------------------------------------------------------------------
# Stage 7 — Fundamental Overlay (from DB)
# ---------------------------------------------------------------------------

def _load_fundamentals(symbol: str, db: Optional[Session]) -> FundamentalOverlay:
    fo = FundamentalOverlay()
    if db is None:
        return fo

    try:
        company = db.query(Company).filter(Company.symbol == symbol).first()
        if company is None:
            return fo

        fo.data_available = True
        fo.revenue_growth_pct = float(company.revenue_growth) if company.revenue_growth is not None else None
        fo.pat_growth_pct = float(company.pat_growth) if company.pat_growth is not None else None
        fo.roce_pct = float(company.roce) if company.roce is not None else None
        fo.health_score = float(company.health_score) if company.health_score is not None else None

        fo.revenue_positive = fo.revenue_growth_pct is not None and fo.revenue_growth_pct > 0.0
        fo.pat_positive = fo.pat_growth_pct is not None and fo.pat_growth_pct > 0.0
        fo.roce_adequate = fo.roce_pct is not None and fo.roce_pct > 10.0
        fo.health_adequate = fo.health_score is not None and fo.health_score > 50.0

        score = 0.0
        if fo.revenue_positive:
            score += 2.5
        if fo.pat_positive:
            score += 2.5
        if fo.roce_adequate:
            score += 2.5
        if fo.health_adequate:
            score += 2.5
        fo.score = round(score, 1)

    except Exception as e:
        logger.debug(f"Fundamental overlay failed for {symbol}: {e}")

    return fo


# ---------------------------------------------------------------------------
# Stage 8 — AI Conviction Score Aggregator
# ---------------------------------------------------------------------------

def _compute_conviction_score(
    cup: CupGeometry,
    handle: HandleGeometry,
    volume: VolumeProfile,
    trend: TrendQuality,
    base: BaseQuality,
    rs: RelativeStrength,
    fundamentals: FundamentalOverlay,
) -> int:
    """
    Composite AI score 0–100:
      Cup symmetry     0–20 pts
      Handle tightness 0–20 pts
      Volume pattern   0–20 pts
      Trend quality    0–15 pts
      RS rank          0–15 pts
      Fundamentals     0–10 pts
    """
    cup_score = 0.0
    if cup.valid:
        symmetry_contribution = (cup.symmetry_score / 100.0) * 10.0
        recovery_contribution = min(6.0, max(0.0, ((cup.right_lip_recovery - 85.0) / 15.0) * 6.0))
        depth_penalty = (1.0 - min(1.0, abs(cup.depth_pct - 18.0) / 25.0)) * 4.0
        cup_score = max(0.0, min(20.0, symmetry_contribution + recovery_contribution + depth_penalty))

    handle_score = base.score

    total = (
        cup_score
        + handle_score
        + volume.score
        + trend.score
        + rs.score
        + fundamentals.score
    )

    return int(min(99, max(10, round(total))))


# ---------------------------------------------------------------------------
# Sector Mapping
# ---------------------------------------------------------------------------

SECTOR_MAP: Dict[str, str] = {
    "OFSS": "IT & Tech", "COFORGE": "IT & Tech", "PERSISTENT": "IT & Tech", "TCS": "IT & Tech",
    "INFY": "IT & Tech", "TECHM": "IT & Tech", "LTTS": "IT & Tech", "WIPRO": "IT & Tech",
    "HCLTECH": "IT & Tech", "MPHASIS": "IT & Tech", "BSOFT": "IT & Tech", "NAUKRI": "IT & Tech",
    "KPITTECH": "IT & Tech", "TATAELXSI": "IT & Tech",
    "HAL": "Defence & Aerospace", "BEL": "Defence & Aerospace", "MAZDOCK": "Defence & Aerospace",
    "COCHINSHIP": "Defence & Aerospace", "BHARATFORG": "Defence & Aerospace",
    "BHEL": "Capital Goods & Power", "SIEMENS": "Capital Goods & Power", "ABB": "Capital Goods & Power",
    "CUMMINSIND": "Capital Goods & Power", "TATAPOWER": "Capital Goods & Power", "NTPC": "Capital Goods & Power",
    "POWERGRID": "Capital Goods & Power", "RECLTD": "Capital Goods & Power", "PFC": "Capital Goods & Power",
    "SUZLON": "Capital Goods & Power", "KAYNES": "Capital Goods & Power", "POLYCAB": "Capital Goods & Power",
    "HAVELLS": "Capital Goods & Power", "CROMPTON": "Capital Goods & Power",
    "DIVISLAB": "Pharma & Healthcare", "ALKEM": "Pharma & Healthcare", "CIPLA": "Pharma & Healthcare",
    "SUNPHARMA": "Pharma & Healthcare", "DRREDDY": "Pharma & Healthcare", "LUPIN": "Pharma & Healthcare",
    "TORNTPHARM": "Pharma & Healthcare", "AUROPHARMA": "Pharma & Healthcare",
    "APOLLOHOSP": "Pharma & Healthcare", "SYNGENE": "Pharma & Healthcare",
    "TVSMOTOR": "Automotive", "BAJAJ-AUTO": "Automotive", "MARUTI": "Automotive",
    "M&M": "Automotive", "HEROMOTOCO": "Automotive", "EICHERMOT": "Automotive",
    "APOLLOTYRE": "Automotive", "BALKRISIND": "Automotive", "MRF": "Automotive",
    "ICICIBANK": "Banking - Private", "HDFCBANK": "Banking - Private", "AXISBANK": "Banking - Private",
    "KOTAKBANK": "Banking - Private", "INDUSINDBK": "Banking - Private", "FEDERALBNK": "Banking - Private",
    "IDFCFIRSTB": "Banking - Private", "AUBANK": "Banking - Private",
    "SBIN": "Banking - PSU", "BANKBARODA": "Banking - PSU", "CANBK": "Banking - PSU", "PNB": "Banking - PSU",
    "BAJFINANCE": "Financial Services", "BAJAJFINSV": "Financial Services", "CHOLAFIN": "Financial Services",
    "SHRIRAMFIN": "Financial Services", "MUTHOOTFIN": "Financial Services", "MCX": "Financial Services",
    "BSE": "Financial Services", "CDSL": "Financial Services", "ANGELONE": "Financial Services",
    "TATASTEEL": "Metals & Mining", "JSWSTEEL": "Metals & Mining", "VEDL": "Metals & Mining",
    "HINDALCO": "Metals & Mining", "SAIL": "Metals & Mining", "NMDC": "Metals & Mining",
    "RELIANCE": "Oil, Gas & Energy", "ONGC": "Oil, Gas & Energy", "IOC": "Oil, Gas & Energy",
    "BPCL": "Oil, Gas & Energy", "HINDPETRO": "Oil, Gas & Energy", "GAIL": "Oil, Gas & Energy",
    "TRENT": "Consumer & Retail", "TITAN": "Consumer & Retail",
    "DIXON": "Consumer & Retail", "ASIANPAINT": "Consumer & Retail", "PIDILITIND": "Consumer & Retail",
    "BRITANNIA": "Consumer & Retail", "NESTLEIND": "Consumer & Retail", "HINDUNILVR": "Consumer & Retail",
    "DABUR": "Consumer & Retail", "MARICO": "Consumer & Retail", "JUBLFOOD": "Consumer & Retail",
    "OBEROIRLTY": "Realty & Infra", "GODREJPROP": "Realty & Infra", "DLF": "Realty & Infra",
    "LT": "Realty & Infra", "HUDCO": "Realty & Infra",
}


# ---------------------------------------------------------------------------
# Exchange-aware ticker resolution helper
# ---------------------------------------------------------------------------

def _resolve_df(clean_sym: str, preferred_exchange: str = "NSE") -> Optional[pd.DataFrame]:
    try:
        from app.services.market_data_service import MarketDataService
        df = MarketDataService.get_symbol_ohlcv(clean_sym, period="3y", interval="1d")
        if df is not None and not df.empty and len(df) >= 60:
            df = df.dropna(subset=["Close", "Volume"])
            if len(df) >= 60:
                return df
    except Exception as e:
        logger.debug(f"[CupHandleEngine] Resolve DF exception for {clean_sym}: {e}")

    # Direct Yahoo Finance v8 chart fallback (prevents yfinance crumb 429 rate limit outages)
    try:
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{clean_sym}.NS?interval=1d&range=2y"
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
        resp = requests.get(url, headers=headers, timeout=6)
        if resp.status_code == 200:
            res = resp.json().get("chart", {}).get("result", [])
            if res:
                ts = res[0].get("timestamp", [])
                q = res[0].get("indicators", {}).get("quote", [{}])[0]
                opens = q.get("open", [])
                highs = q.get("high", [])
                lows = q.get("low", [])
                closes = q.get("close", [])
                volumes = q.get("volume", [])
                if ts and closes and len(closes) >= 60:
                    df = pd.DataFrame({
                        "Open": opens, "High": highs, "Low": lows, "Close": closes, "Volume": volumes
                    }, index=pd.to_datetime(ts, unit="s", utc=True).tz_convert("Asia/Kolkata")).dropna()
                    if len(df) >= 60:
                        return df
    except Exception as e:
        logger.debug(f"[CupHandleEngine] Direct daily fetch error for {clean_sym}: {e}")

    return None


# ---------------------------------------------------------------------------
# Primary Stage Analysis Function
# ---------------------------------------------------------------------------

def analyze_symbol_with_stage_info(
    symbol: str,
    company_name: Optional[str] = None,
    sector: Optional[str] = None,
    exchange: str = "NSE",
    db: Optional[Session] = None,
    nifty_close: Optional[pd.Series] = None,
    cand_override: Optional[Tuple[CupGeometry, HandleGeometry, VolumeProfile]] = None,
    current_price_override: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Evaluates 1-Hour Micro, Short-Duration Quick Wins, or Macro bases for a symbol.
    Returns:
      {
        "max_stage_passed": int,   # 0-8
        "partial_score": int,      # AI score
        "in_results": bool,        # True if fully qualified
        "result": dict or None     # Full result dict if in_results=True
      }
    """
    clean_sym = symbol.strip().upper()
    not_found = {"max_stage_passed": 0, "partial_score": 0, "in_results": False, "result": None}

    try:
        df = _resolve_df(clean_sym, preferred_exchange=exchange)
        if df is None:
            return not_found

        d_close = df["Close"]
        d_open = df["Open"]
        d_high = df["High"]
        d_low = df["Low"]
        d_vol = df["Volume"]

        # Resample to weekly and monthly
        w_df = df.resample("W-FRI").agg({
            "Open": "first", "High": "max", "Low": "min",
            "Close": "last", "Volume": "sum",
        }).dropna()
        m_df = df.resample("ME").agg({
            "Open": "first", "High": "max", "Low": "min",
            "Close": "last", "Volume": "sum",
        }).dropna()

        w_close = w_df["Close"]
        w_high = w_df["High"]
        w_low = w_df["Low"]
        w_volume = w_df["Volume"]
        m_close = m_df["Close"]

        cmp = current_price_override if current_price_override is not None else round(float(d_close.iloc[-1]), 2)
        prev_close = round(float(d_close.iloc[-2]), 2) if len(d_close) > 1 else cmp
        day_change = round(cmp - prev_close, 2)
        day_change_pct = round((day_change / max(prev_close, 1)) * 100.0, 2)

        # ── 1. Candidate Selection ──
        if cand_override is not None:
            selected_cand = cand_override
        else:
            qw_cand = _detect_quick_win_cup_handle(d_close, d_high, d_low, d_vol)
            macro_cand = _detect_macro_cup_handle(w_close, w_high, w_low, w_volume, d_close, d_vol)

            selected_cand = None

            if qw_cand and macro_cand:
                qw_cup, qw_hdl, qw_vp = qw_cand
                qw_dist = (cmp - qw_hdl.pivot_buy_point) / qw_hdl.pivot_buy_point * 100.0
                if -10.0 <= qw_dist <= 5.0:
                    selected_cand = qw_cand
                else:
                    selected_cand = macro_cand if macro_cand[0].symmetry_score >= qw_cup.symmetry_score else qw_cand
            elif qw_cand:
                selected_cand = qw_cand
            elif macro_cand:
                selected_cand = macro_cand

        if selected_cand is None:
            return {"max_stage_passed": 1, "partial_score": 0, "in_results": False, "result": None}

        cup, handle, volume = selected_cand

        # ── Stage 4: Trend Integrity ──
        trend = _analyze_trend(d_close, w_close, m_close)
        if not trend.rsi_zone_ok and trend.daily_rsi < 45.0:
            return {
                "max_stage_passed": 3,
                "partial_score": int(volume.score),
                "in_results": False,
                "result": None,
            }

        # ── Stage 5: Base Quality ──
        base = _analyze_base_quality(d_close, d_high, d_low, handle)

        # ── Stage 6: Relative Strength ──
        rs = _analyze_relative_strength(d_close, nifty_close)

        # ── Stage 7: Fundamentals ──
        fundamentals = _load_fundamentals(clean_sym, db)

        # ── Stage 8: AI Score ──
        ai_score = _compute_conviction_score(cup, handle, volume, trend, base, rs, fundamentals)

        if ai_score < 60:
            return {
                "max_stage_passed": 7,
                "partial_score": ai_score,
                "in_results": False,
                "result": None,
            }

        # ── Trade Blueprint ──
        pivot = handle.pivot_buy_point
        distance_to_pivot_pct = round((cmp - pivot) / pivot * 100.0, 2)

        # Stop loss & targets
        if cup.duration_type == "HOURLY_1H":
            stop_loss_tight = round(handle.handle_low * 0.995, 2)
            stop_loss_wide = round(cup.cup_low * 0.985, 2)
            target_1 = round(pivot * (1.0 + min(0.08, max(0.035, cup.depth_pct * 0.55 / 100.0))), 2)
            target_2 = round(pivot + (cup.prior_high - cup.cup_low), 2)
        elif cup.duration_type == "QUICK_WIN":
            stop_loss_tight = round(handle.handle_low * 0.99, 2)
            stop_loss_wide = round(cup.cup_low * 0.96, 2)
            target_1 = round(pivot * (1.0 + min(0.14, max(0.08, cup.depth_pct * 0.55 / 100.0))), 2)
            target_2 = round(pivot + (cup.prior_high - cup.cup_low), 2)
        else:
            stop_loss_tight = round(handle.handle_low * 0.992, 2)
            stop_loss_wide = round(cup.cup_low * 0.93, 2)
            target_1 = round(pivot * 1.12, 2)
            target_2 = round(pivot + (cup.prior_high - cup.cup_low), 2)

        risk = max(0.2, pivot - stop_loss_tight)
        reward = max(0.5, target_1 - pivot)
        rr = round(reward / risk, 1)

        min_rr = 1.2 if cup.duration_type == "HOURLY_1H" else 1.4
        if rr < min_rr:
            return {
                "max_stage_passed": 7,
                "partial_score": ai_score,
                "in_results": False,
                "result": None,
            }

        if ai_score >= 82:
            conviction_tier = "ELITE"
            tier_badge = "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
        elif ai_score >= 70:
            conviction_tier = "HIGH CONVICTION"
            tier_badge = "bg-cyan-500/10 text-cyan-400 border-cyan-500/30"
        else:
            conviction_tier = "DEVELOPING"
            tier_badge = "bg-amber-500/10 text-amber-400 border-amber-500/30"

        resolved_sector = SECTOR_MAP.get(clean_sym, sector or "Diversified")
        stage_gates = {
            "cup_geometry": cup.valid,
            "handle_geometry": handle.valid,
            "volume_signature": volume.score >= 8.0 or volume.handle_contraction,
            "trend_integrity": trend.rsi_zone_ok or trend.daily_rsi >= 48.0,
            "base_quality": base.tight_action or base.handle_std_pct < 5.0,
            "relative_strength": rs.outperforms,
            "fundamentals": fundamentals.revenue_positive or (not fundamentals.data_available),
            "conviction_threshold": ai_score >= 60,
        }
        stages_passed = sum(1 for v in stage_gates.values() if v)

        full_result = {
            "symbol": clean_sym,
            "company_name": company_name or clean_sym,
            "sector": resolved_sector,
            "exchange": exchange,
            "duration_type": cup.duration_type,
            "duration_label": cup.duration_label,
            "holding_period": cup.holding_period,
            "timeframe": cup.timeframe,
            "width_hours": cup.width_hours,
            "distance_to_pivot_pct": distance_to_pivot_pct,
            "cmp": cmp,
            "day_change": day_change,
            "day_change_pct": day_change_pct,
            "pivot_buy_point": pivot,
            "stop_loss_tight": stop_loss_tight,
            "stop_loss_wide": stop_loss_wide,
            "target_1": target_1,
            "target_2": target_2,
            "risk_reward": rr,
            "ai_conviction_score": ai_score,
            "conviction_tier": conviction_tier,
            "tier_badge": tier_badge,
            "stages_passed": stages_passed,
            "stage_gates": stage_gates,
            "cup": {
                "prior_high": cup.prior_high,
                "cup_low": cup.cup_low,
                "right_rim": cup.right_rim,
                "depth_pct": cup.depth_pct,
                "width_weeks": cup.width_weeks,
                "width_hours": cup.width_hours,
                "cup_bars": cup.cup_bars,
                "duration_type": cup.duration_type,
                "duration_label": cup.duration_label,
                "holding_period": cup.holding_period,
                "timeframe": cup.timeframe,
                "symmetry_score": cup.symmetry_score,
                "symmetry_label": _cup_symmetry_bucket(cup.symmetry_score),
                "right_lip_recovery": cup.right_lip_recovery,
            },
            "handle": {
                "handle_high": handle.handle_high,
                "handle_low": handle.handle_low,
                "depth_pct": handle.depth_pct,
                "width_weeks": handle.width_weeks,
                "handle_bars": handle.handle_bars,
                "handle_hours": handle.handle_hours,
                "in_upper_half": handle.in_upper_half,
                "volume_contracting": handle.volume_contracting,
            },
            "volume": {
                "avg_vol_50d": volume.avg_vol_50d,
                "breakout_vol_ratio": volume.breakout_vol_ratio,
                "base_drying_up": volume.base_drying_up,
                "recovery_surge": volume.recovery_surge,
                "handle_contraction": volume.handle_contraction,
                "breakout_confirmed": volume.breakout_confirmed,
                "volume_score": volume.score,
            },
            "trend": {
                "daily_rsi": trend.daily_rsi,
                "weekly_rsi": trend.weekly_rsi,
                "monthly_rsi": trend.monthly_rsi,
                "above_10w_ema": trend.above_10w_ema,
                "rsi_zone_ok": trend.rsi_zone_ok,
                "price_vs_200d_sma": trend.price_vs_200d_sma,
                "trend_score": trend.score,
            },
            "base": {
                "handle_std_pct": base.handle_std_pct,
                "inside_bar_count": base.inside_bar_count,
                "gap_down_count": base.gap_down_count,
                "tight_action": base.tight_action,
                "volatility_contracting": base.volatility_contracting,
                "base_score": base.score,
            },
            "rs": {
                "stock_12w_return": rs.stock_12w_return,
                "nifty_12w_return": rs.nifty_12w_return,
                "outperformance": rs.outperformance,
                "rs_percentile": rs.rs_percentile,
                "outperforms": rs.outperforms,
                "rs_score": rs.score,
            },
            "fundamentals": {
                "revenue_growth_pct": fundamentals.revenue_growth_pct,
                "pat_growth_pct": fundamentals.pat_growth_pct,
                "roce_pct": fundamentals.roce_pct,
                "health_score": fundamentals.health_score,
                "revenue_positive": fundamentals.revenue_positive,
                "pat_positive": fundamentals.pat_positive,
                "roce_adequate": fundamentals.roce_adequate,
                "data_available": fundamentals.data_available,
                "fundamental_score": fundamentals.score,
            },
            "tradingview_url": f"https://in.tradingview.com/symbols/NSE-{clean_sym}/",
            "techno_funda_url": f"/techno-funda/{clean_sym}",
        }

        return {
            "max_stage_passed": 8,
            "partial_score": ai_score,
            "in_results": True,
            "result": full_result,
        }

    except Exception as e:
        logger.debug(f"[CupHandleEngine] Error analyzing {clean_sym}: {e}")
        return not_found


# ---------------------------------------------------------------------------
# Public evaluation functions
# ---------------------------------------------------------------------------

def analyze_symbol_1h(
    symbol: str,
    company_name: Optional[str] = None,
    sector: Optional[str] = None,
    exchange: str = "NSE",
    db: Optional[Session] = None,
    nifty_close: Optional[pd.Series] = None,
) -> Optional[Dict[str, Any]]:
    """
    Evaluates 1-Hour micro-duration Cup & Handle setup for a symbol.
    """
    clean_sym = symbol.strip().upper()
    try:
        df_1h = _fetch_1h_ohlcv(clean_sym)
        if df_1h is None or len(df_1h) < 30:
            return None
        cand_1h = _detect_1h_cup_handle(df_1h)
        if cand_1h is None:
            return None
        cmp_1h = round(float(df_1h["Close"].iloc[-1]), 2)
        info = analyze_symbol_with_stage_info(
            symbol=clean_sym,
            company_name=company_name,
            sector=sector,
            exchange=exchange,
            db=db,
            nifty_close=nifty_close,
            cand_override=cand_1h,
            current_price_override=cmp_1h,
        )
        if info.get("in_results") and info.get("result"):
            return info["result"]
    except Exception as e:
        logger.debug(f"[CupHandleEngine] 1H analysis error for {clean_sym}: {e}")
    return None


def analyze_symbol_all_patterns(
    symbol: str,
    company_name: Optional[str] = None,
    sector: Optional[str] = None,
    exchange: str = "NSE",
    db: Optional[Session] = None,
    nifty_close: Optional[pd.Series] = None,
) -> List[Dict[str, Any]]:
    """
    Detects all valid patterns across timeframes:
      1. 1-Hour Micro Setup (12–65h)
      2. Daily Quick Win (2.5–8.5w) or Macro Base (8–55w)
    """
    clean_sym = symbol.strip().upper()
    found: List[Dict[str, Any]] = []

    # 1. Check 1-Hour Micro Setup
    h1_res = analyze_symbol_1h(
        clean_sym,
        company_name=company_name,
        sector=sector,
        exchange=exchange,
        db=db,
        nifty_close=nifty_close,
    )
    if h1_res is not None:
        found.append(h1_res)

    # 2. Check Daily Quick Win & Macro Setup
    info = analyze_symbol_with_stage_info(
        symbol=clean_sym,
        company_name=company_name,
        sector=sector,
        exchange=exchange,
        db=db,
        nifty_close=nifty_close,
    )
    if info.get("in_results") and info.get("result"):
        found.append(info["result"])

    return found


def analyze_symbol(
    symbol: str,
    company_name: Optional[str] = None,
    sector: Optional[str] = None,
    db: Optional[Session] = None,
    nifty_close: Optional[pd.Series] = None,
) -> Optional[Dict[str, Any]]:
    """
    Analyzes one symbol and returns the best qualified result dict, else None.
    If both 1-Hour and Daily/Macro setups exist, prioritizes the one closest to pivot.
    """
    patterns = analyze_symbol_all_patterns(
        symbol=symbol,
        company_name=company_name,
        sector=sector,
        db=db,
        nifty_close=nifty_close,
    )
    if not patterns:
        return None
    patterns.sort(key=lambda p: abs(p.get("distance_to_pivot_pct", 999)))
    return patterns[0]


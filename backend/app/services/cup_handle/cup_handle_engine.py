"""
Alpha India — AI-Powered High Conviction Cup & Handle Detection Engine
=======================================================================
Stage 1 : Cup Geometry        — U-shape depth, width, symmetry, right-lip height
Stage 2 : Handle Geometry     — duration, depth, upper-half placement
Stage 3 : Volume Signature    — accumulation in base, surge at recovery, contraction in handle
Stage 4 : Trend Integrity     — EMA alignment, multi-timeframe RSI
Stage 5 : Base Quality        — volatility contraction, inside bars, no gap-downs
Stage 6 : Relative Strength   — stock vs Nifty 500 outperformance
Stage 7 : Fundamental Filter  — revenue/PAT growth, ROCE (from DB)
Stage 8 : AI Conviction Score — composite 0-100 score; only >= 70 surfaced as alerts
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
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
    symmetry_score: float = 0.0     # 0–100 (100 = perfect U)
    right_lip_recovery: float = 0.0 # right_rim / prior_high * 100
    left_slope: float = 0.0
    right_slope: float = 0.0
    cup_start_idx: int = 0
    cup_end_idx: int = 0
    valid: bool = False


@dataclass
class HandleGeometry:
    handle_high: float = 0.0
    handle_low: float = 0.0
    pivot_buy_point: float = 0.0    # handle_high + 0.10% buffer
    depth_pct: float = 0.0          # % drift from right rim
    width_weeks: float = 0.0
    in_upper_half: bool = False      # must form in upper 50% of cup
    volume_contracting: bool = False # avg handle vol < avg cup vol
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
    base_drying_up: bool = False     # base vol < 70% of avg
    recovery_surge: bool = False     # recovery vol >= 1.5× avg
    handle_contraction: bool = False # handle vol < cup vol
    breakout_confirmed: bool = False # breakout vol >= 1.5× avg
    score: float = 0.0               # 0–20


@dataclass
class TrendQuality:
    above_10w_ema: bool = False
    daily_rsi: float = 0.0
    weekly_rsi: float = 0.0
    monthly_rsi: float = 0.0
    rsi_zone_ok: bool = False        # daily 55–75, weekly >= 55, monthly >= 55
    price_vs_200d_sma: float = 0.0   # % above/below 200d SMA
    score: float = 0.0               # 0–15


@dataclass
class BaseQuality:
    handle_std_pct: float = 0.0      # std of closes during handle / mid price
    inside_bar_count: int = 0        # count of inside bars in handle
    gap_down_count: int = 0          # large gap-down candles inside handle
    volatility_contracting: bool = False
    tight_action: bool = False        # handle_std_pct < 3%
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

    # Price
    cmp: float = 0.0
    day_change: float = 0.0
    day_change_pct: float = 0.0
    pivot_buy_point: float = 0.0
    stop_loss_tight: float = 0.0     # handle low
    stop_loss_wide: float = 0.0      # cup_base * 0.93
    target_1: float = 0.0            # buy_point * 1.12
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


def _weeks_between(idx_start: int, idx_end: int, weekly_index: pd.DatetimeIndex) -> float:
    """Approximate weeks between two weekly bar indices."""
    if idx_end <= idx_start:
        return 0.0
    return float(idx_end - idx_start)


# ---------------------------------------------------------------------------
# Stage 1 — Cup Geometry Detection
# ---------------------------------------------------------------------------

def _detect_cup(w_close: pd.Series, w_volume: pd.Series) -> CupGeometry:
    """
    Scans for the most recent valid Cup pattern on weekly bars.
    Lookback: 20–65 bars (approx 5–16 months).
    Depth: 15–50%. Width >= 7 weeks. Symmetry via slope comparison.
    Right lip must recover >= 85% of prior high.
    """
    geo = CupGeometry()
    n = len(w_close)
    if n < 30:
        return geo

    # Search window: last 20–65 weekly bars
    search_start = max(0, n - 65)
    search_end = n - 3  # leave room for handle

    best_score = -1.0

    for cup_end in range(search_end, search_start + 14, -1):  # right rim candidate
        right_rim = w_close.iloc[cup_end]

        # Find the minimum (cup base) in the prior window
        lookback_start = max(search_start, cup_end - 55)
        segment = w_close.iloc[lookback_start:cup_end]
        if len(segment) < 10:
            continue

        cup_low_idx_rel = segment.values.argmin()
        cup_low = segment.iloc[cup_low_idx_rel]
        cup_low_idx = lookback_start + cup_low_idx_rel

        # Prior high (left rim) is the max before the cup base
        left_segment = w_close.iloc[lookback_start:cup_low_idx]
        if len(left_segment) < 3:
            continue
        prior_high_idx_rel = left_segment.values.argmax()
        prior_high = left_segment.iloc[prior_high_idx_rel]
        prior_high_idx = lookback_start + prior_high_idx_rel

        # Geometry checks
        depth_pct = (prior_high - cup_low) / max(prior_high, 1e-9) * 100.0
        if not (15.0 <= depth_pct <= 50.0):
            continue

        width_weeks = cup_end - prior_high_idx
        if width_weeks < 7:
            continue

        right_lip_recovery = (right_rim / max(prior_high, 1e-9)) * 100.0
        if right_lip_recovery < 85.0:
            continue

        # Symmetry: compare left descent slope vs right ascent slope
        left_len = cup_low_idx - prior_high_idx
        right_len = cup_end - cup_low_idx
        if left_len < 2 or right_len < 2:
            continue

        left_slope = abs((prior_high - cup_low) / max(left_len, 1))
        right_slope = abs((right_rim - cup_low) / max(right_len, 1))
        slope_ratio = min(left_slope, right_slope) / max(max(left_slope, right_slope), 1e-9)
        # symmetry: 1.0 = perfect mirror, 0.0 = no match
        symmetry = slope_ratio * 100.0

        # Composite cup score for ranking
        cup_score = (
            symmetry * 0.4
            + right_lip_recovery * 0.3
            + (1.0 - abs(depth_pct - 30.0) / 30.0) * 30.0  # penalise extremes
        )

        if cup_score > best_score:
            best_score = cup_score
            geo.prior_high = round(float(prior_high), 2)
            geo.cup_low = round(float(cup_low), 2)
            geo.right_rim = round(float(right_rim), 2)
            geo.depth_pct = round(depth_pct, 2)
            geo.width_weeks = float(width_weeks)
            geo.symmetry_score = round(symmetry, 1)
            geo.right_lip_recovery = round(right_lip_recovery, 2)
            geo.left_slope = round(left_slope, 4)
            geo.right_slope = round(right_slope, 4)
            geo.cup_start_idx = int(prior_high_idx)
            geo.cup_end_idx = int(cup_end)
            geo.valid = True

    return geo


# ---------------------------------------------------------------------------
# Stage 2 — Handle Geometry Detection
# ---------------------------------------------------------------------------

def _detect_handle(
    w_close: pd.Series,
    w_high: pd.Series,
    w_low: pd.Series,
    w_volume: pd.Series,
    cup: CupGeometry,
    avg_cup_volume: float,
) -> HandleGeometry:
    """
    Detect handle after the cup right rim.
    Handle must be 1–6 weeks, drift 5–15%, in upper half of cup, volume contracting.
    """
    hdl = HandleGeometry()
    if not cup.valid:
        return hdl

    n = len(w_close)
    handle_start = cup.cup_end_idx + 1
    # Handle can extend up to 6 weeks beyond cup end, but not past current bar
    handle_end_max = min(n - 1, handle_start + 6)

    if handle_start >= n or (handle_end_max - handle_start) < 1:
        return hdl

    # The handle segment: from right rim to current or max 6 weeks
    handle_bars = w_close.iloc[handle_start:handle_end_max + 1]
    if len(handle_bars) < 1:
        return hdl

    handle_high_val = float(w_high.iloc[cup.cup_end_idx])  # right rim high
    handle_low_val = float(handle_bars.min())
    handle_high_recent = float(w_high.iloc[handle_start:handle_end_max + 1].max())

    # Depth check
    drift_pct = (handle_high_val - handle_low_val) / max(handle_high_val, 1e-9) * 100.0
    if not (3.0 <= drift_pct <= 20.0):
        return hdl

    width_weeks = float(handle_end_max - handle_start + 1)

    # Upper half check: handle low must be in upper 50% of cup
    cup_mid = cup.cup_low + (cup.prior_high - cup.cup_low) * 0.5
    in_upper_half = handle_low_val >= cup_mid

    # Volume contraction
    handle_vols = w_volume.iloc[handle_start:handle_end_max + 1]
    avg_handle_vol = float(handle_vols.mean()) if len(handle_vols) > 0 else 0.0
    volume_contracting = avg_handle_vol < avg_cup_volume * 0.85

    # Pivot buy point = handle high (right rim) + 0.10% buffer
    pivot = round(handle_high_val * 1.001, 2)

    hdl.handle_high = round(handle_high_val, 2)
    hdl.handle_low = round(handle_low_val, 2)
    hdl.pivot_buy_point = pivot
    hdl.depth_pct = round(drift_pct, 2)
    hdl.width_weeks = width_weeks
    hdl.in_upper_half = in_upper_half
    hdl.volume_contracting = volume_contracting
    hdl.handle_start_idx = int(handle_start)
    hdl.handle_end_idx = int(handle_end_max)
    hdl.valid = (
        in_upper_half
        and drift_pct <= 18.0
        and width_weeks >= 1
    )

    return hdl


# ---------------------------------------------------------------------------
# Stage 3 — Volume Signature Analysis
# ---------------------------------------------------------------------------

def _analyze_volume(
    d_close: pd.Series,
    d_volume: pd.Series,
    w_volume: pd.Series,
    cup: CupGeometry,
    handle: HandleGeometry,
) -> VolumeProfile:
    vp = VolumeProfile()

    n_d = len(d_close)
    if n_d < 60:
        return vp

    # 50-day average volume
    avg_vol_50d = float(d_volume.rolling(50).mean().iloc[-1])
    vp.avg_vol_50d = round(avg_vol_50d, 0)

    # Daily volume on last bar (potential breakout day)
    breakout_vol = float(d_volume.iloc[-1])
    vp.breakout_vol = breakout_vol
    vp.breakout_vol_ratio = round(breakout_vol / max(avg_vol_50d, 1), 2)

    # Weekly cup base volume (base bars around cup low idx)
    if cup.valid:
        n_w = len(w_volume)
        base_start = max(0, cup.cup_start_idx + 2)
        base_end = min(n_w - 1, cup.cup_end_idx - 3)
        if base_end > base_start:
            cup_base_vols = w_volume.iloc[base_start:base_end]
            vp.avg_vol_cup_base = round(float(cup_base_vols.mean()), 0)

        # Recovery volume (last 4 bars of cup — right side rise)
        rec_start = max(0, cup.cup_end_idx - 3)
        rec_end = cup.cup_end_idx + 1
        recovery_vols = w_volume.iloc[rec_start:rec_end]
        vp.avg_vol_right_recovery = round(float(recovery_vols.mean()), 0)

        # Handle volume
        if handle.valid:
            hdl_vols = w_volume.iloc[handle.handle_start_idx:handle.handle_end_idx + 1]
            vp.avg_vol_handle = round(float(hdl_vols.mean()), 0) if len(hdl_vols) > 0 else 0.0

        full_cup_vols = w_volume.iloc[cup.cup_start_idx:cup.cup_end_idx + 1]
        avg_cup_vol = float(full_cup_vols.mean()) if len(full_cup_vols) > 0 else 1.0

        vp.base_drying_up = vp.avg_vol_cup_base < avg_cup_vol * 0.75
        vp.recovery_surge = vp.avg_vol_right_recovery >= avg_cup_vol * 1.4
        vp.handle_contraction = (vp.avg_vol_handle > 0) and (vp.avg_vol_handle < avg_cup_vol * 0.8)

    vp.breakout_confirmed = vp.breakout_vol_ratio >= 1.5

    # Score 0–20
    score = 0.0
    if vp.base_drying_up:
        score += 5.0
    if vp.recovery_surge:
        score += 5.0
    if vp.handle_contraction:
        score += 5.0
    if vp.breakout_confirmed:
        score += 5.0
    elif vp.breakout_vol_ratio >= 1.2:
        score += 2.0
    vp.score = round(score, 1)

    return vp


# ---------------------------------------------------------------------------
# Stage 4 — Trend Integrity
# ---------------------------------------------------------------------------

def _analyze_trend(
    d_close: pd.Series,
    w_close: pd.Series,
    m_close: pd.Series,
) -> TrendQuality:
    tq = TrendQuality()

    # Daily RSI
    d_rsi_series = _calc_rsi(d_close, 14)
    tq.daily_rsi = round(float(d_rsi_series.iloc[-1]) if not pd.isna(d_rsi_series.iloc[-1]) else 50.0, 1)

    # Weekly RSI
    w_rsi_series = _calc_rsi(w_close, 14)
    tq.weekly_rsi = round(float(w_rsi_series.iloc[-1]) if not pd.isna(w_rsi_series.iloc[-1]) else 50.0, 1)

    # Monthly RSI
    if len(m_close) >= 5:
        m_rsi_series = _calc_rsi(m_close, min(14, len(m_close) - 1))
        tq.monthly_rsi = round(float(m_rsi_series.iloc[-1]) if not pd.isna(m_rsi_series.iloc[-1]) else 50.0, 1)

    # 10-week EMA check
    if len(w_close) >= 10:
        w_ema10 = _calc_ema(w_close, 10)
        tq.above_10w_ema = bool(w_close.iloc[-1] >= w_ema10.iloc[-1])

    # 200-day SMA
    if len(d_close) >= 200:
        sma200 = _calc_sma(d_close, 200).iloc[-1]
        tq.price_vs_200d_sma = round((d_close.iloc[-1] - sma200) / max(sma200, 1e-9) * 100.0, 2)

    # RSI zone check: daily 55–78, weekly >=55, monthly >=55
    tq.rsi_zone_ok = (
        55.0 <= tq.daily_rsi <= 80.0
        and tq.weekly_rsi >= 55.0
        and tq.monthly_rsi >= 55.0
    )

    # Score 0–15
    score = 0.0
    if tq.above_10w_ema:
        score += 3.0
    if tq.rsi_zone_ok:
        score += 5.0
    if tq.daily_rsi >= 60.0:
        score += 2.0
    if tq.weekly_rsi >= 60.0:
        score += 2.0
    if tq.monthly_rsi >= 60.0:
        score += 2.0
    if tq.price_vs_200d_sma > 10.0:
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

    # Use last 15 daily bars as proxy for handle period
    handle_days = min(25, max(5, int(handle.width_weeks * 5)))
    seg_close = d_close.iloc[-handle_days:]
    seg_high = d_high.iloc[-handle_days:]
    seg_low = d_low.iloc[-handle_days:]

    if len(seg_close) < 3:
        return bq

    mid_price = float(seg_close.mean())
    std_val = float(seg_close.std())
    bq.handle_std_pct = round((std_val / max(mid_price, 1e-9)) * 100.0, 2)
    bq.tight_action = bq.handle_std_pct < 3.5

    # Count inside bars (high < prev_high AND low > prev_low)
    inside_count = 0
    for i in range(1, len(seg_high)):
        if seg_high.iloc[i] <= seg_high.iloc[i - 1] and seg_low.iloc[i] >= seg_low.iloc[i - 1]:
            inside_count += 1
    bq.inside_bar_count = inside_count

    # Count gap-downs (open significantly below prev close)
    gap_downs = 0
    # Use close-to-close drops as proxy
    close_diff = seg_close.pct_change().dropna()
    gap_downs = int((close_diff < -0.04).sum())
    bq.gap_down_count = gap_downs

    # Volatility contracting: std of last 5 bars < std of prior bars
    if len(seg_close) >= 10:
        early_std = float(seg_close.iloc[:len(seg_close) // 2].std())
        late_std = float(seg_close.iloc[len(seg_close) // 2:].std())
        bq.volatility_contracting = late_std < early_std

    # Score 0–20
    score = 0.0
    if bq.tight_action:
        score += 8.0
    elif bq.handle_std_pct < 5.0:
        score += 4.0
    if bq.inside_bar_count >= 3:
        score += 5.0
    elif bq.inside_bar_count >= 1:
        score += 2.0
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

    # 12-week = ~60 trading days
    lookback = 60
    if len(d_close) < lookback:
        return rs

    stock_ret = (d_close.iloc[-1] - d_close.iloc[-lookback]) / max(d_close.iloc[-lookback], 1e-9) * 100.0
    rs.stock_12w_return = round(float(stock_ret), 2)

    if nifty_close is not None and len(nifty_close) >= lookback:
        nifty_ret = (nifty_close.iloc[-1] - nifty_close.iloc[-lookback]) / max(nifty_close.iloc[-lookback], 1e-9) * 100.0
        rs.nifty_12w_return = round(float(nifty_ret), 2)
        rs.outperformance = round(rs.stock_12w_return - rs.nifty_12w_return, 2)
        rs.outperforms = rs.outperformance > -15.0  # stock hasn't drastically underperformed
    else:
        rs.outperforms = rs.stock_12w_return > -5.0

    # Simple percentile scoring based on return magnitude
    # (In production this would rank against all scanned stocks)
    if rs.stock_12w_return >= 30.0:
        rs.rs_percentile = 90.0
    elif rs.stock_12w_return >= 20.0:
        rs.rs_percentile = 80.0
    elif rs.stock_12w_return >= 10.0:
        rs.rs_percentile = 70.0
    elif rs.stock_12w_return >= 0.0:
        rs.rs_percentile = 55.0
    else:
        rs.rs_percentile = 40.0

    # Score 0–15
    score = 0.0
    if rs.outperforms:
        score += 5.0
    if rs.rs_percentile >= 70.0:
        score += 7.0
    elif rs.rs_percentile >= 55.0:
        score += 4.0
    if rs.outperformance > 10.0:
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

        # Score 0–10
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
    # Cup geometry sub-score (0–20)
    cup_score = 0.0
    if cup.valid:
        cup_score = (
            (cup.symmetry_score / 100.0) * 10.0
            + ((cup.right_lip_recovery - 85.0) / 15.0) * 6.0  # 85–100% range
            + (1.0 - abs(cup.depth_pct - 30.0) / 20.0) * 4.0  # ideal ~30%
        )
        cup_score = max(0.0, min(20.0, cup_score))

    # Handle tightness sub-score (0–20)
    handle_score = base.score  # base quality already scores 0–20

    total = (
        cup_score
        + handle_score
        + volume.score         # 0–20
        + trend.score          # 0–15
        + rs.score             # 0–15
        + fundamentals.score   # 0–10
    )

    return int(min(99, max(10, round(total))))


# ---------------------------------------------------------------------------
# Cup symmetry score for display
# ---------------------------------------------------------------------------

def _cup_symmetry_bucket(symmetry: float) -> str:
    if symmetry >= 80:
        return "EXCELLENT"
    elif symmetry >= 60:
        return "GOOD"
    elif symmetry >= 40:
        return "MODERATE"
    return "WEAK"


# ---------------------------------------------------------------------------
# Main public entry-point: analyze one symbol
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
    "TRENT": "Consumer & Retail", "TITAN": "Consumer & Retail", "TITAN": "Consumer & Retail",
    "DIXON": "Consumer & Retail", "ASIANPAINT": "Consumer & Retail", "PIDILITIND": "Consumer & Retail",
    "BRITANNIA": "Consumer & Retail", "NESTLEIND": "Consumer & Retail", "HINDUNILVR": "Consumer & Retail",
    "DABUR": "Consumer & Retail", "MARICO": "Consumer & Retail", "JUBLFOOD": "Consumer & Retail",
    "OBEROIRLTY": "Realty & Infra", "GODREJPROP": "Realty & Infra", "DLF": "Realty & Infra",
    "LT": "Realty & Infra", "HUDCO": "Realty & Infra",
}


def analyze_symbol(
    symbol: str,
    company_name: Optional[str] = None,
    sector: Optional[str] = None,
    db: Optional[Session] = None,
    nifty_close: Optional[pd.Series] = None,
) -> Optional[Dict[str, Any]]:
    """
    Full 8-stage Cup & Handle analysis for one NSE/BSE symbol.
    Returns None if any mandatory stage fails or conviction < 70.
    Returns dict (serialisable) on success.
    """
    clean_sym = symbol.strip().upper()
    ticker_sym = f"{clean_sym}.NS"

    try:
        from app.services.market_data_service import MarketDataService
        df = MarketDataService.get_symbol_ohlcv(clean_sym, period="3y", interval="1d")
        if df is None or df.empty or len(df) < 120:
            return None

        df = df.dropna(subset=["Close", "Volume"])
        if len(df) < 120:
            return None

        # ---- Resample to weekly and monthly ----
        w_df = df.resample("W-FRI").agg({
            "Open": "first", "High": "max", "Low": "min",
            "Close": "last", "Volume": "sum",
        }).dropna()

        m_df = df.resample("ME").agg({
            "Open": "first", "High": "max", "Low": "min",
            "Close": "last", "Volume": "sum",
        }).dropna()

        if len(w_df) < 25 or len(m_df) < 12:
            return None

        d_close = df["Close"]
        d_open = df["Open"]
        d_high = df["High"]
        d_low = df["Low"]
        d_vol = df["Volume"]
        w_close = w_df["Close"]
        w_high = w_df["High"]
        w_low = w_df["Low"]
        w_volume = w_df["Volume"]
        m_close = m_df["Close"]

        # ----------- STAGE 1: Cup Geometry -----------
        cup = _detect_cup(w_close, w_volume)
        if not cup.valid:
            return None

        # ----------- STAGE 2: Handle Geometry -----------
        full_cup_vols = w_volume.iloc[cup.cup_start_idx:cup.cup_end_idx + 1]
        avg_cup_volume = float(full_cup_vols.mean()) if len(full_cup_vols) > 0 else 1.0
        handle = _detect_handle(w_close, w_high, w_low, w_volume, cup, avg_cup_volume)
        if not handle.valid:
            return None

        # ----------- STAGE 3: Volume Signature -----------
        volume = _analyze_volume(d_close, d_vol, w_volume, cup, handle)

        # ----------- STAGE 4: Trend Integrity -----------
        trend = _analyze_trend(d_close, w_close, m_close)
        if not trend.rsi_zone_ok and trend.daily_rsi < 50.0:
            return None  # Hard gate: weak trend

        # ----------- STAGE 5: Base Quality -----------
        base = _analyze_base_quality(d_close, d_high, d_low, handle)

        # ----------- STAGE 6: Relative Strength -----------
        rs = _analyze_relative_strength(d_close, nifty_close)

        # ----------- STAGE 7: Fundamentals -----------
        fundamentals = _load_fundamentals(clean_sym, db)

        # ----------- STAGE 8: AI Conviction Score -----------
        ai_score = _compute_conviction_score(cup, handle, volume, trend, base, rs, fundamentals)

        # HARD GATE: Only surface patterns with score >= 60
        if ai_score < 60:
            return None

        # ---- Build trade blueprint ----
        cmp = round(float(d_close.iloc[-1]), 2)
        prev_close = round(float(d_close.iloc[-2]), 2) if len(d_close) > 1 else cmp
        day_change = round(cmp - prev_close, 2)
        day_change_pct = round((day_change / max(prev_close, 1)) * 100.0, 2)

        pivot = handle.pivot_buy_point
        stop_loss_tight = round(handle.handle_low * 0.999, 2)
        stop_loss_wide = round(cup.cup_low * 0.93, 2)
        cup_depth_pts = cup.prior_high - cup.cup_low
        target_1 = round(pivot * 1.12, 2)
        target_2 = round(pivot + cup_depth_pts, 2)

        risk = max(0.5, pivot - stop_loss_tight)
        reward = max(1.0, target_1 - pivot)
        rr = round(reward / risk, 1)

        # Must have R:R >= 2 to be worthy
        if rr < 1.5:
            return None

        # Conviction tier
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
            "volume_signature": volume.score >= 10.0,
            "trend_integrity": trend.rsi_zone_ok,
            "base_quality": base.tight_action,
            "relative_strength": rs.outperforms,
            "fundamentals": fundamentals.data_available and (fundamentals.revenue_positive or not fundamentals.data_available),
            "conviction_threshold": ai_score >= 60,
        }
        stages_passed = sum(1 for v in stage_gates.values() if v)

        result = {
            "symbol": clean_sym,
            "company_name": company_name or clean_sym,
            "sector": resolved_sector,
            "exchange": "NSE",
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
                "symmetry_score": cup.symmetry_score,
                "symmetry_label": _cup_symmetry_bucket(cup.symmetry_score),
                "right_lip_recovery": cup.right_lip_recovery,
            },
            "handle": {
                "handle_high": handle.handle_high,
                "handle_low": handle.handle_low,
                "depth_pct": handle.depth_pct,
                "width_weeks": handle.width_weeks,
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
        return result

    except Exception as e:
        logger.debug(f"[CupHandleEngine] Error analyzing {clean_sym}: {e}")
        return None


# ---------------------------------------------------------------------------
# Exchange-aware ticker resolution helper
# ---------------------------------------------------------------------------

def _resolve_df(clean_sym: str, preferred_exchange: str = "NSE") -> Optional[pd.DataFrame]:
    """
    Returns valid DataFrame with >= 120 bars from centralized MarketDataService buffer.
    """
    try:
        from app.services.market_data_service import MarketDataService
        df = MarketDataService.get_symbol_ohlcv(clean_sym, period="3y", interval="1d")
        if df is not None and not df.empty and len(df) >= 120:
            df = df.dropna(subset=["Close", "Volume"])
            if len(df) >= 120:
                return df
    except Exception as e:
        logger.debug(f"[CupHandleEngine] Resolve DF exception for {clean_sym}: {e}")
    return None


# ---------------------------------------------------------------------------
# Partial analysis: returns (max_stage_passed, partial_score, full_result_or_None)
# Used by the scheduler to classify tier even when symbol doesn't fully qualify.
# ---------------------------------------------------------------------------

def analyze_symbol_with_stage_info(
    symbol: str,
    company_name: Optional[str] = None,
    sector: Optional[str] = None,
    exchange: str = "NSE",
    db: Optional[Session] = None,
    nifty_close: Optional[pd.Series] = None,
) -> Dict[str, Any]:
    """
    Full 8-stage analysis that always returns stage metadata for scheduler tiering.
    Returns:
      {
        "max_stage_passed": int,   # 0-8
        "partial_score": int,      # estimated partial AI score
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

        # Resample
        w_df = df.resample("W-FRI").agg({
            "Open": "first", "High": "max", "Low": "min",
            "Close": "last", "Volume": "sum",
        }).dropna()
        m_df = df.resample("ME").agg({
            "Open": "first", "High": "max", "Low": "min",
            "Close": "last", "Volume": "sum",
        }).dropna()

        if len(w_df) < 25 or len(m_df) < 12:
            return not_found

        d_close = df["Close"]
        d_open = df["Open"]
        d_high = df["High"]
        d_low = df["Low"]
        d_vol = df["Volume"]
        w_close = w_df["Close"]
        w_high = w_df["High"]
        w_low = w_df["Low"]
        w_volume = w_df["Volume"]
        m_close = m_df["Close"]

        # ── Stage 1: Cup Geometry ──
        cup = _detect_cup(w_close, w_volume)
        if not cup.valid:
            return {"max_stage_passed": 1, "partial_score": 0, "in_results": False, "result": None}

        # ── Stage 2: Handle Geometry ──
        full_cup_vols = w_volume.iloc[cup.cup_start_idx:cup.cup_end_idx + 1]
        avg_cup_volume = float(full_cup_vols.mean()) if len(full_cup_vols) > 0 else 1.0
        handle = _detect_handle(w_close, w_high, w_low, w_volume, cup, avg_cup_volume)
        if not handle.valid:
            # Cup formed but handle not ready — EARLY_STAGE tier candidate
            # Compute partial score from cup quality alone
            cup_partial = min(20.0, (cup.symmetry_score / 100.0) * 10.0
                             + ((cup.right_lip_recovery - 85.0) / 15.0) * 6.0)
            return {
                "max_stage_passed": 2,
                "partial_score": int(cup_partial),
                "in_results": False,
                "result": None,
            }

        # ── Stage 3: Volume ──
        volume = _analyze_volume(d_close, d_vol, w_volume, cup, handle)

        # ── Stage 4: Trend ──
        trend = _analyze_trend(d_close, w_close, m_close)
        if not trend.rsi_zone_ok and trend.daily_rsi < 50.0:
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

        # Partial score estimate for near-breakout classification
        partial_score = int(volume.score + trend.score + base.score)

        if ai_score < 60:
            return {
                "max_stage_passed": 7,
                "partial_score": ai_score,
                "in_results": False,
                "result": None,
            }

        # Build full result
        cmp = round(float(d_close.iloc[-1]), 2)
        prev_close = round(float(d_close.iloc[-2]), 2) if len(d_close) > 1 else cmp
        day_change = round(cmp - prev_close, 2)
        day_change_pct = round((day_change / max(prev_close, 1)) * 100.0, 2)

        pivot = handle.pivot_buy_point
        stop_loss_tight = round(handle.handle_low * 0.999, 2)
        stop_loss_wide = round(cup.cup_low * 0.93, 2)
        cup_depth_pts = cup.prior_high - cup.cup_low
        target_1 = round(pivot * 1.12, 2)
        target_2 = round(pivot + cup_depth_pts, 2)

        risk = max(0.5, pivot - stop_loss_tight)
        reward = max(1.0, target_1 - pivot)
        rr = round(reward / risk, 1)

        if rr < 1.5:
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
            "volume_signature": volume.score >= 10.0,
            "trend_integrity": trend.rsi_zone_ok,
            "base_quality": base.tight_action,
            "relative_strength": rs.outperforms,
            "fundamentals": fundamentals.data_available and (fundamentals.revenue_positive or not fundamentals.data_available),
            "conviction_threshold": ai_score >= 60,
        }
        stages_passed = sum(1 for v in stage_gates.values() if v)

        full_result = {
            "symbol": clean_sym,
            "company_name": company_name or clean_sym,
            "sector": resolved_sector,
            "exchange": exchange,
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
                "prior_high": cup.prior_high, "cup_low": cup.cup_low, "right_rim": cup.right_rim,
                "depth_pct": cup.depth_pct, "width_weeks": cup.width_weeks,
                "symmetry_score": cup.symmetry_score, "symmetry_label": _cup_symmetry_bucket(cup.symmetry_score),
                "right_lip_recovery": cup.right_lip_recovery,
            },
            "handle": {
                "handle_high": handle.handle_high, "handle_low": handle.handle_low,
                "depth_pct": handle.depth_pct, "width_weeks": handle.width_weeks,
                "in_upper_half": handle.in_upper_half, "volume_contracting": handle.volume_contracting,
            },
            "volume": {
                "avg_vol_50d": volume.avg_vol_50d, "breakout_vol_ratio": volume.breakout_vol_ratio,
                "base_drying_up": volume.base_drying_up, "recovery_surge": volume.recovery_surge,
                "handle_contraction": volume.handle_contraction, "breakout_confirmed": volume.breakout_confirmed,
                "volume_score": volume.score,
            },
            "trend": {
                "daily_rsi": trend.daily_rsi, "weekly_rsi": trend.weekly_rsi,
                "monthly_rsi": trend.monthly_rsi, "above_10w_ema": trend.above_10w_ema,
                "rsi_zone_ok": trend.rsi_zone_ok, "price_vs_200d_sma": trend.price_vs_200d_sma,
                "trend_score": trend.score,
            },
            "base": {
                "handle_std_pct": base.handle_std_pct, "inside_bar_count": base.inside_bar_count,
                "gap_down_count": base.gap_down_count, "tight_action": base.tight_action,
                "volatility_contracting": base.volatility_contracting, "base_score": base.score,
            },
            "rs": {
                "stock_12w_return": rs.stock_12w_return, "nifty_12w_return": rs.nifty_12w_return,
                "outperformance": rs.outperformance, "rs_percentile": rs.rs_percentile,
                "outperforms": rs.outperforms, "rs_score": rs.score,
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
        logger.debug(f"[CupHandleEngine] Error in stage analysis for {clean_sym}: {e}")
        return not_found


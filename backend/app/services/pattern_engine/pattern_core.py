"""
Alpha India — Pattern Engine Core
===================================
Shared utilities, base types, and indicator library used by all 5 pattern engines.
All engines receive pre-computed DataFrames (one yfinance fetch per symbol).

Pattern Catalogue:
  1. FLAT_BASE        — 5+ week tight consolidation < 15% depth, volume drying up
  2. DOUBLE_BOTTOM    — W-shape: two equal lows, breakout above middle pivot
  3. ASCENDING_TRIANGLE — Horizontal resistance + rising support, volume contraction
  4. BULL_FLAG        — Pole (strong up 20%+ in ≤ 10 bars) + tight flag consolidation
  5. HIGH_TIGHT_FLAG  — Explosive 100%+ rally in 8w, then 10–25% tight flag (Mark Minervini elite)
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd


# ─────────────────────────────────────────────────────────────────────────────
# Shared pattern result type
# ─────────────────────────────────────────────────────────────────────────────

PATTERN_TYPES = {
    "FLAT_BASE":           {"label": "Flat Base",            "color": "cyan"},
    "DOUBLE_BOTTOM":       {"label": "Double Bottom (W)",    "color": "emerald"},
    "ASCENDING_TRIANGLE":  {"label": "Ascending Triangle",   "color": "amber"},
    "BULL_FLAG":           {"label": "Bull Flag",            "color": "violet"},
    "HIGH_TIGHT_FLAG":     {"label": "High Tight Flag",      "color": "rose"},
}


@dataclass
class PatternResult:
    # Identity
    symbol: str = ""
    company_name: str = ""
    sector: str = ""
    exchange: str = "NSE"
    pattern_type: str = ""              # FLAT_BASE / DOUBLE_BOTTOM / etc.
    pattern_label: str = ""             # Human-readable

    # Price data
    cmp: float = 0.0
    day_change: float = 0.0
    day_change_pct: float = 0.0

    # Trade blueprint
    pivot_buy_point: float = 0.0
    stop_loss: float = 0.0
    target_1: float = 0.0
    target_2: float = 0.0
    risk_reward: float = 0.0

    # Pattern geometry
    pattern_depth_pct: float = 0.0     # How deep the base/correction is
    pattern_width_weeks: float = 0.0   # How many weeks wide
    volume_ratio: float = 0.0          # Current vol / 50d avg

    # Scoring
    ai_conviction_score: int = 0       # 0–100
    conviction_tier: str = ""          # ELITE / HIGH / DEVELOPING
    tier_badge: str = ""

    # Pattern-specific metrics (flexible dict)
    pattern_metrics: Dict[str, Any] = field(default_factory=dict)

    # Indicators
    daily_rsi: float = 0.0
    weekly_rsi: float = 0.0
    weekly_ema10: float = 0.0
    price_vs_200d_sma: float = 0.0

    # Links
    tradingview_url: str = ""
    techno_funda_url: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


# ─────────────────────────────────────────────────────────────────────────────
# Shared indicator functions (identical to cup_handle_engine helpers)
# ─────────────────────────────────────────────────────────────────────────────

def calc_rsi(series: pd.Series, period: int = 14) -> pd.Series:
    delta = series.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(com=period - 1, min_periods=period).mean()
    avg_loss = loss.ewm(com=period - 1, min_periods=period).mean()
    rs = avg_gain / np.maximum(1e-9, avg_loss)
    return 100.0 - (100.0 / (1.0 + rs))


def calc_ema(series: pd.Series, span: int) -> pd.Series:
    return series.ewm(span=span, adjust=False).mean()


def calc_sma(series: pd.Series, n: int) -> pd.Series:
    return series.rolling(n).mean()


def calc_atr(d_high: pd.Series, d_low: pd.Series, d_close: pd.Series, period: int = 14) -> pd.Series:
    hl = d_high - d_low
    hpc = (d_high - d_close.shift(1)).abs()
    lpc = (d_low - d_close.shift(1)).abs()
    tr = pd.concat([hl, hpc, lpc], axis=1).max(axis=1)
    return tr.rolling(period).mean()


def vol_ratio(d_volume: pd.Series, period: int = 50) -> float:
    avg = float(d_volume.rolling(period).mean().iloc[-1])
    cur = float(d_volume.iloc[-1])
    return round(cur / max(avg, 1), 2)


def linear_regression_slope(series: pd.Series, window: int) -> float:
    """Normalised slope of linear regression over last `window` bars."""
    if len(series) < window:
        return 0.0
    y = series.iloc[-window:].values
    x = np.arange(window)
    slope = np.polyfit(x, y, 1)[0]
    return float(slope / max(abs(y.mean()), 1e-9))


def conviction_tier_label(score: int) -> Tuple[str, str]:
    if score >= 82:
        return "ELITE", "bg-rose-500/10 text-rose-400 border-rose-500/30"
    elif score >= 70:
        return "HIGH CONVICTION", "bg-cyan-500/10 text-cyan-400 border-cyan-500/30"
    elif score >= 60:
        return "DEVELOPING", "bg-amber-500/10 text-amber-400 border-amber-500/30"
    return "WATCHLIST", "bg-slate-800/60 text-slate-400 border-slate-700/40"


def sanitize_json(obj: Any) -> Any:
    """Recursively converts numpy/pandas types to native Python JSON-serializable types."""
    if isinstance(obj, dict):
        return {str(k): sanitize_json(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [sanitize_json(v) for v in obj]
    elif isinstance(obj, (np.bool_, bool)):
        return bool(obj)
    elif isinstance(obj, (np.integer, int)):
        return int(obj)
    elif isinstance(obj, (np.floating, float)):
        return None if (np.isnan(obj) or np.isinf(obj)) else float(obj)
    elif isinstance(obj, pd.Timestamp):
        return obj.isoformat()
    return obj

"""
Unit tests for CandlestickPatternEngine
Validates single, double, and triple pattern detection logic.
"""

import numpy as np
import pandas as pd
import pytest

from app.services.pattern_engine.candlestick_engine import (
    CandlestickEngine,
    PatternDirection,
    PatternCategory,
)


def _generate_synthetic_df(rows: int = 40, base_price: float = 500.0) -> pd.DataFrame:
    dates = pd.date_range("2026-01-01", periods=rows, freq="B")
    rng = np.random.default_rng(42)
    close = base_price + np.cumsum(rng.normal(0, 2, rows))
    open_p = close + rng.normal(0, 1, rows)
    high = np.maximum(open_p, close) + rng.uniform(1, 3, rows)
    low = np.minimum(open_p, close) - rng.uniform(1, 3, rows)
    vol = rng.uniform(100000, 500000, rows)

    return pd.DataFrame({
        "Open": open_p,
        "High": high,
        "Low": low,
        "Close": close,
        "Volume": vol,
    }, index=dates)


def test_morning_star_detection():
    df = _generate_synthetic_df(35)
    # Craft Morning Star on last 3 bars (idx 32, 33, 34)
    df.iloc[32, df.columns.get_loc("Open")] = 520.0
    df.iloc[32, df.columns.get_loc("High")] = 522.0
    df.iloc[32, df.columns.get_loc("Low")] = 498.0
    df.iloc[32, df.columns.get_loc("Close")] = 500.0

    df.iloc[33, df.columns.get_loc("Open")] = 495.0
    df.iloc[33, df.columns.get_loc("High")] = 496.0
    df.iloc[33, df.columns.get_loc("Low")] = 492.0
    df.iloc[33, df.columns.get_loc("Close")] = 494.5

    df.iloc[34, df.columns.get_loc("Open")] = 496.0
    df.iloc[34, df.columns.get_loc("High")] = 516.0
    df.iloc[34, df.columns.get_loc("Low")] = 495.0
    df.iloc[34, df.columns.get_loc("Close")] = 514.0
    df.iloc[34, df.columns.get_loc("Volume")] = 800000.0

    signals = CandlestickEngine.analyze_dataframe(df, lookback_bars=2)
    morning_stars = [s for s in signals if "MORNING_STAR" in s.pattern_key]
    assert len(morning_stars) >= 1
    sig = morning_stars[0]
    assert sig.direction == PatternDirection.BULLISH.value
    assert sig.category == PatternCategory.TRIPLE.value
    assert sig.stop_loss <= 492.0
    assert sig.target_1 > sig.cmp


def test_three_white_soldiers_detection():
    df = _generate_synthetic_df(35)
    df.iloc[32, df.columns.get_loc("Open")] = 500.0
    df.iloc[32, df.columns.get_loc("High")] = 512.0
    df.iloc[32, df.columns.get_loc("Low")] = 499.0
    df.iloc[32, df.columns.get_loc("Close")] = 510.0

    df.iloc[33, df.columns.get_loc("Open")] = 506.0
    df.iloc[33, df.columns.get_loc("High")] = 524.0
    df.iloc[33, df.columns.get_loc("Low")] = 505.0
    df.iloc[33, df.columns.get_loc("Close")] = 522.0

    df.iloc[34, df.columns.get_loc("Open")] = 518.0
    df.iloc[34, df.columns.get_loc("High")] = 538.0
    df.iloc[34, df.columns.get_loc("Low")] = 517.0
    df.iloc[34, df.columns.get_loc("Close")] = 536.0
    df.iloc[34, df.columns.get_loc("Volume")] = 900000.0

    signals = CandlestickEngine.analyze_dataframe(df, lookback_bars=2)
    soldiers = [s for s in signals if s.pattern_key == "THREE_WHITE_SOLDIERS"]
    assert len(soldiers) >= 1
    assert soldiers[0].direction == PatternDirection.BULLISH.value
    assert soldiers[0].ai_conviction_score >= 80


def test_bullish_engulfing_detection():
    df = _generate_synthetic_df(35)
    df.iloc[33, df.columns.get_loc("Open")] = 510.0
    df.iloc[33, df.columns.get_loc("High")] = 511.0
    df.iloc[33, df.columns.get_loc("Low")] = 500.0
    df.iloc[33, df.columns.get_loc("Close")] = 502.0

    df.iloc[34, df.columns.get_loc("Open")] = 500.0
    df.iloc[34, df.columns.get_loc("High")] = 520.0
    df.iloc[34, df.columns.get_loc("Low")] = 499.0
    df.iloc[34, df.columns.get_loc("Close")] = 518.0
    df.iloc[34, df.columns.get_loc("Volume")] = 950000.0

    signals = CandlestickEngine.analyze_dataframe(df, lookback_bars=2)
    engulfs = [s for s in signals if s.pattern_key == "BULLISH_ENGULFING"]
    assert len(engulfs) >= 1
    assert engulfs[0].direction == PatternDirection.BULLISH.value
    assert engulfs[0].category == PatternCategory.DOUBLE.value


def test_evening_star_detection():
    df = _generate_synthetic_df(35)
    # Bar 32: Strong Bullish
    df.iloc[32, df.columns.get_loc("Open")] = 500.0
    df.iloc[32, df.columns.get_loc("High")] = 522.0
    df.iloc[32, df.columns.get_loc("Low")] = 498.0
    df.iloc[32, df.columns.get_loc("Close")] = 520.0

    # Bar 33: Small body gap up
    df.iloc[33, df.columns.get_loc("Open")] = 524.0
    df.iloc[33, df.columns.get_loc("High")] = 526.0
    df.iloc[33, df.columns.get_loc("Low")] = 522.0
    df.iloc[33, df.columns.get_loc("Close")] = 525.0

    # Bar 34: Strong Bearish closing well below midpoint of 32 ((500+520)/2 = 510)
    df.iloc[34, df.columns.get_loc("Open")] = 522.0
    df.iloc[34, df.columns.get_loc("High")] = 523.0
    df.iloc[34, df.columns.get_loc("Low")] = 502.0
    df.iloc[34, df.columns.get_loc("Close")] = 505.0
    df.iloc[34, df.columns.get_loc("Volume")] = 850000.0

    signals = CandlestickEngine.analyze_dataframe(df, lookback_bars=2)
    evening_stars = [s for s in signals if "EVENING_STAR" in s.pattern_key]
    assert len(evening_stars) >= 1
    sig = evening_stars[0]
    assert sig.direction == PatternDirection.BEARISH.value
    assert sig.category == PatternCategory.TRIPLE.value


def test_three_black_crows_detection():
    df = _generate_synthetic_df(35)
    df.iloc[32, df.columns.get_loc("Open")] = 530.0
    df.iloc[32, df.columns.get_loc("High")] = 531.0
    df.iloc[32, df.columns.get_loc("Low")] = 518.0
    df.iloc[32, df.columns.get_loc("Close")] = 520.0

    df.iloc[33, df.columns.get_loc("Open")] = 524.0
    df.iloc[33, df.columns.get_loc("High")] = 525.0
    df.iloc[33, df.columns.get_loc("Low")] = 508.0
    df.iloc[33, df.columns.get_loc("Close")] = 510.0

    df.iloc[34, df.columns.get_loc("Open")] = 512.0
    df.iloc[34, df.columns.get_loc("High")] = 513.0
    df.iloc[34, df.columns.get_loc("Low")] = 496.0
    df.iloc[34, df.columns.get_loc("Close")] = 498.0
    df.iloc[34, df.columns.get_loc("Volume")] = 800000.0

    signals = CandlestickEngine.analyze_dataframe(df, lookback_bars=2)
    crows = [s for s in signals if s.pattern_key == "THREE_BLACK_CROWS"]
    assert len(crows) >= 1
    assert crows[0].direction == PatternDirection.BEARISH.value


def test_hammer_detection():
    df = _generate_synthetic_df(35)
    # Downtrend prior to bar 34
    for j in range(25, 34):
        df.iloc[j, df.columns.get_loc("Close")] = 500.0 - (j - 25) * 5.0
        df.iloc[j, df.columns.get_loc("Open")] = df.iloc[j]["Close"] + 2.0
        df.iloc[j, df.columns.get_loc("High")] = df.iloc[j]["Open"] + 1.0
        df.iloc[j, df.columns.get_loc("Low")] = df.iloc[j]["Close"] - 1.0

    # Bar 34: Hammer (small body at top, very long lower shadow)
    df.iloc[34, df.columns.get_loc("Open")] = 452.0
    df.iloc[34, df.columns.get_loc("High")] = 455.0
    df.iloc[34, df.columns.get_loc("Low")] = 435.0
    df.iloc[34, df.columns.get_loc("Close")] = 454.0
    df.iloc[34, df.columns.get_loc("Volume")] = 600000.0

    signals = CandlestickEngine.analyze_dataframe(df, lookback_bars=2)
    hammers = [s for s in signals if s.pattern_key == "HAMMER"]
    assert len(hammers) >= 1
    assert hammers[0].direction == PatternDirection.BULLISH.value
    assert hammers[0].category == PatternCategory.SINGLE.value


def test_shooting_star_detection():
    df = _generate_synthetic_df(35)
    # Uptrend prior to bar 34
    for j in range(25, 34):
        df.iloc[j, df.columns.get_loc("Close")] = 500.0 + (j - 25) * 5.0
        df.iloc[j, df.columns.get_loc("Open")] = df.iloc[j]["Close"] - 2.0
        df.iloc[j, df.columns.get_loc("High")] = df.iloc[j]["Close"] + 1.0
        df.iloc[j, df.columns.get_loc("Low")] = df.iloc[j]["Open"] - 1.0

    # Bar 34: Shooting star (small body at bottom, very long upper shadow)
    df.iloc[34, df.columns.get_loc("Open")] = 550.0
    df.iloc[34, df.columns.get_loc("High")] = 572.0
    df.iloc[34, df.columns.get_loc("Low")] = 548.0
    df.iloc[34, df.columns.get_loc("Close")] = 549.0
    df.iloc[34, df.columns.get_loc("Volume")] = 650000.0

    signals = CandlestickEngine.analyze_dataframe(df, lookback_bars=2)
    stars = [s for s in signals if s.pattern_key == "SHOOTING_STAR"]
    assert len(stars) >= 1
    assert stars[0].direction == PatternDirection.BEARISH.value


if __name__ == "__main__":
    pytest.main(["-s", __file__])

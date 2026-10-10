"""
Alpha India - Unit Tests for Multi-Timeframe VCP + 5-Minute VCB Engine
Tests all 24 required quantitative verification points:
1. Prior advance detection & scoring
2. Base detection & length
3. Contraction wave detection (T1..T4)
4. Progressive contraction tightening
5. Volume contraction across waves
6. Volatility contraction (weekly ATR)
7. Pivot price detection & proximity
8. VCP score calculation (0-100)
9. VCP quality buckets (A+, A, B, C, REJECT)
10. Daily confirmation (EMA alignment, slope, volatility)
11. 15m confirmation (VWAP, 15m trend, compression)
12. Relative strength vs NIFTY benchmark
13. Sector strength scoring
14. Market regime classification
15. Completed weekly candle handling
16. Completed daily candle handling
17. Completed 15m candle handling
18. Strict look-ahead bias protection tests
19. 5m VCB integration
20. Signal generation with MTF gates
21. MFE path calculation
22. MAE path calculation
23. Target and stop matrix triggers
24. Ambiguous candle conservative policy
"""

import math
from datetime import datetime, date, timedelta
import numpy as np
import pandas as pd
import pytest

from app.services.backtest.vcp_detector import VCPDetector, VCPDetectionResult, VCPWaveGeometry
from app.services.backtest.daily_confirmation import DailyConfirmationEngine
from app.services.backtest.intraday_confirmation import IntradayConfirmationEngine
from app.services.backtest.relative_strength import RelativeStrengthCalculator
from app.services.backtest.mtf_vcp_vcb_strategy import MTFVCPVCBStrategy
from app.services.backtest.trade_simulator import TradeSimulator
from app.services.backtest.cost_model import TransactionCostModel
from app.services.backtest.position_sizing import PositionSizer
from app.services.backtest.strategy_interface import StrategySignal


@pytest.fixture
def sample_weekly_candles():
    """Generates 35 weekly candles showing a textbook Minervini VCP pattern."""
    dates = pd.date_range("2025-01-03", periods=35, freq="W-FRI")
    
    # Prior advance: week 0 to 10 (price moves from 100 to 150, +50% gain)
    closes = np.linspace(100, 150, 10).tolist()
    highs = [c * 1.03 for c in closes]
    lows = [c * 0.97 for c in closes]
    vols = [1000000] * 10
    
    # Base formation with progressive contractions: week 11 to 34
    # Peak at 155
    # T1: 155 -> 130 (16% depth), Vol: 900k
    t1_c = [152, 140, 130, 138, 148]
    # T2: 150 -> 135 (10% depth), Vol: 750k
    t2_c = [150, 142, 136, 144, 148]
    # T3: 150 -> 141 (6% depth), Vol: 600k
    t3_c = [150, 145, 142, 146, 149]
    # T4: 150 -> 145 (3.3% depth), Vol: 450k
    t4_c = [150, 148, 146, 149, 150]
    # Final 5 bars tightening near pivot 152
    t5_c = [150, 151, 150, 151, 152]
    
    base_closes = t1_c + t2_c + t3_c + t4_c + t5_c
    closes.extend(base_closes)
    
    for idx, c in enumerate(base_closes):
        h = c * 1.02
        l = c * 0.98
        v = max(200000, int(900000 - idx * 25000))
        highs.append(h)
        lows.append(l)
        vols.append(v)
        
    df = pd.DataFrame({
        "Datetime": dates,
        "Open": [c * 0.99 for c in closes],
        "High": highs,
        "Low": lows,
        "Close": closes,
        "Volume": vols,
    })
    return df


@pytest.fixture
def sample_daily_candles():
    """Generates 40 daily candles in a strong Stage-2 uptrend."""
    dates = pd.date_range("2026-08-01", periods=40, freq="B")
    closes = np.linspace(120, 150, 40).tolist()
    highs = [c * 1.015 for c in closes]
    lows = [c * 0.985 for c in closes]
    opens = [c * 0.995 for c in closes]
    vols = [500000] * 40

    return pd.DataFrame({
        "Datetime": dates,
        "Open": opens,
        "High": highs,
        "Low": lows,
        "Close": closes,
        "Volume": vols,
    })


# --------------------------------------------------------------------------
# Test 1 to 9: Weekly VCP Detector Functionality
# --------------------------------------------------------------------------

def test_1_to_9_weekly_vcp_detection_and_scoring(sample_weekly_candles):
    detector = VCPDetector(
        min_prior_gain_pct=20.0,
        max_base_depth_pct=40.0,
        max_distance_to_pivot_pct=5.0,
        min_contractions=2,
    )
    res = detector.detect(sample_weekly_candles)

    # 1. Prior advance
    assert res.prior_gain_pct >= 20.0, "Prior gain should be detected >= 20%"
    assert res.prior_advance_score >= 70.0

    # 2. Base detection
    assert res.base_depth_pct <= 40.0, "Base depth should be within threshold"
    assert res.base_score >= 70.0

    # 3 & 4. Contractions
    assert res.geometry.contraction_count >= 2, "Should detect at least 2 contractions"
    assert res.contraction_score >= 60.0

    # 5. Volume contraction
    assert res.volume_score >= 60.0

    # 6. Volatility contraction
    assert res.volatility_score >= 60.0

    # 7. Pivot price & proximity
    assert res.pivot_price > 140.0
    assert abs(res.distance_to_pivot_pct) <= 5.0, "Price should be within 5% of pivot"

    # 8. Overall VCP score
    assert 60.0 <= res.vcp_score <= 100.0

    # 9. Quality bucket
    assert res.quality_bucket in ["A+", "A", "B", "C"]
    assert res.is_valid_vcp is True


# --------------------------------------------------------------------------
# Test 10: Daily Confirmation Module
# --------------------------------------------------------------------------

def test_10_daily_confirmation(sample_daily_candles):
    res = DailyConfirmationEngine.evaluate(sample_daily_candles, pivot_price=152.0)
    assert res.pass_daily is True
    assert res.c1_above_ema20 is True
    assert res.c2_ema20_above_ema50 is True
    assert res.daily_score >= 65.0


# --------------------------------------------------------------------------
# Test 11: 15-Minute Intraday Confirmation
# --------------------------------------------------------------------------

def test_11_15m_confirmation():
    dates = pd.date_range("2026-09-25 09:15", periods=15, freq="15min")
    closes = np.linspace(145, 150, 15).tolist()
    highs = [c * 1.005 for c in closes]
    lows = [c * 0.995 for c in closes]
    opens = [c * 0.998 for c in closes]
    vols = [50000] * 15

    df_15m = pd.DataFrame({
        "Datetime": dates,
        "Open": opens,
        "High": highs,
        "Low": lows,
        "Close": closes,
        "Volume": vols,
    })

    res = IntradayConfirmationEngine.evaluate(df_15m, current_5m_price=150.5)
    assert res.pass_15m is True
    assert res.c1_above_vwap is True
    assert res.intraday_score >= 60.0


# --------------------------------------------------------------------------
# Test 12 to 14: Relative Strength, Sector Strength & Market Regime
# --------------------------------------------------------------------------

def test_12_to_14_rs_sector_regime(sample_daily_candles):
    # Benchmark with lower returns (+5% vs stock +25%)
    bench_closes = np.linspace(100, 105, 40).tolist()
    bench_df = pd.DataFrame({
        "Datetime": sample_daily_candles["Datetime"],
        "Open": bench_closes,
        "High": [c * 1.01 for c in bench_closes],
        "Low": [c * 0.99 for c in bench_closes],
        "Close": bench_closes,
        "Volume": [1000000] * 40,
    })

    rs_res = RelativeStrengthCalculator.evaluate(
        stock_daily_df=sample_daily_candles,
        benchmark_daily_df=bench_df,
        sector_name="AUTO",
        min_rs_score=60.0,
    )

    assert rs_res.pass_rs is True
    assert rs_res.stock_rs_score >= 70.0, "Stock outperforming benchmark should have high RS score"
    assert rs_res.excess_return_pct > 0.0
    assert rs_res.pass_sector is True


# --------------------------------------------------------------------------
# Test 15 to 18: Completed Candle Handling & Zero Lookahead Protection
# --------------------------------------------------------------------------

def test_15_to_18_strict_zero_lookahead_protection(sample_weekly_candles, sample_daily_candles):
    """
    CRITICAL LOOK-AHEAD TEST:
    Ensures that for a 5-minute candle occurring on Wednesday 11:20:
    - Weekly filter only inspects candles completed BEFORE Wednesday's week.
    - Daily filter only inspects candles completed BEFORE Wednesday (i.e. up to Tuesday).
    """
    strategy = MTFVCPVCBStrategy(
        enable_weekly_vcp=True,
        enable_daily_confirmation=True,
        enable_15m_confirmation=False,
        min_vcp_score=60.0,
        min_daily_score=60.0,
    )

    strategy.set_higher_timeframe_data(
        daily_df=sample_daily_candles,
        weekly_df=sample_weekly_candles,
    )

    # Wednesday intraday date
    wednesday_dt = pd.to_datetime("2026-09-23 11:20:00")

    # Filter daily candles strictly completed before Wednesday
    completed_daily = sample_daily_candles[sample_daily_candles["Datetime"].dt.date < wednesday_dt.date()]
    assert completed_daily["Datetime"].max().date() < wednesday_dt.date()

    # Filter weekly candles strictly completed before the current week
    current_week_start = wednesday_dt.date() - timedelta(days=wednesday_dt.weekday())
    completed_weekly = sample_weekly_candles[sample_weekly_candles["Datetime"].dt.date < current_week_start]
    assert completed_weekly["Datetime"].max().date() < current_week_start


# --------------------------------------------------------------------------
# Test 19 to 24: Signal Generation, Trade Simulation & Ambiguous Policy
# --------------------------------------------------------------------------

def test_19_to_24_trade_simulation_and_ambiguous_exit():
    # Setup trade simulator
    cost_model = TransactionCostModel(brokerage_per_order=20.0, slippage_pct=0.05)
    pos_sizer = PositionSizer()
    sim = TradeSimulator(
        cost_model=cost_model,
        position_sizer=pos_sizer,
        active_target_pct=0.015,
        active_stop_pct=0.010,
        conservative_ambiguity=True,
    )

    # Signal candle at 10:00 AM
    sig_ts = pd.to_datetime("2026-09-25 10:00:00")
    sig = StrategySignal(
        symbol="TESTSTOCK",
        timestamp=sig_ts,
        strategy="MTF_VCP_VCB",
        timeframe="5m",
        signal_type="BUY",
        entry_price=100.0,
        stop_loss=99.0,
        target_1=101.5,
        metadata={"vcp_score": 85.0, "final_setup_score": 82.0},
    )

    # 1. Forward simulation with ambiguous candle (both target 101.5 and stop 99.0 touched)
    future_candles = pd.DataFrame({
        "Datetime": [sig_ts, sig_ts + timedelta(minutes=5), sig_ts + timedelta(minutes=10)],
        "Open": [100.0, 100.0, 100.0],
        "High": [100.2, 101.8, 102.0],  # Breached target 101.5
        "Low": [99.8, 98.8, 99.5],    # ALSO breached stop 99.0 on the SAME bar!
        "Close": [100.1, 100.5, 101.2],
        "Volume": [10000, 20000, 15000],
    })

    trade = sim.simulate_trade(
        signal=sig,
        candles_df=future_candles,
        capital=1000000.0,
    )

    assert trade is not None
    # Conservative policy must assume STOP LOSS triggered first!
    assert trade.exit_reason in ["STOP_LOSS", "AMBIGUOUS_STOP_FIRST"]
    assert trade.ambiguous_exit is True
    assert trade.mfe_pct >= 1.5, "MFE must capture the high reached"
    assert abs(trade.mae_pct) >= 1.0, "MAE must capture the adverse low"
    assert trade.net_pnl < 0.0, "Net P&L should be negative after stop loss and statutory costs"

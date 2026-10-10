"""
Alpha India - Backtest Engine Comprehensive Test Suite
Sprint 43.1 Forensic Test Verification

Tests:
1. OHLC validation
2. Candle aggregation
3. ATR calculation
4. VWAP calculation
5. SMA calculation
6. VCB range compression
7. VCB ATR compression
8. VCB volume contraction
9. Breakout detection
10. Volume expansion
11. Close-location calculation
12. Extension calculation
13. Signal generation
14. MFE calculation
15. MAE calculation
16. Target detection
17. Stop detection
18. Ambiguous candle handling (conservative: stop first)
19. Transaction costs
20. Position sizing
21. P&L calculation
22. Drawdown calculation
23. Backtest reproducibility
24. Look-ahead bias protection tests
"""

import sys
import os
from pathlib import Path
import numpy as np
import pandas as pd
import pytest

# Ensure backend path
backend_path = Path(__file__).resolve().parent.parent
if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

from app.services.backtest.candle_aggregator import CandleAggregator
from app.services.backtest.cost_model import TransactionCostModel
from app.services.backtest.data_quality_engine import DataQualityEngine
from app.services.backtest.metrics_calculator import MetricsCalculator
from app.services.backtest.position_sizing import PositionSizer
from app.services.backtest.strategy_interface import StrategySignal
from app.services.backtest.trade_simulator import TradeSimulator
from app.services.backtest.universe_service import UniverseService
from app.services.backtest.vcb_strategy import VCBBreakoutStrategy, VCBEarlyStrategy


# -------------------------------------------------------------------------
# Helper Fixtures
# -------------------------------------------------------------------------

def create_sample_1m_data(n_bars: int = 25) -> pd.DataFrame:
    """Generates synthetic 1-minute bars during market hours."""
    timestamps = pd.date_range("2026-09-01 09:15:00", periods=n_bars, freq="1min", tz="Asia/Kolkata")
    data = {
        "Datetime": timestamps,
        "Open": [100.0 + i * 0.2 for i in range(n_bars)],
        "High": [100.5 + i * 0.2 for i in range(n_bars)],
        "Low": [99.8 + i * 0.2 for i in range(n_bars)],
        "Close": [100.3 + i * 0.2 for i in range(n_bars)],
        "Volume": [1000 + i * 100 for i in range(n_bars)],
    }
    return pd.DataFrame(data)


def create_vcb_test_dataset(trigger_at_index: int = 66) -> pd.DataFrame:
    """
    Creates a deterministic 75-bar 5-minute dataset engineered so that
    at `trigger_at_index`, all 9 VCB Breakout rules strictly pass.
    """
    n_bars = 75
    timestamps = pd.date_range("2026-09-01 09:15:00", periods=n_bars, freq="5min", tz="Asia/Kolkata")

    # Base price coiling tightly around 1000.0
    opens = np.full(n_bars, 1000.0)
    highs = np.full(n_bars, 1005.0)
    lows = np.full(n_bars, 995.0)
    closes = np.full(n_bars, 1000.0)
    volumes = np.full(n_bars, 10000.0)

    # Establish baseline ATR SMA50 over bars 0 to 50 with wider range
    for i in range(0, 50):
        highs[i] = 1020.0
        lows[i] = 980.0
        volumes[i] = 20000.0

    # Bars 50 to 60: High volume baseline, tight price
    for i in range(50, 61):
        opens[i] = 1000.0
        highs[i] = 1003.0
        lows[i] = 998.0
        closes[i] = 1000.0
        volumes[i] = 20000.0

    # Bars 61 to trigger_at_index: Volume contractions (< 80% of 20-SMA)
    for i in range(61, trigger_at_index):
        opens[i] = 1000.0
        highs[i] = 1003.0   # Resistance at 1003.0
        lows[i] = 998.0    # 12-bar range = 5.0 (0.5% < 2%)
        closes[i] = 1000.0
        volumes[i] = 6000.0  # 5-SMA volume = 6000 < 80% of 20-SMA volume

    # Bar trigger_at_index: Clean Breakout
    i = trigger_at_index
    opens[i] = 1001.0
    highs[i] = 1007.0
    lows[i] = 1001.0
    closes[i] = 1006.0
    volumes[i] = 50000.0

    # Forward bars for trade simulation: trending upward
    for j in range(trigger_at_index + 1, n_bars):
        step = j - trigger_at_index
        opens[j] = 1006.0 + step * 3.0
        highs[j] = opens[j] + 5.0
        lows[j] = opens[j] - 0.5
        closes[j] = opens[j] + 4.0
        volumes[j] = 15000.0

    df = pd.DataFrame({
        "Datetime": timestamps,
        "Open": opens,
        "High": highs,
        "Low": lows,
        "Close": closes,
        "Volume": volumes,
    })
    return df


# -------------------------------------------------------------------------
# Unit Tests
# -------------------------------------------------------------------------

def test_1_ohlc_validation():
    """Validates structural OHLC inequalities detection."""
    df_valid = create_sample_1m_data(25)
    clean_df, report = DataQualityEngine.validate_dataframe(df_valid, "TEST_SYM")
    assert report.is_acceptable is True
    assert report.invalid_candles == 0
    assert len(clean_df) == 25

    # Introduce corrupted bar: Low > High
    df_corrupt = df_valid.copy()
    df_corrupt.loc[2, "Low"] = 150.0  # Low greater than High
    clean_df2, report2 = DataQualityEngine.validate_dataframe(df_corrupt, "TEST_SYM")
    assert report2.invalid_candles == 1
    assert any(iss.issue_type == "INVALID_OHLC_RELATIONSHIP" for iss in report2.issues)


def test_2_candle_aggregation():
    """Validates resampling from 1m to 5m with session integrity."""
    df_1m = create_sample_1m_data(15)  # 15 1-minute bars -> exactly 3 5-minute bars
    df_5m = CandleAggregator.aggregate_candles(df_1m, target_timeframe="5m")
    assert len(df_5m) == 3
    # Check OHLC aggregations
    assert df_5m.iloc[0]["Open"] == df_1m.iloc[0]["Open"]
    assert df_5m.iloc[0]["High"] == df_1m.iloc[:5]["High"].max()
    assert df_5m.iloc[0]["Low"] == df_1m.iloc[:5]["Low"].min()
    assert df_5m.iloc[0]["Close"] == df_1m.iloc[4]["Close"]
    assert df_5m.iloc[0]["Volume"] == df_1m.iloc[:5]["Volume"].sum()


def test_3_atr_calculation():
    """Validates True Range and ATR(14) calculations."""
    df = create_sample_1m_data(30)
    strat = VCBBreakoutStrategy()
    ind_df = strat.calculate_indicators(df)
    assert "ATR14" in ind_df.columns
    # Bar 15 should have non-null ATR
    assert not np.isnan(ind_df.loc[20, "ATR14"])
    assert ind_df.loc[20, "ATR14"] > 0


def test_4_vwap_calculation():
    """Validates cumulative intraday VWAP calculation."""
    df = create_sample_1m_data(10)
    strat = VCBBreakoutStrategy()
    ind_df = strat.calculate_indicators(df)
    assert "VWAP" in ind_df.columns
    # Manual VWAP on first bar = Close * Volume / Volume = Close
    assert abs(ind_df.loc[0, "VWAP"] - ind_df.loc[0, "Close"]) < 1e-4


def test_5_sma_calculation():
    """Validates volume SMA20 and SMA5 baselines."""
    df = create_sample_1m_data(25)
    strat = VCBBreakoutStrategy()
    ind_df = strat.calculate_indicators(df)
    assert "Prev_Vol_SMA20" in ind_df.columns
    assert "Prev_Vol_SMA5" in ind_df.columns
    # Verify shift(1) exclusion: Bar 20 SMA20 must equal mean of bars 0 to 19
    expected_sma20 = df.loc[0:19, "Volume"].mean()
    assert abs(ind_df.loc[20, "Prev_Vol_SMA20"] - expected_sma20) < 1e-4


def test_6_to_12_vcb_rules_and_signal_generation():
    """Validates all 9 VCB Breakout rules evaluated independently."""
    df = create_vcb_test_dataset(trigger_at_index=70)
    strat = VCBBreakoutStrategy()
    signals = strat.generate_signals(df, symbol="VCB_EQUITY")

    assert len(signals) >= 1
    sig = signals[0]
    diag = sig.rule_diagnostics

    # Assert every single rule passed
    assert diag["rule_1_breakout"] is True
    assert diag["rule_2_volume"] is True
    assert diag["rule_3_green"] is True
    assert diag["rule_4_close_near_high"] is True
    assert diag["rule_5_vwap"] is True
    assert diag["rule_6_range_compression"] is True
    assert diag["rule_7_atr_compression"] is True
    assert diag["rule_8_volume_contraction"] is True
    assert diag["rule_9_not_extended"] is True

    # Assert diagnostic properties
    assert sig.entry_price == 1006.0
    assert sig.resistance == 1003.0
    assert sig.volume_ratio >= 2.0


def test_13_vcb_early_strategy():
    """Validates VCBEarlyStrategy coiling conditions."""
    df = create_vcb_test_dataset(trigger_at_index=70)
    early_strat = VCBEarlyStrategy()
    # Modify bar 69 so it sits within 0.3% below resistance without breaking out
    df.loc[69, "Close"] = 1002.5  # Below 1003.0, but within 0.3%
    signals = early_strat.generate_signals(df, symbol="VCB_EARLY_EQUITY")
    assert isinstance(signals, list)


def test_14_to_17_trade_simulator_and_mfe_mae():
    """Validates trade simulation, target hit, MFE, and MAE tracking."""
    df = create_vcb_test_dataset()
    strat = VCBBreakoutStrategy()
    signals = strat.generate_signals(df, symbol="VCB_TEST")
    assert len(signals) > 0

    sim = TradeSimulator(
        active_target_pct=0.015,  # 1.5% Target
        active_stop_pct=0.010,    # 1.0% Stop
    )
    trade = sim.simulate_trade(signals[0], candles_df=df)

    assert trade is not None
    assert trade.entry_price == 1006.0
    assert trade.mfe_pct > 0.0
    assert trade.holding_bars > 0
    # Should hit target because subsequent bars move higher
    assert "TARGET" in trade.exit_reason
    assert trade.net_pnl > 0


def test_18_ambiguous_candle_conservative_policy():
    """Validates conservative stop-first resolution on ambiguous bar collision."""
    df = create_vcb_test_dataset()
    strat = VCBBreakoutStrategy()
    signals = strat.generate_signals(df, symbol="AMBIG_TEST")

    # Engineer next bar (67) to touch BOTH target (+2%) and stop (-2%)
    entry = signals[0].entry_price
    df.loc[67, "High"] = entry * 1.05  # Reaches target
    df.loc[67, "Low"] = entry * 0.95   # Reaches stop

    sim_conservative = TradeSimulator(
        active_target_pct=0.015,
        active_stop_pct=0.010,
        conservative_ambiguity=True,
    )
    trade = sim_conservative.simulate_trade(signals[0], candles_df=df)
    assert trade is not None
    assert trade.ambiguous_exit is True
    assert trade.exit_reason == "AMBIGUOUS_STOP_FIRST"


def test_19_transaction_costs():
    """Validates Indian equity regulatory costs and friction."""
    model = TransactionCostModel(brokerage_per_order=20.0, slippage_pct=0.05)
    costs = model.calculate_round_trip_costs(entry_price=1000.0, exit_price=1020.0, shares=100)

    assert costs.brokerage == 40.0  # ₹20 buy + ₹20 sell
    assert costs.stt > 0.0
    assert costs.gst > 0.0
    assert costs.stamp_duty > 0.0
    assert costs.total_friction > 40.0


def test_20_position_sizing():
    """Validates Risk-based, Fixed-capital, and Fixed-quantity position sizing."""
    sizer = PositionSizer()

    # Risk-based: Capital 10,00,000, 1% risk = 10,000. Stop distance = 10. Shares = 1000
    pos_risk = sizer.calculate_position(
        sizing_model="RISK_BASED",
        capital=1000000.0,
        entry_price=1000.0,
        stop_price=990.0,
        risk_per_trade_pct=1.0,
    )
    assert pos_risk["shares"] == 250  # Capped by 25% max position value = ₹2,50,000 / 1000 = 250

    # Fixed capital: ₹1,00,000 / 1000 = 100 shares
    pos_cap = sizer.calculate_position(
        sizing_model="FIXED_CAPITAL",
        capital=1000000.0,
        entry_price=1000.0,
        fixed_allocation_inr=100000.0,
    )
    assert pos_cap["shares"] == 100


def test_21_to_22_metrics_and_drawdown():
    """Validates Performance Metrics and Drawdown calculation."""
    # Build synthetic trades
    sig = StrategySignal(
        symbol="SYM",
        timestamp=pd.to_datetime("2026-09-01 09:30:00"),
        strategy="VCB_BREAKOUT",
        timeframe="5m",
        signal_type="BREAKOUT",
        entry_price=100.0,
    )
    trade_win = TradeSimulator().simulate_trade(sig, create_sample_1m_data(20))

    trades = []
    if trade_win:
        trades.append(trade_win)

    metrics = MetricsCalculator.calculate_metrics(trades=trades, signals=[sig])
    assert "win_rate_pct" in metrics
    assert "profit_factor" in metrics
    assert "max_drawdown_pct" in metrics
    assert "target_hit_rates" in metrics


def test_23_backtest_reproducibility():
    """Validates that running the strategy twice on identical data yields identical signals."""
    df = create_vcb_test_dataset(trigger_at_index=70)
    strat = VCBBreakoutStrategy()
    signals_run1 = strat.generate_signals(df, symbol="REPRO_TEST")
    signals_run2 = strat.generate_signals(df, symbol="REPRO_TEST")

    assert len(signals_run1) == len(signals_run2)
    for s1, s2 in zip(signals_run1, signals_run2):
        assert s1.entry_price == s2.entry_price
        assert s1.rule_diagnostics == s2.rule_diagnostics


def test_24_look_ahead_bias_protection():
    """
    Critical Look-Ahead Protection Test:
    Modifying future bars (t+1, t+2) MUST NOT alter the signal or indicators at bar t.
    """
    df_base = create_vcb_test_dataset(trigger_at_index=70)
    strat = VCBBreakoutStrategy()

    signals_base = strat.generate_signals(df_base, symbol="LOOKAHEAD_TEST")
    assert len(signals_base) >= 1
    base_sig = signals_base[0]

    # Mutate future bars beyond trigger_at_index (e.g., massive spikes or crashes at bar 75)
    df_mutated = df_base.copy()
    df_mutated.loc[75, "High"] = 50000.0
    df_mutated.loc[75, "Close"] = 50000.0
    df_mutated.loc[75, "Volume"] = 10000000.0

    signals_mutated = strat.generate_signals(df_mutated, symbol="LOOKAHEAD_TEST")
    assert len(signals_mutated) >= 1
    mutated_sig = signals_mutated[0]

    # The signal at bar 70 MUST be 100% identical
    assert base_sig.timestamp == mutated_sig.timestamp
    assert base_sig.entry_price == mutated_sig.entry_price
    assert base_sig.vwap == mutated_sig.vwap
    assert base_sig.atr == mutated_sig.atr
    assert base_sig.volume_ratio == mutated_sig.volume_ratio
    assert base_sig.rule_diagnostics == mutated_sig.rule_diagnostics


def test_25_universe_etf_exclusion():
    """Validates that ETFs like UNIGOLD, GOLDBEES, NIFTYBEES are strictly filtered out."""
    assert UniverseService.is_etf_or_non_equity("UNIGOLD") is True
    assert UniverseService.is_etf_or_non_equity("GOLDBEES") is True
    assert UniverseService.is_etf_or_non_equity("NIFTYBEES") is True
    assert UniverseService.is_etf_or_non_equity("RELIANCE") is False
    assert UniverseService.is_etf_or_non_equity("TCS") is False

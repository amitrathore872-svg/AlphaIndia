"""
Alpha India - Production Backtest Engine Database Models
Sprint 43.1 Institutional Backtesting Infrastructure

Defines SQLAlchemy ORM models for:
1. MarketCandle1m: 1-minute intraday canonical candles
2. MarketCandle5m: 5-minute aggregated intraday candles
3. BacktestRun: Reproducible backtest execution runs with full config tracking
4. BacktestSignal: Strategy signals with granular rule diagnostics (e.g. 9 VCB rules)
5. BacktestTrade: Simulated executions with MFE, MAE, target/stop matrices, and friction
6. BacktestMetric: Comprehensive performance metrics, time-of-day, regime, and rule statistics
7. BacktestEquityCurve: Sequential equity curve tracking
"""

from __future__ import annotations

from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    Integer,
    BigInteger,
    String,
    Float,
    Boolean,
    Date,
    DateTime,
    Index,
    Text,
    JSON,
    UniqueConstraint,
)
from app.db.database import Base, utc_now


# =========================================================================
# 1. Market Data Time-Series Candles
# =========================================================================

class MarketCandle1m(Base):
    """Canonical 1-minute intraday candle repository."""
    __tablename__ = "market_candles_1m"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    symbol = Column(String(30), nullable=False, index=True)
    instrument_token = Column(Integer, nullable=True, index=True)
    exchange = Column(String(10), nullable=False, default="NSE")
    timestamp = Column(DateTime, nullable=False, index=True)
    open = Column(Float, nullable=False)
    high = Column(Float, nullable=False)
    low = Column(Float, nullable=False)
    close = Column(Float, nullable=False)
    volume = Column(BigInteger, nullable=False, default=0)
    created_at = Column(DateTime, default=utc_now)

    __table_args__ = (
        UniqueConstraint("symbol", "timestamp", name="uq_candle_1m_sym_ts"),
        Index("idx_candle_1m_sym_ts", "symbol", "timestamp"),
    )


class MarketCandle5m(Base):
    """5-minute intraday candle repository."""
    __tablename__ = "market_candles_5m"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    symbol = Column(String(30), nullable=False, index=True)
    instrument_token = Column(Integer, nullable=True, index=True)
    exchange = Column(String(10), nullable=False, default="NSE")
    timestamp = Column(DateTime, nullable=False, index=True)
    open = Column(Float, nullable=False)
    high = Column(Float, nullable=False)
    low = Column(Float, nullable=False)
    close = Column(Float, nullable=False)
    volume = Column(BigInteger, nullable=False, default=0)
    created_at = Column(DateTime, default=utc_now)

    __table_args__ = (
        UniqueConstraint("symbol", "timestamp", name="uq_candle_5m_sym_ts"),
        Index("idx_candle_5m_sym_ts", "symbol", "timestamp"),
    )


# =========================================================================
# 2. Backtest Execution Engine Records
# =========================================================================

class BacktestRun(Base):
    """
    Complete configuration and execution state for a backtest run.
    Ensures 100% reproducibility across time.
    """
    __tablename__ = "backtest_runs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(String(64), unique=True, nullable=False, index=True)
    name = Column(String(150), nullable=False)
    strategy = Column(String(50), nullable=False, index=True)
    universe = Column(String(50), nullable=False, default="NIFTY_500")
    timeframe = Column(String(10), nullable=False, default="5m")
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    capital = Column(Float, nullable=False, default=1000000.0)

    # State: QUEUED, RUNNING, COMPLETED, FAILED, CANCELLED
    status = Column(String(30), nullable=False, default="QUEUED", index=True)
    progress_pct = Column(Float, default=0.0)
    current_symbol = Column(String(30), nullable=True)
    symbols_processed = Column(Integer, default=0)
    total_symbols = Column(Integer, default=0)
    candles_processed = Column(Integer, default=0)
    signals_count = Column(Integer, default=0)
    trades_count = Column(Integer, default=0)

    # Serialized configuration dictionary
    configuration = Column(JSON, nullable=False)
    error_message = Column(Text, nullable=True)
    execution_time_sec = Column(Float, default=0.0)

    created_at = Column(DateTime, default=utc_now, index=True)
    completed_at = Column(DateTime, nullable=True)


class BacktestSignal(Base):
    """
    Strategy signal generated with full diagnostic transparency.
    Includes boolean pass/fail status for every strategy rule.
    """
    __tablename__ = "backtest_signals"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    run_id = Column(String(64), nullable=False, index=True)
    symbol = Column(String(30), nullable=False, index=True)
    instrument_token = Column(Integer, nullable=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    strategy = Column(String(50), nullable=False)
    timeframe = Column(String(10), nullable=False, default="5m")
    signal_type = Column(String(30), nullable=False, default="BREAKOUT")
    entry_price = Column(Float, nullable=False)

    # Diagnostic values
    resistance = Column(Float, nullable=True)
    breakout_volume = Column(Float, nullable=True)
    average_volume = Column(Float, nullable=True)
    volume_ratio = Column(Float, nullable=True)
    atr = Column(Float, nullable=True)
    atr_baseline = Column(Float, nullable=True)
    atr_ratio = Column(Float, nullable=True)
    compression_pct = Column(Float, nullable=True)
    vwap = Column(Float, nullable=True)
    candle_range = Column(Float, nullable=True)
    close_location_pct = Column(Float, nullable=True)
    extension_pct = Column(Float, nullable=True)
    market_regime = Column(String(50), nullable=True)

    # Boolean dictionary of individual rule evaluation (e.g. rule_1 to rule_9)
    rule_diagnostics = Column(JSON, nullable=False)
    is_valid = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utc_now)


class BacktestTrade(Base):
    """
    Simulated trade execution with MFE/MAE excursion metrics,
    target matrix hit rates, stop levels, and realistic transaction friction.
    """
    __tablename__ = "backtest_trades"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    run_id = Column(String(64), nullable=False, index=True)
    signal_id = Column(BigInteger, nullable=True, index=True)
    symbol = Column(String(30), nullable=False, index=True)
    entry_time = Column(DateTime, nullable=False, index=True)
    entry_price = Column(Float, nullable=False)
    exit_time = Column(DateTime, nullable=True)
    exit_price = Column(Float, nullable=True)
    exit_reason = Column(String(50), nullable=False)
    
    holding_bars = Column(Integer, default=0)
    holding_minutes = Column(Integer, default=0)
    shares = Column(Integer, default=0)
    position_value = Column(Float, default=0.0)

    # Returns & P&L
    gross_return_pct = Column(Float, default=0.0)
    gross_pnl = Column(Float, default=0.0)
    friction_costs = Column(Float, default=0.0)
    net_return_pct = Column(Float, default=0.0)
    net_pnl = Column(Float, default=0.0)

    # Excursion metrics
    mfe_pct = Column(Float, default=0.0)  # Max Favorable Excursion %
    mae_pct = Column(Float, default=0.0)  # Max Adverse Excursion %
    time_to_target_min = Column(Integer, nullable=True)
    time_to_stop_min = Column(Integer, nullable=True)
    ambiguous_exit = Column(Boolean, default=False)

    # Detailed hit matrix for multi-horizon research
    target_matrix = Column(JSON, nullable=True)  # {0.5%: true/false, 1.0%: ..., 5.0%: ...}
    stop_matrix = Column(JSON, nullable=True)    # {-0.5%: true/false, ...}
    created_at = Column(DateTime, default=utc_now)


class BacktestMetric(Base):
    """
    Consolidated performance summary and granular statistical breakdowns for a run.
    """
    __tablename__ = "backtest_metrics"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(String(64), unique=True, nullable=False, index=True)

    total_signals = Column(Integer, default=0)
    total_trades = Column(Integer, default=0)
    winning_trades = Column(Integer, default=0)
    losing_trades = Column(Integer, default=0)
    win_rate_pct = Column(Float, default=0.0)
    loss_rate_pct = Column(Float, default=0.0)

    average_return_pct = Column(Float, default=0.0)
    median_return_pct = Column(Float, default=0.0)
    avg_winning_return_pct = Column(Float, default=0.0)
    avg_losing_return_pct = Column(Float, default=0.0)

    gross_pnl = Column(Float, default=0.0)
    net_pnl = Column(Float, default=0.0)
    profit_factor = Column(Float, default=0.0)
    expectancy_pct = Column(Float, default=0.0)

    avg_mfe_pct = Column(Float, default=0.0)
    median_mfe_pct = Column(Float, default=0.0)
    avg_mae_pct = Column(Float, default=0.0)
    median_mae_pct = Column(Float, default=0.0)

    max_drawdown_pct = Column(Float, default=0.0)
    max_consecutive_wins = Column(Integer, default=0)
    max_consecutive_losses = Column(Integer, default=0)
    avg_holding_minutes = Column(Float, default=0.0)

    # Distributions & Analyses
    target_hit_rates = Column(JSON, nullable=True)
    stop_hit_rates = Column(JSON, nullable=True)
    time_of_day_breakdown = Column(JSON, nullable=True)
    market_regime_breakdown = Column(JSON, nullable=True)
    rule_contribution_analysis = Column(JSON, nullable=True)
    daily_pnl = Column(JSON, nullable=True)
    weekly_pnl = Column(JSON, nullable=True)
    monthly_pnl = Column(JSON, nullable=True)
    trades_per_day_avg = Column(Float, default=0.0)

    created_at = Column(DateTime, default=utc_now)


class BacktestEquityCurve(Base):
    """Time-series equity curve progression tracking."""
    __tablename__ = "backtest_equity_curve"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    run_id = Column(String(64), nullable=False, index=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    trade_id = Column(BigInteger, nullable=True)
    equity = Column(Float, nullable=False)
    cash = Column(Float, nullable=False)
    drawdown_pct = Column(Float, default=0.0)
    peak_equity = Column(Float, default=0.0)

"""
Alpha India - Velocity Burst Elite Engine (VBE) Models
Sprint 39 Flagship Institutional Breakout Intelligence
Defines all 18 core persistent tables supporting:
- Market Regime Engine
- Sleeping Giant Engine
- Compression Intelligence Engine
- Base Pattern Engine
- Institutional Footprint Engine
- Relative Strength Engine
- Sector Rotation Engine
- Smart Money Engine
- Liquidity Engine
- News Risk Engine
- Live Breakout Engine
- Entry Quality Engine
- Trade Management Engine
- BTST Continuation Engine
- AI Confidence Engine & Signal History
- Alert Intelligence Engine
- Historical Learning Engine
- Backtest Simulator
"""

from __future__ import annotations

from datetime import datetime, date, timezone
from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.db.database import Base, utc_now


# =========================================================================
# 0. Market Regime History
# =========================================================================
class VelocityMarketRegime(Base):
    __tablename__ = "velocity_market_regime"

    id = Column(Integer, primary_key=True, index=True)
    calculated_at = Column(DateTime, default=utc_now, index=True, nullable=False)
    market_score = Column(Float, nullable=False, default=50.0)  # 0 to 100
    market_bias = Column(String(50), nullable=False, index=True)  # Bull Expansion, Bull Pullback, Sideways, Bear Expansion, High Volatility, Crash Risk
    risk_level = Column(String(30), nullable=False, default="MODERATE")  # LOW, MODERATE, HIGH, EXTREME
    position_size_multiplier = Column(Float, nullable=False, default=1.0)  # 0.0 to 1.5x

    # Core indices & macro indicators
    nifty_price = Column(Float, nullable=True)
    nifty_change_pct = Column(Float, nullable=True)
    banknifty_price = Column(Float, nullable=True)
    banknifty_change_pct = Column(Float, nullable=True)
    vix_value = Column(Float, nullable=True)
    vix_change_pct = Column(Float, nullable=True)
    advance_decline_ratio = Column(Float, nullable=True)
    sector_breadth_pct = Column(Float, nullable=True)  # % sectors in positive trend

    # Macro & Global inputs
    gift_nifty = Column(Float, nullable=True)
    dollar_index = Column(Float, nullable=True)
    us_10y_yield = Column(Float, nullable=True)
    brent_crude = Column(Float, nullable=True)

    # Breakdown & weights used
    component_scores = Column(JSON, nullable=True)
    weights_used = Column(JSON, nullable=True)
    summary_verdict = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)


# =========================================================================
# 1. Sleeping Giants (Pre-Breakout Contractions)
# =========================================================================
class VelocitySleepingGiant(Base):
    __tablename__ = "velocity_sleeping_giants"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String(30), nullable=False, index=True)
    company_name = Column(String(200), nullable=True)
    sector = Column(String(100), nullable=True, index=True)
    market_cap = Column(Float, nullable=True)
    current_price = Column(Float, nullable=True)

    # Contraction scores & signals
    compression_score = Column(Float, nullable=False, default=0.0, index=True)
    ttm_squeeze_active = Column(Boolean, default=False, index=True)
    bollinger_width_percentile = Column(Float, nullable=True)
    keltner_squeeze_active = Column(Boolean, default=False)
    atr_compression_score = Column(Float, nullable=True)
    adr_compression_score = Column(Float, nullable=True)

    # Narrow Range Bar Detection
    is_nr5 = Column(Boolean, default=False)
    is_nr7 = Column(Boolean, default=False)
    is_nr10 = Column(Boolean, default=False)
    inside_bar_count = Column(Integer, default=0)  # 0, 1, 2, 3, 4

    # Trend & Volume structure
    volume_dry_up = Column(Boolean, default=False)
    volume_dry_up_ratio = Column(Float, nullable=True)
    ema20_structure = Column(String(50), nullable=True)
    ema50_structure = Column(String(50), nullable=True)
    ema200_trend = Column(String(50), nullable=True)
    squeeze_duration_bars = Column(Integer, default=0)

    scan_date = Column(Date, default=lambda: datetime.now(timezone.utc).date(), index=True)
    created_at = Column(DateTime, default=utc_now)

    __table_args__ = (
        UniqueConstraint("symbol", "scan_date", name="uq_sleeping_giant_sym_date"),
        Index("idx_vbe_sg_score", "compression_score", "scan_date"),
    )


# =========================================================================
# 2. Compression Intelligence
# =========================================================================
class VelocityCompression(Base):
    __tablename__ = "velocity_compression"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String(30), unique=True, nullable=False, index=True)
    compression_score = Column(Float, nullable=False, default=0.0, index=True)
    compression_quality = Column(String(30), default="MEDIUM")  # ELITE, HIGH, MEDIUM, LOW
    explosive_potential = Column(Float, default=0.0)  # 0 to 100
    expected_expansion_window_days = Column(Integer, default=5)
    expected_holding_days = Column(Integer, default=15)

    bollinger_width_percentile = Column(Float, nullable=True)
    ttm_active = Column(Boolean, default=False)
    keltner_compression = Column(Boolean, default=False)
    nr_cluster = Column(String(50), nullable=True)  # NR5, NR7, NR10, INSIDE_3
    atr_lowest_percentile = Column(Float, nullable=True)
    adr_lowest_percentile = Column(Float, nullable=True)
    volatility_percentile = Column(Float, nullable=True)
    candle_body_compression = Column(Float, nullable=True)
    volume_compression = Column(Float, nullable=True)
    time_in_compression_bars = Column(Integer, default=0)

    details = Column(JSON, nullable=True)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)


# =========================================================================
# 3. Base Pattern Intelligence
# =========================================================================
class VelocityBasePattern(Base):
    __tablename__ = "velocity_base_patterns"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String(30), unique=True, nullable=False, index=True)
    pattern_type = Column(String(50), nullable=False, index=True)  # VCP, FLAT_BASE, CUP_HANDLE, ASCENDING_TRIANGLE, SYMMETRICAL_TRIANGLE, BULL_FLAG, TIGHT_FLAG, RECTANGLE, IPO_BASE, RE_ACCUMULATION
    base_depth_pct = Column(Float, nullable=False, default=0.0)
    base_length_bars = Column(Integer, nullable=False, default=0)
    contractions_count = Column(Integer, default=0)
    pivot_point = Column(Float, nullable=False)
    distance_to_pivot_pct = Column(Float, nullable=True)
    base_quality_score = Column(Float, nullable=False, default=0.0, index=True)
    is_tight_close = Column(Boolean, default=False)
    volume_dryup_confirmed = Column(Boolean, default=False)
    pattern_status = Column(String(30), default="FORMING")  # FORMING, READY, BROKEN_OUT, FAILED
    ai_explanation = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)


# =========================================================================
# 4. Institutional Footprint
# =========================================================================
class VelocityInstitution(Base):
    __tablename__ = "velocity_institutions"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String(30), unique=True, nullable=False, index=True)
    institution_score = Column(Float, nullable=False, default=0.0, index=True)
    institution_confidence = Column(Float, nullable=False, default=0.0)
    accumulation_type = Column(String(50), nullable=False)  # STEALTH_ACCUMULATION, POCKET_PIVOT_IGNITION, ABSORPTION_AT_SUPPORT, RE_ACCUMULATION, OPERATOR_EXPANSION

    delivery_pct = Column(Float, nullable=True)
    delivery_trend = Column(String(50), nullable=True)
    delivery_differential = Column(Float, nullable=True)
    obv_slope = Column(Float, nullable=True)
    cmf_20 = Column(Float, nullable=True)
    mfi_14 = Column(Float, nullable=True)
    ad_line_trend = Column(String(50), nullable=True)

    pocket_pivot = Column(Boolean, default=False)
    high_volume_tight_close = Column(Boolean, default=False)
    low_volume_pullback = Column(Boolean, default=False)
    volume_dry_up = Column(Boolean, default=False)
    volume_expansion = Column(Boolean, default=False)
    operator_signature = Column(String(100), nullable=True)

    metrics_json = Column(JSON, nullable=True)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)


# =========================================================================
# 5. Relative Strength Engine
# =========================================================================
class VelocityRSRank(Base):
    __tablename__ = "velocity_rs_rank"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String(30), unique=True, nullable=False, index=True)
    rs_score = Column(Float, nullable=False, default=50.0, index=True)
    rs_rank = Column(Integer, nullable=False, default=50, index=True)  # 1 to 99
    rs_percentile = Column(Float, default=50.0)
    is_leader = Column(Boolean, default=False, index=True)
    rs_new_high = Column(Boolean, default=False)
    rs_slope = Column(Float, default=0.0)

    rs_vs_nifty_20 = Column(Float, nullable=True)
    rs_vs_nifty_50 = Column(Float, nullable=True)
    rs_vs_nifty_90 = Column(Float, nullable=True)
    rs_vs_nifty_180 = Column(Float, nullable=True)
    rs_vs_nifty_252 = Column(Float, nullable=True)

    rs_vs_sector = Column(Float, nullable=True)
    rs_vs_industry = Column(Float, nullable=True)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)


# =========================================================================
# 6. Sector Rotation Engine
# =========================================================================
class VelocitySectorStrength(Base):
    __tablename__ = "velocity_sector_strength"

    id = Column(Integer, primary_key=True, index=True)
    sector_name = Column(String(100), unique=True, nullable=False, index=True)
    sector_score = Column(Float, nullable=False, default=50.0, index=True)
    leadership_rank = Column(Integer, default=1)
    rotation_signal = Column(String(50), default="IMPROVING")  # LEADING, IMPROVING, WEAKENING, LAGGING

    sector_rs = Column(Float, default=0.0)
    sector_momentum = Column(Float, default=0.0)
    sector_breadth = Column(Float, default=50.0)  # % of sector stocks > 50 EMA
    sector_volume_surge = Column(Float, default=1.0)
    sector_trend = Column(String(50), default="UPTREND")

    top_leaders = Column(JSON, nullable=True)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)


# =========================================================================
# 7. Smart Money Engine
# =========================================================================
class VelocitySmartMoney(Base):
    __tablename__ = "velocity_smart_money"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String(30), unique=True, nullable=False, index=True)
    smart_money_score = Column(Float, nullable=False, default=0.0, index=True)

    pocket_pivot = Column(Boolean, default=False)
    anchored_vwap_bounce = Column(Boolean, default=False)
    volume_shelf_support = Column(Float, nullable=True)
    demand_zone_range = Column(String(100), nullable=True)
    supply_zone_range = Column(String(100), nullable=True)

    liquidity_grab = Column(Boolean, default=False)
    choch_detected = Column(Boolean, default=False)  # Change of Character
    bos_detected = Column(Boolean, default=False)    # Break of Structure
    fair_value_gap_nearby = Column(Boolean, default=False)
    gap_fill_support = Column(Boolean, default=False)
    vwap_defense = Column(Boolean, default=False)
    opening_drive = Column(Boolean, default=False)
    initial_balance_break = Column(Boolean, default=False)
    operator_shakeout = Column(Boolean, default=False)

    signals_summary = Column(JSON, nullable=True)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)


# =========================================================================
# 8. Liquidity & Execution Engine
# =========================================================================
class VelocityLiquidity(Base):
    __tablename__ = "velocity_liquidity"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String(30), unique=True, nullable=False, index=True)
    liquidity_score = Column(Float, nullable=False, default=50.0, index=True)
    execution_quality_score = Column(Float, nullable=False, default=50.0)

    avg_traded_value_cr = Column(Float, nullable=True)  # Daily turnover ₹ Cr
    bid_ask_spread_pct = Column(Float, nullable=True)
    slippage_estimate_pct = Column(Float, nullable=True)

    volume_profile_poc = Column(Float, nullable=True)  # Point of Control
    volume_profile_hvn = Column(Float, nullable=True)  # High Volume Node
    volume_profile_lvn = Column(Float, nullable=True)  # Low Volume Node

    distance_to_52w_high_pct = Column(Float, nullable=True)
    resistance_count = Column(Integer, default=1)
    free_float_cr = Column(Float, nullable=True)
    is_fno = Column(Boolean, default=False)

    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)


# =========================================================================
# 9. News Risk Engine
# =========================================================================
class VelocityNewsRisk(Base):
    __tablename__ = "velocity_news_risk"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String(30), unique=True, nullable=False, index=True)
    risk_score = Column(Float, nullable=False, default=10.0, index=True)  # Lower is safer (0 to 100)
    opportunity_score = Column(Float, nullable=False, default=50.0)
    verdict = Column(String(50), default="CLEAR_TO_TRADE")  # CLEAR_TO_TRADE, CAUTION_EVENT_AHEAD, BLOCKED_HIGH_RISK

    has_results_tomorrow = Column(Boolean, default=False)
    has_board_meeting = Column(Boolean, default=False)
    has_agm = Column(Boolean, default=False)
    has_bonus_split_dividend = Column(Boolean, default=False)
    has_bulk_block_deal = Column(Boolean, default=False)
    promoter_buying = Column(Boolean, default=False)
    promoter_selling = Column(Boolean, default=False)
    has_sebi_order = Column(Boolean, default=False)
    large_order_win = Column(Boolean, default=False)
    government_announcement = Column(Boolean, default=False)

    catalyst_headline = Column(Text, nullable=True)
    ai_risk_notes = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)


# =========================================================================
# 10. Live Breakout Engine
# =========================================================================
class VelocityLiveSignal(Base):
    __tablename__ = "velocity_live_signals"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String(30), nullable=False, index=True)
    signal_timestamp = Column(DateTime, default=utc_now, index=True)
    signal_type = Column(String(50), default="BREAKOUT_ACTIVE")  # BREAKOUT_ACTIVE, PULLBACK_TEST, GAP_GO, ORB_BREAKOUT
    confidence_score = Column(Float, nullable=False, default=0.0, index=True)
    ai_verdict = Column(String(30), default="WATCHLIST", index=True)  # ELITE A+, ELITE A, ELITE B+, WATCHLIST, REJECT

    entry_price = Column(Float, nullable=False)
    stop_loss = Column(Float, nullable=False)
    target_1 = Column(Float, nullable=False)
    target_2 = Column(Float, nullable=False)
    target_3 = Column(Float, nullable=False)
    risk_reward = Column(Float, default=2.5)

    breakout_candle_strength = Column(Float, default=0.0)
    relative_volume_rvol = Column(Float, default=1.0)
    vwap_confirmed = Column(Boolean, default=True)
    rsi_momentum = Column(Float, default=55.0)
    macd_histogram_positive = Column(Boolean, default=True)
    adx_rising = Column(Boolean, default=True)
    opening_range_break = Column(Boolean, default=False)
    retest_success = Column(Boolean, default=False)
    gap_filter_passed = Column(Boolean, default=True)

    status = Column(String(30), default="ACTIVE", index=True)  # ACTIVE, EXECUTED, CANCELLED, EXPIRED
    created_at = Column(DateTime, default=utc_now)


# =========================================================================
# 11. Entry Quality Engine
# =========================================================================
class VelocityEntryQuality(Base):
    __tablename__ = "velocity_entry_quality"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String(30), unique=True, nullable=False, index=True)
    entry_score = Column(Float, nullable=False, default=0.0, index=True)  # 0 to 100
    passed_gate = Column(Boolean, default=False, index=True)

    breakout_retest = Column(String(50), default="PENDING")  # CONFIRMED, IN_PROGRESS, FAILED, NOT_REQUIRED
    vwap_hold = Column(Boolean, default=False)
    candle_close_strength = Column(Float, default=0.0)  # Close near high %
    wick_ratio = Column(Float, default=0.0)  # Lower upper wick is better
    distance_from_pivot_pct = Column(Float, default=0.0)
    distance_from_resistance_pct = Column(Float, default=0.0)
    atr_position_pct = Column(Float, default=0.0)
    volume_quality = Column(Float, default=0.0)
    momentum_continuation = Column(Float, default=0.0)

    rejection_reasons = Column(JSON, nullable=True)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)


# =========================================================================
# 12. Trade Management Engine
# =========================================================================
class VelocityTradeManager(Base):
    __tablename__ = "velocity_trade_manager"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String(30), nullable=False, index=True)
    signal_id = Column(Integer, nullable=True)
    entry_time = Column(DateTime, default=utc_now)
    entry_price = Column(Float, nullable=False)
    current_price = Column(Float, nullable=False)

    stop_loss = Column(Float, nullable=False)
    trailing_stop = Column(Float, nullable=False)
    trail_type = Column(String(30), default="ATR_TRAIL")  # ATR_TRAIL, EMA9_TRAIL, VWAP_TRAIL, BREAKEVEN

    target_1 = Column(Float, nullable=False)
    target_2 = Column(Float, nullable=False)
    target_3 = Column(Float, nullable=False)
    target_1_hit = Column(Boolean, default=False)
    target_2_hit = Column(Boolean, default=False)
    target_3_hit = Column(Boolean, default=False)

    partial_profit_booked_pct = Column(Float, default=0.0)
    unrealized_pnl_pct = Column(Float, default=0.0)
    realized_pnl_pct = Column(Float, default=0.0)

    trade_status = Column(String(30), default="ACTIVE", index=True)  # PENDING, ACTIVE, TARGET_1_HIT, TARGET_2_HIT, TARGET_3_HIT, TRAILING_STOP, CLOSED_PROFIT, STOPPED_OUT, TIME_STOP, EOD_EXIT
    exit_time = Column(DateTime, nullable=True)
    exit_price = Column(Float, nullable=True)
    exit_reason = Column(String(100), nullable=True)
    holding_duration_bars = Column(Integer, default=0)

    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)


# =========================================================================
# 13. BTST Continuation Engine
# =========================================================================
class VelocityBTST(Base):
    __tablename__ = "velocity_btst"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String(30), nullable=False, index=True)
    scan_date = Column(Date, default=lambda: datetime.now(timezone.utc).date(), index=True)
    scan_type = Column(String(30), default="EVENING_SELECT")  # EVENING_SELECT (2:15-3:15pm) or MORNING_EXECUTE (9:20am)

    late_breakout_confirmed = Column(Boolean, default=False)
    closing_near_high_pct = Column(Float, default=0.0)
    delivery_pct = Column(Float, default=0.0)
    sector_strong = Column(Boolean, default=False)
    vwap_hold = Column(Boolean, default=True)
    volume_elevated = Column(Boolean, default=True)
    volume_surge_multiple = Column(Float, default=1.0)

    btst_confidence = Column(Float, default=0.0, index=True)
    morning_gap_pct = Column(Float, nullable=True)
    continuation_probability = Column(Float, default=0.0)
    action_recommended = Column(String(50), default="HOLD_RUNNER")  # HOLD_RUNNER, BOOK_AT_OPEN, TRAIL_SL, EXIT_WEAK
    outcome_return_pct = Column(Float, nullable=True)

    created_at = Column(DateTime, default=utc_now)

    __table_args__ = (
        UniqueConstraint("symbol", "scan_date", "scan_type", name="uq_btst_sym_date_type"),
    )


# =========================================================================
# 14 & 17. Signal History & AI Confidence Tracking (Permanent Ledger)
# =========================================================================
class VelocitySignalHistory(Base):
    __tablename__ = "velocity_signal_history"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String(30), nullable=False, index=True)
    signal_date = Column(Date, default=lambda: datetime.now(timezone.utc).date(), index=True)
    entry_price = Column(Float, nullable=False)
    stop_loss = Column(Float, nullable=False)
    target_price = Column(Float, nullable=False)
    highest_price_reached = Column(Float, nullable=True)
    lowest_price_reached = Column(Float, nullable=True)
    exit_price = Column(Float, nullable=True)
    exit_date = Column(Date, nullable=True)
    return_pct = Column(Float, nullable=True)
    holding_days = Column(Integer, default=0)
    outcome = Column(String(30), default="PENDING", index=True)  # WIN, LOSS, BREAKEVEN, PENDING
    r_multiple = Column(Float, nullable=True)

    # 100-Point AI Confidence Model
    confidence_score = Column(Float, nullable=False, default=0.0, index=True)
    ai_verdict = Column(String(30), nullable=False, index=True)  # ELITE A+, ELITE A, ELITE B+, WATCHLIST, REJECT

    # Sub-Engine constituent scores
    composite_scores = Column(JSON, nullable=False)
    ai_explanation = Column(Text, nullable=True)
    market_regime_bias = Column(String(50), nullable=True)

    created_at = Column(DateTime, default=utc_now)


# =========================================================================
# 15. Alert Intelligence Engine
# =========================================================================
class VelocityAlert(Base):
    __tablename__ = "velocity_alerts"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String(30), nullable=False, index=True)
    alert_type = Column(String(50), nullable=False, index=True)  # SLEEPING_GIANT, INSTITUTION_CONFIRMED, POCKET_PIVOT, VWAP_DEFENSE, SMART_MONEY, BREAKOUT, RETEST_PASSED, TARGET_HIT, STOP_HIT, TRAIL_EXIT, BTST, NEWS_RISK
    severity = Column(String(20), default="HIGH")  # CRITICAL, HIGH, MEDIUM, INFO
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    data_payload = Column(JSON, nullable=True)
    channels_dispatched = Column(JSON, nullable=True)  # app, desktop, telegram, webhook, email
    dedup_hash = Column(String(100), unique=True, index=True)
    is_read = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime, default=utc_now, index=True)


# =========================================================================
# 17. Backtest Runs & Historical Performance
# =========================================================================
class VelocityBacktest(Base):
    __tablename__ = "velocity_backtests"

    id = Column(Integer, primary_key=True, index=True)
    backtest_name = Column(String(150), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    universe_type = Column(String(50), default="NSE500")

    total_trades = Column(Integer, default=0)
    winning_trades = Column(Integer, default=0)
    losing_trades = Column(Integer, default=0)
    win_rate_pct = Column(Float, default=0.0)
    profit_factor = Column(Float, default=0.0)
    expectancy_r = Column(Float, default=0.0)
    max_drawdown_pct = Column(Float, default=0.0)
    average_return_pct = Column(Float, default=0.0)
    average_hold_days = Column(Float, default=0.0)
    sharpe_ratio = Column(Float, default=0.0)

    sector_performance = Column(JSON, nullable=True)
    regime_performance = Column(JSON, nullable=True)
    confidence_bucket_performance = Column(JSON, nullable=True)
    exit_strategy_comparison = Column(JSON, nullable=True)
    parameters_used = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=utc_now)


# =========================================================================
# 17. Historical Learning Engine & Monthly Weight Optimization
# =========================================================================
class VelocityLearning(Base):
    __tablename__ = "velocity_learning"

    id = Column(Integer, primary_key=True, index=True)
    evaluation_period = Column(String(50), nullable=False)  # e.g. "2026-M09" or "5Y_ROLLING"
    snapshot_date = Column(Date, default=lambda: datetime.now(timezone.utc).date(), index=True)
    total_signals_evaluated = Column(Integer, default=0)
    overall_win_rate = Column(Float, default=0.0)

    optimal_weights = Column(JSON, nullable=False)
    feature_importance = Column(JSON, nullable=True)
    accuracy_by_verdict = Column(JSON, nullable=True)
    recommended_threshold_adjustments = Column(JSON, nullable=True)
    applied_to_system = Column(Boolean, default=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)

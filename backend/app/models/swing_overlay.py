"""
Alpha India - Alpha Swing Overlay Engine (AIOSE v3.0) Models
Sprint S9: Institutional Tactical Swing Overlay & Watchlist Opportunity Engine
"""

from datetime import datetime
from sqlalchemy import (
    Column,
    Integer,
    BigInteger,
    String,
    Float,
    Boolean,
    DateTime,
    Text,
    JSON,
    ForeignKey,
    Index,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from app.db.database import Base


class SwingPosition(Base):
    """
    Tracks active tactical swing tranches overlaid on existing portfolio holdings.
    Maintains clean separation between core compounding shares and actively traded swing shares.
    """
    __tablename__ = "swing_positions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    portfolio_id = Column(Integer, nullable=True, index=True)
    holding_id = Column(Integer, nullable=True, index=True)
    symbol = Column(String(30), nullable=False, index=True)
    company_name = Column(String(200), nullable=True)

    # Position Split
    total_shares = Column(Float, default=0.0)
    core_shares = Column(Float, default=0.0)             # Locked long-term (never sold)
    swing_shares_allocated = Column(Float, default=0.0)  # Maximum tactical swing allocation (10-40%)
    swing_shares_open = Column(Float, default=0.0)       # Currently open active swing shares

    # State Machine (12 States)
    # ACCUMULATION_ZONE, PULLBACK_READY, BREAKOUT_TRIGGERED, SWING_ENTERED,
    # HOLDING_TREND, PROFIT_ZONE_PARTIAL, EXHAUSTION_WARNING, PROFIT_BOOKED,
    # TRAILING_STOP_TRIGGERED, REENTRY_READY, COILING_VCP, STAND_ASIDE
    current_state = Column(String(50), default="PULLBACK_READY", index=True)

    # Execution Price Levels
    avg_swing_entry_price = Column(Float, default=0.0)
    current_stop_loss = Column(Float, default=0.0)
    target_1 = Column(Float, default=0.0)                # Prior Swing High
    target_2 = Column(Float, default=0.0)                # 1.272 Fib Extension (Top Exhaustion)
    trailing_stop_type = Column(String(50), default="1.6_ATR")

    # Alpha Accounting
    realized_swing_pnl = Column(Float, default=0.0)
    unrealized_swing_pnl = Column(Float, default=0.0)
    alpha_yield_pct = Column(Float, default=0.0)         # Excess % return added on top of B&H

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("ix_swing_pos_port_sym", "portfolio_id", "symbol"),
    )


class SwingQuantSignal(Base):
    """
    15-minute / hourly algorithmic telemetry logs generated for tracked holdings & watchlists.
    """
    __tablename__ = "swing_quant_signals"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    symbol = Column(String(30), nullable=False, index=True)
    timeframe = Column(String(10), default="15M", index=True) # 15M, 1H, Daily

    # Signal Type: FAST_BUY, SNIPER_REENTRY, PROFIT_BOOK_50, BLOWOFF_TOP_EXIT, TRAIL_STOP_EXIT, NEUTRAL
    signal_type = Column(String(50), nullable=False, index=True)
    quant_score = Column(Float, default=0.0) # 0 to 100

    # Macro & Technical Context
    daily_trend_up = Column(Boolean, default=True)
    supertrend_state = Column(Integer, default=1) # 1 = Green, -1 = Red
    ema20_dist_pct = Column(Float, default=0.0)
    rsi = Column(Float, default=50.0)
    adx = Column(Float, default=25.0)
    volume_ratio = Column(Float, default=1.0)

    # Structural Pivots & Exhaustion
    last_swing_high = Column(Float, nullable=True)
    last_swing_low = Column(Float, nullable=True)
    buy_zone_min = Column(Float, nullable=True)
    buy_zone_max = Column(Float, nullable=True)
    top_exhaustion_probability = Column(Float, default=0.0) # % (0 to 100)
    exhaustion_tag = Column(String(100), nullable=True) # RSI_DIVERGENCE, BLOWOFF_CLIMAX, LIQUIDITY_SWEEP

    # Actionable Quant Advice
    recommended_action = Column(String(200), nullable=True)
    recommended_swing_pct = Column(Float, default=0.0) # 10 to 40%
    stop_loss_price = Column(Float, nullable=True)
    target_1_price = Column(Float, nullable=True)
    target_2_price = Column(Float, nullable=True)
    reward_risk_ratio = Column(Float, default=0.0)

    timestamp = Column(DateTime, default=datetime.utcnow, index=True)


class SwingTradeLog(Base):
    """
    Historical execution ledger for executed swing tranches.
    """
    __tablename__ = "swing_trade_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    symbol = Column(String(30), nullable=False, index=True)
    portfolio_id = Column(Integer, nullable=True)
    
    entry_time = Column(DateTime, nullable=False)
    exit_time = Column(DateTime, nullable=True)
    entry_price = Column(Float, nullable=False)
    exit_price = Column(Float, nullable=True)
    shares_traded = Column(Float, nullable=False)
    
    gain_pct = Column(Float, default=0.0)
    realized_pnl = Column(Float, default=0.0)
    exit_reason = Column(String(100), nullable=True) # FIB_EXT_TOP, SWING_HIGH_REJECT, BLOWOFF_TOP, STOP_LOSS, EMA20_TRAIL
    holding_hours = Column(Float, default=0.0)
    setup_dna = Column(String(100), nullable=True) # Trend_Supertrend, EMA_Pullback, RSI_Momentum

    created_at = Column(DateTime, default=datetime.utcnow)


class SwingStockProfile(Base):
    """
    Cached Adaptive Indicator DNA profile for each stock symbol.
    """
    __tablename__ = "swing_stock_profiles"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    symbol = Column(String(30), unique=True, index=True, nullable=False)
    company_name = Column(String(200), nullable=True)
    
    best_indicator = Column(String(50), default="EMA_Pullback")
    weight_supertrend = Column(Float, default=25.0)
    weight_ema_pullback = Column(Float, default=35.0)
    weight_rsi_momentum = Column(Float, default=25.0)
    weight_swing_liquidity = Column(Float, default=15.0)

    historical_win_rate = Column(Float, default=60.0)
    historical_profit_factor = Column(Float, default=2.5)
    
    last_profiled_at = Column(DateTime, default=datetime.utcnow)

"""
Alpha India - Sovereign Intraday Cockpit Radar Models
Sprint 42.5 Flagship Real-Time Day Trading Models

Defines the database schema for:
1. SovereignIntradaySignal: Live, active signals strictly inside their operational temporal windows.
2. SovereignIntradayLog: Permanent audit ledger tracking realized trades, P&L on ₹1,00,000 capital, and auto-expired setups.
"""

from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    Boolean,
    Date,
    DateTime,
    Index,
    Text,
)
from app.db.database import Base, utc_now


class SovereignIntradaySignal(Base):
    """
    Active candidate currently within its valid temporal execution window.
    Automatically purged and migrated to SovereignIntradayLog upon window expiry or exit.
    """
    __tablename__ = "sovereign_intraday_signals"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    symbol = Column(String(30), nullable=False, unique=True, index=True)
    company_name = Column(String(255), nullable=True)
    sector = Column(String(100), nullable=True, default="Institutional Equity")

    # Chamber categorization
    # CHAMBER_A_TITAN (F&O Leader), CHAMBER_B_CASH (High-Beta Cash), CHAMBER_C_LONDON (European Breakout)
    chamber = Column(String(50), nullable=False, default="CHAMBER_A_TITAN", index=True)
    chamber_label = Column(String(100), nullable=False, default="Chamber A: F&O Institutional Titan")

    # Temporal Execution Window
    window_name = Column(String(100), default="09:15 - 09:45 Ignition Window")
    window_start = Column(String(10), default="09:15")
    window_end = Column(String(10), default="09:45")
    
    # Status: ARMED (Waiting for trigger), TRIGGERED (Crossed buy level), RUNNING (Position active), EXPIRED
    status = Column(String(30), default="ARMED", index=True)

    # Live prices & levels
    cmp = Column(Float, nullable=False, default=0.0)
    day_change_pct = Column(Float, default=0.0)
    trigger_entry = Column(Float, nullable=False, default=0.0)
    stop_loss = Column(Float, nullable=False, default=0.0)
    target_1 = Column(Float, nullable=False, default=0.0)
    target_2 = Column(Float, nullable=False, default=0.0)
    risk_per_share = Column(Float, default=0.0)
    risk_pct = Column(Float, default=0.0)

    # Microstructure indicators
    rvol = Column(Float, default=1.0)
    open_low_wick_pct = Column(Float, default=0.0)
    cpr_width_pct = Column(Float, default=0.25)
    vwap_distance_pct = Column(Float, default=0.0)
    imbalance_ratio = Column(Float, default=1.0)
    conviction_score = Column(Integer, default=88)  # 0 to 100

    source = Column(String(50), default="FIVEPAISA_REALTIME")
    is_active = Column(Boolean, default=True, index=True)

    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)


class SovereignIntradayLog(Base):
    """
    Permanent audit ledger of all closed trades, velocity stalls, and auto-expired setups.
    Tracks equity curve progression starting from ₹1,00,000 base capital.
    """
    __tablename__ = "sovereign_intraday_logs"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    date = Column(Date, nullable=False, index=True)
    symbol = Column(String(30), nullable=False, index=True)
    company_name = Column(String(255), nullable=True)
    chamber = Column(String(50), nullable=False, default="CHAMBER_A_TITAN")

    # Time tracking
    entry_time = Column(String(10), nullable=True)
    exit_time = Column(String(10), nullable=True)

    # Execution prices
    entry_price = Column(Float, nullable=False, default=0.0)
    exit_price = Column(Float, nullable=False, default=0.0)
    stop_loss = Column(Float, nullable=False, default=0.0)

    # Multiples & P&L based on ₹1,00,000 Capital
    realized_r = Column(Float, default=0.0)
    shares = Column(Integer, default=0)
    position_val_inr = Column(Float, default=0.0)
    gross_pnl_inr = Column(Float, default=0.0)
    friction_inr = Column(Float, default=40.0)  # Brokerage + taxes
    net_pnl_inr = Column(Float, default=0.0)
    account_balance_inr = Column(Float, default=100000.0)

    # Outcome: WIN, LOSS, BREAKEVEN, EXPIRED_UNTRIGGERED, VELOCITY_STALL
    outcome = Column(String(30), nullable=False, default="WIN", index=True)
    close_reason = Column(Text, nullable=True)

    created_at = Column(DateTime, default=utc_now)


Index("idx_sov_intraday_log_date_sym", SovereignIntradayLog.date, SovereignIntradayLog.symbol)

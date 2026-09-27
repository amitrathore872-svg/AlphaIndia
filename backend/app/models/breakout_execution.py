"""
Alpha India - Breakout Execution Engine Models
Tracks and monitors focused pre-breakout candidates for live breakout execution.
"""

from datetime import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    Boolean,
    DateTime,
    Text,
    Index,
)
from app.db.database import Base, utc_now


class BreakoutExecutionCandidate(Base):
    """
    Candidate stock enrolled into the Breakout Execution Engine.
    Continuously monitored for proximity, breakout trigger crossing,
    volume pace surge, and buy zone entry.
    """
    __tablename__ = "breakout_execution_candidates"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    symbol = Column(String(30), nullable=False, unique=True, index=True)
    company_name = Column(String(255), nullable=True)
    sector = Column(String(100), nullable=True)
    pattern_tag = Column(String(50), default="SUPER_COIL")
    conviction_score = Column(Integer, default=75)
    setup_tier = Column(String(50), default="A+ SUPER COIL")

    # Initial levels at time of enrollment
    added_at_cmp = Column(Float, nullable=False, default=0.0)
    current_cmp = Column(Float, nullable=False, default=0.0)
    day_change_pct = Column(Float, default=0.0)

    # Execution Blueprint Levels
    trigger_price = Column(Float, nullable=False, default=0.0)  # Cheat entry / pivot high
    stop_loss = Column(Float, nullable=False, default=0.0)      # Base low / risk floor
    target_1 = Column(Float, nullable=False, default=0.0)       # +9% expansion
    target_2 = Column(Float, nullable=False, default=0.0)       # +18% runner
    buy_zone_max = Column(Float, nullable=False, default=0.0)   # trigger * 1.015 (max allowable chase)
    risk_reward = Column(Float, default=3.0)

    # Live telemetry
    distance_to_trigger_pct = Column(Float, default=0.0)  # % distance from CMP to trigger
    volume_pace_ratio = Column(Float, default=1.0)        # Current intraday vol pace vs 20-DMA

    # Execution State: COILING, READY, TRIGGERED, EXTENDED, FAILED
    execution_status = Column(String(30), default="COILING", index=True)
    triggered_at = Column(DateTime, nullable=True)
    alert_dispatched = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True, index=True)
    auto_enrolled = Column(Boolean, default=False)

    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    __table_args__ = (
        Index("ix_breakout_exec_sym_status", "symbol", "execution_status"),
    )

"""
Alpha India - Momentum Radar Watchlist Model
Sprint 41 — Full Universe Off-Market Scanner & Live Breakout Monitor

Stores stocks that passed ≥7/10 momentum conditions in the off-market deep scan.
These are promoted to live intraday monitoring during market hours for real-time breakout detection.
"""

from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String, Text, JSON
from app.db.database import Base


class MomentumRadarWatchlist(Base):
    __tablename__ = "momentum_radar_watchlist"

    id = Column(Integer, primary_key=True, index=True)

    # Stock identity
    symbol = Column(String(30), nullable=False, index=True)
    company_name = Column(String(200), nullable=True)
    sector = Column(String(100), nullable=True)

    # Scoring — set during off-market universe scan
    match_count = Column(Integer, default=0, index=True)   # 0–10 conditions passed
    conviction_score = Column(Integer, default=0, index=True)
    conditions_passed = Column(JSON, nullable=True)        # dict of filter booleans

    # Price & indicators at time of scan
    cmp_at_scan = Column(Float, nullable=True)
    daily_rsi_at_scan = Column(Float, nullable=True)
    weekly_rsi_at_scan = Column(Float, nullable=True)
    monthly_rsi_at_scan = Column(Float, nullable=True)
    vol_surge_ratio_at_scan = Column(Float, nullable=True)
    daily_bb_upper = Column(Float, nullable=True)
    weekly_bb_upper = Column(Float, nullable=True)
    weekly_wma30 = Column(Float, nullable=True)
    weekly_wma50 = Column(Float, nullable=True)

    # Trade blueprint
    entry_trigger = Column(Float, nullable=True)
    stop_loss = Column(Float, nullable=True)
    target_1 = Column(Float, nullable=True)
    target_2 = Column(Float, nullable=True)
    risk_reward = Column(Float, nullable=True)

    # Scan metadata
    scan_type = Column(String(30), default="UNIVERSE_FULL", index=True)  # UNIVERSE_FULL | MANUAL
    universe_size = Column(Integer, nullable=True)          # Total stocks scanned in that run

    # Intraday live monitoring state
    is_active_monitor = Column(Boolean, default=True, index=True)   # Being monitored during market hours
    breakout_triggered = Column(Boolean, default=False, index=True)  # ≥10/10 met during intraday scan
    breakout_triggered_at = Column(DateTime(timezone=True), nullable=True)
    intraday_cmp = Column(Float, nullable=True)             # Last live price during market hours
    intraday_match_count = Column(Integer, nullable=True)   # Match count from last intraday check

    # Timestamps
    scanned_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    last_intraday_check = Column(DateTime(timezone=True), nullable=True)
    promoted_date = Column(String(20), nullable=True)       # YYYY-MM-DD of the scan date

    # Notes
    notes = Column(Text, nullable=True)

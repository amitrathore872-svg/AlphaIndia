"""
Alpha India - CPR Compression Engine Models
Sprint 38.5 Institutional Quant Scanner
Defines the schema for daily Central Pivot Range (CPR) calculations,
compression quality indicators, triple CPR confluence, and trading plan levels.
"""

from datetime import datetime, date
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


class CPRScannerDaily(Base):
    __tablename__ = "cpr_scanner_daily"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String(30), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)

    # Core CPR Parameters
    pivot = Column(Float, nullable=False)
    bc = Column(Float, nullable=False)
    tc = Column(Float, nullable=False)
    cpr_width_pct = Column(Float, nullable=False)  # ABS(TC - BC) / Prev Close * 100
    category = Column(String(30), nullable=False)  # Ultra Compression, Very Strong, Strong, Average, Ignore

    # Universe Ranking
    cpr_rank = Column(Integer, nullable=False)
    cpr_percentile = Column(Float, nullable=False)
    is_top_1_pct = Column(Boolean, default=False)
    is_top_5_pct = Column(Boolean, default=False)
    is_top_10_pct = Column(Boolean, default=False)

    # Institutional Scores (0-100)
    compression_score = Column(Float, nullable=False, index=True)
    breakout_score = Column(Float, nullable=False, index=True)

    # Compression Quality Flags
    is_nr7 = Column(Boolean, default=False)
    is_nr4 = Column(Boolean, default=False)
    is_inside_bar = Column(Boolean, default=False)
    is_bollinger_squeeze = Column(Boolean, default=False)
    is_atr_compression = Column(Boolean, default=False)
    is_volume_dryup = Column(Boolean, default=False)
    is_supertrend_bullish = Column(Boolean, default=False)
    is_ema_aligned = Column(Boolean, default=False)
    is_adx_rising = Column(Boolean, default=False)

    # Triple CPR Confluence
    is_triple_cpr = Column(Boolean, default=False)
    daily_narrow = Column(Boolean, default=False)
    weekly_narrow = Column(Boolean, default=False)
    monthly_narrow = Column(Boolean, default=False)
    weekly_pivot = Column(Float, nullable=True)
    weekly_bc = Column(Float, nullable=True)
    weekly_tc = Column(Float, nullable=True)
    weekly_width_pct = Column(Float, nullable=True)
    monthly_pivot = Column(Float, nullable=True)
    monthly_bc = Column(Float, nullable=True)
    monthly_tc = Column(Float, nullable=True)
    monthly_width_pct = Column(Float, nullable=True)

    # Price & Technical Context
    current_price = Column(Float, nullable=False)
    prev_close = Column(Float, nullable=False)
    prev_high = Column(Float, nullable=False)
    prev_low = Column(Float, nullable=False)
    prev_open = Column(Float, nullable=False)
    volume = Column(Float, nullable=True)
    volume_ratio_20d = Column(Float, nullable=True)
    dma_20 = Column(Float, nullable=True)
    dma_50 = Column(Float, nullable=True)
    dma_200 = Column(Float, nullable=True)
    rsi_14 = Column(Float, nullable=True)
    adx_14 = Column(Float, nullable=True)
    atr_14 = Column(Float, nullable=True)

    # Institutional Entry Plan & Asymmetric Geometry
    entry_price = Column(Float, nullable=False)  # BUY LEVEL = TC
    stop_loss = Column(Float, nullable=False)    # STOP LOSS = BC
    target1 = Column(Float, nullable=False)      # TC + 1 ATR
    target2 = Column(Float, nullable=False)      # TC + 2 ATR
    target3 = Column(Float, nullable=False)      # Previous Swing High
    risk_reward = Column(String(20), nullable=True)

    # Sector & Market Identity
    company_name = Column(String(200), nullable=True)
    sector = Column(String(100), nullable=True, index=True)
    market_cap = Column(Float, nullable=True)
    market_cap_category = Column(String(20), nullable=True)

    # Alert Trigger Status
    alert_status = Column(String(50), default="NONE")  # APPROACHING_TC, BREAKOUT_TC, RETEST_TC, FAILED_TC, GAPUP_TC, VOLUME_SURGE
    last_alert_time = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=utc_now, nullable=False)

    __table_args__ = (
        Index("idx_cpr_symbol_date", "symbol", "date", unique=True),
        Index("idx_cpr_date_rank", "date", "cpr_rank"),
        Index("idx_cpr_compression_score", "compression_score"),
        Index("idx_cpr_breakout_score", "breakout_score"),
    )

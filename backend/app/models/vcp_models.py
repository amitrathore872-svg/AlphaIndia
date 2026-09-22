"""
Alpha India VCP + Volume Breakout Engine Models
Mark Minervini Style Institutional Contraction & Breakout Discovery Models
"""

from datetime import datetime, date
from sqlalchemy import (
    Column,
    Integer,
    BigInteger,
    String,
    Float,
    Boolean,
    Date,
    DateTime,
    Text,
    JSON,
    ForeignKey,
    Index,
)
from sqlalchemy.orm import relationship
from app.db.database import Base


class VCPPattern(Base):
    """
    Stores Volatility Contraction Pattern (VCP) geometric measurements,
    swing levels, compression metrics, and quality score.
    """
    __tablename__ = "vcp_patterns"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    symbol = Column(String(20), nullable=False, index=True)
    company_name = Column(String(255), nullable=True)
    scan_date = Column(Date, nullable=False, index=True)

    # Price & Pivot Levels
    cmp = Column(Float, nullable=False, default=0.0)
    pivot_price = Column(Float, nullable=False, default=0.0)
    stop_loss_price = Column(Float, nullable=False, default=0.0)
    risk_pct = Column(Float, nullable=False, default=0.0)
    distance_to_pivot_pct = Column(Float, nullable=False, default=0.0)

    # Contraction Wave Geometry (Minervini Rules)
    contraction_count = Column(Integer, nullable=False, default=3)  # >= 3
    contraction_sizes = Column(JSON, nullable=True)  # List[float] e.g. [18.2, 11.4, 6.1, 2.8]
    swing_highs = Column(JSON, nullable=True)        # List[float]
    swing_lows = Column(JSON, nullable=True)         # List[float]
    duration_days = Column(Integer, default=45)

    # Compression Measurements
    atr_compression = Column(Float, default=0.0)      # % ATR contraction from wave 1
    bollinger_width = Column(Float, default=0.0)      # BB width in final contraction
    range_compression = Column(Float, default=0.0)    # Daily (High-Low)/Close compression %
    candle_body_compression = Column(Float, default=0.0) # Average body contraction %

    # Gate 2 Score
    vcp_score = Column(Float, nullable=False, default=0.0)  # 0-100, reject < 80
    vcp_stage = Column(String(50), default="STAGE_3_CONTRACTION")  # e.g. "3-Stage VCP", "4-Stage VCP"

    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_vcp_pattern_sym_date", "symbol", "scan_date"),
    )


class VolumeAnalysis(Base):
    """
    Stores institutional volume dry-up analysis, OBV/CMF accumulation,
    and relative volume footprints inside the VCP base.
    """
    __tablename__ = "volume_analysis"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    symbol = Column(String(20), nullable=False, index=True)
    scan_date = Column(Date, nullable=False, index=True)

    avg_volume20 = Column(BigInteger, default=0)
    current_volume = Column(BigInteger, default=0)
    breakout_volume = Column(BigInteger, default=0)
    breakout_volume_ratio = Column(Float, default=0.0)  # Current/Breakout Vol / 20 DMA
    dryup_ratio = Column(Float, default=0.0)            # Lowest contraction vol / 20 DMA
    delivery_percent = Column(Float, default=0.0)

    # Indicators
    obv_score = Column(Float, default=50.0)             # Bullish OBV divergence score
    cmf_score = Column(Float, default=0.0)              # Chaikin Money Flow (-1 to +1)
    lowest_10d_vol = Column(BigInteger, default=0)
    lowest_20d_vol = Column(BigInteger, default=0)
    volume_trend_declining = Column(Boolean, default=True)

    # Gate 3 Score
    volume_score = Column(Float, nullable=False, default=0.0)  # 0-100, reject < 75

    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_vcp_vol_sym_date", "symbol", "scan_date"),
    )


class BreakoutSignal(Base):
    """
    Stores breakout confirmation telemetry, candle morphology,
    relative volume spikes, and technical momentum boosters.
    """
    __tablename__ = "breakout_signals"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    symbol = Column(String(20), nullable=False, index=True)
    breakout_date = Column(Date, nullable=False, index=True)

    breakout_strength = Column(Float, default=0.0)      # 0-100
    breakout_volume_ratio = Column(Float, default=0.0)  # Must be >= 2.0 on breakout
    relative_volume = Column(Float, default=1.0)

    # Technical Indicators
    rsi = Column(Float, default=55.0)
    macd = Column(Float, default=0.0)
    macd_signal = Column(Float, default=0.0)
    adx = Column(Float, default=25.0)

    # Candle Morphology Checks
    is_gap_up = Column(Boolean, default=False)
    vwap_hold = Column(Boolean, default=True)
    close_in_top_20 = Column(Boolean, default=True)
    wide_range_candle = Column(Boolean, default=True)
    upper_wick_pct = Column(Float, default=0.0)        # Must be <= 25% of body

    # Status: CONFIRMED_BREAKOUT, PRE_BREAKOUT_COILING, POCKET_PIVOT
    status = Column(String(50), default="PRE_BREAKOUT_COILING", index=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_vcp_breakout_sym_date", "symbol", "breakout_date"),
    )


class VCPAIScore(Base):
    """
    Institutional Composite Score, 8-Gate Breakdown, AI Verdict,
    Actionable Trade Setup Zones (Entry, Stop, Targets, R:R).
    """
    __tablename__ = "vcp_ai_scores"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    symbol = Column(String(20), nullable=False, index=True)
    scan_date = Column(Date, nullable=False, index=True)

    # 8-Gate Scoring Breakdown
    total_score = Column(Float, nullable=False, index=True, default=0.0)
    trend_score = Column(Float, default=0.0)          # Gate 1: 15%
    vcp_score = Column(Float, default=0.0)            # Gate 2: 20%
    volume_score = Column(Float, default=0.0)         # Gate 3: 20%
    breakout_score = Column(Float, default=0.0)       # Gate 5: 20%
    institutional_score = Column(Float, default=0.0)  # Gate 6: 10%
    growth_score = Column(Float, default=0.0)         # Gate 7: 10%
    catalyst_score = Column(Float, default=0.0)       # Gate 8: 5%

    # Verdict & Classification
    # 95-100: "Elite VCP Breakout", 90-94: "High Conviction Breakout", "<90": "Ignored"
    verdict = Column(String(100), nullable=False, default="High Conviction Breakout")
    confidence = Column(Float, default=90.0)          # e.g. 96.5%
    why_selected = Column(JSON, nullable=True)        # List[str] institutional rationale bullets
    is_elite = Column(Boolean, default=False, index=True) # Score >= 95

    # Actionable Trade Plan
    cmp = Column(Float, default=0.0)
    pivot_price = Column(Float, default=0.0)
    entry_zone = Column(String(100), nullable=True)   # e.g. "₹1450–1475"
    stop_loss = Column(Float, default=0.0)
    risk_pct = Column(Float, default=0.0)
    target_1 = Column(Float, default=0.0)
    target_2 = Column(Float, default=0.0)
    target_3 = Column(Float, default=0.0)
    reward_risk = Column(String(50), default="1:3.5")
    time_horizon = Column(String(50), default="2–8 Weeks")

    # Meta
    sector = Column(String(100), nullable=True)
    market_cap = Column(Float, default=0.0)
    mf_holding_change = Column(Float, default=0.0)
    catalyst_summary = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_vcp_ai_sym_date", "symbol", "scan_date"),
    )


class VCPScanRejection(Base):
    """
    Stores explainable rejection diagnostics for every filtered stock.
    Guarantees that every rejection has a transparent recorded cause.
    """
    __tablename__ = "vcp_scan_rejections"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    symbol = Column(String(20), nullable=False, index=True)
    scan_date = Column(Date, nullable=False, index=True)
    gate_failed = Column(String(50), nullable=False, index=True)  # e.g. GATE_1_TREND, GATE_2_VCP
    reason = Column(Text, nullable=False)
    gate_details = Column(JSON, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        Index("ix_vcp_rejection_sym_date", "symbol", "scan_date"),
    )

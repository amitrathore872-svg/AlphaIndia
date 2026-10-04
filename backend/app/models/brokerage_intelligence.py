"""
Alpha India — Institutional Brokerage Intelligence Models
Stores sell-side brokerage research reports, target price revisions, earnings estimates,
conviction scores, and historical broker performance scorecards (hit rates and drawdowns).
"""

from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    Float,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    JSON,
)
from sqlalchemy.orm import relationship

from app.db.database import Base


class BrokerageReport(Base):
    __tablename__ = "brokerage_reports"
    __table_args__ = (
        Index("idx_brk_rep_sym_date", "symbol", "report_date"),
        Index("idx_brk_rep_broker", "brokerage_house"),
        Index("idx_brk_rep_action", "action"),
        Index("idx_brk_rep_conviction", "conviction_score"),
        Index("idx_brk_rep_date", "report_date"),
    )

    id = Column(Integer, primary_key=True, index=True)

    # Linking to Master Company
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=True, index=True)
    symbol = Column(String(50), nullable=False, index=True)
    company_name = Column(String(255), nullable=True)
    sector = Column(String(100), nullable=True, index=True)
    market_cap_category = Column(String(50), default="MID_CAP", index=True) # LARGE_CAP, MID_CAP, SMALL_CAP
    market_cap = Column(Float, nullable=True) # In ₹ Cr

    # Broker Identity & Classification
    brokerage_house = Column(String(100), nullable=False, index=True)
    broker_tier = Column(String(50), default="TIER_1_INSTITUTIONAL", index=True)
    report_date = Column(Date, nullable=False, index=True)
    report_type = Column(
        String(50),
        default="RESULT_UPDATE",
        index=True
    )  # RESULT_UPDATE, INITIATION, TOP_PICKS, THEMATIC, MORNING_MEMO

    # Action & Rating Transition (Tracks previous picks vs revised view)
    action = Column(
        String(30),
        default="MAINTAINED",
        index=True
    )  # UPGRADE, TARGET_UP, INITIATION, MAINTAINED, DOWNGRADE, EXIT
    previous_rating = Column(String(30), nullable=True) # e.g. ACCUMULATE, HOLD, NEUTRAL
    current_rating = Column(String(30), nullable=False)  # BUY, ACCUMULATE, HOLD, REDUCE, SELL

    # Price Targets & Revisions
    price_at_reco = Column(Float, nullable=False)
    previous_target_price = Column(Float, nullable=True)
    target_price = Column(Float, nullable=False)
    upside_pct = Column(Float, default=0.0)             # ((target - price_at_reco) / price_at_reco) * 100
    target_revision_pct = Column(Float, nullable=True)  # ((new_target - prev_target) / prev_target) * 100
    target_horizon = Column(String(50), default="12 Months", index=True) # e.g. 1 Month, 3 Months, 6 Months, 12 Months, 18-24 Months
    horizon_months = Column(Integer, default=12, index=True)             # Numerical months: 1, 3, 6, 12, 18, 24

    # Earnings & Financial Estimate Revisions
    fy1_eps_est = Column(Float, nullable=True)
    fy2_eps_est = Column(Float, nullable=True)
    eps_revision_pct = Column(Float, nullable=True)     # e.g. +8.5%

    # Institutional Conviction Metric (0 to 100)
    # Calculated from Broker Hit Rate (35%) + Revision % (25%) + Smart Money Flow (25%) + Concall Clarity (15%)
    conviction_score = Column(Float, default=50.0, index=True)
    is_hot_pick = Column(Boolean, default=False, index=True)

    # Qualitative Intelligence & Synthesized Theses
    headline = Column(Text, nullable=True)
    investment_thesis = Column(Text, nullable=True)     # 2-3 sentence core catalyst
    key_catalysts = Column(JSON, nullable=True)         # List of positive operational drivers
    key_risks = Column(JSON, nullable=True)             # List of monitorable downside risks
    source_url_or_pdf = Column(Text, nullable=True)

    # Concall Interrogation Insights (Linked or Extracted)
    concall_grill_question = Column(Text, nullable=True)
    concall_mgmt_answer = Column(Text, nullable=True)
    mgmt_clarity_rating = Column(String(30), default="MEDIUM") # HIGH, MEDIUM, EVASIVE

    # Quantitative Backtest & Outcome Tracking
    target_achieved = Column(Boolean, default=False, index=True)
    days_to_target = Column(Integer, nullable=True)
    max_gain_pct = Column(Float, default=0.0)
    max_drawdown_pct = Column(Float, default=0.0)

    # Audit Timestamps
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    company = relationship("Company", lazy="joined")


class BrokerScorecard(Base):
    __tablename__ = "broker_scorecards"

    id = Column(Integer, primary_key=True, index=True)
    brokerage_house = Column(String(100), unique=True, nullable=False, index=True)
    tier = Column(String(50), default="TIER_1_INSTITUTIONAL", index=True)
    star_rating = Column(Float, default=4.0)            # 1.0 to 5.0
    specialization = Column(String(100), nullable=True) # e.g. "Defense / Capital Goods", "Banking & Governance"

    # Historical Empirical Track Record
    total_calls_tracked = Column(Integer, default=0)
    calls_hit_target = Column(Integer, default=0)
    hit_rate_pct = Column(Float, default=0.0)           # e.g. 71.4%
    avg_days_to_target = Column(Float, default=0.0)
    avg_max_drawdown_pct = Column(Float, default=0.0)   # e.g. -9.5%

    last_updated = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

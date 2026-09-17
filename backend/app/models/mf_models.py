"""
Mutual Fund Intelligence Models
Alpha India - Institutional Smart Money Radar
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
    ForeignKey,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from app.db.database import Base


class MFScheme(Base):
    """Master registry of Indian Mutual Fund Schemes."""
    __tablename__ = "mf_schemes"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    scheme_code = Column(String(50), unique=True, index=True, nullable=False)
    scheme_name = Column(String(255), index=True, nullable=False)
    amc_name = Column(String(150), index=True, nullable=False)
    category = Column(String(100), index=True, nullable=False)  # Flexi Cap, Mid Cap, Small Cap, ELSS, ETF, Index, etc.
    is_active_alpha = Column(Boolean, default=True, index=True)  # False for Index/ETF/Arbitrage
    fund_manager_name = Column(String(150), index=True, nullable=True)
    aum_cr = Column(Float, default=0.0)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    holdings = relationship("MFSchemeHolding", back_populates="scheme", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<MFScheme(code={self.scheme_code}, name={self.scheme_name}, amc={self.amc_name})>"


class MFSchemeHolding(Base):
    """Monthly portfolio holding record for a scheme."""
    __tablename__ = "mf_scheme_holdings"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    scheme_id = Column(Integer, ForeignKey("mf_schemes.id", ondelete="CASCADE"), index=True, nullable=False)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), index=True, nullable=False)
    report_date = Column(Date, index=True, nullable=False)  # e.g., 2024-07-31
    shares_held = Column(BigInteger, default=0)
    market_value_cr = Column(Float, default=0.0)
    weight_pct = Column(Float, default=0.0)  # % of scheme's AUM
    prev_shares_held = Column(BigInteger, nullable=True, default=0)
    mom_shares_change_pct = Column(Float, default=0.0)
    holding_status = Column(String(50), default="HOLD", index=True)  # NEW_ENTRY, AGGRESSIVE_ADD, ADD, HOLD, TRIMMED, EXIT
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    scheme = relationship("MFScheme", back_populates="holdings")
    company = relationship("Company")

    __table_args__ = (
        UniqueConstraint("scheme_id", "company_id", "report_date", name="uq_scheme_company_month"),
    )

    def __repr__(self):
        return f"<MFSchemeHolding(scheme_id={self.scheme_id}, company_id={self.company_id}, date={self.report_date}, status={self.holding_status})>"


class MFStockMonthlyAggregate(Base):
    """Aggregated institutional ownership & smart money score for each stock by month."""
    __tablename__ = "mf_stock_monthly_aggregates"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), index=True, nullable=False)
    report_date = Column(Date, index=True, nullable=False)
    total_schemes_holding = Column(Integer, default=0)
    active_alpha_schemes_holding = Column(Integer, default=0)
    total_shares_held = Column(BigInteger, default=0)
    total_value_cr = Column(Float, default=0.0)
    pct_of_equity = Column(Float, default=0.0)
    pct_of_free_float = Column(Float, default=0.0)
    net_shares_flow_mom = Column(BigInteger, default=0)
    net_value_flow_mom_cr = Column(Float, default=0.0)
    smart_money_score = Column(Float, default=50.0, index=True)  # 0 to 100
    float_absorption_pct = Column(Float, default=0.0)
    star_manager_count = Column(Integer, default=0)
    is_stealth_accumulation = Column(Boolean, default=False, index=True)
    is_consensus_bet = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    company = relationship("Company")

    __table_args__ = (
        UniqueConstraint("company_id", "report_date", name="uq_stock_monthly_aggregate"),
    )

    def __repr__(self):
        return f"<MFStockMonthlyAggregate(company_id={self.company_id}, date={self.report_date}, score={self.smart_money_score})>"


class MFSectorFlow(Base):
    """Aggregated institutional monthly capital rotation per Indian market sector."""
    __tablename__ = "mf_sector_flows"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    sector_name = Column(String(100), index=True, nullable=False)
    report_date = Column(Date, index=True, nullable=False)
    net_inflow_cr = Column(Float, default=0.0)
    prev_month_inflow_cr = Column(Float, default=0.0)
    mom_delta_pct = Column(Float, default=0.0)
    trend = Column(String(20), default="UP")  # UP, DOWN, STABLE
    top_accumulated_stock = Column(String(100), nullable=True)
    top_trimmed_stock = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("sector_name", "report_date", name="uq_sector_month_flow"),
    )


class MFAccumulationSignal(Base):
    """Institutional trade setups & AI conviction reasoning."""
    __tablename__ = "mf_accumulation_signals"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="CASCADE"), index=True, nullable=False)
    signal_date = Column(Date, index=True, nullable=False)
    signal_type = Column(String(50), index=True, nullable=False)  # STEALTH_ACCUMULATION, CONSENSUS_BET, PRE_EARNINGS_ACCUMULATION
    conviction_score = Column(Float, default=75.0)  # 0 to 100
    entry_zone_low = Column(Float, nullable=True)
    entry_zone_high = Column(Float, nullable=True)
    target_price = Column(Float, nullable=True)
    stop_loss = Column(Float, nullable=True)
    action_recommendation = Column(String(50), default="ACCUMULATE")  # STRONG BUY, ACCUMULATE, HOLD
    ai_thesis_summary = Column(Text, nullable=True)
    primary_driver = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    company = relationship("Company")

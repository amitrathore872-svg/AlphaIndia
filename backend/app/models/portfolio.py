"""
Alpha India - Portfolio Intelligence Models
Supports multiple named portfolios under one account, manual holding additions,
CSV broker imports, and cached 360° AI diagnostic telemetry.
"""

from datetime import datetime
from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from app.db.database import Base


class Portfolio(Base):
    __tablename__ = "portfolios"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    color = Column(String(30), default="emerald")  # emerald, cyan, amber, purple, blue
    benchmark = Column(String(50), default="NIFTY 50", nullable=False)
    cash_balance = Column(Float, default=0.0)
    is_default = Column(Integer, default=0)

    # Multi-tenant user ownership
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", backref="portfolios")
    holdings = relationship(
        "PortfolioHolding",
        back_populates="portfolio",
        cascade="all, delete-orphan",
        order_by="PortfolioHolding.id.desc()",
    )


class PortfolioHolding(Base):
    __tablename__ = "portfolio_holdings"

    id = Column(Integer, primary_key=True, index=True)
    portfolio_id = Column(
        Integer,
        ForeignKey("portfolios.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    symbol = Column(String(30), nullable=False, index=True)
    company_name = Column(String(200), nullable=True)
    sector = Column(String(100), nullable=True)

    # Transaction details
    quantity = Column(Float, nullable=False, default=1.0)
    avg_buy_price = Column(Float, nullable=False)
    buy_date = Column(DateTime, default=datetime.utcnow)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    portfolio = relationship("Portfolio", back_populates="holdings")

    # Composite Unique Constraint: A symbol cannot be duplicated directly in the same portfolio
    __table_args__ = (
        UniqueConstraint("portfolio_id", "symbol", name="uq_portfolio_symbol"),
    )


class PortfolioStockAnalysisCache(Base):
    """
    Cached 360° AI diagnostic output for a stock in the portfolio context.
    """
    __tablename__ = "portfolio_stock_analyses"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String(30), unique=True, index=True, nullable=False)
    company_name = Column(String(200), nullable=True)
    sector = Column(String(100), nullable=True)

    # AI Recommendation Verdict
    # Verdicts: STRONG_BUY, BUY, ACCUMULATE, HOLD, REDUCE, EXIT
    verdict = Column(String(30), default="HOLD")
    conviction_score = Column(Integer, default=75)  # 0 to 100%

    # Investment Horizon: SHORT_TERM, SWING, MID_TERM, LONG_TERM, FOREVER_COMPOUNDER
    horizon = Column(String(40), default="LONG_TERM")
    risk_level = Column(String(30), default="MEDIUM")  # LOW, MEDIUM, HIGH

    # Accumulation & Entry Zones
    best_buy_min = Column(Float, nullable=True)
    best_buy_max = Column(Float, nullable=True)
    accumulate_min = Column(Float, nullable=True)
    accumulate_max = Column(Float, nullable=True)
    profit_booking = Column(Float, nullable=True)
    stop_loss = Column(Float, nullable=True)

    # Valuation Model
    fair_value = Column(Float, nullable=True)
    overvaluation_pct = Column(Float, nullable=True)
    valuation_status = Column(String(50), default="FAIR")  # UNDERVALUED, FAIR, OVERVALUED

    # Expected Quarterly Results Engine
    expected_result = Column(String(30), default="GOOD")  # GOOD, AVERAGE, BAD
    beat_probability = Column(Integer, default=70)  # % probability
    earnings_countdown_days = Column(Integer, nullable=True)

    # Factor Scores (0 to 100)
    quality_score = Column(Integer, default=80)
    growth_score = Column(Integer, default=75)
    valuation_score = Column(Integer, default=70)
    technical_score = Column(Integer, default=80)
    momentum_score = Column(Integer, default=75)
    governance_score = Column(Integer, default=85)

    # AI Qualitative Explanations
    ai_thesis = Column(Text, nullable=True)
    when_to_buy = Column(Text, nullable=True)
    when_not_to_buy = Column(Text, nullable=True)
    company_dna_moat = Column(Text, nullable=True)
    growth_catalysts = Column(Text, nullable=True)

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

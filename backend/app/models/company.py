from datetime import datetime
from sqlalchemy import Boolean, Column, Date, DateTime, Float, Integer, String
from sqlalchemy.orm import relationship

from app.db.database import Base


class Company(Base):
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)

    # ---------------------------------------------------------
    # NSE Identity
    # ---------------------------------------------------------
    symbol = Column(String(30), unique=True, nullable=False, index=True)
    company = Column(String(200), nullable=False)
    isin = Column(String(20), unique=True, nullable=True)

    # ---------------------------------------------------------
    # Classification
    # ---------------------------------------------------------
    sector = Column(String, nullable=True, default="Unknown")
    industry = Column(String, nullable=True, default="Unknown")
    series = Column(String(20), nullable=True)
    security_type = Column(String(30), default="EQUITY", index=True)
    is_growth_eligible = Column(Boolean, default=True, index=True)
    # Sprint 23 — marks companies discovered via early-stage pipeline
    is_provisional = Column(Boolean, default=False, index=True)

    # ---------------------------------------------------------
    # Listing Information
    # ---------------------------------------------------------
    listing_date = Column(Date, nullable=True)

    # ---------------------------------------------------------
    # Existing Warehouse Metrics
    # (These remain until Yahoo warehouse becomes source of truth)
    # ---------------------------------------------------------
    market_cap = Column(String(50), default="Unknown")
    exchange = Column(String(20), default="NSE")
    bse_code = Column(String(20), nullable=True)
    market_cap_category = Column(String(30), nullable=True)
    listing_status = Column(String(20), default="ACTIVE")
    revenue_growth = Column(Float, default=0)
    pat_growth = Column(Float, default=0)
    roce = Column(Float, default=0)
    ai_score = Column(Float, default=0)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, index=True)

    # ---------------------------------------------------------
    # Market Intelligence Metrics
    # ---------------------------------------------------------
    market_metrics = relationship(
        "CompanyMarketMetrics",
        back_populates="company",
        uselist=False,
        cascade="all, delete-orphan",
    )
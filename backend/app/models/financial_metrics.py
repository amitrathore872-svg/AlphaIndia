"""
Alpha India Financial Metrics Model
Stores quarterly financial metrics and AI score for every company.
"""

from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import relationship

from app.db.database import Base


class FinancialMetric(Base):
    __tablename__ = "financial_metrics"

    id = Column(Integer, primary_key=True, index=True)

    company_id = Column(Integer, ForeignKey("companies.id"), index=True)

    period = Column(String(20), index=True)
    period_type = Column(String(20), default="QUARTERLY")

    revenue = Column(Float, nullable=True)
    revenue_growth = Column(Float, default=0)
    pat = Column(Float, nullable=True)
    pat_growth = Column(Float, default=0)
    ebitda_margin = Column(Float, nullable=True)
    roce = Column(Float, default=0)
    roe = Column(Float, nullable=True)

    debt_equity = Column(Float, default=0)
    promoter_holding = Column(Float, default=0)
    eps = Column(Float, nullable=True)
    eps_growth = Column(Float, default=0)
    pe_ratio = Column(Float, nullable=True)

    ai_score = Column(Float, default=0)

    scanned_at = Column(DateTime, default=datetime.utcnow)

    company = relationship("Company")
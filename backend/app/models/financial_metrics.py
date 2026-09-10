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

    revenue_growth = Column(Float, default=0)
    pat_growth = Column(Float, default=0)
    roce = Column(Float, default=0)

    debt_equity = Column(Float, default=0)
    promoter_holding = Column(Float, default=0)

    ai_score = Column(Float, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)

    company = relationship("Company")
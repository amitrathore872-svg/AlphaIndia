"""
Alpha India Quarterly Financial Warehouse
Sprint 30.2 Production Model
"""

from datetime import datetime

from sqlalchemy import Column, Date, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.db.database import Base


class QuarterlyResult(Base):
    __tablename__ = "quarterly_results"

    id = Column(Integer, primary_key=True, index=True)

    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)

    # ----------------------------------------------------------------
    # Legacy Compatibility
    # ----------------------------------------------------------------
    quarter = Column(String(20), nullable=False)

    # ----------------------------------------------------------------
    # Financial Warehouse
    # ----------------------------------------------------------------
    fiscal_period = Column(String(20), index=True)
    period_end = Column(Date, index=True)
    result_date = Column(Date)

    revenue = Column(Float)
    operating_income = Column(Float)
    net_profit = Column(Float)
    eps = Column(Float)

    interest_income = Column(Float)
    interest_expense = Column(Float)
    net_interest_income = Column(Float)

    total_assets = Column(Float)
    total_equity = Column(Float)
    total_debt = Column(Float)

    book_value = Column(Float)

    operating_cash_flow = Column(Float)
    free_cash_flow = Column(Float)

    revenue_growth = Column(Float)
    pat_growth = Column(Float)
    roce = Column(Float)

    source = Column(String(30), default="YAHOO_FINANCE")
    imported_at = Column(DateTime, default=datetime.utcnow)

    company = relationship("Company")
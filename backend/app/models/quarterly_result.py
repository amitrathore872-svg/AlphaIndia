from datetime import datetime

from sqlalchemy import (
    Column,
    Integer,
    Float,
    String,
    Date,
    DateTime,
    ForeignKey,
)
from sqlalchemy.orm import relationship

from app.db.database import Base


class QuarterlyResult(Base):
    """
    Alpha India Financial Warehouse
    Sprint 30.2
    Quarterly structured financial statements imported from Yahoo Finance.
    """

    __tablename__ = "quarterly_results"

    id = Column(Integer, primary_key=True, index=True)

    company_id = Column(Integer, ForeignKey("companies.id"), nullable=False)

    # Quarter identity
    fiscal_period = Column(String(20))     # Q1 FY27
    period_end = Column(Date)
    result_date = Column(Date)

    # Core financial metrics
    revenue = Column(Float)
    net_profit = Column(Float)
    eps = Column(Float)

    # Banking metrics
    interest_income = Column(Float)
    interest_expense = Column(Float)
    net_interest_income = Column(Float)

    # Balance sheet metrics
    total_equity = Column(Float)
    total_debt = Column(Float)
    book_value = Column(Float)

    # Growth metrics
    revenue_growth = Column(Float)
    pat_growth = Column(Float)
    roce = Column(Float)

    source = Column(String(30), default="YAHOO_FINANCE")
    imported_at = Column(DateTime, default=datetime.utcnow)

    company = relationship("Company")
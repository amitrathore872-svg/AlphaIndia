from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, Float, DateTime, Index
from sqlalchemy.sql import func

from app.db.database import Base


class CompanyOrderBookHistory(Base):
    __tablename__ = "company_orderbook_history"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String(50), nullable=False, index=True)
    company_name = Column(String(255), nullable=False, index=True)
    fiscal_quarter = Column(String(20), nullable=False)  # e.g. "Q4FY18", "Q1FY27"
    as_of_date = Column(String(50), nullable=False)       # e.g. "30 Jun 2026"
    period_date = Column(DateTime(timezone=True), nullable=True) # for chronological sorting
    order_book_cr = Column(Float, nullable=False)        # Value in INR Crore
    filing_quote = Column(Text, nullable=True)           # Official filing citation
    source_pdf_url = Column(String(500), nullable=True)   # Direct PDF attachment link
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_comp_ob_sym_quarter", "symbol", "fiscal_quarter", unique=True),
        Index("ix_comp_ob_period", "symbol", "period_date"),
    )

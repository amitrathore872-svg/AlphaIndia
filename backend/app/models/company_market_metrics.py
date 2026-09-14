"""
Alpha India Company Market Metrics Model
Sprint 35 — Market Intelligence & Growth Screener PRO
Stores live market metrics, valuation multiples, and price indicators from Yahoo Finance.
"""

from datetime import datetime
from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from app.db.database import Base


class CompanyMarketMetrics(Base):
    __tablename__ = "company_market_metrics"

    id = Column(Integer, primary_key=True, index=True)

    company_id = Column(
        Integer,
        ForeignKey("companies.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )

    symbol = Column(String(20), nullable=False, index=True)

    # Price & Valuation
    cmp = Column(Float, nullable=True)  # Current Market Price (₹)
    market_cap = Column(Float, nullable=True)  # Market Cap in ₹ Crores
    market_cap_category = Column(String(20), nullable=True, index=True)  # LARGE, MID, SMALL, MICRO

    pe_ratio = Column(Float, nullable=True)  # Stock P/E
    industry_pe = Column(Float, nullable=True)  # Industry Median P/E
    pb_ratio = Column(Float, nullable=True)  # Price to Book
    peg_ratio = Column(Float, nullable=True)  # PEG Ratio

    # Margins & Returns
    roce = Column(Float, nullable=True)  # Return on Capital Employed (%)
    roe = Column(Float, nullable=True)  # Return on Equity (%)
    opm = Column(Float, nullable=True)  # Operating Profit Margin (%)

    # Balance Sheet Per Share & Dividends
    book_value = Column(Float, nullable=True)  # Book Value per share (₹)
    dividend_yield = Column(Float, nullable=True)  # Dividend Yield (%)
    face_value = Column(Float, nullable=True)

    # 52-Week Range
    fifty_two_week_high = Column(Float, nullable=True)
    fifty_two_week_low = Column(Float, nullable=True)

    # Profile & Classification
    sector = Column(String(100), nullable=True, index=True)
    industry = Column(String(100), nullable=True, index=True)
    exchange = Column(String(20), default="NSE", index=True)

    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationship to Company
    company = relationship("Company", back_populates="market_metrics")

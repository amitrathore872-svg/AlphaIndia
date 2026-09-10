"""
Alpha India Filing Registry Model
Sprint 28.2 Production Version
Tracks every historical filing discovered from NSE/BSE.
"""

from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import relationship

from app.db.database import Base


class FilingRegistry(Base):
    __tablename__ = "filing_registry"

    id = Column(Integer, primary_key=True, index=True)

    # -------------------------------------------------------
    # Company Reference
    # -------------------------------------------------------
    company_id = Column(Integer, ForeignKey("companies.id"), index=True)
    symbol = Column(String(20), index=True, nullable=False)
    exchange = Column(String(20), nullable=False)

    # -------------------------------------------------------
    # Filing Metadata
    # -------------------------------------------------------
    filing_type = Column(String(150), nullable=True)   # Quarterly Results / Annual Report
    period = Column(String(30), nullable=False)        # Q1 FY27 / FY26 Annual
    announcement_date = Column(Date)

    # -------------------------------------------------------
    # PDF Information
    # -------------------------------------------------------
    pdf_url = Column(String, nullable=True)
    pdf_local_path = Column(String, nullable=True)

    # -------------------------------------------------------
    # Processing Status
    # -------------------------------------------------------
    download_status = Column(String(20), default="PENDING")
    parse_status = Column(String(20), default="WAITING")
    ai_processed = Column(Boolean, default=False)

    # -------------------------------------------------------
    # Audit
    # -------------------------------------------------------
    discovered_at = Column(DateTime, default=datetime.utcnow)
    downloaded_at = Column(DateTime, nullable=True)
    parsed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # -------------------------------------------------------
    # Relationship
    # -------------------------------------------------------
    company = relationship("Company")
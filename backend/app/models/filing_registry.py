"""
Alpha India Filing Registry Model
Tracks historical filings discovered during the bootstrap import.
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

    company_id = Column(Integer, ForeignKey("companies.id"), index=True)
    symbol = Column(String(20), index=True)
    exchange = Column(String(20))

    period = Column(String(30))
    announcement_date = Column(Date)

    pdf_url = Column(String, nullable=True)
    pdf_local_path = Column(String, nullable=True)

    download_status = Column(String(20), default="PENDING")
    parse_status = Column(String(20), default="PENDING")

    ai_processed = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)

    company = relationship("Company")
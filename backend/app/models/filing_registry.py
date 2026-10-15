"""
Alpha India Filing Registry Model
Sprint 28.2 Production Version
Tracks every historical filing discovered from NSE/BSE.
"""

from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
)
from sqlalchemy.orm import relationship

from app.db.database import Base


class FilingRegistry(Base):
    __tablename__ = "filing_registry"
    __table_args__ = (
        Index("idx_fr_sym_period_type", "symbol", "period", "filing_type"),
        Index("idx_fr_download_status", "download_status"),
        Index("idx_fr_parse_status", "parse_status"),
        Index("idx_fr_announcement_date", "announcement_date"),
        Index("idx_fr_discovered_at", "discovered_at"),
        Index("idx_fr_feed_type", "feed_type"),
        Index("idx_fr_feed_type_ann_date", "feed_type", "announcement_date"),
    )

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
    feed_type = Column(String(30), nullable=True, index=True) # RESULT | ANNOUNCEMENT
    period = Column(String(30), nullable=False)        # Q1 FY27 / FY26 Annual
    announcement_date = Column(Date, index=True)

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
    discovered_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    downloaded_at = Column(DateTime, nullable=True)
    parsed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # -------------------------------------------------------
    # Relationship
    # -------------------------------------------------------
    company = relationship("Company")


from sqlalchemy import event

@event.listens_for(FilingRegistry, "before_insert")
def auto_classify_feed_type(mapper, connection, target):
    if not target.feed_type and target.filing_type:
        ft = str(target.filing_type).lower()
        # Outcomes / approved results are RESULTS
        if any(k in ft for k in ["outcome of board meeting", "outcome of the board meeting", "board meeting outcome", "results approved", "outcome without intimation"]):
            target.feed_type = "RESULT"
        elif any(k in ft for k in ["board meeting", "notice of board meeting", "intimation", "date of meeting", "notice", "schedule"]):
            target.feed_type = "ANNOUNCEMENT"
        else:
            target.feed_type = "RESULT"
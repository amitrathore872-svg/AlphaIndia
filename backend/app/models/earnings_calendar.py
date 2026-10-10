"""
Alpha India — Earnings Calendar Model
Tracks scheduled board meetings and expected quarterly financial result disclosures from NSE/BSE.
Enables pre-announcement radar tracking and bi-directional reconciliation against live result filings.
"""

from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.sql import func

from app.db.database import Base


class EarningsCalendar(Base):
    __tablename__ = "earnings_calendar"
    __table_args__ = (
        UniqueConstraint("symbol", "meeting_date", "purpose", name="uq_earnings_calendar_sym_date_purpose"),
        Index("idx_ec_meeting_date", "meeting_date"),
        Index("idx_ec_symbol", "symbol"),
        Index("idx_ec_status", "status"),
    )

    id = Column(Integer, primary_key=True, index=True)

    # Company Reference
    company_id = Column(Integer, ForeignKey("companies.id"), nullable=True, index=True)
    symbol = Column(String(50), nullable=False, index=True)
    company_name = Column(String(255), nullable=True)
    exchange = Column(String(20), default="NSE", index=True)

    # Meeting & Fiscal Timing
    meeting_date = Column(Date, nullable=False, index=True)  # The date the board meets to approve results
    fiscal_period = Column(String(30), nullable=True, index=True)  # e.g., "Q2 FY27", "Q1 FY27"
    purpose = Column(String(255), default="Financial Results", nullable=False)

    # Intimation Metadata
    intimation_date = Column(Date, nullable=True)  # When the company submitted the advance notice
    source_url = Column(String(500), nullable=True)
    details = Column(Text, nullable=True)

    # Status State Machine
    # SCHEDULED: In advance calendar
    # TODAY: Board meeting is today
    # COMPLETED: Results filing verified and ingested
    # UNSCHEDULED_SURPRISE: Results filed without prior calendar entry
    # DELAYED_POSTPONED: Meeting rescheduled
    status = Column(String(30), default="SCHEDULED", index=True)

    # Reconciliation Link
    result_filing_id = Column(Integer, nullable=True)  # References filing_registry.id or athena_omega_filings.id
    reported_at = Column(DateTime, nullable=True)  # Exact timestamp when the actual results were filed

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

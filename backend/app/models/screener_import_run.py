"""
Alpha India Screener.in Import Run Model
Parallel Architecture - Audit & Job History for Screener.in Imports
"""

from datetime import datetime
from sqlalchemy import Column, DateTime, Float, Integer, String, Text

from app.db.database import Base


class ScreenerImportRun(Base):
    __tablename__ = "screener_import_runs"

    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(String(50), nullable=False, unique=True, index=True)

    # Status: RUNNING, SUCCESS, PARTIAL, FAILED, ABORTED
    status = Column(String(20), default="RUNNING", index=True)

    start_time = Column(DateTime, default=datetime.utcnow)
    end_time = Column(DateTime, nullable=True)
    duration_seconds = Column(Float, default=0.0)

    total_target = Column(Integer, default=0)
    imported_count = Column(Integer, default=0)
    updated_count = Column(Integer, default=0)
    failed_count = Column(Integer, default=0)
    skipped_count = Column(Integer, default=0)
    success_rate_percent = Column(Float, default=0.0)

    error_summary = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

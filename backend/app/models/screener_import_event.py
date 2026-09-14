"""
Alpha India Screener.in Import Event Model
Parallel Architecture - Real-time activity logs for Screener.in telemetry & console
"""

from datetime import datetime
from sqlalchemy import Column, DateTime, Float, Integer, String, Text

from app.db.database import Base


class ScreenerImportEvent(Base):
    __tablename__ = "screener_import_events"

    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(String(50), nullable=True, index=True)
    symbol = Column(String(20), nullable=True, index=True)

    # Event types: JOB_START, FETCHING, PARSED, SAVED, RETRY, ERROR, JOB_COMPLETE
    event_type = Column(String(30), nullable=False, index=True)
    # Level: INFO, WARNING, ERROR, SUCCESS
    level = Column(String(10), default="INFO", index=True)

    message = Column(Text, nullable=False)

    response_time_ms = Column(Float, nullable=True)
    parse_time_ms = Column(Float, nullable=True)
    db_write_time_ms = Column(Float, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, index=True)

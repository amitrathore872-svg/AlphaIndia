from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func

from app.db.database import Base


class MonitoringHeartbeat(Base):
    __tablename__ = "monitoring_heartbeat"

    id = Column(Integer, primary_key=True, index=True)

    # Discovery Engine Status
    engine_status = Column(String, default="IDLE")
    current_session = Column(String, default="BOOTSTRAP")

    # Scan timestamps
    last_scan_time = Column(DateTime, nullable=True)
    next_scan_time = Column(DateTime, nullable=True)

    # Sprint 28 counters
    companies_scanned_today = Column(Integer, default=0)
    results_found_today = Column(Integer, default=0)
    parser_failures_today = Column(Integer, default=0)

    # Last heartbeat update
    heartbeat_at = Column(DateTime(timezone=True), server_default=func.now())
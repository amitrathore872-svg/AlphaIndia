"""
Alpha India Monitoring Heartbeat Model
Stores monitoring engine heartbeat and scheduler status.
"""

from datetime import datetime

from sqlalchemy import Column, DateTime, Integer, String

from app.db.database import Base


class MonitoringHeartbeat(Base):
    __tablename__ = "monitoring_heartbeat"

    id = Column(Integer, primary_key=True, index=True)

    engine_status = Column(String(20), default="STOPPED")

    current_session = Column(String(30), default="NON_MARKET")

    last_scan_time = Column(DateTime, nullable=True)

    next_scan_time = Column(DateTime, nullable=True)

    heartbeat_at = Column(DateTime, default=datetime.utcnow)
from datetime import datetime

from sqlalchemy import Column, Integer, String, DateTime

from app.db.database import Base


class MonitoringHeartbeat(Base):
    """
    Runtime status of Alpha India Monitoring Engine.
    Only one row is maintained and updated continuously.
    """

    __tablename__ = "monitoring_heartbeat"

    id = Column(Integer, primary_key=True, index=True)

    engine_status = Column(String(30), default="STOPPED")
    current_session = Column(String(30), default="NON_MARKET")

    last_scan_time = Column(DateTime)
    next_scan_time = Column(DateTime)

    companies_scanned_today = Column(Integer, default=0)
    results_found_today = Column(Integer, default=0)
    parser_failures_today = Column(Integer, default=0)

    heartbeat_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )
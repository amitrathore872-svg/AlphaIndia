from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from app.models.monitoring_heartbeat import MonitoringHeartbeat


class DiscoveryService:
    """
    Controls Alpha India Historical Discovery Engine.
    Sprint 28.1 Foundation
    """

    @staticmethod
    def get_status(db: Session):
        heartbeat = db.query(MonitoringHeartbeat).first()

        if heartbeat is None:
            heartbeat = MonitoringHeartbeat(
                engine_status="IDLE",
                current_session="BOOTSTRAP",
                next_scan_time=datetime.utcnow(),
                last_scan_time=None,
                companies_scanned_today=0,
                results_found_today=0,
                parser_failures_today=0,
            )
            db.add(heartbeat)
            db.commit()
            db.refresh(heartbeat)

        return heartbeat

    @staticmethod
    def start_engine(db: Session):
        heartbeat = DiscoveryService.get_status(db)

        heartbeat.engine_status = "RUNNING"
        heartbeat.current_session = "BOOTSTRAP"
        heartbeat.last_scan_time = datetime.utcnow()
        heartbeat.next_scan_time = datetime.utcnow() + timedelta(seconds=5)

        db.commit()
        db.refresh(heartbeat)

        return heartbeat

    @staticmethod
    def pause_engine(db: Session):
        heartbeat = DiscoveryService.get_status(db)

        heartbeat.engine_status = "PAUSED"

        db.commit()
        db.refresh(heartbeat)

        return heartbeat

    @staticmethod
    def resume_engine(db: Session):
        heartbeat = DiscoveryService.get_status(db)

        heartbeat.engine_status = "RUNNING"
        heartbeat.next_scan_time = datetime.utcnow() + timedelta(seconds=5)

        db.commit()
        db.refresh(heartbeat)

        return heartbeat
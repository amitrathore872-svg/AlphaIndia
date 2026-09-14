from datetime import datetime, timedelta, timezone
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

    @staticmethod
    def run_realtime_monitor_cycle(db: Session, limit: int = 10) -> dict:
        """
        Executes a real-time monitor cycle across exchange disclosures.
        Captures newly dropped quarterly results, reconciles data,
        updates financial warehouse (quarterly_results, screener_growth_records),
        and stamps company.updated_at in real time.
        """
        from app.services.exchange_feed_simulator import ExchangeFeedSimulator, EXCHANGE_FEED_DATASET
        from app.models.company import Company

        heartbeat = DiscoveryService.get_status(db)
        if heartbeat.engine_status == "PAUSED":
            return {
                "status": "PAUSED",
                "message": "Discovery engine is currently paused",
                "processed": 0,
            }

        heartbeat.engine_status = "RUNNING"
        heartbeat.last_scan_time = datetime.utcnow()
        heartbeat.next_scan_time = datetime.utcnow() + timedelta(seconds=30)
        db.commit()

        processed_companies = []
        high_growth_count = 0

        # Process the incoming live feed items up to limit
        items_to_process = EXCHANGE_FEED_DATASET[:limit]
        for item in items_to_process:
            try:
                res = ExchangeFeedSimulator.process_feed_item(item, db)
                comp = db.query(Company).filter(Company.symbol == item["symbol"]).first()
                if comp:
                    comp.updated_at = datetime.now(timezone.utc)
                    db.commit()
                processed_companies.append({
                    "symbol": res["symbol"],
                    "exchange": res["exchange"],
                    "quarter": res["quarter"],
                    "revenue_growth_pct": res["revenue_growth_pct"],
                    "pat_growth_pct": res["pat_growth_pct"],
                    "growth_score": res["growth_score"],
                    "category": res["growth_category"],
                    "updated_at": comp.updated_at.isoformat() if comp and comp.updated_at else datetime.now(timezone.utc).isoformat(),
                })
                if res["growth_category"] == "HIGH_GROWTH_BREAKOUT":
                    high_growth_count += 1
            except Exception as e:
                heartbeat.parser_failures_today += 1
                db.commit()

        heartbeat.results_found_today = len(processed_companies)
        heartbeat.last_scan_time = datetime.utcnow()
        db.commit()

        return {
            "status": "COMPLETED",
            "cycle_timestamp": datetime.utcnow().isoformat(),
            "companies_scanned": len(processed_companies),
            "high_growth_breakouts": high_growth_count,
            "companies": processed_companies,
            "engine_heartbeat": {
                "engine_status": heartbeat.engine_status,
                "companies_scanned_today": heartbeat.companies_scanned_today,
                "results_found_today": heartbeat.results_found_today,
                "last_scan_time": heartbeat.last_scan_time.isoformat() if heartbeat.last_scan_time else None,
            }
        }
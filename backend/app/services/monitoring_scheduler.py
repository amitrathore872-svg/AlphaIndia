
from datetime import datetime, timedelta, time
import threading
import time as sleep_time

from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.models.monitoring_heartbeat import MonitoringHeartbeat
from app.models.system_setting import SystemSetting


class MonitoringScheduler:
    """
    Alpha India Autonomous Monitoring Scheduler

    Reads configuration from PostgreSQL.
    Updates Monitoring Heartbeat continuously.
    Collector execution will be added in Sprint 4.5.
    """

    def __init__(self):
        self.running = False
        self.thread = None

    # -----------------------------------------------------
    # DATABASE
    # -----------------------------------------------------

    def get_db(self) -> Session:
        return SessionLocal()

    def get_settings(self, db: Session):
        settings = db.query(SystemSetting).all()
        return {s.setting_key: s.setting_value for s in settings}

    # -----------------------------------------------------
    # SESSION DETECTION
    # -----------------------------------------------------

    def get_current_session(self, settings: dict) -> str:
        now = datetime.now().time()

        market_start = time.fromisoformat(settings["market_start_time"])
        market_end = time.fromisoformat(settings["market_end_time"])
        post_market_end = time.fromisoformat(settings["post_market_end_time"])

        if market_start <= now <= market_end:
            return "MARKET"

        if market_end < now <= post_market_end:
            return "POST_MARKET"

        return "NON_MARKET"

    # -----------------------------------------------------
    # HEARTBEAT
    # -----------------------------------------------------

    def update_heartbeat(self):
        db = self.get_db()

        try:
            heartbeat = db.query(MonitoringHeartbeat).first()

            if heartbeat is None:
                print("[Heartbeat] Missing heartbeat row.")
                return

            settings = self.get_settings(db)
            session = self.get_current_session(settings)

            if session == "MARKET":
                interval = int(settings["market_interval_minutes"])
            else:
                interval = int(settings["post_market_interval_minutes"])

            heartbeat.engine_status = (
                "RUNNING"
                if settings["monitoring_enabled"] == "true"
                else "STOPPED"
            )

            heartbeat.current_session = session
            heartbeat.last_scan_time = datetime.now()
            heartbeat.next_scan_time = datetime.now() + timedelta(minutes=interval)
            heartbeat.heartbeat_at = datetime.now()

            db.commit()

            print(
                f"[Heartbeat] {session} | "
                f"Next Scan: {heartbeat.next_scan_time.strftime('%H:%M:%S')}"
            )

        except Exception as e:
            print(f"[Heartbeat Error] {e}")
            db.rollback()

        finally:
            db.close()

    # -----------------------------------------------------
    # LOOP
    # -----------------------------------------------------

    def scheduler_loop(self):
        print("=====================================")
        print(" Alpha India Monitoring Scheduler")
        print(" Scheduler Started")
        print("=====================================")

        while self.running:
            db = self.get_db()

            try:
                settings = self.get_settings(db)

                if settings["monitoring_enabled"] != "true":
                    print("[Scheduler] Monitoring Disabled")
                    sleep_time.sleep(30)
                    continue

            finally:
                db.close()

            # Update heartbeat
            self.update_heartbeat()

            # Collector execution comes in next sprint.
            print("[Scheduler] Waiting for next cycle...")

            # Temporary polling every 30 seconds for testing.
            sleep_time.sleep(30)

        print("[Scheduler] Scheduler Stopped")

    # -----------------------------------------------------
    # CONTROLS
    # -----------------------------------------------------

    def start(self):
        if self.running:
            print("[Scheduler] Already running.")
            return

        self.running = True

        self.thread = threading.Thread(
            target=self.scheduler_loop,
            daemon=True,
        )

        self.thread.start()

    def stop(self):
        self.running = False
        print("[Scheduler] Stop signal received.")


scheduler = MonitoringScheduler()
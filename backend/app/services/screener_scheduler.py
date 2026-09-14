"""
Alpha India Screener.in Scheduler Service
Parallel Architecture - Manages automated periodic import batches and countdown telemetry
"""

from datetime import datetime, timedelta
import logging
import threading
import time
from typing import Any, Dict, Optional

from app.services.screener_telemetry_service import ScreenerTelemetryService
from app.workers.screener_import_worker import ScreenerImportWorker

logger = logging.getLogger(__name__)


class ScreenerScheduler:
    _thread: Optional[threading.Thread] = None
    _stop_event = threading.Event()
    _lock = threading.Lock()

    # Default interval: 30 minutes (1800 seconds) — Institutional Safe Rate
    _interval_seconds: int = 1800
    _batch_size: int = 40
    _delay_seconds: float = 0.8
    _enabled: bool = True

    @classmethod
    def get_interval_seconds(cls) -> int:
        return cls._interval_seconds

    @classmethod
    def set_interval_seconds(cls, seconds: int):
        with cls._lock:
            cls._interval_seconds = max(60, seconds)
            logger.info(f"ScreenerScheduler interval updated to {cls._interval_seconds}s.")

    @classmethod
    def start(cls):
        with cls._lock:
            if cls._thread is not None and cls._thread.is_alive():
                return

            cls._stop_event.clear()
            cls._enabled = True
            cls._thread = threading.Thread(
                target=cls._scheduler_loop,
                daemon=True,
                name="ScreenerSchedulerThread",
            )
            cls._thread.start()
            logger.info("ScreenerScheduler started.")

    @classmethod
    def stop(cls):
        with cls._lock:
            cls._enabled = False
            cls._stop_event.set()
            logger.info("ScreenerScheduler stopped.")

    @classmethod
    def _calculate_initial_next_run(cls) -> datetime:
        """
        Determines the next scheduled run time across system restarts.
        Checks database for the most recent run in ScreenerImportRun.
        If the last run was more than interval ago (or no run exists),
        schedules an initial run after a 20-second startup warmup.
        Otherwise, preserves the remaining time from the last run's completion.
        """
        from app.db.database import SessionLocal
        from app.models.screener_import_run import ScreenerImportRun

        now = datetime.utcnow()
        warmup_delay = 20  # seconds

        try:
            db = SessionLocal()
            try:
                # Auto-recover any dangling RUNNING runs from unexpected server termination
                stale_runs = db.query(ScreenerImportRun).filter(ScreenerImportRun.status == "RUNNING").all()
                for sr in stale_runs:
                    sr.status = "INTERRUPTED"
                    sr.end_time = sr.start_time or now
                    sr.error_summary = "Server restart during execution"
                if stale_runs:
                    db.commit()

                last_run = (
                    db.query(ScreenerImportRun)
                    .filter(ScreenerImportRun.status.in_(["SUCCESS", "PARTIAL"]))
                    .order_by(
                        ScreenerImportRun.end_time.desc().nullslast(),
                        ScreenerImportRun.id.desc(),
                    )
                    .first()
                )

                if last_run and last_run.end_time:
                    elapsed = (now - last_run.end_time).total_seconds()
                    remaining = cls._interval_seconds - elapsed
                    if remaining <= warmup_delay:
                        logger.info(
                            f"ScreenerScheduler: Last run completed {int(elapsed)}s ago. Scheduling startup warmup batch in {warmup_delay}s."
                        )
                        return now + timedelta(seconds=warmup_delay)
                    else:
                        logger.info(
                            f"ScreenerScheduler: Restored schedule from last run. Next run in {int(remaining)}s."
                        )
                        return last_run.end_time + timedelta(seconds=cls._interval_seconds)
                else:
                    logger.info(
                        f"ScreenerScheduler: No previous successful run found. Scheduling startup warmup batch in {warmup_delay}s."
                    )
                    return now + timedelta(seconds=warmup_delay)
            finally:
                db.close()
        except Exception as e:
            logger.error(
                f"ScreenerScheduler error checking last run in DB: {e}. Defaulting to warmup in {warmup_delay}s."
            )
            return now + timedelta(seconds=warmup_delay)

    @classmethod
    def _scheduler_loop(cls):
        # Determine next scheduled run persistently across restarts
        next_run = cls._calculate_initial_next_run()
        ScreenerTelemetryService.set_next_scheduled_run(next_run)

        while not cls._stop_event.is_set():
            now = datetime.utcnow()
            if now >= next_run:
                logger.info("ScreenerScheduler: Triggering scheduled batch import.")
                if not ScreenerImportWorker.is_running():
                    ScreenerImportWorker.start(
                        batch_size=cls._batch_size,
                        delay_seconds=cls._delay_seconds,
                    )
                # Compute next run from now
                next_run = datetime.utcnow() + timedelta(seconds=cls._interval_seconds)
                ScreenerTelemetryService.set_next_scheduled_run(next_run)

            # Sleep short increment to check stop event and update countdown
            time.sleep(5)

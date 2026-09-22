"""
Alpha India VCP Engine Background Scheduler
Runs:
1. 3:40 PM IST: Full EOD Scan across liquid universe.
2. Every 5 Minutes: Intraday breakout confirmation (market hours 09:15-15:30 IST).
3. Weekend: Historical learning + score recalibration.
"""

import logging
import threading
import time
from datetime import datetime, timezone
import zoneinfo

from app.db.database import SessionLocal
from app.services.vcp_engine_service import VCPEngineService
from app.services.vcp_backtest_service import VCPBacktestService

logger = logging.getLogger(__name__)

# IST Timezone for Indian Stock Markets
IST = zoneinfo.ZoneInfo("Asia/Kolkata")


class VCPScheduler:
    """
    Automated thread-safe scheduler for VCP Discovery Engine.
    """

    _thread: threading.Thread = None
    _stop_event = threading.Event()
    _is_running = False

    # State tracking
    last_eod_scan: datetime = None
    last_intraday_scan: datetime = None
    last_weekend_run: datetime = None

    @classmethod
    def start(cls):
        if cls._is_running:
            return
        cls._is_running = True
        cls._stop_event.clear()
        cls._thread = threading.Thread(target=cls._run_loop, daemon=True, name="VCPSchedulerWorker")
        cls._thread.start()
        logger.info("VCPScheduler started: EOD (15:40 IST), Intraday (5m), Weekend recalibration.")

        # --- Catch-Up Scan: if market has already closed today and EOD scan was missed ---
        # This handles the case where the backend restarts AFTER the 15:40 IST window.
        catch_up_thread = threading.Thread(target=cls._maybe_run_catchup_scan, daemon=True, name="VCPCatchUpScanner")
        catch_up_thread.start()

    @classmethod
    def _maybe_run_catchup_scan(cls):
        """
        Runs once on startup. If it's a weekday after 15:45 IST and no VCP scores
        exist for today, triggers a full EOD scan to cover missed scheduled window.
        """
        try:
            now_ist = datetime.now(IST)
            weekday = now_ist.weekday()
            hour, minute = now_ist.hour, now_ist.minute

            # Only act on weekdays after the EOD window has passed (15:45+)
            is_post_market_weekday = (weekday < 5 and (hour > 15 or (hour == 15 and minute > 45)))
            if not is_post_market_weekday:
                return

            # Check if today's EOD scan already ran (any VCPAIScore or VCPScanRejection for today)
            from app.db.database import SessionLocal
            from app.models.vcp_models import VCPAIScore, VCPScanRejection
            from datetime import date
            db = SessionLocal()
            try:
                today = date.today()
                has_scores = db.query(VCPAIScore.id).filter(VCPAIScore.scan_date == today).first() is not None
                has_rejections = db.query(VCPScanRejection.id).filter(VCPScanRejection.scan_date == today).first() is not None
                already_ran = has_scores and has_rejections
            finally:
                db.close()

            if already_ran:
                logger.info("VCPScheduler catch-up: EOD scan already completed for today. Skipping.")
                return

            logger.warning(
                "VCPScheduler catch-up: Post-market restart detected and today's EOD scan was missed. "
                "Triggering catch-up scan now..."
            )
            db = SessionLocal()
            try:
                VCPEngineService.run_discovery_scan(db, limit_candidates=150, filter_mode="TODAY_BREAKOUT", persist=True)
                cls.last_eod_scan = datetime.now(IST)
                logger.info("VCPScheduler catch-up: EOD scan completed successfully.")
            finally:
                db.close()

        except Exception as e:
            logger.error(f"VCPScheduler catch-up scan failed: {e}", exc_info=True)

    @classmethod
    def stop(cls):
        if not cls._is_running:
            return
        cls._is_running = False
        cls._stop_event.set()
        if cls._thread and cls._thread.is_alive():
            cls._thread.join(timeout=3)
        logger.info("VCPScheduler stopped.")

    @classmethod
    def _run_loop(cls):
        while not cls._stop_event.is_set():
            try:
                now_ist = datetime.now(IST)
                hour = now_ist.hour
                minute = now_ist.minute
                weekday = now_ist.weekday()  # 0=Mon, 4=Fri, 5=Sat, 6=Sun

                # 1. 3:40 PM IST Full EOD Scan (Monday to Friday, 15:40 to 15:45)
                if weekday < 5 and hour == 15 and 40 <= minute <= 45:
                    if not cls.last_eod_scan or cls.last_eod_scan.date() != now_ist.date():
                        logger.info("Executing Scheduled 3:40 PM IST Full EOD VCP Scan...")
                        db = SessionLocal()
                        try:
                            VCPEngineService.run_discovery_scan(db, limit_candidates=150, filter_mode="TODAY_BREAKOUT", persist=True)
                            cls.last_eod_scan = now_ist
                        finally:
                            db.close()

                # 2. Every 5 Minutes Intraday Breakout Scan (09:15 to 15:30 IST on Weekdays)
                is_market_hours = (weekday < 5 and ((hour == 9 and minute >= 15) or (10 <= hour < 15) or (hour == 15 and minute <= 30)))
                if is_market_hours:
                    if not cls.last_intraday_scan or (now_ist - cls.last_intraday_scan).total_seconds() >= 300:
                        logger.info("Executing Scheduled 5-Minute Intraday Breakout Scan...")
                        db = SessionLocal()
                        try:
                            VCPEngineService.run_discovery_scan(db, limit_candidates=60, filter_mode="TODAY_BREAKOUT", persist=True)
                            cls.last_intraday_scan = now_ist
                        finally:
                            db.close()

                # 3. Weekend Historical Learning & Recalibration (Saturday/Sunday)
                if weekday in (5, 6):
                    if not cls.last_weekend_run or (now_ist - cls.last_weekend_run).total_seconds() >= 86400:
                        logger.info("Executing Weekend Historical Learning & Threshold Recalibration...")
                        _ = VCPBacktestService.get_10_year_backtest_report()
                        cls.last_weekend_run = now_ist

            except Exception as e:
                logger.error(f"VCPScheduler loop encountered error: {e}", exc_info=True)

            # Sleep 30 seconds before next check
            cls._stop_event.wait(30)

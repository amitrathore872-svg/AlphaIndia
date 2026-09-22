"""
Alpha India - Standalone Background Worker Process Daemon
Sprint 37.0 Production Architecture
Decouples heavy background threads and exchange ingestion pollers from the FastAPI web server.

Usage:
    python worker.py                  # Runs all background services
    python worker.py --services wire  # Runs only the live exchange wire worker
    python worker.py --services wire,vcp,screener
"""

import argparse
import logging
import os
import signal
import sys
import time
from typing import List

# Setup root path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.config import settings
from app.db.database import Base, engine

# Workers & Schedulers
from app.services.live_exchange_wire_worker import LiveExchangeWireWorker
from app.services.screener_scheduler import ScreenerScheduler
from app.services.early_stage_scheduler import EarlyStageScheduler
from app.services.raw_file_archiver import RawFileArchiveService
from app.services.vcp_scheduler import VCPScheduler
from app.services.autonomous_scheduler import AutonomousEngineScheduler

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("AlphaIndiaWorker")

RUNNING = True


def handle_shutdown(signum, frame):
    global RUNNING
    sig_name = signal.Signals(signum).name if hasattr(signal, "Signals") else str(signum)
    logger.info(f"Received termination signal ({sig_name}). Initiating graceful shutdown...")
    RUNNING = False


def main():
    parser = argparse.ArgumentParser(description="Alpha India Standalone Background Worker")
    parser.add_argument(
        "--services",
        type=str,
        default="all",
        help="Comma-separated list of services to run (all, wire, screener, early_stage, archive, vcp)",
    )
    parser.add_argument(
        "--test",
        action="store_true",
        help="Run a single initialization and heartbeat test, then exit immediately (exit code 0)",
    )
    args = parser.parse_args()

    # Register OS signal handlers
    signal.signal(signal.SIGINT, handle_shutdown)
    signal.signal(signal.SIGTERM, handle_shutdown)

    logger.info("=" * 60)
    logger.info("ALPHA INDIA BACKGROUND WORKER DAEMON STARTING")
    logger.info(f"Environment: {settings.APP_ENV} | Version: {settings.APP_VERSION}")
    logger.info(f"Database: {settings.DATABASE_URL.split('@')[-1] if '@' in settings.DATABASE_URL else 'configured'}")
    logger.info("=" * 60)

    # Ensure tables exist
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as exc:
        logger.error(f"Database table verification error: {exc}")

    services_requested = [s.strip().lower() for s in args.services.split(",")]
    run_all = "all" in services_requested

    started_services: List[str] = []

    # 1. Live Exchange Wire Worker
    if run_all or "wire" in services_requested:
        poll_interval = getattr(settings, "WORKER_POLL_INTERVAL_SECONDS", 60)
        LiveExchangeWireWorker.start(poll_interval_seconds=poll_interval)
        started_services.append("LiveExchangeWireWorker")

    # 2. Screener Scheduler
    if run_all or "screener" in services_requested:
        ScreenerScheduler.start()
        started_services.append("ScreenerScheduler")

    # 3. Early Stage Scheduler
    if run_all or "early_stage" in services_requested:
        EarlyStageScheduler.start()
        started_services.append("EarlyStageScheduler")

    # 4. Raw File Archiver
    if run_all or "archive" in services_requested:
        RawFileArchiveService.start(interval_seconds=600)
        started_services.append("RawFileArchiveService")

    # 5. VCP Engine Scheduler
    if run_all or "vcp" in services_requested:
        VCPScheduler.start()
        started_services.append("VCPScheduler")

    # 6. Master Autonomous Engine Scheduler
    if run_all or "autonomous" in services_requested:
        AutonomousEngineScheduler.start()
        started_services.append("AutonomousEngineScheduler")

    logger.info(f"Active Services ({len(started_services)}): {', '.join(started_services)}")

    if args.test:
        logger.info("Running in --test mode. Stopping services and exiting cleanly...")
        _stop_services(started_services)
        logger.info("Test passed successfully.")
        return 0

    logger.info("Worker daemon entering supervision loop. Press Ctrl+C to terminate.")

    loop_count = 0
    while RUNNING:
        time.sleep(5)
        loop_count += 1
        # Emit heartbeat every 30 seconds
        if loop_count % 6 == 0:
            wire_telemetry = LiveExchangeWireWorker.get_telemetry() if "LiveExchangeWireWorker" in started_services else {}
            auto_telemetry = AutonomousEngineScheduler.get_telemetry() if "AutonomousEngineScheduler" in started_services else {}
            logger.info(
                f"[Heartbeat] Wire Running: {wire_telemetry.get('is_running', False)} | "
                f"Autonomous Scheduler: {auto_telemetry.get('is_running', False)} | "
                f"Total Filings Scanned: {wire_telemetry.get('total_filings_scanned', 0)} | "
                f"Catalysts Discovered: {wire_telemetry.get('catalysts_discovered', 0)}"
            )

    # Teardown
    _stop_services(started_services)
    logger.info("Worker daemon stopped cleanly.")
    return 0


def _stop_services(services: List[str]):
    logger.info("Shutting down background services...")
    if "LiveExchangeWireWorker" in services:
        LiveExchangeWireWorker.stop()
    if "ScreenerScheduler" in services:
        ScreenerScheduler.stop()
    if "EarlyStageScheduler" in services:
        EarlyStageScheduler.stop()
    if "RawFileArchiveService" in services:
        RawFileArchiveService.stop()
    if "VCPScheduler" in services:
        VCPScheduler.stop()
    if "AutonomousEngineScheduler" in services:
        AutonomousEngineScheduler.stop()


if __name__ == "__main__":
    sys.exit(main())

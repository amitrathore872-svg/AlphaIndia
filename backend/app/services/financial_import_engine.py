"""
Alpha India Financial Import Engine
Sprint 31.4.3 — Production Background Engine
Version: v2.2.0
"""

from __future__ import annotations

import logging
import threading
import time
import traceback

from app.db.database import SessionLocal
from app.services.financial_batch_importer import FinancialBatchImporter
from app.services.financial_progress_service import FinancialProgressService
from app.services.financial_queue_manager import FinancialQueueManager

logger = logging.getLogger(__name__)


class FinancialImportEngine:
    """
    Background financial warehouse importer.

    • Runs in a dedicated daemon thread.
    • Uses its own SQLAlchemy session.
    • Processes queue until pending = 0.
    • Updates progress after every company.
    """

    _thread = None
    _running = False

    # ==========================================================
    # Background Worker
    # ==========================================================
    @classmethod
    def _worker(cls, batch_size: int, sleep_seconds: int):

        db = SessionLocal()

        logger.info("=" * 80)
        logger.info("FINANCIAL IMPORT ENGINE STARTED")
        logger.info("=" * 80)

        try:
            FinancialProgressService.start(db)

            while cls._running:

                stats = FinancialQueueManager.stats(db)

                logger.info("QUEUE STATUS : %s", stats)

                pending = stats["pending"]

                if pending == 0:
                    logger.info("Financial queue completed successfully.")
                    break

                logger.info(
                    "Importing batch of %s companies (%s pending)",
                    batch_size,
                    pending,
                )

                result = FinancialBatchImporter.run_batch(db, batch_size)

                logger.info("BATCH RESULT : %s", result)

                # If batch importer didn't process anything, stop.
                if (
                    result["imported"] == 0
                    and result["failed"] == 0
                ):
                    logger.warning("Batch importer returned no work.")
                    break

                time.sleep(sleep_seconds)

        except Exception as e:

            logger.error("=" * 80)
            logger.error("FINANCIAL IMPORT ENGINE CRASHED")
            logger.error("=" * 80)
            logger.error(str(e))
            logger.error(traceback.format_exc())

        finally:

            cls._running = False

            try:
                FinancialProgressService.finish(db)
            except Exception as e:
                logger.error("Progress finish failed: %s", str(e))

            db.close()

            logger.info("=" * 80)
            logger.info("FINANCIAL IMPORT ENGINE STOPPED")
            logger.info("=" * 80)

    # ==========================================================
    # Start Engine
    # ==========================================================
    @classmethod
    def start(
        cls,
        batch_size: int = 20,
        sleep_seconds: int = 1,
    ):

        if cls._running:
            return {
                "running": True,
                "message": "Engine already running.",
            }

        cls._running = True

        cls._thread = threading.Thread(
            target=cls._worker,
            args=(batch_size, sleep_seconds),
            daemon=True,
            name="financial-import-engine",
        )

        cls._thread.start()

        logger.info(
            "Financial engine launched (batch=%s sleep=%ss)",
            batch_size,
            sleep_seconds,
        )

        return {
            "running": True,
            "batch_size": batch_size,
            "sleep_seconds": sleep_seconds,
        }

    # ==========================================================
    # Stop Engine
    # ==========================================================
    @classmethod
    def stop(cls):

        cls._running = False

        logger.info("Financial engine stop signal received.")

        return {
            "running": False,
            "message": "Engine stopping...",
        }

    # ==========================================================
    # Engine Status
    # ==========================================================
    @classmethod
    def status(cls):

        return {
            "running": cls._running,
            "thread_alive": (
                cls._thread.is_alive()
                if cls._thread
                else False
            ),
        }
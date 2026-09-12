"""
Alpha India Financial Import Worker
Sprint 31.4.3 — Progress-Aware Queue Worker
Version: v2.0.0
"""

import logging

from sqlalchemy.orm import Session

from app.services.financial_progress_service import FinancialProgressService
from app.services.financial_queue_manager import FinancialQueueManager
from app.services.yahoo_import_service import YahooImportService

logger = logging.getLogger(__name__)


class FinancialImportWorker:
    """
    Imports one company from the financial queue and updates
    queue status + live progress tracker.
    """

    @classmethod
    def run_next(cls, db: Session):

        job = FinancialQueueManager.next_company(db)

        if job is None:
            return {
                "success": True,
                "message": "Financial import queue completed."
            }

        symbol = job.symbol

        logger.info("Starting Yahoo import for %s", symbol)

        try:
            # Show current symbol in live progress
            FinancialProgressService.current(db, symbol)

            result = YahooImportService.import_company(db, symbol)

            FinancialQueueManager.complete(db, symbol)

            # SUCCESS progress update
            FinancialProgressService.update(
                db=db,
                symbol=symbol,
                success=True,
            )

            logger.info(
                "Completed %s (%s quarters imported)",
                symbol,
                result["quarters_imported"],
            )

            return {
                "success": True,
                "symbol": symbol,
                "quarters_imported": result["quarters_imported"],
            }

        except Exception as e:

            message = str(e)

            logger.warning("Yahoo import failed for %s : %s", symbol, message)

            # Permanent Yahoo failures
            if (
                "No Yahoo Finance ticker found" in message
                or "empty dataframe" in message
            ):
                FinancialQueueManager.unavailable(db, symbol, message)

            else:
                FinancialQueueManager.fail(db, symbol, message)

            # FAILED progress update
            FinancialProgressService.update(
                db=db,
                symbol=symbol,
                success=False,
            )

            return {
                "success": False,
                "symbol": symbol,
                "error": message,
            }
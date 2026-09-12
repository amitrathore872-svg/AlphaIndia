"""
Alpha India Financial Progress Service
Sprint 31.4.4 — Live Progress Tracker
Version: v2.0.0
"""

from datetime import datetime
from sqlalchemy.orm import Session

from app.models.financial_import_progress import FinancialImportProgress
from app.models.financial_import_queue import FinancialImportQueue


class FinancialProgressService:
    """
    Maintains live progress for the Financial Warehouse import engine.
    """

    # ==========================================================
    # Get or Create Progress Row
    # ==========================================================
    @classmethod
    def _row(cls, db: Session):

        progress = db.query(FinancialImportProgress).first()

        if progress is None:
            progress = FinancialImportProgress(
                status="IDLE",
                processed=0,
                completed=0,
                failed=0,
            )
            db.add(progress)
            db.commit()
            db.refresh(progress)

        return progress

    # ==========================================================
    # Start Import Session
    # ==========================================================
    @classmethod
    def start(cls, db: Session):

        progress = cls._row(db)

        progress.status = "RUNNING"
        progress.processed = 0
        progress.completed = 0
        progress.failed = 0
        progress.current_symbol = None
        progress.started_at = datetime.utcnow()
        progress.updated_at = datetime.utcnow()
        progress.eta_minutes = None

        db.commit()

    # ==========================================================
    # Update Current Symbol
    # ==========================================================
    @classmethod
    def current(cls, db: Session, symbol: str):

        progress = cls._row(db)

        progress.current_symbol = symbol
        progress.updated_at = datetime.utcnow()

        db.commit()

    # ==========================================================
    # Update After Every Company
    # ==========================================================
    @classmethod
    def update(
        cls,
        db: Session,
        symbol: str,
        success: bool,
    ):

        progress = cls._row(db)

        progress.processed += 1

        if success:
            progress.completed += 1
        else:
            progress.failed += 1

        progress.current_symbol = symbol
        progress.updated_at = datetime.utcnow()

        # ETA Calculation
        pending = (
            db.query(FinancialImportQueue)
            .filter(FinancialImportQueue.status == "PENDING")
            .count()
        )

        if progress.started_at and progress.processed > 0:

            elapsed_minutes = (
                datetime.utcnow() - progress.started_at
            ).total_seconds() / 60

            avg_minutes = elapsed_minutes / progress.processed

            progress.eta_minutes = round(avg_minutes * pending, 2)

        db.commit()

    # ==========================================================
    # Finish Import Session
    # ==========================================================
    @classmethod
    def finish(cls, db: Session):

        progress = cls._row(db)

        progress.status = "IDLE"
        progress.current_symbol = None
        progress.updated_at = datetime.utcnow()

        db.commit()

    # ==========================================================
    # Reset Progress
    # ==========================================================
    @classmethod
    def reset(cls, db: Session):

        progress = cls._row(db)

        progress.status = "IDLE"
        progress.processed = 0
        progress.completed = 0
        progress.failed = 0
        progress.current_symbol = None
        progress.started_at = None
        progress.updated_at = None
        progress.eta_minutes = None

        db.commit()

    # ==========================================================
    # Live Progress Summary API
    # ==========================================================
    @classmethod
    def summary(cls, db: Session):

        progress = cls._row(db)

        return {
            "status": progress.status,
            "processed": progress.processed,
            "completed": progress.completed,
            "failed": progress.failed,
            "current_symbol": progress.current_symbol,
            "started_at": progress.started_at,
            "updated_at": progress.updated_at,
            "eta_minutes": progress.eta_minutes,
        }
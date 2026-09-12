from datetime import datetime
from sqlalchemy.orm import Session

from app.models.company import Company
from app.models.financial_import_queue import FinancialImportQueue


class FinancialQueueManager:
    """
    Sprint 31.5 Production Queue Manager
    """

    # -------------------------------
    # Bootstrap queue
    # -------------------------------
    @classmethod
    def bootstrap(cls, db: Session):

        existing = {
            s for (s,) in db.query(FinancialImportQueue.symbol).all()
        }

        companies = (
            db.query(Company.symbol, Company.id)
            .distinct(Company.symbol)
            .order_by(Company.symbol, Company.id)
            .all()
        )

        added = 0

        for symbol, company_id in companies:

            symbol = symbol.strip().upper()

            if symbol in existing:
                continue

            db.add(
                FinancialImportQueue(
                    company_id=company_id,
                    symbol=symbol,
                    status="PENDING",
                    attempts=0,
                    created_at=datetime.utcnow(),
                )
            )

            existing.add(symbol)
            added += 1

        db.commit()
        return added

    # -------------------------------
    # Clear Queue
    # -------------------------------
    @classmethod
    def clear_queue(cls, db: Session):

        deleted = db.query(FinancialImportQueue).delete()
        db.commit()
        return deleted

    # -------------------------------
    # Next pending
    # -------------------------------
    @classmethod
    def next_company(cls, db: Session):

        return (
            db.query(FinancialImportQueue)
            .filter(FinancialImportQueue.status == "PENDING")
            .order_by(FinancialImportQueue.id.asc())
            .first()
        )

    # -------------------------------
    # Completed
    # -------------------------------
    @classmethod
    def complete(cls, db: Session, symbol: str):

        job = (
            db.query(FinancialImportQueue)
            .filter(FinancialImportQueue.symbol == symbol.upper())
            .first()
        )

        if job:
            job.status = "COMPLETED"
            job.imported_at = datetime.utcnow()
            job.last_error = None
            db.commit()

    # -------------------------------
    # Temporary failure
    # -------------------------------
    @classmethod
    def fail(cls, db: Session, symbol: str, error: str):

        job = (
            db.query(FinancialImportQueue)
            .filter(FinancialImportQueue.symbol == symbol.upper())
            .first()
        )

        if job:
            job.status = "FAILED"
            job.attempts += 1
            job.last_error = error
            db.commit()

    # -------------------------------
    # Yahoo unavailable
    # -------------------------------
    @classmethod
    def unavailable(cls, db: Session, symbol: str, error: str):

        job = (
            db.query(FinancialImportQueue)
            .filter(FinancialImportQueue.symbol == symbol.upper())
            .first()
        )

        if job:
            job.status = "UNAVAILABLE"
            job.attempts += 1
            job.last_error = error
            db.commit()

    # -------------------------------
    # Retry Failed only
    # -------------------------------
    @classmethod
    def retry_failed(cls, db: Session):

        jobs = (
            db.query(FinancialImportQueue)
            .filter(FinancialImportQueue.status == "FAILED")
            .all()
        )

        for job in jobs:
            job.status = "PENDING"
            job.last_error = None

        db.commit()
        return len(jobs)

    # -------------------------------
    # Queue Stats
    # -------------------------------
    @classmethod
    def stats(cls, db: Session):

        total = db.query(FinancialImportQueue).count()

        pending = db.query(FinancialImportQueue).filter_by(status="PENDING").count()
        completed = db.query(FinancialImportQueue).filter_by(status="COMPLETED").count()
        failed = db.query(FinancialImportQueue).filter_by(status="FAILED").count()
        unavailable = db.query(FinancialImportQueue).filter_by(status="UNAVAILABLE").count()

        progress = round((completed / total) * 100, 2) if total else 0

        return {
            "total": total,
            "pending": pending,
            "completed": completed,
            "failed": failed,
            "unavailable": unavailable,
            "progress_percent": progress,
        }
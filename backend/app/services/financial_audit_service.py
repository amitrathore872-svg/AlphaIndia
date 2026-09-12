from datetime import datetime
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.company import Company
from app.models.quarterly_result import QuarterlyResult
from app.models.financial_import_queue import FinancialImportQueue
from app.models.financial_import_audit import FinancialImportAudit


class FinancialAuditService:
    """
    Alpha India Financial Warehouse Audit Service

    Sprint 31.5.2
    -----------------
    Generates warehouse-wide quality statistics.
    """

    @classmethod
    def warehouse_summary(cls, db: Session):

        total_companies = db.query(Company).count()

        imported_companies = (
            db.query(QuarterlyResult.company_id)
            .distinct()
            .count()
        )

        total_quarters = db.query(QuarterlyResult).count()

        # Queue Status
        pending = (
            db.query(FinancialImportQueue)
            .filter(FinancialImportQueue.status == "PENDING")
            .count()
        )

        completed = (
            db.query(FinancialImportQueue)
            .filter(FinancialImportQueue.status == "COMPLETED")
            .count()
        )

        failed = (
            db.query(FinancialImportQueue)
            .filter(FinancialImportQueue.status == "FAILED")
            .count()
        )

        unavailable = (
            db.query(FinancialImportQueue)
            .filter(FinancialImportQueue.status == "UNAVAILABLE")
            .count()
        )

        # Audit Status
        pass_count = (
            db.query(FinancialImportAudit)
            .filter(FinancialImportAudit.status == "PASS")
            .count()
        )

        warning_count = (
            db.query(FinancialImportAudit)
            .filter(FinancialImportAudit.status == "WARNING")
            .count()
        )

        fail_count = (
            db.query(FinancialImportAudit)
            .filter(FinancialImportAudit.status == "FAIL")
            .count()
        )

        average_health = (
            db.query(func.avg(FinancialImportAudit.health_score))
            .scalar()
        )

        latest_audit = (
            db.query(FinancialImportAudit)
            .order_by(FinancialImportAudit.audited_at.desc())
            .first()
        )

        coverage = round(
            imported_companies / total_companies * 100,
            2,
        ) if total_companies else 0

        return {
            "warehouse": {
                "total_companies": total_companies,
                "companies_imported": imported_companies,
                "coverage_percent": coverage,
                "quarter_records": total_quarters,
            },
            "queue": {
                "pending": pending,
                "completed": completed,
                "failed": failed,
                "unavailable": unavailable,
            },
            "audit": {
                "pass": pass_count,
                "warning": warning_count,
                "fail": fail_count,
                "average_health_score": round(
                    average_health or 0,
                    2,
                ),
                "latest_audit": latest_audit.audited_at
                if latest_audit else None,
            },
            "generated_at": datetime.utcnow(),
        }

    # ----------------------------------------------------------
    # Companies requiring repair
    # ----------------------------------------------------------

    @classmethod
    def failures(cls, db: Session, limit: int = 100):

        rows = (
            db.query(FinancialImportAudit)
            .filter(FinancialImportAudit.status != "PASS")
            .order_by(FinancialImportAudit.health_score.asc())
            .limit(limit)
            .all()
        )

        return [
            {
                "symbol": r.symbol,
                "status": r.status,
                "health_score": r.health_score,
                "quarters": r.quarter_count,
                "missing_revenue": r.missing_revenue,
                "missing_profit": r.missing_profit,
                "missing_eps": r.missing_eps,
                "missing_period": r.missing_period,
                "duplicate_quarters": r.duplicate_quarters,
            }
            for r in rows
        ]
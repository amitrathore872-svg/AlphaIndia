"""
Alpha India Financial Warehouse Repair Service
Sprint 31.5.1 — Production Repair Engine
Version: v1.0.0
"""

from sqlalchemy.orm import Session

from app.models.company import Company
from app.models.quarterly_result import QuarterlyResult
from app.models.financial_import_audit import FinancialImportAudit

from app.services.yahoo_import_service import YahooImportService
from app.services.financial_health_service import FinancialHealthService


class FinancialRepairService:
    """
    Repairs corrupted quarterly financial records without
    rebuilding the complete warehouse.
    """

    @classmethod
    def repair_company(cls, db: Session, symbol: str):

        symbol = symbol.upper()

        company = (
            db.query(Company)
            .filter(Company.symbol == symbol)
            .first()
        )

        if company is None:
            return {
                "success": False,
                "error": "Company not found.",
            }

        # --------------------------------------------------
        # Delete corrupted quarterly rows only.
        # --------------------------------------------------

        deleted = (
            db.query(QuarterlyResult)
            .filter(
                QuarterlyResult.company_id == company.id,
                (
                    (QuarterlyResult.revenue == None) |
                    (QuarterlyResult.net_profit == None) |
                    (QuarterlyResult.period_end == None)
                )
            )
            .delete(synchronize_session=False)
        )

        db.commit()

        # --------------------------------------------------
        # Re-import fresh financial statements.
        # --------------------------------------------------

        import_result = YahooImportService.import_company(
            db,
            symbol,
        )

        # --------------------------------------------------
        # Recalculate warehouse health.
        # --------------------------------------------------

        audit = FinancialHealthService.scan_company(
            db,
            company,
        )

        return {
            "success": True,
            "symbol": symbol,
            "deleted_corrupted_records": deleted,
            "quarters_imported": import_result["quarters_imported"],
            "duplicates_skipped": import_result["duplicates_skipped"],
            "health_score": audit["score"],
            "status": audit["status"],
        }

    @classmethod
    def repair_failed_companies(cls, db: Session):

        audits = (
            db.query(FinancialImportAudit)
            .filter(FinancialImportAudit.health_score < 90)
            .all()
        )

        repaired = []

        for audit in audits:

            repaired.append(
                cls.repair_company(
                    db,
                    audit.symbol,
                )
            )

        return {
            "companies_repaired": len(repaired),
            "results": repaired,
        }
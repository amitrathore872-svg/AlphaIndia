"""
Alpha India Mission Control API
Sprint 27.2
"""

from fastapi import APIRouter
from sqlalchemy import func

from app.db.database import SessionLocal
from app.models.company import Company
from app.models.filing_registry import FilingRegistry
from app.models.financial_metrics import FinancialMetric
from app.models.quarterly_result import QuarterlyResult
from app.models.financial_import_audit import FinancialImportAudit

router = APIRouter(
    prefix="/import-dashboard",
    tags=["Mission Control"],
)


@router.get("/summary")
def get_import_summary():
    db = SessionLocal()

    try:
        total_companies = db.query(func.count(Company.id)).scalar() or 0

        # Distinct companies with quarterly statements imported in the warehouse
        warehouse_companies = (
            db.query(func.count(func.distinct(QuarterlyResult.company_id))).scalar()
            or 0
        )

        # Total quarterly statement records in warehouse
        quarterly_records = db.query(func.count(QuarterlyResult.id)).scalar() or 0

        # Real audit statistics
        total_audited = db.query(func.count(FinancialImportAudit.id)).scalar() or 0
        audits_passed = (
            db.query(func.count(FinancialImportAudit.id))
            .filter(FinancialImportAudit.status == "PASS")
            .scalar()
            or 0
        )
        audits_warning = (
            db.query(func.count(FinancialImportAudit.id))
            .filter(FinancialImportAudit.status == "WARNING")
            .scalar()
            or 0
        )
        audits_fail = (
            db.query(func.count(FinancialImportAudit.id))
            .filter(FinancialImportAudit.status == "FAIL")
            .scalar()
            or 0
        )

        # Filing registry statistics
        filings_discovered = db.query(func.count(FilingRegistry.id)).scalar() or 0

        pdf_downloaded = (
            db.query(func.count(FilingRegistry.id))
            .filter(FilingRegistry.download_status.in_(["DOWNLOADED", "COMPLETED"]))
            .scalar()
            or 0
        )

        pending_downloads = (
            db.query(func.count(FilingRegistry.id))
            .filter(FilingRegistry.download_status == "PENDING")
            .scalar()
            or 0
        )

        parsed_filings = (
            db.query(func.count(FilingRegistry.id))
            .filter(FilingRegistry.parse_status.in_(["PARSED", "COMPLETED"]))
            .scalar()
            or 0
        )

        progress_percent = (
            round((warehouse_companies / total_companies) * 100, 2)
            if total_companies
            else 0
        )
        pending_companies = max(total_companies - warehouse_companies, 0)

        return {
            # Sprint 33 Nested Payload
            "warehouse": {
                "total_companies": total_companies,
                "imported_companies": warehouse_companies,
                "pending_companies": pending_companies,
                "coverage_percent": progress_percent,
                "quarterly_records": quarterly_records,
            },
            "audit": {
                "total_audited": total_audited,
                "pass": audits_passed,
                "warning": audits_warning,
                "fail": audits_fail,
            },
            # Flat backward-compatible fields
            "total_companies": total_companies,
            "imported_companies": warehouse_companies,
            "pending_companies": pending_companies,
            "progress_percent": progress_percent,
            "coverage_percent": progress_percent,
            "quarterly_records": quarterly_records,
            "filings_discovered": filings_discovered,
            "pdf_downloaded": pdf_downloaded,
            "pending_downloads": pending_downloads,
            "parsed_filings": parsed_filings,
            "ai_scores_generated": audits_passed,
        }

    finally:
        db.close()
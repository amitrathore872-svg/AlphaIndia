"""
Alpha India Mission Control API
Sprint 27.2
"""

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.database import get_db
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
def get_import_summary(db: Session = Depends(get_db)):
    total_companies = db.query(func.count(Company.id)).scalar() or 0

    warehouse_companies = (
        db.query(func.count(func.distinct(QuarterlyResult.company_id))).scalar()
        or 0
    )

    quarterly_records = db.query(func.count(QuarterlyResult.id)).scalar() or 0

    # Consolidated audit statistics query
    audit_stats = db.query(
        func.count(FinancialImportAudit.id).label("total"),
        func.count().filter(FinancialImportAudit.status == "PASS").label("passed"),
        func.count().filter(FinancialImportAudit.status == "WARNING").label("warning"),
        func.count().filter(FinancialImportAudit.status == "FAIL").label("fail"),
    ).one()

    # Consolidated filing registry statistics query
    filing_stats = db.query(
        func.count(FilingRegistry.id).label("total"),
        func.count().filter(FilingRegistry.download_status.in_(["DOWNLOADED", "COMPLETED"])).label("downloaded"),
        func.count().filter(FilingRegistry.download_status == "PENDING").label("pending"),
        func.count().filter(FilingRegistry.parse_status.in_(["PARSED", "COMPLETED"])).label("parsed"),
    ).one()

    total_audited = audit_stats.total or 0
    audits_passed = audit_stats.passed or 0
    audits_warning = audit_stats.warning or 0
    audits_fail = audit_stats.fail or 0

    filings_discovered = filing_stats.total or 0
    pdf_downloaded = filing_stats.downloaded or 0
    pending_downloads = filing_stats.pending or 0
    parsed_filings = filing_stats.parsed or 0

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
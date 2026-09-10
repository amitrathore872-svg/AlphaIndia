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

router = APIRouter(
    prefix="/import-dashboard",
    tags=["Mission Control"],
)


@router.get("/summary")
def get_import_summary():
    db = SessionLocal()

    try:
        total_companies = db.query(func.count(Company.id)).scalar() or 0

        imported_companies = (
            db.query(func.count(func.distinct(FilingRegistry.company_id))).scalar()
            or 0
        )

        filings_discovered = db.query(func.count(FilingRegistry.id)).scalar() or 0

        pdf_downloaded = (
            db.query(func.count(FilingRegistry.id))
            .filter(FilingRegistry.download_status == "DOWNLOADED")
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
            .filter(FilingRegistry.parse_status == "PARSED")
            .scalar()
            or 0
        )

        ai_scores_generated = (
            db.query(func.count(FinancialMetric.id))
            .filter(FinancialMetric.ai_score.is_not(None))
            .scalar()
            or 0
        )

        progress_percent = (
            round((imported_companies / total_companies) * 100, 2)
            if total_companies
            else 0
        )

        return {
            "total_companies": total_companies,
            "imported_companies": imported_companies,
            "progress_percent": progress_percent,
            "filings_discovered": filings_discovered,
            "pdf_downloaded": pdf_downloaded,
            "pending_downloads": pending_downloads,
            "parsed_filings": parsed_filings,
            "ai_scores_generated": ai_scores_generated,
        }

    finally:
        db.close()
"""
Alpha India Filing Registry API
Sprint 28.3A
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db.database import get_db
from app.models.filing_registry import FilingRegistry

router = APIRouter(prefix="/filings", tags=["Filings"])


@router.get("/company/{symbol}")
def company_filings(symbol: str, db: Session = Depends(get_db)):

    filings = (
        db.query(FilingRegistry)
        .filter(FilingRegistry.symbol == symbol.upper())
        .order_by(FilingRegistry.announcement_date.desc())
        .all()
    )

    return {
        "symbol": symbol.upper(),
        "count": len(filings),
        "filings": [
            {
                "period": f.period,
                "filing_type": f.filing_type,
                "announcement_date": f.announcement_date,
                "download_status": f.download_status,
                "parse_status": f.parse_status,
                "pdf_url": f.pdf_url,
            }
            for f in filings
        ],
    }


@router.get("/summary")
def filing_summary(db: Session = Depends(get_db)):
    stats = db.query(
        func.count(FilingRegistry.id).label("total"),
        func.count().filter(FilingRegistry.download_status == "DOWNLOADED").label("downloaded"),
        func.count().filter(FilingRegistry.parse_status == "COMPLETED").label("parsed"),
        func.count().filter(FilingRegistry.download_status == "PENDING").label("pending"),
    ).one()

    return {
        "total_filings": stats.total or 0,
        "pending_downloads": stats.pending or 0,
        "downloaded": stats.downloaded or 0,
        "parsed": stats.parsed or 0,
    }
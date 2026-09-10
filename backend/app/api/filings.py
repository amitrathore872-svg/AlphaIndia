"""
Alpha India Filing Registry API
Sprint 28.3A
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.models.filing_registry import FilingRegistry

router = APIRouter(prefix="/filings", tags=["Filings"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


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

    total = db.query(FilingRegistry).count()

    downloaded = (
        db.query(FilingRegistry)
        .filter(FilingRegistry.download_status == "DOWNLOADED")
        .count()
    )

    parsed = (
        db.query(FilingRegistry)
        .filter(FilingRegistry.parse_status == "COMPLETED")
        .count()
    )

    pending = (
        db.query(FilingRegistry)
        .filter(FilingRegistry.download_status == "PENDING")
        .count()
    )

    return {
        "total_filings": total,
        "pending_downloads": pending,
        "downloaded": downloaded,
        "parsed": parsed,
    }
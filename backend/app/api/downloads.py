"""
Alpha India PDF Download API
Sprint 28.4
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.models.filing_registry import FilingRegistry
from app.services.download_worker import DownloadWorker

router = APIRouter(prefix="/downloads", tags=["Downloads"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/summary")
def summary(db: Session = Depends(get_db)):

    total = db.query(FilingRegistry).count()

    pending = (
        db.query(FilingRegistry)
        .filter(FilingRegistry.download_status == "PENDING")
        .count()
    )

    downloaded = (
        db.query(FilingRegistry)
        .filter(FilingRegistry.download_status == "DOWNLOADED")
        .count()
    )

    failed = (
        db.query(FilingRegistry)
        .filter(FilingRegistry.download_status == "FAILED")
        .count()
    )

    return {
        "total_filings": total,
        "pending": pending,
        "downloaded": downloaded,
        "failed": failed,
    }


@router.get("/pending")
def pending_downloads(db: Session = Depends(get_db)):

    filings = (
        db.query(FilingRegistry)
        .filter(FilingRegistry.download_status == "PENDING")
        .order_by(FilingRegistry.announcement_date.desc())
        .all()
    )

    return {
        "count": len(filings),
        "results": [
            {
                "symbol": f.symbol,
                "period": f.period,
                "filing_type": f.filing_type,
                "announcement_date": f.announcement_date,
                "pdf_url": f.pdf_url,
            }
            for f in filings
        ],
    }


@router.post("/company/{symbol}")
def download_company(symbol: str, db: Session = Depends(get_db)):
    return DownloadWorker.download_company(db, symbol)


@router.post("/worker")
def download_next_pending(db: Session = Depends(get_db)):

    filing = (
        db.query(FilingRegistry)
        .filter(FilingRegistry.download_status == "PENDING")
        .order_by(FilingRegistry.announcement_date.desc())
        .first()
    )

    if not filing:
        return {"message": "Queue Empty"}

    return DownloadWorker.download_company(db, filing.symbol)
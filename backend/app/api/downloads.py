# backend/app/api/downloads.py

```python
"""
Alpha India Download API
Sprint 29.2.2 — Bronze Layer Download Endpoints (Production)
Version: v0.9.8-alpha
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.models.filing_registry import FilingRegistry
from app.services.pdf_download_service import PDFDownloadService

router = APIRouter(
    prefix="/downloads",
    tags=["Bronze PDF Downloads"],
)


# ==========================================================
# Database Dependency
# ==========================================================
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ==========================================================
# Download Summary
# ==========================================================
@router.get("/summary")
def download_summary(db: Session = Depends(get_db)):
    """
    Returns Bronze Layer download statistics for Mission Control.
    """

    return {
        "total_filings": db.query(FilingRegistry).count(),

        "pending": db.query(FilingRegistry)
        .filter(FilingRegistry.download_status == "PENDING")
        .count(),

        "downloaded": db.query(FilingRegistry)
        .filter(FilingRegistry.download_status == "DOWNLOADED")
        .count(),

        "archive_missing": db.query(FilingRegistry)
        .filter(FilingRegistry.download_status == "ARCHIVE_MISSING")
        .count(),

        "archive_unavailable": db.query(FilingRegistry)
        .filter(FilingRegistry.download_status == "ARCHIVE_UNAVAILABLE")
        .count(),

        "invalid_file": db.query(FilingRegistry)
        .filter(FilingRegistry.download_status == "INVALID_FILE")
        .count(),

        "failed": db.query(FilingRegistry)
        .filter(FilingRegistry.download_status == "FAILED")
        .count(),
    }


# ==========================================================
# Pending Downloads
# ==========================================================
@router.get("/pending")
def pending_downloads(db: Session = Depends(get_db)):
    """
    Returns pending downloads (maximum 100 records).
    """

    filings = (
        db.query(FilingRegistry)
        .filter(FilingRegistry.download_status == "PENDING")
        .order_by(FilingRegistry.announcement_date.desc())
        .limit(100)
        .all()
    )

    return {
        "count": len(filings),
        "results": [
            {
                "symbol": filing.symbol,
                "period": filing.period,
                "filing_type": filing.filing_type,
                "announcement_date": filing.announcement_date,
                "pdf_url": filing.pdf_url,
            }
            for filing in filings
        ],
    }


# ==========================================================
# Download One Company
# ==========================================================
@router.post("/company/{symbol}")
def download_company(symbol: str, db: Session = Depends(get_db)):
    """
    Downloads all pending PDFs for one company.
    """

    symbol = symbol.upper()

    exists = (
        db.query(FilingRegistry)
        .filter(FilingRegistry.symbol == symbol)
        .count()
    )

    if exists == 0:
        raise HTTPException(
            status_code=404,
            detail=f"No filings found for {symbol}.",
        )

    return PDFDownloadService.download_company(db, symbol)


# ==========================================================
# Download Next Pending Filing
# ==========================================================
@router.post("/run-next")
def run_next_download(db: Session = Depends(get_db)):
    """
    Downloads the next pending filing from Bronze queue.
    Used later by scheduler/background worker.
    """

    filing = (
        db.query(FilingRegistry)
        .filter(FilingRegistry.download_status == "PENDING")
        .order_by(FilingRegistry.announcement_date.desc())
        .first()
    )

    if filing is None:
        raise HTTPException(
            status_code=404,
            detail="No pending downloads.",
        )

    success = PDFDownloadService.download_filing(db, filing)
    db.commit()

    return {
        "success": success,
        "symbol": filing.symbol,
        "period": filing.period,
        "filing_type": filing.filing_type,
        "announcement_date": filing.announcement_date,
        "status": filing.download_status,
        "local_path": filing.pdf_local_path,
    }


# ==========================================================
# Download Health
# ==========================================================
@router.get("/health")
def download_health(db: Session = Depends(get_db)):
    """
    Returns Bronze download pipeline health.
    """

    stats = download_summary(db)

    processed = (
        stats["downloaded"]
        + stats["archive_missing"]
        + stats["archive_unavailable"]
        + stats["invalid_file"]
        + stats["failed"]
    )

    completion = (
        round((processed / stats["total_filings"]) * 100, 2)
        if stats["total_filings"] > 0
        else 0
    )

    return {
        "pipeline": "Bronze Layer PDF Downloader",
        "status": "HEALTHY",
        "completion_percent": completion,
        "statistics": stats,
    }
```

"""
Alpha India Financial Warehouse API
Sprint 32.1.2 — Background Import + Audit Engine
Version: v2.1.0
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.models.company import Company
from app.models.quarterly_result import QuarterlyResult

from app.services.yahoo_import_service import YahooImportService
from app.services.financial_import_worker import FinancialImportWorker
from app.services.financial_batch_importer import FinancialBatchImporter
from app.services.financial_queue_manager import FinancialQueueManager
from app.services.financial_progress_service import FinancialProgressService
from app.services.financial_import_engine import FinancialImportEngine
from app.services.financial_audit_service import FinancialAuditService
from app.services.financial_audit_engine import FinancialAuditEngine

router = APIRouter(
    prefix="/financials",
    tags=["Financial Warehouse"],
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
# Financial Warehouse Status
# ==========================================================

@router.get("/status")
def warehouse_status(db: Session = Depends(get_db)):

    companies = db.query(QuarterlyResult.company_id).distinct().count()
    quarters = db.query(QuarterlyResult).count()

    latest_import = (
        db.query(QuarterlyResult)
        .order_by(QuarterlyResult.imported_at.desc())
        .first()
    )

    return {
        "warehouse": "ACTIVE",
        "companies_imported": companies,
        "quarter_records": quarters,
        "queue": FinancialQueueManager.stats(db),
        "progress": FinancialProgressService.summary(db),
        "engine": FinancialImportEngine.status(),
        "audit": FinancialAuditService.warehouse_summary(db)["audit"],
        "latest_import": latest_import.imported_at if latest_import else None,
    }


# ==========================================================
# Queue Status
# ==========================================================

@router.get("/queue")
def queue_status(db: Session = Depends(get_db)):
    return FinancialQueueManager.stats(db)


# ==========================================================
# Live Import Progress
# ==========================================================

@router.get("/progress")
def import_progress(db: Session = Depends(get_db)):
    return FinancialProgressService.summary(db)


# ==========================================================
# Financial Warehouse Audit Summary
# ==========================================================

@router.get("/audit/summary")
def audit_summary(db: Session = Depends(get_db)):
    """
    Returns warehouse-wide financial data quality summary.
    """
    return FinancialAuditService.warehouse_summary(db)


# ==========================================================
# Companies Requiring Repair
# ==========================================================

@router.get("/audit/failures")
def audit_failures(
    limit: int = 100,
    db: Session = Depends(get_db),
):
    """
    Returns companies with WARNING or FAIL audit status.
    """

    if limit < 1 or limit > 500:
        raise HTTPException(
            status_code=400,
            detail="limit must be between 1 and 500",
        )

    return {
        "count": limit,
        "companies": FinancialAuditService.failures(db, limit),
    }


# ==========================================================
# Start Financial Audit Engine
# ==========================================================

@router.post("/audit/engine/start")
def start_audit_engine(
    batch_size: int = 100,
    sleep_seconds: int = 1,
):

    if batch_size < 1 or batch_size > 500:
        raise HTTPException(
            status_code=400,
            detail="batch_size must be between 1 and 500",
        )

    return FinancialAuditEngine.start(
        batch_size=batch_size,
        sleep_seconds=sleep_seconds,
    )


# ==========================================================
# Stop Financial Audit Engine
# ==========================================================

@router.post("/audit/engine/stop")
def stop_audit_engine():
    """
    Stops the background financial audit engine.
    """
    return FinancialAuditEngine.stop()


# ==========================================================
# Financial Audit Engine Status
# ==========================================================

@router.get("/audit/engine/status")
def audit_engine_status(
    db: Session = Depends(get_db),
):
    """
    Returns background audit engine status together with
    warehouse audit statistics.
    """
    return FinancialAuditEngine.status(db)


# ==========================================================
# Import One Company
# ==========================================================

@router.post("/import/{symbol}")
def import_company(symbol: str, db: Session = Depends(get_db)):

    symbol = symbol.upper()

    company = (
        db.query(Company)
        .filter(Company.symbol == symbol)
        .first()
    )

    if company is None:
        raise HTTPException(
            status_code=404,
            detail=f"{symbol} not found in company master.",
        )

    return YahooImportService.import_company(db, symbol)


# ==========================================================
# Import Next Pending Company
# ==========================================================

@router.post("/run-next")
def run_next_import(db: Session = Depends(get_db)):
    return FinancialImportWorker.run_next(db)


# ==========================================================
# Batch Import (Manual Trigger)
# ==========================================================

@router.post("/run-batch")
def run_batch_import(
    limit: int = 10,
    db: Session = Depends(get_db),
):

    if limit < 1 or limit > 100:
        raise HTTPException(
            status_code=400,
            detail="limit must be between 1 and 100",
        )

    return FinancialBatchImporter.run_batch(db, limit)


# ==========================================================
# Manual Import Engine
# ==========================================================

@router.post("/run-engine")
def run_engine(
    limit: int = 100,
    db: Session = Depends(get_db),
):
    """
    Manual import endpoint.
    Imports a fixed number of pending companies.
    Does NOT run continuously.
    """

    if limit < 1 or limit > 500:
        raise HTTPException(
            status_code=400,
            detail="limit must be between 1 and 500",
        )

    return FinancialBatchImporter.run_batch(db, limit)


# ==========================================================
# Background Import Engine — START
# ==========================================================

@router.post("/engine/start")
def start_engine(
    batch_size: int = 20,
    sleep_seconds: int = 1,
):
    """
    Starts the continuous background financial import engine.
    """

    if batch_size < 1 or batch_size > 500:
        raise HTTPException(
            status_code=400,
            detail="batch_size must be between 1 and 500",
        )

    return FinancialImportEngine.start(
        batch_size=batch_size,
        sleep_seconds=sleep_seconds,
    )


# ==========================================================
# Background Import Engine — STOP
# ==========================================================

@router.post("/engine/stop")
def stop_engine():
    """
    Stops the continuous background financial import engine.
    """
    return FinancialImportEngine.stop()


# ==========================================================
# Background Import Engine — STATUS
# ==========================================================

@router.get("/engine/status")
def engine_status(db: Session = Depends(get_db)):
    """
    Returns import engine health and queue progress.
    """

    return {
        "engine": FinancialImportEngine.status(),
        "progress": FinancialProgressService.summary(db),
        "queue": FinancialQueueManager.stats(db),
    }


# ==========================================================
# Retry Failed Imports
# ==========================================================

@router.post("/retry-failed")
def retry_failed(db: Session = Depends(get_db)):

    updated = FinancialQueueManager.retry_failed(db)

    return {
        "success": True,
        "companies_reset": updated,
        "queue": FinancialQueueManager.stats(db),
    }


# ==========================================================
# Company Financial History
# ==========================================================

@router.get("/company/{symbol}")
def company_financials(
    symbol: str,
    db: Session = Depends(get_db),
):

    symbol = symbol.upper()

    company = (
        db.query(Company)
        .filter(Company.symbol == symbol)
        .first()
    )

    if company is None:
        raise HTTPException(
            status_code=404,
            detail="Company not found.",
        )

    results = (
        db.query(QuarterlyResult)
        .filter(QuarterlyResult.company_id == company.id)
        .order_by(QuarterlyResult.period_end.desc())
        .all()
    )

    return {
        "symbol": symbol,
        "company": company.company,
        "quarters": len(results),
        "financials": [
            {
                "fiscal_period": q.fiscal_period,
                "period_end": q.period_end,
                "revenue": q.revenue,
                "net_profit": q.net_profit,
                "eps": q.eps,
                "interest_income": q.interest_income,
                "interest_expense": q.interest_expense,
                "net_interest_income": q.net_interest_income,
                "book_value": q.book_value,
                "revenue_growth": q.revenue_growth,
                "pat_growth": q.pat_growth,
                "roce": q.roce,
                "source": q.source,
                "imported_at": q.imported_at,
            }
            for q in results
        ],
    }
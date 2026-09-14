"""
Alpha India Market Intelligence API
Sprint 35 — Market Intelligence & Growth Screener PRO
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.company import Company
from app.models.company_market_metrics import CompanyMarketMetrics
from app.workers.yahoo_import_worker import YahooImportWorker

router = APIRouter(
    prefix="/market-intelligence",
    tags=["Market Intelligence"],
)


@router.get("/status")
def market_intelligence_status():
    """
    Returns the real-time status of the Yahoo Finance Market Intelligence enrichment worker.
    """
    return {
        "success": True,
        **YahooImportWorker.status(),
    }


@router.post("/sync")
def start_market_intelligence_sync(
    batch_size: int = Query(default=50, ge=1, le=200),
    sleep_seconds: float = Query(default=0.2, ge=0.05, le=5.0),
):
    """
    Triggers the background Yahoo Finance worker to enrich companies with live market valuation.
    """
    res = YahooImportWorker.start(batch_size=batch_size, sleep_seconds=sleep_seconds)
    return {"success": True, **res}


@router.post("/stop")
def stop_market_intelligence_sync():
    """
    Halts the background Yahoo Finance enrichment worker.
    """
    res = YahooImportWorker.stop()
    return {"success": True, **res}


@router.get("/company/{symbol}")
def get_company_market_metrics(symbol: str, db: Session = Depends(get_db)):
    """
    Returns market intelligence data for a single company symbol.
    """
    clean_symbol = symbol.strip().upper()
    company = db.query(Company).filter(Company.symbol == clean_symbol).first()
    if not company:
        raise HTTPException(status_code=404, detail=f"Company {clean_symbol} not found.")

    record = (
        db.query(CompanyMarketMetrics)
        .filter(CompanyMarketMetrics.company_id == company.id)
        .first()
    )

    if not record:
        # Sync on demand if not yet cached
        YahooImportWorker.upsert_company_metrics(db, company)
        record = (
            db.query(CompanyMarketMetrics)
            .filter(CompanyMarketMetrics.company_id == company.id)
            .first()
        )

    if not record:
        raise HTTPException(status_code=404, detail="Market data unavailable for this symbol.")

    return {
        "success": True,
        "symbol": record.symbol,
        "company": company.company,
        "cmp": record.cmp,
        "market_cap": record.market_cap,
        "market_cap_category": record.market_cap_category,
        "pe_ratio": record.pe_ratio,
        "industry_pe": record.industry_pe,
        "pb_ratio": record.pb_ratio,
        "peg_ratio": record.peg_ratio,
        "roce": record.roce,
        "roe": record.roe,
        "opm": record.opm,
        "book_value": record.book_value,
        "dividend_yield": record.dividend_yield,
        "fifty_two_week_high": record.fifty_two_week_high,
        "fifty_two_week_low": record.fifty_two_week_low,
        "sector": record.sector,
        "industry": record.industry,
        "exchange": record.exchange,
        "last_updated": record.last_updated.isoformat() if record.last_updated else None,
    }

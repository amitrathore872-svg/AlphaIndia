from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.company import Company
from app.models.quarterly_result import QuarterlyResult
from app.models.screener_growth_record import ScreenerGrowthRecord
from app.schemas.growth import DashboardSummary
from app.services.discovery_worker import DiscoveryWorker
from app.services.discovery_service import DiscoveryService
from app.services.queue_manager import QueueManager

router = APIRouter(tags=["Dashboard"])


@router.get("/dashboard-summary", response_model=DashboardSummary)
def dashboard_summary(db: Session = Depends(get_db)):
    score_expr = func.coalesce(ScreenerGrowthRecord.health_score, Company.ai_score, 0)
    query = (
        db.query(
            func.coalesce(func.avg(score_expr), 0).label("avg_score"),
            func.count().filter(score_expr >= 80).label("high_growth"),
        )
        .select_from(Company)
        .outerjoin(ScreenerGrowthRecord, ScreenerGrowthRecord.symbol == Company.symbol)
        .filter(Company.listing_status == "Active")
        .filter(Company.is_growth_eligible.is_(True))
    )
    avg_score, high_growth = query.one()

    leader = (
        db.query(Company.company, score_expr.label("score"))
        .select_from(Company)
        .outerjoin(ScreenerGrowthRecord, ScreenerGrowthRecord.symbol == Company.symbol)
        .filter(Company.listing_status == "Active")
        .filter(Company.is_growth_eligible.is_(True))
        .order_by(score_expr.desc())
        .first()
    )

    return {
        "companiesTracked": db.query(func.count(Company.id)).scalar() or 0,
        "resultsToday": db.query(func.count(QuarterlyResult.id)).filter(QuarterlyResult.result_date == date.today()).scalar() or 0,
        "averageGrowthScore": round(float(avg_score), 1),
        "currentLeader": {"name": leader.company, "score": round(float(leader.score), 1)} if leader else None,
        "highGrowthStocks": high_growth or 0,
    }


@router.post("/company/{symbol}")
def discover_company(symbol: str, db: Session = Depends(get_db)):
    """
    Discover historical filings for a single company.
    Example:
        POST /discovery/company/KTKBANK
    """
    result = DiscoveryWorker.discover_company(
        db=db,
        symbol=symbol.upper(),
        exchange="NSE",
    )

    QueueManager.complete_company(symbol.upper())

    heartbeat = DiscoveryService.get_status(db)
    heartbeat.companies_scanned_today += 1
    db.commit()

    return {
        "success": True,
        "message": f"Historical filings discovered for {symbol.upper()}",
        **result,
    }
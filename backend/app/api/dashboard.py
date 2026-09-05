from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.growth import latest_results_query
from app.db.database import get_db
from app.models.company import Company
from app.models.quarterly_result import QuarterlyResult
from app.schemas.growth import DashboardSummary

router = APIRouter(tags=["Dashboard"])


@router.get("/dashboard-summary", response_model=DashboardSummary)
def dashboard_summary(db: Session = Depends(get_db)):
    latest = latest_results_query(db).subquery()
    average_score, high_growth = db.query(func.coalesce(func.avg(latest.c.growth_score), 0), func.count().filter(latest.c.growth_score >= 80)).one()
    leader = db.query(latest.c.company, latest.c.growth_score).order_by(latest.c.growth_score.desc()).first()
    return {"companiesTracked": db.query(func.count(Company.id)).scalar() or 0, "resultsToday": db.query(func.count(QuarterlyResult.id)).filter(QuarterlyResult.result_date == date.today()).scalar() or 0, "averageGrowthScore": round(float(average_score), 1), "currentLeader": {"name": leader.company, "score": round(float(leader.growth_score), 1)} if leader else None, "highGrowthStocks": high_growth or 0}


from fastapi import APIRouter, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.db.database import SessionLocal
from app.models.company import Company
from app.models.financial_metrics import FinancialMetric

router = APIRouter(
    prefix="/growth-metrics",
    tags=["Growth Metrics"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("")
def get_growth_metrics(
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    exchange: str | None = None,
    sector: str | None = None,
    min_ai_score: int = Query(0, ge=0, le=100),
):
    db: Session = SessionLocal()

    query = (
        db.query(
            Company.id,
            Company.company.label("company_name"),   # ✅ FIX HERE
            Company.symbol,
            Company.exchange,
            Company.sector,
            FinancialMetric.period,
            FinancialMetric.revenue_growth,
            FinancialMetric.pat_growth,
            FinancialMetric.roce,
            FinancialMetric.debt_equity,
            FinancialMetric.promoter_holding,
            FinancialMetric.ai_score,
        )
        .join(
            FinancialMetric,
            Company.id == FinancialMetric.company_id,
        )
    )

    if exchange:
        query = query.filter(Company.exchange == exchange)

    if sector:
        query = query.filter(Company.sector == sector)

    query = query.filter(FinancialMetric.ai_score >= min_ai_score)

    total = query.count()

    results = (
        query.order_by(desc(FinancialMetric.ai_score))
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    db.close()

    return {
        "page": page,
        "limit": limit,
        "total": total,
        "results": [
            {
                "id": row.id,
                "company_name": row.company_name,
                "symbol": row.symbol,
                "exchange": row.exchange,
                "sector": row.sector or "Unknown",
                "period": row.period,
                "revenue_growth": float(row.revenue_growth or 0),
                "pat_growth": float(row.pat_growth or 0),
                "roce": float(row.roce or 0),
                "debt_equity": float(row.debt_equity or 0),
                "promoter_holding": float(row.promoter_holding or 0),
                "ai_score": float(row.ai_score or 0),
            }
            for row in results
        ],
    }
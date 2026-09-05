from math import ceil

from fastapi import APIRouter, Depends, Query
from sqlalchemy import Float, String, and_, asc, cast, desc, func, or_
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.company import Company
from app.models.quarterly_result import QuarterlyResult
from app.schemas.growth import GrowthScreenerResponse
from app.services.growth_score import growth_score_expression

router = APIRouter(prefix="/growth-screener", tags=["Growth Screener"])


def latest_results_query(db: Session):
    """One latest quarterly result per company for stable screener rows and totals."""
    latest_result_ids = db.query(
        QuarterlyResult.id.label("result_id"),
        func.row_number().over(partition_by=QuarterlyResult.company_id, order_by=(QuarterlyResult.result_date.desc(), QuarterlyResult.id.desc())).label("rank"),
    ).subquery()
    return db.query(Company, QuarterlyResult, growth_score_expression(QuarterlyResult)).join(QuarterlyResult, QuarterlyResult.company_id == Company.id).join(latest_result_ids, latest_result_ids.c.result_id == QuarterlyResult.id).filter(latest_result_ids.c.rank == 1)


def market_cap_filter(market_cap: str):
    """Support imported numeric rupee-crore values and pre-classified cap strings."""
    cap_text = func.nullif(func.regexp_replace(Company.market_cap, r"[^0-9.]", "", "g"), "")
    numeric_cap = cast(cast(cap_text, String), Float)
    if market_cap == "large":
        return or_(func.lower(Company.market_cap) == "large cap", numeric_cap >= 50000)
    if market_cap == "mid":
        return or_(func.lower(Company.market_cap) == "mid cap", and_(numeric_cap >= 10000, numeric_cap < 50000))
    if market_cap == "small":
        return or_(func.lower(Company.market_cap) == "small cap", numeric_cap < 10000)
    return None


@router.get("", response_model=GrowthScreenerResponse)
def growth_screener(
    search: str | None = Query(default=None, max_length=120), sector: str | None = Query(default=None, max_length=120),
    marketCap: str | None = Query(default=None, pattern="^(all|large|mid|small)$"), minScore: float = Query(default=80, ge=0, le=100),
    page: int = Query(default=1, ge=1), limit: int = Query(default=50, ge=1, le=100),
    sortBy: str = Query(default="growthScore", pattern="^(growthScore|revenueGrowth|patGrowth|roce|company)$"), sortOrder: str = Query(default="desc", pattern="^(asc|desc)$"),
    db: Session = Depends(get_db),
):
    query = latest_results_query(db)
    score = growth_score_expression(QuarterlyResult)
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(or_(Company.company.ilike(term), Company.symbol.ilike(term), Company.sector.ilike(term)))
    if sector:
        query = query.filter(func.lower(Company.sector) == sector.strip().lower())
    cap_condition = market_cap_filter(marketCap) if marketCap and marketCap != "all" else None
    if cap_condition is not None:
        query = query.filter(cap_condition)
    query = query.filter(score >= minScore)
    sortable = {"growthScore": score, "revenueGrowth": QuarterlyResult.revenue_growth, "patGrowth": QuarterlyResult.pat_growth, "roce": QuarterlyResult.roce, "company": Company.company}
    ordering = asc(sortable[sortBy]) if sortOrder == "asc" else desc(sortable[sortBy])
    total_items = query.order_by(None).count()
    rows = query.order_by(ordering, asc(Company.company)).offset((page - 1) * limit).limit(limit).all()
    sectors = [row[0] for row in db.query(Company.sector).filter(Company.sector.isnot(None)).distinct().order_by(Company.sector).all()]
    return {"items": [{"company": company.company, "symbol": company.symbol, "sector": company.sector, "marketCap": company.market_cap or "Unknown", "quarter": result.quarter, "resultDate": result.result_date, "revenueGrowth": result.revenue_growth or 0, "patGrowth": result.pat_growth or 0, "roce": result.roce or 0, "growthScore": score_value or 0} for company, result, score_value in rows], "page": page, "limit": limit, "totalItems": total_items, "totalPages": ceil(total_items / limit) if total_items else 0, "sectors": sectors}

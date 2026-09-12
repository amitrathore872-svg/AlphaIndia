# ==========================================================
# Alpha India Growth Screener API
# Sprint 33.4 Stable Recovery
# Server-side Search + Sorting + Pagination
# PostgreSQL Compatible
# ==========================================================

from math import ceil

from fastapi import APIRouter, Depends, Query
from sqlalchemy import asc, desc, func, or_
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.company import Company
from app.models.quarterly_result import QuarterlyResult
from app.services.growth_score import growth_score_expression

router = APIRouter(
    prefix="/growth-screener",
    tags=["Growth Screener"],
)


# ==========================================================
# Latest Quarterly Result per Company
# ==========================================================

def latest_results_query(db: Session):
    """
    Returns only the latest quarterly result for each company.
    """

    latest_result_ids = (
        db.query(
            QuarterlyResult.id.label("result_id"),
            func.row_number()
            .over(
                partition_by=QuarterlyResult.company_id,
                order_by=(
                    QuarterlyResult.result_date.desc(),
                    QuarterlyResult.id.desc(),
                ),
            )
            .label("rank"),
        )
        .subquery()
    )

    score = growth_score_expression(QuarterlyResult)

    return (
        db.query(Company, QuarterlyResult, score.label("health_score"))
        .join(
            QuarterlyResult,
            QuarterlyResult.company_id == Company.id,
        )
        .join(
            latest_result_ids,
            latest_result_ids.c.result_id == QuarterlyResult.id,
        )
        .filter(latest_result_ids.c.rank == 1)
    )


# ==========================================================
# Growth Screener
# ==========================================================

@router.get("")
def growth_screener(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=25, ge=1, le=100),

    search: str = Query(default=""),
    sector: str | None = Query(default=None),

    sort_by: str = Query(
        default="revenue_growth",
        pattern="^(company|revenue_growth|pat_growth|health_score)$",
    ),
    sort_order: str = Query(
        default="desc",
        pattern="^(asc|desc)$",
    ),

    db: Session = Depends(get_db),
):
    """
    Enterprise Growth Screener API.
    """

    query = latest_results_query(db)

    # ------------------------------------------------------
    # Search
    # ------------------------------------------------------

    if search.strip():
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Company.symbol.ilike(term),
                Company.company.ilike(term),
                Company.sector.ilike(term),
            )
        )

    # ------------------------------------------------------
    # Sector Filter
    # ------------------------------------------------------

    if sector:
        query = query.filter(
            func.lower(Company.sector) == sector.lower()
        )

    # ------------------------------------------------------
    # Sorting
    # ------------------------------------------------------

    score_expr = growth_score_expression(QuarterlyResult)

    sortable_columns = {
        "company": Company.company,
        "revenue_growth": QuarterlyResult.revenue_growth,
        "pat_growth": QuarterlyResult.pat_growth,
        "health_score": score_expr,
    }

    sort_column = sortable_columns.get(
        sort_by,
        QuarterlyResult.revenue_growth,
    )

    ordering = (
        asc(sort_column)
        if sort_order == "asc"
        else desc(sort_column)
    )

    total_items = query.order_by(None).count()

    rows = (
        query.order_by(ordering, asc(Company.company))
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    # ------------------------------------------------------
    # Response
    # ------------------------------------------------------

    results = []

    for company, result, health_score in rows:
        results.append(
    {
        "symbol": company.symbol,
        "company": company.company,

        # Safe field access for Sprint 33 schema
        "sector": getattr(company, "sector", None) or "Unknown",
        "exchange": "NSE",  # Default until exchange is added to Company model
        "market_cap": getattr(company, "market_cap", None) or "Unknown",

        "revenue_growth": result.revenue_growth or 0,
        "pat_growth": result.pat_growth or 0,

        "health_score": round(float(health_score or 0), 2),

        "result_date": (
            result.result_date.isoformat()
            if result.result_date
            else None
        ),
    }
)

    return {
        "success": True,
        "results": results,
        "page": page,
        "limit": limit,
        "total": total_items,
        "total_pages": ceil(total_items / limit) if total_items else 1,
    }


# ==========================================================
# Growth Screener Filters
# ==========================================================

@router.get("/filters")
def growth_screener_filters(db: Session = Depends(get_db)):
    """
    Returns dropdown options for Growth Screener filters.
    """

    sectors = (
        db.query(Company.sector)
        .filter(Company.sector.isnot(None))
        .filter(Company.sector != "")
        .distinct()
        .order_by(Company.sector)
        .all()
    )

    exchanges = (
        db.query(Company.exchange)
        .filter(Company.exchange.isnot(None))
        .filter(Company.exchange != "")
        .distinct()
        .order_by(Company.exchange)
        .all()
    )

    return {
        "success": True,
        "sectors": [row[0] for row in sectors if row[0]],
        "exchanges": [row[0] for row in exchanges if row[0]],
        "health_scores": [
            "90-100",
            "80-89",
            "70-79",
            "60-69",
            "<60",
        ],
    }
@router.get("/filters")
def growth_screener_filters(db: Session = Depends(get_db)):
    sectors = (
        db.query(Company.sector)
        .filter(Company.sector.isnot(None))
        .filter(Company.sector != "")
        .distinct()
        .order_by(Company.sector)
        .all()
    )

    exchanges = (
        db.query(Company.exchange)
        .filter(Company.exchange.isnot(None))
        .filter(Company.exchange != "")
        .distinct()
        .order_by(Company.exchange)
        .all()
    )

    return {
        "success": True,
        "sectors": [row[0] for row in sectors if row[0]],
        "exchanges": [row[0] for row in exchanges if row[0]],
        "health_scores": [
            "90-100",
            "80-89",
            "70-79",
            "60-69",
            "<60",
        ],
    }
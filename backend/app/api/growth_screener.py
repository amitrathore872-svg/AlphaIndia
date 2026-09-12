# ==========================================================
# Alpha India Growth Screener API
# Sprint 33.4.1
# GAP-02 + GAP-03
# Filters + Enterprise Global Sorting
# ==========================================================

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.company import Company

router = APIRouter(
    prefix="/growth-screener",
    tags=["Growth Screener"],
)

# ==========================================================
# Growth Screener Filters
# GAP-02
# ==========================================================


@router.get("/filters")
def growth_screener_filters(db: Session = Depends(get_db)):
    """
    Returns dropdown options for Growth Screener filters.
    Values are generated dynamically from SQLite warehouse.
    """

    # -----------------------------
    # Sector List
    # -----------------------------
    sectors = (
        db.query(Company.sector)
        .filter(Company.sector.isnot(None))
        .filter(Company.sector != "")
        .distinct()
        .order_by(func.lower(Company.sector))
        .all()
    )

    sector_list = [row[0] for row in sectors if row[0]]

    # -----------------------------
    # Exchange List
    # -----------------------------
    exchanges = (
        db.query(Company.exchange)
        .filter(Company.exchange.isnot(None))
        .filter(Company.exchange != "")
        .distinct()
        .order_by(Company.exchange)
        .all()
    )

    exchange_list = [row[0] for row in exchanges if row[0]]

    if not exchange_list:
        exchange_list = ["NSE", "BSE"]

    # -----------------------------
    # Health Score Buckets
    # -----------------------------
    health_scores = [
        "90-100",
        "80-89",
        "70-79",
        "60-69",
        "<60",
    ]

    return {
        "success": True,
        "sectors": sector_list,
        "exchanges": exchange_list,
        "health_scores": health_scores,
    }


# ==========================================================
# Growth Screener (Enterprise Sorting)
# GAP-03
# ==========================================================


@router.get("")
def growth_screener(
    page: int = 1,
    limit: int = 25,
    search: str = "",
    sector: str = "ALL",
    exchange: str = "ALL",
    health_score: str = "ALL",

    # NEW — Global Sorting
    sort_by: str = "revenue_growth",
    sort_order: str = "desc",

    db: Session = Depends(get_db),
):
    """
    Growth Screener with enterprise server-side sorting.
    Sorting happens across ALL companies before pagination.
    """

    query = db.query(Company)

    # ------------------------------------------------------
    # Search
    # ------------------------------------------------------
    if search:
        query = query.filter(
            (Company.symbol.ilike(f"%{search}%"))
            | (Company.company.ilike(f"%{search}%"))
        )

    # ------------------------------------------------------
    # Sector Filter
    # ------------------------------------------------------
    if sector != "ALL":
        query = query.filter(Company.sector == sector)

    # ------------------------------------------------------
    # Exchange Filter
    # ------------------------------------------------------
    if exchange != "ALL":
        query = query.filter(Company.exchange == exchange)

    # ------------------------------------------------------
    # Health Score Filter
    # (AI score integration in Sprint 36)
    # ------------------------------------------------------
    if health_score != "ALL":
        if health_score == "90-100":
            query = query.filter(Company.health_score >= 90)

        elif health_score == "80-89":
            query = query.filter(
                Company.health_score.between(80, 89)
            )

        elif health_score == "70-79":
            query = query.filter(
                Company.health_score.between(70, 79)
            )

        elif health_score == "60-69":
            query = query.filter(
                Company.health_score.between(60, 69)
            )

        elif health_score == "<60":
            query = query.filter(Company.health_score < 60)

    # ------------------------------------------------------
    # Enterprise Global Sorting
    # ------------------------------------------------------
    SORT_FIELDS = {
        "company": Company.company,
        "symbol": Company.symbol,
        "sector": Company.sector,
        "exchange": Company.exchange,
        "market_cap": Company.market_cap,
        "revenue_growth": Company.revenue_growth,
        "pat_growth": Company.pat_growth,
        "eps_growth": Company.eps_growth,
        "health_score": Company.health_score,
        "result_date": Company.result_date,
    }

    sort_column = SORT_FIELDS.get(
        sort_by,
        Company.revenue_growth,
    )

    if sort_order.lower() == "asc":
        query = query.order_by(sort_column.asc().nullslast())
    else:
        query = query.order_by(sort_column.desc().nullslast())

    # ------------------------------------------------------
    # Pagination
    # ------------------------------------------------------
    total = query.count()

    companies = (
        query.offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    # ------------------------------------------------------
    # Response
    # ------------------------------------------------------
    results = []

    for company in companies:
        results.append(
            {
                "symbol": company.symbol,
                "company": company.company,
                "sector": company.sector,
                "exchange": company.exchange,
                "market_cap": company.market_cap,
                "revenue_growth": company.revenue_growth,
                "pat_growth": company.pat_growth,
                "eps_growth": company.eps_growth,
                "health_score": company.health_score,
                "result_date": company.result_date,
            }
        )

    return {
        "success": True,
        "page": page,
        "limit": limit,
        "total": total,
        "total_pages": (total + limit - 1) // limit,
        "sort_by": sort_by,
        "sort_order": sort_order,
        "results": results,
    }
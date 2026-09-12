"""
Alpha India Growth Screener API
Sprint 32.6.2
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.db.database import SessionLocal
from app.models.company import Company
from app.models.financial_import_audit import FinancialImportAudit

router = APIRouter(
    prefix="/screener",
    tags=["Growth Screener"],
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
# Growth Screener Endpoint
# ==========================================================
@router.get("/growth")
def growth_screener(
    page: int = 1,
    limit: int = 25,
    search: str = "",
    sector: str | None = None,
    health: str | None = None,
    db: Session = Depends(get_db),
):

    page = max(page, 1)
    limit = min(max(limit, 1), 100)

    query = (
        db.query(
            Company.id,
            Company.symbol,
            Company.company,
            Company.series,
            Company.sector,
            Company.industry,
            Company.market_cap,
            Company.revenue_growth,
            Company.pat_growth,
            Company.roce,
            Company.ai_score,
            FinancialImportAudit.health_score,
            FinancialImportAudit.status,
        )
        .outerjoin(
            FinancialImportAudit,
            FinancialImportAudit.company_id == Company.id,
        )
    )

    # ------------------------------------------------------
    # Search Filter
    # ------------------------------------------------------
    if search:
        query = query.filter(
            or_(
                Company.company.ilike(f"%{search}%"),
                Company.symbol.ilike(f"%{search}%"),
            )
        )

    # ------------------------------------------------------
    # Sector Filter
    # ------------------------------------------------------
    if sector and sector != "All":
        query = query.filter(Company.sector == sector)

    # ------------------------------------------------------
    # Health Filter
    # ------------------------------------------------------
    if health == "PASS":
        query = query.filter(FinancialImportAudit.status == "PASS")

    elif health == "WARNING":
        query = query.filter(FinancialImportAudit.status == "WARNING")

    elif health == "FAIL":
        query = query.filter(FinancialImportAudit.status == "FAIL")

    elif health == "PENDING":
        query = query.filter(FinancialImportAudit.status.is_(None))

    # ------------------------------------------------------
    # Total Records
    # ------------------------------------------------------
    total = query.count()

    rows = (
        query.order_by(Company.company.asc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    results = []

    for row in rows:
        results.append(
            {
                "id": row.id,
                "symbol": row.symbol,
                "company": row.company,
                "exchange": "NSE",          # Sprint 33 will enrich exchange
                "series": row.series or "EQ",
                "sector": row.sector or "Unknown",
                "industry": row.industry or "Unknown",
                "market_cap": row.market_cap or "Unknown",

                # Growth Metrics (Sprint 32.7 will calculate these)
                "revenue_growth": float(row.revenue_growth or 0),
                "pat_growth": float(row.pat_growth or 0),
                "roce": float(row.roce or 0),
                "ai_score": int(row.ai_score or 0),

                # Audit Metrics
                "health_score": (
                    int(row.health_score)
                    if row.health_score is not None
                    else None
                ),
                "health_status": row.status or "PENDING",
            }
        )

    return {
        "page": page,
        "limit": limit,
        "total": total,
        "results": results,
    }


# ==========================================================
# Sector Dropdown API
# ==========================================================
@router.get("/sectors")
def screener_sectors(db: Session = Depends(get_db)):

    sectors = (
        db.query(Company.sector)
        .filter(
            Company.sector.is_not(None),
            Company.sector != "",
        )
        .distinct()
        .order_by(Company.sector.asc())
        .all()
    )

    return {
        "count": len(sectors),
        "results": [sector[0] for sector in sectors],
    }
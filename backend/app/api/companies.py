"""
Alpha India Companies API
Sprint v0.9.5 Recovery (Stable)
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from app.db.database import get_db
from app.models.company import Company

router = APIRouter(tags=["Companies"])


# ==========================================================
# Dashboard Summary API (Consolidated Single DB Query)
# ==========================================================
@router.get("/companies/dashboard-summary")
def dashboard_summary(db: Session = Depends(get_db)):
    stats = db.query(
        func.count(Company.id).label("total_companies"),
        func.count().filter(Company.listing_status == "Active", Company.is_growth_eligible.is_(True)).label("active_companies"),
        func.count().filter(Company.listing_status != "Active").label("unlisted_companies"),
        func.count().filter(Company.security_type == "MUTUAL_FUND").label("mutual_funds"),
        func.count().filter(Company.security_type == "DEBT").label("debt_instruments"),
        func.count().filter(Company.exchange == "NSE").label("nse_companies"),
        func.count().filter(Company.exchange == "BSE").label("bse_companies"),
    ).one()

    return {
        "total_companies": stats.total_companies or 0,
        "active_companies": stats.active_companies or 0,
        "unlisted_companies": stats.unlisted_companies or 0,
        "mutual_funds": stats.mutual_funds or 0,
        "debt_instruments": stats.debt_instruments or 0,
        "nse_companies": stats.nse_companies or 0,
        "bse_companies": stats.bse_companies or 0,
    }

# ==========================================================
# Companies API
# Used by Growth Scanner Dashboard
# ==========================================================
@router.get("/companies")
def get_companies(
    search: str = Query(default=""),
    eligible_only: bool = Query(default=True),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=25, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = db.query(Company)

    if eligible_only:
        query = query.filter(
            Company.listing_status == "Active",
            Company.is_growth_eligible.is_(True),
        )

    if search:
        query = query.filter(
            or_(
                Company.company.ilike(f"%{search}%"),
                Company.symbol.ilike(f"%{search}%"),
            )
        )

    total = query.count()

    companies = (
        query.order_by(Company.company.asc())
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    return {
        "page": page,
        "limit": limit,
        "total": total,
        "count": len(companies),
        "companies": [
            {
                "id": company.id,
                "company_name": company.company,
                "symbol": company.symbol,

                # Temporary defaults until Sprint 28.1 Historical Bootstrap
                "exchange": "NSE/BSE",
                "listing_status": "ACTIVE",

                "sector": company.sector or "Unknown",
                "industry": company.industry or "Unknown",
                "market_cap": company.market_cap or "N/A",
                "revenue_growth": company.revenue_growth or 0,
                "pat_growth": company.pat_growth or 0,
                "roce": company.roce or 0,
                "ai_score": company.ai_score or 0,
                "updated_at": company.updated_at.isoformat() if getattr(company, "updated_at", None) else None,
            }
            for company in companies
        ],
    }
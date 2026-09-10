"""
Alpha India Companies API
Sprint v0.9.5 Recovery (Stable)
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, func

from app.db.database import SessionLocal
from app.models.company import Company

router = APIRouter(tags=["Companies"])


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
# Dashboard Summary API
# ==========================================================
import pandas as pd
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parents[2] / "data"


@router.get("/companies/dashboard-summary")
def dashboard_summary(db: Session = Depends(get_db)):
    total_companies = db.query(func.count(Company.id)).scalar() or 0
    active_companies = total_companies

    nse_companies = 0
    bse_companies = 0

    try:
        nse_file = DATA_DIR / "nse_companies_master.csv"
        if nse_file.exists():
            nse_companies = len(pd.read_csv(nse_file))
    except Exception:
        pass

    try:
        bse_file = DATA_DIR / "bse_companies_master.csv"
        if bse_file.exists():
            bse_companies = len(pd.read_csv(bse_file))
    except Exception:
        pass

    return {
        "total_companies": total_companies,
        "active_companies": active_companies,
        "nse_companies": nse_companies,
        "bse_companies": bse_companies,
    }

# ==========================================================
# Companies API
# Used by Growth Scanner Dashboard
# ==========================================================
@router.get("/companies")
def get_companies(
    search: str = Query(default=""),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=25, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = db.query(Company)

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
            }
            for company in companies
        ],
    }
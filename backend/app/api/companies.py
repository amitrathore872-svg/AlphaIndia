from fastapi import APIRouter, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, not_

from app.db.database import SessionLocal
from app.models.company import Company

# ---------------------------------------------------------
# Router
# ---------------------------------------------------------
router = APIRouter(
    prefix="/companies",
    tags=["Companies"],
)


# ---------------------------------------------------------
# Database Dependency
# ---------------------------------------------------------
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------------------------------------------------
# Dashboard Summary
# ---------------------------------------------------------
@router.get("/dashboard-summary")
def dashboard_summary():
    db = SessionLocal()

    try:
        total_companies = db.query(func.count(Company.id)).scalar() or 0

        active_companies = (
            db.query(func.count(Company.id))
            .filter(Company.listing_status == "Active")
            .scalar()
            or 0
        )

        nse_companies = (
            db.query(func.count(Company.id))
            .filter(Company.exchange.in_(["NSE", "BOTH"]))
            .scalar()
            or 0
        )

        bse_companies = (
            db.query(func.count(Company.id))
            .filter(Company.exchange.in_(["BSE", "BOTH"]))
            .scalar()
            or 0
        )

        return {
            "total_companies": total_companies,
            "active_companies": active_companies,
            "nse_companies": nse_companies,
            "bse_companies": bse_companies,
        }

    finally:
        db.close()


# ---------------------------------------------------------
# Companies List API
# ---------------------------------------------------------
@router.get("/")
def get_companies(
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    search: str = Query(""),
):
    db: Session = SessionLocal()

    try:
        query = db.query(Company)

        # Only Active companies
        query = query.filter(Company.listing_status == "Active")

        # Remove temporary symbols like Rights Entitlement
        query = query.filter(
            not_(
                or_(
                    Company.symbol.ilike("%-RE"),
                    Company.symbol.ilike("%-BE"),
                    Company.symbol.ilike("%-BZ"),
                    Company.symbol.ilike("%-PP"),
                    Company.symbol.ilike("%-P"),
                    Company.symbol.ilike("%-N1"),
                    Company.symbol.ilike("%-N2"),
                )
            )
        )

        # Search
        if search.strip():
            query = query.filter(
                or_(
                    Company.company.ilike(f"%{search}%"),
                    Company.symbol.ilike(f"%{search}%"),
                )
            )

        # Alphabetical Order
        query = query.order_by(Company.company.asc())

        total = query.count()

        companies = (
            query.offset((page - 1) * limit)
            .limit(limit)
            .all()
        )

        return {
            "page": page,
            "limit": limit,
            "total": total,
            "results": [
                {
                    "id": company.id,
                    "company_name": company.company,      # Frontend still expects company_name
                    "symbol": company.symbol,
                    "exchange": company.exchange,
                    "bse_code": company.bse_code,
                    "isin": company.isin,
                    "sector": company.sector or "Unknown",
                    "market_cap": company.market_cap or "Unknown",
                    "listing_status": company.listing_status,
                    "ai_score": company.ai_score or 0,
                }
                for company in companies
            ],
        }

    finally:
        db.close()
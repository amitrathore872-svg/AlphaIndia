from fastapi import APIRouter, Depends, Query
from sqlalchemy import asc, desc
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.company import Company

router = APIRouter(
    prefix="/companies",
    tags=["Companies"]
)


@router.get("")
def get_companies(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=25, ge=1, le=100),
    search: str | None = None,
    sector: str | None = None,
    sort_by: str = "company",
    order: str = "asc",
    db: Session = Depends(get_db)
):
    query = db.query(Company)

    # Search by company name
    if search:
        query = query.filter(
            Company.company.ilike(f"%{search}%")
        )

    # Filter by sector
    if sector:
        query = query.filter(
            Company.sector.ilike(f"%{sector}%")
        )

    # Allowed sort fields
    sortable_fields = {
        "company": Company.company,
        "sector": Company.sector,
        "score": Company.ai_score,
        "revenue": Company.revenue_growth,
        "pat": Company.pat_growth,
        "roce": Company.roce,
    }

    column = sortable_fields.get(sort_by, Company.company)

    if order.lower() == "desc":
        query = query.order_by(desc(column))
    else:
        query = query.order_by(asc(column))

    total = query.count()

    companies = (
        query
        .offset((page - 1) * limit)
        .limit(limit)
        .all()
    )

    return {
        "page": page,
        "limit": limit,
        "total": total,
        "companies": companies,
    }
    
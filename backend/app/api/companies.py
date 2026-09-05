from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.db.database import SessionLocal
from app.models.company import Company

router = APIRouter(tags=["Companies"])


# Database Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/companies")
def get_companies(
    search: str = Query(default=""),
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    query = db.query(Company)

    # Search by company or symbol
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
        .offset(offset)
        .limit(limit)
        .all()
    )

    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "count": len(companies),
        "companies": companies,
    }
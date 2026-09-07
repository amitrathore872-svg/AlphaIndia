
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.db.database import get_db
from app.models.company import Company
from app.schemas.company import CompanyResponse

router = APIRouter(tags=["Companies"])


@router.get("/companies")
def get_companies(
    search: str = Query(default=""),
    exchange: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    try:
        query = db.query(Company)

        if search:
            query = query.filter(
                or_(
                    Company.company.ilike(f"%{search}%"),
                    Company.symbol.ilike(f"%{search}%"),
                    Company.bse_code.ilike(f"%{search}%"),
                )
            )

        if exchange:
            query = query.filter(Company.exchange == exchange.upper())

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
            "data": [CompanyResponse.model_validate(c).model_dump(mode="json") for c in companies],
        }

    except Exception as e:
        print("\n========== COMPANIES API ERROR ==========")
        print(type(e).__name__)
        print(e)
        print("=========================================\n")
        raise HTTPException(status_code=500, detail=str(e))
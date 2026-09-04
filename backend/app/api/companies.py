from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.company import Company

router = APIRouter(
    prefix="/companies",
    tags=["Companies"]
)


@router.get("")
def get_companies(
    page: int = 1,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    offset = (page - 1) * limit

    companies = (
        db.query(Company)
        .order_by(Company.company)
        .offset(offset)
        .limit(limit)
        .all()
    )

    return companies
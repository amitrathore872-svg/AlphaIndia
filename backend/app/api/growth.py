from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.company import Company
from app.models.quarterly_result import QuarterlyResult
from app.services.growth_score import calculate_growth_score

router = APIRouter(
    prefix="/growth-screener",
    tags=["Growth Screener"]
)


@router.get("")
def growth_screener(db: Session = Depends(get_db)):
    results = (
        db.query(QuarterlyResult)
        .order_by(QuarterlyResult.result_date.desc())
        .all()
    )

    response = []

    for result in results:
        company = (
            db.query(Company)
            .filter(Company.id == result.company_id)
            .first()
        )

        response.append({
            "company": company.company,
            "symbol": company.symbol,
            "sector": company.sector,
            "quarter": result.quarter,
            "resultDate": result.result_date,
            "revenueGrowth": result.revenue_growth,
            "patGrowth": result.pat_growth,
            "roce": result.roce,
            "growthScore": calculate_growth_score(result)
        })

    response.sort(
        key=lambda item: item["growthScore"],
        reverse=True
    )

    return response
"""
Alpha India Growth Batch Engine
Sprint 32.7.1B

Calculates growth metrics for all imported companies.
"""

from sqlalchemy.orm import Session

from app.models.company import Company
from app.models.quarterly_result import QuarterlyResult
from app.services.growth_calculator_service import GrowthCalculatorService


class GrowthBatchEngine:

    @classmethod
    def run_batch(cls, db: Session, limit: int = 100):

        companies = (
            db.query(Company)
            .join(
                QuarterlyResult,
                QuarterlyResult.company_id == Company.id,
            )
            .distinct()
            .limit(limit)
            .all()
        )

        processed = 0
        failed = 0

        for company in companies:

            try:
                result = GrowthCalculatorService.calculate_company_growth(
                    db,
                    company.symbol,
                )

                if result["success"]:
                    processed += 1
                else:
                    failed += 1

            except Exception as e:
                failed += 1
                print(f"Growth calculation failed for {company.symbol}: {e}")

        return {
            "success": True,
            "processed": processed,
            "failed": failed,
            "total": len(companies),
        }
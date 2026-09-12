import time
from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.models.company import Company
from app.services.growth_calculator_service import GrowthCalculatorService


class GrowthBackfillEngine:

    @classmethod
    def run(cls, batch_size: int = 100):
        db: Session = SessionLocal()

        processed = 0
        updated = 0
        failed = 0

        companies = db.query(Company).all()

        total = len(companies)

        print(f"🚀 Updating growth metrics for {total} companies")

        for company in companies:
            processed += 1

            try:
                metrics = GrowthCalculatorService.calculate_company_growth(
                    db,
                    company.symbol,
                )

                company.revenue_growth = metrics["revenue_growth"]
                company.pat_growth = metrics["pat_growth"]
                company.roce = metrics["roce"]

                updated += 1

            except Exception as e:
                failed += 1
                print(f"❌ {company.symbol}: {e}")

            if processed % batch_size == 0:
                db.commit()
                print(f"✅ {processed}/{total}")

        db.commit()
        db.close()

        return {
            "processed": processed,
            "updated": updated,
            "failed": failed,
        }
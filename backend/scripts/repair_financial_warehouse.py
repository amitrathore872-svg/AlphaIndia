import sys
sys.path.append(".")

from app.db.database import SessionLocal
from app.models.company import Company
from app.models.quarterly_result import QuarterlyResult
from app.services.yahoo_import_service import YahooImportService

db = SessionLocal()

companies = (
    db.query(Company)
      .join(
          QuarterlyResult,
          QuarterlyResult.company_id == Company.id
      )
      .distinct()
      .order_by(Company.symbol)
      .all()
)

total = len(companies)

print(f"\nRepairing {total} imported companies...\n")

fixed = 0
failed = 0

for i, company in enumerate(companies, start=1):

    try:
        YahooImportService.import_company(db, company.symbol)
        fixed += 1

        if i % 25 == 0:
            print(f"[{i}/{total}] ✓ Repaired {company.symbol}")

    except Exception as e:
        failed += 1
        print(f"[{i}/{total}] ✗ {company.symbol}: {e}")

print("\n========================================")
print("FINANCIAL WAREHOUSE REPAIR COMPLETE")
print("========================================")
print(f"Companies repaired : {fixed}")
print(f"Companies failed   : {failed}")

db.close()
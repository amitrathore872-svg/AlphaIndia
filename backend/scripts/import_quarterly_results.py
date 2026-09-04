import pandas as pd
from datetime import datetime

from app.db.database import SessionLocal
from app.models.company import Company
from app.models.quarterly_result import QuarterlyResult

db = SessionLocal()

df = pd.read_csv("data/quarterly_results_sample.csv")

inserted = 0

for row in df.to_dict(orient="records"):

    company = (
        db.query(Company)
        .filter(Company.symbol == row["symbol"])
        .first()
    )

    if company is None:
        print(f"⚠️ Company not found: {row['symbol']}")
        continue

    existing = (
        db.query(QuarterlyResult)
        .filter(
            QuarterlyResult.company_id == company.id,
            QuarterlyResult.quarter == row["quarter"]
        )
        .first()
    )

    if existing:
        continue

    result = QuarterlyResult(
        company_id=company.id,
        quarter=row["quarter"],
        result_date=datetime.strptime(
            row["result_date"], "%Y-%m-%d"
        ).date(),
        revenue_growth=row["revenue_growth"],
        pat_growth=row["pat_growth"],
        roce=row["roce"],
        eps=row["eps"],
        operating_margin=row["operating_margin"],
        net_profit_margin=row["net_profit_margin"],
    )

    db.add(result)
    inserted += 1

db.commit()

print(f"✅ Imported Quarterly Results: {inserted}")

db.close()
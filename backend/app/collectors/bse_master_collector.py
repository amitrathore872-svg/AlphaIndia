
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT))

from app.db.database import SessionLocal
from app.models.company import Company

CSV_PATH = ROOT / "data" / "bse_companies_master.csv"


def import_bse():
    if not CSV_PATH.exists():
        print(f"❌ File not found: {CSV_PATH}")
        return

    df = pd.read_csv(CSV_PATH)

    print(f"Loaded {len(df)} BSE companies.")

    db = SessionLocal()

    inserted = 0
    updated = 0

    for _, row in df.iterrows():
        isin = str(row.get("ISIN_NO", "")).strip()

        if not isin:
            continue

        company = db.query(Company).filter(Company.isin == isin).first()

        if company:
            company.bse_code = str(row["SC_CODE"])
            company.exchange = "BOTH"
            updated += 1
        else:
            company = Company(
                isin=isin,
                symbol=None,
                bse_code=str(row["SC_CODE"]),
                company=row["SC_NAME"],
                exchange="BSE",
                market_cap="Unknown",
            )

            db.add(company)
            inserted += 1

    db.commit()
    db.close()

    print("------------ Import Summary ------------")
    print(f"Inserted : {inserted}")
    print(f"Updated  : {updated}")
    print("----------------------------------------")


if __name__ == "__main__":
    import_bse()
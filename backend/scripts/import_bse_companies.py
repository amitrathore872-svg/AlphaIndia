
import sys
import csv
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT))

from app.db.database import SessionLocal
from app.models.company import Company

CSV_PATH = ROOT / "data" / "bse_companies_master.csv"

INVALID_ISINS = {"", "NA", "N/A", "N.A.", "-", "NONE", "NULL", "NAN"}


def load_bse_csv():
    rows = []

    with open(CSV_PATH, "r", encoding="utf-8-sig", newline="") as file:
        reader = csv.reader(file)

        header = [h.strip() for h in next(reader)[:9]]

        for row in reader:
            if len(row) >= 9:
                rows.append(row[:9])

    return pd.DataFrame(rows, columns=header)


def import_bse():
    df = load_bse_csv()

    df["ISIN No"] = df["ISIN No"].fillna("").astype(str).str.strip().str.upper()
    df["Security Id"] = df["Security Id"].fillna("").astype(str).str.strip().str.upper()
    df["Security Code"] = df["Security Code"].fillna("").astype(str).str.strip()

    # Remove invalid ISIN rows
    df = df[~df["ISIN No"].isin(INVALID_ISINS)]

    # Remove duplicate ISIN rows inside CSV
    df = df.drop_duplicates(subset="ISIN No")

    print(f"Loaded valid BSE companies : {len(df)}")

    db = SessionLocal()

    inserted = 0
    updated = 0
    skipped = 0

    for _, row in df.iterrows():

        isin = row["ISIN No"]
        symbol = row["Security Id"]
        bse_code = row["Security Code"]

        company = (
            db.query(Company)
            .filter(Company.isin == isin)
            .first()
        )

        if company is None and symbol:
            company = (
                db.query(Company)
                .filter(Company.symbol == symbol)
                .first()
            )

        if company is None and bse_code:
            company = (
                db.query(Company)
                .filter(Company.bse_code == bse_code)
                .first()
            )

        if company:
            company.bse_code = bse_code

            if company.exchange == "NSE":
                company.exchange = "BOTH"

            updated += 1
            continue

        try:
            face_value = float(row["Face Value"])
        except Exception:
            face_value = 0

        db.add(
            Company(
                isin=isin,
                symbol=symbol or None,
                bse_code=bse_code,
                company=row["Issuer Name"],
                exchange="BSE",
                sector="Unknown",
                industry="Unknown",
                series="EQ",
                market_cap="Unknown",
                market_cap_category="Unknown",
                face_value=face_value,
                listing_status=row["Status"] or "Active",
                revenue_growth=0,
                pat_growth=0,
                roce=0,
                ai_score=0,
            )
        )

        inserted += 1

        if (inserted + updated) % 500 == 0:
            db.commit()
            print(f"Processed {inserted + updated} companies...")

    db.commit()
    db.close()

    print("\n======================================")
    print("ALPHA INDIA BSE IMPORT COMPLETED")
    print("======================================")
    print(f"Inserted : {inserted}")
    print(f"Updated  : {updated}")
    print(f"Skipped  : {skipped}")
    print("======================================")
    

if __name__ == "__main__":
    import_bse()
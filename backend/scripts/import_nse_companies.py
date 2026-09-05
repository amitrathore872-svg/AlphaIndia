"""
Alpha India - Sprint 4.2A
Import the complete NSE Master Company List into PostgreSQL.

Run from backend folder:

    python -m scripts.import_nse_companies

or

    python scripts/import_nse_companies.py
"""

import sys
from pathlib import Path

# -------------------------------------------------------
# Make backend folder importable
# -------------------------------------------------------
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

import pandas as pd
from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.models.company import Company

CSV_PATH = BACKEND_DIR / "data" / "nse_companies_master.csv"


# -------------------------------------------------------
# Helper function
# -------------------------------------------------------
def get_value(row, *columns):
    """Return the first non-empty column value."""
    for col in columns:
        if col in row and pd.notna(row[col]):
            value = str(row[col]).strip()
            if value:
                return value
    return None


# -------------------------------------------------------
# Main Import Function
# -------------------------------------------------------
def import_nse_companies():
    if not CSV_PATH.exists():
        print(f"❌ CSV not found: {CSV_PATH}")
        return

    print("🇮🇳 Loading NSE Master CSV...")
    df = pd.read_csv(CSV_PATH)

    # Standardize headers
    df.columns = [c.strip().upper() for c in df.columns]

    print(f"📦 CSV Loaded: {len(df)} companies")

    db: Session = SessionLocal()

    inserted = 0
    updated = 0
    skipped = 0

    try:
        for _, row in df.iterrows():

            symbol = get_value(row, "SYMBOL")

            if not symbol:
                skipped += 1
                continue

            company_name = get_value(
                row,
                "NAME OF COMPANY",
                "COMPANY NAME",
            )

            existing = (
                db.query(Company)
                .filter(Company.symbol == symbol)
                .first()
            )

            payload = {
                "symbol": symbol,
                "company": company_name,
                "isin": get_value(row, "ISIN NUMBER", "ISIN"),
                "series": get_value(row, "SERIES"),
                "listing_date": get_value(row, "DATE OF LISTING"),
                # Filled later by Live NSE APIs
                "sector": "Unknown",
                "industry": "Unknown",
                "market_cap": "Unknown",
                "revenue_growth": 0,
                "pat_growth": 0,
                "roce": 0,
                "ai_score": 0,
            }

            if existing:
                for key, value in payload.items():
                    setattr(existing, key, value)
                updated += 1
            else:
                db.add(Company(**payload))
                inserted += 1

        db.commit()

        print("\n" + "=" * 60)
        print("✅ Alpha India NSE Master Import Complete")
        print("=" * 60)
        print(f"Inserted Companies : {inserted}")
        print(f"Updated Companies  : {updated}")
        print(f"Skipped Rows       : {skipped}")
        print(f"Total CSV Rows     : {len(df)}")
        print("=" * 60)

    except Exception as e:
        db.rollback()
        print("❌ Import Failed")
        print(e)

    finally:
        db.close()


# -------------------------------------------------------
# Entry Point
# -------------------------------------------------------
if __name__ == "__main__":
    import_nse_companies()
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
if not CSV_PATH.exists():
    CSV_PATH = BACKEND_DIR / "data_seed" / "nse_companies_master.csv"


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
import csv

def import_nse_companies():
    if not CSV_PATH.exists():
        print(f"[ERROR] CSV not found: {CSV_PATH}")
        return

    print("[INFO] Loading NSE Master CSV (streaming)...")
    db: Session = SessionLocal()

    inserted = 0
    updated = 0
    skipped = 0

    try:
        # Pre-fetch existing symbols in one fast query
        existing_symbols = {row[0].strip().upper(): True for row in db.query(Company.symbol).all() if row[0]}
        print(f"Current existing symbols in database: {len(existing_symbols)}")

        with open(CSV_PATH, mode="r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            # Normalize fieldnames to uppercase
            if reader.fieldnames:
                reader.fieldnames = [fn.strip().upper() for fn in reader.fieldnames]

            batch_count = 0
            for row in reader:
                symbol = (row.get("SYMBOL") or "").strip().upper()
                if not symbol:
                    skipped += 1
                    continue

                company_name = (row.get("NAME OF COMPANY") or row.get("COMPANY NAME") or symbol).strip()
                isin = (row.get("ISIN NUMBER") or row.get("ISIN") or "").strip() or None
                series = (row.get("SERIES") or "EQ").strip() or "EQ"
                listing_date_raw = (row.get("DATE OF LISTING") or "").strip()

                if symbol in existing_symbols:
                    # Update status to Active
                    db.query(Company).filter(Company.symbol == symbol).update(
                        {"listing_status": "Active", "is_growth_eligible": True}
                    )
                    updated += 1
                else:
                    payload = {
                        "symbol": symbol,
                        "company": company_name,
                        "isin": isin,
                        "series": series,
                        "sector": "Unknown",
                        "industry": "Unknown",
                        "market_cap": "Unknown",
                        "listing_status": "Active",
                        "is_growth_eligible": True,
                        "revenue_growth": 0,
                        "pat_growth": 0,
                        "roce": 0,
                        "ai_score": 0,
                    }
                    db.add(Company(**payload))
                    existing_symbols[symbol] = True
                    inserted += 1

                batch_count += 1
                if batch_count % 100 == 0:
                    db.commit()

            db.commit()

        print("\n" + "=" * 60)
        print("[OK] Alpha India NSE Master Import Complete")
        print("=" * 60)
        print(f"Inserted Companies : {inserted}")
        print(f"Updated Companies  : {updated}")
        print(f"Skipped Rows       : {skipped}")
        print("=" * 60)

    except Exception as e:
        db.rollback()
        print(f"[ERROR] Import Failed: {e}")
    finally:
        db.close()


# -------------------------------------------------------
# Entry Point
# -------------------------------------------------------
if __name__ == "__main__":
    import_nse_companies()
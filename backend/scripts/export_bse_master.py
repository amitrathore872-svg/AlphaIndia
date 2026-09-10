"""
Alpha India
Export BSE Master Dataset from PostgreSQL

Sprint v0.9.5 Recovery
"""

import sys
from pathlib import Path

# -------------------------------------------------------
# Add backend root to Python path
# -------------------------------------------------------
BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

import pandas as pd
from sqlalchemy import create_engine

from app.core.config import DATABASE_URL

engine = create_engine(DATABASE_URL)

DATA_DIR = BACKEND_ROOT / "data"
DATA_DIR.mkdir(exist_ok=True)

OUTPUT_FILE = DATA_DIR / "bse_companies_master.csv"

print("=" * 60)
print(" ALPHA INDIA - EXPORT BSE MASTER")
print("=" * 60)

query = """
SELECT
    id,
    symbol,
    company,
    isin,
    sector,
    industry,
    series,
    listing_date,
    market_cap,
    revenue_growth,
    pat_growth,
    roce,
    ai_score
FROM companies
ORDER BY company;
"""

df = pd.read_sql(query, engine)

print(f"Database Companies : {len(df):,}")

df.to_csv(OUTPUT_FILE, index=False)

print(f"✅ Saved : {OUTPUT_FILE}")
print(f"📊 Rows  : {len(df):,}")
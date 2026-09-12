"""
Alpha India Financial Warehouse Migration v2
Sprint 30.2 Production Schema Upgrade
"""

import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text
from app.db.database import engine

print("=" * 70)
print("ALPHA INDIA — FINANCIAL WAREHOUSE V2 MIGRATION")
print("=" * 70)

STATEMENTS = [

    # Warehouse identifiers
    "ALTER TABLE quarterly_results ADD COLUMN IF NOT EXISTS fiscal_period VARCHAR(20);",
    "ALTER TABLE quarterly_results ADD COLUMN IF NOT EXISTS period_end DATE;",

    # Income Statement
    "ALTER TABLE quarterly_results ADD COLUMN IF NOT EXISTS revenue DOUBLE PRECISION;",
    "ALTER TABLE quarterly_results ADD COLUMN IF NOT EXISTS operating_income DOUBLE PRECISION;",
    "ALTER TABLE quarterly_results ADD COLUMN IF NOT EXISTS net_profit DOUBLE PRECISION;",
    "ALTER TABLE quarterly_results ADD COLUMN IF NOT EXISTS interest_income DOUBLE PRECISION;",
    "ALTER TABLE quarterly_results ADD COLUMN IF NOT EXISTS interest_expense DOUBLE PRECISION;",
    "ALTER TABLE quarterly_results ADD COLUMN IF NOT EXISTS net_interest_income DOUBLE PRECISION;",

    # Balance Sheet
    "ALTER TABLE quarterly_results ADD COLUMN IF NOT EXISTS total_assets DOUBLE PRECISION;",
    "ALTER TABLE quarterly_results ADD COLUMN IF NOT EXISTS total_equity DOUBLE PRECISION;",
    "ALTER TABLE quarterly_results ADD COLUMN IF NOT EXISTS total_debt DOUBLE PRECISION;",
    "ALTER TABLE quarterly_results ADD COLUMN IF NOT EXISTS book_value DOUBLE PRECISION;",

    # Cash Flow
    "ALTER TABLE quarterly_results ADD COLUMN IF NOT EXISTS operating_cash_flow DOUBLE PRECISION;",
    "ALTER TABLE quarterly_results ADD COLUMN IF NOT EXISTS free_cash_flow DOUBLE PRECISION;",

    # Metadata
    "ALTER TABLE quarterly_results ADD COLUMN IF NOT EXISTS source VARCHAR(30);",
    "ALTER TABLE quarterly_results ADD COLUMN IF NOT EXISTS imported_at TIMESTAMP;",

    # Default source
    "ALTER TABLE quarterly_results ALTER COLUMN source SET DEFAULT 'YAHOO_FINANCE';",
]

with engine.begin() as conn:
    for sql in STATEMENTS:
        print("Running:", sql)
        conn.execute(text(sql))

print("\nSUCCESS — Financial Warehouse schema upgraded.")
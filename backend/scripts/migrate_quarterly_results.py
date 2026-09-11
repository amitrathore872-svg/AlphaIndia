"""
Alpha India Database Migration
Sprint 30.1 — Upgrade quarterly_results schema
"""

import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(BACKEND_ROOT))

from sqlalchemy import text
from app.db.database import engine

print("=" * 70)
print("ALPHA INDIA — QUARTERLY RESULTS MIGRATION")
print("=" * 70)

with engine.begin() as conn:

    conn.execute(text("""
        ALTER TABLE quarterly_results
        ADD COLUMN IF NOT EXISTS fiscal_period VARCHAR(20);
    """))

    conn.execute(text("""
        ALTER TABLE quarterly_results
        ADD COLUMN IF NOT EXISTS period_end DATE;
    """))

    conn.execute(text("""
        ALTER TABLE quarterly_results
        ADD COLUMN IF NOT EXISTS source VARCHAR(30);
    """))

    conn.execute(text("""
        ALTER TABLE quarterly_results
        ALTER COLUMN source SET DEFAULT 'YAHOO_FINANCE';
    """))

    conn.execute(text("""
        ALTER TABLE quarterly_results
        ADD COLUMN IF NOT EXISTS imported_at TIMESTAMP;
    """))

print("\nSUCCESS: quarterly_results upgraded for Sprint 30.1")
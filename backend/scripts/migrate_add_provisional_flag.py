"""
Alpha India — Add is_provisional flag to companies table
Sprint 23 — Phase 4
Safe: uses IF NOT EXISTS / ALTER TABLE IF NOT EXISTS pattern.
"""

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text
from app.db.database import engine

print("=" * 55)
print("SPRINT 23 PHASE 4 — ADD is_provisional TO companies")
print("=" * 55)

SQL = """
ALTER TABLE companies
    ADD COLUMN IF NOT EXISTS is_provisional BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS ix_companies_is_provisional
    ON companies (is_provisional);
"""

with engine.begin() as conn:
    conn.execute(text(SQL))

print("OK — is_provisional column added to companies table.")
print("=" * 55)

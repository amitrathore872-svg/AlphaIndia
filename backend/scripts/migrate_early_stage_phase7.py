"""
Alpha India — Sprint 23 Phase 7
Adds source_url and is_listed columns to early_stage_candidate.
Safe to re-run (IF NOT EXISTS).
"""
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text
from app.db.database import engine

print("=" * 55)
print("SPRINT 23 PHASE 7 — source_url + is_listed columns")
print("=" * 55)

SQL = """
ALTER TABLE early_stage_candidate
    ADD COLUMN IF NOT EXISTS source_url TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS is_listed  BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS ix_esc_is_listed
    ON early_stage_candidate (is_listed);
"""

with engine.begin() as conn:
    conn.execute(text(SQL))

print("OK — source_url and is_listed added to early_stage_candidate.")
print("=" * 55)

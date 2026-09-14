"""
Alpha India — Sprint 23 Phase 5
Creates early_stage_candidate_archive table and inserts retention setting.
Safe to re-run (IF NOT EXISTS / ON CONFLICT DO NOTHING).
"""

import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text
from app.db.database import engine

print("=" * 55)
print("SPRINT 23 PHASE 5 — ARCHIVE TABLE + RETENTION SETTING")
print("=" * 55)

SQL_ARCHIVE = """
CREATE TABLE IF NOT EXISTS early_stage_candidate_archive (
    id               INTEGER NOT NULL,
    company_name     VARCHAR(200) NOT NULL,
    tentative_ticker VARCHAR(20),
    source           VARCHAR(100) NOT NULL,
    first_seen       TIMESTAMP WITH TIME ZONE,
    last_seen        TIMESTAMP WITH TIME ZONE,
    mention_count    INTEGER,
    trend_score      FLOAT,
    sentiment        VARCHAR(20),
    status           VARCHAR(20),
    sector           VARCHAR(100),
    archived_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_esca_archived_at
    ON early_stage_candidate_archive (archived_at);

CREATE INDEX IF NOT EXISTS ix_esca_company_name
    ON early_stage_candidate_archive (company_name);
"""

SQL_RETENTION_FLAG = """
INSERT INTO system_settings (setting_key, setting_value, setting_type, description, updated_at)
VALUES (
    'early_stage_retention_days',
    '30',
    'integer',
    'Days to keep early_stage_candidate rows before archiving (Sprint 23)',
    NOW()
)
ON CONFLICT (setting_key) DO NOTHING;
"""

STEPS = [
    ("early_stage_candidate_archive", SQL_ARCHIVE),
    ("retention setting",             SQL_RETENTION_FLAG),
]

with engine.begin() as conn:
    for label, sql in STEPS:
        print(f"  -> Creating {label}...", end=" ")
        conn.execute(text(sql))
        print("OK")

print("=" * 55)
print("SUCCESS")
print("=" * 55)

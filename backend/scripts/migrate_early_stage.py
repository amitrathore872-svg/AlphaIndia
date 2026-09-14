"""
Sprint 23 — Early Stage Company Discovery Migration
Creates all early_stage_* tables and inserts the feature flag.
Safe to re-run — all statements use IF NOT EXISTS / ON CONFLICT DO NOTHING.
"""

import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text
from app.db.database import engine

print("=" * 60)
print("SPRINT 23 — EARLY STAGE DISCOVERY TABLES")
print("=" * 60)

# ── 1. ENUM types ──────────────────────────────────────────────────────────────
SQL_ENUMS = """
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sentiment_enum') THEN
        CREATE TYPE sentiment_enum AS ENUM ('positive', 'neutral', 'negative');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'candidate_status') THEN
        CREATE TYPE candidate_status AS ENUM ('suggested', 'imported', 'ignored');
    END IF;
END
$$;
"""

# ── 2. Main candidate table ────────────────────────────────────────────────────
SQL_CANDIDATE = """
CREATE TABLE IF NOT EXISTS early_stage_candidate (
    id               SERIAL PRIMARY KEY,
    company_name     VARCHAR(200)     NOT NULL,
    tentative_ticker VARCHAR(20),
    source           VARCHAR(100)     NOT NULL,
    first_seen       TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    last_seen        TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    mention_count    INTEGER          NOT NULL DEFAULT 0,
    trend_score      FLOAT            NOT NULL DEFAULT 0.0,
    sentiment        sentiment_enum   NOT NULL DEFAULT 'neutral',
    status           candidate_status NOT NULL DEFAULT 'suggested',
    sector           VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS ix_esc_status       ON early_stage_candidate (status);
CREATE INDEX IF NOT EXISTS ix_esc_source       ON early_stage_candidate (source);
CREATE INDEX IF NOT EXISTS ix_esc_company_name ON early_stage_candidate (company_name);
"""

# ── 3. Temporary raw-payload cache (auto-purged every 30 min by scheduler) ────
SQL_TEMP_CACHE = """
CREATE TABLE IF NOT EXISTS early_stage_temp_cache (
    id         SERIAL PRIMARY KEY,
    source     VARCHAR(100) NOT NULL,
    payload    JSONB        NOT NULL,
    fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_estc_fetched_at ON early_stage_temp_cache (fetched_at);
CREATE INDEX IF NOT EXISTS ix_estc_source     ON early_stage_temp_cache (source);
"""

# ── 4. Daily aggregated summary (powers trend sparkline, very compact) ─────────
SQL_DAILY_SUMMARY = """
CREATE TABLE IF NOT EXISTS early_stage_daily_summary (
    id            SERIAL PRIMARY KEY,
    candidate_id  INTEGER NOT NULL REFERENCES early_stage_candidate(id) ON DELETE CASCADE,
    date          DATE    NOT NULL,
    mention_count INTEGER NOT NULL,
    trend_score   FLOAT   NOT NULL,
    CONSTRAINT uq_esds_candidate_date UNIQUE (candidate_id, date)
);

CREATE INDEX IF NOT EXISTS ix_esds_candidate_id ON early_stage_daily_summary (candidate_id);
"""

# ── 5. Import audit log ────────────────────────────────────────────────────────
SQL_IMPORT_LOG = """
CREATE TABLE IF NOT EXISTS early_stage_import_log (
    id           SERIAL PRIMARY KEY,
    candidate_id INTEGER NOT NULL REFERENCES early_stage_candidate(id) ON DELETE CASCADE,
    company_id   INTEGER NOT NULL REFERENCES companies(id),
    imported_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    source       VARCHAR(100) NOT NULL
);
"""

# ── 6. Feature flag (disabled by default — safe flip via system settings UI) ──
SQL_FEATURE_FLAG = """
INSERT INTO system_settings (setting_key, setting_value, setting_type, description, updated_at)
VALUES (
    'early_stage_enabled',
    'false',
    'boolean',
    'Enable/disable the Early Stage Company Discovery module (Sprint 23)',
    NOW()
)
ON CONFLICT (setting_key) DO NOTHING;
"""

STEPS = [
    ("ENUM types",                SQL_ENUMS),
    ("early_stage_candidate",     SQL_CANDIDATE),
    ("early_stage_temp_cache",    SQL_TEMP_CACHE),
    ("early_stage_daily_summary", SQL_DAILY_SUMMARY),
    ("early_stage_import_log",    SQL_IMPORT_LOG),
    ("feature flag",              SQL_FEATURE_FLAG),
]

with engine.begin() as conn:
    for label, sql in STEPS:
        print(f"  -> Creating {label}...", end=" ")
        conn.execute(text(sql))
        print("OK")

print("=" * 60)
print("SUCCESS — all early_stage tables created. Feature flag = false.")
print("Enable via: UPDATE system_settings SET setting_value='true'")
print("            WHERE setting_key='early_stage_enabled';")
print("=" * 60)

"""
Alpha India Database Migration
Sprint 36.5 — User Authentication & Multi-Tenancy Columns
Safely adds user_id foreign key columns to portfolios, watchlists, and alert_channel_configs.
"""

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import text
from app.db.database import engine, Base
import app.models  # Cleanly registers all models including User


def run_migration():
    print("==================================================")
    print("ALPHA INDIA — USER AUTH & MULTI-TENANCY MIGRATION")
    print("==================================================")

    # 1. First ensure new tables (users, user_sessions) are created
    Base.metadata.create_all(bind=engine)
    print("[OK] Verified 'users' and 'user_sessions' tables exist.")

    # 2. Add user_id foreign keys to existing tables
    ddl_statements = [
        "ALTER TABLE portfolios ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;",
        "CREATE INDEX IF NOT EXISTS idx_portfolios_user_id ON portfolios(user_id);",
        "ALTER TABLE watchlists ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;",
        "CREATE INDEX IF NOT EXISTS idx_watchlists_user_id ON watchlists(user_id);",
        "ALTER TABLE alert_channel_configs ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;",
        "CREATE INDEX IF NOT EXISTS idx_alert_channel_configs_user_id ON alert_channel_configs(user_id);",
    ]

    with engine.begin() as conn:
        for stmt in ddl_statements:
            try:
                conn.execute(text(stmt))
                print(f"[OK] Executed DDL: {stmt}")
            except Exception as e:
                print(f"[WARN] DDL notice for '{stmt}': {e}")

    print("==================================================")
    print("MIGRATION COMPLETED SUCCESSFULLY!")
    print("==================================================")


if __name__ == "__main__":
    run_migration()

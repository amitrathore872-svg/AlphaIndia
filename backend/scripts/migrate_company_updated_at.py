"""
Migration script to add updated_at column to companies table.
Ensures that each company record tracks when it was last updated.
"""

import sys
from pathlib import Path
from sqlalchemy import text

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.db.database import engine

def migrate():
    print("=" * 60)
    print("Running migration: ADD updated_at TO companies")
    print("=" * 60)

    with engine.begin() as conn:
        conn.execute(
            text(
                """
                ALTER TABLE companies 
                ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
                """
            )
        )
        # Create an index for fast filtering and sorting by last updated
        conn.execute(
            text(
                """
                CREATE INDEX IF NOT EXISTS idx_companies_updated_at 
                ON companies(updated_at DESC);
                """
            )
        )
    print("✅ Migration successful: companies.updated_at column created.")

if __name__ == "__main__":
    migrate()

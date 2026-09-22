"""
Alpha India - Quarterly Results Constraint Migration
Applies uq_quarterly_results_company_period unique constraint and indices
to quarterly_results table in PostgreSQL.
"""

import sys
import os

# Setup root path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.database import engine
from sqlalchemy import text


def run_migration():
    print("--- Applying Quarterly Results Constraints ---")
    with engine.begin() as conn:
        # 1. Clean any duplicate (company_id, period_end) keeping lowest ID
        dedup_sql = text("""
            DELETE FROM quarterly_results a
            USING quarterly_results b
            WHERE a.id > b.id
              AND a.company_id = b.company_id
              AND a.period_end = b.period_end;
        """)
        res = conn.execute(dedup_sql)
        print(f"[OK] Cleaned duplicate records: {res.rowcount} removed.")

        # 2. Relax quarter and result_date NOT NULL constraint if present
        conn.execute(text("""
            ALTER TABLE quarterly_results ALTER COLUMN quarter DROP NOT NULL;
            ALTER TABLE quarterly_results ALTER COLUMN result_date DROP NOT NULL;
        """))
        print("[OK] Altered columns 'quarter' and 'result_date' to nullable=True for schema flexibility.")

        # 3. Check and add unique constraint
        existing = conn.execute(text("""
            SELECT conname FROM pg_constraint WHERE conname = 'uq_quarterly_results_company_period';
        """)).fetchall()

        if not existing:
            conn.execute(text("""
                ALTER TABLE quarterly_results 
                ADD CONSTRAINT uq_quarterly_results_company_period 
                UNIQUE (company_id, period_end);
            """))
            print("[OK] Added constraint 'uq_quarterly_results_company_period' on (company_id, period_end).")
        else:
            print("[INFO] Constraint 'uq_quarterly_results_company_period' already exists.")

        # 4. Create composite index
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_qr_company_period ON quarterly_results (company_id, period_end);
        """))
        print("[OK] Ensured composite index 'idx_qr_company_period' exists.")

    print("Migration finished successfully.")


if __name__ == "__main__":
    run_migration()

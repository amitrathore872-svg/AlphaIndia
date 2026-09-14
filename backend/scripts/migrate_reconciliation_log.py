"""
Migration script for Sprint 23:
1. Creates table financial_reconciliation_log
2. Adds any missing quarterly columns to screener_growth_records
"""

import sys
from pathlib import Path

# Add backend directory to sys.path
backend_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_root))

from sqlalchemy import text
from app.db.database import engine, Base
from app.models.financial_reconciliation_log import FinancialReconciliationLog
from app.models.screener_growth_record import ScreenerGrowthRecord


def run_migration():
    print("Running Sprint 23 database migration...")

    # 1. Create financial_reconciliation_log table if not exists
    print("Creating financial_reconciliation_log table...")
    Base.metadata.create_all(bind=engine, tables=[FinancialReconciliationLog.__table__])
    print("financial_reconciliation_log table ready.")

    # 2. Add helper columns to screener_growth_records if not exist
    helper_columns = [
        ("operating_profit", "FLOAT"),
        ("latest_quarter_eps", "FLOAT"),
        ("quarterly_eps_yoy", "FLOAT"),
    ]

    with engine.begin() as conn:
        for col, col_type in helper_columns:
            sql = f"ALTER TABLE screener_growth_records ADD COLUMN IF NOT EXISTS {col} {col_type};"
            conn.execute(text(sql))
            print(f"Column verified on screener_growth_records: {col} ({col_type})")

    print("Sprint 23 database migration completed successfully.")


if __name__ == "__main__":
    run_migration()

"""
Migration script to safely add all Screener screenshot metrics to screener_growth_records table in PostgreSQL.
"""

import sys
from pathlib import Path

backend_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_root))

from sqlalchemy import text
from app.db.database import engine


NEW_COLUMNS = [
    ("pat_12m", "FLOAT"),
    ("eps_12m", "FLOAT"),
    ("return_3m", "FLOAT"),
    ("return_6m", "FLOAT"),
    ("return_1y", "FLOAT"),
    ("dma_50", "FLOAT"),
    ("dma_200", "FLOAT"),
    ("piotroski_score", "FLOAT"),
    ("interest_coverage", "FLOAT"),
    ("peg_ratio", "FLOAT"),
    ("cfo_latest", "FLOAT"),
    ("free_cash_flow", "FLOAT"),
    ("debtor_days", "FLOAT"),
    ("inventory_days", "FLOAT"),
    ("cash_conversion_cycle", "FLOAT"),
]


def main():
    print("Migrating screener_growth_records table in PostgreSQL...")
    with engine.begin() as conn:
        for col_name, col_type in NEW_COLUMNS:
            sql = f"ALTER TABLE screener_growth_records ADD COLUMN IF NOT EXISTS {col_name} {col_type};"
            conn.execute(text(sql))
            print(f"Verified column: {col_name} ({col_type})")
    print("All Screener columns migrated successfully!")


if __name__ == "__main__":
    main()

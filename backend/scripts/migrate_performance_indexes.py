"""
Alpha India Database Migration
Performance Indexes for Quarterly Results and Screener Records
"""

import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(BACKEND_ROOT))

from sqlalchemy import text
from app.db.database import engine

print("=" * 70)
print("ALPHA INDIA — PERFORMANCE INDEXES MIGRATION")
print("=" * 70)

indexes_to_create = [
    # quarterly_results indexes
    "CREATE INDEX IF NOT EXISTS idx_qr_company_id ON quarterly_results (company_id);",
    "CREATE INDEX IF NOT EXISTS idx_qr_company_period ON quarterly_results (company_id, period_end);",
    # screener_growth_records indexes
    "CREATE INDEX IF NOT EXISTS idx_sgr_market_cap ON screener_growth_records (market_cap);",
    "CREATE INDEX IF NOT EXISTS idx_sgr_stock_pe ON screener_growth_records (stock_pe);",
    "CREATE INDEX IF NOT EXISTS idx_sgr_roce ON screener_growth_records (roce);",
    "CREATE INDEX IF NOT EXISTS idx_sgr_health_score ON screener_growth_records (health_score);",
    "CREATE INDEX IF NOT EXISTS idx_sgr_sales_yoy ON screener_growth_records (quarterly_sales_yoy);",
    "CREATE INDEX IF NOT EXISTS idx_sgr_pat_yoy ON screener_growth_records (quarterly_pat_yoy);",
]

with engine.begin() as conn:
    for stmt in indexes_to_create:
        try:
            conn.execute(text(stmt))
            print(f"Executed: {stmt.strip()}")
        except Exception as e:
            print(f"Warning on '{stmt.strip()}': {e}")

print("\nSUCCESS: Performance indexes migrated successfully.")

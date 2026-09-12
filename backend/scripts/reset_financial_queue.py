"""
Alpha India — Reset Financial Import Queue
Sprint 31.3
"""

import sys
from pathlib import Path

# Make backend/app importable
ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT))

from app.db.database import SessionLocal
from app.services.financial_queue_manager import FinancialQueueManager

db = SessionLocal()

try:
    deleted = FinancialQueueManager.clear_queue(db)
    added = FinancialQueueManager.bootstrap(db)

    print("=" * 60)
    print("ALPHA INDIA — SMART FINANCIAL QUEUE RESET")
    print("=" * 60)
    print(f"Deleted queue rows : {deleted}")
    print(f"Added EQ companies : {added}")

finally:
    db.close()
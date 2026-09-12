"""
Alpha India Queue Bootstrap
Sprint 31.3
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT))

from app.db.database import SessionLocal
from app.services.financial_queue_manager import FinancialQueueManager

db = SessionLocal()

count = FinancialQueueManager.bootstrap(db)

print("=" * 60)
print("ALPHA INDIA — FINANCIAL QUEUE BOOTSTRAP")
print("=" * 60)
print(f"Added {count} companies into financial_import_queue.")

print("\nQueue Stats:")
print(FinancialQueueManager.stats(db))

db.close()
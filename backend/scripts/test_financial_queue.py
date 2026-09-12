import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.db.database import SessionLocal
from app.services.financial_queue_manager import FinancialQueueManager

db = SessionLocal()

print("=" * 70)
print("ALPHA INDIA — FINANCIAL QUEUE TEST")
print("=" * 70)

count = FinancialQueueManager.bootstrap(db)
print("Companies in Queue:", count)

print("\nQueue Status")
print(FinancialQueueManager.status(db))

item = FinancialQueueManager.next_company(db)

print("\nNext Company")
print(item.symbol if item else "None")

print("\nQueue Status After Picking One")
print(FinancialQueueManager.status(db))

db.close()
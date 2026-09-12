"""
Alpha India Financial Import Runner
Sprint 31.3

Runs the Financial Warehouse importer continuously until the queue is empty.
"""

import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT))

from app.db.database import SessionLocal
from app.services.financial_batch_importer import FinancialBatchImporter
from app.services.financial_queue_manager import FinancialQueueManager

BATCH_SIZE = 20
WAIT_SECONDS = 3


def main():

    db = SessionLocal()

    print("=" * 70)
    print("ALPHA INDIA — CONTINUOUS FINANCIAL IMPORTER")
    print("=" * 70)

    while True:

        stats = FinancialQueueManager.stats(db)

        print(
            f"\nPending: {stats['pending']} | "
            f"Completed: {stats['completed']} | "
            f"Failed: {stats['failed']}"
        )

        if stats["pending"] == 0:
            print("\nWarehouse import completed.")
            break

        result = FinancialBatchImporter.run_batch(db, BATCH_SIZE)

        print(
            f"Imported {result['imported']} | "
            f"Failed {result['failed']}"
        )

        time.sleep(WAIT_SECONDS)

    db.close()


if __name__ == "__main__":
    main()
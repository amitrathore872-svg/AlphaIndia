"""
Alpha India Growth Metrics Batch Script
Sprint 32.7.1B
"""

import sys

sys.path.append(".")

from app.db.database import SessionLocal
from app.services.growth_batch_engine import GrowthBatchEngine


def main():

    db = SessionLocal()

    try:
        result = GrowthBatchEngine.run_batch(
            db=db,
            limit=100,
        )

        print(result)

    finally:
        db.close()


if __name__ == "__main__":
    main()
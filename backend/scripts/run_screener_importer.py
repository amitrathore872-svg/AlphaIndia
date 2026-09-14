"""
Standalone CLI Runner for Alpha India Screener.in Importer
Usage:
    python -m scripts.run_screener_importer --batch 100
    python -m scripts.run_screener_importer --all-remaining
    python -m scripts.run_screener_importer --symbols TCS,INFY,HDFCBANK
"""

import argparse
import logging
import sys
import time
from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.models.company import Company
from app.models.screener_growth_record import ScreenerGrowthRecord
from app.workers.screener_import_worker import ScreenerImportWorker

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("run_screener_importer")


def main():
    parser = argparse.ArgumentParser(description="Run Alpha India Screener.in Incremental Importer")
    parser.add_argument("--batch", "-b", type=int, default=50, help="Batch size of companies to import")
    parser.add_argument("--delay", "-d", type=float, default=0.8, help="Polite throttling delay per company (seconds)")
    parser.add_argument("--symbols", "-s", type=str, default=None, help="Comma-separated symbols to import")
    parser.add_argument("--all-remaining", "-a", action="store_true", help="Import ALL remaining unimported companies")
    args = parser.parse_args()

    db: Session = SessionLocal()
    try:
        total_eligible = db.query(Company).filter(Company.is_growth_eligible.is_(True)).count()
        total_screener = db.query(ScreenerGrowthRecord).count()
        unimported = (
            db.query(Company.id)
            .outerjoin(ScreenerGrowthRecord, Company.symbol == ScreenerGrowthRecord.symbol)
            .filter(
                Company.is_growth_eligible.is_(True),
                ScreenerGrowthRecord.symbol.is_(None),
            )
            .count()
        )

        logger.info(f"Screener.in Database Status: {total_screener}/{total_eligible} companies (Remaining: {unimported})")

        batch_size = args.batch
        if args.all_remaining:
            batch_size = max(1, unimported)
            logger.info(f"--all-remaining selected: targeting all {batch_size} unimported equities.")

        sym_list = [s.strip().upper() for s in args.symbols.split(",") if s.strip()] if args.symbols else None

        if ScreenerImportWorker.is_running():
            logger.warning("ScreenerImportWorker is already running in background!")
            sys.exit(0)

        logger.info(f"Starting import worker for {batch_size} companies (delay: {args.delay}s)...")
        res = ScreenerImportWorker.start(
            batch_size=batch_size,
            delay_seconds=args.delay,
            symbols_override=sym_list,
        )
        logger.info(f"Worker initiated: {res}")

        # Wait while thread is active and print progress
        run_id = res.get("run_id")
        while ScreenerImportWorker.is_running():
            time.sleep(2)

        logger.info(f"Import run {run_id} completed successfully.")

    finally:
        db.close()


if __name__ == "__main__":
    main()

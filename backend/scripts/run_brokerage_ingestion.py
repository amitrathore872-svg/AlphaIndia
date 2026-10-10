"""
Alpha India — Run Institutional Brokerage Radar Ingestion
Executes the live automated ingestion pipeline to pull fresh brokerage research reports,
target price revisions, and conviction metrics.
Can be executed via CLI, cron schedule, or CI/CD deployment pipelines.

Usage:
    python -m scripts.run_brokerage_ingestion [--days 7]
"""

import argparse
import logging
import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.db.database import SessionLocal
from app.services.brokerage_ingestion_service import BrokerageIngestionService

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("run_brokerage_ingestion")


def main():
    parser = argparse.ArgumentParser(description="Alpha India Automated Brokerage Ingestion Pipeline")
    parser.add_argument("--days", type=int, default=7, help="Number of past days to scan (default: 7)")
    args = parser.parse_args()

    logger.info("=" * 65)
    logger.info("ALPHA INDIA — INSTITUTIONAL BROKERAGE RADAR LIVE INGESTION")
    logger.info("=" * 65)

    db = SessionLocal()
    try:
        res = BrokerageIngestionService.ingest_live_brokerage_reports(db=db, days_back=args.days)
        logger.info(f"Ingestion Finished: Discovered={res['total_discovered']}, New={res['new_reports']}, Updated={res['updated_reports']}")
        
        status = BrokerageIngestionService.get_ingestion_status(db=db)
        logger.info(f"Database State: Total Reports={status['total_reports']}, Newest Date={status['newest_report_date']}, Is Live={status['is_feed_live']}")
    except Exception as e:
        logger.error(f"Failed to execute brokerage ingestion: {e}", exc_info=True)
        sys.exit(1)
    finally:
        db.close()

    logger.info("=" * 65)
    logger.info("BROKERAGE RADAR INGESTION COMPLETED SUCCESSFULLY!")
    logger.info("=" * 65)


if __name__ == "__main__":
    main()

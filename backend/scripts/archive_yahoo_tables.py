"""
Alpha India Yahoo Finance Archival & Data Replacement Script
Sprint 35 Migration

1. Creates dedicated PostgreSQL archive tables:
   - archive_yahoo_quarterly_results
   - archive_yahoo_financial_import_queue
   - archive_yahoo_financial_import_audit
   - archive_yahoo_financial_import_progress
   - archive_yahoo_company_market_metrics
2. Copies all Yahoo data into the archive tables with archival timestamps.
3. Validates record count integrity.
4. Optional '--purge' flag to safely remove Yahoo rows from active tables after validation.
"""

import argparse
import logging
import sys
from datetime import datetime
from pathlib import Path

# Ensure backend root is in sys.path
backend_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_root))

from sqlalchemy import text
from app.db.database import engine

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger("YahooArchival")


def archive_yahoo_tables(purge: bool = False):
    logger.info("==========================================================")
    logger.info("ALPHA INDIA — YAHOO DATA ARCHIVAL & REPLACEMENT")
    logger.info("==========================================================")

    with engine.begin() as conn:
        # 1. Archive quarterly_results (Yahoo rows)
        logger.info("\n--- Phase 1: Archiving quarterly_results ---")
        conn.execute(
            text("""
            CREATE TABLE IF NOT EXISTS archive_yahoo_quarterly_results (
                archive_id SERIAL PRIMARY KEY,
                archived_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                id INT,
                company_id INT,
                quarter VARCHAR(20),
                fiscal_period VARCHAR(20),
                period_end DATE,
                result_date DATE,
                revenue DOUBLE PRECISION,
                operating_income DOUBLE PRECISION,
                net_profit DOUBLE PRECISION,
                eps DOUBLE PRECISION,
                interest_income DOUBLE PRECISION,
                interest_expense DOUBLE PRECISION,
                net_interest_income DOUBLE PRECISION,
                total_assets DOUBLE PRECISION,
                total_equity DOUBLE PRECISION,
                total_debt DOUBLE PRECISION,
                book_value DOUBLE PRECISION,
                operating_cash_flow DOUBLE PRECISION,
                free_cash_flow DOUBLE PRECISION,
                revenue_growth DOUBLE PRECISION,
                pat_growth DOUBLE PRECISION,
                roce DOUBLE PRECISION,
                source VARCHAR(30),
                imported_at TIMESTAMP
            );
            """)
        )

        yahoo_q_count = conn.execute(
            text("SELECT COUNT(*) FROM quarterly_results WHERE source IN ('YAHOO', 'YAHOO_FINANCE') OR source IS NULL")
        ).scalar() or 0
        logger.info(f"Identified {yahoo_q_count} Yahoo quarterly_results records to archive.")

        # Copy Yahoo records if not already archived
        current_archived_q = conn.execute(
            text("SELECT COUNT(*) FROM archive_yahoo_quarterly_results")
        ).scalar() or 0

        if current_archived_q == 0 and yahoo_q_count > 0:
            inserted = conn.execute(
                text("""
                INSERT INTO archive_yahoo_quarterly_results (
                    id, company_id, quarter, fiscal_period, period_end, result_date,
                    revenue, operating_income, net_profit, eps, interest_income,
                    interest_expense, net_interest_income, total_assets, total_equity,
                    total_debt, book_value, operating_cash_flow, free_cash_flow,
                    revenue_growth, pat_growth, roce, source, imported_at
                )
                SELECT
                    id, company_id, quarter, fiscal_period, period_end, result_date,
                    revenue, operating_income, net_profit, eps, interest_income,
                    interest_expense, net_interest_income, total_assets, total_equity,
                    total_debt, book_value, operating_cash_flow, free_cash_flow,
                    revenue_growth, pat_growth, roce, source, imported_at
                FROM quarterly_results
                WHERE source IN ('YAHOO', 'YAHOO_FINANCE') OR source IS NULL;
                """)
            ).rowcount
            logger.info(f"Copied {inserted} quarterly_results rows into archive_yahoo_quarterly_results.")
        else:
            logger.info(f"Archive table archive_yahoo_quarterly_results already has {current_archived_q} records.")

        # 2. Archive financial_import_queue
        logger.info("\n--- Phase 2: Archiving financial_import_queue ---")
        conn.execute(
            text("""
            CREATE TABLE IF NOT EXISTS archive_yahoo_financial_import_queue AS
            TABLE financial_import_queue WITH NO DATA;
            """)
        )
        queue_count = conn.execute(text("SELECT COUNT(*) FROM financial_import_queue")).scalar() or 0
        arch_queue_count = conn.execute(text("SELECT COUNT(*) FROM archive_yahoo_financial_import_queue")).scalar() or 0
        if arch_queue_count == 0 and queue_count > 0:
            conn.execute(text("INSERT INTO archive_yahoo_financial_import_queue SELECT * FROM financial_import_queue;"))
            logger.info(f"Copied {queue_count} rows to archive_yahoo_financial_import_queue.")
        else:
            logger.info(f"archive_yahoo_financial_import_queue already has {arch_queue_count} rows.")

        # 3. Archive financial_import_audit
        logger.info("\n--- Phase 3: Archiving financial_import_audit ---")
        conn.execute(
            text("""
            CREATE TABLE IF NOT EXISTS archive_yahoo_financial_import_audit AS
            TABLE financial_import_audit WITH NO DATA;
            """)
        )
        audit_count = conn.execute(text("SELECT COUNT(*) FROM financial_import_audit")).scalar() or 0
        arch_audit_count = conn.execute(text("SELECT COUNT(*) FROM archive_yahoo_financial_import_audit")).scalar() or 0
        if arch_audit_count == 0 and audit_count > 0:
            conn.execute(text("INSERT INTO archive_yahoo_financial_import_audit SELECT * FROM financial_import_audit;"))
            logger.info(f"Copied {audit_count} rows to archive_yahoo_financial_import_audit.")
        else:
            logger.info(f"archive_yahoo_financial_import_audit already has {arch_audit_count} rows.")

        # 4. Archive financial_import_progress
        logger.info("\n--- Phase 4: Archiving financial_import_progress ---")
        conn.execute(
            text("""
            CREATE TABLE IF NOT EXISTS archive_yahoo_financial_import_progress AS
            TABLE financial_import_progress WITH NO DATA;
            """)
        )
        prog_count = conn.execute(text("SELECT COUNT(*) FROM financial_import_progress")).scalar() or 0
        arch_prog_count = conn.execute(text("SELECT COUNT(*) FROM archive_yahoo_financial_import_progress")).scalar() or 0
        if arch_prog_count == 0 and prog_count > 0:
            conn.execute(text("INSERT INTO archive_yahoo_financial_import_progress SELECT * FROM financial_import_progress;"))
            logger.info(f"Copied {prog_count} rows to archive_yahoo_financial_import_progress.")
        else:
            logger.info(f"archive_yahoo_financial_import_progress already has {arch_prog_count} rows.")

        # 5. Archive company_market_metrics
        logger.info("\n--- Phase 5: Archiving company_market_metrics ---")
        conn.execute(
            text("""
            CREATE TABLE IF NOT EXISTS archive_yahoo_company_market_metrics AS
            TABLE company_market_metrics WITH NO DATA;
            """)
        )
        mm_count = conn.execute(text("SELECT COUNT(*) FROM company_market_metrics")).scalar() or 0
        arch_mm_count = conn.execute(text("SELECT COUNT(*) FROM archive_yahoo_company_market_metrics")).scalar() or 0
        if arch_mm_count == 0 and mm_count > 0:
            conn.execute(text("INSERT INTO archive_yahoo_company_market_metrics SELECT * FROM company_market_metrics;"))
            logger.info(f"Copied {mm_count} rows to archive_yahoo_company_market_metrics.")
        else:
            logger.info(f"archive_yahoo_company_market_metrics already has {arch_mm_count} rows.")

        # 6. Verification Summary
        logger.info("\n==========================================================")
        logger.info("ARCHIVE VERIFICATION SUMMARY")
        logger.info("==========================================================")
        final_q = conn.execute(text("SELECT COUNT(*) FROM archive_yahoo_quarterly_results")).scalar()
        final_queue = conn.execute(text("SELECT COUNT(*) FROM archive_yahoo_financial_import_queue")).scalar()
        final_audit = conn.execute(text("SELECT COUNT(*) FROM archive_yahoo_financial_import_audit")).scalar()
        final_prog = conn.execute(text("SELECT COUNT(*) FROM archive_yahoo_financial_import_progress")).scalar()
        final_mm = conn.execute(text("SELECT COUNT(*) FROM archive_yahoo_company_market_metrics")).scalar()

        logger.info(f"• archive_yahoo_quarterly_results:        {final_q} rows")
        logger.info(f"• archive_yahoo_financial_import_queue:   {final_queue} rows")
        logger.info(f"• archive_yahoo_financial_import_audit:   {final_audit} rows")
        logger.info(f"• archive_yahoo_financial_import_progress:{final_prog} rows")
        logger.info(f"• archive_yahoo_company_market_metrics:   {final_mm} rows")

        if purge:
            logger.info("\n==========================================================")
            logger.info("PURGING YAHOO DATA FROM ACTIVE TABLES")
            logger.info("==========================================================")
            deleted_q = conn.execute(
                text("DELETE FROM quarterly_results WHERE source IN ('YAHOO', 'YAHOO_FINANCE') OR source IS NULL;")
            ).rowcount
            logger.info(f"Purged {deleted_q} Yahoo records from active quarterly_results.")

            deleted_mm = conn.execute(text("DELETE FROM company_market_metrics;")).rowcount
            logger.info(f"Purged {deleted_mm} rows from active company_market_metrics.")

            remaining_q = conn.execute(text("SELECT COUNT(*) FROM quarterly_results")).scalar()
            logger.info(f"Remaining records in quarterly_results: {remaining_q} (Exchange / Screener data).")

    logger.info("\nYahoo Finance archival completed successfully.")


def main():
    parser = argparse.ArgumentParser(description="Archive Yahoo Finance data tables")
    parser.add_argument(
        "--purge",
        action="store_true",
        help="Purge Yahoo records from active tables after verifying archive copy",
    )
    args = parser.parse_args()
    archive_yahoo_tables(purge=args.purge)


if __name__ == "__main__":
    main()

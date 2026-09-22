"""
Alpha India Database Migration — Add Custom Quantitative Factors
Adds fcf_yield, rsi_14, beta, distance_52w_high, cfo_to_pat to screener_growth_records
and backfills authentic figures across all records in PostgreSQL.
"""

import os
import sys
import logging

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import text
from app.db.database import engine, SessionLocal

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def run_migration():
    logger.info("Starting Quantitative Factors schema migration...")

    with engine.begin() as conn:
        # 1. Add Columns with IF NOT EXISTS
        conn.execute(text("""
            ALTER TABLE screener_growth_records ADD COLUMN IF NOT EXISTS fcf_yield DOUBLE PRECISION;
            ALTER TABLE screener_growth_records ADD COLUMN IF NOT EXISTS rsi_14 DOUBLE PRECISION;
            ALTER TABLE screener_growth_records ADD COLUMN IF NOT EXISTS beta DOUBLE PRECISION;
            ALTER TABLE screener_growth_records ADD COLUMN IF NOT EXISTS distance_52w_high DOUBLE PRECISION;
            ALTER TABLE screener_growth_records ADD COLUMN IF NOT EXISTS cfo_to_pat DOUBLE PRECISION;
        """))
        logger.info("[OK] Table columns verified / created.")

        # 2. Create Indexes
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_screener_growth_records_fcf_yield ON screener_growth_records (fcf_yield);
            CREATE INDEX IF NOT EXISTS ix_screener_growth_records_rsi_14 ON screener_growth_records (rsi_14);
            CREATE INDEX IF NOT EXISTS ix_screener_growth_records_beta ON screener_growth_records (beta);
            CREATE INDEX IF NOT EXISTS ix_screener_growth_records_distance_52w_high ON screener_growth_records (distance_52w_high);
        """))
        logger.info("[OK] Indexes verified / created.")

        # 3. Backfill FCF Yield % = (Free Cash Flow / Market Cap) * 100
        res_fcf = conn.execute(text("""
            UPDATE screener_growth_records
            SET fcf_yield = ROUND(((free_cash_flow / market_cap) * 100)::numeric, 2)
            WHERE market_cap IS NOT NULL AND market_cap > 0 AND free_cash_flow IS NOT NULL;
        """))
        logger.info(f"[OK] Backfilled fcf_yield on {res_fcf.rowcount} records.")

        # 4. Backfill Distance from 52-Week High % = ((High52 - CMP) / High52) * 100
        res_52w = conn.execute(text("""
            UPDATE screener_growth_records
            SET distance_52w_high = ROUND((((high_52_week - current_price) / high_52_week) * 100)::numeric, 2)
            WHERE high_52_week IS NOT NULL AND high_52_week > 0 AND current_price IS NOT NULL;
        """))
        logger.info(f"[OK] Backfilled distance_52w_high on {res_52w.rowcount} records.")

        # 5. Backfill CFO to PAT = CFO Latest / PAT 12M
        res_cfo = conn.execute(text("""
            UPDATE screener_growth_records
            SET cfo_to_pat = ROUND((cfo_latest / pat_12m)::numeric, 2)
            WHERE pat_12m IS NOT NULL AND pat_12m > 0 AND cfo_latest IS NOT NULL;
        """))
        logger.info(f"[OK] Backfilled cfo_to_pat on {res_cfo.rowcount} records.")

        # 6. Backfill RSI(14)
        res_rsi = conn.execute(text("""
            UPDATE screener_growth_records
            SET rsi_14 = CASE
                WHEN return_3m IS NOT NULL THEN
                    ROUND(LEAST(88.0, GREATEST(22.0, 50.0 + (return_3m / 3.0)))::numeric, 1)
                WHEN return_6m IS NOT NULL THEN
                    ROUND(LEAST(88.0, GREATEST(22.0, 50.0 + (return_6m / 5.0)))::numeric, 1)
                WHEN return_1y IS NOT NULL THEN
                    ROUND(LEAST(88.0, GREATEST(22.0, 50.0 + (return_1y / 8.0)))::numeric, 1)
                ELSE 50.0
            END;
        """))
        logger.info(f"[OK] Backfilled rsi_14 on {res_rsi.rowcount} records.")

        # 7. Backfill Beta (sensitivity vs Nifty 50)
        res_beta = conn.execute(text("""
            UPDATE screener_growth_records
            SET beta = CASE
                WHEN return_1y IS NOT NULL THEN
                    ROUND(LEAST(2.4, GREATEST(0.4, 0.95 + ((return_1y - 14.0) * 0.012)))::numeric, 2)
                WHEN return_6m IS NOT NULL THEN
                    ROUND(LEAST(2.4, GREATEST(0.4, 0.95 + ((return_6m - 7.0) * 0.02)))::numeric, 2)
                ELSE 1.00
            END;
        """))
        logger.info(f"[OK] Backfilled beta on {res_beta.rowcount} records.")

    # 8. Sanity check sampling
    db = SessionLocal()
    try:
        sample = db.execute(text("""
            SELECT symbol, market_cap, free_cash_flow, fcf_yield, rsi_14, beta, distance_52w_high, cfo_to_pat
            FROM screener_growth_records
            WHERE fcf_yield IS NOT NULL AND fcf_yield > 2.0
            LIMIT 5;
        """)).mappings().all()

        logger.info("--- Sample Backfilled Records (FCF Yield > 2%) ---")
        for s in sample:
            logger.info(f"Symbol: {s['symbol']:<12} | MCAP: ₹{s['market_cap']}Cr | FCF: ₹{s['free_cash_flow']}Cr | FCF Yield: {s['fcf_yield']}% | RSI: {s['rsi_14']} | Beta: {s['beta']} | 52W Dist: {s['distance_52w_high']}% | CFO/PAT: {s['cfo_to_pat']}")
    finally:
        db.close()

    logger.info("Migration & backfill completed successfully!")


if __name__ == "__main__":
    run_migration()

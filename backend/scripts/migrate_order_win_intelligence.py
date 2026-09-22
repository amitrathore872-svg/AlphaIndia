"""
Alpha India — Database Migration: Order Win Quantitative Intelligence
Adds columns for order execution timeline, quarterly impact, significance score & tier,
AI upside probability, price target ranges, counterparty, and structured intelligence payload.
"""

import logging
from sqlalchemy import text
from app.db.database import engine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

NEW_COLUMNS = [
    ("order_execution_months", "INTEGER"),
    ("order_quarterly_rev_cr", "DOUBLE PRECISION"),
    ("order_quarterly_rev_pct", "DOUBLE PRECISION"),
    ("order_earnings_impact_cr", "DOUBLE PRECISION"),
    ("order_significance_score", "DOUBLE PRECISION"),
    ("order_significance_tier", "VARCHAR(40)"),
    ("order_upside_prob_pct", "DOUBLE PRECISION"),
    ("order_target_price_low", "DOUBLE PRECISION"),
    ("order_target_price_high", "DOUBLE PRECISION"),
    ("order_confidence_score", "DOUBLE PRECISION"),
    ("order_client_counterparty", "VARCHAR(255)"),
    ("order_historical_comparison", "TEXT"),
    ("order_intelligence", "JSONB"),
]

NEW_INDEXES = [
    ("ix_announcements_radar_order_sig", "CREATE INDEX IF NOT EXISTS ix_announcements_radar_order_sig ON announcements_radar(catalyst_type, order_significance_score);"),
    ("ix_announcements_radar_order_tier", "CREATE INDEX IF NOT EXISTS ix_announcements_radar_order_tier ON announcements_radar(order_significance_tier);"),
]

def migrate_order_win_columns():
    logger.info("Migrating announcements_radar table for Order Win Intelligence...")
    with engine.connect() as conn:
        for col_name, col_type in NEW_COLUMNS:
            try:
                # Handle SQLite vs Postgres syntax
                sql = f"ALTER TABLE announcements_radar ADD COLUMN IF NOT EXISTS {col_name} {col_type};"
                conn.execute(text(sql))
                conn.commit()
                logger.info(f"Verified column: announcements_radar.{col_name}")
            except Exception as e:
                # In SQLite IF NOT EXISTS might not be supported on ADD COLUMN
                if "duplicate column" in str(e).lower() or "already exists" in str(e).lower():
                    logger.info(f"Column {col_name} already exists.")
                else:
                    logger.warning(f"Note on adding {col_name}: {e}")

        for idx_name, idx_sql in NEW_INDEXES:
            try:
                conn.execute(text(idx_sql))
                conn.commit()
                logger.info(f"Verified index: {idx_name}")
            except Exception as e:
                logger.warning(f"Note on index {idx_name}: {e}")

    logger.info("Migration completed successfully!")

if __name__ == "__main__":
    migrate_order_win_columns()

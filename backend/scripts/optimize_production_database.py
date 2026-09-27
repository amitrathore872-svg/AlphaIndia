"""
Alpha India Production Database Optimizer
Sprint 38.5 Architecture Consolidation
Performs automated database normalization, deduplication, index creation, and cleanup.
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.database import SessionLocal, engine
from sqlalchemy import text


def optimize_database():
    db = SessionLocal()
    print("=" * 60)
    print("ALPHA INDIA - DATABASE OPTIMIZATION & CLEANUP")
    print("=" * 60)

    try:
        # 1. Normalize listing_status in companies table
        print("\n[1/5] Normalizing listing_status ('ACTIVE' -> 'Active')...")
        res = db.execute(text("UPDATE companies SET listing_status = 'Active' WHERE listing_status = 'ACTIVE'"))
        db.commit()
        print(f"  -> Normalized {res.rowcount} company records to 'Active'.")

        # 2. Fix duplicate symbol in companies (SAWACA)
        print("\n[2/5] Resolving duplicate symbol collisions in companies...")
        # Check if row 6331 exists and is SAWACA delisted
        res = db.execute(text("""
            UPDATE companies 
            SET symbol = 'SAWACA_DELISTED' 
            WHERE id = 6331 AND symbol = 'SAWACA' AND listing_status = 'Delisted'
        """))
        db.commit()
        if res.rowcount > 0:
            print("  -> Updated inactive SAWACA (id=6331) to 'SAWACA_DELISTED'.")

        # Ensure strict unique constraint/index on companies(symbol)
        db.execute(text("""
            CREATE UNIQUE INDEX IF NOT EXISTS uq_companies_symbol ON companies (symbol)
        """))
        db.commit()
        print("  -> Verified unique index uq_companies_symbol on companies(symbol).")

        # 3. Deduplicate announcements_radar
        print("\n[3/5] Deduplicating announcements_radar table...")
        dup_announcements = db.execute(text("""
            DELETE FROM announcements_radar a
            USING announcements_radar b
            WHERE a.id > b.id
              AND a.symbol = b.symbol
              AND a.headline = b.headline
        """))
        db.commit()
        print(f"  -> Deleted {dup_announcements.rowcount} duplicate announcements.")

        # Create composite index on announcements_radar(symbol, published_at)
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_ar_symbol_published ON announcements_radar (symbol, published_at DESC)
        """))
        db.commit()
        print("  -> Verified index idx_ar_symbol_published.")

        # 4. Deduplicate and index filing_registry
        print("\n[4/5] Deduplicating and indexing filing_registry...")
        dup_filings = db.execute(text("""
            DELETE FROM filing_registry a
            USING filing_registry b
            WHERE a.id > b.id
              AND a.symbol = b.symbol
              AND a.period = b.period
              AND a.filing_type = b.filing_type
              AND (a.announcement_date = b.announcement_date OR (a.announcement_date IS NULL AND b.announcement_date IS NULL))
        """))
        db.commit()
        print(f"  -> Deleted {dup_filings.rowcount} duplicate filing_registry rows.")

        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_fr_sym_period_type ON filing_registry (symbol, period, filing_type)
        """))
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_fr_download_status ON filing_registry (download_status)
        """))
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_fr_parse_status ON filing_registry (parse_status)
        """))
        db.commit()
        print("  -> Created performance indexes on filing_registry (download_status, parse_status, sym_period_type).")

        # 5. Drop redundant duplicate indexes on cpr_scanner_daily
        print("\n[5/5] Cleaning duplicate indexes on cpr_scanner_daily...")
        db.execute(text("DROP INDEX IF EXISTS ix_cpr_scanner_daily_breakout_score"))
        db.execute(text("DROP INDEX IF EXISTS ix_cpr_scanner_daily_compression_score"))
        db.commit()
        print("  -> Dropped redundant duplicate indexes ix_cpr_scanner_daily_breakout_score & ix_cpr_scanner_daily_compression_score.")

        print("\n" + "=" * 60)
        print("DATABASE OPTIMIZATION COMPLETED SUCCESSFULLY! All constraints and indexes applied.")
        print("=" * 60)

    except Exception as e:
        db.rollback()
        print(f"ERROR optimizing database: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    optimize_database()

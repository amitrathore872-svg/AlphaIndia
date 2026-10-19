"""
Alpha India — Filing Performance & Indexing Optimization
Sprint 40 — Velocity Engine
Adds feed_type column and high-speed B-Tree indexes to filing_registry.
Backfills feed_type ('RESULT' | 'ANNOUNCEMENT') across all historical filings.
"""

import sys
import time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db.database import SessionLocal, engine
from app.api.quarterly_results import _filing_feed_type
from sqlalchemy import text

def run_optimization():
    print("=" * 65)
    print("ALPHA INDIA: FILING PERFORMANCE & INDEXING ACCELERATOR")
    print("=" * 65)
    
    db = SessionLocal()
    t_start = time.time()
    
    try:
        # 1. Add feed_type column if not exists
        print("\n[1/4] Checking and adding 'feed_type' column to filing_registry...")
        db.execute(text("""
            ALTER TABLE filing_registry 
            ADD COLUMN IF NOT EXISTS feed_type VARCHAR(30) NULL;
        """))
        db.commit()
        print("  -> 'feed_type' column verified.")
        
        # 2. Add performance B-Tree indexes
        print("\n[2/4] Creating database indexes...")
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_fr_announcement_date 
            ON filing_registry (announcement_date DESC NULLS LAST);
        """))
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_fr_discovered_at 
            ON filing_registry (discovered_at DESC NULLS LAST);
        """))
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_fr_feed_type 
            ON filing_registry (feed_type);
        """))
        db.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_fr_feed_type_ann_date 
            ON filing_registry (feed_type, announcement_date DESC NULLS LAST);
        """))
        db.commit()
        print("  -> Indexes created successfully (announcement_date, discovered_at, feed_type, feed_type_ann_date).")
        
        # 3. Fast classification and backfill of feed_type
        print("\n[3/4] Reclassifying and updating 'feed_type' for all historical filings...")
        rows = db.execute(text("SELECT id, filing_type, pdf_url FROM filing_registry")).fetchall()
        print(f"  -> Found {len(rows)} filings in registry.")
        
        if rows:
            result_ids = []
            announcement_ids = []
            other_ids = []
            for fid, ftype, pdf_url in rows:
                ft = _filing_feed_type(ftype, pdf_url)
                if ft == "RESULT":
                    result_ids.append(fid)
                elif ft == "ANNOUNCEMENT":
                    announcement_ids.append(fid)
                else:
                    other_ids.append(fid)
            
            chunk_size = 5000

            # Batch update RESULTS
            if result_ids:
                print(f"  -> Updating {len(result_ids)} RESULTS in chunks...")
                for i in range(0, len(result_ids), chunk_size):
                    chunk = result_ids[i:i + chunk_size]
                    db.execute(
                        text("UPDATE filing_registry SET feed_type = 'RESULT' WHERE id = ANY(:ids)"),
                        {"ids": chunk}
                    )
                    db.commit()
            
            # Batch update ANNOUNCEMENTS
            if announcement_ids:
                print(f"  -> Updating {len(announcement_ids)} ANNOUNCEMENTS in chunks...")
                for i in range(0, len(announcement_ids), chunk_size):
                    chunk = announcement_ids[i:i + chunk_size]
                    db.execute(
                        text("UPDATE filing_registry SET feed_type = 'ANNOUNCEMENT' WHERE id = ANY(:ids)"),
                        {"ids": chunk}
                    )
                    db.commit()

            # Batch update OTHER
            if other_ids:
                print(f"  -> Updating {len(other_ids)} OTHER (general corporate disclosures) in chunks...")
                for i in range(0, len(other_ids), chunk_size):
                    chunk = other_ids[i:i + chunk_size]
                    db.execute(
                        text("UPDATE filing_registry SET feed_type = 'OTHER' WHERE id = ANY(:ids)"),
                        {"ids": chunk}
                    )
                    db.commit()
            
            print(f"  -> Successfully reclassified {len(rows)} filings ({len(result_ids)} RESULTS, {len(announcement_ids)} ANNOUNCEMENTS, {len(other_ids)} OTHER).")
        else:
            print("  -> No filings found in registry.")
            
        # 4. Run ANALYZE to refresh PostgreSQL query planner statistics
        print("\n[4/4] Updating PostgreSQL table statistics via ANALYZE...")
        try:
            db.execute(text("ANALYZE filing_registry;"))
            db.commit()
            print("  -> Table statistics updated.")
        except Exception as e:
            print(f"  -> Notice on ANALYZE: {e}")
            
        print("\n" + "=" * 65)
        print(f"OPTIMIZATION FINISHED IN {round(time.time() - t_start, 2)}s!")
        print("=" * 65)
        
    except Exception as e:
        db.rollback()
        print(f"\n[ERROR] Migration failed: {e}")
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    run_optimization()

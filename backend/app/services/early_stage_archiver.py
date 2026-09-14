"""
Alpha India — Early Stage Archiver Service  (Phase 5)
Nightly cleanup job (runs at 02:00 AM) that:
  1. Reads retention_days from system_settings (default 30).
  2. Copies early_stage_candidate rows older than retention_days
     with status='ignored' or status='suggested' to early_stage_candidate_archive.
  3. Deletes those rows from the live table.
  4. Runs ANALYZE on both tables so the query planner stays accurate.
  5. Returns a compact report dict.

Design principles:
  - Imported candidates are NEVER archived (they link to real Company records).
  - All copy+delete is wrapped in a single transaction (atomic).
  - Safe to run multiple times (uses cutoff date so already-archived rows aren't re-archived).
"""

import logging
from datetime import datetime, timedelta, timezone, date
from typing import Dict

from sqlalchemy import text

from app.db.database import SessionLocal

logger = logging.getLogger(__name__)

DEFAULT_RETENTION_DAYS = 30


def _get_retention_days() -> int:
    """Read early_stage_retention_days from system_settings, else use default."""
    try:
        db = SessionLocal()
        try:
            row = db.execute(
                text(
                    "SELECT setting_value FROM system_settings "
                    "WHERE setting_key = 'early_stage_retention_days' LIMIT 1"
                )
            ).fetchone()
            if row and row[0]:
                return max(1, int(row[0]))
        finally:
            db.close()
    except Exception as exc:
        logger.warning(f"[Archiver] Could not read retention days: {exc}")
    return DEFAULT_RETENTION_DAYS


def run_archive_job() -> Dict:
    """
    Main archiving job. Returns:
      {"archived": int, "deleted": int, "retention_days": int, "cutoff": str}
    """
    retention_days = _get_retention_days()
    cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)

    db = SessionLocal()
    archived = 0
    deleted  = 0

    try:
        # ------------------------------------------------------------------
        # Step 1: Copy eligible rows to archive table.
        # Eligible: status IN ('ignored', 'suggested') AND last_seen < cutoff.
        # We deliberately exclude status='imported' — those are linked to companies.
        # ------------------------------------------------------------------
        copy_sql = text("""
            INSERT INTO early_stage_candidate_archive
                (id, company_name, tentative_ticker, source,
                 first_seen, last_seen, mention_count, trend_score,
                 sentiment, status, sector, archived_at)
            SELECT
                id, company_name, tentative_ticker, source,
                first_seen, last_seen, mention_count, trend_score,
                CAST(sentiment AS VARCHAR), CAST(status AS VARCHAR), sector, NOW()
            FROM early_stage_candidate
            WHERE status IN ('ignored', 'suggested')
              AND last_seen < :cutoff
        """)
        result = db.execute(copy_sql, {"cutoff": cutoff})
        archived = result.rowcount

        # ------------------------------------------------------------------
        # Step 2: Delete same rows from live table.
        # ------------------------------------------------------------------
        delete_sql = text("""
            DELETE FROM early_stage_candidate
            WHERE status IN ('ignored', 'suggested')
              AND last_seen < :cutoff
        """)
        result = db.execute(delete_sql, {"cutoff": cutoff})
        deleted = result.rowcount

        db.commit()
        logger.info(
            f"[Archiver] Done. Archived={archived} Deleted={deleted} "
            f"Retention={retention_days}d Cutoff={cutoff.date()}"
        )

    except Exception as exc:
        db.rollback()
        logger.error(f"[Archiver] Archive job failed: {exc}")
        return {
            "archived": 0, "deleted": 0,
            "retention_days": retention_days,
            "cutoff": str(cutoff.date()),
            "error": str(exc),
        }
    finally:
        # ------------------------------------------------------------------
        # Step 3: ANALYZE both tables so query planner stays accurate.
        # Run outside the transaction (ANALYZE cannot run inside one in PG).
        # ------------------------------------------------------------------
        try:
            with db.bind.connect() as conn:
                conn.execution_options(isolation_level="AUTOCOMMIT")
                conn.execute(text("ANALYZE early_stage_candidate"))
                conn.execute(text("ANALYZE early_stage_candidate_archive"))
                logger.info("[Archiver] ANALYZE complete.")
        except Exception as exc:
            logger.warning(f"[Archiver] ANALYZE failed (non-critical): {exc}")
        db.close()

    return {
        "archived":        archived,
        "deleted":         deleted,
        "retention_days":  retention_days,
        "cutoff":          str(cutoff.date()),
    }

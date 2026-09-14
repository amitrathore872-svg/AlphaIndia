"""
Alpha India — Cache Eviction Service  (Phase 2)
Deletes early_stage_temp_cache rows older than EVICTION_MINUTES (default 30).
Called by the early-stage scheduler after every extraction cycle,
and also available as a standalone function for manual cleanup.
"""

import logging
from datetime import datetime, timedelta, timezone

from sqlalchemy import text

from app.db.database import SessionLocal

logger = logging.getLogger(__name__)

# Rows older than this window are deleted after extraction is done.
EVICTION_MINUTES = 30


def evict_stale_cache(minutes: int = EVICTION_MINUTES) -> int:
    """
    Delete all rows from early_stage_temp_cache older than `minutes`.
    Returns the number of rows deleted.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=minutes)
    db = SessionLocal()
    deleted = 0

    try:
        result = db.execute(
            text(
                "DELETE FROM early_stage_temp_cache "
                "WHERE fetched_at < :cutoff"
            ),
            {"cutoff": cutoff},
        )
        deleted = result.rowcount
        db.commit()
        logger.info(
            f"[CacheEviction] Deleted {deleted} stale cache rows "
            f"(older than {minutes} min)."
        )
    except Exception as exc:
        db.rollback()
        logger.error(f"[CacheEviction] Eviction failed: {exc}")
    finally:
        db.close()

    return deleted

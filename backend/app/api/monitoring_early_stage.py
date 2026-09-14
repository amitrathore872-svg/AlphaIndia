"""
Alpha India — Early Stage Monitoring API  (Phase 5)
Real-time health stats for the Early Stage Discovery module.
Consumed by the Mission Control → Early Stage tab.

Routes:
  GET /monitoring/early-stage        — full health snapshot
  GET /monitoring/early-stage/health — lightweight liveness check
"""

import logging
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/monitoring/early-stage",
    tags=["Monitoring — Early Stage"],
)


@router.get("")
def early_stage_health(db: Session = Depends(get_db)):
    """
    Full health snapshot for the monitoring dashboard.
    Returns:
      - feature flag status
      - candidate counts by status
      - cache queue depth
      - archive stats (row count, latest archived_at)
      - retention days
      - import log stats (total imports, latest import)
    """
    # Feature flag
    flag_row = db.execute(
        text("SELECT setting_value FROM system_settings WHERE setting_key='early_stage_enabled' LIMIT 1")
    ).fetchone()
    feature_enabled = flag_row is not None and flag_row[0].lower() == "true"

    # Retention days
    ret_row = db.execute(
        text("SELECT setting_value FROM system_settings WHERE setting_key='early_stage_retention_days' LIMIT 1")
    ).fetchone()
    retention_days = int(ret_row[0]) if ret_row else 30

    # Candidate counts by status
    status_rows = db.execute(
        text("SELECT status, COUNT(*) FROM early_stage_candidate GROUP BY status")
    ).fetchall()
    candidates_by_status = {r[0]: r[1] for r in status_rows}
    total_candidates = sum(candidates_by_status.values())

    # Cache queue depth
    cache_count = db.execute(
        text("SELECT COUNT(*) FROM early_stage_temp_cache")
    ).fetchone()[0]

    # Latest cache fetch
    latest_cache = db.execute(
        text("SELECT MAX(fetched_at) FROM early_stage_temp_cache")
    ).fetchone()[0]

    # Archive stats
    archive_count = db.execute(
        text("SELECT COUNT(*) FROM early_stage_candidate_archive")
    ).fetchone()[0]
    latest_archived = db.execute(
        text("SELECT MAX(archived_at) FROM early_stage_candidate_archive")
    ).fetchone()[0]

    # Import log stats
    import_count = db.execute(
        text("SELECT COUNT(*) FROM early_stage_import_log")
    ).fetchone()[0]
    latest_import = db.execute(
        text("SELECT MAX(imported_at) FROM early_stage_import_log")
    ).fetchone()[0]

    # Source-wise candidate counts
    source_rows = db.execute(
        text("SELECT source, COUNT(*) FROM early_stage_candidate GROUP BY source ORDER BY COUNT(*) DESC LIMIT 10")
    ).fetchall()
    sources = [{"source": r[0], "count": r[1]} for r in source_rows]

    return {
        "feature_enabled":      feature_enabled,
        "retention_days":       retention_days,
        "candidates": {
            "total":            total_candidates,
            "by_status":        candidates_by_status,
            "top_sources":      sources,
        },
        "cache": {
            "pending_rows":     cache_count,
            "latest_fetch":     str(latest_cache) if latest_cache else None,
        },
        "archive": {
            "total_archived":   archive_count,
            "latest_archived":  str(latest_archived) if latest_archived else None,
        },
        "imports": {
            "total_imported":   import_count,
            "latest_import":    str(latest_import) if latest_import else None,
        },
    }


@router.get("/health")
def early_stage_liveness(db: Session = Depends(get_db)):
    """Lightweight liveness ping for the 5-second heartbeat poller."""
    flag_row = db.execute(
        text("SELECT setting_value FROM system_settings WHERE setting_key='early_stage_enabled' LIMIT 1")
    ).fetchone()
    return {
        "status":          "ok",
        "feature_enabled": flag_row is not None and flag_row[0].lower() == "true",
    }

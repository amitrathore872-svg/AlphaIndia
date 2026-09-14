"""
Alpha India — Early Stage Discovery API  (Phase 3 & 4)
Exposes endpoints for the early-stage company discovery module.

Routes:
  POST /early-stage/run              — manually trigger full discovery pipeline
  GET  /early-stage/candidates       — paginated, sorted candidate list
  PATCH /early-stage/{id}/status     — update candidate status
  POST /early-stage/import           — bulk import selected candidates
  GET  /early-stage/stats            — monitoring stats
"""

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.database import get_db, SessionLocal
from app.models.early_stage_candidate import EarlyStageCandidate

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/early-stage",
    tags=["Early Stage Discovery"],
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _feature_enabled(db: Session) -> bool:
    row = db.execute(
        text("SELECT setting_value FROM system_settings WHERE setting_key='early_stage_enabled' LIMIT 1")
    ).fetchone()
    return row is not None and row[0].lower() == "true"


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class CandidateOut(BaseModel):
    id:               int
    company_name:     str
    tentative_ticker: Optional[str]
    source:           str
    mention_count:    int
    trend_score:      float
    sentiment:        str
    status:           str
    sector:           Optional[str]
    first_seen:       str
    last_seen:        str

    class Config:
        from_attributes = True


class StatusUpdate(BaseModel):
    status: str  # 'suggested' | 'ignored'


class BulkImportRequest(BaseModel):
    candidate_ids: List[int]


class BulkImportResponse(BaseModel):
    total:   int
    created: int
    reused:  int
    errors:  int
    details: list


class RunResponse(BaseModel):
    candidates_created: int
    candidates_updated: int
    texts_processed:    int
    message:            str


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/run", response_model=RunResponse)
def run_discovery_pipeline(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """
    Manually trigger the full early-stage discovery pipeline:
    1. News collector  2. NLP extraction  3. Candidate upsert.
    Runs in background to avoid HTTP timeout.
    """
    if not _feature_enabled(db):
        raise HTTPException(
            status_code=403,
            detail="Early Stage Discovery is disabled. Enable via system_settings.",
        )

    def _run():
        try:
            from app.collectors.news_discovery_collector import collect_news
            from app.services.early_stage_discovery_service import run_extraction_pipeline
            collect_news()
            result = run_extraction_pipeline()
            logger.info(f"[EarlyStage] Manual run complete: {result}")
        except Exception as exc:
            logger.error(f"[EarlyStage] Manual run error: {exc}")

    background_tasks.add_task(_run)
    return RunResponse(
        candidates_created=0,
        candidates_updated=0,
        texts_processed=0,
        message="Discovery pipeline triggered in background. Check /early-stage/candidates in ~30s.",
    )


@router.get("/candidates", response_model=List[CandidateOut])
def get_candidates(
    page:       int = Query(default=1, ge=1),
    limit:      int = Query(default=25, ge=1, le=100),
    status:     Optional[str] = Query(default="suggested"),
    source:     Optional[str] = Query(default=None),
    sentiment:  Optional[str] = Query(default=None),
    sort_by:    str = Query(default="trend_score"),
    sort_order: str = Query(default="desc"),
    db: Session = Depends(get_db),
):
    """
    Returns paginated, sorted list of early-stage company candidates.
    Server-side sorting on: trend_score, mention_count, first_seen, last_seen.
    """
    query = db.query(EarlyStageCandidate)

    if status:
        query = query.filter(EarlyStageCandidate.status == status)
    if source:
        query = query.filter(EarlyStageCandidate.source.ilike(f"%{source}%"))
    if sentiment:
        query = query.filter(EarlyStageCandidate.sentiment == sentiment)

    # Sort
    allowed_sort = {"trend_score", "mention_count", "first_seen", "last_seen", "company_name"}
    if sort_by not in allowed_sort:
        sort_by = "trend_score"
    col = getattr(EarlyStageCandidate, sort_by)
    col = col.desc() if sort_order == "desc" else col.asc()
    query = query.order_by(col)

    # Paginate
    offset  = (page - 1) * limit
    records = query.offset(offset).limit(limit).all()

    return [
        CandidateOut(
            id=r.id,
            company_name=r.company_name,
            tentative_ticker=r.tentative_ticker,
            source=r.source,
            mention_count=r.mention_count,
            trend_score=r.trend_score,
            sentiment=r.sentiment,
            status=r.status,
            sector=r.sector,
            first_seen=r.first_seen.isoformat() if r.first_seen else "",
            last_seen=r.last_seen.isoformat() if r.last_seen else "",
        )
        for r in records
    ]


@router.patch("/{candidate_id}/status")
def update_candidate_status(
    candidate_id: int,
    body: StatusUpdate,
    db: Session = Depends(get_db),
):
    """Update a candidate's status (suggested / ignored)."""
    allowed = {"suggested", "ignored", "imported"}
    if body.status not in allowed:
        raise HTTPException(status_code=400, detail=f"Status must be one of {allowed}")

    candidate = db.query(EarlyStageCandidate).filter(EarlyStageCandidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    candidate.status = body.status
    db.commit()
    return {"id": candidate_id, "status": body.status, "message": "Status updated"}


@router.get("/stats")
def get_discovery_stats(db: Session = Depends(get_db)):
    """Quick stats for the monitoring dashboard."""
    from sqlalchemy import func
    total = db.query(func.count(EarlyStageCandidate.id)).scalar()
    by_status = db.execute(
        text("SELECT status, COUNT(*) FROM early_stage_candidate GROUP BY status")
    ).fetchall()
    cache_count = db.execute(
        text("SELECT COUNT(*) FROM early_stage_temp_cache")
    ).fetchone()[0]

    return {
        "total_candidates": total,
        "by_status": {row[0]: row[1] for row in by_status},
        "cache_rows_pending": cache_count,
        "feature_enabled": _feature_enabled(db),
    }


@router.post("/import", response_model=BulkImportResponse)
def bulk_import(
    body: BulkImportRequest,
    db: Session = Depends(get_db),
):
    """
    Bulk-import selected early-stage candidates into the main pipeline.
    Creates provisional Company records + enqueues financial import.
    Accepts a list of candidate IDs; already-imported candidates are skipped.
    """
    if not body.candidate_ids:
        raise HTTPException(status_code=400, detail="candidate_ids list must not be empty.")

    from app.services.early_stage_import_service import bulk_import_candidates
    result = bulk_import_candidates(db=db, candidate_ids=body.candidate_ids)
    return BulkImportResponse(**result)


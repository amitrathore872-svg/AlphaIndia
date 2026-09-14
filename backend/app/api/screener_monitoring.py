"""
Alpha India Screener.in Monitoring API
Parallel Architecture - Real-Time Importer Telemetry & Health Monitoring
Provides high-frequency status (5s polling), live activity feed, latency metrics,
error log, and historical batch run reporting.
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.screener_import_run import ScreenerImportRun
from app.services.screener_telemetry_service import ScreenerTelemetryService
from app.workers.screener_import_worker import ScreenerImportWorker

router = APIRouter(
    prefix="/screener-monitoring",
    tags=["Screener.in Monitoring"],
)


class StartImportRequest(BaseModel):
    batch_size: int = 50
    delay_seconds: float = 0.8
    symbols: Optional[List[str]] = None


@router.get("/status")
def get_monitoring_status():
    """
    Returns real-time system health, importer state, and countdown timer.
    Polled every 5 seconds by the frontend.
    """
    return {
        "success": True,
        **ScreenerTelemetryService.get_system_health(),
    }


@router.get("/stats")
def get_monitoring_stats(db: Session = Depends(get_db)):
    """
    Returns database import counters: total in DB, today's imports, success rate.
    """
    return {
        "success": True,
        **ScreenerTelemetryService.get_database_stats(db),
    }


@router.get("/activity")
def get_live_activity(limit: int = Query(default=50, ge=1, le=100)):
    """
    Returns live activity feed events from the telemetry ring buffer for the console.
    """
    events = ScreenerTelemetryService.get_live_events(limit=limit)
    return {
        "success": True,
        "count": len(events),
        "events": events,
    }


@router.get("/performance")
def get_performance_metrics():
    """
    Returns response time, parse time, DB write time, and throughput records/sec.
    """
    return {
        "success": True,
        **ScreenerTelemetryService.get_performance_metrics(),
    }


@router.get("/errors")
def get_error_log():
    """
    Returns recent error log with expandable details.
    """
    errors = ScreenerTelemetryService.get_errors()
    return {
        "success": True,
        "count": len(errors),
        "errors": errors,
    }


@router.get("/runs")
def get_historical_runs(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=50),
    status: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    """
    Returns historical batch import runs with status filtering and pagination.
    """
    query = db.query(ScreenerImportRun)

    if status and status.strip() and status.upper() != "ALL":
        query = query.filter(ScreenerImportRun.status == status.strip().upper())

    total = query.count()
    offset = (page - 1) * limit
    runs = query.order_by(ScreenerImportRun.created_at.desc()).offset(offset).limit(limit).all()

    results = []
    for r in runs:
        results.append({
            "id": r.id,
            "run_id": r.run_id,
            "status": r.status,
            "start_time": r.start_time.isoformat() if r.start_time else None,
            "end_time": r.end_time.isoformat() if r.end_time else None,
            "duration_seconds": r.duration_seconds,
            "total_target": r.total_target,
            "imported_count": r.imported_count,
            "updated_count": r.updated_count,
            "failed_count": r.failed_count,
            "skipped_count": r.skipped_count,
            "success_rate_percent": r.success_rate_percent,
            "error_summary": r.error_summary,
        })

    return {
        "success": True,
        "page": page,
        "limit": limit,
        "total": total,
        "total_pages": max(1, (total + limit - 1) // limit),
        "results": results,
    }


@router.post("/start")
def start_import_job(req: StartImportRequest):
    """
    Triggers a background Screener.in import job.
    """
    res = ScreenerImportWorker.start(
        batch_size=req.batch_size,
        delay_seconds=req.delay_seconds,
        symbols_override=req.symbols,
    )
    return {"success": True, **res}


@router.post("/stop")
def stop_import_job():
    """
    Gracefully halts the currently active Screener.in import worker.
    """
    res = ScreenerImportWorker.stop()
    return {"success": True, **res}


@router.post("/schedule/interval")
def update_schedule_interval(interval_seconds: int = Query(..., ge=60, le=86400)):
    """
    Updates the scheduled interval in seconds (e.g., 1800 for 30m, 900 for 15m).
    """
    from app.services.screener_scheduler import ScreenerScheduler
    ScreenerScheduler.set_interval_seconds(interval_seconds)
    return {
        "success": True,
        "interval_seconds": ScreenerScheduler.get_interval_seconds(),
        "message": f"Schedule interval updated to {interval_seconds}s.",
    }


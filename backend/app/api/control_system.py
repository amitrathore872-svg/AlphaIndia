"""
Alpha India — Universal Control System & Action Logs API
Sprint 34 Production API

Exposes endpoints for querying background data fetching services, intervals,
last fetch timestamps, and real-time operational action logs.
"""

from typing import Any, Dict, List, Optional
from fastapi import APIRouter, BackgroundTasks, Query
from pydantic import BaseModel

from app.services.control_system_service import ControlSystemService

router = APIRouter(
    prefix="/control-system",
    tags=["Control System & Action Logs"],
)


class TriggerResponse(BaseModel):
    success: bool
    service_id: str
    message: str


@router.get("/status")
def get_control_system_status() -> Dict[str, Any]:
    """
    Returns full telemetry for all 6 data ingestion services:
    - Service status (RUNNING / IDLE / PAUSED / ERROR)
    - Last fetch timestamp & interval
    - Next scheduled run
    - Records ingested today
    - Latest action logs
    """
    return ControlSystemService.get_all_statuses()


@router.get("/logs")
def get_control_system_logs(
    service_id: Optional[str] = Query(None, description="Filter by service id or 'ALL'"),
    level: Optional[str] = Query(None, description="Filter by level: INFO, SUCCESS, WARN, ERROR"),
    limit: int = Query(50, ge=1, le=200, description="Max logs to return"),
) -> List[Dict[str, Any]]:
    """
    Returns filterable operational action logs recorded across all pipelines.
    """
    return ControlSystemService.get_logs(
        service_id=service_id,
        level=level,
        limit=limit,
    )


@router.post("/trigger/{service_id}")
def trigger_service_now(
    service_id: str,
    background_tasks: BackgroundTasks,
) -> Dict[str, Any]:
    """
    Triggers an immediate on-demand fetch cycle for any specific data service.
    """
    def _run():
        ControlSystemService.trigger_service_now(service_id)

    background_tasks.add_task(_run)
    return {
        "success": True,
        "service_id": service_id,
        "message": f"Service '{service_id}' fetch cycle triggered in background.",
    }


@router.post("/toggle/{service_id}")
def toggle_service_status(service_id: str) -> Dict[str, Any]:
    """
    Pauses or resumes a background ingestion service.
    """
    return ControlSystemService.toggle_service(service_id)


@router.post("/trigger-all")
def trigger_all_services(background_tasks: BackgroundTasks) -> Dict[str, Any]:
    """
    Triggers all external data fetching services immediately.
    """
    def _run_all():
        for s_id in ["exchange_live_wire", "results_discovery", "athena_omega_watcher", "raw_file_archiver"]:
            ControlSystemService.trigger_service_now(s_id)

    background_tasks.add_task(_run_all)
    return {
        "success": True,
        "message": "All data fetching services triggered in parallel background tasks.",
    }

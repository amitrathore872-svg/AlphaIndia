"""
Alpha India — Prometheus Metrics & Telemetry API Router
Exposes institutional Prometheus-compatible text metrics and JSON operational summaries.
"""

from fastapi import APIRouter, Response
from fastapi.responses import PlainTextResponse

from app.core.telemetry import telemetry

router = APIRouter(tags=["Observability & Metrics"])


@router.get("/metrics", response_class=PlainTextResponse)
def get_prometheus_metrics():
    """Returns standard Prometheus-compatible metrics exposition format."""
    content = telemetry.generate_prometheus_exposition()
    return Response(content=content, media_type="text/plain; version=0.0.4; charset=utf-8")


@router.get("/api/v1/telemetry/summary")
def get_telemetry_summary():
    """Returns JSON operational health summary of backend latency and throughput."""
    return telemetry.get_summary()

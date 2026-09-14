"""
Alpha India Screener.in Telemetry Service
Parallel Architecture - Real-time in-memory + DB telemetry streaming
Tracks engine status, live events ring buffer, latency metrics, error monitor, and countdowns.
"""

from collections import deque
from datetime import datetime, timedelta
import threading
import time
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.models.company import Company
from app.models.screener_import_event import ScreenerImportEvent
from app.models.screener_growth_record import ScreenerGrowthRecord
from app.models.screener_import_run import ScreenerImportRun


class ScreenerTelemetryService:
    _lock = threading.Lock()

    # In-memory ring buffer for low-latency live console polling (keeps last 200 events)
    _event_buffer: deque = deque(maxlen=200)

    # Importer Status
    _status: str = "IDLE"  # IDLE, RUNNING, FAILED
    _current_run_id: Optional[str] = None
    _current_symbol: Optional[str] = None
    _run_start_time: Optional[float] = None
    _last_successful_import_time: Optional[datetime] = None

    # Scheduler Telemetry
    _next_scheduled_run: Optional[datetime] = None
    _scheduler_enabled: bool = True

    # Performance Latency Trackers (last 100 samples)
    _fetch_latencies: deque = deque(maxlen=100)
    _parse_latencies: deque = deque(maxlen=100)
    _write_latencies: deque = deque(maxlen=100)

    # Error Log (last 50 errors)
    _error_log: deque = deque(maxlen=50)

    @classmethod
    def emit_event(
        cls,
        event_type: str,
        message: str,
        level: str = "INFO",
        symbol: Optional[str] = None,
        run_id: Optional[str] = None,
        response_time_ms: Optional[float] = None,
        parse_time_ms: Optional[float] = None,
        db_write_time_ms: Optional[float] = None,
        persist_to_db: bool = True,
    ):
        event_data = {
            "id": int(time.time() * 1000),
            "run_id": run_id or cls._current_run_id,
            "symbol": symbol,
            "event_type": event_type,
            "level": level,
            "message": message,
            "response_time_ms": response_time_ms,
            "parse_time_ms": parse_time_ms,
            "db_write_time_ms": db_write_time_ms,
            "timestamp": datetime.utcnow().strftime("%H:%M:%S"),
            "created_at": datetime.utcnow().isoformat(),
        }

        with cls._lock:
            cls._event_buffer.append(event_data)
            if response_time_ms is not None:
                cls._fetch_latencies.append(response_time_ms)
            if parse_time_ms is not None:
                cls._parse_latencies.append(parse_time_ms)
            if db_write_time_ms is not None:
                cls._write_latencies.append(db_write_time_ms)

            if level == "ERROR":
                cls._error_log.append({
                    "symbol": symbol,
                    "event_type": event_type,
                    "message": message,
                    "timestamp": datetime.utcnow().isoformat(),
                })

        if persist_to_db:
            try:
                db: Session = SessionLocal()
                try:
                    db_event = ScreenerImportEvent(
                        run_id=run_id or cls._current_run_id,
                        symbol=symbol,
                        event_type=event_type,
                        level=level,
                        message=message,
                        response_time_ms=response_time_ms,
                        parse_time_ms=parse_time_ms,
                        db_write_time_ms=db_write_time_ms,
                    )
                    db.add(db_event)
                    db.commit()
                finally:
                    db.close()
            except Exception:
                pass

    @classmethod
    def set_running(cls, run_id: str):
        with cls._lock:
            cls._status = "RUNNING"
            cls._current_run_id = run_id
            cls._run_start_time = time.time()

    @classmethod
    def set_idle(cls, success: bool = True):
        with cls._lock:
            cls._status = "IDLE"
            cls._current_symbol = None
            cls._run_start_time = None
            if success:
                cls._last_successful_import_time = datetime.utcnow()

    @classmethod
    def set_failed(cls, reason: str):
        with cls._lock:
            cls._status = "FAILED"
            cls._current_symbol = None
            cls._run_start_time = None
        cls.emit_event("JOB_FAILED", f"Import job failed: {reason}", level="ERROR")

    @classmethod
    def set_current_symbol(cls, symbol: Optional[str]):
        with cls._lock:
            cls._current_symbol = symbol

    @classmethod
    def set_next_scheduled_run(cls, dt: Optional[datetime]):
        with cls._lock:
            cls._next_scheduled_run = dt

    @classmethod
    def get_system_health(cls) -> Dict[str, Any]:
        with cls._lock:
            from app.workers.screener_import_worker import ScreenerImportWorker
            if cls._status == "RUNNING" and not ScreenerImportWorker.is_running():
                cls._status = "IDLE"
                cls._current_symbol = None
                cls._run_start_time = None

            duration_sec = 0.0
            if cls._status == "RUNNING" and cls._run_start_time:
                duration_sec = round(time.time() - cls._run_start_time, 1)

            next_run_countdown = None
            if cls._next_scheduled_run:
                diff = cls._next_scheduled_run - datetime.utcnow()
                total_sec = max(0, int(diff.total_seconds()))
                hours, remainder = divmod(total_sec, 3600)
                minutes, seconds = divmod(remainder, 60)
                next_run_countdown = f"{hours:02d}:{minutes:02d}:{seconds:02d}"

            return {
                "importer_status": cls._status,
                "current_run_id": cls._current_run_id,
                "current_symbol": cls._current_symbol,
                "current_duration_seconds": duration_sec,
                "last_successful_import": cls._last_successful_import_time.isoformat() if cls._last_successful_import_time else None,
                "scheduler_status": "ACTIVE" if cls._scheduler_enabled else "PAUSED",
                "next_scheduled_run": cls._next_scheduled_run.isoformat() if cls._next_scheduled_run else None,
                "next_run_countdown": next_run_countdown or "00:00:00",
            }

    @classmethod
    def get_live_events(cls, limit: int = 50) -> List[Dict[str, Any]]:
        with cls._lock:
            events = list(cls._event_buffer)
            return events[-limit:]

    @classmethod
    def get_performance_metrics(cls) -> Dict[str, Any]:
        with cls._lock:
            avg_fetch = round(sum(cls._fetch_latencies) / len(cls._fetch_latencies), 1) if cls._fetch_latencies else 0.0
            avg_parse = round(sum(cls._parse_latencies) / len(cls._parse_latencies), 1) if cls._parse_latencies else 0.0
            avg_write = round(sum(cls._write_latencies) / len(cls._write_latencies), 1) if cls._write_latencies else 0.0
            total_avg = round(avg_fetch + avg_parse + avg_write, 1)
            throughput = round(1000 / total_avg, 2) if total_avg > 0 else 0.0

            return {
                "avg_response_time_ms": avg_fetch,
                "avg_parse_time_ms": avg_parse,
                "avg_write_time_ms": avg_write,
                "avg_total_execution_ms": total_avg,
                "records_per_second": throughput,
            }

    @classmethod
    def get_errors(cls) -> List[Dict[str, Any]]:
        with cls._lock:
            return list(cls._error_log)

    @classmethod
    def get_database_stats(cls, db: Session) -> Dict[str, Any]:
        total_in_db = db.query(ScreenerGrowthRecord).count()

        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        imported_today = (
            db.query(ScreenerGrowthRecord)
            .filter(ScreenerGrowthRecord.last_updated >= today_start)
            .count()
        )

        new_added_today = (
            db.query(ScreenerGrowthRecord)
            .filter(ScreenerGrowthRecord.import_timestamp >= today_start)
            .count()
        )

        updated_today = max(0, imported_today - new_added_today)

        # Runs today
        runs = db.query(ScreenerImportRun).filter(ScreenerImportRun.created_at >= today_start).all()
        failed_count = sum(r.failed_count for r in runs)
        success_count = sum(r.imported_count + r.updated_count for r in runs)
        total_processed = success_count + failed_count
        success_rate = round((success_count / total_processed) * 100, 1) if total_processed > 0 else 100.0

        total_universe = db.query(Company.id).filter(Company.is_growth_eligible.is_(True)).count()
        unimported_remaining = max(0, total_universe - total_in_db)
        coverage_percent = round((total_in_db / total_universe) * 100, 2) if total_universe > 0 else 0.0

        return {
            "total_companies_in_db": total_in_db,
            "total_universe_eligible": total_universe,
            "unimported_remaining": unimported_remaining,
            "coverage_percent": coverage_percent,
            "imported_today": imported_today,
            "new_added_today": new_added_today,
            "existing_updated_today": updated_today,
            "failed_today": failed_count,
            "skipped_today": 0,
            "success_rate_percent": success_rate,
        }

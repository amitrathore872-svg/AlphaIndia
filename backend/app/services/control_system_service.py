"""
Alpha India — Centralized Control System & Operational Action Logs Service
Sprint 34 Production Core

Tracks real-time status, execution intervals, and operational action logs for all
data fetching and extraction services across the platform.
"""

from collections import deque
from datetime import datetime, timezone, timedelta
import logging
import threading
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class ControlSystemService:
    _lock = threading.RLock()
    _log_counter: int = 0
    _action_logs: deque = deque(maxlen=250)

    # Registered ingestion engines
    _services: Dict[str, Dict[str, Any]] = {
        "exchange_live_wire": {
            "id": "exchange_live_wire",
            "name": "NSE/BSE Live Exchange Wire",
            "category": "Exchange Wire",
            "status": "RUNNING",
            "poll_interval_seconds": 60,
            "last_fetch_time": None,
            "next_run_time": None,
            "total_fetches": 0,
            "records_ingested_today": 0,
            "last_status": "IDLE",
            "last_error": None,
            "description": "Continuous real-time scraping of corporate disclosures & price triggers directly from exchanges.",
        },
        "results_discovery": {
            "id": "results_discovery",
            "name": "Exchange Results Discovery Engine",
            "category": "Results Discovery",
            "status": "RUNNING",
            "poll_interval_seconds": 300,
            "last_fetch_time": None,
            "next_run_time": None,
            "total_fetches": 0,
            "records_ingested_today": 0,
            "last_status": "IDLE",
            "last_error": None,
            "description": "Scans quarterly, half-yearly and audited earnings releases into the filing registry.",
        },
        "athena_omega_watcher": {
            "id": "athena_omega_watcher",
            "name": "Athena Omega 5-Gate Earnings Watcher",
            "category": "AI Conviction",
            "status": "RUNNING",
            "poll_interval_seconds": 120,
            "last_fetch_time": None,
            "next_run_time": None,
            "total_fetches": 0,
            "records_ingested_today": 0,
            "last_status": "IDLE",
            "last_error": None,
            "description": "5-Gate quantitative earnings shock analysis, quality audits, valuation and PEAD drift.",
        },
        "screener_financial_importer": {
            "id": "screener_financial_importer",
            "name": "Financial Statement Warehouse Importer",
            "category": "Financial Warehouse",
            "status": "RUNNING",
            "poll_interval_seconds": 1800,
            "last_fetch_time": None,
            "next_run_time": None,
            "total_fetches": 0,
            "records_ingested_today": 0,
            "last_status": "IDLE",
            "last_error": None,
            "description": "High-frequency multi-quarter financial statements ingestion into historical warehouse.",
        },
        "early_stage_discovery": {
            "id": "early_stage_discovery",
            "name": "Early Stage Breakout & News Engine",
            "category": "Early Stage Scanner",
            "status": "RUNNING",
            "poll_interval_seconds": 3600,
            "last_fetch_time": None,
            "next_run_time": None,
            "total_fetches": 0,
            "records_ingested_today": 0,
            "last_status": "IDLE",
            "last_error": None,
            "description": "Scrapes market news & social volume catalysts to identify emerging microcap breakouts.",
        },
        "raw_file_archiver": {
            "id": "raw_file_archiver",
            "name": "Raw File Archival & Compression Engine",
            "category": "Storage Archival",
            "status": "RUNNING",
            "poll_interval_seconds": 600,
            "last_fetch_time": None,
            "next_run_time": None,
            "total_fetches": 0,
            "records_ingested_today": 0,
            "last_status": "IDLE",
            "last_error": None,
            "description": "Compresses extracted filing documents (.gz) and purges uncompressed heavy files.",
        },
        "cpr_compression_engine": {
            "id": "cpr_compression_engine",
            "name": "CPR Compression Scanner (Engine #11)",
            "category": "Quant Compression",
            "status": "RUNNING",
            "poll_interval_seconds": 300,
            "last_fetch_time": None,
            "next_run_time": None,
            "total_fetches": 0,
            "records_ingested_today": 0,
            "last_status": "IDLE",
            "last_error": None,
            "description": "Scans 4,500 NSE equities for narrow Central Pivot Range, Triple CPR confluence, and volatility breakout readiness.",
        },
        "vcp_breakout_engine": {
            "id": "vcp_breakout_engine",
            "name": "Minervini VCP Breakout Scanner",
            "category": "Quant Breakout",
            "status": "RUNNING",
            "poll_interval_seconds": 300,
            "last_fetch_time": None,
            "next_run_time": None,
            "total_fetches": 0,
            "records_ingested_today": 0,
            "last_status": "IDLE",
            "last_error": None,
            "description": "Scans volatility contraction patterns, volume dry-up, and institutional pivot breakout triggers.",
        },
        "master_scheduler": {
            "id": "master_scheduler",
            "name": "Master Autonomous Scheduler",
            "category": "Autonomous Supervisor",
            "status": "RUNNING",
            "poll_interval_seconds": 5,
            "last_fetch_time": None,
            "next_run_time": None,
            "total_fetches": 0,
            "records_ingested_today": 0,
            "last_status": "IDLE",
            "last_error": None,
            "description": "Master daemon orchestrator coordinating all autonomous scanner cycles across equities.",
        },
    }

    @classmethod
    def log_action(
        cls,
        service_id: str,
        service_name: str,
        level: str,
        action: str,
        message: str,
        duration_ms: float = 0.0,
        records_count: int = 0,
    ):
        with cls._lock:
            cls._log_counter += 1
            entry = {
                "id": cls._log_counter,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "service_id": service_id,
                "service_name": service_name,
                "level": level.upper(),  # INFO, SUCCESS, WARN, ERROR
                "action": action,
                "message": message,
                "duration_ms": round(duration_ms, 1),
                "records_count": records_count,
            }
            cls._action_logs.appendleft(entry)

    @classmethod
    def record_service_fetch(
        cls,
        service_id: str,
        records_count: int = 0,
        status: str = "SUCCESS",
        error_msg: Optional[str] = None,
        duration_ms: float = 0.0,
    ):
        now = datetime.now(timezone.utc)
        with cls._lock:
            srv = cls._services.get(service_id)
            if not srv:
                return

            srv["last_fetch_time"] = now.isoformat()
            srv["total_fetches"] += 1
            srv["records_ingested_today"] += records_count
            srv["last_status"] = status.upper()
            srv["last_error"] = error_msg

            interval = srv.get("poll_interval_seconds", 60)
            next_t = now + timedelta(seconds=interval)
            srv["next_run_time"] = next_t.isoformat()

            if status.upper() == "SUCCESS" and records_count > 0:
                cls.log_action(
                    service_id=service_id,
                    service_name=srv["name"],
                    level="SUCCESS",
                    action="FETCH_COMPLETE",
                    message=f"Ingestion successful: {records_count} fresh items processed in {round(duration_ms, 1)}ms.",
                    duration_ms=duration_ms,
                    records_count=records_count,
                )
            elif status.upper() == "ERROR":
                cls.log_action(
                    service_id=service_id,
                    service_name=srv["name"],
                    level="ERROR",
                    action="FETCH_ERROR",
                    message=f"Fetch cycle error: {error_msg}",
                    duration_ms=duration_ms,
                )

    @classmethod
    def get_all_statuses(cls) -> Dict[str, Any]:
        with cls._lock:
            # Refresh live statuses from active workers
            cls._sync_live_worker_states()

            services_list = list(cls._services.values())
            total_active = sum(1 for s in services_list if s["status"] in ("RUNNING", "POLLING"))
            total_ingested = sum(s["records_ingested_today"] for s in services_list)

            # Find latest fetch across all services
            latest_fetch = None
            for s in services_list:
                if s["last_fetch_time"]:
                    if not latest_fetch or s["last_fetch_time"] > latest_fetch:
                        latest_fetch = s["last_fetch_time"]

            return {
                "server_time": datetime.now(timezone.utc).isoformat(),
                "total_services": len(services_list),
                "active_services": total_active,
                "total_records_ingested_today": total_ingested,
                "latest_fetch_time": latest_fetch,
                "services": services_list,
                "recent_logs": list(cls._action_logs)[:25],
            }

    @classmethod
    def get_logs(
        cls,
        service_id: Optional[str] = None,
        level: Optional[str] = None,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        with cls._lock:
            logs = list(cls._action_logs)

            if service_id and service_id != "ALL":
                logs = [l for l in logs if l["service_id"] == service_id]

            if level and level != "ALL":
                logs = [l for l in logs if l["level"] == level.upper()]

            return logs[:limit]

    @classmethod
    def trigger_service_now(cls, service_id: str) -> Dict[str, Any]:
        """
        Triggers an immediate on-demand fetch cycle for a service.
        """
        with cls._lock:
            srv = cls._services.get(service_id)
            if not srv:
                return {"success": False, "message": f"Service '{service_id}' not found."}

        start_t = datetime.now(timezone.utc)
        records_found = 0
        status = "SUCCESS"
        error_msg = None

        try:
            if service_id == "exchange_live_wire":
                from app.services.live_exchange_wire_worker import LiveExchangeWireWorker
                from app.db.database import SessionLocal
                db = SessionLocal()
                try:
                    res = LiveExchangeWireWorker.poll_next_batch(db)
                    records_found = res.get("catalysts", 0)
                finally:
                    db.close()

            elif service_id == "results_discovery":
                from app.services.discovery_worker import DiscoveryWorker
                from app.db.database import SessionLocal
                db = SessionLocal()
                try:
                    res = DiscoveryWorker.discover_live_market(db)
                    records_found = res.get("new_entries_discovered", 0)
                finally:
                    db.close()

            elif service_id == "athena_omega_watcher":
                from app.services.athena_exchange_watcher import AthenaExchangeWatcher
                res_list = AthenaExchangeWatcher.scan_recent_exchange_results()
                records_found = len(res_list)

            elif service_id == "raw_file_archiver":
                from app.services.raw_file_archiver import RawFileArchiveService
                res = RawFileArchiveService.run_archival_cycle()
                records_found = res.get("archived_count", 0)

            elif service_id == "early_stage_discovery":
                from app.services.early_stage_discovery_service import EarlyStageDiscoveryService
                from app.db.database import SessionLocal
                db = SessionLocal()
                try:
                    res = EarlyStageDiscoveryService.run_full_discovery_pipeline(db)
                    records_found = res.get("candidates_created", 0)
                finally:
                    db.close()

            elif service_id == "screener_financial_importer":
                from app.workers.screener_import_worker import ScreenerImportWorker
                from app.db.database import SessionLocal
                db = SessionLocal()
                try:
                    res = ScreenerImportWorker.run_import_cycle(db, batch_size=5)
                    records_found = res.get("imported_count", 0) if isinstance(res, dict) else 0
                finally:
                    db.close()

        except Exception as exc:
            status = "ERROR"
            error_msg = str(exc)
            logger.error(f"[ControlSystemService] Trigger {service_id} error: {exc}")

        duration_ms = (datetime.now(timezone.utc) - start_t).total_seconds() * 1000.0
        cls.record_service_fetch(
            service_id=service_id,
            records_count=records_found,
            status=status,
            error_msg=error_msg,
            duration_ms=duration_ms,
        )

        return {
            "success": status == "SUCCESS",
            "service_id": service_id,
            "records_processed": records_found,
            "duration_ms": round(duration_ms, 1),
            "error": error_msg,
        }

    @classmethod
    def start_service(cls, service_id: str) -> Dict[str, Any]:
        """
        Explicitly starts a specific background worker or scheduler thread.
        """
        with cls._lock:
            srv = cls._services.get(service_id)
            if not srv:
                return {"success": False, "message": f"Service '{service_id}' not found."}

        try:
            if service_id == "exchange_live_wire":
                from app.services.live_exchange_wire_worker import LiveExchangeWireWorker
                LiveExchangeWireWorker.start(poll_interval_seconds=srv.get("poll_interval_seconds", 60))
            elif service_id == "screener_financial_importer":
                from app.services.screener_scheduler import ScreenerScheduler
                ScreenerScheduler.start(interval_seconds=srv.get("poll_interval_seconds", 1800))
            elif service_id == "early_stage_discovery":
                from app.services.early_stage_scheduler import EarlyStageScheduler
                EarlyStageScheduler.start()
            elif service_id == "raw_file_archiver":
                from app.services.raw_file_archiver import RawFileArchiveService
                RawFileArchiveService.start(interval_seconds=srv.get("poll_interval_seconds", 600))
            elif service_id == "vcp_breakout_engine":
                from app.services.vcp_scheduler import VCPScheduler
                VCPScheduler.start()
                from app.services.autonomous_scheduler import AutonomousEngineScheduler
                AutonomousEngineScheduler.enable_engine("vcp_engine")
            elif service_id == "cpr_compression_engine":
                from app.services.autonomous_scheduler import AutonomousEngineScheduler
                AutonomousEngineScheduler.enable_engine("cpr_engine")
            elif service_id in ("results_discovery", "athena_omega_watcher"):
                from app.services.autonomous_scheduler import AutonomousEngineScheduler
                AutonomousEngineScheduler.enable_engine("discovery_athena")
            elif service_id == "master_scheduler":
                from app.services.autonomous_scheduler import AutonomousEngineScheduler
                AutonomousEngineScheduler.start()

            with cls._lock:
                srv["status"] = "RUNNING"
                cls.log_action(
                    service_id=service_id,
                    service_name=srv["name"],
                    level="SUCCESS",
                    action="ENGINE_START",
                    message=f"Engine '{srv['name']}' started successfully.",
                )
            return {
                "success": True,
                "service_id": service_id,
                "status": "RUNNING",
                "new_status": "RUNNING",
                "message": f"Engine '{srv['name']}' started.",
            }
        except Exception as exc:
            logger.error(f"[ControlSystemService] Failed to start {service_id}: {exc}", exc_info=True)
            return {"success": False, "service_id": service_id, "status": "ERROR", "new_status": "ERROR", "message": str(exc)}

    @classmethod
    def stop_service(cls, service_id: str) -> Dict[str, Any]:
        """
        Explicitly stops a specific background worker or scheduler thread.
        """
        with cls._lock:
            srv = cls._services.get(service_id)
            if not srv:
                return {"success": False, "message": f"Service '{service_id}' not found."}

        try:
            if service_id == "exchange_live_wire":
                from app.services.live_exchange_wire_worker import LiveExchangeWireWorker
                LiveExchangeWireWorker.stop()
            elif service_id == "screener_financial_importer":
                from app.services.screener_scheduler import ScreenerScheduler
                from app.workers.screener_import_worker import ScreenerImportWorker
                ScreenerScheduler.stop()
                ScreenerImportWorker.stop()
            elif service_id == "early_stage_discovery":
                from app.services.early_stage_scheduler import EarlyStageScheduler
                EarlyStageScheduler.stop()
            elif service_id == "raw_file_archiver":
                from app.services.raw_file_archiver import RawFileArchiveService
                RawFileArchiveService.stop()
            elif service_id == "vcp_breakout_engine":
                from app.services.vcp_scheduler import VCPScheduler
                VCPScheduler.stop()
                from app.services.autonomous_scheduler import AutonomousEngineScheduler
                AutonomousEngineScheduler.disable_engine("vcp_engine")
            elif service_id == "cpr_compression_engine":
                from app.services.autonomous_scheduler import AutonomousEngineScheduler
                AutonomousEngineScheduler.disable_engine("cpr_engine")
            elif service_id in ("results_discovery", "athena_omega_watcher"):
                from app.services.autonomous_scheduler import AutonomousEngineScheduler
                AutonomousEngineScheduler.disable_engine("discovery_athena")
            elif service_id == "master_scheduler":
                from app.services.autonomous_scheduler import AutonomousEngineScheduler
                AutonomousEngineScheduler.stop()

            with cls._lock:
                srv["status"] = "STOPPED"
                cls.log_action(
                    service_id=service_id,
                    service_name=srv["name"],
                    level="WARN",
                    action="ENGINE_STOP",
                    message=f"Engine '{srv['name']}' stopped by operator.",
                )
            return {
                "success": True,
                "service_id": service_id,
                "status": "STOPPED",
                "new_status": "STOPPED",
                "message": f"Engine '{srv['name']}' stopped.",
            }
        except Exception as exc:
            logger.error(f"[ControlSystemService] Failed to stop {service_id}: {exc}", exc_info=True)
            return {"success": False, "service_id": service_id, "status": "ERROR", "new_status": "ERROR", "message": str(exc)}

    @classmethod
    def toggle_service(cls, service_id: str) -> Dict[str, Any]:
        """
        Toggles an engine: stops it if running/idle, or starts it if stopped/paused.
        """
        with cls._lock:
            srv = cls._services.get(service_id)
            if not srv:
                return {"success": False, "message": "Service not found"}
            current_status = srv["status"]

        if current_status in ("RUNNING", "POLLING", "IDLE"):
            return cls.stop_service(service_id)
        else:
            return cls.start_service(service_id)

    @classmethod
    def start_all_services(cls) -> Dict[str, Any]:
        """
        Master Start: Ignites all registered ingestion engines and background schedulers.
        """
        results = {}
        for s_id in list(cls._services.keys()):
            results[s_id] = cls.start_service(s_id)

        cls.log_action(
            service_id="ALL",
            service_name="Master Supervisor",
            level="SUCCESS",
            action="ALL_ENGINES_STARTED",
            message="Master Command: All ingestion engines and autonomous schedulers started.",
        )
        return {"success": True, "message": "All engines started.", "results": results}

    @classmethod
    def stop_all_services(cls) -> Dict[str, Any]:
        """
        Safety Halt: Stops all registered ingestion engines and background schedulers.
        """
        results = {}
        for s_id in list(cls._services.keys()):
            results[s_id] = cls.stop_service(s_id)

        cls.log_action(
            service_id="ALL",
            service_name="Master Supervisor",
            level="WARN",
            action="ALL_ENGINES_STOPPED",
            message="Safety Halt: All ingestion engines and autonomous schedulers stopped by operator.",
        )
        return {"success": True, "message": "All engines stopped.", "results": results}

    @classmethod
    def _sync_live_worker_states(cls):
        """Reflects actual background thread states into service dictionary."""
        # 1. Live Exchange Wire
        try:
            from app.services.live_exchange_wire_worker import LiveExchangeWireWorker
            wire_running = LiveExchangeWireWorker.is_running()
            if cls._services["exchange_live_wire"]["status"] not in ("STOPPED", "PAUSED"):
                cls._services["exchange_live_wire"]["status"] = "RUNNING" if wire_running else "IDLE"
            elif wire_running:
                cls._services["exchange_live_wire"]["status"] = "RUNNING"
            telemetry = LiveExchangeWireWorker.get_telemetry()
            if telemetry.get("last_poll_time"):
                cls._services["exchange_live_wire"]["last_fetch_time"] = telemetry["last_poll_time"]
            cls._services["exchange_live_wire"]["records_ingested_today"] = telemetry.get("catalysts_discovered", 0)
        except Exception:
            pass

        # 2. Screener Financial Warehouse Importer
        try:
            from app.services.screener_scheduler import ScreenerScheduler
            from app.workers.screener_import_worker import ScreenerImportWorker
            screener_running = ScreenerScheduler.is_running() or ScreenerImportWorker.is_running()
            if cls._services["screener_financial_importer"]["status"] not in ("STOPPED", "PAUSED"):
                cls._services["screener_financial_importer"]["status"] = "RUNNING" if screener_running else "IDLE"
            elif screener_running:
                cls._services["screener_financial_importer"]["status"] = "RUNNING"
        except Exception:
            pass

        # 3. Early Stage News/Social Scanner
        try:
            from app.services.early_stage_scheduler import EarlyStageScheduler
            early_running = EarlyStageScheduler.is_running()
            if cls._services["early_stage_discovery"]["status"] not in ("STOPPED", "PAUSED"):
                cls._services["early_stage_discovery"]["status"] = "RUNNING" if early_running else "IDLE"
            elif early_running:
                cls._services["early_stage_discovery"]["status"] = "RUNNING"
        except Exception:
            pass

        # 4. Raw File Archiver
        try:
            from app.services.raw_file_archiver import RawFileArchiveService
            archiver_running = RawFileArchiveService.is_running()
            if cls._services["raw_file_archiver"]["status"] not in ("STOPPED", "PAUSED"):
                cls._services["raw_file_archiver"]["status"] = "RUNNING" if archiver_running else "IDLE"
            elif archiver_running:
                cls._services["raw_file_archiver"]["status"] = "RUNNING"
            arch_tel = RawFileArchiveService.get_telemetry()
            if arch_tel.get("last_run_time"):
                cls._services["raw_file_archiver"]["last_fetch_time"] = arch_tel["last_run_time"]
            cls._services["raw_file_archiver"]["records_ingested_today"] = arch_tel.get("total_files_archived", 0)
        except Exception:
            pass

        # 5. VCP Breakout Engine
        try:
            from app.services.vcp_scheduler import VCPScheduler
            from app.services.autonomous_scheduler import AutonomousEngineScheduler
            vcp_running = VCPScheduler.is_running() or AutonomousEngineScheduler.is_engine_enabled("vcp_engine")
            if cls._services["vcp_breakout_engine"]["status"] not in ("STOPPED", "PAUSED"):
                cls._services["vcp_breakout_engine"]["status"] = "RUNNING" if vcp_running else "IDLE"
            elif vcp_running:
                cls._services["vcp_breakout_engine"]["status"] = "RUNNING"
        except Exception:
            pass

        # 6. Master Autonomous Scheduler
        try:
            from app.services.autonomous_scheduler import AutonomousEngineScheduler
            master_running = AutonomousEngineScheduler.is_running()
            if cls._services["master_scheduler"]["status"] not in ("STOPPED", "PAUSED"):
                cls._services["master_scheduler"]["status"] = "RUNNING" if master_running else "IDLE"
            elif master_running:
                cls._services["master_scheduler"]["status"] = "RUNNING"
        except Exception:
            pass

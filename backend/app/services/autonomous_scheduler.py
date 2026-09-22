"""
Alpha India — Master Autonomous Engine Scheduler
Sprint 38.2 Enterprise Architecture

Provides an autonomous, resilient background orchestration engine that continuously executes:
1. Live Exchange Wire & Active Quote Price Refresher (Every 60s)
2. Exchange Results Discovery & Athena Omega 5-Gate PEAD Evaluator (Every 3m)
3. Minervini VCP Breakout & Volume Surge Engine (Every 5m)
4. Financial Importer & YoY Growth Calculation Engine (Every 15m)

Records telemetry and live heartbeats directly into ControlSystemService and database.
Zero manual intervention required.
"""

from datetime import datetime, timezone, timedelta
import logging
import threading
import time
from typing import Any, Dict, Optional

from app.db.database import SessionLocal
from app.services.control_system_service import ControlSystemService

logger = logging.getLogger("AutonomousEngineScheduler")


class AutonomousEngineScheduler:
    _lock = threading.RLock()
    _thread: Optional[threading.Thread] = None
    _stop_event = threading.Event()
    _is_running = False

    # Interval configuration (in seconds)
    INTERVAL_WIRE_PRICES = 60         # 1 min
    INTERVAL_DISCOVERY_ATHENA = 180   # 3 mins
    INTERVAL_VCP_SCAN = 300           # 5 mins
    INTERVAL_GROWTH_IMPORT = 900      # 15 mins

    # Execution telemetry state
    _engine_telemetry: Dict[str, Dict[str, Any]] = {
        "wire_prices": {
            "name": "Live Wire & CMP Refresher",
            "interval_sec": 60,
            "last_run": None,
            "next_run": None,
            "status": "IDLE",
            "runs_count": 0,
            "last_records": 0,
            "last_error": None,
        },
        "discovery_athena": {
            "name": "Results Discovery & Athena 5-Gate",
            "interval_sec": 180,
            "last_run": None,
            "next_run": None,
            "status": "IDLE",
            "runs_count": 0,
            "last_records": 0,
            "last_error": None,
        },
        "vcp_engine": {
            "name": "Minervini VCP Breakout Scanner",
            "interval_sec": 300,
            "last_run": None,
            "next_run": None,
            "status": "IDLE",
            "runs_count": 0,
            "last_records": 0,
            "last_error": None,
        },
        "growth_engine": {
            "name": "Financial Importer & Growth Engine",
            "interval_sec": 900,
            "last_run": None,
            "next_run": None,
            "status": "IDLE",
            "runs_count": 0,
            "last_records": 0,
            "last_error": None,
        },
    }

    @classmethod
    def is_running(cls) -> bool:
        with cls._lock:
            return cls._is_running and cls._thread is not None and cls._thread.is_alive()

    @classmethod
    def start(cls):
        with cls._lock:
            if cls.is_running():
                logger.info("[AutonomousEngineScheduler] Already running.")
                return

            cls._stop_event.clear()
            cls._is_running = True
            cls._thread = threading.Thread(
                target=cls._supervision_loop,
                daemon=True,
                name="AutonomousMasterSchedulerThread",
            )
            cls._thread.start()
            logger.info("[AutonomousEngineScheduler] Master Autonomous Scheduler successfully started.")

    @classmethod
    def stop(cls):
        with cls._lock:
            if not cls._is_running:
                return
            cls._is_running = False
            cls._stop_event.set()
            if cls._thread and cls._thread.is_alive():
                cls._thread.join(timeout=3.0)
            logger.info("[AutonomousEngineScheduler] Master Autonomous Scheduler stopped.")

    @classmethod
    def get_telemetry(cls) -> Dict[str, Any]:
        with cls._lock:
            return {
                "is_running": cls.is_running(),
                "server_time": datetime.now(timezone.utc).isoformat(),
                "engines": dict(cls._engine_telemetry),
            }

    @classmethod
    def _supervision_loop(cls):
        logger.info("[AutonomousEngineScheduler] Background supervision loop entered.")

        # Initialize schedules: execute immediate warmup cycles for wire and prices
        now = time.time()
        next_wire = now + 5               # 5s warmup
        next_discovery = now + 15         # 15s warmup
        next_vcp = now + 30               # 30s warmup
        next_growth = now + 60            # 60s warmup

        while not cls._stop_event.is_set():
            current_time = time.time()

            # -------------------------------------------------------------
            # Cycle 1: Live Exchange Wire & CMP Price Refresher
            # -------------------------------------------------------------
            if current_time >= next_wire:
                cls._execute_wire_prices_cycle()
                next_wire = time.time() + cls.INTERVAL_WIRE_PRICES
                cls._update_next_run("wire_prices", cls.INTERVAL_WIRE_PRICES)

            # -------------------------------------------------------------
            # Cycle 2: Results Discovery & Athena Omega 5-Gate Evaluator
            # -------------------------------------------------------------
            if current_time >= next_discovery:
                cls._execute_discovery_athena_cycle()
                next_discovery = time.time() + cls.INTERVAL_DISCOVERY_ATHENA
                cls._update_next_run("discovery_athena", cls.INTERVAL_DISCOVERY_ATHENA)

            # -------------------------------------------------------------
            # Cycle 3: Minervini VCP Breakout & Volume Surge Engine
            # -------------------------------------------------------------
            if current_time >= next_vcp:
                cls._execute_vcp_cycle()
                next_vcp = time.time() + cls.INTERVAL_VCP_SCAN
                cls._update_next_run("vcp_engine", cls.INTERVAL_VCP_SCAN)

            # -------------------------------------------------------------
            # Cycle 4: Financial Importer & Growth Calculation Engine
            # -------------------------------------------------------------
            if current_time >= next_growth:
                cls._execute_growth_cycle()
                next_growth = time.time() + cls.INTERVAL_GROWTH_IMPORT
                cls._update_next_run("growth_engine", cls.INTERVAL_GROWTH_IMPORT)

            # Sleep in 2-second increments for responsive teardown
            for _ in range(2):
                if cls._stop_event.is_set():
                    break
                time.sleep(1)

        logger.info("[AutonomousEngineScheduler] Supervision loop terminated.")

    @classmethod
    def _update_next_run(cls, engine_key: str, interval_sec: int):
        with cls._lock:
            e = cls._engine_telemetry.get(engine_key)
            if e:
                e["next_run"] = (datetime.now(timezone.utc) + timedelta(seconds=interval_sec)).isoformat()

    @classmethod
    def _execute_wire_prices_cycle(cls):
        key = "wire_prices"
        cls._set_engine_status(key, "RUNNING")
        t0 = time.perf_counter()
        records_count = 0
        error_msg = None

        db = SessionLocal()
        try:
            # 1. Live Exchange Wire batch
            from app.services.live_exchange_wire_worker import LiveExchangeWireWorker
            wire_res = LiveExchangeWireWorker.poll_next_batch(db)
            records_count += wire_res.get("catalysts", 0)

            # 2. Batch refresh CMP for active opportunity universe
            from app.services.live_price_service import LivePriceService
            price_res = LivePriceService.refresh_active_universe_prices(db, limit=35)
            records_count += price_res.get("refreshed_count", 0)

            # 3. Autonomous Material Catalyst Alert Dispatch
            try:
                from app.services.opportunity_alert_service import OpportunityAlertService
                cat_alerts = OpportunityAlertService.scan_catalyst_radar_alerts(db)
                if cat_alerts:
                    logger.info(f"[AutonomousEngineScheduler] Dispatched {len(cat_alerts)} material catalyst alerts.")
            except Exception as cat_err:
                logger.warning(f"[AutonomousEngineScheduler] Catalyst alert check notice: {cat_err}")

            ControlSystemService.record_service_fetch(
                service_id="exchange_live_wire",
                records_count=records_count,
                status="SUCCESS",
                duration_ms=(time.perf_counter() - t0) * 1000.0,
            )
        except Exception as exc:
            error_msg = str(exc)
            logger.error(f"[AutonomousEngineScheduler] Wire & Prices cycle error: {exc}", exc_info=True)
            ControlSystemService.record_service_fetch(
                service_id="exchange_live_wire",
                records_count=0,
                status="ERROR",
                error_msg=error_msg,
                duration_ms=(time.perf_counter() - t0) * 1000.0,
            )
        finally:
            db.close()

        cls._record_engine_finish(key, records_count, error_msg)

    @classmethod
    def _execute_discovery_athena_cycle(cls):
        key = "discovery_athena"
        cls._set_engine_status(key, "RUNNING")
        t0 = time.perf_counter()
        records_count = 0
        error_msg = None

        db = SessionLocal()
        try:
            # 1. Discovery live market announcements
            from app.services.discovery_worker import DiscoveryWorker
            disc_res = DiscoveryWorker.discover_live_market(db)
            disc_records = disc_res.get("new_entries_discovered", 0) if isinstance(disc_res, dict) else 0
            records_count += disc_records

            # 2. Athena Omega 5-Gate evaluation of disclosures
            from app.services.athena_exchange_watcher import AthenaExchangeWatcher
            athena_res = AthenaExchangeWatcher.scan_recent_exchange_results(db=db)
            records_count += len(athena_res) if isinstance(athena_res, list) else 0

            # 3. Autonomous Athena PEAD / Flash Alert Dispatch
            try:
                from app.services.opportunity_alert_service import OpportunityAlertService
                athena_alerts = OpportunityAlertService.scan_athena_pead_alerts(db)
                if athena_alerts:
                    logger.info(f"[AutonomousEngineScheduler] Dispatched {len(athena_alerts)} Athena PEAD flash alerts.")
            except Exception as pead_err:
                logger.warning(f"[AutonomousEngineScheduler] Athena alert check notice: {pead_err}")

            ControlSystemService.record_service_fetch(
                service_id="athena_omega_watcher",
                records_count=records_count,
                status="SUCCESS",
                duration_ms=(time.perf_counter() - t0) * 1000.0,
            )
        except Exception as exc:
            error_msg = str(exc)
            logger.error(f"[AutonomousEngineScheduler] Discovery & Athena cycle error: {exc}", exc_info=True)
            ControlSystemService.record_service_fetch(
                service_id="athena_omega_watcher",
                records_count=0,
                status="ERROR",
                error_msg=error_msg,
                duration_ms=(time.perf_counter() - t0) * 1000.0,
            )
        finally:
            db.close()

        cls._record_engine_finish(key, records_count, error_msg)

    @classmethod
    def _execute_vcp_cycle(cls):
        key = "vcp_engine"
        cls._set_engine_status(key, "RUNNING")
        t0 = time.perf_counter()
        records_count = 0
        error_msg = None

        db = SessionLocal()
        try:
            from app.services.vcp_engine_service import VCPEngineService
            scan_res = VCPEngineService.run_discovery_scan(
                db, limit_candidates=100, filter_mode="TODAY_BREAKOUT", persist=True
            )
            records_count = scan_res.get("candidates_count", 0) if isinstance(scan_res, dict) else 0

            # 2. Pre-warm Intraday Tomorrow Deep Dive cache for instantaneous user loading
            try:
                from app.services.intraday_opportunity_service import IntradayOpportunityService
                IntradayOpportunityService.get_deep_dive_opportunities(db=db, force_refresh=True)
            except Exception as intra_err:
                logger.warning(f"[AutonomousEngineScheduler] Intraday radar pre-warm failed: {intra_err}")

            # 3. Master Autonomous Opportunity Radar Dispatch (VCP, Pre-Breakout, Momentum, Tomorrow Radar)
            try:
                from app.services.opportunity_alert_service import OpportunityAlertService
                alert_res = OpportunityAlertService.scan_and_dispatch_opportunity_alerts(db, force_scan=False)
                new_count = alert_res.get("new_alerts_count", 0)
                if new_count > 0:
                    logger.info(f"[AutonomousEngineScheduler] Dispatched {new_count} high-conviction opportunity alerts to Telegram.")
            except Exception as alert_err:
                logger.warning(f"[AutonomousEngineScheduler] Opportunity alert dispatch notice: {alert_err}")

            ControlSystemService.log_action(
                service_id="vcp_engine",
                service_name="VCP Breakout Scanner",
                level="SUCCESS",
                action="SCAN_COMPLETE",
                message=f"Autonomous VCP scan detected {records_count} qualifying candidates.",
                duration_ms=(time.perf_counter() - t0) * 1000.0,
                records_count=records_count,
            )
        except Exception as exc:
            error_msg = str(exc)
            logger.error(f"[AutonomousEngineScheduler] VCP scan cycle error: {exc}", exc_info=True)
            ControlSystemService.log_action(
                service_id="vcp_engine",
                service_name="VCP Breakout Scanner",
                level="ERROR",
                action="SCAN_ERROR",
                message=f"VCP scan cycle error: {error_msg}",
                duration_ms=(time.perf_counter() - t0) * 1000.0,
            )
        finally:
            db.close()

        cls._record_engine_finish(key, records_count, error_msg)

    @classmethod
    def _execute_growth_cycle(cls):
        key = "growth_engine"
        cls._set_engine_status(key, "RUNNING")
        t0 = time.perf_counter()
        records_count = 0
        error_msg = None

        db = SessionLocal()
        try:
            # 1. Financial statements import cycle
            from app.workers.screener_import_worker import ScreenerImportWorker
            import_res = ScreenerImportWorker.run_import_cycle(db, batch_size=10)
            if isinstance(import_res, dict):
                records_count += import_res.get("imported_count", 0)

            # 2. Growth metrics calculation
            from app.services.growth_calculator_service import GrowthCalculatorService
            calc_res = GrowthCalculatorService.calculate_all_companies(db, batch_size=20)
            if isinstance(calc_res, dict):
                records_count += calc_res.get("calculated_count", 0)

            ControlSystemService.record_service_fetch(
                service_id="screener_financial_importer",
                records_count=records_count,
                status="SUCCESS",
                duration_ms=(time.perf_counter() - t0) * 1000.0,
            )
        except Exception as exc:
            error_msg = str(exc)
            logger.error(f"[AutonomousEngineScheduler] Growth cycle error: {exc}", exc_info=True)
            ControlSystemService.record_service_fetch(
                service_id="screener_financial_importer",
                records_count=0,
                status="ERROR",
                error_msg=error_msg,
                duration_ms=(time.perf_counter() - t0) * 1000.0,
            )
        finally:
            db.close()

        cls._record_engine_finish(key, records_count, error_msg)

    @classmethod
    def _set_engine_status(cls, key: str, status: str):
        with cls._lock:
            e = cls._engine_telemetry.get(key)
            if e:
                e["status"] = status

    @classmethod
    def _record_engine_finish(cls, key: str, records: int, error: Optional[str]):
        with cls._lock:
            e = cls._engine_telemetry.get(key)
            if e:
                e["status"] = "ERROR" if error else "IDLE"
                e["last_run"] = datetime.now(timezone.utc).isoformat()
                e["runs_count"] += 1
                e["last_records"] = records
                e["last_error"] = error

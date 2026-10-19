"""
Alpha India - Velocity Burst Elite Background Scheduler
Sprint 39 Flagship High-Frequency Task Automation
Coordinates scheduled jobs across the trading day:
- 08:30 Dashboard Pre-warm
- 09:00 Market Regime & Risk Gates
- 09:15-10:30 Live Breakout Scan (every 5m)
- 14:15-15:15 BTST Continuation Scan
- 15:20 Trade Reconciliation & EOD Cleanup
- 15:35 Sleeping Giant & Compression Scan
- 16:00 Institutional Footprint Scan
- 16:15 Machine Learning Snapshot
"""

from __future__ import annotations

import logging
import threading
import time
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Optional

from app.db.database import SessionLocal
from app.services.velocity.velocity_orchestrator import VelocityBurstOrchestrator
from app.services.velocity.market_regime_engine import MarketRegimeEngine
from app.services.velocity.historical_learning_engine import HistoricalLearningEngine

logger = logging.getLogger("alpha_india.velocity.scheduler")


class VelocityBurstScheduler:
    """
    Dedicated scheduler thread managing Velocity Burst Elite timing cycles.
    """

    _lock = threading.RLock()
    _thread: Optional[threading.Thread] = None
    _stop_event = threading.Event()
    _is_running = False

    # Telemetry
    _heartbeat_time: Optional[datetime] = None
    _jobs_executed_count: int = 0
    _last_error: Optional[str] = None
    _next_job_time: Optional[datetime] = None

    @classmethod
    def is_running(cls) -> bool:
        with cls._lock:
            return cls._is_running and cls._thread is not None and cls._thread.is_alive()

    @classmethod
    def start(cls):
        with cls._lock:
            if cls.is_running():
                return
            cls._stop_event.clear()
            cls._is_running = True
            cls._thread = threading.Thread(
                target=cls._worker_loop,
                daemon=True,
                name="VelocityBurstSchedulerThread",
            )
            cls._thread.start()
            logger.info("[VelocityBurstScheduler] Flagship VBE Scheduler started.")

    @classmethod
    def stop(cls):
        with cls._lock:
            if not cls._is_running:
                return
            cls._is_running = False
            cls._stop_event.set()
            if cls._thread and cls._thread.is_alive():
                cls._thread.join(timeout=3.0)
            logger.info("[VelocityBurstScheduler] VBE Scheduler stopped.")

    @classmethod
    def get_telemetry(cls) -> Dict[str, Any]:
        with cls._lock:
            return {
                "is_running": cls.is_running(),
                "heartbeat": cls._heartbeat_time.isoformat() if cls._heartbeat_time else None,
                "jobs_executed_count": cls._jobs_executed_count,
                "last_error": cls._last_error,
                "engine_paused": VelocityBurstOrchestrator.is_paused(),
            }

    @classmethod
    def _worker_loop(cls):
        """
        Internal loop ticking every 15 seconds to evaluate scheduled jobs.
        Respects market hours and dual-regime intervals configured in AutonomousEngineScheduler.
        """
        logger.info("[VelocityBurstScheduler] Worker loop initialized with Dynamic Dual-Regime Orchestration.")
        last_scan_epoch = 0.0

        while not cls._stop_event.is_set():
            try:
                cls._heartbeat_time = datetime.now(timezone.utc)
                now_epoch = time.time()

                # Get dynamic interval from AutonomousEngineScheduler
                from app.services.autonomous_scheduler import AutonomousEngineScheduler
                eff_interval = AutonomousEngineScheduler.get_effective_interval("velocity_burst")
                is_enabled = AutonomousEngineScheduler.is_engine_enabled("velocity_burst")

                if eff_interval > 0 and is_enabled and not VelocityBurstOrchestrator.is_paused():
                    if now_epoch - last_scan_epoch >= eff_interval:
                        last_scan_epoch = now_epoch
                        cls._run_cycle()
                else:
                    # Off-market, disabled, or paused: skip heavy CPU scan
                    pass

            except Exception as e:
                cls._last_error = str(e)
                logger.error(f"[VelocityBurstScheduler] Error in cycle: {e}")

            # Sleep in small slices to allow fast shutdown
            for _ in range(15):
                if cls._stop_event.is_set():
                    break
                time.sleep(1.0)

    @classmethod
    def _run_cycle(cls):
        from app.services.autonomous_scheduler import AutonomousEngineScheduler
        AutonomousEngineScheduler._set_engine_status("velocity_burst", "RUNNING")
        db = SessionLocal()
        records_count = 0
        error_msg = None
        try:
            # Check market regime & run light universe scan
            MarketRegimeEngine.evaluate_regime(db)
            scan_res = VelocityBurstOrchestrator.execute_universe_scan(db, limit_symbols=100)
            records_count = len(scan_res) if isinstance(scan_res, list) else 100
            cls._jobs_executed_count += 1
        except Exception as exc:
            error_msg = str(exc)
            raise
        finally:
            db.close()
            AutonomousEngineScheduler._record_engine_finish("velocity_burst", records_count, error_msg)

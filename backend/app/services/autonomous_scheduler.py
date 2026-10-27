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

import copy
from datetime import datetime, timezone, timedelta
import json
import logging
import threading
import time
from typing import Any, Dict, Optional

from app.db.database import SessionLocal
from app.services.control_system_service import ControlSystemService

logger = logging.getLogger("AutonomousEngineScheduler")

IST = timezone(timedelta(hours=5, minutes=30))


class AutonomousEngineScheduler:
    _lock = threading.RLock()
    _thread: Optional[threading.Thread] = None
    _stop_event = threading.Event()
    _is_running = False

    SETTING_KEY_SCHEDULES = "autonomous_scheduler_engine_schedules"

    # Default Dual-Regime Interval Configurations
    DEFAULT_ENGINE_SCHEDULES: Dict[str, Dict[str, Any]] = {
        "wire_prices": {
            "name": "Live Wire & CMP Refresher",
            "market_interval_sec": 60,
            "off_market_interval_sec": 300,
            "market_hours_only": False,
            "is_enabled": True,
            "min_interval_sec": 30,
        },
        "discovery_athena": {
            "name": "Results Discovery & Athena 5-Gate",
            "market_interval_sec": 180,
            "off_market_interval_sec": 600,
            "market_hours_only": False,
            "is_enabled": True,
            "min_interval_sec": 60,
        },
        "vcp_engine": {
            "name": "Minervini VCP Breakout Scanner",
            "market_interval_sec": 300,
            "off_market_interval_sec": 0,
            "market_hours_only": True,
            "is_enabled": True,
            "min_interval_sec": 120,
        },
        "growth_engine": {
            "name": "Financial Importer & Growth Engine",
            "market_interval_sec": 900,
            "off_market_interval_sec": 1800,
            "market_hours_only": False,
            "is_enabled": True,
            "min_interval_sec": 300,
        },
        "cpr_engine": {
            "name": "CPR Compression & Alert Engine",
            "market_interval_sec": 300,
            "off_market_interval_sec": 0,
            "market_hours_only": True,
            "is_enabled": True,
            "min_interval_sec": 120,
        },
        "mf_radar": {
            "name": "Mutual Fund & Institutional Radar",
            "market_interval_sec": 1800,
            "off_market_interval_sec": 3600,
            "market_hours_only": False,
            "is_enabled": True,
            "min_interval_sec": 600,
        },
        "momentum_universe": {
            "name": "Momentum Universe Off-Market Scanner",
            "market_interval_sec": 0,
            "off_market_interval_sec": 3600,
            "market_hours_only": False,
            "is_enabled": True,
            "min_interval_sec": 1800,
        },
        "momentum_intraday": {
            "name": "Momentum Intraday Breakout Monitor",
            "market_interval_sec": 60,
            "off_market_interval_sec": 0,
            "market_hours_only": True,
            "is_enabled": True,
            "min_interval_sec": 30,
        },
        "telegram_auto_alerts": {
            "name": "Auto Telegram Opportunity & Radar",
            "market_interval_sec": 120,
            "off_market_interval_sec": 0,
            "market_hours_only": True,
            "is_enabled": True,
            "min_interval_sec": 60,
        },
        "investor_intelligence": {
            "name": "Investor Concall & Presentation Forensics",
            "market_interval_sec": 600,
            "off_market_interval_sec": 1800,
            "market_hours_only": False,
            "is_enabled": True,
            "min_interval_sec": 300,
        },
        "market_breadth": {
            "name": "Market Breadth Radar & Bhavcopy",
            "market_interval_sec": 1800,
            "off_market_interval_sec": 3600,
            "market_hours_only": False,
            "is_enabled": True,
            "min_interval_sec": 900,
        },
        "velocity_burst": {
            "name": "Velocity Burst Elite Scanner",
            "market_interval_sec": 300,
            "off_market_interval_sec": 0,
            "market_hours_only": True,
            "is_enabled": True,
            "min_interval_sec": 120,
        },
    }

    # One-Click Performance & Scheduling Presets
    PRESETS: Dict[str, Dict[str, Any]] = {
        "PERFORMANCE_SAVER": {
            "name": "Performance Saver",
            "description": "Ultra CPU Saver: Real-time scanners pause completely off-market; relaxed cadences during market hours. Max EC2 responsiveness.",
            "schedules": {
                "wire_prices": {"market_interval_sec": 120, "off_market_interval_sec": 0, "is_enabled": True},
                "discovery_athena": {"market_interval_sec": 300, "off_market_interval_sec": 900, "is_enabled": True},
                "vcp_engine": {"market_interval_sec": 600, "off_market_interval_sec": 0, "is_enabled": True},
                "growth_engine": {"market_interval_sec": 1800, "off_market_interval_sec": 3600, "is_enabled": True},
                "cpr_engine": {"market_interval_sec": 600, "off_market_interval_sec": 0, "is_enabled": True},
                "mf_radar": {"market_interval_sec": 3600, "off_market_interval_sec": 7200, "is_enabled": True},
                "momentum_universe": {"market_interval_sec": 0, "off_market_interval_sec": 7200, "is_enabled": True},
                "momentum_intraday": {"market_interval_sec": 120, "off_market_interval_sec": 0, "is_enabled": True},
                "telegram_auto_alerts": {"market_interval_sec": 300, "off_market_interval_sec": 0, "is_enabled": True},
                "investor_intelligence": {"market_interval_sec": 1200, "off_market_interval_sec": 3600, "is_enabled": True},
                "market_breadth": {"market_interval_sec": 3600, "off_market_interval_sec": 7200, "is_enabled": True},
                "velocity_burst": {"market_interval_sec": 600, "off_market_interval_sec": 0, "is_enabled": True},
            },
        },
        "BALANCED": {
            "name": "Balanced Enterprise",
            "description": "Standard Institutional: Rapid market intraday scans with automated quiet off-market conservation.",
            "schedules": {
                "wire_prices": {"market_interval_sec": 60, "off_market_interval_sec": 0, "is_enabled": True},
                "discovery_athena": {"market_interval_sec": 180, "off_market_interval_sec": 600, "is_enabled": True},
                "vcp_engine": {"market_interval_sec": 300, "off_market_interval_sec": 0, "is_enabled": True},
                "growth_engine": {"market_interval_sec": 900, "off_market_interval_sec": 1800, "is_enabled": True},
                "cpr_engine": {"market_interval_sec": 300, "off_market_interval_sec": 0, "is_enabled": True},
                "mf_radar": {"market_interval_sec": 1800, "off_market_interval_sec": 3600, "is_enabled": True},
                "momentum_universe": {"market_interval_sec": 0, "off_market_interval_sec": 3600, "is_enabled": True},
                "momentum_intraday": {"market_interval_sec": 60, "off_market_interval_sec": 0, "is_enabled": True},
                "telegram_auto_alerts": {"market_interval_sec": 120, "off_market_interval_sec": 0, "is_enabled": True},
                "investor_intelligence": {"market_interval_sec": 600, "off_market_interval_sec": 1800, "is_enabled": True},
                "market_breadth": {"market_interval_sec": 1800, "off_market_interval_sec": 3600, "is_enabled": True},
                "velocity_burst": {"market_interval_sec": 300, "off_market_interval_sec": 0, "is_enabled": True},
            },
        },
        "TURBO": {
            "name": "Turbo Ultra-Fast",
            "description": "High Frequency Turbo: Maximum speed and minimum latency intraday scanning. Ideal during earnings weeks.",
            "schedules": {
                "wire_prices": {"market_interval_sec": 30, "off_market_interval_sec": 0, "is_enabled": True},
                "discovery_athena": {"market_interval_sec": 120, "off_market_interval_sec": 300, "is_enabled": True},
                "vcp_engine": {"market_interval_sec": 180, "off_market_interval_sec": 0, "is_enabled": True},
                "growth_engine": {"market_interval_sec": 600, "off_market_interval_sec": 1200, "is_enabled": True},
                "cpr_engine": {"market_interval_sec": 180, "off_market_interval_sec": 0, "is_enabled": True},
                "mf_radar": {"market_interval_sec": 1200, "off_market_interval_sec": 1800, "is_enabled": True},
                "momentum_universe": {"market_interval_sec": 0, "off_market_interval_sec": 1800, "is_enabled": True},
                "momentum_intraday": {"market_interval_sec": 30, "off_market_interval_sec": 0, "is_enabled": True},
                "telegram_auto_alerts": {"market_interval_sec": 60, "off_market_interval_sec": 0, "is_enabled": True},
                "investor_intelligence": {"market_interval_sec": 300, "off_market_interval_sec": 900, "is_enabled": True},
                "market_breadth": {"market_interval_sec": 1200, "off_market_interval_sec": 1800, "is_enabled": True},
                "velocity_burst": {"market_interval_sec": 180, "off_market_interval_sec": 0, "is_enabled": True},
            },
        },
    }

    _engine_schedules: Dict[str, Dict[str, Any]] = copy.deepcopy(DEFAULT_ENGINE_SCHEDULES)
    _active_preset: str = "BALANCED"

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
        "cpr_engine": {
            "name": "CPR Compression & Alert Engine",
            "interval_sec": 300,
            "last_run": None,
            "next_run": None,
            "status": "IDLE",
            "runs_count": 0,
            "last_records": 0,
            "last_error": None,
        },
        "mf_radar": {
            "name": "Mutual Fund & Institutional Radar Engine",
            "interval_sec": 1800,
            "last_run": None,
            "next_run": None,
            "status": "IDLE",
            "runs_count": 0,
            "last_records": 0,
            "last_error": None,
        },
        "momentum_universe": {
            "name": "Momentum Universe Off-Market Scanner",
            "interval_sec": 3600,
            "last_run": None,
            "next_run": None,
            "status": "IDLE",
            "runs_count": 0,
            "last_records": 0,
            "last_error": None,
        },
        "momentum_intraday": {
            "name": "Momentum Intraday Breakout Monitor",
            "interval_sec": 60,
            "last_run": None,
            "next_run": None,
            "status": "IDLE",
            "runs_count": 0,
            "last_records": 0,
            "last_error": None,
        },
        "telegram_auto_alerts": {
            "name": "Auto Telegram Opportunity & Apex Radar",
            "interval_sec": 120,
            "last_run": None,
            "next_run": None,
            "status": "IDLE",
            "runs_count": 0,
            "last_records": 0,
            "last_error": None,
        },
        "investor_intelligence": {
            "name": "Investor Concall & Presentation Forensics",
            "interval_sec": 600,
            "last_run": None,
            "next_run": None,
            "status": "IDLE",
            "runs_count": 0,
            "last_records": 0,
            "last_error": None,
        },
        "market_breadth": {
            "name": "Market Breadth Radar & Bhavcopy Maintenance",
            "interval_sec": 1800,
            "last_run": None,
            "next_run": None,
            "status": "IDLE",
            "runs_count": 0,
            "last_records": 0,
            "last_error": None,
        },
        "velocity_burst": {
            "name": "Velocity Burst Elite Scanner",
            "interval_sec": 300,
            "last_run": None,
            "next_run": None,
            "status": "IDLE",
            "runs_count": 0,
            "last_records": 0,
            "last_error": None,
        },
    }

    _disabled_engines: set = set()

    @classmethod
    def is_market_hours(cls) -> bool:
        """Returns True if current IST time is within NSE trading hours (Mon–Fri, 09:15–15:30)."""
        now_ist = datetime.now(IST)
        if now_ist.weekday() >= 5:  # Saturday=5, Sunday=6
            return False
        market_open = now_ist.replace(hour=9, minute=15, second=0, microsecond=0)
        market_close = now_ist.replace(hour=15, minute=30, second=0, microsecond=0)
        return market_open <= now_ist <= market_close

    @classmethod
    def get_market_status(cls) -> Dict[str, Any]:
        now_ist = datetime.now(IST)
        in_mkt = cls.is_market_hours()
        return {
            "is_market_hours": in_mkt,
            "ist_time": now_ist.strftime("%Y-%m-%d %H:%M:%S IST"),
            "weekday": now_ist.strftime("%A"),
            "active_preset": cls._active_preset,
        }

    @classmethod
    def get_effective_interval(cls, engine_key: str) -> int:
        """
        Returns effective interval in seconds based on current market hours vs off-market.
        Returns 0 if the engine should be paused/skipped in the current regime.
        """
        with cls._lock:
            sched = cls._engine_schedules.get(engine_key)
            if not sched or not sched.get("is_enabled", True) or engine_key in cls._disabled_engines:
                return 0
            in_mkt = cls.is_market_hours()
            if in_mkt:
                return int(sched.get("market_interval_sec", 60))
            else:
                if sched.get("market_hours_only", False):
                    return 0
                return int(sched.get("off_market_interval_sec", 0))

    @classmethod
    def _load_schedules_from_db(cls):
        db = SessionLocal()
        try:
            from app.models.system_setting import SystemSetting
            setting = db.query(SystemSetting).filter(SystemSetting.setting_key == cls.SETTING_KEY_SCHEDULES).first()
            if setting and setting.setting_value:
                data = json.loads(setting.setting_value)
                cls._active_preset = data.get("active_preset", "BALANCED")
                saved_schedules = data.get("schedules", {})
                for key, sched in saved_schedules.items():
                    if key in cls._engine_schedules:
                        cls._engine_schedules[key].update(sched)
                        if not sched.get("is_enabled", True):
                            cls._disabled_engines.add(key)
                        else:
                            cls._disabled_engines.discard(key)
                logger.info(f"[AutonomousEngineScheduler] Loaded schedule configs from DB (preset: {cls._active_preset}).")
        except Exception as exc:
            logger.warning(f"[AutonomousEngineScheduler] Could not load schedules from DB: {exc}")
        finally:
            db.close()

    @classmethod
    def _save_schedules_to_db(cls):
        db = SessionLocal()
        try:
            from app.models.system_setting import SystemSetting
            setting = db.query(SystemSetting).filter(SystemSetting.setting_key == cls.SETTING_KEY_SCHEDULES).first()
            payload = json.dumps({
                "active_preset": cls._active_preset,
                "schedules": cls._engine_schedules,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            })
            if not setting:
                setting = SystemSetting(
                    setting_key=cls.SETTING_KEY_SCHEDULES,
                    setting_value=payload,
                    setting_type="json",
                    description="Autonomous scheduler dual-regime interval and pause configuration",
                )
                db.add(setting)
            else:
                setting.setting_value = payload
                setting.updated_at = datetime.now(timezone.utc)
            db.commit()
            logger.info(f"[AutonomousEngineScheduler] Saved schedule configs to DB (preset: {cls._active_preset}).")
        except Exception as exc:
            db.rollback()
            logger.error(f"[AutonomousEngineScheduler] Failed to save schedules to DB: {exc}")
        finally:
            db.close()

    @classmethod
    def get_schedule_configs(cls) -> Dict[str, Any]:
        with cls._lock:
            now_ist = datetime.now(IST)
            in_mkt = cls.is_market_hours()
            schedules_list = []
            for key, sched in cls._engine_schedules.items():
                eff = cls.get_effective_interval(key)
                telemetry = cls._engine_telemetry.get(key, {})
                schedules_list.append({
                    "engine_key": key,
                    "name": sched.get("name", key),
                    "market_interval_sec": sched.get("market_interval_sec", 60),
                    "off_market_interval_sec": sched.get("off_market_interval_sec", 0),
                    "market_hours_only": sched.get("market_hours_only", False),
                    "is_enabled": sched.get("is_enabled", True) and key not in cls._disabled_engines,
                    "min_interval_sec": sched.get("min_interval_sec", 30),
                    "effective_interval_sec": eff,
                    "is_active_now": eff > 0 and sched.get("is_enabled", True),
                    "status": telemetry.get("status", "IDLE"),
                    "last_run": telemetry.get("last_run"),
                    "next_run": telemetry.get("next_run"),
                    "runs_count": telemetry.get("runs_count", 0),
                })
            return {
                "is_market_hours": in_mkt,
                "server_time_ist": now_ist.strftime("%Y-%m-%d %H:%M:%S IST"),
                "weekday": now_ist.strftime("%A"),
                "active_preset": cls._active_preset,
                "presets_available": [
                    {"id": k, "name": v["name"], "description": v["description"]}
                    for k, v in cls.PRESETS.items()
                ],
                "schedules": schedules_list,
            }

    @classmethod
    def update_schedule_config(cls, engine_key: str, patch: Dict[str, Any]) -> Dict[str, Any]:
        with cls._lock:
            if engine_key not in cls._engine_schedules:
                raise ValueError(f"Unknown engine key: {engine_key}")
            sched = cls._engine_schedules[engine_key]
            min_sec = sched.get("min_interval_sec", 30)

            if "market_interval_sec" in patch:
                val = int(patch["market_interval_sec"])
                sched["market_interval_sec"] = max(min_sec, val) if val > 0 else 0
            if "off_market_interval_sec" in patch:
                val = int(patch["off_market_interval_sec"])
                sched["off_market_interval_sec"] = max(min_sec, val) if val > 0 else 0
            if "market_hours_only" in patch:
                sched["market_hours_only"] = bool(patch["market_hours_only"])
            if "is_enabled" in patch:
                enabled = bool(patch["is_enabled"])
                sched["is_enabled"] = enabled
                if not enabled:
                    cls.disable_engine(engine_key)
                else:
                    cls.enable_engine(engine_key)

            cls._active_preset = "CUSTOM"
            cls._save_schedules_to_db()
            logger.info(f"[AutonomousEngineScheduler] Updated schedule for '{engine_key}': {sched}")
            return cls.get_schedule_configs()

    @classmethod
    def apply_preset(cls, preset_name: str) -> Dict[str, Any]:
        with cls._lock:
            preset_name = preset_name.upper()
            if preset_name not in cls.PRESETS:
                raise ValueError(f"Unknown preset: {preset_name}. Available: {list(cls.PRESETS.keys())}")

            preset = cls.PRESETS[preset_name]
            for key, p_sched in preset["schedules"].items():
                if key in cls._engine_schedules:
                    cls._engine_schedules[key].update(p_sched)
                    if not p_sched.get("is_enabled", True):
                        cls.disable_engine(key)
                    else:
                        cls.enable_engine(key)

            cls._active_preset = preset_name
            cls._save_schedules_to_db()
            logger.info(f"[AutonomousEngineScheduler] Applied preset '{preset_name}' successfully.")
            return cls.get_schedule_configs()

    @classmethod
    def is_running(cls) -> bool:
        with cls._lock:
            return cls._is_running and cls._thread is not None and cls._thread.is_alive()

    @classmethod
    def is_engine_enabled(cls, engine_key: str) -> bool:
        with cls._lock:
            return engine_key not in cls._disabled_engines and cls._engine_schedules.get(engine_key, {}).get("is_enabled", True)

    @classmethod
    def enable_engine(cls, engine_key: str):
        with cls._lock:
            cls._disabled_engines.discard(engine_key)
            if engine_key in cls._engine_schedules:
                cls._engine_schedules[engine_key]["is_enabled"] = True
            if engine_key in cls._engine_telemetry:
                cls._engine_telemetry[engine_key]["status"] = "IDLE"
            logger.info(f"[AutonomousEngineScheduler] Engine '{engine_key}' enabled.")

    @classmethod
    def disable_engine(cls, engine_key: str):
        with cls._lock:
            cls._disabled_engines.add(engine_key)
            if engine_key in cls._engine_schedules:
                cls._engine_schedules[engine_key]["is_enabled"] = False
            if engine_key in cls._engine_telemetry:
                cls._engine_telemetry[engine_key]["status"] = "STOPPED"
            logger.info(f"[AutonomousEngineScheduler] Engine '{engine_key}' disabled.")

    @classmethod
    def start(cls):
        with cls._lock:
            if cls.is_running():
                logger.info("[AutonomousEngineScheduler] Already running.")
                return

            cls._load_schedules_from_db()
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
        logger.info("[AutonomousEngineScheduler] Background supervision loop entered with Dynamic Dual-Regime Orchestration.")

        # Warmup initialization
        now = time.time()
        next_times: Dict[str, float] = {
            "wire_prices": now + 5,
            "discovery_athena": now + 15,
            "vcp_engine": now + 30,
            "cpr_engine": now + 45,
            "growth_engine": now + 60,
            "mf_radar": now + 75,
            "momentum_universe": now + 90,
            "momentum_intraday": now + 45,
            "telegram_auto_alerts": now + 15,
            "investor_intelligence": now + 80,
            "market_breadth": now + 100,
        }

        cycle_handlers = {
            "wire_prices": cls._execute_wire_prices_cycle,
            "discovery_athena": cls._execute_discovery_athena_cycle,
            "vcp_engine": cls._execute_vcp_cycle,
            "cpr_engine": cls._execute_cpr_cycle,
            "growth_engine": cls._execute_growth_cycle,
            "mf_radar": cls._execute_mf_radar_cycle,
            "momentum_universe": cls._execute_momentum_universe_cycle,
            "momentum_intraday": cls._execute_momentum_intraday_cycle,
            "telegram_auto_alerts": cls._execute_telegram_alerts_cycle,
            "investor_intelligence": cls._execute_investor_intelligence_cycle,
            "market_breadth": cls._execute_market_breadth_cycle,
        }

        while not cls._stop_event.is_set():
            current_time = time.time()

            for key, handler in cycle_handlers.items():
                if cls._stop_event.is_set():
                    break

                eff_interval = cls.get_effective_interval(key)
                if eff_interval > 0 and cls.is_engine_enabled(key):
                    # Clamp next run if interval was shortened dynamically by operator
                    if next_times[key] - current_time > eff_interval:
                        next_times[key] = current_time + min(5, eff_interval)

                    if current_time >= next_times[key]:
                        try:
                            handler()
                        except Exception as cycle_err:
                            logger.error(f"[AutonomousEngineScheduler] Uncaught error in engine '{key}': {cycle_err}", exc_info=True)
                        next_times[key] = time.time() + eff_interval
                        cls._update_next_run(key, eff_interval)
                else:
                    # Engine is off-market, paused, or disabled.
                    # Preserves CPU: zero heavy queries or external fetches executed.
                    if current_time >= next_times[key]:
                        next_times[key] = time.time() + 30
                        cls._update_next_run(key, 30)

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

            # 4. Breakout Execution Engine Autonomous Live Watcher
            try:
                from app.services.breakout_execution_service import BreakoutExecutionService
                breakout_res = BreakoutExecutionService.evaluate_watched_candidates(db)
                if breakout_res and breakout_res.get("evaluated_count", 0) > 0:
                    records_count += breakout_res.get("evaluated_count", 0)
                    if breakout_res.get("newly_triggered"):
                        logger.info(f"[AutonomousEngineScheduler] BREAKOUT TRIGGERED for: {breakout_res.get('newly_triggered')}")
            except Exception as b_err:
                logger.debug(f"[AutonomousEngineScheduler] Breakout execution notice: {b_err}")

            # 5. Sovereign Intraday Cockpit Live Feed & Triggers Monitor
            try:
                from app.services.sovereign_intraday_service import SovereignIntradayService
                sov_res = SovereignIntradayService.get_live_radar(db=db)
                if sov_res:
                    records_count += sov_res.get("summary_stats", {}).get("total_active_candidates", 0)
            except Exception as sov_err:
                logger.debug(f"[AutonomousEngineScheduler] Sovereign intraday cycle notice: {sov_err}")

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

            # 4. Scheduled Earnings Calendar Sync (Every 30 mins)
            now_ts = time.time()
            if not hasattr(cls, "_last_calendar_sync") or (now_ts - getattr(cls, "_last_calendar_sync", 0)) > 1800:
                try:
                    from app.services.earnings_calendar_service import EarningsCalendarService
                    cal_res = EarningsCalendarService.sync_nse_calendar(db)
                    cls._last_calendar_sync = now_ts
                    logger.info(f"[AutonomousEngineScheduler] Synced official NSE Earnings Calendar: {cal_res}")
                except Exception as cal_err:
                    logger.warning(f"[AutonomousEngineScheduler] Earnings Calendar sync notice: {cal_err}")

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
                db, limit_candidates=300, filter_mode="TODAY_BREAKOUT", persist=True
            )
            records_count = scan_res.get("candidates_count", 0) if isinstance(scan_res, dict) else 0

            # 2. Pre-warm Intraday Tomorrow Deep Dive cache safely (non-intrusive cache lookup)
            try:
                from app.services.intraday_opportunity_service import IntradayOpportunityService
                IntradayOpportunityService.get_deep_dive_opportunities(db=db, force_refresh=False)
            except Exception as intra_err:
                logger.debug(f"[AutonomousEngineScheduler] Intraday radar cache check: {intra_err}")

            # 4. Master Autonomous Opportunity Radar Dispatch (VCP, Pre-Breakout, Momentum, Tomorrow Radar)
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
    def _execute_cpr_cycle(cls):
        key = "cpr_engine"
        cls._set_engine_status(key, "RUNNING")
        t0 = time.perf_counter()
        records_count = 0
        error_msg = None

        db = SessionLocal()
        try:
            from app.services.cpr_alert_service import CPRAlertService
            alerts = CPRAlertService.evaluate_live_cpr_alerts(db)
            records_count = len(alerts)

            ControlSystemService.record_service_fetch(
                service_id="cpr_compression_engine",
                records_count=records_count,
                status="SUCCESS",
                duration_ms=(time.perf_counter() - t0) * 1000.0,
            )
        except Exception as exc:
            error_msg = str(exc)
            logger.error(f"[AutonomousEngineScheduler] CPR cycle error: {exc}", exc_info=True)
            ControlSystemService.record_service_fetch(
                service_id="cpr_compression_engine",
                records_count=0,
                status="ERROR",
                error_msg=error_msg,
                duration_ms=(time.perf_counter() - t0) * 1000.0,
            )
        finally:
            db.close()

        cls._record_engine_finish(key, records_count, error_msg)

    @classmethod
    def _execute_mf_radar_cycle(cls):
        key = "mf_radar"
        cls._set_engine_status(key, "RUNNING")
        t0 = time.perf_counter()
        records_count = 0
        error_msg = None

        db = SessionLocal()
        try:
            from app.services.mf_engine_service import MFEngineService
            cycle_res = MFEngineService.run_scheduled_mf_cycle(db)
            records_count = cycle_res.get("holdings_upserted", 0) if isinstance(cycle_res, dict) else 0

            # Also sync AMFI daily NAVs for Mutual Fund Radar
            try:
                from app.services.mf_radar.mf_warehouse_service import MFWarehouseService
                amfi_res = MFWarehouseService.sync_daily_navs_from_amfi(db)
                if isinstance(amfi_res, dict):
                    records_count += amfi_res.get("updated_schemes", 0)
            except Exception as amfi_err:
                logger.warning(f"[AutonomousEngineScheduler] AMFI NAV sync notice: {amfi_err}")


            ControlSystemService.record_service_fetch(
                service_id="mf_radar_engine",
                records_count=records_count,
                status="SUCCESS",
                duration_ms=(time.perf_counter() - t0) * 1000.0,
            )
        except Exception as exc:
            error_msg = str(exc)
            logger.error(f"[AutonomousEngineScheduler] MF Radar cycle error: {exc}", exc_info=True)
            ControlSystemService.record_service_fetch(
                service_id="mf_radar_engine",
                records_count=0,
                status="ERROR",
                error_msg=error_msg,
                duration_ms=(time.perf_counter() - t0) * 1000.0,
            )
        finally:
            db.close()

        cls._record_engine_finish(key, records_count, error_msg)

    @classmethod
    def _execute_momentum_universe_cycle(cls):
        """Off-market full universe scan. Only executes during off-market window."""
        from app.services.momentum_universe_scanner import MomentumUniverseScanner, is_off_market_window
        key = "momentum_universe"

        if not is_off_market_window():
            # During market hours: skip this cycle — let intraday monitor handle live stocks
            logger.debug("[AutonomousEngineScheduler] Momentum universe scan skipped (market hours).")
            return

        cls._set_engine_status(key, "RUNNING")
        t0 = time.perf_counter()
        records_count = 0
        error_msg = None

        db = SessionLocal()
        try:
            result = MomentumUniverseScanner.trigger_background_universe_scan(db=db)
            records_count = 1  # Scan launched (async)

            ControlSystemService.log_action(
                service_id="momentum_universe_scanner",
                service_name="Momentum Universe Scanner",
                level="SUCCESS",
                action="UNIVERSE_SCAN_LAUNCHED",
                message=f"Full universe background scan triggered. Status: {result.get('status')}",
                duration_ms=(time.perf_counter() - t0) * 1000.0,
                records_count=records_count,
            )
        except Exception as exc:
            error_msg = str(exc)
            logger.error(f"[AutonomousEngineScheduler] Momentum universe cycle error: {exc}", exc_info=True)
        finally:
            db.close()

        cls._record_engine_finish(key, records_count, error_msg)

    @classmethod
    def _execute_momentum_intraday_cycle(cls):
        """Intraday re-scoring of watchlist candidates. Only executes during market hours."""
        from app.services.momentum_universe_scanner import MomentumIntradayMonitor, is_market_hours
        key = "momentum_intraday"

        if not is_market_hours():
            # Outside market hours: skip — universe scanner will handle next promotion
            logger.debug("[AutonomousEngineScheduler] Momentum intraday scan skipped (outside market hours).")
            return

        cls._set_engine_status(key, "RUNNING")
        t0 = time.perf_counter()
        records_count = 0
        error_msg = None

        db = SessionLocal()
        try:
            result = MomentumIntradayMonitor.run_intraday_scan(db=db, force=False)
            breakout_count = result.get("metadata", {}).get("breakout_count", 0)
            records_count = result.get("metadata", {}).get("watchlist_size", 0)

            if breakout_count > 0:
                logger.info(
                    f"[AutonomousEngineScheduler] 🚀 MOMENTUM BREAKOUT: {breakout_count} stocks triggered "
                    f"from watchlist! Symbols: {[b['symbol'] for b in result.get('breakouts', [])]}"
                )

            ControlSystemService.log_action(
                service_id="momentum_intraday_monitor",
                service_name="Momentum Intraday Monitor",
                level="SUCCESS" if breakout_count == 0 else "INFO",
                action="INTRADAY_SCAN_COMPLETE",
                message=f"Watchlist re-scored: {records_count} stocks, {breakout_count} breakouts detected.",
                duration_ms=(time.perf_counter() - t0) * 1000.0,
                records_count=records_count,
            )
        except Exception as exc:
            error_msg = str(exc)
            logger.error(f"[AutonomousEngineScheduler] Momentum intraday cycle error: {exc}", exc_info=True)
        finally:
            db.close()

        cls._record_engine_finish(key, records_count, error_msg)

    @classmethod
    def _execute_telegram_alerts_cycle(cls):
        key = "telegram_auto_alerts"
        cls._set_engine_status(key, "RUNNING")
        t0 = time.perf_counter()
        records_count = 0
        error_msg = None

        db = SessionLocal()
        try:
            from app.models.notification import AlertDispatchLog
            from app.services.opportunity_alert_service import OpportunityAlertService
            from app.services.sovereign_cockpit_service import SovereignCockpitService
            from app.services.alert_dispatch_service import AlertDispatchService

            # 1. Automated Opportunity Radar scan across 14 engines (auto-broadcasts to Telegram)
            opp_res = OpportunityAlertService.scan_and_dispatch_opportunity_alerts(db=db, force_scan=False)
            records_count += opp_res.get("new_alerts_count", 0)

            # 2. Automated Sovereign Cockpit Ignition Ready Apex Scanner
            sov_data = SovereignCockpitService.evaluate_universe(db)
            all_sov = (
                sov_data.get("chamber_1_compounders", {}).get("candidates", []) +
                sov_data.get("chamber_2_turnarounds", {}).get("candidates", [])
            )
            ignition_picks = [c for c in all_sov if c.get("stage") == "IGNITION_READY"]

            cutoff = AlertDispatchService.get_dedup_cutoff(hours=18)
            for pick in ignition_picks[:5]:
                sym = pick.get("symbol")
                if not sym:
                    continue
                
                already = db.query(AlertDispatchLog).filter(
                    AlertDispatchLog.symbol == sym,
                    AlertDispatchLog.payload_preview.ilike("%SOVEREIGN IGNITION%"),
                    AlertDispatchLog.dispatched_at >= cutoff
                ).first()

                if not already:
                    res = SovereignCockpitService.dispatch_alert(
                        db=db,
                        alert_type="IGNITION_TRIGGER",
                        symbol=sym,
                        custom_note=f"Auto Sovereign Radar: CMP ₹{pick.get('current_price', 0):.1f}"
                    )
                    if res.get("ok"):
                        records_count += 1

            ControlSystemService.record_service_fetch(
                service_id="telegram_auto_alerts",
                records_count=records_count,
                status="SUCCESS",
                duration_ms=(time.perf_counter() - t0) * 1000.0,
            )
        except Exception as exc:
            error_msg = str(exc)
            logger.error(f"[AutonomousEngineScheduler] Auto Telegram alerts cycle error: {exc}", exc_info=True)
            ControlSystemService.record_service_fetch(
                service_id="telegram_auto_alerts",
                records_count=0,
                status="ERROR",
                error_msg=error_msg,
                duration_ms=(time.perf_counter() - t0) * 1000.0,
            )
        finally:
            db.close()

        cls._record_engine_finish(key, records_count, error_msg)

    @classmethod
    def _execute_investor_intelligence_cycle(cls):
        key = "investor_intelligence"
        cls._set_engine_status(key, "RUNNING")
        t0 = time.perf_counter()
        records_count = 0
        error_msg = None

        db = SessionLocal()
        try:
            from app.services.investor_document_harvester import InvestorDocumentHarvester
            from app.services.investor_intelligence_service import InvestorIntelligenceService
            from app.models.investor_intelligence import InvestorDocument

            # 1. Harvest newly filed concalls & presentations from official NSE & BSE wires
            harvest_res = InvestorDocumentHarvester.harvest_from_exchange_wires(db)
            discovered = harvest_res.get("discovered", 0) if isinstance(harvest_res, dict) else 0
            records_count += discovered

            # 2. Pick top 2 most recent PENDING documents to analyze
            pending_docs = (
                db.query(InvestorDocument)
                .filter(InvestorDocument.status == "PENDING", InvestorDocument.pdf_url.isnot(None))
                .order_by(InvestorDocument.announcement_date.desc().nullslast(), InvestorDocument.id.desc())
                .limit(2)
                .all()
            )
            for doc in pending_docs:
                try:
                    insight = InvestorIntelligenceService.analyze_document(db, doc.id)
                    if insight:
                        records_count += 1
                except Exception as doc_err:
                    logger.warning(f"[AutonomousEngineScheduler] Failed analyzing doc {doc.id}: {doc_err}")

            ControlSystemService.record_service_fetch(
                service_id="investor_intelligence",
                records_count=records_count,
                status="SUCCESS",
                duration_ms=(time.perf_counter() - t0) * 1000.0,
            )
        except Exception as exc:
            error_msg = str(exc)
            logger.error(f"[AutonomousEngineScheduler] Investor Intelligence cycle error: {exc}", exc_info=True)
            ControlSystemService.record_service_fetch(
                service_id="investor_intelligence",
                records_count=0,
                status="ERROR",
                error_msg=error_msg,
                duration_ms=(time.perf_counter() - t0) * 1000.0,
            )
        finally:
            db.close()

        cls._record_engine_finish(key, records_count, error_msg)

    @classmethod
    def _execute_market_breadth_cycle(cls):
        key = "market_breadth"
        cls._set_engine_status(key, "RUNNING")
        t0 = time.perf_counter()
        records_count = 0
        error_msg = None

        try:
            from app.services.report_breadth_service import ReportBreadthService
            downloaded = ReportBreadthService.sync_exchange_bhavcopies(days_back=5)

            if downloaded > 0 or ReportBreadthService.is_cache_stale():
                logger.info(f"[AutonomousEngineScheduler] Market breadth cache is stale (new bhavcopies={downloaded}). Rebuilding...")
                cache = ReportBreadthService.build_breadth_cache(max_sessions=530)
                records_count = len(cache.get("breadth", {}).get("20", {}).get("all_equities", []))
            else:
                records_count = 1

            ControlSystemService.log_action(
                service_id="market_breadth_radar",
                service_name="Market Breadth Radar",
                level="SUCCESS",
                action="BREADTH_SYNC_COMPLETE",
                message=f"Breadth radar verified fresh. New bhavcopies: {downloaded}, sessions indexed: {records_count}",
                duration_ms=(time.perf_counter() - t0) * 1000.0,
                records_count=records_count,
            )
        except Exception as exc:
            error_msg = str(exc)
            logger.error(f"[AutonomousEngineScheduler] Market breadth cycle error: {exc}", exc_info=True)
            ControlSystemService.log_action(
                service_id="market_breadth_radar",
                service_name="Market Breadth Radar",
                level="ERROR",
                action="BREADTH_SYNC_ERROR",
                message=f"Market breadth error: {error_msg}",
                duration_ms=(time.perf_counter() - t0) * 1000.0,
            )
        finally:
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

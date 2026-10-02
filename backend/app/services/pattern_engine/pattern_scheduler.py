"""
Alpha India — Multi-Pattern Universe Scheduler
===============================================
Autonomously scans the 4000+ NSE & BSE universe for 5 high-conviction institutional patterns:
  1. Flat Base
  2. Double Bottom (W Pattern)
  3. Ascending Triangle
  4. Bull Flag
  5. High Tight Flag

Uses intelligent tiered scheduling to manage CPU and network load:
  - ACTIVE (detected pattern, score >= 60): rescanned every 15 minutes
  - DEVELOPING (promising structure, score 50–59): rescanned every 3 hours
  - UNTESTED / STALE: scanned progressively in 60-symbol batches every 60s
  - ELIMINATED (no consolidation / broke 200 SMA): rested for 7 days

Results are continuously merged into the active cache and persisted to disk.
"""

from __future__ import annotations

import concurrent.futures
import json
import logging
import threading
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.db.database import SessionLocal
from app.services.cup_handle.cup_handle_universe import load_full_universe
from app.services.cup_handle.cup_handle_orchestrator import _fetch_nifty_close
from app.services.pattern_engine.pattern_orchestrator import (
    analyze_all_patterns,
    _CACHE,
    _CACHE_LOCK,
    _DISK_CACHE_PATH,
    _save_disk_cache,
)

logger = logging.getLogger("alpha_india.pattern_engine.scheduler")

TICK_INTERVAL_SECONDS = 90
BATCH_SIZE = 25
MAX_WORKERS = 6
UNIVERSE_REFRESH_HOURS = 6

_TIER_COOLDOWNS = {
    "ACTIVE": 15 * 60,            # 15 minutes
    "DEVELOPING": 3 * 3600,       # 3 hours
    "UNTESTED": 0,                # Scan immediately
    "ELIMINATED": 7 * 24 * 3600,  # 7 days
}


class PatternUniverseScheduler:
    """
    Autonomous background scheduler for full-universe multi-pattern detection.
    """

    _thread: Optional[threading.Thread] = None
    _stop_event: threading.Event = threading.Event()
    _is_running: bool = False
    _last_universe_refresh: float = 0.0

    _universe: List[Dict[str, str]] = []
    _symbol_state: Dict[str, Dict[str, Any]] = {}
    _state_lock = threading.Lock()

    _telemetry: Dict[str, Any] = {
        "status": "STOPPED",
        "universe_size": 0,
        "scanned_ever": 0,
        "active_pattern_count": 0,
        "pattern_breakdown": {},
        "elite_count": 0,
        "last_tick_time": None,
        "last_tick_batch_size": 0,
        "last_tick_duration_sec": 0.0,
    }

    @classmethod
    def start(cls) -> None:
        if cls._is_running:
            logger.warning("[PatternScheduler] Already running.")
            return
        cls._stop_event.clear()
        cls._is_running = True
        cls._telemetry["status"] = "RUNNING"
        cls._thread = threading.Thread(
            target=cls._run_loop,
            daemon=True,
            name="PatternUniverseScheduler",
        )
        cls._thread.start()
        logger.info("[PatternScheduler] Started — scanning full NSE/BSE universe for 5 chart patterns.")

    @classmethod
    def stop(cls) -> None:
        if not cls._is_running:
            return
        cls._stop_event.set()
        cls._is_running = False
        cls._telemetry["status"] = "STOPPED"
        if cls._thread:
            cls._thread.join(timeout=5)
        logger.info("[PatternScheduler] Stopped.")

    @classmethod
    def get_telemetry(cls) -> Dict[str, Any]:
        with cls._state_lock:
            active_count = sum(
                1 for s in cls._symbol_state.values()
                if s.get("tier") == "ACTIVE"
            )
            scanned_count = sum(
                1 for s in cls._symbol_state.values()
                if s.get("last_ts", 0) > 0
            )

        with _CACHE_LOCK:
            patterns = _CACHE.get("data", [])
            breakdown = dict(_CACHE.get("metadata", {}).get("pattern_breakdown", {}))
            elite = sum(1 for p in patterns if p.get("ai_conviction_score", 0) >= 82)

        return {
            **cls._telemetry,
            "universe_size": len(cls._universe),
            "scanned_count": scanned_count,
            "coverage_pct": round((scanned_count / max(len(cls._universe), 1)) * 100, 1),
            "active_patterns": len(patterns),
            "pattern_breakdown": breakdown,
            "elite_count": elite,
        }

    @classmethod
    def _run_loop(cls) -> None:
        logger.info("[PatternScheduler] Loop entering.")
        cls._refresh_universe()

        # Seed initial state
        now = time.time()
        for item in cls._universe:
            sym = item["symbol"]
            if sym not in cls._symbol_state:
                cls._symbol_state[sym] = {
                    "tier": "UNTESTED",
                    "last_ts": 0.0,
                    "next_ts": now,
                    "patterns": [],
                }

        # Staggered startup delay (45s) to avoid thread collision with CupHandleUniverseScheduler
        if cls._stop_event.wait(45):
            return

        while not cls._stop_event.is_set():
            t_start = time.time()
            try:
                # Refresh universe every N hours
                if (t_start - cls._last_universe_refresh) > (UNIVERSE_REFRESH_HOURS * 3600):
                    cls._refresh_universe()

                cls._execute_tick()
            except Exception as e:
                logger.error(f"[PatternScheduler] Tick error: {e}", exc_info=True)

            elapsed = time.time() - t_start
            sleep_for = max(0.5, TICK_INTERVAL_SECONDS - elapsed)
            cls._stop_event.wait(timeout=sleep_for)

        logger.info("[PatternScheduler] Loop exited.")

    @classmethod
    def _refresh_universe(cls) -> None:
        try:
            db = SessionLocal()
            try:
                universe = load_full_universe(db)
                cls._universe = universe
                cls._last_universe_refresh = time.time()
                cls._telemetry["universe_size"] = len(universe)
                logger.info(f"[PatternScheduler] Universe loaded: {len(universe)} symbols.")
            finally:
                db.close()
        except Exception as e:
            logger.warning(f"[PatternScheduler] Failed to load universe: {e}")

    @classmethod
    def _get_due_batch(cls, now: float) -> List[Dict[str, str]]:
        with cls._state_lock:
            # Score items for prioritization:
            # ACTIVE (due) -> priority 1
            # DEVELOPING (due) -> priority 2
            # UNTESTED -> priority 3
            # ELIMINATED (due) -> priority 4
            tier_weights = {"ACTIVE": 1, "DEVELOPING": 2, "UNTESTED": 3, "ELIMINATED": 4}

            due = []
            for item in cls._universe:
                sym = item["symbol"]
                st = cls._symbol_state.get(sym)
                if not st or st.get("next_ts", 0) <= now:
                    tier = st.get("tier", "UNTESTED") if st else "UNTESTED"
                    due.append((tier_weights.get(tier, 5), item))

            due.sort(key=lambda x: x[0])
            batch = [item for _, item in due[:BATCH_SIZE]]
            return batch

    @classmethod
    def _execute_tick(cls) -> None:
        now = time.time()
        batch = cls._get_due_batch(now)
        if not batch:
            return

        nifty_close = _fetch_nifty_close()
        tick_results: List[Dict[str, Any]] = []

        def _scan_single(entry: Dict[str, str]) -> List[Dict[str, Any]]:
            return analyze_all_patterns(
                symbol=entry["symbol"],
                company_name=entry.get("company_name", entry["symbol"]),
                sector=entry.get("sector", "Diversified"),
                exchange=entry.get("exchange", "NSE"),
                nifty_close=nifty_close,
            )

        with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            future_to_entry = {executor.submit(_scan_single, e): e for e in batch}
            for fut in concurrent.futures.as_completed(future_to_entry):
                entry = future_to_entry[fut]
                sym = entry["symbol"]
                try:
                    patterns = fut.result()
                    now_ts = time.time()

                    with cls._state_lock:
                        if patterns:
                            best_score = max(p.get("ai_conviction_score", 0) for p in patterns)
                            if best_score >= 60:
                                tier = "ACTIVE"
                            else:
                                tier = "DEVELOPING"
                            p_types = [p.get("pattern_type") for p in patterns]
                        else:
                            tier = "ELIMINATED"
                            p_types = []

                        cls._symbol_state[sym] = {
                            "tier": tier,
                            "last_ts": now_ts,
                            "next_ts": now_ts + _TIER_COOLDOWNS[tier],
                            "patterns": p_types,
                        }

                    if patterns:
                        tick_results.extend(patterns)

                except Exception as e:
                    logger.debug(f"[PatternScheduler] Error scanning {sym}: {e}")

        # Update cache with newly found / re-scanned patterns
        with _CACHE_LOCK:
            existing = {
                (p["symbol"], p["pattern_type"]): p
                for p in _CACHE.get("data", [])
            }
            # Remove stale patterns for symbols in this batch
            batch_syms = {e["symbol"] for e in batch}
            existing = {
                k: v for k, v in existing.items()
                if k[0] not in batch_syms
            }
            # Add new detections
            for p in tick_results:
                existing[(p["symbol"], p["pattern_type"])] = p

            all_patterns = list(existing.values())
            all_patterns.sort(key=lambda x: x.get("ai_conviction_score", 0), reverse=True)

            counts: Dict[str, int] = {}
            for p in all_patterns:
                pt = p["pattern_type"]
                counts[pt] = counts.get(pt, 0) + 1

            meta = {
                "total_patterns": len(all_patterns),
                "pattern_breakdown": counts,
                "elite_count": sum(1 for p in all_patterns if p.get("ai_conviction_score", 0) >= 82),
                "last_scan_time": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime()),
            }

            _CACHE["timestamp"] = time.time()
            _CACHE["data"] = all_patterns
            _CACHE["metadata"] = meta

        _save_disk_cache()

        cls._telemetry["last_tick_time"] = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
        cls._telemetry["last_tick_batch_size"] = len(batch)
        cls._telemetry["last_tick_duration_sec"] = round(time.time() - now, 2)
        cls._telemetry["scanned_ever"] += len(batch)

        logger.info(
            f"[PatternScheduler] Tick finished in {cls._telemetry['last_tick_duration_sec']}s: "
            f"{len(batch)} symbols scanned, {len(tick_results)} new matches found. "
            f"Active pool: {len(all_patterns)} patterns."
        )

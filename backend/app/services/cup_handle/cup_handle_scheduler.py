"""
Alpha India — Cup & Handle Intelligent Universe Scheduler
==========================================================
Scans all 4000+ NSE/BSE stocks using a 5-tier priority intelligence system.

Scheduling Logic:
  1. On startup: load all symbols from DB, register any new ones (scan immediately).
  2. Every tick (60s): pick up to BATCH_SIZE due symbols, sorted by priority tier.
  3. Process batch with up to MAX_WORKERS concurrent threads.
  4. After each symbol scan: record state, update tier + cooldown.
  5. Active results cache is rebuilt from all ACTIVE-tier symbols continuously.

Tier Cooldowns:
  ACTIVE        → 10 minutes   (live pattern — re-check price/volume constantly)
  NEAR_BREAKOUT → 20 minutes   (handle forming, close to pivot — watch closely)
  DEVELOPING    → 6 hours      (stages 4–5 pass — check for handle formation)
  EARLY_STAGE   → 3 days       (cup forms but no handle yet)
  ELIMINATED    → 14 days      (failed geometry — very long rest)

Load Management:
  - Batch size: 80 symbols per tick (at 1 sec avg per symbol = ~80s per cycle)
  - Priority order ensures ACTIVE + NEAR_BREAKOUT always processed first
  - Eliminates ~95% of unnecessary scans vs naive full universe every N minutes
"""

from __future__ import annotations

import concurrent.futures
import logging
import threading
import time
from typing import Any, Dict, List, Optional

from app.db.database import SessionLocal
from app.services.cup_handle.cup_handle_engine import (
    analyze_symbol_with_stage_info,
    SECTOR_MAP,
)
from app.services.cup_handle.cup_handle_scan_state import (
    ScanStateManager,
    ScanTier,
    get_state_manager,
)
from app.services.cup_handle.cup_handle_universe import load_full_universe
from app.services.cup_handle.cup_handle_orchestrator import (
    _fetch_nifty_close,
    _save_disk_cache,
    _CACHE,
    compute_stage_funnel,
)

logger = logging.getLogger("alpha_india.cup_handle.scheduler")

# ── Configuration ─────────────────────────────────────────────────────────────
TICK_INTERVAL_SECONDS = 75      # How often the scheduler wakes up
BATCH_SIZE = 35                 # Throttled symbols processed per tick to prevent 429
MAX_WORKERS = 8                 # Controlled concurrent yfinance threads per batch
UNIVERSE_REFRESH_HOURS = 6      # How often to re-load universe from DB


class CupHandleUniverseScheduler:
    """
    Autonomous background scheduler for full-universe Cup & Handle scanning.
    Integrates with ScanStateManager for tiered intelligent prioritisation.
    """

    _thread: Optional[threading.Thread] = None
    _stop_event: threading.Event = threading.Event()
    _is_running: bool = False
    _last_universe_refresh: float = 0.0

    _telemetry: Dict[str, Any] = {
        "status": "STOPPED",
        "universe_size": 0,
        "total_scanned_ever": 0,
        "active_patterns": 0,
        "near_breakout": 0,
        "last_tick_time": None,
        "last_tick_batch_size": 0,
        "last_tick_duration_sec": 0.0,
        "last_universe_refresh": None,
    }

    @classmethod
    def start(cls) -> None:
        if cls._is_running:
            logger.warning("[CupHandleScheduler] Already running.")
            return
        cls._stop_event.clear()
        cls._is_running = True
        cls._telemetry["status"] = "RUNNING"
        cls._thread = threading.Thread(
            target=cls._run_loop,
            daemon=True,
            name="CupHandleUniverseScheduler",
        )
        cls._thread.start()
        logger.info("[CupHandleScheduler] Started — scanning full NSE/BSE universe.")

    @classmethod
    def stop(cls) -> None:
        cls._stop_event.set()
        cls._is_running = False
        cls._telemetry["status"] = "STOPPED"
        logger.info("[CupHandleScheduler] Stopped.")

    @classmethod
    def is_running(cls) -> bool:
        return cls._is_running

    @classmethod
    def get_telemetry(cls) -> Dict[str, Any]:
        state_mgr = get_state_manager()
        stats = state_mgr.get_stats()
        return {
            **cls._telemetry,
            **stats,
        }

    # ── Main Loop ─────────────────────────────────────────────────────────────

    @classmethod
    def _run_loop(cls) -> None:
        """Background thread main loop."""
        logger.info("[CupHandleScheduler] Loop started.")

        # Initial universe load
        cls._refresh_universe()

        # Staggered startup delay (15s) to avoid thread collision with other schedulers
        if cls._stop_event.wait(15):
            return

        while not cls._stop_event.is_set():
            try:
                # Periodically refresh universe (picks up new IPOs/listings)
                if (time.time() - cls._last_universe_refresh) > (UNIVERSE_REFRESH_HOURS * 3600):
                    cls._refresh_universe()

                cls._process_tick()

            except Exception as e:
                logger.error(f"[CupHandleScheduler] Tick error: {e}", exc_info=True)

            if cls._stop_event.wait(timeout=TICK_INTERVAL_SECONDS):
                break

        logger.info("[CupHandleScheduler] Loop exited.")

    @classmethod
    def _refresh_universe(cls) -> None:
        """Loads all symbols from DB and registers new ones in the state manager."""
        try:
            db = SessionLocal()
            try:
                universe = load_full_universe(db)
            finally:
                db.close()

            state_mgr = get_state_manager()
            new_count = state_mgr.register_symbols(universe)
            state_mgr.save(force=True)

            cls._last_universe_refresh = time.time()
            cls._telemetry["universe_size"] = state_mgr.total()
            cls._telemetry["last_universe_refresh"] = time.strftime(
                "%Y-%m-%d %H:%M:%S", time.localtime()
            )
            logger.info(
                f"[CupHandleScheduler] Universe refreshed: {state_mgr.total()} total, "
                f"{new_count} new symbols registered."
            )
        except Exception as e:
            logger.error(f"[CupHandleScheduler] Universe refresh failed: {e}")

    @classmethod
    def _process_tick(cls) -> None:
        """Single scheduler tick: pick due symbols, scan batch, update state."""
        t0 = time.time()
        state_mgr = get_state_manager()
        due = state_mgr.get_due_symbols(max_batch=BATCH_SIZE)

        if not due:
            cls._telemetry["last_tick_batch_size"] = 0
            return

        logger.info(
            f"[CupHandleScheduler] Processing {len(due)} due symbols "
            f"(ACTIVE:{sum(1 for s in due if s.tier == ScanTier.ACTIVE.value)}, "
            f"NEAR:{sum(1 for s in due if s.tier == ScanTier.NEAR_BREAKOUT.value)}, "
            f"DEV:{sum(1 for s in due if s.tier == ScanTier.DEVELOPING.value)})"
        )

        # Fetch Nifty benchmark once for RS comparison
        nifty_close = _fetch_nifty_close()

        # Open a DB session for fundamentals lookup
        db = SessionLocal()
        results_updated = False

        try:
            def _scan_one(state_entry):
                info = analyze_symbol_with_stage_info(
                    symbol=state_entry.symbol,
                    company_name=state_entry.company_name,
                    sector=state_entry.sector,
                    exchange=state_entry.exchange,
                    db=db,
                    nifty_close=nifty_close,
                )
                return state_entry.symbol, info

            new_results: List[Dict[str, Any]] = []

            with concurrent.futures.ThreadPoolExecutor(max_workers=MAX_WORKERS) as ex:
                futures = {ex.submit(_scan_one, s): s for s in due}
                for future in concurrent.futures.as_completed(futures):
                    try:
                        sym, info = future.result()

                        if info is None:
                            state_mgr.record_scan_error(sym)
                            continue

                        state_mgr.record_scan_result(
                            symbol=sym,
                            max_stage_passed=info["max_stage_passed"],
                            ai_score=info["partial_score"],
                            in_results=info["in_results"],
                        )

                        if info["in_results"] and info["result"]:
                            new_results.append(info["result"])
                            results_updated = True

                    except Exception as ex:
                        sym = futures[future].symbol
                        state_mgr.record_scan_error(sym)

            # ── Merge new results into cache ──────────────────────────────────
            if results_updated:
                _merge_results_into_cache(new_results, state_mgr)

        finally:
            db.close()

        # Persist state changes
        state_mgr.save()

        elapsed = round(time.time() - t0, 2)
        stats = state_mgr.get_stats()

        cls._telemetry.update({
            "total_scanned_ever": cls._telemetry.get("total_scanned_ever", 0) + len(due),
            "active_patterns": stats.get("active_patterns", 0),
            "near_breakout": stats.get("near_breakout", 0),
            "last_tick_time": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime()),
            "last_tick_batch_size": len(due),
            "last_tick_duration_sec": elapsed,
        })

        logger.info(
            f"[CupHandleScheduler] Tick done in {elapsed}s. "
            f"Active: {stats.get('active_patterns', 0)}, "
            f"Near-Breakout: {stats.get('near_breakout', 0)}"
        )


# ── Cache Merge ────────────────────────────────────────────────────────────────

def _merge_results_into_cache(
    new_results: List[Dict[str, Any]],
    state_mgr: ScanStateManager,
) -> None:
    """
    Merges fresh scan results into the shared _CACHE.
    - Replaces existing entries for the same symbol
    - Removes entries for symbols that are no longer ACTIVE
    - Rebuilds metadata + funnel
    """
    import time as _time

    # Build a symbol → result map from new scans
    new_map = {r["symbol"]: r for r in new_results}

    # Start from existing cache
    existing: List[Dict[str, Any]] = list(_CACHE.get("data", []))

    # Remove stale entries for symbols that just got re-scanned
    existing = [e for e in existing if e.get("symbol") not in new_map]

    # Remove entries for symbols that dropped out of ACTIVE tier
    active_syms = {s.symbol for s in state_mgr.get_all_active()}
    existing = [e for e in existing if e.get("symbol") in active_syms]

    # Merge in fresh results
    merged = existing + list(new_map.values())

    # Sort by conviction score
    merged.sort(
        key=lambda x: (x.get("ai_conviction_score", 0), x.get("volume", {}).get("breakout_vol_ratio", 0)),
        reverse=True,
    )

    now = _time.time()
    total_scanned = state_mgr.total()

    elite_count = sum(1 for r in merged if r.get("ai_conviction_score", 0) >= 82)
    high_count = sum(1 for r in merged if 70 <= r.get("ai_conviction_score", 0) < 82)
    developing_count = sum(1 for r in merged if 60 <= r.get("ai_conviction_score", 0) < 70)
    breakout_ready = sum(1 for r in merged if r.get("volume", {}).get("breakout_confirmed", False))

    import numpy as np
    avg_score = (
        round(float(np.mean([r.get("ai_conviction_score", 0) for r in merged])), 1)
        if merged else 0.0
    )

    stage_funnel = compute_stage_funnel(merged, total_scanned)
    near_breakout_count = state_mgr.get_stats().get("near_breakout", 0)

    metadata = {
        "total_scanned": total_scanned,
        "patterns_found": len(merged),
        "elite_count": elite_count,
        "high_conviction_count": high_count,
        "developing_count": developing_count,
        "breakout_ready_count": breakout_ready,
        "near_breakout_watching": near_breakout_count,
        "avg_conviction_score": avg_score,
        "scan_duration_seconds": 0.0,
        "last_scan_time": _time.strftime("%Y-%m-%d %H:%M:%S", _time.localtime(now)),
        "stage_funnel": stage_funnel,
        "scheduler_mode": "FULL_UNIVERSE_TIERED",
    }

    _CACHE["timestamp"] = now
    _CACHE["data"] = merged
    _CACHE["metadata"] = metadata

    _save_disk_cache()
    logger.info(
        f"[CupHandleScheduler] Cache updated: {len(merged)} active patterns "
        f"({elite_count} ELITE, {high_count} HIGH, {breakout_ready} BREAKOUT_READY)"
    )

"""
Alpha India — Cup & Handle Scan State Tracker
==============================================
Tracks per-symbol scan state with tiered cooldowns.
Persists to disk (JSON) for instant restore across server restarts.

Tier hierarchy (based on max stage reached + AI score):
  ELIMINATED   — Fails Stage 1 or 2 (geometry).    Cooldown: 14 days
  EARLY_STAGE  — Passes Stage 1–3 (cup forms).      Cooldown: 3 days
  DEVELOPING   — Passes Stage 4–5 (trend + base).   Cooldown: 6 hours
  NEAR_BREAKOUT — Stage 6–7 pass OR score >= 55.    Cooldown: 20 minutes
  ACTIVE        — All 8 stages pass (in results).   Cooldown: 10 minutes
"""

from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass, asdict
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("alpha_india.cup_handle.scan_state")

# Disk persistence path
STATE_PATH = (
    Path(__file__).resolve().parent.parent.parent.parent
    / "data"
    / "cup_handle_scan_state.json"
)


# ── Tier Definitions ─────────────────────────────────────────────────────────

class ScanTier(str, Enum):
    ELIMINATED    = "ELIMINATED"       # Fails geometry — very long cooldown
    EARLY_STAGE   = "EARLY_STAGE"      # Cup forms but no handle yet
    DEVELOPING    = "DEVELOPING"       # Trend + base quality pass
    NEAR_BREAKOUT = "NEAR_BREAKOUT"    # Close to pivot — high-frequency watch
    ACTIVE        = "ACTIVE"           # Live pattern in results


# Cooldown seconds per tier
TIER_COOLDOWNS: Dict[ScanTier, int] = {
    ScanTier.ELIMINATED:    14 * 24 * 3600,   # 14 days
    ScanTier.EARLY_STAGE:   3  * 24 * 3600,   # 3 days
    ScanTier.DEVELOPING:    6  * 3600,         # 6 hours
    ScanTier.NEAR_BREAKOUT: 20 * 60,           # 20 minutes
    ScanTier.ACTIVE:        10 * 60,           # 10 minutes
}

# Priority order for scheduling (lower = higher priority)
TIER_PRIORITY: Dict[ScanTier, int] = {
    ScanTier.ACTIVE:        0,
    ScanTier.NEAR_BREAKOUT: 1,
    ScanTier.DEVELOPING:    2,
    ScanTier.EARLY_STAGE:   3,
    ScanTier.ELIMINATED:    4,
}


# ── Per-symbol State ──────────────────────────────────────────────────────────

@dataclass
class SymbolScanState:
    symbol: str
    company_name: str = ""
    exchange: str = "NSE"
    sector: str = "Diversified"
    tier: str = ScanTier.ELIMINATED.value
    max_stage_passed: int = 0          # 0–8: highest gate passed in last scan
    ai_score: int = 0                  # last computed AI score (0 if not passed all gates)
    last_scan_ts: float = 0.0          # epoch seconds of last scan
    next_scan_ts: float = 0.0          # epoch seconds — when next scan is due
    in_results: bool = False           # currently surfaced in scanner results
    scan_count: int = 0                # total times this symbol has been scanned
    error_streak: int = 0             # consecutive yfinance errors (max 5 → long backoff)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    @staticmethod
    def from_dict(d: Dict[str, Any]) -> "SymbolScanState":
        return SymbolScanState(
            symbol=d.get("symbol", ""),
            company_name=d.get("company_name", ""),
            exchange=d.get("exchange", "NSE"),
            sector=d.get("sector", "Diversified"),
            tier=d.get("tier", ScanTier.ELIMINATED.value),
            max_stage_passed=d.get("max_stage_passed", 0),
            ai_score=d.get("ai_score", 0),
            last_scan_ts=d.get("last_scan_ts", 0.0),
            next_scan_ts=d.get("next_scan_ts", 0.0),
            in_results=d.get("in_results", False),
            scan_count=d.get("scan_count", 0),
            error_streak=d.get("error_streak", 0),
        )

    @property
    def is_due(self) -> bool:
        return time.time() >= self.next_scan_ts

    @property
    def priority(self) -> int:
        return TIER_PRIORITY.get(ScanTier(self.tier), 4)


def _classify_tier(max_stage: int, ai_score: int, in_results: bool) -> ScanTier:
    """Determine scan tier from detection results."""
    if in_results:
        return ScanTier.ACTIVE
    if max_stage >= 7 or (max_stage >= 5 and ai_score >= 55):
        return ScanTier.NEAR_BREAKOUT
    if max_stage >= 4:
        return ScanTier.DEVELOPING
    if max_stage >= 2:
        return ScanTier.EARLY_STAGE
    return ScanTier.ELIMINATED


def _next_scan_time(tier: ScanTier, error_streak: int) -> float:
    """Compute next scan timestamp based on tier and error streak."""
    if error_streak >= 3:
        # Exponential backoff: 1 hour * 2^(error_streak - 3)
        backoff = min(7 * 24 * 3600, 3600 * (2 ** (error_streak - 3)))
        return time.time() + backoff
    return time.time() + TIER_COOLDOWNS[tier]


# ── State Manager ─────────────────────────────────────────────────────────────

class ScanStateManager:
    """
    Thread-safe in-memory + disk-persisted state store.
    Tracks every symbol's scan history and priority scheduling.
    """

    def __init__(self):
        self._state: Dict[str, SymbolScanState] = {}
        self._dirty: bool = False
        self._last_save_ts: float = 0.0
        self._load()

    # ── Persistence ──────────────────────────────────────────────────────────

    def _load(self) -> None:
        try:
            if STATE_PATH.exists():
                with open(STATE_PATH, "r", encoding="utf-8") as f:
                    raw = json.load(f)
                for sym, data in raw.items():
                    self._state[sym] = SymbolScanState.from_dict(data)
                logger.info(
                    f"[ScanState] Loaded {len(self._state)} symbols from disk."
                )
        except Exception as e:
            logger.warning(f"[ScanState] Failed to load state: {e}")

    def save(self, force: bool = False) -> None:
        """Save to disk if dirty or forced (saves at most every 30 seconds)."""
        now = time.time()
        if not force and not self._dirty:
            return
        if not force and (now - self._last_save_ts) < 30:
            return
        try:
            STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
            raw = {sym: s.to_dict() for sym, s in self._state.items()}
            with open(STATE_PATH, "w", encoding="utf-8") as f:
                json.dump(raw, f, indent=2)
            self._dirty = False
            self._last_save_ts = now
        except Exception as e:
            logger.warning(f"[ScanState] Failed to save state: {e}")

    # ── Symbol Registration ───────────────────────────────────────────────────

    def register_symbols(
        self,
        symbols: List[Dict[str, str]],
    ) -> int:
        """
        Register new symbols that don't yet have a state entry.
        New symbols get next_scan_ts = 0 (immediately due).
        Returns count of newly registered symbols.
        """
        new_count = 0
        for entry in symbols:
            sym = entry["symbol"]
            if sym not in self._state:
                self._state[sym] = SymbolScanState(
                    symbol=sym,
                    company_name=entry.get("company_name", sym),
                    exchange=entry.get("exchange", "NSE"),
                    sector=entry.get("sector", "Diversified"),
                    tier=ScanTier.ELIMINATED.value,
                    next_scan_ts=0.0,   # immediately due
                )
                new_count += 1

        if new_count > 0:
            self._dirty = True
            logger.info(f"[ScanState] Registered {new_count} new symbols.")
        return new_count

    # ── State Update After Scan ───────────────────────────────────────────────

    def record_scan_result(
        self,
        symbol: str,
        max_stage_passed: int,
        ai_score: int,
        in_results: bool,
    ) -> None:
        """Update state after a successful symbol scan."""
        state = self._state.get(symbol)
        if state is None:
            return

        tier = _classify_tier(max_stage_passed, ai_score, in_results)
        state.tier = tier.value
        state.max_stage_passed = max_stage_passed
        state.ai_score = ai_score
        state.in_results = in_results
        state.last_scan_ts = time.time()
        state.next_scan_ts = _next_scan_time(tier, 0)
        state.scan_count += 1
        state.error_streak = 0  # reset on success
        self._dirty = True

    def record_scan_error(self, symbol: str) -> None:
        """Update state after a scan error (yfinance failure, no data, etc)."""
        state = self._state.get(symbol)
        if state is None:
            return
        state.error_streak = min(10, state.error_streak + 1)
        state.last_scan_ts = time.time()
        state.next_scan_ts = _next_scan_time(ScanTier(state.tier), state.error_streak)
        state.scan_count += 1
        self._dirty = True

    # ── Scheduling Queries ────────────────────────────────────────────────────

    def get_due_symbols(self, max_batch: int = 100) -> List[SymbolScanState]:
        """
        Returns up to max_batch symbols that are due for scanning.
        Ordered by priority: ACTIVE → NEAR_BREAKOUT → DEVELOPING → EARLY_STAGE → ELIMINATED
        """
        now = time.time()
        due = [s for s in self._state.values() if s.next_scan_ts <= now]
        due.sort(key=lambda s: (s.priority, s.next_scan_ts))
        return due[:max_batch]

    def get_stats(self) -> Dict[str, Any]:
        now = time.time()
        total = len(self._state)
        by_tier: Dict[str, int] = {}
        due_count = 0
        active_count = 0
        near_breakout_count = 0

        for s in self._state.values():
            by_tier[s.tier] = by_tier.get(s.tier, 0) + 1
            if s.next_scan_ts <= now:
                due_count += 1
            if s.tier == ScanTier.ACTIVE.value:
                active_count += 1
            if s.tier == ScanTier.NEAR_BREAKOUT.value:
                near_breakout_count += 1

        return {
            "total_universe": total,
            "due_for_scan": due_count,
            "active_patterns": active_count,
            "near_breakout": near_breakout_count,
            "by_tier": by_tier,
        }

    def get_all_active(self) -> List[SymbolScanState]:
        """Returns all symbols currently in ACTIVE or NEAR_BREAKOUT tier."""
        return [
            s for s in self._state.values()
            if s.tier in (ScanTier.ACTIVE.value, ScanTier.NEAR_BREAKOUT.value)
        ]

    def total(self) -> int:
        return len(self._state)


# Singleton instance
_manager: Optional[ScanStateManager] = None


def get_state_manager() -> ScanStateManager:
    global _manager
    if _manager is None:
        _manager = ScanStateManager()
    return _manager

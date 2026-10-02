"""
Alpha India — Multi-Pattern Orchestrator
==========================================
One yfinance fetch per symbol → runs all 5 pattern detectors in memory.
This is the key efficiency: no duplicate network calls per pattern type.

Patterns per scan cycle:
  1. FLAT_BASE
  2. DOUBLE_BOTTOM
  3. ASCENDING_TRIANGLE
  4. BULL_FLAG
  5. HIGH_TIGHT_FLAG

A symbol can match multiple patterns simultaneously (e.g., Flat Base + Ascending Triangle).
Each match is returned as a separate result entry with its own conviction score.

Architecture:
  - Inherits the same 4000+ universe from CupHandleUniverseScheduler
  - Shares the tiered ScanStateManager (same cooldown keys: "pattern_{symbol}")
  - Independent in-memory + disk cache from Cup & Handle
  - Results served by /api/v1/chart-patterns endpoint
"""

from __future__ import annotations

import concurrent.futures
import json
import logging
import os
import threading
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd
import yfinance as yf

from app.services.pattern_engine.flat_base_engine import detect_flat_base
from app.services.pattern_engine.double_bottom_engine import detect_double_bottom
from app.services.pattern_engine.ascending_triangle_engine import detect_ascending_triangle
from app.services.pattern_engine.bull_flag_engine import detect_bull_flag, detect_high_tight_flag
from app.services.pattern_engine.pattern_core import sanitize_json
from app.services.cup_handle.cup_handle_universe import load_full_universe
from app.services.cup_handle.cup_handle_orchestrator import _fetch_nifty_close

logger = logging.getLogger("alpha_india.pattern_engine.orchestrator")

# ── Cache ─────────────────────────────────────────────────────────────────────
_CACHE: Dict[str, Any] = {}
_CACHE_LOCK = threading.Lock()
_CACHE_TTL = 10 * 60  # 10 minutes
_DISK_CACHE_PATH = (
    Path(__file__).resolve().parent.parent.parent.parent
    / "data"
    / "pattern_engine_cache.json"
)

# ── Scan state per symbol (simple in-memory, same tier logic) ─────────────────
_PATTERN_SCAN_STATE: Dict[str, Dict[str, Any]] = {}  # symbol → {last_ts, tier, next_ts}
_STATE_LOCK = threading.Lock()

_PATTERN_STATE_PATH = (
    Path(__file__).resolve().parent.parent.parent.parent
    / "data"
    / "pattern_scan_state.json"
)

# Tier cooldowns (in seconds) — same philosophy as Cup & Handle
_PATTERN_TIER_COOLDOWNS = {
    "ELIMINATED":    14 * 24 * 3600,
    "EARLY_STAGE":   3 * 24 * 3600,
    "DEVELOPING":    6 * 3600,
    "NEAR_BREAKOUT": 20 * 60,
    "ACTIVE":        10 * 60,
}


# ─────────────────────────────────────────────────────────────────────────────
# Cache helpers
# ─────────────────────────────────────────────────────────────────────────────

def _load_disk_cache() -> None:
    try:
        if _DISK_CACHE_PATH.exists():
            with open(_DISK_CACHE_PATH, "r") as f:
                data = json.load(f)
            with _CACHE_LOCK:
                _CACHE.update(data)
            logger.info(f"[PatternEngine] Loaded {len(_CACHE.get('data', []))} patterns from disk.")
    except Exception as e:
        logger.warning(f"[PatternEngine] Disk cache load failed: {e}")


def _save_disk_cache() -> None:
    try:
        _DISK_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
        with _CACHE_LOCK:
            snapshot = dict(_CACHE)
        with open(_DISK_CACHE_PATH, "w") as f:
            json.dump(snapshot, f, default=str)
    except Exception as e:
        logger.warning(f"[PatternEngine] Disk cache save failed: {e}")


def _load_pattern_state() -> None:
    try:
        if _PATTERN_STATE_PATH.exists():
            with open(_PATTERN_STATE_PATH, "r") as f:
                data = json.load(f)
            with _STATE_LOCK:
                _PATTERN_SCAN_STATE.update(data)
    except Exception as e:
        logger.warning(f"[PatternEngine] State load failed: {e}")


def _save_pattern_state() -> None:
    try:
        _PATTERN_STATE_PATH.parent.mkdir(parents=True, exist_ok=True)
        with _STATE_LOCK:
            snapshot = dict(_PATTERN_SCAN_STATE)
        with open(_PATTERN_STATE_PATH, "w") as f:
            json.dump(snapshot, f, default=str)
    except Exception as e:
        logger.warning(f"[PatternEngine] State save failed: {e}")


_load_disk_cache()
_load_pattern_state()


# ─────────────────────────────────────────────────────────────────────────────
# Single-symbol multi-pattern analysis
# ─────────────────────────────────────────────────────────────────────────────

def _resolve_df(clean_sym: str, exchange: str = "NSE") -> Optional[pd.DataFrame]:
    """Fetch OHLCV through centralized MarketDataService buffer."""
    try:
        from app.services.market_data_service import MarketDataService
        df = MarketDataService.get_symbol_ohlcv(clean_sym, period="3y", interval="1d")
        if df is not None and not df.empty and len(df) >= 120:
            df = df.dropna(subset=["Close", "Volume"])
            if len(df) >= 120:
                return df
    except Exception as e:
        logger.debug(f"[PatternOrchestrator] Resolve DF exception for {clean_sym}: {e}")
    return None


def analyze_all_patterns(
    symbol: str,
    company_name: str = "",
    sector: str = "Diversified",
    exchange: str = "NSE",
    nifty_close: Optional[pd.Series] = None,
) -> List[Dict[str, Any]]:
    """
    Fetches OHLCV once, runs all 5 pattern detectors.
    Returns a list of matched patterns (0 to 5 per symbol).
    """
    clean_sym = symbol.strip().upper()
    results: List[Dict[str, Any]] = []

    try:
        df = _resolve_df(clean_sym, exchange)
        if df is None:
            return results

        # Resample
        w_df = df.resample("W-FRI").agg({
            "Open": "first", "High": "max", "Low": "min",
            "Close": "last", "Volume": "sum",
        }).dropna()

        m_df = df.resample("ME").agg({
            "Open": "first", "High": "max", "Low": "min",
            "Close": "last", "Volume": "sum",
        }).dropna()

        if len(w_df) < 20 or len(m_df) < 10:
            return results

        d_close = df["Close"]
        d_high = df["High"]
        d_low = df["Low"]
        d_open = df["Open"]
        d_vol = df["Volume"]
        w_close = w_df["Close"]
        w_high = w_df["High"]
        w_low = w_df["Low"]
        w_vol = w_df["Volume"]
        m_close = m_df["Close"]

        common_kwargs = dict(
            symbol=clean_sym, company_name=company_name,
            sector=sector, exchange=exchange,
            nifty_close=nifty_close,
        )

        # ── 1. Flat Base ──
        try:
            r = detect_flat_base(
                **common_kwargs,
                d_close=d_close, d_high=d_high, d_low=d_low, d_open=d_open, d_volume=d_vol,
                w_close=w_close, w_volume=w_vol, m_close=m_close,
            )
            if r:
                results.append(r)
        except Exception as e:
            logger.debug(f"[PatternEngine] Flat base error {clean_sym}: {e}")

        # ── 2. Double Bottom ──
        try:
            r = detect_double_bottom(
                **common_kwargs,
                d_close=d_close, d_high=d_high, d_low=d_low, d_open=d_open, d_volume=d_vol,
                w_close=w_close, w_low=w_low, w_high=w_high, w_volume=w_vol, m_close=m_close,
            )
            if r:
                results.append(r)
        except Exception as e:
            logger.debug(f"[PatternEngine] Double bottom error {clean_sym}: {e}")

        # ── 3. Ascending Triangle ──
        try:
            r = detect_ascending_triangle(
                **common_kwargs,
                d_close=d_close, d_high=d_high, d_low=d_low, d_open=d_open, d_volume=d_vol,
                w_close=w_close, w_low=w_low, w_high=w_high, w_volume=w_vol, m_close=m_close,
            )
            if r:
                results.append(r)
        except Exception as e:
            logger.debug(f"[PatternEngine] Ascending triangle error {clean_sym}: {e}")

        # ── 4. Bull Flag ──
        try:
            r = detect_bull_flag(
                **common_kwargs,
                d_close=d_close, d_high=d_high, d_low=d_low, d_open=d_open, d_volume=d_vol,
                w_close=w_close, w_volume=w_vol, m_close=m_close,
            )
            if r:
                results.append(r)
        except Exception as e:
            logger.debug(f"[PatternEngine] Bull flag error {clean_sym}: {e}")

        # ── 5. High Tight Flag (only if bull flag didn't already catch it as HTF) ──
        already_htf = any(r.get("pattern_type") == "HIGH_TIGHT_FLAG" for r in results)
        if not already_htf:
            try:
                r = detect_high_tight_flag(
                    **common_kwargs,
                    d_close=d_close, d_high=d_high, d_low=d_low, d_open=d_open, d_volume=d_vol,
                    w_close=w_close, w_volume=w_vol, m_close=m_close,
                )
                if r:
                    results.append(r)
            except Exception as e:
                logger.debug(f"[PatternEngine] HTF error {clean_sym}: {e}")

    except Exception as e:
        logger.debug(f"[PatternEngine] Error analyzing {clean_sym}: {e}")

    # Standardize breakout metrics and distance for all patterns
    for r in results:
        pivot = r.get("pivot_buy_point") or r.get("pivot") or r.get("resistance_level") or 0.0
        cmp_val = r.get("cmp") or 0.0
        if pivot and cmp_val:
            dist_pct = round(((pivot - cmp_val) / max(cmp_val, 1e-9)) * 100, 2)
        else:
            dist_pct = 0.0
        r["pivot_buy_point"] = pivot
        r["breakout_distance_pct"] = dist_pct
        r["is_near_breakout"] = abs(dist_pct) <= 2.5
        r["is_breakout"] = -0.5 <= dist_pct <= 3.0

    return [sanitize_json(r) for r in results]


# ─────────────────────────────────────────────────────────────────────────────
# Public scan API (called by router + scheduler)
# ─────────────────────────────────────────────────────────────────────────────

def get_pattern_results(
    db=None,
    force_refresh: bool = False,
) -> Dict[str, Any]:
    """
    Returns cached pattern results with stale-while-revalidate.
    Served instantly from cache; background refresh triggered when stale.
    """
    now = time.time()
    with _CACHE_LOCK:
        age = now - _CACHE.get("timestamp", 0)
        has_data = bool(_CACHE.get("data"))

    if has_data and age < _CACHE_TTL and not force_refresh:
        with _CACHE_LOCK:
            return {"patterns": list(_CACHE.get("data", [])), "metadata": dict(_CACHE.get("metadata", {}))}

    if has_data and not force_refresh:
        threading.Thread(target=_run_quick_scan, kwargs={"db": db}, daemon=True).start()
        with _CACHE_LOCK:
            return {"patterns": list(_CACHE.get("data", [])), "metadata": dict(_CACHE.get("metadata", {}))}

    # Cold start — run synchronously for a quick sample
    _run_quick_scan(db=db, quick=True)
    with _CACHE_LOCK:
        return {"patterns": list(_CACHE.get("data", [])), "metadata": dict(_CACHE.get("metadata", {}))}


def _run_quick_scan(db=None, quick: bool = False) -> None:
    """
    Quick scan: focuses on ACTIVE + NEAR_BREAKOUT tier symbols from Cup & Handle state
    so the pattern scanner immediately has high-quality candidates.
    For fresh install: scans top 200 liquid NSE symbols.
    """
    from app.services.cup_handle.cup_handle_scan_state import get_state_manager, ScanTier

    t0 = time.time()
    nifty_close = _fetch_nifty_close()

    # Priority: symbols already known to be promising from Cup & Handle state
    state_mgr = get_state_manager()
    priority_syms = [
        s for s in state_mgr.get_all_active()
    ]

    # Also include any pattern-scan-state ACTIVE/NEAR_BREAKOUT symbols
    with _STATE_LOCK:
        pattern_active = [
            sym for sym, st in _PATTERN_SCAN_STATE.items()
            if st.get("tier") in ("ACTIVE", "NEAR_BREAKOUT")
        ]

    # Build scan list
    if db is not None:
        universe = load_full_universe(db)
        # Quick mode: top 300 symbols (BOTH/NSE exchange first = largest)
        candidates = [u for u in universe if u["exchange"] == "NSE"][:300 if quick else len(universe)]
    else:
        candidates = []

    # Merge with priority symbols
    priority_set = {s.symbol for s in priority_syms} | set(pattern_active)
    priority_entries = [{"symbol": s.symbol, "company_name": s.company_name,
                         "sector": s.sector, "exchange": s.exchange}
                        for s in priority_syms]
    other_entries = [c for c in candidates if c["symbol"] not in priority_set]
    scan_list = priority_entries + other_entries

    if not scan_list:
        return

    all_results: List[Dict[str, Any]] = []

    def _scan_one(entry: Dict[str, str]) -> List[Dict[str, Any]]:
        return analyze_all_patterns(
            symbol=entry["symbol"],
            company_name=entry.get("company_name", entry["symbol"]),
            sector=entry.get("sector", "Diversified"),
            exchange=entry.get("exchange", "NSE"),
            nifty_close=nifty_close,
        )

    with concurrent.futures.ThreadPoolExecutor(max_workers=16) as ex:
        futures = [ex.submit(_scan_one, e) for e in scan_list]
        for fut in concurrent.futures.as_completed(futures):
            try:
                matches = fut.result()
                all_results.extend(matches)
            except Exception:
                pass

    # Sort by score
    all_results.sort(key=lambda x: x.get("ai_conviction_score", 0), reverse=True)

    # Update scan state for matched symbols
    matched_syms = {r["symbol"] for r in all_results}
    now = time.time()
    with _STATE_LOCK:
        for r in all_results:
            sym = r["symbol"]
            _PATTERN_SCAN_STATE[sym] = {
                "tier": "ACTIVE",
                "last_ts": now,
                "next_ts": now + _PATTERN_TIER_COOLDOWNS["ACTIVE"],
                "patterns": [r2["pattern_type"] for r2 in all_results if r2["symbol"] == sym],
            }

    # Metadata
    pattern_counts: Dict[str, int] = {}
    for r in all_results:
        pt = r["pattern_type"]
        pattern_counts[pt] = pattern_counts.get(pt, 0) + 1

    metadata = {
        "total_patterns": len(all_results),
        "total_symbols_with_patterns": len(matched_syms),
        "pattern_breakdown": pattern_counts,
        "elite_count": sum(1 for r in all_results if r.get("ai_conviction_score", 0) >= 82),
        "high_conviction_count": sum(1 for r in all_results if 70 <= r.get("ai_conviction_score", 0) < 82),
        "scan_duration_seconds": round(time.time() - t0, 2),
        "last_scan_time": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime()),
        "scheduler_mode": "QUICK_SCAN" if quick else "FULL_SCAN",
    }

    with _CACHE_LOCK:
        _CACHE["timestamp"] = time.time()
        _CACHE["data"] = all_results
        _CACHE["metadata"] = metadata

    _save_disk_cache()
    _save_pattern_state()

    logger.info(
        f"[PatternEngine] Scan done in {metadata['scan_duration_seconds']}s — "
        f"{len(all_results)} patterns across {len(matched_syms)} symbols. "
        f"Breakdown: {pattern_counts}"
    )

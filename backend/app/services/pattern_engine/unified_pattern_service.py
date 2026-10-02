"""
Alpha India — Unified Pattern Intelligence Service
===================================================
Unifies institutional pattern signals across:
  1. Cup & Handle Detection Engine (Stage 1-8 AI Conviction)
  2. Multi-Pattern Engine (Flat Base, Ascending Triangle, Double Bottom, Bull Flag, HTF)

Provides instant lookup for:
  - Techno-Funda Screener filtering & badges
  - Stock Analysis Engine (setup score boosting, pivot calibration, risk/reward alignment)
  - Interactive Chart Overlays & Blueprint synchronization
"""

from __future__ import annotations

import json
import logging
import threading
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("alpha_india.unified_pattern_service")

# Cache paths
DATA_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data"
CUP_CACHE_FILE = DATA_DIR / "cup_handle_cache.json"
PAT_CACHE_FILE = DATA_DIR / "pattern_engine_cache.json"

_UNIFIED_CACHE: Dict[str, List[Dict[str, Any]]] = {}
_LAST_SYNC_TS: float = 0.0
_SYNC_LOCK = threading.Lock()
_CACHE_TTL = 300  # 5 minutes


class UnifiedPatternService:
    """
    Central hub bridging pattern detection engines with the Techno-Funda engine.
    """

    @classmethod
    def _sync_caches_if_needed(cls, force: bool = False) -> None:
        global _UNIFIED_CACHE, _LAST_SYNC_TS
        now = time.time()
        if not force and _UNIFIED_CACHE and (now - _LAST_SYNC_TS) < _CACHE_TTL:
            return

        with _SYNC_LOCK:
            if not force and _UNIFIED_CACHE and (now - _LAST_SYNC_TS) < _CACHE_TTL:
                return

            new_cache: Dict[str, List[Dict[str, Any]]] = {}

            # 1. Ingest Cup & Handle patterns
            try:
                if CUP_CACHE_FILE.exists():
                    with open(CUP_CACHE_FILE, "r", encoding="utf-8") as f:
                        cup_data = json.load(f)
                    items = cup_data.get("data", []) if isinstance(cup_data, dict) else []
                    for item in items:
                        sym = str(item.get("symbol", "")).strip().upper()
                        if not sym:
                            continue
                        cup = item.get("cup") or {}
                        handle = item.get("handle") or {}
                        score = int(item.get("ai_conviction_score") or 0)
                        tier = str(item.get("conviction_tier") or "ACTIVE")
                        pivot = float(item.get("pivot_buy_point") or 0.0)
                        stop = float(item.get("stop_loss_tight") or item.get("stop_loss_wide") or 0.0)
                        t1 = float(item.get("target_1") or 0.0)
                        t2 = float(item.get("target_2") or 0.0)
                        depth = float(cup.get("depth_pct") or 0.0)
                        width = float(cup.get("width_weeks") or 0.0)
                        rr = float(item.get("risk_reward") or 2.5)

                        standard_item: Dict[str, Any] = {
                            "symbol": sym,
                            "company_name": item.get("company_name", sym),
                            "pattern_type": "CUP_WITH_HANDLE",
                            "pattern_label": "Cup with Handle",
                            "score": score,
                            "conviction_tier": tier,
                            "pivot_buy_point": round(pivot, 2) if pivot else None,
                            "stop_loss": round(stop, 2) if stop else None,
                            "target_1": round(t1, 2) if t1 else None,
                            "target_2": round(t2, 2) if t2 else None,
                            "depth_pct": round(depth, 1),
                            "width_weeks": round(width, 1),
                            "risk_reward": round(rr, 1),
                            "status": "CONFIRMED" if score >= 80 else "ACTIVE",
                            "summary_notes": (
                                f"High-conviction Cup & Handle ({tier} Tier, Score {score}/100). "
                                f"Base depth {depth:.1f}%, base width {width:.0f} weeks. "
                                f"Handle contraction with breakout pivot at Rs.{pivot:.2f}."
                            ),
                            "metrics": {
                                "cup_depth_pct": depth,
                                "cup_width_weeks": width,
                                "symmetry_score": cup.get("symmetry_score", 0),
                                "handle_depth_pct": handle.get("depth_pct", 0),
                                "handle_width_weeks": handle.get("width_weeks", 0),
                                "volume_contracting": handle.get("volume_contracting", True),
                            },
                        }
                        new_cache.setdefault(sym, []).append(standard_item)
            except Exception as e:
                logger.error(f"[UnifiedPatternService] Failed to load Cup & Handle cache: {e}")

            # 2. Ingest Multi-Pattern Engine (Flat Base, Ascending Triangle, Double Bottom, Bull Flag, HTF)
            try:
                if PAT_CACHE_FILE.exists():
                    with open(PAT_CACHE_FILE, "r", encoding="utf-8") as f:
                        pat_data = json.load(f)
                    items = pat_data.get("data", []) if isinstance(pat_data, dict) else []
                    for item in items:
                        sym = str(item.get("symbol", "")).strip().upper()
                        if not sym:
                            continue
                        pt = str(item.get("pattern_type", "CHART_PATTERN"))
                        label = str(item.get("pattern_label", pt.replace("_", " ").title()))
                        score = int(item.get("ai_conviction_score") or 0)
                        tier = str(item.get("conviction_tier") or "ACTIVE")
                        pivot = float(item.get("pivot_buy_point") or 0.0)
                        stop = float(item.get("stop_loss") or 0.0)
                        t1 = float(item.get("target_1") or 0.0)
                        t2 = float(item.get("target_2") or 0.0)
                        depth = float(item.get("pattern_depth_pct") or 0.0)
                        width = float(item.get("pattern_width_weeks") or 0.0)
                        rr = float(item.get("risk_reward") or 2.5)

                        standard_item = {
                            "symbol": sym,
                            "company_name": item.get("company_name", sym),
                            "pattern_type": pt,
                            "pattern_label": label,
                            "score": score,
                            "conviction_tier": tier,
                            "pivot_buy_point": round(pivot, 2) if pivot else None,
                            "stop_loss": round(stop, 2) if stop else None,
                            "target_1": round(t1, 2) if t1 else None,
                            "target_2": round(t2, 2) if t2 else None,
                            "depth_pct": round(depth, 1),
                            "width_weeks": round(width, 1),
                            "risk_reward": round(rr, 1),
                            "status": item.get("breakout_status", "CONFIRMED"),
                            "summary_notes": (
                                f"Institutional {label} ({tier} Tier, Score {score}/100). "
                                f"Base depth {depth:.1f}%, duration {width:.0f} weeks. "
                                f"Breakout pivot target at Rs.{pivot:.2f}."
                            ),
                            "metrics": item.get("pattern_metrics", {}),
                        }
                        new_cache.setdefault(sym, []).append(standard_item)
            except Exception as e:
                logger.error(f"[UnifiedPatternService] Failed to load Multi-Pattern cache: {e}")

            # Sort patterns for each symbol by conviction score descending
            for sym, pat_list in new_cache.items():
                pat_list.sort(key=lambda x: x.get("score", 0), reverse=True)

            _UNIFIED_CACHE = new_cache
            _LAST_SYNC_TS = now
            logger.info(
                f"[UnifiedPatternService] Cache synchronized: {len(_UNIFIED_CACHE)} symbols have active patterns."
            )

    @classmethod
    def get_all_patterns_map(cls, force_refresh: bool = False) -> Dict[str, List[Dict[str, Any]]]:
        """Returns the dictionary of all symbols mapping to their detected patterns."""
        cls._sync_caches_if_needed(force=force_refresh)
        return dict(_UNIFIED_CACHE)

    @classmethod
    def get_patterns_for_symbol(
        cls, symbol: str, run_if_missing: bool = False
    ) -> List[Dict[str, Any]]:
        """
        Retrieves all identified patterns for a symbol.
        If missing and run_if_missing=True, executes on-demand analysis.
        """
        cls._sync_caches_if_needed()
        clean_sym = symbol.strip().upper()
        if clean_sym in _UNIFIED_CACHE:
            return _UNIFIED_CACHE[clean_sym]

        if not run_if_missing:
            return []

        # Run on-demand analysis if requested
        on_demand_patterns: List[Dict[str, Any]] = []

        # Try multi-pattern engine
        try:
            from app.services.pattern_engine.pattern_orchestrator import analyze_all_patterns
            multi = analyze_all_patterns(clean_sym)
            for m in multi:
                pt = m.get("pattern_type")
                label = m.get("pattern_label", pt)
                score = int(m.get("ai_conviction_score") or 0)
                tier = str(m.get("conviction_tier") or "ACTIVE")
                pivot = float(m.get("pivot_buy_point") or 0.0)
                stop = float(m.get("stop_loss") or 0.0)
                t1 = float(m.get("target_1") or 0.0)
                t2 = float(m.get("target_2") or 0.0)
                depth = float(m.get("pattern_depth_pct") or 0.0)
                width = float(m.get("pattern_width_weeks") or 0.0)
                rr = float(m.get("risk_reward") or 2.5)

                on_demand_patterns.append({
                    "symbol": clean_sym,
                    "company_name": clean_sym,
                    "pattern_type": pt,
                    "pattern_label": label,
                    "score": score,
                    "conviction_tier": tier,
                    "pivot_buy_point": round(pivot, 2) if pivot else None,
                    "stop_loss": round(stop, 2) if stop else None,
                    "target_1": round(t1, 2) if t1 else None,
                    "target_2": round(t2, 2) if t2 else None,
                    "depth_pct": round(depth, 1),
                    "width_weeks": round(width, 1),
                    "risk_reward": round(rr, 1),
                    "status": m.get("breakout_status", "CONFIRMED"),
                    "summary_notes": f"On-demand detected {label} with conviction {score}/100.",
                    "metrics": m.get("pattern_metrics", {}),
                })
        except Exception as e:
            logger.debug(f"[UnifiedPatternService] On-demand multi-pattern error for {clean_sym}: {e}")

        # Try cup & handle engine
        try:
            from app.services.cup_handle.cup_handle_engine import analyze_symbol as analyze_cup
            cup_res = analyze_cup(clean_sym)
            if cup_res:
                score = int(cup_res.get("ai_conviction_score") or 0)
                tier = str(cup_res.get("conviction_tier") or "ACTIVE")
                pivot = float(cup_res.get("pivot_buy_point") or 0.0)
                stop = float(cup_res.get("stop_loss_tight") or 0.0)
                t1 = float(cup_res.get("target_1") or 0.0)
                t2 = float(cup_res.get("target_2") or 0.0)
                cup_obj = cup_res.get("cup") or {}
                handle_obj = cup_res.get("handle") or {}
                depth = float(cup_obj.get("depth_pct") or 0.0)
                width = float(cup_obj.get("width_weeks") or 0.0)
                rr = float(cup_res.get("risk_reward") or 2.5)

                on_demand_patterns.append({
                    "symbol": clean_sym,
                    "company_name": clean_sym,
                    "pattern_type": "CUP_WITH_HANDLE",
                    "pattern_label": "Cup with Handle",
                    "score": score,
                    "conviction_tier": tier,
                    "pivot_buy_point": round(pivot, 2) if pivot else None,
                    "stop_loss": round(stop, 2) if stop else None,
                    "target_1": round(t1, 2) if t1 else None,
                    "target_2": round(t2, 2) if t2 else None,
                    "depth_pct": round(depth, 1),
                    "width_weeks": round(width, 1),
                    "risk_reward": round(rr, 1),
                    "status": "CONFIRMED",
                    "summary_notes": f"On-demand detected Cup with Handle with conviction {score}/100.",
                    "metrics": {
                        "cup_depth_pct": depth,
                        "cup_width_weeks": width,
                        "handle_depth_pct": handle_obj.get("depth_pct", 0),
                    },
                })
        except Exception as e:
            logger.debug(f"[UnifiedPatternService] On-demand cup & handle error for {clean_sym}: {e}")

        if on_demand_patterns:
            on_demand_patterns.sort(key=lambda x: x.get("score", 0), reverse=True)
            with _SYNC_LOCK:
                _UNIFIED_CACHE[clean_sym] = on_demand_patterns

        return on_demand_patterns

    @classmethod
    def get_primary_pattern_for_symbol(
        cls, symbol: str, run_if_missing: bool = False
    ) -> Optional[Dict[str, Any]]:
        """
        Returns the highest conviction pattern for the given symbol, or None if none identified.
        """
        patterns = cls.get_patterns_for_symbol(symbol, run_if_missing=run_if_missing)
        return patterns[0] if patterns else None

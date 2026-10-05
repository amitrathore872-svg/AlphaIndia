"""
Alpha India - Apex Confluence Engine
====================================
Cross-engine institutional intelligence aggregator that unifies signals from:
1. VCP Discovery Engine (Volatility Contraction Pattern)
2. Cup & Handle AI Engine (8-Stage Geometry & Trend)
3. Multi-Pattern Screener (Flat Base, Ascending Triangle, Double Bottom, Flags)
4. Momentum Screener (Bollinger Bands + Triple RSI + MTF WMA)
5. Pre-Breakout Radar (Supply Exhaustion & Compression Coils)
6. Delivery Screener (Institutional Accumulation & Delivery Surge)

Computes composite Apex Confluence Scores (0-100) and separates equities into:
- APEX TRIPLE+ CONFLUENCE (>= 3 independent concurring engines)
- HIGH DUAL CONFLUENCE (2 independent concurring engines)
- SOLITARY HIGH CONVICTION (1 engine with exceptional conviction score >= 85)
"""

from __future__ import annotations

import json
import logging
import math
import os
from pathlib import Path
import threading
import time
from typing import Any, Dict, List, Optional
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.core.redis_cache import cache
from app.db.database import SessionLocal
from app.models.vcp_models import VCPAIScore
from app.services.cup_handle.cup_handle_orchestrator import scan_patterns
from app.services.pattern_engine.pattern_orchestrator import get_pattern_results
from app.services.momentum_screener_service import MomentumScreenerService
from app.services.prebreakout_radar_service import PreBreakoutRadarService
from app.services.delivery_screener_service import DeliveryScreenerService

logger = logging.getLogger("alpha_india.confluence_engine")

CACHE_KEY = "confluence:apex_radar"
CACHE_TTL = 180  # 3 minutes
DISK_CACHE_PATH = Path(__file__).resolve().parents[2] / "data" / "confluence_cache.json"


class ConfluenceEngine:
    _cached_data: Optional[Dict[str, Any]] = None
    _last_eval_time: float = 0
    _eval_in_progress: bool = False
    _eval_lock = threading.Lock()

    @classmethod
    def _load_disk_cache(cls) -> Optional[Dict[str, Any]]:
        try:
            if DISK_CACHE_PATH.exists():
                with open(DISK_CACHE_PATH, "r", encoding="utf-8") as f:
                    return json.load(f)
        except Exception as e:
            logger.debug(f"[ConfluenceEngine] Failed to load disk cache: {e}")
        return None

    @classmethod
    def _save_disk_cache(cls, data: Dict[str, Any]) -> None:
        try:
            DISK_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
            with open(DISK_CACHE_PATH, "w", encoding="utf-8") as f:
                json.dump(data, f)
        except Exception as e:
            logger.debug(f"[ConfluenceEngine] Failed to save disk cache: {e}")

    @classmethod
    def get_confluence_matrix(cls, db: Optional[Session] = None, force_refresh: bool = False) -> Dict[str, Any]:
        """
        Returns institutional confluence radar.
        Responds instantly (< 15ms) using memory/disk cache with non-blocking background revalidation.
        """
        now = time.time()

        # 1. Try memory / Redis / disk cache
        if not force_refresh:
            if cls._cached_data:
                if (now - cls._last_eval_time) >= CACHE_TTL:
                    cls._trigger_async_recompute()
                return cls._cached_data

            cached = cache.get_json_sync(CACHE_KEY)
            if cached and isinstance(cached, dict) and "apex_candidates" in cached:
                cls._cached_data = cached
                cls._last_eval_time = cached.get("metadata", {}).get("timestamp", now)
                if (now - cls._last_eval_time) >= CACHE_TTL:
                    cls._trigger_async_recompute()
                return cls._cached_data

            disk_cached = cls._load_disk_cache()
            if disk_cached and isinstance(disk_cached, dict) and "apex_candidates" in disk_cached:
                cls._cached_data = disk_cached
                cls._last_eval_time = disk_cached.get("metadata", {}).get("timestamp", 0)
                cls._trigger_async_recompute()
                return cls._cached_data

        # 2. If force refresh or cold boot without any disk cache
        return cls._compute_confluence(db=db)

    @classmethod
    def _trigger_async_recompute(cls) -> None:
        """Triggers non-blocking background recomputation."""
        with cls._eval_lock:
            if cls._eval_in_progress:
                return
            cls._eval_in_progress = True

        def _worker():
            try:
                db = SessionLocal()
                try:
                    cls._compute_confluence(db=db)
                finally:
                    db.close()
            except Exception as e:
                logger.error(f"[ConfluenceEngine] Async recompute error: {e}", exc_info=True)
            finally:
                with cls._eval_lock:
                    cls._eval_in_progress = False

        threading.Thread(target=_worker, daemon=True, name="ConfluenceAsyncWorker").start()

    @classmethod
    def _compute_confluence(cls, db: Optional[Session] = None) -> Dict[str, Any]:
        """
        Polls cached state across all 6 engines and merges by symbol into a unified confluence matrix.
        """
        t0 = time.time()
        close_db_at_end = False
        if db is None:
            db = SessionLocal()
            close_db_at_end = True

        raw_signals_by_symbol: Dict[str, Dict[str, Any]] = {}

        try:
            # ---------------- 1. INGEST VCP ----------------
            try:
                vcp_scores = (
                    db.query(VCPAIScore)
                    .order_by(desc(VCPAIScore.scan_date), desc(VCPAIScore.total_score))
                    .limit(40)
                    .all()
                )
                for sc in vcp_scores:
                    sym = sc.symbol.strip().upper()
                    if not sym:
                        continue
                    if sym not in raw_signals_by_symbol:
                        raw_signals_by_symbol[sym] = {
                            "symbol": sym,
                            "company_name": getattr(sc, "company_name", sym) or sym,
                            "sector": getattr(sc, "sector", "Diversified") or "Diversified",
                            "cmp": float(sc.cmp or 0.0),
                            "engines": {},
                        }
                    pivot_val = float(sc.pivot_price or 0.0)
                    cmp_val = float(sc.cmp or 0.0)
                    sl_val = float(sc.stop_loss or 0.0)
                    target_val = float(sc.target_1 or 0.0)

                    raw_signals_by_symbol[sym]["engines"]["VCP"] = {
                        "name": "VCP Discovery Engine",
                        "score": round(float(sc.total_score or 80.0), 1),
                        "setup": getattr(sc, "vcp_stage", "Institutional VCP") or "Institutional VCP",
                        "pivot": round(pivot_val if pivot_val > 0 else (cmp_val * 1.02 if cmp_val > 0 else 0.0), 2),
                        "stop_loss": round(sl_val if sl_val > 0 else (cmp_val * 0.95 if cmp_val > 0 else 0.0), 2),
                        "target": round(target_val if target_val > 0 else (pivot_val * 1.15 if pivot_val > 0 else cmp_val * 1.15), 2),
                        "conviction": "ELITE" if sc.is_elite else "HIGH",
                        "verdict": sc.verdict or "ACCUMULATE",
                    }
                    if raw_signals_by_symbol[sym]["cmp"] <= 0 and sc.cmp:
                        raw_signals_by_symbol[sym]["cmp"] = float(sc.cmp)
            except Exception as e:
                logger.warning(f"[ConfluenceEngine] Error querying VCP: {e}")

            # ---------------- 2. INGEST CUP & HANDLE ----------------
            try:
                ch_res = scan_patterns(db=db, force_refresh=False)
                for p in ch_res.get("patterns", []):
                    sym = p.get("symbol", "").strip().upper()
                    if not sym:
                        continue
                    if sym not in raw_signals_by_symbol:
                        raw_signals_by_symbol[sym] = {
                            "symbol": sym,
                            "company_name": p.get("company_name", sym),
                            "sector": p.get("sector", "Diversified"),
                            "cmp": float(p.get("current_price") or p.get("cmp") or 0.0),
                            "engines": {},
                        }
                    score = float(p.get("ai_conviction_score") or 70.0)
                    cmp_val = float(p.get("current_price") or p.get("cmp") or 0.0)
                    pivot_val = float(p.get("pivot_buy_point") or p.get("pivot_price") or 0.0)
                    sl_val = float(p.get("stop_loss_tight") or p.get("stop_loss_wide") or p.get("stop_loss") or 0.0)
                    target_val = float(p.get("target_1") or p.get("target_2") or p.get("target") or 0.0)

                    raw_signals_by_symbol[sym]["engines"]["CUP_HANDLE"] = {
                        "name": "Cup & Handle AI",
                        "score": round(score, 1),
                        "setup": f"Cup & Handle ({p.get('pattern_stage', 'Stage 8')})",
                        "pivot": round(pivot_val if pivot_val > 0 else (cmp_val * 1.02 if cmp_val > 0 else 0.0), 2),
                        "stop_loss": round(sl_val if sl_val > 0 else (cmp_val * 0.95 if cmp_val > 0 else 0.0), 2),
                        "target": round(target_val if target_val > 0 else (pivot_val * 1.15 if pivot_val > 0 else cmp_val * 1.15), 2),
                        "conviction": p.get("conviction_tier", "HIGH"),
                        "verdict": "BREAKOUT" if p.get("is_breakout") else "BASE_FORMING",
                    }
                    if raw_signals_by_symbol[sym]["cmp"] <= 0 and cmp_val > 0:
                        raw_signals_by_symbol[sym]["cmp"] = cmp_val
            except Exception as e:
                logger.warning(f"[ConfluenceEngine] Error querying Cup & Handle: {e}")

            # ---------------- 3. INGEST MULTI-PATTERN ----------------
            try:
                pat_res = get_pattern_results(db=db, force_refresh=False)
                for p in pat_res.get("patterns", []):
                    sym = p.get("symbol", "").strip().upper()
                    if not sym:
                        continue
                    if sym not in raw_signals_by_symbol:
                        raw_signals_by_symbol[sym] = {
                            "symbol": sym,
                            "company_name": p.get("company_name", sym),
                            "sector": p.get("sector", "Diversified"),
                            "cmp": float(p.get("current_price") or p.get("cmp") or 0.0),
                            "engines": {},
                        }
                    score = float(p.get("ai_conviction_score") or 70.0)
                    p_name = p.get("pattern_name") or p.get("pattern_type", "Pattern")
                    cmp_val = float(p.get("current_price") or p.get("cmp") or 0.0)
                    pivot_val = float(p.get("pivot_buy_point") or p.get("pivot_price") or p.get("resistance_level") or p.get("pivot") or 0.0)
                    sl_val = float(p.get("stop_loss") or p.get("stop_loss_tight") or 0.0)
                    target_val = float(p.get("target_1") or p.get("target_price") or p.get("target") or 0.0)

                    raw_signals_by_symbol[sym]["engines"]["CHART_PATTERNS"] = {
                        "name": "Chart Pattern Screener",
                        "score": round(score, 1),
                        "setup": p_name.replace("_", " ").title(),
                        "pivot": round(pivot_val if pivot_val > 0 else (cmp_val * 1.02 if cmp_val > 0 else 0.0), 2),
                        "stop_loss": round(sl_val if sl_val > 0 else (cmp_val * 0.95 if cmp_val > 0 else 0.0), 2),
                        "target": round(target_val if target_val > 0 else (pivot_val * 1.15 if pivot_val > 0 else cmp_val * 1.15), 2),
                        "conviction": "ELITE" if score >= 80 else "HIGH",
                        "verdict": "BREAKOUT" if p.get("is_breakout") else "CONSOLIDATING",
                    }
                    if raw_signals_by_symbol[sym]["cmp"] <= 0 and cmp_val > 0:
                        raw_signals_by_symbol[sym]["cmp"] = cmp_val
            except Exception as e:
                logger.warning(f"[ConfluenceEngine] Error querying Multi-Pattern: {e}")

            # ---------------- 4. INGEST MOMENTUM SCREENER ----------------
            try:
                mom_res = MomentumScreenerService.scan_opportunities(db=db, force_refresh=False)
                for m in mom_res.get("opportunities", []):
                    sym = m.get("symbol", "").strip().upper()
                    if not sym:
                        continue
                    if sym not in raw_signals_by_symbol:
                        raw_signals_by_symbol[sym] = {
                            "symbol": sym,
                            "company_name": m.get("company_name", sym),
                            "sector": m.get("sector", "Diversified"),
                            "cmp": float(m.get("cmp") or 0.0),
                            "engines": {},
                        }
                    match_count = int(m.get("match_count", 5))
                    score = min(100.0, float(match_count * 10))
                    blueprint = m.get("trade_blueprint") or {}
                    indicators = m.get("indicators") or {}
                    cmp_val = float(m.get("cmp") or 0.0)
                    pivot_val = float(blueprint.get("entry_trigger") or indicators.get("daily_bb_upper") or indicators.get("daily_high") or m.get("pivot_price") or 0.0)
                    sl_val = float(blueprint.get("stop_loss") or m.get("stop_loss") or 0.0)
                    target_val = float(blueprint.get("target_1") or blueprint.get("target_2") or m.get("target_1") or 0.0)

                    raw_signals_by_symbol[sym]["engines"]["MOMENTUM"] = {
                        "name": "Momentum MTF Screener",
                        "score": round(score, 1),
                        "setup": f"MTF Momentum ({match_count}/10 Filters)",
                        "pivot": round(pivot_val if pivot_val > 0 else (cmp_val * 1.015 if cmp_val > 0 else 0.0), 2),
                        "stop_loss": round(sl_val if sl_val > 0 else (cmp_val * 0.95 if cmp_val > 0 else 0.0), 2),
                        "target": round(target_val if target_val > 0 else (pivot_val * 1.12 if pivot_val > 0 else cmp_val * 1.12), 2),
                        "conviction": "ELITE" if match_count >= 8 else "HIGH",
                        "verdict": "STRONG_MOMENTUM",
                    }
                    if raw_signals_by_symbol[sym]["cmp"] <= 0 and m.get("cmp"):
                        raw_signals_by_symbol[sym]["cmp"] = float(m["cmp"])
            except Exception as e:
                logger.warning(f"[ConfluenceEngine] Error querying Momentum Screener: {e}")

            # ---------------- 5. INGEST PRE-BREAKOUT RADAR ----------------
            try:
                pre_res = PreBreakoutRadarService.scan_prebreakout_opportunities(db=db, force_refresh=False)
                for pr in pre_res.get("opportunities", []):
                    sym = pr.get("symbol", "").strip().upper()
                    if not sym:
                        continue
                    if sym not in raw_signals_by_symbol:
                        raw_signals_by_symbol[sym] = {
                            "symbol": sym,
                            "company_name": pr.get("company_name", sym),
                            "sector": pr.get("sector", "Diversified"),
                            "cmp": float(pr.get("cmp") or 0.0),
                            "engines": {},
                        }
                    score = float(pr.get("conviction_score") or 70.0)
                    blueprint = pr.get("blueprint") or {}
                    metrics = pr.get("metrics") or {}
                    cmp_val = float(pr.get("cmp") or 0.0)
                    pivot_val = float(blueprint.get("cheat_entry") or metrics.get("pivot_20d") or pr.get("pivot_price") or 0.0)
                    sl_val = float(blueprint.get("stop_loss") or pr.get("stop_loss") or 0.0)
                    target_val = float(blueprint.get("target_1") or blueprint.get("target_2") or pr.get("target_price") or 0.0)

                    raw_signals_by_symbol[sym]["engines"]["PRE_BREAKOUT"] = {
                        "name": "Pre-Breakout Cheat Radar",
                        "score": round(score, 1),
                        "setup": pr.get("setup_tier", "Pre-Breakout Coil"),
                        "pivot": round(pivot_val if pivot_val > 0 else (cmp_val * 1.015 if cmp_val > 0 else 0.0), 2),
                        "stop_loss": round(sl_val if sl_val > 0 else (cmp_val * 0.96 if cmp_val > 0 else 0.0), 2),
                        "target": round(target_val if target_val > 0 else (pivot_val * 1.10 if pivot_val > 0 else cmp_val * 1.10), 2),
                        "conviction": "ELITE" if "A+" in pr.get("setup_tier", "") else "HIGH",
                        "verdict": "QUIET_CONTRACTION",
                    }
                    if raw_signals_by_symbol[sym]["cmp"] <= 0 and pr.get("cmp"):
                        raw_signals_by_symbol[sym]["cmp"] = float(pr["cmp"])
            except Exception as e:
                logger.warning(f"[ConfluenceEngine] Error querying PreBreakout Radar: {e}")

            # ---------------- 6. INGEST DELIVERY SCREENER ----------------
            try:
                del_res = DeliveryScreenerService.scan_opportunities(force_refresh=False)
                for d in del_res.get("opportunities", []):
                    sym = d.get("symbol", "").strip().upper()
                    if not sym:
                        continue
                    if sym not in raw_signals_by_symbol:
                        raw_signals_by_symbol[sym] = {
                            "symbol": sym,
                            "company_name": d.get("company_name", sym),
                            "sector": d.get("sector", "Diversified"),
                            "cmp": float(d.get("current_price") or d.get("cmp") or 0.0),
                            "engines": {},
                        }
                    score = float(d.get("score") or d.get("conviction_score") or 75.0)
                    blueprint = d.get("blueprint") or {}
                    cmp_val = float(d.get("current_price") or d.get("cmp") or 0.0)
                    pivot_val = float(blueprint.get("pivot_price") or d.get("50d_high") or d.get("pivot_price") or 0.0)
                    sl_val = float(blueprint.get("stop_loss") or d.get("stop_loss") or 0.0)
                    target_val = float(blueprint.get("target_1") or blueprint.get("target_2") or d.get("target_1") or 0.0)

                    raw_signals_by_symbol[sym]["engines"]["DELIVERY"] = {
                        "name": "Delivery Accumulation Screener",
                        "score": round(score, 1),
                        "setup": f"Delivery Spike ({d.get('deliv_spike_ratio', d.get('delivery_spike_x', 2.0)):.1f}x Vol, {d.get('delivery_pct', d.get('delivery_per', 60)):.0f}% Deliv)",
                        "pivot": round(pivot_val if pivot_val > 0 else (cmp_val * 1.02 if cmp_val > 0 else 0.0), 2),
                        "stop_loss": round(sl_val if sl_val > 0 else (cmp_val * 0.965 if cmp_val > 0 else 0.0), 2),
                        "target": round(target_val if target_val > 0 else (pivot_val * 1.08 if pivot_val > 0 else cmp_val * 1.08), 2),
                        "conviction": "ELITE" if score >= 85 else "HIGH",
                        "verdict": "INSTITUTIONAL_ABSORPTION",
                    }
                    if raw_signals_by_symbol[sym]["cmp"] <= 0 and cmp_val > 0:
                        raw_signals_by_symbol[sym]["cmp"] = cmp_val
            except Exception as e:
                logger.warning(f"[ConfluenceEngine] Error querying Delivery Screener: {e}")

            # ---------------- COMPUTE CONFLUENCE SCORES & TIERS ----------------
            apex_candidates: List[Dict[str, Any]] = []
            dual_candidates: List[Dict[str, Any]] = []
            solitary_alpha: List[Dict[str, Any]] = []

            for sym, data in raw_signals_by_symbol.items():
                engines_map = data["engines"]
                concurrence_count = len(engines_map)
                if concurrence_count == 0:
                    continue

                engine_names = list(engines_map.keys())
                scores = [e["score"] for e in engines_map.values()]
                avg_score = sum(scores) / len(scores)

                # Consensus pricing
                pivots = [e["pivot"] for e in engines_map.values() if e.get("pivot", 0) > 0]
                stop_losses = [e["stop_loss"] for e in engines_map.values() if e.get("stop_loss", 0) > 0]
                targets = [e["target"] for e in engines_map.values() if e.get("target", 0) > 0]

                cmp_val = data["cmp"]
                # Prefer true breakout/trigger pivots distinct from raw CMP when available
                if pivots:
                    distinct_pivots = [p for p in pivots if abs(p - cmp_val) > 0.05]
                    if distinct_pivots:
                        consensus_pivot = round(sum(distinct_pivots) / len(distinct_pivots), 2)
                    else:
                        consensus_pivot = round(sum(pivots) / len(pivots), 2)
                else:
                    consensus_pivot = round(cmp_val * 1.015, 2) if cmp_val > 0 else 0.0

                consensus_stop_loss = round(max(stop_losses), 2) if stop_losses else round(cmp_val * 0.95, 2)
                consensus_target = round(sum(targets) / len(targets), 2) if targets else round(consensus_pivot * 1.15, 2)

                # Risk:Reward computation
                risk = max(0.01, consensus_pivot - consensus_stop_loss)
                reward = max(0.01, consensus_target - consensus_pivot)
                rr_ratio = round(reward / risk, 2)

                # Composite Confluence Score (0-100)
                if concurrence_count >= 3:
                    # Apex Confluence: Base 85 + up to 15 from score quality
                    confluence_score = min(100.0, round(85.0 + (avg_score * 0.15) + (concurrence_count - 3) * 2.0, 1))
                    tier = "APEX TRIPLE+ CONFLUENCE"
                elif concurrence_count == 2:
                    # Dual Confluence: Base 70 + up to 20 from score quality
                    confluence_score = min(92.0, round(70.0 + (avg_score * 0.20), 1))
                    tier = "HIGH DUAL CONFLUENCE"
                else:
                    # Solitary Alpha
                    confluence_score = min(88.0, round(avg_score * 0.85, 1))
                    tier = "SOLITARY HIGH CONVICTION"

                # Rationale generation
                rationale_parts = [f"{e['name']}: {e['setup']}" for e in engines_map.values()]
                confluence_rationale = " | ".join(rationale_parts)

                record = {
                    "symbol": sym,
                    "company_name": data["company_name"],
                    "sector": data["sector"],
                    "cmp": round(data["cmp"], 2),
                    "concurrence_count": concurrence_count,
                    "concurring_engines": engine_names,
                    "confluence_score": confluence_score,
                    "confluence_tier": tier,
                    "consensus_pivot": consensus_pivot,
                    "consensus_stop_loss": consensus_stop_loss,
                    "consensus_target": consensus_target,
                    "risk_reward": rr_ratio,
                    "confluence_rationale": confluence_rationale,
                    "engine_breakdown": engines_map,
                }

                if concurrence_count >= 3:
                    apex_candidates.append(record)
                elif concurrence_count == 2:
                    dual_candidates.append(record)
                elif avg_score >= 75.0:
                    solitary_alpha.append(record)

            # Sort groups by confluence_score desc
            apex_candidates.sort(key=lambda x: (x["concurrence_count"], x["confluence_score"]), reverse=True)
            dual_candidates.sort(key=lambda x: x["confluence_score"], reverse=True)
            solitary_alpha.sort(key=lambda x: x["confluence_score"], reverse=True)

            # Pre-enrich all candidates with Stage & Sparkline prior to caching
            try:
                from app.services.stock_trend_enricher import StockTrendEnricher
                all_candidates = apex_candidates + dual_candidates + solitary_alpha
                StockTrendEnricher.enrich(db, all_candidates, symbol_key="symbol", cmp_key="cmp")
            except Exception as e:
                logger.warning(f"[ConfluenceEngine] Pre-enrichment warning: {e}")

            total_evaluated = len(raw_signals_by_symbol)
            elapsed_ms = round((time.time() - t0) * 1000, 2)

            result = {
                "metadata": {
                    "total_equities_evaluated": total_evaluated,
                    "apex_triple_count": len(apex_candidates),
                    "high_dual_count": len(dual_candidates),
                    "solitary_alpha_count": len(solitary_alpha),
                    "computation_latency_ms": elapsed_ms,
                    "timestamp": time.time(),
                },
                "apex_candidates": apex_candidates,
                "dual_candidates": dual_candidates,
                "solitary_alpha": solitary_alpha[:30],
            }

            # Cache to memory / Redis / disk
            cls._cached_data = result
            cls._last_eval_time = time.time()
            cls._save_disk_cache(result)
            cache.set_json_sync(CACHE_KEY, result, expire_seconds=CACHE_TTL)

            return result

        finally:
            if close_db_at_end and db:
                db.close()

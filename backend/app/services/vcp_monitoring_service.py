"""
Alpha India VCP Monitoring & Priority Scanner Engine
Sprint 36 — On-Demand & Continuous Opportunity Monitoring Architecture
Features:
- Priority Queue (Unusual Volume, Near-Pivot Compression, Catalyst Recency)
- Incremental Candle Cache (O(1) skips for unchanged quotes)
- High-Throughput ThreadPoolExecutor Worker Pool
- Live Progress Telemetry State Machine
"""

from __future__ import annotations

import logging
import math
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, date, timezone, timedelta
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.models.company import Company
from app.models.screener_growth_record import ScreenerGrowthRecord
from app.models.announcement_radar import AnnouncementRadar
from app.models.vcp_models import (
    VCPPattern,
    VolumeAnalysis,
    BreakoutSignal,
    VCPAIScore,
    VCPScanRejection,
)
from app.services.vcp_engine_service import VCPEngineService

logger = logging.getLogger(__name__)


def sanitize_for_json(obj: Any) -> Any:
    """Recursively converts numpy scalars and non-serializable objects to native Python types."""
    if isinstance(obj, dict):
        return {k: sanitize_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [sanitize_for_json(v) for v in obj]
    elif hasattr(obj, "item"):  # numpy.bool_, numpy.float64, numpy.int64
        return obj.item()
    elif isinstance(obj, (bool, int, float, str)) or obj is None:
        return obj
    return str(obj)


class VCPMonitoringService:
    """
    Manages live monitoring, on-demand execution, priority queuing,
    incremental caching, and real-time telemetry.
    """

    # In-memory Telemetry State
    _lock = threading.Lock()
    _status: str = "IDLE"  # IDLE | RUNNING | MONITORING | COMPLETED | ERROR
    _mode: str = "ON_DEMAND"  # ON_DEMAND | CONTINUOUS
    _total_stocks: int = 0
    _stocks_scanned: int = 0
    _remaining_stocks: int = 0
    _opportunities_found: int = 0
    _cached_skipped_count: int = 0
    _scan_start_time: Optional[datetime] = None
    _scan_duration_seconds: float = 0.0
    _throughput_stocks_per_sec: float = 0.0
    _current_symbol: str = ""
    _latest_picks: List[Dict[str, Any]] = []
    _last_updated_timestamp: str = datetime.now(timezone.utc).isoformat()
    _error_message: Optional[str] = None

    # Incremental Cache: { symbol: { "last_price": float, "last_volume": int, "cached_at": datetime } }
    _quote_cache: Dict[str, Dict[str, Any]] = {}

    # Continuous Daemon Control
    _continuous_thread: Optional[threading.Thread] = None
    _stop_continuous_event = threading.Event()
    _is_continuous_active: bool = False

    # ----------------------------------------------------------------------
    # Telemetry Retrieval
    # ----------------------------------------------------------------------
    @classmethod
    def get_progress_telemetry(cls) -> Dict[str, Any]:
        with cls._lock:
            duration = cls._scan_duration_seconds
            if cls._status in ("RUNNING", "MONITORING") and cls._scan_start_time:
                duration = round((datetime.now() - cls._scan_start_time).total_seconds(), 1)

            throughput = 0.0
            if duration > 0 and cls._stocks_scanned > 0:
                throughput = round(cls._stocks_scanned / duration, 1)

            raw = {
                "status": cls._status,
                "mode": cls._mode,
                "is_continuous_active": cls._is_continuous_active,
                "total_stocks": cls._total_stocks,
                "stocks_scanned": cls._stocks_scanned,
                "remaining_stocks": max(0, cls._total_stocks - cls._stocks_scanned),
                "progress_pct": round((cls._stocks_scanned / max(1, cls._total_stocks)) * 100.0, 1),
                "opportunities_found": cls._opportunities_found,
                "cached_skipped_count": cls._cached_skipped_count,
                "scan_duration_seconds": duration,
                "throughput_stocks_per_sec": throughput,
                "current_symbol": cls._current_symbol,
                "latest_picks": cls._latest_picks[:3],
                "last_updated_timestamp": cls._last_updated_timestamp,
                "error_message": cls._error_message,
            }
            return sanitize_for_json(raw)

    # ----------------------------------------------------------------------
    # Priority Queue Builder
    # ----------------------------------------------------------------------
    @classmethod
    def _build_priority_queue(
        cls,
        db: Session,
        limit_candidates: int = 150,
    ) -> List[Tuple[ScreenerGrowthRecord, float]]:
        """
        Builds a prioritized list of candidates:
        - Unusual volume spike (> 1.5x 20DMA) -> +40 pts
        - Pivot proximity (within 3% of pivot) -> +30 pts
        - Stage 2 Momentum (> 50 DMA, near 52W High) -> +15 pts
        - Fresh announcement / filing within 48 hours -> +15 pts
        """
        records = (
            db.query(ScreenerGrowthRecord)
            .filter(
                ScreenerGrowthRecord.current_price != None,
                ScreenerGrowthRecord.current_price >= 50.0,
                ScreenerGrowthRecord.market_cap != None,
                ScreenerGrowthRecord.market_cap >= 500.0,
                ScreenerGrowthRecord.dma_50 != None,
                ScreenerGrowthRecord.high_52_week != None,
                ScreenerGrowthRecord.high_52_week > 0,
                ScreenerGrowthRecord.current_price >= ScreenerGrowthRecord.high_52_week * 0.75,
                ScreenerGrowthRecord.current_price > ScreenerGrowthRecord.dma_50,
            )
            .all()
        )

        prioritized: List[Tuple[ScreenerGrowthRecord, float]] = []

        # Map recent catalyst symbols
        cutoff = datetime.now() - timedelta(days=2)
        recent_catalyst_syms = set(
            row[0]
            for row in db.query(AnnouncementRadar.symbol)
            .filter(AnnouncementRadar.announcement_date >= cutoff)
            .all()
            if row[0]
        )

        for rec in records:
            priority = 0.0
            cmp = rec.current_price or 0.0
            high_52 = rec.high_52_week or 0.0
            dma_50 = rec.dma_50 or 0.0

            # Proximity to 52-week high / pivot
            if high_52 > 0 and cmp > 0:
                dist_pct = ((high_52 - cmp) / high_52) * 100.0
                if dist_pct <= 3.0:
                    priority += 35.0
                elif dist_pct <= 8.0:
                    priority += 20.0

            # Stage 2 trend strength
            if cmp > dma_50:
                priority += 15.0

            # Recent catalyst bonus
            if rec.symbol in recent_catalyst_syms:
                priority += 20.0

            # Fundamental health baseline
            priority += (rec.health_score or 50.0) * 0.2

            prioritized.append((rec, priority))

        # Sort descending by priority score and limit
        prioritized.sort(key=lambda x: x[1], reverse=True)
        return prioritized[:limit_candidates]

    # ----------------------------------------------------------------------
    # Incremental Cache Check
    # ----------------------------------------------------------------------
    @classmethod
    def _is_unchanged(cls, record: ScreenerGrowthRecord) -> bool:
        """
        O(1) check: returns True if the stock's price and volume haven't changed
        since the last scan within the last 15 minutes.
        """
        sym = record.symbol.strip().upper()
        now = datetime.now()

        if sym not in cls._quote_cache:
            return False

        cached = cls._quote_cache[sym]
        age_seconds = (now - cached["cached_at"]).total_seconds()

        # Re-scan if cached data is older than 15 minutes (900 seconds)
        if age_seconds > 900:
            return False

        cmp = record.current_price or 0.0
        # Check price equality
        if abs(cached["last_price"] - cmp) < 0.01:
            return True

        return False

    @classmethod
    def _update_cache(cls, record: ScreenerGrowthRecord):
        sym = record.symbol.strip().upper()
        cls._quote_cache[sym] = {
            "last_price": record.current_price or 0.0,
            "cached_at": datetime.now(),
        }

    # ----------------------------------------------------------------------
    # Scan Execution Engine (Single Pass)
    # ----------------------------------------------------------------------
    @classmethod
    def execute_scan_pass(
        cls,
        mode: str = "TODAY_BREAKOUT",
        limit_candidates: int = 120,
        use_cache: bool = True,
    ) -> List[Dict[str, Any]]:
        """
        High-throughput parallelized pass using Priority Queue & Incremental Cache.
        """
        db = SessionLocal()
        try:
            with cls._lock:
                cls._status = "RUNNING"
                cls._scan_start_time = datetime.now()
                cls._stocks_scanned = 0
                cls._cached_skipped_count = 0
                cls._opportunities_found = 0
                cls._error_message = None

            prioritized_records = cls._build_priority_queue(db, limit_candidates)
            total = len(prioritized_records)

            with cls._lock:
                cls._total_stocks = total
                cls._remaining_stocks = total

            opportunities: List[Dict[str, Any]] = []

            # ThreadPoolExecutor for concurrent price history fetches and 8-gate calculations
            def process_candidate(rec_tuple: Tuple[ScreenerGrowthRecord, float]) -> Optional[Dict[str, Any]]:
                rec, _ = rec_tuple
                sym = rec.symbol.strip().upper()

                with cls._lock:
                    cls._current_symbol = sym

                # Check incremental cache
                if use_cache and cls._is_unchanged(rec):
                    with cls._lock:
                        cls._cached_skipped_count += 1
                        cls._stocks_scanned += 1
                        cls._remaining_stocks = max(0, cls._total_stocks - cls._stocks_scanned)
                    return None

                thread_db = SessionLocal()
                try:
                    cmp = rec.current_price or 0.0
                    hist = VCPEngineService._fetch_price_history(sym, cmp=cmp)

                    # Gate 1: Trend
                    p1, trend_score, _, _ = VCPEngineService.evaluate_trend_gate(rec, hist)
                    if not p1:
                        cls._update_cache(rec)
                        return None

                    # Gate 2: VCP
                    p2, vcp_score, vcp_details, _ = VCPEngineService.evaluate_vcp_gate(hist, cmp)
                    if not p2:
                        cls._update_cache(rec)
                        return None

                    # Gate 3: Volume Dry-Up
                    p3, vol_score, vol_details, _ = VCPEngineService.evaluate_volume_dryup_gate(hist, rec)
                    if not p3:
                        cls._update_cache(rec)
                        return None

                    # Gate 4: Pivot
                    pivot_info = VCPEngineService.identify_pivot_point(cmp, vcp_details, hist)

                    # Gate 5: Breakout
                    is_breakout_mode = (mode == "TODAY_BREAKOUT")
                    p5, breakout_score, breakout_details, _ = VCPEngineService.evaluate_breakout_gate(
                        hist, pivot_info["pivot_price"], is_today_breakout_mode=is_breakout_mode
                    )
                    if not p5 and is_breakout_mode:
                        cls._update_cache(rec)
                        return None

                    # Gates 6-8: Inst, Fund, Catalyst
                    inst_score, inst_details = VCPEngineService.evaluate_institutional_gate(sym, rec, thread_db)
                    growth_score, fund_details = VCPEngineService.evaluate_fundamentals_gate(rec)
                    cat_score, cat_details = VCPEngineService.evaluate_catalyst_gate(sym, rec, thread_db)

                    # Total Composite Score
                    total_score = round(
                        (trend_score * 0.15)
                        + (vcp_score * 0.20)
                        + (vol_score * 0.20)
                        + (breakout_score * 0.20)
                        + (inst_score * 0.10)
                        + (growth_score * 0.10)
                        + (cat_score * 0.05),
                        1,
                    )

                    cls._update_cache(rec)

                    min_score = 88.0 if is_breakout_mode else 82.0
                    if total_score < min_score:
                        return None

                    is_elite = total_score >= 95.0
                    verdict = "Elite VCP Breakout" if is_elite else ("High Conviction Breakout" if is_breakout_mode else "Pre-Breakout Coiling")

                    entry_low = round(pivot_info["pivot_price"] * 0.998, 2)
                    entry_high = round(pivot_info["pivot_price"] * 1.015, 2)

                    return {
                        "symbol": sym,
                        "company_name": rec.company_name or sym,
                        "sector": rec.sector or "Diversified",
                        "market_cap": rec.market_cap or 0.0,
                        "cmp": cmp,
                        "pivot_price": pivot_info["pivot_price"],
                        "entry_zone": f"₹{entry_low:.1f}–{entry_high:.1f}",
                        "stop_loss": pivot_info["stop_loss"],
                        "risk_pct": pivot_info["risk_pct"],
                        "target_1": pivot_info["target_1"],
                        "target_2": pivot_info["target_2"],
                        "target_3": pivot_info["target_3"],
                        "reward_risk": pivot_info["reward_risk"],
                        "vcp_stage": vcp_details.get("vcp_stage", "3-Stage VCP"),
                        "contraction_sizes": vcp_details.get("contraction_sizes", []),
                        "wave_volumes": vcp_details.get("wave_volumes", []),
                        "volume_breakout_ratio": breakout_details["breakout_volume_ratio"],
                        "is_20d_max_vol": breakout_details.get("is_20d_max_vol", False),
                        "vol_20d_max_ratio": breakout_details.get("vol_20d_max_ratio", 1.0),
                        "is_strictly_contracting": vcp_details.get("is_strictly_contracting", True),
                        "vol_strictly_contracting": vcp_details.get("vol_strictly_contracting", True),
                        "volume_dryup_pct": int((1.0 - min(1.0, vol_details["dryup_ratio"])) * 100),
                        "trend_score": trend_score,
                        "vcp_score": vcp_score,
                        "volume_score": vol_score,
                        "breakout_score": breakout_score,
                        "institutional_score": inst_score,
                        "growth_score": growth_score,
                        "catalyst_score": cat_score,
                        "final_ai_score": total_score,
                        "verdict": verdict,
                        "confidence": cat_details["confidence"],
                        "time_horizon": cat_details["time_horizon"],
                        "why_selected": [
                            f"Rule 1: {vcp_details.get('vcp_stage', 'VCP structure')} with tightening pullbacks.",
                            f"Rule 2: Volume dry-up ratio {vol_details['dryup_ratio']}x with contracting wave volume.",
                            f"Rule 3: Breakout vol {breakout_details['breakout_volume_ratio']}x (20D High: {'Yes' if breakout_details.get('is_20d_max_vol') else 'Pending'}).",
                            f"Institutional smart money score {inst_details['smart_money_score']}/100.",
                            f"TTM PAT growth +{fund_details['pat_yoy']}% with ROCE {fund_details['roce']}%.",
                        ],
                        "catalyst_summary": cat_details["catalyst_summary"],
                        "expert_consensus": "STRONG ACCUMULATE" if is_elite else ("TACTICAL BUY" if is_breakout_mode else "WATCHLIST"),
                        "mf_holding_change": inst_details["mf_holding_change"],
                        "news_strength": "VERY HIGH" if is_elite else "HIGH",
                        "is_elite": is_elite,
                    }
                except Exception as e:
                    logger.error(f"Error evaluating candidate {sym}: {e}")
                    return None
                finally:
                    thread_db.close()
                    with cls._lock:
                        cls._stocks_scanned += 1
                        cls._remaining_stocks = max(0, cls._total_stocks - cls._stocks_scanned)

            # Parallel execution with 5 worker threads
            with ThreadPoolExecutor(max_workers=5, thread_name_prefix="VCPScanWorker") as executor:
                futures = [executor.submit(process_candidate, rec_tuple) for rec_tuple in prioritized_records]
                for f in as_completed(futures):
                    result = f.result()
                    if result:
                        opportunities.append(result)
                        with cls._lock:
                            cls._opportunities_found = len(opportunities)
                            cls._latest_picks = sorted(opportunities, key=lambda x: x["final_ai_score"], reverse=True)[:3]

            opportunities.sort(key=lambda x: x["final_ai_score"], reverse=True)
            top_picks = opportunities[:3]

            with cls._lock:
                cls._scan_duration_seconds = round((datetime.now() - cls._scan_start_time).total_seconds(), 1) if cls._scan_start_time else 0.0
                cls._status = "COMPLETED" if not cls._is_continuous_active else "MONITORING"
                cls._latest_picks = top_picks
                cls._last_updated_timestamp = datetime.now(timezone.utc).isoformat()

            # Save newly discovered top picks to DB if found
            if top_picks:
                try:
                    scan_date = date.today()
                    for pick in top_picks:
                        sym = pick["symbol"]
                        existing_score = db.query(VCPAIScore).filter(VCPAIScore.symbol == sym, VCPAIScore.scan_date == scan_date).first()
                        if not existing_score:
                            db.add(VCPAIScore(
                                symbol=str(sym),
                                scan_date=scan_date,
                                total_score=float(pick["final_ai_score"]),
                                trend_score=float(pick.get("trend_score", 0.0)),
                                vcp_score=float(pick.get("vcp_score", 0.0)),
                                volume_score=float(pick.get("volume_score", 0.0)),
                                breakout_score=float(pick.get("breakout_score", 0.0)),
                                institutional_score=float(pick.get("institutional_score", 0.0)),
                                growth_score=float(pick.get("growth_score", 0.0)),
                                catalyst_score=float(pick.get("catalyst_score", 0.0)),
                                verdict=str(pick.get("verdict", "")),
                                confidence=float(pick.get("confidence", 90.0)),
                                why_selected=list(pick.get("why_selected", [])),
                                is_elite=bool(pick.get("is_elite", False)),
                                cmp=float(pick.get("cmp", 0.0)),
                                pivot_price=float(pick.get("pivot_price", 0.0)),
                                entry_zone=str(pick.get("entry_zone", "")),
                                stop_loss=float(pick.get("stop_loss", 0.0)),
                                risk_pct=float(pick.get("risk_pct", 0.0)),
                                target_1=float(pick.get("target_1", 0.0)),
                                target_2=float(pick.get("target_2", 0.0)),
                                target_3=float(pick.get("target_3", 0.0)),
                                reward_risk=str(pick.get("reward_risk", "1:3.5")),
                                time_horizon=str(pick.get("time_horizon", "2–8 Weeks")),
                                sector=str(pick.get("sector", "Diversified")),
                                market_cap=float(pick.get("market_cap", 0.0)),
                                mf_holding_change=float(pick.get("mf_holding_change", 0.0)),
                                catalyst_summary=str(pick.get("catalyst_summary", "")),
                            ))
                    db.commit()

                    # Trigger institutional alerts & notifications
                    try:
                        from app.services.alert_dispatch_service import AlertDispatchService
                        for pick in top_picks:
                            AlertDispatchService.trigger_vcp_opportunity_alert(
                                db=db,
                                pick=pick,
                                auto_broadcast=True,
                            )
                    except Exception as alert_err:
                        logger.error(f"Failed to dispatch alerts in monitoring pass: {alert_err}")
                except Exception as e:
                    logger.error(f"Failed to persist live picks: {e}")
                    db.rollback()

            return top_picks
        finally:
            db.close()

    # ----------------------------------------------------------------------
    # On-Demand Trigger (Async Launch)
    # ----------------------------------------------------------------------
    @classmethod
    def trigger_scan_now(cls, mode: str = "TODAY_BREAKOUT") -> Dict[str, Any]:
        """
        Triggers an immediate asynchronous priority scan pass.
        Returns immediately with current state.
        """
        with cls._lock:
            if cls._status == "RUNNING":
                return {
                    "status": "RUNNING",
                    "message": "Scan already in progress. Telemetry active.",
                    "telemetry": cls.get_progress_telemetry(),
                }
            cls._status = "RUNNING"
            cls._mode = "ON_DEMAND"

        # Launch in background worker thread
        t = threading.Thread(
            target=cls.execute_scan_pass,
            args=(mode, 120, False),  # on-demand clears cache check to guarantee fresh evaluation
            daemon=True,
            name="VCPOnDemandWorker",
        )
        t.start()

        return {
            "status": "LAUNCHED",
            "message": "On-demand priority VCP scan launched successfully.",
            "telemetry": cls.get_progress_telemetry(),
        }

    # ----------------------------------------------------------------------
    # Continuous Monitoring Daemon
    # ----------------------------------------------------------------------
    @classmethod
    def start_continuous_monitoring(cls) -> Dict[str, Any]:
        with cls._lock:
            if cls._is_continuous_active:
                return {
                    "status": "ALREADY_ACTIVE",
                    "message": "Continuous Opportunity Monitoring is already running.",
                    "telemetry": cls.get_progress_telemetry(),
                }
            cls._is_continuous_active = True
            cls._mode = "CONTINUOUS"
            cls._status = "MONITORING"
            cls._stop_continuous_event.clear()

        cls._continuous_thread = threading.Thread(
            target=cls._continuous_loop,
            daemon=True,
            name="VCPContinuousMonitoringWorker",
        )
        cls._continuous_thread.start()
        logger.info("Continuous VCP Opportunity Monitoring started.")

        return {
            "status": "STARTED",
            "message": "Continuous live monitoring mode started successfully.",
            "telemetry": cls.get_progress_telemetry(),
        }

    @classmethod
    def stop_continuous_monitoring(cls) -> Dict[str, Any]:
        with cls._lock:
            cls._is_continuous_active = False
            cls._stop_continuous_event.set()
            cls._status = "IDLE"

        logger.info("Continuous VCP Opportunity Monitoring stopped.")
        return {
            "status": "STOPPED",
            "message": "Continuous live monitoring mode stopped.",
            "telemetry": cls.get_progress_telemetry(),
        }

    @classmethod
    def _continuous_loop(cls):
        """
        Loops periodically, scanning prioritized candidates with incremental caching.
        """
        while not cls._stop_continuous_event.is_set():
            try:
                # Perform an incremental scan pass
                cls.execute_scan_pass(mode="TODAY_BREAKOUT", limit_candidates=80, use_cache=True)
            except Exception as e:
                logger.error(f"Error in continuous monitoring loop: {e}")
                with cls._lock:
                    cls._error_message = str(e)

            # Sleep 25 seconds between monitoring cycles
            cls._stop_continuous_event.wait(25)

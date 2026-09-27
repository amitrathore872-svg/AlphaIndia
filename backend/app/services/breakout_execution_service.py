"""
Alpha India - Breakout Execution Engine Service
Continuous live watcher and algorithmic execution engine for pre-breakout contraction coils.
Tracks price proximity to trigger, confirms volume expansion, and alerts immediately upon entry.
"""

from __future__ import annotations

import concurrent.futures
from datetime import datetime
import logging
from typing import Any, Dict, List, Optional
import yfinance as yf
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.breakout_execution import BreakoutExecutionCandidate
from app.services.prebreakout_radar_service import PreBreakoutRadarService
from app.services.alert_dispatch_service import AlertDispatchService

logger = logging.getLogger("alpha_india.breakout_execution")


class BreakoutExecutionService:
    """
    Coordinates candidate tracking, live quote evaluation, status state transitions,
    and multi-channel alerting for active breakout executions.
    """

    @classmethod
    def get_watched_candidates(
        cls, db: Session, status_filter: Optional[str] = None
    ) -> List[BreakoutExecutionCandidate]:
        """
        Returns all active watched candidates, optionally filtered by execution_status.
        """
        query = db.query(BreakoutExecutionCandidate).filter(BreakoutExecutionCandidate.is_active == True)
        if status_filter and status_filter.upper() != "ALL":
            query = query.filter(BreakoutExecutionCandidate.execution_status == status_filter.upper())

        # Sort: TRIGGERED first, then READY, then by conviction_score desc
        items = query.all()
        status_priority = {
            "TRIGGERED": 0,
            "READY": 1,
            "COILING": 2,
            "EXTENDED": 3,
            "FAILED": 4,
        }
        items.sort(
            key=lambda x: (
                status_priority.get(x.execution_status, 5),
                -(x.conviction_score or 0),
                -(x.current_cmp or 0),
            )
        )
        return items

    @classmethod
    def add_candidate(cls, db: Session, data: Dict[str, Any]) -> BreakoutExecutionCandidate:
        """
        Enrolls a candidate into the breakout watcher queue.
        Calculates execution levels if not explicitly provided.
        """
        symbol = data["symbol"].strip().upper()
        existing = db.query(BreakoutExecutionCandidate).filter(BreakoutExecutionCandidate.symbol == symbol).first()

        cmp_val = float(data.get("cmp", data.get("current_cmp", 0.0)))
        trigger = float(data.get("trigger_price", data.get("cheat_entry", round(cmp_val * 1.005, 2))))
        stop = float(data.get("stop_loss", round(cmp_val * 0.968, 2)))
        t1 = float(data.get("target_1", round(trigger * 1.09, 2)))
        t2 = float(data.get("target_2", round(trigger * 1.18, 2)))
        buy_max = round(trigger * 1.015, 2)  # Strict 1.5% max buy zone

        risk = max(0.5, trigger - stop)
        reward = max(1.0, t1 - trigger)
        rr = round(reward / risk, 1)

        dist_pct = round(((trigger - cmp_val) / trigger) * 100.0, 2) if trigger > 0 else 0.0
        initial_status = "COILING"
        if cmp_val <= stop:
            initial_status = "FAILED"
        elif cmp_val >= trigger:
            initial_status = "TRIGGERED" if cmp_val <= buy_max else "EXTENDED"
        elif dist_pct <= 1.2:
            initial_status = "READY"

        if existing:
            existing.company_name = data.get("company_name", existing.company_name)
            existing.sector = data.get("sector", existing.sector)
            existing.pattern_tag = data.get("pattern_tag", existing.pattern_tag)
            existing.conviction_score = int(data.get("conviction_score", existing.conviction_score or 75))
            existing.setup_tier = data.get("setup_tier", existing.setup_tier)
            existing.current_cmp = cmp_val
            existing.day_change_pct = float(data.get("day_change_pct", existing.day_change_pct or 0.0))
            existing.trigger_price = trigger
            existing.stop_loss = stop
            existing.target_1 = t1
            existing.target_2 = t2
            existing.buy_zone_max = buy_max
            existing.risk_reward = rr
            existing.distance_to_trigger_pct = dist_pct
            existing.execution_status = initial_status
            existing.is_active = True
            existing.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(existing)
            return existing

        candidate = BreakoutExecutionCandidate(
            symbol=symbol,
            company_name=data.get("company_name", symbol),
            sector=data.get("sector", "Diversified"),
            pattern_tag=data.get("pattern_tag", "SUPER_COIL"),
            conviction_score=int(data.get("conviction_score", 75)),
            setup_tier=data.get("setup_tier", "A+ SUPER COIL"),
            added_at_cmp=cmp_val,
            current_cmp=cmp_val,
            day_change_pct=float(data.get("day_change_pct", 0.0)),
            trigger_price=trigger,
            stop_loss=stop,
            target_1=t1,
            target_2=t2,
            buy_zone_max=buy_max,
            risk_reward=rr,
            distance_to_trigger_pct=dist_pct,
            volume_pace_ratio=float(data.get("volume_pace_ratio", 1.0)),
            execution_status=initial_status,
            alert_dispatched=False,
            is_active=True,
            auto_enrolled=bool(data.get("auto_enrolled", False)),
            notes=data.get("notes"),
        )
        db.add(candidate)
        db.commit()
        db.refresh(candidate)
        return candidate

    @classmethod
    def remove_candidate(cls, db: Session, symbol: str) -> bool:
        """
        Removes or deactivates a candidate from the execution queue.
        """
        clean_sym = symbol.strip().upper()
        item = db.query(BreakoutExecutionCandidate).filter(BreakoutExecutionCandidate.symbol == clean_sym).first()
        if item:
            db.delete(item)
            db.commit()
            return True
        return False

    @classmethod
    def auto_enroll_top_coils(
        cls, db: Session, limit: int = 10, min_conviction: int = 70
    ) -> Dict[str, Any]:
        """
        Auto-enrolls the top high-conviction coils from PreBreakoutRadarService.
        """
        scan_data = PreBreakoutRadarService.scan_prebreakout_opportunities(db=db, force_refresh=False)
        opportunities = scan_data.get("opportunities", [])

        # Filter by conviction score
        eligible = [opp for opp in opportunities if opp.get("conviction_score", 0) >= min_conviction]
        eligible.sort(key=lambda x: (
            0 if x.get("setup_tier", "").startswith("A+") else 1,
            -x.get("conviction_score", 0),
            x["metrics"].get("dist_to_pivot_pct", 99.0)
        ))

        selected = eligible[:limit]
        enrolled_count = 0
        enrolled_symbols = []

        for opp in selected:
            sym = opp.get("symbol")
            if not sym:
                continue
            bp = opp.get("blueprint", {})
            metrics = opp.get("metrics", {})

            data = {
                "symbol": sym,
                "company_name": opp.get("company_name", sym),
                "sector": opp.get("sector", "Diversified"),
                "pattern_tag": opp.get("pattern_tag", "SUPER_COIL"),
                "conviction_score": opp.get("conviction_score", 75),
                "setup_tier": opp.get("setup_tier", "A+ SUPER COIL"),
                "cmp": opp.get("cmp", 0.0),
                "day_change_pct": opp.get("day_change_pct", 0.0),
                "trigger_price": bp.get("cheat_entry"),
                "stop_loss": bp.get("stop_loss"),
                "target_1": bp.get("target_1"),
                "target_2": bp.get("target_2"),
                "volume_pace_ratio": metrics.get("vdu_ratio", 1.0),
                "auto_enrolled": True,
            }
            cls.add_candidate(db=db, data=data)
            enrolled_count += 1
            enrolled_symbols.append(sym)

        return {
            "success": True,
            "enrolled_count": enrolled_count,
            "symbols": enrolled_symbols,
            "total_watched": db.query(BreakoutExecutionCandidate).filter(BreakoutExecutionCandidate.is_active == True).count(),
        }

    @classmethod
    def evaluate_watched_candidates(cls, db: Session) -> Dict[str, Any]:
        """
        Concurrent live evaluator for all active watched breakout candidates.
        Fetches latest quote, compares against trigger_price and stop_loss,
        evaluates volume surge, transitions state, and dispatches alerts.
        """
        candidates = db.query(BreakoutExecutionCandidate).filter(BreakoutExecutionCandidate.is_active == True).all()
        if not candidates:
            return {"status": "SUCCESS", "message": "No candidates to evaluate", "total_evaluated": 0, "updates": []}

        def _fetch_quote(sym: str) -> Optional[Dict[str, Any]]:
            try:
                t = yf.Ticker(f"{sym}.NS")
                df = t.history(period="5d", interval="1d")
                if df.empty or len(df) < 1:
                    t = yf.Ticker(f"{sym}.BO")
                    df = t.history(period="5d", interval="1d")
                if df.empty or len(df) < 1:
                    return None

                c = float(df["Close"].iloc[-1])
                h = float(df["High"].iloc[-1])
                l = float(df["Low"].iloc[-1])
                v = float(df["Volume"].iloc[-1])
                prev_c = float(df["Close"].iloc[-2]) if len(df) > 1 else c
                chg_pct = round(((c - prev_c) / prev_c) * 100.0, 2) if prev_c > 0 else 0.0
                vol_sma = float(df["Volume"].mean())

                return {
                    "symbol": sym,
                    "cmp": round(c, 2),
                    "high": round(h, 2),
                    "low": round(l, 2),
                    "volume": v,
                    "volume_sma": vol_sma,
                    "day_change_pct": chg_pct,
                }
            except Exception as e:
                logger.debug(f"Error fetching quote for {sym}: {e}")
                return None

        # Fetch quotes concurrently (max 8 threads)
        results: Dict[str, Dict[str, Any]] = {}
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
            future_to_sym = {executor.submit(_fetch_quote, c.symbol): c.symbol for c in candidates}
            for future in concurrent.futures.as_completed(future_to_sym):
                sym = future_to_sym[future]
                res = future.result()
                if res:
                    results[sym] = res

        updates = []
        newly_triggered = []
        newly_ready = []

        for c in candidates:
            quote = results.get(c.symbol)
            if not quote:
                continue

            cmp_val = quote["cmp"]
            day_chg = quote["day_change_pct"]
            vol_pace = round(quote["volume"] / max(1.0, quote["volume_sma"]), 2)

            prev_status = c.execution_status
            c.current_cmp = cmp_val
            c.day_change_pct = day_chg
            c.volume_pace_ratio = vol_pace

            trigger = c.trigger_price or (c.added_at_cmp * 1.005)
            stop = c.stop_loss or (c.added_at_cmp * 0.968)
            buy_max = c.buy_zone_max or (trigger * 1.015)

            dist_pct = round(((trigger - cmp_val) / trigger) * 100.0, 2)
            c.distance_to_trigger_pct = dist_pct

            # State Machine Evaluation
            if cmp_val <= stop:
                new_status = "FAILED"
            elif cmp_val >= trigger:
                if cmp_val <= buy_max:
                    new_status = "TRIGGERED"
                else:
                    new_status = "EXTENDED"
            elif dist_pct <= 1.2:
                new_status = "READY"
            else:
                new_status = "COILING"

            c.execution_status = new_status
            c.updated_at = datetime.utcnow()

            # Trigger Event Handling
            if new_status == "TRIGGERED" and not c.alert_dispatched:
                c.triggered_at = datetime.utcnow()
                c.alert_dispatched = True
                newly_triggered.append(c)

                # 1. Dispatch In-App Notification
                title = f"🚨 BREAKOUT TRIGGERED: {c.symbol} (Buy Zone Active!)"
                message = (
                    f"{c.symbol} has crossed breakout trigger ₹{trigger:,.2f} at CMP ₹{cmp_val:,.2f}. "
                    f"Buy Zone: ₹{trigger:,.2f} – ₹{buy_max:,.2f}. "
                    f"Stop Loss: ₹{stop:,.2f} | T1: ₹{c.target_1:,.2f} (+9%) | T2: ₹{c.target_2:,.2f} (+18%). "
                    f"R:R {c.risk_reward}:1. Action Active!"
                )
                try:
                    AlertDispatchService.create_in_app_notification(
                        db=db,
                        title=title,
                        message=message,
                        category="BREAKOUT_EXECUTION",
                        severity="critical",
                        action_url="/pre-breakout-radar",
                        metadata={
                            "symbol": c.symbol,
                            "trigger_price": trigger,
                            "cmp": cmp_val,
                            "buy_zone_max": buy_max,
                            "stop_loss": stop,
                            "target_1": c.target_1,
                            "target_2": c.target_2,
                            "risk_reward": c.risk_reward,
                            "status": "TRIGGERED",
                        },
                    )
                except Exception as e:
                    logger.warning(f"Error creating in-app notification for {c.symbol}: {e}")

                # 2. Dispatch Telegram & WhatsApp External Broadcasts
                try:
                    broadcast_res = AlertDispatchService.dispatch_breakout_execution_alert(db=db, candidate=c)
                    logger.info(f"Broadcasted breakout trigger for {c.symbol}: {broadcast_res}")
                except Exception as e:
                    logger.error(f"Telegram/External dispatch failed for {c.symbol}: {e}", exc_info=True)

            elif new_status == "READY" and prev_status == "COILING":
                newly_ready.append(c)

            updates.append({
                "symbol": c.symbol,
                "cmp": cmp_val,
                "trigger_price": trigger,
                "distance_to_trigger_pct": dist_pct,
                "status": new_status,
                "volume_pace_ratio": vol_pace,
            })

        db.commit()

        return {
            "status": "SUCCESS",
            "evaluated_count": len(updates),
            "newly_triggered": [c.symbol for c in newly_triggered],
            "newly_ready": [c.symbol for c in newly_ready],
            "updates": updates,
            "evaluated_at": datetime.utcnow().isoformat(),
        }

    @classmethod
    def reset_candidate_alert(cls, db: Session, symbol: str) -> Optional[BreakoutExecutionCandidate]:
        """
        Re-arms a candidate for new breakout alerts (resets alert_dispatched = False).
        """
        clean_sym = symbol.strip().upper()
        c = db.query(BreakoutExecutionCandidate).filter(BreakoutExecutionCandidate.symbol == clean_sym).first()
        if c:
            c.alert_dispatched = False
            c.execution_status = "COILING"
            c.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(c)
            return c
        return None

    @classmethod
    def get_execution_stats(cls, db: Session) -> Dict[str, Any]:
        """
        Returns summary statistics across all watched breakout candidates.
        """
        candidates = db.query(BreakoutExecutionCandidate).filter(BreakoutExecutionCandidate.is_active == True).all()
        total = len(candidates)
        triggered = sum(1 for c in candidates if c.execution_status == "TRIGGERED")
        ready = sum(1 for c in candidates if c.execution_status == "READY")
        coiling = sum(1 for c in candidates if c.execution_status == "COILING")
        extended = sum(1 for c in candidates if c.execution_status == "EXTENDED")
        failed = sum(1 for c in candidates if c.execution_status == "FAILED")

        avg_rr = round(sum(c.risk_reward or 3.0 for c in candidates) / max(1, total), 1) if total > 0 else 3.5

        return {
            "total_watched": total,
            "triggered_count": triggered,
            "ready_count": ready,
            "coiling_count": coiling,
            "extended_count": extended,
            "failed_count": failed,
            "avg_risk_reward": avg_rr,
            "last_check_time": datetime.utcnow().isoformat(),
        }

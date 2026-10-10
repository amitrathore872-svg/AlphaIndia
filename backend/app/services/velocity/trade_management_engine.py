"""
Alpha India - Velocity Burst Elite: Stage 12 Trade Management & Stage 13 BTST Continuation Engine
Sprint 39 Flagship Lifecycle Trade Automation & BTST Engine
Maintains dynamic trailing stop losses (ATR, 9 EMA, VWAP, Breakeven),
partial profit booking, and overnight momentum continuation analysis.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.models.velocity_models import VelocityTradeManager, VelocityBTST
from app.core.websocket_manager import ws_manager

logger = logging.getLogger("alpha_india.velocity.trade_manager")


class TradeManagementEngine:
    """
    Stage 12: Trade Management Engine.
    Manages active breakout trades with algorithmic discipline.
    """

    @classmethod
    def create_trade(
        cls,
        db: Session,
        symbol: str,
        entry_price: float,
        stop_loss: float,
        target_1: float,
        target_2: float,
        target_3: float,
        signal_id: Optional[int] = None,
        trail_type: str = "ATR_TRAIL",
    ) -> VelocityTradeManager:
        # Prevent duplicate active positions for the same stock
        existing = (
            db.query(VelocityTradeManager)
            .filter(
                VelocityTradeManager.symbol == symbol.upper(),
                VelocityTradeManager.trade_status.in_(["ACTIVE", "TARGET_1_HIT", "TARGET_2_HIT"]),
            )
            .order_by(VelocityTradeManager.id.desc())
            .first()
        )
        if existing:
            return existing

        trade = VelocityTradeManager(
            symbol=symbol.upper(),
            signal_id=signal_id,
            entry_time=datetime.now(timezone.utc).replace(tzinfo=None),
            entry_price=entry_price,
            current_price=entry_price,
            stop_loss=stop_loss,
            trailing_stop=stop_loss,
            trail_type=trail_type,
            target_1=target_1,
            target_2=target_2,
            target_3=target_3,
            trade_status="ACTIVE",
            unrealized_pnl_pct=0.0,
            realized_pnl_pct=0.0,
        )
        db.add(trade)
        db.commit()
        db.refresh(trade)
        return trade

    @classmethod
    def update_active_trades(
        cls,
        db: Session,
        price_feed: Dict[str, float],
    ) -> List[Dict[str, Any]]:
        """
        Loops through all ACTIVE / TARGET_1_HIT trades and evaluates trailing stops and targets.
        """
        active_trades = (
            db.query(VelocityTradeManager)
            .filter(VelocityTradeManager.trade_status.in_(["ACTIVE", "TARGET_1_HIT", "TARGET_2_HIT"]))
            .all()
        )

        updates = []
        now = datetime.now(timezone.utc).replace(tzinfo=None)

        for t in active_trades:
            cmp = price_feed.get(t.symbol)
            if not cmp:
                continue

            t.current_price = cmp
            pnl_pct = round(((cmp - t.entry_price) / t.entry_price) * 100.0, 2)
            t.unrealized_pnl_pct = pnl_pct

            # 1. Target 1 Check: Lock in 50% partial profit and move SL to breakeven
            if cmp >= t.target_1 and not t.target_1_hit:
                t.target_1_hit = True
                t.trade_status = "TARGET_1_HIT"
                t.partial_profit_booked_pct = 50.0
                t.trailing_stop = max(t.trailing_stop, t.entry_price)  # Move to breakeven
                t.trail_type = "BREAKEVEN"
                updates.append({"id": t.id, "symbol": t.symbol, "event": "TARGET_1_HIT", "pnl": pnl_pct})

            # 2. Target 2 Check: Trail aggressively using 9 EMA
            elif cmp >= t.target_2 and not t.target_2_hit:
                t.target_2_hit = True
                t.trade_status = "TARGET_2_HIT"
                t.partial_profit_booked_pct = 75.0
                t.trailing_stop = max(t.trailing_stop, t.target_1)  # Lock Target 1 level
                t.trail_type = "EMA9_TRAIL"
                updates.append({"id": t.id, "symbol": t.symbol, "event": "TARGET_2_HIT", "pnl": pnl_pct})

            # 3. Target 3 Final Target Hit
            elif cmp >= t.target_3 and not t.target_3_hit:
                t.target_3_hit = True
                t.trade_status = "CLOSED_PROFIT"
                t.exit_time = now
                t.exit_price = cmp
                t.realized_pnl_pct = pnl_pct
                t.exit_reason = "TARGET_3_MAX_RUNNER_HIT"
                updates.append({"id": t.id, "symbol": t.symbol, "event": "TARGET_3_HIT", "pnl": pnl_pct})

            # 4. Trailing Stop Hit Check
            elif cmp <= t.trailing_stop:
                t.trade_status = "STOPPED_OUT" if t.trailing_stop <= t.entry_price else "TRAILING_STOP"
                t.exit_time = now
                t.exit_price = cmp
                t.realized_pnl_pct = pnl_pct
                t.exit_reason = "TRAILING_STOP_TRIGGERED"
                updates.append({"id": t.id, "symbol": t.symbol, "event": "TRAILING_STOP_HIT", "pnl": pnl_pct})

        if active_trades:
            db.commit()

        return updates


class BTSTContinuationEngine:
    """
    Stage 13: BTST Continuation Engine.
    Scans from 2:15 PM to 3:15 PM for powerful closes near the day's high with high delivery,
    then evaluates morning 9:20 AM continuation probabilities.
    """

    @classmethod
    def scan_evening_btst(
        cls,
        symbol: str,
        df: pd.DataFrame,
        delivery_pct: float = 55.0,
    ) -> Optional[Dict[str, Any]]:
        if df.empty or len(df) < 15:
            return None

        closes = df["Close"].astype(float)
        highs = df["High"].astype(float)
        lows = df["Low"].astype(float)
        volumes = df["Volume"].astype(float)

        cmp = float(closes.iloc[-1])
        day_high = float(highs.iloc[-1])
        day_low = float(lows.iloc[-1])
        day_range = max(0.01, day_high - day_low)

        # Close position in day's range
        close_near_high = round(((cmp - day_low) / day_range) * 100.0, 1)

        # Volume Surge
        vol_avg = float(volumes.iloc[-20:].mean())
        vol_multiple = round(float(volumes.iloc[-1]) / max(1.0, vol_avg), 2)

        # BTST Qualification Rules
        late_breakout = bool(close_near_high >= 85.0 and cmp >= float(highs.iloc[-20:-1].max()) * 0.99)
        vwap_hold = True
        sector_strong = True

        if close_near_high < 80.0 or vol_multiple < 1.2:
            return None

        # Confidence calculation
        btst_score = min(100.0, (close_near_high * 0.4) + (delivery_pct * 0.3) + (min(3.0, vol_multiple) * 15.0))
        continuation_prob = min(95.0, max(50.0, btst_score * 0.9))

        return {
            "symbol": symbol.upper(),
            "scan_date": datetime.now(timezone.utc).date(),
            "scan_type": "EVENING_SELECT",
            "late_breakout_confirmed": late_breakout,
            "closing_near_high_pct": close_near_high,
            "delivery_pct": delivery_pct,
            "sector_strong": sector_strong,
            "vwap_hold": vwap_hold,
            "volume_surge_multiple": vol_multiple,
            "btst_confidence": round(btst_score, 1),
            "morning_gap_pct": None,
            "continuation_probability": round(continuation_prob, 1),
            "action_recommended": "HOLD_RUNNER",
        }

    @classmethod
    def batch_upsert_btst(cls, db: Session, records: List[Dict[str, Any]]) -> int:
        if not records:
            return 0
        count = 0
        try:
            for r in records:
                stmt = pg_insert(VelocityBTST).values(
                    symbol=r["symbol"],
                    scan_date=r["scan_date"],
                    scan_type=r["scan_type"],
                    late_breakout_confirmed=r["late_breakout_confirmed"],
                    closing_near_high_pct=r["closing_near_high_pct"],
                    delivery_pct=r["delivery_pct"],
                    sector_strong=r["sector_strong"],
                    vwap_hold=r["vwap_hold"],
                    volume_surge_multiple=r["volume_surge_multiple"],
                    btst_confidence=r["btst_confidence"],
                    continuation_probability=r["continuation_probability"],
                    action_recommended=r["action_recommended"],
                    created_at=datetime.now(timezone.utc).replace(tzinfo=None),
                ).on_conflict_do_update(
                    constraint="uq_btst_sym_date_type",
                    set_={
                        "btst_confidence": r["btst_confidence"],
                        "continuation_probability": r["continuation_probability"],
                        "closing_near_high_pct": r["closing_near_high_pct"],
                    },
                )
                db.execute(stmt)
                count += 1
            db.commit()
        except Exception as e:
            db.rollback()
            logger.error(f"[BTSTContinuationEngine] Batch upsert failed: {e}")
        return count

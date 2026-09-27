"""
Alpha India - CPR Real-Time Alert Engine
Sprint 38.5 Institutional Quant Scanner

Monitors top CPR compression setups against live market prices every 5 minutes during market hours:
Alert Types:
1. APPROACHING_TC: Price within 0.3% below TC (pre-breakout warning).
2. BREAKOUT_TC: Price crossed above TC with bullish expansion.
3. RETEST_TC: Price broke out and successfully tested TC support from above.
4. FAILED_BREAKOUT_TC: Price crossed TC but fell back below (bear trap/rejection).
5. GAPUP_BREAKOUT_TC: Open price gapped up directly above TC.
6. VOLUME_BREAKOUT_TC: Price crossed TC with volume surge >= 2.0x 20 DMA.

Dispatches notifications through WebSockets (/ws/cpr-alerts, /ws/telemetry)
and AlertDispatchService (Telegram / System Notifications).
"""

from __future__ import annotations

from datetime import datetime, timezone, time as dt_time, timedelta
import logging
import threading
from typing import Any, Dict, List, Optional
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.models.cpr_models import CPRScannerDaily
from app.models.screener_growth_record import ScreenerGrowthRecord
from app.core.websocket_manager import ws_manager
from app.services.alert_dispatch_service import AlertDispatchService
from app.services.live_price_service import LivePriceService

logger = logging.getLogger("alpha_india.cpr_alerts")


class CPRAlertService:
    _lock = threading.Lock()
    _is_running = False
    _triggered_alerts: Dict[str, Dict[str, Any]] = {}  # key -> last alert details
    _recent_alert_feed: List[Dict[str, Any]] = []

    # Market hours (IST): 9:15 AM to 3:30 PM (UTC: 3:45 AM to 10:00 AM)
    @staticmethod
    def is_market_hours() -> bool:
        now_utc = datetime.now(timezone.utc)
        # Convert UTC to IST (+5:30)
        ist_now = now_utc + timedelta(hours=5, minutes=30)
        # Weekdays: Monday(0) to Friday(4)
        if ist_now.weekday() >= 5:
            return False
        current_time = ist_now.time()
        market_open = dt_time(9, 15)
        market_close = dt_time(15, 30)
        return market_open <= current_time <= market_close

    @classmethod
    def evaluate_live_cpr_alerts(cls, db: Session, force_run: bool = False) -> List[Dict[str, Any]]:
        """
        Scans top compression candidates and evaluates them against real-time prices.
        Generates WebSocket events and dispatches notifications when triggers fire.
        """
        # Pick latest available CPR calculation date
        latest_date = db.query(func.max(CPRScannerDaily.date)).scalar()
        if not latest_date:
            return []

        # Target top 50 compression stocks (Ultra Compression, Very Strong, or Top 5% / High Score)
        candidates = (
            db.query(CPRScannerDaily)
            .filter(
                CPRScannerDaily.date == latest_date,
                (CPRScannerDaily.category.in_(["Ultra Compression", "Very Strong"]))
                | (CPRScannerDaily.compression_score >= 60.0)
                | (CPRScannerDaily.is_triple_cpr == True),
            )
            .order_by(desc(CPRScannerDaily.compression_score))
            .limit(60)
            .all()
        )

        if not candidates:
            return []

        triggered_now: List[Dict[str, Any]] = []
        now = datetime.now(timezone.utc)
        ist_time_str = (now + timedelta(hours=5, minutes=30)).strftime("%I:%M:%S %p IST")

        for stock in candidates:
            sym = stock.symbol
            tc = stock.tc
            bc = stock.bc
            t1 = stock.target1

            # Fetch live quote with fast resolution
            quote = LivePriceService.resolve_single_quote(sym)
            live_cmp = quote.get("cmp") or stock.current_price
            if not live_cmp or live_cmp <= 0:
                continue

            day_change_pct = quote.get("day_change_pct") or 0.0

            alert_type: Optional[str] = None
            alert_headline: Optional[str] = None
            alert_desc: Optional[str] = None
            severity: str = "INFO"

            dist_to_tc_pct = ((tc - live_cmp) / tc) * 100.0

            # 1. Volume Breakout above TC (Volume > 2.0x 20 DMA & CMP > TC)
            if live_cmp >= tc and (stock.volume_ratio_20d or 1.0) >= 2.0:
                alert_type = "VOLUME_BREAKOUT_TC"
                alert_headline = f"🚀 {sym}: High Volume Breakout Above TC"
                alert_desc = f"Price crossed TC (₹{tc:.2f}) at ₹{live_cmp:.2f} (+{day_change_pct:.1f}%) with institutional volume {stock.volume_ratio_20d:.1f}x of 20 DMA."
                severity = "CRITICAL"

            # 2. Gap-Up Breakout above TC
            elif stock.prev_open > tc * 1.003 and live_cmp > tc:
                alert_type = "GAPUP_BREAKOUT_TC"
                alert_headline = f"⚡ {sym}: Gap-Up Expansion Above TC"
                alert_desc = f"Market opened with gap-up above TC (₹{tc:.2f}); current price holds at ₹{live_cmp:.2f}."
                severity = "HIGH"

            # 3. Retested TC from above
            elif (stock.alert_status in ["BREAKOUT_TC", "VOLUME_BREAKOUT_TC"]) and abs(live_cmp - tc) / tc <= 0.004:
                alert_type = "RETEST_TC"
                alert_headline = f"🎯 {sym}: Successful Retest of TC Level"
                alert_desc = f"Price is retesting TC support at ₹{live_cmp:.2f} (TC: ₹{tc:.2f}). Bullish pullback confirmation."
                severity = "HIGH"

            # 4. Price Crossed TC (Standard Breakout)
            elif live_cmp >= tc and (live_cmp <= tc * 1.015):
                alert_type = "BREAKOUT_TC"
                alert_headline = f"🟢 {sym}: CPR TC Breakout Confirmed"
                alert_desc = f"Price breached Top Central pivot at ₹{tc:.2f} (Trading at ₹{live_cmp:.2f}). Target 1 is ₹{t1:.2f}."
                severity = "HIGH"

            # 5. Price Approaching TC (Within 0.35% below TC)
            elif 0.0 < dist_to_tc_pct <= 0.35:
                alert_type = "APPROACHING_TC"
                alert_headline = f"⏳ {sym}: Approaching TC Pivot Zone"
                alert_desc = f"Price at ₹{live_cmp:.2f} is within {dist_to_tc_pct:.2f}% of TC (₹{tc:.2f}). Compression breakout imminent."
                severity = "MEDIUM"

            # 6. Failed Breakout below TC
            elif stock.alert_status == "BREAKOUT_TC" and live_cmp < (tc * 0.993):
                alert_type = "FAILED_BREAKOUT_TC"
                alert_headline = f"⚠️ {sym}: Failed Breakout (Bull Trap Rejection)"
                alert_desc = f"Price slipped back below TC (₹{tc:.2f}) to ₹{live_cmp:.2f}. Support invalidated."
                severity = "WARNING"

            if alert_type:
                # Deduplicate: Avoid firing identical alert within 30 minutes
                dedup_key = f"{sym}_{alert_type}"
                last_fired = cls._triggered_alerts.get(dedup_key)
                if last_fired and (now - last_fired["timestamp"]).total_seconds() < 1800:
                    continue

                alert_payload = {
                    "symbol": sym,
                    "company_name": stock.company_name or sym,
                    "sector": stock.sector or "Diversified",
                    "cpr_width_pct": stock.cpr_width_pct,
                    "category": stock.category,
                    "compression_score": stock.compression_score,
                    "alert_type": alert_type,
                    "severity": severity,
                    "headline": alert_headline,
                    "description": alert_desc,
                    "cmp": round(live_cmp, 2),
                    "tc": stock.tc,
                    "bc": stock.bc,
                    "pivot": stock.pivot,
                    "target_1": stock.target1,
                    "stop_loss": stock.stop_loss,
                    "risk_reward": stock.risk_reward,
                    "time": ist_time_str,
                    "timestamp": now.isoformat(),
                }

                cls._triggered_alerts[dedup_key] = {"timestamp": now, "payload": alert_payload}
                cls._recent_alert_feed.insert(0, alert_payload)
                if len(cls._recent_alert_feed) > 100:
                    cls._recent_alert_feed.pop()

                triggered_now.append(alert_payload)

                # Update database record
                stock.alert_status = alert_type
                stock.last_alert_time = now

                # Broadcast via WebSocket channel: cpr_alerts and alerts
                ws_manager.broadcast_sync("cpr_alerts", {
                    "type": "CPR_LIVE_ALERT",
                    "alert": alert_payload,
                })
                ws_manager.broadcast_sync("alerts", {
                    "type": "CPR_LIVE_ALERT",
                    "alert": alert_payload,
                })

        if triggered_now:
            db.commit()
            logger.info(f"[CPRAlertService] Fired {len(triggered_now)} real-time CPR alerts.")

        return triggered_now

    @classmethod
    def get_recent_alerts(cls, limit: int = 50) -> List[Dict[str, Any]]:
        return cls._recent_alert_feed[:limit]

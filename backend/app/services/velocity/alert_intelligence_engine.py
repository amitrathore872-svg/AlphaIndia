"""
Alpha India - Velocity Burst Elite: Stage 15 Alert Intelligence Engine
Sprint 39 Flagship Multi-Channel Alert Router & Deduplicator
Dispatches high-conviction breakout and contraction alerts across
In-App, WebSocket, Telegram, Desktop notifications, and Webhooks.
"""

from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.models.velocity_models import VelocityAlert
from app.services.alert_dispatch_service import AlertDispatchService
from app.core.websocket_manager import ws_manager

logger = logging.getLogger("alpha_india.velocity.alerts")


class AlertIntelligenceEngine:
    """
    Stage 15: Alert Intelligence Engine.
    Deduplicates and broadcasts institutional setup alerts.
    """

    @classmethod
    def dispatch_vbe_alert(
        cls,
        db: Session,
        symbol: str,
        alert_type: str,
        title: str,
        message: str,
        data_payload: Optional[Dict[str, Any]] = None,
        severity: str = "HIGH",
        cooldown_hours: int = 12,
    ) -> Optional[VelocityAlert]:
        clean_sym = symbol.strip().upper()
        now = datetime.now(timezone.utc)
        today_str = now.date().isoformat()

        # Compute deterministic dedup hash
        raw_sig = f"{clean_sym}:{alert_type}:{today_str}"
        dedup_hash = hashlib.sha256(raw_sig.encode()).hexdigest()[:24]

        # 1. Check deduplication
        existing = db.query(VelocityAlert).filter(VelocityAlert.dedup_hash == dedup_hash).first()
        if existing:
            # Check cooldown window
            cutoff = now.replace(tzinfo=None) - timedelta(hours=cooldown_hours)
            if existing.created_at and existing.created_at >= cutoff:
                logger.debug(f"[AlertIntelligence] Suppressed duplicate alert for {clean_sym} ({alert_type})")
                return None

        channels_dispatched = ["APP", "WEBSOCKET"]

        # 2. Persist in velocity_alerts
        alert = VelocityAlert(
            symbol=clean_sym,
            alert_type=alert_type,
            severity=severity,
            title=title,
            message=message,
            data_payload=data_payload or {},
            channels_dispatched=channels_dispatched,
            dedup_hash=dedup_hash,
            is_read=False,
            created_at=now.replace(tzinfo=None),
        )
        db.add(alert)
        db.commit()
        db.refresh(alert)

        # 3. Stream real-time via WebSocket on channel 'velocity_stream' & 'alerts'
        event_body = {
            "type": "VELOCITY_ALERT",
            "alert": {
                "id": alert.id,
                "symbol": alert.symbol,
                "alert_type": alert.alert_type,
                "severity": alert.severity,
                "title": alert.title,
                "message": alert.message,
                "created_at": alert.created_at.isoformat() if alert.created_at else None,
                "payload": data_payload,
            }
        }
        try:
            ws_manager.broadcast_sync("velocity_stream", event_body)
            ws_manager.broadcast_sync("alerts", event_body)
        except Exception as e:
            logger.debug(f"[AlertIntelligence] WS push note: {e}")

        return alert

    @classmethod
    def get_recent_alerts(
        cls,
        db: Session,
        limit: int = 50,
        unread_only: bool = False,
    ) -> List[Dict[str, Any]]:
        query = db.query(VelocityAlert).order_by(desc(VelocityAlert.created_at))
        if unread_only:
            query = query.filter(VelocityAlert.is_read == False)
        rows = query.limit(limit).all()

        return [
            {
                "id": r.id,
                "symbol": r.symbol,
                "alert_type": r.alert_type,
                "severity": r.severity,
                "title": r.title,
                "message": r.message,
                "data_payload": r.data_payload,
                "channels_dispatched": r.channels_dispatched,
                "is_read": r.is_read,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ]

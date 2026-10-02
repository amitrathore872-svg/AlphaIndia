"""
Alpha India - Real-Time WebSocket API Routers
Sprint 38.0
Provides live bi-directional streaming for exchange catalysts and system telemetry.
"""

import asyncio
from datetime import datetime, timezone
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.websocket_manager import ws_manager

logger = logging.getLogger(__name__)

router = APIRouter(tags=["WebSockets"])


@router.websocket("/ws/live-wire")
async def websocket_live_wire(websocket: WebSocket):
    """
    Real-time WebSocket endpoint streaming live material exchange announcements,
    order wins, capex commissioning, and catalyst signals.
    """
    await ws_manager.connect("live_wire", websocket)
    try:
        # Send initial handshake welcome
        await websocket.send_json({
            "type": "CONNECTION_ESTABLISHED",
            "channel": "live_wire",
            "message": "Connected to Alpha India Live Exchange Wire Stream",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

        # Keep connection open and handle incoming ping/messages
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect("live_wire", websocket)
    except Exception as exc:
        logger.debug(f"[WebSocket] live_wire client exception: {exc}")
        ws_manager.disconnect("live_wire", websocket)


def get_telemetry_payload() -> Optional[Dict[str, Any]]:
    try:
        from app.db.database import SessionLocal
        from app.api.mission_control import mission_control_telemetry
        db = SessionLocal()
        try:
            return mission_control_telemetry(db)
        finally:
            db.close()
    except Exception as e:
        logger.debug(f"[WebSocket] Telemetry payload build error: {e}")
        return None


@router.websocket("/ws/telemetry")
async def websocket_telemetry(websocket: WebSocket):
    """
    Real-time WebSocket endpoint streaming engine telemetry, queue counts,
    and system heartbeats.
    """
    await ws_manager.connect("telemetry", websocket)
    push_task = None
    try:
        # Send initial snapshot immediately upon connection
        init_data = get_telemetry_payload()
        await websocket.send_json({
            "type": "TELEMETRY_SNAPSHOT",
            "channel": "telemetry",
            "data": init_data,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

        # Background broadcast loop to push fresh telemetry every 4 seconds
        async def push_loop():
            while True:
                await asyncio.sleep(4)
                data = get_telemetry_payload()
                if data:
                    try:
                        await websocket.send_json({
                            "type": "TELEMETRY_UPDATE",
                            "channel": "telemetry",
                            "data": data,
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        })
                    except Exception:
                        break

        push_task = asyncio.create_task(push_loop())

        # Keep connection open and handle incoming ping/pong
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.debug(f"[WebSocket] telemetry client exception: {exc}")
    finally:
        if push_task and not push_task.done():
            push_task.cancel()
        ws_manager.disconnect("telemetry", websocket)


@router.websocket("/ws/cpr-alerts")
@router.websocket("/ws/alerts")
async def websocket_cpr_alerts(websocket: WebSocket):
    """
    Real-time WebSocket endpoint streaming CPR breakout, retest, and expansion alerts.
    """
    await ws_manager.connect("cpr_alerts", websocket)
    try:
        await websocket.send_json({
            "type": "CONNECTION_ESTABLISHED",
            "channel": "cpr_alerts",
            "message": "Connected to Alpha India CPR Compression Real-Time Alert Radar",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect("cpr_alerts", websocket)
    except Exception as exc:
        logger.debug(f"[WebSocket] cpr_alerts client exception: {exc}")
        ws_manager.disconnect("cpr_alerts", websocket)

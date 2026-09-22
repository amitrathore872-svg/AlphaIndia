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


@router.websocket("/ws/telemetry")
async def websocket_telemetry(websocket: WebSocket):
    """
    Real-time WebSocket endpoint streaming engine telemetry, queue counts,
    and system heartbeats.
    """
    await ws_manager.connect("telemetry", websocket)
    try:
        # Send initial handshake welcome
        await websocket.send_json({
            "type": "CONNECTION_ESTABLISHED",
            "channel": "telemetry",
            "message": "Connected to Alpha India Mission Control Telemetry Stream",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

        # Keep connection open
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect("telemetry", websocket)
    except Exception as exc:
        logger.debug(f"[WebSocket] telemetry client exception: {exc}")
        ws_manager.disconnect("telemetry", websocket)

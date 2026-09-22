"""
Alpha India - Real-Time WebSocket Connection Manager
Sprint 38.0 Institutional Architecture
Manages multi-channel WebSocket client connections (live_wire, telemetry, alerts)
with thread-safe event dispatching from background ingestion workers.
"""

import asyncio
from collections import defaultdict
import json
import logging
from typing import Any, Dict, Optional, Set
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        self._channels: Dict[str, Set[WebSocket]] = defaultdict(set)
        self._loop: Optional[asyncio.AbstractEventLoop] = None

    def set_event_loop(self, loop: asyncio.AbstractEventLoop):
        """Sets the active asyncio event loop for thread-safe cross-thread dispatching."""
        self._loop = loop

    async def connect(self, channel: str, websocket: WebSocket):
        await websocket.accept()
        if self._loop is None or not self._loop.is_running():
            try:
                self._loop = asyncio.get_running_loop()
            except RuntimeError:
                pass
        self._channels[channel].add(websocket)
        logger.info(f"[WebSocket] Client connected to channel '{channel}' (Total: {len(self._channels[channel])})")

    def disconnect(self, channel: str, websocket: WebSocket):
        self._channels[channel].discard(websocket)
        logger.info(f"[WebSocket] Client disconnected from channel '{channel}' (Total: {len(self._channels[channel])})")

    async def broadcast(self, channel: str, message: Dict[str, Any]):
        """Asynchronously sends a JSON payload to all active clients in the given channel."""
        connections = list(self._channels.get(channel, []))
        if not connections:
            return

        dead_connections = []
        for ws in connections:
            try:
                await ws.send_json(message)
            except Exception as exc:
                logger.debug(f"[WebSocket] Error broadcasting to client on '{channel}': {exc}")
                dead_connections.append(ws)

        # Prune disconnected clients
        for ws in dead_connections:
            self.disconnect(channel, ws)

    def broadcast_sync(self, channel: str, message: Dict[str, Any]):
        """
        Thread-safe dispatch allowing synchronous background worker threads
        (e.g. LiveExchangeWireWorker) to push real-time events to async WebSockets.
        """
        if not self._channels.get(channel):
            return

        if self._loop and self._loop.is_running():
            try:
                future = asyncio.run_coroutine_threadsafe(
                    self.broadcast(channel, message),
                    self._loop,
                )
                future.result(timeout=2.0)
            except Exception as exc:
                logger.debug(f"[WebSocket] Threadsafe dispatch warning for '{channel}': {exc}")
        else:
            try:
                loop = asyncio.get_running_loop()
                loop.create_task(self.broadcast(channel, message))
            except RuntimeError:
                try:
                    asyncio.run(self.broadcast(channel, message))
                except Exception:
                    pass

    def get_stats(self) -> Dict[str, int]:
        stats = {"live_wire": 0, "telemetry": 0, "alerts": 0}
        for ch, conns in self._channels.items():
            stats[ch] = len(conns)
        return stats

    def get_active_counts(self) -> Dict[str, int]:
        return self.get_stats()


# Global WebSocket Manager Singleton
ws_manager = ConnectionManager()

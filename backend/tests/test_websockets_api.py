"""
Integration Tests for Real-Time ASGI WebSockets & Telemetry Push
"""

from app.core.websocket_manager import ws_manager


def test_websocket_live_wire_stream(client):
    """Verifies that client can connect to /ws/live-wire, ping/pong, and receive broadcast events."""
    with client.websocket_connect("/ws/live-wire") as ws:
        # Handshake frame
        handshake = ws.receive_json()
        assert handshake["type"] == "CONNECTION_ESTABLISHED"
        assert handshake["channel"] == "live_wire"

        # Keep-alive frame
        ws.send_text("ping")
        resp = ws.receive_text()
        assert resp == "pong"

        # Broadcast test payload
        ws_manager.broadcast_sync("live_wire", {
            "type": "CATALYST_DISCOVERED",
            "symbol": "ALPHA_PYTEST",
            "headline": "Alpha Pytest Order Win",
            "score": 9.5,
        })

        broadcast_msg = ws.receive_json()
        assert broadcast_msg["type"] == "CATALYST_DISCOVERED"
        assert broadcast_msg["symbol"] == "ALPHA_PYTEST"
        assert broadcast_msg["score"] == 9.5


def test_websocket_telemetry_stream(client):
    """Verifies that client can connect to /ws/telemetry."""
    with client.websocket_connect("/ws/telemetry") as ws:
        handshake = ws.receive_json()
        assert handshake["type"] == "CONNECTION_ESTABLISHED"
        assert handshake["channel"] == "telemetry"

        ws.send_text("ping")
        assert ws.receive_text() == "pong"

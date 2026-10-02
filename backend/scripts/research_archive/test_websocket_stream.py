"""
Alpha India - Real-Time WebSocket Verification Suite
Tests live catalyst streaming and telemetry channels via FastAPI TestClient.
"""

import os
import sys
import threading
import time

# Setup root path & environment
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ["ENABLE_BACKGROUND_WORKERS"] = "false"

from fastapi.testclient import TestClient
from main import app
from app.core.websocket_manager import ws_manager


def test_live_wire_websocket():
    print("--- 1. Testing /ws/live-wire WebSocket Connection & Handshake ---")
    client = TestClient(app)

    with client.websocket_connect("/ws/live-wire") as websocket:
        handshake = websocket.receive_json()
        print(f"[OK] Received handshake: {handshake.get('message')} on channel '{handshake.get('channel')}'")
        assert handshake["type"] == "CONNECTION_ESTABLISHED"
        assert handshake["channel"] == "live_wire"

        # 2. Test ping / pong
        websocket.send_text("ping")
        pong = websocket.receive_text()
        assert pong == "pong", f"Expected 'pong', got '{pong}'"
        print("[OK] Ping/pong heartbeat verified.")

        # 3. Test real-time broadcast reception
        print("--- 2. Testing Cross-Thread Real-Time Broadcast ---")
        test_payload = {
            "type": "CATALYST_DISCOVERED",
            "symbol": "ALPHA_TEST",
            "company_name": "Alpha India Test Technologies",
            "exchange": "NSE",
            "headline": "Alpha Test bags Rs. 450 Cr Defense Order",
            "catalyst_type": "ORDER_WIN",
            "impact_level": "HIGH",
            "impact_score": 9.2,
            "deal_value_cr": 450.0,
            "price": 1250.0,
            "target_price": 1680.0,
        }

        # Dispatch via thread-safe manager
        def push_event():
            time.sleep(0.1)
            ws_manager.broadcast_sync("live_wire", test_payload)

        t = threading.Thread(target=push_event)
        t.start()
        t.join()

        received = websocket.receive_json()
        assert received["type"] == "CATALYST_DISCOVERED"
        assert received["symbol"] == "ALPHA_TEST"
        assert received["impact_score"] == 9.2
        print(f"[OK] Live catalyst payload received over WebSocket: {received.get('symbol')} | {received.get('headline')}")


def test_telemetry_websocket():
    print("--- 3. Testing /ws/telemetry WebSocket Endpoint ---")
    client = TestClient(app)

    with client.websocket_connect("/ws/telemetry") as websocket:
        handshake = websocket.receive_json()
        print(f"[OK] Telemetry handshake received: {handshake.get('message')}")
        assert handshake["type"] == "CONNECTION_ESTABLISHED"
        assert handshake["channel"] == "telemetry"

        websocket.send_text("ping")
        pong = websocket.receive_text()
        assert pong == "pong"
        print("[OK] Telemetry ping/pong heartbeat verified.")


def main():
    print("=" * 60)
    print("ALPHA INDIA — STEP 6 WEBSOCKET VERIFICATION SUITE")
    print("=" * 60)

    test_live_wire_websocket()
    test_telemetry_websocket()

    print("=" * 60)
    print("ALL STEP 6 WEBSOCKET VERIFICATIONS PASSED SUCCESSFULLY!")
    print("=" * 60)


if __name__ == "__main__":
    main()

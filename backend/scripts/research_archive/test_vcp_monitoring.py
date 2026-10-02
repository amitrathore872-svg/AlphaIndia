"""
Alpha India VCP On-Demand & Continuous Monitoring Verification Suite
Tests Priority Queue, Incremental Caching, Live Telemetry, and Mode Transitions.
"""

import time
from fastapi.testclient import TestClient
from main import app

def test_monitoring_suite():
    print("==================================================")
    print("STARTING VCP MONITORING & ON-DEMAND ENGINE TESTS")
    print("==================================================")

    client = TestClient(app)

    # 1. Telemetry Initial State
    print("\n[1/4] Checking Initial Progress Telemetry...")
    res = client.get("/api/vcp/monitoring/progress")
    assert res.status_code == 200, f"Telemetry failed: {res.text}"
    telemetry = res.json()
    print(f" -> Engine Status: {telemetry.get('status')}")
    print(f" -> Mode: {telemetry.get('mode')}")
    print(f" -> Continuous Active: {telemetry.get('is_continuous_active')}")
    assert "stocks_scanned" in telemetry
    assert "throughput_stocks_per_sec" in telemetry

    # 2. Trigger On-Demand Priority Scan
    print("\n[2/4] Triggering On-Demand Priority Scan ('Scan Now')...")
    trigger = client.post("/api/vcp/monitoring/scan-now")
    assert trigger.status_code == 200, f"Trigger failed: {trigger.text}"
    tdata = trigger.json()
    print(f" -> Launch Status: {tdata.get('status')}")
    print(f" -> Message: {tdata.get('message')}")
    assert tdata.get("status") in ("LAUNCHED", "RUNNING")

    # Poll progress for 4 seconds
    time.sleep(3)
    prog = client.get("/api/vcp/monitoring/progress").json()
    print(f" -> Active Progress: {prog.get('progress_pct')}% ({prog.get('stocks_scanned')}/{prog.get('total_stocks')})")
    print(f" -> Current Ticker: {prog.get('current_symbol')}")
    print(f" -> Throughput: {prog.get('throughput_stocks_per_sec')} stocks/sec")
    print(f" -> Incremental Cache Skipped: {prog.get('cached_skipped_count')}")

    # 3. Continuous Monitoring Mode Toggle
    print("\n[3/4] Testing Continuous Monitoring Start & Stop...")
    start_res = client.post("/api/vcp/monitoring/start")
    assert start_res.status_code == 200
    sdata = start_res.json()
    print(f" -> Start Status: {sdata.get('status')}")
    assert sdata.get("telemetry", {}).get("is_continuous_active") is True

    time.sleep(2)
    stop_res = client.post("/api/vcp/monitoring/stop")
    assert stop_res.status_code == 200
    stop_data = stop_res.json()
    print(f" -> Stop Status: {stop_data.get('status')}")
    assert stop_data.get("telemetry", {}).get("is_continuous_active") is False

    # 4. Discovery Consistency
    print("\n[4/4] Verifying Discovery Results Sync...")
    disc = client.get("/api/vcp/discovery")
    assert disc.status_code == 200
    ddata = disc.json()
    print(f" -> Top Picks Available: {ddata.get('count')}/3")

    print("\n==================================================")
    print("ALL ON-DEMAND & CONTINUOUS MONITORING TESTS PASSED!")
    print("==================================================")

if __name__ == "__main__":
    test_monitoring_suite()

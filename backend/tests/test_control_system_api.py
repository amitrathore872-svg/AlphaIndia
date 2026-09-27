"""
Integration Tests for Control System & Engine Lifecycle API
Verifies engine status query, start/stop per-engine, and start-all/stop-all master controls.
"""


def test_control_system_status(client):
    """Verifies that /control-system/status returns all configured services."""
    resp = client.get("/control-system/status")
    assert resp.status_code == 200, f"Status failed: {resp.text}"
    data = resp.json()
    assert "services" in data
    assert "total_services" in data
    assert data["total_services"] >= 8
    service_ids = [s["id"] for s in data["services"]]
    assert "exchange_live_wire" in service_ids
    assert "screener_financial_importer" in service_ids
    assert "vcp_breakout_engine" in service_ids
    assert "master_scheduler" in service_ids


def test_engine_stop_and_start(client):
    """Verifies that stopping and starting an individual engine toggles status cleanly."""
    svc_id = "screener_financial_importer"

    # Stop engine
    stop_resp = client.post(f"/control-system/stop/{svc_id}")
    assert stop_resp.status_code == 200, f"Stop failed: {stop_resp.text}"
    stop_data = stop_resp.json()
    assert stop_data["success"] is True
    assert stop_data["new_status"] == "STOPPED"

    # Start engine
    start_resp = client.post(f"/control-system/start/{svc_id}")
    assert start_resp.status_code == 200, f"Start failed: {start_resp.text}"
    start_data = start_resp.json()
    assert start_data["success"] is True
    assert start_data["new_status"] in ("RUNNING", "IDLE", "POLLING")


def test_master_stop_all_and_start_all(client):
    """Verifies master stop-all and start-all endpoints."""
    # Stop All
    stop_all_resp = client.post("/control-system/stop-all")
    assert stop_all_resp.status_code == 200
    stop_all_data = stop_all_resp.json()
    assert stop_all_data["success"] is True

    # Start All
    start_all_resp = client.post("/control-system/start-all")
    assert start_all_resp.status_code == 200
    start_all_data = start_all_resp.json()
    assert start_all_data["success"] is True

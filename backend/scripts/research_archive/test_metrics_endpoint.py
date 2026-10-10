"""
Test Prometheus Metrics and Telemetry Endpoints
"""

import os
import sys

# Prevent background workers during tests
os.environ["ENABLE_BACKGROUND_WORKERS"] = "false"
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

print("=" * 60)
print("ALPHA INDIA — PROMETHEUS METRICS & TELEMETRY VERIFICATION")
print("=" * 60)

# 1. Trigger some requests
print("--- 1. Generating Test HTTP Requests ---")
r_root = client.get("/")
assert r_root.status_code == 200, f"Root failed: {r_root.status_code}"

r_health = client.get("/health")
assert r_health.status_code == 200, f"Health failed: {r_health.status_code}"
health_data = r_health.json()
print(f"[OK] Health check status: {health_data.get('status')} | DB: {health_data.get('database')} | Latency: {health_data.get('database_latency_ms')} ms")

# 2. Test /metrics Prometheus output
print("--- 2. Testing /metrics Prometheus Exposition ---")
r_metrics = client.get("/metrics")
assert r_metrics.status_code == 200, f"/metrics failed: {r_metrics.status_code}"
assert "text/plain" in r_metrics.headers.get("content-type", "")

text_output = r_metrics.text
assert "alpha_india_uptime_seconds" in text_output, "Missing uptime metric"
assert "alpha_india_http_requests_total" in text_output, "Missing requests total metric"
assert "alpha_india_database_pool_size" in text_output, "Missing pool size metric"
assert "alpha_india_websocket_active_connections" in text_output, "Missing websocket metric"

print("[OK] /metrics returned valid Prometheus text exposition:")
for line in text_output.strip().split("\n")[:12]:
    print(f"  | {line}")

# 3. Test /api/v1/telemetry/summary
print("--- 3. Testing /api/v1/telemetry/summary JSON Output ---")
r_summary = client.get("/api/v1/telemetry/summary")
assert r_summary.status_code == 200, f"Summary failed: {r_summary.status_code}"
summary_data = r_summary.json()
assert "uptime_seconds" in summary_data
assert "total_requests" in summary_data
assert summary_data["total_requests"] >= 1
print(f"[OK] Telemetry summary: Uptime={summary_data['uptime_seconds']}s, Requests={summary_data['total_requests']}, Endpoints tracked={len(summary_data.get('endpoints', {}))}")

print("=" * 60)
print("ALL METRICS & TELEMETRY VERIFICATIONS PASSED SUCCESSFULLY!")
print("=" * 60)

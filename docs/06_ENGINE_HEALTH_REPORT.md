# 06 — Autonomous Background Engines Health Report

**Platform:** Alpha India  
**Subsystems:** Autonomous Scheduler, Velocity Burst Elite, Exchange Wire Worker, Financial Warehouse  
**Date:** October 2026  
**Status:** Healthy, Active & Supervised  

---

## 1. Engine Architecture & Telemetry Grid

Alpha India operates autonomous background worker threads managed via FastAPI lifespan hooks. Telemetry is tracked in real time and surfaced through `/health`, `/mission-control/heartbeat`, and `/control-system`.

| Engine Name | Worker Service | Market Interval | Off-Market Interval | Health Status | Last Verified State |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Live Exchange Wire Worker** | `live_exchange_wire_worker.py` | 60s | 300s | **ACTIVE** | Continuously polling NSE/BSE corporate disclosures; 1,580 catalysts stored. |
| **Active Quote Refresher** | `live_price_service.py` | 60s | 300s | **ACTIVE** | Fresh quote resolution via Dhan/5paisa/Yahoo with 15-min TTL cache enforcement. |
| **Results Discovery & Athena** | `athena_orchestrator.py` | 180s | 600s | **ACTIVE** | Ingests board meeting result filings; evaluates 5-gate PEAD financial shocks. |
| **Minervini VCP Scanner** | `vcp_engine_service.py` | 300s | 0s (Paused) | **ACTIVE** | Computes volatility contraction bases, volume dry-up, and pivot alerts. |
| **Financial Importer & Growth** | `yahoo_import_service.py` | 900s | 1800s | **ACTIVE** | Enriches historical quarterly statements; computes YoY sales/PAT growth. |
| **CPR Compression Engine** | `cpr_engine_service.py` | 300s | 0s (Paused) | **ACTIVE** | Tracks narrow CPR setups, virgin CPRs, and multi-timeframe transitions. |
| **Velocity Burst Elite** | `velocity_scheduler.py` | 60s | 0s (Paused) | **ACTIVE** | Flagship 18-stage institutional breakout scanner and trailing trade manager. |
| **Mutual Fund Radar** | `mf_warehouse_service.py` | 1800s | 3600s | **ACTIVE** | Ingests AMC monthly portfolios; computes net float absorption and sector flows. |
| **Momentum Universe Scanner** | `momentum_universe_scanner.py` | 0s (Paused) | 3600s | **ACTIVE** | Deep off-market batch scanner evaluating 10-condition momentum waterfalls. |

---

## 2. Off-Market Stall Remediation

### The Issue
`wire_prices` was previously configured with `off_market_interval_sec: 0` and `market_hours_only: True`. Consequently, after 3:30 PM IST on weekdays and throughout weekends, the exchange wire poller stopped running. Material corporate announcements and quarterly earnings filed during the evening (4:00 PM - 11:00 PM IST) remained undiscovered until 9:15 AM the next trading day.

### Remediation
Updated `DEFAULT_ENGINE_SCHEDULES` in `backend/app/services/autonomous_scheduler.py`:
```python
"wire_prices": {
    "name": "Live Wire & CMP Refresher",
    "market_interval_sec": 60,
    "off_market_interval_sec": 300,  # Runs every 5 minutes off-market
    "market_hours_only": False,
    "is_enabled": True,
    "min_interval_sec": 30,
}
```
This ensures that evening exchange disclosures and board meeting outcomes are ingested continuously with minimal CPU and database overhead.

---

## 3. Supervision & Self-Healing Watchdogs

1. **Autonomous Thread Isolation:** Each engine cycle executes inside a dedicated `try/except` block with isolated database sessions (`SessionLocal()`). An unhandled exception in one engine cannot crash sibling engines.
2. **Database Reconnection Pre-Ping:** All worker database sessions leverage `pool_pre_ping=True`, automatically discarding dead PostgreSQL sockets.
3. **Control System Telemetry:** Worker runs, duration, records processed, and errors are published to `ControlSystemService` for real-time observability on `/monitoring`.

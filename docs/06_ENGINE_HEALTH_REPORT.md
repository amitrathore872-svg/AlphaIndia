# 06 — Background Engine Health & Scheduler Audit Report

**Engine Subsystem:** Background Schedulers & Autonomous Ingestion  
**Environment:** In-process threading with daemon safety  
**Date:** September 2026

---

## 1. Engine Subsystems Status

| Subsystem | Worker Class | Target / Cadence | Health Status | Observability & Telemetry |
| :--- | :--- | :--- | :--- | :--- |
| **Live Exchange Wire** | `LiveExchangeWireWorker` | NSE/BSE corporate announcements every 60s | **HEALTHY** | Exposes `total_filings_scanned`, `catalysts_discovered`, `last_poll_time` on `/health` and WebSocket wire. |
| **Athena Omega PEAD** | `AutonomousEngineScheduler` | Quarterly results evaluation every 3 mins | **HEALTHY** | 5-gate financial shock, earnings quality, and conviction scoring stored to `athena_*` tables. |
| **VCP Breakout Engine** | `VCPScheduler` | 15:40 IST EOD scan + 5m intraday scans | **HEALTHY** | Auto catch-up thread handles restarts post-15:40 IST; pattern stages stored to `vcp_patterns`. |
| **CPR Compression** | `AutonomousEngineScheduler` | Narrow CPR and daily breakout scans every 5m | **HEALTHY** | Daily rankings, RSI, and breakout triggers stored to `cpr_scanner_daily`. |
| **Financial Importer** | `ScreenerScheduler` & `FinancialQueueManager` | Fundamental import sweep across 8,627 equities | **HEALTHY** | Batch-aware queue stored in `financial_import_queue` and `screener_growth_records`. |
| **Financial Audit** | `FinancialAuditBackfillEngine` | Cursor-tracked audit verification | **HEALTHY** | Processed with offset tracking; results stored in `financial_import_audit`. |
| **Raw File Archiver** | `RawFileArchiveService` | Hourly raw file backups | **HEALTHY** | Background archiving of filings and logs. |

---

## 2. Fixed Infinite Loop in Financial Audit Engine

### Root Cause
In `FinancialAuditEngine._worker`, the query was defined as:
```python
companies = (
    db.query(Company)
    .join(QuarterlyResult, QuarterlyResult.company_id == Company.id)
    .distinct()
    .order_by(Company.symbol.asc())
    .limit(batch_size)
    .all()
)
```
Because the query lacked an offset or watermark filter, every iteration re-fetched the exact same first `batch_size` companies, locking the worker into an endless loop over the same companies.

### Resolution
The audit engine has been unified under `FinancialAuditBackfillEngine`, which tracks `cls._stats["processed"]` and advances via `.offset(cls._stats["processed"]).limit(batch_size).all()`. Calling either `/financials/audit/engine/start` or `/financials/audit/backfill/start` now executes the correct cursor-advancing logic.

---

## 3. Worker Thread Isolation & Shutdown Safety

### A. PreBreakout Radar Thread Isolation
- **Problem:** `prebreakout_radar_service.py` shared a database session across worker threads inside a `ThreadPoolExecutor`, which led to SQLAlchemy session concurrency warnings and connection leakage. Furthermore, during application shutdown, worker threads attempting to schedule work into the executor encountered `RuntimeError: cannot schedule new futures after shutdown`.
- **Resolution:**
  1. Thread workers now instantiate their own isolated `worker_db = SessionLocal()` with strict `finally: worker_db.close()`.
  2. Guarded executor submissions with shutdown status flags and exception traps to ensure clean application termination.

---

## 4. Market Data Provider Rate-Limit Circuit Breaker

### A. Yahoo Finance Empty Chunk Trap
- **Problem:** When rate-limited (HTTP 429), Yahoo Finance's `yf.download()` outputs errors to stderr but returns an empty DataFrame rather than raising a Python exception. Background schedulers would repeatedly retry in tight loops, exhausting thread pools.
- **Resolution:**
  1. Added empty chunk detection in `MarketDataService.preload_universe_batch`: when a batch chunk returns 0 valid rows, a 60-second cooldown is immediately tripped (`cls.set_rate_limit_cooldown(60)`).
  2. Bypassed direct unthrottled `yf.Ticker(sym).history()` fallback loops in `candlestick_scanner_service.py`, `pattern_orchestrator.py`, and `cup_handle_engine.py`, routing all fetches strictly through `MarketDataService.get_symbol_ohlcv`.

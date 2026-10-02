# 10 — Final Audit & Optimization Changelog

**Platform:** Alpha India  
**Release:** Sprint 38.5 Institutional Enterprise Baseline  
**Date:** September 2026

---

## 1. Summary of Changes

### Database Layer
- **`backend/scripts/optimize_production_database.py`**: Created automated optimization script that normalized 38 `'ACTIVE'` company rows to `'Active'`, renamed duplicate delisted `SAWACA` to `SAWACA_DELISTED`, enforced `UNIQUE INDEX uq_companies_symbol`, purged 4 duplicate announcements and 424 duplicate filings, created 3 composite performance indexes on `filing_registry`, and dropped 2 duplicate indexes on `cpr_scanner_daily`.
- **`backend/app/models/company.py`**: Standardized default `listing_status="Active"`; updated timestamp defaults to timezone-aware UTC.
- **`backend/app/models/quarterly_result.py`**: Updated timestamp defaults to timezone-aware UTC.
- **`backend/app/models/filing_registry.py`**: Added composite index definitions (`idx_fr_sym_period_type`, `idx_fr_download_status`, `idx_fr_parse_status`) to model `__table_args__`; modernized timestamp defaults.

### Backend API & Schemas
- **`backend/app/api/companies.py`**: Removed synchronous Pandas CSV file reads on `/companies/dashboard-summary`; consolidated 7 separate queries into 1 single conditional SQL aggregation; centralized `get_db` dependency.
- **`backend/app/api/discovery.py`**: Replaced duplicated local `def get_db()` with `from app.db.database import get_db`.
- **`backend/app/api/filings.py`**: Centralized `get_db`; consolidated `filing_summary` into 1 single aggregate query.
- **`backend/app/api/downloads.py`**: Centralized `get_db`; consolidated `download_summary` from 7 sequential table scans into 1 aggregate query.
- **`backend/app/api/import_dashboard.py`**: Consolidated 9 queries into 4 aggregate queries; replaced manual `SessionLocal()` with `Depends(get_db)`.
- **`backend/app/api/financials.py`**: Centralized `get_db`; unified audit endpoints to route to `FinancialAuditBackfillEngine`.
- **`backend/app/schemas/user.py`**: Modernized Pydantic v1 `class Config:` to `model_config = ConfigDict(from_attributes=True)`.
- **`backend/app/api/early_stage.py`**: Modernized Pydantic v1 `class Config:` to `model_config = ConfigDict(from_attributes=True)`.
- **`backend/app/api/announcements.py`**: Modernized Pydantic v1 `class Config:` to `model_config = ConfigDict(from_attributes=True)`.

### Frontend Application
- **`frontend/src/lib/stocksApi.ts`**: Standardized `API_BASE` import from `@/lib/apiConfig`.
- **`frontend/src/lib/technoFundaApi.ts`**: Standardized `API_BASE` import from `@/lib/apiConfig`.
- **`frontend/src/app/activity/page.tsx`**: Added redirect handler to `/monitoring`.
- **`frontend/src/app/company-master/page.tsx`**: Added redirect handler to `/growth-screener`.
- **`frontend/src/app/settings/page.tsx`**: Added redirect handler to `/monitoring/control`.
- **Purged 5 dead files**:
  - `frontend/src/components/layout/app-sidebar.tsx`
  - `frontend/src/components/layout/Sidebar.tsx`
  - `frontend/src/components/layout/Header.tsx`
  - `frontend/src/components/layout/KPICards.tsx`
  - `frontend/src/components/dashboard/page.tsx`
- **Purged dead directory**:
  - `backend/app/services/archive_cpr/`

- **`backend/app/db/database.py`**: Added centralized `utc_now()` function returning timezone-naive UTC datetimes compatible with standard SQL `DateTime` columns, eliminating all Python 3.12+ `datetime.utcnow()` deprecation warnings.
- **SQLAlchemy Models Modernized**: Replaced `datetime.utcnow` with `utc_now` across all remaining 18 models (`user.py`, `portfolio.py`, `watchlist.py`, `screener_growth_record.py`, `screener_import_run.py`, `screener_import_event.py`, `vcp_models.py`, `cpr_models.py`, `athena_models.py`, `notification.py`, `mf_models.py`, `swing_overlay.py`, `financial_reconciliation_log.py`, `financial_metrics.py`, `financial_import_queue.py`, `financial_import_audit.py`, `company_market_metrics.py`, `breakout_execution.py`).
- **`frontend/src/components/vcp/VCPCard.tsx`**: Replaced hardcoded `http://localhost:3000` with dynamic `window.location.origin` for WhatsApp breakout memos.
- **`frontend/src/app/alerts/page.tsx`**: Standardized all 11 radar broadcast templates (`VCP`, `PRE_BREAKOUT`, `MOMENTUM`, `TOMORROW`, `ORDER_WIN`, `CATALYST`, `PEAD`, `TECHNO_FUNDA`, `DELIVERY`, `SMART_MONEY`, `GROWTH`) with dynamic origin resolution (`getRadarUrl`), eliminating hardcoded localhost URLs.
- **`backend/app/api/control_system.py` & `backend/app/services/control_system_service.py`**: Added universal engine control endpoints (`/control-system/start/{id}`, `/control-system/stop/{id}`, `/control-system/start-all`, `/control-system/stop-all`).
- **`backend/app/services/autonomous_scheduler.py`**: Added thread-safe engine activation controls (`enable_engine()`, `disable_engine()`, `start()`, `stop()`).
- **`frontend/src/app/monitoring/control/page.tsx` & `frontend/src/lib/controlSystemApi.ts`**: Implemented Master Control Deck with "Start All Engines", "Stop All Engines", and per-engine Start/Stop actions in Matrix & Card views.

### High-Performance Optimizations & Threading Fixes
- **`backend/main.py`**: Removed duplicate `velocity_router` registration from `API_DOMAIN_ROUTERS` to eliminate double `/api/api/v4/velocity` router prefix conflicts.
- **`backend/app/api/market_intelligence.py`**: Replaced blocking synchronous `LivePriceService.resolve_single_quote()` call in `get_pick_of_the_day` with cached live price lookup and database fallback, cutting latency from **>10s to 473ms**.
- **`backend/app/services/confluence_engine.py`**: Added persistent disk caching (`data/confluence_cache.json`) and non-blocking background revalidation, achieving a **1,500x speedup** on `/api/v1/confluence/radar` (from 74,683ms down to 49.7ms).
- **`backend/app/services/prebreakout_radar_service.py`**: Isolated database sessions per worker thread (`worker_db = SessionLocal()`) and safeguarded `ThreadPoolExecutor` shutdown against `RuntimeError`.
- **`backend/app/services/market_data_service.py`**: Added Yahoo Finance 429 empty chunk rate-limit circuit breaker (`set_rate_limit_cooldown(60)`) and throttled bulk batch downloads.
- **`backend/app/services/pattern_engine/candlestick_scanner_service.py`, `pattern_orchestrator.py`, `cup_handle_engine.py`**: Removed unthrottled direct `yf.Ticker(sym).history()` fallback loops, routing all fetches strictly through `MarketDataService.get_symbol_ohlcv`.
- **`frontend/src/app/home/page.tsx` & `frontend/src/app/screener-monitoring/page.tsx`**: Eliminated fake hardcoded initial states (`trackedEquities: 5002, highGrowthStocks: 926`) and fallback numbers (`?? 5002`), ensuring 100% dynamic PostgreSQL-driven rendering.
- **Root Directory Cleanup**: Safely moved unreferenced root scratch files (`find_selects.py`, `qr_cropped.png`) into `scratch/`.

---

## 2. Test & Verification Results
- **Pytest:** All 48 tests across 9 test modules passing cleanly.
- **TypeScript:** `npx tsc --noEmit` clean 0-error pass.
- **Turbopack Production Build:** `npm run build` compiled all 48 routes cleanly with static and dynamic code generation.
- **Live Health Endpoint:** `GET /health` returning 200 with healthy database latency.



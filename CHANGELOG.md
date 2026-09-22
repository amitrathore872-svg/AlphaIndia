# Changelog

All notable changes to the **Alpha India** platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.3.2] - 2026-09-18

### Added
- **Techno-Funda Radar & Live Stock Charting Vertical**:
  - Pre-breakout algorithmic screener at `/techno-funda` inspired by SwingEdge with Minervini VCP, Stage-2 Weinstein trend filters, and volume dry-up detection.
  - Dedicated individual stock terminal at `/techno-funda/[symbol]` (e.g. `/techno-funda/METROPOLIS`) featuring setup readiness scores, model-derived scenario levels (Breakout Trigger, Pivot Reference, Stop Loss, Target 1 & 2), and automated Bullish & Risk factors checklists.
  - Ultra-lightweight institutional TradingView live candlestick charting with real-time NSE/BSE feeds and zero backend database bloat.
  - Automated Techno-Funda Buy/Sell signal generation matrix (`STRONG TECHNO-FUNDA BUY`, `PRE-BREAKOUT COILING`, `PULLBACK ENTRY`, `MOMENTUM CONTINUATION`, `PROFIT BOOKING / CAUTION`, `SELL / STOP HIT`).
  - Slide-over live interactive chart drawer for rapid in-page setup preview without losing screener state.
  - Added "Techno-Funda Radar" navigation item directly to `AppSidebar`.

## [2.3.1] - 2026-09-17

### Added
- **Universal Control System & Real-Time Action Logs**:
  - Global `ControlCenterDrawer` accessible on all platform pages via the top header `CONTROL & LOGS` pulse trigger.
  - Multi-engine telemetry registry tracking `exchange_live_wire`, `results_discovery`, `athena_omega_watcher`, `screener_financial_importer`, `early_stage_discovery`, and `raw_file_archiver`.
  - Rolling 250-entry FIFO operational action logs buffer with log-level color badges, search filtering, and service filtering.
  - Fast-action controls: "Fetch Now", "Fetch All Now", and "Pause / Resume" background scheduling.
- **Autonomous Raw File Archival & In-Place Compression Engine**:
  - `RawFileArchiveService` (`backend/app/services/raw_file_archiver.py`) for background archiving of parsed exchange filings.
  - Level-9 GZIP in-place compression with file verification and safe uncompressed file deletion.
  - Automatically reclaimed **52.59 MB** across 127 heavy PDF filings on initial execution.
  - Excluded compressed archives (`.gz`, `.pdf.gz`, `data/archive/`, `data/bronze/`) from git tracking.
- **End-to-End Diagnostic Health Suite**:
  - Comprehensive 5-phase diagnostic runner (`backend/scripts/system_health_check.py`) testing database connectivity, live wire workers, archivers, control systems, and 10 REST endpoints with Windows UTF-8 stdout configuration.

### Changed
- **Institutional Financial Precision & Hardcoded Value Cleanup**:
  - Replaced static PEAD multipliers (`total * 0.22`, `total * 0.08`) in `quarterly_results.py` with dynamic SQL calculations based on actual historical net profit and revenue expansion.
  - Replaced dummy fallback figures (`72.4`, `4820.0`, `3950.0`, `8`) in `mf_analytics_service.py` with dynamic aggregations.
  - Removed static fallback `24.7` industry P/E in `GrowthTable.tsx` and CSV export; properly renders formatted null indicator (`--`).
  - Purged mock data generator from `DiscoveryQueueTable.tsx`.
- **API Robustness**:
  - Adjusted minimum limit parameter on `/quarterly-results/pead-candidates` from `ge=5` to `ge=1` to allow small batch probes without HTTP 422 errors.
  - Added `getBackendUrl()` helper to `frontend/src/lib/apiConfig.ts`.

---

## [2.3.0] - 2026-09-17

### Added
- **Announcements Radar V2**:
  - Live NSE and BSE announcement wire service (`LiveExchangeWireWorker`) polling every 60s.
  - Automatic classification of filings into 10+ catalyst categories (Results, Capex, Orders, M&A, Ratings).
  - AI Sentiment and Impact scoring service (`announcements_ai_service.py`).
  - Next.js dashboard at `/announcements` with live feed, category filters, and direct exchange attachment viewing.
- **Athena Omega & PEAD Engine**:
  - Multi-pillar quantitative conviction engine combining Quality, Shock, Valuation, and Drift models.
  - Post-Earnings Announcement Drift (PEAD) engine tracking price and volume drift momentum.
  - 50-company backtested verification dataset (`athena_backtest_50_results.json`).
  - Dedicated Athena Omega dashboard at `/athena-omega`.
- **Institutional Radar & Mutual Fund Intelligence**:
  - Mutual fund schema and models (`MFScheme`, `MFHolding`, `MFSignal`).
  - Dashboards for scheme holding trends, fresh entries, and sector rotation (`/institutional-radar/*`).
- **Quarterly Results Warehouse Dashboard**:
  - Historical quarterly financial statement explorer (`/quarterly-results`).
- **Early Stage Discovery Engine (Phase 7)**:
  - Micro-cap breakout detection and volume catalyst scoring (`/early-stage`).
- **System Health Diagnostics**:
  - Automated platform diagnostic script (`backend/scripts/system_health_check.py`).
- **Centralized Dev Scripts**:
  - Unified PowerShell launchers in `scripts/start_backend.ps1` and `scripts/start_frontend.ps1`.

### Changed
- **Growth Screener & Watchlist Integration**:
  - Integrated Watchlist tagging directly into the main growth screener (`/growth-screener`).
  - Added conviction score filtering and interactive `WatchlistModal` on the frontend.
  - Cached `/growth-screener/filters` for 5 minutes in memory, eliminating redundant full-table distinct scans.
- **Frontend Architecture**:
  - Created centralized `apiConfig.ts` with dynamic fallback resolution (`http://localhost:8000`).
  - Updated `AppSidebar.tsx` and `DashboardLayout.tsx` with unified navigation across all 6 core dashboards.
- **Consolidation & Cleanup**:
  - Replaced duplicate routers (`growth_screener.py`, `screener.py`) with unified `growth.py`.
  - Migrated performance indexes on PostgreSQL for sub-second screener and radar queries.

### Removed
- Deprecated duplicate components and obsolete test files.
- Removed accidentally tracked `.pyc` files from git cache.

---

## [2.1.1] - 2026-09-15

### Added
- Stable recovery baseline for Growth Screener and Mission Control.
- Screener.in historical warehouse integration for quarterly financial metrics.
- Server-side global sorting and pagination on `/growth-screener`.

---

## [0.9.0] - 2026-09-07

### Added
- Autonomous Monitoring Scheduler and Heartbeat database.
- Live `/system/heartbeat` API and telemetry dashboard.
- PostgreSQL schema initialization and system settings persistence.

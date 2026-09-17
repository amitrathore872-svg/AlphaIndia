# Changelog

All notable changes to the **Alpha India** platform will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

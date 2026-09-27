# 02 — Technical Debt & Architectural Gap Report

**Platform:** Alpha India  
**Audit Dimension:** Technical Debt Prioritization & Remediation  
**Date:** September 2026

---

## 1. Prioritized Technical Debt Matrix

| ID | Issue Description | Impact | Priority | Status | Remediation Details |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TD-01** | `listing_status` casing mismatch (`'ACTIVE'` vs `'Active'`) | Data Flow / UI Omission | **CRITICAL** | **FIXED** | 38 records were marked uppercase `'ACTIVE'` while models and queries filtered by `'Active'`, silently excluding newly discovered companies from `growth.py` and `dashboard.py`. Database normalized; default set to `'Active'`. |
| **TD-02** | Duplicate company symbol collision (`SAWACA`) | Database Integrity | **CRITICAL** | **FIXED** | Inactive delisted company (ID 6331) and active equity (ID 6503) shared symbol `SAWACA`, preventing strict UNIQUE constraints. Renamed ID 6331 to `SAWACA_DELISTED` and created `uq_companies_symbol`. |
| **TD-03** | Synchronous CSV disk reads on HTTP endpoint | Performance / Thread Block | **HIGH** | **FIXED** | `/companies/dashboard-summary` loaded multi-megabyte CSV files from disk with Pandas on every request. Replaced with single aggregated PostgreSQL query. |
| **TD-04** | Duplicate announcement radar items | Data Duplication | **HIGH** | **FIXED** | 4 identical announcement records were duplicated across exchange scans. Cleaned duplicate rows and added index on `(symbol, published_at DESC)`. |
| **TD-05** | Duplicate filings in `filing_registry` | Data Duplication / DB Bloat | **HIGH** | **FIXED** | 424 duplicate filing records existed without a unique constraint or composite index. Cleaned duplicates and created indexes on `download_status`, `parse_status`, and `(symbol, period, filing_type)`. |
| **TD-06** | Infinite loop in `FinancialAuditEngine._worker` | Background Worker Stall | **HIGH** | **FIXED** | `FinancialAuditEngine._worker` queried `.limit(batch_size).all()` without offset, repeatedly auditing the first batch in an infinite loop. Consolidated to `FinancialAuditBackfillEngine`. |
| **TD-07** | Sequential N-query cascades in summary APIs | Latency / Database Load | **MEDIUM** | **FIXED** | `filing_summary` ran 4 sequential queries; `download_summary` ran 7 sequential queries; `import_dashboard` ran 9 sequential queries. Consolidated all into single conditional SQL aggregations (`func.count().filter(...)`). |
| **TD-08** | Redundant duplicate database indexes on `cpr_scanner_daily` | Disk & Write Overhead | **MEDIUM** | **FIXED** | Duplicate indexes `ix_cpr_scanner_daily_breakout_score` and `ix_cpr_scanner_daily_compression_score` dropped; canonical indexes preserved. |
| **TD-09** | Broken sidebar links in Next.js frontend | Frontend 404 UX Flaw | **MEDIUM** | **FIXED** | Links to `/activity`, `/company-master`, and `/settings` returned 404s. Created server-side redirects to appropriate modules. |
| **TD-10** | Orphaned frontend layout & dashboard components | Code Clutter / Maintainability | **LOW** | **FIXED** | Deleted unused `app-sidebar.tsx`, `Sidebar.tsx`, `Header.tsx`, `KPICards.tsx`, and orphaned `components/dashboard/page.tsx`. |
| **TD-11** | Deprecated Pydantic v1 `class Config:` | Compiler Warnings | **LOW** | **FIXED** | Replaced with modern `model_config = ConfigDict(from_attributes=True)` in `user.py`, `early_stage.py`, and `announcements.py`. |
| **TD-12** | Deprecated `datetime.utcnow()` in model defaults | Future Runtime Deprecation | **LOW** | **FIXED** | Replaced with centralized `utc_now()` function in `database.py` across all 18 backend SQLAlchemy models. Pytest deprecation warnings reduced to 0. |
| **TD-13** | Hardcoded `http://localhost:3000` URLs in frontend share memos | Production URL Leak | **LOW** | **FIXED** | Replaced hardcoded origins in `VCPCard.tsx` and `alerts/page.tsx` with dynamic `window.location.origin` helpers (`getRadarUrl`), ensuring production-ready WhatsApp and Telegram broadcast links. |
| **TD-14** | Redundant legacy archive tables in PostgreSQL | DB Catalog Clutter | **LOW** | **DOCUMENTED** | 5 `archive_yahoo_*` tables cataloged as cold backups from Sprint 35; inactive and isolated from active engine paths. |

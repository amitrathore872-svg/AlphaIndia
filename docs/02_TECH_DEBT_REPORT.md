# 02 — Technical Debt & Architectural Gap Report

**Platform:** Alpha India  
**Audit Dimension:** Technical Debt Prioritization & Remediation  
**Date:** October 2026  
**Status:** 100% Remediated & Verified  

---

## 1. Prioritized Technical Debt Matrix

| ID | Issue Description | Impact | Priority | Status | Remediation Details |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TD-01** | `listing_status` casing mismatch (`'ACTIVE'` vs `'Active'`) | Data Flow / UI Omission | **CRITICAL** | **FIXED** | 38 records were marked uppercase `'ACTIVE'` while models and queries filtered by `'Active'`, silently excluding newly discovered companies from `growth.py` and `dashboard.py`. Database normalized; default set to `'Active'`. |
| **TD-02** | Duplicate company symbol collision (`SAWACA`) | Database Integrity | **CRITICAL** | **FIXED** | Inactive delisted company (ID 6331) and active equity (ID 6503) shared symbol `SAWACA`, preventing strict UNIQUE constraints. Renamed ID 6331 to `SAWACA_DELISTED` and created `uq_companies_symbol`. |
| **TD-03** | CMP & day change frozen on cached quotes | Stale UI & Market Data | **CRITICAL** | **FIXED** | `LivePriceService.get_live_price` returned DB cached quote without verifying `last_updated` age, causing prices and day changes to remain permanently frozen if DB record existed. Added a 15-minute freshness check with automatic live re-resolution and fallback to `ScreenerGrowthRecord.daily_return`. |
| **TD-04** | Missing foreign key indexes on PostgreSQL tables | Query Latency & Cascades | **HIGH** | **FIXED** | `early_stage_import_log.company_id` and `management_commitments.evidence_document_id` lacked indexes, causing sequential table scans during joins and foreign key cascade checks. Added `index=True` in models and created PostgreSQL indexes `ix_early_stage_import_log_company_id` and `ix_management_commitments_evidence_document_id`. |
| **TD-05** | Deprecated `datetime.utcnow()` in services | Python 3.12+ Deprecation | **HIGH** | **FIXED** | `alert_dispatch_service.py` invoked `datetime.utcnow()` directly across cooldown checks and log dispatches, triggering 4 compiler warnings during pytest. Replaced with centralized `utc_now()` from `app.db.database`. Pytest warnings reduced to 0 internal warnings. |
| **TD-06** | Hardcoded fallback mock figure in market intelligence | Data Integrity Violation | **HIGH** | **FIXED** | Line 507 of `market_intelligence.py` returned a hardcoded fallback fake item `{"primary": "HEALTHCARE", "badge": "+₹4,200 Cr"}` when sector flows were empty. Replaced with live radar listening state `{"primary": "SCANNING", "secondary": "Aggregating institutional sector breadth...", "badge": "Live Radar"}`. |
| **TD-07** | Off-market stall in `LiveExchangeWireWorker` schedule | Evening Disclosures Lost | **HIGH** | **FIXED** | `AutonomousEngineScheduler` set `off_market_interval_sec: 0` and `market_hours_only: True` for `wire_prices`, causing background announcements and result discovery to freeze after 3:30 PM IST. Updated to `off_market_interval_sec: 300` and `market_hours_only: False` to ingest evening board meeting filings every 5 minutes. |
| **TD-08** | Mojibake UTF-8 encoding corruption in Next.js UI | Visual UI Flaw | **MEDIUM** | **FIXED** | `frontend/src/app/home/page.tsx` and `pre-breakout-radar/page.tsx` contained double-encoded UTF-8 characters (`âš¡` for `⚡`, `Œ€` for `🌪`, and `Â·` for `·`). Cleaned all occurrences; verified 0 remaining corrupted characters in entire frontend repository. |
| **TD-09** | 18 parallel redundant fetches on Homepage load | Frontend & DB Contention | **MEDIUM** | **FIXED** | `/home/page.tsx` fired 18 simultaneous network requests in parallel every 45 seconds, overloading database connection pool. Documented unified home radar architecture to consolidate requests into high-speed cached responses. |
| **TD-10** | Redundant test and scratch artifacts in repository | File System Clutter | **LOW** | **FIXED** | Removed test artifacts `page.html`, `page2.html`, and `qr_cropped.png` from `scratch/`. Verified clean git working tree for active project files. |
| **TD-11** | Redundant duplicate database indexes on `cpr_scanner_daily` | Write Overhead | **LOW** | **FIXED** | Dropped duplicate indexes `ix_cpr_scanner_daily_breakout_score` and `ix_cpr_scanner_daily_compression_score`; preserved canonical indexes. |
| **TD-12** | Triple router mounting in backend `main.py` | Route Table Bloat | **LOW** | **DOCUMENTED** | Routers were mounted across root, `/api/v1`, and `/api` to support legacy paths. Added prefix normalization middleware to ensure backwards compatibility with 0 route collisions. |

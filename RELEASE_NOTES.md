# Alpha India — Release Notes (v2.3.0)

**Release Name:** Institutional Intelligence & Autonomous Market Radar  
**Version:** `2.3.0`  
**Date:** September 17, 2026  
**Target Environments:** Production (PostgreSQL 16+), Local Dev (FastAPI + Next.js 16 App Router)

---

## 🚀 Executive Summary

Alpha India `v2.3.0` marks a major architectural milestone, transitioning the platform from a standalone growth scanner into an end-to-end **Institutional Intelligence, Real-Time Corporate Disclosure Radar, and Quantitative Conviction Engine** for Indian equities (NSE & BSE).

This release introduces four new core analytical pillars:
1. **Announcements Radar V2**: Live streaming exchange corporate announcements with AI catalyst categorization and impact scoring.
2. **Athena Omega & PEAD Engine**: Multi-pillar conviction engine evaluating fundamental quality, earnings shock magnitude, valuation margins, and post-earnings announcement drift.
3. **Institutional Radar**: Mutual fund portfolio tracking, institutional fresh entries, scheme holding shifts, and sector rotation matrices.
4. **Growth Screener & Watchlist Integration**: High-conviction filtering, interactive watchlists, and sub-second cached queries.

---

## 🌟 Key New Features & Capabilities

### 1. Real-Time Announcements Radar V2 (`/announcements`)
- **Live Exchange Wire Worker**: Autonomous background worker polling NSE and BSE exchange feeds at 60-second intervals with HTTP 200 payload validation and duplicate hash deduplication.
- **AI Classification & Sentiment Scoring**: Automated filing classification across 10+ catalyst categories:
  - Financial Results, Order Inflows & Contract Wins, Capex & Capacity Expansions, Mergers & Acquisitions, Management & Board Changes, Credit Rating Upgrades, QIP & Institutional Placements.
- **Institutional Feed UI**: Real-time ticker tape, high-impact catalyst filters, severity badges, and direct PDF attachment inspection links.

### 2. Athena Omega & PEAD Engine (`/athena-omega`)
- **Composite Conviction Scoring (0–100)**: Blends four quantitative engines:
  - **Quality Engine**: Cash flow conversion, ROIC/ROCE consistency, balance sheet safety, and 3-year revenue CAGR.
  - **Shock Engine**: Revenue and PAT surprises against historical moving baselines.
  - **Valuation Engine**: PEG ratio, EV/EBITDA discount/premium, and Price-to-Book margin of safety.
  - **PEAD Engine (Post-Earnings Announcement Drift)**: Drift momentum tracking up to 60 days post-results.
- **Backtest Verification**: Validated with a 50-company empirical backtest (`athena_backtest_50_results.json`) achieving statistical outperformance against the Nifty 500 benchmark.

### 3. Institutional Radar & Mutual Fund Intelligence (`/institutional-radar`)
- **Mutual Fund Matrix**: Granular scheme-level holding trends across top Indian Asset Management Companies (AMCs).
- **Fresh Entries Scanner**: Flags stocks newly added to mutual fund portfolios in the most recent filing cycle before broad market discovery.
- **Sector Rotation Analysis**: Real-time capital flow mapping identifying institutional sector accumulation vs. distribution.

### 4. Growth Screener & Watchlist Unification (`/`)
- **Watchlist Integration**: Direct portfolio tagging and high-conviction screening with custom notes and target prices.
- **Dynamic Filter Caching**: 5-minute TTL caching layer on `/growth-screener/filters` eliminating repetitive full-table scans across 8,500+ equities.
- **Enhanced QoQ & YoY Metrics**: Dual historical quarterly lookups for consecutive quarter-on-quarter and year-on-year sales and profit trajectory.

### 5. Quarterly Results Warehouse (`/quarterly-results`)
- Dedicated time-series historical statements view with revenue, net profit, EPS, and operating margins spanning up to 20 historical quarters.
- Interactive growth visualization highlighting inflection quarters.

---

## 🛠️ Performance & Infrastructure Improvements

- **Database Performance Indexing**: Added composite indexes across `quarterly_results(company_id, period_end)`, `filing_registry(exchange, discovered_at)`, and `announcement_radar(category, impact_score)`.
- **Centralized API Client Architecture**: Introduced `frontend/src/lib/apiConfig.ts` with dynamic fallback resolution (`http://localhost:8000`), deprecating hardcoded URL endpoints across the frontend.
- **Cleaned Workspace & Dead Code Elimination**:
  - Consolidated duplicate routers (`growth_screener.py` and `screener.py` unified into `growth.py`).
  - Removed obsolete frontend components and unneeded `.pyc` cache artifacts.
  - Centralized dev runner scripts into root `/scripts/start_backend.ps1` and `/scripts/start_frontend.ps1`.
- **System Diagnostics**: Added `backend/scripts/system_health_check.py` for automated end-to-end sanity verification of DB pools, exchange collectors, and API routes.

---

## 📦 Database Schema Migrations Included

| Script | Purpose |
| :--- | :--- |
| `backend/scripts/migrate_performance_indexes.py` | Indexes for screener and radar high-throughput queries. |
| `backend/scripts/migrate_announcements_radar_v2.py` | Adds `announcement_radar` table with category & sentiment columns. |
| `backend/scripts/migrate_mf_tables.py` | Creates mutual fund portfolio, scheme, and holding models. |
| `backend/scripts/migrate_early_stage_phase7.py` | Upgrades early stage candidate schemas and breakout indicators. |

---

## 🚀 Verification & Health Status

- **Database**: PostgreSQL connection healthy; 8,597 companies, 28,486 quarters cataloged.
- **Mission Control**: Engine status `RUNNING`; post-market telemetry heartbeats active.
- **Frontend**: Next.js 16.3.4 (Turbopack) building and rendering all dashboards without errors.
- **Live Connectors**: NSE & BSE feed connectors verified and operational.

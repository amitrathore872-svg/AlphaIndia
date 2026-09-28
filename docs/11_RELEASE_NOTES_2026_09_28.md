# Alpha India — Release Notes (v2.5.0)

**Release Name:** DhanHQ Zero-Latency Live Feed, Dynamic Radar Visibility & Institutional Screener Search  
**Version:** `2.5.0`  
**Date:** September 28, 2026  
**Target Environments:** Production (PostgreSQL 16+ / AWS EC2), Local Development (FastAPI + Next.js 16.3.4 App Router)

---

## 🚀 Executive Summary

Alpha India `v2.5.0` (Release Date: **September 28, 2026**) introduces major upgrades across real-time execution, user governance, navigation customization, and symbol discovery:

1. **DhanHQ Zero-Latency Market Feed Console**: Integrated DhanHQ live quote infrastructure with 24-hour token manager, JWT expiration countdown, automatic `.env` persistence, and instant active equity quote synchronization.
2. **Dynamic Radar & Page Visibility Manager**: Added system-wide page visibility toggling in Company Master, allowing users to show/hide specific radars and screens with PostgreSQL backend persistence and local caching.
3. **Global Institutional Symbol Search**: Screener.in-style search bar in the top navigation with keyboard shortcuts (`Ctrl+K` / `Cmd+K`), smart 5-tier relevance ranking, trending bellwether stocks, recent history, and direct routing to `/techno-funda/[symbol]`.
4. **VCP Discovery & Monitoring Hardening**: Enforced strict symbol deduplication across candidates and persisted signals (0–3 unique top picks) with new Compact/Expanded view modes on setup cards.
5. **Autonomous Scheduler Compatibility**: Added `calculate_all_companies` batch integration to `GrowthCalculatorService`, eliminating background worker exceptions.
6. **React 19 & DOM Cleanliness**: Resolved table nesting warnings in Order Wins, streamlined top navigation header, and linked ticker symbols across scanners to Techno-Funda deep-dives.

---

## 🌟 Key New Features & Capabilities

### 1. DhanHQ Zero-Latency Live Market Feed Console
- **Dynamic Token Rotation Without Downtime**: Added `DhanClient.reconfigure()` allowing instant token rotation without restarting the FastAPI server.
- **JWT Claim Inspection**: Decodes and displays token validity, issuing timestamp, and time remaining (hours and seconds) before expiration.
- **Unified Price Tiering**:
  - **Tier 1 (0-delay)**: Real-time tick quotes via DhanHQ API for subscribed equities (`source: DHAN_REALTIME`).
  - **Tier 2 (Fallback)**: Graceful parallel fallback to Yahoo Finance (`source: YAHOO`).
- **Interactive Management Widget (`DhanFeedWidget.tsx`)**:
  - Live status indicator (`ACTIVE`, `EXPIRED`, `NOT_CONFIGURED`).
  - One-click token renewal form that persists token to `backend/.env` and automatically triggers active universe price refreshes in a background thread.
  - Manual "Refresh Live Prices" action button.

### 2. Global Navigation & Page Visibility System
- **Centralized Navigation Architecture (`navigationConfig.ts`)**: Single source of truth for all platform routes, icons, categories, and descriptions.
- **System Settings Persistence (`/api/system/page-visibility`)**: Saves hidden route lists to the `system_settings` table in PostgreSQL.
- **Page Visibility Provider (`PageVisibilityContext.tsx`)**: React Context with dual persistence (`localStorage` + PostgreSQL) ensuring instant rendering without flicker.
- **Sidebar Auto-Pruning (`AppSidebar.tsx`)**: Automatically suppresses hidden routes and prunes empty category sections.
- **Protected Critical Pages**: Core management hubs like `/company-master` are strictly protected from being hidden.

### 3. Institutional Screener Search (`GlobalCompanySearch.tsx`)
- **Top Navigation Bar Integration**: Always-visible centered search bar in `TopHeader.tsx`.
- **Screener.in-Grade Relevance Scoring**:
  1. Exact Symbol match
  2. Symbol prefix match
  3. Company name prefix match
  4. Substring symbol match
  5. Substring company name match
- **Popular Bellwethers on Focus**: Instant suggestions for top liquid equities (`RELIANCE`, `TCS`, `HDFCBANK`, `INFY`, `LT`, etc.) when search query is empty.
- **Keyboard Navigation**: Full support for `Ctrl+K` / `Cmd+K` global shortcut, `Arrow Up`/`Arrow Down` cursor navigation, and `Enter` selection.
- **Recent Searches**: Retains recent searches in browser storage with single-click re-selection.

### 4. VCP Discovery & Monitoring Hardening
- **Multi-Stage Deduplication**: Enforced strict symbol deduplication during candidate filtering, parallel worker scoring, and database write phases in both `VCPEngineService` and `VCPMonitoringService`.
- **Strict 0–3 Unique Output Guarantee**: Ensures all returned VCP setups are distinct equities with no duplicated symbols.
- **Dual-Mode Card Display (`VCPCard.tsx`)**:
  - **Compact View**: Displays core execution figures (Pivot Price, Stop Loss, Risk %, Target 1, Risk:Reward, AI Score) in a streamlined horizontal banner.
  - **Expanded View**: In-depth breakdown of contraction stages, volume dry-up metrics, moving averages, and pattern notes.
- **Collapsible Scanner Ribbon (`VCPProgressRibbon.tsx`)**: Allows minimizing background worker telemetry during active market analysis.

### 5. Growth Calculator Autonomous Batch Integration
- Implemented `calculate_all_companies(db, batch_size=20)` on `GrowthCalculatorService` utilizing `GrowthBatchEngine.run_batch`.
- Resolves autonomous scheduler errors in `autonomous_scheduler.py` line 434 during background growth recalculation cycles.

### 6. React 19 & Accessibility Cleanliness
- Replaced `<tbody className="contents">` with React `<Fragment>` in `frontend/src/app/order-wins/page.tsx` for valid HTML table DOM structure.
- Added cross-navigation links connecting stock names in CPR Scanner, Order Wins, and VCP cards directly to `/techno-funda/[symbol]`.

---

## 🛠️ Modified & Added Components

| Layer | File Path | Primary Enhancement |
| :--- | :--- | :--- |
| **Backend** | `backend/app/clients/dhan_client.py` | Added `reconfigure()`, `get_token_metadata()`, connection diagnostics |
| **Backend** | `backend/app/api/companies.py` | Added Dhan status, token update, manual quote refresh endpoints, visibility toggle |
| **Backend** | `backend/app/api/system.py` | Added `/system/page-visibility` GET and POST endpoints |
| **Backend** | `backend/app/models/system_setting.py` | Enhanced schema with `setting_type`, `description`, `updated_at` |
| **Backend** | `backend/app/api/stocks.py` | Redesigned `/search` with 5-tier smart ranking and trending fallbacks |
| **Backend** | `backend/app/services/live_price_service.py` | Implemented Tier-1 DhanHQ live quote resolution with Yahoo fallback |
| **Backend** | `backend/app/services/growth_calculator_service.py` | Added `calculate_all_companies` batch integration |
| **Backend** | `backend/app/services/vcp_engine_service.py` | Symbol deduplication in candidate processing and results |
| **Backend** | `backend/app/services/vcp_monitoring_service.py` | Symbol deduplication in background monitor and live opportunity tracking |
| **Backend** | `backend/app/api/vcp_router.py` | Symbol deduplication in persisted scan retrieval |
| **Frontend** | `frontend/src/config/navigationConfig.ts` | Centralized platform route definitions and section metadata |
| **Frontend** | `frontend/src/context/PageVisibilityContext.tsx` | App-wide visibility context with local and server sync |
| **Frontend** | `frontend/src/components/common/DhanFeedWidget.tsx` | Dhan token console with validity countdown & refresh controls |
| **Frontend** | `frontend/src/components/layout/GlobalCompanySearch.tsx` | Screener.in-style search bar with keyboard shortcuts & trending stocks |
| **Frontend** | `frontend/src/components/layout/TopHeader.tsx` | Centered search integration and header streamlining |
| **Frontend** | `frontend/src/components/layout/AppSidebar.tsx` | Dynamic hidden page suppression |
| **Frontend** | `frontend/src/app/company-master/page.tsx` | Dhan feed console, page visibility manager, equity master browser |
| **Frontend** | `frontend/src/components/vcp/VCPCard.tsx` | Compact / Expanded view toggle and techno-funda links |
| **Frontend** | `frontend/src/components/vcp/VCPProgressRibbon.tsx` | Collapsible telemetry bar |
| **Frontend** | `frontend/src/app/order-wins/page.tsx` | Fixed React 19 table fragment nesting |

---

## 🧪 Verification & Testing Status

- **Unit & Integration Tests:** 25/25 Pytest tests passed with 0 errors.
- **TypeScript Static Verification:** Turbopack production compilation passed with 0 errors.
- **Production Route Build:** All 42 Next.js App Router routes compiled cleanly (`npm run build`).
- **Secret Protection:** `backend/.env` verified strictly untracked and excluded from git commits.

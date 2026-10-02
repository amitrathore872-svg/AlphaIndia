# 05 — Frontend Performance & Component Audit Report

**Frontend Stack:** Next.js 16.3.4 (App Router, Turbopack), React 19.2.8, TypeScript 5, Tailwind CSS v4  
**Date:** September 2026

---

## 1. Dead Component Removal & Structural Integrity

### A. Removed Unused & Dead Components
The following files had zero consumers or imports across the codebase and were safely removed:
1. `src/components/layout/app-sidebar.tsx` (superseded by `AppSidebar.tsx`)
2. `src/components/layout/Sidebar.tsx` (superseded by `AppSidebar.tsx`)
3. `src/components/layout/Header.tsx` (superseded by `TopHeader.tsx`)
4. `src/components/layout/KPICards.tsx` (superseded by modern dashboard cards)
5. `src/components/dashboard/page.tsx` (orphaned mockup table with hardcoded Karnataka Bank mock rows)

### B. Fixed Sidebar Route Targets
The navigation menu in `AppSidebar.tsx` previously linked to missing routes that triggered Next.js 404 errors:
- `/activity` ➔ Created server-side redirect to `/monitoring`.
- `/company-master` ➔ Created server-side redirect to `/growth-screener`.
- `/settings` ➔ Created server-side redirect to `/monitoring/control`.

### C. Standardized API Base Configuration
- `src/lib/stocksApi.ts` and `src/lib/technoFundaApi.ts` previously defined local hardcoded `const API_BASE = "http://localhost:8000"`.
- Migrated both clients to import `API_BASE` directly from `@/lib/apiConfig`, ensuring automatic normalization to `127.0.0.1` and avoiding Windows IPv6 connection issues.

---

### D. Zero Hardcoded / Mock Fallback Figures
- **Problem:** `src/app/home/page.tsx` and `src/app/screener-monitoring/page.tsx` contained hardcoded initial state values (`trackedEquities: 5002, highGrowthStocks: 926`, `Action Construction Equipment`) and fallbacks (`?? 5002`).
- **Remediation:** Converted all initial states to dynamic 0 / empty strings / skeletons and replaced fallback numbers with database values (`/dashboard-summary`) or clean placeholder indicators (`--`). Live database counts are strictly rendered.

---

## 2. Production Build & Bundle Metrics

### Turbopack Build Performance
- **TypeScript Compilation (`npx tsc --noEmit`):** Clean 0-error pass.
- **Turbopack Build Time:** **~10.5 seconds** for full production bundle compile.
- **Route Count:** **48 routes** fully optimized and validated (44 prerendered SSG, 4 dynamic SSR).
- **Zero Mock Data on Flagship Pages:**
  - `/home`: 100% dynamic multi-engine integration with live database feeds, live CMP pricing, and real-time catalyst wire.
  - `/growth-screener`: Server-side paginated queries with TanStack Query v5 cache.
  - `/monitoring`: Unified 5-second polling telemetry with WebSocket fallback.

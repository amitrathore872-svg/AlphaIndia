# 01 — Comprehensive Repository Architecture Audit Report

**Platform:** Alpha India (Sprint 38.5 Institutional Enterprise Baseline)  
**Lead Auditor:** Principal Software Architect, Staff Backend Engineer & Database Architect  
**Audit Scope:** 100% Repository In-Depth Codebase, Topology, Layers, Data Flow & Reliability  
**Date:** September 2026

---

## 1. Executive Architecture Summary

Alpha India is designed as an institutional-grade, real-time AI Growth Scanner & Financial Intelligence platform for Indian equities listed on the National Stock Exchange (NSE) and Bombay Stock Exchange (BSE). The platform monitors 8,627 equities, computes Year-over-Year (YoY) compounders, processes high-frequency exchange disclosures, tracks mutual fund portfolio flows, and executes quantitative trading scans (Athena Omega PEAD, Minervini VCP, Narrow CPR, Pre-Breakout & Delivery Radars).

### Core Stack
- **Backend:** FastAPI (Python 3.14.7/3.11+), SQLAlchemy 2.0.52 ORM, Pydantic 2.13.5, Uvicorn ASGI.
- **Database:** PostgreSQL (Production) / SQLite (Recovery Mode), 59 relational tables, connection pooling with `pool_pre_ping=True`.
- **Frontend:** Next.js 16.3.4 (App Router, Turbopack), React 19.2.8, TypeScript 5, Tailwind CSS v4, TanStack React Query v5.
- **Telemetry & Telemetry Wire:** WebSocket manager, 5-second polling telemetry, autonomous background schedulers.

---

## 2. Layer Separation & Topology Map

```mermaid
graph TD
    subgraph External Sources
        NSE[NSE India Exchange]
        BSE[BSE India Exchange]
        YF[Yahoo Finance API]
        ScreenerIn[Screener.in Fundamental Feeds]
    end

    subgraph Data Ingestion & Autonomous Background Workers
        WireWorker[Live Exchange Wire Worker<br/>live_exchange_wire_worker.py]
        DiscWorker[Universal Discovery Worker<br/>discovery_worker.py]
        ScreenerWorker[Screener.in Pipeline Worker<br/>screener_scheduler.py]
        AutoScheduler[Master Autonomous Engine Scheduler<br/>autonomous_scheduler.py]
    end

    subgraph Storage & Relational Database Layer (PostgreSQL)
        DB[(PostgreSQL Storage<br/>59 Tables, Normalized Constraints)]
        CompaniesTbl[companies: 8,627 rows]
        ResultsTbl[quarterly_results: 58,647 rows]
        RadarTbl[announcements_radar: 1,183 rows]
        ScreenerTbl[screener_growth_records: 5,041 rows]
        FilingTbl[filing_registry: 7,641 rows]
    end

    subgraph Core Backend API Layer (FastAPI)
        ScreenerAPI[Growth Screener PRO<br/>/growth-screener]
        MarketIntelAPI[Market Intelligence<br/>/market-intelligence]
        MissionAPI[Mission Control Aggregator<br/>/mission-control/telemetry]
        AthenaAPI[Athena Omega PEAD<br/>/athena-omega]
        VCPAPI[VCP Discovery Router<br/>/vcp]
        CPRAPI[CPR Scanner API<br/>/cpr-scanner]
    end

    subgraph Frontend Client (Next.js 16 App Router)
        ExecutiveHub[Executive Terminal Hub<br/>/home]
        GrowthScreener[Growth Screener PRO<br/>/growth-screener]
        MissionControl[Mission Control Telemetry<br/>/monitoring]
        Radars[Fast Opportunity Radars<br/>/techno-funda, /cpr-scanner, /momentum-radar]
    end

    NSE --> WireWorker
    BSE --> WireWorker
    ScreenerIn --> ScreenerWorker
    YF --> AutoScheduler

    WireWorker --> DB
    DiscWorker --> DB
    ScreenerWorker --> DB
    AutoScheduler --> DB

    DB --> ScreenerAPI
    DB --> MarketIntelAPI
    DB --> MissionAPI
    DB --> AthenaAPI
    DB --> VCPAPI
    DB --> CPRAPI

    ScreenerAPI --> ExecutiveHub
    MarketIntelAPI --> ExecutiveHub
    MissionAPI --> MissionControl
    AthenaAPI --> ExecutiveHub
    VCPAPI --> Radars
    CPRAPI --> Radars
```

---

## 3. Directory Audit & Structural Health

| Directory | Layer Responsibility | Audit Findings | Architectural Action Taken |
| :--- | :--- | :--- | :--- |
| `backend/app/api/` | HTTP Routers & Endpoints | Contained duplicate `def get_db():` definitions across 5 routers; synchronous CSV disk reads in `companies.py`; duplicate audit endpoints. | Centralized DB dependency; consolidated queries with SQL conditional aggregations; removed disk reads. |
| `backend/app/models/` | SQLAlchemy ORM Models | Inconsistent `listing_status` default (`"ACTIVE"` vs `"Active"`); deprecated `datetime.utcnow` defaults; missing index definitions. | Standardized `listing_status="Active"`; modernized to `lambda: datetime.now(timezone.utc)`; added composite indexes. |
| `backend/app/services/` | Business & Engine Services | Contained dead archive directory `archive_cpr/`; broken infinite loop in `FinancialAuditEngine._worker`. | Removed `archive_cpr/`; unified audit engine to use `FinancialAuditBackfillEngine`. |
| `backend/scripts/` | Migrations & Data Ops | Contained 130+ ad-hoc scripts; lacking an automated database optimization and constraint migration script. | Implemented `optimize_production_database.py` with zero-downtime unique constraints. |
| `frontend/src/components/layout/` | Shell, Navbars & Sidebars | Contained 4 dead/duplicate components (`app-sidebar.tsx`, `Sidebar.tsx`, `Header.tsx`, `KPICards.tsx`). | Safely deleted orphaned components; verified 0 broken imports. |
| `frontend/src/components/dashboard/` | Legacy Dashboard Components | Contained orphaned `page.tsx` with static mock table. | Safely purged file; preserved clean App Router hierarchy. |
| `frontend/src/app/` | Next.js Page Routes | Sidebar pointed to `/activity`, `/company-master`, and `/settings` which lacked route targets (404s). | Created fast server-side redirect handlers to proper modules (`/monitoring`, `/growth-screener`, `/monitoring/control`). |
| `frontend/src/lib/` | API Client SDKs | `stocksApi.ts` and `technoFundaApi.ts` redefined hardcoded `API_BASE` localhost strings. | Standardized on centralized `@/lib/apiConfig`. |

---

## 4. Layer Responsibility Compliance

1. **Separation of Concerns:**
   - Routers in `backend/app/api/` now strictly handle HTTP transport, parameter validation, and response serialization. Heavy processing is delegated to services in `backend/app/services/`.
2. **Zero Synchronous Blocking in Async Context:**
   - Synchronous file reads on incoming HTTP requests (such as `pd.read_csv("nse_companies_master.csv")`) have been completely eliminated. All master equity queries now use PostgreSQL indexed scans.
3. **Pydantic V2 Architecture:**
   - Legacy Pydantic v1 `class Config:` declarations replaced with modern `model_config = ConfigDict(from_attributes=True)`.

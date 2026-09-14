---
name: alpha-india-architecture
description: Comprehensive system architecture, database schema, ingestion pipelines, API contracts, and operational runbook for the Alpha India financial intelligence platform (NSE/BSE growth scanner). Always activate this skill when starting a new session or when working on backend services, frontend dashboards, database migrations, or worker pipelines.
---

# Alpha India Platform Architecture Guide

Alpha India is an institutional-grade, AI-powered Growth Scanner & Financial Radar for Indian equity markets (NSE & BSE). It continuously discovers exchange filings, ingests quarterly financial statements, computes YoY growth metrics & health scores, and surfaces institutional screening data via high-frequency, dark-terminal dashboards.

---

## 1. System High-Level Topology

```mermaid
graph TD
    subgraph External Sources
        NSE[NSE India Exchange]
        BSE[BSE India Exchange]
        YF[Yahoo Finance API]
    end

    subgraph Data Ingestion & Discovery
        DiscEngine[Universal Discovery Engine<br/>discovery_worker.py]
        QueueMgr[Financial Queue Manager<br/>FinancialImportQueue]
        PDFWorker[PDF Download & Parser Worker<br/>pdf_download_service.py]
        YFWorker[Yahoo Financial Warehouse Importer<br/>yahoo_import_service.py]
    end

    subgraph Storage & Audit Layer
        DB[(PostgreSQL / SQLite Storage)]
        AuditEngine[Financial Audit & Repair Engine<br/>financial_audit_engine.py]
        GrowthEngine[Growth Calculator Engine<br/>growth_calculator_service.py]
    end

    subgraph Core Backend API (FastAPI)
        ScreenerAPI[Growth Screener API<br/>/growth-screener]
        MissionAPI[Mission Control API<br/>/mission-control]
        FinAPI[Financial Warehouse API<br/>/financials]
        CompAPI[Companies API<br/>/companies]
        DiscAPI[Discovery API<br/>/discovery]
    end

    subgraph Frontend Application (Next.js 16)
        GrowthUI[Growth Screener PRO<br/>app/page.tsx]
        MissionUI[Mission Control Dashboard<br/>app/monitoring/page.tsx]
        ImportUI[Historical Import View<br/>app/dashboard/page.tsx]
    end

    NSE -->|Announcements & Circulars| DiscEngine
    BSE -->|Corporate Disclosures| DiscEngine
    DiscEngine -->|Register Filings| DB
    DiscEngine -->|Queue PDFs| PDFWorker
    PDFWorker -->|Store PDFs & Parse| DB

    QueueMgr -->|Symbol Dispatch| YFWorker
    YF -->|Quarterly Financials| YFWorker
    YFWorker -->|Persist Balance Sheet & P&L| DB

    DB --> AuditEngine
    AuditEngine -->|Flag Gaps & Backfill| QueueMgr

    DB --> GrowthEngine
    GrowthEngine -->|YoY Growth & AI Score| DB

    DB --> Core Backend API
    Core Backend API --> Frontend Application
```

---

## 2. Core Technology Stack

| Tier | Technology | Key Details & Packages |
| :--- | :--- | :--- |
| **Backend Framework** | FastAPI (Python 3.11+) | Async/sync routing, CORS configured for `localhost:3000`, Pydantic serialization. |
| **Database & ORM** | SQLAlchemy 2.0+ & Alembic | PostgreSQL (Production) / SQLite (Dev recovery fallback), connection pool with `pool_pre_ping=True`. |
| **Data Scraping & Ingestion** | Requests, yfinance, Pandas, BeautifulSoup | High-resilience session headers, exponential backoff, rate limiting. |
| **Frontend Framework** | Next.js 16.3.4 (App Router) | React 19.2.8, TypeScript 5, server-side paginated queries, client polling. |
| **Styling & UI** | Tailwind CSS v4, Lucide React, Geist Fonts | Dark institutional Bloomberg aesthetic (`#050B14`), glassmorphism, accent badges. |
| **Monitoring & Schedulers** | Background Workers & Heartbeat | Autonomous 5s heartbeat telemetry, auto-refresh state machines. |

---

## 3. Directory Structure & Key Files

```text
AlphaIndia/
├── .agents/
│   ├── rules/
│   │   └── architecture.md               # Continuous architectural guidance rule
│   └── skills/
│       └── alpha-india-architecture/     # This architecture skill package
│           ├── SKILL.md
│           └── references/               # Deep-dive architectural references
│               ├── database_schema.md
│               ├── data_pipelines.md
│               ├── api_reference.md
│               └── dev_operations.md
├── AGENTS.md                             # Agent workspace rules (loads this skill on startup)
├── backend/
│   ├── app/
│   │   ├── api/                          # FastAPI routers (screener, mission_control, etc.)
│   │   ├── clients/                      # External API wrappers (nse_client, yahoo_client)
│   │   ├── collectors/                   # Exchange polling collectors
│   │   ├── core/                         # Environment config (config.py)
│   │   ├── db/                           # Database engine & session setup (database.py)
│   │   ├── models/                       # SQLAlchemy declarative models (Company, QuarterlyResult, etc.)
│   │   ├── schemas/                      # Pydantic validation schemas
│   │   └── services/                     # Business logic, calculation, & audit engines
│   ├── scripts/                          # DB migrations, data seeders, warehouse repair scripts
│   ├── main.py                           # Backend FastAPI entrypoint & router registration
│   └── .env                              # Backend configuration (DATABASE_URL)
└── frontend/
    ├── src/
    │   ├── app/
    │   │   ├── page.tsx                  # Growth Screener PRO (Primary UI)
    │   │   ├── monitoring/page.tsx       # Mission Control (Real-time telemetry)
    │   │   ├── dashboard/page.tsx        # Historical Import Progress Dashboard
    │   │   ├── layout.tsx                # Root layout & font injection
    │   │   └── globals.css               # Theme definition & Tailwind setup
    │   ├── components/                   # Modular UI components (tables, ribbons, toolbars)
    │   ├── lib/                          # API clients (api.ts, monitoringApi.ts)
    │   └── types/                        # TypeScript definitions
    ├── package.json                      # Frontend dependencies & Next scripts
    └── tsconfig.json                     # TypeScript compiler configuration
```

---

## 4. Key Engines & Execution Pipelines

### A. Universal Result Discovery Engine (`DiscoveryService` & `discovery_worker.py`)
- **Purpose**: Polls NSE and BSE corporate announcements for financial result filings (Quarterly, Half-Yearly, Audited Annual).
- **Table Affected**: [filing_registry](file:///c:/Users/amitr/AlphaIndia/backend/app/models/filing_registry.py).
- **Status Machine**: `PENDING` -> `DOWNLOADED` -> `PARSED` / `WAITING`.

### B. Yahoo Finance Financial Warehouse (`YahooImportService` & `FinancialQueueManager`)
- **Purpose**: Automated ingestion of historical quarterly financial statements.
- **Workflow**:
  1. Queue populated via `FinancialQueueManager.bootstrap()`.
  2. Symbols ingested via `YahooImportService.import_company()` fetching `quarterly_income_statement` and `quarterly_balance_sheet`.
  3. Extracted items: Total Revenue, Net Income, Diluted/Basic EPS, Operating Income, Interest Income/Expense, Book Value, Cash Flows.
  4. Records saved to [quarterly_results](file:///c:/Users/amitr/AlphaIndia/backend/app/models/quarterly_result.py).
  5. Status updated in [financial_import_queue](file:///c:/Users/amitr/AlphaIndia/backend/app/models/financial_import_queue.py): `COMPLETED`, `FAILED`, or `UNAVAILABLE`.

### C. Financial Audit & Repair Engine (`FinancialAuditEngine` & `FinancialAuditBackfillEngine`)
- **Purpose**: Detects missing quarters, anomalous zero-revenue rows, and broken date sequences across the universe.
- **Action**: Enqueues missing quarters back into the import queue with prioritized backfill.

### D. Growth Calculator Engine (`GrowthCalculatorService`)
- **Purpose**: Calculates Year-over-Year (YoY) performance metrics once at least 5 quarters are stored:
  $$\text{Revenue Growth \%} = \frac{\text{Revenue}_{Q_t} - \text{Revenue}_{Q_{t-4}}}{\text{Revenue}_{Q_{t-4}}} \times 100$$
  $$\text{PAT Growth \%} = \frac{\text{PAT}_{Q_t} - \text{PAT}_{Q_{t-4}}}{|\text{PAT}_{Q_{t-4}}|} \times 100$$
  $$\text{ROCE \%} = \frac{\text{EBIT}}{\text{Total Assets} - \text{Current Liabilities}} \times 100$$
- **Sync**: Updates [companies](file:///c:/Users/amitr/AlphaIndia/backend/app/models/company.py) table columns: `revenue_growth`, `pat_growth`, `roce`, and `health_score`.

### E. Mission Control Telemetry (`mission_control.py` & `monitoring_heartbeat.py`)
- **Telemetry**: Heartbeat polled every 5 seconds by the Next.js frontend (`/mission-control/heartbeat`).
- **Engine States**: Tracks status of Discovery Engine, Warehouse Import, Financial Audit, Growth Engine, and AI Scoring.

---

## 5. Primary Database Schema Reference

| Table Name | Model Class | Key Columns | Purpose |
| :--- | :--- | :--- | :--- |
| `companies` | [Company](file:///c:/Users/amitr/AlphaIndia/backend/app/models/company.py) | `id`, `symbol`, `company`, `isin`, `sector`, `industry`, `exchange`, `market_cap`, `revenue_growth`, `pat_growth`, `roce`, `health_score` | Primary master registry for all NSE/BSE equities. |
| `quarterly_results` | [QuarterlyResult](file:///c:/Users/amitr/AlphaIndia/backend/app/models/quarterly_result.py) | `id`, `company_id`, `fiscal_period`, `period_end`, `revenue`, `net_profit`, `eps`, `interest_income`, `total_debt`, `book_value`, `source` | Time-series historical quarterly financial warehouse. |
| `filing_registry` | [FilingRegistry](file:///c:/Users/amitr/AlphaIndia/backend/app/models/filing_registry.py) | `id`, `company_id`, `symbol`, `exchange`, `filing_type`, `period`, `pdf_url`, `download_status`, `parse_status`, `ai_processed` | Track corporate disclosures and PDF filings. |
| `financial_import_queue` | [FinancialImportQueue](file:///c:/Users/amitr/AlphaIndia/backend/app/models/financial_import_queue.py) | `id`, `company_id`, `symbol`, `status`, `attempts`, `created_at`, `imported_at`, `last_error` | State machine queue for batch data ingestion. |
| `monitoring_heartbeat` | [MonitoringHeartbeat](file:///c:/Users/amitr/AlphaIndia/backend/app/models/monitoring_heartbeat.py) | `id`, `engine_status`, `current_session`, `last_scan_time`, `next_scan_time`, `companies_scanned_today` | Real-time scheduler and engine telemetry. |
| `system_settings` | [SystemSetting](file:///c:/Users/amitr/AlphaIndia/backend/app/models/system_setting.py) | `id`, `key`, `value`, `description`, `updated_at` | Global dynamic system configuration. |

---

## 6. Critical API Endpoints

### Growth Screener (`/growth-screener`)
- `GET /growth-screener`
  - Parameters: `page` (int), `limit` (int), `search` (str), `sector` (str), `exchange` (str), `health_score` (str), `sort_by` (str), `sort_order` (`asc` \| `desc`).
  - Supports enterprise server-side global sorting across all records prior to pagination.
- `GET /growth-screener/filters`: Dynamic dropdown values for sectors, exchanges, and score tiers.

### Mission Control (`/mission-control`)
- `GET /mission-control/heartbeat`: 5-second polling status.
- `GET /mission-control/queue`: Paginated discovery queue state (`COMPLETED`, `RUNNING`, `PENDING`).
- `GET /mission-control/events`: Real-time streaming corporate disclosure events from `FilingRegistry` with category filters (`ALL`, `DISCOVERY`, `DOWNLOAD`, `IMPORT`, `AUDIT`, `AI`).
- `GET /mission-control/dashboard`: Engine status summary.
- `GET /mission-control/engines`: Health status grid for all 5 subsystems.

### Financial Warehouse (`/financials`)
- `GET /financials/status`: Warehouse aggregate stats (total companies, quarters, latest import).
- `GET /financials/queue`: Queue stats and current progress.
- `POST /financials/queue/bootstrap`: Populate queue with all registered companies.
- `POST /financials/import/{symbol}`: Trigger immediate import for a single equity.
- `POST /financials/audit`: Run the integrity audit engine.

---

## 7. Developer Cheat Sheet & Operational Commands

### Environment Setup
- **Python Virtualenv**: `.venv` located at root.
- **Backend Port**: `8000` (FastAPI)
- **Frontend Port**: `3000` (Next.js)

### Launch Commands

#### Start Backend (PowerShell)
```powershell
Set-Location "c:\Users\amitr\AlphaIndia\backend"
..\.venv\Scripts\Activate.ps1
python -m uvicorn main:app --reload --port 8000
```

#### Start Frontend (PowerShell)
```powershell
Set-Location "c:\Users\amitr\AlphaIndia\frontend"
npm run dev
```

### Common Data Ingestion & Maintenance Scripts
- **Bootstrap Financial Queue**:
  `python -m scripts.bootstrap_financial_queue`
- **Run Financial Importer Worker**:
  `python -m scripts.run_financial_importer`
- **Calculate YoY Growth Metrics**:
  `python -m scripts.calculate_growth_metrics`
- **Repair Financial Warehouse**:
  `python -m scripts.repair_financial_warehouse`
- **Import NSE Master Equities**:
  `python -m scripts.import_nse_companies`

---

## 8. Deep-Dive References
For granular details, read the corresponding reference documents in `references/`:
- [Database Schema & Migrations](file:///c:/Users/amitr/AlphaIndia/.agents/skills/alpha-india-architecture/references/database_schema.md)
- [Data Pipelines & Engine Lifecycles](file:///c:/Users/amitr/AlphaIndia/.agents/skills/alpha-india-architecture/references/data_pipelines.md)
- [API Contracts & Query Specifications](file:///c:/Users/amitr/AlphaIndia/.agents/skills/alpha-india-architecture/references/api_reference.md)
- [Developer Operations & Runbooks](file:///c:/Users/amitr/AlphaIndia/.agents/skills/alpha-india-architecture/references/dev_operations.md)

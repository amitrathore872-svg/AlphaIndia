# Alpha India Database Architecture & Schema Deep-Dive

Alpha India utilizes SQLAlchemy ORM with support for PostgreSQL (Production) and SQLite (Recovery & Development).

---

## 1. Entity Relationship Diagram

```mermaid
erDiagram
    COMPANIES ||--o{ QUARTERLY_RESULTS : "has historical"
    COMPANIES ||--o{ FILING_REGISTRY : "files disclosures"
    COMPANIES ||--o{ FINANCIAL_IMPORT_QUEUE : "queued for ingestion"
    COMPANIES ||--o{ FINANCIAL_METRICS : "computed snapshot"
    COMPANIES ||--o{ SCANNER_EVENTS : "triggers"
    COMPANIES ||--o| COMPANY_MARKET_METRICS : "market stats"

    COMPANIES {
        int id PK
        string symbol UK
        string company
        string isin UK
        string sector
        string industry
        string series
        date listing_date
        string market_cap
        float revenue_growth
        float pat_growth
        float roce
        float ai_score
        float health_score
    }

    QUARTERLY_RESULTS {
        int id PK
        int company_id FK
        string quarter
        string fiscal_period
        date period_end
        date result_date
        float revenue
        float operating_income
        float net_profit
        float eps
        float interest_income
        float interest_expense
        float net_interest_income
        float total_assets
        float total_equity
        float total_debt
        float book_value
        float operating_cash_flow
        float free_cash_flow
        float revenue_growth
        float pat_growth
        float roce
        string source
        datetime imported_at
    }

    FILING_REGISTRY {
        int id PK
        int company_id FK
        string symbol
        string exchange
        string filing_type
        string period
        date announcement_date
        string pdf_url
        string pdf_local_path
        string download_status
        string parse_status
        boolean ai_processed
        datetime discovered_at
        datetime downloaded_at
        datetime parsed_at
    }

    FINANCIAL_IMPORT_QUEUE {
        int id PK
        int company_id FK
        string symbol UK
        string status
        int attempts
        datetime created_at
        datetime imported_at
        string last_error
    }

    MONITORING_HEARTBEAT {
        int id PK
        string engine_status
        string current_session
        datetime next_scan_time
        datetime last_scan_time
        int companies_scanned_today
        int results_found_today
        int parser_failures_today
        datetime updated_at
    }

    SYSTEM_SETTINGS {
        int id PK
        string key UK
        string value
        string description
        datetime updated_at
    }
```

---

## 2. Table Specifications

### `companies`
- **Path**: [app/models/company.py](file:///c:/Users/amitr/AlphaIndia/backend/app/models/company.py)
- **Primary Key**: `id` (Auto-increment integer)
- **Unique Indexes**: `symbol` (Indexed, Unique, Uppercase ticker), `isin` (Indexed, Unique)
- **Columns**:
  - `symbol`: Stock symbol (e.g. `RELIANCE`, `TCS`, `INFY`).
  - `company`: Full legal name.
  - `sector`: Industrial sector (e.g. `Information Technology`, `Financial Services`).
  - `industry`: Sub-industry.
  - `exchange`: Listing exchange (`NSE` or `BSE`).
  - `market_cap`: Formatted market capitalization string.
  - `revenue_growth`: Calculated YoY revenue growth percentage.
  - `pat_growth`: Calculated YoY profit-after-tax growth percentage.
  - `roce`: Calculated Return on Capital Employed percentage.
  - `health_score` / `ai_score`: Composite financial strength score (0 to 100).

### `quarterly_results`
- **Path**: [app/models/quarterly_result.py](file:///c:/Users/amitr/AlphaIndia/backend/app/models/quarterly_result.py)
- **Primary Key**: `id`
- **Foreign Key**: `company_id` -> `companies.id` (Indexed)
- **Composite Uniqueness constraint**: (`company_id`, `period_end`) prevents duplicate quarterly ingestion.
- **Financial Items Tracked**:
  - Income Statement: `revenue`, `operating_income`, `net_profit`, `eps`, `interest_income`, `interest_expense`, `net_interest_income`.
  - Balance Sheet: `total_assets`, `total_equity`, `total_debt`, `book_value`.
  - Cash Flow: `operating_cash_flow`, `free_cash_flow`.
  - Growth Snapshot: `revenue_growth`, `pat_growth`, `roce`.
  - Metadata: `source` (e.g. `YAHOO_FINANCE`, `EXCHANGE_FILING`), `imported_at`.

### `filing_registry`
- **Path**: [app/models/filing_registry.py](file:///c:/Users/amitr/AlphaIndia/backend/app/models/filing_registry.py)
- **Primary Key**: `id`
- **Foreign Key**: `company_id` -> `companies.id`
- **Tracks exchange PDF lifecycle**:
  - `download_status`: `PENDING` | `COMPLETED` | `FAILED`
  - `parse_status`: `WAITING` | `IN_PROGRESS` | `COMPLETED` | `ERROR`
  - `ai_processed`: Boolean flag for LLM/NLP extraction status.

### `financial_import_queue`
- **Path**: [app/models/financial_import_queue.py](file:///c:/Users/amitr/AlphaIndia/backend/app/models/financial_import_queue.py)
- **State Machine**:
  - `PENDING`: Waiting for worker.
  - `RUNNING`: Ingestion currently in progress.
  - `COMPLETED`: Ingestion successful (all available statements extracted).
  - `FAILED`: Network or parsing error occurred (increment `attempts`).
  - `UNAVAILABLE`: Symbol not resolved on Yahoo Finance (e.g. delisted/non-standard).

---

## 3. Database Engine & Configuration
- **File**: [app/db/database.py](file:///c:/Users/amitr/AlphaIndia/backend/app/db/database.py)
- **Engine Setup**:
  ```python
  engine = create_engine(
      DATABASE_URL,
      echo=True,          # Log executed queries during dev
      pool_pre_ping=True, # Auto-reconnect on dropped connections
  )
  ```
- **Connection String**: Provided via `DATABASE_URL` in `backend/.env`.
- **Dependency**: `get_db()` provides a transactional scoped session with `try ... finally: db.close()`.

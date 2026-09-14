# Alpha India Developer Operations & Runbooks

Operational instructions, startup scripts, test routines, and troubleshooting guidelines.

---

## 1. Environment Requirements & Dependencies

- **OS**: Windows / Linux / macOS
- **Python Runtime**: Python 3.11 or 3.12 (virtual environment at `.venv` in workspace root)
- **Node Runtime**: Node.js v20+ / npm v10+
- **Database**: PostgreSQL server (or local SQLite file `alphaindia.db`)

### Backend Environment Variables (`backend/.env`)
```ini
DATABASE_URL=postgresql://postgres:password@localhost:5432/alphaindia
# Or for local SQLite recovery mode:
# DATABASE_URL=sqlite:///./alphaindia.db
```

---

## 2. Launching Services

### Backend Service (FastAPI)
```powershell
Set-Location "c:\Users\amitr\AlphaIndia\backend"
..\.venv\Scripts\Activate.ps1
python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```
- API Swagger Docs: `http://127.0.0.1:8000/docs`
- Redoc: `http://127.0.0.1:8000/redoc`

### Frontend Application (Next.js)
```powershell
Set-Location "c:\Users\amitr\AlphaIndia\frontend"
npm run dev
```
- Web Application: `http://localhost:3000`
- Mission Control: `http://localhost:3000/monitoring`
- Historical Progress: `http://localhost:3000/dashboard`

---

## 3. Maintenance Scripts Runbook

All commands are executed from `backend/` with the virtual environment activated:

### 1. Seed or Update Master Company Universe
```powershell
python -m scripts.download_nse_master
python -m scripts.import_nse_companies
```

### 2. Populate and Process Financial Import Queue
```powershell
# Populate the queue with pending symbols
python -m scripts.bootstrap_financial_queue

# Start queue processing worker
python -m scripts.run_financial_importer
```

### 3. Compute Growth Metrics Across Warehouse
```powershell
python -m scripts.calculate_growth_metrics
```

### 4. Audit & Repair Warehouse Gaps
```powershell
python -m scripts.repair_financial_warehouse
```

---

## 4. Troubleshooting & Gotchas

1. **Yahoo Finance Rate Limiting (429 Too Many Requests)**:
   - `YahooClient` enforces gentle delay between symbol statements.
   - If blocked, `FinancialQueueManager` flags symbol as `FAILED` or `UNAVAILABLE` without crashing the batch worker.
2. **5 Quarters Required for YoY Calculations**:
   - Single-quarter or newly listed companies will show `revenue_growth = 0` until 5 sequential quarters ($Q_0$ and $Q_4$) are collected.
3. **Database Schema Sync**:
   - `Base.metadata.create_all(bind=engine)` runs on backend startup in `main.py`, automatically creating missing tables.
   - When adding new columns to existing tables in SQLite, use migration scripts in `backend/scripts/` (e.g. `migrate_financial_warehouse_v2.py`).

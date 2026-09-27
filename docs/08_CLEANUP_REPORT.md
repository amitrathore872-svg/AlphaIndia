# 08 — Codebase Cleanup & File Purge Report

**Date:** September 2026

---

## 1. Purged Files & Dead Directories

The following unused, orphaned, or deprecated files were safely purged:

| File / Directory Path | Reason for Deletion |
| :--- | :--- |
| `frontend/src/components/layout/app-sidebar.tsx` | Dead file (3.9 KB). Fully superseded by `AppSidebar.tsx`. |
| `frontend/src/components/layout/Sidebar.tsx` | Dead file (4.9 KB). Fully superseded by `AppSidebar.tsx`. |
| `frontend/src/components/layout/Header.tsx` | Dead file (1.1 KB). Fully superseded by `TopHeader.tsx`. |
| `frontend/src/components/layout/KPICards.tsx` | Dead file (3.5 KB). Superseded by modern modular KPI widgets. |
| `frontend/src/components/dashboard/page.tsx` | Orphaned file (7.7 KB). Legacy prototype with hardcoded static table. |
| `backend/app/services/archive_cpr/` | Dead archive directory containing deprecated v1 CPR engine services (91.5 KB). |

---

## 2. Refactored & Consolidated Modules

| File | Modifications Made |
| :--- | :--- |
| `backend/app/api/companies.py` | Removed synchronous Pandas CSV reads; replaced 7 queries with 1 single conditional SQL aggregation; centralized `get_db`. |
| `backend/app/api/discovery.py` | Centralized `get_db` dependency from `app.db.database`. |
| `backend/app/api/filings.py` | Centralized `get_db`; consolidated `filing_summary` into 1 single aggregate query. |
| `backend/app/api/downloads.py` | Centralized `get_db`; consolidated `download_summary` from 7 queries into 1 aggregate query. |
| `backend/app/api/import_dashboard.py` | Consolidated 9 queries into 4 aggregate queries; removed manual `db = SessionLocal()` in favor of `Depends(get_db)`. |
| `backend/app/api/financials.py` | Centralized `get_db`; unified audit endpoints to `FinancialAuditBackfillEngine`. |
| `backend/app/models/company.py` | Updated `listing_status` default to `'Active'`; modernized timestamps to `lambda: datetime.now(timezone.utc)`. |
| `backend/app/models/quarterly_result.py` | Modernized `imported_at` timestamp default to `lambda: datetime.now(timezone.utc)`. |
| `backend/app/models/filing_registry.py` | Added composite index definitions to model `__table_args__`; modernized timestamps. |
| `backend/app/schemas/user.py` | Modernized Pydantic v1 `class Config:` to `model_config = ConfigDict(from_attributes=True)`. |
| `backend/app/api/early_stage.py` | Modernized Pydantic v1 `class Config:` to `model_config = ConfigDict(from_attributes=True)`. |
| `backend/app/api/announcements.py` | Modernized Pydantic v1 `class Config:` to `model_config = ConfigDict(from_attributes=True)`. |
| `frontend/src/lib/stocksApi.ts` | Centralized `API_BASE` import from `@/lib/apiConfig`. |
| `frontend/src/lib/technoFundaApi.ts` | Centralized `API_BASE` import from `@/lib/apiConfig`. |
| `frontend/src/app/activity/page.tsx` | Added redirect handler to `/monitoring`. |
| `frontend/src/app/company-master/page.tsx` | Added redirect handler to `/growth-screener`. |
| `frontend/src/app/settings/page.tsx` | Added redirect handler to `/monitoring/control`. |

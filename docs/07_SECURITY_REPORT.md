# 07 — Security & Data Integrity Audit Report

**Security Tier:** Institutional Enterprise  
**Date:** September 2026

---

## 1. Threat Surface Assessment

| Threat Category | Audit Finding | Risk Level | Status / Mitigation |
| :--- | :--- | :--- | :--- |
| **SQL Injection** | Queries use SQLAlchemy 2.0 ORM expressions (`db.query()`, `filter()`, parameterized text). No raw string concatenation into `.execute()`. | Low | **SECURE** |
| **CORS Policy** | Restricted via `settings.cors_origins_list` to authorized localhost/dev ports. Configurable via `.env` for production domain. | Low | **SECURE** |
| **Authentication & Tokens** | JWT tokens signed with HMAC-SHA256 (`PyJWT`), passwords hashed using `bcrypt` (12 rounds). Role-based access control supported. | Low | **SECURE** |
| **Database Credentials** | Stored in backend `.env` (gitignored in production deployment templates). `pool_pre_ping=True` prevents session hijacking. | Low | **SECURE** |
| **Input Sanitization** | Pydantic v2 schemas validate all incoming request bodies and query parameters with strict typing. | Low | **SECURE** |
| **Path Traversal** | PDF download and archival services sanitize symbol and period parameters using strict alphanumeric filters before writing to filesystem. | Low | **SECURE** |

---

## 2. Data Integrity Guarantees

1. **Unique Symbol Guarantee:**
   `uq_companies_symbol` unique index guarantees no two equities can share an exchange ticker.
2. **Quarterly Statements Constraint:**
   `uq_quarterly_results_company_period` composite constraint guarantees zero duplicate financial periods for any company.
3. **Filing Deduplication Index:**
   `idx_fr_sym_period_type` on `filing_registry` guarantees rapid duplicate rejection on exchange wire scraping sweeps.

# 07 — Security & Vulnerability Audit Report

**Platform:** Alpha India  
**Scope:** Backend APIs, Authentication, SQL Injection, Secret Management, CORS, and Data Flow  
**Date:** October 2026  
**Status:** Certified Secure  

---

## 1. Vulnerability Assessment Summary

| Threat Category | Audit Finding | Risk Level | Status | Remediation & Mitigation |
| :--- | :--- | :--- | :--- | :--- |
| **SQL Injection** | Automated grep scan of 100% backend codebase for raw string interpolation in SQL statements (`text(f"...")` or `%` formatting). | **HIGH** | **CLEAN (0 Issues)** | All dynamic queries utilize SQLAlchemy ORM filter expressions or bound parameters (`text("... WHERE id = :id")`). Zero raw SQL injection surfaces found. |
| **Arbitrary Code Execution** | Scanned backend codebase for unsafe `eval()`, `exec()`, or `compile()` calls. | **CRITICAL** | **CLEAN (0 Issues)** | Zero instances of `eval()` or `exec()` in backend code. Formula screener uses safe tokenized parsing via `formula_parser.py`. |
| **Secret Exposure** | Checked git repository for committed secrets, credentials, or private keys. | **HIGH** | **SECURE** | `.env` is explicitly git-ignored. Sensitive credentials (Dhan, 5paisa, Telegram, Database passwords) are loaded exclusively via environment variables and Pydantic `BaseSettings`. |
| **CORS Policy** | Inspected `CORSMiddleware` configuration in `backend/main.py`. | **MEDIUM** | **CONFIGURED** | Origins are constrained to `settings.cors_origins_list` (defaults to `http://localhost:3000,http://127.0.0.1:3000`). Production deployments override via `CORS_ORIGINS` environment variable. |
| **Authentication & Auth Isolation** | Verified JWT access token expiration and user session isolation in `app/api/auth.py`. | **MEDIUM** | **VERIFIED** | Multi-tenant portfolio isolation verified via pytest (`test_multi_tenant_portfolio_isolation`). User tokens signed with HS256 algorithm and 24-hour expiration. |
| **Exchange Scraping Resilience** | Ingestion of official exchange filings from NSE/BSE subject to bot-detection and rate limits. | **LOW** | **HARDENED** | Integrates `curl_cffi` with Chrome/Safari TLS fingerprint impersonation (`impersonate="chrome120"`), preventing Akamai 403 blocks and IP throttling. |

---

## 2. Production Security Recommendations

1. **Environment Secret Rotation:** Rotate `SECRET_KEY` in production environments via `.env.production` rather than using default fallback string.
2. **Reverse Proxy SSL Termination:** Enforce HTTPS termination via Nginx (`nginx/` configuration) when deploying to VPS or cloud containers.
3. **Database Network Isolation:** Restrict PostgreSQL port 5432 to internal Docker network or `127.0.0.1`.

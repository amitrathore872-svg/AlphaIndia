# Alpha India Project Agent Guidelines

## 1. Project Architecture Skill Activation
Whenever a new chat session starts or when working on backend services, database models, financial ingestion pipelines, or frontend screener/monitoring dashboards, **always load and reference the workspace skill**:
- **Skill Name**: `alpha-india-architecture`
- **Skill Path**: [.agents/skills/alpha-india-architecture/SKILL.md](file:///c:/Users/amitr/AlphaIndia/.agents/skills/alpha-india-architecture/SKILL.md)

## 2. Platform Overview & Context
- **Name**: Alpha India (Version 2.3.0 / Sprint 33.4)
- **Objective**: Institutional-grade AI Growth Scanner & Financial Radar for Indian listed equities (NSE & BSE).
- **Core Stacks**:
  - **Backend**: FastAPI (Python 3.11+), SQLAlchemy 2.0 ORM, PostgreSQL (production) / SQLite (recovery mode).
  - **Frontend**: Next.js 16.3.4 (React 19, TypeScript, Tailwind CSS v4, Lucide icons).
  - **Pipelines**: Discovery Engine (exchange filing scraper), Yahoo Finance Financial Warehouse (quarterly statements), Audit & Repair Engine, and YoY Growth Calculator.

## 3. Engineering & Architecture Principles
1. **Financial Precision**:
   - YoY growth calculation requires at least 5 quarters of data ($Q_0$ vs $Q_4$). Never hardcode fallback fake figures for active financial metrics.
   - Financial statement rows must be safely extracted with null checks (`cls.value(df, ...)`).
2. **Database Integrity**:
   - `Company` (`companies`) is the central entity; all historical statements link via `company_id`.
   - Use `(company_id, period_end)` unique composite constraints on `quarterly_results` to prevent duplicate quarterly rows.
   - Migrations and schema adjustments should be handled through scripts in `backend/scripts/`.
3. **Frontend Bloomberg Aesthetic**:
   - Maintain dark institutional aesthetic (`#050B14`, cyan/emerald/amber accents).
   - Use server-side sorting and pagination (`sort_by`, `sort_order`, `page`, `limit`) on `/growth-screener` rather than in-memory client sorting.
   - Mission Control pages poll `/mission-control/heartbeat` and `/mission-control/queue` every 5 seconds.

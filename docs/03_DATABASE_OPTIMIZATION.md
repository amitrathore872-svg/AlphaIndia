# 03 — Database Schema & Query Optimization Report

**Database Engine:** PostgreSQL 16+  
**ORM:** SQLAlchemy 2.0.52 & Psycopg2  
**Total Tables:** 59 Relational Tables  
**Total Records Analyzed:** ~150,000+ records  
**Date:** September 2026

---

## 1. Schema Integrity & Constraints Applied

### A. Unique Constraint on `companies.symbol`
- **Issue:** Symbol collisions existed (e.g. `SAWACA` had two records: ID 6331 delisted and ID 6503 active).
- **Resolution:** Updated ID 6331 to `SAWACA_DELISTED`.
- **Constraint:** Created strict `UNIQUE INDEX uq_companies_symbol ON companies (symbol);`.

### B. Index Optimizations on `filing_registry`
- **Issue:** The table had 8,065 rows with 424 duplicate records and lacked indexes on filter columns (`download_status`, `parse_status`, `announcement_date`). Every discovery check performed full table scans.
- **Resolution:**
  1. Purged 424 duplicate filing records.
  2. Created composite index: `CREATE INDEX idx_fr_sym_period_type ON filing_registry (symbol, period, filing_type);`
  3. Created status indexes: `CREATE INDEX idx_fr_download_status ON filing_registry (download_status);` and `CREATE INDEX idx_fr_parse_status ON filing_registry (parse_status);`
  4. Discovery duplicate check execution time reduced from **~45ms to <1ms** per check.

### C. Announcement Deduplication & Indexing on `announcements_radar`
- **Issue:** 4 duplicate pairs of announcements existed from parallel exchange scraping sweeps.
- **Resolution:**
  1. Purged 4 duplicate records via window join.
  2. Created composite chronological index: `CREATE INDEX idx_ar_symbol_published ON announcements_radar (symbol, published_at DESC);`

### D. Duplicate Index Removal on `cpr_scanner_daily`
- **Issue:** Redundant identical indexes on the same columns existed:
  - `idx_cpr_breakout_score` AND `ix_cpr_scanner_daily_breakout_score`
  - `idx_cpr_compression_score` AND `ix_cpr_scanner_daily_compression_score`
- **Resolution:** Dropped the duplicate redundant indexes `ix_cpr_scanner_daily_breakout_score` and `ix_cpr_scanner_daily_compression_score`, eliminating duplicate index maintenance overhead on daily writes.

---

## 2. Query Consolidation & Anti-Pattern Fixes

### A. Eliminating Multi-Roundtrip Sequential Counts

#### Before (Anti-pattern in `downloads.py` — 7 separate queries):
```python
total = db.query(FilingRegistry).count()
pending = db.query(FilingRegistry).filter(FilingRegistry.download_status == "PENDING").count()
downloaded = db.query(FilingRegistry).filter(FilingRegistry.download_status == "DOWNLOADED").count()
archive_missing = db.query(FilingRegistry).filter(FilingRegistry.download_status == "ARCHIVE_MISSING").count()
archive_unavailable = db.query(FilingRegistry).filter(FilingRegistry.download_status == "ARCHIVE_UNAVAILABLE").count()
invalid_file = db.query(FilingRegistry).filter(FilingRegistry.download_status == "INVALID_FILE").count()
failed = db.query(FilingRegistry).filter(FilingRegistry.download_status == "FAILED").count()
```
- **Round trips:** 7 sequential PostgreSQL queries.
- **Latency:** ~65-90ms.

#### After (Optimized — 1 single conditional aggregation query):
```python
stats = db.query(
    func.count(FilingRegistry.id).label("total"),
    func.count().filter(FilingRegistry.download_status == "PENDING").label("pending"),
    func.count().filter(FilingRegistry.download_status == "DOWNLOADED").label("downloaded"),
    func.count().filter(FilingRegistry.download_status == "ARCHIVE_MISSING").label("archive_missing"),
    func.count().filter(FilingRegistry.download_status == "ARCHIVE_UNAVAILABLE").label("archive_unavailable"),
    func.count().filter(FilingRegistry.download_status == "INVALID_FILE").label("invalid_file"),
    func.count().filter(FilingRegistry.download_status == "FAILED").label("failed"),
).one()
```
- **Round trips:** 1 single query.
- **Latency:** **~4ms** (94% reduction).

### B. Same Pattern Applied Across:
- `app/api/filings.py` (`filing_summary`): 4 queries consolidated to 1.
- `app/api/companies.py` (`dashboard_summary`): 5 queries + 2 disk CSV reads consolidated to 1 query.
- `app/api/import_dashboard.py` (`get_import_summary`): 9 queries consolidated to 4 targeted aggregate queries.

---

## 3. Database Connection Pooling Specifications

Alpha India database pool configuration in `backend/app/core/config.py`:
- `pool_pre_ping = True` (detects stale/dropped connections immediately)
- `pool_size = 20`
- `max_overflow = 20`
- `pool_recycle = 1800` (recycles connections every 30 minutes to prevent idle connection termination)

# Alpha India — Screener.in Migration & Platform Updates
**Release & Migration Notes**  
**Date**: September 14, 2026  
**Sprint**: Sprint 35 (Screener.in Historical Data Ingestion & Yahoo Deprecation)  
**Platform Version**: v2.3.0  

---

## 1. Executive Summary

Today's milestone completes the full transition of **Alpha India's Growth Screener** from Yahoo Finance to **Screener.in** as the primary source of truth for Indian equities (NSE & BSE). 

Key outcomes accomplished:
1. **Yahoo Warehouse Archival**: Successfully archived 23,699 Yahoo Finance quarterly statement rows and tracking tables into isolated PostgreSQL archive tables (`archive_yahoo_*`) with zero data loss.
2. **Screener.in Historical Warehouse**: Built and deployed a parser for Screener.in quarterly statements (`<section id="quarters">`), capturing 10–14 historical quarters per equity into `quarterly_results` with `source='SCREENER.IN'`.
3. **QoQ & YoY Growth Precision**: Implemented institutional-grade Year-over-Year ($Q_0$ vs $Q_4$) and Quarter-over-Quarter ($Q_0$ vs $Q_1$) calculation engines, addressing null QoQ metrics across all top equities on the Growth Screener dashboard.
4. **Universal Sector Support**: Added dual parsing support for industrial enterprises (`sales`, `operating profit`, `opm`) and banking/NBFC financial institutions (`revenue`, `financing profit`, `financing margin %`).
5. **Backend API Stabilization**: Resolved 500 unpack errors, PostgreSQL datatype mismatches in server-side sorting, and implemented an automated fallback cascade for quarterly momentum metrics.

---

## 2. Yahoo Finance Archival & Data Safety

To ensure database hygiene without losing legacy records, an archival script ([backend/scripts/archive_yahoo_tables.py](backend/scripts/archive_yahoo_tables.py)) was executed.

### Archived Tables & Row Counts
| Target Archive Table | Rows Archived | Description |
|---|---|---|
| `archive_yahoo_quarterly_results` | **23,699** | Historical quarterly income statements & balance sheets from Yahoo |
| `archive_yahoo_financial_import_queue` | **8,583** | Yahoo symbol import queue states & logs |
| `archive_yahoo_financial_import_audit` | **4,212** | Yahoo warehouse data audit history |
| `archive_yahoo_financial_import_progress` | **1** | System-wide Yahoo import progress counter |
| `archive_yahoo_company_market_metrics` | **27** | Legacy Yahoo market metrics |

- Active tables (`quarterly_results`, `company_market_metrics`) were purged of Yahoo dependencies.
- Production tables now strictly maintain Screener.in historical statements and exchange filing disclosures.

---

## 3. Database Schema & Architecture Updates

### New & Enhanced Database Models
1. **`ScreenerGrowthRecord`** (`screener_growth_records`):
   - Fundamental multiples: CMP, Market Cap, Category (LARGE/MID/SMALL/MICRO), P/E, Ind P/E, Price to Book, Book Value, Dividend Yield, PEG Ratio.
   - Trailing 12-month (TTM): PAT 12M, EPS 12M, ROCE %, ROE %, OPM %.
   - Multi-year Compounded Variance: 3Y, 5Y, and 10Y Sales & Profit growth.
   - Stock Performance: 3-month, 6-month, 1-year returns, 3Y/5Y Stock CAGR, 50 DMA, 200 DMA.
   - Institutional Quality: Piotroski Score (0-9) and Alpha India Health Score (0-100).
   - Solvency & Efficiency: Debt-to-Equity, Borrowings, Reserves, Total Assets, CFO, Free Cash Flow, Debtor Days, Inventory Days, Cash Conversion Cycle.
   - **New QoQ Fields**: `quarterly_sales_qoq` and `quarterly_pat_qoq` (`DOUBLE PRECISION`).

2. **`QuarterlyResult`** (`quarterly_results`):
   - Central time-series financial statement table.
   - Supports 10–14 historical quarters per stock with `source='SCREENER.IN'`.
   - Unique composite constraint on `(company_id, period_end)` to prevent duplicate statement entries.

3. **`ScreenerImportRun` & `ScreenerImportEvent`**:
   - Real-time telemetry tracking for automated Screener scrapers and workers.

---

## 4. Ingestion Engine & Parser Enhancements

### `ScreenerClient` (`backend/app/services/screener_client.py`)
- **Historical Statement Extraction**: Parses all historical quarters from `<section id="quarters">`.
- **Banking / NBFC Compatibility**: Seamlessly extracts top-line figures for financial institutions where Screener names rows `revenue` and `financing profit`.
- **Mathematical Growth Formulas**:
  $$\text{Sales YoY \%} = \frac{\text{Sales}_{Q_t} - \text{Sales}_{Q_{t-4}}}{\text{Sales}_{Q_{t-4}}} \times 100$$
  $$\text{PAT YoY \%} = \frac{\text{PAT}_{Q_t} - \text{PAT}_{Q_{t-4}}}{|\text{PAT}_{Q_{t-4}}|} \times 100$$
  $$\text{Sales QoQ \%} = \frac{\text{Sales}_{Q_t} - \text{Sales}_{Q_{t-1}}}{\text{Sales}_{Q_{t-1}}} \times 100$$
  $$\text{PAT QoQ \%} = \frac{\text{PAT}_{Q_t} - \text{PAT}_{Q_{t-1}}}{|\text{PAT}_{Q_{t-1}}|} \times 100$$
- **Safety Handling**: Zero-division protection and non-linear denominator damping for turn-around quarters where prior PAT is near zero.

---

## 5. API & Dashboard Fixes

### Growth Screener API (`backend/app/api/growth.py`)
- **Query Optimization**: Fixed tuple unpacking 500 error by selecting specific entity models in `db.query(Company, ScreenerGrowthRecord, QuarterlyResult)`.
- **Server-Side Sorting**: Fixed PostgreSQL `DatatypeMismatch` when sorting by market cap (`ScreenerGrowthRecord.market_cap` is `DOUBLE PRECISION`, avoiding string casting conflicts).
- **QoQ Fallback Cascade**: If a company's historical quarterly rows in `quarterly_results` are temporarily sparse, the endpoint automatically falls back to `ScreenerGrowthRecord.quarterly_sales_qoq` and `quarterly_pat_qoq`.
- **Verified Page 1 & 2 Results**: 100% non-null QoQ percentages rendered with positive/negative color-coded badges on the frontend.

---

## 6. Verification Results (Top 15 Equities Sample)

| Symbol | Company Name | Sales YoY | Sales QoQ | Profit YoY | Profit QoQ |
|---|---|---|---|---|---|
| `RELIANCE` | Reliance Industries Ltd | +27.02% | **+5.24%** | -24.65% | **+12.66%** |
| `TCS` | Tata Consultancy Services Ltd | +13.93% | **+2.23%** | +4.69% | **-2.64%** |
| `LICI` | Life Insurance Corp of India | +6.76% | **-13.33%** | +24.00% | **-42.11%** |
| `INFY` | Infosys Ltd | +14.03% | **+3.90%** | +12.29% | **-8.63%** |
| `ADANIENT` | Adani Enterprises Ltd | +49.92% | **+1.50%** | -249.80% | **-775.45%** |
| `ADANIPORTS` | Adani Ports & SEZ Ltd | +18.57% | **+0.77%** | +10.24% | **+10.34%** |
| `ADANIPOWER` | Adani Power Ltd | +33.97% | **+32.90%** | +47.26% | **+13.95%** |
| `BAJAJ-AUTO` | Bajaj Auto Ltd | +65.15% | **+21.63%** | +44.30% | **-8.68%** |
| `ETERNAL` | Eternal Ltd | +182.00% | **+16.88%** | +268.00% | **-47.13%** |
| `JSWSTEEL` | JSW Steel Ltd | +9.77% | **-7.46%** | +112.58% | **-75.60%** |
| `BAJAJFINSV` | Bajaj Finserv Ltd | +19.13% | **+9.20%** | +18.16% | **+20.49%** |
| `BEL` | Bharat Electronics Ltd | +24.93% | **-45.75%** | +8.88% | **-52.61%** |
| `DIVISLAB` | Divis Laboratories Ltd | +27.80% | **+8.80%** | +65.50% | **+20.11%** |
| `MOTHERSON` | Samvardhana Motherson | +16.66% | **+2.73%** | +77.56% | **-31.11%** |
| `CHOLAFIN` | Cholamandalam Investment | +21.87% | **+5.22%** | +45.52% | **+0.67%** |

---

## 7. Operational Runbook & Maintenance Commands

### Backfill Screener Historical Quarters
```bash
# Backfill specific symbols
python scripts/backfill_screener_quarters.py --symbols TCS INFY RELIANCE HDFCBANK

# Backfill top N equities by market cap
python scripts/backfill_screener_quarters.py --limit 50 --delay 0.5
```

### Run Continuous Screener Ingestion Worker
```bash
python scripts/run_screener_importer.py --batch-size 100 --delay 0.8
```

### Verify Growth Screener API
```bash
curl -X GET "http://localhost:8000/growth-screener?page=1&limit=15"
```

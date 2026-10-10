# Alpha India — Backtest Engine Architecture Audit
**Document ID**: `docs/BACKTEST_ENGINE_AUDIT.md`  
**Platform**: Alpha India (Version 2.3.0 / Sprint 43.1)  
**Author**: Antigravity Quantitative Systems Architecture  
**Status**: COMPLETE / VERIFIED  

---

## 1. Executive Summary & Objective

This audit establishes the baseline architectural landscape for Alpha India prior to implementing the production-quality, reusable **Backtest Engine** and its first strategy, the **Volatility Compression Breakout (VCB) 5-Minute Strategy**.

The implementation adheres to the core engineering principle: **REUSE existing infrastructure wherever possible without creating parallel pipelines, breaking live trading integrations, or destabilizing existing engines.**

---

## 2. Existing Architecture Audit

### 2.1 Backend Architecture
- **Framework**: FastAPI (Python 3.11+) with async routing, CORS enabled for local development (`localhost:3000`).
- **Database Layer**: SQLAlchemy 2.0 ORM with PostgreSQL (`postgresql://postgres:AlphaIndia%40123@localhost:5432/alpha_india`), connection pooling (`pool_pre_ping=True`, pool size 20).
- **Existing Schemas & Tables**: 91 tables in PostgreSQL.
  - Core Master: `companies` (8,701 equities with ISIN, exchange, sector, market cap, and YoY metrics).
  - Financial Warehouse: `quarterly_results` (balance sheets, income statements, PAT, EPS).
  - Corporate Catalysts: `filing_registry`, `announcements`, `announcements_radar`.
  - Intraday & Execution: `sovereign_intraday_signals`, `sovereign_intraday_logs` (tracking trades and P&L on ₹1,00,000 base capital).
  - Velocity Suite: 18 tables under `velocity_*` managing multi-stage pre-breakout scans, base patterns, smart money, and daily backtests.
- **Background Workers**: Async FastAPI background tasks, standalone scripts in `backend/scripts/`, automated scheduler service `autonomous_scheduler.py`.

### 2.2 Frontend Architecture
- **Framework**: Next.js 16.3.4 (React 19, TypeScript 5, Tailwind CSS v4, Lucide React).
- **Design Aesthetic**: Institutional Dark Bloomberg Terminal (`#050B14` canvas, `#0B1528` cards, cyan `#00F0FF`, emerald `#00E676`, amber `#FFB300`, and violet `#A855F7` accents).
- **Navigation Structure**: Centralized navigation registry in `frontend/src/config/navigationConfig.ts` with 46 routes across Radars & Engines, Fast Opportunity Screener, Institutional Research, Portfolio, Monitoring, and Administration.
- **Monitoring & Command Deck**: `frontend/src/app/monitoring/control/page.tsx` and `EngineGrid.tsx` hosting engine command cards (e.g. `VelocityBurstCommandCard.tsx`).
- **Alert Center**: `frontend/src/app/alerts/page.tsx` connected to `backend/app/api/alerts.py` supporting in-app alerts and Telegram dispatches.

---

## 3. Existing 5paisa Integration & Market Data Status

### 3.1 5paisa Client Audit (`backend/app/clients/fivepaisa_client.py`)
- **Credentials**: Configured in `.env` (`FIVEPAISA_APP_NAME`, `FIVEPAISA_USER_ID`, `FIVEPAISA_PASSWORD`, `FIVEPAISA_USER_KEY`, `FIVEPAISA_ENCRYPTION_KEY`, `FIVEPAISA_PIN`, `FIVEPAISA_CLIENT_CODE`, `FIVEPAISA_TOTP_KEY`).
- **Authentication**: Fully automated morning login via `pyotp.TOTP(totp_key)`. Validated live in the environment: returns valid JWT access token with 12-hour expiration.
- **Scrip Master**: Fetches `https://Openapi.5paisa.com/VendorsAPI/Service1.svc/ScripMaster/segment/nse_eq` mapping stock symbols (e.g., `RELIANCE`, `TCS`) to `ScripCode` (e.g., `2885`). Cached in memory for 24 hours.
- **Live Feed**: `client.fetch_market_feed(batch)` batch queries for live CMP, close, high, low, volume.
- **Historical API Discovery**: The underlying `py5paisa.FivePaisaClient` library includes `historical_data(Exch, ExchangeSegment, ScripCode, time, From, To)`.
  - Timeframes supported: `['1m', '3m', '5m', '10m', '15m', '30m', '60m', '1d']`.
  - Returned structure: Pandas DataFrame with `['Datetime', 'Open', 'High', 'Low', 'Close', 'Volume']`.
  - **Live Test Result**: Validated via live execution; fetched real 5-minute candles for `RELIANCE` (ScripCode 2885).

### 3.2 Audit Findings on 5paisa Token Caching
- **Finding**: Calling `ensure_authenticated()` across rapid script runs within a 30-second window causes 5paisa to reject duplicate TOTP codes (`'OTP has been used in past, Please try next OTP'`).
- **Required Fix**: Enhance `FivePaisaClient` with persistent file-based JWT caching (`data/fivepaisa_token_cache.json`) so subsequent processes reuse the unexpired 12-hour JWT token without generating duplicate TOTPs.
- **API Header Sync**: Ensure `self.client.access_token = access_token` and `self.client.jwt_headers["Authorization"] = f'Bearer {access_token}'` are explicitly set during token restoration.

---

## 4. Existing Data Coverage & Storage

### 4.1 Database Storage
- **PostgreSQL**: **Zero** candle tables currently exist in PostgreSQL. There are no tables for `1m` or `5m` time-series candles.

### 4.2 Local Filesystem Storage
- **Parquet Cache**: `backend/data/intraday_5m_cache/` contains **28 liquid equities**:
  - `BAJAJ-AUTO`, `BAJFINANCE`, `BEL`, `BHARATFORG`, `COFORGE`, `DIVISLAB`, `HAL`, `HDFCBANK`, `HINDALCO`, `ICICIBANK`, `ITC`, `JINDALSTEL`, `JSWSTEEL`, `KAYNES`, `LT`, `M&M`, `MARUTI`, `PERSISTENT`, `POLYCAB`, `RELIANCE`, `SBIN`, `SIEMENS`, `TATAPOWER`, `TATASTEEL`, `TCS`, `TITAN`, `TRENT`, `VEDL`.
  - **Coverage**: 4,342 bars each of 5-minute data spanning `2026-07-06 09:15:00+05:30` to `2026-09-25 15:10:00+05:30` (~3 full months of high-resolution 5-minute intraday market hours).
- **Index Universe**: `backend/data/ind_nifty500list.csv` contains official NIFTY 500 equities with symbol, industry, ISIN, and series (`EQ`).

---

## 5. Reusable vs. Missing Components Matrix

| Component | Status | Action / Reuse Plan |
| :--- | :--- | :--- |
| **5paisa Authentication & TOTP** | Exists (`FivePaisaClient`) | **Reuse**. Add persistent token caching to avoid TOTP collision. |
| **5paisa Scrip Master** | Exists (`FivePaisaClient`) | **Reuse**. Use ScripCode mapping for historical calls. |
| **5paisa Historical Candlestick API** | Exists in library | **Integrate**. Create clean provider wrapper `MarketDataProvider` -> `FivePaisaHistoricalProvider`. |
| **Intraday 5m Parquet Dataset** | Exists (28 equities, 3 months) | **Reuse** for immediate validation and baseline benchmarking. |
| **NIFTY 500 Constituent Universe** | Exists (`ind_nifty500list.csv`) | **Reuse**. Filter series `EQ` and eliminate ETFs (e.g. UNIGOLD, GOLDBEES). |
| **Database Candle Tables** | Missing in Postgres | **Create**: `market_candles_1m`, `market_candles_5m`. |
| **Database Backtest Tables** | Missing | **Create**: `backtest_runs`, `backtest_signals`, `backtest_trades`, `backtest_metrics`, `backtest_equity_curve`. |
| **Timeframe Aggregator (1m -> 5m/15m/30m/60m)** | Missing | **Create**: Resilient OHLCV resampler with calendar boundary validation. |
| **Data Quality & Validation Engine** | Missing | **Create**: Validation engine checking high/low bounds, session bounds (09:15–15:30), timestamp order, and zero/negative volume. |
| **Generic Strategy Engine Interface** | Missing | **Create**: `BaseStrategy` abstraction for plug-and-play strategies. |
| **VCB Breakout Strategy (Rules 1–9)** | Missing as standalone engine | **Implement**: Strict 9-rule mathematical implementation with rule diagnostic tracking. |
| **VCB Early Strategy (Rules 1–8)** | Missing | **Implement**: Strict 8-rule pre-breakout compression scanner. |
| **Trade Simulation Engine** | Missing | **Implement**: Realistic next-candle execution, MFE/MAE tracking, multi-target, multi-stop, ambiguous candle conservative resolution. |
| **Transaction Cost Model** | Missing | **Implement**: Configurable Indian equity cost model (brokerage, STT, turnover, GST, SEBI, stamp duty, slippage). |
| **Position Sizing Models** | Missing | **Implement**: Fixed quantity, fixed capital, risk-based with capital cap. |
| **Market Regime & Time-of-Day Engines** | Missing | **Implement**: NIFTY EMA trend classifier + 7 intraday time buckets. |
| **Backtest REST API** | Missing | **Implement**: `/api/v1/backtest/*` following Alpha India FastAPI conventions. |
| **Backtest Lab Frontend UI** | Missing | **Implement**: `/backtest-lab` with institutional Bloomberg aesthetic and interactive panels. |
| **Command Deck Integration** | Missing | **Implement**: `BacktestCommandCard` inside `EngineGrid.tsx` and Mission Control. |
| **Alert Center Correlation** | Partial | **Implement**: Link live signals with historical backtest conviction metrics. |

---

## 6. Risks, Potential Duplications & Mitigations

1. **Duplicate 5paisa Integration Risk**:
   - *Risk*: Creating a second client class for 5paisa historical data.
   - *Mitigation*: Extend the existing `FivePaisaClient` singleton in `backend/app/clients/fivepaisa_client.py` with `get_historical_candles()` and persistent token caching.
2. **Database Ingestion Bloat**:
   - *Risk*: Storing millions of redundant candles with unindexed queries causing slow queries.
   - *Mitigation*: Proper composite indexes `(symbol, timestamp)`, `(symbol, timeframe, timestamp)`, and bulk insert utilities (`copy` / `bulk_insert_mappings`).
3. **Look-Ahead Bias Risk**:
   - *Risk*: Signal calculation using the breakout candle's future trajectory or entry executing at a price better than close.
   - *Mitigation*: Explicit bar indexing rules: Indicators calculated strictly on $T \le t$. Entry occurs strictly at $t$ close or $t+1$ open. Automated look-ahead unit tests.
4. **Survivorship Bias Risk**:
   - *Risk*: Testing today's NIFTY 500 constituents against historical periods without acknowledging membership changes.
   - *Mitigation*: Clear warnings in Backtest Configuration metadata and UI: `"Current constituent universe may introduce survivorship bias."`
5. **ETF Pollution Risk**:
   - *Risk*: Chartink scans returning ETF instruments like UNIGOLD.
   - *Mitigation*: Strict equity universe filtering checking series (`EQ`), name regex rejecting `(ETF|BEES|GOLD|SILVER|NIFTYBEES|LIQUID|INVIT|REIT)`.

---

## 7. Migration & Implementation Roadmap

- **Phase 1 & 2**: Enhanced 5paisa historical client, candle storage & resampling, data quality validator.
- **Phase 3**: SQLAlchemy models (`market_candles_*`, `backtest_*`) and table creation.
- **Phase 4, 5, 6**: Generic `BaseStrategy`, `VCBBreakoutStrategy` (9 rules), `VCBEarlyStrategy` (8 rules).
- **Phase 7, 8, 9, 10**: Signal generator with rule diagnostics, trade simulator (MFE/MAE/Targets/Stops), cost model, position sizing.
- **Phase 11, 12, 13, 14, 15, 16**: Backtest runner, performance metrics, market regime, time-of-day analyzer, universe filters.
- **Phase 17**: FastAPI router `/api/v1/backtest`.
- **Phase 18, 22, 23**: Frontend Backtest Lab (`/backtest-lab`), Command Deck card, Alert Center integration.
- **Phase 26, 27**: Comprehensive test suite (unit tests, look-ahead tests).
- **Phase 30, 31, 32**: Documentation and validation runs (10-stock test, followed by 3-month NIFTY 500 benchmark).

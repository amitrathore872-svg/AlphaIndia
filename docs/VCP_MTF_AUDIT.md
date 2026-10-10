# Alpha India — Multi-Timeframe VCP + 5-Minute VCB Architecture Audit

**Author**: Senior Quant Developer & Trading-System Architect  
**Platform**: Alpha India Quant Intelligence  
**Document**: `docs/VCP_MTF_AUDIT.md`  
**Date**: October 2026 (Local Context: 2026-10-07)  
**Objective**: Architecture audit and blueprint for integrating a multi-timeframe (Weekly VCP + Daily + 15m + RS + Sector + Market Regime) research strategy into the existing Alpha India Backtest Engine without rebuilding existing engines or duplicating broker pipelines.

---

## 1. Executive Summary

The Alpha India Backtest Engine (Sprint 33.4 / 43) is fully operational with:
- Canonical 5Paisa historical data fetching (`FivePaisaClient`) with persistent token caching.
- Forensic Data Quality Engine (`DataQualityEngine`) with session window bounds (09:15–15:30 IST) and OHLC sanity checks.
- Strategy abstraction layer (`BaseStrategy`, `StrategySignal`).
- Trade Simulation Engine (`TradeSimulator`) with zero look-ahead bias, conservative ambiguous exit policy (stop-first), MFE/MAE excursions, and full Indian statutory friction costs.
- PostgreSQL persistence (`backtest_runs`, `backtest_signals`, `backtest_trades`, `backtest_metrics`, `backtest_equity_curve`).
- Interactive Bloomberg-styled frontend (`/backtest-lab`) and Command Deck monitoring integration (`BacktestCommandCard`).

This audit establishes how to extend the backtest engine to systematically test the core research question:
> **Does higher-timeframe VCP structure, daily confirmation, 15m alignment, Relative Strength, Sector Strength, or Market Regime improve the expectancy of the baseline 5-minute VCB Breakout strategy?**

We formulate an empirical, data-driven framework where each filter layer is independently toggled and parameterized across a rigorous matrix of 9 controlled experiments.

---

## 2. Inventory of Existing Reusable Components

| Module / Component | Existing File | Reusability in MTF VCP + 5M VCB |
|---|---|---|
| **Backtest Engine Core** | `backend/app/services/backtest/backtest_engine.py` | **100% REUSE**. Orchestrates runs, DB transactions, background execution. |
| **Strategy Interface** | `backend/app/services/backtest/strategy_interface.py` | **100% REUSE**. `BaseStrategy` abstract base class. |
| **Baseline VCB Breakout** | `backend/app/services/backtest/vcb_strategy.py` | **100% REUSE**. Exact 9-rule baseline engine remains untouched. |
| **Trade Simulator & MFE/MAE** | `backend/app/services/backtest/trade_simulator.py` | **100% REUSE**. Forward stepping, excursions, target/stop matrix. |
| **Indian Cost Model** | `backend/app/services/backtest/cost_model.py` | **100% REUSE**. Brokerage, STT, turnover, GST, SEBI, stamp duty, slippage. |
| **Data Quality Engine** | `backend/app/services/backtest/data_quality_engine.py` | **100% REUSE**. Session bounds, duplicate rejection, OHLC validation. |
| **Candle Aggregator** | `backend/app/services/backtest/candle_aggregator.py` | **EXTEND**. Currently handles 1m $\to$ 5m, 15m, 30m, 60m. Extend to construct completed Daily and Weekly bars with strict close alignment. |
| **Market Data Provider** | `backend/app/services/backtest/market_data_provider.py` | **EXTEND**. Add multi-timeframe fetching (5m intraday + Daily bars for Weekly aggregation) cached in local Parquet lake. |
| **5Paisa Historical Client** | `backend/app/clients/fivepaisa_client.py` | **100% REUSE**. Supports `'1m'`, `'5m'`, `'15m'`, and `'1d'` intervals with 12h JWT token cache. |
| **Company & Sector Master** | `backend/app/models/company.py` | **100% REUSE**. Contains `symbol`, `sector`, `industry` classification. |
| **VCP Domain Logic** | `backend/app/services/vcp_engine_service.py` | **ADAPT / MODULARIZE**. Existing engine contains swing peak/trough wave detection, volume dry-up, and ATR contraction. Modularize into a pure, stateless `VCPDetector` suitable for weekly historical backtesting. |
| **Relative Strength Suite** | `backend/app/services/velocity/relative_strength_engine.py` | **REUSE LOGIC**. Mansfield RS vs NIFTY benchmark across 20/60 periods. |
| **Market Regime Classifier** | `backend/app/services/backtest/market_regime.py` | **100% REUSE**. NIFTY 20/50 EMA trend and slope classification. |
| **Backtest Lab UI** | `frontend/src/app/backtest-lab/page.tsx` | **EXTEND**. Add MTF VCP strategy configuration, layer toggles, VCP candidate inspector, and experiment comparison table. |
| **Command Deck Card** | `frontend/src/components/layout/monitoring/BacktestCommandCard.tsx` | **100% REUSE**. Telemetry polling `/api/v1/backtest/status`. |

---

## 3. Analysis of Existing Data Coverage

1. **Intraday Data (5-Minute)**:
   - 5Paisa historical endpoint returns 5-minute OHLCV candles reliably.
   - Tested 10 Alpha India equities (43,506 candles) and NIFTY 50 liquid stocks (152,034 candles) over 3-month window.
2. **Daily Data (1D)**:
   - 5Paisa historical endpoint returns 430+ daily bars per symbol (spanning 2025 to 2026), providing ~86 weekly candles.
   - This exceeds the 20 to 50 weekly candles required for Mark Minervini base and contraction detection.
3. **NIFTY Benchmark**:
   - `NIFTYBEES` daily and 5-minute candles provide seamless 1:1 benchmark price action for relative strength, EMA trend filters, and market regimes.
4. **Sectoral Classification**:
   - Stored in `companies.sector`. 40+ listed Indian equity sectors mapped.

---

## 4. Timeframe Hierarchy & Strict No-Lookahead Protection

A critical failure point in multi-timeframe quantitative research is future-data leakage (e.g. evaluating a Wednesday 11:20 5-minute bar using an unfinished Wednesday daily bar or unfinished current week candle).

### Explicit Bar Completion Rules:
```
At Bar t (e.g., Wednesday 11:20 IST):

[ WEEKLY FILTER ]
  Use ONLY the last completed weekly bar (prior Friday's 15:30 close).
  The current week's forming candle is STRICTLY EXCLUDED.

[ DAILY FILTER ]
  Use ONLY the last completed daily bar (Tuesday's 15:30 close).
  Wednesday's forming daily candle is STRICTLY EXCLUDED.

[ 15-MINUTE FILTER ]
  Use ONLY the last completed 15-minute bar (11:00 or 11:15 close, depending on minute).
  The forming 15-minute bar is STRICTLY EXCLUDED.

[ 5-MINUTE VCB TRIGGER ]
  The current 5-minute breakout candle evaluates only at its close (11:20:00).
  Indicators (VWAP, ATR, SMA) use data up to t.
  Next-bar forward simulation strictly begins at t+1 (11:25:00).
```

---

## 5. Proposed MTF Strategy Architecture (`MTFVCPVCBStrategy`)

We implement `MTFVCPVCBStrategy` inheriting from `BaseStrategy`:

```
Input: 5m Intraday Candles + Pre-computed Daily/Weekly Bars
                      │
                      ▼
       ┌──────────────────────────────┐
       │   Market Regime Filter (Opt) │  (Nifty > EMA20/50, Trend Bullish)
       └──────────────┬───────────────┘
                      ▼
       ┌──────────────────────────────┐
       │  Weekly VCP Detector (Opt)   │  (Prior Advance, Base, T1..T4 Waves,
       │                              │   Volume Contraction, Pivot Proximity)
       └──────────────┬───────────────┘
                      ▼
       ┌──────────────────────────────┐
       │   Daily Confirmation (Opt)   │  (Daily Close > EMA20, EMA20 > EMA50,
       │                              │   Slope Positive, Controlled Volatility)
       └──────────────┬───────────────┘
                      ▼
       ┌──────────────────────────────┐
       │ Relative Strength Gate (Opt) │  (Stock RS vs Nifty > threshold)
       └──────────────┬───────────────┘
                      ▼
       ┌──────────────────────────────┐
       │ Sector Strength Filter (Opt) │  (Sector Outperforming Benchmark)
       └──────────────┬───────────────┘
                      ▼
       ┌──────────────────────────────┐
       │    15M Confirmation (Opt)    │  (15m Close > VWAP, 15m Compression)
       └──────────────┬───────────────┘
                      ▼
       ┌──────────────────────────────┐
       │     5M VCB Breakout Trigger  │  (Exact 9-Rule Baseline Engine)
       └──────────────┬───────────────┘
                      ▼
              Emitted Signal
```

Every layer computes:
- An explicit Boolean pass flag: `pass_market_regime`, `pass_weekly_vcp`, `pass_daily_conf`, `pass_rs`, `pass_sector`, `pass_15m_conf`, `pass_5m_vcb`.
- An explicit sub-score: `vcp_score` (0-100), `daily_score` (0-100), `rs_score` (0-100), `sector_score` (0-100), `market_score` (0-100), `intraday_score` (0-100), `final_setup_score` (0-100).
- Detailed VCP wave geometry: `prior_advance_pct`, `base_depth_pct`, `contraction_count`, `t1_pct`, `t2_pct`, `t3_pct`, `t4_pct`, `volume_contraction_ratio`, `pivot_price`, `distance_to_pivot_pct`.

---

## 6. The 9-Stage Controlled Experiment Matrix

To objectively test whether higher-timeframe structures improve edge without relying on preconceptions:

| Exp # | Identifier | Filters Enabled | Research Hypothesis |
|---|---|---|---|
| **01** | `BASELINE_VCB` | 5M VCB Only (Baseline) | Benchmark baseline performance |
| **02** | `WEEKLY_VCP_5M` | Weekly VCP + 5M VCB | Does multi-week volatility coiling filter false intraday breaks? |
| **03** | `DAILY_5M` | Daily Confirmation + 5M VCB | Does daily trend alignment alone suffice? |
| **04** | `VCP_DAILY_5M` | Weekly VCP + Daily + 5M VCB | Does fusing multi-week base with daily momentum create edge? |
| **05** | `VCP_DAILY_15M_5M` | Weekly VCP + Daily + 15M + 5M VCB | Does 15m intraday confirmation reduce intraday whipsaws? |
| **06** | `VCP_RS_5M` | Weekly VCP + Relative Strength + 5M VCB | Does stock RS vs Nifty outperform broad market participation? |
| **07** | `VCP_DAILY_RS_5M` | Weekly VCP + Daily + RS + 5M VCB | Core institutional confluence: structure + trend + leadership |
| **08** | `VCP_DAILY_RS_SECTOR_5M` | Weekly VCP + Daily + RS + Sector + 5M VCB | Does top-down sector tailwind improve expectancy? |
| **09** | `FULL_MTF_CONFLUENCE` | Weekly VCP + Daily + 15M + RS + Sector + Market + 5M VCB | Complete multi-timeframe institutional radar |

---

## 7. Risks & Mitigations

1. **Over-filtering (Sample Size Collapse)**:
   - *Risk*: Combining 6 strict layers might reduce trade count from 225 trades to under 10 trades, rendering statistical significance invalid.
   - *Mitigation*: Track sample size sufficiency ($N < 50$ flagged as `VERY LOW SAMPLE`, $50-100$ `LOW`, $100-300$ `MODERATE`, $300+$ `BETTER`). Evaluate each layer incrementally.
2. **Look-Ahead Leakage in Daily/Weekly Bars**:
   - *Risk*: Indexing weekly/daily series by current date might bleed close information before 15:30 IST.
   - *Mitigation*: Strict time-shift `shift(1)` on higher-timeframe series before merging with intraday timestamp indices. Dedicated unit tests with simulated partial bars.
3. **Overfitting to Historical Period**:
   - *Risk*: Selecting parameter combinations that maximize P&L on a specific 3-month window.
   - *Mitigation*: Parameter stability testing across neighboring parameter regions (e.g. VCP Score 75/80/85, Volume 1.5x/2.0x/2.5x). Perform walk-forward splits (60% Train, 20% Validation, 20% Out-of-Sample).

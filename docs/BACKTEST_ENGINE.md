# Alpha India — Institutional Backtest Engine Specification & Architecture

**Platform**: Alpha India Quant Intelligence  
**Version**: 2.3.0 (Sprint 33.4)  
**Modules**: 5Paisa Canonical Lake, Parquet Storage, Data Quality Engine, Trade Simulator, Indian Cost Model, Backtest Lab  

---

## 1. Executive Summary & Objective

The Alpha India Backtest Engine provides an institutional-grade, zero-lookahead backtesting framework for Indian listed equities (NSE). Rather than building isolated or parallel broker pipelines, this system directly leverages Alpha India's existing **5Paisa API integration** (`FivePaisaClient`) and PostgreSQL database infrastructure (`SessionLocal`).

The engine resamples canonical 1-minute and 5-minute intraday bars, enforces strict Indian equity regular trading sessions (`09:15 → 15:30 IST`), eliminates non-equity contaminants (such as ETFs and indices), validates data cleanliness, models complete statutory friction (brokerage, STT, turnover charges, GST, SEBI turnover fees, stamp duty, slippage), and simulates trades without future-data leakage.

---

## 2. High-Level System Architecture

```
                   [ 5Paisa Historical API ]
                              │
                    (get_historical_candles)
                              │
                              ▼
                   [ Local Parquet Cache ]
               (backend/data/candles/{symbol}_{tf}.parquet)
                              │
                              ▼
            ┌───────────────────────────────────┐
            │       Data Quality Engine         │
            │  - OHLC Validity (H>=O,C; L<=O,C) │
            │  - Session Window (09:15 - 15:30) │
            │  - Duplicate & Gap Detection      │
            └─────────────────┬─────────────────┘
                              │
                              ▼
            ┌───────────────────────────────────┐
            │     Multi-Tier Aggregator         │
            │  - 1m Canonical -> 5m, 15m, 30m   │
            │  - Volume Sum, Period Open/Close  │
            └─────────────────┬─────────────────┘
                              │
                              ▼
            ┌───────────────────────────────────┐
            │      Strategy Interface           │
            │  - BaseStrategy (prepare, calc)   │
            │  - VCB Breakout (9 Strict Rules)  │
            │  - VCB Early (8 Compression Rules)│
            └─────────────────┬─────────────────┘
                              │
                              ▼
            ┌───────────────────────────────────┐
            │      Trade Simulator Engine       │
            │  - Next-bar Entry (Zero Lookahead)│
            │  - Forward Bar Stepper (T+1 .. N) │
            │  - MFE / MAE Path Tracker         │
            │  - Ambiguous Candle Stop-First    │
            │  - Target Matrix (+0.5% to +5.0%) │
            │  - Stop Matrix (-0.5% to -2.0%)   │
            └─────────────────┬─────────────────┘
                              │
                              ▼
            ┌───────────────────────────────────┐
            │   Indian Transaction Cost Model   │
            │  - Brokerage (₹20 flat / order)   │
            │  - STT (0.025% sell-side equity)  │
            │  - Exchange / GST / SEBI / Stamp  │
            │  - Slippage Modeling (0.05% def)  │
            └─────────────────┬─────────────────┘
                              │
                              ▼
            ┌───────────────────────────────────┐
            │  PostgreSQL Database Persistence  │
            │  - backtest_runs                  │
            │  - backtest_signals               │
            │  - backtest_trades                │
            │  - backtest_metrics               │
            │  - backtest_equity_curve          │
            └─────────────────┬─────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
     [ FastAPI REST APIs ]           [ Next.js Frontend ]
  `/api/v1/backtest/*`            `/backtest-lab` & Deck Card
```

---

## 3. Database Schema

All tables are defined in [`backend/app/models/backtest_models.py`](file:///c:/Users/amitr/AlphaIndia/backend/app/models/backtest_models.py) and registered in SQLAlchemy ORM.

### 3.1 Market Candle Stores
1. **`market_candles_1m`**:
   - `symbol` (VARCHAR(30)), `instrument_token` (VARCHAR(30)), `exchange` (VARCHAR(10))
   - `timestamp` (TIMESTAMP WITH TIME ZONE)
   - `open`, `high`, `low`, `close` (NUMERIC(12, 4)), `volume` (BIGINT)
   - Unique Index: `(symbol, timestamp)`
2. **`market_candles_5m`**:
   - Resampled 5-minute bars matching identical indexing.

### 3.2 Backtest Execution Stores
1. **`backtest_runs`**:
   - `run_id` (VARCHAR(64), Primary Key)
   - `name`, `strategy`, `universe`, `timeframe`, `start_date`, `end_date`, `initial_capital`
   - `config_json` (Full parameter snapshot for 100% reproducibility)
   - `status` (`QUEUED`, `RUNNING`, `COMPLETED`, `FAILED`, `CANCELLED`)
   - `signals_count`, `trades_count`, `candles_processed`, `execution_time_sec`
2. **`backtest_signals`**:
   - Links via `run_id`
   - Diagnostic rule flags: `rule_1_breakout`, `rule_2_volume`, `rule_3_green`, `rule_4_close_near_high`, `rule_5_vwap`, `rule_6_range_compression`, `rule_7_atr_compression`, `rule_8_volume_contraction`, `rule_9_no_extended_chase`
   - Metric states at trigger: `resistance_level`, `atr_value`, `vwap_value`, `compression_pct`, `extension_pct`
3. **`backtest_trades`**:
   - `entry_time`, `exit_time`, `entry_price`, `exit_price`, `quantity`
   - `gross_pnl`, `net_pnl`, `return_pct`, `brokerage`, `taxes`, `slippage`
   - `mfe_pct` (Maximum Favorable Excursion), `mae_pct` (Maximum Adverse Excursion)
   - `holding_bars`, `exit_reason` (`TARGET`, `STOP_LOSS`, `TIME_LIMIT`, `EOD`), `ambiguous_exit` (BOOLEAN)
4. **`backtest_metrics`**:
   - Summary statistics: win rate, profit factor, expectancy, max drawdown, streaks, time-of-day JSON, rule attribution JSON
5. **`backtest_equity_curve`**:
   - Step-by-step portfolio equity and drawdown time-series.

---

## 4. Reusable Strategy Interface (`BaseStrategy`)

Defined in [`backend/app/services/backtest/strategy_interface.py`](file:///c:/Users/amitr/AlphaIndia/backend/app/services/backtest/strategy_interface.py):

```python
class BaseStrategy(ABC):
    @abstractmethod
    def prepare_data(self, df: pd.DataFrame) -> pd.DataFrame:
        """Pre-processes OHLCV, session alignment, and cleaning."""
        pass

    @abstractmethod
    def calculate_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """Vectorized indicator calculation (VWAP, ATR, SMAs, Resistance)."""
        pass

    @abstractmethod
    def generate_signals(self, df: pd.DataFrame) -> List[StrategySignal]:
        """Bar-by-bar signal emission with rule diagnostic audit."""
        pass
```

Implementations:
- `VCBBreakoutStrategy`: Full 9-rule strict breakout engine.
- `VCBEarlyStrategy`: 8-rule pre-breakout compression scanner.

---

## 5. Zero Look-Ahead Bias Guarantee

1. **Information Horizon**: Bar $t$ close is evaluated only against historical bars $[0 \dots t]$. Indicators never inspect $t+1$ or later.
2. **Trade Entry**: Position entry is placed at Bar $t$ close (or simulated open of Bar $t+1$).
3. **Excursion Path Evaluation**: Forward simulation begins strictly on Bar $t+1$. The signal candle's high/low is **never** used to claim a target was hit on the entry bar.
4. **Ambiguous Intra-bar Exit Policy**: If both Target (+1.5%) and Stop (-1.0%) price limits are encompassed within the high-low span of a single 5-minute candle and tick sequencing is unavailable, the conservative policy assumes **Stop Loss hit first** and flags `ambiguous_exit = True`.

---

## 6. Indian Regulatory Transaction Cost Model

Defined in [`backend/app/services/backtest/cost_model.py`](file:///c:/Users/amitr/AlphaIndia/backend/app/services/backtest/cost_model.py):

| Component | Intraday Rate | Standard Basis |
|---|---|---|
| **Brokerage** | ₹20 per executed order | Capped at 0.05% per order |
| **STT (Securities Transaction Tax)** | 0.025% on sell turnover | Intraday equity |
| **Exchange Turnover Fee** | 0.00297% (NSE) | Both buy and sell turnover |
| **GST** | 18% | Applied on (Brokerage + Exchange Fees) |
| **SEBI Turnover Charges** | ₹10 per crore (0.0001%) | Total turnover |
| **Stamp Duty** | 0.003% on buy turnover | Buy-side only |
| **Simulated Slippage** | 0.05% (configurable) | Deducted from gross fill prices |

---

## 7. REST API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/v1/backtest/run` | Launch synchronous/asynchronous backtest |
| `GET` | `/api/v1/backtest/runs` | List all historical backtest runs |
| `GET` | `/api/v1/backtest/runs/{run_id}` | Detailed status and configuration of run |
| `GET` | `/api/v1/backtest/runs/{run_id}/metrics` | Complete quantitative performance metrics |
| `GET` | `/api/v1/backtest/runs/{run_id}/trades` | Paginated executed trade log with MFE/MAE |
| `GET` | `/api/v1/backtest/runs/{run_id}/signals` | Emitted strategy signals with 9-rule flags |
| `GET` | `/api/v1/backtest/runs/{run_id}/equity` | Cumulative portfolio equity curve points |
| `GET` | `/api/v1/backtest/strategies` | List registered strategy models |
| `GET` | `/api/v1/backtest/universes` | Supported equity universes & ETF filter notes |
| `GET` | `/api/v1/backtest/status` | Real-time engine health & data coverage |
| `GET` | `/api/v1/backtest/data-quality/{symbol}` | Forensic data hygiene audit for symbol |

---

## 8. Frontend Backtest Lab & Command Deck

- **Route**: [`frontend/src/app/backtest-lab/page.tsx`](file:///c:/Users/amitr/AlphaIndia/frontend/src/app/backtest-lab/page.tsx)
- **Command Deck Card**: [`frontend/src/components/layout/monitoring/BacktestCommandCard.tsx`](file:///c:/Users/amitr/AlphaIndia/frontend/src/components/layout/monitoring/BacktestCommandCard.tsx)
- **Visual Design**: Bloomberg Terminal dark aesthetic (`#050B14`, cyan/emerald/amber/rose palettes, SVG cumulative equity chart, sticky header tables, and time-of-day breakdowns).

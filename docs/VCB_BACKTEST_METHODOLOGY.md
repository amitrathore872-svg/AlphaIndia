# Alpha India — VCB Strategy & Backtest Methodology Specification

**Strategy**: Volatility Compression Breakout (VCB)  
**Timeframe**: 5-Minute Intraday  
**Market**: NSE Equity Cash Market  
**Canonical Timezone**: `Asia/Kolkata` (IST)  
**Session Window**: `09:15 → 15:30 IST`  

---

## 1. Overview & Strategy Philosophy

Volatility Compression Breakout (VCB) identifies equities that undergo sharp contraction in both price range and volume over a sequence of 5-minute bars, followed by an aggressive expansion in price and volume that breaks through multi-bar resistance while holding above the intraday Volume Weighted Average Price (VWAP).

The Alpha India Backtest Engine implements two distinct variations of this model:
1. **VCB Breakout Strategy**: The primary trade generation model triggered when an expansion bar clears resistance.
2. **VCB Early Strategy**: A pre-breakout radar scanner detecting coiled compression coiling immediately below resistance.

---

## 2. VCB Breakout Strategy: The 9 Mandatory Rules

A valid breakout signal requires **all nine conditions** to evaluate to `True` simultaneously on the closing tick of the candidate 5-minute candle. Every rule is calculated independently and stored as an explicit Boolean diagnostic flag in `backtest_signals`.

### Rule 1: Resistance Breakout
The closing price of the current candle must exceed the highest high of the prior 12 completed 5-minute bars.
$$\text{Close}_t > \max(\text{High}_{t-12 \dots t-1})$$

### Rule 2: Volume Surge (Expansion)
The volume of the breakout candle must be at least twice the 20-period simple moving average of volume. Crucially, the breakout candle itself is **excluded** from the baseline calculation to prevent denominator inflation:
$$\text{Volume}_t > 2.0 \times \text{SMA}(\text{Volume}, 20)_{t-1}$$

### Rule 3: Bullish Green Body
The candle must close higher than its opening price:
$$\text{Close}_t > \text{Open}_t$$

### Rule 4: Close Near Bar High
The candle must demonstrate closing conviction by finishing within the upper 25% of its total range:
$$\text{High}_t - \text{Close}_t < 0.25 \times (\text{High}_t - \text{Low}_t)$$

### Rule 5: VWAP Filter
The current close must be above the session VWAP calculated cumulatively from 09:15 IST:
$$\text{Close}_t > \text{VWAP}_t$$
where:
$$\text{VWAP}_t = \frac{\sum_{i=1}^{t} \left(\frac{\text{High}_i + \text{Low}_i + \text{Close}_i}{3}\right) \times \text{Volume}_i}{\sum_{i=1}^{t} \text{Volume}_i}$$

### Rule 6: Prior Range Compression
The price range across the prior 12 completed candles must represent less than 2.0% of the prior candle's closing price:
$$\max(\text{High}_{t-12 \dots t-1}) - \min(\text{Low}_{t-12 \dots t-1}) < 0.02 \times \text{Close}_{t-1}$$

### Rule 7: Prior ATR Volatility Contraction
The 14-period Average True Range of the previous bar must be compressed below 70% of its 50-period SMA:
$$\text{ATR}(14)_{t-1} < 0.70 \times \text{SMA}(\text{ATR}(14), 50)_{t-1}$$

### Rule 8: Prior Volume Contraction
Prior short-term volume activity must reflect coiling behavior, defined as the 5-period SMA of volume being below 80% of the 20-period SMA:
$$\text{SMA}(\text{Volume}, 5)_{t-1} < 0.80 \times \text{SMA}(\text{Volume}, 20)_{t-1}$$

### Rule 9: Extension Guard (Do Not Chase)
The breakout candle must not be over-extended. The current close must not exceed 1.0% above the prior 12-bar resistance:
$$\text{Close}_t < \text{Resistance}_{t-1} \times 1.010$$

---

## 3. VCB Early Pre-Breakout Scanner Rules

The pre-breakout setup monitors equities primed for range expansion before the breakout occurs:

1. **Range Tightness**: Prior 12-bar range $< 2.0\%$ of current close.
2. **ATR Contraction**: $\text{ATR}(14) < 0.70 \times \text{SMA}(\text{ATR}(14), 50)$.
3. **Volume Dry-Up**: $\text{SMA}(\text{Volume}, 5) < 0.80 \times \text{SMA}(\text{Volume}, 20)$.
4. **Upper Range Positioning**: Current close is in the upper 40% of the 12-bar range:
   $$\text{Close}_t \ge \text{Low}_{12} + 0.60 \times (\text{High}_{12} - \text{Low}_{12})$$
5. **Near Resistance**: Current close is within 0.3% below the 12-bar resistance:
   $$\text{Close}_t \ge \text{Resistance}_{12} \times 0.997$$
6. **Sub-Resistance**: Current close remains strictly below resistance:
   $$\text{Close}_t \le \text{Resistance}_{12}$$
7. **VWAP Positive**: $\text{Close}_t > \text{VWAP}_t$.
8. **Liquidity Threshold**: 20-bar average traded value exceeds ₹500,000:
   $$\text{SMA}(\text{Close} \times \text{Volume}, 20) \ge 500,000$$

---

## 4. Execution & Trade Simulation Methodology

### 4.1 Entry Logic
- **Entry Price**: Close of the breakout candle $t$.
- **Simulated Order Execution**: Market order filled at $t$ close with configured slippage (default 0.05%).
- **Capital Allocation**: Risk-based position sizing targeting 1.0% maximum portfolio risk per trade, subject to a maximum single-stock capital allocation limit of 20%.

### 4.2 Target and Stop Grid
- **Targets Evaluated**: +0.5%, +1.0%, +1.5%, +2.0%, +3.0%, +5.0%
- **Stops Evaluated**: -0.5%, -1.0%, -1.5%, -2.0%
- **Baseline Default**: Target +1.5%, Stop Loss -1.0% ($1.5\text{R}$ risk/reward profile).

### 4.3 Ambiguous Candle Resolution
If a single 5-minute forward candle displays both:
$$\text{High}_{t+k} \ge \text{Target Price} \quad \text{and} \quad \text{Low}_{t+k} \le \text{Stop Loss Price}$$
and intrabar order book sequencing is unavailable, the engine applies the **conservative assumption**:
- **Stop Loss is assumed to have triggered first.**
- The trade is tagged with `ambiguous_exit = True` for audit and sensitivity analysis.

### 4.4 Excursion Metrics
For every completed trade, the engine computes:
- **MFE (Maximum Favorable Excursion)**:
  $$\text{MFE} = \max_{k \in [1 \dots \text{exit}]} \left(\frac{\text{High}_{t+k} - \text{Entry}}{\text{Entry}}\right) \times 100\%$$
- **MAE (Maximum Adverse Excursion)**:
  $$\text{MAE} = \max_{k \in [1 \dots \text{exit}]} \left(\frac{\text{Entry} - \text{Low}_{t+k}}{\text{Entry}}\right) \times 100\%$$

---

## 5. Non-Equity / ETF Filtering

To prevent contamination from instruments such as `UNIGOLD`, `NIFTYBEES`, `GOLDBEES`, etc., the `UniverseService` applies a regex filter purging all instruments matching:
`.*(BEES|GOLD|ETF|LIQUID|INDEX|INVIT|REIT|NIFTY).*` unless equities are explicitly targeted.

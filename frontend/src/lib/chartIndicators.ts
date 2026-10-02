// =======================================================
// Alpha India - Client-Side Chart Indicator Suite
// Vectorized, pure empirical calculations for TradingViewChart
// =======================================================

import type { CandleData, LineDataPoint } from "@/lib/technoFundaApi";

/**
 * Exponential Moving Average (EMA)
 */
export function computeEMA(candles: CandleData[], span: number): LineDataPoint[] {
  if (!candles || candles.length < span) return [];
  const k = 2 / (span + 1);
  const out: LineDataPoint[] = [];

  // Seed with Simple Moving Average of first 'span' candles
  let sum = 0;
  for (let i = 0; i < span; i++) {
    sum += candles[i].close;
  }
  let ema = sum / span;
  out.push({ time: candles[span - 1].time, value: Number(ema.toFixed(2)) });

  for (let i = span; i < candles.length; i++) {
    ema = candles[i].close * k + ema * (1 - k);
    out.push({ time: candles[i].time, value: Number(ema.toFixed(2)) });
  }

  return out;
}

/**
 * Simple Moving Average (SMA)
 */
export function computeSMA(candles: CandleData[], span: number): LineDataPoint[] {
  if (!candles || candles.length < span) return [];
  const out: LineDataPoint[] = [];
  let sum = 0;

  for (let i = 0; i < candles.length; i++) {
    sum += candles[i].close;
    if (i >= span) {
      sum -= candles[i - span].close;
    }
    if (i >= span - 1) {
      out.push({ time: candles[i].time, value: Number((sum / span).toFixed(2)) });
    }
  }

  return out;
}

/**
 * Bollinger Bands (20, 2)
 */
export interface BollingerBandsResult {
  upper: LineDataPoint[];
  middle: LineDataPoint[];
  lower: LineDataPoint[];
}

export function computeBollingerBands(
  candles: CandleData[],
  span = 20,
  multiplier = 2
): BollingerBandsResult {
  if (!candles || candles.length < span) {
    return { upper: [], middle: [], lower: [] };
  }

  const upper: LineDataPoint[] = [];
  const middle: LineDataPoint[] = [];
  const lower: LineDataPoint[] = [];

  for (let i = span - 1; i < candles.length; i++) {
    const windowSlice = candles.slice(i - span + 1, i + 1);
    const mean = windowSlice.reduce((acc, c) => acc + c.close, 0) / span;
    const variance =
      windowSlice.reduce((acc, c) => acc + Math.pow(c.close - mean, 2), 0) / span;
    const stdDev = Math.sqrt(variance);

    const t = candles[i].time;
    middle.push({ time: t, value: Number(mean.toFixed(2)) });
    upper.push({ time: t, value: Number((mean + multiplier * stdDev).toFixed(2)) });
    lower.push({ time: t, value: Number((mean - multiplier * stdDev).toFixed(2)) });
  }

  return { upper, middle, lower };
}

/**
 * Volume-Weighted Average Price (VWAP)
 */
export function computeVWAP(candles: CandleData[]): LineDataPoint[] {
  if (!candles || candles.length === 0) return [];
  const out: LineDataPoint[] = [];
  let cumVol = 0;
  let cumVolPrice = 0;

  for (const c of candles) {
    const typicalPrice = (c.high + c.low + c.close) / 3;
    const vol = c.volume > 0 ? c.volume : 1;
    cumVol += vol;
    cumVolPrice += typicalPrice * vol;
    out.push({
      time: c.time,
      value: Number((cumVolPrice / Math.max(1, cumVol)).toFixed(2)),
    });
  }

  return out;
}

/**
 * Volume 20 SMA
 */
export function computeVolumeSMA(candles: CandleData[], span = 20): LineDataPoint[] {
  if (!candles || candles.length < span) return [];
  const out: LineDataPoint[] = [];
  let sum = 0;

  for (let i = 0; i < candles.length; i++) {
    sum += candles[i].volume;
    if (i >= span) {
      sum -= candles[i - span].volume;
    }
    if (i >= span - 1) {
      out.push({ time: candles[i].time, value: Math.round(sum / span) });
    }
  }

  return out;
}

/**
 * Central Pivot Range (CPR) Levels
 * Based on the previous session/candle
 */
export interface CPRLevels {
  pivot: number;
  bc: number; // Bottom Central
  tc: number; // Top Central
  r1: number;
  s1: number;
  r2: number;
  s2: number;
}

export function computeCPR(candles: CandleData[]): CPRLevels | null {
  if (!candles || candles.length < 2) return null;
  // Use previous completed candle for CPR
  const prev = candles[candles.length - 2];
  const h = prev.high;
  const l = prev.low;
  const c = prev.close;

  const pivot = Number(((h + l + c) / 3).toFixed(2));
  const bc = Number(((h + l) / 2).toFixed(2));
  const tc = Number(((pivot - bc) + pivot).toFixed(2));
  const r1 = Number(((2 * pivot) - l).toFixed(2));
  const s1 = Number(((2 * pivot) - h).toFixed(2));
  const r2 = Number((pivot + (h - l)).toFixed(2));
  const s2 = Number((pivot - (h - l)).toFixed(2));

  return { pivot, bc, tc, r1, s1, r2, s2 };
}

/**
 * Relative Strength Index (RSI 14)
 */
export function computeRSI(candles: CandleData[], period = 14): LineDataPoint[] {
  if (!candles || candles.length <= period) return [];
  const out: LineDataPoint[] = [];

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  let rsi = 100 - (100 / (1 + rs));
  out.push({ time: candles[period].time, value: Number(rsi.toFixed(1)) });

  for (let i = period + 1; i < candles.length; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    const currentGain = diff >= 0 ? diff : 0;
    const currentLoss = diff < 0 ? Math.abs(diff) : 0;

    avgGain = (avgGain * (period - 1) + currentGain) / period;
    avgLoss = (avgLoss * (period - 1) + currentLoss) / period;

    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi = 100 - (100 / (1 + rs));
    out.push({ time: candles[i].time, value: Number(rsi.toFixed(1)) });
  }

  return out;
}

/**
 * Supertrend (ATR Period = 10, Multiplier = 3.0)
 * Classic volatility-based trailing stop & trend-following engine
 */
export interface SupertrendPoint {
  time: string;
  value: number;
  direction: 1 | -1; // 1 = Bullish (uptrend), -1 = Bearish (downtrend)
  lowerBand: number;
  upperBand: number;
}

export interface SupertrendResult {
  points: SupertrendPoint[];
  bullishSeries: LineDataPoint[];
  bearishSeries: LineDataPoint[];
  signals: Array<{
    time: string;
    position: "belowBar" | "aboveBar";
    color: string;
    shape: "arrowUp" | "arrowDown";
    text: string;
  }>;
}

export function computeSupertrend(
  candles: CandleData[],
  period = 10,
  multiplier = 3
): SupertrendResult {
  if (!candles || candles.length < period) {
    return { points: [], bullishSeries: [], bearishSeries: [], signals: [] };
  }

  // 1. True Range calculation
  const tr: number[] = [];
  tr.push(candles[0].high - candles[0].low);
  for (let i = 1; i < candles.length; i++) {
    const hl = candles[i].high - candles[i].low;
    const hc = Math.abs(candles[i].high - candles[i - 1].close);
    const lc = Math.abs(candles[i].low - candles[i - 1].close);
    tr.push(Math.max(hl, hc, lc));
  }

  // 2. Average True Range (Wilder smoothing)
  const atr: number[] = new Array(candles.length).fill(0);
  let trSum = 0;
  for (let i = 0; i < period; i++) {
    trSum += tr[i];
  }
  atr[period - 1] = trSum / period;
  for (let i = period; i < candles.length; i++) {
    atr[i] = (atr[i - 1] * (period - 1) + tr[i]) / period;
  }

  // 3. Bands & Direction State Machine
  const points: SupertrendPoint[] = [];
  const bullishSeries: LineDataPoint[] = [];
  const bearishSeries: LineDataPoint[] = [];
  const signals: Array<{
    time: string;
    position: "belowBar" | "aboveBar";
    color: string;
    shape: "arrowUp" | "arrowDown";
    text: string;
  }> = [];

  let prevFinalUpper = 0;
  let prevFinalLower = 0;
  let prevSupertrend = 0;
  let prevDirection: 1 | -1 = 1;

  for (let i = period - 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const close = candles[i].close;
    const currentAtr = atr[i];
    const mid = (high + low) / 2;

    const basicUpper = mid + multiplier * currentAtr;
    const basicLower = mid - multiplier * currentAtr;

    let finalUpper = basicUpper;
    let finalLower = basicLower;

    if (i > period - 1) {
      const prevClose = candles[i - 1].close;
      finalUpper = (basicUpper < prevFinalUpper || prevClose > prevFinalUpper) ? basicUpper : prevFinalUpper;
      finalLower = (basicLower > prevFinalLower || prevClose < prevFinalLower) ? basicLower : prevFinalLower;
    }

    let direction: 1 | -1 = 1;
    let supertrend = finalLower;

    if (i === period - 1) {
      direction = close >= basicUpper ? 1 : -1;
      supertrend = direction === 1 ? finalLower : finalUpper;
    } else {
      if (prevSupertrend === prevFinalUpper) {
        direction = close > finalUpper ? 1 : -1;
      } else {
        direction = close < finalLower ? -1 : 1;
      }
      supertrend = direction === 1 ? finalLower : finalUpper;
    }

    // Trend reversal signal
    if (i > period - 1 && direction !== prevDirection) {
      if (direction === 1) {
        signals.push({
          time: candles[i].time,
          position: "belowBar",
          color: "#10b981",
          shape: "arrowUp",
          text: "ST BUY",
        });
      } else {
        signals.push({
          time: candles[i].time,
          position: "aboveBar",
          color: "#ef4444",
          shape: "arrowDown",
          text: "ST SELL",
        });
      }
    }

    const pt: SupertrendPoint = {
      time: candles[i].time,
      value: Number(supertrend.toFixed(2)),
      direction,
      lowerBand: Number(finalLower.toFixed(2)),
      upperBand: Number(finalUpper.toFixed(2)),
    };
    points.push(pt);

    if (direction === 1) {
      bullishSeries.push({ time: pt.time, value: pt.value });
    } else {
      bearishSeries.push({ time: pt.time, value: pt.value });
    }

    prevFinalUpper = finalUpper;
    prevFinalLower = finalLower;
    prevSupertrend = supertrend;
    prevDirection = direction;
  }

  return { points, bullishSeries, bearishSeries, signals };
}

/**
 * Moving Average Convergence Divergence (MACD 12, 26, 9)
 */
export interface MACDResult {
  macdLine: LineDataPoint[];
  signalLine: LineDataPoint[];
  histogram: Array<{ time: string; value: number; color: string }>;
}

export function computeMACD(
  candles: CandleData[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
): MACDResult {
  const fastEma = computeEMA(candles, fastPeriod);
  const slowEma = computeEMA(candles, slowPeriod);
  if (slowEma.length === 0) return { macdLine: [], signalLine: [], histogram: [] };

  const fastMap = new Map(fastEma.map((d) => [d.time, d.value]));
  const macdLine: LineDataPoint[] = [];

  for (const s of slowEma) {
    const fVal = fastMap.get(s.time);
    if (fVal !== undefined) {
      macdLine.push({
        time: s.time,
        value: Number((fVal - s.value).toFixed(2)),
      });
    }
  }

  // Signal line is 9-period EMA of MACD line
  const dummyCandles: CandleData[] = macdLine.map((m) => ({
    time: m.time,
    open: m.value,
    high: m.value,
    low: m.value,
    close: m.value,
    volume: 0,
  }));
  const signalLine = computeEMA(dummyCandles, signalPeriod);
  const signalMap = new Map(signalLine.map((d) => [d.time, d.value]));

  const histogram: Array<{ time: string; value: number; color: string }> = [];
  for (const m of macdLine) {
    const sig = signalMap.get(m.time);
    if (sig !== undefined) {
      const histVal = Number((m.value - sig).toFixed(2));
      histogram.push({
        time: m.time,
        value: histVal,
        color: histVal >= 0 ? "rgba(16, 185, 129, 0.7)" : "rgba(239, 68, 68, 0.7)",
      });
    }
  }

  return { macdLine, signalLine, histogram };
}

/**
 * Average True Range (ATR) helper
 */
export function computeATR(candles: CandleData[], period = 14): number[] {
  if (!candles || candles.length < period) return [];
  const tr: number[] = [candles[0].high - candles[0].low];
  for (let i = 1; i < candles.length; i++) {
    const hl = candles[i].high - candles[i].low;
    const hc = Math.abs(candles[i].high - candles[i - 1].close);
    const lc = Math.abs(candles[i].low - candles[i - 1].close);
    tr.push(Math.max(hl, hc, lc));
  }

  const atr: number[] = new Array(candles.length).fill(0);
  let trSum = 0;
  for (let i = 0; i < period; i++) {
    trSum += tr[i];
  }
  atr[period - 1] = trSum / period;
  for (let i = period; i < candles.length; i++) {
    atr[i] = (atr[i - 1] * (period - 1) + tr[i]) / period;
  }
  return atr;
}

/**
 * 1. Keltner Channels (20 EMA, 2.0x ATR)
 */
export interface KeltnerChannelsResult {
  upper: LineDataPoint[];
  middle: LineDataPoint[];
  lower: LineDataPoint[];
}

export function computeKeltnerChannels(
  candles: CandleData[],
  length = 20,
  mult = 2,
  atrPeriod = 10
): KeltnerChannelsResult {
  if (!candles || candles.length < Math.max(length, atrPeriod)) {
    return { upper: [], middle: [], lower: [] };
  }

  const ema = computeEMA(candles, length);
  const atr = computeATR(candles, atrPeriod);
  const emaMap = new Map(ema.map((d) => [d.time, d.value]));

  const upper: LineDataPoint[] = [];
  const middle: LineDataPoint[] = [];
  const lower: LineDataPoint[] = [];

  for (let i = 0; i < candles.length; i++) {
    const t = candles[i].time;
    const emaVal = emaMap.get(t);
    const atrVal = atr[i];
    if (emaVal !== undefined && atrVal > 0) {
      middle.push({ time: t, value: emaVal });
      upper.push({ time: t, value: Number((emaVal + mult * atrVal).toFixed(2)) });
      lower.push({ time: t, value: Number((emaVal - mult * atrVal).toFixed(2)) });
    }
  }

  return { upper, middle, lower };
}

/**
 * 2. TTM Squeeze (John Carter Volatility Coil & Momentum)
 */
export interface TTMSqueezeResult {
  histogram: Array<{ time: string; value: number; color: string }>;
  squeezeDots: Array<{ time: string; value: number; color: string; inSqueeze: boolean }>;
}

export function computeTTMSqueeze(
  candles: CandleData[],
  length = 20,
  bbMult = 2.0,
  kcMult = 1.5
): TTMSqueezeResult {
  if (!candles || candles.length < length) {
    return { histogram: [], squeezeDots: [] };
  }

  const bb = computeBollingerBands(candles, length, bbMult);
  const kc = computeKeltnerChannels(candles, length, kcMult, length);
  const ema = computeEMA(candles, length);

  const bbUpperMap = new Map(bb.upper.map((d) => [d.time, d.value]));
  const bbLowerMap = new Map(bb.lower.map((d) => [d.time, d.value]));
  const kcUpperMap = new Map(kc.upper.map((d) => [d.time, d.value]));
  const kcLowerMap = new Map(kc.lower.map((d) => [d.time, d.value]));
  const emaMap = new Map(ema.map((d) => [d.time, d.value]));

  const histogram: Array<{ time: string; value: number; color: string }> = [];
  const squeezeDots: Array<{ time: string; value: number; color: string; inSqueeze: boolean }> = [];

  let prevVal = 0;
  for (let i = length - 1; i < candles.length; i++) {
    const t = candles[i].time;
    const bbU = bbUpperMap.get(t);
    const bbL = bbLowerMap.get(t);
    const kcU = kcUpperMap.get(t);
    const kcL = kcLowerMap.get(t);
    const emaVal = emaMap.get(t) || candles[i].close;

    if (bbU !== undefined && bbL !== undefined && kcU !== undefined && kcL !== undefined) {
      // Squeeze ON when Bollinger Bands are completely inside Keltner Channel
      const inSqueeze = bbU < kcU && bbL > kcL;
      squeezeDots.push({
        time: t,
        value: 0,
        color: inSqueeze ? "#ef4444" : "#10b981", // Red = Squeeze Coiling, Green = Squeeze Fired
        inSqueeze,
      });

      // Linear regression/momentum approximation of price delta
      const windowSlice = candles.slice(i - length + 1, i + 1);
      const highest = Math.max(...windowSlice.map((c) => c.high));
      const lowest = Math.min(...windowSlice.map((c) => c.low));
      const mid = (highest + lowest) / 2;
      const baseline = (mid + emaVal) / 2;
      const momVal = Number((candles[i].close - baseline).toFixed(2));

      // 4-Color John Carter Momentum:
      let color = "#06b6d4"; // Default cyan
      if (momVal >= 0) {
        color = momVal >= prevVal ? "#06b6d4" : "#0284c7"; // Cyan (up), Blue (down)
      } else {
        color = momVal <= prevVal ? "#ef4444" : "#f59e0b"; // Red (down), Yellow (up)
      }

      histogram.push({ time: t, value: momVal, color });
      prevVal = momVal;
    }
  }

  return { histogram, squeezeDots };
}

/**
 * 3. Mansfield Relative Strength (Stage 2 Outperformance vs Benchmark / 52W Baseline)
 */
export interface MansfieldRSResult {
  rsLine: LineDataPoint[];
  zeroLine: LineDataPoint[];
}

export function computeMansfieldRS(
  candles: CandleData[],
  length = 52
): MansfieldRSResult {
  if (!candles || candles.length < length) {
    return { rsLine: [], zeroLine: [] };
  }

  // Self 52-bar relative performance: RS = Close / SMA(Close, 52)
  const sma52 = computeSMA(candles, length);
  const smaMap = new Map(sma52.map((d) => [d.time, d.value]));

  const rawRS: { time: string; rs: number }[] = [];
  for (let i = length - 1; i < candles.length; i++) {
    const t = candles[i].time;
    const base = smaMap.get(t);
    if (base && base > 0) {
      const rs = (candles[i].close / base) * 10;
      rawRS.push({ time: t, rs });
    }
  }

  // Mansfield formula: ((RS / SMA(RS, length)) - 1) * 100
  const rsLine: LineDataPoint[] = [];
  const zeroLine: LineDataPoint[] = [];

  const rsMaWindow = Math.min(20, Math.floor(rawRS.length / 2)) || 10;
  for (let i = rsMaWindow - 1; i < rawRS.length; i++) {
    const slice = rawRS.slice(i - rsMaWindow + 1, i + 1);
    const avgRS = slice.reduce((acc, c) => acc + c.rs, 0) / rsMaWindow;
    const mRS = Number((((rawRS[i].rs / avgRS) - 1) * 100).toFixed(2));
    const t = rawRS[i].time;
    rsLine.push({ time: t, value: mRS });
    zeroLine.push({ time: t, value: 0 });
  }

  return { rsLine, zeroLine };
}

/**
 * 4. Chandelier Exit (Chuck LeBeau ATR-based Trailing Stop)
 */
export function computeChandelierExit(
  candles: CandleData[],
  period = 22,
  mult = 3.0
): LineDataPoint[] {
  if (!candles || candles.length < period) return [];

  const atr = computeATR(candles, period);
  const out: LineDataPoint[] = [];
  let prevStop = 0;

  for (let i = period - 1; i < candles.length; i++) {
    const windowSlice = candles.slice(i - period + 1, i + 1);
    const highestHigh = Math.max(...windowSlice.map((c) => c.high));
    const currentAtr = atr[i] || 0;
    let stop = highestHigh - mult * currentAtr;

    // Ratchet trailing stop upward if price remains above stop
    if (i > period - 1 && candles[i - 1].close > prevStop) {
      stop = Math.max(stop, prevStop);
    }

    prevStop = stop;
    out.push({ time: candles[i].time, value: Number(stop.toFixed(2)) });
  }

  return out;
}

/**
 * 5. On-Balance Volume (OBV) + 20-period Signal SMA
 */
export interface OBVResult {
  obvLine: LineDataPoint[];
  obvMa: LineDataPoint[];
}

export function computeOBV(candles: CandleData[], maPeriod = 20): OBVResult {
  if (!candles || candles.length === 0) return { obvLine: [], obvMa: [] };

  const rawObv: { time: string; value: number }[] = [];
  let currentObv = 0;
  rawObv.push({ time: candles[0].time, value: currentObv });

  for (let i = 1; i < candles.length; i++) {
    const vol = candles[i].volume || 0;
    if (candles[i].close > candles[i - 1].close) {
      currentObv += vol;
    } else if (candles[i].close < candles[i - 1].close) {
      currentObv -= vol;
    }
    rawObv.push({ time: candles[i].time, value: currentObv });
  }

  // Smooth into LineDataPoints
  const obvLine: LineDataPoint[] = rawObv.map((d) => ({
    time: d.time,
    value: Number(d.value.toFixed(0)),
  }));

  // 20 SMA of OBV
  const obvMa: LineDataPoint[] = [];
  let sum = 0;
  for (let i = 0; i < rawObv.length; i++) {
    sum += rawObv[i].value;
    if (i >= maPeriod) {
      sum -= rawObv[i - maPeriod].value;
    }
    if (i >= maPeriod - 1) {
      obvMa.push({ time: rawObv[i].time, value: Number((sum / maPeriod).toFixed(0)) });
    }
  }

  return { obvLine, obvMa };
}

/**
 * 6. Stochastic RSI (%K, %D with 80/20 Overbought/Oversold Bands)
 */
export interface StochasticRSIResult {
  kLine: LineDataPoint[];
  dLine: LineDataPoint[];
}

export function computeStochasticRSI(
  candles: CandleData[],
  rsiPeriod = 14,
  stochPeriod = 14,
  kPeriod = 3,
  dPeriod = 3
): StochasticRSIResult {
  const rsi = computeRSI(candles, rsiPeriod);
  if (rsi.length < stochPeriod) return { kLine: [], dLine: [] };

  const rawStochRsi: { time: string; value: number }[] = [];
  for (let i = stochPeriod - 1; i < rsi.length; i++) {
    const windowSlice = rsi.slice(i - stochPeriod + 1, i + 1).map((d) => d.value);
    const minRsi = Math.min(...windowSlice);
    const maxRsi = Math.max(...windowSlice);
    const range = maxRsi - minRsi || 1;
    const stochVal = ((rsi[i].value - minRsi) / range) * 100;
    rawStochRsi.push({ time: rsi[i].time, value: stochVal });
  }

  // %K = SMA(stochRsi, kPeriod)
  const kLine: LineDataPoint[] = [];
  let sumK = 0;
  for (let i = 0; i < rawStochRsi.length; i++) {
    sumK += rawStochRsi[i].value;
    if (i >= kPeriod) {
      sumK -= rawStochRsi[i - kPeriod].value;
    }
    if (i >= kPeriod - 1) {
      kLine.push({ time: rawStochRsi[i].time, value: Number((sumK / kPeriod).toFixed(2)) });
    }
  }

  // %D = SMA(%K, dPeriod)
  const dLine: LineDataPoint[] = [];
  let sumD = 0;
  for (let i = 0; i < kLine.length; i++) {
    sumD += kLine[i].value;
    if (i >= dPeriod) {
      sumD -= kLine[i - dPeriod].value;
    }
    if (i >= dPeriod - 1) {
      dLine.push({ time: kLine[i].time, value: Number((sumD / dPeriod).toFixed(2)) });
    }
  }

  return { kLine, dLine };
}

/**
 * 7. Auto Fibonacci Retracement Levels
 */
export interface FibLevel {
  ratio: number;
  price: number;
  label: string;
  color: string;
}

export interface AutoFibonacciResult {
  highPrice: number;
  lowPrice: number;
  levels: FibLevel[];
}

export function computeAutoFibonacci(
  candles: CandleData[],
  lookback = 100
): AutoFibonacciResult | null {
  if (!candles || candles.length < 20) return null;
  const slice = candles.slice(-lookback);

  let highPrice = -Infinity;
  let lowPrice = Infinity;

  for (const c of slice) {
    if (c.high > highPrice) highPrice = c.high;
    if (c.low < lowPrice) lowPrice = c.low;
  }

  const range = highPrice - lowPrice;
  if (range <= 0) return null;

  const ratios = [
    { ratio: 0.0, label: "Fib 0.0% (Swing High)", color: "#94a3b8" },
    { ratio: 0.236, label: "Fib 23.6%", color: "#38bdf8" },
    { ratio: 0.382, label: "Fib 38.2%", color: "#34d399" },
    { ratio: 0.5, label: "Fib 50.0% (Equilibrium)", color: "#fbbf24" },
    { ratio: 0.618, label: "Fib 61.8% (Golden Pocket)", color: "#f97316" },
    { ratio: 0.786, label: "Fib 78.6%", color: "#e879f9" },
    { ratio: 1.0, label: "Fib 100% (Swing Low)", color: "#ef4444" },
  ];

  const levels: FibLevel[] = ratios.map((r) => ({
    ratio: r.ratio,
    price: Number((highPrice - r.ratio * range).toFixed(2)),
    label: r.label,
    color: r.color,
  }));

  return { highPrice, lowPrice, levels };
}

/**
 * 8. Ichimoku Kinko Hyo (Cloud Envelope)
 */
export interface IchimokuCloudResult {
  tenkan: LineDataPoint[]; // Conversion Line (9)
  kijun: LineDataPoint[]; // Base Line (26)
  spanA: LineDataPoint[]; // Leading Span A
  spanB: LineDataPoint[]; // Leading Span B (52)
}

export function computeIchimokuCloud(
  candles: CandleData[],
  tenkanPeriod = 9,
  kijunPeriod = 26,
  spanBPeriod = 52
): IchimokuCloudResult {
  if (!candles || candles.length < spanBPeriod) {
    return { tenkan: [], kijun: [], spanA: [], spanB: [] };
  }

  const getMid = (slice: CandleData[]) => {
    let hi = -Infinity;
    let lo = Infinity;
    for (const c of slice) {
      if (c.high > hi) hi = c.high;
      if (c.low < lo) lo = c.low;
    }
    return (hi + lo) / 2;
  };

  const tenkan: LineDataPoint[] = [];
  const kijun: LineDataPoint[] = [];
  const spanA: LineDataPoint[] = [];
  const spanB: LineDataPoint[] = [];

  for (let i = 0; i < candles.length; i++) {
    const t = candles[i].time;

    let tenkanVal: number | null = null;
    let kijunVal: number | null = null;

    if (i >= tenkanPeriod - 1) {
      tenkanVal = getMid(candles.slice(i - tenkanPeriod + 1, i + 1));
      tenkan.push({ time: t, value: Number(tenkanVal.toFixed(2)) });
    }

    if (i >= kijunPeriod - 1) {
      kijunVal = getMid(candles.slice(i - kijunPeriod + 1, i + 1));
      kijun.push({ time: t, value: Number(kijunVal.toFixed(2)) });
    }

    if (tenkanVal !== null && kijunVal !== null) {
      spanA.push({ time: t, value: Number(((tenkanVal + kijunVal) / 2).toFixed(2)) });
    }

    if (i >= spanBPeriod - 1) {
      const spanBVal = getMid(candles.slice(i - spanBPeriod + 1, i + 1));
      spanB.push({ time: t, value: Number(spanBVal.toFixed(2)) });
    }
  }

  return { tenkan, kijun, spanA, spanB };
}

/**
 * 9. Volume Profile (Point of Control, Value Area High/Low)
 */
export interface VolumeProfileBin {
  price: number;
  priceTop: number;
  priceBottom: number;
  totalVolume: number;
  buyVolume: number;
  sellVolume: number;
  isPOC: boolean;
  inValueArea: boolean;
  volumePct: number; // 0 to 1 relative to max bin
}

export interface VolumeProfileResult {
  pocPrice: number;
  vahPrice: number;
  valPrice: number;
  totalVolume: number;
  bins: VolumeProfileBin[];
}

export function computeVolumeProfile(
  candles: CandleData[],
  numBins = 28,
  valueAreaPct = 0.70
): VolumeProfileResult | null {
  if (!candles || candles.length === 0) return null;

  let minPrice = Infinity;
  let maxPrice = -Infinity;
  let totalVolume = 0;

  for (const c of candles) {
    if (c.low < minPrice) minPrice = c.low;
    if (c.high > maxPrice) maxPrice = c.high;
    totalVolume += (c.volume || 0);
  }

  if (minPrice >= maxPrice || totalVolume <= 0) return null;

  const binSize = (maxPrice - minPrice) / numBins;
  const rawBins = Array.from({ length: numBins }, (_, idx) => {
    const bottom = minPrice + idx * binSize;
    const top = bottom + binSize;
    return {
      price: Number(((bottom + top) / 2).toFixed(2)),
      priceTop: Number(top.toFixed(2)),
      priceBottom: Number(bottom.toFixed(2)),
      totalVolume: 0,
      buyVolume: 0,
      sellVolume: 0,
    };
  });

  // Distribute candle volume across intersecting price bins
  for (const c of candles) {
    const vol = c.volume || 0;
    if (vol <= 0) continue;
    const isBull = c.close >= c.open;

    const lowIdx = Math.max(0, Math.min(numBins - 1, Math.floor((c.low - minPrice) / binSize)));
    const highIdx = Math.max(0, Math.min(numBins - 1, Math.floor((c.high - minPrice) / binSize)));
    const span = Math.max(1, highIdx - lowIdx + 1);
    const volPerBin = vol / span;

    for (let b = lowIdx; b <= highIdx; b++) {
      rawBins[b].totalVolume += volPerBin;
      if (isBull) {
        rawBins[b].buyVolume += volPerBin;
      } else {
        rawBins[b].sellVolume += volPerBin;
      }
    }
  }

  // Find POC (Point of Control = bin with max totalVolume)
  let maxBinVol = 0;
  let pocIdx = 0;
  for (let i = 0; i < numBins; i++) {
    if (rawBins[i].totalVolume > maxBinVol) {
      maxBinVol = rawBins[i].totalVolume;
      pocIdx = i;
    }
  }

  const pocPrice = rawBins[pocIdx].price;

  // Value Area calculation (70% of total volume expanding outward from POC)
  const targetVAVolume = totalVolume * valueAreaPct;
  let currentVAVolume = rawBins[pocIdx].totalVolume;
  const inVA = new Set<number>([pocIdx]);

  let upperIdx = pocIdx;
  let lowerIdx = pocIdx;

  while (currentVAVolume < targetVAVolume && (upperIdx < numBins - 1 || lowerIdx > 0)) {
    const nextUpVol = upperIdx < numBins - 1 ? rawBins[upperIdx + 1].totalVolume : 0;
    const nextDownVol = lowerIdx > 0 ? rawBins[lowerIdx - 1].totalVolume : 0;

    if (nextUpVol >= nextDownVol && upperIdx < numBins - 1) {
      upperIdx++;
      currentVAVolume += rawBins[upperIdx].totalVolume;
      inVA.add(upperIdx);
    } else if (lowerIdx > 0) {
      lowerIdx--;
      currentVAVolume += rawBins[lowerIdx].totalVolume;
      inVA.add(lowerIdx);
    } else if (upperIdx < numBins - 1) {
      upperIdx++;
      currentVAVolume += rawBins[upperIdx].totalVolume;
      inVA.add(upperIdx);
    } else {
      break;
    }
  }

  const vahPrice = rawBins[upperIdx].priceTop;
  const valPrice = rawBins[lowerIdx].priceBottom;

  const bins: VolumeProfileBin[] = rawBins.map((b, idx) => ({
    price: b.price,
    priceTop: b.priceTop,
    priceBottom: b.priceBottom,
    totalVolume: Math.round(b.totalVolume),
    buyVolume: Math.round(b.buyVolume),
    sellVolume: Math.round(b.sellVolume),
    isPOC: idx === pocIdx,
    inValueArea: inVA.has(idx),
    volumePct: maxBinVol > 0 ? b.totalVolume / maxBinVol : 0,
  }));

  return { pocPrice, vahPrice, valPrice, totalVolume, bins };
}

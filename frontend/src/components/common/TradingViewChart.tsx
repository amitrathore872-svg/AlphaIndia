"use client";

import { useEffect, useRef, useState, memo, useMemo } from "react";
import {
  createChart,
  ColorType,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  CrosshairMode,
  IChartApi,
  createSeriesMarkers,
} from "lightweight-charts";
import {
  fetchTechnoFundaCandles,
  type CandleData,
  type LineDataPoint,
  type PatternOverlay,
} from "@/lib/technoFundaApi";
import {
  computeEMA,
  computeBollingerBands,
  computeVWAP,
  computeVolumeSMA,
  computeCPR,
  computeRSI,
  computeSupertrend,
  computeMACD,
  computeKeltnerChannels,
  computeTTMSqueeze,
  computeMansfieldRS,
  computeChandelierExit,
  computeOBV,
  computeStochasticRSI,
  computeAutoFibonacci,
  computeIchimokuCloud,
  computeVolumeProfile,
  type VolumeProfileResult,
} from "@/lib/chartIndicators";
import {
  Activity,
  ExternalLink,
  Sparkles,
  Layers,
  Target,
  Shield,
  Eye,
  EyeOff,
  SlidersHorizontal,
  Check,
  BookmarkPlus,
  X,
  RotateCcw,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";

export interface ActiveIndicators {
  dma50: boolean;
  dma200: boolean;
  ema20: boolean;
  ema9: boolean;
  vwap: boolean;
  supertrend: boolean;
  bollingerBands: boolean;
  cpr: boolean;
  volumeMa: boolean;
  patternLines: boolean;
  targetsAndStop: boolean;
  rsi14: boolean;
  macd: boolean;
  // 8 Institutional Radar Indicators
  ttmSqueeze: boolean;
  mansfieldRS: boolean;
  chandelierExit: boolean;
  keltnerChannels: boolean;
  obv: boolean;
  stochRSI: boolean;
  autoFibonacci: boolean;
  ichimoku: boolean;
  // Volume Profile (POC, VAH, VAL)
  volumeProfile: boolean;
}

export const DEFAULT_INDICATORS: ActiveIndicators = {
  dma50: true,
  dma200: true,
  ema20: false,
  ema9: false,
  vwap: false,
  supertrend: false,
  bollingerBands: false,
  cpr: false,
  volumeMa: true,
  patternLines: true,
  targetsAndStop: false,
  rsi14: false,
  macd: false,
  ttmSqueeze: false,
  mansfieldRS: false,
  chandelierExit: false,
  keltnerChannels: false,
  obv: false,
  stochRSI: false,
  autoFibonacci: false,
  ichimoku: false,
  volumeProfile: false,
};

interface TradingViewChartProps {
  symbol: string;
  exchange?: string;
  height?: number | string;
  initialPeriod?: string;
  pivotReference?: number;
  scenarioTrigger?: number;
  downsideReference?: number;
  target1?: number;
  patternOverlays?: PatternOverlay[];
  alertLines?: Array<{ price: number; title: string; color?: string; lineStyle?: number }>;
  onAddToWatchlist?: (symbol: string) => void;
  isInWatchlist?: boolean;
}

function TradingViewChartComponent({
  symbol,
  exchange = "NSE",
  height = 540,
  initialPeriod = "6mo",
  pivotReference,
  scenarioTrigger,
  downsideReference,
  target1,
  patternOverlays: propsOverlays,
  alertLines,
  onAddToWatchlist,
  isInWatchlist = false,
}: TradingViewChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const [period, setPeriod] = useState<string>(initialPeriod);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<boolean>(false);
  const [dataVersion, setDataVersion] = useState<number>(0);
  const [retryTrigger, setRetryTrigger] = useState<number>(0);
  const [lastCandle, setLastCandle] = useState<CandleData | null>(null);

  // Indicator values at latest bar
  const [lastDma50, setLastDma50] = useState<number | null>(null);
  const [lastDma200, setLastDma200] = useState<number | null>(null);
  const [lastEma20, setLastEma20] = useState<number | null>(null);
  const [lastEma9, setLastEma9] = useState<number | null>(null);
  const [lastVwap, setLastVwap] = useState<number | null>(null);
  const [lastRsi, setLastRsi] = useState<number | null>(null);
  const [lastSupertrend, setLastSupertrend] = useState<{ value: number; direction: 1 | -1 } | null>(null);
  const [lastMacd, setLastMacd] = useState<{ macd: number; signal: number; hist: number } | null>(null);
  const [lastObv, setLastObv] = useState<{ value: number; ma: number } | null>(null);
  const [volumeProfileData, setVolumeProfileData] = useState<VolumeProfileResult | null>(null);

  // Pattern overlays & interactive toggles
  const [overlays, setOverlays] = useState<PatternOverlay[]>(propsOverlays || []);
  const [selectedOverlayIdx, setSelectedOverlayIdx] = useState<number>(0);

  // Indicators toggle state & modal visibility
  const [indicators, setIndicators] = useState<ActiveIndicators>(DEFAULT_INDICATORS);
  const [showIndicatorsModal, setShowIndicatorsModal] = useState<boolean>(false);
  const indicatorsModalRef = useRef<HTMLDivElement>(null);

  // Cached chart data to re-draw without re-fetching on toggle changes
  const chartDataRef = useRef<{
    candles: CandleData[];
    dma_50: LineDataPoint[];
    dma_200: LineDataPoint[];
    pattern_overlays: PatternOverlay[];
  } | null>(null);

  // Close modal on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        indicatorsModalRef.current &&
        !indicatorsModalRef.current.contains(e.target as Node)
      ) {
        setShowIndicatorsModal(false);
      }
    };
    if (showIndicatorsModal) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showIndicatorsModal]);

  // ── Fetch data ──
  useEffect(() => {
    let isCancelled = false;
    setLoading(true);
    setFetchError(false);

    fetchTechnoFundaCandles(symbol, period)
      .then((data) => {
        if (isCancelled) return;
        const fetchedOverlays = (data.pattern_overlays && data.pattern_overlays.length > 0)
          ? data.pattern_overlays
          : (propsOverlays || []);

        setOverlays(fetchedOverlays);
        setSelectedOverlayIdx(0);
        chartDataRef.current = {
          candles: data.candles || [],
          dma_50: data.dma_50 || [],
          dma_200: data.dma_200 || [],
          pattern_overlays: fetchedOverlays,
        };
        setDataVersion((v) => v + 1);
        if (!data.candles || data.candles.length === 0) {
          setFetchError(true);
        }
        setLoading(false);
      })
      .catch((err) => {
        if (!isCancelled) {
          console.error("Failed to fetch candle data:", err);
          chartDataRef.current = {
            candles: [],
            dma_50: [],
            dma_200: [],
            pattern_overlays: [],
          };
          setDataVersion((v) => v + 1);
          setFetchError(true);
          setLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [symbol, period, propsOverlays, retryTrigger]);

  // Count active indicators
  const activeCount = useMemo(() => {
    return Object.values(indicators).filter(Boolean).length;
  }, [indicators]);

  const [activePreset, setActivePreset] = useState<"clean" | "breakout" | "volumeProfile" | "momentum" | "custom">("clean");
  const [showPatternLegend, setShowPatternLegend] = useState(false);

  const applyPreset = (preset: "clean" | "breakout" | "volumeProfile" | "momentum") => {
    setActivePreset(preset);
    if (preset === "clean") {
      setIndicators({
        ...DEFAULT_INDICATORS,
        dma50: true,
        dma200: true,
        patternLines: true,
        targetsAndStop: false,
        supertrend: false,
        rsi14: false,
        macd: false,
        volumeProfile: false,
      });
    } else if (preset === "breakout") {
      setIndicators({
        ...DEFAULT_INDICATORS,
        dma50: true,
        dma200: true,
        patternLines: true,
        targetsAndStop: true,
        supertrend: true,
        rsi14: false,
        macd: false,
        volumeProfile: false,
      });
    } else if (preset === "volumeProfile") {
      setIndicators({
        ...DEFAULT_INDICATORS,
        dma50: true,
        dma200: true,
        patternLines: false,
        targetsAndStop: false,
        supertrend: false,
        rsi14: false,
        macd: false,
        volumeProfile: true,
        obv: true,
      });
    } else if (preset === "momentum") {
      setIndicators({
        ...DEFAULT_INDICATORS,
        dma50: true,
        dma200: false,
        patternLines: false,
        targetsAndStop: false,
        supertrend: false,
        rsi14: true,
        macd: true,
        volumeProfile: false,
      });
    }
  };

  const toggleIndicator = (key: keyof ActiveIndicators) => {
    setActivePreset("custom");
    setIndicators((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // ── Draw chart ──
  useEffect(() => {
    if (!chartContainerRef.current || !chartDataRef.current) return;
    const container = chartContainerRef.current;
    container.innerHTML = "";

    const data = chartDataRef.current;
    if (data.candles.length === 0) return;

    const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");

    const initialHeight = typeof height === "number" 
      ? height 
      : (container.clientHeight > 100 ? container.clientHeight : 680);

    const chart = createChart(container, {
      width: container.clientWidth,
      height: initialHeight,
      layout: {
        background: { type: ColorType.Solid, color: isDark ? "#050B14" : "#ffffff" },
        textColor: isDark ? "#94a3b8" : "#475569",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: isDark ? "#0d1c33" : "#f1f5f9" },
        horzLines: { color: isDark ? "#0d1c33" : "#f1f5f9" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: isDark ? "#1e293b" : "#e2e8f0",
        scaleMargins: {
          top: 0.1,
          bottom: 0.22,
        },
      },
      timeScale: {
        borderColor: isDark ? "#1e293b" : "#e2e8f0",
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    const hasSubPane = Boolean(
      indicators.rsi14 ||
      indicators.macd ||
      indicators.ttmSqueeze ||
      indicators.mansfieldRS ||
      indicators.obv ||
      indicators.stochRSI
    );

    // 1. Volume Series (Tucked neatly at bottom, clean separation from oscillators)
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "",
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: hasSubPane ? 0.88 : 0.82,
        bottom: 0,
      },
    });
    volumeSeries.setData(
      data.candles.map((c) => ({
        time: c.time as any,
        value: c.volume,
        color: c.close >= c.open ? "rgba(16, 185, 129, 0.35)" : "rgba(239, 68, 68, 0.35)",
      }))
    );

    // 1B. Volume 20 SMA
    if (indicators.volumeMa) {
      const volMa = computeVolumeSMA(data.candles, 20);
      if (volMa.length > 0) {
        const volMaSeries = chart.addSeries(LineSeries, {
          color: "#94a3b8",
          lineWidth: 1,
          priceFormat: { type: "volume" },
          priceScaleId: "",
          title: "Vol 20 SMA",
        });
        volMaSeries.setData(volMa.map((d) => ({ time: d.time as any, value: d.value })));
      }
    }

    // 2. Candlestick Series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#10b981",
      downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#10b981",
      wickDownColor: "#ef4444",
    });
    candleSeries.setData(
      data.candles.map((c) => ({
        time: c.time as any,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
    );

    // 3. Moving Averages & Trend
    // 50 DMA
    if (indicators.dma50) {
      if (data.dma_50 && data.dma_50.length > 0) {
        const dma50Series = chart.addSeries(LineSeries, {
          color: "#06b6d4",
          lineWidth: 2,
          title: "50 DMA",
        });
        dma50Series.setData(
          data.dma_50.map((d) => ({
            time: d.time as any,
            value: d.value,
          }))
        );
        setLastDma50(data.dma_50[data.dma_50.length - 1]?.value ?? null);
      }
    } else {
      setLastDma50(null);
    }

    // 200 DMA
    if (indicators.dma200) {
      if (data.dma_200 && data.dma_200.length > 0) {
        const dma200Series = chart.addSeries(LineSeries, {
          color: "#f59e0b",
          lineWidth: 2,
          title: "200 DMA",
        });
        dma200Series.setData(
          data.dma_200.map((d) => ({
            time: d.time as any,
            value: d.value,
          }))
        );
        setLastDma200(data.dma_200[data.dma_200.length - 1]?.value ?? null);
      }
    } else {
      setLastDma200(null);
    }

    // 20 EMA
    if (indicators.ema20) {
      const ema20Data = computeEMA(data.candles, 20);
      if (ema20Data.length > 0) {
        const ema20Series = chart.addSeries(LineSeries, {
          color: "#a855f7",
          lineWidth: 2,
          title: "20 EMA",
        });
        ema20Series.setData(ema20Data.map((d) => ({ time: d.time as any, value: d.value })));
        setLastEma20(ema20Data[ema20Data.length - 1]?.value ?? null);
      }
    } else {
      setLastEma20(null);
    }

    // 9 EMA
    if (indicators.ema9) {
      const ema9Data = computeEMA(data.candles, 9);
      if (ema9Data.length > 0) {
        const ema9Series = chart.addSeries(LineSeries, {
          color: "#ec4899",
          lineWidth: 1,
          title: "9 EMA",
        });
        ema9Series.setData(ema9Data.map((d) => ({ time: d.time as any, value: d.value })));
        setLastEma9(ema9Data[ema9Data.length - 1]?.value ?? null);
      }
    } else {
      setLastEma9(null);
    }

    // VWAP
    if (indicators.vwap) {
      const vwapData = computeVWAP(data.candles);
      if (vwapData.length > 0) {
        const vwapSeries = chart.addSeries(LineSeries, {
          color: "#3b82f6",
          lineWidth: 2,
          title: "VWAP",
        });
        vwapSeries.setData(vwapData.map((d) => ({ time: d.time as any, value: d.value })));
        setLastVwap(vwapData[vwapData.length - 1]?.value ?? null);
      }
    } else {
      setLastVwap(null);
    }

    // Bollinger Bands (20, 2)
    if (indicators.bollingerBands) {
      const bb = computeBollingerBands(data.candles, 20, 2);
      if (bb.middle.length > 0) {
        const bbUpperSeries = chart.addSeries(LineSeries, {
          color: "#818cf8",
          lineWidth: 1,
          lineStyle: 2,
          title: "BB Upper",
        });
        bbUpperSeries.setData(bb.upper.map((d) => ({ time: d.time as any, value: d.value })));

        const bbMidSeries = chart.addSeries(LineSeries, {
          color: "#6366f1",
          lineWidth: 1,
          title: "BB 20 SMA",
        });
        bbMidSeries.setData(bb.middle.map((d) => ({ time: d.time as any, value: d.value })));

        const bbLowerSeries = chart.addSeries(LineSeries, {
          color: "#818cf8",
          lineWidth: 1,
          lineStyle: 2,
          title: "BB Lower",
        });
        bbLowerSeries.setData(bb.lower.map((d) => ({ time: d.time as any, value: d.value })));
      }
    }

    // CPR (Central Pivot Range)
    if (indicators.cpr) {
      const cpr = computeCPR(data.candles);
      if (cpr) {
        candleSeries.createPriceLine({
          price: cpr.pivot,
          color: "#eab308",
          lineWidth: 2,
          lineStyle: 0,
          axisLabelVisible: true,
          title: `CPR Pivot (₹${cpr.pivot})`,
        });
        candleSeries.createPriceLine({
          price: cpr.tc,
          color: "#14b8a6",
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: `CPR TC (₹${cpr.tc})`,
        });
        candleSeries.createPriceLine({
          price: cpr.bc,
          color: "#06b6d4",
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: `CPR BC (₹${cpr.bc})`,
        });
        candleSeries.createPriceLine({
          price: cpr.r1,
          color: "#10b981",
          lineWidth: 1,
          lineStyle: 3,
          axisLabelVisible: true,
          title: `R1 (₹${cpr.r1})`,
        });
        candleSeries.createPriceLine({
          price: cpr.s1,
          color: "#ef4444",
          lineWidth: 1,
          lineStyle: 3,
          axisLabelVisible: true,
          title: `S1 (₹${cpr.s1})`,
        });
      }
    }

    // Supertrend (10, 3)
    if (indicators.supertrend) {
      const st = computeSupertrend(data.candles, 10, 3);
      if (st.points.length > 0) {
        if (st.bullishSeries.length > 0) {
          const stBullSeries = chart.addSeries(LineSeries, {
            color: "#10b981",
            lineWidth: 2,
            title: "Supertrend (Bull)",
          });
          stBullSeries.setData(st.bullishSeries.map((d) => ({ time: d.time as any, value: d.value })));
        }

        if (st.bearishSeries.length > 0) {
          const stBearSeries = chart.addSeries(LineSeries, {
            color: "#ef4444",
            lineWidth: 2,
            title: "Supertrend (Bear)",
          });
          stBearSeries.setData(st.bearishSeries.map((d) => ({ time: d.time as any, value: d.value })));
        }

        if (st.signals.length > 0) {
          try {
            createSeriesMarkers(
              candleSeries,
              st.signals.map((s) => ({
                time: s.time as any,
                position: s.position,
                color: s.color,
                shape: s.shape,
                text: s.text,
              }))
            );
          } catch (e) {
            console.debug("Supertrend markers skipped:", e);
          }
        }

        const latestSt = st.points[st.points.length - 1];
        setLastSupertrend({ value: latestSt.value, direction: latestSt.direction });
      }
    } else {
      setLastSupertrend(null);
    }

    // RSI 14 (Visual Curve with 70/30 Thresholds)
    if (indicators.rsi14) {
      const rsiData = computeRSI(data.candles, 14);
      if (rsiData.length > 0) {
        setLastRsi(rsiData[rsiData.length - 1]?.value ?? null);

        const rsiSeries = chart.addSeries(LineSeries, {
          color: "#c084fc",
          lineWidth: 2,
          priceScaleId: "rsi",
          title: "RSI (14)",
        });
        rsiSeries.priceScale().applyOptions({
          scaleMargins: {
            top: 0.74,
            bottom: 0.13,
          },
        });
        rsiSeries.setData(rsiData.map((d) => ({ time: d.time as any, value: d.value })));

        rsiSeries.createPriceLine({
          price: 70,
          color: "rgba(239, 68, 68, 0.7)",
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: "70",
        });
        rsiSeries.createPriceLine({
          price: 30,
          color: "rgba(16, 185, 129, 0.7)",
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: "30",
        });
      }
    } else {
      setLastRsi(null);
    }

    // MACD (12, 26, 9)
    if (indicators.macd) {
      const macdRes = computeMACD(data.candles, 12, 26, 9);
      if (macdRes.macdLine.length > 0) {
        const macdFastSeries = chart.addSeries(LineSeries, {
          color: "#38bdf8",
          lineWidth: 2,
          priceScaleId: "macd",
          title: "MACD",
        });
        macdFastSeries.priceScale().applyOptions({
          scaleMargins: {
            top: 0.74,
            bottom: 0.13,
          },
        });
        macdFastSeries.setData(macdRes.macdLine.map((d) => ({ time: d.time as any, value: d.value })));

        if (macdRes.signalLine.length > 0) {
          const macdSigSeries = chart.addSeries(LineSeries, {
            color: "#fb923c",
            lineWidth: 1,
            priceScaleId: "macd",
            title: "Signal",
          });
          macdSigSeries.setData(macdRes.signalLine.map((d) => ({ time: d.time as any, value: d.value })));
        }

        if (macdRes.histogram.length > 0) {
          const macdHistSeries = chart.addSeries(HistogramSeries, {
            priceScaleId: "macd",
            title: "Histogram",
          });
          macdHistSeries.setData(macdRes.histogram.map((d) => ({ time: d.time as any, value: d.value, color: d.color })));
        }

        const latestM = macdRes.macdLine[macdRes.macdLine.length - 1]?.value ?? 0;
        const latestS = macdRes.signalLine[macdRes.signalLine.length - 1]?.value ?? 0;
        setLastMacd({ macd: latestM, signal: latestS, hist: latestM - latestS });
      }
    } else {
      setLastMacd(null);
    }

    // -------------------------------------------------------------
    // Institutional Indicators Suite (Overlays & Sub-panes)
    // -------------------------------------------------------------

    // 1. Keltner Channels (20 EMA, 2.0x ATR) - Overlay
    if (indicators.keltnerChannels) {
      const kc = computeKeltnerChannels(data.candles, 20, 2, 10);
      if (kc.middle.length > 0) {
        const kcU = chart.addSeries(LineSeries, {
          color: "#38bdf8",
          lineWidth: 1,
          lineStyle: 2,
          title: "KC Upper",
        });
        kcU.setData(kc.upper.map((d) => ({ time: d.time as any, value: d.value })));

        const kcMid = chart.addSeries(LineSeries, {
          color: "#0284c7",
          lineWidth: 1,
          title: "KC 20 EMA",
        });
        kcMid.setData(kc.middle.map((d) => ({ time: d.time as any, value: d.value })));

        const kcL = chart.addSeries(LineSeries, {
          color: "#38bdf8",
          lineWidth: 1,
          lineStyle: 2,
          title: "KC Lower",
        });
        kcL.setData(kc.lower.map((d) => ({ time: d.time as any, value: d.value })));
      }
    }

    // 2. Chandelier Exit (22, 3.0 ATR) - Overlay
    if (indicators.chandelierExit) {
      const chandStop = computeChandelierExit(data.candles, 22, 3.0);
      if (chandStop.length > 0) {
        const chandSeries = chart.addSeries(LineSeries, {
          color: "#f59e0b",
          lineWidth: 2,
          lineStyle: 0,
          title: "Chandelier Exit",
        });
        chandSeries.setData(chandStop.map((d) => ({ time: d.time as any, value: d.value })));
      }
    }

    // 3. Auto Fibonacci Retracement Levels - Overlay
    if (indicators.autoFibonacci) {
      const fib = computeAutoFibonacci(data.candles, 100);
      if (fib) {
        for (const lvl of fib.levels) {
          candleSeries.createPriceLine({
            price: lvl.price,
            color: lvl.color,
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: `${lvl.label} (₹${lvl.price})`,
          });
        }
      }
    }

    // 4. Ichimoku Cloud (9, 26, 52) - Overlay
    if (indicators.ichimoku) {
      const ichi = computeIchimokuCloud(data.candles, 9, 26, 52);
      if (ichi.tenkan.length > 0) {
        const tenkanSeries = chart.addSeries(LineSeries, {
          color: "#06b6d4",
          lineWidth: 1,
          title: "Tenkan (9)",
        });
        tenkanSeries.setData(ichi.tenkan.map((d) => ({ time: d.time as any, value: d.value })));
      }
      if (ichi.kijun.length > 0) {
        const kijunSeries = chart.addSeries(LineSeries, {
          color: "#f43f5e",
          lineWidth: 1,
          title: "Kijun (26)",
        });
        kijunSeries.setData(ichi.kijun.map((d) => ({ time: d.time as any, value: d.value })));
      }
      if (ichi.spanA.length > 0) {
        const spanASeries = chart.addSeries(LineSeries, {
          color: "#10b981",
          lineWidth: 1,
          lineStyle: 2,
          title: "Span A",
        });
        spanASeries.setData(ichi.spanA.map((d) => ({ time: d.time as any, value: d.value })));
      }
      if (ichi.spanB.length > 0) {
        const spanBSeries = chart.addSeries(LineSeries, {
          color: "#ef4444",
          lineWidth: 1,
          lineStyle: 2,
          title: "Span B",
        });
        spanBSeries.setData(ichi.spanB.map((d) => ({ time: d.time as any, value: d.value })));
      }
    }

    // 5. TTM Squeeze (Sub-pane)
    if (indicators.ttmSqueeze) {
      const ttm = computeTTMSqueeze(data.candles, 20, 2.0, 1.5);
      if (ttm.histogram.length > 0) {
        const ttmHistSeries = chart.addSeries(HistogramSeries, {
          priceScaleId: "ttm",
          title: "TTM Squeeze",
        });
        ttmHistSeries.priceScale().applyOptions({
          scaleMargins: {
            top: 0.82,
            bottom: 0.01,
          },
        });
        ttmHistSeries.setData(ttm.histogram.map((d) => ({ time: d.time as any, value: d.value, color: d.color })));

        // Squeeze status line (0 line with color markers)
        if (ttm.squeezeDots.length > 0) {
          const dotSeries = chart.addSeries(LineSeries, {
            priceScaleId: "ttm",
            lineWidth: 1,
            color: "#64748b",
            title: "Coil Status",
          });
          dotSeries.setData(ttm.squeezeDots.map((d) => ({ time: d.time as any, value: 0 })));
        }
      }
    }

    // 6. Mansfield Relative Strength (Sub-pane)
    if (indicators.mansfieldRS) {
      const mRS = computeMansfieldRS(data.candles, 52);
      if (mRS.rsLine.length > 0) {
        const rsSeries = chart.addSeries(LineSeries, {
          color: "#a855f7",
          lineWidth: 2,
          priceScaleId: "mansfield",
          title: "Mansfield RS (52)",
        });
        rsSeries.priceScale().applyOptions({
          scaleMargins: {
            top: 0.82,
            bottom: 0.01,
          },
        });
        rsSeries.setData(mRS.rsLine.map((d) => ({ time: d.time as any, value: d.value })));

        // Zero reference line
        rsSeries.createPriceLine({
          price: 0,
          color: "#94a3b8",
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: "Zero (Alpha Pivot)",
        });
      }
    }

    // 7. On-Balance Volume (OBV) (Sub-pane)
    if (indicators.obv) {
      const obvData = computeOBV(data.candles, 20);
      if (obvData.obvLine.length > 0) {
        const obvSeries = chart.addSeries(LineSeries, {
          color: "#22c55e",
          lineWidth: 2,
          priceScaleId: "obv",
          title: "OBV",
        });
        obvSeries.priceScale().applyOptions({
          scaleMargins: {
            top: 0.82,
            bottom: 0.01,
          },
        });
        obvSeries.setData(obvData.obvLine.map((d) => ({ time: d.time as any, value: d.value })));

        if (obvData.obvMa.length > 0) {
          const obvMaSeries = chart.addSeries(LineSeries, {
            color: "#f59e0b",
            lineWidth: 1,
            lineStyle: 2,
            priceScaleId: "obv",
            title: "OBV 20 SMA",
          });
          obvMaSeries.setData(obvData.obvMa.map((d) => ({ time: d.time as any, value: d.value })));
        }

        const latestObv = obvData.obvLine[obvData.obvLine.length - 1]?.value ?? 0;
        const latestObvMa = obvData.obvMa[obvData.obvMa.length - 1]?.value ?? 0;
        setLastObv({ value: latestObv, ma: latestObvMa });
      }
    } else {
      setLastObv(null);
    }

    // 8. Stochastic RSI (Sub-pane)
    if (indicators.stochRSI) {
      const stoch = computeStochasticRSI(data.candles, 14, 14, 3, 3);
      if (stoch.kLine.length > 0) {
        const kSeries = chart.addSeries(LineSeries, {
          color: "#38bdf8",
          lineWidth: 2,
          priceScaleId: "stochRsi",
          title: "Stoch %K",
        });
        kSeries.priceScale().applyOptions({
          scaleMargins: {
            top: 0.82,
            bottom: 0.01,
          },
        });
        kSeries.setData(stoch.kLine.map((d) => ({ time: d.time as any, value: d.value })));

        if (stoch.dLine.length > 0) {
          const dSeries = chart.addSeries(LineSeries, {
            color: "#f97316",
            lineWidth: 1,
            priceScaleId: "stochRsi",
            title: "Stoch %D",
          });
          dSeries.setData(stoch.dLine.map((d) => ({ time: d.time as any, value: d.value })));
        }

        kSeries.createPriceLine({
          price: 80,
          color: "#ef4444",
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: "OB 80",
        });
        kSeries.createPriceLine({
          price: 20,
          color: "#10b981",
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: "OS 20",
        });
      }
    }

    // 9. Volume Profile (POC, VAH, VAL Price Lines)
    if (indicators.volumeProfile) {
      const vp = computeVolumeProfile(data.candles, 28, 0.70);
      setVolumeProfileData(vp);
      if (vp) {
        // Point of Control (POC) - Highlighted Amber
        candleSeries.createPriceLine({
          price: vp.pocPrice,
          color: "#f59e0b",
          lineWidth: 1,
          lineStyle: 0,
          axisLabelVisible: true,
          title: "POC",
        });
        // Value Area High (VAH) - Dashed, no bulky badge to keep axis clean
        candleSeries.createPriceLine({
          price: vp.vahPrice,
          color: "rgba(6, 182, 212, 0.65)",
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: false,
          title: "VAH",
        });
        // Value Area Low (VAL) - Dashed, no bulky badge
        candleSeries.createPriceLine({
          price: vp.valPrice,
          color: "rgba(6, 182, 212, 0.65)",
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: false,
          title: "VAL",
        });
      }
    } else {
      setVolumeProfileData(null);
    }

    // 4. Pattern Overlays (Horizontal Lines, Rising Support Trendlines, Markers)
    const activeOverlay = overlays[selectedOverlayIdx] || overlays[0];

    if (indicators.patternLines && activeOverlay) {
      // 4A. Horizontal Lines (Resistance, Support, Pivot, Targets, Stop)
      if (activeOverlay.horizontal_lines) {
        for (const line of activeOverlay.horizontal_lines) {
          const isTargetOrStop = line.id.startsWith("target") || line.id === "stop_loss";
          if (isTargetOrStop && !indicators.targetsAndStop) continue;

          let cleanTitle = line.title;
          if (line.id === "pivot" || line.title.toLowerCase().includes("pivot")) {
            cleanTitle = "Pivot";
          } else if (line.id === "resistance" || line.title.toLowerCase().includes("resistance")) {
            cleanTitle = "Res";
          } else if (line.id === "stop_loss" || line.title.toLowerCase().includes("stop")) {
            cleanTitle = "Stop";
          } else if (line.id.startsWith("target_1") || line.title.toLowerCase().includes("target 1")) {
            cleanTitle = "T1";
          } else if (line.id.startsWith("target_2") || line.title.toLowerCase().includes("target 2")) {
            cleanTitle = "T2";
          } else if (line.title.length > 8) {
            cleanTitle = line.title.split(" ")[0];
          }

          candleSeries.createPriceLine({
            price: line.price,
            color: line.color,
            lineWidth: 1,
            lineStyle: isTargetOrStop ? 2 : (line.lineStyle ?? 2), // Subtle dashed lines
            axisLabelVisible: true,
            title: cleanTitle,
          });
        }
      }

      // 4B. Trendlines (Rising Support, Flag Channels)
      if (activeOverlay.trend_lines) {
        for (const tline of activeOverlay.trend_lines) {
          if (tline.points && tline.points.length >= 2) {
            const trendSeries = chart.addSeries(LineSeries, {
              color: tline.color || "#10b981",
              lineWidth: (tline.lineWidth || 2) as any,
              lineStyle: tline.lineStyle ?? 2,
              title: tline.title,
              lastValueVisible: false,
              priceLineVisible: false,
            });
            trendSeries.setData(
              tline.points.map((p) => ({
                time: p.time as any,
                value: p.value,
              }))
            );
          }
        }
      }

      // 4C. Markers on Key Inflection Points
      if (activeOverlay.markers && activeOverlay.markers.length > 0) {
        try {
          createSeriesMarkers(
            candleSeries,
            activeOverlay.markers.map((m) => ({
              time: m.time as any,
              position: m.position,
              color: m.color,
              shape: m.shape,
              text: m.text,
            }))
          );
        } catch (e) {
          console.debug("createSeriesMarkers skipped:", e);
        }
      }
    } else {
      // Fallback: draw basic scenario triggers if no pattern overlay active
      if (scenarioTrigger) {
        candleSeries.createPriceLine({
          price: scenarioTrigger,
          color: "#06b6d4",
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: "TRIGGER",
        });
      }
      if (pivotReference) {
        candleSeries.createPriceLine({
          price: pivotReference,
          color: "#f59e0b",
          lineWidth: 1,
          lineStyle: 0,
          axisLabelVisible: true,
          title: "PIVOT",
        });
      }
      if (indicators.targetsAndStop) {
        if (downsideReference) {
          candleSeries.createPriceLine({
            price: downsideReference,
            color: "#ef4444",
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: "STOP LOSS",
          });
        }
        if (target1) {
          candleSeries.createPriceLine({
            price: target1,
            color: "#10b981",
            lineWidth: 1,
            lineStyle: 1,
            axisLabelVisible: true,
            title: "TARGET 1",
          });
        }
      }
    }

    // 5. Watchlist Alert Threshold Lines
    if (alertLines && alertLines.length > 0) {
      for (const al of alertLines) {
        if (al.price && al.price > 0) {
          candleSeries.createPriceLine({
            price: al.price,
            color: al.color || "#f59e0b",
            lineWidth: 2,
            lineStyle: (al.lineStyle ?? 2) as any,
            axisLabelVisible: true,
            title: `🔔 ${al.title}`,
          });
        }
      }
    }

    chart.timeScale().fitContent();

    const latest = data.candles[data.candles.length - 1];
    setLastCandle(latest || null);

    // Responsive resize handler
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        const clientW = chartContainerRef.current.clientWidth;
        const clientH = chartContainerRef.current.clientHeight;
        const newHeight = typeof height === "number" ? height : (clientH > 100 ? clientH : initialHeight);
        chartRef.current.applyOptions({
          width: clientW,
          height: newHeight,
        });
      }
    };

    window.addEventListener("resize", handleResize);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && chartContainerRef.current) {
      resizeObserver = new ResizeObserver(() => handleResize());
      resizeObserver.observe(chartContainerRef.current);
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      if (resizeObserver) resizeObserver.disconnect();
      chart.remove();
    };
  }, [
    dataVersion,
    overlays,
    selectedOverlayIdx,
    indicators,
    height,
    pivotReference,
    scenarioTrigger,
    downsideReference,
    target1,
    alertLines,
  ]);

  const tvUrl = `https://in.tradingview.com/symbols/${exchange}-${symbol.toUpperCase()}/`;
  const activeOverlay = overlays[selectedOverlayIdx] || overlays[0];

  return (
    <div className="relative w-full h-full flex flex-col flex-1 min-h-0 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#050B14] shadow-2xl">
      {/* ── Top Header / Legend & Pattern Toolbar ── */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-[#081225] px-4 py-2.5 gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold tracking-wider text-slate-900 dark:text-white font-mono">
              {exchange}:{symbol.toUpperCase()}
            </span>
            {onAddToWatchlist && (
              <button
                type="button"
                onClick={() => onAddToWatchlist(symbol)}
                className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border text-[11px] font-semibold transition ml-1 ${
                  isInWatchlist
                    ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                    : "border-cyan-500/50 bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30"
                }`}
                title={isInWatchlist ? "Already in active watchlist" : "Add to active watchlist"}
              >
                {isInWatchlist ? (
                  <>
                    <Check size={11} className="text-emerald-400" />
                    <span>In Watchlist</span>
                  </>
                ) : (
                  <>
                    <BookmarkPlus size={11} className="text-cyan-400" />
                    <span>+ Watchlist</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Real-time prices & Indicator values */}
          {lastCandle && (
            <div className="flex flex-wrap items-center gap-2.5 font-mono text-xs text-slate-600 dark:text-slate-300">
              <span>
                C: <strong className="text-slate-900 dark:text-white">₹{lastCandle.close}</strong>
              </span>
              <span className="text-slate-500 dark:text-slate-400 hidden sm:inline">
                H: ₹{lastCandle.high} L: ₹{lastCandle.low}
              </span>
              {indicators.dma50 && lastDma50 && (
                <span className="hidden md:inline text-cyan-500 font-medium">
                  50 DMA: ₹{lastDma50}
                </span>
              )}
              {indicators.dma200 && lastDma200 && (
                <span className="hidden md:inline text-amber-400 font-medium">
                  200 DMA: ₹{lastDma200}
                </span>
              )}
              {indicators.ema20 && lastEma20 && (
                <span className="hidden lg:inline text-purple-400 font-medium">
                  20 EMA: ₹{lastEma20}
                </span>
              )}
              {indicators.ema9 && lastEma9 && (
                <span className="hidden xl:inline text-pink-400 font-medium">
                  9 EMA: ₹{lastEma9}
                </span>
              )}
              {indicators.vwap && lastVwap && (
                <span className="hidden xl:inline text-blue-400 font-medium">
                  VWAP: ₹{lastVwap}
                </span>
              )}
              {indicators.supertrend && lastSupertrend && (
                <span
                  className={`hidden sm:inline font-bold px-2 py-0.5 rounded text-[10px] font-mono border ${
                    lastSupertrend.direction === 1
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                      : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                  }`}
                  title={`Supertrend (10, 3) Trailing Stop: ₹${lastSupertrend.value}`}
                >
                  ST(10,3): ₹{lastSupertrend.value} ({lastSupertrend.direction === 1 ? "BULL" : "BEAR"})
                </span>
              )}
              {indicators.rsi14 && lastRsi && (
                <span
                  className={`hidden sm:inline font-bold px-1.5 py-0.2 rounded text-[10px] ${
                    lastRsi >= 70
                      ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                      : lastRsi <= 30
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      : "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                  }`}
                  title="RSI (14) - 70 Overbought, 30 Oversold"
                >
                  RSI(14): {lastRsi}
                </span>
              )}
              {indicators.macd && lastMacd && (
                <span
                  className={`hidden lg:inline font-mono px-1.5 py-0.2 rounded text-[10px] border ${
                    lastMacd.hist >= 0
                      ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/30"
                      : "bg-rose-500/15 text-rose-300 border-rose-500/30"
                  }`}
                  title={`MACD: ${lastMacd.macd} | Signal: ${lastMacd.signal}`}
                >
                  MACD: {lastMacd.macd > 0 ? "+" : ""}{lastMacd.macd} ({lastMacd.hist >= 0 ? "Bull" : "Bear"})
                </span>
              )}
              {indicators.obv && lastObv && (
                <span
                  className={`hidden xl:inline font-mono px-1.5 py-0.2 rounded text-[10px] border ${
                    lastObv.value >= lastObv.ma
                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                      : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                  }`}
                  title={`On-Balance Volume: ${lastObv.value.toLocaleString()} | 20 SMA: ${lastObv.ma.toLocaleString()}`}
                >
                  OBV: {lastObv.value >= lastObv.ma ? "Accumulation (Bull)" : "Distribution (Bear)"}
                </span>
              )}
              {indicators.volumeProfile && volumeProfileData && (
                <span
                  className="hidden xl:inline font-mono px-1.5 py-0.2 rounded text-[10px] border bg-amber-500/20 text-amber-300 border-amber-500/40"
                  title={`Volume Profile Point of Control: ₹${volumeProfileData.pocPrice} | VAH: ₹${volumeProfileData.vahPrice} | VAL: ₹${volumeProfileData.valPrice}`}
                >
                  VP POC: ₹{volumeProfileData.pocPrice}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Timeframe & Indicators & External link */}
        <div className="flex items-center gap-2">
          {/* Quick Preset Modes: Clean | Breakout | Volume Profile | Oscillators */}
          <div className="hidden lg:flex items-center gap-1 bg-slate-100 dark:bg-slate-900/90 p-0.5 rounded-lg border border-slate-300 dark:border-slate-800 text-[10px] font-semibold">
            <button
              type="button"
              onClick={() => applyPreset("clean")}
              className={`px-2 py-0.5 rounded transition ${
                activePreset === "clean"
                  ? "bg-cyan-600 dark:bg-cyan-500 text-white dark:text-slate-950 font-bold shadow-xs"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
              title="Clean minimalist view: Candlesticks + 50/200 DMA + Volume"
            >
              Clean
            </button>
            <button
              type="button"
              onClick={() => applyPreset("breakout")}
              className={`px-2 py-0.5 rounded transition ${
                activePreset === "breakout"
                  ? "bg-cyan-600 dark:bg-cyan-500 text-white dark:text-slate-950 font-bold shadow-xs"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
              title="Breakout Radar: Pattern Pivot & Targets + Supertrend"
            >
              Breakout
            </button>
            <button
              type="button"
              onClick={() => applyPreset("volumeProfile")}
              className={`px-2 py-0.5 rounded transition ${
                activePreset === "volumeProfile"
                  ? "bg-cyan-600 dark:bg-cyan-500 text-white dark:text-slate-950 font-bold shadow-xs"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
              title="Volume Profile: POC + VAH + VAL + OBV Accumulation"
            >
              Volume Profile
            </button>
            <button
              type="button"
              onClick={() => applyPreset("momentum")}
              className={`px-2 py-0.5 rounded transition ${
                activePreset === "momentum"
                  ? "bg-cyan-600 dark:bg-cyan-500 text-white dark:text-slate-950 font-bold shadow-xs"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
              title="Oscillators: RSI (14) + MACD"
            >
              Oscillators
            </button>
          </div>

          {/* fx Indicators Button */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowIndicatorsModal((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/90 px-2.5 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-300 hover:border-cyan-500/50 transition shadow-xs"
              title="Add or remove technical indicators from chart"
            >
              <SlidersHorizontal size={12} className="text-cyan-500" />
              <span>fx Indicators</span>
              <span className="rounded bg-cyan-500/20 px-1 py-0.2 font-mono text-[10px] text-cyan-600 dark:text-cyan-300 font-bold">
                {activeCount}
              </span>
            </button>

            {/* Indicators Popover Dropdown */}
            {showIndicatorsModal && (
              <div
                ref={indicatorsModalRef}
                className="absolute right-0 top-full mt-2 z-50 w-84 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#070F1E] p-4 shadow-2xl backdrop-blur-2xl text-xs space-y-3.5 max-h-[82vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <SlidersHorizontal size={14} className="text-cyan-500" />
                    <span className="font-bold text-slate-900 dark:text-white">Chart Technical Indicators</span>
                  </div>
                  <button
                    onClick={() => setShowIndicatorsModal(false)}
                    className="text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Section 1: Trend & Moving Averages */}
                <div className="space-y-1.5">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                    Trend & Moving Averages
                  </div>
                  <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#06b6d4]" />
                      <span className="text-slate-800 dark:text-slate-200 font-medium">50 DMA</span>
                      <span className="text-[10px] text-slate-400">Institutional Trend</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={indicators.dma50}
                      onChange={() => toggleIndicator("dma50")}
                      className="rounded accent-cyan-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" />
                      <span className="text-slate-800 dark:text-slate-200 font-medium">200 DMA</span>
                      <span className="text-[10px] text-slate-400">Major Bull/Bear Anchor</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={indicators.dma200}
                      onChange={() => toggleIndicator("dma200")}
                      className="rounded accent-amber-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#a855f7]" />
                      <span className="text-slate-800 dark:text-slate-200 font-medium">20 EMA</span>
                      <span className="text-[10px] text-slate-400">Swing Pullback</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={indicators.ema20}
                      onChange={() => toggleIndicator("ema20")}
                      className="rounded accent-purple-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#ec4899]" />
                      <span className="text-slate-800 dark:text-slate-200 font-medium">9 EMA</span>
                      <span className="text-[10px] text-slate-400">Scalp Momentum</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={indicators.ema9}
                      onChange={() => toggleIndicator("ema9")}
                      className="rounded accent-pink-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6]" />
                      <span className="text-slate-800 dark:text-slate-200 font-medium">VWAP</span>
                      <span className="text-[10px] text-slate-400">Volume Weighted Price</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={indicators.vwap}
                      onChange={() => toggleIndicator("vwap")}
                      className="rounded accent-blue-500"
                    />
                  </label>
                </div>

                {/* Section 2: Trend Envelopes & Trailing Stops (Overlays) */}
                <div className="space-y-1.5 border-t border-slate-200 dark:border-slate-800/80 pt-2.5">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                    Trend Envelopes & Trailing Stops
                  </div>
                  <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#10b981]" />
                      <span className="text-slate-800 dark:text-slate-200 font-medium">Supertrend (10, 3)</span>
                      <span className="text-[10px] text-emerald-400 font-mono font-semibold">Trailing Stop</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={indicators.supertrend}
                      onChange={() => toggleIndicator("supertrend")}
                      className="rounded accent-emerald-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" />
                      <span className="text-slate-800 dark:text-slate-200 font-medium">Chandelier Exit</span>
                      <span className="text-[10px] text-amber-400 font-mono">22, 3 ATR</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={indicators.chandelierExit}
                      onChange={() => toggleIndicator("chandelierExit")}
                      className="rounded accent-amber-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#38bdf8]" />
                      <span className="text-slate-800 dark:text-slate-200 font-medium">Keltner Channels</span>
                      <span className="text-[10px] text-cyan-400 font-mono">20 EMA ±2 ATR</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={indicators.keltnerChannels}
                      onChange={() => toggleIndicator("keltnerChannels")}
                      className="rounded accent-sky-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#818cf8]" />
                      <span className="text-slate-800 dark:text-slate-200 font-medium">Bollinger Bands</span>
                      <span className="text-[10px] text-slate-400">20 SMA ±2σ</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={indicators.bollingerBands}
                      onChange={() => toggleIndicator("bollingerBands")}
                      className="rounded accent-indigo-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#f43f5e]" />
                      <span className="text-slate-800 dark:text-slate-200 font-medium">Ichimoku Cloud</span>
                      <span className="text-[10px] text-rose-400 font-mono">9, 26, 52</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={indicators.ichimoku}
                      onChange={() => toggleIndicator("ichimoku")}
                      className="rounded accent-rose-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#f97316]" />
                      <span className="text-slate-800 dark:text-slate-200 font-medium">Auto Fibonacci</span>
                      <span className="text-[10px] text-orange-400 font-mono">Golden Pocket</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={indicators.autoFibonacci}
                      onChange={() => toggleIndicator("autoFibonacci")}
                      className="rounded accent-orange-500"
                    />
                  </label>
                </div>

                {/* Section 3: Momentum & Oscillators (Sub-panes) */}
                <div className="space-y-1.5 border-t border-slate-200 dark:border-slate-800/80 pt-2.5">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                    Momentum Oscillators & Breakout
                  </div>

                  <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#06b6d4]" />
                      <span className="text-slate-800 dark:text-slate-200 font-medium">TTM Squeeze</span>
                      <span className="text-[10px] text-cyan-400 font-mono font-semibold">Coil & Fire</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={indicators.ttmSqueeze}
                      onChange={() => toggleIndicator("ttmSqueeze")}
                      className="rounded accent-cyan-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#a855f7]" />
                      <span className="text-slate-800 dark:text-slate-200 font-medium">Mansfield RS</span>
                      <span className="text-[10px] text-purple-400 font-mono font-semibold">Stage 2 Alpha</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={indicators.mansfieldRS}
                      onChange={() => toggleIndicator("mansfieldRS")}
                      className="rounded accent-purple-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#c084fc]" />
                      <span className="text-slate-800 dark:text-slate-200 font-medium">RSI (14)</span>
                      <span className="text-[10px] text-purple-400 font-mono">70/30 Zones</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={indicators.rsi14}
                      onChange={() => toggleIndicator("rsi14")}
                      className="rounded accent-purple-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#38bdf8]" />
                      <span className="text-slate-800 dark:text-slate-200 font-medium">Stochastic RSI</span>
                      <span className="text-[10px] text-sky-400 font-mono">%K / %D (80/20)</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={indicators.stochRSI}
                      onChange={() => toggleIndicator("stochRSI")}
                      className="rounded accent-sky-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#38bdf8]" />
                      <span className="text-slate-800 dark:text-slate-200 font-medium">MACD (12, 26, 9)</span>
                      <span className="text-[10px] text-cyan-400 font-mono">Signal + Hist</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={indicators.macd}
                      onChange={() => toggleIndicator("macd")}
                      className="rounded accent-cyan-500"
                    />
                  </label>
                </div>

                {/* Section 4: Volume & Institutional Flow */}
                <div className="space-y-1.5 border-t border-slate-200 dark:border-slate-800/80 pt-2.5">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                    Volume & Flow
                  </div>

                  <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]" />
                      <span className="text-slate-800 dark:text-slate-200 font-medium">Volume Profile (VP)</span>
                      <span className="text-[10px] text-amber-400 font-mono font-semibold">POC / VAH / VAL</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={indicators.volumeProfile}
                      onChange={() => toggleIndicator("volumeProfile")}
                      className="rounded accent-amber-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#22c55e]" />
                      <span className="text-slate-800 dark:text-slate-200 font-medium">On-Balance Volume (OBV)</span>
                      <span className="text-[10px] text-emerald-400 font-mono">Accumulation</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={indicators.obv}
                      onChange={() => toggleIndicator("obv")}
                      className="rounded accent-emerald-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#94a3b8]" />
                      <span className="text-slate-800 dark:text-slate-200 font-medium">Volume 20 SMA</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={indicators.volumeMa}
                      onChange={() => toggleIndicator("volumeMa")}
                      className="rounded accent-slate-400"
                    />
                  </label>
                </div>

                {/* Section 5: Pivots & CPR */}
                <div className="space-y-1.5 border-t border-slate-200 dark:border-slate-800/80 pt-2.5">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                    Alpha India Pivots
                  </div>
                  <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#eab308]" />
                      <span className="text-slate-800 dark:text-slate-200 font-medium">Central Pivot Range (CPR)</span>
                      <span className="text-[10px] text-slate-400">Pivot, TC, BC, R1, S1</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={indicators.cpr}
                      onChange={() => toggleIndicator("cpr")}
                      className="rounded accent-yellow-500"
                    />
                  </label>
                </div>

                {/* Section 6: AI Overlays & Targets */}
                <div className="space-y-1.5 border-t border-slate-200 dark:border-slate-800/80 pt-2.5">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                    AI Radar Overlays
                  </div>
                  <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                      <span className="text-slate-800 dark:text-slate-200 font-medium">Pattern Geometry</span>
                      <span className="text-[10px] text-slate-400">Base Top & Rising Support</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={indicators.patternLines}
                      onChange={() => toggleIndicator("patternLines")}
                      className="rounded accent-cyan-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/60 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                      <span className="text-slate-800 dark:text-slate-200 font-medium">Targets & Stop Loss</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={indicators.targetsAndStop}
                      onChange={() => toggleIndicator("targetsAndStop")}
                      className="rounded accent-emerald-500"
                    />
                  </label>
                </div>

                {/* Reset button */}
                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center text-[11px]">
                  <button
                    type="button"
                    onClick={() => setIndicators(DEFAULT_INDICATORS)}
                    className="flex items-center gap-1 text-slate-400 hover:text-white"
                  >
                    <RotateCcw size={11} />
                    <span>Reset Defaults</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowIndicatorsModal(false)}
                    className="px-3 py-1 rounded-lg bg-cyan-500 text-slate-950 font-bold hover:bg-cyan-400 transition"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Timeframe selector */}
          <div className="flex items-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/90 p-0.5 text-[10px] font-semibold shadow-xs">
            {[
              { id: "1mo", label: "1M" },
              { id: "3mo", label: "3M" },
              { id: "6mo", label: "6M" },
              { id: "1y", label: "1Y" },
              { id: "2y", label: "2Y" },
              { id: "5y", label: "5Y" },
              { id: "max", label: "MAX" },
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setPeriod(id)}
                title={`View ${label} candlestick and moving average history`}
                className={`rounded px-1.5 sm:px-2 py-0.5 transition uppercase font-mono ${
                  period === id
                    ? "bg-cyan-600 dark:bg-cyan-500 text-white dark:text-slate-950 font-bold shadow-xs"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <a
            href={tvUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1 text-xs font-semibold text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500 hover:text-white dark:hover:text-slate-950 transition shadow-xs"
            title={`Open ${symbol} live interactive chart directly on TradingView.com`}
          >
            <span>TradingView</span>
            <ExternalLink size={12} />
          </a>
        </div>
      </div>

      {/* ── Pattern Identification & Overlay Controls Sub-Bar ── */}
      {overlays.length > 0 && (
        <div className="flex flex-wrap items-center justify-between border-b border-slate-200 dark:border-slate-800/60 bg-slate-100/70 dark:bg-[#070F1E] px-4 py-2 gap-2 text-xs">
          {/* Detected Pattern Badges */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-cyan-400" />
              Identified Patterns:
            </span>
            {overlays.map((ov, idx) => (
              <button
                key={`${ov.pattern_type}-${idx}`}
                onClick={() => setSelectedOverlayIdx(idx)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-semibold transition-all ${
                  selectedOverlayIdx === idx
                    ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-sm shadow-cyan-950/40 font-bold"
                    : "bg-slate-800/50 border-slate-700/60 text-slate-400 hover:text-slate-200"
                }`}
              >
                <Layers className="w-3 h-3" />
                <span>{ov.pattern_label}</span>
                <span className="px-1.5 py-0.2 rounded-full bg-cyan-950/60 text-cyan-400 font-mono text-[10px] font-bold">
                  {ov.score}
                </span>
              </button>
            ))}
          </div>

          {/* Quick Line Toggles */}
          <div className="flex items-center gap-2 ml-auto">
            {/* Pattern Lines Toggle */}
            <button
              onClick={() => toggleIndicator("patternLines")}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-colors ${
                indicators.patternLines
                  ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-300"
                  : "bg-slate-800/40 border-slate-700/40 text-slate-500 hover:text-slate-300"
              }`}
            >
              {indicators.patternLines ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              <span>Pattern Lines</span>
            </button>

            {/* Targets & Stop Toggle */}
            <button
              onClick={() => toggleIndicator("targetsAndStop")}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-colors ${
                indicators.targetsAndStop
                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                  : "bg-slate-800/40 border-slate-700/40 text-slate-500 hover:text-slate-300"
              }`}
            >
              <Target className="w-3 h-3 text-emerald-400" />
              <span>Targets & Stop</span>
            </button>

            {/* DMA Toggle */}
            <button
              onClick={() => {
                const anyDma = indicators.dma50 || indicators.dma200;
                setIndicators((prev) => ({
                  ...prev,
                  dma50: !anyDma,
                  dma200: !anyDma,
                }));
              }}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-semibold transition-colors ${
                indicators.dma50 || indicators.dma200
                  ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                  : "bg-slate-800/40 border-slate-700/40 text-slate-500 hover:text-slate-300"
              }`}
            >
              <span>50/200 DMA</span>
            </button>

            {/* Optional Collapsible Legend Button */}
            <button
              onClick={() => setShowPatternLegend((v) => !v)}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-semibold transition-colors ${
                showPatternLegend
                  ? "bg-slate-700 text-white border-slate-600"
                  : "bg-slate-800/40 border-slate-700/40 text-slate-400 hover:text-slate-300"
              }`}
              title="Toggle color legend for pattern lines"
            >
              <span>ℹ️ Legend</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Pattern Geometry Legend Bar (Collapsible to save vertical space) ── */}
      {showPatternLegend && indicators.patternLines && activeOverlay && (
        <div className="flex flex-wrap items-center gap-4 bg-slate-950/80 border-b border-slate-800/40 px-4 py-1.5 text-[10px] text-slate-400 font-mono transition-all">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-[#06b6d4] inline-block" />
            <span className="text-cyan-300 font-semibold">Resistance / Base Top</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-[#10b981] inline-block" />
            <span className="text-emerald-300 font-semibold">Pivot Buy Point / Rising Support</span>
          </div>
          {indicators.targetsAndStop && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-[#ef4444] border-b border-dashed border-[#ef4444] inline-block" />
                <span className="text-rose-300 font-semibold">Stop Loss Invalidation</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-[#10b981] border-b border-dotted border-[#10b981] inline-block" />
                <span className="text-emerald-400 font-semibold">Target 1 (+10%) & Target 2 (+20%)</span>
              </div>
            </>
          )}
          {alertLines && alertLines.length > 0 && (
            <div className="flex items-center gap-1.5 ml-auto">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse inline-block" />
              <span className="text-amber-300 font-semibold">🔔 {alertLines.length} Alert{alertLines.length > 1 ? "s" : ""} Armed</span>
            </div>
          )}
        </div>
      )}

      {/* Chart Canvas */}
      <div className="relative w-full flex-1 min-h-0 h-full">
        {loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-white/80 dark:bg-[#050B14]/80 backdrop-blur-xs">
            <Activity className="h-6 w-6 animate-spin text-cyan-600 dark:text-cyan-400" />
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Loading {symbol} Candlesticks & Indicators...
            </span>
          </div>
        )}

        {!loading && fetchError && (!chartDataRef.current || chartDataRef.current.candles.length === 0) && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 p-6 text-center bg-white/95 dark:bg-[#050B14]/95 backdrop-blur-xs">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-800 dark:text-slate-100">
                Candle Data Temporarily Unavailable for {symbol}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
                Market data feed did not return historical candles. You can retry the fetch or open directly on TradingView.
              </div>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                onClick={() => setRetryTrigger((v) => v + 1)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500 text-slate-950 font-bold text-xs hover:bg-cyan-400 transition cursor-pointer"
              >
                <RotateCcw size={12} />
                <span>Retry Fetch</span>
              </button>
              <a
                href={tvUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:border-cyan-500 transition cursor-pointer"
              >
                <span>TradingView</span>
                <ExternalLink size={12} />
              </a>
            </div>
          </div>
        )}

        <div
          ref={chartContainerRef}
          className="w-full h-full"
          style={{ height: typeof height === "number" ? `${height}px` : (height || "100%") }}
        />

        {/* Visual Volume Profile Horizontal Distribution (Clean Right Edge Overlay) */}
        {indicators.volumeProfile && volumeProfileData && volumeProfileData.bins.length > 0 && (
          <div className="absolute right-16 top-6 bottom-10 w-24 sm:w-32 z-10 pointer-events-none flex flex-col-reverse justify-between opacity-60 hover:opacity-85 transition select-none">
            {volumeProfileData.bins.map((bin, idx) => (
              <div key={idx} className="flex items-center justify-end h-full gap-1">
                <div
                  className={`h-[75%] rounded-l-xs transition-all ${
                    bin.isPOC
                      ? "bg-amber-400/90 shadow-xs shadow-amber-400/50"
                      : bin.inValueArea
                      ? "bg-cyan-500/40 border-l border-cyan-400/50"
                      : "bg-slate-600/20"
                  }`}
                  style={{ width: `${Math.max(4, bin.volumePct * 100)}%` }}
                  title={`Price: ₹${bin.price} | Volume: ${bin.totalVolume.toLocaleString()}`}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(TradingViewChartComponent);

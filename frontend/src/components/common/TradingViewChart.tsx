"use client";

import { useEffect, useRef, useState, memo } from "react";
import {
  createChart,
  ColorType,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  CrosshairMode,
  IChartApi,
  ISeriesApi,
} from "lightweight-charts";
import { fetchTechnoFundaCandles, type CandleData, type LineDataPoint } from "@/lib/technoFundaApi";
import { Activity, ExternalLink, RefreshCw } from "lucide-react";

interface TradingViewChartProps {
  symbol: string;
  exchange?: string;
  height?: number | string;
  pivotReference?: number;
  scenarioTrigger?: number;
  downsideReference?: number;
  target1?: number;
}

function TradingViewChartComponent({
  symbol,
  exchange = "NSE",
  height = 540,
  pivotReference,
  scenarioTrigger,
  downsideReference,
  target1,
}: TradingViewChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const [period, setPeriod] = useState<string>("6mo");
  const [loading, setLoading] = useState(true);
  const [lastCandle, setLastCandle] = useState<CandleData | null>(null);
  const [lastDma50, setLastDma50] = useState<number | null>(null);
  const [lastDma200, setLastDma200] = useState<number | null>(null);

  useEffect(() => {
    let isCancelled = false;
    setLoading(true);

    fetchTechnoFundaCandles(symbol, period)
      .then((data) => {
        if (isCancelled || !chartContainerRef.current) return;

        const container = chartContainerRef.current;
        // Clear container
        container.innerHTML = "";

        if (data.candles.length === 0) {
          setLoading(false);
          return;
        }

        const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");

        const chart = createChart(container, {
          width: container.clientWidth,
          height: typeof height === "number" ? height : 520,
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

        // Volume Series (at the bottom)
        const volumeSeries = chart.addSeries(HistogramSeries, {
          priceFormat: { type: "volume" },
          priceScaleId: "",
        });

        volumeSeries.priceScale().applyOptions({
          scaleMargins: {
            top: 0.8,
            bottom: 0,
          },
        });

        const volumeData = data.candles.map((c) => ({
          time: c.time as any,
          value: c.volume,
          color: c.close >= c.open ? "rgba(16, 185, 129, 0.35)" : "rgba(239, 68, 68, 0.35)",
        }));
        volumeSeries.setData(volumeData);

        // Candlestick Series
        const candleSeries = chart.addSeries(CandlestickSeries, {
          upColor: "#10b981",
          downColor: "#ef4444",
          borderVisible: false,
          wickUpColor: "#10b981",
          wickDownColor: "#ef4444",
        });

        const formattedCandles = data.candles.map((c) => ({
          time: c.time as any,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }));
        candleSeries.setData(formattedCandles);

        // 50 DMA Line Series
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

        // 200 DMA Line Series
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

        // Add Scenario Blueprint Price Lines if available
        if (scenarioTrigger) {
          candleSeries.createPriceLine({
            price: scenarioTrigger,
            color: "#06b6d4",
            lineWidth: 1,
            lineStyle: 2, // Dashed
            axisLabelVisible: true,
            title: "TRIGGER",
          });
        }

        if (pivotReference) {
          candleSeries.createPriceLine({
            price: pivotReference,
            color: "#f59e0b",
            lineWidth: 1,
            lineStyle: 0, // Solid
            axisLabelVisible: true,
            title: "PIVOT",
          });
        }

        if (downsideReference) {
          candleSeries.createPriceLine({
            price: downsideReference,
            color: "#ef4444",
            lineWidth: 1,
            lineStyle: 2, // Dashed
            axisLabelVisible: true,
            title: "STOP LOSS",
          });
        }

        if (target1) {
          candleSeries.createPriceLine({
            price: target1,
            color: "#10b981",
            lineWidth: 1,
            lineStyle: 1, // Dotted
            axisLabelVisible: true,
            title: "TARGET 1",
          });
        }

        chart.timeScale().fitContent();

        const latest = data.candles[data.candles.length - 1];
        setLastCandle(latest || null);
        setLoading(false);

        // Resize observer
        const handleResize = () => {
          if (chartContainerRef.current && chartRef.current) {
            chartRef.current.applyOptions({
              width: chartContainerRef.current.clientWidth,
            });
          }
        };

        window.addEventListener("resize", handleResize);

        return () => {
          window.removeEventListener("resize", handleResize);
          chart.remove();
        };
      })
      .catch((err) => {
        if (!isCancelled) {
          console.error("Failed to render chart:", err);
          setLoading(false);
        }
      });

    return () => {
      isCancelled = true;
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
      }
    };
  }, [symbol, period, height, pivotReference, scenarioTrigger, downsideReference, target1]);

  const tvUrl = `https://in.tradingview.com/symbols/${exchange}-${symbol.toUpperCase()}/`;

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#050B14] shadow-2xl">
      {/* Top Header / Legend Bar */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-[#081225] px-4 py-2.5 gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold tracking-wider text-slate-900 dark:text-white">
              {exchange}:{symbol.toUpperCase()}
            </span>
          </div>

          {/* Quick Real-Time / Last Close Metrics */}
          {lastCandle && (
            <div className="flex items-center gap-3 font-mono text-xs text-slate-600 dark:text-slate-300">
              <span>
                C: <strong className="text-slate-900 dark:text-white">₹{lastCandle.close}</strong>
              </span>
              <span className="text-slate-500 dark:text-slate-400">
                H: ₹{lastCandle.high} L: ₹{lastCandle.low}
              </span>
              {lastDma50 && (
                <span className="hidden sm:inline text-cyan-700 dark:text-cyan-400 font-medium">
                  50 DMA: ₹{lastDma50}
                </span>
              )}
              {lastDma200 && (
                <span className="hidden md:inline text-amber-700 dark:text-amber-400 font-medium">
                  200 DMA: ₹{lastDma200}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Timeframe selector & TradingView External Link */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/90 p-0.5 text-[11px] font-semibold shadow-xs">
            <button
              onClick={() => setPeriod("3mo")}
              className={`rounded px-2 py-0.5 transition ${
                period === "3mo" ? "bg-cyan-600 dark:bg-cyan-500 text-white dark:text-slate-950 font-bold" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              3M
            </button>
            <button
              onClick={() => setPeriod("6mo")}
              className={`rounded px-2 py-0.5 transition ${
                period === "6mo" ? "bg-cyan-600 dark:bg-cyan-500 text-white dark:text-slate-950 font-bold" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              6M
            </button>
            <button
              onClick={() => setPeriod("1y")}
              className={`rounded px-2 py-0.5 transition ${
                period === "1y" ? "bg-cyan-600 dark:bg-cyan-500 text-white dark:text-slate-950 font-bold" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              1Y
            </button>
          </div>

          {/* Direct TradingView Link — Opens specific company chart directly on TradingView */}
          <a
            href={tvUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1 text-xs font-semibold text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500 hover:text-white dark:hover:text-slate-950 transition shadow-xs"
            title={`Open ${symbol} live interactive chart directly on TradingView.com`}
          >
            <span>TradingView.com</span>
            <ExternalLink size={12} />
          </a>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="relative w-full">
        {loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-white/80 dark:bg-[#050B14]/80 backdrop-blur-xs">
            <Activity className="h-6 w-6 animate-spin text-cyan-600 dark:text-cyan-400" />
            <span className="text-xs text-slate-500 dark:text-slate-400">Loading {symbol} Candlesticks & Technicals...</span>
          </div>
        )}
        <div
          ref={chartContainerRef}
          className="w-full"
          style={{ height: typeof height === "number" ? `${height}px` : height }}
        />
      </div>
    </div>
  );
}

export default memo(TradingViewChartComponent);

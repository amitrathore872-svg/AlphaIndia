"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  createChart,
  ColorType,
  CandlestickSeries,
  AreaSeries,
  LineSeries,
  CrosshairMode,
  IChartApi,
  ISeriesApi,
} from "lightweight-charts";
import {
  X,
  TrendingUp,
  TrendingDown,
  Calendar,
  Layers,
  Sparkles,
  Maximize2,
  Minimize2,
  RefreshCw,
  Sliders,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  fetchIndexChart,
  IndexPerformance,
  IndexChartResponse,
  CandlePoint,
  LinePoint,
} from "@/lib/marketIndicesApi";

interface IndexChartModalProps {
  index: IndexPerformance | null;
  allIndices?: IndexPerformance[];
  onClose: () => void;
  onSelectIndex?: (index: IndexPerformance) => void;
}

export default function IndexChartModal({
  index,
  allIndices = [],
  onClose,
  onSelectIndex,
}: IndexChartModalProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<any> | null>(null);
  const dma50SeriesRef = useRef<ISeriesApi<any> | null>(null);
  const dma200SeriesRef = useRef<ISeriesApi<any> | null>(null);

  const [period, setPeriod] = useState<string>("1Y");
  const [chartType, setChartType] = useState<"candlestick" | "area">("candlestick");
  const [showDma50, setShowDma50] = useState<boolean>(true);
  const [showDma200, setShowDma200] = useState<boolean>(true);
  const [isFullScreen, setIsFullScreen] = useState<boolean>(true);
  const [showSeasonalityBars, setShowSeasonalityBars] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<IndexChartResponse | null>(null);

  // Hovered crosshair state
  const [hoveredPoint, setHoveredPoint] = useState<{
    time: string;
    open?: number;
    high?: number;
    low?: number;
    close?: number;
    changePct?: number;
  } | null>(null);

  // Current index navigation in list
  const currentIndexIndex = useMemo(() => {
    if (!index || !allIndices.length) return -1;
    return allIndices.findIndex((i) => i.symbol === index.symbol);
  }, [index, allIndices]);

  const hasPrev = currentIndexIndex > 0;
  const hasNext = currentIndexIndex >= 0 && currentIndexIndex < allIndices.length - 1;

  const handlePrev = () => {
    if (hasPrev && onSelectIndex) {
      onSelectIndex(allIndices[currentIndexIndex - 1]);
    }
  };

  const handleNext = () => {
    if (hasNext && onSelectIndex) {
      onSelectIndex(allIndices[currentIndexIndex + 1]);
    }
  };

  // Keyboard navigation & full screen shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "f" || e.key === "F") {
        setIsFullScreen((prev) => !prev);
      } else if (e.key === "ArrowLeft") {
        handlePrev();
      } else if (e.key === "ArrowRight") {
        handleNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasPrev, hasNext, currentIndexIndex, allIndices, onClose]);

  // Fetch Chart Data
  useEffect(() => {
    if (!index) return;
    let isMounted = true;
    setIsLoading(true);
    setError(null);

    fetchIndexChart(index.symbol, period)
      .then((data) => {
        if (!isMounted) return;
        if (data.status === "error") {
          setError(data.description || "Chart data not available for this index.");
        } else {
          setChartData(data);
          if (data.candles && data.candles.length > 0) {
            const last = data.candles[data.candles.length - 1];
            setHoveredPoint({
              time: last.time,
              open: last.open,
              high: last.high,
              low: last.low,
              close: last.close,
            });
          }
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || "Failed to load index chart");
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [index, period]);

  // Render TradingView Lightweight Chart
  useEffect(() => {
    if (!chartContainerRef.current || !chartData || isLoading) return;

    const container = chartContainerRef.current;
    container.innerHTML = "";

    const chartHeight = container.clientHeight > 100 ? container.clientHeight : (isFullScreen ? 550 : 420);

    const chart = createChart(container, {
      width: container.clientWidth || 800,
      height: chartHeight,
      layout: {
        background: { type: ColorType.Solid, color: "#080c18" },
        textColor: "#94a3b8",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(148, 163, 184, 0.08)" },
        horzLines: { color: "rgba(148, 163, 184, 0.08)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: "rgba(34, 211, 238, 0.5)",
          width: 1,
          style: 3,
        },
        horzLine: {
          color: "rgba(34, 211, 238, 0.5)",
          width: 1,
          style: 3,
        },
      },
      rightPriceScale: {
        borderColor: "rgba(148, 163, 184, 0.15)",
        scaleMargins: { top: 0.1, bottom: 0.1 },
        autoScale: true,
      },
      timeScale: {
        borderColor: "rgba(148, 163, 184, 0.15)",
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    // Series
    if (chartType === "candlestick") {
      const candlestickSeries = chart.addSeries(CandlestickSeries, {
        upColor: "#10b981",
        downColor: "#f43f5e",
        borderVisible: false,
        wickUpColor: "#10b981",
        wickDownColor: "#f43f5e",
      });
      candlestickSeries.setData(chartData.candles);
      seriesRef.current = candlestickSeries;
    } else {
      const areaSeries = chart.addSeries(AreaSeries, {
        topColor: "rgba(6, 182, 212, 0.4)",
        bottomColor: "rgba(6, 182, 212, 0.01)",
        lineColor: "#06b6d4",
        lineWidth: 2,
      });
      areaSeries.setData(chartData.line_data);
      seriesRef.current = areaSeries;
    }

    // 50 DMA
    if (showDma50 && chartData.dma_50 && chartData.dma_50.length > 0) {
      const dma50Series = chart.addSeries(LineSeries, {
        color: "#f59e0b",
        lineWidth: 1,
        title: "50 DMA",
        crosshairMarkerVisible: false,
      });
      dma50Series.setData(chartData.dma_50);
      dma50SeriesRef.current = dma50Series;
    }

    // 200 DMA
    if (showDma200 && chartData.dma_200 && chartData.dma_200.length > 0) {
      const dma200Series = chart.addSeries(LineSeries, {
        color: "#a855f7",
        lineWidth: 1,
        title: "200 DMA",
        crosshairMarkerVisible: false,
      });
      dma200Series.setData(chartData.dma_200);
      dma200SeriesRef.current = dma200Series;
    }

    // Crosshair move subscription
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData) return;

      const seriesData = seriesRef.current ? param.seriesData.get(seriesRef.current) : null;
      if (seriesData) {
        if ("open" in seriesData && "close" in seriesData) {
          const cData = seriesData as CandlePoint;
          const chg = ((cData.close - cData.open) / Math.max(cData.open, 1e-6)) * 100;
          setHoveredPoint({
            time: String(param.time),
            open: cData.open,
            high: cData.high,
            low: cData.low,
            close: cData.close,
            changePct: Math.round(chg * 100) / 100,
          });
        } else if ("value" in seriesData) {
          setHoveredPoint({
            time: String(param.time),
            close: (seriesData as LinePoint).value,
          });
        }
      }
    });

    chart.timeScale().fitContent();

    // Auto-Resize Observer for full screen & window resizing
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === container && chartRef.current) {
          const width = entry.contentRect.width;
          const height = entry.contentRect.height;
          if (width > 0 && height > 0) {
            chartRef.current.applyOptions({ width, height });
          }
        }
      }
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [chartData, chartType, showDma50, showDma200, isFullScreen, isLoading]);


  if (!index) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center ${
        isFullScreen ? "p-0" : "p-2 sm:p-4"
      } bg-black/90 backdrop-blur-md animate-in fade-in duration-150`}
    >
      <div
        className={`bg-slate-950 border ${
          isFullScreen
            ? "border-0 rounded-none w-screen h-screen max-w-none max-h-none"
            : "border-slate-700/80 rounded-2xl w-full max-w-6xl max-h-[96vh]"
        } shadow-2xl flex flex-col overflow-hidden`}
      >
        {/* ── MODAL HEADER ─────────────────────────────────────────── */}
        <div className="p-3 sm:px-5 sm:py-3.5 border-b border-slate-800 bg-slate-950/90 flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight truncate">
                {index.name}
              </h2>
              <span className="px-2 py-0.5 rounded text-xs font-mono bg-cyan-950 text-cyan-300 border border-cyan-800">
                {index.exchange}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-xs font-mono font-medium ${
                  index.category === "BROAD"
                    ? "bg-blue-950 text-blue-300 border border-blue-800/40"
                    : index.category === "SECTORAL"
                    ? "bg-purple-950 text-purple-300 border border-purple-800/40"
                    : "bg-amber-950 text-amber-300 border border-amber-800/40"
                }`}
              >
                {index.category}
              </span>
              <span className="text-xs text-slate-400 font-mono hidden sm:inline">
                • {index.streak}
              </span>
            </div>
          </div>

          {/* Quick Prev / Next, Fullscreen & Close */}
          <div className="flex items-center gap-2">
            {allIndices.length > 0 && (
              <div className="flex items-center bg-slate-900 border border-slate-700/80 rounded-lg p-0.5">
                <button
                  onClick={handlePrev}
                  disabled={!hasPrev}
                  className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
                  title="Previous Index (←)"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2 text-[11px] font-mono text-slate-300">
                  {currentIndexIndex + 1}/{allIndices.length}
                </span>
                <button
                  onClick={handleNext}
                  disabled={!hasNext}
                  className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400 transition-colors"
                  title="Next Index (→)"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Full Screen Toggle Button */}
            <button
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="p-1.5 rounded-lg text-slate-300 hover:text-cyan-300 bg-slate-900 border border-slate-700/80 hover:border-cyan-500/50 transition-colors"
              title={isFullScreen ? "Exit Full Screen (F)" : "Full Screen Chart (F)"}
            >
              {isFullScreen ? (
                <Minimize2 className="w-4 h-4 text-cyan-400" />
              ) : (
                <Maximize2 className="w-4 h-4 text-slate-300" />
              )}
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-slate-900 border border-slate-700/80 hover:bg-slate-800 transition-colors"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── METRIC RIBBON ────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 px-3 py-2 sm:px-5 bg-slate-950/60 border-b border-slate-800/80 font-mono text-xs">
          <div>
            <span className="text-[10px] text-slate-500 uppercase">Live Level</span>
            <div className="text-sm sm:text-base font-bold text-white">
              ₹{index.cmp.toLocaleString("en-IN")}
            </div>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase">1D Change</span>
            <div
              className={`font-semibold flex items-center gap-0.5 ${
                index.change_pct_1d >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {index.change_pct_1d >= 0 ? "▲" : "▼"}{" "}
              {Math.abs(index.change_pct_1d).toFixed(2)}%
            </div>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase">12M Seasonality</span>
            <div className="text-cyan-300 font-semibold">
              {index.win_rate_pct.toFixed(0)}% ({index.green_count}G / {index.red_count}R)
            </div>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase">1-Year Return</span>
            <div
              className={`font-semibold ${
                index.return_12m >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {index.return_12m > 0 ? "+" : ""}
              {index.return_12m.toFixed(1)}%
            </div>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase">52W Range</span>
            <div className="text-slate-300 text-[11px] truncate">
              ₹{index.year_low.toLocaleString("en-IN")} - ₹{index.year_high.toLocaleString("en-IN")}
            </div>
          </div>
          <div>
            <span className="text-[10px] text-slate-500 uppercase">Off Peak High</span>
            <div className="text-rose-400 font-semibold">
              {index.pct_off_high.toFixed(1)}%
            </div>
          </div>
        </div>

        {/* ── CHART TOOLBAR ────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 sm:px-5 py-2 bg-slate-900/80 border-b border-slate-800">
          {/* Timeframe Selectors */}
          <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
            {["1M", "3M", "6M", "1Y"].map((tf) => (
              <button
                key={tf}
                onClick={() => setPeriod(tf)}
                className={`px-3 py-1 rounded text-xs font-mono font-medium transition-all ${
                  period === tf
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          {/* Chart Type, DMA & Seasonality Toggles */}
          <div className="flex items-center gap-2">
            {/* Candlestick vs Area */}
            <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800">
              <button
                onClick={() => setChartType("candlestick")}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                  chartType === "candlestick"
                    ? "bg-slate-800 text-cyan-300 border border-cyan-500/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Candles
              </button>
              <button
                onClick={() => setChartType("area")}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                  chartType === "area"
                    ? "bg-slate-800 text-cyan-300 border border-cyan-500/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Area
              </button>
            </div>

            {/* 50 DMA Toggle */}
            <button
              onClick={() => setShowDma50(!showDma50)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono border transition-all ${
                showDma50
                  ? "bg-amber-950/50 text-amber-300 border-amber-600/50"
                  : "bg-slate-950 text-slate-500 border-slate-800"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              <span>50 DMA</span>
            </button>

            {/* 200 DMA Toggle */}
            <button
              onClick={() => setShowDma200(!showDma200)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono border transition-all ${
                showDma200
                  ? "bg-purple-950/50 text-purple-300 border-purple-600/50"
                  : "bg-slate-950 text-slate-500 border-slate-800"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-purple-400"></span>
              <span>200 DMA</span>
            </button>

            {/* Seasonality Bars Toggle */}
            <button
              onClick={() => setShowSeasonalityBars(!showSeasonalityBars)}
              className={`hidden md:flex items-center gap-1 px-2 py-1 rounded text-xs font-mono border transition-all ${
                showSeasonalityBars
                  ? "bg-slate-800 text-cyan-300 border-cyan-500/30"
                  : "bg-slate-950 text-slate-500 border-slate-800"
              }`}
              title="Toggle Monthly Seasonality Ribbon"
            >
              <span>12M Bars</span>
            </button>
          </div>
        </div>

        {/* ── CHART CANVAS ─────────────────────────────────────────── */}
        <div className="relative p-2 sm:p-4 bg-slate-950 flex-1 w-full flex flex-col min-h-0 overflow-hidden">
          {/* Floating Crosshair HUD */}
          {hoveredPoint && (
            <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-2 sm:gap-3 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-lg font-mono text-[11px] sm:text-xs shadow-xl backdrop-blur-md">
              <span className="text-slate-400">{hoveredPoint.time}</span>
              {hoveredPoint.open !== undefined && (
                <>
                  <span className="text-slate-300">
                    O: <span className="text-white font-semibold">₹{hoveredPoint.open}</span>
                  </span>
                  <span className="text-slate-300">
                    H: <span className="text-white font-semibold">₹{hoveredPoint.high}</span>
                  </span>
                  <span className="text-slate-300">
                    L: <span className="text-white font-semibold">₹{hoveredPoint.low}</span>
                  </span>
                </>
              )}
              {hoveredPoint.close !== undefined && (
                <span className="text-slate-300">
                  C: <span className="text-cyan-300 font-bold">₹{hoveredPoint.close}</span>
                </span>
              )}
              {hoveredPoint.changePct !== undefined && (
                <span
                  className={hoveredPoint.changePct >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}
                >
                  {hoveredPoint.changePct > 0 ? "+" : ""}
                  {hoveredPoint.changePct}%
                </span>
              )}
            </div>
          )}

          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center space-y-2">
              <RefreshCw className="w-7 h-7 text-cyan-400 animate-spin" />
              <span className="text-xs text-slate-400 font-mono">
                Rendering {index.name} historical chart...
              </span>
            </div>
          ) : error ? (
            <div className="flex-1 flex flex-col items-center justify-center space-y-2 text-rose-400 font-mono text-xs">
              <span>{error}</span>
            </div>
          ) : (
            <div ref={chartContainerRef} className="w-full h-full flex-1" />
          )}
        </div>

        {/* ── 12-MONTH RETURN SEQUENCE BELOW CHART ─────────────────── */}
        {showSeasonalityBars && (
          <div className="p-3 sm:px-5 sm:py-3 border-t border-slate-800 bg-slate-900/70 space-y-2 shrink-0">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-200 font-semibold flex items-center gap-1.5 text-[11px] sm:text-xs">
                <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                <span>12-MONTH HISTORICAL RETURN BARS (GREEN / RED)</span>
              </span>
              <span className="text-[10px] sm:text-[11px] text-slate-400">
                Green: <strong className="text-emerald-400">{index.green_count}</strong> • Red:{" "}
                <strong className="text-rose-400">{index.red_count}</strong> • Win Rate:{" "}
                <strong className="text-cyan-300">{index.win_rate_pct.toFixed(0)}%</strong>
              </span>
            </div>

            {/* Month pill grid */}
            <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-1 sm:gap-1.5">
              {index.months.map((m) => {
                const isGreen = m.is_green;
                return (
                  <div
                    key={m.month_index}
                    className={`p-1.5 rounded-lg border text-center font-mono text-xs transition-transform hover:scale-105 ${
                      isGreen
                        ? "bg-emerald-950/70 text-emerald-300 border-emerald-700/60 shadow-xs"
                        : "bg-rose-950/70 text-rose-300 border-rose-700/60 shadow-xs"
                    }`}
                  >
                    <div className="text-[9px] sm:text-[10px] text-slate-400">{m.month_short}</div>
                    <div className="font-bold text-[11px] sm:text-xs mt-0.5">
                      {m.return_pct > 0 ? "+" : ""}
                      {m.return_pct.toFixed(1)}%
                    </div>
                    <div className="text-[8px] sm:text-[9px] opacity-75 mt-0.5">
                      {isGreen ? "GREEN" : "RED"}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


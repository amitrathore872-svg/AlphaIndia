"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  createChart,
  ColorType,
  BaselineSeries,
  LineSeries,
  LineStyle,
  CrosshairMode,
  IChartApi,
  ISeriesApi,
} from "lightweight-charts";
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  Layers,
  Sparkles,
  Maximize2,
  Minimize2,
  RefreshCw,
  Sliders,
  ShieldCheck,
  AlertTriangle,
  Info,
  CheckCircle2,
  BarChart2,
  Activity,
  Layers3,
} from "lucide-react";
import { BreadthPoint, BreadthReportData, MultiDmaPoint } from "@/lib/reportsApi";

interface BreadthDmaChartProps {
  data: BreadthReportData;
  selectedDma: number; // 20, 50, 200
  timeframe: string;
  universe: string;
  onDmaChange: (dma: number) => void;
  onTimeframeChange: (tf: string) => void;
  onUniverseChange: (u: string) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  multiDmaSeries?: MultiDmaPoint[];
}

export default function Breadth20DmaChart({
  data,
  selectedDma,
  timeframe,
  universe,
  onDmaChange,
  onTimeframeChange,
  onUniverseChange,
  onRefresh,
  isRefreshing,
  multiDmaSeries = [],
}: BreadthDmaChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<any> | null>(null);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [displayMode, setDisplayMode] = useState<"percentage" | "count">("percentage");
  const [isMultiOverlay, setIsMultiOverlay] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<BreadthPoint | null>(null);
  const [hoveredMulti, setHoveredMulti] = useState<MultiDmaPoint | null>(null);

  const seriesData = data.series || [];
  const metrics = data.current_metrics;
  const isGreenNow = metrics?.current_zone === "GREEN";

  // Base value for baseline series
  const baseValue = useMemo(() => {
    if (displayMode === "percentage" || isMultiOverlay) {
      return 50.0;
    }
    const total = metrics?.total_universe_count || 2835;
    return Math.round(total * 0.5);
  }, [displayMode, metrics, isMultiOverlay]);

  // Single DMA formatted data
  const chartFormattedData = useMemo(() => {
    if (!seriesData || seriesData.length === 0) return [];

    return seriesData
      .map((item) => {
        const val =
          displayMode === "percentage"
            ? item.pct_above_dma ?? item.pct_above_20dma ?? 0
            : item.above_dma ?? item.above_20dma ?? 0;
        return {
          time: item.date,
          value: Number(val),
        };
      })
      .sort((a, b) => (a.time > b.time ? 1 : -1));
  }, [seriesData, displayMode]);

  // Initialize and update Lightweight Chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
      seriesRef.current = null;
    }

    const container = chartContainerRef.current;
    const width = container.clientWidth || 800;
    const height = isFullscreen ? window.innerHeight - 200 : 490;

    const chart = createChart(container, {
      width,
      height,
      layout: {
        background: { type: ColorType.Solid, color: "#060A12" },
        textColor: "#94a3b8",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "rgba(30, 41, 59, 0.45)" },
        horzLines: { color: "rgba(30, 41, 59, 0.45)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: {
          color: "#38bdf8",
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: "#0284c7",
        },
        horzLine: {
          color: "#38bdf8",
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: "#0284c7",
        },
      },
      timeScale: {
        borderColor: "#1e293b",
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: "#1e293b",
        scaleMargins: {
          top: 0.08,
          bottom: 0.08,
        },
      },
    });

    chartRef.current = chart;

    if (!isMultiOverlay) {
      // Single DMA Mode: BaselineSeries with Green above 50% and Red below 50%
      const baselineSeries = chart.addSeries(BaselineSeries, {
        baseValue: { type: "price", price: baseValue },
        // Green Zone (above 50%)
        topLineColor: "#10b981",
        topFillColor1: "rgba(16, 185, 129, 0.45)",
        topFillColor2: "rgba(16, 185, 129, 0.04)",
        // Red Zone (below 50%)
        bottomLineColor: "#f43f5e",
        bottomFillColor1: "rgba(244, 63, 94, 0.04)",
        bottomFillColor2: "rgba(244, 63, 94, 0.45)",
        lineWidth: 2,
        priceFormat: {
          type: displayMode === "percentage" ? "percent" : "price",
          minMove: displayMode === "percentage" ? 0.01 : 1,
        },
      });

      seriesRef.current = baselineSeries;

      if (chartFormattedData.length > 0) {
        baselineSeries.setData(chartFormattedData);
        chart.timeScale().fitContent();
      }

      // 50% Horizontal Reference Line
      baselineSeries.createPriceLine({
        price: baseValue,
        color: "#f59e0b",
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title:
          displayMode === "percentage"
            ? `50% ${selectedDma} DMA NEUTRAL EQUILIBRIUM`
            : `50% EQUILIBRIUM (${baseValue} STOCKS)`,
      });

      chart.subscribeCrosshairMove((param) => {
        if (!param.time || param.point === undefined || !param.seriesData || !seriesRef.current) {
          setHoveredPoint(null);
          return;
        }

        const dateStr = String(param.time);
        const match = seriesData.find((p) => p.date === dateStr);
        if (match) {
          setHoveredPoint(match);
        } else {
          const val = param.seriesData.get(seriesRef.current) as any;
          if (val && val.value !== undefined) {
            setHoveredPoint({
              date: dateStr,
              pct_above_dma: Number(val.value),
              pct_above_20dma: Number(val.value),
              above_dma: Math.round(Number(val.value)),
              above_20dma: Math.round(Number(val.value)),
              total_stocks: metrics?.total_universe_count || 2835,
              below_dma: 0,
              below_20dma: 0,
              zone: Number(val.value) >= 50 ? "GREEN" : "RED",
              change_1d: 0,
            });
          }
        }
      });
    } else {
      // Multi-DMA Overlay Mode: 20 DMA (Cyan), 50 DMA (Amber), 200 DMA (Emerald)
      const line20 = chart.addSeries(LineSeries, {
        color: "#06b6d4", // Cyan
        lineWidth: 2,
        title: "20 DMA Breadth",
        priceFormat: { type: "percent", minMove: 0.01 },
      });

      const line50 = chart.addSeries(LineSeries, {
        color: "#f59e0b", // Amber
        lineWidth: 2,
        title: "50 DMA Breadth",
        priceFormat: { type: "percent", minMove: 0.01 },
      });

      const line200 = chart.addSeries(LineSeries, {
        color: "#10b981", // Emerald
        lineWidth: 2,
        title: "200 DMA Breadth",
        priceFormat: { type: "percent", minMove: 0.01 },
      });

      if (multiDmaSeries.length > 0) {
        line20.setData(
          multiDmaSeries.map((p) => ({ time: p.date, value: p.pct_above_20dma }))
        );
        line50.setData(
          multiDmaSeries.map((p) => ({ time: p.date, value: p.pct_above_50dma }))
        );
        line200.setData(
          multiDmaSeries.map((p) => ({ time: p.date, value: p.pct_above_200dma }))
        );
        chart.timeScale().fitContent();
      }

      // Prominent 50% Threshold Reference Line
      line20.createPriceLine({
        price: 50.0,
        color: "#e2e8f0",
        lineWidth: 2,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: "50% BULL/BEAR REGIME LINE",
      });

      chart.subscribeCrosshairMove((param) => {
        if (!param.time || param.point === undefined) {
          setHoveredMulti(null);
          return;
        }
        const dateStr = String(param.time);
        const match = multiDmaSeries.find((p) => p.date === dateStr);
        setHoveredMulti(match || null);
      });
    }

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: isFullscreen ? window.innerHeight - 200 : 490,
        });
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = null;
      }
    };
  }, [
    chartFormattedData,
    baseValue,
    isFullscreen,
    displayMode,
    seriesData,
    metrics,
    selectedDma,
    isMultiOverlay,
    multiDmaSeries,
  ]);

  const activePoint =
    hoveredPoint || (seriesData.length > 0 ? seriesData[seriesData.length - 1] : null);
  const activePct =
    activePoint?.pct_above_dma ?? activePoint?.pct_above_20dma ?? metrics?.current_pct_above_dma ?? 0;
  const activeIsGreen = activePct >= 50.0;

  const dmaLabel =
    selectedDma === 20
      ? "20 DMA (Short-Term Tactical)"
      : selectedDma === 50
      ? "50 DMA (Intermediate Trend)"
      : "200 DMA (Stage-2 Macro Health)";

  return (
    <div
      className={`rounded-2xl border border-slate-800/80 bg-[#070C16] shadow-2xl transition-all duration-300 ${
        isFullscreen ? "fixed inset-0 z-50 overflow-y-auto p-6 bg-[#040810]" : "p-6"
      }`}
    >
      {/* Header Bar */}
      <div className="flex flex-col gap-4 border-b border-slate-800/70 pb-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-xl border ${
              isGreenNow
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border-rose-500/30 bg-rose-500/10 text-rose-400"
            }`}
          >
            <Activity className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-bold tracking-tight text-white">
                {isMultiOverlay ? "Multi-DMA Breadth Comparison" : `% Companies Above ${selectedDma} DMA`}
              </h2>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  isGreenNow
                    ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                    : "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    isGreenNow ? "bg-emerald-400 animate-pulse" : "bg-rose-400 animate-pulse"
                  }`}
                />
                {isGreenNow ? "GREEN ZONE (BULLISH)" : "RED ZONE (BEARISH)"}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-400">
              {dmaLabel} &bull; 50% Threshold Baseline &bull; {data.universe_name} (
              {metrics?.total_universe_count || 0} Stocks)
            </p>
          </div>
        </div>

        {/* DMA Period Selector Pills: 20 DMA, 50 DMA, 200 DMA, Multi-DMA */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-slate-800 bg-[#090F1E] p-1 text-xs">
            {[20, 50, 200].map((d) => (
              <button
                key={d}
                onClick={() => {
                  setIsMultiOverlay(false);
                  onDmaChange(d);
                }}
                className={`rounded-lg px-3 py-1.5 font-bold transition ${
                  selectedDma === d && !isMultiOverlay
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-[0_0_10px_rgba(6,182,212,0.3)]"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {d} DMA
              </button>
            ))}

            <button
              onClick={() => setIsMultiOverlay(true)}
              className={`rounded-lg px-3 py-1.5 font-bold transition flex items-center gap-1 ${
                isMultiOverlay
                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/50 shadow-[0_0_10px_rgba(168,85,247,0.3)]"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Layers3 className="h-3.5 w-3.5" />
              All 3 Overlaid
            </button>
          </div>

          {/* Timeframe Selectors */}
          <div className="inline-flex rounded-lg border border-slate-800 bg-slate-900/90 p-0.5 text-xs">
            {["1M", "3M", "6M", "1Y", "ALL"].map((tf) => (
              <button
                key={tf}
                onClick={() => onTimeframeChange(tf)}
                className={`rounded-md px-2.5 py-1.5 font-medium transition ${
                  timeframe === tf
                    ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          {/* Universe Filter */}
          <div className="inline-flex rounded-lg border border-slate-800 bg-slate-900/90 p-0.5 text-xs">
            <button
              onClick={() => onUniverseChange("all")}
              className={`rounded-md px-3 py-1.5 font-medium transition ${
                universe === "all"
                  ? "bg-blue-600/30 text-blue-300 border border-blue-500/40"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              All Listed (~2.8k)
            </button>
            <button
              onClick={() => onUniverseChange("nifty500")}
              className={`rounded-md px-3 py-1.5 font-medium transition ${
                universe === "nifty500"
                  ? "bg-blue-600/30 text-blue-300 border border-blue-500/40"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Nifty 500 (500)
            </button>
          </div>

          {/* Metric View Mode (only for single DMA) */}
          {!isMultiOverlay && (
            <div className="inline-flex rounded-lg border border-slate-800 bg-slate-900/90 p-0.5 text-xs">
              <button
                onClick={() => setDisplayMode("percentage")}
                className={`rounded-md px-2.5 py-1.5 font-medium transition ${
                  displayMode === "percentage"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                % Mode
              </button>
              <button
                onClick={() => setDisplayMode("count")}
                className={`rounded-md px-2.5 py-1.5 font-medium transition ${
                  displayMode === "count"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Count Mode
              </button>
            </div>
          )}

          {/* Refresh & Fullscreen Buttons */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Refresh Breadth Data"
            className="rounded-lg border border-slate-800 bg-slate-900/80 p-2 text-slate-400 hover:text-white transition disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin text-cyan-400" : ""}`} />
          </button>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
            className="rounded-lg border border-slate-800 bg-slate-900/80 p-2 text-slate-400 hover:text-white transition"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Real-time Institutional HUD & Inspector Bar */}
      {!isMultiOverlay && activePoint && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6 rounded-xl border border-slate-800/90 bg-[#090F1C]/90 p-3.5 backdrop-blur-md">
          {/* Inspected Date */}
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
              <Calendar className="h-3 w-3 text-cyan-400" />
              {hoveredPoint ? "Inspected Session" : "Latest Session"}
            </span>
            <span className="text-sm font-bold text-white mt-0.5">{activePoint.date}</span>
          </div>

          {/* % Above Selected DMA */}
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              % Above {selectedDma} DMA
            </span>
            <span
              className={`text-base font-extrabold mt-0.5 ${
                activeIsGreen ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {activePct.toFixed(2)}%
            </span>
          </div>

          {/* Absolute Company Count */}
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Companies Above {selectedDma} DMA
            </span>
            <span className="text-sm font-bold text-white mt-0.5">
              {(activePoint.above_dma ?? activePoint.above_20dma ?? 0).toLocaleString()} /{" "}
              <span className="text-slate-400">{activePoint.total_stocks.toLocaleString()}</span>
            </span>
          </div>

          {/* Breadth Regime */}
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {selectedDma} DMA Regime
            </span>
            <span
              className={`text-xs font-bold mt-1 inline-flex items-center gap-1 ${
                activeIsGreen ? "text-emerald-300" : "text-rose-300"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${activeIsGreen ? "bg-emerald-400" : "bg-rose-400"}`}
              />
              {activeIsGreen ? "GREEN ZONE (>50%)" : "RED ZONE (<50%)"}
            </span>
          </div>

          {/* 1-Day Breadth Change */}
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              1-Day Shift
            </span>
            <span
              className={`text-sm font-bold mt-0.5 flex items-center gap-1 ${
                (activePoint.change_1d || 0) >= 0 ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {(activePoint.change_1d || 0) >= 0 ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" />
              )}
              {(activePoint.change_1d || 0) >= 0 ? "+" : ""}
              {(activePoint.change_1d || 0).toFixed(2)}%
            </span>
          </div>

          {/* Period Extremes */}
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              {timeframe} High / Low
            </span>
            <span className="text-xs font-bold text-slate-200 mt-0.5">
              <span className="text-emerald-400">{metrics?.highest_pct?.toFixed(1)}%</span> /{" "}
              <span className="text-rose-400">{metrics?.lowest_pct?.toFixed(1)}%</span>
            </span>
          </div>
        </div>
      )}

      {/* Multi-DMA HUD when All 3 Overlaid is active */}
      {isMultiOverlay && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5 rounded-xl border border-slate-800/90 bg-[#090F1C]/90 p-3.5 backdrop-blur-md">
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold uppercase text-slate-400">
              {hoveredMulti ? "Inspected Session" : "Latest Session"}
            </span>
            <span className="text-sm font-bold text-white mt-0.5">
              {hoveredMulti?.date || data.current_metrics?.latest_date}
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-[10px] font-semibold uppercase text-cyan-400">
              20 DMA (Tactical)
            </span>
            <span className="text-base font-extrabold text-cyan-300 mt-0.5">
              {(hoveredMulti?.pct_above_20dma ?? data.multi_dma_latest?.["20_dma_pct"] ?? 0).toFixed(1)}%
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-[10px] font-semibold uppercase text-amber-400">
              50 DMA (Intermediate)
            </span>
            <span className="text-base font-extrabold text-amber-300 mt-0.5">
              {(hoveredMulti?.pct_above_50dma ?? data.multi_dma_latest?.["50_dma_pct"] ?? 0).toFixed(1)}%
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-[10px] font-semibold uppercase text-emerald-400">
              200 DMA (Stage-2 Macro)
            </span>
            <span className="text-base font-extrabold text-emerald-300 mt-0.5">
              {(hoveredMulti?.pct_above_200dma ?? data.multi_dma_latest?.["200_dma_pct"] ?? 0).toFixed(1)}%
            </span>
          </div>

          <div className="flex flex-col">
            <span className="text-[10px] font-semibold uppercase text-purple-400">
              Alignment Status
            </span>
            <span className="text-xs font-bold text-white mt-1">
              {(hoveredMulti?.pct_above_20dma ?? 0) >= 50 &&
              (hoveredMulti?.pct_above_50dma ?? 0) >= 50 &&
              (hoveredMulti?.pct_above_200dma ?? 0) >= 50
                ? "🟢 TRIPLE BULLISH ALIGNMENT"
                : (hoveredMulti?.pct_above_20dma ?? 0) < 50 &&
                  (hoveredMulti?.pct_above_50dma ?? 0) < 50 &&
                  (hoveredMulti?.pct_above_200dma ?? 0) < 50
                ? "🔴 TRIPLE BEARISH COMPRESSION"
                : "🟡 MIXED TRANSITION BREADTH"}
            </span>
          </div>
        </div>
      )}

      {/* Visual Regime Zone Guide Overlay */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div className="flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-950/20 px-3.5 py-2 text-emerald-300">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
            <span className="font-semibold uppercase tracking-wider text-[11px]">
              Green Zone (&gt; 50% Equities Above {selectedDma} DMA)
            </span>
          </div>
          <span className="font-medium text-emerald-400/90 text-[11px]">
            Bullish Expansion &bull; Favorable for Breakouts
          </span>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-rose-500/20 bg-rose-950/20 px-3.5 py-2 text-rose-300">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
            <span className="font-semibold uppercase tracking-wider text-[11px]">
              Red Zone (&lt; 50% Equities Above {selectedDma} DMA)
            </span>
          </div>
          <span className="font-medium text-rose-400/90 text-[11px]">
            Bearish Contraction &bull; Capital Defense Mode
          </span>
        </div>
      </div>

      {/* Chart Canvas Area */}
      <div className="relative mt-3 rounded-xl border border-slate-800/80 bg-[#060A12] overflow-hidden">
        {/* Subtle Watermark Labels inside chart */}
        <div className="pointer-events-none absolute top-3 left-4 z-10 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-emerald-500/40">
          <span>🟢 Green Zone: Bullish Breadth Expansion</span>
        </div>
        <div className="pointer-events-none absolute bottom-6 left-4 z-10 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-rose-500/40">
          <span>🔴 Red Zone: Bearish Breadth Contraction</span>
        </div>

        {/* 50% Line Banner */}
        <div className="pointer-events-none absolute top-1/2 -translate-y-1/2 right-20 z-10 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400/80 backdrop-blur-sm">
          50% Neutral Dividing Line
        </div>

        <div
          ref={chartContainerRef}
          className="w-full"
          style={{ height: isFullscreen ? "calc(100vh - 280px)" : "490px" }}
        />
      </div>

      {/* Bottom KPI Metrics Bar */}
      {metrics && !isMultiOverlay && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5 text-xs">
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-3">
            <span className="text-[10px] font-medium uppercase text-slate-400">
              Current {selectedDma} DMA Level
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span
                className={`text-lg font-bold ${
                  metrics.current_zone === "GREEN" ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {metrics.current_pct_above_dma}%
              </span>
              <span className="text-xs text-slate-400">
                ({metrics.current_count_above_dma} stocks)
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-3">
            <span className="text-[10px] font-medium uppercase text-slate-400">5-Day Shift</span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span
                className={`text-lg font-bold flex items-center gap-1 ${
                  metrics.change_5d >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {metrics.change_5d >= 0 ? "+" : ""}
                {metrics.change_5d}%
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-3">
            <span className="text-[10px] font-medium uppercase text-slate-400">20-Day Shift</span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span
                className={`text-lg font-bold flex items-center gap-1 ${
                  metrics.change_20d >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {metrics.change_20d >= 0 ? "+" : ""}
                {metrics.change_20d}%
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-3">
            <span className="text-[10px] font-medium uppercase text-slate-400">
              {timeframe} Green Days
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-lg font-bold text-emerald-400">
                {metrics.green_days_count} days
              </span>
              <span className="text-xs text-slate-400">({metrics.green_days_pct}%)</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-3 col-span-2 sm:col-span-1">
            <span className="text-[10px] font-medium uppercase text-slate-400">
              {timeframe} Average
            </span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-lg font-bold text-cyan-400">{metrics.avg_pct}%</span>
              <span className="text-xs text-slate-400">mean breadth</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

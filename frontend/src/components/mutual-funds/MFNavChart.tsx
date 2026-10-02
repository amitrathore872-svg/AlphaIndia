"use client";

import { useEffect, useRef, useState, memo } from "react";
import {
  createChart,
  ColorType,
  AreaSeries,
  LineSeries,
  CrosshairMode,
  IChartApi,
  createSeriesMarkers,
} from "lightweight-charts";
import {
  mfRadarApi,
  type MFRadarNavPoint,
  type MFDmaPoint,
  type MFDipMarker,
} from "@/lib/mfRadarApi";
import { Activity, Maximize2, Sparkles, TrendingUp, Layers, Eye, EyeOff } from "lucide-react";

interface MFNavChartProps {
  schemeCode: string;
  schemeName?: string;
  category?: string;
  height?: number | string;
  initialPeriod?: string;
  showToolbar?: boolean;
  onOpenDeepDive?: () => void;
  isModalView?: boolean;
}

function MFNavChartComponent({
  schemeCode,
  schemeName,
  category,
  height = 300,
  initialPeriod = "6M",
  showToolbar = true,
  onOpenDeepDive,
  isModalView = false,
}: MFNavChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const [period, setPeriod] = useState<string>(initialPeriod);
  const [loading, setLoading] = useState<boolean>(true);
  const [hoverData, setHoverData] = useState<{
    date: string;
    nav: number;
    changePct?: number;
    dma50?: number;
    dma200?: number;
  } | null>(null);

  const [showDma, setShowDma] = useState<boolean>(true);
  const [showDips, setShowDips] = useState<boolean>(true);

  const [chartData, setChartData] = useState<{
    points: MFRadarNavPoint[];
    dma_50: MFDmaPoint[];
    dma_200: MFDmaPoint[];
    dip_markers: MFDipMarker[];
  } | null>(null);

  // 1. Fetch NAV Time-Series
  useEffect(() => {
    let isCancelled = false;
    setLoading(true);

    mfRadarApi
      .getNavSeries(schemeCode, period)
      .then((res) => {
        if (isCancelled) return;
        const processed = {
          points: res.points || [],
          dma_50: res.dma_50 || [],
          dma_200: res.dma_200 || [],
          dip_markers: res.dip_markers || [],
        };
        setChartData(processed);

        if (res.points && res.points.length > 0) {
          const latest = res.points[res.points.length - 1];
          setHoverData({
            date: latest.time,
            nav: latest.value,
            changePct: latest.day_change_pct,
          });
        }
        setLoading(false);
      })
      .catch((err) => {
        if (!isCancelled) {
          console.error("Failed to load MF NAV series:", err);
          setLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [schemeCode, period]);

  // 2. Render Chart Canvas
  useEffect(() => {
    if (!chartContainerRef.current || !chartData) return;
    const container = chartContainerRef.current;
    container.innerHTML = "";

    const data = chartData;
    if (!data.points || data.points.length === 0) return;

    const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
    const chartHeight = typeof height === "number" ? height : 300;
    const containerWidth = container.clientWidth || container.parentElement?.clientWidth || 600;

    const chart = createChart(container, {
      width: containerWidth,
      height: chartHeight,
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
          top: 0.08,
          bottom: 0.12,
        },
      },
      timeScale: {
        borderColor: isDark ? "#1e293b" : "#e2e8f0",
        timeVisible: false,
      },
    });

    chartRef.current = chart;

    // A. Primary NAV Area Series
    const navSeries = chart.addSeries(AreaSeries, {
      topColor: isDark ? "rgba(6, 182, 212, 0.42)" : "rgba(14, 165, 233, 0.35)",
      bottomColor: isDark ? "rgba(6, 182, 212, 0.02)" : "rgba(14, 165, 233, 0.02)",
      lineColor: "#06b6d4",
      lineWidth: 2,
      priceFormat: {
        type: "price",
        precision: 2,
        minMove: 0.01,
      },
    });

    navSeries.setData(
      data.points.map((p) => ({
        time: p.time as any,
        value: p.value,
      }))
    );

    // B. 50 DMA Line (Emerald)
    if (showDma && data.dma_50 && data.dma_50.length > 0) {
      const dma50Series = chart.addSeries(LineSeries, {
        color: "#10b981",
        lineWidth: 1,
        title: "50 DMA",
      });
      dma50Series.setData(
        data.dma_50.map((d) => ({
          time: d.time as any,
          value: d.value,
        }))
      );
    }

    // C. 200 DMA Line (Amber)
    if (showDma && data.dma_200 && data.dma_200.length > 0) {
      const dma200Series = chart.addSeries(LineSeries, {
        color: "#f59e0b",
        lineWidth: 1,
        title: "200 DMA",
      });
      dma200Series.setData(
        data.dma_200.map((d) => ({
          time: d.time as any,
          value: d.value,
        }))
      );
    }

    // D. Dip Buy Markers (Arrows where fund dropped > 1%)
    if (showDips && data.dip_markers && data.dip_markers.length > 0) {
      try {
        createSeriesMarkers(
          navSeries,
          data.dip_markers.map((m) => ({
            time: m.time as any,
            position: m.position,
            color: "#10b981",
            shape: "arrowUp",
            text: m.text,
          }))
        );
      } catch (e) {
        console.debug("Dip markers render skipped:", e);
      }
    }

    // Crosshair hover listener
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData) return;
      const navVal = param.seriesData.get(navSeries) as { value?: number } | undefined;
      if (navVal?.value) {
        const timeStr = String(param.time);
        const matchPoint = data.points.find((p) => p.time === timeStr);
        setHoverData({
          date: timeStr,
          nav: navVal.value,
          changePct: matchPoint?.day_change_pct,
        });
      }
    });

    chart.timeScale().fitContent();

    const fitTimer = setTimeout(() => {
      if (chartRef.current) {
        chartRef.current.timeScale().fitContent();
      }
    }, 100);

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && chartRef.current) {
          chartRef.current.applyOptions({
            width: entry.contentRect.width,
          });
          chartRef.current.timeScale().fitContent();
        }
      }
    });

    resizeObserver.observe(container);

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        });
        chartRef.current.timeScale().fitContent();
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      clearTimeout(fitTimer);
      window.removeEventListener("resize", handleResize);
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [chartData, height, showDma, showDips]);

  const periodsList = ["1M", "3M", "6M", "1Y", "3Y", "5Y", "MAX"];

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#050B14]">
      {/* ── Top HUD / Toolbar ── */}
      {showToolbar && (
        <div className="flex flex-wrap items-center justify-between border-b border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-[#07101E] px-3.5 py-2 gap-2 text-xs">
          {/* Left: Scheme Info & Hover NAV Display */}
          <div className="flex items-center gap-3">
            {schemeName && (
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
                <span className="font-bold text-slate-800 dark:text-slate-200 font-mono text-[11px] truncate max-w-[240px]">
                  {schemeName}
                </span>
                {category && (
                  <span className="rounded bg-cyan-500/10 border border-cyan-500/30 px-1.5 py-0.2 text-[9px] font-semibold text-cyan-400">
                    {category}
                  </span>
                )}
              </div>
            )}

            {hoverData && (
              <div className="flex items-center gap-2 font-mono text-[11px]">
                <span className="text-slate-500 dark:text-slate-400">{hoverData.date}</span>
                <span className="font-bold text-slate-900 dark:text-white">₹{hoverData.nav.toFixed(2)}</span>
                {hoverData.changePct !== undefined && (
                  <span
                    className={`font-semibold ${
                      hoverData.changePct >= 0 ? "text-emerald-500" : "text-rose-500"
                    }`}
                  >
                    ({hoverData.changePct > 0 ? "+" : ""}
                    {hoverData.changePct.toFixed(2)}%)
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Right: Timeframe Switcher & Toggles */}
          <div className="flex items-center gap-2 ml-auto">
            {/* 50/200 DMA Toggle */}
            <button
              onClick={() => setShowDma((v) => !v)}
              className={`rounded px-2 py-0.5 text-[10px] font-semibold border transition ${
                showDma
                  ? "bg-amber-500/15 border-amber-500/40 text-amber-400"
                  : "bg-slate-800/40 border-slate-700/40 text-slate-500"
              }`}
              title="Toggle 50 & 200 DMA lines"
            >
              50/200 DMA
            </button>

            {/* Dip Markers Toggle */}
            <button
              onClick={() => setShowDips((v) => !v)}
              className={`rounded px-2 py-0.5 text-[10px] font-semibold border transition ${
                showDips
                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                  : "bg-slate-800/40 border-slate-700/40 text-slate-500"
              }`}
              title="Highlight historical > 1% dip buying opportunities"
            >
              Dips (&gt;1%)
            </button>

            {/* Timeframe Buttons */}
            <div className="flex items-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/90 p-0.5 text-[10px] font-semibold">
              {periodsList.map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`rounded px-1.5 py-0.5 transition ${
                    period === p
                      ? "bg-cyan-600 dark:bg-cyan-500 text-white dark:text-slate-950 font-bold"
                      : "text-slate-500 dark:text-slate-400 hover:text-white"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Open Full Deep-Dive Modal button (shown if in inline mode) */}
            {onOpenDeepDive && !isModalView && (
              <button
                onClick={onOpenDeepDive}
                className="flex items-center gap-1 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2 py-1 text-[11px] font-semibold text-cyan-400 hover:bg-cyan-500 hover:text-slate-950 transition shadow-xs"
                title="Open Institutional Full Deep-Dive Modal"
              >
                <span>Full Deep Dive</span>
                <Maximize2 size={11} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Chart Canvas ── */}
      <div className="relative w-full">
        {loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-white/80 dark:bg-[#050B14]/80 backdrop-blur-xs">
            <Activity className="h-5 w-5 animate-spin text-cyan-500" />
            <span className="text-[11px] text-slate-400 font-mono">
              Loading Historical NAV & Dip Points...
            </span>
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

export default memo(MFNavChartComponent);

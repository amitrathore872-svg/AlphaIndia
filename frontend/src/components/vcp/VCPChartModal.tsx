"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  CrosshairMode,
  IChartApi,
} from "lightweight-charts";
import { X, Target, ShieldCheck, Activity, Layers, BarChart3, RefreshCw } from "lucide-react";
import { fetchVCPStockDeepDive, type VCPStockPick, type VCPStockDeepDive } from "@/lib/vcpApi";

interface VCPChartModalProps {
  stock: VCPStockPick | null;
  onClose: () => void;
}

export default function VCPChartModal({ stock, onClose }: VCPChartModalProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);

  const [deepDive, setDeepDive] = useState<VCPStockDeepDive | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!stock) return;

    let mounted = true;
    setLoading(true);

    fetchVCPStockDeepDive(stock.symbol)
      .then((data) => {
        if (mounted) {
          setDeepDive(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch deep dive for chart:", err);
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [stock]);

  // Initialize and draw Lightweight Chart
  useEffect(() => {
    if (!deepDive || !chartContainerRef.current) return;

    const container = chartContainerRef.current;
    container.innerHTML = "";

    const chart = createChart(container, {
      width: container.clientWidth,
      height: 480,
      layout: {
        background: { type: ColorType.Solid, color: "#03070E" },
        textColor: "#94A3B8",
        fontSize: 11,
        fontFamily: "Geist Mono, monospace",
      },
      grid: {
        vertLines: { color: "rgba(30, 41, 59, 0.4)" },
        horzLines: { color: "rgba(30, 41, 59, 0.4)" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: "#1E293B",
        autoScale: true,
      },
      timeScale: {
        borderColor: "#1E293B",
        timeVisible: true,
      },
    });

    chartRef.current = chart;

    // 1. Candlestick Series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#10B981",
      downColor: "#EF4444",
      borderUpColor: "#10B981",
      borderDownColor: "#EF4444",
      wickUpColor: "#10B981",
      wickDownColor: "#EF4444",
    });

    const candles = deepDive.chart_data?.candles || [];
    if (candles.length > 0) {
      candleSeries.setData(
        candles.map((c) => ({
          time: c.time as any,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }))
      );
    }

    // 2. Volume Histogram (Lower pane)
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume_pane",
    });

    chart.priceScale("volume_pane").applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    const volumes = deepDive.chart_data?.volume || [];
    if (volumes.length > 0) {
      volumeSeries.setData(
        volumes.map((v) => ({
          time: v.time as any,
          value: v.value,
          color: v.color,
        }))
      );
    }

    // 3. DMA 50 Line
    const dma50 = deepDive.chart_data?.dma_50 || [];
    if (dma50.length > 0) {
      const dma50Series = chart.addSeries(LineSeries, {
        color: "#06B6D4",
        lineWidth: 1,
        title: "50 EMA",
      });
      dma50Series.setData(dma50.map((d) => ({ time: d.time as any, value: d.value })));
    }

    // 4. Pivot Resistance Price Line
    const pivotVal = deepDive.pivot_price;
    if (pivotVal) {
      candleSeries.createPriceLine({
        price: pivotVal,
        color: "#06B6D4",
        lineWidth: 2,
        lineStyle: 0,
        axisLabelVisible: true,
        title: `PIVOT ₹${pivotVal.toFixed(1)}`,
      });
    }

    // 5. Stop Loss Price Line
    const stopVal = deepDive.stop_loss;
    if (stopVal) {
      candleSeries.createPriceLine({
        price: stopVal,
        color: "#EF4444",
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: `STOP ₹${stopVal.toFixed(1)}`,
      });
    }

    // 6. Target 1 Price Line
    const tgt1 = deepDive.target_1;
    if (tgt1) {
      candleSeries.createPriceLine({
        price: tgt1,
        color: "#10B981",
        lineWidth: 1,
        lineStyle: 1,
        axisLabelVisible: true,
        title: `TARGET 1 ₹${tgt1.toFixed(0)}`,
      });
    }

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth });
      }
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [deepDive]);

  if (!stock) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-5xl rounded-2xl bg-white dark:bg-[#050B14] border border-cyan-500/40 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#071322]">
          <div className="flex items-center gap-3">
            <span className="text-xl font-black font-mono text-slate-900 dark:text-white">{stock.symbol}</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border border-slate-300 dark:border-slate-700">
              {stock.company_name}
            </span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 font-bold border border-cyan-500/30">
              {stock.vcp_stage}
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-200 dark:bg-slate-800/80 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 p-3.5 rounded-xl font-mono">
            <div>
              <span className="text-slate-500 dark:text-slate-400 text-[10px] block uppercase">
                {deepDive ? "Live CMP (Real-Time)" : "Scan CMP"}
              </span>
              <span className="text-slate-900 dark:text-white font-bold text-sm">
                ₹{(deepDive?.cmp ?? stock.cmp).toFixed(2)}
              </span>
              {/* Show drift badge when live CMP diverges from scan-time CMP by more than 0.5% */}
              {deepDive && Math.abs(deepDive.cmp - stock.cmp) / Math.max(1, stock.cmp) > 0.005 && (
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded mt-0.5 inline-block ${
                    deepDive.cmp > stock.cmp
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {deepDive.cmp > stock.cmp ? "▲" : "▼"}{" "}
                  {(((deepDive.cmp - stock.cmp) / Math.max(1, stock.cmp)) * 100).toFixed(2)}% vs scan ₹{stock.cmp.toFixed(2)}
                </span>
              )}
            </div>
            <div>
              <span className="text-cyan-700 dark:text-cyan-400 text-[10px] block uppercase">Pivot Resistance</span>
              <span className="text-cyan-700 dark:text-cyan-300 font-bold text-sm">₹{(deepDive?.pivot_price ?? stock.pivot_price).toFixed(2)}</span>
            </div>
            <div>
              <span className="text-rose-600 dark:text-rose-400 text-[10px] block uppercase">Stop Loss</span>
              <span className="text-rose-600 dark:text-rose-400 font-bold text-sm">
                ₹{(deepDive?.stop_loss ?? stock.stop_loss).toFixed(2)} (-{(deepDive?.risk_pct ?? stock.risk_pct).toFixed(1)}%)
              </span>
            </div>
            <div>
              <span className="text-emerald-700 dark:text-emerald-400 text-[10px] block uppercase">Target 1 & 2</span>
              <span className="text-emerald-700 dark:text-emerald-300 font-bold text-sm">
                ₹{(deepDive?.target_1 ?? stock.target_1).toFixed(0)} / ₹{(deepDive?.target_2 ?? stock.target_2).toFixed(0)}
              </span>
            </div>
            <div>
              <span className="text-amber-700 dark:text-amber-400 text-[10px] block uppercase">Risk : Reward</span>
              <span className="text-amber-700 dark:text-amber-300 font-bold text-sm">{deepDive?.reward_risk ?? stock.reward_risk}</span>
            </div>
          </div>

          {/* Chart View Container */}
          <div className="relative rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-950">
            {loading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 backdrop-blur-sm text-cyan-400 gap-2">
                <RefreshCw className="w-5 h-5 animate-spin" />
                <span className="text-sm font-semibold">Rendering Minervini VCP Swings...</span>
              </div>
            )}
            <div ref={chartContainerRef} className="w-full h-[480px]" />
          </div>

          {/* Bottom Indicators & Contraction Note */}
          <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-slate-600 dark:text-slate-400 gap-2 bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
                Cyan Line: Breakout Pivot
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                Red Line: Guardrail Stop
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                Green Line: R:2.5 Target
              </span>
            </div>
            <div className="font-mono text-cyan-700 dark:text-cyan-400 font-semibold">
              Volume Histogram: Violet Bars = Dry-Up Footprint
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

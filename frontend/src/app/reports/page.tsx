"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  FileBarChart,
  Activity,
  Layers,
  Sparkles,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Info,
  ShieldCheck,
  AlertTriangle,
  Compass,
  ArrowRight,
  Filter,
  Layers3,
  Calendar,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { PageHeader } from "@/components/common";
import {
  fetchBreadthDma,
  fetchMultiDmaBreadth,
  fetchReportCatalog,
  triggerBreadthRefresh,
  BreadthReportData,
  MultiDmaPoint,
  ReportCatalogItem,
} from "@/lib/reportsApi";
import Breadth20DmaChart from "@/components/reports/Breadth20DmaChart";
import SectorBreadthMatrix from "@/components/reports/SectorBreadthMatrix";
import ReportCatalogSection from "@/components/reports/ReportCatalogSection";

export default function ReportsDashboardPage() {
  const [selectedDma, setSelectedDma] = useState<number>(20); // 20, 50, 200
  const [activeTab, setActiveTab] = useState<"dma-chart" | "sector-matrix" | "catalog">("dma-chart");
  const [timeframe, setTimeframe] = useState<string>("1Y");
  const [universe, setUniverse] = useState<string>("all");
  const [breadthData, setBreadthData] = useState<BreadthReportData | null>(null);
  const [multiDmaSeries, setMultiDmaSeries] = useState<MultiDmaPoint[]>([]);
  const [catalog, setCatalog] = useState<ReportCatalogItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load breadth report data for selected DMA
  const loadBreadth = useCallback(
    async (showLoadingSpinner: boolean = true) => {
      if (showLoadingSpinner) setIsLoading(true);
      setError(null);
      try {
        const [data, multiRes] = await Promise.all([
          fetchBreadthDma(selectedDma, universe, timeframe),
          fetchMultiDmaBreadth(timeframe).catch(() => ({ series: [] })),
        ]);
        setBreadthData(data);
        if (multiRes && multiRes.series) {
          setMultiDmaSeries(multiRes.series);
        }
      } catch (err: any) {
        console.error("Error loading breadth data:", err);
        setError(err.message || "Failed to load market breadth data");
      } finally {
        setIsLoading(false);
      }
    },
    [selectedDma, universe, timeframe]
  );

  // Load catalog on mount
  useEffect(() => {
    fetchReportCatalog()
      .then((cat) => setCatalog(cat))
      .catch((err) => console.warn("Failed to load report catalog:", err));
  }, []);

  // Reload breadth on DMA, universe, or timeframe change
  useEffect(() => {
    loadBreadth();
  }, [loadBreadth]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await triggerBreadthRefresh();
      await loadBreadth(false);
    } catch (err: any) {
      console.error("Failed to refresh breadth:", err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const metrics = breadthData?.current_metrics;
  const isGreenNow = metrics?.current_zone === "GREEN";

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-12">
        {/* Institutional Header with App Context */}
        <PageHeader
          eyebrow={
            <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs tracking-wider uppercase">
              <FileBarChart className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span>INSTITUTIONAL RESEARCH RADAR • MARKET BREADTH</span>
            </div>
          }
          icon={<FileBarChart className="w-5 h-5" />}
          iconColor="cyan"
          title="Institutional Report Dashboard"
          badge={{ label: "20 / 50 / 200 DMA", color: "cyan" }}
          subtitle="Quantitative market breadth, macro regime zones, and multi-horizon moving average health (20, 50, 200 DMA)."
          actions={
            <div className="flex flex-wrap items-center gap-3">
              {/* Quick DMA Gauges */}
              {breadthData?.multi_dma_latest && (
                <div className="hidden lg:flex items-center gap-2 rounded-xl border border-slate-800/90 bg-[#080E1C] px-3 py-1.5 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">20 DMA:</span>
                    <span
                      className={`font-bold ${
                        breadthData.multi_dma_latest["20_dma_pct"] >= 50
                          ? "text-emerald-400"
                          : "text-rose-400"
                      }`}
                    >
                      {breadthData.multi_dma_latest["20_dma_pct"]}%
                    </span>
                  </div>
                  <span className="text-slate-600">|</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">50 DMA:</span>
                    <span
                      className={`font-bold ${
                        breadthData.multi_dma_latest["50_dma_pct"] >= 50
                          ? "text-emerald-400"
                          : "text-rose-400"
                      }`}
                    >
                      {breadthData.multi_dma_latest["50_dma_pct"]}%
                    </span>
                  </div>
                  <span className="text-slate-600">|</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">200 DMA:</span>
                    <span
                      className={`font-bold ${
                        breadthData.multi_dma_latest["200_dma_pct"] >= 50
                          ? "text-emerald-400"
                          : "text-rose-400"
                      }`}
                    >
                      {breadthData.multi_dma_latest["200_dma_pct"]}%
                    </span>
                  </div>
                </div>
              )}

              {metrics && (
                <div
                  className={`flex items-center gap-2 rounded-xl border px-3.5 py-1.5 backdrop-blur-md ${
                    isGreenNow
                      ? "border-emerald-500/40 bg-emerald-950/20 text-emerald-300"
                      : "border-rose-500/40 bg-rose-950/20 text-rose-300"
                  }`}
                >
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      isGreenNow
                        ? "bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]"
                        : "bg-rose-400 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.8)]"
                    }`}
                  />
                  <div className="text-left">
                    <div className="text-[9px] uppercase font-bold tracking-wider opacity-80">
                      {selectedDma} DMA Breadth Regime
                    </div>
                    <div className="text-xs font-extrabold">
                      {metrics.current_pct_above_dma}% Above &bull;{" "}
                      {isGreenNow ? "GREEN ZONE" : "RED ZONE"}
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-2 rounded-xl border border-slate-700/80 bg-slate-800/80 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-cyan-400" : ""}`} />
                <span>{isRefreshing ? "Syncing..." : "Sync Exchange Data"}</span>
              </button>
            </div>
          }
        />

        {/* DMA Navigation Horizon Selector Pills */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/70 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            {[
              { dma: 20, title: "20 DMA Tactical Breadth", desc: "Short-Term Pulse" },
              { dma: 50, title: "50 DMA Intermediate Breadth", desc: "Swing Health" },
              { dma: 200, title: "200 DMA Stage-2 Health", desc: "Macro Bull/Bear" },
            ].map((item) => {
              const isSelected = selectedDma === item.dma && activeTab === "dma-chart";
              return (
                <button
                  key={item.dma}
                  onClick={() => {
                    setSelectedDma(item.dma);
                    setActiveTab("dma-chart");
                  }}
                  className={`flex flex-col text-left rounded-xl px-4 py-2 text-xs font-bold transition ${
                    isSelected
                      ? "border border-cyan-500/50 bg-cyan-500/15 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.25)]"
                      : "border border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white hover:bg-slate-800/60"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5" />
                    {item.title}
                  </span>
                  <span className="text-[10px] font-normal opacity-70 mt-0.5">{item.desc}</span>
                </button>
              );
            })}
          </div>

          {/* Supplementary Views: Sector Matrix & Reports Catalog */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("sector-matrix")}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                activeTab === "sector-matrix"
                  ? "border border-cyan-500/50 bg-cyan-500/15 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.2)]"
                  : "border border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white"
              }`}
            >
              <Layers className="h-4 w-4" />
              Sector {selectedDma} DMA Matrix
            </button>

            <button
              onClick={() => setActiveTab("catalog")}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                activeTab === "catalog"
                  ? "border border-cyan-500/50 bg-cyan-500/15 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.2)]"
                  : "border border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white"
              }`}
            >
              <Compass className="h-4 w-4" />
              Report Suite ({catalog.length})
            </button>
          </div>
        </div>

        {/* Error state */}
        {error && (
          <div className="flex items-center gap-3 rounded-xl border border-rose-500/30 bg-rose-950/20 p-4 text-rose-300">
            <AlertTriangle className="h-5 w-5 text-rose-400" />
            <div className="text-sm">
              <span className="font-bold">Error loading report data:</span> {error}
            </div>
            <button
              onClick={() => loadBreadth()}
              className="ml-auto rounded-lg bg-rose-600/30 px-3 py-1 text-xs font-semibold hover:bg-rose-600/50"
            >
              Retry
            </button>
          </div>
        )}

        {/* Main Content Area based on Tab */}
        {isLoading ? (
          <div className="flex h-96 flex-col items-center justify-center rounded-2xl border border-slate-800/80 bg-[#070C16] p-8 text-center">
            <RefreshCw className="h-8 w-8 animate-spin text-cyan-400" />
            <h3 className="mt-4 text-base font-bold text-white">
              Computing {selectedDma} DMA Breadth Tensors...
            </h3>
            <p className="mt-1 text-xs text-slate-400 max-w-md">
              Aggregating daily OHLC rolling {selectedDma}-session moving averages across official NSE
              security bhavcopies for {universe === "all" ? "2,800+ listed equities" : "Nifty 500 institutional equities"}.
            </p>
          </div>
        ) : breadthData ? (
          <>
            {activeTab === "dma-chart" && (
              <div className="space-y-6">
                {/* Primary Breadth Line Chart with 50% Green/Red Zones */}
                <Breadth20DmaChart
                  data={breadthData}
                  selectedDma={selectedDma}
                  timeframe={timeframe}
                  universe={universe}
                  onDmaChange={(dma) => setSelectedDma(dma)}
                  onTimeframeChange={setTimeframe}
                  onUniverseChange={setUniverse}
                  onRefresh={handleRefresh}
                  isRefreshing={isRefreshing}
                  multiDmaSeries={multiDmaSeries}
                />

                {/* Institutional Quantitative Commentary Card */}
                {metrics && (
                  <div
                    className={`rounded-2xl border p-5 transition-all ${
                      isGreenNow
                        ? "border-emerald-500/30 bg-gradient-to-r from-emerald-950/20 via-slate-900/40 to-slate-950"
                        : "border-rose-500/30 bg-gradient-to-r from-rose-950/20 via-slate-900/40 to-slate-950"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`rounded-xl p-2.5 ${
                          isGreenNow ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                        }`}
                      >
                        {isGreenNow ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-bold text-white">
                            Institutional Breadth Verdict: {metrics.regime_label}
                          </h4>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase ${
                              isGreenNow
                                ? "bg-emerald-500/20 text-emerald-300"
                                : "bg-rose-500/20 text-rose-300"
                            }`}
                          >
                            {metrics.current_zone} ZONE
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-300 leading-relaxed max-w-4xl">
                          {metrics.regime_description} On session <strong>{metrics.latest_date}</strong>,{" "}
                          <strong>{metrics.current_count_above_dma.toLocaleString()}</strong> out of{" "}
                          <strong>{metrics.total_universe_count.toLocaleString()}</strong> equities (
                          {metrics.current_pct_above_dma}%) closed above their {selectedDma} DMA line.
                        </p>

                        <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-slate-400">
                          <span>
                            &bull; 5-Day Momentum Shift:{" "}
                            <strong className={metrics.change_5d >= 0 ? "text-emerald-400" : "text-rose-400"}>
                              {metrics.change_5d >= 0 ? "+" : ""}
                              {metrics.change_5d}%
                            </strong>
                          </span>
                          <span>
                            &bull; 20-Day Momentum Shift:{" "}
                            <strong className={metrics.change_20d >= 0 ? "text-emerald-400" : "text-rose-400"}>
                              {metrics.change_20d >= 0 ? "+" : ""}
                              {metrics.change_20d}%
                            </strong>
                          </span>
                          <span>
                            &bull; {timeframe} Time Spent in Green Zone:{" "}
                            <strong className="text-emerald-400">{metrics.green_days_pct}%</strong> (
                            {metrics.green_days_count} of {metrics.green_days_count + metrics.red_days_count} sessions)
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Quick Preview of Sector Breakdown for Selected DMA */}
                {breadthData.sector_breadth && breadthData.sector_breadth.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <Layers className="h-4 w-4 text-cyan-400" />
                        Sectoral {selectedDma} DMA Breadth Matrix Preview
                      </h3>
                      <button
                        onClick={() => setActiveTab("sector-matrix")}
                        className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition"
                      >
                        View Full Sector Matrix
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                    <SectorBreadthMatrix sectors={breadthData.sector_breadth} />
                  </div>
                )}
              </div>
            )}

            {activeTab === "sector-matrix" && (
              <div className="space-y-6">
                <SectorBreadthMatrix sectors={breadthData.sector_breadth} />
              </div>
            )}

            {activeTab === "catalog" && (
              <div className="space-y-6">
                <ReportCatalogSection
                  catalog={catalog}
                  activeReportId={`breadth-${selectedDma}dma`}
                  onSelectReport={(id) => {
                    if (id === "breadth-20dma") {
                      setSelectedDma(20);
                      setActiveTab("dma-chart");
                    } else if (id === "breadth-50dma") {
                      setSelectedDma(50);
                      setActiveTab("dma-chart");
                    } else if (id === "breadth-200dma") {
                      setSelectedDma(200);
                      setActiveTab("dma-chart");
                    } else if (id === "breadth-sector-matrix") {
                      setActiveTab("sector-matrix");
                    }
                  }}
                />
              </div>
            )}
          </>
        ) : null}

        {/* Persistent Multi-Report Suite Footer */}
        {activeTab !== "catalog" && catalog.length > 0 && (
          <div className="pt-4">
            <ReportCatalogSection
              catalog={catalog}
              activeReportId={`breadth-${selectedDma}dma`}
              onSelectReport={(id) => {
                if (id === "breadth-20dma") {
                  setSelectedDma(20);
                  setActiveTab("dma-chart");
                } else if (id === "breadth-50dma") {
                  setSelectedDma(50);
                  setActiveTab("dma-chart");
                } else if (id === "breadth-200dma") {
                  setSelectedDma(200);
                  setActiveTab("dma-chart");
                } else if (id === "breadth-sector-matrix") {
                  setActiveTab("sector-matrix");
                }
              }}
            />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

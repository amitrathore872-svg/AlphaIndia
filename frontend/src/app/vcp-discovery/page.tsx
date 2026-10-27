"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/layout/DashboardLayout";
import VCPCard from "@/components/vcp/VCPCard";
import VCPChartModal from "@/components/vcp/VCPChartModal";
import VCPFunnelModal from "@/components/vcp/VCPFunnelModal";
import VCPProgressRibbon from "@/components/vcp/VCPProgressRibbon";
import {
  fetchVCPDiscovery,
  fetchVCPWatchlist,
  fetchVCPProgress,
  triggerScanNow,
  startContinuousMonitoring,
  stopContinuousMonitoring,
  triggerVCPScan,
  type VCPStockPick,
  type VCPDiscoveryResponse,
  type VCPProgressTelemetry,
} from "@/lib/vcpApi";
import {
  Target,
  Zap,
  ShieldCheck,
  TrendingUp,
  Activity,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  Clock,
  Filter,
  SlidersHorizontal,
  History,
  Info,
  Check,
  Award,
  AlertTriangle,
  Eye,
  EyeOff,
  LayoutList,
  LayoutGrid,
} from "lucide-react";

type TabMode = "DISCOVERY" | "WATCHLIST";

export default function VCPDiscoveryPage() {
  const [tab, setTab] = useState<TabMode>("DISCOVERY");
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [eliteOnly, setEliteOnly] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Data States
  const [discoveryData, setDiscoveryData] = useState<VCPDiscoveryResponse | null>(null);
  const [watchlistItems, setWatchlistItems] = useState<VCPStockPick[]>([]);
  const [telemetry, setTelemetry] = useState<VCPProgressTelemetry>({
    status: "IDLE",
    mode: "ON_DEMAND",
    is_continuous_active: false,
    total_stocks: 0,
    stocks_scanned: 0,
    remaining_stocks: 0,
    progress_pct: 0,
    opportunities_found: 0,
    cached_skipped_count: 0,
    scan_duration_seconds: 0.0,
    throughput_stocks_per_sec: 0.0,
    current_symbol: null,
    latest_picks: [],
    last_updated_timestamp: null,
    error_message: null,
  });

  // Modals
  const [selectedStockForChart, setSelectedStockForChart] = useState<VCPStockPick | null>(null);
  const [showFunnelModal, setShowFunnelModal] = useState(false);

  // Scanner Engine Ribbon Visibility
  const [showTelemetry, setShowTelemetry] = useState<boolean>(true);

  // Results View Mode (Compact vs Detailed)
  const [viewMode, setViewMode] = useState<"compact" | "detailed">("compact");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("alpha_india_vcp_telemetry_visible");
      if (saved !== null) {
        setShowTelemetry(saved === "true");
      }
      const savedMode = localStorage.getItem("alpha_india_vcp_view_mode");
      if (savedMode === "compact" || savedMode === "detailed") {
        setViewMode(savedMode);
      }
    } catch {
      // Ignore localStorage error
    }
  }, []);

  const handleSetViewMode = (mode: "compact" | "detailed") => {
    setViewMode(mode);
    try {
      localStorage.setItem("alpha_india_vcp_view_mode", mode);
    } catch {
      // Ignore
    }
  };

  const toggleTelemetry = () => {
    setShowTelemetry((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("alpha_india_vcp_telemetry_visible", String(next));
      } catch {
        // Ignore
      }
      return next;
    });
  };

  // Initial Load
  useEffect(() => {
    loadAllData();
  }, []);

  // Real-time telemetry polling: polls every 2 seconds when running or continuous monitoring active
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;

    const poll = async () => {
      try {
        const prog = await fetchVCPProgress();
        setTelemetry((prev) => {
          // If status transitioned from RUNNING to COMPLETED/MONITORING, refresh discovery picks
          if (prev?.status === "RUNNING" && (prog.status === "COMPLETED" || prog.status === "MONITORING")) {
            fetchVCPDiscovery(false, "TODAY_BREAKOUT").then((d) => setDiscoveryData(d)).catch(() => {});
          }
          return prog;
        });
      } catch (err) {
        console.error("Telemetry poll failed:", err);
      }
    };

    poll(); // immediate initial poll

    timer = setInterval(() => {
      poll();
    }, 2000);

    return () => {
      if (timer) clearInterval(timer);
    };
  }, []);

  const [loadError, setLoadError] = useState<string | null>(null);

  const loadAllData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      // 1. Fetch Discovery immediately so top picks render without delay
      try {
        const disc = await fetchVCPDiscovery(false, "TODAY_BREAKOUT", 300);
        setDiscoveryData(disc);
        if ((disc as any)?.telemetry) {
          setTelemetry((disc as any).telemetry);
        }
      } catch (err: any) {
        console.error("Discovery fetch failed:", err);
        setLoadError(err?.message || "Failed to connect to Alpha India backend service on port 8000.");
      }

      // 2. Concurrently fetch Watchlist and Telemetry in background
      Promise.allSettled([
        fetchVCPWatchlist(10),
        fetchVCPProgress().catch(() => null),
      ]).then(([wlistRes, progRes]) => {
        if (wlistRes.status === "fulfilled" && wlistRes.value) {
          setWatchlistItems(wlistRes.value.items || []);
        }
        if (progRes.status === "fulfilled" && progRes.value) {
          setTelemetry(progRes.value);
        }
      });
    } catch (err: any) {
      console.error("Failed to load VCP data:", err);
      setLoadError("Unexpected error occurred while loading VCP data.");
    } finally {
      setLoading(false);
    }
  };

  const handleScanNow = async () => {
    setIsActionLoading(true);
    try {
      const res = await triggerScanNow("TODAY_BREAKOUT", 300);
      if (res.telemetry) setTelemetry(res.telemetry);
    } catch (err) {
      console.error("On-demand scan trigger failed:", err);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleToggleContinuous = async () => {
    setIsActionLoading(true);
    try {
      if (telemetry?.is_continuous_active) {
        const res = await stopContinuousMonitoring();
        if (res.telemetry) setTelemetry(res.telemetry);
      } else {
        const res = await startContinuousMonitoring();
        if (res.telemetry) setTelemetry(res.telemetry);
      }
    } catch (err) {
      console.error("Toggle continuous monitoring failed:", err);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleTriggerScan = async (mode: "TODAY_BREAKOUT" | "BEFORE_BREAKOUT") => {
    setScanning(true);
    try {
      const res = await triggerVCPScan(mode, 300);
      setDiscoveryData(res);
      if (mode === "BEFORE_BREAKOUT") {
        setWatchlistItems(res.items || []);
      }
    } catch (err) {
      console.error("Scan execution failed:", err);
    } finally {
      setScanning(false);
    }
  };

  const filterStock = (item: VCPStockPick) => {
    if (eliteOnly && !item.is_elite && item.final_ai_score < 95) return false;
    return true;
  };

  const dedupeBySymbol = (items: VCPStockPick[]) => {
    const seen = new Set<string>();
    return items.filter((item) => {
      const sym = (item.symbol || "").trim().toUpperCase();
      if (!sym || seen.has(sym)) return false;
      seen.add(sym);
      return true;
    });
  };

  const activePicks = dedupeBySymbol((discoveryData?.items || []).filter(filterStock));
  const activeWatchlist = dedupeBySymbol(watchlistItems.filter(filterStock));

  return (
    <DashboardLayout>
      <div className="space-y-3.5">
        {/* Institutional Bloomberg Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800/80 pb-3 sm:pb-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
                <Target className="w-4 h-4" />
              </div>
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white font-mono">
                VCP Volume Breakout
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono tracking-wider bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30">
                INSTITUTIONAL RADAR • 8 GATES
              </span>
            </div>
          </div>

          {/* Controls & Schedulers status */}
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/vcp-signals"
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold font-mono tracking-wide bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-emerald-700 dark:text-emerald-300 border border-slate-300 dark:border-slate-700 hover:border-emerald-500/40 transition-all flex items-center gap-1.5"
            >
              <Award className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Signal Track Record
            </Link>

            <button
              onClick={() => handleTriggerScan("TODAY_BREAKOUT")}
              disabled={scanning}
              className="px-3 py-1.5 rounded-lg text-xs font-bold tracking-wide bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-mono flex items-center gap-1.5 transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${scanning ? "animate-spin" : ""}`} />
              {scanning ? "Executing..." : "Scan Universe"}
            </button>

            {/* Toggle Engine Telemetry Button */}
            <button
              onClick={toggleTelemetry}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
              title={showTelemetry ? "Hide Scanner Engine" : "Show Scanner Engine"}
            >
              {showTelemetry ? (
                <>
                  <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                  <span>Hide Engine</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Show Engine</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Live Opportunity Monitoring & Progress Telemetry Ribbon */}
        {showTelemetry ? (
          <VCPProgressRibbon
            telemetry={telemetry}
            onScanNow={handleScanNow}
            onToggleContinuous={handleToggleContinuous}
            onHide={toggleTelemetry}
            isActionLoading={isActionLoading}
          />
        ) : (
          <div className="flex items-center justify-between px-3 py-1.5 rounded-lg border border-dashed border-cyan-500/25 bg-cyan-500/5 text-xs font-mono text-cyan-400">
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-slate-400">Scanner Engine Telemetry Hidden</span>
            </div>
            <button
              onClick={toggleTelemetry}
              className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 underline underline-offset-2 flex items-center gap-1 cursor-pointer"
            >
              <Eye className="w-3 h-3" />
              Show Scanner Engine
            </button>
          </div>
        )}

        {/* Navigation Tabs (Horizontal Scroll Ribbon) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 bg-white dark:bg-[#040A14] p-1 rounded-xl border border-slate-200 dark:border-slate-800/80 overflow-x-auto no-scrollbar shadow-xs">
            <button
              onClick={() => setTab("DISCOVERY")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono tracking-wide transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                tab === "DISCOVERY"
                  ? "bg-cyan-500 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.35)]"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              CONFIRMED BREAKOUTS ({activePicks.length})
            </button>

            <button
              onClick={() => setTab("WATCHLIST")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono tracking-wide transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                tab === "WATCHLIST"
                  ? "bg-cyan-500 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.35)]"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              PRE-BREAKOUT COILING ({activeWatchlist.length})
            </button>
          </div>

          {/* Controls: View Mode & Elite Only */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
            {/* View Mode Switcher: Compact vs Detailed */}
            <div className="flex items-center gap-1 bg-white dark:bg-[#040A14] p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-mono shadow-xs">
              <button
                onClick={() => handleSetViewMode("compact")}
                className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === "compact"
                    ? "bg-cyan-500 text-slate-950 font-bold shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
                title="Single-row compact view with quick swing chart button and details toggle"
              >
                <LayoutList className="w-3.5 h-3.5" />
                <span>Compact View</span>
              </button>
              <button
                onClick={() => handleSetViewMode("detailed")}
                className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  viewMode === "detailed"
                    ? "bg-cyan-500 text-slate-950 font-bold shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
                title="Full detailed multi-gate breakdown view"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Detailed View</span>
              </button>
            </div>

            {/* Quick Filter: Elite Only */}
            {tab === "DISCOVERY" && (
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={eliteOnly}
                  onChange={(e) => setEliteOnly(e.target.checked)}
                  className="rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-cyan-500 focus:ring-cyan-500 w-4 h-4 cursor-pointer"
                />
                <span>Elite Setups Only (95+ Score)</span>
              </label>
            )}
          </div>
        </div>

        {/* Tab 1: Discovery Top 3 Output */}
        {tab === "DISCOVERY" && (
          <div className="space-y-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-cyan-400 gap-3">
                <RefreshCw className="w-8 h-8 animate-spin" />
                <span className="text-sm font-semibold tracking-wide">
                  Evaluating 8-Gate Pipeline across universe...
                </span>
              </div>
            ) : loadError ? (
              <div className="rounded-2xl border border-red-500/30 bg-red-950/20 p-8 text-center space-y-4 max-w-2xl mx-auto backdrop-blur-sm shadow-2xl">
                <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mx-auto">
                  <AlertTriangle className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-lg font-bold font-mono text-white">
                    Unable to Connect to Alpha India Backend
                  </h2>
                  <p className="text-xs text-red-300 font-mono mt-1">
                    {loadError}
                  </p>
                </div>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Please verify the FastAPI backend service is running on <code className="text-cyan-400 bg-slate-900 px-1.5 py-0.5 rounded">http://127.0.0.1:8000</code>.
                </p>
                <button
                  onClick={loadAllData}
                  className="px-4 py-2 rounded-xl text-xs font-bold font-mono bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 transition-colors inline-flex items-center gap-2"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Retry Connection
                </button>
              </div>
            ) : activePicks.length > 0 ? (
              <div className="space-y-4">
                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                  <span>
                    Displaying{" "}
                    <strong className="text-slate-900 dark:text-white font-mono">{activePicks.length} of 3</strong>{" "}
                    institutional setups that passed all 8 gates with Score &ge; 90.0
                  </span>
                </div>

                <div className={`grid grid-cols-1 ${viewMode === "compact" ? "gap-2.5" : "gap-6"}`}>
                  {activePicks.map((stock, idx) => (
                    <VCPCard
                      key={`${stock.symbol}-${idx}`}
                      stock={stock}
                      isCompactMode={viewMode === "compact"}
                      onOpenChart={(s) => setSelectedStockForChart(s)}
                    />
                  ))}
                </div>
              </div>
            ) : eliteOnly && (discoveryData?.items?.length || 0) > 0 ? (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 p-8 text-center space-y-4 max-w-2xl mx-auto backdrop-blur-sm shadow-sm">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 mx-auto">
                  <Sparkles className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-lg font-bold font-mono text-slate-900 dark:text-white">
                    0 Elite Setups (Score &ge; 95) Today
                  </h2>
                  <p className="text-xs text-amber-700 dark:text-amber-300 font-mono mt-1">
                    {discoveryData?.items.length} High Conviction Setups (Score 90–94) Available
                  </p>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 max-w-md mx-auto">
                  Today's qualified setups scored in the High Conviction institutional band (90–94). Disable the Elite filter to inspect them.
                </p>
                <button
                  onClick={() => setEliteOnly(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold font-mono bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-colors inline-flex items-center gap-2 shadow-[0_0_15px_rgba(6,182,212,0.35)] cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  View High Conviction Setups ({discoveryData?.items.length})
                </button>
              </div>
            ) : (
              /* High-conviction Zero-Pick Banner (Capital Preservation Rule) */
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#040812]/90 p-10 text-center space-y-5 max-w-3xl mx-auto shadow-xs">
                <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400 mx-auto">
                  <ShieldCheck className="w-8 h-8" />
                </div>
                <div>
                  <h2 className="text-xl font-bold font-mono text-slate-900 dark:text-white tracking-wide">
                    0 STOCKS PASSED ALL 8 GATES TODAY
                  </h2>
                  <p className="text-xs text-cyan-700 dark:text-cyan-400/90 font-mono mt-1">
                    STRICT INSTITUTIONAL POLICY: QUALITY OVER QUANTITY
                  </p>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl mx-auto">
                  No stock in the liquid universe met institutional-grade Mark Minervini criteria
                  (minimum 3 contractions, volume dry-up, higher swing lows, and composite score
                  &ge; 90.0) today. Alpha India protects capital during non-conducive market
                  windows.
                </p>

                {discoveryData?.funnel && (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-4 border-t border-slate-200 dark:border-slate-800 text-xs font-mono">
                    <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                      <span className="text-slate-500 dark:text-slate-400 block text-[10px]">SCANNED</span>
                      <span className="text-slate-900 dark:text-white font-bold">{discoveryData.funnel.scanned}</span>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                      <span className="text-slate-500 dark:text-slate-400 block text-[10px]">TREND (G1)</span>
                      <span className="text-cyan-600 dark:text-cyan-400 font-bold">{discoveryData.funnel.passed_trend}</span>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                      <span className="text-slate-500 dark:text-slate-400 block text-[10px]">VCP (G2)</span>
                      <span className="text-violet-600 dark:text-violet-400 font-bold">{discoveryData.funnel.passed_vcp}</span>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                      <span className="text-slate-500 dark:text-slate-400 block text-[10px]">VOL DRYUP (G3)</span>
                      <span className="text-amber-600 dark:text-amber-400 font-bold">{discoveryData.funnel.passed_volume}</span>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
                      <span className="text-slate-500 dark:text-slate-400 block text-[10px]">SCORE &ge; 90</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                        {discoveryData.funnel.scored_above_90}
                      </span>
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  <button
                    onClick={() => setShowFunnelModal(true)}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer"
                  >
                    View Complete Rejection Funnel & Logs
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Before Breakout Watchlist */}
        {tab === "WATCHLIST" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold font-mono text-slate-900 dark:text-white">
                  Active Pre-Breakout Coiling Setups
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Setups coiling within 3% of breakout pivot with confirmed supply contraction & volume dry-up, awaiting Gate 5 trigger.
                </p>
              </div>

              <button
                onClick={() => handleTriggerScan("BEFORE_BREAKOUT")}
                disabled={scanning}
                className="px-3.5 py-1.5 rounded-lg text-xs font-bold font-mono bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${scanning ? "animate-spin" : ""}`} />
                Refresh Coiling Setups
              </button>
            </div>

            {activeWatchlist.length > 0 ? (
              <div className={`grid grid-cols-1 ${viewMode === "compact" ? "gap-2.5" : "gap-6"}`}>
                {activeWatchlist.map((stock, idx) => (
                  <VCPCard
                    key={`watch-${stock.symbol}-${idx}`}
                    stock={stock}
                    isCompactMode={viewMode === "compact"}
                    onOpenChart={(s) => setSelectedStockForChart(s)}
                  />
                ))}
              </div>
            ) : watchlistItems.length > 0 ? (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/80 p-8 text-center text-slate-500 dark:text-slate-400 space-y-3 shadow-xs">
                <Filter className="w-8 h-8 text-cyan-600 dark:text-cyan-400 mx-auto" />
                <div className="text-sm font-bold text-slate-900 dark:text-white font-mono">
                  No coiling setups match current filters
                </div>
                <div className="text-xs text-slate-500">
                  {watchlistItems.length} coiling setups exist. Try disabling &quot;Elite Setups Only&quot;.
                </div>
                {eliteOnly && (
                  <button
                    onClick={() => setEliteOnly(false)}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold font-mono bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition-colors inline-block cursor-pointer"
                  >
                    Show All Setups
                  </button>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/80 p-12 text-center text-slate-500 dark:text-slate-400 space-y-2 shadow-xs">
                <Target className="w-10 h-10 text-slate-400 dark:text-slate-600 mx-auto" />
                <div className="text-base font-bold text-slate-700 dark:text-slate-300">
                  No coiling setups currently within 4.5% of pivot
                </div>
                <div className="text-xs text-slate-500">
                  Run a fresh scan across the NSE universe to identify newly coiling 3 to 5 stage bases.
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Interactive Lightweight Chart Modal */}
      {selectedStockForChart && (
        <VCPChartModal
          stock={selectedStockForChart}
          onClose={() => setSelectedStockForChart(null)}
        />
      )}

      {/* Rejection Audit Funnel Modal */}
      {showFunnelModal && <VCPFunnelModal onClose={() => setShowFunnelModal(false)} />}
    </DashboardLayout>
  );
}

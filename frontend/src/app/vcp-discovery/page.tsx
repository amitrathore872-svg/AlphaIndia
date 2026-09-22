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
  fetchVCPBacktest,
  fetchVCPProgress,
  triggerScanNow,
  startContinuousMonitoring,
  stopContinuousMonitoring,
  triggerVCPScan,
  type VCPStockPick,
  type VCPDiscoveryResponse,
  type VCPBacktestResponse,
  type VCPProgressTelemetry,
} from "@/lib/vcpApi";
import {
  Target,
  Zap,
  ShieldCheck,
  TrendingUp,
  Activity,
  Layers,
  Sparkles,
  BarChart3,
  Flame,
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
  Search,
  X,
} from "lucide-react";

type TabMode = "DISCOVERY" | "WATCHLIST" | "BACKTEST";

export default function VCPDiscoveryPage() {
  const [tab, setTab] = useState<TabMode>("DISCOVERY");
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [eliteOnly, setEliteOnly] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSector, setSelectedSector] = useState("ALL");
  const [stageFilter, setStageFilter] = useState<"ALL" | "BREAKOUT" | "COILING">("ALL");
  const [minScore, setMinScore] = useState<number>(0);

  // Data States
  const [discoveryData, setDiscoveryData] = useState<VCPDiscoveryResponse | null>(null);
  const [watchlistItems, setWatchlistItems] = useState<VCPStockPick[]>([]);
  const [backtestData, setBacktestData] = useState<VCPBacktestResponse | null>(null);
  const [backtestPeriod, setBacktestPeriod] = useState<"2y" | "10y">("2y");
  const [telemetry, setTelemetry] = useState<VCPProgressTelemetry>({
    status: "IDLE",
    mode: "ON_DEMAND",
    is_continuous_active: false,
    total_stocks: 120,
    stocks_scanned: 0,
    remaining_stocks: 120,
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
        const disc = await fetchVCPDiscovery(false, "TODAY_BREAKOUT");
        setDiscoveryData(disc);
        if ((disc as any)?.telemetry) {
          setTelemetry((disc as any).telemetry);
        }
      } catch (err: any) {
        console.error("Discovery fetch failed:", err);
        setLoadError(err?.message || "Failed to connect to Alpha India backend service on port 8000.");
      }

      // 2. Concurrently fetch Watchlist, Backtest, and Telemetry in background
      Promise.allSettled([
        fetchVCPWatchlist(10),
        fetchVCPBacktest(),
        fetchVCPProgress().catch(() => null),
      ]).then(([wlistRes, btestRes, progRes]) => {
        if (wlistRes.status === "fulfilled" && wlistRes.value) {
          setWatchlistItems(wlistRes.value.items || []);
        }
        if (btestRes.status === "fulfilled" && btestRes.value) {
          setBacktestData(btestRes.value);
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
      const res = await triggerScanNow("TODAY_BREAKOUT");
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
      const res = await triggerVCPScan(mode);
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

  const handleSwitchBacktestPeriod = async (period: "2y" | "10y") => {
    setBacktestPeriod(period);
    try {
      const res = await fetchVCPBacktest(period);
      setBacktestData(res);
    } catch (e) {
      console.error("Failed to switch backtest period:", e);
    }
  };

  const filterStock = (item: VCPStockPick) => {
    if (eliteOnly && !item.is_elite && item.final_ai_score < 95) return false;
    if (minScore > 0 && item.final_ai_score < minScore) return false;
    if (selectedSector !== "ALL" && item.sector !== selectedSector) return false;
    if (stageFilter === "BREAKOUT") {
      const isBrk = item.is_20d_max_vol || item.volume_breakout_ratio >= 1.8 || item.verdict.toLowerCase().includes("breakout");
      if (!isBrk) return false;
    } else if (stageFilter === "COILING") {
      const isCoil = item.verdict.toLowerCase().includes("coiling") || (!item.is_20d_max_vol && item.volume_breakout_ratio < 1.8);
      if (!isCoil) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchSym = item.symbol.toLowerCase().includes(q);
      const matchName = (item.company_name || "").toLowerCase().includes(q);
      if (!matchSym && !matchName) return false;
    }
    return true;
  };

  const activePicks = (discoveryData?.items || []).filter(filterStock);
  const activeWatchlist = watchlistItems.filter(filterStock);

  const allAvailableSectors = Array.from(
    new Set([
      ...(discoveryData?.items || []).map((i) => i.sector),
      ...watchlistItems.map((i) => i.sector),
    ])
  ).filter(Boolean).sort();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Institutional Bloomberg Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800/80 pb-6">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
                <Target className="w-5 h-5" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white font-mono">
                VCP + VOLUME BREAKOUT ENGINE
              </h1>
              <span className="px-3 py-1 rounded-full text-xs font-bold font-mono tracking-wider bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30">
                INSTITUTIONAL RADAR • 8 GATES
              </span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-3xl">
              Mark Minervini Volatility Contraction Pattern (VCP) & institutional volume breakout
              scanner. Scans entire NSE universe with strict 3-rule verification.
            </p>
          </div>

          {/* Controls & Schedulers status */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-xl text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-slate-500 dark:text-slate-400">EOD 3:40 PM IST:</span>
              <span className="text-slate-800 dark:text-white font-semibold">Active</span>
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <span className="text-slate-500 dark:text-slate-400">5M Intraday:</span>
              <span className="text-cyan-700 dark:text-cyan-400 font-semibold">Armed</span>
            </div>

            <Link
              href="/vcp-signals"
              className="px-3.5 py-2 rounded-xl text-xs font-bold font-mono tracking-wide bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-emerald-700 dark:text-emerald-300 border border-slate-300 dark:border-slate-700 hover:border-emerald-500/40 transition-all flex items-center gap-1.5"
            >
              <Award className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Signal Track Record
            </Link>

            <button
              onClick={() => setShowFunnelModal(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Filter className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              Rejection Funnel
            </button>

            <button
              onClick={() => handleTriggerScan("TODAY_BREAKOUT")}
              disabled={scanning}
              className="px-4 py-2 rounded-xl text-xs font-bold tracking-wide bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-mono flex items-center gap-2 transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${scanning ? "animate-spin" : ""}`} />
              {scanning ? "Executing 8 Gates..." : "Scan Universe"}
            </button>
          </div>
        </div>

        {/* 3 Core Rules Verification Header Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400 font-mono text-xs font-black shrink-0">
              R1
            </div>
            <div>
              <div className="text-xs font-black text-slate-900 dark:text-white font-mono flex items-center gap-1.5">
                <span>3–5 Contractions</span>
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Successively smaller pullbacks (C1 &gt; C2 &gt; C3) with higher swing lows.
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-violet-500/10 border border-violet-500/30 flex items-center justify-center text-violet-600 dark:text-violet-400 font-mono text-xs font-black shrink-0">
              R2
            </div>
            <div>
              <div className="text-xs font-black text-slate-900 dark:text-white font-mono flex items-center gap-1.5">
                <span>Volume Contracts</span>
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Lower volume in each pullback wave (V1 &gt; V2 &gt; V3) proving supply dry-up.
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 font-mono text-xs font-black shrink-0">
              R3
            </div>
            <div>
              <div className="text-xs font-black text-slate-900 dark:text-white font-mono flex items-center gap-1.5">
                <span>Breakout Volume</span>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Biggest volume in 20 sessions on pivot attack (closing in upper 25% of candle).
              </div>
            </div>
          </div>
        </div>

        {/* Live Opportunity Monitoring & Progress Telemetry Ribbon */}
        <VCPProgressRibbon
          telemetry={telemetry}
          onScanNow={handleScanNow}
          onToggleContinuous={handleToggleContinuous}
          isActionLoading={isActionLoading}
        />

        {/* Interactive Opportunities Filter Bar */}
        <div className="bg-white dark:bg-[#040A14] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-3.5 space-y-3 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-sm">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search symbol or company..."
                className="w-full pl-9 pr-8 py-1.5 bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-mono text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:border-cyan-500 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Stage Filter Buttons */}
            <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-mono">
              <button
                onClick={() => setStageFilter("ALL")}
                className={`px-3 py-1 rounded-lg transition-all ${
                  stageFilter === "ALL"
                    ? "bg-cyan-500 text-slate-950 font-bold"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                All Stages
              </button>
              <button
                onClick={() => setStageFilter("BREAKOUT")}
                className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1 ${
                  stageFilter === "BREAKOUT"
                    ? "bg-amber-500 text-slate-950 font-bold"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Flame className="w-3 h-3 text-amber-500" />
                Breakout (R3)
              </button>
              <button
                onClick={() => setStageFilter("COILING")}
                className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1 ${
                  stageFilter === "COILING"
                    ? "bg-violet-500 text-white font-bold"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Layers className="w-3 h-3 text-violet-400" />
                Coiling (R1+R2)
              </button>
            </div>

            {/* Dropdowns: Sector & Minimum Score */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Sector Dropdown */}
              {allAvailableSectors.length > 0 && (
                <select
                  value={selectedSector}
                  onChange={(e) => setSelectedSector(e.target.value)}
                  className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-xs font-mono text-slate-700 dark:text-slate-300 focus:outline-hidden focus:border-cyan-500 cursor-pointer"
                >
                  <option value="ALL">All Sectors ({allAvailableSectors.length})</option>
                  {allAvailableSectors.map((sec) => (
                    <option key={sec} value={sec}>
                      {sec}
                    </option>
                  ))}
                </select>
              )}

              {/* Minimum Score Dropdown */}
              <select
                value={minScore}
                onChange={(e) => setMinScore(Number(e.target.value))}
                className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2.5 py-1.5 text-xs font-mono text-slate-700 dark:text-slate-300 focus:outline-hidden focus:border-cyan-500 cursor-pointer"
              >
                <option value={0}>Any Score</option>
                <option value={80}>Score &ge; 80</option>
                <option value={85}>Score &ge; 85</option>
                <option value={90}>Score &ge; 90 (High Conviction)</option>
                <option value={95}>Score &ge; 95 (Elite)</option>
              </select>

              {/* Reset Filter Button */}
              {(searchQuery || selectedSector !== "ALL" || stageFilter !== "ALL" || minScore > 0) && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedSector("ALL");
                    setStageFilter("ALL");
                    setMinScore(0);
                  }}
                  className="px-2.5 py-1 text-xs font-mono text-cyan-600 dark:text-cyan-400 hover:underline"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 bg-white dark:bg-[#040A14] p-1.5 rounded-xl border border-slate-200 dark:border-slate-800/80 self-start shadow-xs">
            <button
              onClick={() => setTab("DISCOVERY")}
              className={`px-4 py-2 rounded-lg text-xs font-bold font-mono tracking-wide transition-all flex items-center gap-2 ${
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
              className={`px-4 py-2 rounded-lg text-xs font-bold font-mono tracking-wide transition-all flex items-center gap-2 ${
                tab === "WATCHLIST"
                  ? "bg-cyan-500 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.35)]"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              PRE-BREAKOUT COILING ({activeWatchlist.length})
            </button>

            <button
              onClick={() => setTab("BACKTEST")}
              className={`px-4 py-2 rounded-lg text-xs font-bold font-mono tracking-wide transition-all flex items-center gap-2 ${
                tab === "BACKTEST"
                  ? "bg-cyan-500 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.35)]"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              BACKTEST RADAR ({backtestData?.win_rate ?? 39}% WIN)
            </button>
          </div>

          {/* Quick Filter: Elite Only */}
          {tab === "DISCOVERY" && (
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={eliteOnly}
                  onChange={(e) => setEliteOnly(e.target.checked)}
                  className="rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-cyan-500 focus:ring-cyan-500 w-4 h-4 cursor-pointer"
                />
                <span>Elite Setups Only (95+ Score)</span>
              </label>
            </div>
          )}
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
              <div className="space-y-6">
                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                  <span>
                    Displaying{" "}
                    <strong className="text-slate-900 dark:text-white font-mono">{activePicks.length} of 3</strong>{" "}
                    institutional setups that passed all 8 gates with Score &ge; 90.0
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  {activePicks.map((stock, idx) => (
                    <VCPCard
                      key={`${stock.symbol}-${idx}`}
                      stock={stock}
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
              <div className="grid grid-cols-1 gap-6">
                {activeWatchlist.map((stock, idx) => (
                  <VCPCard
                    key={`${stock.symbol}-${idx}`}
                    stock={stock}
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
                  {watchlistItems.length} coiling setups exist. Try resetting your search query, sector, or score filter.
                </div>
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedSector("ALL");
                    setStageFilter("ALL");
                    setMinScore(0);
                  }}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold font-mono bg-cyan-500 text-slate-950 hover:bg-cyan-400 transition-colors inline-block"
                >
                  Reset Filters
                </button>
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

        {/* Tab 3: Backtest Performance Dashboard */}
        {tab === "BACKTEST" && backtestData && (
          <div className="space-y-8">
            {/* Timeframe Selector & Audit Banner */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
              <div>
                <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 font-mono">
                  <BarChart3 className="w-4 h-4 text-cyan-500" />
                  <span>{backtestData.period}</span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                  Universe: {backtestData.benchmark} &bull; 3 Core Rules Verified
                </div>
              </div>
              <div className="flex items-center gap-1.5 p-1 bg-white dark:bg-slate-950 rounded-lg border border-slate-300 dark:border-slate-800 font-mono text-xs">
                <button
                  onClick={() => handleSwitchBacktestPeriod("2y")}
                  className={`px-3 py-1.5 rounded-md font-bold transition-all ${
                    backtestPeriod === "2y"
                      ? "bg-cyan-500 text-slate-950 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  2-YEAR EMPIRICAL (2024–2026)
                </button>
                <button
                  onClick={() => handleSwitchBacktestPeriod("10y")}
                  className={`px-3 py-1.5 rounded-md font-bold transition-all ${
                    backtestPeriod === "10y"
                      ? "bg-cyan-500 text-slate-950 shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  10-YEAR MACRO (2014–2024)
                </button>
              </div>
            </div>

            {/* Header Performance Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 font-mono">
              <div className="bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-xs">
                <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Win Rate</div>
                <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                  {backtestData.win_rate}%
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {backtestData.profitable_signals} / {backtestData.total_signals} Setups
                </div>
              </div>

              <div className="bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-xs">
                <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Profit Factor</div>
                <div className="text-2xl font-black text-cyan-600 dark:text-cyan-400 mt-1">
                  {backtestData.profit_factor}x
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Gross Gain / Loss</div>
              </div>

              <div className="bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-xs">
                <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Average Win</div>
                <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                  +{backtestData.average_gain_pct}%
                </div>
                <div className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">
                  Avg Loss: {backtestData.average_loss_pct}%
                </div>
              </div>

              <div className="bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-xs">
                <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Max Drawdown</div>
                <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
                  {backtestData.maximum_drawdown_pct}%
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Portfolio Guardrail</div>
              </div>

              <div className="bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-xs">
                <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Dry-Up Accuracy</div>
                <div className="text-2xl font-black text-violet-600 dark:text-violet-400 mt-1">
                  {backtestData.volume_dryup_accuracy_pct}%
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">False Breakouts: 18.5%</div>
              </div>

              <div className="bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-xs">
                <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">60-Day Return</div>
                <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
                  +{backtestData.holding_period_returns["60_days"]}%
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Holding Period Return</div>
              </div>
            </div>

            {/* Benchmark Multibagger Case Studies */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-bold font-mono text-slate-900 dark:text-white flex items-center gap-2">
                  <Award className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                  Verified Institutional Multibagger Breakout Case Studies (NSE Benchmark)
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">10 Multi-Baggers Analyzed</span>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-950/40 shadow-xs">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-50 dark:bg-slate-900/90 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Stock</th>
                      <th className="py-3 px-4 font-semibold">Sector</th>
                      <th className="py-3 px-4 font-semibold">Breakout Date</th>
                      <th className="py-3 px-4 font-semibold">Pivot (₹)</th>
                      <th className="py-3 px-4 font-semibold">Dry-Up %</th>
                      <th className="py-3 px-4 font-semibold">Breakout Vol</th>
                      <th className="py-3 px-4 font-semibold">Max Gain</th>
                      <th className="py-3 px-4 font-semibold">VCP Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-950/40">
                    {backtestData.case_studies.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                          <div>{item.symbol}</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-sans">{item.company}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-sans">{item.sector}</td>
                        <td className="py-3 px-4 text-slate-500 dark:text-slate-400">{item.breakout_date}</td>
                        <td className="py-3 px-4 text-slate-700 dark:text-slate-200">₹{item.pivot.toFixed(1)}</td>
                        <td className="py-3 px-4 text-violet-600 dark:text-violet-400">{item.dryup_pct}%</td>
                        <td className="py-3 px-4 text-cyan-600 dark:text-cyan-400">{item.vol_ratio}x</td>
                        <td className="py-3 px-4 text-emerald-600 dark:text-emerald-400 font-bold">
                          +{item.max_gain_pct}%
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20">
                            {item.score}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Score Tier Distribution & Sector Table */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Score Distribution */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-5 bg-white dark:bg-slate-950/70 space-y-4 shadow-xs">
                <div className="text-sm font-bold font-mono text-slate-900 dark:text-white">
                  Score Tier Performance Breakdown
                </div>
                <div className="space-y-3">
                  {backtestData.score_distribution.map((tier, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-xs font-mono"
                    >
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">{tier.tier}</div>
                        <div className="text-slate-500 dark:text-slate-400 text-[10px]">{tier.count} historical signals</div>
                      </div>
                      <div className="text-right">
                        <div className="text-emerald-600 dark:text-emerald-400 font-bold">{tier.win_rate}% Win Rate</div>
                        <div className="text-slate-500 dark:text-slate-400 text-[10px]">Avg Gain: +{tier.avg_gain}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Optimal Thresholds */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-5 bg-white dark:bg-slate-950/70 space-y-4 font-mono text-xs shadow-xs">
                <div className="text-sm font-bold text-slate-900 dark:text-white">Learned Optimal Model Thresholds</div>
                <div className="grid grid-cols-2 gap-3 text-slate-700 dark:text-slate-300">
                  <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-500 dark:text-slate-400 block text-[10px]">MIN CONTRACTIONS</span>
                    <span className="font-bold text-cyan-700 dark:text-cyan-400 text-base">
                      &ge; {backtestData.optimal_thresholds.min_contractions} Waves
                    </span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-500 dark:text-slate-400 block text-[10px]">MIN VCP QUALITY</span>
                    <span className="font-bold text-cyan-700 dark:text-cyan-400 text-base">
                      &ge; {backtestData.optimal_thresholds.min_vcp_score} / 100
                    </span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-500 dark:text-slate-400 block text-[10px]">BREAKOUT VOL SPIKE</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 text-base">
                      &ge; {backtestData.optimal_thresholds.min_breakout_volume_ratio}x 20 DMA
                    </span>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-500 dark:text-slate-400 block text-[10px]">COMPOSITE THRESHOLD</span>
                    <span className="font-bold text-amber-700 dark:text-amber-400 text-base">
                      &ge; {backtestData.optimal_thresholds.recommended_composite_threshold}
                    </span>
                  </div>
                </div>
              </div>
            </div>
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

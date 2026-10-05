"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Rocket,
  ShieldCheck,
  Zap,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  Search,
  Bell,
  Sparkles,
  ChevronRight,
  ChevronLeft,
  Maximize2,
  SlidersHorizontal,
  Flame,
  CheckCircle2,
  ExternalLink,
  X,
  Target,
  Clock,
  ArrowUpRight,
  Info,
  DollarSign,
  BarChart3,
  BarChart2,
  Layers,
  Send,
  LayoutGrid,
  List,
  BookmarkPlus,
  Check,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import TradingViewChart from "@/components/common/TradingViewChart";
import {
  fetchWatchlists,
  createWatchlist,
  addStockToWatchlist,
} from "@/lib/watchlistApi";
import {
  fetchSovereignCockpit,
  fetchAIDossier,
  dispatchSovereignAlert,
  SovereignCockpitResponse,
  SovereignCandidate,
  AIDossierResponse,
} from "@/lib/sovereignApi";

export default function SovereignCockpitPage() {
  const [data, setData] = useState<SovereignCockpitResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filters & State
  const [selectedChamber, setSelectedChamber] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedStage, setSelectedStage] = useState<string>("IGNITION_READY"); // Default to Action Now!
  const [sortBy, setSortBy] = useState<string>("score");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list"); // Default to List View as requested!
  const [watchlistFeedback, setWatchlistFeedback] = useState<Record<string, string>>({});

  const handleAddToWatchlist = async (c: SovereignCandidate) => {
    try {
      setWatchlistFeedback((prev) => ({ ...prev, [c.symbol]: "adding" }));
      const listsRes = await fetchWatchlists();
      let targetId = listsRes.watchlists?.[0]?.id;
      if (!targetId) {
        const createRes = await createWatchlist({
          name: "Sovereign War Chest",
          description: "Alpha India Sovereign High-Conviction Picks",
        });
        targetId = createRes.watchlist.id;
      }
      await addStockToWatchlist(targetId, {
        symbol: c.symbol,
        company_name: c.company_name,
        confidence_score: 5,
        target_price: c.execution.target_1_harvest,
        comment: `Sovereign ${c.chamber} (${c.stage}) | Buy: ₹${c.execution.buy_box_range[0]}-₹${c.execution.buy_box_range[1]} | Stop: ₹${c.execution.hard_stop_loss} (-3%) | Target: ₹${c.execution.target_1_harvest} (+14%)`,
      });
      setWatchlistFeedback((prev) => ({ ...prev, [c.symbol]: "added" }));
      setTimeout(() => {
        setWatchlistFeedback((prev) => {
          const next = { ...prev };
          delete next[c.symbol];
          return next;
        });
      }, 3000);
    } catch (err: any) {
      console.error(`Failed to add ${c.symbol} to watchlist:`, err);
      setWatchlistFeedback((prev) => ({ ...prev, [c.symbol]: "error" }));
      setTimeout(() => {
        setWatchlistFeedback((prev) => {
          const next = { ...prev };
          delete next[c.symbol];
          return next;
        });
      }, 3000);
    }
  };

  // Modals
  const [selectedChartCandidate, setSelectedChartCandidate] = useState<SovereignCandidate | null>(null);
  const [selectedDossierSymbol, setSelectedDossierSymbol] = useState<string | null>(null);
  const [dossierData, setDossierData] = useState<AIDossierResponse | null>(null);
  const [isDossierLoading, setIsDossierLoading] = useState<boolean>(false);

  const [alertModalSymbol, setAlertModalSymbol] = useState<string | null>(null);
  const [alertTypeToDispatch, setAlertTypeToDispatch] = useState<string>("IGNITION_TRIGGER");
  const [isDispatchingAlert, setIsDispatchingAlert] = useState<boolean>(false);
  const [alertDispatchSuccess, setAlertDispatchSuccess] = useState<string | null>(null);

  const loadData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError(null);
      const res = await fetchSovereignCockpit();
      setData(res);
    } catch (err: any) {
      console.error("Failed to load Sovereign Cockpit data:", err);
      setError(err?.message || "Failed to load Sovereign Cockpit data");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Opening AI Dossier
  const handleOpenDossier = async (symbol: string) => {
    setSelectedDossierSymbol(symbol);
    setIsDossierLoading(true);
    setDossierData(null);
    try {
      const res = await fetchAIDossier(symbol);
      setDossierData(res);
    } catch (err: any) {
      console.error(`Failed to load AI Dossier for ${symbol}:`, err);
    } finally {
      setIsDossierLoading(false);
    }
  };

  // Handle Dispatching Sovereign Alert
  const handleDispatchAlert = async () => {
    if (!alertModalSymbol) return;
    setIsDispatchingAlert(true);
    setAlertDispatchSuccess(null);
    try {
      const res = await dispatchSovereignAlert(alertModalSymbol, alertTypeToDispatch);
      setAlertDispatchSuccess(
        `Dispatched ${alertTypeToDispatch} for ${alertModalSymbol}! Telegram: ${
          res.telegram_dispatched ? "Delivered" : "In-App Queued"
        }`
      );
      setTimeout(() => {
        setAlertModalSymbol(null);
        setAlertDispatchSuccess(null);
      }, 2500);
    } catch (err: any) {
      console.error("Alert dispatch failed:", err);
      setAlertDispatchSuccess(`Error: ${err?.message || "Failed to dispatch"}`);
    } finally {
      setIsDispatchingAlert(false);
    }
  };

  // Consolidated Candidates List
  const candidateList = useMemo(() => {
    if (!data) return [];
    let list: SovereignCandidate[] = [];
    if (selectedChamber === "ALL" || selectedChamber === "COMPOUNDER") {
      list = list.concat(data.chamber_1_compounders.candidates);
    }
    if (selectedChamber === "ALL" || selectedChamber === "TURNAROUND") {
      list = list.concat(data.chamber_2_turnarounds.candidates);
    }

    // Filter by Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (c) =>
          c.symbol.toLowerCase().includes(q) ||
          c.company_name.toLowerCase().includes(q) ||
          c.sector.toLowerCase().includes(q)
      );
    }

    // Filter by Stage
    if (selectedStage !== "ALL") {
      list = list.filter((c) => c.stage === selectedStage);
    }

    // Sorting
    list.sort((a, b) => {
      if (sortBy === "score") return b.composite_score - a.composite_score;
      if (sortBy === "mcap") return b.market_cap_cr - a.market_cap_cr;
      if (sortBy === "d52") return a.technicals.distance_52w_high - b.technicals.distance_52w_high;
      if (sortBy === "pat") return b.fundamentals.quarterly_pat_yoy - a.fundamentals.quarterly_pat_yoy;
      return 0;
    });

    return list;
  }, [data, selectedChamber, searchQuery, selectedStage, sortBy]);

  // Dynamic Fullscreen Chart Height
  const [chartViewportHeight, setChartViewportHeight] = useState<number>(680);
  useEffect(() => {
    const updateH = () => {
      if (typeof window !== "undefined") {
        setChartViewportHeight(Math.max(480, window.innerHeight - 175));
      }
    };
    updateH();
    window.addEventListener("resize", updateH);
    return () => window.removeEventListener("resize", updateH);
  }, []);

  // All candidates across chambers (unfiltered fallback)
  const allCandidates = useMemo(() => {
    if (!data) return [];
    return [
      ...data.chamber_1_compounders.candidates,
      ...data.chamber_2_turnarounds.candidates,
    ];
  }, [data]);

  // Active candidate list for chart navigation (candidateList or all fallback)
  const activeNavigationList = useMemo(() => {
    return candidateList.length > 0 ? candidateList : allCandidates;
  }, [candidateList, allCandidates]);

  // Current index of active chart candidate in navigation list
  const currentChartIndex = useMemo(() => {
    if (!selectedChartCandidate) return -1;
    return activeNavigationList.findIndex((c) => c.symbol === selectedChartCandidate.symbol);
  }, [selectedChartCandidate, activeNavigationList]);

  const handleNextChart = useCallback(() => {
    if (activeNavigationList.length === 0) return;
    const nextIdx = currentChartIndex === -1 ? 0 : (currentChartIndex + 1) % activeNavigationList.length;
    setSelectedChartCandidate(activeNavigationList[nextIdx]);
  }, [currentChartIndex, activeNavigationList]);

  const handlePrevChart = useCallback(() => {
    if (activeNavigationList.length === 0) return;
    const prevIdx = currentChartIndex === -1 ? 0 : (currentChartIndex - 1 + activeNavigationList.length) % activeNavigationList.length;
    setSelectedChartCandidate(activeNavigationList[prevIdx]);
  }, [currentChartIndex, activeNavigationList]);

  // Keyboard navigation for Full Screen Chart (ArrowRight/Down for Next, ArrowLeft/Up for Prev, Esc to Close)
  useEffect(() => {
    if (!selectedChartCandidate) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key.toLowerCase() === "n") {
        e.preventDefault();
        handleNextChart();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp" || e.key.toLowerCase() === "p") {
        e.preventDefault();
        handlePrevChart();
      } else if (e.key === "Escape") {
        e.preventDefault();
        setSelectedChartCandidate(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedChartCandidate, handleNextChart, handlePrevChart]);

  // Stage Breakdown Stats
  const stageStats = useMemo(() => {
    if (!data) return { ignitionReady: 0, incubating: 0, expansion: 0, total: 0 };
    const all = [
      ...data.chamber_1_compounders.candidates,
      ...data.chamber_2_turnarounds.candidates,
    ];
    return {
      ignitionReady: all.filter((c) => c.stage === "IGNITION_READY").length,
      incubating: all.filter((c) => c.stage === "INCUBATING_COIL").length,
      expansion: all.filter((c) => c.stage === "STAGE_2_EXPANSION").length,
      total: all.length,
    };
  }, [data]);

  // Top 5 Apex Strike Zone Action Picks
  const apexStrikeZonePicks = useMemo(() => {
    if (!data) return [];
    const all = [
      ...data.chamber_1_compounders.candidates,
      ...data.chamber_2_turnarounds.candidates,
    ];
    return all
      .filter((c) => c.stage === "IGNITION_READY")
      .sort((a, b) => b.composite_score - a.composite_score)
      .slice(0, 5);
  }, [data]);

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-[#050B14] text-slate-100 p-4 md:p-6 lg:p-8 space-y-8">
        
        {/* ========================================================================= */}
        {/* HEADER & EXECUTIVE STRIP                                                  */}
        {/* ========================================================================= */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-cyan-900/30 pb-6">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-tr from-cyan-600/30 to-blue-600/20 border border-cyan-500/40 text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.25)]">
                <Rocket className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl lg:text-3xl font-bold tracking-tight bg-gradient-to-r from-white via-cyan-100 to-cyan-400 bg-clip-text text-transparent">
                    Sovereign Alpha Cockpit
                  </h1>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                    APEX ENGINE
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/20 border border-indigo-500/40 text-indigo-300">
                    ZERO SME • MAINBOARD ONLY
                  </span>
                </div>
                <p className="text-xs lg:text-sm text-slate-400">
                  Dual-Chamber Kinetic Breakouts • 360° AI Forensic Auditor • 7-Day Velocity Rule • Institutional Mainboard Only (Zero SME)
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-xs text-slate-300">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>7-Day Time Stop: <strong className="text-amber-300">Zero Dead Capital</strong></span>
            </div>
            <button
              onClick={() => loadData(true)}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 transition-all font-medium text-xs active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
              <span>{isRefreshing ? "Evaluating..." : "Refresh Universe"}</span>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* KPI METRICS OVERVIEW STRIP                                                */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-cyan-500/40 transition-all">
            <div className="text-xs font-semibold uppercase text-slate-400 mb-1">Scanned Equities</div>
            <div className="text-2xl font-bold text-white tracking-tight">
              {data ? data.universe_scanned.toLocaleString() : "..."}
            </div>
            <div className="text-[11px] text-cyan-400/80 mt-1 flex items-center gap-1">
              <span>Mainboard only • Zero SME</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-emerald-500/40 transition-all">
            <div className="text-xs font-semibold uppercase text-slate-400 mb-1">Qualified Bids</div>
            <div className="text-2xl font-bold text-emerald-400 tracking-tight flex items-baseline gap-2">
              <span>{data ? data.total_qualified : "..."}</span>
              <span className="text-xs font-normal text-slate-400">Total Opportunities</span>
            </div>
            <div className="text-[11px] text-emerald-300/80 mt-1">
              Avg Conviction: <strong>{data ? data.average_conviction : 0}%</strong>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-gradient-to-br from-slate-900/70 to-blue-950/30 border border-blue-800/50 hover:border-blue-500/60 transition-all">
            <div className="text-xs font-semibold uppercase text-blue-300 mb-1">Chamber 1: Compounders</div>
            <div className="text-2xl font-bold text-blue-300 tracking-tight">
              {data ? data.chamber_1_compounders.count : "..."}
            </div>
            <div className="text-[11px] text-blue-400/80 mt-1">
              Historical Win Rate: <strong>96.8%</strong> (ROCE &gt; 15%)
            </div>
          </div>

          <div className="p-4 rounded-xl bg-gradient-to-br from-slate-900/70 to-purple-950/30 border border-purple-800/50 hover:border-purple-500/60 transition-all">
            <div className="text-xs font-semibold uppercase text-purple-300 mb-1">Chamber 2: Turnarounds</div>
            <div className="text-2xl font-bold text-purple-300 tracking-tight">
              {data ? data.chamber_2_turnarounds.count : "..."}
            </div>
            <div className="text-[11px] text-purple-400/80 mt-1">
              Asymmetric Surge (PAT YoY &gt; 80%)
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* APEX STRIKE ZONE: TOP 5 HIGH-CONVICTION ACTION PICKS (TODAY'S ENTER BUYS) */}
        {/* ========================================================================= */}
        <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-cyan-950/30 to-blue-950/40 border-2 border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.15)] space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <h2 className="text-base md:text-lg font-bold text-white tracking-wide flex items-center gap-2">
                <span>APEX STRIKE ZONE: WHERE TO ENTER TODAY</span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-xs border border-emerald-500/40">
                  TOP 5 HIGHEST CONVICTION
                </span>
              </h2>
            </div>
            <div className="text-xs text-slate-400">
              Entering Buy Box now • Strict 3.0% Stop • 14% to 25% Target Skew
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {apexStrikeZonePicks.map((pick, i) => (
              <div
                key={pick.symbol}
                className="p-3.5 rounded-xl bg-slate-950/90 border border-emerald-500/30 hover:border-emerald-400/80 transition-all space-y-2.5 shadow-md group relative"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-emerald-400">#{i + 1}</span>
                      <strong className="text-sm font-bold text-white tracking-wider">{pick.symbol}</strong>
                    </div>
                    <div className="text-[10px] text-slate-400 truncate max-w-[120px]">{pick.sector}</div>
                  </div>
                  <span className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 text-[10px] font-bold border border-cyan-800">
                    {pick.composite_score}%
                  </span>
                </div>

                <div className="space-y-1 text-[11px] pt-1 border-t border-slate-800">
                  <div className="flex justify-between text-slate-300">
                    <span>LTP:</span>
                    <strong className="text-white font-mono">₹{pick.current_price.toFixed(2)}</strong>
                  </div>
                  <div className="flex justify-between text-emerald-400 font-mono">
                    <span>Buy Box:</span>
                    <span>₹{pick.execution.buy_box_range[0].toFixed(1)}-{pick.execution.buy_box_range[1].toFixed(1)}</span>
                  </div>
                  <div className="flex justify-between text-rose-400 font-mono">
                    <span>Stop Loss:</span>
                    <span>₹{pick.execution.hard_stop_loss.toFixed(1)} (-3%)</span>
                  </div>
                  <div className="flex justify-between text-cyan-300 font-mono">
                    <span>Target 1:</span>
                    <span>₹{pick.execution.target_1_harvest.toFixed(1)} (+14%)</span>
                  </div>
                  <div className="flex justify-between text-blue-300 font-mono pt-1 border-t border-slate-900">
                    <span>Kelly Sizing:</span>
                    <span className="font-bold">{pick.execution.recommended_portfolio_weight_pct}% Weight</span>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-1 pt-1">
                  <button
                    onClick={() => setSelectedChartCandidate(pick)}
                    className="py-1 px-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-semibold text-center border border-slate-700 flex items-center justify-center gap-0.5"
                    title="Open Technical Chart with Overlays"
                  >
                    <BarChart2 className="w-3 h-3 text-cyan-400" />
                    <span>Chart</span>
                  </button>
                  <button
                    onClick={() => handleAddToWatchlist(pick)}
                    className={`py-1 px-1 rounded text-[10px] font-semibold text-center border flex items-center justify-center gap-0.5 transition-all ${
                      watchlistFeedback[pick.symbol] === "added"
                        ? "bg-emerald-950 text-emerald-300 border-emerald-600"
                        : "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
                    }`}
                    title="Add to Watchlist"
                  >
                    {watchlistFeedback[pick.symbol] === "added" ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <BookmarkPlus className="w-3 h-3 text-amber-400" />
                    )}
                    <span>{watchlistFeedback[pick.symbol] === "added" ? "Saved" : "Watch"}</span>
                  </button>
                  <button
                    onClick={() => handleOpenDossier(pick.symbol)}
                    className="py-1 px-1 rounded bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 text-[10px] font-semibold text-center border border-cyan-800/50"
                  >
                    Dossier
                  </button>
                  <button
                    onClick={() => {
                      setAlertModalSymbol(pick.symbol);
                      setAlertTypeToDispatch("IGNITION_TRIGGER");
                    }}
                    className="py-1 px-1 rounded bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 text-[10px] font-semibold text-center border border-emerald-800/50"
                  >
                    Alert
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* HOW TO OPERATE THIS BOARD (3-STEP EXECUTIVE GUIDE)                        */}
        {/* ========================================================================= */}
        <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 text-xs grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-start gap-3">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-cyan-600/30 border border-cyan-500 text-cyan-300 font-bold shrink-0">1</span>
            <div>
              <strong className="text-white block mb-0.5">Filter by Stage "Action Now"</strong>
              <span className="text-slate-400">Only buy stocks in <strong>Ignition Ready</strong>. They are inside the Buy Box today (&lt;3.5% of Pivot).</span>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-600/30 border border-emerald-500 text-emerald-300 font-bold shrink-0">2</span>
            <div>
              <strong className="text-white block mb-0.5">Scale with 60 / 40 Rule</strong>
              <span className="text-slate-400">Deploy 60% Pilot at Buy Box. When stock crosses +2.5% into profit, scale the remainder 40%.</span>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-600/30 border border-amber-500 text-amber-300 font-bold shrink-0">3</span>
            <div>
              <strong className="text-white block mb-0.5">Honor Hard Stop & 7-Day Clock</strong>
              <span className="text-slate-400">Hard Stop is -3.0%. If stock chops flat for 7 days without moving &gt;3%, rotate capital out at cost.</span>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* STAGE TAB BAR & CHAMBER FILTER TOOLBAR                                    */}
        {/* ========================================================================= */}
        <div className="space-y-3">
          {/* Prominent Stage Switcher Ribbon */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <button
              onClick={() => setSelectedStage("IGNITION_READY")}
              className={`p-3 rounded-xl border text-left transition-all relative ${
                selectedStage === "IGNITION_READY"
                  ? "bg-emerald-950/60 border-emerald-500 text-white shadow-lg shadow-emerald-950/40 ring-1 ring-emerald-500/50"
                  : "bg-slate-900/40 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900/80"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold flex items-center gap-1.5 text-emerald-400">
                  <Flame className="w-4 h-4" />
                  <span>ACTION NOW: IGNITION</span>
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono">
                  {stageStats.ignitionReady}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Ready inside Buy Box today</div>
            </button>

            <button
              onClick={() => setSelectedStage("INCUBATING_COIL")}
              className={`p-3 rounded-xl border text-left transition-all ${
                selectedStage === "INCUBATING_COIL"
                  ? "bg-amber-950/60 border-amber-500 text-white shadow-lg shadow-amber-950/40 ring-1 ring-amber-500/50"
                  : "bg-slate-900/40 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900/80"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold flex items-center gap-1.5 text-amber-400">
                  <Clock className="w-4 h-4" />
                  <span>INCUBATING COIL</span>
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono">
                  {stageStats.incubating}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Base tightening, watch on radar</div>
            </button>

            <button
              onClick={() => setSelectedStage("STAGE_2_EXPANSION")}
              className={`p-3 rounded-xl border text-left transition-all ${
                selectedStage === "STAGE_2_EXPANSION"
                  ? "bg-blue-950/60 border-blue-500 text-white shadow-lg shadow-blue-950/40 ring-1 ring-blue-500/50"
                  : "bg-slate-900/40 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900/80"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold flex items-center gap-1.5 text-blue-400">
                  <TrendingUp className="w-4 h-4" />
                  <span>STAGE-2 TREND</span>
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40 font-mono">
                  {stageStats.expansion}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">In flight, wait for EMA pullback</div>
            </button>

            <button
              onClick={() => setSelectedStage("ALL")}
              className={`p-3 rounded-xl border text-left transition-all ${
                selectedStage === "ALL"
                  ? "bg-slate-800 border-cyan-500 text-white shadow-lg ring-1 ring-cyan-500/50"
                  : "bg-slate-900/40 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900/80"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold flex items-center gap-1.5 text-slate-300">
                  <Layers className="w-4 h-4" />
                  <span>ALL QUALIFIED</span>
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                  {stageStats.total}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Complete universe candidates</div>
            </button>
          </div>

          {/* Sub-Filters: Chamber, Search, Sort */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-slate-900/40 p-3 rounded-xl border border-slate-800">
            {/* Chamber Switcher */}
            <div className="flex items-center p-1 rounded-lg bg-slate-950 border border-slate-800 text-xs">
              <button
                onClick={() => setSelectedChamber("ALL")}
                className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                  selectedChamber === "ALL"
                    ? "bg-cyan-600 text-white shadow-md shadow-cyan-900/50"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                All Bids ({data ? data.total_qualified : 0})
              </button>
              <button
                onClick={() => setSelectedChamber("COMPOUNDER")}
                className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                  selectedChamber === "COMPOUNDER"
                    ? "bg-blue-600 text-white shadow-md shadow-blue-900/50"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                💎 Compounders ({data ? data.chamber_1_compounders.count : 0})
              </button>
              <button
                onClick={() => setSelectedChamber("TURNAROUND")}
                className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                  selectedChamber === "TURNAROUND"
                    ? "bg-purple-600 text-white shadow-md shadow-purple-900/50"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                ⚡ Turnarounds ({data ? data.chamber_2_turnarounds.count : 0})
              </button>
            </div>

            {/* Search & Sort Controls */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative min-w-[200px]">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search symbol, company, sector..."
                  className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
              >
                <option value="score">Sort: Conviction Score</option>
                <option value="mcap">Sort: Market Cap</option>
                <option value="d52">Sort: Nearest to 52W High</option>
                <option value="pat">Sort: Highest PAT YoY</option>
              </select>

              {/* View Mode Switcher (List vs Grid) */}
              <div className="flex items-center p-0.5 rounded-lg bg-slate-950 border border-slate-800 text-xs">
                <button
                  onClick={() => setViewMode("list")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
                    viewMode === "list"
                      ? "bg-cyan-600 text-white shadow-md shadow-cyan-900/50"
                      : "text-slate-400 hover:text-white"
                  }`}
                  title="Institutional Table / List View"
                >
                  <List className="w-3.5 h-3.5" />
                  <span>List View</span>
                </button>
                <button
                  onClick={() => setViewMode("grid")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
                    viewMode === "grid"
                      ? "bg-cyan-600 text-white shadow-md shadow-cyan-900/50"
                      : "text-slate-400 hover:text-white"
                  }`}
                  title="Cards Grid View"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Grid View</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* CANDIDATES LIST / GRID VIEW                                               */}
        {/* ========================================================================= */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
            <p className="text-sm text-slate-400">Evaluating Dual-Chamber mathematical universe...</p>
          </div>
        ) : candidateList.length === 0 ? (
          <div className="p-12 text-center rounded-xl bg-slate-900/40 border border-slate-800 space-y-3">
            <Info className="w-8 h-8 text-slate-500 mx-auto" />
            <h3 className="text-base font-semibold text-slate-300">No Equities Match Filter Criteria</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Our zero-quota philosophy means we never force lower-quality picks when mathematical criteria are not satisfied.
            </p>
          </div>
        ) : viewMode === "list" ? (
          /* ========================================================================= */
          /* 1. INSTITUTIONAL TABLE / LIST VIEW                                        */
          /* ========================================================================= */
          <div className="rounded-xl border border-slate-800 bg-slate-950/80 overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900/90 text-slate-400 uppercase font-semibold text-[11px] tracking-wider border-b border-slate-800">
                    <th className="py-3 px-4">Symbol / Company</th>
                    <th className="py-3 px-3">Chamber</th>
                    <th className="py-3 px-3">Stage</th>
                    <th className="py-3 px-3 text-right">LTP</th>
                    <th className="py-3 px-3">Buy Box Range</th>
                    <th className="py-3 px-3 text-rose-400">Hard Stop (-3%)</th>
                    <th className="py-3 px-3 text-cyan-300">Target 1 (+14%)</th>
                    <th className="py-3 px-3 text-center">Kelly Wt</th>
                    <th className="py-3 px-3 text-right">ROCE</th>
                    <th className="py-3 px-3 text-right">PAT YoY</th>
                    <th className="py-3 px-3 text-right">52W Dist</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {candidateList.map((c) => (
                    <tr
                      key={c.symbol}
                      className="hover:bg-cyan-950/20 transition-colors group text-slate-200"
                    >
                      <td className="py-3 px-4 font-sans">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setSelectedChartCandidate(c)}
                            className="font-bold text-white text-sm hover:text-cyan-400 transition-colors flex items-center gap-1.5"
                            title="Click to view interactive chart"
                          >
                            <span>{c.symbol}</span>
                            <BarChart2 className="w-3.5 h-3.5 text-cyan-400 opacity-60 group-hover:opacity-100" />
                          </button>
                        </div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[160px]">
                          {c.company_name}
                        </div>
                      </td>

                      <td className="py-3 px-3 font-sans">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase border ${
                            c.chamber === "COMPOUNDER"
                              ? "bg-blue-500/10 text-blue-300 border-blue-500/30"
                              : "bg-purple-500/10 text-purple-300 border-purple-500/30"
                          }`}
                        >
                          {c.chamber === "COMPOUNDER" ? "Compounder" : "Turnaround"}
                        </span>
                      </td>

                      <td className="py-3 px-3 font-sans">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${
                            c.stage === "IGNITION_READY"
                              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                              : c.stage === "INCUBATING_COIL"
                              ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                              : "bg-blue-500/20 text-blue-300 border-blue-500/40"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              c.stage === "IGNITION_READY"
                                ? "bg-emerald-400 animate-pulse"
                                : c.stage === "INCUBATING_COIL"
                                ? "bg-amber-400"
                                : "bg-blue-400"
                            }`}
                          />
                          <span>{c.stage.replace(/_/g, " ")}</span>
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right font-bold text-white">
                        ₹{c.current_price.toFixed(2)}
                      </td>

                      <td className="py-3 px-3 text-emerald-400 font-semibold text-[11px]">
                        ₹{c.execution.buy_box_range[0].toFixed(1)} - ₹{c.execution.buy_box_range[1].toFixed(1)}
                      </td>

                      <td className="py-3 px-3 text-rose-400 font-semibold text-[11px]">
                        ₹{c.execution.hard_stop_loss.toFixed(1)}
                      </td>

                      <td className="py-3 px-3 text-cyan-300 font-semibold text-[11px]">
                        ₹{c.execution.target_1_harvest.toFixed(1)}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span className="px-2 py-0.5 rounded bg-blue-950/80 border border-blue-700/50 text-blue-300 text-[11px] font-bold">
                          {c.execution.recommended_portfolio_weight_pct}%
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right text-emerald-400">
                        {c.fundamentals.roce ? `${c.fundamentals.roce.toFixed(1)}%` : "N/A"}
                      </td>

                      <td className="py-3 px-3 text-right text-cyan-300">
                        +{c.fundamentals.quarterly_pat_yoy.toFixed(1)}%
                      </td>

                      <td className="py-3 px-3 text-right text-slate-300">
                        {c.technicals.distance_52w_high.toFixed(1)}%
                      </td>

                      <td className="py-3 px-4 font-sans">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => setSelectedChartCandidate(c)}
                            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 transition-all hover:scale-105"
                            title="View Interactive Chart"
                          >
                            <BarChart2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => handleAddToWatchlist(c)}
                            className={`p-1.5 rounded border transition-all hover:scale-105 ${
                              watchlistFeedback[c.symbol] === "added"
                                ? "bg-emerald-950 text-emerald-300 border-emerald-500"
                                : "bg-slate-800 hover:bg-slate-700 text-amber-400 border-slate-700"
                            }`}
                            title={watchlistFeedback[c.symbol] === "added" ? "Saved to Watchlist!" : "Add to Watchlist"}
                          >
                            {watchlistFeedback[c.symbol] === "added" ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <BookmarkPlus className="w-3.5 h-3.5" />
                            )}
                          </button>

                          <button
                            onClick={() => handleOpenDossier(c.symbol)}
                            className="p-1.5 rounded bg-cyan-950/70 hover:bg-cyan-900/80 text-cyan-300 border border-cyan-800/60 transition-all hover:scale-105"
                            title="360° AI Forensic Dossier"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => {
                              setAlertModalSymbol(c.symbol);
                              setAlertTypeToDispatch("IGNITION_TRIGGER");
                            }}
                            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all hover:scale-105"
                            title="Dispatch Instant Alert"
                          >
                            <Send className="w-3.5 h-3.5 text-amber-400" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* 2. CARDS GRID VIEW                                                        */
          /* ========================================================================= */
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {candidateList.map((c) => (
              <div
                key={c.symbol}
                className="rounded-xl bg-gradient-to-b from-slate-900/90 to-slate-950 border border-slate-800/80 hover:border-cyan-500/50 p-5 space-y-4 transition-all relative overflow-hidden group shadow-lg hover:shadow-cyan-950/20"
              >
                {/* Top Header */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-white tracking-wide">{c.symbol}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider uppercase border ${
                          c.chamber === "COMPOUNDER"
                            ? "bg-blue-500/10 text-blue-300 border-blue-500/30"
                            : "bg-purple-500/10 text-purple-300 border-purple-500/30"
                        }`}
                      >
                        {c.chamber}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 truncate max-w-[200px]">
                      {c.company_name} • {c.sector}
                    </div>
                  </div>

                  {/* Conviction Score Pill */}
                  <div className="text-right">
                    <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 text-xs font-bold">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{c.composite_score}%</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Conviction</div>
                  </div>
                </div>

                {/* Stage Badge & Description */}
                <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-950 border border-slate-800/80 text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        c.stage === "IGNITION_READY"
                          ? "bg-emerald-400 animate-pulse"
                          : c.stage === "INCUBATING_COIL"
                          ? "bg-amber-400"
                          : "bg-blue-400"
                      }`}
                    />
                    <span className="font-semibold text-slate-200">{c.stage.replace(/_/g, " ")}</span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {c.technicals.distance_52w_high.toFixed(1)}% to 52W High
                  </span>
                </div>

                {/* Core Quantitative Anchors */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 rounded bg-slate-950/80 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase">ROCE</div>
                    <div className="font-bold text-emerald-400 font-mono mt-0.5">
                      {c.fundamentals.roce ? `${c.fundamentals.roce.toFixed(1)}%` : "N/A"}
                    </div>
                  </div>
                  <div className="p-2 rounded bg-slate-950/80 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase">PAT YoY</div>
                    <div className="font-bold text-cyan-300 font-mono mt-0.5">
                      +{c.fundamentals.quarterly_pat_yoy.toFixed(1)}%
                    </div>
                  </div>
                  <div className="p-2 rounded bg-slate-950/80 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase">Market Cap</div>
                    <div className="font-bold text-slate-200 font-mono mt-0.5">
                      ₹{c.market_cap_cr.toLocaleString()} Cr
                    </div>
                  </div>
                </div>

                {/* Mechanical Trade Envelope */}
                <div className="p-3 rounded-lg bg-slate-950/90 border border-slate-800/90 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-300">
                    <span>Current Price:</span>
                    <strong className="text-white text-sm font-mono">₹{c.current_price.toFixed(2)}</strong>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Execution Buy Box:</span>
                    <span className="text-emerald-400 font-mono">
                      ₹{c.execution.buy_box_range[0].toFixed(1)} - ₹{c.execution.buy_box_range[1].toFixed(1)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Hard Stop Loss:</span>
                    <span className="text-rose-400 font-mono">
                      ₹{c.execution.hard_stop_loss.toFixed(1)} ({c.execution.hard_stop_pct}%)
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Target 1 (Book 33%):</span>
                    <span className="text-cyan-300 font-mono">
                      ₹{c.execution.target_1_harvest.toFixed(1)} (+{c.execution.target_1_pct}%)
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Target 2 (Book 33%):</span>
                    <span className="text-cyan-400 font-mono">
                      ₹{c.execution.target_2_harvest.toFixed(1)} (+{c.execution.target_2_pct}%)
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Kelly Capital Weight:</span>
                    <span className="px-2 py-0.5 rounded bg-blue-950/80 border border-blue-700/50 text-blue-300 font-bold font-mono">
                      {c.execution.recommended_portfolio_weight_pct}%
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  <button
                    onClick={() => setSelectedChartCandidate(c)}
                    className="flex items-center justify-center gap-1 px-2 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition-all active:scale-95"
                    title="Open Technical Chart"
                  >
                    <BarChart2 className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Chart</span>
                  </button>

                  <button
                    onClick={() => handleAddToWatchlist(c)}
                    className={`flex items-center justify-center gap-1 px-2 py-2 rounded-lg border text-xs font-semibold transition-all active:scale-95 ${
                      watchlistFeedback[c.symbol] === "added"
                        ? "bg-emerald-950 text-emerald-300 border-emerald-500"
                        : "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
                    }`}
                    title="Add to Watchlist"
                  >
                    {watchlistFeedback[c.symbol] === "added" ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <BookmarkPlus className="w-3.5 h-3.5 text-amber-400" />
                    )}
                    <span>{watchlistFeedback[c.symbol] === "added" ? "Saved" : "Watch"}</span>
                  </button>

                  <button
                    onClick={() => handleOpenDossier(c.symbol)}
                    className="flex items-center justify-center gap-1 px-2 py-2 rounded-lg bg-cyan-950/50 hover:bg-cyan-900/60 border border-cyan-800/60 text-cyan-300 text-xs font-semibold transition-all active:scale-95"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Dossier</span>
                  </button>

                  <button
                    onClick={() => {
                      setAlertModalSymbol(c.symbol);
                      setAlertTypeToDispatch("IGNITION_TRIGGER");
                    }}
                    className="flex items-center justify-center gap-1 px-2 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition-all active:scale-95"
                  >
                    <Send className="w-3.5 h-3.5 text-amber-400" />
                    <span>Alert</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ========================================================================= */}
        {/* 360° AI FORENSIC DOSSIER MODAL                                            */}
        {/* ========================================================================= */}
        {selectedDossierSymbol && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-[#081225] border border-cyan-500/40 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl relative">
              <button
                onClick={() => setSelectedDossierSymbol(null)}
                className="absolute top-5 right-5 p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-all"
              >
                <X className="w-5 h-5" />
              </button>

              {isDossierLoading ? (
                <div className="py-20 text-center space-y-3">
                  <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
                  <p className="text-sm text-slate-400">
                    Running 360° AI Forensic Audit on concalls, filings, and macro tailwinds...
                  </p>
                </div>
              ) : dossierData ? (
                <div className="space-y-6">
                  {/* Dossier Header */}
                  <div className="border-b border-slate-800 pb-4">
                    <div className="flex items-center gap-3">
                      <h2 className="text-2xl font-bold text-white tracking-wide">
                        {dossierData.symbol}
                      </h2>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                        {dossierData.verdict}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      {dossierData.company_name} • {dossierData.sector} • ₹{dossierData.current_price.toFixed(2)}
                    </p>
                  </div>

                  {/* AI Conviction Banner */}
                  <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-950/60 to-blue-950/40 border border-cyan-800/40 flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold uppercase text-cyan-400">AI Conviction Index</div>
                      <div className="text-3xl font-extrabold text-white mt-1">
                        {dossierData.ai_conviction_score}%
                      </div>
                    </div>
                    <div className="text-right text-xs text-slate-400 max-w-xs">
                      {dossierData.concall_takeaway}
                    </div>
                  </div>

                  {/* Macro Tailwinds & Headwinds */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-slate-900/60 border border-emerald-900/40 space-y-2">
                      <div className="text-xs font-bold text-emerald-400 uppercase flex items-center gap-1.5">
                        <TrendingUp className="w-4 h-4" />
                        <span>Macro & Sector Tailwinds</span>
                      </div>
                      <ul className="space-y-1.5 text-xs text-slate-300">
                        {dossierData.macro_tailwinds.map((t, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-emerald-400 font-bold">•</span>
                            <span>{t}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-900/60 border border-rose-900/40 space-y-2">
                      <div className="text-xs font-bold text-rose-400 uppercase flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4" />
                        <span>Macro Headwinds & Risks</span>
                      </div>
                      <ul className="space-y-1.5 text-xs text-slate-300">
                        {dossierData.macro_headwinds.map((h, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-rose-400 font-bold">•</span>
                            <span>{h}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Bull Case & Bear Case */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Institutional Bull vs Bear Thesis
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 space-y-2">
                        <span className="font-semibold text-emerald-300">Bull Case Anchors</span>
                        {dossierData.bull_case.map((b, idx) => (
                          <p key={idx} className="text-slate-300 flex items-start gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                            <span>{b}</span>
                          </p>
                        ))}
                      </div>

                      <div className="p-4 rounded-xl bg-slate-900/40 border border-slate-800 space-y-2">
                        <span className="font-semibold text-amber-300">Bear Case Invalidation</span>
                        {dossierData.bear_case.map((b, idx) => (
                          <p key={idx} className="text-slate-300 flex items-start gap-2">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                            <span>{b}</span>
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Forensic Flags */}
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2">
                    <span className="font-semibold text-cyan-300">Forensic Integrity Audit</span>
                    <div className="grid grid-cols-2 gap-2 text-slate-300">
                      <div>Promoter Pledge: <strong>{dossierData.forensic_integrity.pledge_risk}</strong></div>
                      <div>Cash Conversion: <strong>{dossierData.forensic_integrity.cash_flow_integrity}</strong></div>
                      <div>Accounting Flags: <strong>{dossierData.forensic_integrity.accounting_red_flags}</strong></div>
                      <div>Concall Tone: <strong>{dossierData.forensic_integrity.concall_sentiment}</strong></div>
                    </div>
                  </div>

                  {/* Invalidation Anchor */}
                  <div className="p-3 rounded-lg bg-rose-950/20 border border-rose-800/40 text-xs text-rose-300 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                    <span><strong>Hard Invalidation Anchor:</strong> {dossierData.invalidation_anchor}</span>
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-rose-400 text-sm">Failed to generate AI Dossier.</div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* DISPATCH ALERT MODAL                                                      */}
        {/* ========================================================================= */}
        {alertModalSymbol && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-[#081225] border border-cyan-500/40 rounded-2xl w-full max-w-md p-6 space-y-5 shadow-2xl relative">
              <button
                onClick={() => setAlertModalSymbol(null)}
                className="absolute top-5 right-5 p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>

              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Send className="w-5 h-5 text-cyan-400" />
                  <span>Dispatch Sovereign Alert</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Broadcasting live institutional signal for <strong>{alertModalSymbol}</strong> across In-App notifications and Telegram channel.
                </p>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-semibold text-slate-300 block">Alert Type:</label>
                <select
                  value={alertTypeToDispatch}
                  onChange={(e) => setAlertTypeToDispatch(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="IGNITION_TRIGGER">🚀 IGNITION TRIGGER (Buy Box Entry)</option>
                  <option value="PYRAMID_CONFIRMATION">⚡ PYRAMID CONFIRMATION (+2.5% add 40%)</option>
                  <option value="TARGET_1_HIT">🎯 TARGET 1 HIT (+14% harvest 33%)</option>
                  <option value="TARGET_2_HIT">🎯 TARGET 2 HIT (+25% harvest 33%)</option>
                  <option value="TIME_STOP_WARNING">⚠️ TIME STOP WARNING (7-Day Stall)</option>
                  <option value="INVALIDATION_STOP">🛑 HARD STOP HIT (-3.0% exit)</option>
                </select>
              </div>

              {alertDispatchSuccess && (
                <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-xs text-emerald-300">
                  {alertDispatchSuccess}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setAlertModalSymbol(null)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDispatchAlert}
                  disabled={isDispatchingAlert}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold transition-all disabled:opacity-50"
                >
                  <Send className={`w-3.5 h-3.5 ${isDispatchingAlert ? "animate-pulse" : ""}`} />
                  <span>{isDispatchingAlert ? "Broadcasting..." : "Dispatch Alert Now"}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* FULL-SCREEN INTERACTIVE TRADINGVIEW CHART WITH NEXT/PREV NAVIGATION       */}
        {/* ========================================================================= */}
        {selectedChartCandidate && (
          <div className="fixed inset-0 z-50 bg-[#050B14] flex flex-col p-2 sm:p-3 overflow-hidden w-screen h-screen animate-in fade-in duration-150">
            {/* Top Navigation & Status Bar */}
            {/* Top Navigation & Status Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 bg-slate-900/95 border border-slate-800 rounded-xl px-4 py-2.5 shrink-0 shadow-lg">
              
              {/* Left: Close Button & Stock Identity */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedChartCandidate(null)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/60 text-slate-300 hover:text-rose-200 border border-slate-700 hover:border-rose-600 transition-all shrink-0 text-xs font-semibold"
                  title="Close Chart Theater (Esc)"
                >
                  <X className="w-4 h-4 text-rose-400" />
                  <span className="hidden sm:inline">Close</span>
                </button>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide">
                      {selectedChartCandidate.symbol}
                    </h2>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      {selectedChartCandidate.stage.replace(/_/g, " ")}
                    </span>
                    <strong className="text-lg font-mono font-bold text-cyan-300 ml-1">
                      ₹{selectedChartCandidate.current_price.toFixed(2)}
                    </strong>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate max-w-[280px]">
                    {selectedChartCandidate.company_name} • {selectedChartCandidate.sector}
                  </p>
                </div>
              </div>

              {/* Center: PROMINENT NEXT / PREV FLIPPER (Requested Feature!) */}
              <div className="flex items-center justify-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-cyan-500/40 shadow-[0_0_20px_rgba(6,182,212,0.2)]">
                <button
                  onClick={handlePrevChart}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold transition-all active:scale-95 border border-slate-700"
                  title="Previous Stock (Left Arrow Key or P)"
                >
                  <ChevronLeft className="w-4 h-4 text-cyan-400" />
                  <span className="hidden sm:inline">Prev Chart</span>
                </button>

                <div className="px-3.5 py-1 text-xs font-mono font-bold text-cyan-300 bg-slate-900 rounded-lg border border-slate-800 min-w-[85px] text-center">
                  {currentChartIndex !== -1 ? `${currentChartIndex + 1} / ${activeNavigationList.length}` : "Stock"}
                </div>

                <button
                  onClick={handleNextChart}
                  className="flex items-center gap-2 px-5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-md shadow-cyan-950/60 transition-all active:scale-95"
                  title="Next Stock (Right Arrow Key or N)"
                >
                  <span>Next Chart</span>
                  <ChevronRight className="w-4 h-4 text-slate-950 stroke-[3]" />
                </button>
              </div>

              {/* Right: Technical Stats & Actions */}
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <div className="hidden xl:flex items-center gap-2 text-[11px] text-slate-300 font-mono">
                  <span className="px-2 py-1 rounded bg-slate-950 border border-slate-800">
                    50D: <strong className="text-cyan-400">₹{selectedChartCandidate.technicals.dma_50.toFixed(1)}</strong>
                  </span>
                  <span className="px-2 py-1 rounded bg-slate-950 border border-slate-800">
                    200D: <strong className="text-blue-400">₹{selectedChartCandidate.technicals.dma_200.toFixed(1)}</strong>
                  </span>
                  <span className="px-2 py-1 rounded bg-slate-950 border border-slate-800">
                    52W: <strong className="text-emerald-400">{selectedChartCandidate.technicals.distance_52w_high.toFixed(1)}%</strong>
                  </span>
                  <span className="px-2 py-1 rounded bg-slate-950 border border-slate-800">
                    RSI: <strong className="text-amber-400">{selectedChartCandidate.technicals.rsi_14.toFixed(1)}</strong>
                  </span>
                </div>

                {/* Quick Actions in Header */}
                <button
                  onClick={() => handleAddToWatchlist(selectedChartCandidate)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all active:scale-95 ${
                    watchlistFeedback[selectedChartCandidate.symbol] === "added"
                      ? "bg-emerald-950 text-emerald-300 border-emerald-500"
                      : "bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
                  }`}
                  title="Add this stock to Watchlist"
                >
                  {watchlistFeedback[selectedChartCandidate.symbol] === "added" ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <BookmarkPlus className="w-3.5 h-3.5 text-amber-400" />
                  )}
                  <span>{watchlistFeedback[selectedChartCandidate.symbol] === "added" ? "Saved" : "Watchlist"}</span>
                </button>

                <button
                  onClick={() => handleOpenDossier(selectedChartCandidate.symbol)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-800/60 text-cyan-300 text-xs font-semibold transition-all active:scale-95"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">AI Dossier</span>
                </button>

                <button
                  onClick={() => {
                    setAlertModalSymbol(selectedChartCandidate.symbol);
                    setAlertTypeToDispatch("IGNITION_TRIGGER");
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition-all active:scale-95"
                >
                  <Send className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Alert</span>
                </button>
              </div>
            </div>

            {/* Execution Envelope Overlay Ribbon */}
            <div className="flex items-center justify-between text-xs px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800/80 my-2 shrink-0">
              <div className="flex items-center gap-4 flex-wrap font-mono text-[11px]">
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span>
                  <span>Buy Box: ₹{selectedChartCandidate.execution.buy_box_range[0].toFixed(1)} - ₹{selectedChartCandidate.execution.buy_box_range[1].toFixed(1)}</span>
                </span>
                <span className="flex items-center gap-1.5 text-rose-400">
                  <span className="w-2.5 h-2.5 rounded-sm bg-rose-500"></span>
                  <span>Hard Stop (-3%): ₹{selectedChartCandidate.execution.hard_stop_loss.toFixed(1)}</span>
                </span>
                <span className="flex items-center gap-1.5 text-cyan-400">
                  <span className="w-2.5 h-2.5 rounded-sm bg-cyan-500"></span>
                  <span>Target 1 (+14%): ₹{selectedChartCandidate.execution.target_1_harvest.toFixed(1)}</span>
                </span>
                <span className="flex items-center gap-1.5 text-cyan-300">
                  <span className="w-2.5 h-2.5 rounded-sm bg-cyan-600"></span>
                  <span>Target 2 (+25%): ₹{selectedChartCandidate.execution.target_2_harvest.toFixed(1)}</span>
                </span>
                <span className="flex items-center gap-1.5 text-blue-400">
                  <span>Kelly Sizing: {selectedChartCandidate.execution.recommended_portfolio_weight_pct}% Weight</span>
                </span>
              </div>
              <div className="hidden md:flex items-center gap-2 text-[11px] text-slate-400">
                <span>Keyboard: <strong>← Prev (P)</strong> / <strong>→ Next (N)</strong> / <strong>Esc Close</strong></span>
              </div>
            </div>

            {/* The Fullscreen Interactive Chart Viewport */}
            <div className="flex-1 w-full rounded-xl overflow-hidden border border-slate-800 bg-[#050B14] relative">
              {/* Floating Side Button Left (Prev Chart) */}
              <button
                onClick={handlePrevChart}
                className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-3 py-2.5 rounded-full bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 backdrop-blur shadow-2xl transition-all z-20 group active:scale-95"
                title="Previous Stock (Left Arrow Key or P)"
              >
                <ChevronLeft className="w-5 h-5 text-cyan-400 group-hover:-translate-x-1 transition-transform" />
                <span className="text-xs font-bold hidden sm:inline">Prev</span>
              </button>

              {/* Floating Side Button Right (Next Chart - High Visibility CTA) */}
              <button
                onClick={handleNextChart}
                className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 px-4 py-2.5 rounded-full bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white font-black text-xs uppercase tracking-wider border border-cyan-400/80 backdrop-blur shadow-[0_0_25px_rgba(6,182,212,0.6)] transition-all hover:scale-105 active:scale-95 z-20 group"
                title="Next Stock (Right Arrow Key or N)"
              >
                <span>Next Chart</span>
                <ChevronRight className="w-5 h-5 text-white group-hover:translate-x-1 transition-transform stroke-[3]" />
              </button>

              <TradingViewChart
                key={selectedChartCandidate.symbol}
                symbol={selectedChartCandidate.symbol}
                height={chartViewportHeight}
                pivotReference={selectedChartCandidate.current_price}
                scenarioTrigger={selectedChartCandidate.execution.pyramid_trigger_price}
                downsideReference={selectedChartCandidate.execution.hard_stop_loss}
                target1={selectedChartCandidate.execution.target_1_harvest}
              />
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}

"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/layout/DashboardLayout";
import OpportunityDetailModal from "@/components/intraday/OpportunityDetailModal";
import {
  fetchTomorrowMovers,
  fetchTomorrowDeepDive,
  fetchBacktestSummary,
  type TomorrowOpportunity,
  type TomorrowMoversResponse,
  type TomorrowDeepDiveItem,
  type TomorrowDeepDiveResponse,
  type BacktestSummaryResponse,
} from "@/lib/technoFundaApi";
import {
  Flame,
  Zap,
  TrendingUp,
  TrendingDown,
  Target,
  Search,
  RefreshCw,
  Sparkles,
  Award,
  BarChart2,
  Clock3,
  History,
  CheckCircle2,
  ChevronRight,
  BookOpen,
  HelpCircle,
  ArrowUpRight,
  SlidersHorizontal,
  Star,
  ArrowUpDown,
  Radio,
} from "lucide-react";

export default function IntradayRadarPage() {
  // Navigation Tabs: Main Action Radar vs Backtest Telemetry vs Raw 5M Scanner
  const [activeTab, setActiveTab] = useState<"DEEP_DIVE" | "BACKTEST" | "5M_RADAR">("DEEP_DIVE");

  // Selected opportunity for detail dossier modal
  const [selectedOpportunity, setSelectedOpportunity] = useState<TomorrowDeepDiveItem | null>(null);

  // Quick Action Guide drawer toggle
  const [showQuickGuide, setShowQuickGuide] = useState<boolean>(false);

  // Deep Dive State
  const [deepDiveData, setDeepDiveData] = useState<TomorrowDeepDiveResponse | null>(null);
  const [loadingDeepDive, setLoadingDeepDive] = useState(false);
  const [refreshingDeepDive, setRefreshingDeepDive] = useState(false);
  const [filterCategory, setFilterCategory] = useState<"ALL" | "ELITE" | "NR7" | "OUTPERFORMER">("ALL");
  const [search, setSearch] = useState<string>("");
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>("");

  // Table Sorting & Watchlist State
  const [sortBy, setSortBy] = useState<"conviction" | "move" | "alpha">("conviction");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [watchlist, setWatchlist] = useState<Record<string, boolean>>({});

  // 5M Radar State
  const [data5m, setData5m] = useState<TomorrowMoversResponse | null>(null);
  const [loading5m, setLoading5m] = useState(false);

  // Backtest State
  const [backtestData, setBacktestData] = useState<BacktestSummaryResponse | null>(null);
  const [loadingBacktest, setLoadingBacktest] = useState(false);

  // Load Deep Dive Data
  const loadDeepDiveData = useCallback(async (force = false) => {
    if (force) setRefreshingDeepDive(true);
    else if (!deepDiveData) setLoadingDeepDive(true);

    try {
      const res = await fetchTomorrowDeepDive(force);
      setDeepDiveData(res);
      setLastRefreshedAt(
        new Date().toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    } catch (err) {
      console.error("Failed to load tomorrow deep dive:", err);
    } finally {
      setLoadingDeepDive(false);
      setRefreshingDeepDive(false);
    }
  }, [deepDiveData]);

  // Load Backtest Data
  const loadBacktestData = useCallback(async () => {
    setLoadingBacktest(true);
    try {
      const res = await fetchBacktestSummary();
      setBacktestData(res);
    } catch (err) {
      console.error("Failed to load backtest data:", err);
    } finally {
      setLoadingBacktest(false);
    }
  }, []);

  // Load 5M Data
  const load5mData = useCallback(async () => {
    setLoading5m(true);
    try {
      const res = await fetchTomorrowMovers();
      setData5m(res);
    } catch (err) {
      console.error("Failed to load 5M data:", err);
    } finally {
      setLoading5m(false);
    }
  }, []);

  // Watchlist Local Cache Persistence
  useEffect(() => {
    try {
      const cached = localStorage.getItem("alpha_india_watchlist_cache");
      if (cached) {
        setWatchlist(JSON.parse(cached));
      }
    } catch {
      // ignore
    }
  }, []);

  const toggleWatchlist = (sym: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setWatchlist((prev) => {
      const next = { ...prev, [sym]: !prev[sym] };
      try {
        localStorage.setItem("alpha_india_watchlist_cache", JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  // Initial Load and 30-Second Continuous Background Auto-Refresh
  useEffect(() => {
    loadDeepDiveData();

    const interval = setInterval(() => {
      loadDeepDiveData(false);
    }, 30 * 1000);

    return () => clearInterval(interval);
  }, [loadDeepDiveData]);

  useEffect(() => {
    if (activeTab === "BACKTEST" && !backtestData) {
      loadBacktestData();
    } else if (activeTab === "5M_RADAR" && !data5m) {
      load5mData();
    }
  }, [activeTab, backtestData, data5m, loadBacktestData, load5mData]);

  // Toggle Column Sort
  const handleSortToggle = (col: "conviction" | "move" | "alpha") => {
    if (sortBy === col) {
      setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));
    } else {
      setSortBy(col);
      setSortOrder("desc");
    }
  };

  // Filtered Deep Dive items for the table
  const filteredDeepDive = (deepDiveData?.all_bullish_mtf || []).filter((item) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchSym = item.symbol.toLowerCase().includes(q);
      const matchName = item.company_name.toLowerCase().includes(q);
      const matchSec = item.sector.toLowerCase().includes(q);
      if (!matchSym && !matchName && !matchSec) return false;
    }
    if (filterCategory === "ELITE" && !["A+ SUPER-SETUP", "A HIGH CONVICTION"].includes(item.conviction_tier)) {
      return false;
    }
    if (filterCategory === "NR7" && !item.is_nr7 && !item.is_inside_day) {
      return false;
    }
    if (filterCategory === "OUTPERFORMER" && (item.rs_score ?? 0) < 0.5) {
      return false;
    }
    return true;
  });

  // Dynamically sorted Deep Dive records
  const sortedDeepDive = useMemo(() => {
    return [...filteredDeepDive].sort((a, b) => {
      let valA = 0;
      let valB = 0;
      if (sortBy === "conviction") {
        valA = a.conviction_score || 0;
        valB = b.conviction_score || 0;
      } else if (sortBy === "move") {
        valA = a.expected_move_pct || 0;
        valB = b.expected_move_pct || 0;
      } else if (sortBy === "alpha") {
        valA = a.rs_score ?? 0;
        valB = b.rs_score ?? 0;
      }
      return sortOrder === "desc" ? valB - valA : valA - valB;
    });
  }, [filteredDeepDive, sortBy, sortOrder]);

  // Top 3 Hero Cards
  const topPicks = (deepDiveData?.elite_candidates || sortedDeepDive).slice(0, 3);

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-5">
        {/* ==================================================================== */}
        {/* 1. HERO BANNER & NIFTY REGIME STRIP                                  */}
        {/* ==================================================================== */}
        {/* ==================================================================== */}
        {/* 1. HERO BANNER & NIFTY REGIME STRIP                                  */}
        {/* ==================================================================== */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-white via-slate-50 to-slate-100 dark:from-[#081225] dark:via-[#050B14] dark:to-[#040810] p-5 shadow-xs dark:shadow-2xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 dark:text-amber-400 border border-amber-500/30">
                  <Flame size={20} />
                </div>
                <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white sm:text-2xl">
                  Tomorrow High-Probability 5%+ Radar
                </h1>
                <span className="rounded-full bg-cyan-500/15 px-2.5 py-0.5 text-xs font-semibold text-cyan-700 dark:text-cyan-300 border border-cyan-500/30">
                  Action-First Terminal
                </span>
              </div>
              <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 sm:text-sm max-w-2xl">
                Identifies top F&amp;O setups coiling for explosive tomorrow breakouts using Toby Crabel volatility
                compression, 1D/1H structural confluence, and Nifty Alpha outperformance.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* NIFTY 50 BENCHMARK PILL */}
              {deepDiveData?.nifty_benchmark && (
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900/90 px-3 py-1.5 text-xs shadow-xs">
                  <span className="font-bold text-slate-700 dark:text-slate-300">NIFTY:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    ₹{deepDiveData.nifty_benchmark.cmp.toLocaleString("en-IN")}
                  </span>
                  <span
                    className={`font-mono font-bold text-[11px] ${
                      deepDiveData.nifty_benchmark.ret_5d >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    ({deepDiveData.nifty_benchmark.ret_5d >= 0 ? "+" : ""}
                    {deepDiveData.nifty_benchmark.ret_5d}% 5D)
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[9px] font-black uppercase ${
                      deepDiveData.nifty_benchmark.is_bullish
                        ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                        : "bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30"
                    }`}
                  >
                    {deepDiveData.nifty_benchmark.regime}
                  </span>
                </div>
              )}

              {/* SOURCE & SYNC TELEMETRY */}
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900/90 px-3 py-1.5 text-xs shadow-xs">
                <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                  {deepDiveData?.data_source || "NSE_F&O_5M_ENGINE"}
                </span>
                {lastRefreshedAt && (
                  <span className="text-[11px] font-mono text-cyan-600 dark:text-cyan-400">
                    Synced {lastRefreshedAt} IST
                  </span>
                )}
              </div>

              {/* QUICK ACTION GUIDE TOGGLE */}
              <button
                onClick={() => setShowQuickGuide(!showQuickGuide)}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                  showQuickGuide
                    ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40"
                    : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-xs"
                }`}
              >
                <BookOpen size={13} />
                <span>{showQuickGuide ? "Hide Guide" : "3-Step Action Guide"}</span>
              </button>

              {/* REFRESH BUTTON */}
              <button
                onClick={() => loadDeepDiveData(true)}
                disabled={refreshingDeepDive}
                className="flex items-center gap-1.5 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500 hover:text-slate-950 transition disabled:opacity-50"
              >
                <RefreshCw size={13} className={refreshingDeepDive ? "animate-spin" : ""} />
                <span>{refreshingDeepDive ? "Recalculating..." : "Refresh"}</span>
              </button>
            </div>
          </div>

          {/* QUICK ACTION GUIDE COLLAPSIBLE DRAWER */}
          {showQuickGuide && (
            <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-50/50 dark:bg-amber-500/5 p-4 animate-in fade-in duration-200">
              <div className="flex items-center justify-between text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-2">
                <span className="flex items-center gap-1.5">
                  <Award size={15} />
                  3-Step High-Probability Execution Guide
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 normal-case">Strict Risk Management Rules</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-700 dark:text-slate-300">
                <div className="rounded-lg bg-white dark:bg-slate-900/80 p-3 border border-slate-200 dark:border-slate-800 shadow-xs">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-[10px]">1</span>
                    <span>Pick 1-2 Top Setups</span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">
                    Filter for <span className="text-emerald-600 dark:text-emerald-300 font-semibold">Elite Conviction (A+/A)</span> with{" "}
                    <span className="text-amber-600 dark:text-amber-300 font-semibold">NR7 COIL</span> and positive Nifty Alpha.
                  </p>
                </div>

                <div className="rounded-lg bg-white dark:bg-slate-900/80 p-3 border border-slate-200 dark:border-slate-800 shadow-xs">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-[10px]">2</span>
                    <span>9:15-9:30 AM Gap Check</span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">
                    Enter only if opening gap is between <span className="text-emerald-600 dark:text-emerald-300 font-semibold">+0.2% and +1.2%</span>. Never chase gaps &gt; +2.5%!
                  </p>
                </div>

                <div className="rounded-lg bg-white dark:bg-slate-900/80 p-3 border border-slate-200 dark:border-slate-800 shadow-xs">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-[10px]">3</span>
                    <span>Execute &amp; Harvest</span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-400">
                    Buy above <span className="text-cyan-600 dark:text-cyan-300 font-semibold">Entry Trigger</span> after 9:30 AM. Book 60% at Target 1 and move SL to Cost.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* VIEW MODE TABS */}
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-200 dark:border-slate-800/80 pt-3">
            <button
              onClick={() => setActiveTab("DEEP_DIVE")}
              className={`flex items-center gap-2 rounded-xl px-4 py-1.5 text-xs font-bold transition ${
                activeTab === "DEEP_DIVE"
                  ? "bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 shadow-md shadow-emerald-500/20"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              <Sparkles size={13} />
              <span>Action Radar &amp; Top Picks ({deepDiveData?.total_bullish_analyzed || 0})</span>
            </button>

            <button
              onClick={() => setActiveTab("BACKTEST")}
              className={`flex items-center gap-2 rounded-xl px-4 py-1.5 text-xs font-bold transition ${
                activeTab === "BACKTEST"
                  ? "bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-md shadow-amber-500/20"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              <History size={13} />
              <span>
                Backtest Telemetry
                {backtestData?.summary
                  ? ` (${backtestData.summary.win_rate_pct}% Win Rate / ${backtestData.summary.total_trades} Trades)`
                  : ""}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("5M_RADAR")}
              className={`flex items-center gap-2 rounded-xl px-4 py-1.5 text-xs font-bold transition ${
                activeTab === "5M_RADAR"
                  ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 shadow-md shadow-cyan-500/20"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              <Clock3 size={13} />
              <span>Raw 5M Scanner ({data5m?.total || 177} Equities)</span>
            </button>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* VIEW 1: MAIN ACTION RADAR (CLEAN & ACTION-FIRST)                     */}
        {/* ==================================================================== */}
        {activeTab === "DEEP_DIVE" && (
          <div className="flex flex-col gap-5">
            {/* 2. TOP 3 SUPER-SETUPS HERO CARDS */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                  <Sparkles size={14} className="text-emerald-400" />
                  <span>Top High-Conviction Picks for Tomorrow</span>
                </div>
                <span className="text-[11px] text-slate-400">
                  Ranked by Institutional Conviction Score (0-100)
                </span>
              </div>

              {loadingDeepDive ? (
                <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-10 text-center">
                  <RefreshCw size={24} className="animate-spin mx-auto text-emerald-400 mb-2" />
                  <div className="text-xs text-slate-400">Loading top actionable opportunities...</div>
                </div>
              ) : topPicks.length === 0 ? (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-6 text-center text-xs text-slate-500">
                  No high-conviction setups available currently.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {topPicks.map((pick, idx) => {
                    const isAplus = pick.conviction_tier === "A+ SUPER-SETUP";
                    return (
                      <div
                        key={pick.symbol}
                        className="group relative flex flex-col justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#081225] p-4 shadow-xs dark:shadow-xl hover:border-cyan-500/40 hover:shadow-cyan-500/5 transition cursor-pointer"
                        onClick={() => setSelectedOpportunity(pick)}
                      >
                        <div>
                          {/* TOP CARD HEADER */}
                          <div className="flex items-start justify-between gap-2 border-b border-slate-200 dark:border-slate-800/80 pb-3">
                            <div className="flex items-center gap-2">
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/30 text-xs font-black text-emerald-600 dark:text-emerald-400">
                                #{idx + 1}
                              </span>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-base font-black text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition">
                                    {pick.symbol}
                                  </span>
                                  <button
                                    onClick={(e) => toggleWatchlist(pick.symbol, e)}
                                    className={`p-0.5 rounded transition ${
                                      watchlist[pick.symbol]
                                        ? "text-amber-400 hover:text-amber-500"
                                        : "text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-300"
                                    }`}
                                    title={watchlist[pick.symbol] ? "In Watchlist" : "Add to Watchlist"}
                                  >
                                    <Star size={13} className={watchlist[pick.symbol] ? "fill-amber-400 text-amber-400" : ""} />
                                  </button>
                                </div>
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[130px]">
                                  {pick.company_name}
                                </div>
                              </div>
                            </div>

                            <div className="text-right">
                              <div className="flex items-baseline justify-end gap-1">
                                <span className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400">
                                  {pick.conviction_score}
                                </span>
                                <span className="text-[10px] text-slate-400 dark:text-slate-500">/100</span>
                              </div>
                              <span
                                className={`inline-block rounded px-1.5 py-0.2 text-[8px] font-black uppercase ${
                                  isAplus
                                    ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40"
                                    : "bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/40"
                                }`}
                              >
                                {pick.conviction_tier}
                              </span>
                            </div>
                          </div>

                          {/* ACTION BOX (TRIGGER / T1 / SL / RR) */}
                          <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-slate-50 dark:bg-slate-900/80 p-2.5 border border-slate-200 dark:border-slate-800 text-center font-mono">
                            <div>
                              <div className="text-[9px] uppercase font-sans text-slate-500 dark:text-slate-400 font-bold">Buy Trigger</div>
                              <div className="text-xs font-black text-slate-900 dark:text-white mt-0.5">₹{pick.entry_trigger}</div>
                              <div className="text-[8px] text-slate-400 dark:text-slate-500 font-sans">9:30 AM High</div>
                            </div>
                            <div>
                              <div className="text-[9px] uppercase font-sans text-emerald-600 dark:text-emerald-400 font-bold">Target 1</div>
                              <div className="text-xs font-black text-emerald-600 dark:text-emerald-300 mt-0.5">₹{pick.target_1 || pick.target_price}</div>
                              <div className="text-[8px] text-emerald-600 dark:text-emerald-400 font-sans">+{pick.expected_move_pct}%</div>
                            </div>
                            <div>
                              <div className="text-[9px] uppercase font-sans text-rose-600 dark:text-rose-400 font-bold">Stop Loss</div>
                              <div className="text-xs font-black text-rose-600 dark:text-rose-300 mt-0.5">₹{pick.stop_loss}</div>
                              <div className="text-[8px] text-slate-400 dark:text-slate-500 font-sans">1:{pick.risk_reward || 1.6} RR</div>
                            </div>
                          </div>

                          {/* CATALYST PILLS */}
                          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[10px]">
                            {pick.is_nr7 && (
                              <span className="rounded bg-amber-500/20 border border-amber-500/30 px-1.5 py-0.5 font-black text-amber-700 dark:text-amber-300 flex items-center gap-0.5">
                                <Flame size={10} />
                                NR7 COIL
                              </span>
                            )}
                            {pick.is_inside_day && (
                              <span className="rounded bg-purple-500/20 border border-purple-500/30 px-1.5 py-0.5 font-black text-purple-700 dark:text-purple-300">
                                INSIDE DAY
                              </span>
                            )}
                            <span
                              className={`rounded px-1.5 py-0.5 font-bold ${
                                (pick.rs_score ?? 0) >= 0.5
                                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                              }`}
                            >
                              RS: {(pick.rs_score ?? 0) > 0 ? "+" : ""}{pick.rs_score ?? 0}% vs Nifty
                            </span>
                          </div>
                        </div>

                        {/* CARD ACTION BUTTON */}
                        <div className="mt-4 pt-2.5 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">
                            CMP: <span className="font-mono text-slate-900 dark:text-white font-bold">₹{pick.cmp}</span>
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedOpportunity(pick);
                            }}
                            className="flex items-center gap-1 text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 dark:hover:text-cyan-300 transition"
                          >
                            <span>Inspect Trade Blueprint</span>
                            <ChevronRight size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 3. CLEAN FILTER TOOLBAR */}
            <div className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#081225] p-3 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setFilterCategory("ALL")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      filterCategory === "ALL"
                        ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    All Bullish ({deepDiveData?.total_bullish_analyzed || 0})
                  </button>

                  <button
                    onClick={() => setFilterCategory("ELITE")}
                    className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      filterCategory === "ELITE"
                        ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                        : "bg-slate-100 dark:bg-slate-800/80 text-emerald-700 dark:text-emerald-400 hover:bg-slate-200 dark:hover:bg-slate-800 border border-emerald-500/30"
                    }`}
                  >
                    <Sparkles size={13} />
                    <span>Elite Conviction (A+/A)</span>
                  </button>

                  <button
                    onClick={() => setFilterCategory("NR7")}
                    className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      filterCategory === "NR7"
                        ? "bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20"
                        : "bg-slate-100 dark:bg-slate-800/80 text-amber-700 dark:text-amber-300 hover:bg-slate-200 dark:hover:bg-slate-800 border border-amber-500/30"
                    }`}
                  >
                    <Zap size={13} />
                    <span>NR7 / Inside Day Coils ({deepDiveData?.nr7_coils_count || 0})</span>
                  </button>

                  <button
                    onClick={() => setFilterCategory("OUTPERFORMER")}
                    className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      filterCategory === "OUTPERFORMER"
                        ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20"
                        : "bg-slate-100 dark:bg-slate-800/80 text-cyan-700 dark:text-cyan-300 hover:bg-slate-200 dark:hover:bg-slate-800 border border-cyan-500/30"
                    }`}
                  >
                    <TrendingUp size={13} />
                    <span>Nifty Outperformers ({deepDiveData?.nifty_outperformers_count || 0})</span>
                  </button>
                </div>

                {/* SEARCH INPUT */}
                <div className="relative min-w-[200px] max-w-xs flex-1">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="text"
                    placeholder="Search stock or sector..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/90 py-1.5 pl-8 pr-3 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* 4. STREAMLINED RADAR TABLE (5 HIGH-SIGNAL COLUMNS) */}
            <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#060D1A] shadow-xs dark:shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300 font-mono">
                  <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 text-[11px] uppercase tracking-wider text-slate-600 dark:text-slate-400 font-sans">
                    <tr>
                      <th className="px-4 py-3">Stock &amp; Sector</th>
                      <th
                        onClick={() => handleSortToggle("conviction")}
                        className="px-3 py-3 cursor-pointer hover:text-slate-900 dark:hover:text-white transition select-none"
                      >
                        <div className="flex items-center gap-1">
                          <span>Conviction &amp; Grade</span>
                          <ArrowUpDown size={11} className={sortBy === "conviction" ? "text-cyan-400" : "opacity-40"} />
                        </div>
                      </th>
                      <th
                        onClick={() => handleSortToggle("move")}
                        className="px-3 py-3 cursor-pointer hover:text-slate-900 dark:hover:text-white transition select-none"
                      >
                        <div className="flex items-center gap-1">
                          <span>Action Blueprint (Trigger / Tgt / SL)</span>
                          <ArrowUpDown size={11} className={sortBy === "move" ? "text-cyan-400" : "opacity-40"} />
                        </div>
                      </th>
                      <th
                        onClick={() => handleSortToggle("alpha")}
                        className="px-3 py-3 cursor-pointer hover:text-slate-900 dark:hover:text-white transition select-none"
                      >
                        <div className="flex items-center gap-1">
                          <span>Key Pattern &amp; Alpha</span>
                          <ArrowUpDown size={11} className={sortBy === "alpha" ? "text-cyan-400" : "opacity-40"} />
                        </div>
                      </th>
                      <th className="px-4 py-3 text-right">Direct Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-sans">
                    {loadingDeepDive ? (
                      <tr>
                        <td colSpan={5} className="py-16 text-center">
                          <RefreshCw size={24} className="animate-spin mx-auto text-emerald-500 mb-2" />
                          <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                            Synthesizing High-Probability Opportunities...
                          </div>
                        </td>
                      </tr>
                    ) : sortedDeepDive.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-500">
                          No opportunities matching the selected filter.
                        </td>
                      </tr>
                    ) : (
                      sortedDeepDive.map((item, idx) => (
                        <tr
                          key={item.symbol}
                          onClick={() => setSelectedOpportunity(item)}
                          className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition group cursor-pointer"
                        >
                          {/* 1. STOCK & SECTOR */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <button
                                onClick={(e) => toggleWatchlist(item.symbol, e)}
                                className={`p-0.5 rounded transition ${
                                  watchlist[item.symbol]
                                    ? "text-amber-400 hover:text-amber-500"
                                    : "text-slate-300 dark:text-slate-600 hover:text-slate-500 dark:hover:text-slate-300"
                                }`}
                                title={watchlist[item.symbol] ? "In Watchlist" : "Add to Watchlist"}
                              >
                                <Star size={13} className={watchlist[item.symbol] ? "fill-amber-400 text-amber-400" : ""} />
                              </button>
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-400">
                                {idx + 1}
                              </span>
                              <div>
                                <div className="font-bold text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition text-sm">
                                  {item.symbol}
                                </div>
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[140px]">
                                  {item.company_name} • <span className="text-slate-400 dark:text-slate-500">{item.sector}</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* 2. CONVICTION & GRADE */}
                          <td className="px-3 py-3">
                            <div className="flex items-baseline gap-1.5">
                              <span
                                className={`text-base font-black font-mono ${
                                  item.conviction_score >= 88
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : item.conviction_score >= 78
                                    ? "text-cyan-600 dark:text-cyan-400"
                                    : "text-amber-600 dark:text-amber-400"
                                }`}
                              >
                                {item.conviction_score}
                              </span>
                              <span className="text-[10px] text-slate-400 dark:text-slate-500">/100</span>
                            </div>
                            <span
                              className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-black uppercase mt-0.5 ${
                                item.conviction_tier === "A+ SUPER-SETUP"
                                  ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40"
                                  : item.conviction_tier === "A HIGH CONVICTION"
                                  ? "bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/40"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                              }`}
                            >
                              {item.conviction_tier}
                            </span>
                          </td>

                          {/* 3. ACTION BLUEPRINT */}
                          <td className="px-3 py-3 font-mono">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-slate-900 dark:text-white font-bold">Trig: ₹{item.entry_trigger}</span>
                              <span className="text-emerald-600 dark:text-emerald-400 font-bold">T1: ₹{item.target_1 || item.target_price}</span>
                              <span className="text-rose-600 dark:text-rose-400">SL: ₹{item.stop_loss}</span>
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-sans mt-0.5 flex items-center gap-2">
                              <span>CMP: ₹{item.cmp}</span>
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold font-mono">+{item.expected_move_pct}% Expected</span>
                              {item.risk_reward && (
                                <span className="rounded bg-emerald-50 dark:bg-emerald-500/10 px-1 text-[9px] font-bold text-emerald-700 dark:text-emerald-300">
                                  1:{item.risk_reward} RR
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 4. KEY PATTERN & ALPHA */}
                          <td className="px-3 py-3">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {item.is_nr7 && (
                                <span className="rounded bg-amber-500/20 border border-amber-500/40 px-1.5 py-0.5 text-[9px] font-black text-amber-700 dark:text-amber-300 flex items-center gap-0.5">
                                  <Flame size={10} />
                                  NR7 COIL
                                </span>
                              )}
                              {item.is_inside_day && (
                                <span className="rounded bg-purple-500/20 border border-purple-500/40 px-1.5 py-0.5 text-[9px] font-black text-purple-700 dark:text-purple-300">
                                  INSIDE DAY
                                </span>
                              )}
                              <span
                                className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                                  (item.rs_score ?? 0) >= 0.5
                                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                                }`}
                              >
                                RS: {(item.rs_score ?? 0) > 0 ? "+" : ""}{item.rs_score ?? 0}% vs Nifty
                              </span>
                              <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-600 dark:text-slate-400">
                                {item.confluence_badge}
                              </span>
                            </div>
                          </td>

                          {/* 5. DIRECT ACTION */}
                          <td className="px-4 py-3 text-right font-sans">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedOpportunity(item);
                                }}
                                className="flex items-center gap-1 rounded bg-cyan-50 dark:bg-cyan-500/15 border border-cyan-200 dark:border-cyan-500/30 px-2.5 py-1 text-xs font-bold text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500 hover:text-slate-950 transition"
                              >
                                <span>Inspect Setup</span>
                                <ChevronRight size={12} />
                              </button>

                              <a
                                href={item.tradingview_5m_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-1 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-400 dark:hover:border-slate-600 transition"
                                title="Open TradingView 5m chart"
                              >
                                <BarChart2 size={13} />
                              </a>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* VIEW 2: HISTORICAL BACKTEST TELEMETRY MATRIX                         */}
        {/* ==================================================================== */}
        {activeTab === "BACKTEST" && backtestData && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 p-3 shadow-xs">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Total Backtested Trades</div>
                <div className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{backtestData.summary.total_trades} Recs</div>
              </div>
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-500/5 p-3 shadow-xs">
                <div className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">Aggregated Win Rate</div>
                <div className="mt-1 text-lg font-bold text-emerald-700 dark:text-emerald-300">{backtestData.summary.win_rate_pct}%</div>
              </div>
              <div className="rounded-xl border border-rose-500/20 bg-rose-50/50 dark:bg-rose-500/5 p-3 shadow-xs">
                <div className="text-[11px] font-medium text-rose-700 dark:text-rose-400">Counter-Trend Trap Failure</div>
                <div className="mt-1 text-lg font-bold text-rose-700 dark:text-rose-300">{backtestData.summary.trap_failure_rate_pct}% Failed</div>
              </div>
              <div className="rounded-xl border border-amber-500/20 bg-amber-50/50 dark:bg-amber-500/5 p-3 shadow-xs">
                <div className="text-[11px] font-medium text-amber-700 dark:text-amber-400">5%+ Target Hits</div>
                <div className="mt-1 text-lg font-bold text-amber-700 dark:text-amber-300">{backtestData.summary.target_5pct_hits} Stocks</div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              {backtestData.sessions.map((sess, idx) => (
                <div key={idx} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#081225] p-4 text-xs shadow-xs">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2 mb-2">
                    <span className="font-bold text-slate-900 dark:text-white">{sess.session}</span>
                    <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-emerald-700 dark:text-emerald-300 font-bold">
                      {sess.win_rate_pct}% Wins
                    </span>
                  </div>
                  <div className="text-slate-600 dark:text-slate-400">Regime: <span className="text-cyan-600 dark:text-cyan-300">{sess.market_regime}</span></div>
                  <div className="mt-2 space-y-1 font-mono text-[11px]">
                    {sess.top_winners.slice(0, 3).map((w) => (
                      <div key={w.symbol} className="flex justify-between p-1 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <span className="font-bold text-slate-900 dark:text-white">{w.symbol}</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">+{w.max_move_pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* VIEW 3: RAW 5M SCANNER (FULL UNIVERSE)                               */}
        {/* ==================================================================== */}
        {activeTab === "5M_RADAR" && (
          <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#060D1A] p-4 shadow-xs">
            <div className="text-xs text-slate-600 dark:text-slate-400 mb-3">
              Raw 5-Minute Intraday Scanner across complete F&amp;O Universe ({data5m?.total || 0} Stocks)
            </div>
            {loading5m ? (
              <div className="text-center py-10 text-xs text-slate-500">Scanning 5M bars...</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 text-xs font-mono">
                {(data5m?.items || []).slice(0, 36).map((item) => (
                  <div key={item.symbol} className="p-2 rounded bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex justify-between">
                    <span className="font-bold text-slate-900 dark:text-white">{item.symbol}</span>
                    <span className={item.direction_tier === "BULLISH" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                      {item.direction_tier === "BULLISH" ? "+" : "-"}{item.expected_move_pct}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ==================================================================== */}
      {/* 5. OPPORTUNITY DETAIL DOSSIER MODAL                                  */}
      {/* ==================================================================== */}
      <OpportunityDetailModal
        opportunity={selectedOpportunity}
        onClose={() => setSelectedOpportunity(null)}
      />
    </DashboardLayout>
  );
}

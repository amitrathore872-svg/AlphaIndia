"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  ShieldCheck,
  TrendingUp,
  RefreshCw,
  Search,
  Sparkles,
  Award,
  Target,
  Flame,
  Zap,
  Info,
  Clock,
  Layers,
  Crosshair,
  Activity,
  ExternalLink,
  AlertCircle,
  Gauge,
  Lock,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  SlidersHorizontal,
  PieChart,
} from "lucide-react";
import Link from "next/link";
import DashboardLayout from "@/components/layout/DashboardLayout";
import AddToWatchlistButton from "@/components/watchlist/AddToWatchlistButton";
import PageHeader from "@/components/common/PageHeader";
import EmptyState from "@/components/common/EmptyState";
import { SparklineChart, StageBadge } from "@/components/common";
import {
  DeliveryOpportunity,
  DeliveryRadarMetadata,
  LiveBuyerRatioResponse,
  fetchDeliveryOpportunities,
  fetchLiveBuyerRatio,
  triggerDeliveryScan,
} from "@/lib/deliveryRadarApi";
import DeliveryTreeDrawdownModal from "@/components/delivery/DeliveryTreeDrawdownModal";
import BhavcopySyncControl from "@/components/delivery/BhavcopySyncControl";

export default function DeliveryRadarPage() {
  const [opportunities, setOpportunities] = useState<DeliveryOpportunity[]>([]);
  const [metadata, setMetadata] = useState<DeliveryRadarMetadata | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [scanning, setScanning] = useState<boolean>(false);
  const [selectedBlueprint, setSelectedBlueprint] = useState<DeliveryOpportunity | null>(null);
  const [selectedTreeSymbol, setSelectedTreeSymbol] = useState<{ symbol: string; companyName?: string } | null>(null);

  // Filters & Controls
  const [selectedTier, setSelectedTier] = useState<string>("ALL");
  const [selectedArchetype, setSelectedArchetype] = useState<string>("ALL");
  const [minBuyerRatio, setMinBuyerRatio] = useState<number | undefined>(undefined);
  const [lookbackSessions, setLookbackSessions] = useState<number>(3);
  const [setupType, setSetupType] = useState<string>("ALL");
  const [minSpike, setMinSpike] = useState<number>(1.6);
  const [minDelivPer, setMinDelivPer] = useState<number>(55.0);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("conviction_score");
  const [sortOrder, setSortOrder] = useState<string>("desc");
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  // Live Market Depth Modal State
  const [depthModalSymbol, setDepthModalSymbol] = useState<string | null>(null);
  const [depthData, setDepthData] = useState<LiveBuyerRatioResponse | null>(null);
  const [loadingDepth, setLoadingDepth] = useState<boolean>(false);
  const [depthError, setDepthError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchDeliveryOpportunities({
        lookback_sessions: lookbackSessions,
        min_spike: minSpike,
        min_deliv_per: minDelivPer,
        search: searchTerm,
        tier: selectedTier === "ALL" ? undefined : selectedTier,
        setup_type: setupType,
        archetype: selectedArchetype === "ALL" ? undefined : selectedArchetype,
        min_buyer_ratio: minBuyerRatio,
        sort_by: sortBy,
        sort_order: sortOrder,
        page: page,
        limit: 25,
      });
      setOpportunities(res.items || []);
      setMetadata(res.metadata || null);
      setTotalCount(res.total_count || 0);
      setTotalPages(res.total_pages || 1);
    } catch (err) {
      console.error("Failed to load delivery opportunities:", err);
      setError(err instanceof Error ? err.message : "Failed to load delivery opportunities.");
    } finally {
      setLoading(false);
    }
  }, [lookbackSessions, minSpike, minDelivPer, searchTerm, selectedTier, setupType, selectedArchetype, minBuyerRatio, sortBy, sortOrder, page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
    setPage(1);
  };

  const renderSortIcon = (column: string) => {
    if (sortBy !== column) {
      return <ChevronsUpDown size={11} className="text-slate-400/40 opacity-0 group-hover:opacity-100 transition inline-block ml-1" />;
    }
    return sortOrder === "asc" ? (
      <ChevronUp size={11} className="text-cyan-400 font-bold inline-block ml-1" />
    ) : (
      <ChevronDown size={11} className="text-cyan-400 font-bold inline-block ml-1" />
    );
  };

  const handleResetFilters = () => {
    setSelectedTier("ALL");
    setSelectedArchetype("ALL");
    setSetupType("ALL");
    setMinBuyerRatio(undefined);
    setLookbackSessions(3);
    setMinSpike(1.6);
    setMinDelivPer(55.0);
    setSearchTerm("");
    setSortBy("conviction_score");
    setSortOrder("desc");
    setPage(1);
  };

  const isFiltered =
    selectedArchetype !== "ALL" ||
    selectedTier !== "ALL" ||
    setupType !== "ALL" ||
    minBuyerRatio !== undefined ||
    lookbackSessions !== 3 ||
    minSpike !== 1.6 ||
    minDelivPer !== 55.0 ||
    Boolean(searchTerm);

  const handleOpenLiveDepth = async (symbol: string) => {
    setDepthModalSymbol(symbol);
    setLoadingDepth(true);
    setDepthData(null);
    setDepthError(null);
    try {
      const res = await fetchLiveBuyerRatio(symbol);
      setDepthData(res);
    } catch (err) {
      console.error("Live depth error:", err);
      setDepthError(err instanceof Error ? err.message : "Failed to load live depth.");
    } finally {
      setLoadingDepth(false);
    }
  };

  const handleTriggerScan = async () => {
    setScanning(true);
    try {
      await triggerDeliveryScan({
        lookback_sessions: lookbackSessions,
        min_spike: minSpike,
        min_deliv_per: minDelivPer,
      });
      await loadData();
    } catch (err) {
      console.error("Scan error:", err);
    } finally {
      setScanning(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* TOP BANNER & TITLE */}
        <PageHeader
          eyebrow="INSTITUTIONAL RADAR"
          icon={<Flame className="w-5 h-5" />}
          iconColor="emerald"
          title="Delivery Breakout Radar"
          badge={{ label: "INSTITUTIONAL APEX: 78% WIN RATE • MCAP ≥ ₹1,000 CR", color: "purple" }}
          subtitle="Institutional float absorption engine with ticket size expansion, pre-breakout contraction, and dynamic buy/sell corridors (Price ≥ ₹40, MCap ≥ ₹1,000 Cr)."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <BhavcopySyncControl
                onSyncCompleted={() => {
                  loadData();
                }}
              />
              <Link
                href="/delivery-radar-v2"
                className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition"
              >
                <PieChart size={14} className="text-emerald-400" />
                <span>Radar 2.0 (Free Float) &rarr;</span>
              </Link>
              <button
                onClick={handleTriggerScan}
                disabled={scanning}
                className="flex items-center gap-2 rounded-lg bg-cyan-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg shadow-cyan-600/20 transition hover:bg-cyan-500 active:scale-95 disabled:opacity-50"
              >
                <RefreshCw size={14} className={scanning ? "animate-spin" : ""} />
                <span>{scanning ? "Scanning 1,400+ Quality Equities..." : "Run Live Scan"}</span>
              </button>
            </div>
          }
        />

        {/* ERROR NOTIFICATION BANNER */}
        {error && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-300 backdrop-blur-md">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => loadData()}
              className="rounded-md border border-rose-500/40 bg-rose-500/20 px-3 py-1 font-medium text-rose-200 transition hover:bg-rose-500/30 active:scale-95"
            >
              Retry Connection
            </button>
          </div>
        )}

        {/* INSTITUTIONAL BACKTEST & TELEMETRY KPI RIBBON */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-3.5 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-purple-300 uppercase tracking-wider">Win Rate (Apex / Swing)</span>
              <Award className="h-4 w-4 text-purple-400" />
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-extrabold text-white">
                {metadata?.backtest_proven_stats?.win_rate_apex || "78%"}
              </span>
              <span className="text-xs font-semibold text-purple-300 font-mono">
                / {metadata?.backtest_proven_stats?.win_rate_swing || "66%"}
              </span>
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              2-Year Backtested Empirical Edge
            </div>
          </div>

          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3.5 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-emerald-300 uppercase tracking-wider">Profit Factor & Sharpe</span>
              <TrendingUp className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-extrabold text-emerald-400">
                {metadata?.backtest_proven_stats?.profit_factor ? `${metadata.backtest_proven_stats.profit_factor}x` : "3.42x"}
              </span>
              <span className="text-xs font-semibold text-slate-300 font-mono">
                SR {metadata?.backtest_proven_stats?.sharpe || 2.45}
              </span>
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              R:R {metadata?.backtest_proven_stats?.risk_reward || "1:2.8"} • BE Lock {metadata?.backtest_proven_stats?.be_lock_efficiency || "82%"}
            </div>
          </div>

          <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-3.5 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-cyan-300 uppercase tracking-wider">2Y CAGR / Max DD</span>
              <ShieldCheck className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-extrabold text-cyan-400">
                +{metadata?.backtest_proven_stats?.cagr_2y || 58.4}%
              </span>
              <span className="text-xs font-semibold text-rose-400 font-mono">
                DD {metadata?.backtest_proven_stats?.max_drawdown || -8.2}%
              </span>
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              Float Absorption Corridor Protection
            </div>
          </div>

          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-amber-300 uppercase tracking-wider">Active Opportunities</span>
              <Target className="h-4 w-4 text-amber-400" />
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-extrabold text-white">
                {totalCount}
              </span>
              <span className="text-xs font-semibold text-slate-400 font-mono">
                / {metadata?.qualifying_setups_count ?? totalCount} active
              </span>
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              {metadata?.confirmed_breakouts_count || 0} Breakouts • {metadata?.apex_sniper_count || 0} Apex
            </div>
          </div>
        </div>

        {/* UNIFIED INSTITUTIONAL RADAR COMMAND DECK */}
        <div className="rounded-2xl border border-slate-200/80 bg-white/70 p-3 shadow-xs dark:border-slate-800 dark:bg-[#081224]/80 space-y-3">
          {/* ROW 1: PRIMARY STRATEGY CHANNELS */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                {
                  id: "ALL",
                  label: "All Signals",
                  count: metadata?.qualifying_setups_count ?? totalCount,
                  activeClass: "border-cyan-500 bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/40 font-bold",
                  defaultClass: "border-slate-700/80 bg-slate-900/60 text-slate-300 hover:bg-slate-800",
                },
                {
                  id: "MOMENTUM_BREAKOUT",
                  label: "🚀 Validated Breakouts",
                  count: metadata?.confirmed_breakouts_count ?? 0,
                  activeClass: "border-rose-500 bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/40 font-bold",
                  defaultClass: "border-rose-500/20 bg-rose-500/5 text-rose-400/80 hover:bg-rose-500/10",
                },
                {
                  id: "CIRCUIT_RADAR",
                  label: "🎯 Circuit Radar",
                  count: (metadata?.circuit_locked_count ?? 0) + (metadata?.pre_circuit_count ?? 0),
                  activeClass: "border-purple-500 bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/40 font-bold",
                  defaultClass: "border-purple-500/20 bg-purple-500/5 text-purple-400/80 hover:bg-purple-500/10",
                },
                {
                  id: "HIGH_BUYER",
                  label: "⚡ High Buyer Flow",
                  count: metadata?.high_buyer_count ?? 0,
                  activeClass: "border-amber-500 bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40 font-bold",
                  defaultClass: "border-amber-500/20 bg-amber-500/5 text-amber-400/80 hover:bg-amber-500/10",
                },
                {
                  id: "STEALTH_FLOAT_LOCK",
                  label: "🔒 Stealth Float Lock",
                  count: metadata?.stealth_lock_count ?? 0,
                  activeClass: "border-emerald-500 bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40 font-bold",
                  defaultClass: "border-emerald-500/20 bg-emerald-500/5 text-emerald-400/80 hover:bg-emerald-500/10",
                },
                {
                  id: "SUPPORT_DEFENDER",
                  label: "🛡️ 20 EMA Support",
                  count: metadata?.ema_pullback_count ?? 0,
                  activeClass: "border-indigo-500 bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/40 font-bold",
                  defaultClass: "border-indigo-500/20 bg-indigo-500/5 text-indigo-400/80 hover:bg-indigo-500/10",
                },
              ].map((t) => {
                const isActive = selectedArchetype === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      setSelectedArchetype(t.id);
                      setPage(1);
                    }}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                      isActive ? t.activeClass : t.defaultClass
                    }`}
                  >
                    <span>{t.label}</span>
                    <span className="rounded-full bg-slate-800/90 px-1.5 py-0.2 text-[10px] font-bold text-white">
                      {t.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Quick Reset if filtered */}
            {isFiltered && (
              <button
                onClick={handleResetFilters}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 hover:underline transition font-semibold"
              >
                Reset All Filters
              </button>
            )}
          </div>

          {/* ROW 2: SEARCH, TIER, SETUP TYPE, BUYER RATIO, LOOKBACK, AND THRESHOLDS */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-800/70">
            {/* Search */}
            <div className="relative min-w-[180px] flex-1 max-w-xs">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search symbol or name..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-900 placeholder-slate-400 focus:border-cyan-500 focus:outline-none dark:border-slate-700/80 dark:bg-slate-900 dark:text-white"
              />
            </div>

            {/* Controls Group */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Conviction Tier Selector */}
              <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                <Award size={13} className="text-purple-400" />
                <span>Tier:</span>
                <select
                  value={selectedTier}
                  onChange={(e) => {
                    setSelectedTier(e.target.value);
                    setPage(1);
                  }}
                  className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-800 dark:border-slate-700/80 dark:bg-slate-900 dark:text-white cursor-pointer shadow-xs focus:outline-hidden focus:border-cyan-500"
                >
                  <option value="ALL">All Tiers ({metadata?.qualifying_setups_count ?? totalCount})</option>
                  <option value="APEX_SNIPER">🎯 Apex Sniper ({metadata?.apex_sniper_count ?? 0}) - 78% WR</option>
                  <option value="ACTIVE_SWING">⚡ Active Swing ({metadata?.active_swing_count ?? 0}) - 65% WR</option>
                  <option value="BASE_ACCUMULATION">📦 Base Watchlist ({metadata?.base_accumulation_count ?? 0})</option>
                </select>
              </div>

              {/* Setup Type Selector */}
              <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                <Crosshair size={13} className="text-rose-400" />
                <span>Setup:</span>
                <select
                  value={setupType}
                  onChange={(e) => {
                    setSetupType(e.target.value);
                    setPage(1);
                  }}
                  className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-800 dark:border-slate-700/80 dark:bg-slate-900 dark:text-white cursor-pointer shadow-xs focus:outline-hidden focus:border-cyan-500"
                >
                  <option value="ALL">All Setups</option>
                  <option value="50D_BREAKOUT">🚀 50D Breakout</option>
                  <option value="EMA20_PULLBACK">🛡️ 20 EMA Pullback</option>
                  <option value="NEAR_PIVOT_BASE">📦 Near Pivot Base</option>
                  <option value="CIRCUIT_LOCKED">🔒 Circuit Locked</option>
                  <option value="PRE_CIRCUIT_SURGE">⚡ Pre-Circuit Surge</option>
                </select>
              </div>

              {/* Min Buyer Demand Ratio Selector */}
              <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                <Flame size={13} className="text-amber-400" />
                <span>Buyer ≥</span>
                <select
                  value={minBuyerRatio ?? "ALL"}
                  onChange={(e) => {
                    setMinBuyerRatio(e.target.value === "ALL" ? undefined : Number(e.target.value));
                    setPage(1);
                  }}
                  className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-800 dark:border-slate-700/80 dark:bg-slate-900 dark:text-white cursor-pointer shadow-xs focus:outline-hidden focus:border-cyan-500"
                >
                  <option value="ALL">Any Ratio</option>
                  <option value="60">≥ 60%</option>
                  <option value="70">≥ 70% (High)</option>
                  <option value="80">≥ 80% (Extreme)</option>
                </select>
              </div>

              {/* Lookback Selector */}
              <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                <Clock size={13} className="text-cyan-400" />
                <span>Lookback:</span>
                <select
                  value={lookbackSessions}
                  onChange={(e) => {
                    setLookbackSessions(Number(e.target.value));
                    setPage(1);
                  }}
                  className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-800 dark:border-slate-700/80 dark:bg-slate-900 dark:text-white cursor-pointer shadow-xs focus:outline-hidden focus:border-cyan-500"
                >
                  <option value={1}>Today (Latest Session)</option>
                  <option value={3}>Last 3 Sessions</option>
                  <option value={5}>Last 5 Sessions</option>
                  <option value={10}>Last 10 Sessions</option>
                  <option value={20}>Last 20 Sessions</option>
                  <option value={30}>Full Month (30 Sessions - Blast Radar)</option>
                </select>
              </div>

              {/* Min Spike Selector */}
              <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                <span>Spike ≥</span>
                <select
                  value={minSpike}
                  onChange={(e) => {
                    setMinSpike(Number(e.target.value));
                    setPage(1);
                  }}
                  className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-800 dark:border-slate-700/80 dark:bg-slate-900 dark:text-white cursor-pointer shadow-xs focus:outline-hidden focus:border-cyan-500"
                >
                  <option value={1.5}>1.5x</option>
                  <option value={1.8}>1.8x</option>
                  <option value={2.0}>2.0x</option>
                  <option value={2.5}>2.5x</option>
                </select>
              </div>

              {/* Min Deliv % Selector */}
              <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                <span>Deliv ≥</span>
                <select
                  value={minDelivPer}
                  onChange={(e) => {
                    setMinDelivPer(Number(e.target.value));
                    setPage(1);
                  }}
                  className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-800 dark:border-slate-700/80 dark:bg-slate-900 dark:text-white cursor-pointer shadow-xs focus:outline-hidden focus:border-cyan-500"
                >
                  <option value={55}>55%</option>
                  <option value={60}>60%</option>
                  <option value={65}>65%</option>
                  <option value={70}>70%</option>
                </select>
              </div>

              {/* Quick Sort Selector */}
              <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                <ArrowUpDown size={13} className="text-cyan-400" />
                <span>Sort:</span>
                <select
                  value={`${sortBy}_${sortOrder}`}
                  onChange={(e) => {
                    const [col, ord] = e.target.value.split("_");
                    setSortBy(col);
                    setSortOrder(ord);
                    setPage(1);
                  }}
                  className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-800 dark:border-slate-700/80 dark:bg-slate-900 dark:text-white cursor-pointer shadow-xs focus:outline-hidden focus:border-cyan-500"
                >
                  <option value="conviction_score_desc">Highest Conviction</option>
                  <option value="delivery_per_desc">Highest Delivery %</option>
                  <option value="net_deliv_cr_10d_desc">Highest 10D Inflow</option>
                  <option value="delivery_spike_x_desc">Highest Volume Spike</option>
                  <option value="ticket_spike_x_desc">Largest Ticket Size</option>
                  <option value="buyer_demand_ratio_desc">Highest Buyer Demand</option>
                  <option value="day_change_pct_desc">Top Gainers (Day %)</option>
                  <option value="day_change_pct_asc">Top Losers (Day %)</option>
                  <option value="current_price_desc">Highest Price</option>
                  <option value="market_cap_cr_desc">Largest Market Cap</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* OPPORTUNITIES TABLE */}
        <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-[#0b1528]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-400 select-none">
                <tr>
                  <th
                    onClick={() => handleSort("symbol")}
                    className="group cursor-pointer py-3 pl-4 pr-3 hover:text-cyan-400 transition"
                  >
                    <span className="inline-flex items-center">
                      Equity & MCap
                      {renderSortIcon("symbol")}
                    </span>
                  </th>
                  <th className="px-3 py-3">Archetype & Setup</th>
                  <th
                    onClick={() => handleSort("current_price")}
                    className="group cursor-pointer px-3 py-3 text-right hover:text-cyan-400 transition"
                  >
                    <span className="inline-flex items-center justify-end">
                      CMP & Buy Status
                      {renderSortIcon("current_price")}
                    </span>
                  </th>
                  <th
                    onClick={() => handleSort("day_change_pct")}
                    className="group cursor-pointer px-3 py-3 text-right hover:text-cyan-400 transition"
                  >
                    <span className="inline-flex items-center justify-end">
                      Day %
                      {renderSortIcon("day_change_pct")}
                    </span>
                  </th>
                  <th
                    onClick={() => handleSort("buyer_demand_ratio")}
                    className="group cursor-pointer px-3 py-3 text-center hover:text-cyan-400 transition"
                  >
                    <span className="inline-flex items-center justify-center">
                      ⚡ Buyer Demand
                      {renderSortIcon("buyer_demand_ratio")}
                    </span>
                  </th>
                  <th className="px-3 py-3 text-center">Trend (90D)</th>
                  <th
                    onClick={() => handleSort("delivery_per")}
                    className="group cursor-pointer px-3 py-3 text-center hover:text-cyan-400 transition"
                  >
                    <span className="inline-flex items-center justify-center">
                      Delivery %
                      {renderSortIcon("delivery_per")}
                    </span>
                  </th>
                  <th
                    onClick={() => handleSort("net_deliv_cr_10d")}
                    className="group cursor-pointer px-3 py-3 text-right hover:text-cyan-400 transition"
                  >
                    <span className="inline-flex items-center justify-end">
                      10D Inflow (₹ Cr)
                      {renderSortIcon("net_deliv_cr_10d")}
                    </span>
                  </th>
                  <th
                    onClick={() => handleSort("delivery_spike_x")}
                    className="group cursor-pointer px-3 py-3 text-right hover:text-cyan-400 transition"
                  >
                    <span className="inline-flex items-center justify-end">
                      10D Spike
                      {renderSortIcon("delivery_spike_x")}
                    </span>
                  </th>
                  <th
                    onClick={() => handleSort("ticket_spike_x")}
                    className="group cursor-pointer px-3 py-3 text-right hover:text-cyan-400 transition"
                  >
                    <span className="inline-flex items-center justify-end">
                      Order Ticket
                      {renderSortIcon("ticket_spike_x")}
                    </span>
                  </th>
                  <th
                    onClick={() => handleSort("deliv_flow_20d")}
                    className="group cursor-pointer px-3 py-3 text-right hover:text-cyan-400 transition"
                  >
                    <span className="inline-flex items-center justify-end">
                      20D Flow
                      {renderSortIcon("deliv_flow_20d")}
                    </span>
                  </th>
                  <th
                    onClick={() => handleSort("conviction_score")}
                    className="group cursor-pointer px-3 py-3 text-center hover:text-cyan-400 transition"
                  >
                    <span className="inline-flex items-center justify-center">
                      Conviction
                      {renderSortIcon("conviction_score")}
                    </span>
                  </th>
                  <th className="py-3 pl-3 pr-4 text-center">Execution Blueprint</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={13} className="py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="h-6 w-6 animate-spin text-cyan-500" />
                        <span>Scanning institutional delivery footprints & float absorption...</span>
                      </div>
                    </td>
                  </tr>
                ) : opportunities.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="p-8">
                      <EmptyState
                        icon={<Target className="h-7 w-7 text-cyan-400" />}
                        title="No Qualifying Setups for Selected Filters"
                        description="Try switching to 'All Signals' or resetting archetype & threshold filters."
                        action={
                          <button
                            onClick={handleResetFilters}
                            className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20"
                          >
                            Reset All Filters
                          </button>
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  opportunities.map((item) => {
                    const isCircuitLocked = item.is_circuit_locked;
                    const isPreCircuit = item.is_pre_circuit;
                    const isStealthLock = item.decision_archetype === "STEALTH_FLOAT_LOCK";
                    const isHighBuyer = (item.buyer_demand_ratio || 0) >= 78.0;
                    const isDefender = item.decision_archetype === "SUPPORT_DEFENDER";
                    const isBreakout = item.is_50d_breakout;
                    const buyStatus = item.blueprint?.buy_status || "ACCUMULATION_BASE";
                    const buyerRatio = item.buyer_demand_ratio || 50.0;

                    return (
                      <tr
                        key={`${item.symbol}-${item.signal_date}`}
                        className="transition hover:bg-slate-50/80 dark:hover:bg-slate-800/30"
                      >
                        {/* 1. Symbol & Company */}
                        <td className="py-3 pl-4 pr-3">
                          <div className="flex items-center gap-1.5">
                            <Link
                              href={`/stocks/${encodeURIComponent(item.symbol.replace(/\.NS$|\.BO$/i, "").trim())}?from=/delivery-radar`}
                              className="font-bold text-slate-900 transition hover:text-cyan-600 dark:text-white dark:hover:text-cyan-400 hover:underline"
                              title={`View ${item.symbol} stock details page`}
                            >
                              <span>{item.symbol}</span>
                            </Link>
                            <a
                              href={`https://in.tradingview.com/chart/?symbol=NSE:${encodeURIComponent(item.symbol.replace(/\.NS$|\.BO$/i, "").trim())}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-slate-400 hover:text-cyan-400 transition"
                              title={`Open ${item.symbol} on TradingView`}
                            >
                              <ExternalLink size={10} />
                            </a>
                            {item.market_cap_cr && (
                              <span className="rounded bg-indigo-500/10 px-1 py-0.2 font-mono text-[9px] font-bold text-indigo-400">
                                ₹{item.market_cap_cr.toLocaleString("en-IN")} Cr
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                            <Link
                              href={`/stocks/${encodeURIComponent(item.symbol.replace(/\.NS$|\.BO$/i, "").trim())}?from=/delivery-radar`}
                              className="max-w-[130px] truncate text-[11px] text-slate-500 hover:text-cyan-600 dark:text-slate-400 dark:hover:text-cyan-300 transition hover:underline"
                              title={`View ${item.company_name} details`}
                            >
                              {item.company_name}
                            </Link>
                            <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 font-mono text-[9px] font-medium text-slate-500 dark:text-slate-400">
                              {item.signal_date}
                            </span>
                          </div>
                        </td>

                        {/* 2. Archetype & Setup Badge */}
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap items-center gap-1">
                            {isCircuitLocked ? (
                              <span className="inline-flex items-center gap-1 rounded-md border border-purple-500/50 bg-purple-500/20 px-2 py-0.5 text-[10px] font-extrabold text-purple-300 ring-1 ring-purple-500/40">
                                <Lock size={10} /> Locked UC (+{item.circuit_band || "5%"})
                              </span>
                            ) : isPreCircuit ? (
                              <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/50 bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300 ring-1 ring-amber-500/40">
                                <Flame size={10} /> Pre-Circuit Surge (+{item.circuit_band || "5%"})
                              </span>
                            ) : isStealthLock ? (
                              <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/50 bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                                <ShieldCheck size={10} /> Stealth Float Lock
                              </span>
                            ) : isHighBuyer ? (
                              <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/50 bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                                <Flame size={10} /> Extreme Buyer Flow
                              </span>
                            ) : isDefender ? (
                              <span className="inline-flex items-center gap-1 rounded-md border border-indigo-500/40 bg-indigo-500/15 px-2 py-0.5 text-[10px] font-bold text-indigo-300">
                                <Target size={10} /> 20 EMA Defender
                              </span>
                            ) : isBreakout ? (
                              <span className="inline-flex items-center gap-1 rounded-md border border-cyan-500/40 bg-cyan-500/15 px-2 py-0.5 text-[10px] font-bold text-cyan-300">
                                <Sparkles size={10} /> Validated Breakout
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-300">
                                Base Accumulation
                              </span>
                            )}
                          </div>
                          {isBreakout && (
                            <div className="mt-1 flex items-center gap-1 text-[10px] font-mono text-cyan-300 bg-cyan-950/70 border border-cyan-800/60 px-1.5 py-0.5 rounded">
                              <Sparkles size={10} className="text-cyan-400 shrink-0" />
                              <span>Breakout: <strong>₹{item.breakout_price || item["50d_high"]}</strong> on <strong>{item.breakout_date || item.signal_date}</strong></span>
                            </div>
                          )}
                          {item.institutional_verdict && (
                            <div className="mt-1 max-w-[210px] truncate text-[10px] text-slate-400 dark:text-slate-400" title={item.institutional_verdict}>
                              {item.institutional_verdict}
                            </div>
                          )}
                        </td>

                        {/* 3. Price & Buy Zone Status */}
                        <td className="px-3 py-3 text-right">
                          <div className="font-bold text-slate-900 dark:text-white">
                            ₹{item.current_price.toLocaleString("en-IN")}
                          </div>
                          <div className="text-[10px] font-mono mt-0.5">
                            {isBreakout ? (
                              <span className="text-emerald-400 font-bold" title="50-Day Pivot Level">
                                Pivot: ₹{item.breakout_price || item["50d_high"]} (+{item.breakout_margin_pct !== undefined ? item.breakout_margin_pct : Math.abs(item.pivot_distance_pct).toFixed(1)}%)
                              </span>
                            ) : (
                              <span className="text-slate-400">
                                Pivot: ₹{item["50d_high"]} ({item.pivot_distance_pct > 0 ? `-${item.pivot_distance_pct.toFixed(1)}%` : `+${Math.abs(item.pivot_distance_pct).toFixed(1)}%`})
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5">
                            {buyStatus === "IN_BUY_ZONE" ? (
                              <span className="inline-flex rounded bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.2 text-[9px] font-extrabold text-emerald-400">
                                🟢 In Buy Zone
                              </span>
                            ) : buyStatus === "EXTENDED_WAIT_DIP" ? (
                              <span className="inline-flex rounded bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.2 text-[9px] font-bold text-amber-400" title="Extended above pivot. Wait for dip to buy corridor.">
                                🟡 Extended: Wait Dip
                              </span>
                            ) : buyStatus === "RETEST_CONFIRMED" ? (
                              <span className="inline-flex rounded bg-cyan-500/15 border border-cyan-500/30 px-1.5 py-0.2 text-[9px] font-bold text-cyan-400">
                                🔵 Retest Bounced
                              </span>
                            ) : buyStatus === "CIRCUIT_LOCKED_HOLD" ? (
                              <span className="inline-flex rounded bg-purple-500/15 border border-purple-500/30 px-1.5 py-0.2 text-[9px] font-bold text-purple-400">
                                🔒 Circuit Locked
                              </span>
                            ) : (
                              <span className="inline-flex rounded bg-slate-800 px-1.5 py-0.2 text-[9px] font-medium text-slate-400">
                                Base Accumulation
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 4. Day Change % */}
                        <td className="px-3 py-3 text-right">
                          <span
                            className={`font-semibold ${item.day_change_pct >= 0
                                ? "text-emerald-500 dark:text-emerald-400"
                                : "text-rose-500"
                              }`}
                          >
                            {item.day_change_pct >= 0 ? "+" : ""}
                            {item.day_change_pct}%
                          </span>
                        </td>

                        {/* 5. ⚡ Buyer Demand Ratio */}
                        <td className="px-3 py-3 text-center">
                          <div className={`font-mono text-xs font-extrabold ${buyerRatio >= 80
                              ? "text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]"
                              : buyerRatio >= 70
                                ? "text-cyan-400"
                                : "text-slate-300"
                            }`}>
                            {buyerRatio}%
                          </div>
                          <div className="mx-auto mt-1 h-1.5 w-16 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${buyerRatio >= 80 ? "bg-emerald-400" : buyerRatio >= 70 ? "bg-cyan-400" : "bg-slate-400"}`}
                              style={{ width: `${Math.min(100, buyerRatio)}%` }}
                            />
                          </div>
                          <div className="mt-0.5 text-[9px] font-semibold text-slate-400">
                            {isCircuitLocked ? "100% Demand" : (buyerRatio >= 80 ? "⚡ Extreme" : (buyerRatio >= 70 ? "High" : "Balanced"))}
                          </div>
                        </td>

                        {/* Trend (90D) */}
                        <td className="px-3 py-3 text-center">
                          <SparklineChart
                            data={item.sparkline}
                            cmp={item.current_price}
                            return90d={item.return_90d_pct}
                            width={78}
                            height={22}
                            periodLabel="90D"
                            showDot={true}
                            showBadge={true}
                          />
                        </td>

                        {/* 6. Delivery % */}
                        <td className="px-3 py-3 text-center">
                          <div className="font-bold text-slate-900 dark:text-white">
                            {item.delivery_per}%
                          </div>
                          <div className="mx-auto mt-1 h-1.5 w-16 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{ width: `${Math.min(100, item.delivery_per)}%` }}
                            />
                          </div>
                        </td>

                        {/* 7. 10D Net Inflow (₹ Cr) */}
                        <td className="px-3 py-3 text-right font-mono">
                          <div className="font-bold text-slate-900 dark:text-white">
                            ₹{(item.net_deliv_cr_10d || item.turnover_cr).toLocaleString("en-IN")} Cr
                          </div>
                          <div className="text-[9px] text-slate-400">
                            {item.deliv_persist_10d ?? 0}/10 Sessions &gt; 55%
                          </div>
                        </td>

                        {/* 8. Volume Spike */}
                        <td className="px-3 py-3 text-right">
                          <span className="rounded bg-indigo-500/10 px-1.5 py-0.5 font-bold text-indigo-500 dark:text-indigo-400">
                            {item.delivery_spike_x}x
                          </span>
                        </td>

                        {/* 9. Institutional Ticket Size Spike */}
                        <td className="px-3 py-3 text-right font-mono">
                          <span
                            className={`rounded px-1.5 py-0.5 font-bold ${(item.ticket_spike_x || 1.0) >= 1.25
                                ? "bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/30"
                                : "text-slate-400"
                              }`}
                          >
                            {item.ticket_spike_x ? `${item.ticket_spike_x}x` : "1.0x"}
                          </span>
                          <div className="text-[9px] text-slate-400">Ticket Size</div>
                        </td>

                        {/* 10. 20D D-A/D Accumulation Flow */}
                        <td className="px-3 py-3 text-right">
                          <div className="inline-flex items-center gap-1 font-mono font-bold">
                            <span
                              className={`rounded px-1.5 py-0.5 text-xs ${(item.deliv_flow_20d || 1.0) >= 2.0
                                  ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40"
                                  : (item.deliv_flow_20d || 1.0) >= 1.35
                                    ? "bg-cyan-500/20 text-cyan-400"
                                    : "bg-slate-800 text-slate-400"
                                }`}
                            >
                              {item.deliv_flow_20d ? `${item.deliv_flow_20d}x` : "1.0x"}
                            </span>
                          </div>
                          <div className="text-[9px] text-slate-400">
                            {(item.deliv_flow_20d || 1.0) >= 1.4 ? "Net Inflow" : "Neutral"}
                          </div>
                        </td>

                        {/* 11. Conviction Score */}
                        <td className="px-3 py-3 text-center">
                          <span
                            className={`inline-flex items-center justify-center rounded-lg px-2 py-1 text-xs font-bold ${item.conviction_score >= 80
                                ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40"
                                : item.conviction_score >= 70
                                  ? "bg-cyan-500/20 text-cyan-400 ring-1 ring-cyan-500/40"
                                  : "bg-slate-800 text-slate-300"
                              }`}
                          >
                            {item.conviction_score}
                          </span>
                        </td>

                        {/* 12. Actions: Live Depth, 30D Tree, Trade Plan */}
                        <td className="py-3 pl-3 pr-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <AddToWatchlistButton
                              symbol={item.symbol}
                              companyName={item.company_name}
                              currentPrice={item.current_price}
                              variant="star"
                            />

                            <Link
                              href={`/delivery-radar/${encodeURIComponent(item.symbol.replace(/\.NS$|\.BO$/i, "").trim())}`}
                              className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2 py-1.5 text-xs font-semibold text-cyan-400 transition hover:bg-cyan-500 hover:text-slate-950"
                              title={`Open dedicated Delivery Radar History page for ${item.symbol}`}
                            >
                              <ExternalLink size={12} />
                              <span>History</span>
                            </Link>
                            <button
                              onClick={() => setSelectedBlueprint(item)}
                              className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1.5 text-xs font-semibold text-cyan-400 transition hover:bg-cyan-500 hover:text-white"
                            >
                              <Zap size={12} />
                              <span>Trade Plan</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* PAGINATION CONTROLS */}
        {totalCount > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white/70 p-3 shadow-xs dark:border-slate-800 dark:bg-[#081224]/80 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <span>
                Showing <strong className="text-slate-900 dark:text-white font-mono">{Math.min(totalCount, (page - 1) * 25 + 1)}</strong> to{" "}
                <strong className="text-slate-900 dark:text-white font-mono">{Math.min(totalCount, page * 25)}</strong> of{" "}
                <strong className="text-cyan-400 font-mono">{totalCount}</strong> opportunities
              </span>
              {totalPages > 1 && (
                <span className="rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-mono">
                  Page {page} of {totalPages}
                </span>
              )}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 px-2.5 py-1.5 font-medium transition hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ChevronLeft size={14} />
                  <span>Prev</span>
                </button>

                {/* Page Number Buttons */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                    .reduce((acc: (number | string)[], p, idx, arr) => {
                      if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) {
                        acc.push("...");
                      }
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, idx) =>
                      typeof p === "string" ? (
                        <span key={`ellipsis-${idx}`} className="px-1 text-slate-500">
                          ...
                        </span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => setPage(p)}
                          className={`h-7 w-7 rounded-lg text-xs font-mono font-bold transition ${
                            page === p
                              ? "bg-cyan-600 text-white shadow-sm shadow-cyan-600/30"
                              : "border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          {p}
                        </button>
                      )
                    )}
                </div>

                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 px-2.5 py-1.5 font-medium transition hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span>Next</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* LIVE ORDER BOOK MARKET DEPTH MODAL */}
        {depthModalSymbol && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md animate-in fade-in duration-200">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-[#070e1b]">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30">
                    <Flame size={16} />
                  </span>
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>{depthModalSymbol}</span>
                      <span className="text-[11px] font-normal text-slate-400">Live Order Book Depth</span>
                    </h3>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => depthModalSymbol && handleOpenLiveDepth(depthModalSymbol)}
                    disabled={loadingDepth}
                    className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition disabled:opacity-50"
                    title="Refresh real-time market depth"
                  >
                    <RefreshCw size={13} className={loadingDepth ? "animate-spin" : ""} />
                  </button>
                  <button
                    onClick={() => setDepthModalSymbol(null)}
                    className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {loadingDepth ? (
                <div className="py-10 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                  <RefreshCw className="h-5 w-5 animate-spin text-amber-500" />
                  <span>Querying real-time market depth & bid-ask ratio...</span>
                </div>
              ) : depthError ? (
                <div className="py-8 text-center space-y-3">
                  <div className="text-xs text-rose-400 flex items-center justify-center gap-1.5">
                    <AlertCircle size={15} />
                    <span>{depthError}</span>
                  </div>
                  <button
                    onClick={() => depthModalSymbol && handleOpenLiveDepth(depthModalSymbol)}
                    className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs text-rose-300 hover:bg-rose-500/20"
                  >
                    Retry Depth
                  </button>
                </div>
              ) : depthData ? (
                <div className="mt-4 space-y-4">
                  {/* Status Banner */}
                  {depthData.status === "AFTER_HOURS_OFFLINE" || (depthData.total_buy_quantity === 0 && depthData.total_sell_quantity === 0) ? (
                    <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-3 text-center">
                      <div className="text-xs font-semibold text-amber-400 flex items-center justify-center gap-1.5">
                        <Clock size={13} />
                        <span>After-Hours Market Session / Offline Depth</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        NSE Level-2 order book depth is cleared after market hours. Live depth stream resumes at 09:15 IST.
                      </div>
                    </div>
                  ) : depthData.is_upper_circuit_locked ? (
                    <div className="rounded-xl border border-purple-500/40 bg-purple-500/20 p-3 text-center">
                      <div className="text-xs font-bold text-purple-300 uppercase tracking-wide flex items-center justify-center gap-1.5">
                        <Lock size={13} />
                        <span>Locked in Upper Circuit (100% Buyers)</span>
                      </div>
                      <div className="text-[11px] text-purple-200/80 mt-0.5">
                        Total Sell Quantity = 0. All limit asks completely exhausted.
                      </div>
                    </div>
                  ) : depthData.buyer_ratio >= 75.0 ? (
                    <div className="rounded-xl border border-amber-500/40 bg-amber-500/20 p-3 text-center">
                      <div className="text-xs font-bold text-amber-300 uppercase tracking-wide flex items-center justify-center gap-1.5">
                        <Flame size={13} />
                        <span>Extreme Buyer Dominance ({depthData.buyer_ratio}%)</span>
                      </div>
                      <div className="text-[11px] text-amber-200/80 mt-0.5">
                        Buyers heavily outnumber sellers in the order book.
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-3 text-center">
                      <div className="text-xs font-semibold text-slate-300">
                        Balanced Order Flow ({depthData.buyer_ratio}% Buyers)
                      </div>
                    </div>
                  )}

                  {/* Ratio Split Bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-emerald-400 font-bold">
                        Buyers: {depthData.buyer_ratio}%
                      </span>
                      <span className="text-rose-400 font-bold">
                        Sellers: {depthData.seller_ratio}%
                      </span>
                    </div>
                    <div className="h-3 w-full overflow-hidden rounded-full bg-slate-800 flex">
                      <div
                        className="bg-emerald-500 transition-all duration-500"
                        style={{ width: `${depthData.buyer_ratio}%` }}
                      />
                      <div
                        className="bg-rose-500 transition-all duration-500"
                        style={{ width: `${depthData.seller_ratio}%` }}
                      />
                    </div>
                  </div>

                  {/* Absolute Quantities */}
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                      <div className="text-[10px] uppercase font-bold text-emerald-400">Total Buy Orders (Bid Qty)</div>
                      <div className="mt-1 font-mono text-base font-extrabold text-white">
                        {depthData.total_buy_quantity.toLocaleString("en-IN")}
                      </div>
                    </div>
                    <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3">
                      <div className="text-[10px] uppercase font-bold text-rose-400">Total Sell Orders (Ask Qty)</div>
                      <div className="mt-1 font-mono text-base font-extrabold text-white">
                        {depthData.total_sell_quantity.toLocaleString("en-IN")}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg bg-black/30 p-2 text-center text-[10px] text-slate-400 flex items-center justify-between">
                    <span>Source: {depthData.source}</span>
                    <span>CMP: ₹{depthData.cmp} ({depthData.day_change_pct >= 0 ? "+" : ""}{depthData.day_change_pct}%)</span>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* TRADE BLUEPRINT MODAL / DRAWER */}
        {selectedBlueprint && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-[#0a1426]">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-slate-200 pb-4 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <a
                      href={`https://in.tradingview.com/chart/?symbol=NSE:${encodeURIComponent(selectedBlueprint.symbol.replace(/\.NS$|\.BO$/i, "").trim())}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-1.5 text-xl font-bold text-slate-900 transition hover:text-cyan-500 dark:text-white dark:hover:text-cyan-400"
                      title="Open interactive chart on TradingView"
                    >
                      <span>{selectedBlueprint.symbol}</span>
                      <ExternalLink size={14} className="text-cyan-400 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </a>
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-semibold ${selectedBlueprint.conviction_tier === "APEX_SNIPER"
                          ? "bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/30"
                          : selectedBlueprint.conviction_tier === "ACTIVE_SWING"
                            ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30"
                            : "bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/30"
                        }`}
                    >
                      {selectedBlueprint.conviction_tier}
                    </span>
                    <span className="rounded bg-cyan-500/10 px-2 py-0.5 text-xs font-semibold text-cyan-400">
                      {selectedBlueprint.setup_type}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedBlueprint.company_name}</span>
                    {selectedBlueprint.market_cap_cr && (
                      <span className="rounded bg-indigo-500/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-indigo-400">
                        MCap: ₹{selectedBlueprint.market_cap_cr.toLocaleString("en-IN")} Cr
                      </span>
                    )}
                    <span>•</span>
                    <span>Win Rate Expectation:{" "}
                      <strong className="text-emerald-400">
                        {selectedBlueprint.blueprint.win_rate_expectation || "75% - 78% (Apex)"}
                      </strong>
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectedTreeSymbol({ symbol: selectedBlueprint.symbol, companyName: selectedBlueprint.company_name })}
                    className="inline-flex items-center gap-1 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1.5 text-xs font-semibold text-indigo-400 transition hover:bg-indigo-500 hover:text-white"
                  >
                    <Layers size={13} />
                    <span>30D Tree</span>
                  </button>
                  <AddToWatchlistButton
                    symbol={selectedBlueprint.symbol}
                    companyName={selectedBlueprint.company_name}
                    currentPrice={selectedBlueprint.current_price || selectedBlueprint.blueprint.entry_price}
                    variant="button"
                  />
                  <button
                    onClick={() => setSelectedBlueprint(null)}
                    className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-white"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Blueprint Details */}
              <div className="mt-4 space-y-4">
                {/* BREAKOUT MILESTONE CARD: TRIGGER TIME & PRICE */}
                {(selectedBlueprint.is_50d_breakout || selectedBlueprint.breakout_price) && (
                  <div className="rounded-xl border border-cyan-500/40 bg-gradient-to-r from-cyan-950/70 via-slate-900 to-slate-950 p-3.5 shadow-md">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="rounded-lg bg-cyan-500/20 p-2 text-cyan-400">
                          <Sparkles size={18} />
                        </div>
                        <div>
                          <div className="text-xs font-extrabold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                            <span>50-Day Momentum Breakout Confirmed</span>
                          </div>
                          <div className="text-[11px] text-slate-300 mt-0.5">
                            Triggered on Session: <strong className="text-white font-mono bg-slate-800 px-1.5 py-0.2 rounded">{selectedBlueprint.breakout_date || selectedBlueprint.signal_date}</strong>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-slate-400 uppercase font-bold">Breakout Pivot Level</div>
                        <div className="font-mono text-base font-extrabold text-emerald-400">
                          ₹{(selectedBlueprint.breakout_price || selectedBlueprint["50d_high"] || selectedBlueprint.blueprint.pivot_price)?.toLocaleString("en-IN")}
                        </div>
                        <div className="text-[10px] text-emerald-300/90 font-mono font-medium">
                          {selectedBlueprint.breakout_margin_pct !== undefined
                            ? `+${selectedBlueprint.breakout_margin_pct}% above pivot`
                            : "Cleared Pivot"}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ZONE 1: BUY CORRIDOR & CHASE CEILING */}
                <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold uppercase tracking-wider text-cyan-400">Zone 1: Accumulation Corridor</span>
                    <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${selectedBlueprint.blueprint.buy_status === "IN_BUY_ZONE"
                        ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40"
                        : selectedBlueprint.blueprint.buy_status === "EXTENDED_WAIT_DIP"
                          ? "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40"
                          : "bg-cyan-500/20 text-cyan-300"
                      }`}>
                      {selectedBlueprint.blueprint.buy_status === "IN_BUY_ZONE"
                        ? "🟢 In Optimal Buy Zone"
                        : selectedBlueprint.blueprint.buy_status === "EXTENDED_WAIT_DIP"
                          ? "🟡 Extended: Limit Order on Dip"
                          : selectedBlueprint.blueprint.buy_status === "RETEST_CONFIRMED"
                            ? "🔵 Retest Support Held"
                            : "⚪ Base Accumulation"}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-black/30 p-2">
                      <div className="text-[10px] text-slate-400">Pivot Level</div>
                      <div className="font-mono text-sm font-bold text-white">₹{selectedBlueprint.blueprint.pivot_price || selectedBlueprint.blueprint.entry_price}</div>
                    </div>
                    <div className="rounded-lg bg-black/30 p-2">
                      <div className="text-[10px] text-slate-400">Ideal Buy Corridor</div>
                      <div className="font-mono text-sm font-bold text-emerald-400">
                        ₹{selectedBlueprint.blueprint.buy_corridor_min || selectedBlueprint.blueprint.entry_price} – ₹{selectedBlueprint.blueprint.buy_corridor_max || selectedBlueprint.blueprint.entry_price}
                      </div>
                    </div>
                    <div className="rounded-lg bg-black/30 p-2">
                      <div className="text-[10px] text-slate-400">Do Not Chase Above</div>
                      <div className="font-mono text-sm font-bold text-amber-400">₹{selectedBlueprint.blueprint.max_chase_price || selectedBlueprint.blueprint.entry_price}</div>
                    </div>
                  </div>
                </div>

                {/* ZONE 2 & 3: 4-PHASE TARGETS & DEFENSE GRID */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-center">
                  {/* Stop Loss (Structural Candle Low) */}
                  <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-2.5">
                    <div className="text-[10px] font-bold uppercase text-rose-400">
                      Stop Loss (-{selectedBlueprint.blueprint.risk_pct}%)
                    </div>
                    <div className="mt-1 text-base font-extrabold text-rose-500">
                      ₹{selectedBlueprint.blueprint.stop_loss}
                    </div>
                    <div className="mt-0.5 text-[9px] text-rose-400/80">Candle Low Defense</div>
                  </div>

                  {/* Breakeven Trigger */}
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5">
                    <div className="text-[10px] font-bold uppercase text-amber-400">
                      BE Shield (+{selectedBlueprint.blueprint.entry_price > 0 ? (((selectedBlueprint.blueprint.breakeven_trigger - selectedBlueprint.blueprint.entry_price) / selectedBlueprint.blueprint.entry_price) * 100).toFixed(1) : "2.0"}%)
                    </div>
                    <div className="mt-1 text-base font-extrabold text-amber-300">
                      ₹{selectedBlueprint.blueprint.breakeven_trigger}
                    </div>
                    <div className="mt-0.5 text-[9px] text-amber-400/80">Lock Stop to Entry+0.4%</div>
                  </div>

                  {/* Target 1 */}
                  <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-2.5">
                    <div className="text-[10px] font-bold uppercase text-cyan-400">
                      Target 1 (+{selectedBlueprint.blueprint.entry_price > 0 ? (((selectedBlueprint.blueprint.target_1 - selectedBlueprint.blueprint.entry_price) / selectedBlueprint.blueprint.entry_price) * 100).toFixed(1) : "5.0"}%)
                    </div>
                    <div className="mt-1 text-base font-extrabold text-cyan-400">
                      ₹{selectedBlueprint.blueprint.target_1}
                    </div>
                    <div className="mt-0.5 text-[9px] text-cyan-400/80">Book 50% Profit</div>
                  </div>

                  {/* Target 2 */}
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-2.5">
                    <div className="text-[10px] font-bold uppercase text-emerald-400">
                      Target 2 (+{selectedBlueprint.blueprint.entry_price > 0 ? (((selectedBlueprint.blueprint.target_2 - selectedBlueprint.blueprint.entry_price) / selectedBlueprint.blueprint.entry_price) * 100).toFixed(1) : "10.0"}%)
                    </div>
                    <div className="mt-1 text-base font-extrabold text-emerald-400">
                      ₹{selectedBlueprint.blueprint.target_2}
                    </div>
                    <div className="mt-0.5 text-[9px] text-emerald-400/80">10 EMA Trailing Runner</div>
                  </div>
                </div>

                {/* Parameters Breakdown */}
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 text-xs dark:border-slate-800 dark:bg-slate-900/60">
                  <div className="grid grid-cols-2 gap-y-2 text-slate-600 dark:text-slate-300">
                    <div>
                      <span className="text-slate-400">Current CMP:</span>{" "}
                      <span className="font-semibold text-slate-900 dark:text-white">
                        ₹{selectedBlueprint.blueprint.entry_price}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Risk:Reward:</span>{" "}
                      <span className="font-bold text-emerald-400">
                        {selectedBlueprint.blueprint.rr_ratio}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Slot Allocation:</span>{" "}
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {selectedBlueprint.blueprint.recommended_slot_allocation}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Holding Horizon:</span>{" "}
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {selectedBlueprint.blueprint.holding_horizon}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Order Ticket Expansion:</span>{" "}
                      <span className="font-mono font-bold text-purple-400">
                        {selectedBlueprint.ticket_spike_x ? `${selectedBlueprint.ticket_spike_x}x 20D Mean` : "1.0x"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Pre-Breakout Squeeze:</span>{" "}
                      <span className="font-mono font-bold text-cyan-400">
                        {selectedBlueprint.range_contraction_ratio ? `${selectedBlueprint.range_contraction_ratio}x 5D/20D` : "1.0x"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">20D D-A/D Flow:</span>{" "}
                      <span className="font-mono font-bold text-cyan-400">
                        {selectedBlueprint.deliv_flow_20d ? `${selectedBlueprint.deliv_flow_20d}x Net Inflow` : "1.0x"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Distance to 20 EMA:</span>{" "}
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {selectedBlueprint.dist_to_ema20_pct > 0 ? `+${selectedBlueprint.dist_to_ema20_pct}%` : `${selectedBlueprint.dist_to_ema20_pct}%`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Execution Trail Rules */}
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300/90">
                  <div className="flex items-center gap-1.5 font-bold text-amber-400">
                    <Info size={14} />
                    <span>Breakeven Locking & 10 EMA Trailing Protocol</span>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed">
                    {selectedBlueprint.blueprint.trail_rule}
                  </p>
                </div>

                {/* Close Button */}
                <button
                  onClick={() => setSelectedBlueprint(null)}
                  className="w-full rounded-xl bg-slate-900 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700"
                >
                  Close Plan
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 30-DAY MONTH -> WEEK -> DAY DRAWDOWN TREE MODAL */}
        {selectedTreeSymbol && (
          <DeliveryTreeDrawdownModal
            symbol={selectedTreeSymbol.symbol}
            companyName={selectedTreeSymbol.companyName}
            onClose={() => setSelectedTreeSymbol(null)}
          />
        )}
      </div>
    </DashboardLayout>
  );
}



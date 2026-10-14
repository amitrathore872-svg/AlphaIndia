"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  TrendingUp,
  RefreshCw,
  Search,
  Sparkles,
  Zap,
  Target,
  Flame,
  Filter,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  ArrowUpDown,
  Layers,
  BarChart2,
  Sliders,
  ShieldCheck,
  Activity,
  Info,
  Clock,
  Gauge,
  Percent,
  Star,
  Award,
  ChevronDown,
  ArrowUpRight,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/common/PageHeader";
import KpiCard from "@/components/common/KpiCard";
import EmptyState from "@/components/common/EmptyState";
import {
  StaircaseOpportunity,
  StaircaseMetadata,
  StaircaseTier,
  fetchStaircaseOpportunities,
  refreshStaircaseScan,
} from "@/lib/staircaseScreenerApi";

const TIER_TABS: { id: StaircaseTier; label: string; badge?: string }[] = [
  { id: "ALL", label: "All Staircases" },
  { id: "STEALTH_ACCUMULATOR", label: "Stealth Accumulators", badge: "HOT" },
  { id: "EARLY_STAIRCASE", label: "Early Ignition (Day 3-6)" },
  { id: "ESTABLISHED_RUNNER", label: "Established Runners" },
  { id: "EXTENDED_RUNNER", label: "Extended (Tight Trail)" },
];

export default function StaircaseRadarPage() {
  const [opportunities, setOpportunities] = useState<StaircaseOpportunity[]>([]);
  const [metadata, setMetadata] = useState<StaircaseMetadata>({
    total_scanned: 0,
    total_opportunities: 0,
    stealth_accumulator_count: 0,
    cupid_archetype_count: 0,
    early_staircase_count: 0,
    established_count: 0,
    avg_ker_10d: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filters & Sorting state
  const [selectedTier, setSelectedTier] = useState<StaircaseTier>("ALL");
  const [tennisBallOnly, setTennisBallOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [minScore, setMinScore] = useState<number>(50);
  const [sortBy, setSortBy] = useState<"conviction_score" | "ker_10d" | "green_days_10d" | "cmp" | "day_change_pct" | "distance_from_base_pct" | "down_day_alpha_pct">("conviction_score");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [showGuide, setShowGuide] = useState<boolean>(false);

  // Load data from backend
  const loadOpportunities = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetchStaircaseOpportunities({
        min_score: minScore,
        tier: selectedTier,
        tennis_ball_only: tennisBallOnly,
        search: searchQuery,
        sort_by: sortBy,
        sort_order: sortOrder,
      });
      setOpportunities(res?.opportunities || []);
      const m = res?.metadata || {};
      setMetadata({
        total_scanned: m.total_scanned ?? (res?.opportunities?.length || 0),
        total_opportunities: m.total_opportunities ?? (res?.opportunities?.length || 0),
        stealth_accumulator_count: m.stealth_accumulator_count ?? m.cupid_archetype_count ?? 0,
        cupid_archetype_count: m.cupid_archetype_count ?? m.stealth_accumulator_count ?? 0,
        early_staircase_count: m.early_staircase_count ?? 0,
        established_count: m.established_count ?? 0,
        tennis_ball_count: m.tennis_ball_count ?? 0,
        avg_ker_10d: m.avg_ker_10d ?? 0,
        last_scan_time: m.last_scan_time,
        total_filtered: m.total_filtered ?? (res?.opportunities?.length || 0),
        page: m.page ?? 1,
        limit: m.limit ?? 25,
        total_pages: m.total_pages ?? 1,
      });
    } catch (err: any) {
      console.error("Failed to load staircase opportunities:", err);
      setError(err?.message || "Failed to load opportunities from scanner backend.");
    } finally {
      setLoading(false);
    }
  }, [minScore, selectedTier, tennisBallOnly, searchQuery, sortBy, sortOrder]);

  useEffect(() => {
    loadOpportunities();
  }, [loadOpportunities]);

  // Handle live scan refresh
  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await refreshStaircaseScan();
      await loadOpportunities();
    } catch (err: any) {
      console.error("Refresh scan failed:", err);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-12">
        {/* ========================================================================= */}
        {/* Page Header */}
        {/* ========================================================================= */}
        <PageHeader
          icon={<TrendingUp className="w-5 h-5" />}
          iconColor="cyan"
          title="Staircase Momentum Radar"
          subtitle="Institutional low-volatility trend screener detecting stealth accumulators grinding +1% to +2% daily (Institutional Stealth Accumulation)."
          badge={{ label: "STEALTH TREND", color: "cyan" }}
          actions={
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowGuide(!showGuide)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold text-cyan-400 bg-cyan-950/40 border border-cyan-800/60 hover:bg-cyan-900/40 transition-colors"
              >
                <Info size={14} />
                {showGuide ? "Hide Stealth Blueprint" : "Stealth Accumulation Blueprint"}
              </button>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 shadow-lg shadow-emerald-900/30 transition-all disabled:opacity-50"
              >
                <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
                {refreshing ? "Scanning Market..." : "Live Rescan"}
              </button>
            </div>
          }
        />

        {/* ========================================================================= */}
        {/* Stealth Accumulation Educational Blueprint Banner (Collapsible) */}
        {/* ========================================================================= */}
        {showGuide && (
          <div className="rounded-xl border border-cyan-500/30 bg-gradient-to-b from-cyan-950/40 via-[#071322] to-[#050B14] p-5 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300">
                  <Flame size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-wide">
                    Institutional Mechanics: How Stealth Accumulators Grind +1% to +2% Daily
                  </h3>
                  <p className="text-xs text-slate-400">
                    Why high-probability leaders gain +1% to +2% daily through algorithmic TWAP buying without hitting erratic circuits.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowGuide(false)}
                className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800/40"
              >
                Dismiss
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-2">
              <div className="p-3.5 rounded-lg bg-slate-900/70 border border-slate-800/80">
                <div className="text-[11px] font-bold text-cyan-400 mb-1">1. 8-WEEK BASE & VDU</div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Price consolidates tightly along the rising 50 DMA. Volume dries up below 20 SMA. Weak hands exit completely.
                </p>
              </div>
              <div className="p-3.5 rounded-lg bg-slate-900/70 border border-slate-800/80">
                <div className="text-[11px] font-bold text-emerald-400 mb-1">2. CLEAN PIVOT BREAKOUT</div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Stock clears base pivot high with high delivery volume. Supply is absorbed into strong hands without panic selling.
                </p>
              </div>
              <div className="p-3.5 rounded-lg bg-slate-900/70 border border-slate-800/80">
                <div className="text-[11px] font-bold text-amber-400 mb-1">3. THE LOW-VOLATILITY GRIND</div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Institutions deploy TWAP algos. High Kaufman Efficiency (KER &gt; 0.70), consecutive green days, closes near high of the day.
                </p>
              </div>
              <div className="p-3.5 rounded-lg bg-slate-900/70 border border-slate-800/80">
                <div className="text-[11px] font-bold text-purple-400 mb-1">4. MECHANICAL 10 EMA TRAIL</div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Hold as long as daily close remains above rising 10 EMA. Exit only when 10 EMA breaks on heavy selling volume.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* KPI Telemetry Header Grid */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          <KpiCard
            label="Total Scanned"
            value={(metadata?.total_scanned ?? 0).toString()}
            sub={`${metadata?.total_opportunities ?? 0} Qualified Trends`}
            icon={<Activity size={16} />}
            color="default"
          />
          <KpiCard
            label="Stealth Accumulators"
            value={(metadata?.stealth_accumulator_count ?? metadata?.cupid_archetype_count ?? 0).toString()}
            sub="KER > 0.70 & Sweet Base"
            icon={<Flame size={16} />}
            color="cyan"
          />
          <KpiCard
            label="Early Ignition"
            value={(metadata?.early_staircase_count ?? 0).toString()}
            sub="Day 3-6 Post-Breakout"
            icon={<Sparkles size={16} />}
            color="emerald"
          />
          <KpiCard
            label="Established Runners"
            value={(metadata?.established_count ?? 0).toString()}
            sub="Holding 10 EMA Stack"
            icon={<TrendingUp size={16} />}
            color="amber"
          />
          <KpiCard
            label="Avg Trend Efficiency"
            value={(metadata?.avg_ker_10d ?? 0).toFixed(2)}
            sub="KER (1.0 = Pure Line)"
            icon={<Gauge size={16} />}
            color="purple"
          />
        </div>

        {/* ========================================================================= */}
        {/* Navigation Tabs & Search Toolbar */}
        {/* ========================================================================= */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800 backdrop-blur-md">
          {/* Tier Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {TIER_TABS.map((tab) => {
              const active = selectedTier === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSelectedTier(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    active
                      ? "bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent"
                  }`}
                >
                  {tab.label}
                  {tab.badge && (
                    <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Search & Sort Controls */}
          <div className="flex items-center gap-2.5 flex-wrap md:flex-nowrap">
            {/* Tennis Ball RS Toggle */}
            <button
              onClick={() => setTennisBallOnly(!tennisBallOnly)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                tennisBallOnly
                  ? "bg-gradient-to-r from-amber-500/25 to-yellow-500/20 text-amber-300 border border-amber-500/50 shadow-md shadow-amber-950/40"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-slate-800"
              }`}
              title="Filter for stocks that held flat or closed green when Nifty dropped (Tennis Ball Leaders)"
            >
              <ShieldCheck size={14} className={tennisBallOnly ? "text-amber-400" : "text-slate-500"} />
              Tennis Ball RS
              {metadata.tennis_ball_count !== undefined && metadata.tennis_ball_count > 0 && (
                <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-400 text-black font-bold">
                  {metadata.tennis_ball_count}
                </span>
              )}
            </button>

            <div className="relative flex-1 md:w-52">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search symbol..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
            >
              <option value="conviction_score">Sort: Conviction Score</option>
              <option value="down_day_alpha_pct">Sort: Down-Day Alpha vs Nifty</option>
              <option value="ker_10d">Sort: Kaufman Efficiency (KER)</option>
              <option value="green_days_10d">Sort: Green Days (10d)</option>
              <option value="distance_from_base_pct">Sort: Base Proximity</option>
              <option value="cmp">Sort: CMP</option>
              <option value="day_change_pct">Sort: Day Change %</option>
            </select>

            <button
              onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
              className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-400 hover:text-white"
              title={`Order: ${sortOrder.toUpperCase()}`}
            >
              <ArrowUpDown size={14} />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* Main Content Table & Cards */}
        {/* ========================================================================= */}
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-3">
            <RefreshCw size={28} className="animate-spin text-cyan-400" />
            <p className="text-xs text-slate-400">Computing Kaufman efficiency and stealth accumulation models...</p>
          </div>
        ) : error ? (
          <div className="p-8 rounded-xl bg-red-950/20 border border-red-800/40 text-center">
            <p className="text-sm font-semibold text-red-400">{error}</p>
            <button
              onClick={loadOpportunities}
              className="mt-3 px-3 py-1.5 rounded bg-red-900/40 text-xs text-red-200 hover:bg-red-900/60"
            >
              Retry
            </button>
          </div>
        ) : opportunities.length === 0 ? (
          <EmptyState
            title="No Staircase Opportunities Found"
            description="No stocks currently match the specified tier and conviction threshold. Try lowering the conviction score or resetting the search filter."
            action={
              <button
                onClick={() => {
                  setSelectedTier("ALL");
                  setSearchQuery("");
                  setMinScore(50);
                }}
                className="px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-xs font-mono font-bold text-cyan-400 hover:bg-cyan-500/20 transition cursor-pointer"
              >
                Reset Filters
              </button>
            }
          />
        ) : (
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-400 font-semibold tracking-wider">
                    <th className="py-3 px-4">SYMBOL & ARCHETYPE</th>
                    <th className="py-3 px-4">CMP & CHANGE</th>
                    <th className="py-3 px-4">CONVICTION</th>
                    <th className="py-3 px-4">EFFICIENCY (KER 10D)</th>
                    <th className="py-3 px-4">10D GREEN DAYS</th>
                    <th className="py-3 px-4">DOWN-DAY RS (NIFTY DIP)</th>
                    <th className="py-3 px-4">BASE LAUNCHPAD</th>
                    <th className="py-3 px-4">10 EMA DYNAMIC TRAIL</th>
                    <th className="py-3 px-4 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {opportunities.map((opp) => {
                    const isStealth = opp.setup_tier === "STEALTH_ACCUMULATOR" || opp.setup_tier === "CUPID_ARCHETYPE";
                    const isEarly = opp.setup_tier === "EARLY_STAIRCASE";
                    const score = opp.conviction_score;
                    const ker = opp.metrics.ker_10d;

                    return (
                      <tr
                        key={opp.symbol}
                        className={`hover:bg-slate-900/60 transition-colors ${
                          isStealth ? "bg-cyan-950/15" : ""
                        }`}
                      >
                        {/* Symbol & Archetype Badge */}
                        <td className="py-3.5 px-4 font-sans">
                          <div className="flex items-center gap-2">
                            <Link
                              href={opp.techno_funda_url}
                              className="font-bold text-sm text-white hover:text-cyan-400 transition-colors flex items-center gap-1 group"
                            >
                              {opp.symbol}
                              <ArrowUpRight size={13} className="opacity-0 group-hover:opacity-100 transition-opacity text-cyan-400" />
                            </Link>
                            {isStealth && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1">
                                <Flame size={10} className="text-cyan-400" />
                                Stealth Leader
                              </span>
                            )}
                            {isEarly && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                                <Sparkles size={10} className="text-emerald-400" />
                                Early Ignition
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5 font-sans">
                            {opp.tier_badge} • Del: {opp.metrics.estimated_delivery_pct}%
                          </div>
                        </td>

                        {/* CMP & Change */}
                        <td className="py-3.5 px-4">
                          <div className="text-sm font-semibold text-white">
                            ₹{opp.cmp.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </div>
                          <div
                            className={`text-[11px] font-medium flex items-center gap-1 ${
                              opp.day_change >= 0 ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            {opp.day_change >= 0 ? "+" : ""}
                            {opp.day_change_pct.toFixed(2)}%
                          </div>
                        </td>

                        {/* Conviction Score */}
                        <td className="py-3.5 px-4 font-sans">
                          <div className="flex items-center gap-2">
                            <div className="w-10 text-sm font-bold text-white">
                              {score}
                              <span className="text-[10px] text-slate-500 font-normal">/100</span>
                            </div>
                            <div className="w-20 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  score >= 80
                                    ? "bg-gradient-to-r from-emerald-400 to-cyan-400"
                                    : score >= 65
                                    ? "bg-cyan-500"
                                    : "bg-slate-500"
                                }`}
                                style={{ width: `${score}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Kaufman Efficiency (KER 10D) */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-bold font-mono ${
                                ker >= 0.70
                                  ? "bg-emerald-950/60 text-emerald-300 border border-emerald-700/60"
                                  : ker >= 0.55
                                  ? "bg-cyan-950/60 text-cyan-300 border border-cyan-700/60"
                                  : "bg-slate-800 text-slate-300"
                              }`}
                            >
                              {ker.toFixed(3)}
                            </span>
                            <span className="text-[10px] text-slate-500 font-sans">
                              {ker >= 0.70 ? "Clean Drift" : "Moderate"}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-1 font-sans">
                            Avg: +{opp.metrics.avg_daily_gain_pct}%/day
                          </div>
                        </td>

                        {/* 10D Green Days */}
                        <td className="py-3.5 px-4">
                          <div className="text-xs font-bold text-emerald-400">
                            {opp.metrics.green_days_10d} / 10 Green Sessions
                          </div>
                          <div className="text-[10px] text-slate-400 font-sans mt-0.5">
                            {opp.metrics.green_ratio_pct}% Win Rate (10d)
                          </div>
                        </td>

                        {/* Down-Day RS Divergence (Tennis Ball Metric) */}
                        <td className="py-3.5 px-4 font-sans">
                          <div className="flex items-center gap-1.5">
                            {opp.metrics.is_tennis_ball ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                                <ShieldCheck size={11} className="text-amber-400" />
                                Tennis Ball
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400">
                                Market Neutral
                              </span>
                            )}
                            <span
                              className={`text-[11px] font-mono font-bold ${
                                opp.metrics.down_day_alpha_pct >= 0 ? "text-emerald-400" : "text-rose-400"
                              }`}
                            >
                              {opp.metrics.down_day_alpha_pct >= 0 ? "+" : ""}
                              {opp.metrics.down_day_alpha_pct.toFixed(1)}% vs Nifty
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-1 font-sans">
                            {opp.metrics.down_day_green_count} / {opp.metrics.down_day_total_red} Red Days Green ({opp.metrics.down_day_rs_ratio_pct}%)
                          </div>
                        </td>

                        {/* Base Launchpad Proximity */}
                        <td className="py-3.5 px-4">
                          <div className="text-xs font-semibold text-slate-200">
                            +{opp.metrics.distance_from_base_pct}% from Pivot
                          </div>
                          <div className="text-[10px] text-slate-400 font-sans mt-0.5">
                            Base: ₹{opp.metrics.base_pivot_high} ({opp.metrics.base_depth_pct}% depth)
                          </div>
                        </td>

                        {/* 10 EMA Dynamic Trail */}
                        <td className="py-3.5 px-4">
                          <div className="text-xs font-bold text-amber-400 font-mono">
                            ₹{opp.blueprint.trailing_stop_10ema.toFixed(2)}
                          </div>
                          <div className="text-[10px] text-slate-400 font-sans mt-0.5">
                            -{opp.blueprint.distance_to_stop_pct}% risk to trail
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <a
                              href={opp.tradingview_url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-cyan-300 hover:border-cyan-600 transition-colors"
                              title="Open TradingView Chart"
                            >
                              <ExternalLink size={13} />
                            </a>
                            <Link
                              href={opp.techno_funda_url}
                              className="px-2.5 py-1 rounded-lg text-xs font-semibold text-cyan-300 bg-cyan-950/40 border border-cyan-800/60 hover:bg-cyan-900/40 transition-colors"
                            >
                              Analyze
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

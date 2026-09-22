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
  XCircle,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  ArrowUpDown,
  Layers,
  BarChart2,
  Sliders,
  ShieldCheck,
  Activity,
  Maximize2,
  X,
  Info,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import {
  MomentumOpportunity,
  MomentumRadarMetadata,
  fetchMomentumOpportunities,
  triggerMomentumScan,
  fetchMomentumFilterOptions,
} from "@/lib/momentumScreenerApi";

interface RuleToggle {
  id: string;
  label: string;
  field: keyof MomentumOpportunity["filters"];
  timeframe: string;
  active: boolean;
}

const INITIAL_RULES: RuleToggle[] = [
  { id: "c1", label: "Daily Volume > Daily SMA(Volume, 20)", field: "vol_gt_sma20", timeframe: "Daily", active: true },
  { id: "c2", label: "Daily Close > Daily Upper Bollinger band (20, 2)", field: "daily_close_gt_bb_upper", timeframe: "Daily", active: true },
  { id: "c3", label: "Weekly Close > Weekly Upper Bollinger band (20, 2)", field: "weekly_close_gt_bb_upper", timeframe: "Weekly", active: true },
  { id: "c4", label: "Daily RSI(14) > 60", field: "daily_rsi_gt_60", timeframe: "Daily", active: true },
  { id: "c5", label: "Weekly RSI(14) > 60", field: "weekly_rsi_gt_60", timeframe: "Weekly", active: true },
  { id: "c6", label: "Monthly RSI(14) > 60", field: "monthly_rsi_gt_60", timeframe: "Monthly", active: true },
  { id: "c7", label: "Weekly WMA(30) Crossed above / > WMA(50)", field: "weekly_wma_cross", timeframe: "Weekly", active: true },
  { id: "c8", label: "Weekly WMA(30) > 60", field: "weekly_wma30_gt_60", timeframe: "Weekly", active: true },
  { id: "c9", label: "Weekly WMA(50) > 60", field: "weekly_wma50_gt_60", timeframe: "Weekly", active: true },
  { id: "c10", label: "Daily Close > Daily Open (Bull Candle)", field: "daily_close_gt_open", timeframe: "Daily", active: false },
];

export default function MomentumRadarPage() {
  const [opportunities, setOpportunities] = useState<MomentumOpportunity[]>([]);
  const [metadata, setMetadata] = useState<MomentumRadarMetadata | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [scanning, setScanning] = useState<boolean>(false);
  const [sectors, setSectors] = useState<string[]>([]);
  const [selectedOpportunity, setSelectedOpportunity] = useState<MomentumOpportunity | null>(null);

  // Filter Rules & Controls
  const [rules, setRules] = useState<RuleToggle[]>(INITIAL_RULES);
  const [minMatches, setMinMatches] = useState<number>(6);
  const [requireStrict, setRequireStrict] = useState<boolean>(false);
  const [conviction79Only, setConviction79Only] = useState<boolean>(false);
  const [selectedSector, setSelectedSector] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("match_count");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  // Toggle single rule
  const handleToggleRule = (id: string) => {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, active: !r.active } : r))
    );
  };

  // Load backend data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchMomentumOpportunities({
        min_matches: requireStrict ? 9 : minMatches,
        require_strict: requireStrict,
        search: searchTerm,
        sector: selectedSector === "ALL" ? undefined : selectedSector,
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
      console.error("Failed to load momentum opportunities:", err);
    } finally {
      setLoading(false);
    }
  }, [minMatches, requireStrict, searchTerm, selectedSector, sortBy, sortOrder, page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load filter options (sectors)
  useEffect(() => {
    fetchMomentumFilterOptions()
      .then((opts) => {
        if (opts && opts.sectors) {
          setSectors(opts.sectors);
        }
      })
      .catch(() => {});
  }, []);

  const handleTriggerScan = async () => {
    setScanning(true);
    try {
      await triggerMomentumScan();
      await loadData();
    } catch (err) {
      console.error("Failed to trigger scan:", err);
    } finally {
      setScanning(false);
    }
  };

  // Dynamically compute active filter match for each stock based on UI toggles
  const processedOpportunities = useMemo(() => {
    const activeRules = rules.filter((r) => r.active);
    let list = opportunities;
    if (activeRules.length > 0) {
      list = opportunities.map((opp) => {
        let customMatchCount = 0;
        activeRules.forEach((rule) => {
          if (opp.filters && opp.filters[rule.field]) {
            customMatchCount += 1;
          }
        });
        const isCustomAllMatched = customMatchCount === activeRules.length;
        return {
          ...opp,
          customMatchCount,
          activeRulesCount: activeRules.length,
          isCustomAllMatched,
        };
      });
    }
    if (conviction79Only) {
      list = list.filter((opp) => (opp.conviction_score || 0) >= 79);
    }
    return list;
  }, [opportunities, rules, conviction79Only]);

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* HEADER & TOP BANNER */}
        <div className="rounded-2xl border border-slate-800 bg-[#07111F]/90 p-5 shadow-xl backdrop-blur-md">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  <Zap className="h-5 w-5" />
                </div>
                <h1 className="text-xl md:text-2xl font-black font-mono tracking-tight text-white">
                  SUPER MOMENTUM RADAR
                </h1>
                <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-xs font-mono font-bold text-cyan-300">
                  TRIPLE RSI & BB EXPLOSION
                </span>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-mono font-bold text-emerald-400">
                  CASH SEGMENT
                </span>
              </div>
              <p className="text-xs md:text-sm text-slate-400 max-w-3xl">
                Multi-Timeframe institutional momentum scanner targeting stocks with Volume Expansion, Daily & Weekly Upper Bollinger Band breakouts, Triple RSI (Daily/Weekly/Monthly &gt; 60), and Weekly WMA 30/50 Golden Cross.
              </p>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleTriggerScan}
                disabled={scanning}
                className="flex items-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-950/60 px-3.5 py-2 text-xs font-mono font-bold text-cyan-300 hover:bg-cyan-900/80 transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${scanning ? "animate-spin" : ""}`} />
                <span>{scanning ? "Scanning Universe..." : "Trigger Live Scan"}</span>
              </button>

              <button
                onClick={() => setRequireStrict(!requireStrict)}
                className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-mono font-bold transition-all cursor-pointer ${
                  requireStrict
                    ? "border-emerald-500/50 bg-emerald-950/70 text-emerald-300 shadow-lg shadow-emerald-950/50"
                    : "border-slate-800 bg-slate-900/80 text-slate-400 hover:text-white"
                }`}
              >
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span>Strict All 9/9 Pass: {requireStrict ? "ON" : "OFF"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* METRICS & TELEMETRY RIBBON */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="rounded-xl border border-slate-800/80 bg-slate-950/80 p-3.5 flex flex-col justify-between">
            <span className="text-[10px] uppercase font-mono font-bold text-slate-400">Total Scanned</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold font-mono text-white">{metadata?.total_scanned || 0}</span>
              <span className="text-[10px] text-slate-500 font-mono">Equities</span>
            </div>
          </div>

          <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-3.5 flex flex-col justify-between">
            <span className="text-[10px] uppercase font-mono font-bold text-emerald-400">10/10 Perfect</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold font-mono text-emerald-300">{metadata?.perfect_10_count || 0}</span>
              <span className="text-[10px] text-emerald-400/70 font-mono">Breakouts</span>
            </div>
          </div>

          <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-3.5 flex flex-col justify-between">
            <span className="text-[10px] uppercase font-mono font-bold text-cyan-400">Core 9/9 Passed</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold font-mono text-cyan-300">{metadata?.core_9_count || 0}</span>
              <span className="text-[10px] text-cyan-400/70 font-mono">All Filters</span>
            </div>
          </div>

          <div className="rounded-xl border border-purple-500/20 bg-purple-950/20 p-3.5 flex flex-col justify-between">
            <span className="text-[10px] uppercase font-mono font-bold text-purple-400">High Conviction</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold font-mono text-purple-300">{metadata?.high_conviction_count || 0}</span>
              <span className="text-[10px] text-purple-400/70 font-mono">&gt;= 8/10</span>
            </div>
          </div>

          <div className="rounded-xl border border-amber-500/20 bg-amber-950/20 p-3.5 flex flex-col justify-between">
            <span className="text-[10px] uppercase font-mono font-bold text-amber-400">Conviction 79+</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold font-mono text-amber-300">
                {metadata?.conviction_79_count ?? metadata?.high_conviction_count ?? 0}
              </span>
              <span className="text-[10px] text-amber-400/70 font-mono">Alert Tier</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-slate-950/80 p-3.5 flex flex-col justify-between">
            <span className="text-[10px] uppercase font-mono font-bold text-slate-400">Last Telemetry</span>
            <div className="flex flex-col mt-1">
              <span className="text-xs font-bold font-mono text-slate-300 truncate">{metadata?.last_scan_time || "Ready"}</span>
              <span className="text-[10px] text-slate-500 font-mono">{metadata?.scan_duration_seconds ? `${metadata.scan_duration_seconds}s latency` : "Active"}</span>
            </div>
          </div>
        </div>

        {/* INTERACTIVE RULE ENGINE CONSOLE (MATCHING THE SCREENSHOT) */}
        <div className="rounded-2xl border border-slate-800 bg-[#07111F]/80 p-4 md:p-5 shadow-lg space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <Sliders className="h-4 w-4 text-cyan-400" />
              <h2 className="text-xs md:text-sm font-bold font-mono uppercase tracking-wider text-slate-200">
                Rule Engine Filter Conditions (Cash Segment)
              </h2>
            </div>
            <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2">
              <span>Click toggle to customize live screening logic</span>
              <button
                onClick={() => setRules(INITIAL_RULES)}
                className="text-cyan-400 hover:text-cyan-300 underline cursor-pointer text-[10px]"
              >
                Reset Defaults
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
            {rules.map((rule) => {
              return (
                <div
                  key={rule.id}
                  onClick={() => handleToggleRule(rule.id)}
                  className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                    rule.active
                      ? "bg-slate-900/90 border-cyan-500/40 text-slate-200 hover:border-cyan-400/60"
                      : "bg-slate-950/40 border-slate-800/60 text-slate-500 hover:border-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                        rule.timeframe === "Daily"
                          ? "bg-blue-500/10 text-blue-400 border border-blue-500/30"
                          : rule.timeframe === "Weekly"
                          ? "bg-purple-500/10 text-purple-400 border border-purple-500/30"
                          : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                      }`}
                    >
                      {rule.timeframe}
                    </span>
                    <span className={`text-xs font-mono truncate ${rule.active ? "text-slate-200" : "text-slate-500 line-through"}`}>
                      {rule.label}
                    </span>
                  </div>

                  {/* Toggle Pill */}
                  <div
                    className={`w-8 h-4 rounded-full p-0.5 transition-colors flex items-center ${
                      rule.active ? "bg-emerald-500 justify-end" : "bg-slate-800 justify-start"
                    }`}
                  >
                    <div className="w-3 h-3 rounded-full bg-white shadow-md" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* SEARCH, SECTOR & SORT TOOLBAR */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-800 bg-slate-950/70">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search symbol or company..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-9 pr-4 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50"
              />
            </div>

            {/* Sector Dropdown */}
            <select
              value={selectedSector}
              onChange={(e) => {
                setSelectedSector(e.target.value);
                setPage(1);
              }}
              className="py-1.5 px-3 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300 focus:outline-none focus:border-cyan-500/50"
            >
              <option value="ALL">All Sectors</option>
              {sectors.map((sec) => (
                <option key={sec} value={sec}>
                  {sec}
                </option>
              ))}
            </select>

            {/* Minimum Matches Dropdown */}
            <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
              <span>Min Matches:</span>
              <select
                value={minMatches}
                onChange={(e) => {
                  setMinMatches(Number(e.target.value));
                  setPage(1);
                }}
                className="bg-transparent text-cyan-300 font-bold focus:outline-none cursor-pointer"
              >
                <option value={10} className="bg-slate-900">10 / 10</option>
                <option value={9} className="bg-slate-900">&gt;= 9 / 10 (Alert Tier)</option>
                <option value={8} className="bg-slate-900">&gt;= 8 / 10</option>
                <option value={7} className="bg-slate-900">&gt;= 7 / 10</option>
                <option value={6} className="bg-slate-900">&gt;= 6 / 10</option>
                <option value={1} className="bg-slate-900">Any (1+)</option>
              </select>
            </div>

            {/* Quick 79+ Conviction Filter Button */}
            <button
              onClick={() => setConviction79Only((prev) => !prev)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer ${
                conviction79Only
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/60 shadow-xs"
                  : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
              }`}
            >
              <Flame className="h-3.5 w-3.5 text-amber-400" />
              <span>79+ Conviction (Alert Tier)</span>
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 self-end md:self-auto">
            <button
              onClick={() => setViewMode("table")}
              className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition-all cursor-pointer ${
                viewMode === "table" ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40" : "text-slate-400 hover:text-white"
              }`}
            >
              Table View
            </button>
            <button
              onClick={() => setViewMode("cards")}
              className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition-all cursor-pointer ${
                viewMode === "cards" ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40" : "text-slate-400 hover:text-white"
              }`}
            >
              Cards View
            </button>
          </div>
        </div>

        {/* MAIN RESULTS SECTION */}
        {loading ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-12 text-center space-y-3">
            <RefreshCw className="h-8 w-8 text-cyan-400 animate-spin mx-auto" />
            <p className="text-sm font-mono text-slate-300">Scanning liquid universe across Daily, Weekly, and Monthly timeframes...</p>
            <p className="text-xs font-mono text-slate-500">Evaluating Bollinger Bands, Wilder RSI, and WMA crossovers</p>
          </div>
        ) : processedOpportunities.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-12 text-center space-y-3">
            <Info className="h-8 w-8 text-amber-400 mx-auto" />
            <p className="text-base font-bold font-mono text-white">No Matching Stocks Found for Current Filter Threshold</p>
            <p className="text-xs font-mono text-slate-400 max-w-md mx-auto">
              Try adjusting the minimum match count or disabling strict 9/9 mode to see high-probability near-breakout coiling candidates.
            </p>
            <button
              onClick={() => {
                setRequireStrict(false);
                setMinMatches(6);
                setSelectedSector("ALL");
                setSearchTerm("");
              }}
              className="mt-2 px-4 py-2 rounded-xl bg-cyan-950 text-cyan-300 border border-cyan-700/50 text-xs font-mono font-bold hover:bg-cyan-900 cursor-pointer"
            >
              Reset Filters to View Developing Setups
            </button>
          </div>
        ) : viewMode === "table" ? (
          /* TABLE VIEW */
          <div className="rounded-2xl border border-slate-800 bg-[#07111F]/90 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-950/90 text-[10px] uppercase text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Symbol & Sector</th>
                    <th className="py-3 px-3">Price & Return</th>
                    <th className="py-3 px-3">Match Score</th>
                    <th className="py-3 px-3 text-center">Vol &gt; SMA</th>
                    <th className="py-3 px-3 text-center">Daily BB+</th>
                    <th className="py-3 px-3 text-center">Weekly BB+</th>
                    <th className="py-3 px-3 text-center">RSI D / W / M</th>
                    <th className="py-3 px-3 text-center">WMA 30/50</th>
                    <th className="py-3 px-3">Setup Trigger</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {processedOpportunities.map((opp) => {
                    const isPositive = opp.day_change_pct >= 0;
                    return (
                      <tr
                        key={opp.symbol}
                        className="hover:bg-slate-900/60 transition-colors group cursor-pointer"
                        onClick={() => setSelectedOpportunity(opp)}
                      >
                        {/* Symbol & Name */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-sm text-white group-hover:text-cyan-400 transition-colors">
                                {opp.symbol}
                              </span>
                              {opp.is_perfect_match && (
                                <span className="p-0.5 rounded bg-emerald-500/20 text-emerald-400">
                                  <Sparkles className="h-3 w-3" />
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-slate-400 truncate max-w-[140px]">
                              {opp.company_name}
                            </span>
                            <span className="text-[9px] text-slate-500">
                              {opp.sector}
                            </span>
                          </div>
                        </td>

                        {/* CMP & 1D Change */}
                        <td className="py-3.5 px-3">
                          <div className="flex flex-col">
                            <span className="font-bold text-white text-sm">
                              ₹{opp.cmp.toLocaleString("en-IN")}
                            </span>
                            <span
                              className={`text-[11px] font-bold ${
                                isPositive ? "text-emerald-400" : "text-rose-400"
                              }`}
                            >
                              {isPositive ? "+" : ""}
                              {opp.day_change_pct}%
                            </span>
                          </div>
                        </td>

                        {/* Match Score & Conviction */}
                        <td className="py-3.5 px-3">
                          <div className="flex flex-col gap-1 items-start">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border ${opp.tier_badge}`}
                            >
                              {opp.match_count}/10 MATCH
                            </span>
                            {opp.conviction_score !== undefined && (
                              <span
                                className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border inline-block ${
                                  opp.conviction_score >= 79
                                    ? "bg-amber-500/15 text-amber-300 border-amber-500/40"
                                    : "bg-slate-800/60 text-slate-400 border-slate-700/40"
                                }`}
                              >
                                {opp.conviction_score} PTS CONVICTION
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Condition 1: Volume */}
                        <td className="py-3.5 px-3 text-center">
                          {opp.filters.vol_gt_sma20 ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 rounded">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>{opp.indicators.volume_surge_ratio}x</span>
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[11px]">
                              {opp.indicators.volume_surge_ratio}x
                            </span>
                          )}
                        </td>

                        {/* Condition 2: Daily BB+ */}
                        <td className="py-3.5 px-3 text-center">
                          {opp.filters.daily_close_gt_bb_upper ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 rounded">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>₹{opp.indicators.daily_bb_upper}</span>
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[11px]">
                              ₹{opp.indicators.daily_bb_upper}
                            </span>
                          )}
                        </td>

                        {/* Condition 3: Weekly BB+ */}
                        <td className="py-3.5 px-3 text-center">
                          {opp.filters.weekly_close_gt_bb_upper ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-400 bg-purple-950/60 border border-purple-800/40 px-2 py-0.5 rounded">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>₹{opp.indicators.weekly_bb_upper}</span>
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[11px]">
                              ₹{opp.indicators.weekly_bb_upper}
                            </span>
                          )}
                        </td>

                        {/* Condition 4-6: Triple RSI */}
                        <td className="py-3.5 px-3 text-center">
                          <div className="flex items-center justify-center gap-1 text-[11px]">
                            <span
                              className={`px-1 py-0.5 rounded ${
                                opp.filters.daily_rsi_gt_60
                                  ? "bg-emerald-500/20 text-emerald-300 font-bold"
                                  : "text-slate-400"
                              }`}
                            >
                              D:{opp.indicators.daily_rsi}
                            </span>
                            <span
                              className={`px-1 py-0.5 rounded ${
                                opp.filters.weekly_rsi_gt_60
                                  ? "bg-purple-500/20 text-purple-300 font-bold"
                                  : "text-slate-400"
                              }`}
                            >
                              W:{opp.indicators.weekly_rsi}
                            </span>
                            <span
                              className={`px-1 py-0.5 rounded ${
                                opp.filters.monthly_rsi_gt_60
                                  ? "bg-amber-500/20 text-amber-300 font-bold"
                                  : "text-slate-400"
                              }`}
                            >
                              M:{opp.indicators.monthly_rsi}
                            </span>
                          </div>
                        </td>

                        {/* Condition 7: WMA Cross / Above */}
                        <td className="py-3.5 px-3 text-center">
                          {opp.filters.weekly_wma_cross ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-cyan-300 bg-cyan-950/60 border border-cyan-800/40 px-1.5 py-0.5 rounded">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>30 &gt; 50</span>
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[10px]">Lagging</span>
                          )}
                        </td>

                        {/* Trade Blueprint Trigger */}
                        <td className="py-3.5 px-3">
                          <div className="flex flex-col text-[11px]">
                            <span className="text-emerald-400 font-bold">
                              Trig: ₹{opp.trade_blueprint.entry_trigger}
                            </span>
                            <span className="text-slate-400 text-[10px]">
                              T1: ₹{opp.trade_blueprint.target_1} | SL: ₹{opp.trade_blueprint.stop_loss}
                            </span>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <a
                              href={opp.tradingview_url}
                              target="_blank"
                              rel="noreferrer"
                              title="Open in TradingView"
                              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-cyan-400 border border-slate-800 transition-colors"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                            <Link
                              href={opp.techno_funda_url}
                              title="Deep Dive Techno-Funda"
                              className="p-1.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-300 border border-cyan-800/40 transition-colors"
                            >
                              <Target className="h-3.5 w-3.5" />
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
        ) : (
          /* CARDS VIEW */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {processedOpportunities.map((opp) => (
              <div
                key={opp.symbol}
                onClick={() => setSelectedOpportunity(opp)}
                className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-cyan-500/50 transition-all cursor-pointer space-y-3 flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar: Symbol, Score, & Price */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold font-mono text-white hover:text-cyan-400 transition-colors">
                          {opp.symbol}
                        </h3>
                        {opp.is_perfect_match && (
                          <span className="p-0.5 rounded bg-emerald-500/20 text-emerald-400">
                            <Sparkles className="h-3 w-3" />
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 truncate max-w-[180px]">{opp.company_name}</p>
                      <span className="text-[10px] text-slate-500">{opp.sector}</span>
                    </div>

                    <div className="text-right">
                      <div className="text-base font-bold font-mono text-white">
                        ₹{opp.cmp.toLocaleString("en-IN")}
                      </div>
                      <div
                        className={`text-xs font-bold font-mono ${
                          opp.day_change_pct >= 0 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {opp.day_change_pct >= 0 ? "+" : ""}
                        {opp.day_change_pct}%
                      </div>
                    </div>
                  </div>

                  {/* Match Score Badge */}
                  <div className="mt-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${opp.tier_badge}`}>
                        {opp.setup_tier}
                      </span>
                      {opp.conviction_score !== undefined && (
                        <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                          opp.conviction_score >= 79
                            ? "bg-amber-500/15 text-amber-300 border-amber-500/40"
                            : "bg-slate-800/60 text-slate-400 border-slate-700/40"
                        }`}>
                          {opp.conviction_score} PTS
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">
                      R:R {opp.trade_blueprint.risk_reward}:1
                    </span>
                  </div>

                  {/* Multi-Timeframe Matrix */}
                  <div className="mt-3 grid grid-cols-3 gap-1.5 p-2 rounded-lg bg-slate-900/80 border border-slate-800/80 text-[10px] font-mono">
                    <div className="text-center">
                      <span className="text-slate-500 block text-[9px] uppercase">Daily RSI</span>
                      <span className={`font-bold ${opp.filters.daily_rsi_gt_60 ? "text-emerald-400" : "text-slate-400"}`}>
                        {opp.indicators.daily_rsi}
                      </span>
                    </div>
                    <div className="text-center">
                      <span className="text-slate-500 block text-[9px] uppercase">Weekly RSI</span>
                      <span className={`font-bold ${opp.filters.weekly_rsi_gt_60 ? "text-purple-400" : "text-slate-400"}`}>
                        {opp.indicators.weekly_rsi}
                      </span>
                    </div>
                    <div className="text-center">
                      <span className="text-slate-500 block text-[9px] uppercase">Monthly RSI</span>
                      <span className={`font-bold ${opp.filters.monthly_rsi_gt_60 ? "text-amber-400" : "text-slate-400"}`}>
                        {opp.indicators.monthly_rsi}
                      </span>
                    </div>
                  </div>

                  {/* Key Indicators Checkstrip */}
                  <div className="mt-2.5 space-y-1 text-[11px] font-mono">
                    <div className="flex items-center justify-between text-slate-300">
                      <span>Volume &gt; 20 SMA:</span>
                      <span className={opp.filters.vol_gt_sma20 ? "text-emerald-400 font-bold" : "text-slate-500"}>
                        {opp.indicators.volume_surge_ratio}x Surge
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span>Daily Upper BB (20,2):</span>
                      <span className={opp.filters.daily_close_gt_bb_upper ? "text-emerald-400 font-bold" : "text-slate-500"}>
                        ₹{opp.indicators.daily_bb_upper}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span>Weekly Upper BB (20,2):</span>
                      <span className={opp.filters.weekly_close_gt_bb_upper ? "text-purple-400 font-bold" : "text-slate-500"}>
                        ₹{opp.indicators.weekly_bb_upper}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span>Weekly WMA (30/50):</span>
                      <span className={opp.filters.weekly_wma_cross ? "text-cyan-400 font-bold" : "text-slate-500"}>
                        ₹{opp.indicators.weekly_wma30} / ₹{opp.indicators.weekly_wma50}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Trade Setup Blueprint Footer */}
                <div className="pt-3 border-t border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-slate-400">Trigger: <span className="text-white font-bold">₹{opp.trade_blueprint.entry_trigger}</span></span>
                    <span className="text-slate-400">T1: <span className="text-emerald-400 font-bold">₹{opp.trade_blueprint.target_1}</span></span>
                    <span className="text-slate-400">SL: <span className="text-rose-400 font-bold">₹{opp.trade_blueprint.stop_loss}</span></span>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <a
                      href={opp.tradingview_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 py-1 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-mono text-center flex items-center justify-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span>TradingView</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <Link
                      href={opp.techno_funda_url}
                      className="flex-1 py-1 px-2 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-800/60 text-xs font-mono text-center flex items-center justify-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span>Techno-Funda</span>
                      <Target className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* PAGINATION */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-slate-950/70 text-xs font-mono text-slate-400">
            <span>
              Showing {opportunities.length} of {totalCount} qualifying stocks
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-30 cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span>
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-30 cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* DETAILED INSPECTOR MODAL */}
        {selectedOpportunity && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="relative w-full max-w-2xl rounded-2xl border border-slate-700 bg-[#07111F] p-5 md:p-6 shadow-2xl space-y-4">
              {/* Modal Header */}
              <div className="flex items-start justify-between border-b border-slate-800 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-black font-mono text-white">{selectedOpportunity.symbol}</h2>
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${selectedOpportunity.tier_badge}`}>
                      {selectedOpportunity.setup_tier}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">{selectedOpportunity.company_name} — {selectedOpportunity.sector}</p>
                </div>
                <button
                  onClick={() => setSelectedOpportunity(null)}
                  className="p-1 rounded-lg bg-slate-900 text-slate-400 hover:text-white border border-slate-800 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Price Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-mono">
                <div>
                  <span className="text-slate-500 text-[10px] block">Current Price</span>
                  <span className="text-base font-bold text-white">₹{selectedOpportunity.cmp}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">1D Change</span>
                  <span className={`text-base font-bold ${selectedOpportunity.day_change_pct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {selectedOpportunity.day_change_pct >= 0 ? "+" : ""}{selectedOpportunity.day_change_pct}%
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">Day High / Low</span>
                  <span className="text-white">₹{selectedOpportunity.indicators.daily_high} / ₹{selectedOpportunity.indicators.daily_low}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">Day Open</span>
                  <span className="text-white">₹{selectedOpportunity.indicators.daily_open}</span>
                </div>
              </div>

              {/* 10 Condition Breakdown */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold font-mono uppercase text-slate-300">
                  Condition Verification Audit (10 Filters)
                </h3>
                <div className="space-y-1.5">
                  {rules.map((rule) => {
                    const passed = selectedOpportunity.filters[rule.field];
                    return (
                      <div
                        key={rule.id}
                        className={`flex items-center justify-between p-2 rounded-lg border text-xs font-mono ${
                          passed
                            ? "bg-emerald-950/20 border-emerald-500/30 text-emerald-300"
                            : "bg-slate-950/40 border-slate-800/80 text-slate-400"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {passed ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                          ) : (
                            <XCircle className="h-4 w-4 text-slate-600" />
                          )}
                          <span className="text-[11px]">{rule.label}</span>
                        </div>
                        <span className="font-bold text-[10px]">
                          {passed ? "PASSED" : "NOT MET"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Trade Blueprint */}
              <div className="p-3.5 rounded-xl bg-cyan-950/30 border border-cyan-800/40 space-y-2 text-xs font-mono">
                <span className="text-[10px] uppercase font-bold text-cyan-400 block">
                  Institutional Trade Execution Blueprint
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <span className="text-slate-500 text-[10px] block">Entry Trigger</span>
                    <span className="font-bold text-white">₹{selectedOpportunity.trade_blueprint.entry_trigger}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">Target 1 (+8%)</span>
                    <span className="font-bold text-emerald-400">₹{selectedOpportunity.trade_blueprint.target_1}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">Target 2 (+16%)</span>
                    <span className="font-bold text-cyan-400">₹{selectedOpportunity.trade_blueprint.target_2}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">Stop Loss</span>
                    <span className="font-bold text-rose-400">₹{selectedOpportunity.trade_blueprint.stop_loss}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <a
                  href={selectedOpportunity.tradingview_url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Open in TradingView</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <Link
                  href={selectedOpportunity.techno_funda_url}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-mono font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Techno-Funda Analysis</span>
                  <Target className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Award,
  Zap,
  Shield,
  Target,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronUp,
  Layers,
  ArrowUpRight,
  Sparkles,
  Activity,
  CheckCircle2,
  ExternalLink,
  Flame,
  GitBranch,
  Crosshair,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import {
  fetchConfluenceRadar,
  ConfluenceCandidate,
  ConfluenceResponse,
} from "@/lib/confluenceApi";
import AddToWatchlistButton from "@/components/watchlist/AddToWatchlistButton";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { SparklineChart, StageBadge } from "@/components/common";

const ENGINE_ICONS: Record<string, any> = {
  VCP: Shield,
  CUP_HANDLE: GitBranch,
  CHART_PATTERNS: Layers,
  MOMENTUM: Zap,
  PRE_BREAKOUT: Crosshair,
  DELIVERY: Flame,
};

const ENGINE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  VCP: { bg: "bg-emerald-950/40", text: "text-emerald-400", border: "border-emerald-800/60" },
  CUP_HANDLE: { bg: "bg-cyan-950/40", text: "text-cyan-400", border: "border-cyan-800/60" },
  CHART_PATTERNS: { bg: "bg-indigo-950/40", text: "text-indigo-400", border: "border-indigo-800/60" },
  MOMENTUM: { bg: "bg-amber-950/40", text: "text-amber-400", border: "border-amber-800/60" },
  PRE_BREAKOUT: { bg: "bg-purple-950/40", text: "text-purple-400", border: "border-purple-800/60" },
  DELIVERY: { bg: "bg-rose-950/40", text: "text-rose-400", border: "border-rose-800/60" },
};
const formatINR = (val: number | null | undefined): string => {
  if (val == null || isNaN(val) || val <= 0) return "—";
  return `₹${val.toLocaleString("en-IN", { minimumFractionDigits: 1, maximumFractionDigits: 2 })}`;
};

export default function ApexConfluencePage() {
  const [data, setData] = useState<ConfluenceResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<string>("ALL");
  const [search, setSearch] = useState<string>("");
  const [selectedSector, setSelectedSector] = useState<string>("All");
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);

  const loadData = useCallback(async (force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await fetchConfluenceRadar({ force_refresh: force });
      setData(res);
      setError(null);
    } catch (err) {
      console.error("Failed to load Confluence Radar data:", err);
      setError(err instanceof Error ? err.message : "Failed to load Confluence Radar data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(() => loadData(false), 30000); // 30s background poll
    return () => clearInterval(interval);
  }, [loadData]);

  // Unique sectors
  const sectors = useMemo(() => {
    if (!data?.items) return ["All"];
    const set = new Set<string>();
    data.items.forEach((item) => {
      if (item.sector) set.add(item.sector);
    });
    return ["All", ...Array.from(set).sort()];
  }, [data]);

  // Filtered items
  const filteredCandidates = useMemo(() => {
    if (!data) return [];
    let list: ConfluenceCandidate[] = [];
    if (selectedTier === "ALL") {
      list = [...data.apex_candidates, ...data.dual_candidates, ...data.solitary_alpha];
    } else if (selectedTier === "APEX") {
      list = data.apex_candidates;
    } else if (selectedTier === "DUAL") {
      list = data.dual_candidates;
    } else if (selectedTier === "SOLITARY") {
      list = data.solitary_alpha;
    }

    return list.filter((item) => {
      if (search) {
        const q = search.trim().toUpperCase();
        const s = item.symbol.toUpperCase();
        const c = item.company_name.toUpperCase();
        if (!s.includes(q) && !c.includes(q)) return false;
      }
      if (selectedSector !== "All" && item.sector !== selectedSector) {
        return false;
      }
      return true;
    });
  }, [data, selectedTier, search, selectedSector]);

  const meta = data?.metadata;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/20 via-cyan-500/20 to-indigo-500/20 border border-emerald-500/30 text-emerald-400">
                <Award className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-300 via-cyan-200 to-indigo-200 bg-clip-text text-transparent">
                    Apex Confluence Radar
                  </h1>
                  <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    STAGE 5 APEX
                  </span>
                </div>
                <p className="text-sm text-slate-400 mt-1">
                  Multi-Engine Concurrence Aggregator: Synthesizes VCP, Cup & Handle, Multi-Pattern, Momentum, Pre-Breakout & Delivery signals into high-probability consensus alpha.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 border border-slate-700/80 text-slate-300 hover:text-white hover:border-cyan-500/50 transition-all text-xs font-semibold shadow-lg shadow-black/40 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-cyan-400" : ""}`} />
              {refreshing ? "Re-Evaluating Matrix..." : "Force Scan Refresh"}
            </button>
          </div>
        </div>

        {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Telemetry Ribbon â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-[#09121F]/80 backdrop-blur border border-slate-800/80 rounded-xl p-3.5">
            <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Total Scanned</div>
            <div className="text-xl font-bold text-white mt-1">
              {meta ? meta.total_equities_evaluated : "—"}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Across 6 Independent Engines</div>
          </div>

          <div className="bg-[#09121F]/80 backdrop-blur border border-emerald-900/40 rounded-xl p-3.5">
            <div className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Apex Triple+ Confluence
            </div>
            <div className="text-xl font-bold text-emerald-300 mt-1">
              {meta ? meta.apex_triple_count : 0}
            </div>
            <div className="text-[11px] text-emerald-500/80 mt-0.5">â‰¥ 3 Concurring Engines</div>
          </div>

          <div className="bg-[#09121F]/80 backdrop-blur border border-cyan-900/40 rounded-xl p-3.5">
            <div className="text-[11px] font-medium text-cyan-400 uppercase tracking-wider">High Dual Confluence</div>
            <div className="text-xl font-bold text-cyan-300 mt-1">
              {meta ? meta.high_dual_count : 0}
            </div>
            <div className="text-[11px] text-cyan-500/80 mt-0.5">2 Concurring Engines</div>
          </div>

          <div className="bg-[#09121F]/80 backdrop-blur border border-slate-800/80 rounded-xl p-3.5">
            <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Activity className="w-3 h-3 text-cyan-400" />
              Engine Matrix Latency
            </div>
            <div className="text-xl font-bold text-slate-200 mt-1">
              {meta ? `${meta.computation_latency_ms.toFixed(1)} ms` : "—"}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">Vectorized Cache Buffer</div>
          </div>
        </div>

        {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Filters & Controls â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-[#09121F]/60 border border-slate-200 dark:border-slate-800/80 rounded-xl p-3 shadow-xs">
          {/* Tier Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            {[
              { id: "ALL", label: "All Confluences" },
              { id: "APEX", label: `Apex Triple+ (${meta?.apex_triple_count ?? 0})` },
              { id: "DUAL", label: `High Dual (${meta?.high_dual_count ?? 0})` },
              { id: "SOLITARY", label: `Solitary Alpha (${meta?.solitary_alpha_count ?? 0})` },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedTier(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedTier === tab.id
                    ? "bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/40 shadow-xs shadow-cyan-900/20"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/40 border border-transparent"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search & Sector */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-48">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search symbol..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-white dark:bg-[#050B14] border border-slate-300 dark:border-slate-700/80 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:border-cyan-500 transition-colors shadow-xs"
              />
            </div>

            <select
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
              className="bg-white dark:bg-[#050B14] border border-slate-300 dark:border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-300 focus:outline-hidden focus:border-cyan-500 cursor-pointer shadow-xs"
            >
              {sectors.map((sec) => (
                <option key={sec} value={sec} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
                  {sec}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Candidates List â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
            <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
            <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">Synthesizing Cross-Engine Confluence Matrix...</div>
            <p className="text-xs text-slate-500 max-w-md">
              Evaluating VCP geometry, Cup & Handle baselines, multi-pattern coils, momentum filters and delivery volume.
            </p>
          </div>
        ) : error && !data ? (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-4 bg-rose-500/5 border border-rose-500/20 rounded-xl p-8">
            <AlertCircle className="w-10 h-10 text-rose-400" />
            <div className="text-base font-bold text-rose-300">Confluence Matrix Unavailable</div>
            <p className="text-xs text-slate-400 max-w-md">
              {error}
            </p>
            <button
              onClick={() => loadData(true)}
              className="px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retry Scan
            </button>
          </div>
        ) : filteredCandidates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-3 bg-slate-50 dark:bg-[#09121F]/40 border border-slate-200 dark:border-slate-800/60 rounded-xl p-8">
            <Shield className="w-10 h-10 text-slate-400 dark:text-slate-500" />
            <div className="text-base font-bold text-slate-800 dark:text-slate-300">No Equities Satisfying Tier Filter</div>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md">
              Try selecting &quot;All Confluences&quot; or clearing your search term to see active candidates across all engines.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredCandidates.map((candidate) => {
              const isApex = candidate.concurrence_count >= 3;
              const isDual = candidate.concurrence_count === 2;
              const isExpanded = expandedSymbol === candidate.symbol;

              return (
                <div
                  key={candidate.symbol}
                  className={`bg-white dark:bg-[#09121F] border rounded-xl overflow-hidden transition-all duration-200 ${
                    isApex
                      ? "border-emerald-500/50 shadow-lg shadow-emerald-950/20"
                      : isDual
                      ? "border-cyan-500/40 shadow-md shadow-cyan-950/10"
                      : "border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs"
                  }`}
                >
                  {/* Card Header & Summary Bar */}
                  <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left: Identity & Badges */}
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <AddToWatchlistButton
                          symbol={candidate.symbol}
                          companyName={candidate.company_name}
                          currentPrice={candidate.cmp}
                          variant="star"
                        />
                        <Link
                          href={`/stocks/${encodeURIComponent(candidate.symbol)}?from=/apex-confluence`}
                          className="text-lg font-extrabold text-white hover:text-cyan-400 transition-colors flex items-center gap-1 group"
                          title={`View ${candidate.symbol} stock details page`}
                        >
                          {candidate.symbol}
                          <ArrowUpRight className="w-4 h-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                        </Link>
                        <span className="text-xs text-slate-400 font-medium">
                          {candidate.company_name}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800/80 text-slate-400 border border-slate-700/60">
                          {candidate.sector}
                        </span>
                        <StageBadge
                          stage={(candidate as any).current_stage}
                          stageCode={(candidate as any).stage_code}
                          cmp={candidate.cmp}
                        />

                        {isApex ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1 animate-pulse">
                            <Sparkles className="w-3 h-3" />
                            APEX TRIPLE+ ({candidate.concurrence_count} ENGINES)
                          </span>
                        ) : isDual ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 flex items-center gap-1">
                            <Layers className="w-3 h-3" />
                            HIGH DUAL ({candidate.concurrence_count} ENGINES)
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                            SOLITARY ALPHA
                          </span>
                        )}
                      </div>

                      {/* Engine concurrence badges */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] text-slate-500 font-medium mr-1">Concurring:</span>
                        {candidate.concurring_engines.map((engKey) => {
                          const Icon = ENGINE_ICONS[engKey] || Shield;
                          const color = ENGINE_COLORS[engKey] || {
                            bg: "bg-slate-800",
                            text: "text-slate-300",
                            border: "border-slate-700",
                          };
                          const breakdown = candidate.engine_breakdown[engKey];

                          return (
                            <span
                              key={engKey}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold border ${color.bg} ${color.text} ${color.border}`}
                              title={breakdown?.setup}
                            >
                              <Icon className="w-3 h-3" />
                              {engKey.replace("_", " ")}
                              <span className="opacity-75 font-mono">({breakdown?.score.toFixed(0)})</span>
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    {/* Right: Metrics & Plan */}
                    <div className="flex items-center justify-between sm:justify-end gap-5 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-800/80">
                      <div className="text-right">
                        <div className="text-[10px] uppercase font-semibold text-slate-400">CMP</div>
                        <div className="text-base font-bold text-white font-mono">{formatINR(candidate.cmp)}</div>
                      </div>

                      {/* 90D Trend Sparkline */}
                      <div className="flex flex-col items-end">
                        <div className="text-[10px] uppercase font-semibold text-slate-400">90D Trend</div>
                        <SparklineChart
                          data={(candidate as any).sparkline}
                          cmp={candidate.cmp}
                          return90d={(candidate as any).return_90d_pct}
                          width={80}
                          height={22}
                          periodLabel="90D"
                          showDot={true}
                          showBadge={true}
                        />
                      </div>

                      <div className="text-right">
                        <div className="text-[10px] uppercase font-semibold text-cyan-400">Consensus Pivot</div>
                        <div className="text-base font-bold text-cyan-300 font-mono">
                          {formatINR(candidate.consensus_pivot)}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-[10px] uppercase font-semibold text-rose-400">Stop Loss</div>
                        <div className="text-base font-bold text-rose-300 font-mono">
                          {formatINR(candidate.consensus_stop_loss)}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-[10px] uppercase font-semibold text-emerald-400">Target</div>
                        <div className="text-base font-bold text-emerald-300 font-mono">
                          {formatINR(candidate.consensus_target)}
                        </div>
                      </div>

                      <div className="text-right pl-2 border-l border-slate-800">
                        <div className="text-[10px] uppercase font-semibold text-slate-400">Confluence Score</div>
                        <div className="text-xl font-extrabold text-cyan-400 font-mono">
                          {candidate.confluence_score.toFixed(0)}
                          <span className="text-xs text-slate-500 font-normal">/100</span>
                        </div>
                      </div>

                      {/* Expand / Collapse Button */}
                      <button
                        onClick={() => setExpandedSymbol(isExpanded ? null : candidate.symbol)}
                        className="p-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                        title="Toggle Engine Breakdown"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Breakdown Accordion */}
                  {isExpanded && (
                    <div className="bg-[#050B14]/80 border-t border-slate-800/80 p-4 sm:p-5 space-y-4">
                      <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                        <Target className="w-3.5 h-3.5 text-cyan-400" />
                        Independent Engine Analysis Breakdown
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {Object.entries(candidate.engine_breakdown).map(([engKey, engData]) => {
                          const Icon = ENGINE_ICONS[engKey] || Shield;
                          const color = ENGINE_COLORS[engKey] || {
                            bg: "bg-slate-800",
                            text: "text-slate-300",
                            border: "border-slate-700",
                          };

                          return (
                            <div
                              key={engKey}
                              className={`p-3.5 rounded-xl border ${color.border} ${color.bg} flex flex-col justify-between space-y-2`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 font-bold text-xs text-white">
                                  <Icon className={`w-3.5 h-3.5 ${color.text}`} />
                                  {engData.name}
                                </div>
                                <span className={`text-xs font-bold font-mono ${color.text}`}>
                                  Score: {engData.score}
                                </span>
                              </div>

                              <div className="text-xs text-slate-300 font-medium">
                                Setup: <span className="text-white">{engData.setup}</span>
                              </div>

                              <div className="grid grid-cols-3 gap-1 pt-2 border-t border-slate-800/60 text-[11px] font-mono">
                                <div>
                                  <span className="text-slate-500 block text-[9px]">PIVOT</span>
                                  {formatINR(engData.pivot)}
                                </div>
                                <div>
                                  <span className="text-slate-500 block text-[9px]">STOP</span>
                                  {formatINR(engData.stop_loss)}
                                </div>
                                <div>
                                  <span className="text-slate-500 block text-[9px]">TARGET</span>
                                  {formatINR(engData.target)}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Rationale & Quick Action Footer */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
                        <div className="text-xs text-slate-400">
                          <span className="text-slate-500 font-semibold uppercase text-[10px] block sm:inline mr-2">
                            Confluence Rationale:
                          </span>
                          {candidate.confluence_rationale}
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          <AddToWatchlistButton
                            symbol={candidate.symbol}
                            companyName={candidate.company_name}
                            currentPrice={candidate.cmp}
                            variant="button"
                          />
                          <Link
                            href={`/techno-funda/${candidate.symbol}?from=/apex-confluence`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 text-xs font-semibold transition-colors"
                          >
                            <Target className="w-3 h-3" />
                            Techno-Funda Dossier
                          </Link>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}



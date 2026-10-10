"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Target,
  TrendingUp,
  TrendingDown,
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  Layers,
  ArrowUpRight,
  Flame,
  Award,
  Star,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  X,
  Info,
  Sliders,
  Calendar,
  Building,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Clock,
} from "lucide-react";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { PageHeader, ActionButton, LoadingSpinner, EmptyState } from "@/components/common";
import {
  fetchBrokerageFeed,
  fetchHotPicks,
  fetchBrokerScorecards,
  fetchBrokerageMetrics,
  fetchAllStocksConsensus,
  triggerBrokerageIngestion,
  type BrokerageReportItem,
  type BrokerScorecardItem,
  type HotPickItem,
  type BrokerageMetricsRibbon,
  type StockConsensusGroupItem,
} from "@/lib/brokerageApi";

export default function BrokerageRadarPage() {
  const [reports, setReports] = useState<BrokerageReportItem[]>([]);
  const [hotPicks, setHotPicks] = useState<HotPickItem[]>([]);
  const [scorecards, setScorecards] = useState<BrokerScorecardItem[]>([]);
  const [metrics, setMetrics] = useState<BrokerageMetricsRibbon | null>(null);

  // Consensus by Stock State
  const [consensusStocks, setConsensusStocks] = useState<StockConsensusGroupItem[]>([]);
  const [minBrokersFilter, setMinBrokersFilter] = useState<number>(1);
  const [consensusSortBy, setConsensusSortBy] = useState<string>("broker_count");
  const [consensusSortOrder, setConsensusSortOrder] = useState<"asc" | "desc">("desc");
  const [expandedStocks, setExpandedStocks] = useState<Set<string>>(new Set());
  const [selectedConsensusStock, setSelectedConsensusStock] = useState<StockConsensusGroupItem | null>(null);

  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestBanner, setIngestBanner] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  // Filters & State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBroker, setSelectedBroker] = useState("ALL");
  const [selectedAction, setSelectedAction] = useState("ALL");
  const [selectedCap, setSelectedCap] = useState<"ALL" | "LARGE_CAP" | "MID_CAP" | "SMALL_CAP">("ALL");
  const [selectedHorizon, setSelectedHorizon] = useState<string>("ALL");
  const [minConviction, setMinConviction] = useState<number>(0);
  const [sortBy, setSortBy] = useState("report_date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [activeView, setActiveView] = useState<"feed" | "consensus" | "league">("feed");

  // Selected report for side drawer / modal
  const [selectedReport, setSelectedReport] = useState<BrokerageReportItem | null>(null);

  const toggleStockExpanded = (symbol: string) => {
    setExpandedStocks((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) {
        next.delete(symbol);
      } else {
        next.add(symbol);
      }
      return next;
    });
  };

  const loadData = async () => {
    try {
      setIsRefreshing(true);
      const [feedRes, hotRes, scoreRes, metricsRes, consensusRes] = await Promise.all([
        fetchBrokerageFeed({
          page,
          limit: 50,
          search: searchQuery || undefined,
          brokerage_house: selectedBroker !== "ALL" ? selectedBroker : undefined,
          action: selectedAction !== "ALL" ? selectedAction : undefined,
          market_cap_category: selectedCap !== "ALL" ? selectedCap : undefined,
          target_horizon: selectedHorizon !== "ALL" ? selectedHorizon : undefined,
          min_conviction: minConviction > 0 ? minConviction : undefined,
          sort_by: sortBy,
          sort_order: sortOrder,
        }),
        fetchHotPicks(6),
        fetchBrokerScorecards(),
        fetchBrokerageMetrics(),
        fetchAllStocksConsensus({
          market_cap_category: selectedCap !== "ALL" ? selectedCap : undefined,
          search: searchQuery || undefined,
          min_brokers: minBrokersFilter,
          sort_by: consensusSortBy,
          sort_order: consensusSortOrder,
        }),
      ]);

      setReports(feedRes.items || []);
      setTotalCount(feedRes.total || 0);
      setHotPicks(hotRes.data || []);
      setScorecards(scoreRes.data || []);
      setMetrics(metricsRes.data || null);
      setConsensusStocks(consensusRes.data || []);
    } catch (err) {
      console.error("Failed to load brokerage data:", err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRunLiveScan = async () => {
    try {
      setIsIngesting(true);
      setIngestBanner(null);
      const res = await triggerBrokerageIngestion(7);
      setIngestBanner(
        `Live Scan Completed: ${res.total_discovered} institutional calls discovered (${res.new_reports} new, ${res.updated_reports} updated). Feed is now live up to today!`
      );
      await loadData();
    } catch (err: any) {
      console.error("Live scan failed:", err);
      setIngestBanner(`Scan Notice: ${err?.message || "Failed to complete live feed scan"}`);
    } finally {
      setIsIngesting(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [
    page,
    selectedBroker,
    selectedAction,
    selectedCap,
    selectedHorizon,
    minConviction,
    sortBy,
    sortOrder,
    minBrokersFilter,
    consensusSortBy,
    consensusSortOrder,
  ]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fast symbol lookup map for multi-broker consensus
  const consensusMap = useMemo(() => {
    const map = new Map<string, StockConsensusGroupItem>();
    for (const item of consensusStocks) {
      map.set(item.symbol, item);
    }
    return map;
  }, [consensusStocks]);

  // Unique list of brokerage houses from scorecards
  const brokerList = useMemo(() => {
    return scorecards.map((sc) => sc.brokerage_house).sort();
  }, [scorecards]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* ===================================================================== */}
        {/* 1. TOP HEADER & TELEMETRY STATUS                                      */}
        {/* ===================================================================== */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-mono">
                Institutional Radar
              </span>
              <span className="text-xs text-slate-400 font-mono flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Live Telemetry: {metrics?.tracked_houses_count || 40}+ Research Desks Active
              </span>
            </div>
            <h1 className="text-2xl font-black text-white font-mono tracking-tight mt-1 flex items-center gap-2">
              <Target size={24} className="text-cyan-400" />
              <span>Institutional Brokerage Radar & Hot Picks</span>
            </h1>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">
              Quantitative tracking of 60+ SEBI-registered brokerages. Analyzes target price revisions,
              computes institutional conviction scores, and tracks empirical hit-rate scorecards.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* View Switcher: Feed vs Consensus vs League Table */}
            <div className="flex rounded-xl bg-slate-900 border border-slate-800 p-1 text-xs font-mono">
              <button
                onClick={() => setActiveView("feed")}
                className={`px-3 py-1.5 rounded-lg transition ${
                  activeView === "feed"
                    ? "bg-cyan-500 text-slate-950 font-bold shadow-md"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Research Feed
              </button>
              <button
                onClick={() => setActiveView("consensus")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition ${
                  activeView === "consensus"
                    ? "bg-cyan-500 text-slate-950 font-bold shadow-md"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <span>Consensus by Stock</span>
                <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                  activeView === "consensus" ? "bg-slate-950/40 text-slate-950" : "bg-cyan-950 text-cyan-300"
                }`}>
                  {consensusStocks.length}
                </span>
              </button>
              <button
                onClick={() => setActiveView("league")}
                className={`px-3 py-1.5 rounded-lg transition ${
                  activeView === "league"
                    ? "bg-cyan-500 text-slate-950 font-bold shadow-md"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Broker League Table ({scorecards.length})
              </button>
            </div>

            <button
              onClick={handleRunLiveScan}
              disabled={isIngesting || isRefreshing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-slate-950 font-bold text-xs font-mono shadow-md shadow-cyan-950/40 transition disabled:opacity-50"
            >
              <Sparkles size={14} className={isIngesting ? "animate-spin text-white" : "text-slate-950"} />
              <span>{isIngesting ? "Scanning..." : "Scan Live Feed"}</span>
            </button>

            <button
              onClick={loadData}
              disabled={isRefreshing || isIngesting}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#0B1528] border border-cyan-500/30 text-cyan-300 hover:bg-cyan-950/40 text-xs font-mono font-semibold transition disabled:opacity-50"
            >
              <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Live Scan Notification Banner */}
        {ingestBanner && (
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-cyan-500/40 bg-gradient-to-r from-cyan-950/40 to-[#071325] text-cyan-200 text-xs font-mono shadow-md">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
              <span>{ingestBanner}</span>
            </div>
            <button
              onClick={() => setIngestBanner(null)}
              className="text-slate-400 hover:text-white text-xs ml-4"
            >
              ✕
            </button>
          </div>
        )}


        {/* ===================================================================== */}
        {/* 2. HEADER METRICS RIBBON                                              */}
        {/* ===================================================================== */}
        {metrics && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="rounded-xl border border-slate-800 bg-[#060D19] p-4 shadow-md">
              <div className="text-[10px] text-slate-400 uppercase font-mono font-semibold">Active Research Calls</div>
              <div className="text-xl font-black text-white font-mono mt-1">
                {metrics.total_active_calls} Tracked
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Across NSE/BSE Universe</p>
            </div>

            <div className="rounded-xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/20 via-[#060D19] to-[#040812] p-4 shadow-md">
              <div className="text-[10px] text-emerald-400 uppercase font-mono font-bold flex items-center gap-1">
                <Flame size={12} className="text-amber-400" /> Hot Picks
              </div>
              <div className="text-xl font-black text-emerald-400 font-mono mt-1">
                {metrics.hot_picks_count} High Conviction
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Conviction Score â‰¥ 85</p>
            </div>

            <div className="rounded-xl border border-cyan-500/30 bg-gradient-to-br from-cyan-950/20 via-[#060D19] to-[#040812] p-4 shadow-md">
              <div className="text-[10px] text-cyan-400 uppercase font-mono font-semibold">Avg Consensus Upside</div>
              <div className="text-xl font-black text-cyan-300 font-mono mt-1">
                +{metrics.avg_consensus_upside_pct}%
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">To Institutional Targets</p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-[#060D19] p-4 shadow-md">
              <div className="text-[10px] text-slate-400 uppercase font-mono font-semibold">Revision Breadth</div>
              <div className="text-xl font-black text-emerald-400 font-mono mt-1">
                {metrics.net_revision_breadth_bull_pct}% Upgrades
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">Net Bullish Revision Cycle</p>
            </div>

            <div className="rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-950/20 via-[#060D19] to-[#040812] p-4 shadow-md">
              <div className="text-[10px] text-amber-300 uppercase font-mono font-semibold flex items-center gap-1">
                <Award size={12} className="text-amber-400" /> Top Broker Hit Rate
              </div>
              <div className="text-lg font-black text-white font-mono mt-1 truncate">
                {metrics.top_broker_hit_rate}%
              </div>
              <p className="text-[11px] text-amber-300/80 truncate mt-0.5">{metrics.top_broker_name}</p>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* 3. ”¥ HOT PICKS CLUSTERS CAROUSEL                                     */}
        {/* ===================================================================== */}
        {hotPicks.length > 0 && activeView === "feed" && (
          <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-950/20 via-[#071325] to-[#050C17] p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Flame size={18} className="text-amber-400" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-amber-300 font-mono">
                  Institutional Hot Picks (Multiple Tier-1 Upgrades & High Conviction)
                </h2>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                Algorithmic synthesis of Broker Reliability + Target Revision Acceleration
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {hotPicks.map((pick) => (
                <div
                  key={pick.id}
                  className="rounded-xl border border-slate-800 bg-[#060E1C]/90 p-4 hover:border-cyan-500/40 transition group relative overflow-hidden"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <Link
                        href={`/stocks/${pick.symbol}?tab=brokerage&from=/brokerage-radar`}
                        className="text-base font-black text-white font-mono hover:text-cyan-400 transition flex items-center gap-1.5"
                      >
                        <span>{pick.symbol}</span>
                        <ArrowUpRight size={14} className="opacity-0 group-hover:opacity-100 transition text-cyan-400" />
                      </Link>
                      <div className="text-[11px] text-slate-400 truncate max-w-[180px]">{pick.company_name}</div>
                    </div>

                    <div className="flex flex-col items-end">
                      <span className="text-xs font-black font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded">
                        +{pick.upside_pct}%
                      </span>
                      <span className="text-[9px] text-slate-400 font-mono mt-0.5">Target: ₹{pick.target_price.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Broker, Horizon & Conviction */}
                  <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-300 truncate max-w-[130px] text-[11px]">
                      {pick.brokerage_house}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-cyan-950/70 border border-cyan-800/40 text-cyan-300">
                        <Clock size={10} className="text-cyan-400" />
                        <span>{pick.target_horizon || "12 Months"}</span>
                      </span>
                      <span className="flex items-center gap-1 text-amber-400 font-bold text-[11px]">
                        <Star size={11} className="fill-amber-400" />
                        {pick.conviction_score}/100
                      </span>
                    </div>
                  </div>

                  {/* Headline */}
                  {pick.headline && (
                    <p className="text-[11px] text-slate-400 mt-2 line-clamp-2 leading-relaxed">
                      {pick.headline}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* 4. ACTIVE VIEW: RESEARCH FEED TABLE                                  */}
        {/* ===================================================================== */}
        {activeView === "feed" && (
          <div className="space-y-4">
            {/* Segmented Market Cap Filter Tabs */}
            <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-[#060D19] border border-slate-800 font-mono text-xs overflow-x-auto shadow-md">
              <button
                onClick={() => {
                  setSelectedCap("ALL");
                  setPage(1);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition whitespace-nowrap ${
                  selectedCap === "ALL"
                    ? "bg-cyan-500 text-slate-950 font-bold shadow-md"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <span>All Market Caps</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  selectedCap === "ALL" ? "bg-slate-950/40 text-slate-900" : "bg-slate-800 text-slate-400"
                }`}>
                  {metrics?.total_active_calls ?? totalCount}
                </span>
              </button>

              <button
                onClick={() => {
                  setSelectedCap("LARGE_CAP");
                  setPage(1);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition whitespace-nowrap ${
                  selectedCap === "LARGE_CAP"
                    ? "bg-cyan-500 text-slate-950 font-bold shadow-md"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <span>›ï¸ Large Cap</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  selectedCap === "LARGE_CAP" ? "bg-slate-950/40 text-slate-900" : "bg-slate-800 text-slate-400"
                }`}>
                  {metrics?.large_cap_count ?? 0}
                </span>
              </button>

              <button
                onClick={() => {
                  setSelectedCap("MID_CAP");
                  setPage(1);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition whitespace-nowrap ${
                  selectedCap === "MID_CAP"
                    ? "bg-cyan-500 text-slate-950 font-bold shadow-md"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <span>âš¡ Mid Cap</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  selectedCap === "MID_CAP" ? "bg-slate-950/40 text-slate-900" : "bg-slate-800 text-slate-400"
                }`}>
                  {metrics?.mid_cap_count ?? 0}
                </span>
              </button>

              <button
                onClick={() => {
                  setSelectedCap("SMALL_CAP");
                  setPage(1);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition whitespace-nowrap ${
                  selectedCap === "SMALL_CAP"
                    ? "bg-cyan-500 text-slate-950 font-bold shadow-md"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <span>š€ Small / Micro Cap</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                  selectedCap === "SMALL_CAP" ? "bg-slate-950/40 text-slate-900" : "bg-slate-800 text-slate-400"
                }`}>
                  {metrics?.small_cap_count ?? 0}
                </span>
              </button>
            </div>

            {/* Filter Toolbar */}
            <div className="rounded-2xl border border-slate-800 bg-[#060D19] p-4 flex flex-wrap items-center justify-between gap-3 shadow-lg">
              <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                  <Search size={14} className="absolute left-3 top-3 text-slate-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by Symbol, Company, Broker, Catalyst..."
                    className="w-full rounded-xl border border-slate-800 bg-[#081224] pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                {/* Broker Filter */}
                <select
                  value={selectedBroker}
                  onChange={(e) => {
                    setSelectedBroker(e.target.value);
                    setPage(1);
                  }}
                  className="rounded-xl border border-slate-800 bg-[#081224] px-3 py-2 text-xs text-slate-300 font-mono focus:border-cyan-500 focus:outline-none"
                >
                  <option value="ALL">All Brokerages (60+)</option>
                  {brokerList.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>

                {/* Action Filter */}
                <select
                  value={selectedAction}
                  onChange={(e) => {
                    setSelectedAction(e.target.value);
                    setPage(1);
                  }}
                  className="rounded-xl border border-slate-800 bg-[#081224] px-3 py-2 text-xs text-slate-300 font-mono focus:border-cyan-500 focus:outline-none"
                >
                  <option value="ALL">All Actions</option>
                  <option value="UPGRADE">Upgrades Only</option>
                  <option value="TARGET_UP">Target Hikes</option>
                  <option value="INITIATION">First-Time Initiations</option>
                  <option value="MAINTAINED">Maintained</option>
                  <option value="DOWNGRADE">Downgrades</option>
                </select>

                {/* Min Conviction Filter */}
                <select
                  value={minConviction}
                  onChange={(e) => {
                    setMinConviction(Number(e.target.value));
                    setPage(1);
                  }}
                  className="rounded-xl border border-slate-800 bg-[#081224] px-3 py-2 text-xs text-slate-300 font-mono focus:border-cyan-500 focus:outline-none"
                >
                  <option value={0}>All Conviction</option>
                  <option value={80}>Conviction ≥ 80 (High)</option>
                  <option value={85}>Conviction ≥ 85 (Hot Picks)</option>
                  <option value={90}>Conviction ≥ 90 (Elite)</option>
                </select>

                {/* Horizon Filter */}
                <select
                  value={selectedHorizon}
                  onChange={(e) => {
                    setSelectedHorizon(e.target.value);
                    setPage(1);
                  }}
                  className="rounded-xl border border-slate-800 bg-[#081224] px-3 py-2 text-xs text-slate-300 font-mono focus:border-cyan-500 focus:outline-none"
                >
                  <option value="ALL">All Horizons (1M - 24M)</option>
                  <option value="1_MONTH">â±ï¸ 1 Month (Tactical)</option>
                  <option value="3_MONTHS">â±ï¸ 3 Months (Short Term)</option>
                  <option value="6_MONTHS">â±ï¸ 6 Months (Medium Term)</option>
                  <option value="12_MONTHS">â±ï¸ 12 Months (Street Standard)</option>
                  <option value="LONG">â±ï¸ 18M+ (Long-Term Capex)</option>
                </select>
              </div>

              {/* Sort By Dropdown */}
              <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                <span>Sort:</span>
                <select
                  value={`${sortBy}:::${sortOrder}`}
                  onChange={(e) => {
                    const [f, o] = e.target.value.split(":::");
                    setSortBy(f);
                    setSortOrder(o as "asc" | "desc");
                  }}
                  className="rounded-xl border border-slate-800 bg-[#081224] px-3 py-1.5 text-xs text-slate-300 font-mono focus:border-cyan-500 focus:outline-none"
                >
                  <option value="report_date:::desc">Latest Date (Newest)</option>
                  <option value="conviction_score:::desc">Conviction Score (Highest)</option>
                  <option value="upside_pct:::desc">Implied Upside (Highest)</option>
                  <option value="target_revision_pct:::desc">Target Revision % (Highest)</option>
                </select>
              </div>
            </div>

            {/* Master Table */}
            <div className="rounded-2xl border border-slate-800 bg-[#060D19] shadow-2xl overflow-hidden">
              {loading ? (
                <div className="p-16 flex flex-col items-center justify-center space-y-3">
                  <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-slate-400 font-mono">LOADING INSTITUTIONAL RESEARCH CALLS...</span>
                </div>
              ) : reports.length === 0 ? (
                <div className="p-12 text-center text-slate-400 font-mono text-xs">
                  No brokerage reports matched your filter criteria. Try clearing search filters.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 bg-[#081325] text-slate-400 font-mono text-[10px] uppercase tracking-wider">
                        <th className="py-3.5 px-4">Date & Time</th>
                        <th className="py-3.5 px-4">Stock & Sector</th>
                        <th className="py-3.5 px-4">Market Cap</th>
                        <th className="py-3.5 px-4">Broker House & Rating</th>
                        <th className="py-3.5 px-4">Action</th>
                        <th className="py-3.5 px-4">CMP âž” Target Price</th>
                        <th className="py-3.5 px-4">Target Horizon</th>
                        <th className="py-3.5 px-4">Target Rev %</th>
                        <th className="py-3.5 px-4">Conviction Score</th>
                        <th className="py-3.5 px-4">Core Catalyst</th>
                        <th className="py-3.5 px-4 text-right">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {reports.map((r) => {
                        const isPositiveRev = (r.target_revision_pct || 0) > 0;
                        const isNegativeRev = (r.target_revision_pct || 0) < 0;

                        return (
                          <tr
                            key={r.id}
                            className="hover:bg-cyan-950/20 transition-colors group cursor-pointer"
                            onClick={() => setSelectedReport(r)}
                          >
                            <td className="py-3.5 px-4 text-slate-400 whitespace-nowrap">
                              {r.report_date}
                            </td>

                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <Link
                                  href={`/stocks/${r.symbol}?tab=brokerage&from=/brokerage-radar`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="font-bold text-white hover:text-cyan-400 transition flex items-center gap-1.5"
                                >
                                  <span>{r.symbol}</span>
                                  <ArrowUpRight size={12} className="opacity-0 group-hover:opacity-100 transition text-cyan-400" />
                                </Link>
                                {(() => {
                                  const c = consensusMap.get(r.symbol);
                                  if (c && c.broker_count > 1) {
                                    return (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedConsensusStock(c);
                                        }}
                                        className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition flex items-center gap-1 shadow-sm"
                                        title={`View all ${c.total_reports} recommendations across ${c.broker_count} brokerages`}
                                      >
                                        <span>{c.broker_count} Desks</span>
                                      </button>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                              <div className="text-[10px] text-slate-400 font-sans truncate max-w-[140px]">
                                {r.sector}
                              </div>
                            </td>

                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  r.market_cap_category === "LARGE_CAP"
                                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                                    : r.market_cap_category === "MID_CAP"
                                    ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                                    : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                }`}
                              >
                                {r.market_cap_category === "LARGE_CAP"
                                  ? "Large Cap"
                                  : r.market_cap_category === "MID_CAP"
                                  ? "Mid Cap"
                                  : "Small Cap"}
                              </span>
                              {r.market_cap ? (
                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                  ₹{r.market_cap >= 100000 ? (r.market_cap / 100000).toFixed(1) + "L Cr" : Math.round(r.market_cap).toLocaleString() + " Cr"}
                                </div>
                              ) : null}
                            </td>

                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <div className="font-semibold text-slate-200 font-sans">
                                {r.brokerage_house}
                              </div>
                              <div className="text-[10px] text-cyan-400 flex items-center gap-1">
                                <Star size={10} className="fill-cyan-400 text-cyan-400" />
                                <span>{r.broker_star_rating}â˜…</span>
                                <span className="text-slate-400">Â· {r.broker_hit_rate_pct}% Hit Rate</span>
                              </div>
                            </td>

                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  r.action === "UPGRADE" || r.action === "TARGET_UP"
                                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                                    : r.action === "INITIATION"
                                    ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                                    : r.action === "DOWNGRADE" || r.action === "EXIT"
                                    ? "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                                    : "bg-slate-800 text-slate-300 border border-slate-700"
                                }`}
                              >
                                {r.action}
                              </span>
                            </td>

                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <div className="text-white font-bold">
                                ₹{r.price_at_reco.toLocaleString()} âž” ₹{r.target_price.toLocaleString()}
                              </div>
                              <div
                                className={`text-[11px] font-bold ${
                                  r.upside_pct >= 0 ? "text-emerald-400" : "text-rose-400"
                                }`}
                              >
                                {r.upside_pct >= 0 ? "+" : ""}
                                {r.upside_pct}% Implied Upside
                              </div>
                            </td>

                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-cyan-950/60 border border-cyan-800/40 text-cyan-300">
                                <Clock size={11} className="text-cyan-400" />
                                <span>{r.target_horizon || "12 Months"}</span>
                              </span>
                            </td>

                            <td className="py-3.5 px-4 whitespace-nowrap">
                              {r.target_revision_pct !== null ? (
                                <span
                                  className={`font-semibold ${
                                    isPositiveRev
                                      ? "text-emerald-400"
                                      : isNegativeRev
                                      ? "text-rose-400"
                                      : "text-slate-400"
                                  }`}
                                >
                                  {isPositiveRev ? "+" : ""}
                                  {r.target_revision_pct}%
                                </span>
                              ) : (
                                <span className="text-purple-300 font-semibold">1st Coverage</span>
                              )}
                            </td>

                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-2 rounded-full bg-slate-800 overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      r.conviction_score >= 85
                                        ? "bg-emerald-400"
                                        : r.conviction_score >= 70
                                        ? "bg-cyan-400"
                                        : "bg-amber-400"
                                    }`}
                                    style={{ width: `${r.conviction_score}%` }}
                                  />
                                </div>
                                <span className="font-bold text-white text-xs">{r.conviction_score}</span>
                              </div>
                            </td>

                            <td className="py-3.5 px-4 font-sans text-slate-300 max-w-xs truncate" title={r.headline || r.investment_thesis || ""}>
                              {r.headline || r.investment_thesis || "—"}
                            </td>

                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedReport(r);
                                }}
                                className="px-2.5 py-1 rounded bg-[#091526] hover:bg-cyan-950/40 border border-slate-700 hover:border-cyan-500/50 text-[11px] text-cyan-300 transition"
                              >
                                View Thesis
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* 5. ACTIVE VIEW: MULTI-BROKER CONSENSUS BY STOCK                       */}
        {/* ===================================================================== */}
        {activeView === "consensus" && (
          <div className="space-y-4">
            {/* Consensus Toolbar & Filter Bar */}
            <div className="rounded-2xl border border-slate-800 bg-[#060D19] p-4 flex flex-wrap items-center justify-between gap-3 shadow-lg">
              <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                  <Search size={14} className="absolute left-3 top-3 text-slate-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by Symbol, Company, Sector, or Broker..."
                    className="w-full rounded-xl border border-slate-800 bg-[#081224] pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 font-mono focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                {/* Market Cap Filter */}
                <div className="flex items-center gap-1 bg-[#081224] p-1 rounded-xl border border-slate-800 font-mono text-xs">
                  <button
                    onClick={() => setSelectedCap("ALL")}
                    className={`px-2.5 py-1 rounded-lg transition ${
                      selectedCap === "ALL" ? "bg-cyan-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    All Caps
                  </button>
                  <button
                    onClick={() => setSelectedCap("LARGE_CAP")}
                    className={`px-2.5 py-1 rounded-lg transition ${
                      selectedCap === "LARGE_CAP" ? "bg-cyan-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Large
                  </button>
                  <button
                    onClick={() => setSelectedCap("MID_CAP")}
                    className={`px-2.5 py-1 rounded-lg transition ${
                      selectedCap === "MID_CAP" ? "bg-cyan-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Mid
                  </button>
                  <button
                    onClick={() => setSelectedCap("SMALL_CAP")}
                    className={`px-2.5 py-1 rounded-lg transition ${
                      selectedCap === "SMALL_CAP" ? "bg-cyan-500 text-slate-950 font-bold" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Small
                  </button>
                </div>

                {/* Min Brokers Coverage Filter */}
                <select
                  value={minBrokersFilter}
                  onChange={(e) => setMinBrokersFilter(Number(e.target.value))}
                  className="rounded-xl border border-slate-800 bg-[#081224] px-3 py-2 text-xs text-slate-300 font-mono focus:border-cyan-500 focus:outline-none"
                >
                  <option value={1}>All Covered Stocks ({consensusStocks.length})</option>
                  <option value={2}>🔥 Multi-Broker Only (2+ Desks)</option>
                  <option value={3}>⭐ Heavy Coverage (3+ Desks)</option>
                </select>
              </div>

              {/* Sort Dropdown */}
              <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                <span>Sort:</span>
                <select
                  value={`${consensusSortBy}:::${consensusSortOrder}`}
                  onChange={(e) => {
                    const [f, o] = e.target.value.split(":::");
                    setConsensusSortBy(f);
                    setConsensusSortOrder(o as "asc" | "desc");
                  }}
                  className="rounded-xl border border-slate-800 bg-[#081224] px-3 py-1.5 text-xs text-slate-300 font-mono focus:border-cyan-500 focus:outline-none"
                >
                  <option value="broker_count:::desc">Most Broker Desks</option>
                  <option value="consensus_upside_pct:::desc">Consensus Upside % (Highest)</option>
                  <option value="avg_conviction_score:::desc">Avg Conviction (Highest)</option>
                  <option value="total_reports:::desc">Total Research Notes</option>
                  <option value="symbol:::asc">Stock Symbol (A-Z)</option>
                </select>
              </div>
            </div>

            {/* Stocks Consensus Table */}
            <div className="rounded-2xl border border-slate-800 bg-[#060D19] shadow-2xl overflow-hidden">
              {consensusStocks.length === 0 ? (
                <div className="p-12 text-center text-slate-400 font-mono text-xs">
                  No stocks match the consensus filters. Try selecting "All Covered Stocks".
                </div>
              ) : (
                <div className="divide-y divide-slate-800/80">
                  {consensusStocks.map((stock) => {
                    const isExpanded = expandedStocks.has(stock.symbol);

                    return (
                      <div key={stock.symbol} className="p-4 transition hover:bg-slate-900/30 font-mono">
                        {/* Top Stock Bar */}
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          {/* Symbol, Name, Market Cap & Stance */}
                          <div className="flex items-start sm:items-center gap-3">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <Link
                                  href={`/stocks/${stock.symbol}?tab=brokerage&from=/brokerage-radar`}
                                  className="text-base font-black text-white hover:text-cyan-400 transition flex items-center gap-1"
                                >
                                  <span>{stock.symbol}</span>
                                  <ArrowUpRight size={14} className="text-cyan-400" />
                                </Link>

                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    stock.market_cap_category === "LARGE_CAP"
                                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                                      : stock.market_cap_category === "MID_CAP"
                                      ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                                      : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                  }`}
                                >
                                  {stock.market_cap_category === "LARGE_CAP"
                                    ? "Large Cap"
                                    : stock.market_cap_category === "MID_CAP"
                                    ? "Mid Cap"
                                    : "Small Cap"}
                                </span>

                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                    stock.consensus_stance === "STRONG_CONSENSUS_BUY"
                                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                                      : stock.consensus_stance === "MODERATE_BUY"
                                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                                      : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                  }`}
                                >
                                  {stock.consensus_stance.replace(/_/g, " ")} ({stock.ratings_breakdown.buy} Buy{stock.ratings_breakdown.hold > 0 ? `, ${stock.ratings_breakdown.hold} Hold` : ""}{stock.ratings_breakdown.sell > 0 ? `, ${stock.ratings_breakdown.sell} Sell` : ""})
                                </span>

                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  {stock.broker_count} Broker Desks ({stock.total_reports} Calls)
                                </span>
                              </div>
                              <div className="text-xs text-slate-400 font-sans mt-0.5">
                                {stock.company_name} · <span className="text-slate-500">{stock.sector}</span>
                              </div>
                            </div>
                          </div>

                          {/* CMP, Target Corridor & Upside */}
                          <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                            <div>
                              <div className="text-[10px] text-slate-500 uppercase font-mono">Current CMP</div>
                              <div className="text-sm font-bold text-white mt-0.5">
                                ₹{stock.current_price.toLocaleString()}
                              </div>
                            </div>

                            <div className="hidden sm:block">
                              <div className="text-[10px] text-slate-500 uppercase font-mono">Target Price Corridor</div>
                              <div className="text-xs text-cyan-300 font-bold mt-0.5 flex items-center gap-1.5">
                                <span>₹{stock.target_corridor.low.toLocaleString()}</span>
                                <span className="text-slate-500">➔</span>
                                <span className="text-white bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
                                  ₹{stock.target_corridor.median.toLocaleString()}
                                </span>
                                <span className="text-slate-500">➔</span>
                                <span>₹{stock.target_corridor.high.toLocaleString()}</span>
                              </div>
                            </div>

                            <div>
                              <div className="text-[10px] text-slate-500 uppercase font-mono">Consensus Upside</div>
                              <div className={`text-sm font-black mt-0.5 ${stock.consensus_upside_pct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                {stock.consensus_upside_pct >= 0 ? "+" : ""}{stock.consensus_upside_pct}%
                              </div>
                            </div>

                            <div>
                              <div className="text-[10px] text-slate-500 uppercase font-mono">Avg Conviction</div>
                              <div className="text-xs font-bold text-amber-300 mt-0.5 flex items-center gap-1">
                                <Star size={11} className="fill-amber-400 text-amber-400" />
                                <span>{stock.avg_conviction_score}/100</span>
                              </div>
                            </div>

                            {/* Accordion Toggle */}
                            <button
                              onClick={() => toggleStockExpanded(stock.symbol)}
                              className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition flex items-center gap-1.5 ${
                                isExpanded
                                  ? "bg-cyan-500 text-slate-950 border-cyan-400"
                                  : "bg-[#0A1628] hover:bg-cyan-950/40 text-cyan-300 border-slate-700 hover:border-cyan-500/50"
                              }`}
                            >
                              <span>{isExpanded ? "Hide Calls" : `View ${stock.reports.length} Recommendations`}</span>
                              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                          </div>
                        </div>

                        {/* Covering Broker Chips Row */}
                        <div className="mt-3 flex items-center gap-2 flex-wrap text-[11px]">
                          <span className="text-[10px] text-slate-500 uppercase">Covering Desks:</span>
                          {stock.reports.map((rep) => (
                            <button
                              key={rep.id}
                              onClick={() => setSelectedReport(rep)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-800 bg-[#081224] hover:border-cyan-500/40 hover:bg-cyan-950/30 transition text-slate-300 group"
                            >
                              <span className="font-semibold text-slate-200 group-hover:text-cyan-300">{rep.brokerage_house}</span>
                              <span className="text-slate-500">·</span>
                              <span className="font-bold text-cyan-400">₹{rep.target_price.toLocaleString()}</span>
                              <span className={`text-[10px] font-bold ${rep.upside_pct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                ({rep.upside_pct >= 0 ? "+" : ""}{rep.upside_pct}%)
                              </span>
                              <span className="text-[9px] text-amber-400/80">★ {rep.conviction_score}</span>
                            </button>
                          ))}
                        </div>

                        {/* Expanded Full Multi-Broker Recommendation Table */}
                        {isExpanded && (
                          <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-3 animate-in fade-in duration-150">
                            <div className="flex items-center justify-between text-xs text-slate-400">
                              <span className="font-bold uppercase tracking-wider text-cyan-300 text-[10px]">
                                Detailed Chronological Brokerage History for {stock.symbol} ({stock.company_name})
                              </span>
                              <Link
                                href={`/stocks/${stock.symbol}?tab=brokerage&from=/brokerage-radar`}
                                className="text-cyan-400 hover:underline flex items-center gap-1 text-[11px]"
                              >
                                <span>Full Stock Terminal</span>
                                <ExternalLink size={11} />
                              </Link>
                            </div>

                            <div className="rounded-xl border border-slate-800 bg-[#070F1E] overflow-x-auto shadow-inner">
                              <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                  <tr className="border-b border-slate-800 bg-[#091526] text-slate-400 font-mono text-[10px] uppercase">
                                    <th className="py-2.5 px-3">Date</th>
                                    <th className="py-2.5 px-3">Brokerage Desk</th>
                                    <th className="py-2.5 px-3">Action</th>
                                    <th className="py-2.5 px-3">Rating</th>
                                    <th className="py-2.5 px-3">CMP ➔ Target Price</th>
                                    <th className="py-2.5 px-3">Target Horizon</th>
                                    <th className="py-2.5 px-3">Conviction Score</th>
                                    <th className="py-2.5 px-3">Core Catalyst / Note</th>
                                    <th className="py-2.5 px-3 text-right">Details</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                                  {stock.reports.map((r) => (
                                    <tr
                                      key={r.id}
                                      className="hover:bg-cyan-950/20 transition cursor-pointer"
                                      onClick={() => setSelectedReport(r)}
                                    >
                                      <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                                        {r.report_date}
                                      </td>
                                      <td className="py-2.5 px-3 whitespace-nowrap">
                                        <div className="font-semibold text-white">{r.brokerage_house}</div>
                                        <div className="text-[10px] text-cyan-400 flex items-center gap-1">
                                          <Star size={10} className="fill-cyan-400 text-cyan-400" />
                                          <span>{r.broker_star_rating}★</span>
                                          <span className="text-slate-400">· {r.broker_hit_rate_pct}% Hit Rate</span>
                                        </div>
                                      </td>
                                      <td className="py-2.5 px-3 whitespace-nowrap">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                          r.action === "UPGRADE" || r.action === "TARGET_UP"
                                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                                            : r.action === "INITIATION"
                                            ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                                            : "bg-slate-800 text-slate-300 border border-slate-700"
                                        }`}>
                                          {r.action}
                                        </span>
                                      </td>
                                      <td className="py-2.5 px-3 font-bold text-white whitespace-nowrap">
                                        {r.current_rating}
                                      </td>
                                      <td className="py-2.5 px-3 whitespace-nowrap">
                                        <div className="text-white font-bold">
                                          ₹{r.price_at_reco.toLocaleString()} ➔ ₹{r.target_price.toLocaleString()}
                                        </div>
                                        <div className={`text-[10px] font-bold ${r.upside_pct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                          {r.upside_pct >= 0 ? "+" : ""}{r.upside_pct}% Implied Upside
                                        </div>
                                      </td>
                                      <td className="py-2.5 px-3 whitespace-nowrap">
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-cyan-950/60 border border-cyan-800/40 text-cyan-300">
                                          <Clock size={10} />
                                          <span>{r.target_horizon}</span>
                                        </span>
                                      </td>
                                      <td className="py-2.5 px-3 whitespace-nowrap">
                                        <div className="flex items-center gap-1.5">
                                          <div className="w-12 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                                            <div
                                              className={`h-full rounded-full ${
                                                r.conviction_score >= 85 ? "bg-emerald-400" : "bg-cyan-400"
                                              }`}
                                              style={{ width: `${r.conviction_score}%` }}
                                            />
                                          </div>
                                          <span className="font-bold text-white text-xs">{r.conviction_score}</span>
                                        </div>
                                      </td>
                                      <td className="py-2.5 px-3 text-slate-300 font-sans max-w-xs truncate" title={r.headline || r.investment_thesis || ""}>
                                        {r.headline || r.investment_thesis || "—"}
                                      </td>
                                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedReport(r);
                                          }}
                                          className="px-2 py-0.5 rounded bg-[#091526] hover:bg-cyan-950/40 border border-slate-700 hover:border-cyan-500/50 text-[10px] text-cyan-300 transition"
                                        >
                                          View Thesis
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* 6. ACTIVE VIEW: 60+ BROKER LEAGUE TABLE                               */}
        {/* ===================================================================== */}
        {activeView === "league" && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-[#060D19] p-5 shadow-2xl space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Award size={18} className="text-amber-400" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-white font-mono">
                    Empirical Brokerage League Table & Hit Rate Scorecard
                  </h2>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  Ranked by 12-Month Target Price Achievement Ratio
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-[#081325] text-slate-400 font-mono text-[10px] uppercase tracking-wider">
                      <th className="py-3 px-4">Rank</th>
                      <th className="py-3 px-4">Brokerage House</th>
                      <th className="py-3 px-4">Category Tier</th>
                      <th className="py-3 px-4">Star Rating</th>
                      <th className="py-3 px-4">Hit Rate %</th>
                      <th className="py-3 px-4">Total Calls Tracked</th>
                      <th className="py-3 px-4">Avg Days to Target</th>
                      <th className="py-3 px-4">Avg Drawdown Before Target</th>
                      <th className="py-3 px-4">Sector Superpower / Specialization</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {scorecards.map((sc, idx) => (
                      <tr key={sc.id} className="hover:bg-cyan-950/20 transition-colors">
                        <td className="py-3 px-4 font-bold text-slate-400">#{idx + 1}</td>

                        <td className="py-3 px-4 font-bold text-white font-sans text-sm whitespace-nowrap">
                          {sc.brokerage_house}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                            {sc.tier.replace(/_/g, " ")}
                          </span>
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1 text-amber-400 font-bold">
                            <Star size={12} className="fill-amber-400 text-amber-400" />
                            <span>{sc.star_rating.toFixed(1)}</span>
                          </div>
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`font-black text-sm ${
                              sc.hit_rate_pct >= 66
                                ? "text-emerald-400"
                                : sc.hit_rate_pct >= 58
                                ? "text-cyan-400"
                                : "text-amber-400"
                            }`}
                          >
                            {sc.hit_rate_pct.toFixed(1)}%
                          </span>
                        </td>

                        <td className="py-3 px-4 text-slate-300 whitespace-nowrap">
                          {sc.total_calls_tracked} calls
                        </td>

                        <td className="py-3 px-4 text-slate-300 whitespace-nowrap">
                          {sc.avg_days_to_target.toFixed(0)} days
                        </td>

                        <td className="py-3 px-4 text-rose-400 whitespace-nowrap">
                          {sc.avg_max_drawdown_pct.toFixed(1)}%
                        </td>

                        <td className="py-3 px-4 text-slate-300 font-sans max-w-xs truncate">
                          {sc.specialization || "Diversified Multi-Sector Coverage"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* 6. DETAIL MODAL / DRAWER FOR SELECTED REPORT                          */}
        {/* ===================================================================== */}
        {selectedReport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-2xl rounded-2xl border border-cyan-500/40 bg-[#081224] p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 space-y-4">
              <div className="flex items-start justify-between border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      {selectedReport.symbol}
                    </span>
                    <span className="text-xs text-slate-400">{selectedReport.company_name}</span>
                  </div>
                  <h3 className="text-base font-black text-white mt-1">
                    {selectedReport.headline || `${selectedReport.brokerage_house} Research Note`}
                  </h3>
                </div>

                <button
                  onClick={() => setSelectedReport(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Target & Conviction Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-xl bg-slate-900/80 border border-slate-800 font-mono text-center text-xs">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase">Brokerage House</div>
                  <div className="text-white font-bold mt-0.5 truncate">{selectedReport.brokerage_house}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase">Target Price</div>
                  <div className="text-cyan-400 font-bold mt-0.5">₹{selectedReport.target_price.toLocaleString()} (+{selectedReport.upside_pct}%)</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase">Target Horizon</div>
                  <div className="text-amber-400 font-bold mt-0.5 flex items-center justify-center gap-1">
                    <Clock size={11} className="text-amber-400" />
                    <span>{selectedReport.target_horizon || "12 Months"}</span>
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase">Conviction Score</div>
                  <div className="text-emerald-400 font-bold mt-0.5">{selectedReport.conviction_score}/100</div>
                </div>
              </div>

              {/* Investment Thesis */}
              {selectedReport.investment_thesis && (
                <div className="space-y-1">
                  <div className="text-[11px] font-mono font-bold text-slate-400 uppercase">Core Investment Thesis</div>
                  <p className="text-xs text-slate-200 leading-relaxed rounded-xl bg-black/30 p-3 border border-slate-800/80">
                    {selectedReport.investment_thesis}
                  </p>
                </div>
              )}

              {/* Catalysts & Risks */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3 space-y-1.5">
                  <div className="font-bold text-emerald-400 text-[11px] uppercase font-mono">Key Operational Catalysts</div>
                  <ul className="space-y-1 text-slate-300 text-[11px]">
                    {(selectedReport.key_catalysts || ["Sustained earnings visibility & operational tailwinds"]).map((c, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <CheckCircle2 size={12} className="text-emerald-400 shrink-0 mt-0.5" />
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-3 space-y-1.5">
                  <div className="font-bold text-rose-400 text-[11px] uppercase font-mono">Monitorable Downside Risks</div>
                  <ul className="space-y-1 text-slate-300 text-[11px]">
                    {(selectedReport.key_risks || ["Commodity pricing volatility and execution cycle delays"]).map((rk, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <AlertTriangle size={12} className="text-rose-400 shrink-0 mt-0.5" />
                        <span>{rk}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Other Broker Recommendations on This Stock */}
              {(() => {
                const stockConsensus = consensusMap.get(selectedReport.symbol);
                if (!stockConsensus) return null;
                const otherCalls = stockConsensus.reports.filter((r) => r.id !== selectedReport.id);

                return (
                  <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 space-y-2.5 font-mono">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider">
                          Consensus Across {stockConsensus.broker_count} Desks ({stockConsensus.total_reports} Calls)
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          Corridor: ₹{stockConsensus.target_corridor.low.toLocaleString()} ➔ ₹{stockConsensus.target_corridor.median.toLocaleString()} ➔ ₹{stockConsensus.target_corridor.high.toLocaleString()}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedReport(null);
                          setSelectedConsensusStock(stockConsensus);
                        }}
                        className="text-[10px] font-bold text-cyan-400 hover:text-cyan-300 transition underline underline-offset-2 flex items-center gap-1"
                      >
                        <span>Compare all {stockConsensus.broker_count} desks</span>
                        <ArrowUpRight size={11} />
                      </button>
                    </div>

                    {otherCalls.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {otherCalls.slice(0, 4).map((oc) => (
                          <button
                            key={oc.id}
                            onClick={() => setSelectedReport(oc)}
                            className="text-left p-2.5 rounded-lg bg-[#081224] border border-slate-800/80 hover:border-cyan-500/50 hover:bg-slate-800/50 transition group flex items-center justify-between"
                          >
                            <div>
                              <div className="font-bold text-white group-hover:text-cyan-300 transition text-[11px]">
                                {oc.brokerage_house}
                              </div>
                              <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                <span className="text-cyan-400 font-bold">{oc.current_rating}</span>
                                <span>·</span>
                                <span>{oc.target_horizon || "12M"}</span>
                                <span>·</span>
                                <span>
                                  {oc.report_date
                                    ? new Date(oc.report_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
                                    : "Recent"}
                                </span>
                              </div>
                            </div>
                            <div className="text-right font-mono">
                              <div className="font-bold text-cyan-400 text-xs">₹{oc.target_price.toLocaleString()}</div>
                              <div className={`text-[10px] font-bold ${oc.upside_pct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                +{oc.upside_pct}%
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400">
                        This is currently the sole active institutional report tracked for this ticker.
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-between">
                {(() => {
                  const stockConsensus = consensusMap.get(selectedReport.symbol);
                  if (!stockConsensus) return <div />;
                  return (
                    <button
                      onClick={() => {
                        setSelectedReport(null);
                        setSelectedConsensusStock(stockConsensus);
                      }}
                      className="inline-flex items-center gap-1.5 text-xs text-amber-300 hover:text-amber-200 font-mono font-bold transition"
                    >
                      <span>⚡ Open Multi-Broker Workspace</span>
                    </button>
                  );
                })()}

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedReport(null)}
                    className="rounded-xl border border-slate-700 px-3.5 py-2 text-xs font-mono text-slate-300 hover:bg-slate-800 transition"
                  >
                    Close
                  </button>
                  <Link
                    href={`/stocks/${selectedReport.symbol}?tab=brokerage&from=/brokerage-radar`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition"
                  >
                    <span>Open Full Stock Consensus Page</span>
                    <ExternalLink size={13} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* 7. DEDICATED MULTI-BROKER CONSENSUS MODAL FOR A STOCK                 */}
        {/* ===================================================================== */}
        {selectedConsensusStock && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto">
            <div className="w-full max-w-4xl rounded-2xl border border-cyan-500/50 bg-[#081224] p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 space-y-5 my-8 max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-mono font-black px-2.5 py-1 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                      {selectedConsensusStock.symbol}
                    </span>
                    <span className="text-sm font-bold text-white">{selectedConsensusStock.company_name}</span>
                    <span className="text-xs text-slate-400">· {selectedConsensusStock.sector}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        selectedConsensusStock.market_cap_category === "LARGE_CAP"
                          ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                          : selectedConsensusStock.market_cap_category === "MID_CAP"
                          ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                          : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                      }`}
                    >
                      {selectedConsensusStock.market_cap_category === "LARGE_CAP"
                        ? "Large Cap"
                        : selectedConsensusStock.market_cap_category === "MID_CAP"
                        ? "Mid Cap"
                        : "Small Cap"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Consolidated institutional view: {selectedConsensusStock.broker_count} broker desks covering this equity across {selectedConsensusStock.total_reports} research notes.
                  </p>
                </div>

                <button
                  onClick={() => setSelectedConsensusStock(null)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Target Corridor & Consensus Metrics Banner */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-slate-900/90 border border-slate-800 font-mono text-center">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase">Current CMP</div>
                  <div className="text-base font-black text-white mt-0.5">
                    ₹{selectedConsensusStock.current_price.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase">Consensus Median Target</div>
                  <div className="text-base font-black text-cyan-400 mt-0.5">
                    ₹{selectedConsensusStock.consensus_target.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase">Consensus Upside</div>
                  <div className={`text-base font-black mt-0.5 ${selectedConsensusStock.consensus_upside_pct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {selectedConsensusStock.consensus_upside_pct >= 0 ? "+" : ""}{selectedConsensusStock.consensus_upside_pct}%
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase">Consensus Stance</div>
                  <div className="text-xs font-bold text-amber-300 mt-1">
                    {selectedConsensusStock.consensus_stance.replace(/_/g, " ")}
                  </div>
                </div>
              </div>

              {/* Corridor Visualizer */}
              <div className="p-3.5 rounded-xl bg-[#060D19] border border-cyan-500/20 font-mono text-xs space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-bold uppercase tracking-wider text-cyan-300">Street Target Price Corridor</span>
                  <span className="text-slate-500">
                    Low ₹{selectedConsensusStock.target_corridor.low.toLocaleString()} to High ₹{selectedConsensusStock.target_corridor.high.toLocaleString()} (₹{(selectedConsensusStock.target_corridor.high - selectedConsensusStock.target_corridor.low).toLocaleString()} Spread)
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <div className="text-left">
                    <span className="text-[10px] text-slate-500 uppercase block">Street Low</span>
                    <span className="text-sm font-bold text-slate-300">₹{selectedConsensusStock.target_corridor.low.toLocaleString()}</span>
                  </div>
                  <div className="text-center px-4 py-1.5 rounded-xl bg-cyan-950/40 border border-cyan-500/40">
                    <span className="text-[10px] text-cyan-400 uppercase font-bold block">Consensus Median</span>
                    <span className="text-base font-black text-cyan-300">₹{selectedConsensusStock.target_corridor.median.toLocaleString()}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 uppercase block">Street High</span>
                    <span className="text-sm font-bold text-emerald-400">₹{selectedConsensusStock.target_corridor.high.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Multi-Broker Historical Comparison Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-bold text-white uppercase tracking-wider">
                    All Brokerage Recommendations at a Glance ({selectedConsensusStock.reports.length} Reports)
                  </span>
                  <span className="text-slate-400 text-[11px]">
                    Chronological Desk Tracking
                  </span>
                </div>

                <div className="rounded-xl border border-slate-800 bg-[#060D19] overflow-hidden overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-slate-800 bg-[#081325] text-slate-400 text-[10px] uppercase">
                        <th className="py-2.5 px-3">Brokerage House</th>
                        <th className="py-2.5 px-3">Rating / Action</th>
                        <th className="py-2.5 px-3">Target Price</th>
                        <th className="py-2.5 px-3">Horizon</th>
                        <th className="py-2.5 px-3">Report Date</th>
                        <th className="py-2.5 px-3">Conviction</th>
                        <th className="py-2.5 px-3">Core Catalyst / Note</th>
                        <th className="py-2.5 px-3">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {selectedConsensusStock.reports.map((rep) => (
                        <tr key={rep.id} className="hover:bg-slate-900/40 transition">
                          <td className="py-3 px-3 font-bold text-white whitespace-nowrap">
                            <div>{rep.brokerage_house}</div>
                            <div className="text-[10px] text-slate-500 font-sans">{rep.broker_tier.replace(/_/g, " ")}</div>
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                rep.current_rating.includes("BUY") || rep.action === "UPGRADE"
                                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                                  : rep.current_rating.includes("ACCUMULATE") || rep.action === "TARGET_UP"
                                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                                  : "bg-slate-800 text-slate-300 border border-slate-700"
                              }`}
                            >
                              {rep.current_rating}
                            </span>
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span className="font-bold text-cyan-400">₹{rep.target_price.toLocaleString()}</span>
                            <span className={`ml-1 text-[10px] font-bold ${rep.upside_pct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                              ({rep.upside_pct >= 0 ? "+" : ""}{rep.upside_pct}%)
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-300 whitespace-nowrap">
                            {rep.target_horizon || "12 Months"}
                          </td>
                          <td className="py-3 px-3 text-slate-400 whitespace-nowrap">
                            {rep.report_date ? new Date(rep.report_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span className="text-amber-400 font-bold">★ {rep.conviction_score}/100</span>
                          </td>
                          <td className="py-3 px-3 max-w-xs truncate text-slate-300 font-sans text-[11px]" title={rep.investment_thesis || ""}>
                            {rep.investment_thesis || rep.headline || "Institutional research note"}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <button
                              onClick={() => {
                                setSelectedConsensusStock(null);
                                setSelectedReport(rep);
                              }}
                              className="px-2 py-1 rounded bg-slate-800 text-cyan-400 hover:bg-slate-700 text-[10px] font-bold border border-slate-700"
                            >
                              View Note
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Footer */}
              <div className="pt-2 flex items-center justify-between border-t border-slate-800">
                <button
                  onClick={() => {
                    const sym = selectedConsensusStock.symbol;
                    setSelectedConsensusStock(null);
                    setActiveView("consensus");
                    setSearchQuery(sym);
                  }}
                  className="text-xs text-cyan-400 hover:text-cyan-300 font-mono font-bold transition flex items-center gap-1.5"
                >
                  <span>Filter by {selectedConsensusStock.symbol} in Main Grid</span>
                  <ArrowUpRight size={13} />
                </button>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedConsensusStock(null)}
                    className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-mono font-bold text-slate-300 hover:bg-slate-800 transition"
                  >
                    Close
                  </button>
                  <Link
                    href={`/stocks/${selectedConsensusStock.symbol}?tab=brokerage&from=/brokerage-radar`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-500 px-4 py-2 text-xs font-mono font-bold text-slate-950 hover:bg-cyan-400 transition"
                  >
                    <span>Open {selectedConsensusStock.symbol} Stock Radar</span>
                    <ExternalLink size={13} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}


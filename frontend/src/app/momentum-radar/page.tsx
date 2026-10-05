"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
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
  ChevronDown,
  ChevronUp,
  Globe,
  Radio,
  Clock,
  AlertCircle,
  Gauge,
  Eye,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import {
  PageHeader,
  KpiCard,
  LoadingSpinner,
  EmptyState,
  ActionButton,
  SparklineChart,
  StageBadge,
} from "@/components/common";
import AddToWatchlistButton from "@/components/watchlist/AddToWatchlistButton";
import {
  MomentumOpportunity,
  MomentumRadarMetadata,
  WatchlistCandidate,
  UniverseScanMetadata,
  fetchMomentumOpportunities,
  triggerMomentumScan,
  fetchMomentumFilterOptions,
  fetchUniverseScanStatus,
  triggerUniverseScan,
  fetchUniverseScanResults,
  fetchMomentumWatchlist,
  fetchIntradayBreakouts,
  refreshIntradayBreakouts,
} from "@/lib/momentumScreenerApi";

type PageMode = "screener" | "universe" | "intraday";

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
  // â”€â”€ Mode switcher â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [pageMode, setPageMode] = useState<PageMode>("screener");

  // â”€â”€ F&O Screener state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [opportunities, setOpportunities] = useState<MomentumOpportunity[]>([]);
  const [metadata, setMetadata] = useState<MomentumRadarMetadata | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [scanning, setScanning] = useState<boolean>(false);
  const [sectors, setSectors] = useState<string[]>([]);
  const [selectedOpportunity, setSelectedOpportunity] = useState<MomentumOpportunity | null>(null);

  // Filter Rules & Controls
  const [rules, setRules] = useState<RuleToggle[]>(INITIAL_RULES);
  const [showRules, setShowRules] = useState<boolean>(false);
  const [showFunnel, setShowFunnel] = useState<boolean>(false);
  const [funnelTab, setFunnelTab] = useState<"waterfall" | "conditions">("waterfall");
  const [minMatches, setMinMatches] = useState<number>(9);
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

  // â”€â”€ Universe Scan state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [universeStatus, setUniverseStatus] = useState<any>(null);
  const [universeScanLoading, setUniverseScanLoading] = useState(false);
  const [universeResults, setUniverseResults] = useState<MomentumOpportunity[]>([]);
  const [universeResultsMeta, setUniverseResultsMeta] = useState<UniverseScanMetadata | null>(null);
  const [universeMinMatches, setUniverseMinMatches] = useState(7);
  const [universeSearchTerm, setUniverseSearchTerm] = useState("");
  const [universePage, setUniversePage] = useState(1);
  const [universeTotalPages, setUniverseTotalPages] = useState(1);
  const [universeTotalCount, setUniverseTotalCount] = useState(0);
  const [universeScanTriggering, setUniverseScanTriggering] = useState(false);

  // â”€â”€ Intraday Breakout state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [watchlistData, setWatchlistData] = useState<any>(null);
  const [intradayData, setIntradayData] = useState<any>(null);
  const [intradayLoading, setIntradayLoading] = useState(false);
  const [intradayRefreshing, setIntradayRefreshing] = useState(false);
  const intradayIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

  // â”€â”€ Universe Scan handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const loadUniverseStatus = useCallback(async () => {
    try {
      const data = await fetchUniverseScanStatus();
      setUniverseStatus(data);
    } catch (e) {
      console.error("Universe status load error:", e);
    }
  }, []);

  const loadUniverseResults = useCallback(async () => {
    setUniverseScanLoading(true);
    try {
      const data = await fetchUniverseScanResults({
        min_matches: universeMinMatches,
        min_mcap: 1000,
        min_price: 20,
        min_turnover_lakhs: 50,
        page: universePage,
        limit: 50,
      });
      setUniverseResults(data?.items || []);
      setUniverseResultsMeta(data?.metadata || null);
      setUniverseTotalPages(data?.total_pages || 1);
      setUniverseTotalCount(data?.total_count || 0);
    } catch (e) {
      console.error("Universe results load error:", e);
    } finally {
      setUniverseScanLoading(false);
    }
  }, [universeMinMatches, universePage]);

  const handleTriggerUniverseScan = async () => {
    setUniverseScanTriggering(true);
    try {
      await triggerUniverseScan();
      setTimeout(loadUniverseStatus, 2000);
    } catch (e) {
      console.error("Universe scan trigger error:", e);
    } finally {
      setTimeout(() => setUniverseScanTriggering(false), 3000);
    }
  };

  // URL query parameter support & initial pre-fetching
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab") || params.get("mode");
      if (tab === "universe" || tab === "intraday" || tab === "screener") {
        setPageMode(tab as PageMode);
      }
    }
    loadUniverseStatus();
    loadUniverseResults();
  }, [loadUniverseStatus, loadUniverseResults]);

  useEffect(() => {
    if (pageMode === "universe") {
      loadUniverseResults();
    }
  }, [pageMode, universeMinMatches, universePage, loadUniverseResults]);

  const filteredUniverseResults = useMemo(() => {
    if (!universeSearchTerm.trim()) return universeResults;
    const term = universeSearchTerm.trim().toLowerCase();
    return universeResults.filter(
      (s) =>
        s.symbol.toLowerCase().includes(term) ||
        (s.company_name && s.company_name.toLowerCase().includes(term)) ||
        (s.sector && s.sector.toLowerCase().includes(term))
    );
  }, [universeResults, universeSearchTerm]);

  // â”€â”€ Intraday Breakout handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const loadIntradayBreakouts = useCallback(async () => {
    setIntradayLoading(true);
    try {
      const [breakoutData, wlData] = await Promise.all([
        fetchIntradayBreakouts(),
        fetchMomentumWatchlist(),
      ]);
      setIntradayData(breakoutData);
      setWatchlistData(wlData);
    } catch (e) {
      console.error("Intraday breakout load error:", e);
    } finally {
      setIntradayLoading(false);
    }
  }, []);

  const handleRefreshIntraday = async () => {
    setIntradayRefreshing(true);
    try {
      await refreshIntradayBreakouts();
      setTimeout(loadIntradayBreakouts, 2000);
    } catch (e) {
      console.error("Intraday refresh error:", e);
    } finally {
      setTimeout(() => setIntradayRefreshing(false), 3000);
    }
  };

  // Auto-poll intraday every 60s when in intraday mode
  useEffect(() => {
    if (pageMode === "intraday") {
      loadIntradayBreakouts();
      intradayIntervalRef.current = setInterval(loadIntradayBreakouts, 60000);
    } else {
      if (intradayIntervalRef.current) {
        clearInterval(intradayIntervalRef.current);
        intradayIntervalRef.current = null;
      }
    }
    return () => {
      if (intradayIntervalRef.current) {
        clearInterval(intradayIntervalRef.current);
        intradayIntervalRef.current = null;
      }
    };
  }, [pageMode, loadIntradayBreakouts]);



  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* HEADER */}
        <PageHeader
          icon={<Zap className="h-5 w-5" />}
          iconColor="cyan"
          title="Super Momentum Radar"
          badge={{ label: "TRIPLE RSI & BB EXPLOSION", color: "cyan" }}
          extraBadges={[{ label: "CASH SEGMENT", color: "emerald" }]}
          subtitle="Multi-Timeframe institutional momentum scanner targeting stocks with Volume Expansion, Daily &amp; Weekly Upper Bollinger Band breakouts, Triple RSI (Daily/Weekly/Monthly &gt; 60), and Weekly WMA 30/50 Golden Cross."
          actions={
            <>
              {pageMode === "screener" && (
                <>
                  <ActionButton variant="primary" onClick={handleTriggerScan} disabled={scanning}>
                    <RefreshCw className={`h-4 w-4 ${scanning ? "animate-spin" : ""}`} />
                    {scanning ? "Scanning..." : "Live Scan (F&O)"}
                  </ActionButton>
                  <ActionButton onClick={() => setRequireStrict(!requireStrict)} variant={requireStrict ? "primary" : "secondary"}>
                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                    Strict 9/9: {requireStrict ? "ON" : "OFF"}
                  </ActionButton>
                </>
              )}
              {pageMode === "universe" && (
                <ActionButton
                  variant="primary"
                  onClick={handleTriggerUniverseScan}
                  disabled={universeScanTriggering || universeStatus?.universe_scan_in_progress}
                >
                  <Globe className={`h-4 w-4 ${universeScanTriggering ? "animate-spin" : ""}`} />
                  {universeScanTriggering || universeStatus?.universe_scan_in_progress
                    ? "Scanning Universe..."
                    : "Run Full Universe Scan"}
                </ActionButton>
              )}
              {pageMode === "intraday" && (
                <ActionButton variant="primary" onClick={handleRefreshIntraday} disabled={intradayRefreshing}>
                  <Radio className={`h-4 w-4 ${intradayRefreshing ? "animate-pulse" : ""}`} />
                  {intradayRefreshing ? "Refreshing..." : "Force Refresh"}
                </ActionButton>
              )}
            </>
          }
        />

        {/* â”€â”€ MODE SWITCHER TABS â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div className="flex items-center gap-2 p-1 rounded-xl bg-slate-100 dark:bg-[#060D1A] border border-slate-200 dark:border-slate-800/80">
          {/* Tab 1: F&O Screener */}
          <button
            id="mode-tab-screener"
            onClick={() => setPageMode("screener")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-mono font-bold transition-all ${
              pageMode === "screener"
                ? "bg-cyan-500/15 border border-cyan-500/40 text-cyan-800 dark:text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.15)]"
                : "text-slate-600 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            F&O Screener
            {metadata && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-700 dark:text-cyan-400 text-[10px]">
                {metadata.total_scanned}
              </span>
            )}
          </button>

          {/* Tab 2: Full Universe Scan */}
          <button
            id="mode-tab-universe"
            onClick={() => setPageMode("universe")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-mono font-bold transition-all ${
              pageMode === "universe"
                ? "bg-purple-500/15 border border-purple-500/40 text-purple-800 dark:text-purple-300 shadow-[0_0_12px_rgba(168,85,247,0.15)]"
                : "text-slate-600 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
            }`}
          >
            <Globe className="h-3.5 w-3.5" />
            Full Universe Scan
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-800 dark:text-purple-300 text-[10px] font-bold">
              {universeTotalCount > 0 ? universeTotalCount : (universeResultsMeta?.near_breakout_count ?? 61)}
            </span>
          </button>

          {/* Tab 3: Live Breakout Monitor */}
          <button
            id="mode-tab-intraday"
            onClick={() => setPageMode("intraday")}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-mono font-bold transition-all ${
              pageMode === "intraday"
                ? "bg-emerald-500/15 border border-emerald-500/40 text-emerald-800 dark:text-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.15)]"
                : "text-slate-600 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-800/50"
            }`}
          >
            <Radio className="h-3.5 w-3.5" />
            Live Breakout Monitor
            {watchlistData && watchlistData.breakout_triggered_count > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-[10px] animate-pulse">
                {watchlistData.breakout_triggered_count} ”¥
              </span>
            )}
            {watchlistData && watchlistData.total_watchlist > 0 && watchlistData.breakout_triggered_count === 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-[10px]">
                {watchlistData.total_watchlist}
              </span>
            )}
          </button>
        </div>

        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {/* MODE: F&O SCREENER (existing content)                            */}
        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {pageMode === "screener" && (<>


        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard
            label="Total Scanned"
            value={metadata?.total_scanned || 0}
            sub="Equities"
          />
          <KpiCard
            label="10/10 Perfect"
            value={metadata?.perfect_10_count || 0}
            sub="Breakouts"
            color="emerald"
          />
          <KpiCard
            label="Core 9/9 Passed"
            value={metadata?.core_9_count || 0}
            sub="All Filters"
            color="cyan"
          />
          <KpiCard
            label="High Conviction"
            value={metadata?.high_conviction_count || 0}
            sub=">= 8/10"
            color="purple"
          />
          <KpiCard
            label="Conviction 79+"
            value={metadata?.conviction_79_count ?? metadata?.high_conviction_count ?? 0}
            sub="Alert Tier"
            color="amber"
          />
          <KpiCard
            label="Last Telemetry"
            value={metadata?.last_scan_time || "Ready"}
            sub={metadata?.scan_duration_seconds ? `${metadata.scan_duration_seconds}s latency` : "Active"}
          />
        </div>

        {/* INTERACTIVE RULE ENGINE CONSOLE (COLLAPSIBLE) */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#07111F]/80 p-4 md:p-5 shadow-sm dark:shadow-lg space-y-3 transition-all">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              onClick={() => setShowRules((prev) => !prev)}
              className="flex items-center gap-2.5 cursor-pointer select-none group"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400 group-hover:bg-cyan-500/20 transition-all">
                <Sliders className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xs md:text-sm font-bold font-mono uppercase tracking-wider text-slate-800 dark:text-slate-200 group-hover:text-cyan-600 dark:group-hover:text-cyan-300 transition-colors">
                    Rule Engine Filter Conditions (Cash Segment)
                  </h2>
                  <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-mono font-bold text-cyan-700 dark:text-cyan-300">
                    {rules.filter((r) => r.active).length}/10 Active
                  </span>
                </div>
                {!showRules && (
                  <p className="text-[11px] font-mono text-slate-500 hidden sm:block">
                    Click to expand &amp; customize Volume expansion, BB breakouts, Triple RSI &amp; WMA cross rules
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {showRules && (
                <button
                  onClick={() => setRules(INITIAL_RULES)}
                  className="text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 underline cursor-pointer text-xs font-mono mr-1"
                >
                  Reset Defaults
                </button>
              )}

              <button
                onClick={() => setShowFunnel((prev) => !prev)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono font-bold transition-all cursor-pointer shadow-xs ${
                  showFunnel
                    ? "bg-amber-500/15 border-amber-500/50 text-amber-700 dark:text-amber-300 hover:bg-amber-500/25"
                    : "bg-white dark:bg-slate-900/90 border-slate-300 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-amber-500/40"
                }`}
              >
                <Filter className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
                <span>Stage Filter Waterfall</span>
                {showFunnel ? (
                  <ChevronUp className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
                )}
              </button>

              <button
                onClick={() => setShowRules((prev) => !prev)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono font-bold transition-all cursor-pointer shadow-xs ${
                  showRules
                    ? "bg-cyan-500/15 border-cyan-500/50 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/25"
                    : "bg-white dark:bg-slate-900/90 border-slate-300 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:border-cyan-500/40"
                }`}
              >
                {showRules ? (
                  <>
                    <ChevronUp className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                    <span>Hide Rules</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                    <span>Expand Rules ({rules.filter((r) => r.active).length}/10 Active)</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {showRules && (
            <>
              <div className="border-t border-slate-800/80 pt-3">
                <p className="text-[11px] font-mono text-slate-400">
                  Click any condition toggle below to customize live screening logic:
                </p>
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
                        <span
                          className={`text-xs font-mono truncate ${
                            rule.active ? "text-slate-200" : "text-slate-500 line-through"
                          }`}
                        >
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
            </>
          )}
        </div>

        {/* STAGE FILTER ATTRITION WATERFALL PANEL */}
        {showFunnel && metadata?.stage_funnel && (
          <div className="rounded-2xl border border-slate-800 bg-[#060E1A]/90 p-4 md:p-5 shadow-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2 font-mono">
                  <Filter className="h-4 w-4 text-amber-400" />
                  Stage Filter Attrition Waterfall (Number of Stocks Filtered Out on Each Stage)
                </h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">
                  Exact candidate survival &amp; attrition at every multi-timeframe condition gate.
                </p>
              </div>

              {/* Sub-view switcher */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFunnelTab("waterfall")}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition ${
                    funnelTab === "waterfall"
                      ? "bg-amber-500 text-black shadow-md shadow-amber-500/20"
                      : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  Sequential Funnel
                </button>
                <button
                  onClick={() => setFunnelTab("conditions")}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition ${
                    funnelTab === "conditions"
                      ? "bg-amber-500 text-black shadow-md shadow-amber-500/20"
                      : "text-slate-400 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  Standalone Condition Drop Rates
                </button>
              </div>
            </div>

            {/* Quick KPI Strip */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 font-mono">
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                <p className="text-[10px] uppercase text-slate-400">Total Scanned</p>
                <p className="mt-1 text-xl font-bold text-cyan-300">
                  {metadata.stage_funnel.summary.initial_universe}
                </p>
                <p className="text-[10px] text-slate-500">Liquid Equities</p>
              </div>

              <div className="rounded-xl border border-rose-500/20 bg-rose-950/20 p-3">
                <p className="text-[10px] uppercase text-rose-400">Total Filtered Out</p>
                <p className="mt-1 text-xl font-bold text-rose-400">
                  {metadata.stage_funnel.summary.total_filtered_out}
                </p>
                <p className="text-[10px] text-rose-400/70">
                  {metadata.stage_funnel.summary.overall_attrition_pct}% Elimination
                </p>
              </div>

              <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-3">
                <p className="text-[10px] uppercase text-emerald-400">Passed All Stages</p>
                <p className="mt-1 text-xl font-bold text-emerald-300">
                  {metadata.stage_funnel.summary.final_matched_stocks}
                </p>
                <p className="text-[10px] text-emerald-400/70">
                  {metadata.stage_funnel.summary.overall_survival_rate_pct}% Final Yield
                </p>
              </div>

              <div className="rounded-xl border border-purple-500/20 bg-purple-950/20 p-3">
                <p className="text-[10px] uppercase text-purple-400">Core 9 Setup Yield</p>
                <p className="mt-1 text-xl font-bold text-purple-300">
                  {metadata.core_9_count}
                </p>
                <p className="text-[10px] text-purple-400/70">High-Probability Setups</p>
              </div>
            </div>

            {/* TAB 1: Sequential Waterfall Table & Progression */}
            {funnelTab === "waterfall" && (
              <div className="space-y-3">
                <div className="overflow-x-auto rounded-xl border border-slate-800">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="border-b border-slate-800 bg-slate-900/80 text-[10px] uppercase tracking-wider text-slate-400">
                      <tr>
                        <th className="py-2.5 px-3">Stage #</th>
                        <th className="py-2.5 px-3">Condition / Screening Gate</th>
                        <th className="py-2.5 px-3">Timeframe</th>
                        <th className="py-2.5 px-3 text-right">Candidates In</th>
                        <th className="py-2.5 px-3 text-right">Passed</th>
                        <th className="py-2.5 px-3 text-right">Filtered Out</th>
                        <th className="py-2.5 px-3 text-right">Stage Attrition</th>
                        <th className="py-2.5 px-3 text-right">Survival %</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {metadata.stage_funnel.sequential_waterfall.map((stage) => {
                        return (
                          <tr key={stage.condition_id} className="transition hover:bg-slate-800/40">
                            <td className="py-2.5 px-3 font-bold text-slate-400">
                              #{stage.stage_index}
                            </td>
                            <td className="py-2.5 px-3 font-sans font-medium text-slate-200">
                              {stage.condition_label}
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                                  stage.timeframe === "Daily"
                                    ? "bg-blue-500/10 text-blue-400 border border-blue-500/30"
                                    : stage.timeframe === "Weekly"
                                    ? "bg-purple-500/10 text-purple-400 border border-purple-500/30"
                                    : stage.timeframe === "Monthly"
                                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                                    : "bg-slate-800 text-slate-300"
                                }`}
                              >
                                {stage.timeframe}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right text-slate-300">
                              {stage.candidates_in}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-emerald-400">
                              {stage.passed_count}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold">
                              {stage.filtered_out_count > 0 ? (
                                <span className="inline-flex items-center gap-1 rounded bg-rose-950/60 border border-rose-500/30 px-2 py-0.5 text-rose-300">
                                  <XCircle className="h-3 w-3 text-rose-400" />
                                  -{stage.filtered_out_count}
                                </span>
                              ) : (
                                <span className="text-slate-500">—</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              {stage.attrition_pct > 0 ? (
                                <span className="text-rose-400 font-bold">{stage.attrition_pct}%</span>
                              ) : (
                                <span className="text-slate-500">0.0%</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-cyan-300">
                              {stage.cumulative_survival_pct}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 2: Standalone Condition Drop Rates Grid */}
            {funnelTab === "conditions" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {metadata.stage_funnel.independent_conditions.map((cond) => {
                  return (
                    <div
                      key={cond.condition_id}
                      className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 flex items-center justify-between"
                    >
                      <div className="min-w-0 pr-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                              cond.timeframe === "Daily"
                                ? "bg-blue-500/10 text-blue-400 border border-blue-500/30"
                                : cond.timeframe === "Weekly"
                                ? "bg-purple-500/10 text-purple-400 border border-purple-500/30"
                                : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                            }`}
                          >
                            {cond.timeframe}
                          </span>
                          <span className="text-xs font-bold text-slate-200 truncate">
                            {cond.condition_label}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono mt-1">
                          Evaluated: {cond.total_evaluated} stocks across universe
                        </p>
                      </div>

                      <div className="text-right flex-shrink-0 font-mono">
                        <div className="text-xs font-bold text-rose-400">
                          -{cond.filtered_out_count} ({cond.filter_rate_pct}%)
                        </div>
                        <div className="text-[10px] text-emerald-400">
                          {cond.passed_count} passed ({cond.pass_rate_pct}%)
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}


        {/* SEARCH, SECTOR & SORT TOOLBAR */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/70">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search symbol or company..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-9 pr-4 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-xs font-mono text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 shadow-xs"
              />
            </div>

            {/* Sector Dropdown */}
            <select
              value={selectedSector}
              onChange={(e) => {
                setSelectedSector(e.target.value);
                setPage(1);
              }}
              className="py-1.5 px-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-xs font-mono text-slate-800 dark:text-slate-300 focus:outline-none focus:border-cyan-500/50 cursor-pointer shadow-xs"
            >
              <option value="ALL">All Sectors</option>
              {sectors.map((sec) => (
                <option key={sec} value={sec}>
                  {sec}
                </option>
              ))}
            </select>

            {/* Minimum Matches Dropdown */}
            <div className="flex items-center gap-1.5 text-xs font-mono text-slate-700 dark:text-slate-400 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-800 shadow-xs">
              <span>Min Matches:</span>
              <select
                value={minMatches}
                onChange={(e) => {
                  setMinMatches(Number(e.target.value));
                  setPage(1);
                }}
                className="bg-transparent text-cyan-700 dark:text-cyan-300 font-bold focus:outline-none cursor-pointer"
              >
                <option value={10}>10 / 10</option>
                <option value={9}>&gt;= 9 / 10 (Alert Tier)</option>
                <option value={8}>&gt;= 8 / 10</option>
                <option value={7}>&gt;= 7 / 10</option>
                <option value={6}>&gt;= 6 / 10</option>
                <option value={1}>Any (1+)</option>
              </select>
            </div>

            {/* Quick 79+ Conviction Filter Button */}
            <button
              onClick={() => setConviction79Only((prev) => !prev)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer shadow-xs ${
                conviction79Only
                  ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/60 shadow-xs"
                  : "bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-400 border-slate-300 dark:border-slate-800 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              <Flame className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
              <span>79+ Conviction (Alert Tier)</span>
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-lg border border-slate-300 dark:border-slate-800 self-end md:self-auto shadow-xs">
            <button
              onClick={() => setViewMode("table")}
              className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition-all cursor-pointer ${
                viewMode === "table" ? "bg-cyan-500/20 text-cyan-800 dark:text-cyan-300 border border-cyan-500/40" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Table View
            </button>
            <button
              onClick={() => setViewMode("cards")}
              className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition-all cursor-pointer ${
                viewMode === "cards" ? "bg-cyan-500/20 text-cyan-800 dark:text-cyan-300 border border-cyan-500/40" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
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
                setMinMatches(9);
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
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#07111F]/90 overflow-hidden shadow-md dark:shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-100 dark:bg-slate-950/90 text-[10px] uppercase text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Symbol & Sector</th>
                    <th className="py-3 px-3">Price & Return</th>
                    <th className="py-3 px-3">Trend (90D)</th>
                    <th className="py-3 px-3">Current Stage</th>
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
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-slate-800 dark:text-slate-200">
                  {processedOpportunities.map((opp) => {
                    const isPositive = opp.day_change_pct >= 0;
                    return (
                      <tr
                        key={opp.symbol}
                        className="hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-colors group cursor-pointer"
                        onClick={() => setSelectedOpportunity(opp)}
                      >
                        {/* Symbol & Name */}
                        <td className="py-3.5 px-4">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                              <Link
                                href={`/stocks/${opp.symbol}?from=/momentum-radar`}
                                onClick={(e) => e.stopPropagation()}
                                className="font-bold text-sm text-slate-900 dark:text-white hover:text-cyan-600 dark:hover:text-cyan-400 hover:underline transition-colors"
                                title={`View ${opp.symbol} stock details page`}
                              >
                                {opp.symbol}
                              </Link>
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

                        {/* Trend (90D) */}
                        <td className="py-3.5 px-3">
                          <SparklineChart
                            data={(opp as any).sparkline}
                            cmp={opp.cmp}
                            return90d={(opp as any).return_90d_pct}
                            width={82}
                            height={22}
                            periodLabel="90D"
                            showDot={true}
                            showBadge={true}
                          />
                        </td>

                        {/* Current Stage */}
                        <td className="py-3.5 px-3">
                          <StageBadge
                            stage={(opp as any).current_stage}
                            stageCode={(opp as any).stage_code}
                            cmp={opp.cmp}
                          />
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
                            <AddToWatchlistButton
                              symbol={opp.symbol}
                              companyName={opp.company_name}
                              currentPrice={opp.cmp}
                              sector={opp.sector}
                              defaultThesis={`Super Momentum Radar: ${opp.match_count}/10 conditions met (${opp.setup_tier}). Entry: ₹${opp.trade_blueprint.entry_trigger}, Target 1: ₹${opp.trade_blueprint.target_1}, SL: ₹${opp.trade_blueprint.stop_loss} (R:R ${opp.trade_blueprint.risk_reward}:1)`}
                              variant="icon"
                            />
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
                className="p-4 rounded-xl bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 hover:border-cyan-500/50 shadow-sm dark:shadow-none transition-all cursor-pointer space-y-3 flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar: Symbol, Score, & Price */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <AddToWatchlistButton
                          symbol={opp.symbol}
                          companyName={opp.company_name}
                          currentPrice={opp.cmp}
                          sector={opp.sector}
                          defaultThesis={`Super Momentum Radar: ${opp.match_count}/10 conditions met (${opp.setup_tier}). Entry: ₹${opp.trade_blueprint.entry_trigger}, Target 1: ₹${opp.trade_blueprint.target_1}, SL: ₹${opp.trade_blueprint.stop_loss}`}
                        />
                        <h3 className="text-base font-bold font-mono text-slate-900 dark:text-white">
                          <Link
                            href={`/stocks/${opp.symbol}?from=/momentum-radar`}
                            onClick={(e) => e.stopPropagation()}
                            className="hover:text-cyan-600 dark:hover:text-cyan-400 hover:underline transition-colors"
                            title={`View ${opp.symbol} stock details page`}
                          >
                            {opp.symbol}
                          </Link>
                        </h3>
                        {opp.is_perfect_match && (
                          <span className="p-0.5 rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                            <Sparkles className="h-3 w-3" />
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[180px]">{opp.company_name}</p>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">{opp.sector}</span>
                    </div>

                    <div className="text-right">
                      <div className="text-base font-bold font-mono text-slate-900 dark:text-white">
                        ₹{opp.cmp.toLocaleString("en-IN")}
                      </div>
                      <div
                        className={`text-xs font-bold font-mono ${
                          opp.day_change_pct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
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
                            ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40"
                            : "bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700/40"
                        }`}>
                          {opp.conviction_score} PTS
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                      R:R {opp.trade_blueprint.risk_reward}:1
                    </span>
                  </div>

                  {/* Multi-Timeframe Matrix */}
                  <div className="mt-3 grid grid-cols-3 gap-1.5 p-2 rounded-lg bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800/80 text-[10px] font-mono">
                    <div className="text-center">
                      <span className="text-slate-500 block text-[9px] uppercase">Daily RSI</span>
                      <span className={`font-bold ${opp.filters.daily_rsi_gt_60 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400"}`}>
                        {opp.indicators.daily_rsi}
                      </span>
                    </div>
                    <div className="text-center">
                      <span className="text-slate-500 block text-[9px] uppercase">Weekly RSI</span>
                      <span className={`font-bold ${opp.filters.weekly_rsi_gt_60 ? "text-purple-600 dark:text-purple-400" : "text-slate-500 dark:text-slate-400"}`}>
                        {opp.indicators.weekly_rsi}
                      </span>
                    </div>
                    <div className="text-center">
                      <span className="text-slate-500 block text-[9px] uppercase">Monthly RSI</span>
                      <span className={`font-bold ${opp.filters.monthly_rsi_gt_60 ? "text-amber-600 dark:text-amber-400" : "text-slate-500 dark:text-slate-400"}`}>
                        {opp.indicators.monthly_rsi}
                      </span>
                    </div>
                  </div>

                  {/* Key Indicators Checkstrip */}
                  <div className="mt-2.5 space-y-1 text-[11px] font-mono">
                    <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                      <span>Volume &gt; 20 SMA:</span>
                      <span className={opp.filters.vol_gt_sma20 ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-slate-400 dark:text-slate-500"}>
                        {opp.indicators.volume_surge_ratio}x Surge
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                      <span>Daily Upper BB (20,2):</span>
                      <span className={opp.filters.daily_close_gt_bb_upper ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-slate-400 dark:text-slate-500"}>
                        ₹{opp.indicators.daily_bb_upper}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                      <span>Weekly Upper BB (20,2):</span>
                      <span className={opp.filters.weekly_close_gt_bb_upper ? "text-purple-600 dark:text-purple-400 font-bold" : "text-slate-400 dark:text-slate-500"}>
                        ₹{opp.indicators.weekly_bb_upper}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                      <span>Weekly WMA (30/50):</span>
                      <span className={opp.filters.weekly_wma_cross ? "text-cyan-700 dark:text-cyan-400 font-bold" : "text-slate-400 dark:text-slate-500"}>
                        ₹{opp.indicators.weekly_wma30} / ₹{opp.indicators.weekly_wma50}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Trade Setup Blueprint Footer */}
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="text-slate-500 dark:text-slate-400">Trigger: <span className="text-slate-900 dark:text-white font-bold">₹{opp.trade_blueprint.entry_trigger}</span></span>
                    <span className="text-slate-500 dark:text-slate-400">T1: <span className="text-emerald-600 dark:text-emerald-400 font-bold">₹{opp.trade_blueprint.target_1}</span></span>
                    <span className="text-slate-500 dark:text-slate-400">SL: <span className="text-rose-600 dark:text-rose-400 font-bold">₹{opp.trade_blueprint.stop_loss}</span></span>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <a
                      href={opp.tradingview_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 py-1 px-2 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-700 text-xs font-mono text-center flex items-center justify-center gap-1 shadow-xs"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span>TradingView</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <Link
                      href={opp.techno_funda_url}
                      className="flex-1 py-1 px-2 rounded-lg bg-cyan-50 dark:bg-cyan-950/80 hover:bg-cyan-100 dark:hover:bg-cyan-900 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800/60 text-xs font-mono text-center flex items-center justify-center gap-1 shadow-xs"
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
          <div className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 text-xs font-mono text-slate-600 dark:text-slate-400">
            <span>
              Showing {opportunities.length} of {totalCount} qualifying stocks
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 cursor-pointer shadow-xs"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="font-bold text-slate-900 dark:text-white">
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white disabled:opacity-30 cursor-pointer shadow-xs"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* DETAILED INSPECTOR MODAL */}
        {selectedOpportunity && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#07111F] p-5 md:p-6 shadow-2xl space-y-4">
              {/* Modal Header */}
              <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/stocks/${selectedOpportunity.symbol}?from=/momentum-radar`}
                      className="text-xl font-black font-mono text-slate-900 dark:text-white hover:text-cyan-600 dark:hover:text-cyan-400 hover:underline transition-colors flex items-center gap-1.5"
                      title={`View ${selectedOpportunity.symbol} stock details page`}
                    >
                      <span>{selectedOpportunity.symbol}</span>
                      <ExternalLink className="h-4 w-4 opacity-70" />
                    </Link>
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${selectedOpportunity.tier_badge}`}>
                      {selectedOpportunity.setup_tier}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">{selectedOpportunity.company_name} — {selectedOpportunity.sector}</p>
                </div>
                <div className="flex items-center gap-2">
                  <AddToWatchlistButton
                    symbol={selectedOpportunity.symbol}
                    companyName={selectedOpportunity.company_name}
                    currentPrice={selectedOpportunity.cmp}
                    sector={selectedOpportunity.sector}
                    defaultThesis={`Super Momentum Radar: ${selectedOpportunity.match_count}/10 match (${selectedOpportunity.setup_tier}). Entry: ₹${selectedOpportunity.trade_blueprint.entry_trigger}, Target 1: ₹${selectedOpportunity.trade_blueprint.target_1}, SL: ₹${selectedOpportunity.trade_blueprint.stop_loss}`}
                    variant="button"
                  />
                  <button
                    onClick={() => setSelectedOpportunity(null)}
                    className="p-1.5 rounded-xl bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-800 cursor-pointer shadow-xs"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Price Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-xs font-mono">
                <div>
                  <span className="text-slate-500 text-[10px] block">Current Price</span>
                  <span className="text-base font-bold text-slate-900 dark:text-white">₹{selectedOpportunity.cmp}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">1D Change</span>
                  <span className={`text-base font-bold ${selectedOpportunity.day_change_pct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                    {selectedOpportunity.day_change_pct >= 0 ? "+" : ""}{selectedOpportunity.day_change_pct}%
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">Day High / Low</span>
                  <span className="text-slate-800 dark:text-white">₹{selectedOpportunity.indicators.daily_high} / ₹{selectedOpportunity.indicators.daily_low}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">Day Open</span>
                  <span className="text-slate-800 dark:text-white">₹{selectedOpportunity.indicators.daily_open}</span>
                </div>
              </div>

              {/* 10 Condition Breakdown */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold font-mono uppercase text-slate-800 dark:text-slate-300">
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
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                            : "bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800/80 text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {passed ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <XCircle className="h-4 w-4 text-slate-400 dark:text-slate-600" />
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
              <div className="p-3.5 rounded-xl bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800/40 space-y-2 text-xs font-mono">
                <span className="text-[10px] uppercase font-bold text-cyan-800 dark:text-cyan-400 block">
                  Institutional Trade Execution Blueprint
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <span className="text-slate-500 text-[10px] block">Entry Trigger</span>
                    <span className="font-bold text-slate-900 dark:text-white">₹{selectedOpportunity.trade_blueprint.entry_trigger}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">Target 1 (+8%)</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">₹{selectedOpportunity.trade_blueprint.target_1}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">Target 2 (+16%)</span>
                    <span className="font-bold text-cyan-700 dark:text-cyan-400">₹{selectedOpportunity.trade_blueprint.target_2}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">Stop Loss</span>
                    <span className="font-bold text-rose-600 dark:text-rose-400">₹{selectedOpportunity.trade_blueprint.stop_loss}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <a
                  href={selectedOpportunity.tradingview_url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-slate-700 text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
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
        {/* END of screener mode content */}
        </>)}

        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {/* MODE: FULL UNIVERSE SCAN                                         */}
        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {pageMode === "universe" && (
          <div className="space-y-5">
            {/* Universe Status Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <KpiCard
                label="Universe Size"
                value={universeResultsMeta?.universe_size?.toLocaleString() ?? universeStatus?.last_universe_scan?.universe_size?.toLocaleString() ?? "—"}
                sub="Total Equities"
                color="purple"
              />
              <KpiCard
                label="Scanned"
                value={universeResultsMeta?.scanned_count?.toLocaleString() ?? "—"}
                sub="Processed"
                color="cyan"
              />
              <KpiCard
                label="â‰¥7/10 Near-Breakout"
                value={universeResultsMeta?.near_breakout_count ?? universeStatus?.last_universe_scan?.near_breakout_count ?? "—"}
                sub="Watchlist Promoted"
                color="amber"
              />
              <KpiCard
                label="High Conviction"
                value={universeResultsMeta?.high_conviction_count ?? "—"}
                sub="â‰¥8/10 Conditions"
                color="emerald"
              />
              <KpiCard
                label="Perfect 10/10"
                value={universeResultsMeta?.perfect_10_count ?? "—"}
                sub="All Filters"
                color="emerald"
              />
              <KpiCard
                label="Scan Duration"
                value={universeResultsMeta?.scan_duration_seconds ? `${universeResultsMeta.scan_duration_seconds}s` : "—"}
                sub={universeResultsMeta?.last_scan_time ?? (universeStatus?.universe_scan_in_progress ? "In Progress..." : "Not yet run")}
              />
            </div>

            {/* Universe Scan Status Banner */}
            {universeStatus?.universe_scan_in_progress && (
              <div className="flex items-center gap-3 p-4 rounded-xl border border-purple-500/40 bg-purple-950/20">
                <RefreshCw className="h-5 w-5 text-purple-400 animate-spin flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold text-purple-300 font-mono">Full Universe Scan In Progress</p>
                  <p className="text-xs text-slate-400 font-mono">Scanning all NSE/BSE equities in the background. Results will appear automatically when complete.</p>
                </div>
              </div>
            )}

            {/* Off-Market Window Indicator */}
            <div className={`flex items-center gap-3 p-3 rounded-xl border text-xs font-mono ${
              universeStatus?.is_off_market_window
                ? "border-emerald-500/30 bg-emerald-950/20 text-emerald-300"
                : "border-amber-500/30 bg-amber-950/20 text-amber-300"
            }`}>
              <Clock className="h-4 w-4 flex-shrink-0" />
              <div>
                {universeStatus?.is_off_market_window
                  ? "âœ… Off-market window active — Autonomous scheduler will trigger full universe scan every 60 minutes. You can also trigger manually above."
                  : "• Market hours active — Universe scanner paused. Intraday breakout monitor is watching your watchlist candidates live. Switch to the Live Breakout Monitor tab."}
              </div>
            </div>

            {/* Min Match Filter + Search + Institutional Controls */}
            {!universeStatus?.universe_scan_in_progress && (
              <div className="p-3.5 rounded-2xl bg-white dark:bg-[#060E1A] border border-slate-200 dark:border-slate-800/80 shadow-sm dark:shadow-none space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {/* Condition Filter Buttons */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-slate-700 dark:text-slate-400 font-bold">Minimum Score:</span>
                    {[7, 8, 9, 10].map((n) => (
                      <button
                        key={n}
                        onClick={() => { setUniverseMinMatches(n); setUniversePage(1); }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all shadow-xs ${
                          universeMinMatches === n
                            ? "bg-purple-500/20 border-purple-500/50 text-purple-800 dark:text-purple-300 shadow-[0_0_10px_rgba(168,85,247,0.2)]"
                            : "bg-white dark:bg-slate-900/60 border-slate-300 dark:border-slate-700/50 text-slate-700 dark:text-slate-400 hover:border-purple-500/30 hover:text-slate-900 dark:hover:text-slate-200"
                        }`}
                      >
                        {n === 10 ? "10/10 Perfect" : `â‰¥${n}/10`}
                      </button>
                    ))}
                  </div>

                  {/* Search box */}
                  <div className="relative min-w-[220px] max-w-xs flex-1">
                    <input
                      type="text"
                      placeholder="Search symbol, company, sector..."
                      value={universeSearchTerm}
                      onChange={(e) => setUniverseSearchTerm(e.target.value)}
                      className="w-full bg-white dark:bg-[#081324] border border-slate-300 dark:border-slate-700/80 rounded-xl px-3.5 py-1.5 text-xs font-mono text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-purple-500/60 shadow-xs"
                    />
                    {universeSearchTerm && (
                      <button
                        onClick={() => setUniverseSearchTerm("")}
                        className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 text-xs"
                      >
                        âœ•
                      </button>
                    )}
                  </div>
                </div>

                {/* Institutional Filter Badges */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800/60 text-[11px] font-mono flex-wrap">
                  <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Active Institutional Gates:</span>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 font-bold">
                    âœ“ Market Cap â‰¥ ₹1,000 Cr
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-500/30 font-bold">
                    âœ“ Non-Penny (CMP â‰¥ ₹20)
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/30 font-bold">
                    âœ“ Liquid (Turnover â‰¥ ₹50L &amp; Vol â‰¥ 25k)
                  </span>
                  <span className="text-slate-600 dark:text-slate-400 ml-auto font-bold">
                    {filteredUniverseResults.length} / {universeTotalCount} stocks showing
                  </span>
                </div>
              </div>
            )}

            {/* Universe Results Table */}
            {filteredUniverseResults.length === 0 && !universeScanLoading && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-[#060E1A]/80 p-8 text-center">
                <Globe className="h-10 w-10 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
                <p className="text-sm font-mono font-bold text-slate-700 dark:text-slate-400">
                  {universeSearchTerm ? `No institutional stocks match "${universeSearchTerm}"` : "No universe scan results yet"}
                </p>
                <p className="text-xs font-mono text-slate-500 dark:text-slate-600 mt-1">
                  Click <span className="text-purple-600 dark:text-purple-400">"Run Full Universe Scan"</span> to sweep all NSE/BSE equities for momentum setups.
                  The autonomous scheduler will also run this automatically during off-market hours (18:00–09:00 IST).
                </p>
              </div>
            )}

            {universeScanLoading && (
              <div className="flex items-center justify-center py-12">
                <LoadingSpinner />
              </div>
            )}

            {!universeScanLoading && filteredUniverseResults.length > 0 && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#07111F]/90 overflow-hidden shadow-md dark:shadow-xl shadow-black/10 dark:shadow-black/40">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-mono">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-[#07111F]/90">
                        <th className="text-left px-4 py-3 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider w-10">#</th>
                        <th className="text-left px-4 py-3 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider">Symbol</th>
                        <th className="text-left px-4 py-3 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider">Sector</th>
                        <th className="text-right px-3 py-3 text-emerald-700 dark:text-emerald-400 font-bold uppercase tracking-wider">Mcap (Cr)</th>
                        <th className="text-right px-3 py-3 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider">CMP</th>
                        <th className="text-center px-3 py-3 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider">Trend (90D)</th>
                        <th className="text-center px-3 py-3 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider">Stage</th>
                        <th className="text-right px-3 py-3 text-cyan-700 dark:text-cyan-400 font-bold uppercase tracking-wider">20D Turnover</th>
                        <th className="text-center px-4 py-3 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider">Score</th>
                        <th className="text-center px-4 py-3 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider">10 Conditions</th>
                        <th className="text-right px-4 py-3 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider">Daily RSI</th>
                        <th className="text-right px-4 py-3 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider">Wkly RSI</th>
                        <th className="text-right px-4 py-3 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider">Vol Surge</th>
                        <th className="text-center px-4 py-3 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                      {filteredUniverseResults.map((stock, idx) => {
                        const matchPct = (stock.match_count / 10) * 100;
                        const matchColor =
                          stock.match_count >= 9 ? "bg-emerald-500" :
                          stock.match_count >= 7 ? "bg-amber-500" :
                          "bg-slate-400 dark:bg-slate-600";
                        const globalIdx = (universePage - 1) * 50 + idx + 1;
                        return (
                          <tr key={stock.symbol} className="border-b border-slate-200 dark:border-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors group">
                            <td className="px-4 py-2.5 text-slate-400 dark:text-slate-600">{globalIdx}</td>
                            <td className="px-4 py-2.5">
                              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                <Link
                                  href={`/stocks/${stock.symbol}?from=/momentum-radar`}
                                  className="hover:text-purple-600 dark:hover:text-purple-400 hover:underline transition-colors"
                                  title={`View ${stock.symbol} stock details page`}
                                >
                                  {stock.symbol}
                                </Link>
                                {stock.match_count === 10 && (
                                  <span className="px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[9px] font-bold border border-emerald-500/40">10/10</span>
                                )}
                              </div>
                              <div className="text-slate-500 text-[10px] truncate max-w-[130px]">{stock.company_name}</div>
                            </td>
                            <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">{stock.sector}</td>
                            <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">
                              {stock.market_cap_cr ? `₹${Math.round(stock.market_cap_cr).toLocaleString()} Cr` : "â‰¥ ₹1,000 Cr"}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900 dark:text-white">
                              ₹{stock.cmp?.toLocaleString()}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <SparklineChart
                                data={(stock as any).sparkline}
                                cmp={stock.cmp}
                                return90d={(stock as any).return_90d_pct}
                                width={76}
                                height={20}
                                periodLabel="90D"
                                showDot={true}
                                showBadge={true}
                              />
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <StageBadge
                                stage={(stock as any).current_stage}
                                stageCode={(stock as any).stage_code}
                                cmp={stock.cmp}
                              />
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono font-bold text-cyan-700 dark:text-cyan-300">
                              {stock.turnover_lakhs ? `₹${stock.turnover_lakhs.toLocaleString()} L` : "—"}
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex flex-col items-center gap-1">
                                <span className={`text-sm font-bold ${
                                  stock.match_count >= 9 ? "text-emerald-600 dark:text-emerald-400" :
                                  stock.match_count >= 7 ? "text-amber-600 dark:text-amber-400" : "text-slate-600 dark:text-slate-400"
                                }`}>{stock.match_count}/10</span>
                                <div className="w-16 h-1.5 rounded-full bg-slate-200 dark:bg-slate-800">
                                  <div className={`h-full rounded-full ${matchColor}`} style={{ width: `${matchPct}%` }} />
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-0.5 justify-center">
                                {Object.entries(stock.filters || {}).slice(0, 10).map(([key, passed]) => (
                                  <div
                                    key={key}
                                    title={key}
                                    className={`w-2.5 h-4 rounded-sm ${passed ? "bg-emerald-500/80" : "bg-slate-200 dark:bg-slate-700/60"}`}
                                  />
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <span className={`font-bold ${(stock.indicators?.daily_rsi ?? 0) > 70 ? "text-emerald-600 dark:text-emerald-400" : (stock.indicators?.daily_rsi ?? 0) > 60 ? "text-cyan-700 dark:text-cyan-400" : "text-slate-600 dark:text-slate-400"}`}>
                                {stock.indicators?.daily_rsi?.toFixed(1) ?? "—"}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <span className={`font-bold ${(stock.indicators?.weekly_rsi ?? 0) > 60 ? "text-purple-600 dark:text-purple-400" : "text-slate-600 dark:text-slate-400"}`}>
                                {stock.indicators?.weekly_rsi?.toFixed(1) ?? "—"}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              <span className={`font-bold ${(stock.indicators?.volume_surge_ratio ?? 0) >= 2 ? "text-amber-600 dark:text-amber-400" : "text-slate-600 dark:text-slate-400"}`}>
                                {stock.indicators?.volume_surge_ratio?.toFixed(2) ?? "—"}Ã—
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <a
                                href={`https://in.tradingview.com/symbols/NSE-${stock.symbol}/`}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] inline-flex items-center gap-1 border border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 shadow-xs"
                              >
                                Chart <ExternalLink className="h-2.5 w-2.5" />
                              </a>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {universeTotalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#07111F]/80">
                    <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
                      Page {universePage} of {universeTotalPages} ({universeTotalCount.toLocaleString()} stocks)
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setUniversePage(Math.max(1, universePage - 1))}
                        disabled={universePage <= 1}
                        className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-mono hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 shadow-xs"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setUniversePage(Math.min(universeTotalPages, universePage + 1))}
                        disabled={universePage >= universeTotalPages}
                        className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 text-xs font-mono hover:bg-slate-800 disabled:opacity-40"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {/* MODE: LIVE INTRADAY BREAKOUT MONITOR                             */}
        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        {pageMode === "intraday" && (
          <div className="space-y-5">
            {/* Intraday Status Banner */}
            {intradayLoading && (
              <div className="flex items-center justify-center py-12">
                <LoadingSpinner />
              </div>
            )}

            {!intradayLoading && (
              <>
                {/* Market Hours Indicator */}
                <div className={`flex items-center gap-3 p-3 rounded-xl border text-xs font-mono ${
                  intradayData?.is_market_hours
                    ? "border-emerald-500/40 bg-emerald-950/20 text-emerald-300"
                    : "border-slate-700/60 bg-slate-900/40 text-slate-400"
                }`}>
                  <Radio className={`h-4 w-4 flex-shrink-0 ${intradayData?.is_market_hours ? "text-emerald-400 animate-pulse" : "text-slate-500"}`} />
                  <div className="flex-1">
                    {intradayData?.is_market_hours
                      ? `Ÿ¢ MARKET HOURS ACTIVE — Auto-polling every 60s. Watchlist: ${intradayData?.metadata?.watchlist_size ?? 0} stocks being monitored. Last scan: ${intradayData?.metadata?.last_scan_time ?? "—"}`
                      : `âš« MARKET CLOSED — Live monitoring paused. Run the Full Universe Scan tonight to build tomorrow's watchlist. Watchlist: ${watchlistData?.total_watchlist ?? 0} candidates from last scan.`}
                  </div>
                </div>

                {/* Breakout Alerts */}
                {intradayData?.breakouts?.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-2 uppercase tracking-wider">
                      <Zap className="h-4 w-4" />
                      ”¥ LIVE BREAKOUTS DETECTED ({intradayData.breakouts.length})
                    </h3>
                    {intradayData.breakouts.map((stock: any) => (
                      <div key={stock.symbol} className="flex items-center gap-4 p-4 rounded-xl border border-emerald-500/40 bg-emerald-950/15 hover:border-emerald-400/60 transition-all">
                        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                          <Zap className="h-5 w-5 text-emerald-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/stocks/${stock.symbol}?from=/momentum-radar`}
                              className="font-bold text-white text-sm font-mono hover:text-emerald-400 hover:underline transition-colors"
                              title={`View ${stock.symbol} stock details page`}
                            >
                              {stock.symbol}
                            </Link>
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold border border-emerald-500/30">
                              {stock.match_count}/10
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-mono">BREAKOUT</span>
                          </div>
                          <div className="text-slate-400 text-[11px] font-mono mt-0.5">
                            {stock.company_name} Â· {stock.sector} Â· Prior: {stock.prior_match_count}/10 â†’ Now: {stock.match_count}/10
                          </div>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <div className="text-white font-bold font-mono">₹{stock.cmp?.toLocaleString()}</div>
                          <div className={`text-xs font-mono ${(stock.day_change_pct ?? 0) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                            {(stock.day_change_pct ?? 0) >= 0 ? "+" : ""}{stock.day_change_pct?.toFixed(2)}%
                          </div>
                        </div>
                        <a
                          href={`https://in.tradingview.com/symbols/NSE-${stock.symbol}/`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-shrink-0 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-mono font-bold flex items-center gap-1"
                        >
                          Chart <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    ))}
                  </div>
                )}

                {/* Watchlist Monitoring Table */}
                {watchlistData?.candidates?.length > 0 ? (
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#07111F]/90 overflow-hidden shadow-sm dark:shadow-none">
                    <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#07111F]/90 flex items-center justify-between">
                      <h3 className="text-xs font-mono font-bold text-slate-800 dark:text-slate-300 flex items-center gap-2">
                        <Eye className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
                        Watchlist Monitor ({watchlistData.total_watchlist} candidates)
                        <span className="text-slate-500 font-normal">— Stocks promoted from last night's â‰¥7/10 universe scan</span>
                      </h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs font-mono">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-800/80 bg-slate-100/60 dark:bg-[#07111F]/60">
                            <th className="text-left px-4 py-2.5 text-slate-600 dark:text-slate-500 font-bold uppercase tracking-wider">Symbol</th>
                            <th className="text-right px-3 py-2.5 text-emerald-700 dark:text-emerald-400 font-bold uppercase tracking-wider">Mcap (Cr)</th>
                            <th className="text-center px-4 py-2.5 text-slate-600 dark:text-slate-500 font-bold uppercase tracking-wider">Scan Score</th>
                            <th className="text-center px-4 py-2.5 text-slate-600 dark:text-slate-500 font-bold uppercase tracking-wider">Live Score</th>
                            <th className="text-right px-4 py-2.5 text-slate-600 dark:text-slate-500 font-bold uppercase tracking-wider">CMP at Scan</th>
                            <th className="text-right px-4 py-2.5 text-slate-600 dark:text-slate-500 font-bold uppercase tracking-wider">Live CMP</th>
                            <th className="text-center px-4 py-2.5 text-slate-600 dark:text-slate-500 font-bold uppercase tracking-wider">Status</th>
                            <th className="text-center px-4 py-2.5 text-slate-600 dark:text-slate-500 font-bold uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                          {watchlistData.candidates.map((cand: WatchlistCandidate) => {
                            const liveScore = intradayData?.near_breakouts?.find((x: any) => x.symbol === cand.symbol)?.match_count
                              ?? intradayData?.breakouts?.find((x: any) => x.symbol === cand.symbol)?.match_count
                              ?? cand.intraday_match_count;
                            const isBreakout = cand.breakout_triggered;
                            return (
                              <tr key={cand.id} className={`border-b border-slate-200 dark:border-slate-800/40 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/20 ${isBreakout ? "bg-emerald-50 dark:bg-emerald-950/10" : ""}`}>
                                <td className="px-4 py-2.5">
                                  <div className="font-bold text-slate-900 dark:text-white">
                                    <Link
                                      href={`/stocks/${cand.symbol}?from=/momentum-radar`}
                                      className="hover:text-cyan-600 dark:hover:text-cyan-400 hover:underline transition-colors"
                                      title={`View ${cand.symbol} stock details page`}
                                    >
                                      {cand.symbol}
                                    </Link>
                                  </div>
                                  <div className="text-slate-500 text-[10px] truncate max-w-[100px]">{cand.company_name}</div>
                                </td>
                                <td className="px-3 py-2.5 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400">
                                  {cand.market_cap_cr ? `₹${Math.round(cand.market_cap_cr).toLocaleString()} Cr` : "â‰¥ ₹1,000 Cr"}
                                </td>
                                <td className="px-4 py-2.5 text-center">
                                  <span className={`font-bold ${cand.match_count >= 8 ? "text-amber-700 dark:text-amber-400" : "text-slate-600 dark:text-slate-400"}`}>
                                    {cand.match_count}/10
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 text-center">
                                  {liveScore != null ? (
                                    <span className={`font-bold ${liveScore >= 9 ? "text-emerald-700 dark:text-emerald-400" : liveScore >= 7 ? "text-amber-700 dark:text-amber-400" : "text-slate-600 dark:text-slate-400"}`}>
                                      {liveScore}/10
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 dark:text-slate-600">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-2.5 text-right text-slate-600 dark:text-slate-400">
                                  {cand.cmp_at_scan ? `₹${cand.cmp_at_scan?.toLocaleString()}` : "—"}
                                </td>
                                <td className="px-4 py-2.5 text-right">
                                  {cand.intraday_cmp ? (
                                    <span className="text-slate-900 dark:text-slate-200">₹{cand.intraday_cmp?.toLocaleString()}</span>
                                  ) : (
                                    <span className="text-slate-400 dark:text-slate-600">—</span>
                                  )}
                                </td>
                                <td className="px-4 py-2.5 text-center">
                                  {isBreakout ? (
                                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px] border border-emerald-500/30 font-bold">
                                      ”¥ BREAKOUT
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 text-[10px] border border-cyan-500/20">
                                      ‘ WATCHING
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-2.5 text-center">
                                  <a
                                    href={`https://in.tradingview.com/symbols/NSE-${cand.symbol}/`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-[10px] inline-flex items-center gap-1 border border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600 shadow-xs"
                                  >
                                    Chart <ExternalLink className="h-2.5 w-2.5" />
                                  </a>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-[#060E1A]/80 p-8 text-center">
                    <Gauge className="h-10 w-10 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
                    <p className="text-sm font-mono font-bold text-slate-700 dark:text-slate-400">No watchlist candidates yet</p>
                    <p className="text-xs font-mono text-slate-500 dark:text-slate-600 mt-1">
                      Switch to the <span className="text-purple-600 dark:text-purple-400">Full Universe Scan</span> tab and trigger an off-market scan.
                      Stocks passing â‰¥7/10 conditions will be automatically promoted here for live monitoring.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}




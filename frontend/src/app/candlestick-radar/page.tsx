"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Flame,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  RefreshCw,
  SlidersHorizontal,
  ShieldAlert,
  Zap,
  CheckCircle2,
  ExternalLink,
  Target,
  BarChart3,
  Layers,
  Sparkles,
  Info,
  Table as TableIcon,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  ShieldCheck,
  TrendingUp,
  X,
  Crosshair,
  Percent,
  Sliders,
} from "lucide-react";
import Link from "next/link";
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
  fetchCandlesticks,
  fetchCandlestickSummary,
  CandlestickSignal,
  CandlestickMetadata,
  CandlestickSummaryResponse,
} from "@/lib/candlestickApi";

export default function CandlestickRadarPage() {
  const [signals, setSignals] = useState<CandlestickSignal[]>([]);
  const [metadata, setMetadata] = useState<CandlestickMetadata | null>(null);
  const [summary, setSummary] = useState<CandlestickSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // View Mode: Institutional Table (List) vs Cards (Grid)
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  // Selected Signal for Detailed Inspection Modal
  const [selectedSignal, setSelectedSignal] = useState<CandlestickSignal | null>(null);

  // Grouping & Volume Filters
  const [groupByStock, setGroupByStock] = useState<boolean>(true);
  const [minVolumeRatio, setMinVolumeRatio] = useState<number>(0);
  const [expandedStocks, setExpandedStocks] = useState<Record<string, boolean>>({});

  // Universe & Conviction Filters
  const [universe, setUniverse] = useState<string>("NIFTY_500");
  const [convictionTier, setConvictionTier] = useState<string>("ALL");

  // Filters & Sorting & Pagination
  const [directionFilter, setDirectionFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [minScore, setMinScore] = useState<number>(60);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("ai_conviction_score");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(25);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(1);

  const toggleExpandStock = (symbol: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedStocks((prev) => ({
      ...prev,
      [symbol]: !prev[symbol],
    }));
  };

  const loadData = useCallback(async (force = false) => {
    try {
      if (force) setIsRefreshing(true);
      else setIsLoading(true);
      setError(null);

      const [candlestickData, summaryData] = await Promise.all([
        fetchCandlesticks({
          universe: universe,
          group_by_stock: groupByStock,
          conviction_tier: convictionTier,
          direction: directionFilter,
          category: categoryFilter,
          min_score: minScore,
          min_volume_ratio: minVolumeRatio > 0 ? minVolumeRatio : undefined,
          search: searchQuery,
          sort_by: sortBy,
          sort_order: sortOrder,
          page: page,
          limit: limit,
          force_refresh: force,
        }),
        fetchCandlestickSummary(universe),
      ]);

      setSignals(candlestickData.signals || []);
      setTotalCount(candlestickData.total_count || 0);
      setTotalPages(candlestickData.total_pages || 1);
      setMetadata(candlestickData.metadata || null);
      setSummary(summaryData || null);
    } catch (err: any) {
      console.error("Error loading candlestick radar:", err);
      setError(err?.message || "Failed to load candlestick patterns");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [universe, groupByStock, minVolumeRatio, convictionTier, directionFilter, categoryFilter, minScore, searchQuery, sortBy, sortOrder, page, limit]);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  // Handle header sorting click
  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
    setPage(1);
  };

  // Derived filter counts for tab badges
  const bullCount = useMemo(() => summary?.direction_breakdown?.bullish ?? 0, [summary]);
  const bearCount = useMemo(() => summary?.direction_breakdown?.bearish ?? 0, [summary]);

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* â”€â”€ HEADER â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <PageHeader
          eyebrow={
            <>
              <Flame className="w-4 h-4 text-amber-400 animate-pulse" />
              <span>Institutional Candlestick Pattern Radar â€¢ Strike &amp; TradingSim Engine</span>
            </>
          }
          icon={<Flame className="w-5 h-5" />}
          iconColor="cyan"
          title="Algorithmic Candlestick Screener"
          badge={{ label: "20 TRIPLE & DOUBLE SETUPS", color: "cyan" }}
          subtitle="Mathematical pattern recognition scanning Morning Stars, Three White Soldiers, Engulfing bars, and Island reversals with volume expansion, 90D trend sparklines, and DMA defense filters."
          actions={
            <>
              <ActionButton
                variant="secondary"
                onClick={() => loadData(true)}
                disabled={isRefreshing}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-cyan-400" : ""}`} />
                {isRefreshing ? "Scanning..." : "Rescan Universe"}
              </ActionButton>
              <Link
                href="/chart-patterns"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 text-xs font-semibold transition border border-cyan-500/40"
              >
                <Layers className="w-3.5 h-3.5" />
                Base Patterns
              </Link>
            </>
          }
        />

        {/* â”€â”€ UNIVERSE & CONVICTION CONTROLS RIBBON â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3 rounded-2xl bg-white dark:bg-[#07111F]/90 border border-slate-200 dark:border-slate-800 shadow-sm">
          {/* Universe Segment Tabs */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5 pl-1">
              <Target className="w-3.5 h-3.5 text-cyan-500" />
              <span>Universe:</span>
            </span>
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setUniverse("NIFTY_500");
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  universe === "NIFTY_500"
                    ? "bg-cyan-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <span>Nifty 500</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded ${
                  universe === "NIFTY_500" ? "bg-cyan-900/60 text-cyan-200" : "bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                }`}>
                  500 Stocks
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setUniverse("NIFTY_50");
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  universe === "NIFTY_50"
                    ? "bg-cyan-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <span>Nifty 50</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded ${
                  universe === "NIFTY_50" ? "bg-cyan-900/60 text-cyan-200" : "bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                }`}>
                  Large Cap
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setUniverse("FNO");
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  universe === "FNO"
                    ? "bg-cyan-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <span>F&O Universe</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded ${
                  universe === "FNO" ? "bg-cyan-900/60 text-cyan-200" : "bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                }`}>
                  180 Liquid
                </span>
              </button>
            </div>
          </div>

          {/* Group By Stock (1 Row / Stock) Toggle */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>Grouping:</span>
            </span>
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setGroupByStock(true);
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  groupByStock
                    ? "bg-cyan-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
                title="Consolidate all patterns for each stock into 1 single row with multi-pattern synergy badge"
              >
                <Layers className="w-3 h-3" />
                <span>1 Row / Stock</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                  groupByStock ? "bg-cyan-900/80 text-cyan-200" : "bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                }`}>
                  {summary?.total_unique_stocks ?? metadata?.total_unique_stocks ?? 383}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setGroupByStock(false);
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                  !groupByStock
                    ? "bg-cyan-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
                title="Show every detected pattern formation as an individual row"
              >
                <span>All Signals</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                  !groupByStock ? "bg-cyan-900/80 text-cyan-200" : "bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                }`}>
                  {metadata?.total_signals ?? summary?.metadata?.total_signals ?? 620}
                </span>
              </button>
            </div>
          </div>

          {/* Conviction Tier Selector */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Conviction:</span>
            </span>
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setConvictionTier("ALL");
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition cursor-pointer ${
                  convictionTier === "ALL"
                    ? "bg-slate-300 dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => {
                  setConvictionTier("ELITE");
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1 transition cursor-pointer ${
                  convictionTier === "ELITE"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300"
                }`}
              >
                <Zap className="w-3 h-3" />
                <span>Elite (90+)</span>
                <span className="text-[10px] px-1 rounded bg-emerald-950/80 text-emerald-200 border border-emerald-700/50">
                  {summary?.conviction_breakdown?.elite ?? metadata?.elite_signals ?? 0}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setConvictionTier("HIGH");
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1 transition cursor-pointer ${
                  convictionTier === "HIGH"
                    ? "bg-cyan-600 text-white shadow-xs"
                    : "text-cyan-700 dark:text-cyan-400 hover:text-cyan-800 dark:hover:text-cyan-300"
                }`}
              >
                <CheckCircle2 className="w-3 h-3" />
                <span>High (80+)</span>
                <span className="text-[10px] px-1 rounded bg-cyan-950/80 text-cyan-200 border border-cyan-700/50">
                  {summary?.conviction_breakdown?.high ?? metadata?.high_conviction_signals ?? 0}
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setConvictionTier("MODERATE");
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition cursor-pointer ${
                  convictionTier === "MODERATE"
                    ? "bg-amber-600 text-white shadow-xs"
                    : "text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300"
                }`}
              >
                <span>Mod (65+)</span>
              </button>
            </div>
          </div>
        </div>

        {/* â”€â”€ METRIC TILES â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard
            label="Total Formations"
            value={metadata?.total_signals ?? totalCount}
            sub={`${metadata?.universe_name || universe.replace("_", " ")} (${metadata?.universe_scanned ?? 500} Eq)`}
          />
          <KpiCard
            label="Multi-Pattern Stocks"
            value={summary?.multi_pattern_stocks ?? 179}
            sub="â‰¥2 Pattern Confluence"
            color="cyan"
            icon={<Sparkles className="w-3.5 h-3.5" />}
          />
          <KpiCard
            label="Heavy Vol Surges"
            value={summary?.volume_breakdown?.explosive_2x ?? 0}
            sub="â‰¥2.0x Institutional Vol"
            color="amber"
            icon={<Flame className="w-3.5 h-3.5" />}
          />
          <KpiCard
            label="Elite Setups (90+)"
            value={summary?.conviction_breakdown?.elite ?? metadata?.elite_signals ?? 0}
            sub="Ultra Sniper"
            color="emerald"
            icon={<Zap className="w-3.5 h-3.5" />}
          />
          <KpiCard
            label="Bullish Setups"
            value={bullCount}
            sub="Accumulation Bias"
            color="emerald"
            icon={<ArrowUpRight className="w-3.5 h-3.5" />}
          />
          <KpiCard
            label="Bearish Setups"
            value={bearCount}
            sub="Distribution / Stop"
            color="rose"
            icon={<ArrowDownRight className="w-3.5 h-3.5" />}
          />
        </div>

        {/* â”€â”€ FILTER & TOOLBAR RIBBON â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 shadow-xs">
          {/* Direction Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-lg border border-slate-200 dark:border-slate-800/80">
            <button
              onClick={() => {
                setDirectionFilter("ALL");
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer ${
                directionFilter === "ALL"
                  ? "bg-cyan-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              All Signals ({metadata?.total_signals ?? totalCount})
            </button>
            <button
              onClick={() => {
                setDirectionFilter("BULLISH");
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition cursor-pointer ${
                directionFilter === "BULLISH"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400"
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5" /> Bullish ({bullCount})
            </button>
            <button
              onClick={() => {
                setDirectionFilter("BEARISH");
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition cursor-pointer ${
                directionFilter === "BEARISH"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
              }`}
            >
              <ArrowDownRight className="w-3.5 h-3.5" /> Bearish ({bearCount})
            </button>
          </div>

          {/* Category, Vol Surge, Score, Search & View Mode Switcher */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Volume Surge Weightage Dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 dark:text-slate-400 text-xs font-mono flex items-center gap-1">
                <Flame className="w-3 h-3 text-amber-500" />
                <span>Vol:</span>
              </span>
              <select
                value={minVolumeRatio}
                onChange={(e) => {
                  setMinVolumeRatio(Number(e.target.value));
                  setPage(1);
                }}
                className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-xs rounded-lg px-2.5 py-1.5 font-mono focus:outline-none focus:border-cyan-500 cursor-pointer shadow-2xs"
                title="Filter by Institutional Volume Confirmation"
              >
                <option value={0}>All Volume</option>
                <option value={1.2}>â‰¥1.2x (Above Avg)</option>
                <option value={1.5}>âš¡ â‰¥1.5x (Institutional)</option>
                <option value={2.0}>ðŸ”¥ â‰¥2.0x (Heavy Surge)</option>
                <option value={2.5}>ðŸ’¥ â‰¥2.5x (Ultra Climax)</option>
              </select>
            </div>

            {/* Category Dropdown */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 dark:text-slate-400 text-xs font-mono">Category:</span>
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPage(1);
                }}
                className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-xs rounded-lg px-2.5 py-1.5 font-mono focus:outline-none focus:border-cyan-500 cursor-pointer shadow-2xs"
              >
                <option value="ALL">All Categories</option>
                <option value="TRIPLE">Triple Candlestick (Strike.money)</option>
                <option value="DOUBLE">Double Candlestick (Engulfing)</option>
                <option value="SINGLE">Single Candlestick (Hammers)</option>
              </select>
            </div>

            {/* Min Conviction Score */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 dark:text-slate-400 text-xs font-mono">Min Score:</span>
              <select
                value={minScore}
                onChange={(e) => {
                  setMinScore(Number(e.target.value));
                  setPage(1);
                }}
                className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-xs rounded-lg px-2.5 py-1.5 font-mono focus:outline-none focus:border-cyan-500 cursor-pointer shadow-2xs"
              >
                <option value={50}>50+ (All Scored)</option>
                <option value={60}>60+ (Confirmed Base)</option>
                <option value={70}>70+ (High Probability)</option>
                <option value={80}>80+ (Elite Institutional)</option>
                <option value={90}>90+ (Ultra Sniper)</option>
              </select>
            </div>

            {/* Search Box */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search symbol, pattern, sector..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-200 text-xs rounded-lg pl-8 pr-3 py-1.5 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-44 md:w-56 font-mono shadow-2xs"
              >
              </input>
            </div>

            {/* View Mode Switcher (Table View vs Cards View) */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-lg border border-slate-300 dark:border-slate-800 self-end md:self-auto shadow-2xs">
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-bold transition-all cursor-pointer ${
                  viewMode === "table"
                    ? "bg-cyan-500/20 text-cyan-800 dark:text-cyan-300 border border-cyan-500/40 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
                title="Switch to Institutional List / Table View"
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>Table View</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("cards")}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-bold transition-all cursor-pointer ${
                  viewMode === "cards"
                    ? "bg-cyan-500/20 text-cyan-800 dark:text-cyan-300 border border-cyan-500/40 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
                title="Switch to Card Grid View"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Cards View</span>
              </button>
            </div>
          </div>
        </div>

        {/* â”€â”€ LOADING / ERROR STATE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {isLoading && (
          <div className="py-24 text-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-12">
            <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-3" />
            <p className="text-slate-800 dark:text-slate-200 font-mono text-sm">Evaluating Candlestick Formations across universe...</p>
            <p className="text-slate-500 text-xs mt-1">Analyzing body/shadow ratios, volume expansions, 90-day trends, and DMA defenses.</p>
          </div>
        )}

        {error && !isLoading && (
          <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            <span>Error loading candlestick radar: {error}</span>
          </div>
        )}

        {/* â”€â”€ EMPTY STATE â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {!isLoading && signals.length === 0 && !error && (
          <EmptyState
            icon={<Info className="w-8 h-8 text-amber-400" />}
            title="No Matching Candlestick Patterns Found"
            description="Try switching the direction filter to 'All Signals', lowering the minimum conviction score, or changing the category filter."
            action={
              <button
                onClick={() => {
                  setDirectionFilter("ALL");
                  setCategoryFilter("ALL");
                  setMinScore(50);
                  setSearchQuery("");
                  setPage(1);
                }}
                className="mt-2 px-4 py-2 rounded-xl bg-cyan-950 text-cyan-300 border border-cyan-700/50 text-xs font-mono font-bold hover:bg-cyan-900 cursor-pointer"
              >
                Reset Filters to View All Signals
              </button>
            }
          />
        )}

        {/* â”€â”€ INSTITUTIONAL TABLE (LIST) VIEW â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {!isLoading && signals.length > 0 && viewMode === "table" && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#07111F]/90 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-100 dark:bg-slate-950/90 text-[10px] uppercase font-bold tracking-wider text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 select-none">
                  <tr>
                    <th
                      className="py-3 px-4 cursor-pointer hover:text-cyan-400 transition"
                      onClick={() => handleSort("symbol")}
                    >
                      <div className="flex items-center gap-1">
                        <span>Symbol & Company</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-500" />
                      </div>
                    </th>
                    <th
                      className="py-3 px-3 cursor-pointer hover:text-cyan-400 transition"
                      onClick={() => handleSort("cmp")}
                    >
                      <div className="flex items-center gap-1">
                        <span>CMP & Day %</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-500" />
                      </div>
                    </th>
                    <th className="py-3 px-3 text-center">Trend (90D)</th>
                    <th className="py-3 px-3 text-center">Stage</th>
                    <th className="py-3 px-3">Candlestick Pattern & Bias</th>
                    <th
                      className="py-3 px-3 cursor-pointer hover:text-cyan-400 transition text-center"
                      onClick={() => handleSort("ai_conviction_score")}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>AI Score</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-500" />
                      </div>
                    </th>
                    <th
                      className="py-3 px-3 cursor-pointer hover:text-cyan-400 transition text-center"
                      onClick={() => handleSort("volume_surge_ratio")}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Vol Surge</span>
                        <ArrowUpDown className="w-3 h-3 text-slate-500" />
                      </div>
                    </th>
                    <th className="py-3 px-3 text-center">RSI & R:R</th>
                    <th className="py-3 px-3">DMA Confluence</th>
                    <th className="py-3 px-3">Execution Blueprint</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-slate-800 dark:text-slate-200">
                  {signals.map((sig, idx) => {
                    const isBullish = sig.direction === "BULLISH";
                    const dayChange = sig.day_change_pct ?? 0;
                    const isPositive = dayChange >= 0;
                    const cleanSymbol = sig.symbol.replace(/\.NS$|\.BO$/i, "").trim();
                    const isExpanded = !!expandedStocks[cleanSymbol];
                    const hasMultiplePatterns = (sig.patterns_count && sig.patterns_count > 1) || (sig.patterns && sig.patterns.length > 1);
                    const patternsCount = sig.patterns_count ?? sig.patterns?.length ?? 1;

                    return (
                      <React.Fragment key={`${sig.symbol}-${sig.pattern_key}-${idx}`}>
                        <tr
                          className={`hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-colors group cursor-pointer ${
                            isExpanded ? "bg-cyan-950/20 border-b border-cyan-800/40" : ""
                          }`}
                          onClick={() => setSelectedSignal(sig)}
                        >
                          {/* 1. Symbol, Watchlist & Company */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <div onClick={(e) => e.stopPropagation()}>
                                <AddToWatchlistButton
                                  symbol={cleanSymbol}
                                  companyName={sig.company_name}
                                  currentPrice={sig.cmp}
                                  sector={sig.sector}
                                  defaultConviction={sig.ai_conviction_score >= 80 ? 5 : 4}
                                  defaultThesis={`Candlestick Radar: ${sig.pattern_name} (${sig.direction}, ${sig.category}). Score: ${sig.ai_conviction_score}/100. Entry: â‚¹${sig.trigger_price}, SL: â‚¹${sig.stop_loss}, T1: â‚¹${sig.target_1}, T2: â‚¹${sig.target_2}`}
                                  variant="star"
                                />
                              </div>

                              <div className="flex flex-col min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <Link
                                    href={`/stocks/${encodeURIComponent(cleanSymbol)}?from=/candlestick-radar`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="font-bold text-sm text-slate-900 dark:text-white hover:text-cyan-500 dark:hover:text-cyan-400 hover:underline transition-colors"
                                    title={`View ${cleanSymbol} stock details`}
                                  >
                                    {cleanSymbol}
                                  </Link>
                                  <a
                                    href={`https://in.tradingview.com/chart/?symbol=NSE:${encodeURIComponent(cleanSymbol)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="text-slate-400 hover:text-cyan-400 transition"
                                    title={`Open ${cleanSymbol} on TradingView`}
                                  >
                                    <ExternalLink size={11} />
                                  </a>
                                </div>
                                <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[150px]">
                                  {sig.company_name || cleanSymbol}
                                </span>
                                <span className="text-[9px] text-slate-400 dark:text-slate-500">
                                  {sig.sector || "Diversified"}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* 2. CMP & Day % */}
                          <td className="py-3.5 px-3">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-900 dark:text-white text-sm">
                                â‚¹{sig.cmp.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                              <span
                                className={`text-[11px] font-bold ${
                                  isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                                }`}
                              >
                                {isPositive ? "+" : ""}
                                {dayChange.toFixed(2)}%
                              </span>
                            </div>
                          </td>

                          {/* 3. Trend (90D Sparkline) */}
                          <td className="py-3.5 px-3 text-center">
                            <div className="flex justify-center">
                              <SparklineChart
                                data={sig.sparkline}
                                cmp={sig.cmp}
                                return90d={sig.return_90d_pct}
                                width={82}
                                height={22}
                                periodLabel="90D"
                                showDot={true}
                                showBadge={true}
                              />
                            </div>
                          </td>

                          {/* 4. Current Stage Badge */}
                          <td className="py-3.5 px-3 text-center">
                            <div className="flex justify-center">
                              <StageBadge
                                stage={sig.current_stage}
                                stageCode={sig.stage_code}
                                cmp={sig.cmp}
                              />
                            </div>
                          </td>

                          {/* 5. Pattern & Bias */}
                          <td className="py-3.5 px-3">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1.5">
                                <Flame
                                  className={`w-3.5 h-3.5 ${
                                    isBullish
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : "text-rose-600 dark:text-rose-400"
                                  }`}
                                />
                                <span className="font-bold text-slate-900 dark:text-slate-100 text-xs">
                                  {sig.pattern_name}
                                </span>
                                {hasMultiplePatterns && (
                                  <button
                                    type="button"
                                    onClick={(e) => toggleExpandStock(cleanSymbol, e)}
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition cursor-pointer"
                                    title="Click to expand all patterns for this stock"
                                  >
                                    <Sparkles className="w-2.5 h-2.5 text-amber-500" />
                                    <span>+{patternsCount - 1} more</span>
                                    {isExpanded ? (
                                      <ChevronUp className="w-2.5 h-2.5" />
                                    ) : (
                                      <ChevronDown className="w-2.5 h-2.5" />
                                    )}
                                  </button>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span
                                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                                    isBullish
                                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                                      : "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30"
                                  }`}
                                >
                                  {sig.direction}
                                </span>
                                <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-cyan-700 dark:text-cyan-300">
                                  {sig.category}
                                </span>
                                <span className="text-[9px] text-slate-400 truncate max-w-[90px]">
                                  {sig.trend_context.replace(/_/g, " ")}
                                </span>
                              </div>
                              {/* Quick chips of other active patterns */}
                              {hasMultiplePatterns && sig.all_pattern_names && sig.all_pattern_names.length > 1 && (
                                <div className="flex flex-wrap gap-1 mt-0.5">
                                  {sig.all_pattern_names.slice(1, 3).map((patName, pIdx) => (
                                    <span
                                      key={pIdx}
                                      className="text-[8px] px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 truncate max-w-[120px]"
                                    >
                                      {patName}
                                    </span>
                                  ))}
                                  {sig.all_pattern_names.length > 3 && (
                                    <span className="text-[8px] text-slate-400 font-mono">
                                      +{sig.all_pattern_names.length - 3}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>

                          {/* 6. AI Conviction Score & Tier */}
                          <td className="py-3.5 px-3 text-center">
                            <div className="inline-flex flex-col items-center">
                              <div className="flex items-center gap-1">
                                <span
                                  className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                                    (sig.conviction_tier === "ELITE" || sig.ai_conviction_score >= 90)
                                      ? "bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-500/50 shadow-xs"
                                      : (sig.conviction_tier === "HIGH" || sig.ai_conviction_score >= 80)
                                      ? "bg-cyan-500/15 text-cyan-800 dark:text-cyan-300 border-cyan-500/40"
                                      : "bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-500/40"
                                  }`}
                                >
                                  {sig.ai_conviction_score} PTS
                                </span>
                                <span
                                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                    (sig.conviction_tier === "ELITE" || sig.ai_conviction_score >= 90)
                                      ? "bg-emerald-950 text-emerald-300 border border-emerald-700/60"
                                      : (sig.conviction_tier === "HIGH" || sig.ai_conviction_score >= 80)
                                      ? "bg-cyan-950 text-cyan-300 border border-cyan-700/60"
                                      : "bg-slate-900 text-slate-400 border border-slate-800"
                                  }`}
                                >
                                  {sig.conviction_tier || (sig.ai_conviction_score >= 90 ? "ELITE" : sig.ai_conviction_score >= 80 ? "HIGH" : "MODERATE")}
                                </span>
                              </div>
                              {/* Multi-pattern synergy bonus badge */}
                              {sig.multi_pattern_confluence && (
                                <span className="text-[8px] font-bold px-1.5 py-0.2 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-700/50 mt-1 flex items-center gap-0.5">
                                  <Sparkles className="w-2 h-2 text-cyan-400" />
                                  +{sig.confluence_bonus || 5} Synergy
                                </span>
                              )}
                              {/* Conviction rationale tags */}
                              {sig.conviction_reasons && sig.conviction_reasons.length > 0 && (
                                <div className="flex flex-wrap justify-center gap-1 mt-1 max-w-[150px]">
                                  {sig.conviction_reasons.slice(0, 2).map((reason, rIdx) => (
                                    <span
                                      key={rIdx}
                                      className="text-[8px] px-1 py-0.2 rounded bg-slate-100 dark:bg-slate-950 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 truncate"
                                      title={reason}
                                    >
                                      {reason}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>

                          {/* 7. Volume Surge Ratio */}
                          <td className="py-3.5 px-3 text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              <span
                                className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] flex items-center gap-1 ${
                                  sig.volume_surge_ratio >= 2.5
                                    ? "bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/50 shadow-xs"
                                    : sig.volume_surge_ratio >= 2.0
                                    ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/50 shadow-xs"
                                    : sig.volume_surge_ratio >= 1.5
                                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                                    : sig.volume_surge_ratio >= 1.2
                                    ? "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-500/20"
                                    : "text-slate-600 dark:text-slate-400"
                                }`}
                              >
                                {sig.volume_surge_ratio >= 2.0 ? (
                                  <Flame className="w-3 h-3 text-amber-400 animate-pulse" />
                                ) : sig.volume_surge_ratio >= 1.5 ? (
                                  <Zap className="w-3 h-3 text-emerald-400" />
                                ) : null}
                                <span>{sig.volume_surge_ratio}x MA20</span>
                              </span>
                              <span className="text-[8px] font-mono uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                {sig.volume_confirmation_level?.replace(/_/g, " ") || (sig.volume_surge_ratio >= 2.0 ? "Heavy Vol" : sig.volume_surge_ratio >= 1.5 ? "Surge" : "Normal")}
                              </span>
                            </div>
                          </td>

                          {/* 8. RSI 14 & R:R */}
                          <td className="py-3.5 px-3 text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              <span
                                className={`text-[10px] font-bold ${
                                  sig.rsi_14 <= 45
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : sig.rsi_14 >= 70
                                    ? "text-rose-600 dark:text-rose-400"
                                    : "text-slate-700 dark:text-slate-300"
                                }`}
                              >
                                RSI: {sig.rsi_14}
                              </span>
                              <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300">
                                {sig.risk_reward}:1 RR
                              </span>
                            </div>
                          </td>

                          {/* 9. DMA Confluence */}
                          <td className="py-3.5 px-3">
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300">
                              {sig.dma_confluence.replace(/_/g, " ")}
                            </span>
                          </td>

                          {/* 10. Execution Blueprint */}
                          <td className="py-3.5 px-3">
                            <div className="flex flex-col text-[10px] leading-tight space-y-0.5">
                              <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                                <span className="text-slate-400">Trig:</span>
                                <span className="font-bold text-slate-900 dark:text-white">
                                  â‚¹{sig.trigger_price.toFixed(2)}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 text-rose-600 dark:text-rose-400">
                                <span className="text-slate-400">SL:</span>
                                <span className="font-bold">
                                  â‚¹{sig.stop_loss.toFixed(2)}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                                <span className="text-slate-400">T1:</span>
                                <span className="font-bold">
                                  â‚¹{sig.target_1.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* 11. Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                              {hasMultiplePatterns && (
                                <button
                                  type="button"
                                  onClick={(e) => toggleExpandStock(cleanSymbol, e)}
                                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold border transition shadow-2xs cursor-pointer ${
                                    isExpanded
                                      ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40"
                                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:text-white"
                                  }`}
                                  title="Expand all setups for this stock"
                                >
                                  <span>{patternsCount} Setups</span>
                                  {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                </button>
                              )}
                              <Link
                                href={`/stocks/${encodeURIComponent(cleanSymbol)}?from=/candlestick-radar`}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-700 dark:text-cyan-400 border border-cyan-500/30 transition shadow-2xs"
                                title={`View ${cleanSymbol} Full Chart & DMA`}
                              >
                                <span>Chart</span>
                                <ChevronRight className="w-3 h-3" />
                              </Link>
                            </div>
                          </td>
                        </tr>

                        {/* Accordion Sub-Row for Multiple Patterns on Same Stock */}
                        {isExpanded && sig.patterns && sig.patterns.length > 0 && (
                          <tr className="bg-slate-100/70 dark:bg-slate-950/90 border-b border-cyan-500/30">
                            <td colSpan={11} className="py-3 px-6">
                              <div className="rounded-xl border border-cyan-500/40 bg-white/95 dark:bg-[#071322] p-3.5 shadow-lg space-y-2.5">
                                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                                  <div className="flex items-center gap-2">
                                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                                    <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                                      All Formations Detected on {cleanSymbol} ({sig.patterns.length} Patterns)
                                    </span>
                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 font-mono font-bold">
                                      Cluster Confluence +{sig.confluence_bonus || 5} pts
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={(e) => toggleExpandStock(cleanSymbol, e)}
                                    className="text-[11px] text-slate-400 hover:text-slate-200 font-mono flex items-center gap-1 cursor-pointer"
                                  >
                                    <span>Collapse List</span>
                                    <ChevronUp className="w-3 h-3" />
                                  </button>
                                </div>

                                <div className="overflow-x-auto">
                                  <table className="w-full text-left text-xs font-mono">
                                    <thead className="text-[9px] uppercase text-slate-500 border-b border-slate-200 dark:border-slate-800/80">
                                      <tr>
                                        <th className="py-2 px-2">#</th>
                                        <th className="py-2 px-2">Pattern Formation</th>
                                        <th className="py-2 px-2">Category</th>
                                        <th className="py-2 px-2">Bias</th>
                                        <th className="py-2 px-2 text-center">AI Score</th>
                                        <th className="py-2 px-2 text-center">Vol Surge</th>
                                        <th className="py-2 px-2 text-center">RSI</th>
                                        <th className="py-2 px-2 text-right">Trigger Level</th>
                                        <th className="py-2 px-2 text-right">Stop Loss</th>
                                        <th className="py-2 px-2 text-right">Target 1</th>
                                        <th className="py-2 px-2 text-center">Action</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                                      {sig.patterns.map((subSig, pIdx) => {
                                        const isSubBullish = subSig.direction === "BULLISH";
                                        return (
                                          <tr
                                            key={pIdx}
                                            className="hover:bg-cyan-500/5 transition cursor-pointer"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setSelectedSignal(subSig);
                                            }}
                                          >
                                            <td className="py-2 px-2 text-slate-400 text-[10px]">{pIdx + 1}</td>
                                            <td className="py-2 px-2 font-bold text-slate-900 dark:text-white">
                                              <div className="flex items-center gap-1.5">
                                                <Flame className={`w-3 h-3 ${isSubBullish ? "text-emerald-500" : "text-rose-500"}`} />
                                                <span>{subSig.pattern_name}</span>
                                                {pIdx === 0 && (
                                                  <span className="text-[8px] px-1 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-mono">
                                                    PRIMARY
                                                  </span>
                                                )}
                                              </div>
                                            </td>
                                            <td className="py-2 px-2 text-cyan-600 dark:text-cyan-400 text-[10px]">
                                              {subSig.category}
                                            </td>
                                            <td className="py-2 px-2">
                                              <span
                                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                                                  isSubBullish
                                                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                                                    : "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30"
                                                }`}
                                              >
                                                {subSig.direction}
                                              </span>
                                            </td>
                                            <td className="py-2 px-2 text-center">
                                              <span
                                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                                  subSig.ai_conviction_score >= 80
                                                    ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                                                    : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                                                }`}
                                              >
                                                {subSig.ai_conviction_score}
                                              </span>
                                            </td>
                                            <td className="py-2 px-2 text-center">
                                              <span className={`text-[10px] font-bold ${subSig.volume_surge_ratio >= 1.5 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}`}>
                                                {subSig.volume_surge_ratio}x
                                              </span>
                                            </td>
                                            <td className="py-2 px-2 text-center text-[10px] text-slate-400">
                                              {subSig.rsi_14}
                                            </td>
                                            <td className="py-2 px-2 text-right font-bold text-slate-900 dark:text-white">
                                              â‚¹{subSig.trigger_price.toFixed(2)}
                                            </td>
                                            <td className="py-2 px-2 text-right text-rose-600 dark:text-rose-400 font-bold">
                                              â‚¹{subSig.stop_loss.toFixed(2)}
                                            </td>
                                            <td className="py-2 px-2 text-right text-emerald-600 dark:text-emerald-400 font-bold">
                                              â‚¹{subSig.target_1.toFixed(2)}
                                            </td>
                                            <td className="py-2 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                                              <button
                                                type="button"
                                                onClick={() => setSelectedSignal(subSig)}
                                                className="px-2 py-0.5 rounded bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 text-[10px] font-bold border border-cyan-500/30 transition cursor-pointer"
                                              >
                                                Blueprint
                                              </button>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Ribbon */}
            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-950/80 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono text-slate-500 dark:text-slate-400">
              <div>
                Showing <span className="font-bold text-slate-900 dark:text-white">{(page - 1) * limit + 1}</span> to{" "}
                <span className="font-bold text-slate-900 dark:text-white">{Math.min(page * limit, totalCount)}</span> of{" "}
                <span className="font-bold text-slate-900 dark:text-white">{totalCount}</span> candlestick setups
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 mr-2">
                  <span>Rows:</span>
                  <select
                    value={limit}
                    onChange={(e) => {
                      setLimit(Number(e.target.value));
                      setPage(1);
                    }}
                    className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs rounded px-1.5 py-0.5 cursor-pointer font-mono"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span>
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* â”€â”€ CARDS (GRID) VIEW â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {!isLoading && signals.length > 0 && viewMode === "cards" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {signals.map((sig, idx) => {
                const isBullish = sig.direction === "BULLISH";
                const borderGlow = isBullish ? "hover:border-emerald-500/50" : "hover:border-rose-500/50";
                const badgeBg = isBullish
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                  : "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30";
                const cleanSymbol = sig.symbol.replace(/\.NS$|\.BO$/i, "").trim();
                const dayChange = sig.day_change_pct ?? 0;
                const isPositive = dayChange >= 0;

                return (
                  <div
                    key={`${sig.symbol}-${sig.pattern_key}-${idx}`}
                    className={`bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl p-4 transition-all duration-200 ${borderGlow} flex flex-col justify-between shadow-xs hover:shadow-md cursor-pointer`}
                    onClick={() => setSelectedSignal(sig)}
                  >
                    <div>
                      {/* Top Bar: Symbol, Watchlist, Price, Category */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2">
                          <div onClick={(e) => e.stopPropagation()}>
                            <AddToWatchlistButton
                              symbol={cleanSymbol}
                              companyName={sig.company_name}
                              currentPrice={sig.cmp}
                              sector={sig.sector}
                              defaultConviction={sig.ai_conviction_score >= 80 ? 5 : 4}
                              defaultThesis={`Candlestick Radar: ${sig.pattern_name} (${sig.direction}, ${sig.category}). Score: ${sig.ai_conviction_score}/100.`}
                              variant="star"
                            />
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <Link
                                href={`/stocks/${encodeURIComponent(cleanSymbol)}?from=/candlestick-radar`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-base font-bold text-slate-900 dark:text-white font-mono hover:text-cyan-400 hover:underline transition"
                              >
                                {cleanSymbol}
                              </Link>
                              <a
                                href={`https://in.tradingview.com/chart/?symbol=NSE:${encodeURIComponent(cleanSymbol)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="text-slate-400 hover:text-cyan-400 transition"
                              >
                                <ExternalLink size={10} />
                              </a>
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[160px]">
                              {sig.company_name || cleanSymbol}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-slate-900 dark:text-white font-mono">
                              â‚¹{sig.cmp.toFixed(2)}
                            </span>
                            <span
                              className={`text-[10px] font-mono font-bold ${
                                isPositive ? "text-emerald-500" : "text-rose-500"
                              }`}
                            >
                              {isPositive ? "+" : ""}
                              {dayChange.toFixed(2)}%
                            </span>
                          </div>
                          <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border font-semibold ${badgeBg}`}>
                            {sig.direction} â€¢ {sig.category}
                          </span>
                        </div>
                      </div>

                      {/* Multi-Pattern Cluster Banner in Cards */}
                      {((sig.patterns_count && sig.patterns_count > 1) || (sig.patterns && sig.patterns.length > 1)) && (
                        <div className="flex items-center justify-between px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-[10px] font-mono font-bold mb-2.5">
                          <span className="flex items-center gap-1.5">
                            <Sparkles className="w-3 h-3 text-amber-500" />
                            <span>{sig.patterns_count || sig.patterns?.length} Patterns Confluence</span>
                          </span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-950/80 text-amber-200 border border-amber-700/50">
                            +{sig.confluence_bonus || 5} Synergy
                          </span>
                        </div>
                      )}

                      {/* Sparkline & Current Stage Sub-bar */}
                      <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-950/50 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800/60 mb-3 shadow-2xs">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 font-mono">Trend:</span>
                          <SparklineChart
                            data={sig.sparkline}
                            cmp={sig.cmp}
                            return90d={sig.return_90d_pct}
                            width={82}
                            height={20}
                            periodLabel="90D"
                            showDot={true}
                            showBadge={true}
                          />
                        </div>
                        <StageBadge
                          stage={sig.current_stage}
                          stageCode={sig.stage_code}
                          cmp={sig.cmp}
                        />
                      </div>

                      {/* Pattern Header */}
                      <div className="bg-slate-50 dark:bg-slate-950/70 p-3 rounded-lg border border-slate-200 dark:border-slate-800/80 mb-3 shadow-2xs">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5">
                            <Flame
                              className={`w-3.5 h-3.5 ${
                                isBullish
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-rose-600 dark:text-rose-400"
                              }`}
                            />
                            <span className="text-sm font-semibold text-slate-900 dark:text-white">
                              {sig.pattern_name}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">Score:</span>
                            <span
                              className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${
                                sig.ai_conviction_score >= 90
                                  ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40"
                                  : sig.ai_conviction_score >= 80
                                  ? "text-cyan-700 dark:text-cyan-400"
                                  : "text-amber-600 dark:text-amber-400"
                              }`}
                            >
                              {sig.ai_conviction_score}/100
                            </span>
                            <span className="text-[9px] font-bold px-1 rounded bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 uppercase">
                              {sig.conviction_tier || (sig.ai_conviction_score >= 90 ? "ELITE" : sig.ai_conviction_score >= 80 ? "HIGH" : "MODERATE")}
                            </span>
                          </div>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 text-xs line-clamp-2 leading-relaxed mb-2">
                          {sig.description}
                        </p>
                        {/* Other active patterns chips */}
                        {sig.all_pattern_names && sig.all_pattern_names.length > 1 && (
                          <div className="flex flex-wrap gap-1 mb-2 pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
                            {sig.all_pattern_names.slice(1, 4).map((pName, pIdx) => (
                              <span
                                key={pIdx}
                                className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25 font-mono"
                              >
                                + {pName}
                              </span>
                            ))}
                          </div>
                        )}
                        {/* Conviction rationale tags */}
                        {sig.conviction_reasons && sig.conviction_reasons.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
                            {sig.conviction_reasons.map((r, rIdx) => (
                              <span
                                key={rIdx}
                                className="text-[9px] px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 flex items-center gap-1"
                              >
                                <span className="w-1 h-1 rounded-full bg-cyan-400" />
                                {r}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Quantitative Signals: Volume, Confluence, RSI */}
                      <div className="grid grid-cols-3 gap-2 mb-3 text-[11px] font-mono">
                        <div className="bg-slate-50 dark:bg-slate-950/40 p-2 rounded border border-slate-200 dark:border-slate-800/60 shadow-2xs">
                          <span className="text-slate-500 text-[10px] block">Volume Surge</span>
                          <span
                            className={`font-semibold flex items-center gap-0.5 ${
                              sig.volume_surge_ratio >= 2.0
                                ? "text-amber-600 dark:text-amber-400 font-bold"
                                : sig.volume_surge_ratio >= 1.5
                                ? "text-emerald-600 dark:text-emerald-400 font-bold"
                                : "text-slate-700 dark:text-slate-300"
                            }`}
                          >
                            {sig.volume_surge_ratio >= 2.0 ? (
                              <Flame className="w-3 h-3 text-amber-400" />
                            ) : null}
                            <span>{sig.volume_surge_ratio}x MA20</span>
                          </span>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-950/40 p-2 rounded border border-slate-200 dark:border-slate-800/60 shadow-2xs">
                          <span className="text-slate-500 text-[10px] block">RSI 14</span>
                          <span
                            className={`font-semibold ${
                              sig.rsi_14 <= 55
                                ? "text-cyan-700 dark:text-cyan-400"
                                : "text-amber-600 dark:text-amber-400"
                            }`}
                          >
                            {sig.rsi_14}
                          </span>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-950/40 p-2 rounded border border-slate-200 dark:border-slate-800/60 shadow-2xs">
                          <span className="text-slate-500 text-[10px] block">R:R Ratio</span>
                          <span className="font-semibold text-indigo-700 dark:text-indigo-300">
                            {sig.risk_reward}:1
                          </span>
                        </div>
                      </div>

                      {/* DMA Confluence Tag */}
                      <div className="flex items-center justify-between text-[11px] font-mono px-2.5 py-1.5 rounded bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-900/40 text-cyan-800 dark:text-cyan-300 mb-3 shadow-2xs">
                        <span>DMA Confluence:</span>
                        <span className="font-semibold">{sig.dma_confluence.replace(/_/g, " ")}</span>
                      </div>

                      {/* Exact Rupee Execution Blueprint */}
                      <div className="bg-slate-50 dark:bg-slate-950/80 p-3 rounded-lg border border-slate-200 dark:border-slate-800/90 text-xs font-mono space-y-1.5 mb-3 shadow-2xs">
                        <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
                          <span className="text-slate-500">Trigger Level:</span>
                          <span className="font-semibold text-slate-900 dark:text-white">
                            â‚¹{sig.trigger_price.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-rose-600 dark:text-rose-300">
                          <span className="text-slate-500">Invalidation Stop:</span>
                          <span className="font-semibold text-rose-600 dark:text-rose-400">
                            â‚¹{sig.stop_loss.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-emerald-700 dark:text-emerald-300">
                          <span className="text-slate-500">Target 1 (Harvest):</span>
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            â‚¹{sig.target_1.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-cyan-700 dark:text-cyan-300">
                          <span className="text-slate-500">Target 2 (Runner):</span>
                          <span className="font-semibold text-cyan-600 dark:text-cyan-400">
                            â‚¹{sig.target_2.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer: Quick Actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800/80">
                      <span className="text-[10px] text-slate-500 font-mono">
                        Reliability:{" "}
                        <span className="text-slate-700 dark:text-slate-300 font-semibold">
                          {sig.reliability.replace("_", " ")}
                        </span>
                      </span>

                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <Link
                          href={`/stocks/${encodeURIComponent(cleanSymbol)}?from=/candlestick-radar`}
                          className="flex items-center gap-1 text-[11px] font-semibold text-cyan-700 dark:text-cyan-400 hover:text-cyan-600 dark:hover:text-cyan-300 transition"
                        >
                          <span>Chart &amp; DMA</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination Ribbon for Cards */}
            <div className="px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono text-slate-500 dark:text-slate-400">
              <div>
                Showing <span className="font-bold text-slate-900 dark:text-white">{(page - 1) * limit + 1}</span> to{" "}
                <span className="font-bold text-slate-900 dark:text-white">{Math.min(page * limit, totalCount)}</span> of{" "}
                <span className="font-bold text-slate-900 dark:text-white">{totalCount}</span> setups
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span>
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* â”€â”€ MODAL: DETAILED CANDLESTICK EXECUTION BLUEPRINT â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {selectedSignal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
            <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-200">
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setSelectedSignal(null)}
                className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Modal Header */}
              <div className="flex items-start justify-between pr-8">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                      {selectedSignal.symbol.replace(/\.NS$|\.BO$/i, "").trim()}
                    </span>
                    <span
                      className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full border ${
                        selectedSignal.direction === "BULLISH"
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                          : "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30"
                      }`}
                    >
                      {selectedSignal.direction} â€¢ {selectedSignal.category}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {selectedSignal.company_name} â€¢ {selectedSignal.sector || "Diversified"}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-lg font-bold font-mono text-slate-900 dark:text-white">
                    â‚¹{selectedSignal.cmp.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-xs font-mono text-cyan-600 dark:text-cyan-400">
                    AI Score: {selectedSignal.ai_conviction_score}/100
                  </div>
                </div>
              </div>

              {/* Trend & Stage Strip */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-mono">90D Trend:</span>
                  <SparklineChart
                    data={selectedSignal.sparkline}
                    cmp={selectedSignal.cmp}
                    return90d={selectedSignal.return_90d_pct}
                    width={110}
                    height={28}
                    periodLabel="90D"
                    showDot={true}
                    showBadge={true}
                  />
                </div>
                <StageBadge
                  stage={selectedSignal.current_stage}
                  stageCode={selectedSignal.stage_code}
                  cmp={selectedSignal.cmp}
                />
              </div>

              {/* Multi-Pattern Formations Cluster for this stock in Modal */}
              {selectedSignal.patterns && selectedSignal.patterns.length > 1 && (
                <div className="p-3.5 rounded-xl bg-amber-500/5 dark:bg-slate-950 border border-amber-500/30 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider">
                        All Patterns Detected on this Stock ({selectedSignal.patterns.length})
                      </span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 font-bold">
                      +{selectedSignal.confluence_bonus || 5} Synergy Bonus
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {selectedSignal.patterns.map((subPat, pIdx) => {
                      const isCurrent = subPat.pattern_key === selectedSignal.pattern_key;
                      return (
                        <div
                          key={pIdx}
                          onClick={() => setSelectedSignal(subPat)}
                          className={`p-2.5 rounded-lg border text-xs font-mono transition cursor-pointer ${
                            isCurrent
                              ? "bg-cyan-500/15 border-cyan-500/60 shadow-xs"
                              : "bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 hover:border-slate-700"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900 dark:text-white truncate max-w-[140px]">
                              {subPat.pattern_name}
                            </span>
                            <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400">
                              {subPat.ai_conviction_score} pts
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                            <span>{subPat.category}</span>
                            <span>â€¢</span>
                            <span className={subPat.direction === "BULLISH" ? "text-emerald-500 font-semibold" : "text-rose-500 font-semibold"}>
                              {subPat.direction}
                            </span>
                            <span>â€¢</span>
                            <span>{subPat.volume_surge_ratio}x Vol</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Pattern Info Card */}
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center gap-2">
                  <Flame
                    className={`w-4 h-4 ${
                      selectedSignal.direction === "BULLISH"
                        ? "text-emerald-500"
                        : "text-rose-500"
                    }`}
                  />
                  <span className="font-bold text-slate-900 dark:text-white text-sm">
                    {selectedSignal.pattern_name}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {selectedSignal.description}
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] font-mono">
                  <span className="text-slate-400">Confluence:</span>
                  <span className="font-semibold text-cyan-600 dark:text-cyan-400">
                    {selectedSignal.dma_confluence.replace(/_/g, " ")}
                  </span>
                  <span className="text-slate-600">â€¢</span>
                  <span className="text-slate-400">Trend Bias:</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {selectedSignal.trend_context.replace(/_/g, " ")}
                  </span>
                  <span className="text-slate-600">â€¢</span>
                  <span className="text-slate-400">Vol Weightage:</span>
                  <span className="font-semibold text-amber-500">
                    {selectedSignal.volume_surge_ratio}x ({selectedSignal.volume_confirmation_level?.replace(/_/g, " ") || "Normal"})
                  </span>
                </div>

                {/* Conviction Blueprint Rationale */}
                {selectedSignal.conviction_reasons && selectedSignal.conviction_reasons.length > 0 && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                    <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider block mb-1.5">
                      Institutional Conviction Drivers:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedSignal.conviction_reasons.map((reason, rIdx) => (
                        <span
                          key={rIdx}
                          className="px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
                          {reason}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Exact Blueprint Coordinates */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-center">
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-500 block uppercase">Trigger Entry</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">
                    â‚¹{selectedSignal.trigger_price.toFixed(2)}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40">
                  <span className="text-[10px] text-rose-600 dark:text-rose-400 block uppercase">Stop Loss</span>
                  <span className="text-sm font-bold text-rose-700 dark:text-rose-300">
                    â‚¹{selectedSignal.stop_loss.toFixed(2)}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40">
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block uppercase">Target 1</span>
                  <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                    â‚¹{selectedSignal.target_1.toFixed(2)}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-900/40">
                  <span className="text-[10px] text-cyan-600 dark:text-cyan-400 block uppercase">Target 2</span>
                  <span className="text-sm font-bold text-cyan-700 dark:text-cyan-300">
                    â‚¹{selectedSignal.target_2.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
                <a
                  href={`https://in.tradingview.com/chart/?symbol=NSE:${encodeURIComponent(
                    selectedSignal.symbol.replace(/\.NS$|\.BO$/i, "").trim()
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-cyan-400 transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open in TradingView Chart</span>
                </a>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedSignal(null)}
                    className="px-4 py-2 rounded-xl text-xs font-mono font-semibold text-slate-600 dark:text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                  >
                    Close
                  </button>
                  <Link
                    href={`/stocks/${encodeURIComponent(
                      selectedSignal.symbol.replace(/\.NS$|\.BO$/i, "").trim()
                    )}?from=/candlestick-radar`}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-mono font-bold bg-cyan-600 hover:bg-cyan-500 text-white transition shadow-sm cursor-pointer"
                  >
                    <span>Full Stock Analysis</span>
                    <ChevronRight className="w-3.5 h-3.5" />
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


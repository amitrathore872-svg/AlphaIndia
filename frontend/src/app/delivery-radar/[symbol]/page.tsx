"use client";

import React, { useEffect, useState, use, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import TradingViewChart from "@/components/common/TradingViewChart";
import {
  ArrowLeft,
  Layers,
  Activity,
  Zap,
  ShieldAlert,
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Search,
  Calendar,
  Table,
  BarChart3,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import {
  DeliveryTreeResponse,
  DeliveryDayNode,
  fetchDeliveryTreeBreakdown,
} from "@/lib/deliveryRadarApi";
import {
  fetchStockTechnicalOverview,
  searchStocks,
  type StockTechnicalOverview,
  type StockSearchResult,
} from "@/lib/stocksApi";
import AddToWatchlistButton from "@/components/watchlist/AddToWatchlistButton";
import BhavcopySyncControl from "@/components/delivery/BhavcopySyncControl";

interface PageProps {
  params: Promise<{ symbol: string }>;
}

export default function StockDeliveryRadarHistoryPage({ params }: PageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const rawSymbol = resolvedParams?.symbol || "WINDMACHIN";
  const symbol = decodeURIComponent(rawSymbol).trim().toUpperCase();

  // Data States
  const [treeData, setTreeData] = useState<DeliveryTreeResponse | null>(null);
  const [techOverview, setTechOverview] = useState<StockTechnicalOverview | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Controls & Filters
  const [lookbackSessions, setLookbackSessions] = useState<number>(30);
  const [expandedWeeks, setExpandedWeeks] = useState<Record<string, boolean>>({});
  const [dayFilter, setDayFilter] = useState<"ALL" | "GREEN" | "HIGH_DELIV" | "SPIKES">("ALL");
  const [viewMode, setViewMode] = useState<"tree" | "table">("tree");
  const [tableSortField, setTableSortField] = useState<string>("date");
  const [tableSortOrder, setTableSortOrder] = useState<"asc" | "desc">("desc");

  // Search Switcher
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<StockSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  // Fetch Delivery Tree Data
  const loadData = useMemo(() => {
    return () => {
      if (!symbol) return;
      setLoading(true);
      setError(null);

      // Fetch delivery tree breakdown
      fetchDeliveryTreeBreakdown(symbol, lookbackSessions)
        .then((res) => {
          setTreeData(res);
          // Expand first 2 weeks by default
          const initExpanded: Record<string, boolean> = {};
          res.weeks?.forEach((w, idx) => {
            initExpanded[w.week_key] = idx < 2;
          });
          setExpandedWeeks(initExpanded);
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Failed to load delivery radar tree.");
        })
        .finally(() => {
          setLoading(false);
        });

      // Supplementary technical overview
      fetchStockTechnicalOverview(symbol)
        .then((overview) => {
          setTechOverview(overview);
        })
        .catch(() => {
          // Non-blocking
        });
    };
  }, [symbol, lookbackSessions]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Search Input
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(() => {
      setIsSearching(true);
      searchStocks(searchQuery, 8)
        .then((res) => {
          setSearchResults(res);
          setShowSearchDropdown(true);
        })
        .finally(() => setIsSearching(false));
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const toggleWeek = (weekKey: string) => {
    setExpandedWeeks((prev) => ({
      ...prev,
      [weekKey]: !prev[weekKey],
    }));
  };

  const expandAll = () => {
    if (!treeData) return;
    const allExp: Record<string, boolean> = {};
    treeData.weeks.forEach((w) => {
      allExp[w.week_key] = true;
    });
    setExpandedWeeks(allExp);
  };

  const collapseAll = () => {
    setExpandedWeeks({});
  };

  const summary = treeData?.month_summary;

  // Flattened sessions for Table View (strictly sorted latest first)
  const allSessions = useMemo(() => {
    if (!treeData) return [];
    const list: (DeliveryDayNode & { weekLabel: string })[] = [];
    treeData.weeks.forEach((w) => {
      w.days.forEach((d) => {
        list.push({ ...d, weekLabel: w.week_label });
      });
    });
    // Ensure strict descending order (latest session first)
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [treeData]);

  const filteredSessions = useMemo(() => {
    if (dayFilter === "GREEN") {
      return allSessions.filter((d) => d.is_green);
    }
    if (dayFilter === "HIGH_DELIV") {
      return allSessions.filter((d) => d.delivery_per >= 55);
    }
    if (dayFilter === "SPIKES") {
      return allSessions.filter((d) => (d.delivery_spike_x || 0) >= 1.5);
    }
    return allSessions;
  }, [allSessions, dayFilter]);

  const sortedFilteredSessions = useMemo(() => {
    const list = [...filteredSessions];
    list.sort((a, b) => {
      let valA: any = (a as any)[tableSortField];
      let valB: any = (b as any)[tableSortField];
      if (tableSortField === "date") {
        return tableSortOrder === "asc" ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date);
      }
      valA = Number(valA || 0);
      valB = Number(valB || 0);
      return tableSortOrder === "asc" ? valA - valB : valB - valA;
    });
    return list;
  }, [filteredSessions, tableSortField, tableSortOrder]);

  const toggleSort = (field: string) => {
    if (tableSortField === field) {
      setTableSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setTableSortField(field);
      setTableSortOrder(field === "date" ? "desc" : "desc");
    }
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-[#03070E] text-slate-100 p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
        {/* TOP BREADCRUMB & SEARCH BAR */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
          <div className="flex items-center gap-3">
            <Link
              href="/delivery-radar"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/90 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-cyan-500/40 hover:text-cyan-400 transition shadow-xs"
            >
              <ArrowLeft size={14} />
              <span>Back to Delivery Radar</span>
            </Link>

            <span className="text-slate-600">/</span>

            <span className="text-xs font-mono font-semibold uppercase text-slate-400">
              Institutional Delivery & Drawdown History
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-start lg:justify-end">
            <BhavcopySyncControl
              onSyncCompleted={() => {
                loadData();
              }}
            />

            {/* QUICK SWITCHER SEARCH */}
            <div className="relative w-full sm:w-72">
              <div className="relative flex items-center">
                <Search className="absolute left-3 h-4 w-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search stock (e.g. BEL, TRENT)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setShowSearchDropdown(true)}
                  className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-900/90 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-hidden focus:border-cyan-500/50 transition font-mono"
                />
                {isSearching && (
                  <RefreshCw className="absolute right-3 h-3.5 w-3.5 animate-spin text-cyan-400" />
                )}
              </div>

              {showSearchDropdown && searchResults.length > 0 && (
                <div className="absolute z-50 mt-1 w-full rounded-xl border border-slate-700 bg-[#070e1b] shadow-2xl overflow-hidden max-h-64 overflow-y-auto">
                  {searchResults.map((item) => (
                    <button
                      key={item.symbol}
                      onClick={() => {
                        setShowSearchDropdown(false);
                        setSearchQuery("");
                        router.push(`/delivery-radar/${item.symbol}`);
                      }}
                      className="w-full px-3 py-2 text-left text-xs hover:bg-slate-800/80 flex items-center justify-between border-b border-slate-800/50 last:border-0 transition"
                    >
                      <div>
                        <div className="font-bold text-slate-200 font-mono">{item.symbol}</div>
                        <div className="text-[10px] text-slate-400 truncate max-w-[180px]">
                          {item.company_name}
                        </div>
                      </div>
                      {item.current_price && (
                        <div className="text-right font-mono">
                          <div className="text-slate-300">₹{item.current_price.toFixed(2)}</div>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* HERO TITLE & INSTITUTIONAL HEADER */}
        <div className="rounded-2xl border border-slate-800/80 bg-gradient-to-b from-[#091222] to-[#050B14] p-5 sm:p-6 shadow-xl relative overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  <Layers className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-mono">
                      {symbol}
                    </h1>
                    {summary?.blast_badge && (
                      <span className="rounded-md border border-cyan-500/40 bg-cyan-500/15 px-3 py-0.5 text-xs font-semibold text-cyan-300">
                        {summary.blast_badge}
                      </span>
                    )}
                    {techOverview?.sector && (
                      <span className="rounded-md border border-slate-700 bg-slate-800/80 px-2.5 py-0.5 text-[11px] text-slate-300">
                        {techOverview.sector}
                      </span>
                    )}
                  </div>
                  <p className="text-xs sm:text-sm text-slate-400">
                    {techOverview?.company_name || symbol} • Institutional 30-Day Delivery Accumulation & Drawdown History
                  </p>
                </div>
              </div>

              {summary?.blast_description && (
                <p className="text-xs text-slate-300/90 bg-slate-900/60 border border-slate-800 rounded-lg px-3 py-2 max-w-3xl leading-relaxed">
                  <span className="text-cyan-400 font-semibold">Institutional Radar Signature:</span>{" "}
                  {summary.blast_description}
                </p>
              )}
            </div>

            {/* CMP & QUICK ACTIONS */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 lg:self-center">
              {techOverview?.current_price && (
                <div className="text-left sm:text-right font-mono bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-slate-400">Last Traded Price</div>
                  <div className="text-xl sm:text-2xl font-bold text-white">
                    ₹{techOverview.current_price.toFixed(2)}
                  </div>
                  <div
                    className={`text-xs font-bold ${
                      (techOverview.day_change_pct || 0) >= 0 ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {(techOverview.day_change_pct || 0) >= 0 ? "+" : ""}
                    {techOverview.day_change_pct?.toFixed(2)}%
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <AddToWatchlistButton
                  symbol={symbol}
                  currentPrice={techOverview?.current_price || summary?.end_price}
                  companyName={techOverview?.company_name || symbol}
                />

                <Link
                  href={`/stocks/${symbol}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition shadow-xs"
                >
                  <BarChart3 size={13} />
                  <span>Stock Hub</span>
                </Link>

                <a
                  href={`https://in.tradingview.com/chart/?symbol=NSE:${encodeURIComponent(symbol)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-300 hover:bg-cyan-500 hover:text-slate-950 transition shadow-xs"
                >
                  <ExternalLink size={13} />
                  <span>TradingView</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* 6-METRIC TELEMETRY RIBBON */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-3.5 backdrop-blur-xs">
              <div className="text-[10px] font-semibold uppercase text-slate-400">30D Return</div>
              <div
                className={`text-lg font-bold font-mono mt-1 ${
                  summary.month_return_pct >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {summary.month_return_pct >= 0 ? "+" : ""}
                {summary.month_return_pct?.toFixed(2)}%
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">
                ₹{summary.start_price?.toFixed(1)} → ₹{summary.end_price?.toFixed(1)}
              </div>
            </div>

            <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-3.5 backdrop-blur-xs">
              <div className="text-[10px] font-semibold uppercase text-slate-400">Peak Drawdown</div>
              <div className="text-lg font-bold font-mono text-amber-400 mt-1">
                {summary.month_max_drawdown_pct?.toFixed(2)}%
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">
                Peak: ₹{summary.month_peak_price?.toFixed(1)}
              </div>
            </div>

            <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-3.5 backdrop-blur-xs">
              <div className="text-[10px] font-semibold uppercase text-slate-400">Pivot Distance</div>
              <div className="text-lg font-bold font-mono text-cyan-400 mt-1">
                {summary.current_drawdown_from_peak_pct?.toFixed(2)}%
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                {Math.abs(summary.current_drawdown_from_peak_pct) < 3.0 ? "At Resistance Pivot" : "Consolidating"}
              </div>
            </div>

            <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-3.5 backdrop-blur-xs">
              <div className="text-[10px] font-semibold uppercase text-slate-400">Demat Absorbed</div>
              <div className="text-lg font-bold font-mono text-white mt-1">
                ₹{summary.total_delivery_cr?.toFixed(2)} Cr
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                Avg Deliv: <span className="text-emerald-400">{summary.avg_delivery_per?.toFixed(1)}%</span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-3.5 backdrop-blur-xs">
              <div className="text-[10px] font-semibold uppercase text-slate-400">30D Flow Ratio</div>
              <div className="text-lg font-bold font-mono text-cyan-300 mt-1">
                {summary.delivery_flow_imbalance_ratio?.toFixed(2)}x
              </div>
              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                <span className="text-emerald-400">{summary.green_days_count} Green</span> vs{" "}
                <span className="text-rose-400">{summary.red_days_count} Red</span>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-3.5 backdrop-blur-xs">
              <div className="text-[10px] font-semibold uppercase text-slate-400">Base Squeeze</div>
              <div className="text-lg font-bold font-mono text-indigo-300 mt-1">
                {summary.range_squeeze_ratio?.toFixed(2)}x
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                {summary.range_squeeze_ratio <= 0.85 ? "Spring Coiling" : "Normal Volatility"}
              </div>
            </div>
          </div>
        )}

        {/* EMBEDDED TECHNICAL CANDLESTICK CHART */}
        <div className="rounded-2xl border border-slate-800/80 bg-[#070e1b] p-4 sm:p-5 shadow-xl">
          <div className="flex items-center justify-between mb-3 border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-cyan-400" />
              <span className="text-sm font-bold tracking-tight text-white font-mono">
                Daily Price & Volume Action (1-Year Chart)
              </span>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              Hover candlesticks to inspect volume and moving averages
            </span>
          </div>

          <div className="w-full">
            <TradingViewChart
              symbol={symbol}
              exchange="NSE"
              height={440}
              initialPeriod="1y"
            />
          </div>
        </div>

        {/* CONTROLS & LOOKBACK SELECTOR */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 rounded-xl border border-slate-800/80 bg-slate-900/70 p-3 sm:p-4 backdrop-blur-xs">
          {/* LOOKBACK SESSIONS */}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-cyan-400 shrink-0" />
            <span className="text-xs font-semibold text-slate-300">Lookback Horizon:</span>
            <div className="flex items-center rounded-lg border border-slate-800 bg-slate-950 p-0.5 text-xs font-mono">
              {[
                { sessions: 30, label: "30 Sessions (~1.5M)" },
                { sessions: 45, label: "45 Sessions (~2M)" },
                { sessions: 60, label: "60 Sessions (~3M)" },
              ].map(({ sessions, label }) => (
                <button
                  key={sessions}
                  onClick={() => setLookbackSessions(sessions)}
                  className={`rounded-md px-2.5 py-1 transition ${
                    lookbackSessions === sessions
                      ? "bg-cyan-500 text-slate-950 font-bold shadow-xs"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* VIEW SWITCHER & FILTERS */}
          <div className="flex flex-wrap items-center gap-3">
            {/* VIEW MODE TABS */}
            <div className="flex items-center rounded-lg border border-slate-800 bg-slate-950 p-0.5 text-xs font-mono">
              <button
                onClick={() => setViewMode("tree")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1 transition ${
                  viewMode === "tree"
                    ? "bg-indigo-600 text-white font-bold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Layers size={13} />
                <span>Tree View</span>
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1 transition ${
                  viewMode === "table"
                    ? "bg-indigo-600 text-white font-bold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Table size={13} />
                <span>Table View</span>
              </button>
            </div>

            {/* DAY FILTERS */}
            <div className="flex items-center rounded-lg border border-slate-800 bg-slate-950 p-0.5 text-xs">
              <button
                onClick={() => setDayFilter("ALL")}
                className={`rounded-md px-2.5 py-1 transition ${
                  dayFilter === "ALL"
                    ? "bg-slate-800 text-white font-semibold"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                All Days
              </button>
              <button
                onClick={() => setDayFilter("GREEN")}
                className={`rounded-md px-2.5 py-1 transition ${
                  dayFilter === "GREEN"
                    ? "bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Green Inflows
              </button>
              <button
                onClick={() => setDayFilter("HIGH_DELIV")}
                className={`rounded-md px-2.5 py-1 transition ${
                  dayFilter === "HIGH_DELIV"
                    ? "bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Deliv ≥ 55%
              </button>
              <button
                onClick={() => setDayFilter("SPIKES")}
                className={`rounded-md px-2.5 py-1 transition ${
                  dayFilter === "SPIKES"
                    ? "bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Spikes ≥ 1.5x
              </button>
            </div>

            {viewMode === "tree" && (
              <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400">
                <button
                  onClick={expandAll}
                  className="rounded px-2 py-1 bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition"
                >
                  Expand All
                </button>
                <button
                  onClick={collapseAll}
                  className="rounded px-2 py-1 bg-slate-800/80 hover:bg-slate-700 text-slate-300 transition"
                >
                  Collapse All
                </button>
              </div>
            )}
          </div>
        </div>

        {/* LOADING & ERROR STATES */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3 rounded-2xl border border-slate-800/80 bg-slate-900/30">
            <RefreshCw className="h-8 w-8 animate-spin text-cyan-400" />
            <p className="text-sm font-medium">
              Reconstructing delivery accumulation & drawdown tree for {symbol}...
            </p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-center text-rose-300 space-y-3">
            <ShieldAlert className="h-10 w-10 text-rose-400 mx-auto" />
            <h3 className="text-base font-bold">Failed to load delivery history</h3>
            <p className="text-xs text-rose-200/80 max-w-md mx-auto">{error}</p>
            <button
              onClick={() => setLookbackSessions((s) => s)}
              className="mt-2 rounded-lg bg-rose-500/20 border border-rose-500/40 px-4 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-500/30 transition"
            >
              Retry
            </button>
          </div>
        ) : viewMode === "tree" ? (
          /* ========================================================== */
          /* HIERARCHICAL TREE VIEW                                     */
          /* ========================================================== */
          <div className="space-y-4">
            {treeData?.weeks.map((week) => {
              const isExpanded = Boolean(expandedWeeks[week.week_key]);
              const filteredDays = week.days
                .filter((d) => {
                  if (dayFilter === "GREEN") return d.is_green;
                  if (dayFilter === "HIGH_DELIV") return d.delivery_per >= 55;
                  if (dayFilter === "SPIKES") return (d.delivery_spike_x || 0) >= 1.5;
                  return true;
                })
                .sort((a, b) => b.date.localeCompare(a.date));

              return (
                <div
                  key={week.week_key}
                  className="rounded-2xl border border-slate-800 bg-[#070e1b] overflow-hidden shadow-lg transition duration-150 hover:border-slate-700/80"
                >
                  {/* WEEK HEADER ACCORDION */}
                  <div
                    onClick={() => toggleWeek(week.week_key)}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-slate-900/60 hover:bg-slate-800/50 cursor-pointer transition select-none border-b border-slate-800/80"
                  >
                    <div className="flex items-center gap-3">
                      <div className="text-slate-400">
                        {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-white font-mono">
                            {week.week_label}
                          </span>
                          <span className="text-[10px] text-slate-400 rounded bg-slate-800 px-2 py-0.5 font-mono">
                            {week.days.length} trading days
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 sm:gap-4 font-mono text-xs">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase mr-1">Return:</span>
                        <span
                          className={`font-bold ${
                            week.week_return_pct >= 0 ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {week.week_return_pct >= 0 ? "+" : ""}
                          {week.week_return_pct.toFixed(2)}%
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-500 uppercase mr-1">Week DD:</span>
                        <span className="text-amber-400 font-bold">
                          {week.week_drawdown_pct.toFixed(2)}%
                        </span>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-500 uppercase mr-1">Deliv Absorbed:</span>
                        <span className="text-white font-bold">₹{week.total_delivery_cr.toFixed(2)} Cr</span>
                      </div>

                      <div>
                        <span className="text-[10px] text-slate-500 uppercase mr-1">Avg Deliv:</span>
                        <span className="text-cyan-400 font-bold">
                          {week.avg_delivery_per.toFixed(1)}%
                        </span>
                      </div>

                      {week.net_flow_bias && (
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                            week.net_flow_bias === "ACCUMULATION" || week.net_flow_bias === "INFLOW"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : week.net_flow_bias === "DISTRIBUTION" || week.net_flow_bias === "OUTFLOW"
                              ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                              : "bg-slate-800 text-slate-300"
                          }`}
                        >
                          {week.net_flow_bias}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* WEEK SESSIONS (DAYS) */}
                  {isExpanded && (
                    <div className="p-3 sm:p-4 divide-y divide-slate-800/60">
                      {filteredDays.length === 0 ? (
                        <div className="py-6 text-center text-xs text-slate-500 font-mono">
                          No sessions match the selected filter in this week.
                        </div>
                      ) : (
                        filteredDays.map((day) => {
                          return (
                            <div
                              key={day.date}
                              className="py-3 px-2 flex flex-col lg:flex-row lg:items-center justify-between gap-3 hover:bg-slate-900/40 rounded-lg transition"
                            >
                              {/* DAY & PRICE */}
                              <div className="flex items-center gap-3 min-w-[220px]">
                                <span
                                  className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                                    day.is_green ? "bg-emerald-400" : "bg-rose-400"
                                  }`}
                                />
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-white font-mono">
                                      {day.day_label || day.date}
                                    </span>
                                    <span className="text-xs font-mono text-slate-300 font-semibold">
                                      (₹{day.close.toFixed(2)})
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-slate-500 font-mono">
                                    O: ₹{day.open.toFixed(1)} | H: ₹{day.high.toFixed(1)} | L: ₹{day.low.toFixed(1)}
                                  </div>
                                </div>
                              </div>

                              {/* PERFORMANCE & DRAWDOWN */}
                              <div className="flex items-center gap-4 font-mono text-xs">
                                <div>
                                  <span
                                    className={`font-bold block ${
                                      day.return_pct >= 0 ? "text-emerald-400" : "text-rose-400"
                                    }`}
                                  >
                                    {day.return_pct >= 0 ? "+" : ""}
                                    {day.return_pct.toFixed(2)}%
                                  </span>
                                  <span className="text-[9px] text-slate-500 uppercase">Day Return</span>
                                </div>

                                <div>
                                  <span className="text-amber-400 font-bold block">
                                    {day.drawdown_from_month_peak_pct.toFixed(2)}%
                                  </span>
                                  <span className="text-[9px] text-slate-500 uppercase">From 30D High</span>
                                </div>
                              </div>

                              {/* DELIVERY VOLUME BAR & PERCENT */}
                              <div className="flex items-center gap-3 min-w-[200px]">
                                <span className="text-[10px] text-slate-400 uppercase font-mono">Deliv:</span>
                                <div className="flex-1 bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700/60 max-w-[120px]">
                                  <div
                                    className={`h-full rounded-full ${
                                      day.delivery_per >= 80
                                        ? "bg-emerald-400"
                                        : day.delivery_per >= 60
                                        ? "bg-cyan-400"
                                        : "bg-slate-500"
                                    }`}
                                    style={{ width: `${Math.min(100, Math.max(0, day.delivery_per))}%` }}
                                  />
                                </div>
                                <span className="font-bold text-xs font-mono text-slate-200">
                                  {day.delivery_per.toFixed(1)}%
                                </span>
                              </div>

                              {/* SPIKE & TURNOVER */}
                              <div className="font-mono text-xs min-w-[140px]">
                                <div className="text-white font-bold">
                                  {day.delivery_spike_x > 0 ? `${day.delivery_spike_x.toFixed(2)}x Spike` : "1.0x"}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  ₹{day.delivery_turnover_cr.toFixed(2)} Cr Demat
                                </div>
                              </div>

                              {/* INSTITUTIONAL SIGNATURE BADGE */}
                              <div className="min-w-[160px] text-left lg:text-right">
                                {day.candle_label && (
                                  <span
                                    className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-bold border ${
                                      day.candle_type === "BLAST_SURGE"
                                        ? "bg-purple-500/20 text-purple-300 border-purple-500/40 animate-pulse"
                                        : day.candle_type === "HIGH_ABSORPTION"
                                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                        : day.candle_type === "SHAKEOUT_PULLBACK"
                                        ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                                        : day.candle_type === "SUPPLY_DRY_UP"
                                        ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                        : "bg-slate-800 text-slate-300 border-slate-700"
                                    }`}
                                  >
                                    <Sparkles size={11} />
                                    <span>{day.candle_label}</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* ========================================================== */
          /* TABULAR HISTORY VIEW                                       */
          /* ========================================================== */
          <div className="rounded-2xl border border-slate-800 bg-[#070e1b] overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800 text-[11px] uppercase tracking-wider select-none">
                  <tr>
                    <th
                      onClick={() => toggleSort("date")}
                      className="py-3 px-4 cursor-pointer hover:text-white transition group"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={tableSortField === "date" ? "text-cyan-300 font-bold" : ""}>Date</span>
                        {tableSortField === "date" ? (
                          tableSortOrder === "asc" ? (
                            <ArrowUp size={11} className="text-cyan-400" />
                          ) : (
                            <ArrowDown size={11} className="text-cyan-400" />
                          )
                        ) : (
                          <ArrowUpDown size={11} className="text-slate-600 group-hover:text-slate-400 transition" />
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => toggleSort("close")}
                      className="py-3 px-3 cursor-pointer hover:text-white transition group"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={tableSortField === "close" ? "text-cyan-300 font-bold" : ""}>Close</span>
                        {tableSortField === "close" ? (
                          tableSortOrder === "asc" ? (
                            <ArrowUp size={11} className="text-cyan-400" />
                          ) : (
                            <ArrowDown size={11} className="text-cyan-400" />
                          )
                        ) : (
                          <ArrowUpDown size={11} className="text-slate-600 group-hover:text-slate-400 transition" />
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => toggleSort("return_pct")}
                      className="py-3 px-3 cursor-pointer hover:text-white transition group"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={tableSortField === "return_pct" ? "text-cyan-300 font-bold" : ""}>Day Return</span>
                        {tableSortField === "return_pct" ? (
                          tableSortOrder === "asc" ? (
                            <ArrowUp size={11} className="text-cyan-400" />
                          ) : (
                            <ArrowDown size={11} className="text-cyan-400" />
                          )
                        ) : (
                          <ArrowUpDown size={11} className="text-slate-600 group-hover:text-slate-400 transition" />
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => toggleSort("drawdown_from_month_peak_pct")}
                      className="py-3 px-3 cursor-pointer hover:text-white transition group"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={tableSortField === "drawdown_from_month_peak_pct" ? "text-cyan-300 font-bold" : ""}>30D Drawdown</span>
                        {tableSortField === "drawdown_from_month_peak_pct" ? (
                          tableSortOrder === "asc" ? (
                            <ArrowUp size={11} className="text-cyan-400" />
                          ) : (
                            <ArrowDown size={11} className="text-cyan-400" />
                          )
                        ) : (
                          <ArrowUpDown size={11} className="text-slate-600 group-hover:text-slate-400 transition" />
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => toggleSort("delivery_per")}
                      className="py-3 px-3 cursor-pointer hover:text-white transition group"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={tableSortField === "delivery_per" ? "text-cyan-300 font-bold" : ""}>Delivery %</span>
                        {tableSortField === "delivery_per" ? (
                          tableSortOrder === "asc" ? (
                            <ArrowUp size={11} className="text-cyan-400" />
                          ) : (
                            <ArrowDown size={11} className="text-cyan-400" />
                          )
                        ) : (
                          <ArrowUpDown size={11} className="text-slate-600 group-hover:text-slate-400 transition" />
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => toggleSort("delivery_turnover_cr")}
                      className="py-3 px-3 cursor-pointer hover:text-white transition group"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={tableSortField === "delivery_turnover_cr" ? "text-cyan-300 font-bold" : ""}>Delivery Cr</span>
                        {tableSortField === "delivery_turnover_cr" ? (
                          tableSortOrder === "asc" ? (
                            <ArrowUp size={11} className="text-cyan-400" />
                          ) : (
                            <ArrowDown size={11} className="text-cyan-400" />
                          )
                        ) : (
                          <ArrowUpDown size={11} className="text-slate-600 group-hover:text-slate-400 transition" />
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => toggleSort("delivery_spike_x")}
                      className="py-3 px-3 cursor-pointer hover:text-white transition group"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={tableSortField === "delivery_spike_x" ? "text-cyan-300 font-bold" : ""}>Volume Spike</span>
                        {tableSortField === "delivery_spike_x" ? (
                          tableSortOrder === "asc" ? (
                            <ArrowUp size={11} className="text-cyan-400" />
                          ) : (
                            <ArrowDown size={11} className="text-cyan-400" />
                          )
                        ) : (
                          <ArrowUpDown size={11} className="text-slate-600 group-hover:text-slate-400 transition" />
                        )}
                      </div>
                    </th>
                    <th className="py-3 px-4 text-right">Signature Pattern</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {sortedFilteredSessions.map((row) => (
                    <tr key={row.date} className="hover:bg-slate-900/40 transition">
                      <td className="py-2.5 px-4 font-bold text-white whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span
                            className={`h-2 w-2 rounded-full ${
                              row.is_green ? "bg-emerald-400" : "bg-rose-400"
                            }`}
                          />
                          <span>{row.day_label || row.date}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-200 font-bold whitespace-nowrap">
                        ₹{row.close.toFixed(2)}
                      </td>
                      <td
                        className={`py-2.5 px-3 font-bold whitespace-nowrap ${
                          row.return_pct >= 0 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {row.return_pct >= 0 ? "+" : ""}
                        {row.return_pct.toFixed(2)}%
                      </td>
                      <td className="py-2.5 px-3 text-amber-400 whitespace-nowrap">
                        {row.drawdown_from_month_peak_pct.toFixed(2)}%
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span
                          className={`font-bold ${
                            row.delivery_per >= 80
                              ? "text-emerald-400"
                              : row.delivery_per >= 60
                              ? "text-cyan-400"
                              : "text-slate-300"
                          }`}
                        >
                          {row.delivery_per.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-white font-bold whitespace-nowrap">
                        ₹{row.delivery_turnover_cr.toFixed(2)} Cr
                      </td>
                      <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap">
                        {row.delivery_spike_x > 0 ? `${row.delivery_spike_x.toFixed(2)}x` : "1.0x"}
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        {row.candle_label && (
                          <span className="text-[10px] font-semibold text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 rounded">
                            {row.candle_label}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* INSTITUTIONAL SIGNATURE LEGEND */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-4 text-xs text-slate-400 space-y-2">
          <div className="font-bold text-slate-300 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
            <span>Institutional Delivery Archetype Interpretation</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-[11px] pt-1">
            <div className="flex items-start gap-2">
              <span className="h-2 w-2 rounded-full bg-purple-400 mt-1 shrink-0" />
              <div>
                <strong className="text-purple-300">Blast Surge:</strong> Extreme delivery volume spike (&gt; 2.5x 10D SMA) coupled with high absorption % indicating aggressive institutional accumulation.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 mt-1 shrink-0" />
              <div>
                <strong className="text-emerald-300">High Absorption:</strong> Over 60% of daily traded volume converted directly into Demat custody without distribution wicks.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-400 mt-1 shrink-0" />
              <div>
                <strong className="text-amber-300">Supply Dry-Up:</strong> Extreme volume and delivery contraction near baseline or 50 DMA support signaling exhausted sellers.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="h-2 w-2 rounded-full bg-rose-400 mt-1 shrink-0" />
              <div>
                <strong className="text-rose-300">Shakeout Pullback:</strong> Controlled red pullback on low delivery volume within multi-week baseline structure.
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

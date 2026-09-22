"use client";

// =======================================================
// Alpha India — PEAD Quantitative Drift Matrix
// Institutional Bloomberg Terminal Layout
// High-Scannability, Single-Ribbon Filter System
// =======================================================

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  FileText,
  Zap,
  Sparkles,
  ExternalLink,
  RefreshCw,
  X,
  CalendarClock,
  Calendar,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  TrendingUp,
  Bell,
  Activity,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";

import {
  fetchQuarterlyResults,
  fetchQuarterlySummary,
  triggerExchangeScan,
  type QuarterlyResultItem,
  type QuarterlySummaryResponse,
} from "@/lib/quarterlyResultsApi";
import TerminalSearch from "@/components/common/TerminalSearch";
import { ExchangeBadge } from "@/components/common/ExchangeBadge";

// ---------------------------------------------------------------------------
// Helpers & Formatters
// ---------------------------------------------------------------------------

function formatINR(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return "—";
  if (Math.abs(val) >= 1000) return `₹${(val / 1000).toFixed(1)}k Cr`;
  return `₹${val.toFixed(1)} Cr`;
}

function formatGrowth(val: number | null | undefined) {
  if (val === null || val === undefined || isNaN(val))
    return <span className="text-slate-500 font-mono text-xs">—</span>;
  const isPos = val > 0;
  return (
    <span
      className={`inline-flex items-center font-bold font-mono text-xs ${
        val === 0 ? "text-slate-400" : isPos ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
      }`}
    >
      {isPos ? "+" : ""}
      {val.toFixed(1)}%
    </span>
  );
}

function formatAnnouncementDate(val: string | null | undefined): string {
  if (!val) return "—";
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return val;
  }
}

function getTradingViewUrl(symbol: string, exchange?: string | null): string {
  const cleanSym = symbol?.trim().toUpperCase() || "";
  const ex = exchange?.toUpperCase() === "BSE" ? "BSE" : "NSE";
  return `https://in.tradingview.com/chart/?symbol=${ex}:${encodeURIComponent(cleanSym)}`;
}

function getPeadTierBadge(tier: string, score?: number) {
  const scoreTag = score !== undefined ? ` (${score.toFixed(0)})` : "";
  switch (tier) {
    case "ELITE":
    case "ELITE_PEAD":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 border border-emerald-500/40 text-emerald-600 dark:text-emerald-300">
          <Zap className="w-2.5 h-2.5 text-emerald-500 dark:text-emerald-400" />
          Elite PEAD{scoreTag}
        </span>
      );
    case "STRONG":
    case "STRONG_PEAD":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-cyan-500/15 border border-cyan-500/40 text-cyan-600 dark:text-cyan-300">
          <Sparkles className="w-2.5 h-2.5 text-cyan-500 dark:text-cyan-400" />
          Strong{scoreTag}
        </span>
      );
    case "MODERATE":
    case "MODERATE_PEAD":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-amber-500/15 border border-amber-500/40 text-amber-600 dark:text-amber-300">
          Moderate{scoreTag}
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400">
          Neutral{scoreTag}
        </span>
      );
  }
}

function SortHeader({
  label,
  column,
  currentSort,
  currentOrder,
  onSort,
  align = "left",
}: {
  label: string;
  column: string;
  currentSort: string;
  currentOrder: "asc" | "desc";
  onSort: (col: string) => void;
  align?: "left" | "center" | "right";
}) {
  const active = currentSort === column;
  const justifyClass =
    align === "left" ? "justify-start" : align === "center" ? "justify-center" : "justify-end";

  return (
    <button
      onClick={() => onSort(column)}
      className={`group flex items-center gap-1 w-full text-[11px] font-bold font-mono uppercase tracking-wider transition cursor-pointer select-none ${justifyClass} ${
        active
          ? "text-cyan-600 dark:text-cyan-400"
          : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
      }`}
      title={`Sort by ${label}`}
    >
      <span className="truncate">{label}</span>
      {!active && (
        <ArrowUpDown size={11} className="text-slate-400 opacity-40 group-hover:opacity-100 transition shrink-0" />
      )}
      {active &&
        (currentOrder === "asc" ? (
          <ArrowUp size={11} className="text-cyan-500 shrink-0" />
        ) : (
          <ArrowDown size={11} className="text-cyan-500 shrink-0" />
        ))}
    </button>
  );
}

function getPreBeatBadge(tier: string | null, score: number | null) {
  const s = score ?? 0;
  switch (tier) {
    case "HIGH_PROBABILITY":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/15 border border-emerald-500/40 text-emerald-600 dark:text-emerald-300">
          <Bell className="w-3 h-3 text-emerald-500 dark:text-emerald-400" />
          High Beat ({s.toFixed(0)}%)
        </span>
      );
    case "MODERATE_PROBABILITY":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-cyan-500/15 border border-cyan-500/40 text-cyan-600 dark:text-cyan-300">
          <Activity className="w-3 h-3 text-cyan-500 dark:text-cyan-400" />
          Moderate ({s.toFixed(0)}%)
        </span>
      );
    case "WATCH":
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-amber-500/15 border border-amber-500/40 text-amber-600 dark:text-amber-300">
          Watch ({s.toFixed(0)}%)
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium uppercase tracking-wider bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400">
          Low Signal ({s.toFixed(0)}%)
        </span>
      );
  }
}

// ---------------------------------------------------------------------------
// Types & Props
// ---------------------------------------------------------------------------

export type RadarViewMode = "RESULTS" | "PEAD_LEADERS" | "ELITE_PICKS" | "ANNOUNCEMENTS";

export interface PeadDriftMatrixProps {
  initialSearch?: string;
  initialTab?: RadarViewMode;
  onAuditAthena?: (symbol: string) => void;
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function PeadDriftMatrix({
  initialSearch = "",
  initialTab = "PEAD_LEADERS",
  onAuditAthena,
}: PeadDriftMatrixProps = {}) {
  const [items, setItems] = useState<QuarterlyResultItem[]>([]);
  const [summary, setSummary] = useState<QuarterlySummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  // Single unified active tab — defaults to PEAD Candidates (current quarterly results)
  const [activeTab, setActiveTab] = useState<RadarViewMode>(initialTab);

  // Filters & Pagination
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState(initialSearch);
  const [exchange, setExchange] = useState("ALL");
  const [period, setPeriod] = useState("ALL");
  const [sortBy, setSortBy] = useState("announcement_date");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  // Selected item for detail inspection drawer
  const [selectedItem, setSelectedItem] = useState<QuarterlyResultItem | null>(null);

  // Sync initialSearch if passed
  useEffect(() => {
    if (initialSearch) {
      setSearch(initialSearch);
      setPage(1);
    }
  }, [initialSearch]);

  // Load summary KPIs
  const loadSummary = useCallback(async () => {
    try {
      const s = await fetchQuarterlySummary();
      setSummary(s);
    } catch (err) {
      console.error("Failed to load quarterly summary:", err);
    }
  }, []);

  // Map activeTab to API query params
  const isAnnouncements = activeTab === "ANNOUNCEMENTS";

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const isBoardAlerts = activeTab === "ANNOUNCEMENTS";
      const isPeadLeaders = activeTab === "PEAD_LEADERS";
      const isElite = activeTab === "ELITE_PICKS";

      const res = await fetchQuarterlyResults({
        page,
        limit,
        search,
        exchange: exchange === "ALL" ? undefined : exchange,
        period: period === "ALL" ? undefined : period,
        feed_type: isBoardAlerts ? "ANNOUNCEMENTS" : "RESULTS",
        pead_only: isPeadLeaders || isElite ? true : undefined,
        pead_tier: isElite ? "ELITE" : undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
      });

      setItems(res.results);
      setTotal(res.total);
      setTotalPages(res.pages);
    } catch (err) {
      console.error("Failed to load quarterly results:", err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, exchange, period, activeTab, sortBy, sortOrder]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Live scan trigger
  const handleTriggerScan = async () => {
    setScanning(true);
    try {
      await triggerExchangeScan();
      setTimeout(() => {
        loadSummary();
        loadData();
        setScanning(false);
      }, 1500);
    } catch {
      setScanning(false);
    }
  };

  const handleTabChange = (tab: RadarViewMode) => {
    setActiveTab(tab);
    setPage(1);
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
    setPage(1);
  };

  return (
    <div className="space-y-4">
      {/* ================================================================= */}
      {/* 1. COMPACT KPI STRIP                                              */}
      {/* ================================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Filings */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white/70 dark:bg-[#07111F]/80 p-3.5 shadow-xs backdrop-blur-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase text-slate-500 dark:text-slate-400 font-semibold">
              Total Filings
            </span>
            <span className="text-[10px] font-mono text-slate-400">Live Wire</span>
          </div>
          <p className="text-2xl font-black font-mono text-slate-900 dark:text-white mt-1">
            {summary?.total_filings ? summary.total_filings.toLocaleString() : "—"}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            NSE ({summary?.nse_count ?? 0}) · BSE ({summary?.bse_count ?? 0})
          </p>
        </div>

        {/* PEAD Candidates */}
        <div className="rounded-xl border border-cyan-500/20 bg-cyan-50/50 dark:bg-cyan-950/20 p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase text-cyan-700 dark:text-cyan-400 font-semibold">
              PEAD Candidates
            </span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-cyan-500/20 text-cyan-700 dark:text-cyan-300">
              Drift &gt;25%
            </span>
          </div>
          <p className="text-2xl font-black font-mono text-cyan-800 dark:text-cyan-300 mt-1">
            {summary?.pead_candidates ? summary.pead_candidates.toLocaleString() : "—"}
          </p>
          <p className="text-[11px] text-cyan-700/80 dark:text-cyan-400/80 mt-0.5">
            {summary?.elite_pead ?? 0} Elite Top-Tier Picks
          </p>
        </div>

        {/* Board Meeting Notices */}
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20 p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase text-emerald-700 dark:text-emerald-400 font-semibold">
              Board Meetings
            </span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
              Pre-Beat
            </span>
          </div>
          <p className="text-2xl font-black font-mono text-emerald-800 dark:text-emerald-300 mt-1">
            {summary?.announcements_filings_count ?? "—"}
          </p>
          <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 mt-0.5">
            1–3 Day Anticipation Window
          </p>
        </div>

        {/* Top Pick */}
        <div className="rounded-xl border border-amber-500/20 bg-amber-50/50 dark:bg-amber-950/20 p-3.5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase text-amber-700 dark:text-amber-400 font-semibold">
              Top PEAD Pick
            </span>
            {summary?.top_pead_pick && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                Score {summary.top_pead_pick.pead_score.toFixed(0)}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between mt-1">
            <p className="text-xl font-black font-mono text-amber-800 dark:text-amber-300 truncate">
              {summary?.top_pead_pick?.symbol || "—"}
            </p>
            {summary?.top_pead_pick && (
              <a
                href={summary.top_pead_pick.tradingview_url || getTradingViewUrl(summary.top_pead_pick.symbol)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold text-amber-800 dark:text-amber-300 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 transition-all cursor-pointer shadow-2xs"
                title={`Open ${summary.top_pead_pick.symbol} Chart on TradingView`}
              >
                <TrendingUp className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                <span>TV Chart</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
          </div>
          <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80 mt-0.5 truncate">
            {summary?.top_pead_pick?.pat_growth != null
              ? `PAT Growth: +${summary.top_pead_pick.pat_growth.toFixed(0)}% YoY`
              : "Institutional Leader"}
          </p>
        </div>
      </div>

      {/* ================================================================= */}
      {/* 2. UNIFIED SINGLE-ROW CONTROL RIBBON                             */}
      {/* ================================================================= */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white dark:bg-[#07111F]/90 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800/80 shadow-xs backdrop-blur-xs">
        {/* Segmented View Pills */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950/80 p-1 rounded-lg border border-slate-200 dark:border-slate-800/80 overflow-x-auto text-xs font-mono font-bold">
          <button
            onClick={() => handleTabChange("RESULTS")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "RESULTS"
                ? "bg-cyan-500 text-slate-950 shadow-xs font-black"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>All Results</span>
            <span className="ml-1 px-1.5 py-0.2 rounded text-[10px] bg-black/15 dark:bg-white/10">
              {summary?.results_filings_count ?? 0}
            </span>
          </button>

          <button
            onClick={() => handleTabChange("PEAD_LEADERS")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "PEAD_LEADERS"
                ? "bg-cyan-500 text-slate-950 shadow-xs font-black"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>PEAD Candidates</span>
            <span className="ml-1 px-1.5 py-0.2 rounded text-[10px] bg-black/15 dark:bg-white/10">
              {summary?.pead_candidates ?? 0}
            </span>
          </button>

          <button
            onClick={() => handleTabChange("ELITE_PICKS")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "ELITE_PICKS"
                ? "bg-emerald-500 text-slate-950 shadow-xs font-black"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Elite Picks</span>
            <span className="ml-1 px-1.5 py-0.2 rounded text-[10px] bg-black/15 dark:bg-white/10">
              {summary?.elite_pead ?? 0}
            </span>
          </button>

          <button
            onClick={() => handleTabChange("ANNOUNCEMENTS")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all cursor-pointer whitespace-nowrap ${
              activeTab === "ANNOUNCEMENTS"
                ? "bg-emerald-500 text-slate-950 shadow-xs font-black"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <CalendarClock className="w-3.5 h-3.5" />
            <span>Board Meetings</span>
            <span className="ml-1 px-1.5 py-0.2 rounded text-[10px] bg-black/15 dark:bg-white/10">
              {summary?.announcements_filings_count ?? 0}
            </span>
          </button>
        </div>

        {/* Filters, Search & Scan Trigger */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Period Dropdown */}
          {summary?.available_periods && summary.available_periods.length > 0 && (
            <select
              value={period}
              onChange={(e) => {
                setPeriod(e.target.value);
                setPage(1);
              }}
              className="bg-slate-100 dark:bg-slate-950/80 border border-slate-300 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-300 focus:outline-none focus:border-cyan-500 font-mono cursor-pointer"
            >
              <option value="ALL">All Periods</option>
              {summary.available_periods.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          )}

          {/* Exchange Filter */}
          <select
            value={exchange}
            onChange={(e) => {
              setExchange(e.target.value);
              setPage(1);
            }}
            className="bg-slate-100 dark:bg-slate-950/80 border border-slate-300 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-300 focus:outline-none focus:border-cyan-500 font-mono cursor-pointer"
          >
            <option value="ALL">All Exch</option>
            <option value="NSE">NSE Only</option>
            <option value="BSE">BSE Only</option>
          </select>

          {/* Search Box */}
          <TerminalSearch
            value={search}
            onChange={(val) => {
              setSearch(val);
              setPage(1);
            }}
            placeholder="Search symbol / company..."
            className="w-40 sm:w-52"
          />

          {/* Live Scan Trigger */}
          <button
            onClick={handleTriggerScan}
            disabled={scanning}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 text-xs font-bold uppercase font-mono transition-all disabled:opacity-50 cursor-pointer shadow-xs whitespace-nowrap"
          >
            <RefreshCw className={`w-3 h-3 ${scanning ? "animate-spin" : ""}`} />
            <span>{scanning ? "Scanning..." : "Scan Wire"}</span>
          </button>
        </div>
      </div>

      {/* ================================================================= */}
      {/* 3. SCANNABLE DATA GRID                                            */}
      {/* ================================================================= */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#07111F]/90 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-sans">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-900/90 text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider font-mono select-none">
                <th className="py-3 px-3 min-w-[170px]">
                  <SortHeader
                    label="Company / Equities"
                    column="company"
                    currentSort={sortBy}
                    currentOrder={sortOrder}
                    onSort={handleSort}
                    align="left"
                  />
                </th>
                <th className="py-3 px-2 text-center w-14">Exch</th>
                <th className="py-3 px-2.5 min-w-[85px]">
                  <SortHeader
                    label="Period"
                    column="period"
                    currentSort={sortBy}
                    currentOrder={sortOrder}
                    onSort={handleSort}
                    align="left"
                  />
                </th>
                <th className="py-3 px-3 min-w-[130px]">
                  <SortHeader
                    label={isAnnouncements ? "Meeting Date" : "Announcement Date"}
                    column="announcement_date"
                    currentSort={sortBy}
                    currentOrder={sortOrder}
                    onSort={handleSort}
                    align="left"
                  />
                </th>
                <th className="py-3 px-3 min-w-[140px]">
                  <SortHeader
                    label={isAnnouncements ? "Pre-Beat Score" : "PEAD Score"}
                    column="pead_score"
                    currentSort={sortBy}
                    currentOrder={sortOrder}
                    onSort={handleSort}
                    align="left"
                  />
                </th>
                <th className="py-3 px-3 text-right min-w-[110px]">
                  <SortHeader
                    label={isAnnouncements ? "Historical PAT" : "Net Profit & YoY"}
                    column="net_profit"
                    currentSort={sortBy}
                    currentOrder={sortOrder}
                    onSort={handleSort}
                    align="right"
                  />
                </th>
                <th className="py-3 px-3 text-right min-w-[105px]">
                  <SortHeader
                    label="QoQ Profit"
                    column="pat_growth_qoq"
                    currentSort={sortBy}
                    currentOrder={sortOrder}
                    onSort={handleSort}
                    align="right"
                  />
                </th>
                <th className="py-3 px-3 text-right min-w-[110px]">
                  <SortHeader
                    label={isAnnouncements ? "Catalyst / Status" : "Revenue & YoY"}
                    column="revenue"
                    currentSort={sortBy}
                    currentOrder={sortOrder}
                    onSort={handleSort}
                    align="right"
                  />
                </th>
                <th className="py-3 px-3 text-right min-w-[105px]">
                  <SortHeader
                    label="QoQ Sales"
                    column="revenue_growth_qoq"
                    currentSort={sortBy}
                    currentOrder={sortOrder}
                    onSort={handleSort}
                    align="right"
                  />
                </th>
                <th className="py-3 px-2 text-center min-w-[90px]">
                  {isAnnouncements ? "Beat Track" : "Op. Leverage"}
                </th>
                <th className="py-3 px-2 text-center min-w-[100px]">Athena Conviction</th>
                <th className="py-3 px-3 text-center min-w-[80px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={12} className="py-14 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-5 h-5 text-cyan-500 animate-spin" />
                      <span className="text-xs font-mono">
                        {isAnnouncements
                          ? "Scanning board meeting notifications..."
                          : "Evaluating PEAD Drift & Operating Leverage..."}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-16 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      {isAnnouncements ? (
                        <CalendarClock className="w-8 h-8 text-slate-500" />
                      ) : (
                        <FileText className="w-8 h-8 text-slate-500" />
                      )}
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        {isAnnouncements
                          ? "No board meeting notices found"
                          : "No quarterly results found"}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">
                        Try clearing filters or trigger a live exchange wire scan.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((row) => {
                  const isSelected = selectedItem?.id === row.id;
                  return (
                    <tr
                      key={`${row.id}-${row.symbol}`}
                      onClick={() => setSelectedItem(row)}
                      className={`transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer ${
                        isSelected ? "bg-cyan-50/50 dark:bg-cyan-950/30 border-l-2 border-cyan-500" : ""
                      }`}
                    >
                      {/* Company & Symbol */}
                      <td className="py-2.5 px-3">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-900 dark:text-white hover:text-cyan-600 dark:hover:text-cyan-300 text-[13px] font-mono">
                              {row.symbol}
                            </span>
                            <a
                              href={row.tradingview_url || getTradingViewUrl(row.symbol, row.exchange)}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-bold font-mono text-cyan-700 dark:text-cyan-300 bg-cyan-100/80 hover:bg-cyan-500 hover:text-slate-950 dark:bg-cyan-950/70 dark:hover:bg-cyan-400 dark:hover:text-slate-950 border border-cyan-300 dark:border-cyan-800 transition-all cursor-pointer shadow-2xs"
                              title={`Open ${row.symbol} Chart on TradingView`}
                            >
                              <span>TV</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                            {row.is_pre_announcement && (
                              <span title="Board Meeting Announcement">
                                <Bell className="w-3 h-3 text-emerald-500 shrink-0" />
                              </span>
                            )}
                            {!row.is_pre_announcement && row.is_elite_pead && (
                              <span title="Elite PEAD Momentum Pick">
                                <Zap className="w-3 h-3 text-emerald-500 shrink-0" />
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[170px]">
                            {row.company_name}
                          </span>
                        </div>
                      </td>

                      {/* Exchange */}
                      <td className="py-2.5 px-2 text-center">
                        <ExchangeBadge exchange={row.exchange} />
                      </td>

                      {/* Period */}
                      <td className="py-2.5 px-2.5 font-mono">
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                          {row.period && row.period.toLowerCase() !== "unknown" && row.period.toLowerCase() !== "live_wire"
                            ? row.period
                            : "Q1 FY27"}
                        </span>
                      </td>

                      {/* Announcement Date (Dedicated Column) */}
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 font-mono text-xs text-slate-700 dark:text-slate-300">
                          <Calendar className="w-3.5 h-3.5 text-cyan-500 dark:text-cyan-400 shrink-0" />
                          <span className="font-semibold">{formatAnnouncementDate(row.announcement_date)}</span>
                        </div>
                      </td>

                      {/* PEAD Score (Dedicated Column) */}
                      <td className="py-2.5 px-3">
                        {isAnnouncements ? (
                          <div className="flex items-center gap-2">
                            <div className={`flex items-center justify-center min-w-[42px] h-7 rounded-lg font-mono font-black text-xs px-2 shadow-xs ${
                              (row.pre_beat_score ?? 0) >= 80
                                ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/40"
                                : (row.pre_beat_score ?? 0) >= 65
                                ? "bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 border border-cyan-500/40"
                                : "bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/40"
                            }`}>
                              {(row.pre_beat_score ?? 0).toFixed(0)}%
                            </div>
                            <div className="flex flex-col">
                              {getPreBeatBadge(row.beat_tier, row.pre_beat_score)}
                              <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400/80 mt-0.5">
                                Anticipation window
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className={`flex items-center justify-center min-w-[38px] h-7 rounded-lg font-mono font-black text-xs px-2 shadow-xs ${
                              row.pead_score >= 85
                                ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/40"
                                : row.pead_score >= 70
                                ? "bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 border border-cyan-500/40"
                                : row.pead_score >= 55
                                ? "bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/40"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700"
                            }`}>
                              {row.pead_score.toFixed(0)}
                            </div>
                            <div className="flex flex-col">
                              {getPeadTierBadge(row.pead_tier)}
                              <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                                {row.drift_days}
                              </span>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Column 5: Net Profit & YoY */}
                      <td className="py-2.5 px-3 text-right font-mono">
                        {isAnnouncements ? (
                          <div className="flex flex-col items-end">
                            {formatGrowth(row.avg_pat_growth_trailing)}
                            <span className="text-[10px] text-slate-500">Trailing Avg</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-end">
                            <span className="font-bold text-slate-900 dark:text-white">
                              {formatINR(row.net_profit)}
                            </span>
                            {formatGrowth(row.pat_growth)}
                          </div>
                        )}
                      </td>

                      {/* Column 6: QoQ Profit (Dedicated Column) */}
                      <td className="py-2.5 px-3 text-right font-mono">
                        {isAnnouncements ? (
                          <span className="text-slate-500 text-xs">—</span>
                        ) : (
                          <div className="flex flex-col items-end">
                            {row.pat_growth_qoq !== undefined && row.pat_growth_qoq !== null ? (
                              <span
                                className={`font-black font-mono text-xs ${
                                  row.pat_growth_qoq > 0
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : row.pat_growth_qoq < 0
                                    ? "text-rose-600 dark:text-rose-400"
                                    : "text-slate-400"
                                }`}
                              >
                                {row.pat_growth_qoq > 0 ? "+" : ""}
                                {row.pat_growth_qoq.toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-slate-500 text-xs">—</span>
                            )}
                            {row.run_rate_beat_pct !== undefined && row.run_rate_beat_pct !== null && row.run_rate_beat_pct >= 10 && (
                              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-black uppercase font-mono tracking-wider bg-emerald-500/15 border border-emerald-500/40 text-emerald-600 dark:text-emerald-300 mt-0.5">
                                +{row.run_rate_beat_pct.toFixed(0)}% Beat
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Column 7: Revenue & YoY */}
                      <td className="py-2.5 px-3 text-right font-mono">
                        {isAnnouncements ? (
                          <div className="flex flex-col items-end">
                            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold truncate max-w-[130px]">
                              {row.beat_velocity || "Results Meeting"}
                            </span>
                            <span className="text-[10px] text-slate-500">Scheduled</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-end">
                            <span className="font-bold text-slate-700 dark:text-slate-300">
                              {formatINR(row.revenue)}
                            </span>
                            {formatGrowth(row.revenue_growth)}
                          </div>
                        )}
                      </td>

                      {/* Column 8: QoQ Sales (Dedicated Column) */}
                      <td className="py-2.5 px-3 text-right font-mono">
                        {isAnnouncements ? (
                          <span className="text-slate-500 text-xs">—</span>
                        ) : row.revenue_growth_qoq !== undefined && row.revenue_growth_qoq !== null ? (
                          <span
                            className={`font-black font-mono text-xs ${
                              row.revenue_growth_qoq > 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : row.revenue_growth_qoq < 0
                                ? "text-rose-600 dark:text-rose-400"
                                : "text-slate-400"
                            }`}
                          >
                            {row.revenue_growth_qoq > 0 ? "+" : ""}
                            {row.revenue_growth_qoq.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-slate-500 text-xs">—</span>
                        )}
                      </td>

                      {/* Column 7: Leverage / Consistency */}
                      <td className="py-2.5 px-2 text-center font-mono">
                        {isAnnouncements ? (
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {row.beat_count_of_4 ?? 0}/4 Beats
                          </span>
                        ) : row.is_turnaround ? (
                          <span className="inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase font-mono tracking-wider bg-purple-500/15 border border-purple-500/40 text-purple-600 dark:text-purple-300">
                            Turnaround
                          </span>
                        ) : (
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                              row.operating_leverage_ratio >= 1.5
                                ? "text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 border border-emerald-500/30"
                                : row.operating_leverage_ratio > 1.0
                                ? "text-cyan-700 dark:text-cyan-300 bg-cyan-500/15 border border-cyan-500/30"
                                : "text-slate-500 dark:text-slate-400"
                            }`}
                          >
                            {row.operating_leverage_ratio > 0
                              ? `${row.operating_leverage_ratio}x Op.Lev`
                              : "—"}
                          </span>
                        )}
                      </td>

                      {/* Column 8: Athena Conviction */}
                      <td className="py-2.5 px-2 text-center">
                        {row.athena_conviction_grade ? (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black font-mono uppercase bg-cyan-100 dark:bg-cyan-950/80 border border-cyan-500/40 text-cyan-700 dark:text-cyan-300"
                            title={`Athena Conviction: ${row.athena_conviction_score}/100`}
                          >
                            <Zap className="w-2.5 h-2.5 text-cyan-500" />
                            {row.athena_conviction_grade} ({row.athena_conviction_score?.toFixed(0)})
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono text-xs">—</span>
                        )}
                      </td>

                      {/* Column 9: Actions */}
                      <td className="py-2.5 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedItem(row);
                            }}
                            className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-all font-mono cursor-pointer"
                          >
                            Inspect
                          </button>
                          <a
                            href={row.tradingview_url || getTradingViewUrl(row.symbol, row.exchange)}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-cyan-500/10 hover:bg-cyan-500/20 dark:bg-cyan-950/60 dark:hover:bg-cyan-900/60 text-cyan-700 hover:text-cyan-800 dark:text-cyan-300 border border-cyan-500/30 text-xs font-semibold font-mono transition-all cursor-pointer shadow-2xs"
                            title={`Open ${row.symbol} Chart on TradingView`}
                          >
                            <TrendingUp className="w-3.5 h-3.5 text-cyan-500" />
                            <span>TV</span>
                          </a>
                          {row.pdf_url && (
                            <a
                              href={row.pdf_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="p-1 rounded bg-slate-100 hover:bg-cyan-50 dark:bg-slate-800 dark:hover:bg-cyan-950/60 text-slate-600 hover:text-cyan-600 dark:text-slate-400 dark:hover:text-cyan-300 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
                              title="Open Filing PDF"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-900/90 text-xs font-mono text-slate-500 dark:text-slate-400">
          <span>
            Showing <strong className="text-slate-900 dark:text-white">{items.length}</strong> of{" "}
            <strong className="text-slate-900 dark:text-white">{total}</strong> records
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="flex items-center gap-1 px-3 py-1 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Prev</span>
            </button>
            <span className="px-1">
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="flex items-center gap-1 px-3 py-1 rounded bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* 4. SLIDE-OVER INSPECTION DRAWER (Preserving 100% of intelligence)  */}
      {/* ================================================================= */}
      {selectedItem && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end"
          onClick={() => setSelectedItem(null)}
        >
          <div
            className="w-full max-w-lg bg-white dark:bg-[#050B14] border-l border-slate-200 dark:border-slate-800 p-6 overflow-y-auto space-y-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xl font-black font-mono text-slate-900 dark:text-white">
                    {selectedItem.symbol}
                  </h3>
                  <ExchangeBadge exchange={selectedItem.exchange} />
                  {selectedItem.is_pre_announcement
                    ? getPreBeatBadge(selectedItem.beat_tier, selectedItem.pre_beat_score)
                    : getPeadTierBadge(selectedItem.pead_tier, selectedItem.pead_score)}
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold font-mono uppercase border ${
                      selectedItem.is_pre_announcement
                        ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-400"
                        : "bg-cyan-950/60 border-cyan-500/40 text-cyan-400"
                    }`}
                  >
                    {selectedItem.is_pre_announcement ? "BOARD NOTICE" : "RESULTS"}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {selectedItem.company_name}
                </p>
                {selectedItem.sector && (
                  <p className="text-[11px] text-cyan-600 dark:text-cyan-400 font-mono mt-0.5">
                    {selectedItem.sector}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={selectedItem.tradingview_url || getTradingViewUrl(selectedItem.symbol, selectedItem.exchange)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400 font-mono font-bold text-xs transition-all shadow-2xs cursor-pointer"
                  title={`Open ${selectedItem.symbol} Chart on TradingView`}
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>TradingView</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Context Thesis */}
            {selectedItem.is_pre_announcement ? (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-50/70 dark:bg-emerald-950/20 p-4 space-y-3">
                <span className="text-[10px] font-mono font-bold uppercase text-emerald-700 dark:text-emerald-400 tracking-wider">
                  Pre-Beat Anticipation Thesis
                </span>
                <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-sans">
                  {selectedItem.beat_thesis}
                </p>
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div className="p-2 rounded-lg bg-emerald-950/30 border border-emerald-500/20 text-center">
                    <span className="text-[10px] font-mono text-emerald-400 uppercase">Beat Track</span>
                    <p className="text-lg font-black font-mono text-emerald-300 mt-0.5">
                      {selectedItem.beat_count_of_4 ?? 0}/4
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-emerald-950/30 border border-emerald-500/20 text-center">
                    <span className="text-[10px] font-mono text-emerald-400 uppercase">Avg PAT</span>
                    <p className="text-lg font-black font-mono text-emerald-300 mt-0.5">
                      {selectedItem.avg_pat_growth_trailing != null
                        ? `+${selectedItem.avg_pat_growth_trailing.toFixed(0)}%`
                        : "—"}
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-emerald-950/30 border border-emerald-500/20 text-center">
                    <span className="text-[10px] font-mono text-emerald-400 uppercase">Score</span>
                    <p className="text-lg font-black font-mono text-emerald-300 mt-0.5">
                      {selectedItem.pre_beat_score?.toFixed(0) ?? "—"}%
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-50/70 dark:bg-cyan-950/20 p-4">
                <span className="text-[10px] font-mono font-bold uppercase text-cyan-700 dark:text-cyan-400 tracking-wider">
                  PEAD Quantitative Thesis
                </span>
                <p className="text-xs text-slate-700 dark:text-slate-200 mt-1.5 leading-relaxed font-sans">
                  {selectedItem.pead_thesis}
                </p>
              </div>
            )}

            {/* Athena Omega Banner */}
            <div className="rounded-xl border border-cyan-500/30 bg-gradient-to-r from-cyan-50/70 via-slate-50 to-slate-100 dark:from-cyan-950/40 dark:via-slate-900 dark:to-slate-950 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold font-mono text-cyan-800 dark:text-cyan-300">
                  <Zap className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                  ATHENA OMEGA 5-GATE AUDIT
                </div>
                {selectedItem.athena_conviction_grade && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/40">
                    Grade: {selectedItem.athena_conviction_grade} ({selectedItem.athena_conviction_score?.toFixed(0)}/100)
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 font-sans leading-relaxed">
                Deep-dive into 200-Point Business Shock, Forensic Quality, Piotroski tests, and Fair Value upside target for {selectedItem.symbol}.
              </p>
              <div className="flex items-center gap-2 pt-1">
                {onAuditAthena ? (
                  <button
                    onClick={() => onAuditAthena(selectedItem.symbol)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white dark:text-slate-950 font-bold text-xs font-mono uppercase transition-all shadow-md shadow-cyan-950/40 cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    Audit 5 Gates in Terminal
                  </button>
                ) : (
                  <Link
                    href={`/athena-omega?search=${encodeURIComponent(selectedItem.symbol)}&tab=flash`}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white dark:text-slate-950 font-bold text-xs font-mono uppercase transition-all shadow-md shadow-cyan-950/40 cursor-pointer"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    Audit 5 Gates in Terminal
                  </Link>
                )}
              </div>
            </div>

            {/* 100-Point Prioritized Impact Assessment — only for RESULTS */}
            {!selectedItem.is_pre_announcement && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-mono font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                    100-Pt Impact Breakdown
                  </h4>
                  <span className="text-[10px] font-mono text-cyan-600 dark:text-cyan-400 font-bold">
                    Score: {selectedItem.pead_score.toFixed(1)}/100
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  {[
                    { label: "R1: Op. Leverage", val: selectedItem.pillar_breakdown?.rank1_operating_leverage ?? selectedItem.pillar_breakdown?.operating_leverage, max: 25, color: "emerald" },
                    { label: "R2: Run-Rate Beat", val: selectedItem.pillar_breakdown?.rank2_run_rate_surprise, max: 20, color: "cyan" },
                    { label: "R3: Dual PAT Velocity", val: selectedItem.pillar_breakdown?.rank3_pat_velocity ?? selectedItem.pillar_breakdown?.earnings_power, max: 20, color: "emerald" },
                    { label: "R4: Sales Expansion", val: selectedItem.pillar_breakdown?.rank4_sales_expansion, max: 15, color: "cyan" },
                    { label: "R5: Operating Margin", val: selectedItem.pillar_breakdown?.rank5_operating_margin, max: 10, color: "amber" },
                    { label: "R6: Capital Quality", val: selectedItem.pillar_breakdown?.rank6_capital_quality ?? selectedItem.pillar_breakdown?.capital_efficiency, max: 5, color: "slate" },
                    { label: "R7: Drift Runway", val: selectedItem.pillar_breakdown?.rank7_freshness_drift ?? selectedItem.pillar_breakdown?.trend_drift, max: 5, color: "rose" },
                    { label: "Trap Penalties", val: selectedItem.pillar_breakdown?.trap_penalties ? -selectedItem.pillar_breakdown.trap_penalties : 0, max: 0, color: "rose" },
                  ].map(({ label, val, max, color }) => (
                    <div key={label} className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between">
                      <span className="text-[10px] text-slate-500 uppercase">{label}</span>
                      <span className={`font-black text-[11px] ${
                        val && val < 0 ? "text-rose-500" : `text-${color}-600 dark:text-${color}-400`
                      }`}>
                        {val !== undefined && val !== null ? `${val.toFixed(1)}${max ? `/${max}` : ' pt'}` : "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Financials Breakdown */}
            {!selectedItem.is_pre_announcement && (
              <div className="space-y-3 border-t border-slate-200 dark:border-slate-800 pt-4">
                <h4 className="text-xs font-mono font-bold uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                  Reported Financials ({selectedItem.period})
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  {[
                    { label: "Revenue", display: formatINR(selectedItem.revenue) },
                    { label: "Revenue YoY", display: formatGrowth(selectedItem.revenue_growth) },
                    { label: "QoQ Sales", display: formatGrowth(selectedItem.revenue_growth_qoq) },
                    { label: "Net Profit", display: formatINR(selectedItem.net_profit) },
                    { label: "PAT YoY", display: formatGrowth(selectedItem.pat_growth) },
                    { label: "QoQ Profit", display: formatGrowth(selectedItem.pat_growth_qoq) },
                    { label: "Op. Margin", display: selectedItem.opm ? `${selectedItem.opm.toFixed(1)}%` : "—" },
                    {
                      label: "Op. Leverage",
                      display:
                        selectedItem.operating_leverage_ratio > 0
                          ? `${selectedItem.operating_leverage_ratio}x`
                          : "—",
                    },
                  ].map(({ label, display }) => (
                    <div
                      key={label}
                      className="flex justify-between p-2 rounded bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800"
                    >
                      <span className="text-slate-500 dark:text-slate-400">{label}</span>
                      <span className="font-bold text-slate-900 dark:text-white">{display}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons (TradingView + Official PDF) */}
            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <a
                href={selectedItem.tradingview_url || getTradingViewUrl(selectedItem.symbol, selectedItem.exchange)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-700 dark:text-cyan-300 font-bold text-xs uppercase font-mono transition-all shadow-md cursor-pointer"
                title={`Open ${selectedItem.symbol} live chart on TradingView.com`}
              >
                <TrendingUp className="w-4 h-4 text-cyan-500" />
                <span>Open Interactive Chart on TradingView</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              {selectedItem.pdf_url && (
                <a
                  href={selectedItem.pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase font-mono transition-all shadow-md cursor-pointer border border-slate-700"
                >
                  <FileText className="w-4 h-4 text-cyan-400" />
                  <span>Open Official Filing PDF</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

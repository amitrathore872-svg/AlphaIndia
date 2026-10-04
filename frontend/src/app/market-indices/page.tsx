"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Activity,
  Search,
  RefreshCw,
  Flame,
  CheckCircle2,
  TrendingUp,
  Maximize2,
  BarChart2,
  X,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import IndexChartModal from "@/components/indices/IndexChartModal";


import {
  PageHeader,
  KpiCard,
  LoadingSpinner,
  EmptyState,
} from "@/components/common";
import {
  fetchMarketIndices,
  refreshMarketIndices,
  IndexPerformance,
  IndicesSummary,
  MonthlyReturn,
} from "@/lib/marketIndicesApi";

export default function MarketIndicesPage() {
  const [indices, setIndices] = useState<IndexPerformance[]>([]);
  const [summary, setSummary] = useState<IndicesSummary | null>(null);
  const [monthHeaders, setMonthHeaders] = useState<string[]>([]);
  const [timestamp, setTimestamp] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filters & State
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("win_rate_pct");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [viewMode, setViewMode] = useState<"heatmap" | "table">("heatmap");
  const [selectedModalIndex, setSelectedModalIndex] = useState<IndexPerformance | null>(null);

  // Load Data
  const loadData = useCallback(async (force = false) => {
    try {
      if (force) {
        setIsRefreshing(true);
        await refreshMarketIndices().catch(() => {});
      } else {
        setIsLoading(true);
      }
      setError(null);

      const resp = await fetchMarketIndices({
        category: selectedCategory,
        search: searchQuery,
        sort_by: sortBy,
        sort_order: sortOrder,
        force_refresh: force,
      });

      setIndices(resp.indices || []);
      setSummary(resp.summary || null);
      setMonthHeaders(resp.month_headers || []);
      setTimestamp(resp.timestamp || "");
    } catch (err: any) {
      console.error("Error loading market indices:", err);
      setError(err?.message || "Failed to load market indices");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedCategory, searchQuery, sortBy, sortOrder]);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  // Quick stats derived from indices list
  const categoryCounts = useMemo(() => {
    return {
      all: indices.length,
      broad: indices.filter((i) => i.category === "BROAD").length,
      sectoral: indices.filter((i) => i.category === "SECTORAL").length,
      thematic: indices.filter((i) => i.category === "THEMATIC").length,
    };
  }, [indices]);

  // Color helper for monthly return cell
  const getCellColorClasses = (val: number, isGreen: boolean) => {
    if (isGreen) {
      if (val >= 5.0) {
        return "bg-emerald-950/80 text-emerald-300 border-emerald-700/60 font-semibold shadow-xs";
      }
      return "bg-emerald-950/40 text-emerald-400 border-emerald-800/40";
    } else {
      if (val <= -5.0) {
        return "bg-rose-950/80 text-rose-300 border-rose-700/60 font-semibold shadow-xs";
      }
      return "bg-rose-950/40 text-rose-400 border-rose-800/40";
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-5 pb-12">
        {/* ── HEADER ─────────────────────────────────────────────────── */}
        <PageHeader
          eyebrow={
            <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs tracking-wider uppercase">
              <Activity className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              <span>INDIAN EQUITIES RADAR • SPRINT 42</span>
            </div>
          }
          title="Market Indices Radar"
          badge={{ label: "12-MONTH HEATMAP", color: "emerald" }}
          subtitle="Rolling 12-month performance matrix & monthly seasonality across benchmark, sectoral, and thematic indices listed on NSE & BSE."
          actions={
            <div className="flex items-center gap-2">
              <button
                onClick={() => loadData(true)}
                disabled={isRefreshing || isLoading}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 text-xs font-medium transition-all shadow-xs disabled:opacity-50"
                title="Force refresh index quotes and 12-month data"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-cyan-400" : ""}`} />
                <span>{isRefreshing ? "Refreshing..." : "Refresh Feed"}</span>
              </button>
            </div>
          }
        />

        {/* ── KPI TELEMETRY STRIP ───────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            label="MARKET BREADTH (TODAY)"
            value={
              summary ? (
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400">{summary.green_1d_count} ▲</span>
                  <span className="text-slate-500">/</span>
                  <span className="text-rose-400">{summary.red_1d_count} ▼</span>
                </div>
              ) : (
                "Loading..."
              )
            }
            sub={
              summary
                ? `${Math.round((summary.green_1d_count / Math.max(summary.total_indices, 1)) * 100)}% Green Today`
                : "Aggregating 42 indices"
            }
            icon={<Activity className="w-4 h-4 text-cyan-400" />}
          />

          <KpiCard
            label="12M TOP LEADER"
            value={
              summary ? (
                <span className="text-emerald-400 font-bold">
                  {summary.top_12m_leader.return_12m > 0 ? "+" : ""}
                  {summary.top_12m_leader.return_12m.toFixed(1)}%
                </span>
              ) : (
                "..."
              )
            }
            sub={summary ? summary.top_12m_leader.name : "Leaderboard"}
            icon={<Flame className="w-4 h-4 text-amber-400" />}
          />

          <KpiCard
            label="1-MONTH MOMENTUM"
            value={
              summary ? (
                <span className={summary.top_1m_leader.return_1m >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                  {summary.top_1m_leader.return_1m > 0 ? "+" : ""}
                  {summary.top_1m_leader.return_1m.toFixed(1)}%
                </span>
              ) : (
                "..."
              )
            }
            sub={summary ? summary.top_1m_leader.name : "30-Day Leader"}
            icon={<TrendingUp className="w-4 h-4 text-emerald-400" />}
          />

          <KpiCard
            label="MOST CONSISTENT INDEX"
            value={
              summary ? (
                <span className="text-cyan-400 font-bold">
                  {summary.most_consistent.win_rate_pct}% WR
                </span>
              ) : (
                "..."
              )
            }
            sub={
              summary
                ? `${summary.most_consistent.name} (${summary.most_consistent.green_months}/12 Green)`
                : "Seasonality"
            }
            icon={<CheckCircle2 className="w-4 h-4 text-cyan-400" />}
          />
        </div>

        {/* ── FILTER & CONTROL TOOLBAR ───────────────────────────────── */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 p-3 bg-slate-900/60 border border-slate-800/80 rounded-xl backdrop-blur-md">
          {/* Category Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
            {[
              { id: "ALL", label: "All Indices" },
              { id: "BROAD", label: "Broad Benchmarks" },
              { id: "SECTORAL", label: "Sectoral" },
              { id: "THEMATIC", label: "Thematic & Strategy" },
            ].map((tab) => {
              const active = selectedCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSelectedCategory(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                    active
                      ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-xs"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Search, Sort, and View Toggle */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative min-w-[180px] max-w-xs flex-1">
              <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search index (e.g. Bank, Auto, Sensex)..."
                className="w-full bg-slate-950/80 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-hidden focus:border-cyan-500/60 transition-all font-mono"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-200 text-xs"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Sort Selector */}
            <div className="flex items-center gap-1.5 bg-slate-950/80 border border-slate-800 rounded-lg px-2.5 py-1 text-xs">
              <span className="text-slate-400">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-transparent text-slate-200 focus:outline-hidden cursor-pointer"
              >
                <option value="win_rate_pct">Win Rate % (Most Green)</option>
                <option value="return_1m">1-Month Return</option>
                <option value="return_3m">3-Month Return</option>
                <option value="return_6m">6-Month Return</option>
                <option value="return_12m">12-Month Return</option>
                <option value="return_ytd">YTD Return</option>
                <option value="change_pct_1d">1D Change %</option>
                <option value="cmp">CMP (Level)</option>
                <option value="name">Index Name</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
                className="ml-1 p-0.5 text-slate-400 hover:text-cyan-400 transition-colors"
                title={`Order: ${sortOrder.toUpperCase()}`}
              >
                {sortOrder === "desc" ? "↓" : "↑"}
              </button>
            </div>

            {/* View Mode Switcher */}
            <div className="flex items-center bg-slate-950/80 border border-slate-800 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode("heatmap")}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                  viewMode === "heatmap"
                    ? "bg-slate-800 text-cyan-300 border border-cyan-500/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title="12-Month Colored Heatmap View"
              >
                Heatmap
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                  viewMode === "table"
                    ? "bg-slate-800 text-cyan-300 border border-cyan-500/30"
                    : "text-slate-400 hover:text-slate-200"
                }`}
                title="Multi-Timeframe Returns Table View"
              >
                Summary
              </button>
            </div>
          </div>
        </div>

        {/* ── HEATMAP LEGEND & GUIDE ───────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between text-xs px-3 py-2 bg-slate-900/40 border border-slate-800/60 rounded-lg text-slate-400 font-mono">
          <div className="flex items-center gap-2">
            <span className="text-slate-300 font-sans font-medium">Monthly Return Status:</span>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-xs bg-emerald-600"></span>
              <span className="text-emerald-400">Green (Positive Return)</span>
            </div>
            <div className="flex items-center gap-1.5 ml-2">
              <span className="inline-block w-2.5 h-2.5 rounded-xs bg-rose-600"></span>
              <span className="text-rose-400">Red (Negative Return)</span>
            </div>
            <div className="hidden sm:flex items-center gap-1 ml-3 text-[11px] text-slate-500">
              (Darker tint = magnitude &gt; 5%)
            </div>
          </div>

          <div className="text-[11px] text-slate-500 flex items-center gap-2">
            <span>Showing {indices.length} indices</span>
            {timestamp && <span>• Feed updated {timestamp}</span>}
          </div>
        </div>

        {/* ── MAIN CONTENT ───────────────────────────────────────────── */}
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <LoadingSpinner size="lg" />
            <p className="text-xs text-slate-400 font-mono tracking-wide">
              Analyzing monthly returns & calculating win rates...
            </p>
          </div>
        ) : error ? (
          <div className="p-6 bg-rose-950/20 border border-rose-800/40 rounded-xl text-center space-y-2">
            <p className="text-rose-300 font-medium text-sm">{error}</p>
            <button
              onClick={() => loadData(true)}
              className="px-3 py-1.5 bg-rose-900/60 hover:bg-rose-900 text-rose-100 rounded-lg text-xs"
            >
              Try Again
            </button>
          </div>
        ) : indices.length === 0 ? (
          <EmptyState
            title="No indices found"
            description="No index matches your current search or category filter."
          />
        ) : viewMode === "heatmap" ? (
          /* ── HEATMAP VIEW ─────────────────────────────────────────── */
          <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-950/60 shadow-xl scrollbar-thin">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900/90 text-slate-400 font-mono text-[11px] border-b border-slate-800">
                  <th className="py-3 px-3 min-w-[200px] sticky left-0 z-20 bg-slate-900 border-r border-slate-800/80">
                    INDEX NAME
                  </th>
                  <th className="py-3 px-3 text-right min-w-[90px]">CMP</th>
                  <th className="py-3 px-3 text-right min-w-[80px]">1D CHG</th>
                  <th className="py-3 px-3 text-center min-w-[95px]">12M SCORE</th>
                  <th className="py-3 px-3 text-center min-w-[80px]">WIN RATE</th>
                  
                  {/* 12 Monthly Columns */}
                  {monthHeaders.map((mHeader, idx) => (
                    <th
                      key={mHeader}
                      className="py-3 px-2 text-center min-w-[70px] border-l border-slate-800/50"
                    >
                      <div className="font-semibold text-slate-200">{mHeader}</div>
                      <div className="text-[10px] text-slate-500 font-normal">
                        M{idx + 1}
                      </div>
                    </th>
                  ))}

                  <th className="py-3 px-3 text-right min-w-[80px] border-l border-slate-800">
                    1Y TOT
                  </th>
                  <th className="py-3 px-3 text-right min-w-[80px]">YTD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-slate-300">
                {indices.map((idx) => {
                  const is1dGreen = idx.change_pct_1d >= 0;
                  const is1yGreen = idx.return_12m >= 0;
                  const isYtdGreen = idx.return_ytd >= 0;

                  return (
                    <tr
                      key={idx.symbol}
                      className="hover:bg-slate-900/50 transition-colors group cursor-pointer"
                      onClick={() => setSelectedModalIndex(idx)}
                    >
                      {/* Sticky Index Column */}
                      <td className="py-2.5 px-3 sticky left-0 z-10 bg-slate-950/95 group-hover:bg-slate-900/95 transition-colors border-r border-slate-800/80">
                        <div className="flex items-center justify-between gap-1.5">
                          <div>
                            <div className="font-medium text-slate-100 flex items-center gap-1.5">
                              <span>{idx.name}</span>
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                                {idx.exchange}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500 flex items-center gap-1.5">
                              <span
                                className={`px-1 rounded text-[9px] font-mono ${
                                  idx.category === "BROAD"
                                    ? "bg-blue-950 text-blue-300 border border-blue-800/40"
                                    : idx.category === "SECTORAL"
                                    ? "bg-purple-950 text-purple-300 border border-purple-800/40"
                                    : "bg-amber-950 text-amber-300 border border-amber-800/40"
                                }`}
                              >
                                {idx.category}
                              </span>
                              <span>{idx.streak}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedModalIndex(idx);
                              }}
                              className="px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 bg-cyan-950/70 hover:bg-cyan-900 text-cyan-300 border border-cyan-800/80 transition-colors shadow-xs"
                              title={`Open interactive chart for ${idx.name}`}
                            >
                              <BarChart2 className="w-3 h-3 text-cyan-400" />
                              <span>Chart</span>
                            </button>
                            <Maximize2 className="w-3.5 h-3.5 text-slate-600 group-hover:text-cyan-400 transition-colors" />
                          </div>
                        </div>
                      </td>

                      {/* CMP */}
                      <td className="py-2.5 px-3 text-right font-mono text-slate-200">
                        ₹{idx.cmp.toLocaleString("en-IN")}
                      </td>

                      {/* 1D Change */}
                      <td className="py-2.5 px-3 text-right font-mono">
                        <span
                          className={`inline-flex items-center gap-0.5 font-semibold ${
                            is1dGreen ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {is1dGreen ? "▲" : "▼"}{" "}
                          {Math.abs(idx.change_pct_1d).toFixed(2)}%
                        </span>
                      </td>

                      {/* 12M Score (Green vs Red) */}
                      <td className="py-2.5 px-3 text-center font-mono">
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[11px]">
                          <span className="text-emerald-400 font-bold">{idx.green_count}G</span>
                          <span className="text-slate-600">/</span>
                          <span className="text-rose-400 font-bold">{idx.red_count}R</span>
                        </div>
                      </td>

                      {/* Win Rate */}
                      <td className="py-2.5 px-3 text-center font-mono">
                        <span
                          className={`px-2 py-0.5 rounded font-semibold text-[11px] ${
                            idx.win_rate_pct >= 58
                              ? "bg-emerald-950/70 text-emerald-300 border border-emerald-800/50"
                              : idx.win_rate_pct <= 42
                              ? "bg-rose-950/70 text-rose-300 border border-rose-800/50"
                              : "bg-slate-900 text-slate-300 border border-slate-800"
                          }`}
                        >
                          {idx.win_rate_pct.toFixed(0)}%
                        </span>
                      </td>

                      {/* 12 Month Cells */}
                      {idx.months.map((m) => {
                        const cellColor = getCellColorClasses(m.return_pct, m.is_green);
                        return (
                          <td
                            key={m.month_index}
                            className="py-2 px-1 text-center border-l border-slate-800/40"
                            title={`${idx.name} • ${m.month_label}: ${m.return_pct > 0 ? "+" : ""}${m.return_pct}% (Close: ₹${m.close_price.toLocaleString("en-IN")})`}
                          >
                            <div
                              className={`mx-auto w-[62px] py-1 px-1 rounded-md text-[11px] font-mono border text-center transition-transform hover:scale-105 ${cellColor}`}
                            >
                              <span>
                                {m.return_pct > 0 ? "+" : ""}
                                {m.return_pct.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                        );
                      })}

                      {/* 1 Year Total */}
                      <td className="py-2.5 px-3 text-right font-mono border-l border-slate-800">
                        <span
                          className={`font-semibold ${
                            is1yGreen ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {is1yGreen ? "+" : ""}
                          {idx.return_12m.toFixed(1)}%
                        </span>
                      </td>

                      {/* YTD */}
                      <td className="py-2.5 px-3 text-right font-mono">
                        <span
                          className={`font-semibold ${
                            isYtdGreen ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {isYtdGreen ? "+" : ""}
                          {idx.return_ytd.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* ── TABLE VIEW ───────────────────────────────────────────── */
          <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-950/60 shadow-xl scrollbar-thin">
            <table className="w-full text-left text-xs border-collapse font-sans">
              <thead>
                <tr className="bg-slate-900/90 text-slate-400 font-mono text-[11px] border-b border-slate-800">
                  <th className="py-3 px-3">INDEX</th>
                  <th className="py-3 px-3 text-right">CMP</th>
                  <th className="py-3 px-3 text-right">1D CHG</th>
                  <th className="py-3 px-3 text-right">1M</th>
                  <th className="py-3 px-3 text-right">3M</th>
                  <th className="py-3 px-3 text-right">6M</th>
                  <th className="py-3 px-3 text-right">12M</th>
                  <th className="py-3 px-3 text-right">YTD</th>
                  <th className="py-3 px-3 text-center">WIN RATE (12M)</th>
                  <th className="py-3 px-3 text-center">BEST MONTH</th>
                  <th className="py-3 px-3 text-center">WORST MONTH</th>
                  <th className="py-3 px-3 text-right">OFF 52W HIGH</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 text-slate-300">
                {indices.map((idx) => {
                  return (
                    <tr
                      key={idx.symbol}
                      className="hover:bg-slate-900/50 transition-colors cursor-pointer"
                      onClick={() => setSelectedModalIndex(idx)}
                    >
                      <td className="py-3 px-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                              <span>{idx.name}</span>
                              <span className="text-[10px] px-1 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                                {idx.exchange}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              {idx.category} • {idx.streak}
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedModalIndex(idx);
                            }}
                            className="px-2 py-1 rounded text-[10px] font-mono flex items-center gap-1 bg-cyan-950/70 hover:bg-cyan-900 text-cyan-300 border border-cyan-800/80 transition-colors shadow-xs"
                            title={`Open interactive chart for ${idx.name}`}
                          >
                            <BarChart2 className="w-3 h-3 text-cyan-400" />
                            <span>Chart</span>
                          </button>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-200">
                        ₹{idx.cmp.toLocaleString("en-IN")}
                      </td>
                      <td className="py-3 px-3 text-right font-mono">
                        <span
                          className={`font-semibold ${
                            idx.change_pct_1d >= 0 ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {idx.change_pct_1d > 0 ? "+" : ""}
                          {idx.change_pct_1d.toFixed(2)}%
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono">
                        <span className={idx.return_1m >= 0 ? "text-emerald-400" : "text-rose-400"}>
                          {idx.return_1m > 0 ? "+" : ""}
                          {idx.return_1m.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono">
                        <span className={idx.return_3m >= 0 ? "text-emerald-400" : "text-rose-400"}>
                          {idx.return_3m > 0 ? "+" : ""}
                          {idx.return_3m.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono">
                        <span className={idx.return_6m >= 0 ? "text-emerald-400" : "text-rose-400"}>
                          {idx.return_6m > 0 ? "+" : ""}
                          {idx.return_6m.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono">
                        <span
                          className={`font-semibold ${
                            idx.return_12m >= 0 ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {idx.return_12m > 0 ? "+" : ""}
                          {idx.return_12m.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono">
                        <span
                          className={`font-semibold ${
                            idx.return_ytd >= 0 ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {idx.return_ytd > 0 ? "+" : ""}
                          {idx.return_ytd.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-mono">
                        <span className="font-semibold text-cyan-300">
                          {idx.win_rate_pct.toFixed(0)}%
                        </span>{" "}
                        <span className="text-[10px] text-slate-500">
                          ({idx.green_count}G/{idx.red_count}R)
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-mono">
                        {idx.best_month ? (
                          <span className="text-emerald-400 text-[11px]">
                            {idx.best_month.month} (+{idx.best_month.return_pct.toFixed(1)}%)
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="py-3 px-3 text-center font-mono">
                        {idx.worst_month ? (
                          <span className="text-rose-400 text-[11px]">
                            {idx.worst_month.month} ({idx.worst_month.return_pct.toFixed(1)}%)
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-rose-400">
                        {idx.pct_off_high.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── INTERACTIVE TRADINGVIEW CHART MODAL ────────────────────── */}
        {selectedModalIndex && (
          <IndexChartModal
            index={selectedModalIndex}
            allIndices={indices}
            onClose={() => setSelectedModalIndex(null)}
            onSelectIndex={(idx) => setSelectedModalIndex(idx)}
          />
        )}
      </div>
    </DashboardLayout>
  );
}

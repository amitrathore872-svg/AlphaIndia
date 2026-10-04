"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Sparkles,
  Search,
  RefreshCw,
  ArrowUpRight,
  TrendingUp,
  ShieldCheck,
  Building2,
  ChevronLeft,
  ChevronRight,
  X,
  Coins,
  Percent,
  Layers,
  Award,
  Eye,
  EyeOff,
  ExternalLink,
  Activity,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import InstitutionalSubNav from "@/components/institutional/InstitutionalSubNav";
import StockInstitutionalModal from "@/components/institutional/StockInstitutionalModal";
import AddToWatchlistButton from "@/components/watchlist/AddToWatchlistButton";
import { SparklineChart } from "@/components/common";
import {
  FreshEntriesResponse,
  FreshEntryItem,
  CapCounts,
  fetchFreshEntries,
} from "@/lib/institutionalApi";

export default function FreshPortfolioEntriesPage() {
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<FreshEntriesResponse | null>(null);

  // Filters
  const [capCategory, setCapCategory] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedSector, setSelectedSector] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<string>("market_value_cr");
  const [sortOrder, setSortOrder] = useState<string>("desc");

  // Pagination
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(25);

  // Modal
  const [modalSymbol, setModalSymbol] = useState<string | null>(null);

  // Metric Cards Visibility
  const [showMetrics, setShowMetrics] = useState<boolean>(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("alpha_india_fresh_entries_metrics_visible");
      if (saved !== null) {
        setShowMetrics(saved === "true");
      }
    } catch {
      // Ignore localStorage error
    }
  }, []);

  const handleToggleMetrics = () => {
    setShowMetrics((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("alpha_india_fresh_entries_metrics_visible", String(next));
      } catch {
        // Ignore localStorage error
      }
      return next;
    });
  };

  const loadFreshEntries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchFreshEntries({
        market_cap_category: capCategory !== "ALL" ? capCategory : undefined,
        search: searchTerm || undefined,
        sector: selectedSector !== "ALL" ? selectedSector : undefined,
        page,
        limit,
        sort_by: sortBy,
        sort_order: sortOrder,
      });
      setData(res);
    } catch (err) {
      console.error("Error loading fresh entries:", err);
    } finally {
      setLoading(false);
    }
  }, [capCategory, searchTerm, selectedSector, page, limit, sortBy, sortOrder]);

  useEffect(() => {
    loadFreshEntries();
  }, [loadFreshEntries]);

  const capCounts: CapCounts = data?.cap_counts || {
    ALL: 0,
    LARGE: 0,
    MID: 0,
    SMALL: 0,
    MICRO: 0,
  };

  const summary = data?.summary || {
    total_fresh_entries: 0,
    total_deployment_cr: 0,
    max_deployment_cr: 0,
    max_weight_pct: 0,
    top_sector: "N/A",
  };

  return (
    <DashboardLayout>
      <div className="flex-1 space-y-4">
        {/* TOP SUB-NAV */}
        <InstitutionalSubNav freshCount={summary.total_fresh_entries} />

        {/* HEADER TITLE & ACTIONS */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800/80 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-lg shadow-emerald-950/10 dark:shadow-emerald-950/30">
              <Sparkles size={26} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                  Mutual Funds New Entries
                </h1>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  {summary.total_fresh_entries} NEW INITIATIONS
                </span>
                <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-xs font-bold text-cyan-700 dark:text-cyan-400">
                  {data?.latest_report_date || "Aug 2026"} CYCLE
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Newly initiated equity positions detected in the latest AMFI monthly filing across leading Indian AMCs.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={handleToggleMetrics}
              className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition-all shadow-xs ${
                showMetrics
                  ? "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-600 hover:text-slate-900 dark:hover:text-white"
                  : "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20"
              }`}
              title={showMetrics ? "Hide Telemetry Metric Boxes" : "Show Telemetry Metric Boxes"}
            >
              {showMetrics ? (
                <>
                  <EyeOff size={14} className="text-slate-500 dark:text-slate-400" />
                  <span>Hide Metrics</span>
                </>
              ) : (
                <>
                  <Eye size={14} className="text-emerald-600 dark:text-emerald-400" />
                  <span>Show Metrics</span>
                </>
              )}
            </button>

            <button
              onClick={loadFreshEntries}
              disabled={loading}
              className="flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-600 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800 transition disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? "animate-spin text-emerald-600 dark:text-emerald-400" : ""} />
              Refresh Radar
            </button>
          </div>
        </div>

        {/* TELEMETRY METRIC CARDS */}
        {showMetrics && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 animate-in fade-in duration-200">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 p-4 backdrop-blur-md shadow-sm dark:shadow-lg">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
              <span>Total Fresh Initiations</span>
              <Sparkles size={16} className="text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-black text-slate-900 dark:text-white">
                {summary.total_fresh_entries}
              </span>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Positions</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Zero prior holdings detected in preceding cycle</p>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 p-4 backdrop-blur-md shadow-sm dark:shadow-lg">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
              <span>Fresh Capital Deployed</span>
              <Coins size={16} className="text-cyan-600 dark:text-cyan-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-black text-cyan-700 dark:text-cyan-300">
                â‚¹{summary.total_deployment_cr.toLocaleString("en-IN")}
              </span>
              <span className="text-xs font-semibold text-cyan-600 dark:text-cyan-400">Cr</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Total initial rupee deployment across funds</p>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 p-4 backdrop-blur-md shadow-sm dark:shadow-lg">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
              <span>Max Single Deployment</span>
              <Award size={16} className="text-amber-600 dark:text-amber-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-black text-amber-700 dark:text-amber-300">
                â‚¹{summary.max_deployment_cr.toLocaleString("en-IN")}
              </span>
              <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">Cr</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Highest conviction single scheme entry</p>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 p-4 backdrop-blur-md shadow-sm dark:shadow-lg">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 dark:text-slate-400">
              <span>Top Entry Sector</span>
              <Layers size={16} className="text-purple-600 dark:text-purple-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-lg font-black text-purple-700 dark:text-purple-300 line-clamp-1">
                {summary.top_sector}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Max net fresh institutional inflow sector</p>
          </div>
        </div>
        )}

        {/* SEARCH & SORT TOOLBAR */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-900/40 p-3">
          <div className="flex flex-1 flex-wrap items-center gap-2.5">
            <div className="relative min-w-[240px] flex-1 sm:max-w-xs">
              <Search
                size={14}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                placeholder="Search stock, scheme, AMC..."
                className="w-full rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950/70 py-2 pl-9 pr-4 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 shadow-xs"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Market Cap Filter Dropdown */}
            <select
              value={capCategory}
              onChange={(e) => {
                setCapCategory(e.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950/70 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-300 focus:border-emerald-500 focus:outline-none cursor-pointer hover:border-slate-400 dark:hover:border-slate-700 transition shadow-xs"
              aria-label="Filter by Market Cap"
            >
              <option value="ALL">Market Cap: All Caps ({capCounts.ALL})</option>
              <option value="LARGE">Large Cap ({capCounts.LARGE}) â€¢ &gt; â‚¹20k Cr</option>
              <option value="MID">Mid Cap ({capCounts.MID}) â€¢ â‚¹5k - â‚¹20k Cr</option>
              <option value="SMALL">Small Cap ({capCounts.SMALL}) â€¢ â‚¹1k - â‚¹5k Cr</option>
              <option value="MICRO">Micro Cap ({capCounts.MICRO}) â€¢ &lt; â‚¹1k Cr</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950/70 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-300 focus:border-emerald-500 focus:outline-none cursor-pointer hover:border-slate-400 dark:hover:border-slate-700 transition shadow-xs"
            >
              <option value="market_value_cr">Sort: Capital Deployed (â‚¹ Cr)</option>
              <option value="weight_pct">Sort: Scheme Weight %</option>
              <option value="shares_held">Sort: Shares Bought</option>
              <option value="symbol">Sort: Ticker Symbol</option>
              <option value="amc_name">Sort: AMC Name</option>
            </select>
          </div>

          <div className="text-xs text-slate-600 dark:text-slate-400">
            Showing <strong className="text-slate-900 dark:text-white">{data?.items?.length || 0}</strong> of{" "}
            <strong className="text-emerald-600 dark:text-emerald-400">{data?.total || 0}</strong> fresh additions
          </div>
        </div>

        {/* FRESH ENTRIES TABLE */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 backdrop-blur-md shadow-md dark:shadow-2xl">
          {loading && (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-white/70 dark:bg-slate-950/70 backdrop-blur-xs">
              <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/40 bg-white dark:bg-slate-900 px-5 py-3 shadow-2xl">
                <RefreshCw size={18} className="animate-spin text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-black tracking-wide text-emerald-800 dark:text-emerald-200">
                  SCANNING FRESH PORTFOLIO ENTRIES...
                </span>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/90 text-[11px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-3.5 text-center">Cap Tier</th>
                  <th className="px-4 py-3.5">Company & Symbol</th>
                  <th className="px-3 py-3.5 text-center">Current Stage</th>
                  <th className="px-3 py-3.5 text-center">Trend (90D)</th>
                  <th className="px-4 py-3.5">Sector</th>
                  <th className="px-4 py-3.5">Scheme & AMC Name</th>
                  <th className="px-4 py-3.5">Fund Manager</th>
                  <th className="px-4 py-3.5 text-right">Shares Bought</th>
                  <th className="px-4 py-3.5 text-right">Rupee Deployment</th>
                  <th className="px-4 py-3.5 text-right">Scheme Weight %</th>
                  <th className="px-4 py-3.5 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300 font-medium">
                {data?.items?.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-16 text-center text-slate-500 dark:text-slate-400">
                      <Sparkles size={36} className="mx-auto mb-2 text-slate-400" />
                      <p className="text-sm font-semibold">No fresh entries found for selected criteria.</p>
                    </td>
                  </tr>
                ) : (
                  data?.items?.map((item) => {
                    const catBadge =
                      item.market_cap_category === "LARGE"
                        ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-700 dark:text-cyan-400"
                        : item.market_cap_category === "MID"
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        : item.market_cap_category === "SMALL"
                        ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                        : "border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400";

                    const isStage2 = item.stage_code === "STAGE_2";
                    const isStage1 = item.stage_code === "STAGE_1";
                    const isStage3 = item.stage_code === "STAGE_3";

                    const stageBadgeClass = isStage2
                      ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold shadow-xs"
                      : isStage1
                      ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 font-bold"
                      : isStage3
                      ? "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-400 font-bold"
                      : "border-rose-500/40 bg-rose-500/15 text-rose-700 dark:text-rose-400 font-bold";

                    const stageDotClass = isStage2
                      ? "bg-emerald-400 animate-pulse"
                      : isStage1
                      ? "bg-cyan-400"
                      : isStage3
                      ? "bg-amber-400"
                      : "bg-rose-400";

                    return (
                      <tr
                        key={item.id}
                        className="group hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        {/* Cap Tier */}
                        <td className="px-3 py-3.5 text-center">
                          <span
                            className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-black tracking-wider uppercase ${catBadge}`}
                          >
                            {item.market_cap_category || "MICRO"}
                          </span>
                        </td>

                        {/* Company & Symbol with direct stock detail link */}
                        <td className="px-4 py-3.5">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                              <Link
                                href={`/stocks/${encodeURIComponent(item.symbol)}?from=/institutional-radar`}
                                className="font-extrabold text-slate-900 dark:text-white text-sm tracking-wide hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors inline-flex items-center gap-1.5"
                                title={`Open comprehensive technical analysis for ${item.symbol}`}
                              >
                                <span>{item.symbol}</span>
                                <ExternalLink size={12} className="text-cyan-600 dark:text-cyan-400 opacity-70 group-hover:opacity-100" />
                              </Link>
                            </div>
                            <Link
                              href={`/stocks/${encodeURIComponent(item.symbol)}?from=/institutional-radar`}
                              className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 line-clamp-1 transition-colors"
                              title={`Open ${item.company_name} detail page`}
                            >
                              {item.company_name}
                            </Link>
                          </div>
                        </td>

                        {/* Current Stage */}
                        <td className="px-3 py-3.5 text-center">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] tracking-wide uppercase ${stageBadgeClass}`}
                            title={`Stan Weinstein / Minervini Stage: ${item.current_stage || "Stage 2 (Markup)"}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${stageDotClass}`} />
                            <span>{item.current_stage || "Stage 2 (Markup)"}</span>
                          </span>
                        </td>

                        {/* Small Sparkline Graph on the row */}
                        <td className="px-3 py-3.5 text-center">
                          <Link
                            href={`/stocks/${encodeURIComponent(item.symbol)}?from=/institutional-radar`}
                            className="inline-block hover:opacity-85 transition-opacity"
                            title={`Click to view interactive chart for ${item.symbol}`}
                          >
                            <SparklineChart
                              data={item.sparkline}
                              width={82}
                              height={24}
                              showDot={true}
                              showBadge={true}
                              periodLabel="90D"
                            />
                          </Link>
                        </td>

                        {/* Sector */}
                        <td className="px-4 py-3.5 text-slate-600 dark:text-slate-400 text-xs">
                          {item.sector}
                        </td>

                        {/* Scheme & AMC */}
                        <td className="px-4 py-3.5">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900 dark:text-white text-xs">
                              {item.scheme_name}
                            </span>
                            <div className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                              <span className="text-cyan-700 dark:text-cyan-400">{item.amc_name}</span>
                              <span>&bull;</span>
                              <span>{item.scheme_category}</span>
                            </div>
                          </div>
                        </td>

                        {/* Fund Manager */}
                        <td className="px-4 py-3.5 text-slate-700 dark:text-slate-300 font-medium">
                          {item.fund_manager_name}
                        </td>

                        {/* Shares Bought */}
                        <td className="px-4 py-3.5 text-right font-mono text-slate-700 dark:text-slate-300">
                          {item.shares_held.toLocaleString("en-IN")}
                        </td>

                        {/* Rupee Deployment */}
                        <td className="px-4 py-3.5 text-right font-mono font-black text-cyan-700 dark:text-cyan-300 text-sm">
                          â‚¹{item.market_value_cr.toLocaleString("en-IN")} Cr
                        </td>

                        {/* Scheme Weight % */}
                        <td className="px-4 py-3.5 text-right">
                          <div className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-xs font-black text-emerald-700 dark:text-emerald-400">
                            <span>â˜…</span>
                            <span>{item.weight_pct.toFixed(2)}%</span>
                          </div>
                        </td>

                        {/* Action: Stock Detail Link + Fund Intelligence Modal */}
                        <td className="px-4 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <AddToWatchlistButton
                              symbol={item.symbol}
                              companyName={item.company_name}
                              variant="star"
                            />
                            <Link
                              href={`/stocks/${encodeURIComponent(item.symbol)}?from=/institutional-radar`}
                              className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-bold text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/20 transition shadow-xs inline-flex items-center gap-1"
                              title={`Open ${item.symbol} Stock Detail Page`}
                            >
                              <span>Stock</span>
                              <ArrowUpRight size={11} />
                            </Link>
                            <button
                              onClick={() => setModalSymbol(item.symbol)}
                              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 px-2.5 py-1 text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/20 hover:text-emerald-700 dark:hover:text-emerald-300 transition shadow-xs"
                              title="View AMC Scheme Holdings Intelligence Modal"
                            >
                              Funds
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

          {/* TABLE FOOTER / PAGINATION */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3.5 text-xs text-slate-600 dark:text-slate-400">
            <div>
              Showing{" "}
              <strong className="text-slate-900 dark:text-white">
                {data?.items?.length ? (page - 1) * limit + 1 : 0}
              </strong>{" "}
              to{" "}
              <strong className="text-slate-900 dark:text-white">
                {Math.min(page * limit, data?.total || 0)}
              </strong>{" "}
              of <strong className="text-emerald-600 dark:text-emerald-400">{data?.total || 0}</strong> fresh entries
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="flex items-center gap-1 rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 font-bold text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition disabled:opacity-40 shadow-xs"
              >
                <ChevronLeft size={14} />
                Previous
              </button>
              <span className="px-2 font-mono font-bold text-slate-900 dark:text-white">
                Page {page} of {data?.pages || 1}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(data?.pages || 1, p + 1))}
                disabled={page >= (data?.pages || 1) || loading}
                className="flex items-center gap-1 rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 font-bold text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition disabled:opacity-40 shadow-xs"
              >
                Next
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* 5-QUESTION STOCK INSTITUTIONAL MODAL */}
        {modalSymbol && (
          <StockInstitutionalModal
            symbol={modalSymbol}
            onClose={() => setModalSymbol(null)}
          />
        )}
      </div>
    </DashboardLayout>
  );
}


"use client";

import { useEffect, useState, useCallback, useTransition } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/layout/DashboardLayout";
import {
  fetchTechnoFundaScreener,
  fetchTechnoFundaSummary,
  type TechnoFundaItem,
  type TechnoFundaSummary,
} from "@/lib/technoFundaApi";
import {
  TrendingUp,
  Activity,
  Zap,
  Target,
  Search,
  Filter,
  ArrowUpRight,
  ShieldCheck,
  ChevronRight,
  SlidersHorizontal,
  X,
  Maximize2,
  ExternalLink,
  Flame,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

export default function TechnoFundaPage() {
  const [items, setItems] = useState<TechnoFundaItem[]>([]);
  const [summary, setSummary] = useState<TechnoFundaSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [signalFilter, setSignalFilter] = useState("ALL");
  const [patternFilter, setPatternFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("setup_score");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Load summary stats once
  useEffect(() => {
    fetchTechnoFundaSummary()
      .then(setSummary)
      .catch((err) => console.error("Summary error:", err));
  }, []);

  // Fetch screener data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchTechnoFundaScreener({
        page,
        limit,
        search: debouncedSearch,
        signal_filter: signalFilter,
        pattern_filter: patternFilter,
        sort_by: sortBy,
        sort_order: sortOrder,
      });
      setItems(res.items);
      setTotalPages(res.total_pages);
      setTotalCount(res.total);
    } catch (err) {
      console.error("Failed to load screener data:", err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, signalFilter, patternFilter, sortBy, sortOrder]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleQuickFilter = (type: "signal" | "pattern", val: string) => {
    setPage(1);
    if (type === "signal") {
      setSignalFilter(val);
      setPatternFilter("ALL");
    } else {
      setPatternFilter(val);
      setSignalFilter("ALL");
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-5">
        {/* TOP BANNER / HEADER */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-white via-slate-50 to-slate-100 dark:from-[#081225] dark:via-[#050B14] dark:to-[#040810] p-5 shadow-xs dark:shadow-2xl">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                  <Activity size={18} />
                </div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
                  Techno-Funda Radar & Pre-Breakout Scanner
                </h1>
                <span className="rounded-full bg-emerald-100 dark:bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 dark:text-emerald-400 border border-emerald-500/20">
                  Live Vertical
                </span>
              </div>
              <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-400 sm:text-sm">
                Dual-conviction engine fusing institutional fundamental health with Weinstein Stage-2 price structures,
                Minervini VCP volatility contractions, and volume dry-up footprints.
              </p>
            </div>

            {/* External Quick Link Demo */}
            <div className="flex items-center gap-2">
              <Link
                href="/techno-funda/METROPOLIS"
                className="flex items-center gap-1.5 rounded-xl border border-cyan-500/30 bg-cyan-50 dark:bg-cyan-500/10 px-3.5 py-2 text-xs font-semibold text-cyan-700 dark:text-cyan-300 transition hover:bg-cyan-100 dark:hover:bg-cyan-500/20"
              >
                <Zap size={14} />
                <span>Featured: METROPOLIS Terminal</span>
                <ArrowUpRight size={14} />
              </Link>
            </div>
          </div>

          {/* TELEMETRY KPI CARDS */}
          {summary && (
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/50 p-3 shadow-2xs">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Total Equities Scanned</div>
                <div className="mt-1 text-lg font-bold text-slate-900 dark:text-white">{summary.total_screened.toLocaleString()}</div>
                <div className="mt-0.5 text-[10px] text-cyan-600 dark:text-cyan-400">Active NSE/BSE Universe</div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/50 p-3 shadow-2xs">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Stage 2 Advancing Ratio</div>
                <div className="mt-1 text-lg font-bold text-emerald-600 dark:text-emerald-400">{summary.stage_2_ratio_pct}%</div>
                <div className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">{summary.stage_2_count} stocks above rising 50 DMA</div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/50 p-3 shadow-2xs">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Pre-Breakout Coiling Setups</div>
                <div className="mt-1 text-lg font-bold text-cyan-600 dark:text-cyan-400">Within ≤ 4.5% Pivot</div>
                <div className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">Volume dry-up footprint detected</div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-slate-900/50 p-3 shadow-2xs">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">High Conviction Buys</div>
                <div className="mt-1 text-lg font-bold text-amber-600 dark:text-amber-400">Techno-Funda Converged</div>
                <div className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">Funda Score ≥ 60 + Stage 2</div>
              </div>
            </div>
          )}
        </div>

        {/* QUICK FILTER PILLS & SEARCH TOOLBAR */}
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#081225] p-3.5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Quick Pills */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  setSignalFilter("ALL");
                  setPatternFilter("ALL");
                  setPage(1);
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  signalFilter === "ALL" && patternFilter === "ALL"
                    ? "bg-cyan-500 text-slate-950 shadow-xs"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                All Setups ({totalCount})
              </button>

              <button
                onClick={() => handleQuickFilter("signal", "STRONG_BUY")}
                className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  signalFilter === "STRONG_BUY"
                    ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                    : "bg-slate-800/80 text-emerald-400 hover:bg-slate-800 border border-emerald-500/30"
                }`}
              >
                <Flame size={13} />
                Techno-Funda Buys
              </button>

              <button
                onClick={() => handleQuickFilter("signal", "PRE_BREAKOUT")}
                className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  signalFilter === "PRE_BREAKOUT"
                    ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20"
                    : "bg-slate-800/80 text-cyan-300 hover:bg-slate-800 border border-cyan-500/30"
                }`}
              >
                <Target size={13} />
                Near Pivot (&le; 4.5%)
              </button>

              <button
                onClick={() => handleQuickFilter("pattern", "VCP")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  patternFilter === "VCP"
                    ? "bg-purple-500 text-white shadow-md shadow-purple-500/20"
                    : "bg-slate-800/80 text-purple-300 hover:bg-slate-800 border border-purple-500/30"
                }`}
              >
                VCP Coiling
              </button>

              <button
                onClick={() => handleQuickFilter("pattern", "PULLBACK")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  patternFilter === "PULLBACK"
                    ? "bg-blue-500 text-white shadow-md shadow-blue-500/20"
                    : "bg-slate-800/80 text-blue-300 hover:bg-slate-800 border border-blue-500/30"
                }`}
              >
                50 DMA Pullback
              </button>

              <button
                onClick={() => handleQuickFilter("pattern", "STAGE_2")}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  patternFilter === "STAGE_2"
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-500/20"
                    : "bg-slate-800/80 text-emerald-300 hover:bg-slate-800 border border-emerald-500/30"
                }`}
              >
                Stage 2 Leaders
              </button>
            </div>

            {/* Search Input */}
            <div className="relative min-w-[240px] flex-1 sm:max-w-xs">
              <Search size={15} className="absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search symbol, e.g. METROPOLIS..."
                className="w-full rounded-lg border border-slate-700 bg-slate-900/90 py-1.5 pl-9 pr-3 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-500"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-white"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* DATA TABLE */}
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#060D1A] shadow-xs dark:shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
              <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#09152A] text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">Symbol & Company</th>
                  <th className="px-3 py-3 font-semibold">CMP (₹)</th>
                  <th className="px-3 py-3 font-semibold">Signal</th>
                  <th className="px-3 py-3 font-semibold">From Pivot</th>
                  <th className="px-3 py-3 font-semibold">Pattern</th>
                  <th className="px-3 py-3 font-semibold">Setup Score</th>
                  <th className="px-3 py-3 font-semibold">RSI(14)</th>
                  <th className="px-3 py-3 font-semibold">Vol Q / Base Q</th>
                  <th className="px-3 py-3 font-semibold">Funda Score</th>
                  <th className="px-3 py-3 font-semibold">TTM Sales / PAT</th>
                  <th className="px-4 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono text-[12px]">
                {loading ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-slate-400 dark:text-slate-500 font-sans">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Activity className="h-6 w-6 animate-spin text-cyan-500 dark:text-cyan-400" />
                        <span>Scanning institutional price action & fundamentals...</span>
                      </div>
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-slate-400 dark:text-slate-500 font-sans">
                      No matching setups found. Try resetting your search or filter pills.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr
                      key={item.id}
                      className="transition hover:bg-slate-50 dark:hover:bg-slate-800/40 group"
                    >
                      {/* SYMBOL */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Link href={`/techno-funda/${item.symbol}`} className="block">
                            <span className="font-bold text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition hover:underline">
                              {item.symbol}
                            </span>
                            <div className="font-sans text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 max-w-[150px]">
                              {item.company_name}
                            </div>
                          </Link>
                        </div>
                      </td>

                      {/* CMP */}
                      <td className="px-3 py-3 font-bold text-slate-900 dark:text-white">
                        ₹{item.current_price?.toLocaleString()}
                        <div className="text-[10px] font-normal text-slate-500 dark:text-slate-400">
                          {item.return_3m ? `${item.return_3m > 0 ? "+" : ""}${item.return_3m}% 3M` : ""}
                        </div>
                      </td>

                      {/* SIGNAL */}
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold border ${
                            item.signal_tier === "STRONG_BUY"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : item.signal_tier === "PRE_BREAKOUT"
                              ? "bg-cyan-500/10 text-cyan-300 border-cyan-500/30"
                              : item.signal_tier === "PULLBACK"
                              ? "bg-blue-500/10 text-blue-300 border-blue-500/30"
                              : item.signal_tier === "MOMENTUM"
                              ? "bg-purple-500/10 text-purple-300 border-purple-500/30"
                              : item.signal_tier === "CAUTION"
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                              : "bg-slate-800 text-slate-400 border-slate-700"
                          }`}
                        >
                          {item.signal}
                        </span>
                      </td>

                      {/* DISTANCE TO PIVOT */}
                      <td className="px-3 py-3">
                        <div className="flex flex-col gap-1">
                          <span
                            className={`font-semibold ${
                              item.distance_to_pivot_pct <= 3.5
                                ? "text-cyan-400 font-bold"
                                : item.distance_to_pivot_pct <= 6.0
                                ? "text-emerald-400"
                                : "text-slate-300"
                            }`}
                          >
                            {item.distance_to_pivot_pct}%
                          </span>
                          <span className="text-[10px] text-slate-500">
                            Piv: ₹{item.pivot_reference}
                          </span>
                        </div>
                      </td>

                      {/* PATTERN */}
                      <td className="px-3 py-3 font-sans">
                        <span className="rounded bg-slate-800/80 px-2 py-0.5 text-[11px] text-slate-300 border border-slate-700">
                          {item.pattern}
                        </span>
                      </td>

                      {/* SETUP SCORE */}
                      <td className="px-3 py-3 font-sans">
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-bold text-xs ${
                              item.setup_score >= 80
                                ? "text-emerald-400"
                                : item.setup_score >= 65
                                ? "text-cyan-400"
                                : "text-amber-400"
                            }`}
                          >
                            {item.setup_score}/100
                          </span>
                        </div>
                      </td>

                      {/* RSI(14) */}
                      <td className="px-3 py-3">
                        <span
                          className={`font-semibold ${
                            item.rsi_14 >= 50 && item.rsi_14 <= 68
                              ? "text-emerald-400"
                              : item.rsi_14 > 72
                              ? "text-amber-400"
                              : "text-slate-400"
                          }`}
                        >
                          {item.rsi_14}
                        </span>
                      </td>

                      {/* VOL Q / BASE Q */}
                      <td className="px-3 py-3">
                        <span className="text-slate-300">{item.vol_q}</span>
                        <span className="text-slate-500"> / </span>
                        <span className="text-slate-400">{item.base_q}</span>
                      </td>

                      {/* FUNDAMENTAL HEALTH SCORE */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5 font-sans">
                          <ShieldCheck
                            size={13}
                            className={item.health_score >= 65 ? "text-emerald-400" : "text-slate-500"}
                          />
                          <span className="font-semibold text-slate-200">{item.health_score}</span>
                          {item.roce && (
                            <span className="text-[10px] text-slate-500 font-mono">
                              ({item.roce}% ROCE)
                            </span>
                          )}
                        </div>
                      </td>

                      {/* TTM GROWTH */}
                      <td className="px-3 py-3">
                        <div className="flex flex-col font-mono text-[11px]">
                          <span className={item.sales_growth_ttm && item.sales_growth_ttm > 15 ? "text-emerald-400" : "text-slate-300"}>
                            S: {item.sales_growth_ttm ?? "—"}%
                          </span>
                          <span className={item.profit_growth_ttm && item.profit_growth_ttm > 15 ? "text-emerald-400" : "text-slate-400"}>
                            P: {item.profit_growth_ttm ?? "—"}%
                          </span>
                        </div>
                      </td>

                      {/* ACTIONS */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <a
                            href={`https://in.tradingview.com/symbols/NSE-${encodeURIComponent(item.symbol)}/`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 rounded bg-cyan-500/10 border border-cyan-500/30 px-2.5 py-1 text-[11px] font-semibold text-cyan-300 hover:bg-cyan-500 hover:text-slate-950 transition"
                            title={`Open ${item.symbol} live chart directly on TradingView.com`}
                          >
                            <Activity size={12} />
                            <span>Live Chart</span>
                            <ArrowUpRight size={12} />
                          </a>

                          <Link
                            href={`/techno-funda/${item.symbol}`}
                            className="flex items-center gap-1 rounded bg-slate-800 border border-slate-700 px-2 py-1 text-[11px] font-medium text-slate-300 hover:border-cyan-500/50 hover:text-white transition"
                            title={`Deep Dive Setup Analysis for ${item.symbol}`}
                          >
                            <span>Analysis</span>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* PAGINATION */}
          <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#081225] px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
            <div>
              Showing <span className="font-semibold text-slate-900 dark:text-white">{items.length}</span> of{" "}
              <span className="font-semibold text-slate-900 dark:text-white">{totalCount}</span> setups
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1 font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40"
              >
                Previous
              </button>
              <span>
                Page <strong className="text-slate-900 dark:text-white">{page}</strong> of <strong>{totalPages}</strong>
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1 font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

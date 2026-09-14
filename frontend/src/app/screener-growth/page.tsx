"use client";

// =======================================================
// Alpha India Screener.in Growth Scanner
// Parallel Architecture - Isolated Frontend Dashboard
// Displays all Screener screenshot columns:
// S.No, Company, CMP, P/E, Mar Cap, Ind PE, PAT 12M, B.V., CMP/BV,
// OPM %, Sales growth %, Profit growth %, Profit Var 3Yrs %, Sales Var 3Yrs %,
// EPS 12M, Piotroski Scr, 3mth return %, 6mth return %, Qtr Profit Var %, NP Qtr
// =======================================================

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Search,
  ArrowUpDown,
  TrendingUp,
  ShieldCheck,
  Zap,
  Filter,
  RefreshCw,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  PieChart,
  LayoutGrid,
  Table as TableIcon,
  Star,
  Check,
  X,
} from "lucide-react";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { fetchScreenerGrowth, fetchScreenerFilters } from "@/lib/screenerApi";
import { fetchWatchlists, addStockToWatchlist } from "@/lib/watchlistApi";
import type { ScreenerGrowthCompany } from "@/types/screener";
import type { WatchlistSummary } from "@/types/watchlist";

export default function ScreenerGrowthPage() {
  const [companies, setCompanies] = useState<ScreenerGrowthCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [totalPages, setTotalPages] = useState(1);

  // Filters & Sorting
  const [search, setSearch] = useState("");
  const [sector, setSector] = useState("ALL");
  const [category, setCategory] = useState("ALL");
  const [sortBy, setSortBy] = useState("last_updated");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Preset metric toggles
  const [roce20, setRoce20] = useState(false);
  const [salesGrowth15, setSalesGrowth15] = useState(false);
  const [profitGrowth20, setProfitGrowth20] = useState(false);
  const [promoter50, setPromoter50] = useState(false);

  // View Mode: "SCREENER_DEFAULT" (exact 20 screenshot columns) vs "EXPANDED" (all institutional metrics)
  const [viewMode, setViewMode] = useState<"SCREENER_DEFAULT" | "EXPANDED">("SCREENER_DEFAULT");

  // Filter dropdown data
  const [sectorOptions, setSectorOptions] = useState<string[]>([]);
  const [summaryStats, setSummaryStats] = useState({
    total_companies: 0,
    avg_roce: 0,
    avg_sales_growth_3yr: 0,
  });

  // Watchlist integration state
  const [watchlists, setWatchlists] = useState<WatchlistSummary[]>([]);
  const [selectedStock, setSelectedStock] = useState<ScreenerGrowthCompany | null>(null);
  const [targetWatchlistId, setTargetWatchlistId] = useState<number | null>(null);
  const [selectedConfidence, setSelectedConfidence] = useState<number>(4);
  const [commentText, setCommentText] = useState<string>("");
  const [targetPrice, setTargetPrice] = useState<string>("");
  const [showWatchlistModal, setShowWatchlistModal] = useState(false);
  const [watchlistSubmitting, setWatchlistSubmitting] = useState(false);
  const [addedStocks, setAddedStocks] = useState<Record<string, boolean>>({});
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Load available watchlists
  useEffect(() => {
    fetchWatchlists()
      .then((res) => {
        if (res.success && res.watchlists.length > 0) {
          setWatchlists(res.watchlists);
          setTargetWatchlistId(res.watchlists[0].id);
        }
      })
      .catch((err) => console.error("Failed to load watchlists:", err));
  }, []);

  const handleOpenWatchlistModal = (c: ScreenerGrowthCompany) => {
    setSelectedStock(c);
    setSelectedConfidence(4);
    setCommentText(
      `Discovered via Screener Growth. CMP: ₹${c.current_price ?? "-"}, ROCE: ${c.roce ?? "-"}%`
    );
    setTargetPrice("");
    setShowWatchlistModal(true);
  };

  const handleConfirmAddToWatchlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStock || !targetWatchlistId) return;

    try {
      setWatchlistSubmitting(true);
      await addStockToWatchlist(targetWatchlistId, {
        symbol: selectedStock.symbol,
        company_name: selectedStock.company_name,
        confidence_score: selectedConfidence,
        comment: commentText.trim(),
        target_price: targetPrice ? parseFloat(targetPrice) : undefined,
      });

      const chosenWl = watchlists.find((w) => w.id === targetWatchlistId);
      const wlName = chosenWl ? chosenWl.name : "Watchlist";

      // Mark as added in table
      setAddedStocks((prev) => ({ ...prev, [selectedStock.symbol]: true }));
      setShowWatchlistModal(false);

      // Trigger toast
      setSuccessToast(`Added ${selectedStock.symbol} to "${wlName}" with ${selectedConfidence}★ conviction!`);
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to add stock to watchlist";
      alert(msg);
    } finally {
      setWatchlistSubmitting(false);
    }
  };

  // Load filter options
  useEffect(() => {
    fetchScreenerFilters()
      .then((data) => {
        if (data.success) {
          setSectorOptions(data.sectors || []);
          if (data.summary) setSummaryStats(data.summary);
        }
      })
      .catch((err) => console.error("Filter options failed:", err));
  }, []);

  // Load companies
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchScreenerGrowth({
        page,
        limit,
        search: search.trim() || undefined,
        sector: sector !== "ALL" ? sector : undefined,
        category: category !== "ALL" ? category : undefined,
        min_roce: roce20 ? 20 : undefined,
        min_sales_growth_3yr: salesGrowth15 ? 15 : undefined,
        min_profit_growth_3yr: profitGrowth20 ? 20 : undefined,
        min_promoter_holding: promoter50 ? 50 : undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
      });

      if (data.success) {
        setCompanies(data.results || []);
        setTotal(data.total || 0);
        setTotalPages(data.total_pages || 1);
      }
    } catch (err) {
      console.error("Failed to load Screener growth:", err);
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  }, [
    page,
    limit,
    search,
    sector,
    category,
    roce20,
    salesGrowth15,
    profitGrowth20,
    promoter50,
    sortBy,
    sortOrder,
  ]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function handleSort(column: string) {
    if (sortBy === column) {
      setSortOrder(sortOrder === "desc" ? "asc" : "desc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
    setPage(1);
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        {/* Top Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-slate-800/80 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-800/50 bg-emerald-950/40 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
                <Zap className="h-3 w-3 text-emerald-400" />
                SCREENER.IN ENGINE
              </span>
              <span className="text-xs uppercase tracking-wider text-slate-400">
                20-Column Official Indian Screener Layout
              </span>
            </div>

            <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Screener.in Growth Radar
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Direct Screener.in accounting layout: CMP, P/E, Mar Cap, Ind PE, PAT 12M, B.V., CMP/BV, OPM %, Multi-Year Variances, Piotroski Score, Returns &amp; Quarterly Momentum.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* View Mode Toggle */}
            <div className="flex items-center rounded-xl border border-slate-800 bg-slate-900 p-1 text-xs">
              <button
                onClick={() => setViewMode("SCREENER_DEFAULT")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold transition ${
                  viewMode === "SCREENER_DEFAULT"
                    ? "bg-cyan-500 text-slate-950 shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <TableIcon className="h-3.5 w-3.5" />
                Screener Layout
              </button>
              <button
                onClick={() => setViewMode("EXPANDED")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold transition ${
                  viewMode === "EXPANDED"
                    ? "bg-cyan-500 text-slate-950 shadow"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Expanded + Cash Flows
              </button>
            </div>

            <Link
              href="/screener-monitoring"
              className="flex items-center gap-1.5 rounded-xl border border-cyan-800/60 bg-cyan-950/40 px-3.5 py-2 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-900/60"
            >
              <TrendingUp className="h-3.5 w-3.5" />
              Live Monitor
            </Link>

            <button
              onClick={() => loadData()}
              className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-cyan-400" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Summary KPI Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Screener Equities</span>
              <PieChart className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="mt-2 text-2xl font-bold text-white">
              {summaryStats.total_companies.toLocaleString("en-IN")}
            </div>
            <div className="mt-1 text-xs text-slate-500">In independent database</div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Average ROCE</span>
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="mt-2 text-2xl font-bold text-emerald-400">
              {summaryStats.avg_roce > 0 ? `${summaryStats.avg_roce}%` : "--"}
            </div>
            <div className="mt-1 text-xs text-slate-500">Capital efficiency</div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Avg 3Y Sales Var</span>
              <TrendingUp className="h-4 w-4 text-cyan-400" />
            </div>
            <div className="mt-2 text-2xl font-bold text-cyan-400">
              {summaryStats.avg_sales_growth_3yr > 0 ? `${summaryStats.avg_sales_growth_3yr}%` : "--"}
            </div>
            <div className="mt-1 text-xs text-slate-500">Compounded 3-year variance</div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Active Filter Results</span>
              <Filter className="h-4 w-4 text-amber-400" />
            </div>
            <div className="mt-2 text-2xl font-bold text-amber-400">
              {total.toLocaleString("en-IN")}
            </div>
            <div className="mt-1 text-xs text-slate-500">Matching criteria</div>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search company or symbol (e.g. PSP Projects, CPCL, INFY, TCS)..."
                className="w-full rounded-xl border border-slate-800 bg-slate-900/90 py-2 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>

            {/* Sector Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Sector:</span>
              <select
                value={sector}
                onChange={(e) => {
                  setSector(e.target.value);
                  setPage(1);
                }}
                className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
              >
                <option value="ALL">All Sectors</option>
                {sectorOptions.map((sec) => (
                  <option key={sec} value={sec}>
                    {sec}
                  </option>
                ))}
              </select>
            </div>

            {/* Market Cap Category Pills */}
            <div className="flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-900/80 p-1">
              {["ALL", "LARGE", "MID", "SMALL", "MICRO"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setCategory(cat);
                    setPage(1);
                  }}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                    category === cat
                      ? "bg-cyan-500 text-slate-950 shadow"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Multi-Factor Presets */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80">
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
              <SlidersHorizontal className="h-3 w-3" />
              Presets:
            </span>

            <button
              onClick={() => {
                setRoce20(!roce20);
                setPage(1);
              }}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                roce20
                  ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                  : "border-slate-800 bg-slate-900 text-slate-400 hover:text-white"
              }`}
            >
              ROCE &gt; 20%
            </button>

            <button
              onClick={() => {
                setSalesGrowth15(!salesGrowth15);
                setPage(1);
              }}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                salesGrowth15
                  ? "border-cyan-500 bg-cyan-500/20 text-cyan-300"
                  : "border-slate-800 bg-slate-900 text-slate-400 hover:text-white"
              }`}
            >
              Sales Var 3Y &gt; 15%
            </button>

            <button
              onClick={() => {
                setProfitGrowth20(!profitGrowth20);
                setPage(1);
              }}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                profitGrowth20
                  ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                  : "border-slate-800 bg-slate-900 text-slate-400 hover:text-white"
              }`}
            >
              Profit Var 3Y &gt; 20%
            </button>

            <button
              onClick={() => {
                setPromoter50(!promoter50);
                setPage(1);
              }}
              className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                promoter50
                  ? "border-amber-500 bg-amber-500/20 text-amber-300"
                  : "border-slate-800 bg-slate-900 text-slate-400 hover:text-white"
              }`}
            >
              Promoter &gt; 50%
            </button>

            {(roce20 || salesGrowth15 || profitGrowth20 || promoter50 || sector !== "ALL" || category !== "ALL" || search) && (
              <button
                onClick={() => {
                  setRoce20(false);
                  setSalesGrowth15(false);
                  setProfitGrowth20(false);
                  setPromoter50(false);
                  setSector("ALL");
                  setCategory("ALL");
                  setSearch("");
                  setPage(1);
                }}
                className="text-xs text-rose-400 hover:underline ml-2"
              >
                Clear all filters
              </button>
            )}
          </div>
        </div>

        {/* 20-Column Screener Table */}
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="border-b border-slate-800 bg-[#0B1528] text-slate-400 font-semibold select-none">
                <tr>
                  <th className="px-3 py-3 w-12 text-center text-slate-500">S.No.</th>
                  <th
                    className="px-4 py-3 cursor-pointer hover:text-cyan-300"
                    onClick={() => handleSort("company_name")}
                  >
                    <div className="flex items-center gap-1">
                      <span>Company</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th
                    className="px-3 py-3 cursor-pointer hover:text-cyan-300"
                    onClick={() => handleSort("current_price")}
                  >
                    <div className="flex items-center gap-1">
                      <span>CMP Rs.</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th
                    className="px-3 py-3 cursor-pointer hover:text-cyan-300"
                    onClick={() => handleSort("stock_pe")}
                  >
                    <div className="flex items-center gap-1">
                      <span>P/E</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th
                    className="px-3 py-3 cursor-pointer hover:text-cyan-300"
                    onClick={() => handleSort("market_cap")}
                  >
                    <div className="flex items-center gap-1">
                      <span>Mar Cap Rs.Cr.</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th
                    className="px-3 py-3 cursor-pointer hover:text-cyan-300"
                    onClick={() => handleSort("industry_pe")}
                  >
                    <div className="flex items-center gap-1">
                      <span>Ind PE</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th
                    className="px-3 py-3 cursor-pointer hover:text-cyan-300"
                    onClick={() => handleSort("pat_12m")}
                  >
                    <div className="flex items-center gap-1">
                      <span>PAT 12M Rs.Cr.</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th
                    className="px-3 py-3 cursor-pointer hover:text-cyan-300"
                    onClick={() => handleSort("book_value")}
                  >
                    <div className="flex items-center gap-1">
                      <span>B.V. Rs.</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th
                    className="px-3 py-3 cursor-pointer hover:text-cyan-300"
                    onClick={() => handleSort("price_to_book")}
                  >
                    <div className="flex items-center gap-1">
                      <span>CMP / BV</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th
                    className="px-3 py-3 cursor-pointer hover:text-cyan-300"
                    onClick={() => handleSort("opm_latest")}
                  >
                    <div className="flex items-center gap-1">
                      <span>OPM %</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th
                    className="px-3 py-3 cursor-pointer hover:text-cyan-300"
                    onClick={() => handleSort("sales_growth_ttm")}
                  >
                    <div className="flex items-center gap-1">
                      <span>Sales growth %</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th
                    className="px-3 py-3 cursor-pointer hover:text-cyan-300"
                    onClick={() => handleSort("profit_growth_ttm")}
                  >
                    <div className="flex items-center gap-1">
                      <span>Profit growth %</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th
                    className="px-3 py-3 cursor-pointer hover:text-cyan-300"
                    onClick={() => handleSort("profit_growth_3yr")}
                  >
                    <div className="flex items-center gap-1">
                      <span>Profit Var 3Yrs %</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th
                    className="px-3 py-3 cursor-pointer hover:text-cyan-300"
                    onClick={() => handleSort("sales_growth_3yr")}
                  >
                    <div className="flex items-center gap-1">
                      <span>Sales Var 3Yrs %</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th
                    className="px-3 py-3 cursor-pointer hover:text-cyan-300"
                    onClick={() => handleSort("eps_12m")}
                  >
                    <div className="flex items-center gap-1">
                      <span>EPS 12M Rs.</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th
                    className="px-3 py-3 cursor-pointer hover:text-cyan-300"
                    onClick={() => handleSort("piotroski_score")}
                  >
                    <div className="flex items-center gap-1">
                      <span>Piotroski Scr</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th
                    className="px-3 py-3 cursor-pointer hover:text-cyan-300"
                    onClick={() => handleSort("return_3m")}
                  >
                    <div className="flex items-center gap-1">
                      <span>3mth return %</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th
                    className="px-3 py-3 cursor-pointer hover:text-cyan-300"
                    onClick={() => handleSort("return_6m")}
                  >
                    <div className="flex items-center gap-1">
                      <span>6mth return %</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th
                    className="px-3 py-3 cursor-pointer hover:text-cyan-300"
                    onClick={() => handleSort("quarterly_pat_yoy")}
                  >
                    <div className="flex items-center gap-1">
                      <span>Qtr Profit Var %</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th
                    className="px-3 py-3 cursor-pointer hover:text-cyan-300"
                    onClick={() => handleSort("latest_quarter_net_profit")}
                  >
                    <div className="flex items-center gap-1">
                      <span>NP Qtr Rs.Cr.</span>
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>

                  {/* Additional Columns for Expanded View */}
                  {viewMode === "EXPANDED" && (
                    <>
                      <th
                        className="px-3 py-3 cursor-pointer hover:text-cyan-300"
                        onClick={() => handleSort("roce")}
                      >
                        <div className="flex items-center gap-1">
                          <span>ROCE %</span>
                          <ArrowUpDown className="h-3 w-3" />
                        </div>
                      </th>
                      <th
                        className="px-3 py-3 cursor-pointer hover:text-cyan-300"
                        onClick={() => handleSort("roe")}
                      >
                        <div className="flex items-center gap-1">
                          <span>ROE %</span>
                          <ArrowUpDown className="h-3 w-3" />
                        </div>
                      </th>
                      <th
                        className="px-3 py-3 cursor-pointer hover:text-cyan-300"
                        onClick={() => handleSort("cfo_latest")}
                      >
                        <div className="flex items-center gap-1">
                          <span>CFO (₹ Cr)</span>
                          <ArrowUpDown className="h-3 w-3" />
                        </div>
                      </th>
                      <th
                        className="px-3 py-3 cursor-pointer hover:text-cyan-300"
                        onClick={() => handleSort("debtor_days")}
                      >
                        <div className="flex items-center gap-1">
                          <span>Debtor Days</span>
                          <ArrowUpDown className="h-3 w-3" />
                        </div>
                      </th>
                      <th
                        className="px-3 py-3 cursor-pointer hover:text-cyan-300"
                        onClick={() => handleSort("dma_50")}
                      >
                        <div className="flex items-center gap-1">
                          <span>50 DMA</span>
                          <ArrowUpDown className="h-3 w-3" />
                        </div>
                      </th>
                      <th
                        className="px-3 py-3 cursor-pointer hover:text-cyan-300"
                        onClick={() => handleSort("dma_200")}
                      >
                        <div className="flex items-center gap-1">
                          <span>200 DMA</span>
                          <ArrowUpDown className="h-3 w-3" />
                        </div>
                      </th>
                      <th
                        className="px-3 py-3 cursor-pointer hover:text-cyan-300"
                        onClick={() => handleSort("promoter_holding")}
                      >
                        <div className="flex items-center gap-1">
                          <span>Promoter %</span>
                          <ArrowUpDown className="h-3 w-3" />
                        </div>
                      </th>
                    </>
                  )}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800/80 font-mono">
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={viewMode === "EXPANDED" ? 27 : 20} className="px-4 py-4 text-center text-slate-500">
                        Loading Screener data...
                      </td>
                    </tr>
                  ))
                ) : companies.length === 0 ? (
                  <tr>
                    <td colSpan={viewMode === "EXPANDED" ? 27 : 20} className="px-6 py-12 text-center text-slate-400">
                      <p className="text-base font-semibold text-slate-300">No records found</p>
                      <p className="mt-1 text-xs text-slate-500">
                        No companies match the selected criteria, or the Screener database is currently empty.
                      </p>
                      <Link
                        href="/screener-monitoring"
                        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-cyan-500"
                      >
                        <Zap className="h-3.5 w-3.5" />
                        Sync Companies in Screener Monitor
                      </Link>
                    </td>
                  </tr>
                ) : (
                  companies.map((c, idx) => (
                    <tr
                      key={c.symbol}
                      className="hover:bg-slate-900/60 transition-colors"
                    >
                      {/* S.No. */}
                      <td className="px-3 py-3 text-center text-slate-500 font-sans text-xs">
                        {(page - 1) * limit + idx + 1}.
                      </td>

                      {/* Company & Symbol with Watchlist Action */}
                      <td className="px-4 py-3 font-sans">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-cyan-300 hover:underline cursor-pointer">
                                {c.company_name || c.symbol}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">({c.symbol})</span>
                              {c.market_cap_category && (
                                <span
                                  className={`rounded px-1.5 py-0.2 text-[9px] font-bold ${
                                    c.market_cap_category === "LARGE"
                                      ? "bg-cyan-950 text-cyan-400 border border-cyan-800/60"
                                      : c.market_cap_category === "MID"
                                      ? "bg-emerald-950 text-emerald-400 border border-emerald-800/60"
                                      : "bg-amber-950 text-amber-400 border border-amber-800/60"
                                  }`}
                                >
                                  {c.market_cap_category}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Add to Watchlist Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenWatchlistModal(c);
                            }}
                            title={`Add ${c.symbol} to Watchlist`}
                            className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-bold transition-all ${
                              addedStocks[c.symbol]
                                ? "border border-emerald-500/40 bg-emerald-500/20 text-emerald-300"
                                : "border border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/25 hover:border-amber-400 opacity-80 group-hover:opacity-100 shadow-sm"
                            }`}
                          >
                            {addedStocks[c.symbol] ? (
                              <>
                                <Check size={11} className="text-emerald-400" />
                                <span>Added</span>
                              </>
                            ) : (
                              <>
                                <Star size={11} className="fill-amber-400 text-amber-400" />
                                <span>+ Watchlist</span>
                              </>
                            )}
                          </button>
                        </div>
                      </td>

                      {/* CMP Rs. */}
                      <td className="px-3 py-3 font-semibold text-slate-200">
                        {c.current_price !== null ? c.current_price.toFixed(2) : "--"}
                      </td>

                      {/* P/E */}
                      <td className="px-3 py-3 text-slate-300">
                        {c.stock_pe !== null ? c.stock_pe.toFixed(2) : "--"}
                      </td>

                      {/* Mar Cap Rs.Cr. */}
                      <td className="px-3 py-3 text-slate-300">
                        {c.market_cap !== null ? c.market_cap.toFixed(2) : "--"}
                      </td>

                      {/* Ind PE */}
                      <td className="px-3 py-3 text-slate-400">
                        {c.industry_pe !== null ? c.industry_pe.toFixed(2) : "--"}
                      </td>

                      {/* PAT 12M Rs.Cr. */}
                      <td className="px-3 py-3 font-semibold text-slate-200">
                        {c.pat_12m !== null ? c.pat_12m.toFixed(2) : "--"}
                      </td>

                      {/* B.V. Rs. */}
                      <td className="px-3 py-3 text-slate-300">
                        {c.book_value !== null ? c.book_value.toFixed(2) : "--"}
                      </td>

                      {/* CMP / BV */}
                      <td className="px-3 py-3 text-slate-300">
                        {c.price_to_book !== null ? c.price_to_book.toFixed(2) : "--"}
                      </td>

                      {/* OPM % */}
                      <td className="px-3 py-3 text-slate-300">
                        {c.opm_latest !== null ? `${c.opm_latest.toFixed(2)}` : "--"}
                      </td>

                      {/* Sales growth % */}
                      <td className="px-3 py-3 font-semibold">
                        <span
                          className={
                            c.sales_growth_ttm && c.sales_growth_ttm > 0
                              ? "text-emerald-400"
                              : c.sales_growth_ttm && c.sales_growth_ttm < 0
                              ? "text-rose-400"
                              : "text-slate-300"
                          }
                        >
                          {c.sales_growth_ttm !== null ? c.sales_growth_ttm.toFixed(2) : "--"}
                        </span>
                      </td>

                      {/* Profit growth % */}
                      <td className="px-3 py-3 font-semibold">
                        <span
                          className={
                            c.profit_growth_ttm && c.profit_growth_ttm > 0
                              ? "text-emerald-400"
                              : c.profit_growth_ttm && c.profit_growth_ttm < 0
                              ? "text-rose-400"
                              : "text-slate-300"
                          }
                        >
                          {c.profit_growth_ttm !== null ? c.profit_growth_ttm.toFixed(2) : "--"}
                        </span>
                      </td>

                      {/* Profit Var 3Yrs % */}
                      <td className="px-3 py-3 font-semibold">
                        <span
                          className={
                            c.profit_growth_3yr && c.profit_growth_3yr > 0
                              ? "text-emerald-400"
                              : c.profit_growth_3yr && c.profit_growth_3yr < 0
                              ? "text-rose-400"
                              : "text-slate-300"
                          }
                        >
                          {c.profit_growth_3yr !== null ? c.profit_growth_3yr.toFixed(2) : "--"}
                        </span>
                      </td>

                      {/* Sales Var 3Yrs % */}
                      <td className="px-3 py-3 font-semibold">
                        <span
                          className={
                            c.sales_growth_3yr && c.sales_growth_3yr > 0
                              ? "text-emerald-400"
                              : c.sales_growth_3yr && c.sales_growth_3yr < 0
                              ? "text-rose-400"
                              : "text-slate-300"
                          }
                        >
                          {c.sales_growth_3yr !== null ? c.sales_growth_3yr.toFixed(2) : "--"}
                        </span>
                      </td>

                      {/* EPS 12M Rs. */}
                      <td className="px-3 py-3 text-slate-200">
                        {c.eps_12m !== null ? c.eps_12m.toFixed(2) : "--"}
                      </td>

                      {/* Piotroski Scr */}
                      <td className="px-3 py-3">
                        {c.piotroski_score !== null ? (
                          <span
                            className={`rounded px-1.5 py-0.5 font-bold ${
                              c.piotroski_score >= 7
                                ? "bg-emerald-950 text-emerald-400 border border-emerald-800/60"
                                : c.piotroski_score >= 5
                                ? "bg-amber-950 text-amber-400 border border-amber-800/60"
                                : "bg-rose-950 text-rose-400 border border-rose-800/60"
                            }`}
                          >
                            {c.piotroski_score.toFixed(2)}
                          </span>
                        ) : (
                          "--"
                        )}
                      </td>

                      {/* 3mth return % */}
                      <td className="px-3 py-3 font-semibold">
                        <span
                          className={
                            c.return_3m && c.return_3m > 0
                              ? "text-emerald-400"
                              : c.return_3m && c.return_3m < 0
                              ? "text-rose-400"
                              : "text-slate-400"
                          }
                        >
                          {c.return_3m !== null ? `${c.return_3m.toFixed(2)}` : "--"}
                        </span>
                      </td>

                      {/* 6mth return % */}
                      <td className="px-3 py-3 font-semibold">
                        <span
                          className={
                            c.return_6m && c.return_6m > 0
                              ? "text-emerald-400"
                              : c.return_6m && c.return_6m < 0
                              ? "text-rose-400"
                              : "text-slate-400"
                          }
                        >
                          {c.return_6m !== null ? `${c.return_6m.toFixed(2)}` : "--"}
                        </span>
                      </td>

                      {/* Qtr Profit Var % */}
                      <td className="px-3 py-3 font-semibold">
                        <span
                          className={
                            c.quarterly_pat_yoy && c.quarterly_pat_yoy > 0
                              ? "text-emerald-400"
                              : c.quarterly_pat_yoy && c.quarterly_pat_yoy < 0
                              ? "text-rose-400"
                              : "text-slate-400"
                          }
                        >
                          {c.quarterly_pat_yoy !== null ? `${c.quarterly_pat_yoy.toFixed(2)}` : "--"}
                        </span>
                      </td>

                      {/* NP Qtr Rs.Cr. */}
                      <td className="px-3 py-3 font-semibold text-slate-200">
                        {c.latest_quarter_net_profit !== null
                          ? c.latest_quarter_net_profit.toFixed(2)
                          : "--"}
                      </td>

                      {/* Additional Columns in Expanded View */}
                      {viewMode === "EXPANDED" && (
                        <>
                          <td className="px-3 py-3 font-semibold text-emerald-400">
                            {c.roce !== null ? `${c.roce.toFixed(2)}%` : "--"}
                          </td>
                          <td className="px-3 py-3 text-slate-300">
                            {c.roe !== null ? `${c.roe.toFixed(2)}%` : "--"}
                          </td>
                          <td className="px-3 py-3 text-slate-300">
                            {c.cfo_latest !== null ? c.cfo_latest.toFixed(2) : "--"}
                          </td>
                          <td className="px-3 py-3 text-slate-300">
                            {c.debtor_days !== null ? `${c.debtor_days}d` : "--"}
                          </td>
                          <td className="px-3 py-3 text-slate-400">
                            {c.dma_50 !== null ? `₹${c.dma_50.toFixed(2)}` : "--"}
                          </td>
                          <td className="px-3 py-3 text-slate-400">
                            {c.dma_200 !== null ? `₹${c.dma_200.toFixed(2)}` : "--"}
                          </td>
                          <td className="px-3 py-3 text-slate-300">
                            {c.promoter_holding !== null ? `${c.promoter_holding.toFixed(2)}%` : "--"}
                          </td>
                        </>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-slate-800 bg-slate-900/60 px-4 py-3 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span>Rows per page:</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-slate-200"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="ml-2">
                Showing {companies.length > 0 ? (page - 1) * limit + 1 : 0} to{" "}
                {Math.min(page * limit, total)} of {total.toLocaleString("en-IN")}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-300 transition hover:bg-slate-800 disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Previous
              </button>

              <span className="px-2 font-mono text-slate-300">
                {page} / {totalPages}
              </span>

              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-xs font-medium text-slate-300 transition hover:bg-slate-800 disabled:opacity-40"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* ADD TO WATCHLIST MODAL                                    */}
        {/* ========================================================= */}
        {showWatchlistModal && selectedStock && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-[#081225] p-6 shadow-2xl">
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
                    <Star size={18} className="fill-amber-400 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <span>Add to Watchlist</span>
                      <span className="rounded bg-cyan-950/70 text-cyan-300 border border-cyan-700/50 px-2 py-0.5 text-xs font-mono">
                        {selectedStock.symbol}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400 truncate max-w-xs">
                      {selectedStock.company_name || selectedStock.symbol}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowWatchlistModal(false)}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-800 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Stock Fundamentals Snapshot Bar */}
              <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs">
                <div>
                  <span className="text-[10px] uppercase text-slate-500 font-medium">CMP</span>
                  <div className="font-bold text-white font-mono">
                    {selectedStock.current_price !== null ? `₹${selectedStock.current_price.toLocaleString("en-IN")}` : "--"}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-slate-500 font-medium">ROCE</span>
                  <div className="font-bold text-emerald-400 font-mono">
                    {selectedStock.roce !== null ? `${selectedStock.roce}%` : "--"}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-slate-500 font-medium">P/E Ratio</span>
                  <div className="font-bold text-slate-300 font-mono">
                    {selectedStock.stock_pe !== null ? selectedStock.stock_pe.toFixed(1) : "--"}
                  </div>
                </div>
              </div>

              <form onSubmit={handleConfirmAddToWatchlist} className="mt-5 space-y-4">
                {/* 1. Target Watchlist Selector */}
                <div>
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Select Target Watchlist *
                  </label>
                  {watchlists.length === 0 ? (
                    <div className="mt-1 text-xs text-amber-400">
                      No watchlists found. A default watchlist will be initialized automatically.
                    </div>
                  ) : (
                    <select
                      value={targetWatchlistId ?? watchlists[0]?.id}
                      onChange={(e) => setTargetWatchlistId(Number(e.target.value))}
                      className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-xs font-semibold text-white outline-none focus:border-cyan-500"
                    >
                      {watchlists.map((wl) => (
                        <option key={wl.id} value={wl.id}>
                          {wl.name} ({wl.items_count} stocks)
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* 2. Confidence Ranking (1 to 5 Stars) */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Conviction Score (1 to 5★)
                    </label>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                        selectedConfidence === 5
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          : selectedConfidence === 4
                          ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                          : selectedConfidence === 3
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                          : "bg-slate-800 text-slate-400 border border-slate-700"
                      }`}
                    >
                      {selectedConfidence === 5
                        ? "5/5 Max Conviction"
                        : selectedConfidence === 4
                        ? "4/5 High Conviction"
                        : selectedConfidence === 3
                        ? "3/5 Moderate"
                        : `${selectedConfidence}/5 Watch`}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                    {[1, 2, 3, 4, 5].map((starVal) => {
                      const isFilled = starVal <= selectedConfidence;
                      return (
                        <button
                          key={starVal}
                          type="button"
                          onClick={() => setSelectedConfidence(starVal)}
                          className="group/star p-1 transition-transform hover:scale-125 focus:outline-none"
                        >
                          <Star
                            size={22}
                            className={`transition-colors ${
                              isFilled
                                ? selectedConfidence === 5
                                  ? "fill-emerald-400 text-emerald-400"
                                  : selectedConfidence === 4
                                  ? "fill-cyan-400 text-cyan-400"
                                  : "fill-amber-400 text-amber-400"
                                : "text-slate-700 hover:text-slate-400"
                            }`}
                          />
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Comment / Investment Thesis */}
                <div>
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Investment Thesis / Notes
                  </label>
                  <textarea
                    rows={3}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Enter catalyst rationale, quarterly momentum trigger, valuation margin of safety..."
                    className="mt-1.5 w-full resize-none rounded-xl border border-slate-700 bg-slate-900 p-3 text-xs text-white placeholder:text-slate-600 outline-none focus:border-cyan-500"
                  />
                </div>

                {/* 4. Optional Target Price */}
                <div>
                  <label className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                    Target Buy / Exit Price (₹) - Optional
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(e.target.value)}
                    placeholder="e.g. 1450"
                    className="mt-1.5 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-white placeholder:text-slate-600 outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Modal Actions */}
                <div className="mt-6 flex justify-end gap-3 border-t border-slate-800 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowWatchlistModal(false)}
                    className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={watchlistSubmitting}
                    className="flex items-center gap-2 rounded-xl border border-amber-500/50 bg-amber-500/20 px-5 py-2 text-xs font-bold text-amber-300 hover:bg-amber-500/30 hover:border-amber-400 transition-all shadow-md shadow-amber-500/10"
                  >
                    {watchlistSubmitting ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
                    ) : (
                      <Star size={14} className="fill-amber-400" />
                    )}
                    <span>Confirm Add to Watchlist</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* SUCCESS FLOATING TOAST                                    */}
        {/* ========================================================= */}
        {successToast && (
          <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border border-emerald-500/40 bg-[#081225] px-4 py-3 shadow-2xl backdrop-blur-xl">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
              <Check size={16} />
            </div>
            <span className="text-xs font-bold text-slate-200">{successToast}</span>
            <Link
              href="/watchlist"
              className="ml-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-bold text-cyan-300 hover:bg-cyan-500/20"
            >
              Open Watchlist →
            </Link>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

"use client";

// =======================================================
// Alpha India Home Dashboard — Growth Screener PRO
// Institutional Bloomberg Terminal
// Sprint 33.4.2 — Real Financial Warehouse & Yahoo Intelligence
// =======================================================

import { useEffect, useState, useCallback } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import ScreenerToolbar from "@/components/layout/screener/ScreenerToolbar";
import GrowthTable, {
  type TableDensity,
} from "@/components/layout/screener/GrowthTable";
import WatchlistModal from "@/components/layout/screener/WatchlistModal";

import {
  fetchGrowthScreener,
  fetchGrowthFilters,
  type GrowthCompany,
  type ScreenerFiltersState,
} from "@/lib/api";
import { fetchWatchlists } from "@/lib/watchlistApi";
import type { WatchlistSummary } from "@/types/watchlist";

const initialFilters: ScreenerFiltersState = {
  sector: "ALL",
  exchange: "ALL",
  market_cap_category: "ALL",
  pe_range: "ALL",
  pb_range: "ALL",
  roce_min: "ALL",
  roe_min: "ALL",
  health_score_range: "ALL",
  watchlist_only: false,
  min_conviction: "ALL",
};

export default function HomePage() {
  // =====================================================
  // State
  // =====================================================
  const [companies, setCompanies] = useState<GrowthCompany[]>([]);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [totalCompanies, setTotalCompanies] = useState(0);

  // Debounce search input by 350ms to eliminate multi-fetch on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Watchlist integration state
  const [watchlists, setWatchlists] = useState<WatchlistSummary[]>([]);
  const [selectedCompanyForWatchlist, setSelectedCompanyForWatchlist] = useState<GrowthCompany | null>(null);
  const [isWatchlistModalOpen, setIsWatchlistModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Table Density (Compact | Default)
  const [density, setDensity] = useState<TableDensity>("default");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("alpha_india_table_density");
      if (saved === "compact" || saved === "default") {
        setDensity(saved);
      }
    } catch {
      // ignore
    }
  }, []);

  const handleDensityChange = (newDensity: TableDensity) => {
    setDensity(newDensity);
    try {
      localStorage.setItem("alpha_india_table_density", newDensity);
    } catch {
      // ignore
    }
  };

  // Sorting state (server-side)
  const [sortBy, setSortBy] = useState("market_cap");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Filters state
  const [filters, setFilters] = useState<ScreenerFiltersState>(initialFilters);
  const [availableSectors, setAvailableSectors] = useState<string[]>([]);

  // =====================================================
  // Load Watchlists & Available Filter Options
  // =====================================================
  const loadWatchlists = useCallback(async () => {
    try {
      const res = await fetchWatchlists();
      if (res.watchlists) setWatchlists(res.watchlists);
    } catch (err) {
      console.warn("Could not load watchlists:", err);
    }
  }, []);

  useEffect(() => {
    loadWatchlists();
  }, [loadWatchlists]);

  useEffect(() => {
    async function loadFilterOptions() {
      try {
        const data = await fetchGrowthFilters();
        if (data.sectors && Array.isArray(data.sectors)) {
          setAvailableSectors(data.sectors);
        }
      } catch (err) {
        console.warn("Could not load dynamic filter sectors:", err);
      }
    }
    loadFilterOptions();
  }, []);

  // =====================================================
  // Watchlist Update Handler
  // =====================================================
  const handleWatchlistUpdated = (
    symbol: string,
    action: "added" | "updated" | "removed",
    data?: {
      watchlistId: number;
      watchlistName: string;
      convictionScore: number;
      comment?: string;
      targetPrice?: number | null;
    }
  ) => {
    // Optimistic update in table
    setCompanies((prev) =>
      prev.map((c) => {
        if (c.symbol === symbol) {
          if (action === "removed") {
            return {
              ...c,
              in_watchlist: false,
              watchlist_item_id: null,
              watchlist_id: null,
              watchlist_name: null,
              conviction_score: null,
              watchlist_comment: null,
              target_price: null,
            };
          } else {
            return {
              ...c,
              in_watchlist: true,
              watchlist_id: data?.watchlistId,
              watchlist_name: data?.watchlistName,
              conviction_score: data?.convictionScore,
              watchlist_comment: data?.comment,
              target_price: data?.targetPrice,
            };
          }
        }
        return c;
      })
    );

    // Toast
    if (action === "removed") {
      setToastMessage(`Removed ${symbol} from watchlist`);
    } else {
      setToastMessage(
        `★ ${symbol} ${action === "updated" ? "updated in" : "saved to"} ${data?.watchlistName ?? "Watchlist"} (${data?.convictionScore ?? 3}★ Conviction)`
      );
    }
    setTimeout(() => setToastMessage(null), 4000);

    loadWatchlists();
  };

  // =====================================================
  // Fetch Screener Data (Server-Side)
  // =====================================================
  const loadCompanies = useCallback(
    async (currentPage = page, currentLimit = limit, currentSearch = debouncedSearch) => {
      setLoading(true);

      try {
        const data = await fetchGrowthScreener(
          currentPage,
          currentLimit,
          currentSearch,
          sortBy,
          sortOrder,
          filters
        );

        setCompanies(data.results || []);
        setTotalCompanies(data.total || 0);
      } catch (error) {
        console.error("Failed to load Growth Screener:", error);
        setCompanies([]);
        setTotalCompanies(0);
      } finally {
        setLoading(false);
      }
    },
    [page, limit, debouncedSearch, sortBy, sortOrder, filters]
  );

  // Reload when page, limit, sort, filters, or debouncedSearch change
  useEffect(() => {
    loadCompanies(page, limit, debouncedSearch);
  }, [loadCompanies, page, limit, sortBy, sortOrder, filters, debouncedSearch]);

  // =====================================================
  // Handlers
  // =====================================================
  function handleSearch() {
    setDebouncedSearch(search);
    setPage(1);
  }

  function handleFilterChange(key: keyof ScreenerFiltersState, value: string | number | boolean) {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
    setPage(1);
  }


  function handleResetFilters() {
    setFilters(initialFilters);
    setSearch("");
    setDebouncedSearch("");
    setPage(1);
  }


  function handleSort(column: string) {
    if (column === sortBy) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
    setPage(1);
  }

  function handleLimitChange(newLimit: number) {
    setLimit(newLimit);
    setPage(1);
  }

  // =====================================================
  // Export CSV
  // =====================================================
  function handleExportCSV() {
    if (companies.length === 0) return;

    const headers = [
      "Index",
      "Symbol",
      "Company",
      "Sector",
      "Exchange",
      "CMP (INR)",
      "Market Cap (Cr)",
      "PE Ratio",
      "Ind PE",
      "PB Ratio",
      "ROCE (%)",
      "ROE (%)",
      "OPM (%)",
      "Sales Growth YoY (%)",
      "Sales Growth QoQ (%)",
      "Profit Growth YoY (%)",
      "Profit Growth QoQ (%)",
      "Sales 3Y CAGR (%)",
      "Profit 3Y CAGR (%)",
      "Health Score",
    ];

    const rows = companies.map((c, i) => [
      c.index || i + 1,
      `"${c.symbol}"`,
      `"${(c.company || "").replace(/"/g, '""')}"`,
      `"${c.sector || ""}"`,
      c.exchange || "NSE",
      c.cmp ?? "",
      c.market_cap ?? "",
      c.pe_ratio ?? "",
      c.industry_pe ?? 24.7,
      c.pb_ratio ?? "",
      c.roce ?? "",
      c.roe ?? "",
      c.opm ?? "",
      c.sales_growth_yoy ?? "",
      c.sales_growth_qoq ?? "",
      c.profit_growth_yoy ?? "",
      c.profit_growth_qoq ?? "",
      c.sales_cagr_3y ?? "",
      c.profit_cagr_3y ?? "",
      c.health_score ?? "",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `alpha_india_growth_screener_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const totalPages = Math.max(1, Math.ceil(totalCompanies / limit));

  // =====================================================
  // Render
  // =====================================================
  return (
    <DashboardLayout>
      <div className="space-y-3">
        {/* Dynamic Filter Toolbar */}
        <ScreenerToolbar
          search={search}
          setSearch={setSearch}
          onSearch={handleSearch}
          filters={filters}
          onFilterChange={handleFilterChange}
          onResetFilters={handleResetFilters}
          onExportCSV={handleExportCSV}
          availableSectors={availableSectors}
          totalResults={totalCompanies}
          density={density}
          onDensityChange={handleDensityChange}
        />

        {/* Enterprise Grouped Column Growth Table */}
        <GrowthTable
          companies={companies}
          loading={loading}
          page={page}
          totalPages={totalPages}
          totalCompanies={totalCompanies}
          limit={limit}
          onLimitChange={handleLimitChange}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={handleSort}
          onPrevious={() => setPage((prev) => Math.max(prev - 1, 1))}
          onNext={() => setPage((prev) => Math.min(prev + 1, totalPages))}
          onFirst={() => setPage(1)}
          onLast={() => setPage(totalPages)}
          density={density}
          onOpenWatchlist={(company) => {
            setSelectedCompanyForWatchlist(company);
            setIsWatchlistModalOpen(true);
          }}
        />

        {/* Watchlist & Conviction Score Modal */}
        <WatchlistModal
          isOpen={isWatchlistModalOpen}
          onClose={() => setIsWatchlistModalOpen(false)}
          company={selectedCompanyForWatchlist}
          watchlists={watchlists}
          onWatchlistUpdated={handleWatchlistUpdated}
          onRefreshWatchlists={loadWatchlists}
        />

        {/* Floating Toast Notification */}
        {toastMessage && (
          <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl border border-amber-500/40 bg-slate-900/95 px-4 py-3 text-xs font-semibold text-amber-400 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-3 duration-200">
            <span className="flex h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
            <span>{toastMessage}</span>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
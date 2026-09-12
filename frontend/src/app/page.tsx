"use client";

// =======================================================
// Alpha India Home Dashboard
// Sprint 33.4.1 — GAP-03 COMPLETE
// Enterprise Server-Side Sorting
// =======================================================

import { useEffect, useState } from "react";

import DashboardLayout from "@/components/layout/DashboardLayout";
import MarketTicker from "@/components/layout/MarketTicker";

import ScreenerToolbar from "@/components/layout/screener/ScreenerToolbar";
import GrowthTable from "@/components/layout/screener/GrowthTable";

import {
  fetchGrowthScreener,
  type GrowthCompany,
} from "@/lib/api";

export default function HomePage() {
  // =====================================================
  // State
  // =====================================================

  const [companies, setCompanies] = useState<GrowthCompany[]>([]);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [totalCompanies, setTotalCompanies] = useState(0);

  // Sprint 33.4.1 — Server-side sorting
  const [sortBy, setSortBy] = useState("revenue_growth");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  const limit = 25;

  // =====================================================
  // Load Screener
  // =====================================================

  async function loadCompanies(searchValue: string = search) {
    setLoading(true);

    try {
      const data = await fetchGrowthScreener(
        page,
        limit,
        searchValue,
        sortBy,
        sortOrder
      );

      setCompanies(data.results);
      setTotalCompanies(data.total);
    } catch (error) {
      console.error("Failed to load Growth Screener:", error);
      setCompanies([]);
      setTotalCompanies(0);
    } finally {
      setLoading(false);
    }
  }

  // Reload when page or sorting changes
  useEffect(() => {
    loadCompanies(search);
  }, [page, sortBy, sortOrder]);

  // =====================================================
  // Search
  // =====================================================

  function handleSearch() {
    setPage(1);
    loadCompanies(search);
  }

  // =====================================================
  // Sorting
  // =====================================================

  function handleSort(column: string) {
    if (column === sortBy) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }

    // Always start from page 1 after sorting
    setPage(1);
  }

  const totalPages = Math.max(
    1,
    Math.ceil(totalCompanies / limit)
  );

  // =====================================================
  // Render
  // =====================================================

  return (
    <DashboardLayout>
      {/* Bloomberg Market Ribbon */}
      <MarketTicker />

      <div className="space-y-6">
        {/* Executive Header */}
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-cyan-400">
            Alpha India v2.3.0
          </p>

          <h1 className="mt-2 text-4xl font-bold text-white">
            Growth Screener PRO
          </h1>

          <p className="mt-2 text-slate-400">
            Discover India's fastest-growing listed companies using Alpha India's
            quarterly financial warehouse and AI-powered growth engine.
          </p>
        </div>

        {/* Toolbar */}
        <ScreenerToolbar
          search={search}
          setSearch={setSearch}
          onSearch={handleSearch}
        />

        {/* Growth Screener Table */}
        <GrowthTable
          companies={companies}
          loading={loading}
          page={page}
          totalPages={totalPages}
          totalCompanies={totalCompanies}
          limit={limit}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={handleSort}
          onPrevious={() =>
            setPage((prev) => Math.max(prev - 1, 1))
          }
          onNext={() =>
            setPage((prev) =>
              Math.min(prev + 1, totalPages)
            )
          }
        />
      </div>
    </DashboardLayout>
  );
}
"use client";

import { useEffect, useState } from "react";

import DashboardLayout from "@/components/layout/DashboardLayout";
import MarketTicker from "@/components/layout/MarketTicker";
import MonitoringRibbon from "@/components/layout/MonitoringRibbon";
import KPICards from "@/components/layout/KPICards";
import GrowthTable from "@/components/layout/screener/GrowthTable";

import { fetchCompanies, Company } from "@/lib/api";

export default function HomePage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const [totalCompanies, setTotalCompanies] = useState(0);

  const limit = 25;

  // Load companies whenever page changes
  useEffect(() => {
    loadCompanies(search);
  }, [page]);

  // Fetch companies from backend
  async function loadCompanies(searchValue: string = search) {
    setLoading(true);

    try {
      const data = await fetchCompanies(page, limit, searchValue);
      setCompanies(data.results);
      setTotalCompanies(data.total);
    } catch (error) {
      console.error("Failed to load companies:", error);
      setCompanies([]);
      setTotalCompanies(0);
    } finally {
      setLoading(false);
    }
  }

  // Search handler
  function handleSearch() {
    setPage(1);
    loadCompanies(search);
  }

  const totalPages = Math.max(1, Math.ceil(totalCompanies / limit));

  return (
    <DashboardLayout>
      {/* Bloomberg Live Market Ribbon */}
      <MarketTicker />

      {/* Monitoring Engine */}
      <MonitoringRibbon />

      {/* KPI Cards */}
      <KPICards />

      {/* Search Toolbar */}
      <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">
              Company Search
            </h2>

            <p className="mt-1 text-sm text-slate-400">
              Search companies from Alpha India's live NSE & BSE database.
            </p>
          </div>

          <div className="flex w-full gap-3 lg:w-auto">
            <input
              type="text"
              placeholder="Search company name or symbol..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSearch();
              }}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder:text-slate-500 outline-none transition focus:border-emerald-500 lg:w-80"
            />

            <button
              onClick={handleSearch}
              className="rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white transition hover:bg-emerald-700"
            >
              Search
            </button>
          </div>
        </div>
      </section>

      {/* Growth Screener Table */}
      <GrowthTable
        companies={companies}
        loading={loading}
        page={page}
        totalPages={totalPages}
        totalCompanies={totalCompanies}
        limit={limit}
        onPrevious={() => setPage((prev) => Math.max(prev - 1, 1))}
        onNext={() => setPage((prev) => Math.min(prev + 1, totalPages))}
      />
    </DashboardLayout>
  );
}
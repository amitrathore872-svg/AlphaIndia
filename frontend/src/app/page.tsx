"use client";

// =======================================================
// Alpha India Dashboard
// Sprint 32.8.1 (Stable)
// Growth Screener PRO Dashboard
// =======================================================

import { useEffect, useState } from "react";

import DashboardLayout from "@/components/layout/DashboardLayout";
import MarketTicker from "@/components/layout/MarketTicker";
import MonitoringRibbon from "@/components/layout/MonitoringRibbon";
import KPICards from "@/components/layout/KPICards";

import ScreenerToolbar from "@/components/layout/screener/ScreenerToolbar";
import GrowthTable from "@/components/layout/screener/GrowthTable";

import {
  fetchGrowthScreener,
  GrowthCompany,
} from "@/lib/api";

export default function HomePage() {
  const [companies, setCompanies] = useState<GrowthCompany[]>([]);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const [totalCompanies, setTotalCompanies] = useState(0);

  const limit = 25;

  useEffect(() => {
    loadCompanies(search);
  }, [page]);

  async function loadCompanies(searchValue: string = search) {
    setLoading(true);

    try {
      const data = await fetchGrowthScreener(page, limit, searchValue);

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

  function handleSearch() {
    setPage(1);
    loadCompanies(search);
  }

  const totalPages = Math.max(1, Math.ceil(totalCompanies / limit));

  return (
    <DashboardLayout>
      {/* Bloomberg Market Ribbon */}
      <MarketTicker />

      {/* Live Monitoring Center */}
      <MonitoringRibbon />

      {/* KPI Dashboard */}
      <KPICards />

      {/* Growth Screener Toolbar */}
      <ScreenerToolbar
        search={search}
        setSearch={setSearch}
        onSearch={handleSearch}
      />

      {/* Growth Screener PRO */}
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
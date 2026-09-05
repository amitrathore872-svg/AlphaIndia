"use client";

import { useEffect, useState } from "react";

import DashboardLayout from "@/components/layout/DashboardLayout";
import Header from "@/components/layout/Header";
import KPICards from "@/components/layout/KPICards";

import Filters from "@/components/screener/Filters";
import GrowthTable from "@/components/screener/GrowthTable";
import Pagination from "@/components/screener/Pagination";

import { fetchCompanies } from "@/lib/api";

export interface Company {
  id: number;
  symbol: string;
  company: string;
  sector: string;
  market_cap: string;
  revenue_growth: number;
  pat_growth: number;
  roce: number;
  ai_score: number;
}

export default function HomePage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");

  const [page, setPage] = useState(1);
  const limit = 50;

  const [totalCompanies, setTotalCompanies] = useState(0);

  // -----------------------------
  // Load companies from backend
  // -----------------------------
  useEffect(() => {
    async function loadCompanies() {
      try {
        setLoading(true);

        const data = await fetchCompanies(search, page, limit);

        setCompanies(data.companies);
        setTotalCompanies(data.total);
      } catch (err) {
        console.error("Failed to load companies", err);
      } finally {
        setLoading(false);
      }
    }

    loadCompanies();
  }, [search, page]);

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* Top Header */}
        <Header />

        {/* KPI Cards */}
        <KPICards
          totalCompanies={totalCompanies}
          displayedCompanies={companies.length}
          currentPage={page}
        />

        {/* Search Filters */}
        <Filters
          search={search}
          setSearch={(value: string) => {
            setPage(1);
            setSearch(value);
          }}
        />

        {/* Company Table */}
        {loading ? (
          <div className="bg-slate-900 rounded-xl p-10 text-center text-slate-400">
            Loading NSE Companies...
          </div>
        ) : (
          <GrowthTable companies={companies} />
        )}

        {/* Pagination */}
        <Pagination
          page={page}
          total={totalCompanies}
          limit={limit}
          onPageChange={setPage}
        />

      </div>
    </DashboardLayout>
  );
}
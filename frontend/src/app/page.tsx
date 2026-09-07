
"use client";

import { useEffect, useState } from "react";

import DashboardLayout from "@/components/layout/DashboardLayout";
import Header from "@/components/layout/Header";
import KPICards from "@/components/layout/KPICards";
import GrowthTable from "@/components/screener/GrowthTable";

import { fetchCompanies } from "@/lib/api";

import type { Company } from "@/types/growth";

export default function HomePage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [totalCompanies, setTotalCompanies] = useState(0);
  const [page, setPage] = useState(1);

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadCompanies() {
    try {
      setLoading(true);

      const response = await fetchCompanies(search, page);

      setCompanies(response.data ?? []);
      setTotalCompanies(response.total ?? 0);
    } catch (error) {
      console.error("Failed to load companies:", error);
      setCompanies([]);
      setTotalCompanies(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCompanies();
  }, [page, search]);

  return (
    <DashboardLayout>
      <Header
        search={search}
        setSearch={setSearch}
      />

      <div className="space-y-6">
        <KPICards
          totalCompanies={totalCompanies}
          displayedCompanies={companies.length}
          currentPage={page}
        />

        {loading ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-8 text-center text-slate-400">
            Loading NSE companies...
          </div>
        ) : (
          <GrowthTable companies={companies} />
        )}
      </div>
    </DashboardLayout>
  );
}
"use client";

import { useEffect, useState } from "react";
import { fetchDashboardSummary } from "@/lib/api";

interface DashboardSummary {
  total_companies: number;
  growth_companies: number;
  sectors: number;
  latest_results: number;
}

interface Props {
  totalCompanies: number;
  displayedCompanies: number;
  currentPage: number;
}

export default function KPICards({
  totalCompanies,
  displayedCompanies,
  currentPage,
}: Props) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    async function loadSummary() {
      try {
        const data = await fetchDashboardSummary();
        setSummary(data);
      } catch (err) {
        console.error("Dashboard summary failed", err);
      }
    }

    loadSummary();
  }, []);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card
        title="Total NSE Companies"
        value={summary?.total_companies ?? totalCompanies}
      />

      <Card
        title="Growth Companies"
        value={summary?.growth_companies ?? 0}
      />

      <Card
        title="Sectors Covered"
        value={summary?.sectors ?? 0}
      />

      <Card
        title="Current Page"
        value={`${currentPage} (${displayedCompanies})`}
      />
    </div>
  );
}

function Card({ title, value }: { title: string; value: string | number }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
      <p className="text-slate-400 text-sm">{title}</p>
      <h2 className="text-2xl font-bold text-white mt-2">{value}</h2>
    </div>
  );
}
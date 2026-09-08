"use client";

import { useEffect, useState } from "react";
import { Building2, Landmark, Activity, BarChart3 } from "lucide-react";
import { fetchDashboardSummary } from "@/lib/api";

interface DashboardSummary {
  total_companies: number;
  active_companies: number;
  nse_companies: number;
  bse_companies: number;
}

export default function KPICards() {
  const [summary, setSummary] = useState<DashboardSummary>({
    total_companies: 0,
    active_companies: 0,
    nse_companies: 0,
    bse_companies: 0,
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadSummary() {
      try {
        const data = await fetchDashboardSummary();
        setSummary(data);
      } catch (err) {
        console.error("Dashboard summary failed:", err);
      } finally {
        setLoading(false);
      }
    }

    loadSummary();
  }, []);

  const cards = [
    {
      title: "Total Companies",
      value: summary.total_companies,
      icon: Building2,
      color: "text-emerald-400",
      bg: "from-emerald-900/20 to-slate-900",
    },
    {
      title: "Active Companies",
      value: summary.active_companies,
      icon: Activity,
      color: "text-sky-400",
      bg: "from-sky-900/20 to-slate-900",
    },
    {
      title: "NSE Listed",
      value: summary.nse_companies,
      icon: BarChart3,
      color: "text-orange-400",
      bg: "from-orange-900/20 to-slate-900",
    },
    {
      title: "BSE Listed",
      value: summary.bse_companies,
      icon: Landmark,
      color: "text-violet-400",
      bg: "from-violet-900/20 to-slate-900",
    },
  ];

  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <div
            key={card.title}
            className={`rounded-2xl border border-slate-800 bg-gradient-to-br ${card.bg} p-6 shadow-lg transition-all duration-200 hover:border-emerald-600 hover:shadow-emerald-900/20`}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wider text-slate-400">
                {card.title}
              </p>

              <Icon className={`h-6 w-6 ${card.color}`} />
            </div>

            <h2 className={`mt-4 text-3xl font-bold ${card.color}`}>
              {loading ? "--" : card.value.toLocaleString("en-IN")}
            </h2>

            <p className="mt-2 text-xs text-slate-500">
              Alpha India Master Database
            </p>
          </div>
        );
      })}
    </div>
  );
}
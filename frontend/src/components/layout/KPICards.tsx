
"use client";

import { useEffect, useState } from "react";
import { fetchDashboardSummary } from "@/lib/api";

interface DashboardSummary {
  companiesTracked: number;
  resultsToday: number;
  averageGrowthScore: number;
  currentLeader: {
    name: string;
    score: number;
  } | null;
  highGrowthStocks: number;
}

export default function KPICards() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    async function loadSummary() {
      try {
        const data = await fetchDashboardSummary();
        setSummary(data);
      } catch (err) {
        console.error("Dashboard summary failed:", err);
      }
    }

    loadSummary();
  }, []);

  const cards = [
    {
      title: "Total NSE Companies",
      value: summary?.companiesTracked ?? 0,
    },
    {
      title: "Results Today",
      value: summary?.resultsToday ?? 0,
    },
    {
      title: "Average Growth Score",
      value: summary?.averageGrowthScore ?? 0,
    },
    {
      title: "Current Leader",
      value: summary?.currentLeader
        ? `${summary.currentLeader.name} (${summary.currentLeader.score})`
        : "-",
    },
    {
      title: "High Growth Stocks",
      value: summary?.highGrowthStocks ?? 0,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-5">
      {cards.map((card) => (
        <div
          key={card.title}
          className="rounded-xl border border-slate-800 bg-slate-900/70 p-5"
        >
          <p className="text-xs uppercase text-slate-400">{card.title}</p>
          <h2 className="mt-2 text-2xl font-bold text-emerald-400">
            {card.value}
          </h2>
        </div>
      ))}
    </div>
  );
}
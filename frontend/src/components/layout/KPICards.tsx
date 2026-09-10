"use client";

import { useEffect, useState } from "react";
import {
  Building2,
  CircleCheck,
  Landmark,
  BarChart3,
  Rocket,
  FileSpreadsheet,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

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
    loadSummary();

    const timer = setInterval(loadSummary, 30000);
    return () => clearInterval(timer);
  }, []);

  async function loadSummary() {
    try {
      const response = await fetch(
        `${API_URL}/companies/dashboard-summary`,
        {
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error(`API Error (${response.status})`);
      }

      const data = await response.json();

      // Compatible with Sprint 23 (v0.9.4) and Sprint 28 backend.
      setSummary({
        total_companies: data.total_companies ?? data.total ?? 0,
        active_companies:
          data.active_companies ??
          data.total_active ??
          data.total_companies ??
          data.total ??
          0,
        nse_companies: data.nse_companies ?? data.nse ?? 0,
        bse_companies: data.bse_companies ?? data.bse ?? 0,
      });
    } catch (error) {
      console.error("Dashboard summary failed:", error);

      setSummary({
        total_companies: 0,
        active_companies: 0,
        nse_companies: 0,
        bse_companies: 0,
      });
    } finally {
      setLoading(false);
    }
  }

  const cards = [
    {
      title: "Total Companies",
      value: (summary.total_companies ?? 0).toLocaleString(),
      icon: Building2,
      color: "emerald",
      subtitle: "NSE + BSE Universe",
    },
    {
      title: "Active Companies",
      value: (summary.active_companies ?? 0).toLocaleString(),
      icon: CircleCheck,
      color: "green",
      subtitle: "Currently Listed",
    },
    {
      title: "NSE Listed",
      value: (summary.nse_companies ?? 0).toLocaleString(),
      icon: BarChart3,
      color: "cyan",
      subtitle: "National Stock Exchange",
    },
    {
      title: "BSE Listed",
      value: (summary.bse_companies ?? 0).toLocaleString(),
      icon: Landmark,
      color: "blue",
      subtitle: "Bombay Stock Exchange",
    },
    {
      title: "Growth Opportunities",
      value: "128",
      icon: Rocket,
      color: "amber",
      subtitle: "AI Growth Score ≥ 80",
    },
    {
      title: "Results Today",
      value: "42",
      icon: FileSpreadsheet,
      color: "purple",
      subtitle: "Quarterly Results Today",
    },
  ];

  const colorMap = {
    emerald: {
      icon: "text-emerald-400",
      bg: "from-emerald-500/15 to-emerald-700/5",
      border: "border-emerald-500/20",
      value: "text-emerald-400",
    },
    green: {
      icon: "text-green-400",
      bg: "from-green-500/15 to-green-700/5",
      border: "border-green-500/20",
      value: "text-green-400",
    },
    cyan: {
      icon: "text-cyan-400",
      bg: "from-cyan-500/15 to-cyan-700/5",
      border: "border-cyan-500/20",
      value: "text-cyan-400",
    },
    blue: {
      icon: "text-blue-400",
      bg: "from-blue-500/15 to-blue-700/5",
      border: "border-blue-500/20",
      value: "text-blue-400",
    },
    amber: {
      icon: "text-amber-400",
      bg: "from-amber-500/15 to-amber-700/5",
      border: "border-amber-500/20",
      value: "text-amber-400",
    },
    purple: {
      icon: "text-purple-400",
      bg: "from-purple-500/15 to-purple-700/5",
      border: "border-purple-500/20",
      value: "text-purple-400",
    },
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">
            Market Overview
          </h2>
          <p className="text-sm text-slate-400">
            Live statistics from the Alpha India database.
          </p>
        </div>

        <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
          {loading ? "Updating..." : "LIVE DATABASE"}
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          const theme = colorMap[card.color as keyof typeof colorMap];

          return (
            <div
              key={card.title}
              className={`rounded-2xl border ${theme.border}
                bg-gradient-to-br ${theme.bg}
                p-5 transition-all duration-300
                hover:-translate-y-1 hover:border-slate-600 hover:shadow-xl hover:shadow-slate-900/50`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
                    {card.title}
                  </p>

                  <h3 className={`mt-3 text-4xl font-bold ${theme.value}`}>
                    {loading ? "--" : card.value}
                  </h3>

                  <p className="mt-2 text-sm text-slate-400">
                    {card.subtitle}
                  </p>
                </div>

                <div
                  className={`rounded-2xl border ${theme.border} bg-slate-950/40 p-4`}
                >
                  <Icon className={`h-8 w-8 ${theme.icon}`} />
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-slate-800 pt-4">
                <span className="text-xs text-slate-500">
                  ALPHA INDIA v0.9.5
                </span>

                <span className={`text-xs font-semibold ${theme.icon}`}>
                  {loading ? "Syncing" : "Updated"}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
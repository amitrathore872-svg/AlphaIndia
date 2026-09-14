"use client";

import { TrendingUp, TrendingDown, Activity } from "lucide-react";

const marketData = [
  {
    name: "NIFTY 50",
    value: "24,918.40",
    change: "+1.24%",
    positive: true,
  },
  {
    name: "SENSEX",
    value: "81,903.18",
    change: "+0.98%",
    positive: true,
  },
  {
    name: "BANK NIFTY",
    value: "55,220.15",
    change: "-0.32%",
    positive: false,
  },
  {
    name: "INDIA VIX",
    value: "13.52",
    change: "-2.50%",
    positive: false,
  },
  {
    name: "USD / INR",
    value: "₹87.45",
    change: "+0.08%",
    positive: true,
  },
  {
    name: "GOLD (10g)",
    value: "₹1,03,600",
    change: "+0.45%",
    positive: true,
  },
];

export default function MarketTicker() {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-lg">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-slate-800 px-3.5 py-2.5 sm:px-5 sm:py-3">
        <Activity className="h-4 w-4 sm:h-5 sm:w-5 animate-pulse text-emerald-400" />

        <h3 className="text-xs sm:text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">
          Live Indian Markets
        </h3>
      </div>

      {/* Market Cards: 2-col on mobile, 3-col on tablet, 6-col on desktop */}
      <div className="grid grid-cols-2 gap-px bg-slate-800 sm:grid-cols-3 lg:grid-cols-6">
        {marketData.map((item) => (
          <div
            key={item.name}
            className="bg-slate-900 p-3 sm:p-4 transition hover:bg-slate-800"
          >
            <p className="text-[10px] sm:text-[11px] uppercase tracking-wider text-slate-500 truncate">
              {item.name}
            </p>

            <h4 className="mt-1.5 text-base sm:text-lg font-bold tracking-tight text-white">
              {item.value}
            </h4>

            <div
              className={`mt-1.5 flex items-center gap-1 text-xs sm:text-sm font-semibold ${
                item.positive ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {item.positive ? (
                <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              )}

              {item.change}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="border-t border-slate-800 bg-slate-950 px-3.5 py-1.5 sm:px-5 sm:py-2 text-[10px] sm:text-xs text-slate-500">
        Refresh Interval: 15 seconds (Live NSE integration coming in Sprint 5.0)
      </div>
    </section>
  );
}
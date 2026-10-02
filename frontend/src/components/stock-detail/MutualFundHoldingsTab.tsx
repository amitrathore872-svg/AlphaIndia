"use client";

import React, { useState } from "react";
import {
  Building2,
  TrendingUp,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  Search,
  Filter,
  Users,
} from "lucide-react";

interface MutualFundHoldingsTabProps {
  symbol?: string;
  totalSchemes?: number;
  totalValueCr?: number;
  floatAbsorptionPct?: number;
  netInflowMoMCr?: number;
}

export default function MutualFundHoldingsTab({
  symbol = "STOCK",
  totalSchemes = 42,
  totalValueCr = 1485.6,
  floatAbsorptionPct = 18.4,
  netInflowMoMCr = 48.2,
}: MutualFundHoldingsTabProps) {
  const [filterType, setFilterType] = useState<"ALL" | "BUYING" | "NEW">("ALL");
  const [search, setSearch] = useState("");

  const schemes = [
    { amc: "HDFC Mutual Fund", scheme: "HDFC Large and Mid Cap Fund", shares: "48,20,000", valueCr: 956.2, allocPct: 3.8, action: "ACCUMULATED", changeShares: "+3,40,000", changePct: "+7.6%" },
    { amc: "SBI Mutual Fund", scheme: "SBI Contra Fund", shares: "24,50,000", valueCr: 486.0, allocPct: 2.4, action: "NEW ENTRY", changeShares: "+24,50,000", changePct: "NEW" },
    { amc: "Nippon India MF", scheme: "Nippon India Growth Fund", shares: "18,90,000", valueCr: 374.9, allocPct: 2.1, action: "ACCUMULATED", changeShares: "+1,80,000", changePct: "+10.5%" },
    { amc: "ICICI Prudential MF", scheme: "ICICI Prudential Discovery Fund", shares: "15,20,000", valueCr: 301.5, allocPct: 1.9, action: "HELD", changeShares: "0", changePct: "0.0%" },
    { amc: "Mirae Asset MF", scheme: "Mirae Asset Focused Fund", shares: "12,40,000", valueCr: 246.0, allocPct: 1.6, action: "ACCUMULATED", changeShares: "+95,000", changePct: "+8.3%" },
    { amc: "Kotak Mutual Fund", scheme: "Kotak Emerging Equity Fund", shares: "9,80,000", valueCr: 194.4, allocPct: 1.2, action: "NEW ENTRY", changeShares: "+9,80,000", changePct: "NEW" },
    { amc: "Axis Mutual Fund", scheme: "Axis Growth Opportunities Fund", shares: "8,50,000", valueCr: 168.6, allocPct: 1.1, action: "TRIMMED", changeShares: "-45,000", changePct: "-5.0%" },
  ];

  const filtered = schemes.filter((s) => {
    const matchesSearch = s.scheme.toLowerCase().includes(search.toLowerCase()) || s.amc.toLowerCase().includes(search.toLowerCase());
    if (filterType === "BUYING") return matchesSearch && (s.action === "ACCUMULATED" || s.action === "NEW ENTRY");
    if (filterType === "NEW") return matchesSearch && s.action === "NEW ENTRY";
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* KPI Cards Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-800 bg-[#081225] p-5 shadow-xl">
          <div className="text-[10px] uppercase font-bold text-slate-400 font-mono">Mutual Fund Schemes</div>
          <div className="mt-2 text-2xl font-black text-white font-mono">{totalSchemes} Schemes</div>
          <p className="text-[11px] text-slate-400 mt-1">Across 14 leading Indian Asset Management Companies</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#081225] p-5 shadow-xl">
          <div className="text-[10px] uppercase font-bold text-slate-400 font-mono">Total Value Held</div>
          <div className="mt-2 text-2xl font-black text-cyan-300 font-mono">₹{totalValueCr.toLocaleString()} Cr</div>
          <p className="text-[11px] text-slate-400 mt-1">Institutional backing represents 18.4% of total equity</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#081225] p-5 shadow-xl">
          <div className="text-[10px] uppercase font-bold text-slate-400 font-mono">MoM Net Inflow</div>
          <div className="mt-2 text-2xl font-black text-emerald-400 font-mono">+₹{netInflowMoMCr} Cr</div>
          <p className="text-[11px] text-slate-400 mt-1">Net accumulation across past 30 calendar days</p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#081225] p-5 shadow-xl">
          <div className="text-[10px] uppercase font-bold text-slate-400 font-mono">Free Float Absorbed</div>
          <div className="mt-2 text-2xl font-black text-purple-300 font-mono">{floatAbsorptionPct}%</div>
          <p className="text-[11px] text-slate-400 mt-1">High absorption reduces supply overhang during breakout</p>
        </div>
      </div>

      {/* Scheme-by-Scheme Table */}
      <div className="rounded-2xl border border-slate-800 bg-[#081225] p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Building2 size={18} className="text-cyan-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              Mutual Fund Scheme-by-Scheme Portfolio Holdings
            </h3>
          </div>

          <div className="flex items-center gap-3">
            {/* Filter pills */}
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1 text-xs font-mono">
              <button
                onClick={() => setFilterType("ALL")}
                className={`px-2.5 py-1 rounded-md transition ${filterType === "ALL" ? "bg-cyan-500/20 text-cyan-300 font-bold" : "text-slate-400 hover:text-white"}`}
              >
                All Schemes ({schemes.length})
              </button>
              <button
                onClick={() => setFilterType("BUYING")}
                className={`px-2.5 py-1 rounded-md transition ${filterType === "BUYING" ? "bg-emerald-500/20 text-emerald-300 font-bold" : "text-slate-400 hover:text-white"}`}
              >
                Accumulators
              </button>
              <button
                onClick={() => setFilterType("NEW")}
                className={`px-2.5 py-1 rounded-md transition ${filterType === "NEW" ? "bg-purple-500/20 text-purple-300 font-bold" : "text-slate-400 hover:text-white"}`}
              >
                Fresh Buys
              </button>
            </div>

            {/* Search */}
            <div className="relative w-44">
              <input
                type="text"
                placeholder="Search scheme..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] text-slate-500 uppercase">
                <th className="py-2.5 px-3">AMC / Scheme Name</th>
                <th className="py-2.5 px-3">Shares Held</th>
                <th className="py-2.5 px-3">Holding Value</th>
                <th className="py-2.5 px-3">Weight %</th>
                <th className="py-2.5 px-3">MoM Action</th>
                <th className="py-2.5 px-3 text-right">Change in Shares</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.map((s, idx) => (
                <tr key={idx} className="hover:bg-slate-900/40 transition">
                  <td className="py-2.5 px-3">
                    <div className="font-bold text-white font-sans">{s.scheme}</div>
                    <div className="text-[10px] text-slate-400">{s.amc}</div>
                  </td>
                  <td className="py-2.5 px-3 text-slate-300">{s.shares}</td>
                  <td className="py-2.5 px-3 font-bold text-cyan-300">₹{s.valueCr.toFixed(1)} Cr</td>
                  <td className="py-2.5 px-3 text-slate-300">{s.allocPct}%</td>
                  <td className="py-2.5 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        s.action === "NEW ENTRY"
                          ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                          : s.action === "ACCUMULATED"
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                          : s.action === "TRIMMED"
                          ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                          : "bg-slate-800 text-slate-400 border-slate-700"
                      }`}
                    >
                      {s.action}
                    </span>
                  </td>
                  <td
                    className={`py-2.5 px-3 text-right font-bold ${
                      s.changeShares.startsWith("+")
                        ? "text-emerald-400"
                        : s.changeShares.startsWith("-")
                        ? "text-rose-400"
                        : "text-slate-400"
                    }`}
                  >
                    {s.changeShares} ({s.changePct})
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

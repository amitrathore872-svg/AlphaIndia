"use client";

import React, { useState, useEffect } from "react";
import {
  Building2,
  TrendingUp,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  Search,
  Filter,
  Users,
  ExternalLink,
  Info,
  Loader2,
  ChevronDown,
} from "lucide-react";
import {
  fetchStockInstitutionalDetail,
  type StockInstitutionalDetail,
  type SchemeHoldingItem,
} from "@/lib/institutionalApi";

interface MutualFundHoldingsTabProps {
  symbol?: string;
  marketCapCr?: number;
  totalSchemes?: number;
  totalValueCr?: number;
  floatAbsorptionPct?: number;
  netInflowMoMCr?: number;
}

export default function MutualFundHoldingsTab({
  symbol = "STOCK",
  marketCapCr = 5000,
  totalSchemes,
  totalValueCr,
  floatAbsorptionPct,
  netInflowMoMCr,
}: MutualFundHoldingsTabProps) {
  const [filterType, setFilterType] = useState<"ALL" | "BUYING" | "NEW">("ALL");
  const [search, setSearch] = useState("");
  const [data, setData] = useState<StockInstitutionalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (!symbol || symbol === "STOCK") {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    fetchStockInstitutionalDetail(symbol)
      .then((res) => {
        if (isMounted) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err?.message || "Failed to load mutual fund holdings");
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [symbol]);

  // Authentic stats from database (with graceful fallback if still fetching or empty)
  const stats = data?.latest_stats;
  const computedSchemesCount = stats?.total_schemes ?? totalSchemes ?? 0;
  const activeAlphaCount = stats?.active_alpha_schemes ?? 0;
  const computedValueHeld = stats?.total_value_cr ?? totalValueCr ?? 0;
  const computedEquityPct = stats?.pct_of_equity ?? 0;
  const computedFloatPct = stats?.pct_of_free_float ?? 0;
  const computedNetInflow = stats?.net_value_flow_mom_cr ?? netInflowMoMCr ?? 0;
  const computedAbsorption = stats?.float_absorption_pct ?? floatAbsorptionPct ?? 0;
  const smartMoneyScore = stats?.smart_money_score ?? 50;

  const nseShareholdingUrl = `https://www.nseindia.com/companies-listing/corporate-filings-shareholding-pattern?symbol=${encodeURIComponent(
    symbol
  )}`;

  const holdings = data?.holdings || [];

  const filtered = holdings.filter((s) => {
    const matchesSearch =
      s.scheme_name.toLowerCase().includes(search.toLowerCase()) ||
      s.amc_name.toLowerCase().includes(search.toLowerCase());
    if (filterType === "BUYING")
      return (
        matchesSearch &&
        (s.holding_status === "AGGRESSIVE_ADD" ||
          s.holding_status === "ADD" ||
          s.holding_status === "NEW_ENTRY")
      );
    if (filterType === "NEW") return matchesSearch && s.holding_status === "NEW_ENTRY";
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* KPI Cards Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {/* Card 1: Total Schemes */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#081225] p-5 shadow-xs dark:shadow-xl">
          <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 font-mono">
            Mutual Fund Schemes
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900 dark:text-white font-mono">
            {loading ? "..." : `${computedSchemesCount} Schemes`}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            {activeAlphaCount > 0
              ? `${activeAlphaCount} Active Alpha & High-Conviction Mandates`
              : "Across registered Asset Management Companies"}
          </p>
        </div>

        {/* Card 2: Total Value Held */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#081225] p-5 shadow-xs dark:shadow-xl">
          <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 font-mono">
            Total Value Held
          </div>
          <div className="mt-2 text-2xl font-black text-cyan-600 dark:text-cyan-300 font-mono">
            {loading ? "..." : `₹${computedValueHeld.toLocaleString()} Cr`}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            {computedEquityPct > 0
              ? `Institutional backing represents ~${computedEquityPct}% of total equity`
              : "Calculated from official AMFI portfolio filings"}
          </p>
        </div>

        {/* Card 3: MoM Net Inflow */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#081225] p-5 shadow-xs dark:shadow-xl">
          <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 font-mono">
            MoM Net Inflow
          </div>
          <div
            className={`mt-2 text-2xl font-black font-mono ${
              computedNetInflow >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400"
            }`}
          >
            {loading
              ? "..."
              : `${computedNetInflow >= 0 ? "+" : ""}₹${computedNetInflow.toLocaleString()} Cr`}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            {stats?.report_date ? `Latest filing period: ${stats.report_date}` : "Net accumulation in recent reporting cycle"}
          </p>
        </div>

        {/* Card 4: Free Float Absorbed */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#081225] p-5 shadow-xs dark:shadow-xl">
          <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 font-mono">
            Free Float Absorbed
          </div>
          <div className="mt-2 text-2xl font-black text-purple-600 dark:text-purple-300 font-mono">
            {loading ? "..." : `${computedFloatPct > 0 ? computedFloatPct : computedAbsorption}%`}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Smart Money Score: <span className="font-bold text-purple-500">{smartMoneyScore}/100</span>
          </p>
        </div>
      </div>

      {/* Scheme-by-Scheme Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#081225] p-5 shadow-xs dark:shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Building2 size={18} className="text-cyan-600 dark:text-cyan-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider font-mono">
              Institutional Mutual Fund Holdings — {symbol}
            </h3>
          </div>

          <div className="flex items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search AMC or Scheme..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-48 sm:w-60 px-3 py-1.5 pl-8 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-cyan-500"
              />
              <Search size={13} className="absolute left-2.5 top-2 text-slate-400" />
            </div>

            {/* Filter Pills */}
            <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-800 p-0.5 bg-slate-100 dark:bg-slate-900 text-[11px] font-mono">
              <button
                onClick={() => setFilterType("ALL")}
                className={`px-2.5 py-1 rounded-md transition ${
                  filterType === "ALL"
                    ? "bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 font-bold shadow-xs"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                All ({holdings.length})
              </button>
              <button
                onClick={() => setFilterType("BUYING")}
                className={`px-2.5 py-1 rounded-md transition ${
                  filterType === "BUYING"
                    ? "bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 font-bold shadow-xs"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Buying
              </button>
              <button
                onClick={() => setFilterType("NEW")}
                className={`px-2.5 py-1 rounded-md transition ${
                  filterType === "NEW"
                    ? "bg-white dark:bg-slate-800 text-cyan-600 dark:text-cyan-400 font-bold shadow-xs"
                    : "text-slate-500 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                New Entries
              </button>
            </div>

            <a
              href={nseShareholdingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-mono text-slate-700 dark:text-slate-300 transition"
            >
              <span>Official Filing</span>
              <ExternalLink size={11} />
            </a>
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-500 font-mono text-xs">
            <Loader2 className="animate-spin text-cyan-500" size={24} />
            <span>Loading authentic mutual fund filings for {symbol}...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              No registered mutual fund schemes currently report active holdings in {symbol}.
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              Domestic institutions may hold this stock via Category III AIFs, PMS portfolios, or
              direct promoter accounts.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 uppercase text-[11px]">
                  <th className="py-2.5 px-3">AMC / Fund Family</th>
                  <th className="py-2.5 px-3">Scheme Name</th>
                  <th className="py-2.5 px-3">Fund Manager</th>
                  <th className="py-2.5 px-3 text-right">Value Held (₹ Cr)</th>
                  <th className="py-2.5 px-3 text-right">Scheme Alloc %</th>
                  <th className="py-2.5 px-3 text-right">MoM Change</th>
                  <th className="py-2.5 px-3 text-center">Recent Stance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filtered.map((s, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition">
                    <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white font-sans">
                      {s.amc_name}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="text-cyan-600 dark:text-cyan-300 font-semibold">{s.scheme_name}</div>
                      <div className="text-[10px] text-slate-400">{s.category}</div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 font-sans">
                      {s.fund_manager_name || "Institutional Desk"}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-white font-mono">
                      ₹{s.market_value_cr.toLocaleString()} Cr
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-300 font-mono">
                      {s.weight_pct}%
                    </td>
                    <td
                      className={`py-2.5 px-3 text-right font-mono font-bold ${
                        s.mom_shares_change_pct > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : s.mom_shares_change_pct < 0
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-slate-500"
                      }`}
                    >
                      {s.mom_shares_change_pct > 0 ? "+" : ""}
                      {s.mom_shares_change_pct}%
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          s.holding_status === "AGGRESSIVE_ADD"
                            ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700"
                            : s.holding_status === "ADD"
                            ? "bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-300 dark:border-teal-700"
                            : s.holding_status === "NEW_ENTRY"
                            ? "bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-700"
                            : s.holding_status === "TRIMMED" || s.holding_status === "HEAVY_TRIM"
                            ? "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700"
                            : s.holding_status === "EXIT"
                            ? "bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-700"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        {s.holding_status.replace("_", " ")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

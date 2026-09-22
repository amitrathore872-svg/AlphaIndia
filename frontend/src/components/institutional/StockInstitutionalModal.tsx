"use client";

import React, { useEffect, useState } from "react";
import {
  X,
  TrendingUp,
  ShieldCheck,
  BrainCircuit,
  Target,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Award,
  Layers,
  BarChart3,
  CheckCircle2,
} from "lucide-react";
import {
  StockInstitutionalDetail,
  fetchStockInstitutionalDetail,
} from "@/lib/institutionalApi";

interface StockInstitutionalModalProps {
  symbol: string | null;
  onClose: () => void;
}

export default function StockInstitutionalModal({
  symbol,
  onClose,
}: StockInstitutionalModalProps) {
  const [data, setData] = useState<StockInstitutionalDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("ALL");

  useEffect(() => {
    if (!symbol) return;
    setLoading(true);
    setError(null);

    fetchStockInstitutionalDetail(symbol)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setError("Failed to load institutional data for " + symbol);
        setLoading(false);
      });
  }, [symbol]);

  if (!symbol) return null;

  const filteredHoldings =
    data?.holdings.filter((h) => {
      if (filterCategory === "ACTIVE") return h.is_active_alpha;
      if (filterCategory === "PASSIVE") return !h.is_active_alpha;
      if (filterCategory === "BUYERS")
        return ["NEW_ENTRY", "AGGRESSIVE_ADD", "ADD"].includes(h.holding_status);
      return true;
    }) || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 sm:p-4 md:p-6 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative flex max-h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-[#081225] text-slate-800 dark:text-slate-100 shadow-2xl">
        {/* MODAL HEADER */}
        <div className="flex flex-wrap items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#080E1A]/90 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
              <ShieldCheck size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {data?.company.name || symbol}
                </h2>
                <span className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 text-xs font-semibold text-cyan-700 dark:text-cyan-400">
                  NSE: {symbol}
                </span>
                <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  {data?.company.sector || "Institutional Radar"}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Smart Money Ownership Radar &bull; Monthly AMFI Portfolio Filing Analysis
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {data?.action_zone && (
              <div className="hidden sm:flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5">
                <span className="text-xs text-slate-600 dark:text-slate-400">Recommendation:</span>
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  {data.action_zone.action}
                </span>
                <span className="rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                  {data.action_zone.confidence}% Conviction
                </span>
              </div>
            )}
            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* CONTENT BODY */}
        {loading ? (
          <div className="flex h-96 flex-col items-center justify-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
            <p className="text-sm text-slate-500 dark:text-slate-400">Synthesizing institutional filings for {symbol}...</p>
          </div>
        ) : error ? (
          <div className="flex h-96 flex-col items-center justify-center gap-2 text-rose-500 dark:text-rose-400">
            <AlertTriangle size={32} />
            <p className="text-sm">{error}</p>
          </div>
        ) : data ? (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar">
            {/* TOP SUMMARY STATS RIBBON */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#080E1A]/80 p-3">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Smart Money Score</span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-cyan-600 dark:text-cyan-400">
                    {data.latest_stats.smart_money_score}
                  </span>
                  <span className="text-[10px] text-slate-500">/ 100</span>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#080E1A]/80 p-3">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Total MF Equity Stake</span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    {data.latest_stats.pct_of_equity}%
                  </span>
                  <span className="text-[10px] text-slate-500">of company</span>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#080E1A]/80 p-3">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Free Float Absorbed</span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-amber-600 dark:text-amber-400">
                    {data.latest_stats.float_absorption_pct}%
                  </span>
                  <span className="text-[10px] text-slate-500">in 60D</span>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#080E1A]/80 p-3">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Active Alpha Schemes</span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-slate-900 dark:text-white">
                    {data.latest_stats.active_alpha_schemes}
                  </span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                    (+{data.flow_tracker.new_entries_count} New)
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#080E1A]/80 p-3">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Net MoM Inflow</span>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                    +₹{data.latest_stats.net_value_flow_mom_cr} Cr
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#080E1A]/80 p-3">
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Stealth Accumulation</span>
                <div className="mt-1">
                  {data.latest_stats.is_stealth_accumulation ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-cyan-600 dark:text-cyan-400">
                      <Sparkles size={14} /> ACTIVE BASE
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400 dark:text-slate-500">Normal Range</span>
                  )}
                </div>
              </div>
            </div>

            {/* TWO-COLUMN GRID: OWNERSHIP TABLE (LEFT) VS TIMELINE & AI THESIS (RIGHT) */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* LEFT COLUMN: COMPLETE OWNERSHIP TABLE */}
              <div className="lg:col-span-7 flex flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#080E1A]/80 p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Layers size={16} className="text-cyan-600 dark:text-cyan-400" />
                      Who is Buying? Who is Selling? Complete Holdings
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {data.flow_tracker.buyers_count} Buyers &bull; {data.flow_tracker.sellers_count} Sellers &bull; {data.flow_tracker.new_entries_count} Fresh Entries
                    </p>
                  </div>

                  {/* FILTER BUTTONS */}
                  <div className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-1 text-[11px]">
                    <button
                      onClick={() => setFilterCategory("ALL")}
                      className={`rounded-md px-2.5 py-1 font-semibold transition ${
                        filterCategory === "ALL" ? "bg-cyan-500/20 text-cyan-700 dark:text-cyan-400 font-bold" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      All ({data.holdings.length})
                    </button>
                    <button
                      onClick={() => setFilterCategory("ACTIVE")}
                      className={`rounded-md px-2.5 py-1 font-semibold transition ${
                        filterCategory === "ACTIVE" ? "bg-cyan-500/20 text-cyan-700 dark:text-cyan-400 font-bold" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      Active Alpha
                    </button>
                    <button
                      onClick={() => setFilterCategory("BUYERS")}
                      className={`rounded-md px-2.5 py-1 font-semibold transition ${
                        filterCategory === "BUYERS" ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-bold" : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      Buyers Only
                    </button>
                  </div>
                </div>

                {/* TABLE */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                        <th className="pb-2.5 font-semibold">Fund Scheme</th>
                        <th className="pb-2.5 font-semibold">Fund Manager</th>
                        <th className="pb-2.5 font-semibold text-right">Shares Held</th>
                        <th className="pb-2.5 font-semibold text-right">Val (₹ Cr)</th>
                        <th className="pb-2.5 font-semibold text-right">% of Fund</th>
                        <th className="pb-2.5 font-semibold text-right">MoM Delta</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                      {filteredHoldings.map((h, i) => {
                        const isAdd = ["NEW_ENTRY", "AGGRESSIVE_ADD", "ADD"].includes(h.holding_status);
                        const isTrim = ["TRIMMED", "HEAVY_TRIM", "EXIT"].includes(h.holding_status);
                        return (
                          <tr key={i} className="hover:bg-slate-100/70 dark:hover:bg-slate-800/40 transition">
                            <td className="py-2.5 pr-2">
                              <div className="font-semibold text-slate-900 dark:text-white">{h.scheme_name}</div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                                <span>{h.amc_name}</span>
                                &bull;
                                <span>{h.category}</span>
                              </div>
                            </td>
                            <td className="py-2.5 text-slate-600 dark:text-slate-300 font-medium">
                              {h.fund_manager_name}
                            </td>
                            <td className="py-2.5 text-right font-mono text-slate-800 dark:text-slate-200">
                              {h.shares_held.toLocaleString("en-IN")}
                            </td>
                            <td className="py-2.5 text-right font-mono text-cyan-600 dark:text-cyan-400 font-semibold">
                              ₹{h.market_value_cr}
                            </td>
                            <td className="py-2.5 text-right font-mono text-slate-600 dark:text-slate-300">
                              {h.weight_pct}%
                            </td>
                            <td className="py-2.5 text-right">
                              {h.holding_status === "NEW_ENTRY" ? (
                                <span className="inline-flex items-center gap-0.5 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold text-cyan-700 dark:text-cyan-400">
                                  <Sparkles size={10} /> NEW ENTRY
                                </span>
                              ) : isAdd ? (
                                <span className="inline-flex items-center gap-0.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                                  <ArrowUpRight size={12} /> +{h.mom_shares_change_pct}%
                                </span>
                              ) : isTrim ? (
                                <span className="inline-flex items-center gap-0.5 rounded-md border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:text-rose-400">
                                  <ArrowDownRight size={12} /> {h.mom_shares_change_pct}%
                                </span>
                              ) : (
                                <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">UNF</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* RIGHT COLUMN: TIMELINE + AI REASONING + ACTION ZONE */}
              <div className="lg:col-span-5 flex flex-col gap-4">
                {/* 1. TIMELINE GRAPH CARD */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#080E1A]/80 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <BarChart3 size={14} className="text-cyan-600 dark:text-cyan-400" />
                      Institutional Ownership Timeline
                    </h4>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">6-Month Trend</span>
                  </div>

                  {/* MINI SVG LINE CHART */}
                  <div className="h-32 w-full pt-2">
                    <div className="flex h-20 items-end gap-2 border-b border-slate-200 dark:border-slate-800 px-2">
                      {data.timeline.map((tp, idx) => {
                        const heightPct = Math.min(100, Math.max(15, (tp.pct_of_equity / 25) * 100));
                        return (
                          <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative">
                            <div className="absolute -top-7 hidden group-hover:flex rounded bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold text-cyan-300 border border-slate-700 shadow-md">
                              {tp.pct_of_equity}%
                            </div>
                            <div
                              style={{ height: `${heightPct}%` }}
                              className="w-full rounded-t-sm bg-gradient-to-t from-cyan-500/30 via-cyan-400/70 to-emerald-400 transition-all duration-300 group-hover:from-cyan-400 group-hover:to-emerald-300"
                            />
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-between px-1 pt-1 text-[10px] text-slate-500 dark:text-slate-400">
                      {data.timeline.map((tp, i) => (
                        <span key={i}>{tp.month_label}</span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 2. AI CONVICTION REASONING */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#080E1A]/80 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <BrainCircuit size={15} className="text-cyan-600 dark:text-cyan-400" />
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Why Are Funds Buying? AI Thesis
                    </h4>
                  </div>
                  <div className="rounded-lg border border-cyan-500/20 bg-cyan-50/50 dark:bg-cyan-500/5 p-2.5 mb-2.5">
                    <span className="text-[10px] font-bold text-cyan-700 dark:text-cyan-400 uppercase tracking-wider block">
                      Primary Institutional Catalyst
                    </span>
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                      {data.ai_reasoning.primary_driver}
                    </p>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {data.ai_reasoning.thesis}
                  </p>
                </div>

                {/* 3. ACTION ZONE (IS THIS A BUY TODAY?) */}
                <div className="rounded-xl border border-emerald-500/40 bg-emerald-50/40 dark:bg-[#080E1A]/90 p-4 shadow-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Target size={16} className="text-emerald-600 dark:text-emerald-400" />
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                        Smart Money Action Zone
                      </h4>
                    </div>
                    <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-xs font-black text-emerald-700 dark:text-emerald-400">
                      {data.action_zone.action}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-2 shadow-xs">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Entry Base Zone</span>
                      <span className="text-xs font-bold font-mono text-cyan-700 dark:text-cyan-400 mt-0.5 block">
                        ₹{data.action_zone.entry_zone_low} - ₹{data.action_zone.entry_zone_high}
                      </span>
                    </div>

                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-2 shadow-xs">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Target Price</span>
                      <span className="text-xs font-bold font-mono text-emerald-700 dark:text-emerald-400 mt-0.5 block">
                        ₹{data.action_zone.target_price}
                      </span>
                      <span className="text-[9px] text-emerald-600 dark:text-emerald-500 font-semibold">
                        (+{data.action_zone.upside_pct}%)
                      </span>
                    </div>

                    <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-2 shadow-xs">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Base Stop Loss</span>
                      <span className="text-xs font-bold font-mono text-rose-700 dark:text-rose-400 mt-0.5 block">
                        ₹{data.action_zone.stop_loss}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

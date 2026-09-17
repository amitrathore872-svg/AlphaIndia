"use client";

import React from "react";
import {
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Sparkles,
  Award,
  Calendar,
  Building,
} from "lucide-react";
import { SectorFlowItem, StarFundManager } from "@/lib/institutionalApi";

interface SectorRotationCardProps {
  sectorFlows: SectorFlowItem[];
  fundManagers: StarFundManager[];
  onSelectStock: (symbol: string) => void;
}

export default function SectorRotationCard({
  sectorFlows,
  fundManagers,
  onSelectStock,
}: SectorRotationCardProps) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* SECTOR ROTATION HEATMAP (LEFT) */}
      <div className="lg:col-span-7 flex flex-col rounded-2xl border border-slate-800 bg-[#080E1A]/90 p-5 shadow-xl">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
              <PieChart size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                Mutual Fund Sector Rotation Heatmap
              </h3>
              <p className="text-[11px] text-slate-400">
                Monthly Net Capital Inflow / Outflow Across NSE Sectors
              </p>
            </div>
          </div>
          <span className="rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-cyan-400">
            Monthly AMFI Aggregate
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="pb-2.5 font-semibold">Sector</th>
                <th className="pb-2.5 font-semibold text-right">Net Flow (₹ Cr)</th>
                <th className="pb-2.5 font-semibold text-right">MoM Delta</th>
                <th className="pb-2.5 font-semibold text-center">Trend</th>
                <th className="pb-2.5 font-semibold">Top Inflow Stock</th>
                <th className="pb-2.5 font-semibold">Top Trimmed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {sectorFlows.map((s, idx) => {
                const isInflow = s.net_inflow_cr > 0;
                return (
                  <tr key={idx} className="hover:bg-slate-800/40 transition">
                    <td className="py-2.5 font-medium text-white">
                      {s.sector_name}
                    </td>
                    <td className="py-2.5 text-right font-mono font-bold">
                      <span
                        className={
                          isInflow ? "text-emerald-400" : "text-rose-400"
                        }
                      >
                        {isInflow ? "+" : ""}
                        ₹{s.net_inflow_cr.toLocaleString("en-IN")} Cr
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-mono">
                      <span
                        className={
                          s.mom_delta_pct > 0
                            ? "text-emerald-400"
                            : s.mom_delta_pct < 0
                            ? "text-rose-400"
                            : "text-slate-400"
                        }
                      >
                        {s.mom_delta_pct > 0 ? "+" : ""}
                        {s.mom_delta_pct}%
                      </span>
                    </td>
                    <td className="py-2.5 text-center">
                      {s.trend === "UP" ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-500/10 p-1 text-emerald-400">
                          <ArrowUpRight size={13} />
                        </span>
                      ) : s.trend === "DOWN" ? (
                        <span className="inline-flex items-center rounded-full bg-rose-500/10 p-1 text-rose-400">
                          <ArrowDownRight size={13} />
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-slate-700/50 p-1 text-slate-400">
                          <Minus size={13} />
                        </span>
                      )}
                    </td>
                    <td className="py-2.5">
                      {s.top_accumulated_stock && (
                        <button
                          onClick={() => onSelectStock(s.top_accumulated_stock!)}
                          className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-emerald-400 hover:bg-emerald-500/20 transition"
                        >
                          {s.top_accumulated_stock}
                        </button>
                      )}
                    </td>
                    <td className="py-2.5">
                      {s.top_trimmed_stock && (
                        <span className="font-mono text-[11px] text-slate-400">
                          {s.top_trimmed_stock}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* STAR FUND MANAGER PRE-EARNINGS RADAR (RIGHT) */}
      <div className="lg:col-span-5 flex flex-col rounded-2xl border border-slate-800 bg-[#080E1A]/90 p-5 shadow-xl">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
              <Award size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                Star Fund Manager Pre-Earnings Radar
              </h3>
              <p className="text-[11px] text-slate-400">
                15-30 Days Pre-Earnings Accumulation & Alpha Conviction
              </p>
            </div>
          </div>
          <span className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold text-cyan-400">
            Top 5 Alpha Desks
          </span>
        </div>

        <div className="space-y-3.5 overflow-y-auto max-h-[420px] pr-1 custom-scrollbar">
          {fundManagers.map((mgr, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-3.5 hover:border-slate-700 transition"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500/30 to-emerald-500/30 text-xs font-bold text-cyan-300 border border-cyan-500/30">
                    {mgr.manager_name.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white">
                      {mgr.manager_name}
                    </h4>
                    <p className="text-[10px] text-slate-400">
                      {mgr.amc} &bull; <span className="text-cyan-400">{mgr.flagship_scheme}</span>
                    </p>
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 italic">
                  {mgr.philosophy}
                </span>
              </div>

              {/* RECENT ADDITIONS */}
              <div className="mt-2.5 pt-2 border-t border-slate-800/60 flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-medium text-slate-400">
                  Pre-Earnings Adds:
                </span>
                {mgr.recent_accumulations.map((acc, aIdx) => (
                  <button
                    key={aIdx}
                    onClick={() => onSelectStock(acc.symbol)}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/90 px-2 py-0.5 text-[11px] font-semibold text-slate-200 hover:border-cyan-500/50 hover:bg-slate-700 transition"
                  >
                    <span>{acc.symbol}</span>
                    <span className="text-emerald-400 font-mono">
                      +{acc.mom_change_pct}%
                    </span>
                    {acc.status === "NEW_ENTRY" && (
                      <span className="rounded bg-cyan-500/20 px-1 text-[9px] text-cyan-300">
                        NEW
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

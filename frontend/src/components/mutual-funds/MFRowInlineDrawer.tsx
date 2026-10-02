"use client";

import { memo } from "react";
import MFNavChart from "./MFNavChart";
import { type MFRadarScheme } from "@/lib/mfRadarApi";
import { Maximize2, ShieldCheck, TrendingUp, AlertTriangle, User, Award, Percent } from "lucide-react";

interface MFRowInlineDrawerProps {
  scheme: MFRadarScheme;
  onOpenDeepDive: () => void;
}

function MFRowInlineDrawer({ scheme, onOpenDeepDive }: MFRowInlineDrawerProps) {
  return (
    <div className="border-t border-b border-cyan-500/20 bg-slate-950/70 p-4 transition-all">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left: Compact Interactive NAV Chart (8 cols) */}
        <div className="lg:col-span-8">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
              <span className="text-xs font-bold text-white font-mono">
                {scheme.scheme_name}
              </span>
              <span className="rounded bg-cyan-950/80 border border-cyan-500/30 px-2 py-0.5 text-[10px] font-semibold text-cyan-300">
                {scheme.category}
              </span>
            </div>

            <button
              onClick={onOpenDeepDive}
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1 text-xs font-semibold text-cyan-300 hover:bg-cyan-500 hover:text-slate-950 transition shadow-xs"
            >
              <span>Full Deep Dive Modal</span>
              <Maximize2 size={12} />
            </button>
          </div>

          <MFNavChart
            schemeCode={scheme.scheme_code}
            schemeName={scheme.scheme_name}
            category={scheme.category}
            height={260}
            initialPeriod="6M"
            onOpenDeepDive={onOpenDeepDive}
          />
        </div>

        {/* Right: Institutional Intelligence Strip (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-2.5">
          {/* Quick Metrics Card */}
          <div className="rounded-xl border border-slate-800 bg-[#071120] p-3 text-xs">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 mb-2.5">
              <span className="font-bold text-slate-300 font-mono text-[11px] uppercase tracking-wider">
                Fund Profile & Ratios
              </span>
              <span className="rounded bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.2 text-[10px] font-semibold text-emerald-400">
                Direct - Growth
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-slate-500 text-[10px] block">AUM Size</span>
                <strong className="text-white font-mono font-bold">
                  ₹{scheme.aum_cr ? Number(scheme.aum_cr).toLocaleString("en-IN") : "N/A"} Cr
                </strong>
              </div>

              <div>
                <span className="text-slate-500 text-[10px] block">Expense Ratio (TER)</span>
                <strong className="text-cyan-400 font-mono font-bold">
                  {scheme.ter ? `${scheme.ter}%` : "0.65%"}
                </strong>
              </div>

              <div>
                <span className="text-slate-500 text-[10px] block">Benchmark</span>
                <strong className="text-slate-200 font-mono truncate block" title={scheme.benchmark_index}>
                  {scheme.benchmark_index}
                </strong>
              </div>

              <div>
                <span className="text-slate-500 text-[10px] block">1Y Alpha</span>
                <strong className={`font-mono font-bold ${scheme.alpha_1y >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {scheme.alpha_1y > 0 ? "+" : ""}{scheme.alpha_1y}%
                </strong>
              </div>

              <div>
                <span className="text-slate-500 text-[10px] block">Sharpe Ratio</span>
                <strong className="text-slate-200 font-mono">
                  {scheme.sharpe_ratio || "N/A"}
                </strong>
              </div>

              <div>
                <span className="text-slate-500 text-[10px] block">1Y Dip Frequency</span>
                <strong className="text-emerald-400 font-mono font-bold">
                  {scheme.dip_count_1y || 0} dips (&gt;1%)
                </strong>
              </div>
            </div>

            {scheme.fund_manager && (
              <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center gap-1.5 text-[11px] text-slate-400">
                <User size={12} className="text-cyan-400 shrink-0" />
                <span className="truncate">Manager: <strong className="text-slate-200">{scheme.fund_manager}</strong></span>
              </div>
            )}
          </div>

          {/* 52-Week Range & Drawdown Box */}
          <div className="rounded-xl border border-slate-800 bg-[#071120] p-3 text-xs">
            <div className="flex items-center justify-between text-[11px] mb-1.5">
              <span className="text-slate-400">52W Low: <strong className="text-slate-200">₹{scheme.nav_52w_low || "N/A"}</strong></span>
              <span className="text-slate-400">52W High: <strong className="text-slate-200">₹{scheme.nav_52w_high || "N/A"}</strong></span>
            </div>

            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden my-1">
              <div
                className="bg-gradient-to-r from-emerald-500 via-cyan-400 to-amber-500 h-full rounded-full"
                style={{
                  width: `${Math.min(
                    100,
                    Math.max(
                      10,
                      scheme.nav_52w_high && scheme.nav_52w_low && scheme.current_nav
                        ? ((scheme.current_nav - scheme.nav_52w_low) /
                            (scheme.nav_52w_high - scheme.nav_52w_low)) *
                            100
                        : 75
                    )
                  )}%`,
                }}
              />
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
              <span>Current NAV: ₹{scheme.current_nav?.toFixed(2)}</span>
              <span className="text-rose-400 font-mono">
                {scheme.dip_from_52w_high_pct ? `-${scheme.dip_from_52w_high_pct}% from peak` : "At peak"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(MFRowInlineDrawer);

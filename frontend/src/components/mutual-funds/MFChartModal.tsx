"use client";

import { useEffect, memo } from "react";
import { X, ExternalLink, TrendingUp, ShieldCheck, Award, Calendar, DollarSign, Activity } from "lucide-react";
import MFNavChart from "./MFNavChart";
import { type MFRadarScheme } from "@/lib/mfRadarApi";

interface MFChartModalProps {
  scheme: MFRadarScheme | null;
  isOpen: boolean;
  onClose: () => void;
}

function MFChartModal({ scheme, isOpen, onClose }: MFChartModalProps) {
  // ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen || !scheme) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-6xl max-h-[92vh] flex flex-col rounded-2xl border border-slate-800 bg-[#050B14] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Modal Header ── */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-[#081225] px-5 py-3.5">
          <div className="flex items-center gap-3">
            <span className="flex h-3 w-3 rounded-full bg-cyan-400 animate-pulse" />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white font-mono">
                  {scheme.scheme_name}
                </h2>
                <span className="rounded bg-cyan-500/15 border border-cyan-500/30 px-2 py-0.5 text-xs font-semibold text-cyan-300">
                  {scheme.category}
                </span>
                <span className="rounded bg-slate-800 border border-slate-700 px-2 py-0.5 text-xs font-mono text-slate-300">
                  Code: {scheme.scheme_code}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {scheme.amc_name} • Benchmark: <strong className="text-slate-200">{scheme.benchmark_index}</strong> • Manager: <strong className="text-slate-200">{scheme.fund_manager || "N/A"}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right font-mono hidden sm:block">
              <span className="text-xs text-slate-400 block">Current NAV</span>
              <div className="flex items-center gap-1.5 justify-end">
                <span className="text-base font-bold text-white">₹{scheme.current_nav?.toFixed(2)}</span>
                <span
                  className={`text-xs font-semibold ${
                    scheme.day_change_pct >= 0 ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  ({scheme.day_change_pct > 0 ? "+" : ""}{scheme.day_change_pct}%)
                </span>
              </div>
            </div>

            <button
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white transition"
              aria-label="Close modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ── Modal Body (Scrollable) ── */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-4">
          {/* Institutional Full-Size Chart */}
          <div className="w-full">
            <MFNavChart
              schemeCode={scheme.scheme_code}
              schemeName={scheme.scheme_name}
              category={scheme.category}
              height={460}
              initialPeriod="1Y"
              isModalView={true}
            />
          </div>

          {/* Performance Returns Ribbon */}
          <div className="rounded-xl border border-slate-800 bg-[#071120] p-4">
            <h3 className="text-xs font-bold font-mono text-slate-400 uppercase tracking-wider mb-3">
              Trailing Return Matrix (%)
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2 text-center">
              <div className="rounded-lg border border-slate-800/80 bg-slate-900/60 p-2">
                <span className="text-[10px] text-slate-500 uppercase block">1 Day</span>
                <strong className={`font-mono text-xs ${scheme.day_change_pct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {scheme.day_change_pct > 0 ? "+" : ""}{scheme.day_change_pct}%
                </strong>
              </div>

              <div className="rounded-lg border border-slate-800/80 bg-slate-900/60 p-2">
                <span className="text-[10px] text-slate-500 uppercase block">1 Month</span>
                <strong className={`font-mono text-xs ${scheme.return_1m_pct && scheme.return_1m_pct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {scheme.return_1m_pct !== null ? `${scheme.return_1m_pct > 0 ? "+" : ""}${scheme.return_1m_pct}%` : "N/A"}
                </strong>
              </div>

              <div className="rounded-lg border border-slate-800/80 bg-slate-900/60 p-2">
                <span className="text-[10px] text-slate-500 uppercase block">3 Months</span>
                <strong className={`font-mono text-xs ${scheme.return_3m_pct && scheme.return_3m_pct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {scheme.return_3m_pct !== null ? `${scheme.return_3m_pct > 0 ? "+" : ""}${scheme.return_3m_pct}%` : "N/A"}
                </strong>
              </div>

              <div className="rounded-lg border border-cyan-500/30 bg-cyan-950/20 p-2">
                <span className="text-[10px] text-cyan-400 uppercase font-semibold block">6 Months (Alpha)</span>
                <strong className={`font-mono text-sm font-bold ${scheme.return_6m_pct && scheme.return_6m_pct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {scheme.return_6m_pct !== null ? `${scheme.return_6m_pct > 0 ? "+" : ""}${scheme.return_6m_pct}%` : "N/A"}
                </strong>
              </div>

              <div className="rounded-lg border border-slate-800/80 bg-slate-900/60 p-2">
                <span className="text-[10px] text-slate-500 uppercase block">1 Year</span>
                <strong className={`font-mono text-xs ${scheme.return_1y_pct && scheme.return_1y_pct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {scheme.return_1y_pct !== null ? `${scheme.return_1y_pct > 0 ? "+" : ""}${scheme.return_1y_pct}%` : "N/A"}
                </strong>
              </div>

              <div className="rounded-lg border border-slate-800/80 bg-slate-900/60 p-2">
                <span className="text-[10px] text-slate-500 uppercase block">3 Years (CAGR)</span>
                <strong className="font-mono text-xs text-slate-200">
                  {scheme.return_3y_pct !== null ? `${scheme.return_3y_pct > 0 ? "+" : ""}${scheme.return_3y_pct}%` : "N/A"}
                </strong>
              </div>

              <div className="rounded-lg border border-slate-800/80 bg-slate-900/60 p-2">
                <span className="text-[10px] text-slate-500 uppercase block">5 Years (CAGR)</span>
                <strong className="font-mono text-xs text-slate-200">
                  {scheme.return_5y_pct !== null ? `${scheme.return_5y_pct > 0 ? "+" : ""}${scheme.return_5y_pct}%` : "N/A"}
                </strong>
              </div>
            </div>
          </div>

          {/* Deep-Dive Risk & Institutional Profile */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Box 1: Alpha & Risk Ratios */}
            <div className="rounded-xl border border-slate-800 bg-[#071120] p-4">
              <h4 className="text-xs font-bold text-slate-300 font-mono uppercase mb-3 flex items-center gap-1.5">
                <Award size={14} className="text-cyan-400" />
                Risk & Volatility Ratios
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                  <span className="text-slate-400">1Y Jensen's Alpha (α)</span>
                  <strong className={`font-mono ${scheme.alpha_1y >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {scheme.alpha_1y > 0 ? "+" : ""}{scheme.alpha_1y}%
                  </strong>
                </div>
                <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                  <span className="text-slate-400">Sharpe Ratio</span>
                  <strong className="text-white font-mono">{scheme.sharpe_ratio || "N/A"}</strong>
                </div>
                <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                  <span className="text-slate-400">Sortino Ratio</span>
                  <strong className="text-emerald-400 font-mono">{scheme.sortino_ratio || "N/A"}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Portfolio Beta (β)</span>
                  <strong className="text-slate-300 font-mono">{scheme.beta || 1.0}</strong>
                </div>
              </div>
            </div>

            {/* Box 2: Dip Buying & High/Low Range */}
            <div className="rounded-xl border border-slate-800 bg-[#071120] p-4">
              <h4 className="text-xs font-bold text-slate-300 font-mono uppercase mb-3 flex items-center gap-1.5">
                <TrendingUp size={14} className="text-emerald-400" />
                Dip Intelligence & 52W Range
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                  <span className="text-slate-400">1Y Dips (&gt; 1% drop)</span>
                  <strong className="text-emerald-400 font-mono font-bold">{scheme.dip_count_1y || 0} occurrences</strong>
                </div>
                <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                  <span className="text-slate-400">52-Week High</span>
                  <strong className="text-white font-mono">₹{scheme.nav_52w_high || "N/A"}</strong>
                </div>
                <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                  <span className="text-slate-400">52-Week Low</span>
                  <strong className="text-slate-300 font-mono">₹{scheme.nav_52w_low || "N/A"}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Discount from ATH</span>
                  <strong className="text-rose-400 font-mono">
                    {scheme.dip_from_52w_high_pct ? `-${scheme.dip_from_52w_high_pct}%` : "0.0%"}
                  </strong>
                </div>
              </div>
            </div>

            {/* Box 3: Fund Execution & Operations */}
            <div className="rounded-xl border border-slate-800 bg-[#071120] p-4">
              <h4 className="text-xs font-bold text-slate-300 font-mono uppercase mb-3 flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-amber-400" />
                Execution & Liquidity
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                  <span className="text-slate-400">Total AUM</span>
                  <strong className="text-white font-mono">₹{scheme.aum_cr ? Number(scheme.aum_cr).toLocaleString("en-IN") : "N/A"} Cr</strong>
                </div>
                <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                  <span className="text-slate-400">Expense Ratio (TER)</span>
                  <strong className="text-cyan-400 font-mono">{scheme.ter ? `${scheme.ter}%` : "0.65%"}</strong>
                </div>
                <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                  <span className="text-slate-400">SEBI Cut-off Time</span>
                  <strong className="text-amber-400 font-mono">14:00 IST (Same-day NAV)</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Exit Load Window</span>
                  <strong className="text-slate-300 font-mono">1.0% if &lt; 365 Days</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(MFChartModal);

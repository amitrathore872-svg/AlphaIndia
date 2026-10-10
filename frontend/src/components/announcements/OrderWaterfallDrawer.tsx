"use client";

// =======================================================
// Alpha India — Order Waterfall & Milestone Drawer View
// Deep Dive Quarterly Revenue Realization & Historical Analysis
// =======================================================

import Link from "next/link";
import {
  Coins,
  Clock,
  TrendingUp,
  BarChart3,
  Calendar,
  Layers,
  Award,
  Compass,
  ArrowUpRight,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import type { AnnouncementRadarItem } from "@/lib/announcementsApi";

interface OrderWaterfallDrawerProps {
  item: AnnouncementRadarItem;
  showNavigationLink?: boolean;
  onClose?: () => void;
}

export default function OrderWaterfallDrawer({
  item,
  showNavigationLink = true,
}: OrderWaterfallDrawerProps) {
  const dealValue = item.deal_value_cr ?? item.synergy_rev_addition_cr ?? 0;
  const executionMonths = item.order_execution_months;
  const quarters = executionMonths ? Math.max(1, Math.round(executionMonths / 3)) : null;
  const quarterlyRev = item.order_quarterly_rev_cr ?? (dealValue > 0 && quarters ? Math.round((dealValue / quarters) * 10) / 10 : 0);
  const opm = item.synergy_ebitda_margin_pct;
  const quarterlyEbitda = (opm != null && quarterlyRev > 0) ? Math.round(quarterlyRev * (opm / 100.0) * 10) / 10 : 0;
  const quarterlyPat = quarterlyEbitda > 0 ? Math.round(quarterlyEbitda * 0.75 * 10) / 10 : 0;

  const displayQuarters = quarters ?? (dealValue > 0 ? 4 : 0);
  const isEstimatedSchedule = quarters == null && dealValue > 0;
  const stepRev = quarterlyRev > 0 ? quarterlyRev : (dealValue > 0 ? Math.round((dealValue / 4) * 10) / 10 : 0);
  const quarterlySchedule = Array.from({ length: Math.min(displayQuarters, 8) }, (_, i) => ({
    quarter: `Q${i + 1}`,
    timeline: `Month ${i * 3 + 1}–${(i + 1) * 3}`,
    revCr: stepRev,
    ebitdaCr: quarterlyEbitda,
    patCr: quarterlyPat,
    cumulativeRev: Math.round(stepRev * (i + 1) * 10) / 10,
    cumulativePct: Math.min(100, Math.round(((i + 1) / displayQuarters) * 100)),
  }));

  const histStats = item.order_intelligence?.order_historical_stats;

  return (
    <div className="flex flex-col gap-5 text-xs">
      {/* ── SECTION 1: Executive Sizing Summary ───────────────────── */}
      <div className="rounded-xl border border-amber-300 dark:border-amber-500/30 bg-amber-50/70 dark:bg-amber-950/20 p-4">
        <div className="flex items-center justify-between border-b border-amber-200 dark:border-amber-500/20 pb-2.5 mb-3">
          <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            <Coins size={14} />
            <span>Order Value & Execution Sizing</span>
          </div>
          <span className="font-mono text-xs font-black text-slate-900 dark:text-white">
            {dealValue > 0 ? `₹${dealValue.toLocaleString("en-IN")} Cr` : "Value Not Disclosed"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 font-mono">
          <div className="bg-white dark:bg-slate-950/60 rounded-lg p-2.5 border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-sans block">Revenue Contribution</span>
            <span className="text-amber-600 dark:text-amber-300 font-bold text-sm mt-0.5 block">
              {item.synergy_rev_pct_ttm != null ? `+${item.synergy_rev_pct_ttm.toFixed(1)}%` : "—"}
            </span>
            <span className="text-[9px] text-slate-500 dark:text-slate-400 font-sans block">of TTM Sales</span>
          </div>

          <div className="bg-white dark:bg-slate-950/60 rounded-lg p-2.5 border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-sans block">Execution Runway</span>
            <span className="text-cyan-700 dark:text-cyan-300 font-bold text-sm mt-0.5 block">
              {executionMonths ? `${executionMonths} Months` : "Not Disclosed"}
            </span>
            <span className="text-[9px] text-slate-500 dark:text-slate-400 font-sans block">{executionMonths ? `${quarters} Quarters` : "Filing has no timeline"}</span>
          </div>

          <div className="bg-white dark:bg-slate-950/60 rounded-lg p-2.5 border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-sans block">Run-rate / Quarter</span>
            <span className="text-emerald-700 dark:text-emerald-300 font-bold text-sm mt-0.5 block">
              {quarterlyRev > 0 ? `+₹${quarterlyRev.toLocaleString("en-IN")} Cr` : (dealValue > 0 ? "Pending timeline" : "—")}
            </span>
            <span className="text-[9px] text-emerald-600 dark:text-emerald-400/80 font-sans block">Quarterly Accretion</span>
          </div>

          <div className="bg-white dark:bg-slate-950/60 rounded-lg p-2.5 border border-slate-200 dark:border-slate-800 shadow-xs">
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-sans block">EBITDA Margin</span>
            <span className="text-purple-700 dark:text-purple-300 font-bold text-sm mt-0.5 block">
              {opm != null ? `${opm}%` : "Not Disclosed"}
            </span>
            <span className="text-[9px] text-purple-600 dark:text-purple-400/80 font-sans block">{opm != null ? "Company Operating Margin" : "No margin reported"}</span>
          </div>
        </div>
      </div>

      {/* ── SECTION 2: Quarterly Realization Waterfall ───────────── */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-[#071322] p-4">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5 mb-3">
          <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
            <Calendar size={13} />
            <span>Quarterly Revenue Realization Waterfall {quarters ? `(${quarters} Quarters)` : "(Illustrative 4Q Cadence)"}</span>
          </div>
          <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
            {isEstimatedSchedule ? "Timeline Not Disclosed (Illustrative)" : "Linear Execution Cadence"}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-sans uppercase text-slate-500 dark:text-slate-400">
                <th className="py-2 px-2">Quarter</th>
                <th className="py-2 px-2">Timeline</th>
                <th className="py-2 px-2 text-right">Revenue (₹ Cr)</th>
                <th className="py-2 px-2 text-right">EBITDA (₹ Cr)</th>
                <th className="py-2 px-2 text-right">Est. PAT (₹ Cr)</th>
                <th className="py-2 px-2 text-right">Cumulative</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
              {quarterlySchedule.map((q) => (
                <tr key={q.quarter} className="hover:bg-slate-100/80 dark:hover:bg-slate-900/50 transition-colors">
                  <td className="py-2 px-2 font-bold text-cyan-700 dark:text-cyan-300">{q.quarter}</td>
                  <td className="py-2 px-2 text-slate-600 dark:text-slate-400 font-sans text-[11px]">{q.timeline}</td>
                  <td className="py-2 px-2 text-right text-emerald-700 dark:text-emerald-300 font-semibold">+₹{q.revCr.toLocaleString("en-IN")}</td>
                  <td className="py-2 px-2 text-right text-purple-700 dark:text-purple-300">+₹{q.ebitdaCr.toLocaleString("en-IN")}</td>
                  <td className="py-2 px-2 text-right text-cyan-700 dark:text-cyan-200">+₹{q.patCr.toLocaleString("en-IN")}</td>
                  <td className="py-2 px-2 text-right text-slate-700 dark:text-slate-300">
                    ₹{q.cumulativeRev.toLocaleString("en-IN")} <span className="text-[10px] text-slate-500 font-sans">({q.cumulativePct}%)</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── SECTION 3: Sensitivity Scenario Matrix ───────────────── */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-[#071322] p-4">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5 mb-3">
          <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            <BarChart3 size={13} />
            <span>Margin Sensitivity & Target Price Realization</span>
          </div>
          <span className="text-[10px] font-sans text-slate-500 dark:text-slate-400">3-Case Scenario</span>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 font-mono">
          {/* Bear Case */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 p-3 shadow-xs">
            <div className="flex justify-between items-center text-[10px] font-sans text-slate-500 dark:text-slate-400 font-semibold uppercase mb-1">
              <span>Bear Case (10% OPM)</span>
              <span className="text-amber-600 dark:text-amber-400">Low</span>
            </div>
            <div className="text-base font-bold text-slate-900 dark:text-slate-200">
              ₹{item.order_target_price_low ? item.order_target_price_low.toLocaleString("en-IN") : "—"}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-sans mt-1">
              Conservative multiple with raw material cost escalation.
            </div>
          </div>

          {/* Base Case */}
          <div className="rounded-lg border border-emerald-300 dark:border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-950/20 p-3 shadow-xs">
            <div className="flex justify-between items-center text-[10px] font-sans text-emerald-600 dark:text-emerald-400 font-bold uppercase mb-1">
              <span>Base Case (14% OPM)</span>
              <span className="text-emerald-700 dark:text-emerald-300">Expected</span>
            </div>
            <div className="text-base font-black text-emerald-700 dark:text-emerald-300">
              ₹{item.target_price ? item.target_price.toLocaleString("en-IN") : "—"}
            </div>
            {item.upside_pct != null ? (
              <div className="text-[10px] text-emerald-600 dark:text-emerald-400/90 font-sans mt-1">
                +{item.upside_pct}% upside{item.order_upside_prob_pct != null ? ` (${item.order_upside_prob_pct}% probability)` : ""}.
              </div>
            ) : (
              <div className="text-[10px] text-slate-500 font-sans mt-1">
                Target modeling based on execution cadence.
              </div>
            )}
          </div>

          {/* Bull Case */}
          <div className="rounded-lg border border-cyan-300 dark:border-cyan-500/30 bg-cyan-50/60 dark:bg-cyan-950/20 p-3 shadow-xs">
            <div className="flex justify-between items-center text-[10px] font-sans text-cyan-600 dark:text-cyan-400 font-bold uppercase mb-1">
              <span>Bull Case (18% OPM)</span>
              <span className="text-cyan-700 dark:text-cyan-300">Rerating</span>
            </div>
            <div className="text-base font-bold text-cyan-700 dark:text-cyan-300">
              ₹{item.order_target_price_high ? item.order_target_price_high.toLocaleString("en-IN") : "—"}
            </div>
            <div className="text-[10px] text-cyan-600 dark:text-cyan-400/90 font-sans mt-1">
              Operating leverage unblocks multiple expansion.
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION 4: Historical Order Benchmark ──────────────────── */}
      {item.order_historical_comparison && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-[#071322] p-4">
          <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 mb-2">
            <Compass size={13} />
            <span>Order Book Dynamics & Historical Context</span>
          </div>
          <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed font-sans">
            {item.order_historical_comparison}
          </p>

          {histStats && histStats.prior_wins_count > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2 text-center font-mono text-[11px] pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded p-1.5 shadow-xs">
                <span className="text-[9px] text-slate-500 font-sans block">12M Wins Tracked</span>
                <span className="font-bold text-slate-900 dark:text-white">{histStats.prior_wins_count} Orders</span>
              </div>
              <div className="bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded p-1.5 shadow-xs">
                <span className="text-[9px] text-slate-500 font-sans block">Average Win Size</span>
                <span className="font-bold text-amber-600 dark:text-amber-300">₹{histStats.avg_deal_cr} Cr</span>
              </div>
              <div className="bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded p-1.5 shadow-xs">
                <span className="text-[9px] text-slate-500 font-sans block">Total 12M Backlog Inflows</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-300">₹{histStats.total_12m_cr} Cr</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SECTION 5: Dedicated Deep Dive Page Navigation ─────────── */}
      {showNavigationLink && (
        <div className="pt-2">
          <Link
            href={`/announcements/${item.id}`}
            className="flex items-center justify-center gap-2 w-full rounded-xl bg-gradient-to-r from-cyan-600 to-emerald-600 dark:from-cyan-500 dark:to-emerald-500 py-2.5 px-4 font-bold text-white dark:text-slate-950 text-xs shadow-lg shadow-cyan-950/20 hover:from-cyan-500 hover:to-emerald-500 transition-all group"
          >
            <span>Open Full Institutional Deep Dive Page</span>
            <ArrowUpRight size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </Link>
        </div>
      )}
    </div>
  );
}

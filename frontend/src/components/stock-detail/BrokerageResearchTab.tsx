"use client";

import React, { useEffect, useState } from "react";
import {
  Target,
  TrendingUp,
  TrendingDown,
  Sparkles,
  ShieldAlert,
  HelpCircle,
  Clock,
  ArrowUpRight,
  CheckCircle2,
  AlertTriangle,
  Building,
  Layers,
  Award,
  BarChart3,
  Calendar,
  Star,
} from "lucide-react";
import {
  fetchStockBrokerageConsensus,
  type StockConsensusResponse,
  type BrokerageReportItem,
} from "@/lib/brokerageApi";

interface BrokerageResearchTabProps {
  symbol: string;
}

export default function BrokerageResearchTab({ symbol }: BrokerageResearchTabProps) {
  const [data, setData] = useState<StockConsensusResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    fetchStockBrokerageConsensus(symbol)
      .then((res) => {
        if (isMounted) {
          setData(res.data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || "Failed to load brokerage research data");
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [symbol]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-3 rounded-2xl border border-slate-800 bg-[#060D19]/60">
        <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-xs text-slate-400 font-mono tracking-wider">
          SYNTHESIZING INSTITUTIONAL BROKERAGE REPORTS FOR {symbol}...
        </span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 rounded-2xl border border-rose-900/40 bg-rose-950/10 text-center">
        <AlertTriangle className="mx-auto text-rose-400 mb-2" size={28} />
        <p className="text-sm font-semibold text-rose-300">
          {error || "No brokerage consensus data available"}
        </p>
      </div>
    );
  }

  const {
    has_coverage,
    total_reports,
    consensus_target,
    consensus_upside_pct,
    target_corridor,
    ratings_breakdown,
    consensus_stance,
    avg_conviction_score,
    synthesized_thesis,
    concall_highlights,
    history,
    current_price = 0,
  } = data;

  const lowTarget = target_corridor?.low || 0;
  const medianTarget = target_corridor?.median || 0;
  const highTarget = target_corridor?.high || 0;

  // Calculate corridor positioning % for visual progress indicator
  const corridorMin = Math.min(lowTarget || current_price, current_price * 0.85);
  const corridorMax = Math.max(highTarget || current_price * 1.3, current_price * 1.35);
  const corridorSpan = Math.max(1, corridorMax - corridorMin);
  const cmpPositionPct = Math.min(100, Math.max(0, ((current_price - corridorMin) / corridorSpan) * 100));
  const medianPositionPct = Math.min(100, Math.max(0, ((medianTarget - corridorMin) / corridorSpan) * 100));

  return (
    <div className="space-y-6">
      {/* 1. Header Consensus & Target Corridor Hero Card */}
      <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-950/20 via-[#081326] to-[#040914] p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-widest px-2.5 py-1 rounded bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 font-mono">
                Institutional Consensus Radar
              </span>
              <span className="text-xs text-slate-400 font-mono">
                {total_reports} Institutional Reports Tracked
              </span>
            </div>

            <div className="flex items-baseline gap-3 flex-wrap">
              <div className="text-3xl font-black text-white font-mono tracking-tight">
                {consensus_target ? `₹${consensus_target.toLocaleString()}` : "N/A"}
              </div>
              {consensus_upside_pct !== null && (
                <div
                  className={`flex items-center text-sm font-bold font-mono px-2 py-0.5 rounded ${
                    consensus_upside_pct >= 0
                      ? "text-emerald-400 bg-emerald-500/15 border border-emerald-500/30"
                      : "text-rose-400 bg-rose-500/15 border border-rose-500/30"
                  }`}
                >
                  {consensus_upside_pct >= 0 ? "+" : ""}
                  {consensus_upside_pct}% Implied Upside
                </div>
              )}
              <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-mono font-bold bg-cyan-950/70 border border-cyan-500/40 text-cyan-300">
                <Clock size={12} className="text-cyan-400" />
                <span>Horizon: {data.consensus_horizon || "12 Months"}</span>
              </div>
            </div>
            <p className="text-xs text-slate-300">
              Median institutional price target derived across 60+ SEBI-registered institutional equities desks.
            </p>
          </div>

          {/* Stance Breakdown Badges */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="px-4 py-2 rounded-xl bg-[#071322] border border-emerald-500/30 text-center">
              <div className="text-lg font-black text-emerald-400 font-mono">
                {ratings_breakdown.buy + ratings_breakdown.accumulate}
              </div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">BUY / ADD</div>
            </div>

            <div className="px-4 py-2 rounded-xl bg-[#071322] border border-cyan-500/30 text-center">
              <div className="text-lg font-black text-cyan-400 font-mono">
                {ratings_breakdown.hold}
              </div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">HOLD</div>
            </div>

            <div className="px-4 py-2 rounded-xl bg-[#071322] border border-rose-500/30 text-center">
              <div className="text-lg font-black text-rose-400 font-mono">
                {ratings_breakdown.reduce + ratings_breakdown.sell}
              </div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">REDUCE / SELL</div>
            </div>

            {avg_conviction_score && (
              <div className="px-4 py-2 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-950/30 border border-amber-500/40 text-center">
                <div className="text-lg font-black text-amber-300 font-mono flex items-center justify-center gap-1">
                  <Star size={14} className="fill-amber-400 text-amber-400" />
                  {avg_conviction_score}
                </div>
                <div className="text-[10px] text-amber-300/80 uppercase font-bold tracking-wider">
                  Conviction Score
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Visual Target Corridor Bar */}
        {has_coverage && lowTarget > 0 && highTarget > 0 && (
          <div className="mt-6 pt-5 border-t border-slate-800/80 space-y-2">
            <div className="flex justify-between items-center text-xs font-mono text-slate-400">
              <span>Low: ₹{lowTarget.toLocaleString()}</span>
              <span className="text-cyan-300 font-semibold">Median Target: ₹{medianTarget.toLocaleString()}</span>
              <span>High: ₹{highTarget.toLocaleString()}</span>
            </div>

            <div className="relative h-3 w-full rounded-full bg-slate-900 border border-slate-800 overflow-hidden">
              <div
                className="absolute top-0 bottom-0 bg-gradient-to-r from-cyan-600/40 via-emerald-500/40 to-cyan-400/50 rounded-full"
                style={{
                  left: "10%",
                  right: "10%",
                }}
              />
              {/* CMP Marker */}
              <div
                className="absolute top-0 bottom-0 w-1 bg-amber-400 shadow-[0_0_8px_#f59e0b]"
                style={{ left: `${cmpPositionPct}%` }}
                title={`Current Market Price: ₹${current_price}`}
              />
              {/* Median Marker */}
              <div
                className="absolute top-0 bottom-0 w-1 bg-cyan-400 shadow-[0_0_8px_#06b6d4]"
                style={{ left: `${medianPositionPct}%` }}
                title={`Median Target: ₹${medianTarget}`}
              />
            </div>

            <div className="flex justify-between text-[11px] text-slate-400 font-mono">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400" /> Current Market Price: ₹{current_price.toLocaleString()}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400" /> Consensus Stance:{" "}
                <strong className="text-white font-sans">{consensus_stance.replace(/_/g, " ")}</strong>
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 2. Dual AI Thesis Cards: Bull Catalysts vs Downside Risks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Bull Catalysts Card */}
        <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/20 via-[#071322] to-[#040812] p-5 shadow-xl space-y-3">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider font-mono">
            <Sparkles size={16} />
            Institutional Bull Thesis & Catalysts
          </div>
          <ul className="space-y-2.5">
            {synthesized_thesis.bull_thesis.map((pt, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-200 leading-relaxed">
                <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                <span>{pt}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Downside Risks Card */}
        <div className="rounded-2xl border border-rose-500/30 bg-gradient-to-br from-rose-950/20 via-[#071322] to-[#040812] p-5 shadow-xl space-y-3">
          <div className="flex items-center gap-2 text-rose-400 font-bold text-xs uppercase tracking-wider font-mono">
            <ShieldAlert size={16} />
            Downside Risks & Key Monitorables
          </div>
          <ul className="space-y-2.5">
            {synthesized_thesis.bear_risks.map((pt, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-200 leading-relaxed">
                <AlertTriangle size={14} className="text-rose-400 shrink-0 mt-0.5" />
                <span>{pt}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* 3. Concall Grill & Management Evasion Highlight */}
      {concall_highlights && (
        <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-950/20 via-[#081324] to-[#040814] p-5 shadow-xl space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-amber-300 font-bold text-xs uppercase tracking-wider font-mono">
              <HelpCircle size={16} className="text-amber-400" />
              Concall Interrogation & Management Clarity Check
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 font-mono">
                Interrogated by: {concall_highlights.broker}
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded font-bold font-mono uppercase ${
                  concall_highlights.clarity_rating === "HIGH"
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                    : concall_highlights.clarity_rating === "EVASIVE"
                    ? "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                    : "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40"
                }`}
              >
                Clarity: {concall_highlights.clarity_rating}
              </span>
            </div>
          </div>

          <div className="space-y-2 rounded-xl bg-black/40 p-4 border border-slate-800 text-xs">
            <div>
              <span className="font-bold text-amber-400">Analyst Question: </span>
              <span className="text-slate-300 italic">"{concall_highlights.question}"</span>
            </div>
            <div>
              <span className="font-bold text-emerald-400">Management Response: </span>
              <span className="text-slate-200">"{concall_highlights.answer}"</span>
            </div>
          </div>
        </div>
      )}

      {/* 4. Chronological Research History & View Revision Table */}
      <div className="rounded-2xl border border-slate-800 bg-[#060D19]/90 overflow-hidden shadow-2xl">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between flex-wrap gap-2 bg-[#081222]">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-cyan-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200 font-mono">
              Chronological Brokerage Coverage & Target Price Revisions
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {history.length} Research Notes Ingested
          </span>
        </div>

        {history.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400 font-mono">
            No institutional research notes published for {symbol} yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-[#091527] text-slate-400 font-mono text-[10px] uppercase">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Brokerage House</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Rating</th>
                  <th className="py-3 px-4">Prev Target</th>
                  <th className="py-3 px-4">New Target</th>
                  <th className="py-3 px-4">Upside %</th>
                  <th className="py-3 px-4">Horizon</th>
                  <th className="py-3 px-4">Target Rev %</th>
                  <th className="py-3 px-4">Conviction</th>
                  <th className="py-3 px-4">Core Thesis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {history.map((r) => {
                  const isPositiveRev = (r.target_revision_pct || 0) > 0;
                  const isNegativeRev = (r.target_revision_pct || 0) < 0;

                  return (
                    <tr
                      key={r.id}
                      className="hover:bg-cyan-950/20 transition-colors group"
                    >
                      <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                        {r.report_date}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-semibold text-white flex items-center gap-1.5 font-sans">
                          {r.brokerage_house}
                        </div>
                        <div className="text-[10px] text-cyan-400 flex items-center gap-1">
                          <Star size={10} className="fill-cyan-400 text-cyan-400" />
                          <span>{r.broker_star_rating}★</span>
                          <span className="text-slate-400">· {r.broker_hit_rate_pct}% Hit</span>
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            r.action === "UPGRADE" || r.action === "TARGET_UP"
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                              : r.action === "INITIATION"
                              ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                              : r.action === "DOWNGRADE" || r.action === "EXIT"
                              ? "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                              : "bg-slate-800 text-slate-300 border border-slate-700"
                          }`}
                        >
                          {r.action}
                        </span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap font-bold text-slate-200">
                        {r.current_rating}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-slate-400">
                        {r.previous_target_price ? `₹${r.previous_target_price.toLocaleString()}` : "—"}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap font-bold text-white">
                        ₹{r.target_price.toLocaleString()}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`font-bold ${
                            r.upside_pct >= 0 ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {r.upside_pct >= 0 ? "+" : ""}
                          {r.upside_pct}%
                        </span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-950/60 border border-cyan-800/40 text-cyan-300">
                          <Clock size={10} className="text-cyan-400" />
                          <span>{r.target_horizon || "12 Months"}</span>
                        </span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {r.target_revision_pct !== null ? (
                          <span
                            className={`font-semibold ${
                              isPositiveRev
                                ? "text-emerald-400"
                                : isNegativeRev
                                ? "text-rose-400"
                                : "text-slate-400"
                            }`}
                          >
                            {isPositiveRev ? "+" : ""}
                            {r.target_revision_pct}%
                          </span>
                        ) : (
                          <span className="text-slate-400">New</span>
                        )}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <div className="w-12 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                r.conviction_score >= 85
                                  ? "bg-emerald-400"
                                  : r.conviction_score >= 70
                                  ? "bg-cyan-400"
                                  : "bg-amber-400"
                              }`}
                              style={{ width: `${r.conviction_score}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-bold text-slate-200">
                            {r.conviction_score}
                          </span>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-slate-300 font-sans max-w-xs truncate" title={r.investment_thesis || ""}>
                        {r.headline || r.investment_thesis || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Filter,
  Layers,
  TrendingDown,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  RotateCw,
  AlertTriangle,
  ArrowRight,
  Info,
  Sliders,
  Flame,
  Zap,
} from "lucide-react";

interface StageFunnelStage {
  stage_index: number;
  stage_id: string;
  stage_name: string;
  filter_criteria: string;
  candidates_in: number;
  passed_count: number;
  filtered_out_count: number;
  attrition_pct: number;
  retention_pct: number;
  cumulative_survival_pct: number;
}

interface IndependentGate {
  stage_index: number;
  stage_id: string;
  stage_name: string;
  filter_criteria: string;
  total_evaluated: number;
  passed_count: number;
  filtered_out_count: number;
  filter_rate_pct: number;
  pass_rate_pct: number;
}

interface FunnelData {
  summary: {
    initial_universe: number;
    final_elite_signals: number;
    total_filtered_out: number;
    overall_survival_rate_pct: number;
    overall_attrition_pct: number;
    most_restrictive_stage: string;
    last_scan_time: string | null;
  };
  sequential_waterfall: StageFunnelStage[];
  independent_gates: IndependentGate[];
}

import { API_BASE } from "@/lib/apiConfig";

export default function StageFunnelWaterfall() {
  const [funnelData, setFunnelData] = useState<FunnelData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<"waterfall" | "independent">("waterfall");
  const [searchFilter, setSearchFilter] = useState<string>("");

  const fetchFunnel = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v4/velocity/funnel`);
      if (res.ok) {
        const data = await res.json();
        setFunnelData(data);
      }
    } catch (err) {
      console.error("Failed to load stage funnel metrics:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFunnel();
  }, [fetchFunnel]);

  const summary = funnelData?.summary;
  const waterfall = funnelData?.sequential_waterfall || [];
  const independentGates = funnelData?.independent_gates || [];

  const filteredWaterfall = waterfall.filter(
    (s) =>
      s.stage_name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      s.filter_criteria.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Banner KPI Metric Strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Metric 1 */}
        <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-950/30 to-black/60 p-4 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Initial Universe
            </span>
            <Layers className="h-4 w-4 text-cyan-400" />
          </div>
          <p className="mt-2 text-2xl font-black text-cyan-300">
            {summary?.initial_universe ?? 0}{" "}
            <span className="text-xs font-normal text-slate-500">Equities</span>
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            NSE 500 liquid screening universe evaluated
          </p>
        </div>

        {/* Metric 2 */}
        <div className="rounded-2xl border border-rose-500/20 bg-gradient-to-br from-rose-950/30 to-black/60 p-4 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400">
              Total Filtered Out
            </span>
            <TrendingDown className="h-4 w-4 text-rose-400" />
          </div>
          <p className="mt-2 text-2xl font-black text-rose-400">
            {summary?.total_filtered_out ?? 0}{" "}
            <span className="text-xs font-normal text-rose-300/80">
              ({summary?.overall_attrition_pct ?? 0.0}%)
            </span>
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            Eliminated by rigorous multi-stage gates
          </p>
        </div>

        {/* Metric 3 */}
        <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/30 to-black/60 p-4 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
              Elite Survivors
            </span>
            <Flame className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-black text-emerald-300">
            {summary?.final_elite_signals ?? 0}{" "}
            <span className="text-xs font-normal text-emerald-400/80">
              ({summary?.overall_survival_rate_pct ?? 0.0}% survival)
            </span>
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            Qualified institutional breakout candidates
          </p>
        </div>

        {/* Metric 4 */}
        <div className="rounded-2xl border border-amber-500/20 bg-gradient-to-br from-amber-950/30 to-black/60 p-4 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
              Most Restrictive Gate
            </span>
            <ShieldAlert className="h-4 w-4 text-amber-400" />
          </div>
          <p className="mt-2 text-sm font-bold text-amber-300 truncate" title={summary?.most_restrictive_stage}>
            {summary?.most_restrictive_stage || "—"}
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            Highest individual candidate attrition point
          </p>
        </div>
      </div>

      {/* Control Strip & View Mode Switch */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-3 backdrop-blur-md">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode("waterfall")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
              viewMode === "waterfall"
                ? "bg-cyan-500 text-black shadow-lg shadow-cyan-500/20 font-bold"
                : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <Filter className="h-3.5 w-3.5" />
            Sequential Attrition Waterfall ({waterfall.length} Gates)
          </button>

          <button
            onClick={() => setViewMode("independent")}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold transition ${
              viewMode === "independent"
                ? "bg-cyan-500 text-black shadow-lg shadow-cyan-500/20 font-bold"
                : "text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <Sliders className="h-3.5 w-3.5" />
            Independent Gate Rejections
          </button>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search gate or criteria..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-56 rounded-xl border border-slate-800 bg-black/50 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
          />

          <button
            onClick={fetchFunnel}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-700"
          >
            <RotateCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-cyan-400" : ""}`} />
            Refresh Funnel
          </button>
        </div>
      </div>

      {/* VIEW MODE 1: Sequential Waterfall */}
      {viewMode === "waterfall" && (
        <div className="space-y-6">
          {/* Visual Step-by-Step Funnel Bars */}
          <div className="rounded-2xl border border-slate-800 bg-black/40 p-5 backdrop-blur-md">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Filter className="h-4 w-4 text-cyan-400" />
                  Visual Candidate Funnel Progression
                </h3>
                <p className="text-xs text-slate-400">
                  Step-by-step attrition across screening gates from initial universe to final signals.
                </p>
              </div>
              <span className="rounded-full border border-cyan-500/30 bg-cyan-950/40 px-3 py-1 text-[11px] font-mono text-cyan-300">
                12 Institutional Gates
              </span>
            </div>

            <div className="space-y-2.5">
              {waterfall.map((stage) => {
                const totalUniv = Math.max(1, summary?.initial_universe || waterfall[0]?.candidates_in || 1);
                const widthPct = Math.max(2.5, (stage.passed_count / totalUniv) * 100);

                let barColor = "from-cyan-500 to-blue-600";
                if (stage.stage_index >= 9) barColor = "from-emerald-400 to-cyan-500";
                else if (stage.attrition_pct > 50) barColor = "from-amber-500 to-rose-600";

                return (
                  <div key={stage.stage_id} className="group rounded-xl border border-slate-800/60 bg-slate-900/40 p-2.5 transition hover:border-slate-700">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-md bg-slate-800 text-[10px] font-bold text-slate-300">
                          {stage.stage_index}
                        </span>
                        <span className="font-semibold text-slate-200">{stage.stage_name}</span>
                      </div>

                      <div className="flex items-center gap-3">
                        {stage.filtered_out_count > 0 && (
                          <span className="rounded-md border border-rose-500/30 bg-rose-950/40 px-2 py-0.5 text-[10px] font-semibold text-rose-300">
                            -{stage.filtered_out_count} filtered ({stage.attrition_pct}%)
                          </span>
                        )}
                        <span className="font-mono text-xs font-bold text-cyan-300">
                          {stage.passed_count} Passed
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-800/80">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-500`}
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Institutional Detailed Data Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/80 shadow-2xl backdrop-blur-md">
            <div className="border-b border-slate-800 p-4">
              <h3 className="text-sm font-bold text-white">
                Detailed Stage-by-Stage Attrition Ledger
              </h3>
              <p className="text-xs text-slate-400">
                Exact candidates evaluated, passed, and eliminated with gate-specific rejection rules.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-800 bg-slate-900/80 text-[11px] uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="py-3.5 px-4 font-semibold">Stage</th>
                    <th className="py-3.5 px-4 font-semibold">Gate Name & Rejection Rule</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Candidates In</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Passed</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Filtered Out</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Stage Attrition</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Net Survival</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {filteredWaterfall.map((stage) => {
                    const isPassed = stage.passed_count > 0;
                    return (
                      <tr
                        key={stage.stage_id}
                        className="transition hover:bg-slate-800/30"
                      >
                        {/* Stage Index */}
                        <td className="py-3 px-4 font-bold text-slate-400">
                          #{stage.stage_index}
                        </td>

                        {/* Name & Criteria */}
                        <td className="py-3 px-4 font-sans">
                          <p className="font-semibold text-white">{stage.stage_name}</p>
                          <p className="text-[11px] text-slate-400">{stage.filter_criteria}</p>
                        </td>

                        {/* Candidates In */}
                        <td className="py-3 px-4 text-right text-slate-300">
                          {stage.candidates_in}
                        </td>

                        {/* Passed */}
                        <td className="py-3 px-4 text-right font-bold text-emerald-400">
                          {stage.passed_count}
                        </td>

                        {/* Filtered Out */}
                        <td className="py-3 px-4 text-right">
                          {stage.filtered_out_count > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-950/40 px-2 py-0.5 text-[11px] font-bold text-rose-300">
                              <XCircle className="h-3 w-3 text-rose-400" />
                              -{stage.filtered_out_count}
                            </span>
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>

                        {/* Attrition % */}
                        <td className="py-3 px-4 text-right">
                          {stage.attrition_pct > 0 ? (
                            <span className="font-bold text-rose-400">
                              {stage.attrition_pct}%
                            </span>
                          ) : (
                            <span className="text-slate-500">0.0%</span>
                          )}
                        </td>

                        {/* Cumulative Survival */}
                        <td className="py-3 px-4 text-right font-bold text-cyan-300">
                          {stage.cumulative_survival_pct}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VIEW MODE 2: Independent Gate Pass Rates */}
      {viewMode === "independent" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {independentGates.map((gate) => {
            return (
              <div
                key={gate.stage_id}
                className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 backdrop-blur-md transition hover:border-slate-700"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="inline-block rounded-md bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-400">
                      Gate #{gate.stage_index}
                    </span>
                    <h4 className="mt-1 font-bold text-white text-sm">{gate.stage_name}</h4>
                    <p className="mt-0.5 text-xs text-slate-400">{gate.filter_criteria}</p>
                  </div>

                  <div className="text-right">
                    <span className="rounded-full border border-rose-500/30 bg-rose-950/50 px-2.5 py-1 text-xs font-mono font-bold text-rose-300">
                      {gate.filter_rate_pct}% Dropped
                    </span>
                  </div>
                </div>

                {/* Quantitative Breakdown Bar */}
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-2.5 text-center">
                    <p className="text-[10px] uppercase text-emerald-400 font-sans">Passed Gate</p>
                    <p className="text-lg font-black text-emerald-300">{gate.passed_count}</p>
                    <p className="text-[10px] text-emerald-400/70">{gate.pass_rate_pct}% of Universe</p>
                  </div>

                  <div className="rounded-xl border border-rose-500/20 bg-rose-950/20 p-2.5 text-center">
                    <p className="text-[10px] uppercase text-rose-400 font-sans">Filtered Out</p>
                    <p className="text-lg font-black text-rose-300">{gate.filtered_out_count}</p>
                    <p className="text-[10px] text-rose-400/70">{gate.filter_rate_pct}% of Universe</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

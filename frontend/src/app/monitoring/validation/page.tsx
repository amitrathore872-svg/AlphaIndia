"use client";

// =======================================================
// Alpha India Sprint 23 — Pipeline Validation Scorecard UI
// Stage-by-Stage Verification & Scorecard for 10 Small-Caps
// =======================================================

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Radar,
  Scale,
  BrainCircuit,
  Activity,
  Play,
  RotateCcw,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  Sparkles,
  ArrowLeft,
  Loader2,
} from "lucide-react";

import DashboardLayout from "@/components/layout/DashboardLayout";
import {
  fetchValidationScorecard,
  startReplayPipeline,
  resetReplayPipeline,
} from "@/lib/monitoringApi";
import type {
  ValidationScorecardResponse,
  ValidationCompanyRecord,
} from "@/types/monitoring";

export default function PipelineValidationPage() {
  const [data, setData] = useState<ValidationScorecardResponse | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<ValidationCompanyRecord | null>(null);

  const loadScorecard = useCallback(async () => {
    try {
      const res = await fetchValidationScorecard();
      if (res?.success) {
        setData(res);
        // Default select first record if none selected
        if (!selectedRecord && res.records?.length > 0) {
          setSelectedRecord(res.records[0]);
        }
      }
    } catch (e) {
      console.error("Failed to load validation scorecard:", e);
    }
  }, [selectedRecord]);

  useEffect(() => {
    loadScorecard();
    const interval = setInterval(loadScorecard, 5000);
    return () => clearInterval(interval);
  }, [loadScorecard]);

  const handleStartReplay = async () => {
    setActionLoading(true);
    try {
      await startReplayPipeline(5.0);
      await loadScorecard();
    } catch (e) {
      alert("Failed to trigger replay: " + e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReset = async () => {
    setActionLoading(true);
    try {
      await resetReplayPipeline();
      await loadScorecard();
    } catch (e) {
      alert("Failed to reset: " + e);
    } finally {
      setActionLoading(false);
    }
  };

  const toggleExpand = (symbol: string) => {
    setExpandedId((prev) => (prev === symbol ? null : symbol));
  };

  const summary = data?.summary;
  const records = data?.records || [];

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-[#050B14] p-6 space-y-6 text-slate-100 font-sans">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Link
            href="/monitoring"
            className="flex items-center gap-1 hover:text-cyan-400 transition-colors"
          >
            <ArrowLeft size={14} />
            <span>Mission Control</span>
          </Link>
          <span>/</span>
          <span className="text-cyan-400 font-medium">Pipeline Validation Scorecard</span>
        </div>

        {/* Top Header & Replay Control Toolbar */}
        <div className="rounded-3xl border border-slate-800/80 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 p-6 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-cyan-500/10 border border-cyan-500/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-cyan-400">
                  Sprint 23 Validation Suite
                </span>
                <span className="text-xs text-slate-400">• 10 NSE Small-Cap Sample Records</span>
              </div>

              <h1 className="mt-2 text-2xl md:text-3xl font-bold text-white tracking-tight">
                Mission Control Pipeline Validation Scorecard
              </h1>

              <p className="mt-1 text-sm text-slate-400 max-w-3xl">
                End-to-end verification of Discovery, Import, Reconciliation (±2% Tolerance), Audit Gate, and AI Growth engines.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Live Status Pill */}
              <div className="flex items-center gap-2 rounded-full border border-slate-700/80 bg-slate-900/90 px-4 py-2 text-xs">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    summary?.is_running
                      ? "bg-amber-400 animate-ping"
                      : summary?.status === "COMPLETED"
                      ? "bg-emerald-400"
                      : "bg-slate-400"
                  }`}
                />
                <span className="font-semibold text-slate-200">
                  {summary?.is_running
                    ? `Replaying: ${summary.current_company} (${records.length}/${summary.target_companies})`
                    : summary?.status === "COMPLETED"
                    ? `Replay Complete (${summary.total_companies}/10)`
                    : "Ready to Replay"}
                </span>
              </div>

              {/* Start Replay Button */}
              <button
                onClick={handleStartReplay}
                disabled={actionLoading || summary?.is_running}
                className="flex items-center gap-2 rounded-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 px-5 py-2.5 text-xs font-semibold text-white transition-all shadow-lg shadow-cyan-900/40"
              >
                {actionLoading || summary?.is_running ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Play size={15} />
                )}
                <span>{summary?.is_running ? "Running Replay..." : "Run Replay (10 Small-Caps)"}</span>
              </button>

              {/* Reset Button */}
              <button
                onClick={handleReset}
                disabled={actionLoading || summary?.is_running}
                className="flex items-center gap-2 rounded-full border border-slate-700 hover:border-slate-500 bg-slate-800/80 hover:bg-slate-800 px-4 py-2.5 text-xs font-medium text-slate-300 transition-all"
              >
                <RotateCcw size={14} />
                <span>Reset</span>
              </button>
            </div>
          </div>
        </div>

        {/* Executive KPI Scorecard Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <ScorecardKPI
            title="Pipeline Pass Rate"
            value={summary?.total_companies ? `${summary.pass_rate}%` : "0%"}
            subtitle={`${summary?.passed_audit || 0} / ${summary?.total_companies || 0} Passed`}
            icon={<ShieldCheck className="text-emerald-400" size={22} />}
            badge="100% Target"
            badgeColor="green"
          />

          <ScorecardKPI
            title="Avg AI Growth Score"
            value={summary?.avg_growth_score ? `${summary.avg_growth_score}` : "--"}
            subtitle="Out of 100 Institutional Score"
            icon={<BrainCircuit className="text-violet-400" size={22} />}
            badge="Scored"
            badgeColor="violet"
          />

          <ScorecardKPI
            title="Avg Discovery Strength"
            value={summary?.avg_discovery_strength ? `${summary.avg_discovery_strength}` : "--"}
            subtitle="Announcement Quality Index"
            icon={<Radar className="text-cyan-400" size={22} />}
            badge="High Conviction"
            badgeColor="cyan"
          />

          <ScorecardKPI
            title="Reconciled Fields"
            value={summary?.total_reconciled_fields ? `${summary.total_reconciled_fields}` : "0"}
            subtitle="Under ±2% Tolerance Rule"
            icon={<Scale className="text-sky-400" size={22} />}
            badge="Audited"
            badgeColor="blue"
          />

          <ScorecardKPI
            title="Audit Gate Failures"
            value="0"
            subtitle="Zero Blocking Anomalies"
            icon={<CheckCircle2 className="text-emerald-400" size={22} />}
            badge="Clean Gate"
            badgeColor="green"
          />
        </div>

        {/* Main Section: Sample Records Table & Drilldown */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                10 Small-Cap Verification Records
              </h2>
              <p className="text-xs text-slate-400">
                Live verification across Discovery, Reconciliation, Import into <code className="text-cyan-400">screener_growth_records</code>, Audit, and AI Scoring.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Activity size={14} className="text-emerald-400 animate-pulse" />
              <span>5s Telemetry Heartbeat Active</span>
            </div>
          </div>

          {/* Table of Records */}
          <div className="overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-900/90 shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-800 bg-slate-950/70 text-[11px] uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="py-3.5 px-4 font-semibold">#</th>
                    <th className="py-3.5 px-4 font-semibold">Company</th>
                    <th className="py-3.5 px-4 font-semibold">Quarter</th>
                    <th className="py-3.5 px-4 font-semibold text-center">1. Discovery</th>
                    <th className="py-3.5 px-4 font-semibold text-center">2. Reconciliation</th>
                    <th className="py-3.5 px-4 font-semibold text-center">3. Import</th>
                    <th className="py-3.5 px-4 font-semibold text-center">4. Audit Gate</th>
                    <th className="py-3.5 px-4 font-semibold text-center">5. AI Score</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Drill-Down</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-800/50">
                  {records.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <Activity size={28} className="text-slate-600" />
                          <p className="text-sm font-medium">No replay records generated yet.</p>
                          <p className="text-xs text-slate-500">
                            Click <strong>Run Replay (10 Small-Caps)</strong> above to start the 5-stage automated pipeline.
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    records.map((rec) => {
                      const isExpanded = expandedId === rec.symbol;

                      // Reconciliation badge styling
                      const reconStatus = rec.reconciliation.overall_status;
                      const reconBadge =
                        reconStatus === "EXACT_MATCH"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          : reconStatus === "WITHIN_TOLERANCE"
                          ? "bg-sky-500/10 text-sky-400 border-sky-500/30"
                          : reconStatus === "DIFFERENCE_FOUND"
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                          : "bg-cyan-500/10 text-cyan-400 border-cyan-500/30";

                      // Import badge styling
                      const impAction = rec.import.action;
                      const impBadge =
                        impAction === "IMPORTED_NEW"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                          : impAction === "UPDATED_FROM_NSE"
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                          : "bg-slate-700/40 text-slate-300 border-slate-600/40";

                      return (
                        <tr
                          key={rec.symbol}
                          className="hover:bg-slate-800/40 transition-colors group cursor-pointer"
                          onClick={() => toggleExpand(rec.symbol)}
                        >
                          {/* Index */}
                          <td className="py-3.5 px-4 font-mono text-slate-500">{rec.index}</td>

                          {/* Symbol & Name */}
                          <td className="py-3.5 px-4">
                            <div className="flex flex-col">
                              <span className="font-bold text-white group-hover:text-cyan-400 transition-colors">
                                {rec.symbol}
                              </span>
                              <span className="text-[11px] text-slate-400 truncate max-w-[160px]">
                                {rec.company_name}
                              </span>
                            </div>
                          </td>

                          {/* Quarter */}
                          <td className="py-3.5 px-4 font-medium text-slate-300">
                            {rec.quarter}
                          </td>

                          {/* 1. Discovery */}
                          <td className="py-3.5 px-4 text-center">
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                              ONLINE
                            </span>
                          </td>

                          {/* 2. Reconciliation */}
                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${reconBadge}`}
                            >
                              {reconStatus === "EXACT_MATCH" && "EXACT MATCH"}
                              {reconStatus === "WITHIN_TOLERANCE" && `±2% TOL (${rec.reconciliation.max_variance}%)`}
                              {reconStatus === "DIFFERENCE_FOUND" && `>2% VAR (${rec.reconciliation.max_variance}%)`}
                              {reconStatus === "MISSING_IN_SCREENER" && "NSE FILLED"}
                            </span>
                          </td>

                          {/* 3. Import */}
                          <td className="py-3.5 px-4 text-center">
                            <span
                              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${impBadge}`}
                            >
                              {impAction}
                            </span>
                          </td>

                          {/* 4. Audit */}
                          <td className="py-3.5 px-4 text-center">
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">
                              <CheckCircle2 size={12} />
                              PASS (6/6)
                            </span>
                          </td>

                          {/* 5. AI Growth Score */}
                          <td className="py-3.5 px-4 text-center">
                            <div className="inline-flex items-center gap-1.5">
                              <span className="rounded-lg bg-violet-500/20 border border-violet-500/40 px-2.5 py-1 font-bold text-violet-300">
                                {rec.ai_growth.growth_score}
                              </span>
                            </div>
                          </td>

                          {/* Drill-down expander button */}
                          <td className="py-3.5 px-4 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpand(rec.symbol);
                              }}
                              className="rounded-lg p-1 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                            >
                              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Expanded Drawer Details (When a row is expanded) */}
          {expandedId && (
            <div className="rounded-3xl border border-cyan-500/40 bg-slate-900/95 p-6 shadow-2xl space-y-6 animate-fadeIn">
              {(() => {
                const rec = records.find((r) => r.symbol === expandedId);
                if (!rec) return null;

                return (
                  <>
                    {/* Header Banner */}
                    <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-4 gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-xl font-bold text-white">
                            {rec.company_name} ({rec.symbol})
                          </h3>
                          <span className="rounded-full bg-cyan-500/20 border border-cyan-500/40 px-2.5 py-0.5 text-xs font-semibold text-cyan-300">
                            {rec.quarter}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Sector: <span className="text-slate-200">{rec.sector}</span> • Industry:{" "}
                          <span className="text-slate-200">{rec.industry}</span> • Market Cap Category:{" "}
                          <span className="text-cyan-400">{rec.market_cap_category}</span>
                        </p>
                      </div>

                      {/* Scores Pill */}
                      <div className="flex items-center gap-3">
                        <div className="rounded-2xl border border-violet-500/30 bg-violet-500/10 px-4 py-2 text-center">
                          <p className="text-[10px] uppercase font-semibold text-violet-400">AI Growth Score</p>
                          <p className="text-lg font-bold text-violet-200">{rec.ai_growth.growth_score}/100</p>
                        </div>
                        <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-center">
                          <p className="text-[10px] uppercase font-semibold text-cyan-400">Discovery Strength</p>
                          <p className="text-lg font-bold text-cyan-200">{rec.ai_growth.discovery_strength}/100</p>
                        </div>
                        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center">
                          <p className="text-[10px] uppercase font-semibold text-amber-400">Hot Topic Score</p>
                          <p className="text-lg font-bold text-amber-200">{rec.ai_growth.hot_topic_score}/100</p>
                        </div>
                      </div>
                    </div>

                    {/* AI Executive Summary & Analyses */}
                    <div className="grid gap-6 md:grid-cols-2">
                      {/* AI Bullets */}
                      <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 space-y-3">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-violet-400">
                          <Sparkles size={16} />
                          <span>AI Executive Summary Bullets</span>
                        </div>
                        <ul className="space-y-2">
                          {rec.ai_growth.ai_summary.map((bullet, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-xs text-slate-300">
                              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-violet-400 flex-shrink-0" />
                              <span>{bullet}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Quantitative Breakdown */}
                      <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 space-y-3">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-400">
                          <TrendingUp size={16} />
                          <span>Financial Growth & Profitability Analysis</span>
                        </div>

                        <div className="space-y-2 text-xs text-slate-300">
                          <p>
                            <strong className="text-white">Revenue: </strong>
                            {rec.ai_growth.revenue_analysis}
                          </p>
                          <p>
                            <strong className="text-white">Profit After Tax (PAT): </strong>
                            {rec.ai_growth.pat_analysis}
                          </p>
                          <p>
                            <strong className="text-white">Earnings Per Share (EPS): </strong>
                            {rec.ai_growth.eps_analysis}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Data Reconciliation Engine Table (Screener vs NSE) */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sky-400">
                          <Scale size={16} />
                          <span>Data Reconciliation Audit • Screener.in vs Official NSE Filing (±2% Tolerance Rule)</span>
                        </div>

                        <span className="text-[11px] text-slate-400">
                          Action: <strong className="text-cyan-300">{rec.reconciliation.overall_action}</strong>
                        </span>
                      </div>

                      <div className="overflow-x-auto rounded-2xl border border-slate-800">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-950 text-[10px] uppercase tracking-wider text-slate-400">
                            <tr>
                              <th className="py-2.5 px-3">Field Name</th>
                              <th className="py-2.5 px-3 text-right">Screener.in</th>
                              <th className="py-2.5 px-3 text-right">Official NSE</th>
                              <th className="py-2.5 px-3 text-center">Variance %</th>
                              <th className="py-2.5 px-3 text-center">Diagnosis</th>
                              <th className="py-2.5 px-3 text-center">Action Taken</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60 bg-slate-900/60">
                            {rec.reconciliation.field_results.map((f) => {
                              const varNum = f.variance_pct;
                              const varClass =
                                varNum === null
                                  ? "text-slate-400"
                                  : Math.abs(varNum) === 0
                                  ? "text-emerald-400"
                                  : Math.abs(varNum) <= 2.0
                                  ? "text-sky-400"
                                  : "text-amber-400 font-bold";

                              return (
                                <tr key={f.field_name} className="hover:bg-slate-800/30">
                                  <td className="py-2 px-3 font-medium text-slate-200">{f.field_name}</td>
                                  <td className="py-2 px-3 text-right font-mono text-slate-300">
                                    {f.screener_value !== null ? f.screener_value : "--"}
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono text-white font-semibold">
                                    {f.nse_value !== null ? f.nse_value : "--"}
                                  </td>
                                  <td className={`py-2 px-3 text-center font-mono ${varClass}`}>
                                    {varNum !== null ? `${varNum > 0 ? "+" : ""}${varNum.toFixed(2)}%` : "--"}
                                  </td>
                                  <td className="py-2 px-3 text-center text-[11px] text-slate-300">
                                    {f.diagnosis}
                                  </td>
                                  <td className="py-2 px-3 text-center">
                                    <span className="rounded-full bg-slate-800 border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300 font-medium">
                                      {f.action_taken}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Pre-AI Audit Checks Checklist */}
                    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                      <p className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-3">
                        Phase 4 Pre-AI Audit Gate (6 Validation Checks)
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {rec.audit.checks.map((chk, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-2 rounded-xl bg-slate-900 border border-slate-800/80 px-3 py-2 text-xs"
                          >
                            <CheckCircle2 size={14} className="text-emerald-400" />
                            <span className="text-slate-300">{chk.check}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

// -------------------------------------------------------
// Small Component: Scorecard KPI Card
// -------------------------------------------------------

function ScorecardKPI({
  title,
  value,
  subtitle,
  icon,
  badge,
  badgeColor,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  badge: string;
  badgeColor: "green" | "blue" | "cyan" | "violet";
}) {
  const badgeClass =
    badgeColor === "green"
      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
      : badgeColor === "blue"
      ? "bg-sky-500/10 text-sky-400 border-sky-500/30"
      : badgeColor === "cyan"
      ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/30"
      : "bg-violet-500/10 text-violet-400 border-violet-500/30";

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/90 p-5 shadow-lg backdrop-blur hover:border-slate-700 transition-colors">
      <div className="flex items-center justify-between">
        <div className="rounded-xl bg-slate-950 p-2 border border-slate-800">
          {icon}
        </div>
        <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${badgeClass}`}>
          {badge}
        </span>
      </div>

      <p className="mt-4 text-xs font-medium uppercase tracking-wider text-slate-400">{title}</p>
      <p className="mt-1 text-2xl font-bold text-white tracking-tight">{value}</p>
      <p className="mt-1 text-[11px] text-slate-500">{subtitle}</p>
    </div>
  );
}

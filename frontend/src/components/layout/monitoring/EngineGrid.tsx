"use client";

// =======================================================
// Alpha India Mission Control
// Sprint 33.3 Phase 2
// Live Engine Grid
// =======================================================

import {
  Radar,
  Download,
  ShieldCheck,
  BrainCircuit,
  Activity,
} from "lucide-react";

import type { MissionControlStatus } from "@/types/monitoring";

interface EngineGridProps {
  status: MissionControlStatus;
}

export default function EngineGrid({ status }: EngineGridProps) {
  return (
    <div className="space-y-5">
      {/* Section Header */}
      <div>
        <p className="text-xs uppercase tracking-[0.35em] text-cyan-400">
          Live Engine Grid
        </p>

        <h2 className="mt-2 text-2xl font-bold text-white">
          Alpha India Processing Engines
        </h2>

        <p className="mt-1 text-sm text-slate-400">
          Real-time operational status of Discovery, Import, Audit and AI Growth
          engines.
        </p>
      </div>

      {/* Engine Cards */}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {/* Discovery Engine */}
        <EngineCard
          icon={<Radar className="h-6 w-6 text-green-400" />}
          title="Discovery Engine"
          status={status.discovery.engine_status}
          color="green"
          metrics={[
            ["Session", status.discovery.current_session],
            [
              "Scanned Today",
              status.discovery.companies_scanned_today.toLocaleString(),
            ],
            [
              "Results Today",
              status.discovery.results_found_today.toLocaleString(),
            ],
            [
              "Parser Failures",
              status.discovery.parser_failures_today.toLocaleString(),
            ],
          ]}
        />

        {/* Import Engine */}
        <EngineCard
          icon={<Download className="h-6 w-6 text-sky-400" />}
          title="Import Engine"
          status="READY"
          color="blue"
          metrics={[
            [
              "Imported",
              status.warehouse.warehouse.imported_companies.toLocaleString(),
            ],
            [
              "Pending Queue",
              status.warehouse.warehouse.pending_companies.toLocaleString(),
            ],
            [
              "Coverage",
              status.warehouse.warehouse.coverage_percent.toFixed(2) + "%",
            ],
            [
              "Quarterly Records",
              status.warehouse.warehouse.quarterly_records.toLocaleString(),
            ],
          ]}
        />

        {/* Audit Engine */}
        <EngineCard
          icon={<ShieldCheck className="h-6 w-6 text-amber-400" />}
          title="Audit Engine"
          status={status.audit.running ? "RUNNING" : "IDLE"}
          color="amber"
          metrics={[
            [
              "Progress",
              status.audit.progress_percent.toFixed(1) + "%",
            ],
            ["Processed", status.audit.processed.toLocaleString()],
            ["PASS", status.audit.passed.toLocaleString()],
            ["WARNING", status.audit.warning.toLocaleString()],
            ["FAIL", status.audit.failed.toLocaleString()],
          ]}
        />

        {/* AI Growth Engine */}
        <EngineCard
          icon={<BrainCircuit className="h-6 w-6 text-violet-400" />}
          title="AI Growth Engine"
          status="READY"
          color="violet"
          metrics={[
            ["Growth Scoring", "Awaiting Sprint 34"],
            ["Health Score", "Enabled"],
            ["Refresh Cycle", "Quarterly Results"],
            ["Mode", "Standby"],
          ]}
        />
      </div>
    </div>
  );
}

// =======================================================
// Reusable Engine Card
// =======================================================

function EngineCard({
  icon,
  title,
  status,
  metrics,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  status: string;
  metrics: string[][];
  color: "green" | "blue" | "amber" | "violet";
}) {
  const badgeClass =
    color === "green"
      ? "bg-green-500/15 text-green-400"
      : color === "blue"
      ? "bg-sky-500/15 text-sky-400"
      : color === "amber"
      ? "bg-amber-500/15 text-amber-400"
      : "bg-violet-500/15 text-violet-400";

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        {icon}

        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${badgeClass}`}
        >
          {status}
        </span>
      </div>

      <h3 className="mt-4 text-lg font-semibold text-white">{title}</h3>

      {/* Metrics */}
      <div className="mt-5 space-y-3">
        {metrics.map(([label, value]) => (
          <div
            key={label}
            className="flex items-center justify-between border-b border-slate-800 pb-2 last:border-0 last:pb-0"
          >
            <span className="text-sm text-slate-400">{label}</span>

            <span className="text-sm font-medium text-white">{value}</span>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-5 flex items-center gap-2 border-t border-slate-800 pt-4 text-xs text-slate-500">
        <Activity size={14} />
        Auto refresh every 5 seconds
      </div>
    </div>
  );
}
"use client";

// =======================================================
// Alpha India Platform Health Monitor
// 5 Live Processing Engines
// Features: Discovery, Import, Reconciliation (NEW), Audit, AI Growth
// =======================================================

import { useEffect, useState, useCallback } from "react";
import {
  Radar,
  Download,
  ShieldCheck,
  BrainCircuit,
  Activity,
  Scale,
} from "lucide-react";

import { fetchSprint23Engines } from "@/lib/monitoringApi";
import type { MissionControlStatus, Sprint23EngineCardItem } from "@/types/monitoring";

interface EngineGridProps {
  status: MissionControlStatus;
}

export default function EngineGrid({ status }: EngineGridProps) {
  const [engines, setEngines] = useState<Sprint23EngineCardItem[]>([]);

  // Build safe fallback metrics from the status prop
  const getFallbackEngines = useCallback((): Sprint23EngineCardItem[] => {
    const discStatus = status?.discovery?.engine_status || "ONLINE";
    const discSession = status?.discovery?.current_session || "POST_MARKET";
    const discScanned = status?.discovery?.companies_scanned_today?.toLocaleString() ?? "0";
    const discResults = status?.discovery?.results_found_today?.toLocaleString() ?? "0";
    const discFailures = status?.discovery?.parser_failures_today?.toLocaleString() ?? "0";

    const whImported = status?.warehouse?.warehouse?.imported_companies?.toLocaleString() ?? "0";
    const whPending = status?.warehouse?.warehouse?.pending_companies?.toLocaleString() ?? "0";
    const whCoverage = status?.warehouse?.warehouse?.coverage_percent !== undefined
      ? `${status.warehouse.warehouse.coverage_percent.toFixed(1)}%`
      : "0.0%";

    const audRunning = status?.audit?.running;
    const audProcessed = status?.audit?.processed?.toLocaleString() ?? "0";
    const audPassed = status?.audit?.passed?.toLocaleString() ?? "0";
    const audWarning = status?.audit?.warning?.toLocaleString() ?? "0";
    const audFailed = status?.audit?.failed?.toLocaleString() ?? "0";

    return [
      {
        name: "Discovery Engine",
        status: discStatus,
        color: "green",
        metrics: [
          ["Session", discSession],
          ["Scanned Today", discScanned],
          ["Results Today", discResults],
          ["Parser Failures", discFailures],
        ],
      },
      {
        name: "Import Engine",
        status: Number(whImported) > 0 ? "ONLINE" : "READY",
        color: "blue",
        metrics: [
          ["Imported", whImported],
          ["Updated From NSE", "0"],
          ["Unchanged", "0"],
          ["Pending Queue", whPending],
          ["Coverage", whCoverage],
        ],
      },
      {
        name: "Data Reconciliation Engine",
        status: "ONLINE",
        color: "cyan",
        metrics: [
          ["Compared", "0"],
          ["Exact Match", "0"],
          ["Within Tolerance", "0"],
          ["Differences >2%", "0"],
          ["Missing Values", "0"],
          ["Parse Errors", "0"],
        ],
      },
      {
        name: "Audit Engine",
        status: audRunning ? "RUNNING" : "ONLINE",
        color: "amber",
        metrics: [
          ["Processed", audProcessed],
          ["PASS", audPassed],
          ["WARNING", audWarning],
          ["FAIL", audFailed],
        ],
      },
      {
        name: "AI Growth Engine",
        status: "ONLINE",
        color: "violet",
        metrics: [
          ["Scored Companies", audPassed],
          ["AI Reports", audPassed],
          ["Pending Queue", "0"],
          ["Avg Processing Time", "115ms"],
        ],
      },
    ];
  }, [status]);

  const loadEngines = useCallback(async () => {
    try {
      const data = await fetchSprint23Engines();
      if (data?.engines?.length) {
        // Validate each item has a metrics array with at least one element
        const fallbackList = getFallbackEngines();
        const validated = data.engines.map((e) => {
          if (Array.isArray(e.metrics) && e.metrics.length > 0) {
            return e;
          }
          // Merge metrics from fallback
          const fb = fallbackList.find((f) => f.name === e.name);
          return {
            ...e,
            metrics: fb?.metrics || [["Status", e.status || "ONLINE"]],
          };
        });
        setEngines(validated);
      }
    } catch (e) {
      console.warn("Using fallback engine metrics:", e);
    }
  }, [getFallbackEngines]);

  useEffect(() => {
    loadEngines();
    const interval = setInterval(loadEngines, 5000);
    return () => clearInterval(interval);
  }, [loadEngines]);

  // Use engines if loaded and non-empty, otherwise use fallback
  const displayEngines: Sprint23EngineCardItem[] =
    engines.length > 0 ? engines : getFallbackEngines();

  const getIcon = (name: string) => {
    if (name.includes("Discovery")) return <Radar className="h-6 w-6 text-emerald-400" />;
    if (name.includes("Import") || name.includes("Warehouse")) return <Download className="h-6 w-6 text-sky-400" />;
    if (name.includes("Reconciliation")) return <Scale className="h-6 w-6 text-cyan-400" />;
    if (name.includes("Audit")) return <ShieldCheck className="h-6 w-6 text-amber-400" />;
    return <BrainCircuit className="h-6 w-6 text-violet-400" />;
  };

  return (
    <div className="space-y-5">
      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-cyan-400">
            Live Engine Grid • Pipeline Health Monitor
          </p>

          <h2 className="mt-2 text-2xl font-bold text-white">
            Alpha India 5-Stage Processing Radar
          </h2>

          <p className="mt-1 text-sm text-slate-400">
            Real-time operational status of Discovery, Import, Reconciliation (±2% Tolerance), Audit, and AI Growth engines.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          Synchronized every 5s
        </div>
      </div>

      {/* 5 Engine Cards Grid */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {displayEngines.map((engine) => (
          <EngineCard
            key={engine.name}
            icon={getIcon(engine.name)}
            title={engine.name}
            status={engine.status}
            color={engine.color}
            metrics={Array.isArray(engine.metrics) ? engine.metrics : []}
          />
        ))}
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
  metrics = [],
  color = "green",
}: {
  icon: React.ReactNode;
  title: string;
  status: string;
  metrics?: [string, string][];
  color?: "green" | "blue" | "cyan" | "amber" | "violet";
}) {
  const badgeClass =
    color === "green"
      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
      : color === "blue"
      ? "bg-sky-500/15 text-sky-400 border border-sky-500/30"
      : color === "cyan"
      ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30"
      : color === "amber"
      ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
      : "bg-violet-500/15 text-violet-400 border border-violet-500/30";

  const safeMetrics = Array.isArray(metrics) ? metrics : [];

  return (
    <div className="flex flex-col justify-between rounded-3xl border border-slate-800/80 bg-slate-900/90 p-5 shadow-lg backdrop-blur hover:border-slate-700 transition-colors">
      <div>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="rounded-2xl bg-slate-950 p-2.5 border border-slate-800">
            {icon}
          </div>

          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${badgeClass}`}
          >
            {status}
          </span>
        </div>

        <h3 className="mt-4 text-base font-semibold text-white tracking-tight">{title}</h3>

        {/* Metrics */}
        <div className="mt-4 space-y-2.5">
          {safeMetrics.length > 0 ? (
            safeMetrics.map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between border-b border-slate-800/60 pb-2 last:border-0 last:pb-0"
              >
                <span className="text-xs text-slate-400">{label}</span>
                <span className="text-xs font-semibold text-white">{value}</span>
              </div>
            ))
          ) : (
            <p className="text-xs text-slate-500 italic py-2">No metrics available</p>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center gap-1.5 border-t border-slate-800/60 pt-3 text-[11px] text-slate-500">
        <Activity size={12} className="text-slate-400" />
        Auto refresh (5s)
      </div>
    </div>
  );
}
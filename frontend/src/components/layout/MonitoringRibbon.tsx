"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Activity,
  ShieldCheck,
  Database,
  RefreshCcw,
  Play,
  Square,
} from "lucide-react";

import {
  fetchMissionControlTelemetry,
  startAuditEngine,
  stopAuditEngine,
} from "@/lib/monitoringApi";

import { useLiveWireStream } from "@/hooks/useLiveWireStream";

export interface WarehouseData {
  total_companies: number;
  imported_companies: number;
  pending_companies: number;
  failed_companies?: number;
  quarterly_records: number;
  coverage_percent: number;
}

export interface AuditData {
  running: boolean;
  progress_percent: number;
  processed: number;
  passed: number;
  warning: number;
  failed: number;
  last_symbol: string | null;
}

interface MonitoringRibbonProps {
  warehouse?: WarehouseData | null;
  audit?: AuditData | null;
}

export default function MonitoringRibbon({ warehouse: propWarehouse, audit: propAudit }: MonitoringRibbonProps = {}) {
  const { isConnected } = useLiveWireStream();
  const [internalWarehouse, setInternalWarehouse] = useState<WarehouseData | null>(null);
  const [internalAudit, setInternalAudit] = useState<AuditData | null>(null);
  const [loading, setLoading] = useState(false);

  const warehouse = propWarehouse ?? internalWarehouse;
  const audit = propAudit ?? internalAudit;

  const loadStatus = useCallback(async () => {
    if (propWarehouse && propAudit) return;
    try {
      const telemetry = await fetchMissionControlTelemetry();
      if (telemetry.warehouse) {
        setInternalWarehouse(telemetry.warehouse);
      }
      if (telemetry.audit) {
        setInternalAudit(telemetry.audit as unknown as AuditData);
      }
    } catch (error) {
      console.error("Monitoring status failed:", error);
    }
  }, [propWarehouse, propAudit]);

  useEffect(() => {
    if (propWarehouse && propAudit) return;
    loadStatus();

    const timer = setInterval(loadStatus, 5000);

    return () => {
      clearInterval(timer);
    };
  }, [loadStatus, propWarehouse, propAudit]);

  async function handleStartAudit() {
    setLoading(true);

    try {
      await startAuditEngine();
      await loadStatus();
    } catch (error) {
      console.error("Start audit failed:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleStopAudit() {
    setLoading(true);

    try {
      await stopAuditEngine();
      await loadStatus();
    } catch (error) {
      console.error("Stop audit failed:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 text-slate-900 dark:text-white shadow-xs dark:shadow-lg">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
            Alpha India Mission Control
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Live Warehouse + Financial Audit Engine
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold tracking-wider uppercase transition-colors ${
              isConnected
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 text-slate-500"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isConnected ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
              }`}
            />
            <span>{isConnected ? "LIVE STREAM ACTIVE" : "STREAM DISCONNECTED"}</span>
          </div>

          <button
            onClick={loadStatus}
            className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            title="Refresh"
          >
            <RefreshCcw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card
          icon={<Database className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />}
          label="Warehouse Coverage"
          value={
            warehouse
              ? `${warehouse.coverage_percent.toFixed(2)}%`
              : "--"
          }
          sub={`${warehouse?.imported_companies ?? 0} / ${
            warehouse?.total_companies ?? 0
          } companies`}
        />

        <Card
          icon={<Activity className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
          label="Quarterly Records"
          value={warehouse?.quarterly_records ?? "--"}
          sub="Imported financial records"
        />

        <Card
          icon={<ShieldCheck className="h-5 w-5 text-amber-600 dark:text-yellow-400" />}
          label="Audit Progress"
          value={
            audit ? `${audit.progress_percent.toFixed(1)}%` : "--"
          }
          sub={`${audit?.processed ?? 0} processed`}
        />

        <Card
          icon={<ShieldCheck className="h-5 w-5 text-green-600 dark:text-green-400" />}
          label="Audit Engine"
          value={audit?.running ? "RUNNING" : "STOPPED"}
          sub={audit?.last_symbol ?? "Waiting..."}
        />
      </div>

      {/* Progress Bar */}
      <div className="mt-5">
        <div className="mb-2 flex justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>Warehouse Coverage</span>
          <span>{warehouse?.coverage_percent.toFixed(2) ?? 0}%</span>
        </div>

        <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-2 rounded-full bg-emerald-500 transition-all duration-500"
            style={{
              width: `${warehouse?.coverage_percent ?? 0}%`,
            }}
          />
        </div>
      </div>

      {/* Audit Breakdown */}
      <div className="mt-6 grid grid-cols-3 gap-3 text-center">
        <Stat color="text-green-600 dark:text-green-400" label="PASS" value={audit?.passed ?? 0} />

        <Stat
          color="text-amber-600 dark:text-yellow-400"
          label="WARNING"
          value={audit?.warning ?? 0}
        />

        <Stat color="text-rose-600 dark:text-red-400" label="FAIL" value={audit?.failed ?? 0} />
      </div>

      {/* Controls */}
      <div className="mt-6 flex gap-3">
        <button
          disabled={loading}
          onClick={handleStartAudit}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-medium text-white hover:bg-emerald-500 transition disabled:opacity-60"
        >
          <Play className="h-4 w-4" />
          Start Audit
        </button>

        <button
          disabled={loading}
          onClick={handleStopAudit}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-3 font-medium text-white hover:bg-rose-500 transition disabled:opacity-60"
        >
          <Square className="h-4 w-4" />
          Stop Audit
        </button>
      </div>
    </div>
  );
}

/* ---------- Reusable Components ---------- */

function Card({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900 p-3 shadow-2xs">
      <div className="mb-3 flex items-center gap-2 text-slate-500 dark:text-slate-400">
        {icon}
        <span className="text-xs">{label}</span>
      </div>

      <div className="text-xl font-bold text-slate-900 dark:text-white">{value}</div>

      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{sub}</div>
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900 p-4 shadow-2xs">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>

      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{label}</div>
    </div>
  );
}
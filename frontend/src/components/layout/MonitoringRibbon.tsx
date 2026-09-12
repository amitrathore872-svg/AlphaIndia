"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  ShieldCheck,
  Database,
  RefreshCcw,
  Play,
  Square,
} from "lucide-react";

import {
  fetchWarehouseStatus,
  fetchAuditStatus,
  startAuditEngine,
  stopAuditEngine,
} from "@/lib/monitoringApi";

interface WarehouseData {
  total_companies: number;
  imported_companies: number;
  pending_companies: number;
  failed_companies: number;
  quarterly_records: number;
  coverage_percent: number;
}

interface AuditData {
  running: boolean;
  progress_percent: number;
  processed: number;
  passed: number;
  warning: number;
  failed: number;
  last_symbol: string | null;
}

export default function MonitoringRibbon() {
  const [warehouse, setWarehouse] = useState<WarehouseData | null>(null);
  const [audit, setAudit] = useState<AuditData | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadStatus() {
    try {
      const [warehouseStatus, auditStatus] = await Promise.all([
        fetchWarehouseStatus(),
        fetchAuditStatus(),
      ]);

      setWarehouse(warehouseStatus);
      setAudit(auditStatus);
    } catch (error) {
      console.error("Monitoring status failed:", error);
    }
  }

  useEffect(() => {
    loadStatus();

    const timer = setInterval(loadStatus, 5000);

    return () => clearInterval(timer);
  }, []);

  async function handleStartAudit() {
    setLoading(true);

    try {
      await startAuditEngine(25, 1);
      await loadStatus();
    } finally {
      setLoading(false);
    }
  }

  async function handleStopAudit() {
    setLoading(true);

    try {
      await stopAuditEngine();
      await loadStatus();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 text-white shadow-lg">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-emerald-400">
            Alpha India Mission Control
          </h2>
          <p className="text-xs text-slate-400">
            Live Warehouse + Financial Audit Engine
          </p>
        </div>

        <button
          onClick={loadStatus}
          className="rounded-lg bg-slate-800 p-2 hover:bg-slate-700"
        >
          <RefreshCcw className="h-4 w-4" />
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card
          icon={<Database className="h-5 w-5 text-cyan-400" />}
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
          icon={<Activity className="h-5 w-5 text-emerald-400" />}
          label="Quarterly Records"
          value={warehouse?.quarterly_records ?? "--"}
          sub="Imported financial records"
        />

        <Card
          icon={<ShieldCheck className="h-5 w-5 text-yellow-400" />}
          label="Audit Progress"
          value={
            audit ? `${audit.progress_percent.toFixed(1)}%` : "--"
          }
          sub={`${audit?.processed ?? 0} processed`}
        />

        <Card
          icon={<ShieldCheck className="h-5 w-5 text-green-400" />}
          label="Audit Engine"
          value={audit?.running ? "RUNNING" : "STOPPED"}
          sub={audit?.last_symbol ?? "Waiting..."}
        />
      </div>

      {/* Progress Bar */}
      <div className="mt-5">
        <div className="mb-2 flex justify-between text-xs text-slate-400">
          <span>Warehouse Coverage</span>
          <span>{warehouse?.coverage_percent.toFixed(2) ?? 0}%</span>
        </div>

        <div className="h-2 w-full rounded-full bg-slate-800">
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
        <Stat color="text-green-400" label="PASS" value={audit?.passed ?? 0} />

        <Stat
          color="text-yellow-400"
          label="WARNING"
          value={audit?.warning ?? 0}
        />

        <Stat color="text-red-400" label="FAIL" value={audit?.failed ?? 0} />
      </div>

      {/* Controls */}
      <div className="mt-6 flex gap-3">
        <button
          disabled={loading}
          onClick={handleStartAudit}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-medium hover:bg-emerald-500 disabled:opacity-60"
        >
          <Play className="h-4 w-4" />
          Start Audit
        </button>

        <button
          disabled={loading}
          onClick={handleStopAudit}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 font-medium hover:bg-red-500 disabled:opacity-60"
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
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
      <div className="mb-3 flex items-center gap-2 text-slate-400">
        {icon}
        <span className="text-xs">{label}</span>
      </div>

      <div className="text-xl font-bold">{value}</div>

      <div className="mt-1 text-xs text-slate-500">{sub}</div>
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
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>

      <div className="mt-1 text-xs text-slate-400">{label}</div>
    </div>
  );
}
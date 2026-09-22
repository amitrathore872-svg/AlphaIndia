"use client";

// =======================================================
// Alpha India — Health Monitor Header
// Real-time telemetry, engine vitality, and warehouse metrics
// =======================================================

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Clock3,
  Database,
  ShieldCheck,
  Radar,
  Building2,
  ExternalLink,
  Sliders,
} from "lucide-react";

import type { MissionControlStatus } from "@/types/monitoring";

interface MissionHeaderProps {
  status: MissionControlStatus;
}

export default function MissionHeader({ status }: MissionHeaderProps) {
  const [now, setNow] = useState<number>(0);

  // Live countdown timer
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const countdown = useMemo(() => {
    if (!now || !status?.heartbeat?.next_scan) return "--:--";

    const next = new Date(status.heartbeat.next_scan).getTime();
    const diff = Math.max(0, next - now);

    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
      2,
      "0"
    )}`;
  }, [now, status]);

  const sessionColor =
    status.discovery.current_session === "LIVE"
      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
      : status.discovery.current_session === "POST_MARKET"
      ? "bg-orange-500/20 text-orange-400 border-orange-500/30"
      : "bg-sky-500/20 text-sky-400 border-sky-500/30";

  return (
    <div className="space-y-5">
      {/* Top Health Monitor Ribbon */}
      <div className="rounded-3xl border border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-emerald-400">
                Health Monitor
              </span>
              <span className="text-xs text-slate-400">• Institutional Data Telemetry</span>
            </div>

            <h1 className="mt-2 text-3xl font-bold text-white tracking-tight">
              Monitoring Center
            </h1>

            <p className="mt-1 text-sm text-slate-400">
              Real-time exchange filing discovery radar, autonomous ingestion telemetry, and data pipeline health.
            </p>
          </div>

          {/* Action Controls & Navigation */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Link to Control & Logs Page */}
            <Link
              href="/monitoring/control"
              className="flex items-center gap-1.5 rounded-full bg-cyan-600 hover:bg-cyan-500 px-4 py-2 text-xs font-semibold text-white transition-all shadow-md shadow-cyan-900/30"
            >
              <Sliders size={14} />
              <span>Control & Action Logs</span>
              <ExternalLink size={12} className="opacity-70" />
            </Link>

            {/* Server Status Pill */}
            <div className="flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2 text-xs font-semibold text-emerald-400">
              <Activity size={14} className="animate-pulse" />
              <span>{status.heartbeat.status || "HEALTHY"}</span>
            </div>
          </div>
        </div>

        {/* Status Chips */}
        <div className="mt-6 grid gap-3 md:grid-cols-4">
          <InfoChip
            icon={<Radar size={16} />}
            label="Market Session"
            value={status.discovery.current_session}
            badgeClass={sessionColor}
          />

          <InfoChip
            icon={<Clock3 size={16} />}
            label="Last Scan"
            value={formatTime(status.heartbeat.last_scan)}
          />

          <InfoChip
            icon={<Clock3 size={16} />}
            label="Next Scan In"
            value={countdown}
          />

          <InfoChip
            icon={<Activity size={16} />}
            label="Companies Scanned Today"
            value={status.heartbeat.companies_scanned_today.toLocaleString()}
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Warehouse Coverage"
          value={`${status.warehouse.warehouse.coverage_percent.toFixed(2)}%`}
          icon={<Database className="text-emerald-400" size={22} />}
          valueColor="text-emerald-400"
        />

        <MetricCard
          title="Imported Companies"
          value={status.warehouse.warehouse.imported_companies.toLocaleString()}
          icon={<Building2 className="text-sky-400" size={22} />}
          valueColor="text-sky-400"
        />

        <MetricCard
          title="Quarterly Records"
          value={status.warehouse.warehouse.quarterly_records.toLocaleString()}
          icon={<Database className="text-violet-400" size={22} />}
          valueColor="text-violet-400"
        />

        <MetricCard
          title="Audit Progress"
          value={`${status.audit.progress_percent.toFixed(1)}%`}
          icon={<ShieldCheck className="text-amber-400" size={22} />}
          valueColor="text-amber-400"
        />
      </div>
    </div>
  );
}

// -------------------------------------------------------
// Small Components
// -------------------------------------------------------

function MetricCard({
  title,
  value,
  icon,
  valueColor,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  valueColor: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-sm hover:border-slate-700 transition-colors">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wider text-slate-500">
          {title}
        </p>

        {icon}
      </div>

      <p className={`mt-4 text-2xl font-bold ${valueColor}`}>{value}</p>
    </div>
  );
}

function InfoChip({
  icon,
  label,
  value,
  badgeClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  badgeClass?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
      <div className="flex items-center gap-2 text-slate-400">
        {icon}
        <span className="text-xs uppercase tracking-wider">{label}</span>
      </div>

      <div className="mt-3">
        {badgeClass ? (
          <span
            className={`rounded-full border px-3 py-1 text-sm font-semibold ${badgeClass}`}
          >
            {value}
          </span>
        ) : (
          <p className="text-sm font-medium text-white">{value}</p>
        )}
      </div>
    </div>
  );
}

function formatTime(value?: string) {
  if (!value) return "--";

  try {
    return new Date(value).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return value;
  }
}
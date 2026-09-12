"use client";

// =======================================================
// Alpha India Mission Control Header
// Sprint 33.3 Phase 1.3
// =======================================================

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Clock3,
  Database,
  ShieldCheck,
  Radar,
  Building2,
} from "lucide-react";

import type { MissionControlStatus } from "@/types/monitoring";

interface MissionHeaderProps {
  status: MissionControlStatus;
}

export default function MissionHeader({ status }: MissionHeaderProps) {
  const [now, setNow] = useState(Date.now());

  // Live countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const countdown = useMemo(() => {
    if (!status?.heartbeat?.next_scan) return "--:--";

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
      ? "bg-green-500/20 text-green-400"
      : status.discovery.current_session === "POST_MARKET"
      ? "bg-orange-500/20 text-orange-400"
      : "bg-sky-500/20 text-sky-400";

  return (
    <div className="space-y-5">
      {/* Top Ribbon */}
      <div className="rounded-3xl border border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-400">
              Alpha India Mission Control
            </p>

            <h1 className="mt-2 text-3xl font-bold text-white">
              Enterprise Monitoring Center
            </h1>
          </div>

          <div className="flex items-center gap-2 rounded-full bg-emerald-500/10 px-4 py-2 text-emerald-400">
            <Activity size={18} />
            <span className="font-semibold">
              {status.heartbeat.status}
            </span>
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
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
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
            className={`rounded-full px-3 py-1 text-sm font-semibold ${badgeClass}`}
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
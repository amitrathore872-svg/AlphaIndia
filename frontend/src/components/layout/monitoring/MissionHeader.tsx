"use client";

// =======================================================
// Alpha India Mission Control Header
// Sprint 23 — Pipeline Validation & Replay Controls
// =======================================================

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import {
  Activity,
  Clock3,
  Database,
  ShieldCheck,
  Radar,
  Building2,
  Play,
  RotateCcw,
  ExternalLink,
  CheckCircle2,
  Loader2,
} from "lucide-react";

import {
  startReplayPipeline,
  resetReplayPipeline,
  fetchReplayStatus,
} from "@/lib/monitoringApi";
import type { MissionControlStatus, ReplayStatePayload } from "@/types/monitoring";

interface MissionHeaderProps {
  status: MissionControlStatus;
}

export default function MissionHeader({ status }: MissionHeaderProps) {
  const [now, setNow] = useState<number>(0);
  const [replayLoading, setReplayLoading] = useState(false);
  const [replayState, setReplayState] = useState<ReplayStatePayload | null>(null);

  // Poll replay status
  const checkReplay = useCallback(async () => {
    try {
      const res = await fetchReplayStatus();
      if (res?.state) {
        setReplayState(res.state);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    checkReplay();
    const interval = setInterval(checkReplay, 3000);
    return () => clearInterval(interval);
  }, [checkReplay]);

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

  const handleStartReplay = async () => {
    setReplayLoading(true);
    try {
      await startReplayPipeline(5.0);
      await checkReplay();
    } catch (e) {
      alert("Failed to start replay: " + e);
    } finally {
      setReplayLoading(false);
    }
  };

  const handleResetReplay = async () => {
    setReplayLoading(true);
    try {
      await resetReplayPipeline();
      await checkReplay();
    } catch (e) {
      alert("Failed to reset replay: " + e);
    } finally {
      setReplayLoading(false);
    }
  };

  const sessionColor =
    status.discovery.current_session === "LIVE"
      ? "bg-emerald-500/20 text-emerald-400"
      : status.discovery.current_session === "POST_MARKET"
      ? "bg-orange-500/20 text-orange-400"
      : "bg-sky-500/20 text-sky-400";

  return (
    <div className="space-y-5">
      {/* Top Ribbon */}
      <div className="rounded-3xl border border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-400">
              Alpha India Mission Control • Sprint 23
            </p>

            <h1 className="mt-2 text-3xl font-bold text-white tracking-tight">
              Enterprise Monitoring & Replay Center
            </h1>

            <p className="mt-1 text-sm text-slate-400">
              Live telemetry, data reconciliation radar, and automated 10-company pipeline validation.
            </p>
          </div>

          {/* Action Controls & Navigation */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Replay Status Badge */}
            {replayState && (
              <div className="flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/90 px-3.5 py-1.5 text-xs">
                <span
                  className={`h-2 w-2 rounded-full ${
                    replayState.is_running
                      ? "bg-amber-400 animate-ping"
                      : replayState.status === "COMPLETED"
                      ? "bg-emerald-400"
                      : "bg-slate-400"
                  }`}
                />
                <span className="text-slate-300 font-medium">
                  {replayState.is_running
                    ? `Replay: ${replayState.current_company} (${replayState.current_index}/${replayState.total_companies})`
                    : replayState.status === "COMPLETED"
                    ? "Replay Complete (10/10)"
                    : "Replay Ready"}
                </span>
              </div>
            )}

            {/* Start Replay Button */}
            <button
              onClick={handleStartReplay}
              disabled={replayLoading || replayState?.is_running}
              className="flex items-center gap-1.5 rounded-full bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 px-4 py-2 text-xs font-semibold text-white transition-all shadow-md shadow-cyan-900/30"
              title="Replay 10 historical NSE Small-Cap announcements (1 every 5 sec)"
            >
              {replayLoading || replayState?.is_running ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Play size={14} />
              )}
              <span>{replayState?.is_running ? "Replaying..." : "Start Replay"}</span>
            </button>

            {/* Reset Button */}
            <button
              onClick={handleResetReplay}
              disabled={replayLoading || replayState?.is_running}
              className="flex items-center gap-1.5 rounded-full border border-slate-700 hover:border-slate-500 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 px-3.5 py-2 text-xs font-medium text-slate-300 transition-all"
              title="Reset replay queue and reconciliation logs"
            >
              <RotateCcw size={14} />
              <span>Reset</span>
            </button>

            {/* Link to Validation Scorecard Page */}
            <Link
              href="/monitoring/validation"
              className="flex items-center gap-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-semibold text-white transition-all shadow-md shadow-emerald-900/30"
            >
              <CheckCircle2 size={14} />
              <span>Validation Scorecard</span>
              <ExternalLink size={12} className="opacity-70" />
            </Link>

            {/* Server Status Pill */}
            <div className="flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-2 text-xs font-semibold text-emerald-400">
              <Activity size={14} />
              <span>{status.heartbeat.status}</span>
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
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-sm">
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
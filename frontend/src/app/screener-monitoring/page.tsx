"use client";

// =======================================================
// Alpha India Screener.in Real-Time Monitor
// Parallel Architecture - Isolated Telemetry & Engine Health
// High-frequency 5-second telemetry, live activity feed, performance metrics
// =======================================================

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Play,
  Square,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Layers,
  TrendingUp,
  Terminal,
  Zap,
  Gauge,
} from "lucide-react";

import DashboardLayout from "@/components/layout/DashboardLayout";
import {
  fetchScreenerMonitoringStatus,
  fetchScreenerMonitoringStats,
  fetchScreenerLiveActivity,
  fetchScreenerPerformance,
  fetchScreenerErrors,
  fetchScreenerRuns,
  startScreenerImport,
  stopScreenerImport,
} from "@/lib/screenerApi";
import type {
  ScreenerMonitoringStatus,
  ScreenerMonitoringStats,
  ScreenerPerformanceMetrics,
  ScreenerLiveEvent,
  ScreenerImportRunRow,
} from "@/types/screener";

export default function ScreenerMonitoringPage() {
  const [status, setStatus] = useState<ScreenerMonitoringStatus | null>(null);
  const [stats, setStats] = useState<ScreenerMonitoringStats | null>(null);
  const [performance, setPerformance] = useState<ScreenerPerformanceMetrics | null>(null);
  const [events, setEvents] = useState<ScreenerLiveEvent[]>([]);
  const [errors, setErrors] = useState<{ symbol?: string; event_type: string; message: string; timestamp: string }[]>([]);
  const [runs, setRuns] = useState<ScreenerImportRunRow[]>([]);
  const [runStatusFilter, setRunStatusFilter] = useState("ALL");

  // Console controls
  const [autoScroll, setAutoScroll] = useState(true);
  const [batchInput, setBatchInput] = useState(50);
  const [delayInput, setDelayInput] = useState(0.8);
  const [symbolsInput, setSymbolsInput] = useState("");
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const consoleEndRef = useRef<HTMLDivElement>(null);

  // Polling data fetcher
  const pollTelemetry = useCallback(async () => {
    try {
      const [statusRes, statsRes, perfRes, activityRes, errRes, runsRes] = await Promise.all([
        fetchScreenerMonitoringStatus(),
        fetchScreenerMonitoringStats(),
        fetchScreenerPerformance(),
        fetchScreenerLiveActivity(100),
        fetchScreenerErrors(),
        fetchScreenerRuns(1, 10, runStatusFilter),
      ]);

      setStatus(statusRes);
      setStats(statsRes);
      setPerformance(perfRes);
      setEvents(activityRes.events || []);
      setErrors(errRes.errors || []);
      setRuns(runsRes.results || []);
    } catch (err) {
      console.error("Telemetry poll failed:", err);
    }
  }, [runStatusFilter]);

  // 5-second polling interval
  useEffect(() => {
    pollTelemetry();
    const timer = setInterval(pollTelemetry, 5000);
    return () => clearInterval(timer);
  }, [pollTelemetry]);

  // Auto-scroll terminal console
  useEffect(() => {
    if (autoScroll && consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [events, autoScroll]);

  // Actions
  async function handleStart() {
    setActionLoading(true);
    try {
      const symList = symbolsInput.trim()
        ? symbolsInput.split(/[\s,]+/).filter(Boolean)
        : undefined;
      await startScreenerImport(batchInput, delayInput, symList);
      setShowConfigModal(false);
      await pollTelemetry();
    } catch (err) {
      console.error("Start failed:", err);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleStop() {
    setActionLoading(true);
    try {
      await stopScreenerImport();
      await pollTelemetry();
    } catch (err) {
      console.error("Stop failed:", err);
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        {/* Header Ribbon */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-slate-800/80 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-800/60 bg-cyan-950/40 px-2.5 py-0.5 text-xs font-semibold text-cyan-300">
                <Gauge className="h-3 w-3 text-cyan-400" />
                TELEMETRY &amp; RADAR
              </span>
              <span className="text-xs uppercase tracking-wider text-slate-400">
                Phase 2 — Isolated Screener Importer
              </span>
            </div>

            <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
              Screener.in Monitoring Terminal
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Live status, high-frequency telemetry, latency benchmarks, and audit feed for the parallel Screener engine.
            </p>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/screener-growth"
              className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2 text-xs font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
            >
              <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
              View Screener Table
            </Link>

            {status?.importer_status === "RUNNING" ? (
              <button
                disabled={actionLoading}
                onClick={handleStop}
                className="flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-rose-500 disabled:opacity-50"
              >
                <Square className="h-3.5 w-3.5" />
                Stop Worker
              </button>
            ) : (
              <button
                disabled={actionLoading}
                onClick={() => setShowConfigModal(true)}
                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50"
              >
                <Play className="h-3.5 w-3.5" />
                Start Import Sweep
              </button>
            )}

            <button
              onClick={() => pollTelemetry()}
              className="rounded-xl border border-slate-800 bg-slate-900 p-2 text-slate-400 hover:text-white transition"
              title="Refresh Telemetry"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Section 1: System Health Ribbon */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {/* Status Badge */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
            <span className="text-xs text-slate-400 font-medium">Importer Engine</span>
            <div className="mt-2 flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                {status?.importer_status === "RUNNING" ? (
                  <>
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500"></span>
                  </>
                ) : status?.importer_status === "FAILED" ? (
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-500"></span>
                ) : (
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-slate-600"></span>
                )}
              </span>
              <span
                className={`text-xl font-bold tracking-tight ${
                  status?.importer_status === "RUNNING"
                    ? "text-emerald-400"
                    : status?.importer_status === "FAILED"
                    ? "text-rose-400"
                    : "text-slate-300"
                }`}
              >
                {status?.importer_status || "IDLE"}
              </span>
            </div>
            <div className="mt-1 text-xs text-slate-500 truncate">
              {status?.current_symbol
                ? `Syncing ${status.current_symbol}...`
                : "Awaiting next batch trigger"}
            </div>
          </div>

          {/* Running Duration Stopwatch */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Run Duration</span>
              <Clock className="h-3.5 w-3.5 text-cyan-400" />
            </div>
            <div className="mt-2 font-mono text-2xl font-bold text-white">
              {status?.importer_status === "RUNNING"
                ? `${status.current_duration_seconds}s`
                : "--"}
            </div>
            <div className="mt-1 text-xs text-slate-500">Live active execution timer</div>
          </div>

          {/* Scheduler Status & Countdown */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Next Scheduled Run</span>
              <Zap className="h-3.5 w-3.5 text-amber-400" />
            </div>
            <div className="mt-2 font-mono text-2xl font-bold text-amber-400">
              {status?.next_run_countdown || "00:00:00"}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Scheduler: {status?.scheduler_status || "ACTIVE"}
            </div>
          </div>

          {/* Last Successful Import */}
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Last Successful Import</span>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            </div>
            <div className="mt-2 text-sm font-bold text-slate-200 truncate">
              {status?.last_successful_import
                ? new Date(status.last_successful_import).toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })
                : "Ready"}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {status?.last_successful_import
                ? new Date(status.last_successful_import).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                  })
                : "Batch initialized"}
            </div>
          </div>
        </div>

        {/* Section 2: Import Statistics KPI Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
          <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3.5">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider">Total in DB</span>
            <div className="mt-1.5 text-xl font-bold text-white">
              {stats?.total_companies_in_db.toLocaleString("en-IN") ?? 0}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500 truncate">
              {stats?.coverage_percent ? `${stats.coverage_percent}% coverage` : "Screener universe"}
            </div>
          </div>

          <div className="rounded-xl border border-cyan-900/40 bg-cyan-950/20 p-3.5">
            <span className="text-[11px] text-cyan-400 uppercase tracking-wider">Unimported Left</span>
            <div className="mt-1.5 text-xl font-bold text-cyan-300">
              {stats?.unimported_remaining ? stats.unimported_remaining.toLocaleString("en-IN") : "--"}
            </div>
            <div className="mt-0.5 text-[11px] text-cyan-500/80 truncate">
              of {stats?.total_universe_eligible?.toLocaleString("en-IN") ?? 5002} eligible
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3.5">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider">Imported Today</span>
            <div className="mt-1.5 text-xl font-bold text-cyan-400">
              {stats?.imported_today ?? 0}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">Processed today</div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3.5">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider">New Added</span>
            <div className="mt-1.5 text-xl font-bold text-emerald-400">
              {stats?.new_added_today ?? 0}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">Fresh records</div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3.5">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider">Updated</span>
            <div className="mt-1.5 text-xl font-bold text-indigo-400">
              {stats?.existing_updated_today ?? 0}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">Refreshed data</div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3.5">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider">Failed</span>
            <div className="mt-1.5 text-xl font-bold text-rose-400">
              {stats?.failed_today ?? 0}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">Network / 404s</div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/90 p-3.5">
            <span className="text-[11px] text-slate-400 uppercase tracking-wider">Success Rate</span>
            <div className="mt-1.5 text-xl font-bold text-emerald-400">
              {stats?.success_rate_percent ?? 100}%
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">Batch accuracy</div>
          </div>
        </div>

        {/* Section 3: Performance & Latency Telemetry */}
        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white">Performance Telemetry (Live Benchmarks)</h3>
            </div>
            <span className="text-xs text-slate-500">Measured across recent 100 requests</span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="rounded-xl border border-slate-800/80 bg-slate-900/70 p-3 text-center">
              <span className="text-[11px] text-slate-400">Screener HTTP Latency</span>
              <div className="mt-1 font-mono text-lg font-bold text-cyan-300">
                {performance?.avg_response_time_ms ? `${performance.avg_response_time_ms} ms` : "--"}
              </div>
            </div>

            <div className="rounded-xl border border-slate-800/80 bg-slate-900/70 p-3 text-center">
              <span className="text-[11px] text-slate-400">HTML Parse Time</span>
              <div className="mt-1 font-mono text-lg font-bold text-emerald-300">
                {performance?.avg_parse_time_ms ? `${performance.avg_parse_time_ms} ms` : "--"}
              </div>
            </div>

            <div className="rounded-xl border border-slate-800/80 bg-slate-900/70 p-3 text-center">
              <span className="text-[11px] text-slate-400">DB Write Latency</span>
              <div className="mt-1 font-mono text-lg font-bold text-indigo-300">
                {performance?.avg_write_time_ms ? `${performance.avg_write_time_ms} ms` : "--"}
              </div>
            </div>

            <div className="rounded-xl border border-slate-800/80 bg-slate-900/70 p-3 text-center">
              <span className="text-[11px] text-slate-400">Total Round-Trip</span>
              <div className="mt-1 font-mono text-lg font-bold text-white">
                {performance?.avg_total_execution_ms ? `${performance.avg_total_execution_ms} ms` : "--"}
              </div>
            </div>

            <div className="rounded-xl border border-slate-800/80 bg-slate-900/70 p-3 text-center">
              <span className="text-[11px] text-slate-400">Throughput</span>
              <div className="mt-1 font-mono text-lg font-bold text-amber-400">
                {performance?.records_per_second ? `${performance.records_per_second} rec/s` : "--"}
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Live Activity Feed (Log Console) */}
        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">Live Import Activity Console</h3>
              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-400">
                {events.length} events
              </span>
            </div>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-0"
                />
                Auto-scroll
              </label>
            </div>
          </div>

          {/* Terminal Box */}
          <div className="mt-3 h-64 overflow-y-auto rounded-xl border border-slate-900 bg-black/90 p-3 font-mono text-xs text-slate-300">
            {events.length === 0 ? (
              <div className="flex h-full items-center justify-center text-slate-600">
                No active events logged yet. Start an import sweep to view live streaming logs.
              </div>
            ) : (
              <div className="space-y-1.5">
                {events.map((ev, i) => (
                  <div key={i} className="flex items-start gap-2 leading-relaxed">
                    <span className="text-slate-600 shrink-0">[{ev.timestamp}]</span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-bold shrink-0 ${
                        ev.level === "ERROR"
                          ? "bg-rose-950 text-rose-400 border border-rose-800/60"
                          : ev.level === "SUCCESS"
                          ? "bg-emerald-950 text-emerald-400 border border-emerald-800/60"
                          : ev.event_type === "FETCHING"
                          ? "bg-cyan-950 text-cyan-400 border border-cyan-800/60"
                          : ev.event_type === "PARSED"
                          ? "bg-indigo-950 text-indigo-400 border border-indigo-800/60"
                          : "bg-slate-900 text-slate-400"
                      }`}
                    >
                      {ev.event_type}
                    </span>
                    {ev.symbol && (
                      <span className="text-amber-300 font-bold shrink-0">{ev.symbol}</span>
                    )}
                    <span className="text-slate-300 break-all">{ev.message}</span>
                  </div>
                ))}
                <div ref={consoleEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* Section 5: Error Monitoring Panel */}
        {errors.length > 0 && (
          <div className="rounded-2xl border border-rose-900/50 bg-rose-950/20 p-4">
            <div className="flex items-center gap-2 text-rose-400">
              <AlertTriangle className="h-4 w-4" />
              <h3 className="text-sm font-bold">Recent Import Error Trace ({errors.length})</h3>
            </div>
            <div className="mt-3 space-y-2 max-h-40 overflow-y-auto">
              {errors.map((err, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-rose-900/60 bg-slate-950/80 p-2.5 text-xs text-rose-300 flex items-start justify-between"
                >
                  <div>
                    <span className="font-bold text-white">{err.symbol || "SYSTEM"}: </span>
                    <span>{err.message}</span>
                  </div>
                  <span className="text-[10px] text-slate-500 shrink-0 ml-2">
                    {new Date(err.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section 6: Historical Import Runs Table */}
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/90 px-4 py-3">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white">Historical Import Jobs</h3>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Filter Status:</span>
              <select
                value={runStatusFilter}
                onChange={(e) => setRunStatusFilter(e.target.value)}
                className="rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-xs text-slate-200"
              >
                <option value="ALL">All Runs</option>
                <option value="SUCCESS">Success</option>
                <option value="PARTIAL">Partial</option>
                <option value="FAILED">Failed</option>
                <option value="RUNNING">Running</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 bg-slate-900/60 text-slate-400 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-4 py-3">Run ID</th>
                  <th className="px-3 py-3">Start Time</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Target</th>
                  <th className="px-3 py-3">Imported</th>
                  <th className="px-3 py-3">Updated</th>
                  <th className="px-3 py-3">Failed</th>
                  <th className="px-3 py-3">Duration</th>
                  <th className="px-3 py-3">Accuracy</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800/80 font-mono">
                {runs.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-6 text-center text-slate-500">
                      No historical import runs recorded yet.
                    </td>
                  </tr>
                ) : (
                  runs.map((r) => (
                    <tr key={r.run_id} className="hover:bg-slate-900/60 transition">
                      <td className="px-4 py-3 font-sans font-bold text-white">
                        {r.run_id}
                      </td>
                      <td className="px-3 py-3 text-slate-400 font-sans">
                        {r.start_time
                          ? new Date(r.start_time).toLocaleString("en-IN", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "--"}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                            r.status === "SUCCESS"
                              ? "bg-emerald-950 text-emerald-400 border border-emerald-800/60"
                              : r.status === "PARTIAL"
                              ? "bg-amber-950 text-amber-400 border border-amber-800/60"
                              : r.status === "RUNNING"
                              ? "bg-cyan-950 text-cyan-400 border border-cyan-800/60"
                              : "bg-rose-950 text-rose-400 border border-rose-800/60"
                          }`}
                        >
                          {r.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-300">{r.total_target}</td>
                      <td className="px-3 py-3 text-emerald-400">{r.imported_count}</td>
                      <td className="px-3 py-3 text-indigo-400">{r.updated_count}</td>
                      <td className="px-3 py-3 text-rose-400">{r.failed_count}</td>
                      <td className="px-3 py-3 text-slate-300">{r.duration_seconds}s</td>
                      <td className="px-3 py-3 font-semibold text-emerald-400">
                        {r.success_rate_percent}%
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal: Configure & Start Import Job */}
        {showConfigModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 p-6 space-y-4 shadow-2xl">
              <h3 className="text-lg font-bold text-white">Trigger Screener.in Import</h3>
              <p className="text-xs text-slate-400">
                Runs an isolated fundamental data sweep against Screener.in, saving directly to the parallel database.
              </p>

              <div className="space-y-3 text-xs">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-300 font-medium">
                      Batch Size (Number of companies)
                    </label>
                    {stats?.unimported_remaining ? (
                      <button
                        type="button"
                        onClick={() => setBatchInput(stats.unimported_remaining || 50)}
                        className="text-[11px] text-cyan-400 hover:text-cyan-300 underline font-sans"
                      >
                        All Remaining ({stats.unimported_remaining.toLocaleString("en-IN")})
                      </button>
                    ) : null}
                  </div>
                  <input
                    type="number"
                    min={1}
                    max={6000}
                    value={batchInput}
                    onChange={(e) => setBatchInput(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-white"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    Prioritizes unimported active equities by market cap, then cycles stalest.
                  </p>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Polite Throttling Delay (seconds per company)
                  </label>
                  <input
                    type="number"
                    step={0.1}
                    min={0.4}
                    max={5.0}
                    value={delayInput}
                    onChange={(e) => setDelayInput(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-white"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    Recommended: 0.8s to avoid Screener.in rate limits.
                  </p>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">
                    Specific Symbols (Optional, comma-separated)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. TCS, INFY, HDFCBANK, ITC, TITAN"
                    value={symbolsInput}
                    onChange={(e) => setSymbolsInput(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-white"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    Leave blank to automatically import top market cap equities.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  onClick={() => setShowConfigModal(false)}
                  className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  disabled={actionLoading}
                  onClick={handleStart}
                  className="flex items-center gap-1.5 rounded-xl bg-cyan-600 px-4 py-2 text-xs font-bold text-white hover:bg-cyan-500 disabled:opacity-50"
                >
                  <Play className="h-3.5 w-3.5" />
                  Launch Batch
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

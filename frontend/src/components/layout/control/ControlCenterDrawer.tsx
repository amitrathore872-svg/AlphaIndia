"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  X,
  RefreshCw,
  Zap,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock3,
  Server,
  Terminal,
  Play,
  Pause,
  ArrowUpRight,
  Archive,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import {
  fetchControlSystemStatus,
  fetchControlSystemLogs,
  triggerService,
  toggleService,
  triggerAllServices,
  type ControlSystemServiceItem,
  type ActionLogItem,
  type ControlSystemStatusResponse,
} from "@/lib/controlSystemApi";

interface ControlCenterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatRelativeTime(isoStr: string | null): string {
  if (!isoStr) return "Never";
  try {
    const diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
    if (diff < 5) return "Just now";
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  } catch {
    return "Unknown";
  }
}

function formatInterval(seconds: number): string {
  if (seconds < 60) return `Every ${seconds}s`;
  if (seconds < 3600) return `Every ${Math.floor(seconds / 60)}m`;
  return `Every ${Math.floor(seconds / 3600)}h`;
}

export default function ControlCenterDrawer({ isOpen, onClose }: ControlCenterDrawerProps) {
  const [data, setData] = useState<ControlSystemStatusResponse | null>(null);
  const [logs, setLogs] = useState<ActionLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggeringId, setTriggeringId] = useState<string | null>(null);
  const [triggeringAll, setTriggeringAll] = useState(false);

  // Filters for logs
  const [selectedServiceFilter, setSelectedServiceFilter] = useState<string>("ALL");
  const [selectedLevelFilter, setSelectedLevelFilter] = useState<string>("ALL");
  const [logSearchQuery, setLogSearchQuery] = useState<string>("");

  // Load Status & Logs
  const loadStatusAndLogs = useCallback(async () => {
    try {
      const [statusRes, logsRes] = await Promise.all([
        fetchControlSystemStatus(),
        fetchControlSystemLogs(selectedServiceFilter, selectedLevelFilter, 80),
      ]);
      setData(statusRes);
      setLogs(logsRes);
    } catch (err) {
      console.error("ControlCenter fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedServiceFilter, selectedLevelFilter]);

  // Polling every 4 seconds when open
  useEffect(() => {
    if (!isOpen) return;
    loadStatusAndLogs();

    const timer = setInterval(() => {
      loadStatusAndLogs();
    }, 4000);

    return () => clearInterval(timer);
  }, [isOpen, loadStatusAndLogs]);

  // Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Action handlers
  const handleTriggerSingle = async (serviceId: string) => {
    setTriggeringId(serviceId);
    try {
      await triggerService(serviceId);
      setTimeout(() => {
        loadStatusAndLogs();
        setTriggeringId(null);
      }, 1000);
    } catch (err) {
      console.error("Trigger error:", err);
      setTriggeringId(null);
    }
  };

  const handleToggle = async (serviceId: string) => {
    try {
      await toggleService(serviceId);
      loadStatusAndLogs();
    } catch (err) {
      console.error("Toggle error:", err);
    }
  };

  const handleTriggerAll = async () => {
    setTriggeringAll(true);
    try {
      await triggerAllServices();
      setTimeout(() => {
        loadStatusAndLogs();
        setTriggeringAll(false);
      }, 1500);
    } catch (err) {
      console.error("Trigger all error:", err);
      setTriggeringAll(false);
    }
  };

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (logSearchQuery) {
        const q = logSearchQuery.toLowerCase();
        const matches =
          log.message.toLowerCase().includes(q) ||
          log.service_name.toLowerCase().includes(q) ||
          log.action.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [logs, logSearchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Dark backdrop blur */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 flex max-w-full pl-6 sm:pl-10">
        <div className="w-screen max-w-4xl bg-white dark:bg-[#050B14] border-l border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 shadow-2xl flex flex-col">
          {/* ====================================================
              DRAWER HEADER
          ==================================================== */}
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80 px-6 py-4 bg-slate-50 dark:bg-slate-900/60 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-500/40 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                <Server size={18} className="animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight font-mono">
                    UNIVERSAL CONTROL SYSTEM & LOGS
                  </h2>
                  <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 font-mono">
                    LIVE
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Continuous multi-engine data scraping, intervals & real-time operational logs.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleTriggerAll}
                disabled={triggeringAll}
                className="flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-bold font-mono text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/20 transition disabled:opacity-50"
                title="Trigger immediate fetch across all services"
              >
                <RefreshCw size={13} className={triggeringAll ? "animate-spin" : ""} />
                <span>{triggeringAll ? "Triggering All..." : "Fetch All Now"}</span>
              </button>

              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition"
                aria-label="Close Control Center"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* ====================================================
              TOP TELEMETRY RIBBON
          ==================================================== */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50 dark:bg-[#081225] border-b border-slate-200 dark:border-slate-800/60 text-xs font-mono">
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-2.5 shadow-xs">
              <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">Active Engines</p>
              <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                {data?.active_services || 0} / {data?.total_services || 6} RUNNING
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-2.5 shadow-xs">
              <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">Latest Global Fetch</p>
              <p className="text-base font-bold text-cyan-600 dark:text-cyan-400 mt-0.5">
                {formatRelativeTime(data?.latest_fetch_time || null)}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-2.5 shadow-xs">
              <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">Ingested Records Today</p>
              <p className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                {data?.total_records_ingested_today?.toLocaleString() || 0}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-2.5 shadow-xs">
              <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase">Auto Poller SLA</p>
              <p className="text-base font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                60s Interval
              </p>
            </div>
          </div>

          {/* ====================================================
              SCROLLABLE BODY
          ==================================================== */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {/* 1. DATA FETCHING SERVICES STATUS GRID */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-bold text-slate-800 dark:text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <Activity size={14} className="text-cyan-600 dark:text-cyan-400" />
                  Continuous Ingestion Engines & Intervals
                </h3>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  Auto-ticks every 4 seconds
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {data?.services?.map((srv) => {
                  const isRunning = srv.status === "RUNNING";
                  const isPaused = srv.status === "PAUSED";
                  const isTriggering = triggeringId === srv.id;

                  return (
                    <div
                      key={srv.id}
                      className={`rounded-xl border p-4 transition-all duration-200 ${
                        isPaused
                          ? "border-amber-300 dark:border-amber-500/20 bg-amber-50/50 dark:bg-amber-950/5 opacity-80"
                          : isRunning
                          ? "border-slate-200 dark:border-slate-800/90 bg-white dark:bg-slate-900/70 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs"
                          : "border-red-300 dark:border-red-500/20 bg-red-50/50 dark:bg-red-950/10"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 dark:text-white font-mono">
                              {srv.name}
                            </span>
                            <span className="rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 text-[9px] font-mono text-slate-600 dark:text-slate-400 uppercase">
                              {srv.category}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                            {srv.description}
                          </p>
                        </div>

                        {/* Status Badge */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold font-mono uppercase ${
                              isPaused
                                ? "bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400"
                                : isRunning
                                ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                                : "bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                isPaused
                                  ? "bg-amber-500"
                                  : isRunning
                                  ? "bg-emerald-500 animate-pulse"
                                  : "bg-red-500"
                              }`}
                            />
                            {srv.status}
                          </span>
                        </div>
                      </div>

                      {/* Schedule & Last Fetch Metrics */}
                      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-200 dark:border-slate-800/60 pt-2.5 text-[11px] font-mono">
                        <div>
                          <span className="text-slate-500 dark:text-slate-400">Last Fetch: </span>
                          <span className="text-cyan-700 dark:text-cyan-300 font-semibold">
                            {formatRelativeTime(srv.last_fetch_time)}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-slate-500 dark:text-slate-400">Interval: </span>
                          <span className="text-slate-700 dark:text-slate-300">
                            {formatInterval(srv.poll_interval_seconds)}
                          </span>
                        </div>
                      </div>

                      {/* Action Bar */}
                      <div className="mt-3 flex items-center justify-between border-t border-slate-200 dark:border-slate-800/40 pt-2.5">
                        <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                          {srv.records_ingested_today} records today
                        </span>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggle(srv.id)}
                            className="rounded px-2 py-1 text-[10px] font-mono font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                            title={isPaused ? "Resume background polling" : "Pause polling"}
                          >
                            {isPaused ? <Play size={11} className="inline mr-1 text-emerald-600 dark:text-emerald-400" /> : <Pause size={11} className="inline mr-1 text-amber-600 dark:text-amber-400" />}
                            {isPaused ? "Resume" : "Pause"}
                          </button>

                          <button
                            onClick={() => handleTriggerSingle(srv.id)}
                            disabled={isTriggering}
                            className="flex items-center gap-1 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-bold font-mono text-cyan-700 dark:text-cyan-400 hover:bg-cyan-500/20 transition disabled:opacity-50"
                          >
                            <RefreshCw size={10} className={isTriggering ? "animate-spin" : ""} />
                            <span>{isTriggering ? "Fetching..." : "Fetch Now"}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. REAL-TIME ACTION LOGS TERMINAL */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800/80 pb-2">
                <div className="flex items-center gap-2">
                  <Terminal size={15} className="text-emerald-600 dark:text-emerald-400" />
                  <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider font-mono">
                    Live Operational Action Logs ({filteredLogs.length})
                  </h3>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Search filter */}
                  <div className="relative">
                    <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                    <input
                      value={logSearchQuery}
                      onChange={(e) => setLogSearchQuery(e.target.value)}
                      placeholder="Filter log messages..."
                      className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 pl-7 pr-2 py-1 text-[11px] font-mono text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-cyan-500/60 focus:outline-none w-44"
                    />
                  </div>

                  {/* Level Filter Pills */}
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900/80 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800 text-[10px] font-mono">
                    {["ALL", "SUCCESS", "INFO", "WARN", "ERROR"].map((lvl) => (
                      <button
                        key={lvl}
                        onClick={() => setSelectedLevelFilter(lvl)}
                        className={`px-2 py-0.5 rounded font-semibold transition ${
                          selectedLevelFilter === lvl
                            ? "bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/40 font-bold"
                            : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Terminal Log Console */}
              <div className="rounded-xl border border-slate-800/90 bg-[#030712] p-3 font-mono text-xs max-h-80 overflow-y-auto space-y-1.5">
                {filteredLogs.length === 0 ? (
                  <div className="py-8 text-center text-slate-500 text-xs">
                    No action logs matching selected filters. Background workers are monitoring for incoming events.
                  </div>
                ) : (
                  filteredLogs.map((log) => {
                    const isSuccess = log.level === "SUCCESS";
                    const isError = log.level === "ERROR";
                    const isWarn = log.level === "WARN";

                    const timeStr = new Date(log.timestamp).toLocaleTimeString("en-IN", {
                      hour12: false,
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    });

                    return (
                      <div
                        key={log.id}
                        className="flex items-start gap-2.5 py-1 px-1.5 rounded hover:bg-slate-900/40 transition border-b border-slate-900/60 last:border-0"
                      >
                        <span className="text-slate-500 text-[11px] shrink-0 font-mono">
                          [{timeStr}]
                        </span>

                        <span
                          className={`rounded px-1.5 py-0 text-[9px] font-bold shrink-0 uppercase ${
                            isError
                              ? "bg-red-500/20 text-red-400"
                              : isWarn
                              ? "bg-amber-500/20 text-amber-400"
                              : isSuccess
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-cyan-500/20 text-cyan-400"
                          }`}
                        >
                          {log.level}
                        </span>

                        <span className="text-slate-400 text-[11px] shrink-0 font-semibold">
                          [{log.service_name}]
                        </span>

                        <span className="text-slate-200 text-[11px] flex-1 break-words">
                          {log.message}
                        </span>

                        {log.duration_ms > 0 && (
                          <span className="text-slate-500 text-[10px] shrink-0">
                            {log.duration_ms}ms
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* ====================================================
              DRAWER FOOTER
          ==================================================== */}
          <div className="border-t border-slate-200 dark:border-slate-800/80 px-6 py-3 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between text-xs font-mono">
            <span className="text-slate-600 dark:text-slate-400">
              Alpha India Control Engine · Active Polling Loop
            </span>

            <button
              onClick={loadStatusAndLogs}
              className="flex items-center gap-1.5 text-cyan-700 dark:text-cyan-400 hover:text-cyan-600 dark:hover:text-cyan-300 transition font-semibold"
            >
              <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
              <span>Refresh Now</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

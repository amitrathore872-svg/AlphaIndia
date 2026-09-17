"use client";

// =======================================================
// Alpha India Monitoring Center — Control & Action Logs Dashboard
// Enterprise System Telemetry, Ingestion Control & Real-time Action Logs
// =======================================================

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import {
  Sliders,
  Terminal,
  Activity,
  RefreshCw,
  Play,
  Pause,
  AlertCircle,
  CheckCircle2,
  Clock,
  Search,
  Zap,
  Database,
  Radio,
  Download,
  Filter,
  ArrowLeft,
  ChevronRight,
  ShieldAlert,
  Loader2,
  HardDrive,
  Cpu,
  Layers,
} from "lucide-react";

import DashboardLayout from "@/components/layout/DashboardLayout";
import {
  fetchControlSystemStatus,
  fetchControlSystemLogs,
  triggerService,
  toggleService,
  triggerAllServices,
  type ControlSystemStatusResponse,
  type ControlSystemServiceItem,
  type ActionLogItem,
} from "@/lib/controlSystemApi";

function formatRelativeTime(isoString: string | null): string {
  if (!isoString) return "Never";
  try {
    const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
    if (diff < 5) return "Just now";
    if (diff < 60) return `${diff}s ago`;
    const mins = Math.floor(diff / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ago`;
  } catch {
    return isoString;
  }
}

export default function ControlAndLogsPage() {
  const [statusData, setStatusData] = useState<ControlSystemStatusResponse | null>(null);
  const [logs, setLogs] = useState<ActionLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [activeServiceFilter, setActiveServiceFilter] = useState("ALL");
  const [activeLevelFilter, setActiveLevelFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [logLimit, setLogLimit] = useState(100);
  const [triggeringId, setTriggeringId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [triggeringAll, setTriggeringAll] = useState(false);
  const [tick, setTick] = useState(0);

  // Auto-tick every 1s for relative time display
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent) setRefreshing(true);
    try {
      const [statusRes, logsRes] = await Promise.all([
        fetchControlSystemStatus(),
        fetchControlSystemLogs(activeServiceFilter, activeLevelFilter, logLimit),
      ]);
      setStatusData(statusRes);
      setLogs(logsRes);
    } catch (e) {
      console.error("Failed to load control system data:", e);
    } finally {
      setLoading(false);
      if (!isSilent) setRefreshing(false);
    }
  }, [activeServiceFilter, activeLevelFilter, logLimit]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Polling every 4 seconds when autoRefresh is enabled
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadData(true);
    }, 4000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadData]);

  const handleTriggerService = async (serviceId: string) => {
    setTriggeringId(serviceId);
    try {
      await triggerService(serviceId);
      await loadData(true);
    } catch (e) {
      console.error(e);
    } finally {
      setTriggeringId(null);
    }
  };

  const handleToggleService = async (serviceId: string) => {
    setTogglingId(serviceId);
    try {
      await toggleService(serviceId);
      await loadData(true);
    } catch (e) {
      console.error(e);
    } finally {
      setTogglingId(null);
    }
  };

  const handleTriggerAll = async () => {
    setTriggeringAll(true);
    try {
      await triggerAllServices();
      await loadData(true);
    } catch (e) {
      console.error(e);
    } finally {
      setTriggeringAll(false);
    }
  };

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesSearch =
        !searchQuery ||
        log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.service_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.action.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });
  }, [logs, searchQuery]);

  const exportLogs = () => {
    const jsonStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(filteredLogs, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", jsonStr);
    downloadAnchor.setAttribute("download", `alpha_india_action_logs_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-[#050B14] p-6 space-y-6 text-slate-100">
        {/* Breadcrumbs & Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
              <Link href="/monitoring" className="hover:text-cyan-400 transition-colors">
                Monitoring Center
              </Link>
              <ChevronRight size={12} />
              <span className="text-cyan-400 font-medium">Control & Action Logs</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                <Sliders size={20} />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                  Universal Control & Operational Logs
                  <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    LIVE TELEMETRY
                  </span>
                </h1>
                <p className="text-xs text-slate-400">
                  Continuous multi-engine pipeline controller, last-fetch tracking, and institutional action logs terminal.
                </p>
              </div>
            </div>
          </div>

          {/* Action Bar */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                autoRefresh
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                  : "bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200"
              }`}
            >
              <Activity size={13} className={autoRefresh ? "animate-pulse" : ""} />
              <span>{autoRefresh ? "Auto-refresh: 4s" : "Auto-refresh: OFF"}</span>
            </button>

            <button
              onClick={() => loadData()}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={13} className={refreshing ? "animate-spin text-cyan-400" : ""} />
              <span>Refresh</span>
            </button>

            <button
              onClick={handleTriggerAll}
              disabled={triggeringAll}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-900/30 transition-all disabled:opacity-50"
            >
              {triggeringAll ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Zap size={13} />
              )}
              <span>{triggeringAll ? "Syncing All..." : "Fetch All Engines"}</span>
            </button>

            <Link
              href="/monitoring"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800/60 border border-slate-700/80 text-slate-300 hover:text-white transition-colors"
            >
              <ArrowLeft size={13} />
              <span>Back to Mission Control</span>
            </Link>
          </div>
        </div>

        {/* Top KPIs Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Active Engines</p>
              <p className="text-xl font-bold text-white mt-0.5">
                {statusData ? `${statusData.active_services} / ${statusData.total_services}` : "--"}
              </p>
              <span className="text-[10px] text-emerald-400 flex items-center gap-1 mt-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                100% Operational
              </span>
            </div>
            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Cpu size={18} />
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Ingested Today</p>
              <p className="text-xl font-bold text-white mt-0.5">
                {statusData ? statusData.total_records_ingested_today.toLocaleString() : "--"}
              </p>
              <span className="text-[10px] text-cyan-400 flex items-center gap-1 mt-1">
                <Radio size={10} />
                Live filings & statements
              </span>
            </div>
            <div className="h-9 w-9 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Database size={18} />
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Latest Sync</p>
              <p className="text-xl font-bold text-white mt-0.5">
                {formatRelativeTime(statusData?.latest_fetch_time ?? null)}
              </p>
              <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-1">
                <Clock size={10} />
                Interval: 60s - 900s
              </span>
            </div>
            <div className="h-9 w-9 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <Clock size={18} />
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Action Logs Ring</p>
              <p className="text-xl font-bold text-white mt-0.5">
                {logs.length} <span className="text-xs font-normal text-slate-400">/ 250</span>
              </p>
              <span className="text-[10px] text-purple-400 flex items-center gap-1 mt-1">
                <HardDrive size={10} />
                In-memory FIFO buffer
              </span>
            </div>
            <div className="h-9 w-9 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
              <Terminal size={18} />
            </div>
          </div>
        </div>

        {/* Section 1: Ingestion & Processing Engines Grid */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white tracking-wide uppercase flex items-center gap-2">
              <Layers size={15} className="text-cyan-400" />
              Ingestion & Autonomous Processing Engines
            </h2>
            <span className="text-xs text-slate-400">Click &quot;Fetch Now&quot; to trigger on-demand asynchronous execution</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {statusData?.services.map((svc) => {
              const isTriggering = triggeringId === svc.id;
              const isToggling = togglingId === svc.id;
              const isPaused = svc.status === "PAUSED";
              const isError = svc.status === "ERROR";

              return (
                <div
                  key={svc.id}
                  className={`bg-slate-900/80 border rounded-xl p-4 transition-all duration-200 flex flex-col justify-between ${
                    isError
                      ? "border-red-500/40 bg-red-950/10"
                      : isPaused
                      ? "border-slate-800 opacity-75"
                      : "border-slate-800/90 hover:border-slate-700"
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold border border-slate-700">
                            {svc.category}
                          </span>
                          <h3 className="text-sm font-bold text-white">{svc.name}</h3>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{svc.description}</p>
                      </div>

                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 shrink-0 ${
                          isPaused
                            ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                            : isError
                            ? "bg-red-500/10 border-red-500/30 text-red-400"
                            : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            isPaused ? "bg-amber-400" : isError ? "bg-red-400" : "bg-emerald-400 animate-pulse"
                          }`}
                        />
                        {svc.status}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs bg-slate-950/50 rounded-lg p-2.5 border border-slate-800/60">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Last Fetch</span>
                        <span className="font-semibold text-slate-200">
                          {formatRelativeTime(svc.last_fetch_time)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Interval</span>
                        <span className="font-semibold text-cyan-400">
                          Every {svc.poll_interval_seconds}s
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Ingested Today</span>
                        <span className="font-semibold text-white">
                          {svc.records_ingested_today.toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Total Cycles</span>
                        <span className="font-semibold text-slate-300">
                          {svc.total_fetches.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {svc.last_error && (
                      <div className="mt-2 text-[11px] text-red-400 bg-red-950/30 border border-red-800/40 rounded p-1.5 flex items-center gap-1.5">
                        <AlertCircle size={12} className="shrink-0" />
                        <span className="truncate">{svc.last_error}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    <button
                      onClick={() => handleToggleService(svc.id)}
                      disabled={isToggling}
                      className="flex items-center gap-1 text-[11px] font-medium text-slate-400 hover:text-slate-200 px-2 py-1 rounded hover:bg-slate-800 transition-colors disabled:opacity-50"
                    >
                      {isToggling ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : isPaused ? (
                        <Play size={12} className="text-emerald-400" />
                      ) : (
                        <Pause size={12} className="text-amber-400" />
                      )}
                      <span>{isPaused ? "Resume" : "Pause"}</span>
                    </button>

                    <button
                      onClick={() => handleTriggerService(svc.id)}
                      disabled={isTriggering || isPaused}
                      className="flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded bg-slate-800 hover:bg-cyan-600 hover:text-white text-cyan-300 border border-cyan-500/20 transition-all disabled:opacity-50"
                    >
                      {isTriggering ? (
                        <Loader2 size={12} className="animate-spin text-cyan-400" />
                      ) : (
                        <Zap size={12} />
                      )}
                      <span>{isTriggering ? "Fetching..." : "Fetch Now"}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 2: Operational Action Logs Terminal */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
            <div className="flex items-center gap-2">
              <Terminal size={18} className="text-cyan-400" />
              <div>
                <h2 className="text-base font-bold text-white tracking-tight">Real-Time Operational Action Logs</h2>
                <p className="text-xs text-slate-400">
                  Instant telemetry stream of background tasks, records parsed, batch runtimes, and errors.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={exportLogs}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-colors"
                title="Export logs as JSON"
              >
                <Download size={13} />
                <span>Export JSON</span>
              </button>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[220px] max-w-md">
              <Search size={13} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search logs by message, service, or action..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 text-xs"
              />
            </div>

            {/* Service Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1">
              {["ALL", "exchange_live_wire", "results_discovery", "athena_omega_watcher", "screener_financial_importer", "early_stage_discovery", "raw_file_archiver"].map((sid) => {
                const label = sid === "ALL" ? "All Services" : sid.replace(/_/g, " ");
                return (
                  <button
                    key={sid}
                    onClick={() => setActiveServiceFilter(sid)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium capitalize border transition-colors ${
                      activeServiceFilter === sid
                        ? "bg-cyan-600/20 border-cyan-500/50 text-cyan-300 font-semibold"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Level Filter Tabs */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              {["ALL", "SUCCESS", "INFO", "WARN", "ERROR"].map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setActiveLevelFilter(lvl)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider transition-colors ${
                    activeLevelFilter === lvl
                      ? lvl === "SUCCESS"
                        ? "bg-emerald-500 text-slate-950"
                        : lvl === "ERROR"
                        ? "bg-red-500 text-white"
                        : lvl === "WARN"
                        ? "bg-amber-500 text-slate-950"
                        : "bg-cyan-600 text-white"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          {/* Log Stream Terminal Window */}
          <div className="bg-[#030712] border border-slate-800/90 rounded-xl overflow-hidden font-mono text-xs">
            <div className="bg-slate-950 border-b border-slate-800/80 px-4 py-2 flex items-center justify-between text-[11px] text-slate-400">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-red-500/80" />
                <span className="h-2 w-2 rounded-full bg-yellow-500/80" />
                <span className="h-2 w-2 rounded-full bg-green-500/80" />
                <span className="ml-2 font-medium text-slate-300">alpha-india-control.log</span>
              </div>
              <span>Showing {filteredLogs.length} events</span>
            </div>

            <div className="max-h-[460px] overflow-y-auto divide-y divide-slate-900/60 p-2">
              {filteredLogs.length === 0 ? (
                <div className="py-12 text-center text-slate-500">
                  <Terminal size={24} className="mx-auto mb-2 opacity-40" />
                  <p>No operational logs matching current filters.</p>
                </div>
              ) : (
                filteredLogs.map((log) => {
                  const date = new Date(log.timestamp);
                  const timeFormatted = date.toLocaleTimeString("en-US", {
                    hour12: false,
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  });

                  return (
                    <div
                      key={log.id}
                      className="py-1.5 px-3 hover:bg-slate-900/40 rounded flex flex-col md:flex-row md:items-center justify-between gap-2 text-[11px] transition-colors"
                    >
                      <div className="flex items-start md:items-center gap-2.5 overflow-hidden">
                        <span className="text-slate-500 shrink-0 select-none">{timeFormatted}</span>

                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-bold tracking-wider shrink-0 ${
                            log.level === "SUCCESS"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                              : log.level === "ERROR"
                              ? "bg-red-500/10 text-red-400 border border-red-500/30"
                              : log.level === "WARN"
                              ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                              : "bg-blue-500/10 text-blue-400 border border-blue-500/30"
                          }`}
                        >
                          {log.level}
                        </span>

                        <span className="text-cyan-400 font-semibold shrink-0">
                          [{log.service_name}]
                        </span>

                        <span className="text-slate-300 truncate">
                          {log.message}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 text-slate-500 text-[10px] pl-8 md:pl-0">
                        {log.records_count > 0 && (
                          <span className="text-emerald-400/90 font-medium">
                            +{log.records_count} recs
                          </span>
                        )}
                        <span>{log.duration_ms}ms</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

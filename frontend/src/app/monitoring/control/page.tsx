"use client";

// =======================================================
// Alpha India — Control & Action Logs Dashboard (Health Monitor)
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
  AlertTriangle,
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
  LayoutGrid,
  Table as TableIcon,
  X,
  Maximize2,
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

  // Engine deck view mode & filter
  const [engineViewMode, setEngineViewMode] = useState<"MATRIX" | "CARDS">("MATRIX");
  const [serviceStatusFilter, setServiceStatusFilter] = useState<"ALL" | "ACTIVE" | "PAUSED" | "ERROR">("ALL");

  // Log terminal filters & controls
  const [activeServiceFilter, setActiveServiceFilter] = useState("ALL");
  const [activeLevelFilter, setActiveLevelFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [logLimit, setLogLimit] = useState(100);
  const [autoScroll, setAutoScroll] = useState(false);
  const [inspectedLog, setInspectedLog] = useState<ActionLogItem | null>(null);

  const [triggeringId, setTriggeringId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [triggeringAll, setTriggeringAll] = useState(false);
  const [tick, setTick] = useState(0);

  const terminalEndRef = useRef<HTMLDivElement | null>(null);

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

  // Auto-scroll terminal when new logs arrive
  useEffect(() => {
    if (autoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll]);

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

  const filteredServices = useMemo(() => {
    if (!statusData?.services) return [];
    if (serviceStatusFilter === "ACTIVE") {
      return statusData.services.filter((s) => s.status === "RUNNING" || s.status === "POLLING" || s.status === "IDLE");
    }
    if (serviceStatusFilter === "PAUSED") {
      return statusData.services.filter((s) => s.status === "PAUSED");
    }
    if (serviceStatusFilter === "ERROR") {
      return statusData.services.filter((s) => s.status === "ERROR");
    }
    return statusData.services;
  }, [statusData, serviceStatusFilter]);

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

  const levelCounts = useMemo(() => {
    return {
      ALL: logs.length,
      SUCCESS: logs.filter((l) => l.level === "SUCCESS").length,
      INFO: logs.filter((l) => l.level === "INFO").length,
      WARN: logs.filter((l) => l.level === "WARN").length,
      ERROR: logs.filter((l) => l.level === "ERROR").length,
    };
  }, [logs]);

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
      <div className="space-y-6 font-sans">
        {/* Breadcrumbs & Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
              <Link href="/monitoring" className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors">
                Monitoring Center
              </Link>
              <ChevronRight size={12} />
              <span className="text-cyan-600 dark:text-cyan-400 font-medium">Control & Action Logs</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400">
                <Sliders size={20} />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                  Control & Action Logs
                  <span className="text-[10px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
                    Health Monitor
                  </span>
                </h1>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Continuous multi-engine pipeline controller, last-fetch telemetry, and institutional operational logs.
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
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                  : "bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <Activity size={13} className={autoRefresh ? "animate-pulse" : ""} />
              <span>{autoRefresh ? "Auto-refresh: 4s" : "Auto-refresh: OFF"}</span>
            </button>

            <button
              onClick={() => loadData()}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={13} className={refreshing ? "animate-spin text-cyan-600 dark:text-cyan-400" : ""} />
              <span>Refresh</span>
            </button>

            <button
              onClick={handleTriggerAll}
              disabled={triggeringAll}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white shadow-xs dark:shadow-md dark:shadow-cyan-900/30 transition-all disabled:opacity-50"
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeft size={13} />
              <span>Monitoring Center</span>
            </Link>
          </div>
        </div>

        {/* Top KPIs Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/90 rounded-2xl p-4 flex items-center justify-between shadow-xs">
            <div>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Active Engines</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                {statusData ? `${statusData.active_services} / ${statusData.total_services}` : "--"}
              </p>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-1 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-ping" />
                Operational
              </span>
            </div>
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Cpu size={20} />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/90 rounded-2xl p-4 flex items-center justify-between shadow-xs">
            <div>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ingested Today</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                {statusData ? statusData.total_records_ingested_today.toLocaleString() : "--"}
              </p>
              <span className="text-[10px] text-cyan-600 dark:text-cyan-400 flex items-center gap-1 mt-1 font-medium">
                <Radio size={10} />
                Filings & statements
              </span>
            </div>
            <div className="h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
              <Database size={20} />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/90 rounded-2xl p-4 flex items-center justify-between shadow-xs">
            <div>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Latest Sync</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                {formatRelativeTime(statusData?.latest_fetch_time ?? null)}
              </p>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-1 font-medium">
                <Clock size={10} />
                Interval: 60s - 900s
              </span>
            </div>
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Clock size={20} />
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/90 rounded-2xl p-4 flex items-center justify-between shadow-xs">
            <div>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Action Logs Ring</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                {logs.length} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">/ 250</span>
              </p>
              <span className="text-[10px] text-purple-600 dark:text-purple-400 flex items-center gap-1 mt-1 font-medium">
                <HardDrive size={10} />
                FIFO in-memory buffer
              </span>
            </div>
            <div className="h-10 w-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Terminal size={20} />
            </div>
          </div>
        </div>

        {/* Section 1: Ingestion & Processing Engines Deck */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white tracking-wide uppercase flex items-center gap-2">
                <Layers size={15} className="text-cyan-600 dark:text-cyan-400" />
                Engine Command Deck
              </h2>

              {/* Status Filter Pills */}
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800 text-[10px]">
                {(["ALL", "ACTIVE", "PAUSED", "ERROR"] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setServiceStatusFilter(st)}
                    className={`px-2 py-0.5 rounded font-medium transition-colors ${
                      serviceStatusFilter === st
                        ? "bg-cyan-600 text-white font-semibold shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                  >
                    {st === "ALL" ? `All (${statusData?.services.length || 0})` : st}
                  </button>
                ))}
              </div>
            </div>

            {/* View Mode Toggle: Compact Matrix vs Cards */}
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-slate-100 dark:bg-slate-950 p-0.5 rounded-lg border border-slate-200 dark:border-slate-800">
                <button
                  onClick={() => setEngineViewMode("MATRIX")}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors ${
                    engineViewMode === "MATRIX"
                      ? "bg-white dark:bg-slate-800 text-cyan-700 dark:text-cyan-300 font-semibold shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                  title="Compact Table Matrix"
                >
                  <TableIcon size={13} />
                  <span>Matrix</span>
                </button>

                <button
                  onClick={() => setEngineViewMode("CARDS")}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs transition-colors ${
                    engineViewMode === "CARDS"
                      ? "bg-white dark:bg-slate-800 text-cyan-700 dark:text-cyan-300 font-semibold shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                  title="Detailed Cards Grid"
                >
                  <LayoutGrid size={13} />
                  <span>Cards</span>
                </button>
              </div>
            </div>
          </div>

          {/* Engine Deck View: Compact Matrix */}
          {engineViewMode === "MATRIX" ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800/90 bg-white dark:bg-slate-900/90 shadow-xs dark:shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/70 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Engine Name</th>
                      <th className="py-3 px-4 font-semibold">Category</th>
                      <th className="py-3 px-4 font-semibold text-center">Status</th>
                      <th className="py-3 px-4 font-semibold text-center">Last Fetch</th>
                      <th className="py-3 px-4 font-semibold text-center">Interval</th>
                      <th className="py-3 px-4 font-semibold text-right">Ingested Today</th>
                      <th className="py-3 px-4 font-semibold text-right">Total Cycles</th>
                      <th className="py-3 px-4 font-semibold text-right">Controls</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                    {filteredServices.map((svc) => {
                      const isTriggering = triggeringId === svc.id;
                      const isToggling = togglingId === svc.id;
                      const isPaused = svc.status === "PAUSED";
                      const isError = svc.status === "ERROR";

                      return (
                        <tr key={svc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          {/* Engine Name */}
                          <td className="py-3 px-4">
                            <div>
                              <span className="font-bold text-slate-900 dark:text-white block">{svc.name}</span>
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-xs block">
                                {svc.description}
                              </span>
                            </div>
                          </td>

                          {/* Category */}
                          <td className="py-3 px-4">
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
                              {svc.category}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${
                                isPaused
                                  ? "bg-amber-500/10 border-amber-500/30 text-amber-500 dark:text-amber-400"
                                  : isError
                                  ? "bg-red-500/10 border-red-500/30 text-red-500 dark:text-red-400"
                                  : "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                              }`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  isPaused ? "bg-amber-500" : isError ? "bg-red-500" : "bg-emerald-500 dark:bg-emerald-400 animate-pulse"
                                }`}
                              />
                              {svc.status}
                            </span>
                          </td>

                          {/* Last Fetch */}
                          <td className="py-3 px-4 text-center font-medium text-slate-700 dark:text-slate-300">
                            {formatRelativeTime(svc.last_fetch_time)}
                          </td>

                          {/* Interval */}
                          <td className="py-3 px-4 text-center text-cyan-600 dark:text-cyan-400 font-medium">
                            {svc.poll_interval_seconds}s
                          </td>

                          {/* Ingested Today */}
                          <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 dark:text-white">
                            {svc.records_ingested_today.toLocaleString()}
                          </td>

                          {/* Total Cycles */}
                          <td className="py-3 px-4 text-right font-mono text-slate-500 dark:text-slate-400">
                            {svc.total_fetches.toLocaleString()}
                          </td>

                          {/* Action Controls */}
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-2">
                              <button
                                onClick={() => handleToggleService(svc.id)}
                                disabled={isToggling}
                                className="flex items-center gap-1 text-[11px] font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                                title={isPaused ? "Resume Worker" : "Pause Worker"}
                              >
                                {isToggling ? (
                                  <Loader2 size={12} className="animate-spin" />
                                ) : isPaused ? (
                                  <Play size={12} className="text-emerald-500" />
                                ) : (
                                  <Pause size={12} className="text-amber-500" />
                                )}
                                <span>{isPaused ? "Resume" : "Pause"}</span>
                              </button>

                              <button
                                onClick={() => handleTriggerService(svc.id)}
                                disabled={isTriggering || isPaused}
                                className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 hover:bg-cyan-600 hover:text-white text-cyan-700 dark:text-cyan-300 border border-slate-200 dark:border-cyan-500/20 transition-all disabled:opacity-50"
                              >
                                {isTriggering ? (
                                  <Loader2 size={12} className="animate-spin text-cyan-500" />
                                ) : (
                                  <Zap size={12} />
                                )}
                                <span>{isTriggering ? "Fetching..." : "Fetch"}</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Engine Deck View: Cards Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredServices.map((svc) => {
                const isTriggering = triggeringId === svc.id;
                const isToggling = togglingId === svc.id;
                const isPaused = svc.status === "PAUSED";
                const isError = svc.status === "ERROR";

                return (
                  <div
                    key={svc.id}
                    className={`bg-white dark:bg-slate-900/80 border rounded-2xl p-4 transition-all duration-200 flex flex-col justify-between shadow-xs ${
                      isError
                        ? "border-red-500/40 bg-red-50/50 dark:bg-red-950/10"
                        : isPaused
                        ? "border-slate-200 dark:border-slate-800 opacity-75"
                        : "border-slate-200 dark:border-slate-800/90 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border border-slate-200 dark:border-slate-700">
                              {svc.category}
                            </span>
                            <h3 className="text-sm font-bold text-slate-900 dark:text-white">{svc.name}</h3>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{svc.description}</p>
                        </div>

                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 shrink-0 ${
                            isPaused
                              ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
                              : isError
                              ? "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400"
                              : "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              isPaused ? "bg-amber-500" : isError ? "bg-red-500" : "bg-emerald-500 dark:bg-emerald-400 animate-pulse"
                            }`}
                          />
                          {svc.status}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs bg-slate-50 dark:bg-slate-950/50 rounded-xl p-2.5 border border-slate-200 dark:border-slate-800/60">
                        <div>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Last Fetch</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {formatRelativeTime(svc.last_fetch_time)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Interval</span>
                          <span className="font-semibold text-cyan-600 dark:text-cyan-400">
                            Every {svc.poll_interval_seconds}s
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Ingested Today</span>
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {svc.records_ingested_today.toLocaleString()}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Total Cycles</span>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {svc.total_fetches.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {svc.last_error && (
                        <div className="mt-2 text-[11px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/40 rounded p-1.5 flex items-center gap-1.5">
                          <AlertTriangle size={12} />
                          <span className="truncate">{svc.last_error}</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
                      <button
                        onClick={() => handleToggleService(svc.id)}
                        disabled={isToggling}
                        className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-colors disabled:opacity-50"
                      >
                        {isToggling ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : isPaused ? (
                          <Play size={12} className="text-emerald-500" />
                        ) : (
                          <Pause size={12} className="text-amber-500" />
                        )}
                        <span>{isPaused ? "Resume Engine" : "Pause Engine"}</span>
                      </button>

                      <button
                        onClick={() => handleTriggerService(svc.id)}
                        disabled={isTriggering || isPaused}
                        className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-1.5 px-3 rounded-xl bg-cyan-50 dark:bg-cyan-600/20 text-cyan-700 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-500/30 hover:bg-cyan-600 hover:text-white transition-all disabled:opacity-50"
                      >
                        {isTriggering ? (
                          <Loader2 size={12} className="animate-spin text-cyan-500" />
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
          )}
        </div>

        {/* Section 2: Operational Action Logs Terminal */}
        <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800/90 rounded-2xl p-5 space-y-4 shadow-xs dark:shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800/80 pb-4">
            <div className="flex items-center gap-2">
              <Terminal size={18} className="text-cyan-600 dark:text-cyan-400" />
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Real-Time Operational Action Logs</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Instant telemetry stream of background tasks, records parsed, batch runtimes, and errors.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setAutoScroll(!autoScroll)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  autoScroll
                    ? "bg-cyan-50 dark:bg-cyan-500/10 border-cyan-300 dark:border-cyan-500/30 text-cyan-700 dark:text-cyan-400"
                    : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
                title="Automatically scroll to latest logs as they stream"
              >
                <span>Auto-scroll: {autoScroll ? "ON" : "OFF"}</span>
              </button>

              <button
                onClick={exportLogs}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
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
            <div className="relative flex-1 min-w-[220px] max-w-sm">
              <Search size={13} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search logs by message, service, or action..."
                className="w-full pl-8 pr-8 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 text-xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Service Filter Select */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-500 uppercase tracking-wider">Service:</span>
              <select
                value={activeServiceFilter}
                onChange={(e) => setActiveServiceFilter(e.target.value)}
                className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="ALL">All Services ({statusData?.services.length || 6})</option>
                <option value="exchange_live_wire">Exchange Live Wire</option>
                <option value="results_discovery">Results Discovery</option>
                <option value="athena_omega_watcher">Athena Omega Watcher</option>
                <option value="screener_financial_importer">Screener Financial Importer</option>
                <option value="early_stage_discovery">Early Stage Discovery</option>
                <option value="raw_file_archiver">Raw File Archiver</option>
              </select>
            </div>

            {/* Level Filter Tabs with counts */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-lg border border-slate-200 dark:border-slate-800">
              {(["ALL", "SUCCESS", "INFO", "WARN", "ERROR"] as const).map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setActiveLevelFilter(lvl)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider transition-colors flex items-center gap-1 ${
                    activeLevelFilter === lvl
                      ? lvl === "SUCCESS"
                        ? "bg-emerald-500 text-slate-950"
                        : lvl === "ERROR"
                        ? "bg-red-500 text-white"
                        : lvl === "WARN"
                        ? "bg-amber-500 text-slate-950"
                        : "bg-cyan-600 text-white"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  <span>{lvl}</span>
                  <span className="opacity-70 text-[9px]">({levelCounts[lvl]})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Log Stream Terminal Window */}
          <div className="bg-[#030712] border border-slate-800/90 rounded-xl overflow-hidden font-mono text-xs shadow-inner">
            <div className="bg-slate-950 border-b border-slate-800/80 px-4 py-2 flex items-center justify-between text-[11px] text-slate-400">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-red-500/80" />
                <span className="h-2 w-2 rounded-full bg-yellow-500/80" />
                <span className="h-2 w-2 rounded-full bg-green-500/80" />
                <span className="ml-2 font-medium text-slate-300">alpha-india-control.log</span>
              </div>
              <span>Showing {filteredLogs.length} events (click row to inspect)</span>
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
                      onClick={() => setInspectedLog(log)}
                      className="py-1.5 px-3 hover:bg-slate-900/70 rounded cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-2 text-[11px] transition-colors group"
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

                        <span className="text-slate-300 truncate group-hover:text-white transition-colors">
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
                        <Maximize2 size={11} className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400" />
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={terminalEndRef} />
            </div>
          </div>
        </div>

        {/* Modal / Inspector Drawer for selected log entry */}
        {inspectedLog && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fadeIn"
            onClick={() => setInspectedLog(null)}
          >
            <div
              className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Terminal size={18} className="text-cyan-400" />
                  <h3 className="text-base font-bold text-white">Log Event Inspector</h3>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      inspectedLog.level === "SUCCESS"
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : inspectedLog.level === "ERROR"
                        ? "bg-red-500/20 text-red-400 border border-red-500/30"
                        : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                    }`}
                  >
                    {inspectedLog.level}
                  </span>
                </div>

                <button
                  onClick={() => setInspectedLog(null)}
                  className="rounded-lg p-1 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block text-[10px] uppercase tracking-wider">Service</span>
                  <span className="text-white font-mono font-semibold">{inspectedLog.service_name}</span>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block text-[10px] uppercase tracking-wider">Action</span>
                  <span className="text-cyan-400 font-mono font-semibold">{inspectedLog.action}</span>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block text-[10px] uppercase tracking-wider">Timestamp</span>
                  <span className="text-slate-200 font-mono">{new Date(inspectedLog.timestamp).toISOString()}</span>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block text-[10px] uppercase tracking-wider">Execution Duration</span>
                  <span className="text-amber-400 font-mono font-semibold">{inspectedLog.duration_ms} ms</span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider block mb-1">
                  Log Message & Payload
                </span>
                <div className="rounded-xl border border-slate-800 bg-[#030712] p-4 text-xs font-mono text-slate-200 max-h-60 overflow-y-auto break-all whitespace-pre-wrap">
                  {inspectedLog.message}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setInspectedLog(null)}
                  className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-white transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

"use client";

// =======================================================
// Alpha India — Mission Control Overview (Tier 1)
// Live system health, warehouse KPIs, engine status grid,
// and catalyst pulse feed. Gateway to Tier 2 control terminal.
// Sprint 38.1 — Unified Operations Hub
// =======================================================

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Cpu,
  Database,
  Radio,
  RefreshCw,
  Sliders,
  TrendingUp,
  Activity,
  Zap,
  BarChart3,
  FileText,
  BookOpen,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Layers,
  ShieldCheck,
  Target,
  Building2,
} from "lucide-react";
import Link from "next/link";

import DashboardLayout from "@/components/layout/DashboardLayout";
import MonitoringRibbon from "@/components/layout/MonitoringRibbon";
import MissionHeader from "@/components/layout/monitoring/MissionHeader";
import EngineGrid from "@/components/layout/monitoring/EngineGrid";
import ScannerTimeline from "@/components/layout/monitoring/ScannerTimeline";

import {
  fetchMissionControlStatus,
} from "@/lib/monitoringApi";

// =====================================================
// Helpers
// =====================================================
function formatRelativeTime(isoString: string | null | undefined): string {
  if (!isoString) return "Never";
  try {
    const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
    if (diff < 5) return "Just now";
    if (diff < 60) return `${diff}s ago`;
    const mins = Math.floor(diff / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m ago`;
  } catch {
    return isoString;
  }
}

// =====================================================
// Sub-Components
// =====================================================

function KpiCard({
  label,
  value,
  subLabel,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  subLabel?: string;
  icon: React.ElementType;
  accent: "cyan" | "emerald" | "amber" | "violet" | "rose" | "blue";
}) {
  const colors = {
    cyan: {
      bg: "bg-cyan-500/10 dark:bg-cyan-500/[0.08]",
      border: "border-cyan-500/20 dark:border-cyan-500/20",
      icon: "text-cyan-600 dark:text-cyan-400",
      value: "text-cyan-700 dark:text-cyan-300",
      sub: "text-cyan-600/70 dark:text-cyan-400/70",
    },
    emerald: {
      bg: "bg-emerald-500/10 dark:bg-emerald-500/[0.08]",
      border: "border-emerald-500/20 dark:border-emerald-500/20",
      icon: "text-emerald-600 dark:text-emerald-400",
      value: "text-emerald-700 dark:text-emerald-300",
      sub: "text-emerald-600/70 dark:text-emerald-400/70",
    },
    amber: {
      bg: "bg-amber-500/10 dark:bg-amber-500/[0.08]",
      border: "border-amber-500/20 dark:border-amber-500/20",
      icon: "text-amber-600 dark:text-amber-400",
      value: "text-amber-700 dark:text-amber-300",
      sub: "text-amber-600/70 dark:text-amber-400/70",
    },
    violet: {
      bg: "bg-violet-500/10 dark:bg-violet-500/[0.08]",
      border: "border-violet-500/20 dark:border-violet-500/20",
      icon: "text-violet-600 dark:text-violet-400",
      value: "text-violet-700 dark:text-violet-300",
      sub: "text-violet-600/70 dark:text-violet-400/70",
    },
    rose: {
      bg: "bg-rose-500/10 dark:bg-rose-500/[0.08]",
      border: "border-rose-500/20 dark:border-rose-500/20",
      icon: "text-rose-600 dark:text-rose-400",
      value: "text-rose-700 dark:text-rose-300",
      sub: "text-rose-600/70 dark:text-rose-400/70",
    },
    blue: {
      bg: "bg-blue-500/10 dark:bg-blue-500/[0.08]",
      border: "border-blue-500/20 dark:border-blue-500/20",
      icon: "text-blue-600 dark:text-blue-400",
      value: "text-blue-700 dark:text-blue-300",
      sub: "text-blue-600/70 dark:text-blue-400/70",
    },
  };
  const c = colors[accent];

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border bg-white dark:bg-slate-900/70 p-4 shadow-xs dark:shadow-xl transition-all duration-200 hover:shadow-md dark:hover:shadow-2xl hover:-translate-y-0.5 ${c.border}`}
    >
      {/* Glow accent */}
      <div
        className={`absolute -top-4 -right-4 h-20 w-20 rounded-full opacity-20 blur-2xl ${c.bg}`}
      />
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1">
            {label}
          </p>
          <p className={`text-2xl font-bold font-mono tracking-tight ${c.value}`}>
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
          {subLabel && (
            <p className={`text-[11px] mt-1 font-medium ${c.sub}`}>{subLabel}</p>
          )}
        </div>
        <div className={`h-10 w-10 shrink-0 rounded-xl border flex items-center justify-center ${c.bg} ${c.border}`}>
          <Icon size={18} className={c.icon} />
        </div>
      </div>
    </div>
  );
}

// =====================================================
// Main Page
// =====================================================
export default function MonitoringPage() {
  const [activeSection, setActiveSection] = useState<"OVERVIEW" | "ENGINES" | "LIVE_WIRE">("OVERVIEW");

  const {
    data: status,
    isLoading: loadingStatus,
    refetch: refetchStatus,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ["mission-control-status"],
    queryFn: fetchMissionControlStatus,
    refetchInterval: 5000,
  });

  const loading = loadingStatus && !status;
  const warehouse = status?.warehouse?.warehouse;
  const audit = status?.audit;

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })
    : "--:--:--";

  return (
    <DashboardLayout>
      {/* Live Telemetry Ribbon */}
      <MonitoringRibbon warehouse={warehouse} audit={audit} />

      <div className="space-y-6">
        {loading || !status ? (
          /* Loading skeleton */
          <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-20 text-center shadow-xs">
            <RefreshCw className="h-8 w-8 animate-spin text-cyan-500 mb-3" />
            <p className="text-base font-semibold text-slate-900 dark:text-white">
              Connecting to Mission Control...
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Polling live telemetry from Alpha India backend
            </p>
          </div>
        ) : (
          <>
            {/* ================================================
                PAGE HEADER — Mission Branding + Status Badge
                ================================================ */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-1">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-cyan-600 dark:text-cyan-400 font-semibold">
                    Alpha India • Mission Control
                  </span>
                  <span className="flex items-center gap-1 text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 uppercase tracking-wider">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Operational
                  </span>
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                  System Overview & Health
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Institutional-grade telemetry for all NSE/BSE ingestion engines, warehouse state, and market intelligence pipelines.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  <Clock size={11} />
                  Updated {lastUpdated}
                </span>
                <button
                  onClick={() => refetchStatus()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  <RefreshCw size={12} className={loadingStatus ? "animate-spin text-cyan-500" : ""} />
                  <span>Refresh</span>
                </button>

                <Link
                  href="/monitoring/control"
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white shadow-md shadow-cyan-900/20 transition-all"
                >
                  <Sliders size={12} />
                  <span>Operations Console</span>
                  <ArrowRight size={11} />
                </Link>
              </div>
            </div>

            {/* ================================================
                SECTION NAV TABS
                ================================================ */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 w-fit">
              {(
                [
                  { id: "OVERVIEW", label: "Warehouse KPIs", icon: Database },
                  { id: "ENGINES", label: "Engine Status", icon: Cpu },
                  { id: "LIVE_WIRE", label: "Live Wire & Catalysts", icon: Radio },
                ] as const
              ).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveSection(id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                    activeSection === id
                      ? "bg-white dark:bg-slate-800 text-cyan-700 dark:text-cyan-300 shadow-xs"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  <Icon size={13} />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {/* ================================================
                SECTION 1: WAREHOUSE KPI CARDS
                ================================================ */}
            {(activeSection === "OVERVIEW") && (
              <div className="space-y-5 animate-fadeIn">
                {/* Master KPI Grid */}
                <div>
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-2">
                    <Database size={13} className="text-cyan-500" />
                    Warehouse & Market Intelligence
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
                    <KpiCard
                      label="Master Companies"
                      value={warehouse?.total_companies ?? "--"}
                      subLabel="NSE + BSE Listed"
                      icon={Building2}
                      accent="cyan"
                    />
                    <KpiCard
                      label="Financial Statements"
                      value={warehouse?.quarterly_records ?? "--"}
                      subLabel="Quarterly records"
                      icon={FileText}
                      accent="emerald"
                    />
                    <KpiCard
                      label="Coverage"
                      value={warehouse ? `${warehouse.coverage_percent.toFixed(1)}%` : "--"}
                      subLabel="Import coverage"
                      icon={TrendingUp}
                      accent="blue"
                    />
                    <KpiCard
                      label="Imported"
                      value={warehouse?.imported_companies ?? "--"}
                      subLabel="Companies imported"
                      icon={BarChart3}
                      accent="amber"
                    />
                    <KpiCard
                      label="Pending Import"
                      value={warehouse?.pending_companies ?? "--"}
                      subLabel="Awaiting ingestion"
                      icon={Target}
                      accent="violet"
                    />
                    <KpiCard
                      label="Audit Processed"
                      value={audit?.processed ?? "--"}
                      subLabel={audit ? `${audit.progress_percent.toFixed(1)}% complete` : "Pending"}
                      icon={ShieldCheck}
                      accent="rose"
                    />
                  </div>
                </div>

                {/* Audit & Repair Status */}
                <div>
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-2">
                    <ShieldCheck size={13} className="text-emerald-500" />
                    Audit & Data Integrity
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/90 rounded-2xl p-4 shadow-xs">
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">
                        Companies Processed
                      </p>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white font-mono">
                        {audit?.processed?.toLocaleString() ?? "--"}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        of {audit?.total?.toLocaleString() ?? "--"} total
                      </p>
                      {audit && audit.total > 0 && (
                        <div className="mt-2 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                            style={{
                              width: `${Math.min(100, audit.progress_percent || 0).toFixed(1)}%`,
                            }}
                          />
                        </div>
                      )}
                    </div>

                    <div className="bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/90 rounded-2xl p-4 shadow-xs">
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">
                        Audit Failures
                      </p>
                      <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 font-mono">
                        {audit?.failed?.toLocaleString() ?? "--"}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        companies failed audit
                      </p>
                      {(audit?.failed ?? 0) === 0 ? (
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-2 flex items-center gap-1 font-medium">
                          <CheckCircle2 size={11} /> Clean — no audit failures
                        </p>
                      ) : (
                        <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1 font-medium">
                          <AlertTriangle size={11} /> Review recommended
                        </p>
                      )}
                    </div>

                    <div className="bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/90 rounded-2xl p-4 shadow-xs">
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">
                        Passed Audit
                      </p>
                      <p className="text-2xl font-bold text-cyan-700 dark:text-cyan-300 font-mono">
                        {audit?.passed?.toLocaleString() ?? "--"}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        companies passed all checks
                      </p>
                    </div>

                    <div className="bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800/90 rounded-2xl p-4 shadow-xs">
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">
                        Audit Warnings
                      </p>
                      <p className="text-2xl font-bold text-slate-900 dark:text-white font-mono">
                        {audit?.warning?.toLocaleString() ?? "--"}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                        minor data quality issues
                      </p>
                    </div>
                  </div>
                </div>

                {/* CTA Banner → Tier 2 */}
                <div className="relative overflow-hidden rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 via-slate-900/0 to-blue-500/5 dark:from-cyan-500/10 dark:to-blue-600/5 p-5 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Layers size={15} className="text-cyan-500" />
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          Operations Control Console & Action Logs
                        </h3>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-lg">
                        Full engine control matrix, real-time action log terminal with severity filters, discovery queue explorer,
                        and manual service triggers. Deep-dive operational diagnostics for advanced administration.
                      </p>
                    </div>
                    <Link
                      href="/monitoring/control"
                      className="flex items-center gap-2 shrink-0 px-5 py-2.5 rounded-xl text-sm font-semibold bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-900/30 transition-all hover:scale-105"
                    >
                      <Sliders size={14} />
                      <span>Open Control Terminal</span>
                      <ArrowRight size={13} />
                    </Link>
                  </div>
                  {/* Subtle grid decoration */}
                  <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                    style={{
                      backgroundImage: "linear-gradient(rgba(6,182,212,1) 1px, transparent 1px), linear-gradient(90deg, rgba(6,182,212,1) 1px, transparent 1px)",
                      backgroundSize: "40px 40px",
                    }}
                  />
                </div>
              </div>
            )}

            {/* ================================================
                SECTION 2: ENGINE STATUS GRID
                ================================================ */}
            {activeSection === "ENGINES" && (
              <div className="animate-fadeIn space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <Cpu size={13} className="text-cyan-500" />
                    Live Engine Health Matrix
                  </h2>
                  <Link
                    href="/monitoring/control"
                    className="flex items-center gap-1.5 text-xs text-cyan-600 dark:text-cyan-400 font-medium hover:underline"
                  >
                    <Sliders size={11} />
                    Manage engines in Control Console
                  </Link>
                </div>
                <MissionHeader status={status} />
                <EngineGrid status={status} />

                {/* Quick CTA */}
                <div className="flex items-center justify-end pt-2">
                  <Link
                    href="/monitoring/control"
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white transition-all"
                  >
                    <Zap size={12} />
                    Trigger / Manage Engines in Control Terminal
                    <ArrowRight size={11} />
                  </Link>
                </div>
              </div>
            )}

            {/* ================================================
                SECTION 3: LIVE WIRE & CATALYST FEED
                ================================================ */}
            {activeSection === "LIVE_WIRE" && (
              <div className="animate-fadeIn space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <Radio size={13} className="text-emerald-500" />
                    Live Discovery & Catalyst Pulse
                    <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  </h2>
                </div>
                <ScannerTimeline status={status} />

                {/* Data Freshness footer */}
                <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 border-t border-slate-200 dark:border-slate-800 pt-3">
                  <Activity size={11} />
                  <span>Auto-refreshing every 5 seconds • Last fetched: {lastUpdated}</span>
                  <span className="ml-auto flex items-center gap-1.5">
                    <BookOpen size={11} />
                    Full action logs available in
                    <Link href="/monitoring/control" className="text-cyan-600 dark:text-cyan-400 font-medium hover:underline">
                      Control Terminal
                    </Link>
                  </span>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
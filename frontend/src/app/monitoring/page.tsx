"use client";

// =======================================================
// Alpha India Mission Control
// Sprint 33.4 Phase 4C.2.2
// Live Queue Integration
// =======================================================

import { useEffect, useState } from "react";

import DashboardLayout from "@/components/layout/DashboardLayout";
import MonitoringRibbon from "@/components/layout/MonitoringRibbon";

import MissionHeader from "@/components/layout/monitoring/MissionHeader";
import EngineGrid from "@/components/layout/monitoring/EngineGrid";
import ScannerTimeline from "@/components/layout/monitoring/ScannerTimeline";
import DiscoveryQueueDashboard from "@/components/layout/monitoring/DiscoveryQueueDashboard";
import DiscoveryToolbar from "@/components/layout/monitoring/DiscoveryToolbar";
import DiscoveryQueueTable from "@/components/layout/monitoring/DiscoveryQueueTable";

import {
  fetchMissionControlStatus,
  fetchMissionControlQueue,
  type MissionControlQueueRow,
} from "@/lib/monitoringApi";

import type { MissionControlStatus } from "@/types/monitoring";

export default function MonitoringPage() {
  // =====================================================
  // Mission Control State
  // =====================================================

  const [status, setStatus] = useState<MissionControlStatus | null>(null);
  const [loading, setLoading] = useState(true);

  // Discovery Queue
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [queueRows, setQueueRows] = useState<MissionControlQueueRow[]>([]);
  const [queuePage, setQueuePage] = useState(1);
  const [queueTotalPages, setQueueTotalPages] = useState(1);

  // =====================================================
  // Load Mission Control Dashboard
  // =====================================================

  async function loadMissionControl() {
    try {
      const data = await fetchMissionControlStatus();
      setStatus(data);
    } catch (error) {
      console.error("Mission Control:", error);
    } finally {
      setLoading(false);
    }
  }

  // =====================================================
  // Load Discovery Queue
  // =====================================================

  async function loadQueue() {
    try {
      const data = await fetchMissionControlQueue(
        queuePage,
        50,
        search,
        statusFilter
      );

      setQueueRows(data.results);
      setQueueTotalPages(data.total_pages);
    } catch (error) {
      console.error("Discovery Queue:", error);
      setQueueRows([]);
    }
  }

  // =====================================================
  // Auto Refresh Every 5 Seconds
  // =====================================================

  useEffect(() => {
    loadMissionControl();
    loadQueue();

    const interval = setInterval(() => {
      loadMissionControl();
      loadQueue();
    }, 5000);

    return () => clearInterval(interval);
  }, [queuePage, search, statusFilter]);

  // =====================================================
  // Render
  // =====================================================

  return (
    <DashboardLayout>
      <MonitoringRibbon />

      <div className="space-y-8 p-6">
        {loading || !status ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-10 text-center text-slate-400">
            Loading Mission Control...
          </div>
        ) : (
          <>
            {/* =================================================== */}
            {/* Phase 1 — Mission Header */}
            {/* =================================================== */}

            <MissionHeader status={status} />

            {/* =================================================== */}
            {/* Phase 2 — Live Engine Grid */}
            {/* =================================================== */}

            <EngineGrid status={status} />

            {/* =================================================== */}
            {/* Phase 3 — Scanner Timeline */}
            {/* =================================================== */}

            <ScannerTimeline status={status} />

            {/* =================================================== */}
            {/* Phase 4 — Queue Summary Dashboard */}
            {/* =================================================== */}

            <DiscoveryQueueDashboard />

            {/* =================================================== */}
            {/* Discovery Queue Toolbar */}
            {/* =================================================== */}

            <DiscoveryToolbar
              search={search}
              setSearch={setSearch}
              status={statusFilter}
              setStatus={setStatusFilter}
              total={status.warehouse.warehouse.total_companies}
              onRefresh={() => {
                loadMissionControl();
                loadQueue();
              }}
            />

            {/* =================================================== */}
            {/* Discovery Queue Table */}
            {/* =================================================== */}

            <DiscoveryQueueTable
              rows={queueRows}
              search={search}
              statusFilter={statusFilter}
            />

            {/* =================================================== */}
            {/* Queue Pagination */}
            {/* =================================================== */}

            <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 px-5 py-4">
              <div className="text-sm text-slate-400">
                Showing page{" "}
                <span className="font-semibold text-white">{queuePage}</span>{" "}
                of{" "}
                <span className="font-semibold text-white">
                  {queueTotalPages}
                </span>
              </div>

              <div className="flex gap-3">
                <button
                  disabled={queuePage === 1}
                  onClick={() =>
                    setQueuePage((prev) => Math.max(prev - 1, 1))
                  }
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>

                <button
                  disabled={queuePage >= queueTotalPages}
                  onClick={() =>
                    setQueuePage((prev) =>
                      Math.min(prev + 1, queueTotalPages)
                    )
                  }
                  className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>

            {/* =================================================== */}
            {/* Live Metrics Snapshot */}
            {/* =================================================== */}

            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-cyan-400">
                    Live Metrics
                  </p>

                  <h2 className="mt-2 text-2xl font-bold text-white">
                    Mission Control Snapshot
                  </h2>

                  <p className="mt-1 text-sm text-slate-400">
                    Real-time operational metrics from Alpha India backend.
                  </p>
                </div>

                <div className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
                  AUTO REFRESH • 5 SEC
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  title="System Status"
                  value={status.heartbeat.status}
                  color="text-emerald-400"
                />

                <MetricCard
                  title="Market Session"
                  value={status.discovery.current_session}
                  color="text-sky-400"
                />

                <MetricCard
                  title="Last Scan Time"
                  value={status.heartbeat.last_scan}
                  color="text-amber-400"
                />

                <MetricCard
                  title="Next Scan Time"
                  value={status.heartbeat.next_scan}
                  color="text-violet-400"
                />

                <MetricCard
                  title="Companies Scanned Today"
                  value={status.heartbeat.companies_scanned_today.toLocaleString()}
                  color="text-cyan-400"
                />

                <MetricCard
                  title="Results Found Today"
                  value={status.heartbeat.results_found_today.toLocaleString()}
                  color="text-emerald-400"
                />

                <MetricCard
                  title="PDF Downloaded Today"
                  value={status.heartbeat.pdf_downloaded_today.toLocaleString()}
                  color="text-indigo-400"
                />

                <MetricCard
                  title="Parser Failures Today"
                  value={status.heartbeat.parser_failures_today.toLocaleString()}
                  color="text-red-400"
                />
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

// =======================================================
// Reusable Metric Card
// =======================================================

function MetricCard({
  title,
  value,
  color,
}: {
  title: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 transition-all hover:border-slate-700">
      <p className="text-xs uppercase tracking-wider text-slate-500">
        {title}
      </p>

      <p className={`mt-3 break-all text-lg font-semibold ${color}`}>
        {value}
      </p>
    </div>
  );
}
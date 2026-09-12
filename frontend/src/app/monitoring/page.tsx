"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  Database,
  ShieldCheck,
  Brain,
  Clock,
  Building2,
  FileText,
  AlertTriangle,
  RefreshCcw,
} from "lucide-react";

import MonitoringRibbon from "@/components/layout/MonitoringRibbon";

import {
  fetchMonitoringDashboard,
  fetchDiscoveryQueue,
  formatDateTime,
  MonitoringDashboard,
  DiscoveryQueueItem,
} from "@/lib/monitoringApi";

export default function MonitoringPage() {
  const [dashboard, setDashboard] =
    useState<MonitoringDashboard | null>(null);

  const [queue, setQueue] = useState<DiscoveryQueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadDashboard() {
    try {
      const [status, queueResponse] = await Promise.all([
        fetchMonitoringDashboard(),
        fetchDiscoveryQueue(),
      ]);

      setDashboard(status);
      setQueue(queueResponse.queue ?? []);
    } catch (err) {
      console.error("Mission Control failed:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();

    const timer = setInterval(loadDashboard, 5000);

    return () => clearInterval(timer);
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6 space-y-6">

      {/* Mission Header */}
      <section className="rounded-3xl bg-gradient-to-r from-emerald-900 via-slate-900 to-cyan-900 p-6 border border-emerald-700 shadow-xl">
        <div className="flex flex-wrap justify-between gap-4">

          <div>
            <p className="text-xs uppercase tracking-widest text-emerald-300">
              Alpha India v3.0
            </p>

            <h1 className="text-3xl font-bold text-white mt-2">
              Mission Control
            </h1>

            <p className="text-slate-300 mt-2">
              Live NSE / BSE Monitoring & Financial Warehouse Operations Center
            </p>
          </div>

          <div className="text-right">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-2 border border-emerald-500">
              <Activity className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-medium text-emerald-300">
                {dashboard?.heartbeat.status ?? "OFFLINE"}
              </span>
            </div>

            <p className="mt-4 text-sm text-slate-300">
              Session:{" "}
              <span className="text-cyan-300">
                {dashboard?.discovery.current_session ?? "--"}
              </span>
            </p>

            <p className="text-xs text-slate-400">
              Last Scan:{" "}
              {formatDateTime(dashboard?.heartbeat.last_scan)}
            </p>
          </div>

        </div>
      </section>

      {/* Monitoring Ribbon */}
      <MonitoringRibbon />

      {/* Engine Status */}
      <section className="grid md:grid-cols-4 gap-4">

        <EngineCard
          icon={<Activity className="text-green-400" />}
          title="Discovery Engine"
          value={dashboard?.discovery.engine_status ?? "--"}
          subtitle="Live Scanner"
        />

        <EngineCard
          icon={<Database className="text-cyan-400" />}
          title="Financial Engine"
          value={dashboard?.importEngine.running ? "RUNNING" : "STOPPED"}
          subtitle="Quarterly Import"
        />

        <EngineCard
          icon={<ShieldCheck className="text-yellow-400" />}
          title="Audit Engine"
          value={dashboard?.audit.running ? "RUNNING" : "STOPPED"}
          subtitle="Health Validation"
        />

        <EngineCard
          icon={<Brain className="text-purple-400" />}
          title="AI Growth Engine"
          value="READY"
          subtitle="Growth Ranking"
        />

      </section>

      {/* KPI Section */}
      <section className="grid md:grid-cols-4 gap-4">

        <KpiCard
          icon={<Building2 className="text-green-400" />}
          label="Companies Scanned Today"
          value={dashboard?.heartbeat.companies_scanned_today ?? 0}
        />

        <KpiCard
          icon={<FileText className="text-blue-400" />}
          label="Results Found Today"
          value={dashboard?.heartbeat.results_found_today ?? 0}
        />

        <KpiCard
          icon={<Database className="text-cyan-400" />}
          label="Quarterly Records"
          value={dashboard?.warehouse.quarterly_records ?? 0}
        />

        <KpiCard
          icon={<AlertTriangle className="text-red-400" />}
          label="Parser Failures"
          value={dashboard?.heartbeat.parser_failures_today ?? 0}
        />

      </section>

      {/* Warehouse Progress */}
      <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6 space-y-5">

        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-cyan-300">
            Financial Warehouse Coverage
          </h2>

          <RefreshCcw className="h-5 w-5 text-slate-500" />
        </div>

        <div className="flex justify-between text-sm text-slate-300">
          <span>
            {dashboard?.warehouse.imported_companies ?? 0} Imported
          </span>

          <span>
            {dashboard?.warehouse.total_companies ?? 0} Universe
          </span>
        </div>

        <div className="h-3 rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-3 rounded-full bg-gradient-to-r from-green-500 to-cyan-400 transition-all duration-500"
            style={{
              width: `${dashboard?.warehouse.coverage_percent ?? 0}%`,
            }}
          />
        </div>

        <p className="text-right text-green-400 font-semibold">
          {(dashboard?.warehouse.coverage_percent ?? 0).toFixed(2)}%
        </p>

      </section>

      {/* Discovery Queue */}
      <section className="rounded-3xl border border-slate-800 bg-slate-900 p-6">

        <h2 className="text-xl font-bold text-emerald-300 mb-5">
          Live Discovery Queue
        </h2>

        <div className="overflow-auto rounded-xl border border-slate-800">

          <table className="w-full text-sm">
            <thead className="bg-slate-950 text-slate-400">
              <tr>
                <th className="p-3 text-left">SYMBOL</th>
                <th className="p-3 text-left">EXCHANGE</th>
                <th className="p-3 text-left">STATUS</th>
                <th className="p-3 text-left">UPDATED</th>
              </tr>
            </thead>

            <tbody>
              {queue.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="text-center text-slate-500 p-6"
                  >
                    Loading Queue...
                  </td>
                </tr>
              )}

              {queue.slice(0, 25).map((item, index) => (
                <tr
                  key={index}
                  className="border-t border-slate-800 hover:bg-slate-800/40"
                >
                  <td className="p-3 font-medium text-cyan-300">
                    {item.symbol}
                  </td>

                  <td className="p-3">
                    {item.exchange ?? "NSE"}
                  </td>

                  <td className="p-3">
                    <StatusBadge status={item.status} />
                  </td>

                  <td className="p-3 text-slate-400 text-xs">
                    {formatDateTime(item.updated_at)}
                  </td>
                </tr>
              ))}
            </tbody>

          </table>

        </div>

      </section>

      {/* Audit Summary */}
      <section className="grid md:grid-cols-4 gap-4">

        <AuditCard
          label="PASS"
          value={dashboard?.audit.passed ?? 0}
          color="text-green-400"
        />

        <AuditCard
          label="WARNING"
          value={dashboard?.audit.warning ?? 0}
          color="text-yellow-400"
        />

        <AuditCard
          label="FAIL"
          value={dashboard?.audit.failed ?? 0}
          color="text-red-400"
        />

        <AuditCard
          label="Processed"
          value={dashboard?.audit.processed ?? 0}
          color="text-cyan-400"
        />

      </section>

      {/* Footer */}
      <footer className="rounded-3xl bg-slate-900 border border-slate-800 p-5 flex flex-wrap justify-between text-sm text-slate-400 gap-3">

        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-cyan-400" />
          Refreshing every 5 seconds
        </div>

        <div>
          Next Scan:{" "}
          {formatDateTime(dashboard?.heartbeat.next_scan)}
        </div>

      </footer>

    </main>
  );
}

/* -------------------------------- Components ------------------------------ */

function EngineCard({
  icon,
  title,
  value,
  subtitle,
}: any) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-3">
      <div className="flex items-center justify-between">
        {icon}
      </div>

      <h3 className="text-sm text-slate-400">{title}</h3>

      <p className="text-xl font-bold">{value}</p>

      <p className="text-xs text-slate-500">{subtitle}</p>
    </div>
  );
}

function KpiCard({ icon, label, value }: any) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
      <div className="flex items-center gap-3 text-slate-400">
        {icon}
        <span className="text-xs">{label}</span>
      </div>

      <p className="mt-4 text-3xl font-bold text-white">
        {Number(value).toLocaleString()}
      </p>
    </div>
  );
}

function AuditCard({ label, value, color }: any) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 text-center">
      <p className="text-xs text-slate-400">{label}</p>

      <p className={`mt-3 text-3xl font-bold ${color}`}>
        {value}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "COMPLETED"
      ? "bg-green-500/20 text-green-400 border-green-500"
      : status === "RUNNING"
      ? "bg-cyan-500/20 text-cyan-400 border-cyan-500"
      : status === "FAILED"
      ? "bg-red-500/20 text-red-400 border-red-500"
      : "bg-yellow-500/20 text-yellow-400 border-yellow-500";

  return (
    <span className={`px-2 py-1 rounded-full border text-xs ${color}`}>
      {status}
    </span>
  );
}
"use client";

// =======================================================
// Alpha India Mission Control
// Sprint 33.4 Phase 4A
// Discovery Queue Dashboard
// =======================================================

import { useEffect, useState } from "react";
import {
  Clock3,
  CheckCircle2,
  Activity,
  Database,
  RefreshCw,
} from "lucide-react";

import { fetchDiscoveryQueueSummary } from "@/lib/monitoringApi";
import type { DiscoveryQueueSummary } from "@/types/monitoring";

export default function DiscoveryQueueDashboard() {
  const [queue, setQueue] = useState<DiscoveryQueueSummary | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadQueue() {
    try {
      const data = await fetchDiscoveryQueueSummary();
      setQueue(data);
    } catch (error) {
      console.error("Discovery Queue:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadQueue();

    const interval = setInterval(loadQueue, 5000);

    return () => clearInterval(interval);
  }, []);

  if (loading || !queue) {
    return (
      <div className="rounded-3xl border border-slate-800 bg-slate-900 p-8 text-center text-slate-400">
        Loading Discovery Queue...
      </div>
    );
  }

  const runningWorkers = queue.running ? queue.running.length : 0;

  const progress =
    queue.total === 0 ? 0 : (queue.completed / queue.total) * 100;

  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-cyan-400">
            Discovery Queue
          </p>

          <h2 className="mt-2 text-2xl font-bold text-white">
            8,588 Company Pipeline
          </h2>

          <p className="mt-1 text-sm text-slate-400">
            Live quarterly filing discovery progress across NSE & BSE.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-full bg-green-500/10 px-3 py-2 text-xs font-semibold text-green-400">
          <RefreshCw className="h-4 w-4" />
          LIVE • 5 SEC
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <QueueCard
          title="Pending Companies"
          value={queue.pending.toLocaleString()}
          icon={<Clock3 className="h-6 w-6 text-orange-400" />}
          valueColor="text-orange-400"
        />

        <QueueCard
          title="Completed Companies"
          value={queue.completed.toLocaleString()}
          icon={<CheckCircle2 className="h-6 w-6 text-green-400" />}
          valueColor="text-green-400"
        />

        <QueueCard
          title="Running Workers"
          value={runningWorkers.toString()}
          icon={<Activity className="h-6 w-6 text-sky-400" />}
          valueColor="text-sky-400"
        />

        <QueueCard
          title="Total Queue"
          value={queue.total.toLocaleString()}
          icon={<Database className="h-6 w-6 text-violet-400" />}
          valueColor="text-violet-400"
        />
      </div>

      {/* Progress */}
      <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-950 p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium text-slate-300">
            Discovery Progress
          </span>

          <span className="text-sm font-bold text-emerald-400">
            {progress.toFixed(2)}%
          </span>
        </div>

        <div className="h-4 overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-700"
            style={{ width: progress + "%" }}
          />
        </div>

        <div className="mt-4 flex justify-between text-xs text-slate-500">
          <span>{queue.completed.toLocaleString()} Completed</span>

          <span>{queue.pending.toLocaleString()} Pending</span>
        </div>
      </div>

      {/* Queue Summary */}
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <SummaryBox
          label="Queue Success"
          value={queue.success ? "ONLINE" : "OFFLINE"}
          color="text-emerald-400"
        />

        <SummaryBox
          label="Completion Ratio"
          value={queue.completed + " / " + queue.total}
          color="text-sky-400"
        />

        <SummaryBox
          label="Pending Remaining"
          value={queue.pending.toLocaleString()}
          color="text-orange-400"
        />
      </div>
    </div>
  );
}

// =======================================================
// Queue KPI Card
// =======================================================

function QueueCard({
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
    <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 transition-all hover:border-slate-700">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wider text-slate-500">
          {title}
        </p>

        {icon}
      </div>

      <p className={`mt-4 text-3xl font-bold ${valueColor}`}>{value}</p>
    </div>
  );
}

// =======================================================
// Summary Box
// =======================================================

function SummaryBox({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
      <p className="text-xs uppercase tracking-wider text-slate-500">
        {label}
      </p>

      <p className={`mt-3 text-lg font-semibold ${color}`}>{value}</p>
    </div>
  );
}
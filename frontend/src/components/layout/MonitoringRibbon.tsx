"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  Clock3,
  RefreshCcw,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

const API_URL = "http://127.0.0.1:8000";

interface Heartbeat {
  engine_status: string;
  current_session: string;
  next_scan_time: string | null;
  last_scan_time: string | null;
  companies_scanned_today: number;
  results_found_today: number;
  parser_failures_today: number;
}

export default function MonitoringRibbon() {
  const [heartbeat, setHeartbeat] = useState<Heartbeat | null>(null);

  async function loadHeartbeat() {
    try {
      const response = await fetch(`${API_URL}/system/heartbeat`, {
        cache: "no-store",
      });

      const data = await response.json();
      setHeartbeat(data);
    } catch (error) {
      console.error("Heartbeat fetch failed", error);
    }
  }

  useEffect(() => {
    loadHeartbeat();

    const timer = setInterval(loadHeartbeat, 10000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (value: string | null) => {
    if (!value) return "--";

    return new Date(value).toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  };

  const sessionColor =
    heartbeat?.current_session === "MARKET"
      ? "text-emerald-400"
      : heartbeat?.current_session === "POST_MARKET"
      ? "text-cyan-400"
      : "text-amber-400";

  return (
    <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 via-slate-900 to-cyan-500/10 p-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="rounded-full bg-emerald-500/20 p-3">
            <Activity className="h-7 w-7 text-emerald-400" />
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">
              Live Monitoring Engine
            </p>

            <h2 className="mt-1 text-xl font-bold text-white">
              {heartbeat?.engine_status ?? "CONNECTING..."}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-full border border-slate-700 bg-slate-900 px-4 py-2">
          <CheckCircle2 className={`h-5 w-5 ${sessionColor}`} />

          <span className={`font-semibold ${sessionColor}`}>
            {heartbeat?.current_session ?? "UNKNOWN"}
          </span>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-4">
        <div className="rounded-xl bg-slate-900/70 p-4">
          <div className="mb-2 flex items-center gap-2 text-slate-400">
            <Clock3 className="h-4 w-4" />
            <span className="text-xs uppercase">Next Scan</span>
          </div>

          <p className="text-lg font-bold text-cyan-400">
            {formatTime(heartbeat?.next_scan_time ?? null)}
          </p>
        </div>

        <div className="rounded-xl bg-slate-900/70 p-4">
          <div className="mb-2 flex items-center gap-2 text-slate-400">
            <RefreshCcw className="h-4 w-4" />
            <span className="text-xs uppercase">Last Scan</span>
          </div>

          <p className="text-lg font-bold text-white">
            {formatTime(heartbeat?.last_scan_time ?? null)}
          </p>
        </div>

        <div className="rounded-xl bg-slate-900/70 p-4">
          <p className="mb-2 text-xs uppercase text-slate-400">
            Companies Scanned Today
          </p>

          <p className="text-2xl font-bold text-emerald-400">
            {heartbeat?.companies_scanned_today ?? 0}
          </p>
        </div>

        <div className="rounded-xl bg-slate-900/70 p-4">
          <p className="mb-2 text-xs uppercase text-slate-400">
            Results Found Today
          </p>

          <p className="text-2xl font-bold text-yellow-400">
            {heartbeat?.results_found_today ?? 0}
          </p>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-slate-800 pt-4 text-sm">
        <div className="flex items-center gap-2 text-slate-400">
          <AlertTriangle className="h-4 w-4 text-red-400" />
          Parser Failures Today:
          <span className="font-bold text-red-400">
            {heartbeat?.parser_failures_today ?? 0}
          </span>
        </div>

        <span className="text-xs text-slate-500">
          Refreshes every 10 seconds
        </span>
      </div>
    </div>
  );
}
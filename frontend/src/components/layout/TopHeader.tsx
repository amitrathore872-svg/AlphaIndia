
"use client";

import { useEffect, useState } from "react";
import { fetchSystemStatus, fetchHeartbeat } from "@/lib/systemApi";

interface HeaderStatus {
  current_session: string;
  monitoring_enabled: boolean;
}

export default function TopHeader() {
  const [status, setStatus] = useState<HeaderStatus | null>(null);
  const [heartbeatTime, setHeartbeatTime] = useState("--:--:--");

  async function loadStatus() {
    try {
      const [systemStatus, heartbeat] = await Promise.all([
        fetchSystemStatus(),
        fetchHeartbeat(),
      ]);

      setStatus({
        current_session: systemStatus.current_session,
        monitoring_enabled: systemStatus.monitoring_enabled,
      });

      if (heartbeat.heartbeat_at) {
        setHeartbeatTime(
          new Date(heartbeat.heartbeat_at).toLocaleTimeString("en-IN")
        );
      }
    } catch (err) {
      console.error("Header status error", err);
    }
  }

  useEffect(() => {
    loadStatus();

    const timer = setInterval(loadStatus, 10000);

    return () => clearInterval(timer);
  }, []);

  const sessionColor =
    status?.current_session === "MARKET"
      ? "bg-green-500"
      : status?.current_session === "POST_MARKET"
      ? "bg-orange-500"
      : "bg-slate-500";

  return (
    <header className="h-20 border-b border-slate-800 bg-slate-950 px-8 flex items-center justify-between">

      {/* LEFT */}
      <div className="flex items-center gap-6 flex-1">

        <div className="relative w-full max-w-xl">

          <input
            type="text"
            placeholder="Search company (Infosys, KPIT, Zomato...)"
            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 text-sm text-white placeholder:text-slate-500 outline-none focus:border-emerald-500"
          />

          <span className="absolute right-4 top-3 text-slate-500">🔍</span>

        </div>

      </div>

      {/* RIGHT */}
      <div className="flex items-center gap-6">

        {/* SESSION */}
        <div className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 border border-slate-800">

          <div className={`h-3 w-3 rounded-full ${sessionColor}`} />

          <span className="text-sm text-white font-medium">
            {status?.current_session ?? "LOADING"}
          </span>

        </div>

        {/* HEARTBEAT */}
        <div className="hidden md:flex flex-col text-right">

          <span className="text-xs text-slate-500">
            Last Heartbeat
          </span>

          <span className="text-sm text-emerald-400 font-semibold">
            {heartbeatTime}
          </span>

        </div>

        {/* NOTIFICATION */}
        <button className="relative rounded-xl bg-slate-900 p-3 hover:bg-slate-800 transition">

          <span className="text-lg">🔔</span>

          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />

        </button>

        {/* USER */}
        <div className="flex items-center gap-3 rounded-xl bg-slate-900 border border-slate-800 px-4 py-2">

          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-black font-bold">
            A
          </div>

          <div className="hidden md:block">
            <p className="text-sm font-semibold text-white">Amit</p>
            <p className="text-xs text-slate-400">Growth Investor</p>
          </div>

        </div>

      </div>

    </header>
  );
}
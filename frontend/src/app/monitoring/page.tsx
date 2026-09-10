"use client";

import { useEffect, useState } from "react";
import {
  fetchSystemStatus,
  fetchSystemSettings,
  fetchHeartbeat,
  updateSystemSetting,
} from "@/lib/systemApi";

import type { SystemStatus, SystemSetting } from "@/types/system";
import type { MonitoringHeartbeat } from "@/types/heartbeat";

export default function MonitoringPage() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [heartbeat, setHeartbeat] = useState<MonitoringHeartbeat | null>(null);
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  async function loadData() {
    try {
      const [statusData, settingsData, heartbeatData] = await Promise.all([
        fetchSystemStatus(),
        fetchSystemSettings(),
        fetchHeartbeat(),
      ]);

      setStatus(statusData);
      setSettings(settingsData);
      setHeartbeat(heartbeatData);
    } catch (err) {
      console.error("Monitoring Center Load Failed", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Auto refresh heartbeat every 10 seconds.
  useEffect(() => {
    const timer = setInterval(() => {
      loadData();
    }, 10000);

    return () => clearInterval(timer);
  }, []);

  async function toggleSetting(setting: SystemSetting) {
    const nextValue =
      setting.setting_value === "true" ? "false" : "true";

    setSavingKey(setting.setting_key);

    try {
      await updateSystemSetting(setting.setting_key, nextValue);
      await loadData();
    } catch (err) {
      console.error(err);
      alert("Unable to update setting.");
    } finally {
      setSavingKey(null);
    }
  }

  async function saveSetting(key: string, value: string) {
    setSavingKey(key);

    try {
      await updateSystemSetting(key, value);
      await loadData();
    } catch (err) {
      console.error(err);
      alert("Unable to save setting.");
    } finally {
      setSavingKey(null);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        Loading Monitoring Center...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-7xl mx-auto space-y-8">

        {/* HEADER */}

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-emerald-400">
              Alpha India Monitoring Center
            </h1>

            <p className="text-slate-400 mt-2">
              Live NSE & BSE Autonomous Monitoring Engine
            </p>
          </div>

          <button
            onClick={loadData}
            className="rounded-xl bg-slate-800 hover:bg-slate-700 px-5 py-3 text-sm"
          >
            Refresh
          </button>
        </div>

        {/* ENGINE HEALTH */}

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">
            Engine Health
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">

            <HealthCard
              title="Engine Status"
              value={heartbeat?.engine_status ?? "Unknown"}
              color="emerald"
            />

            <HealthCard
              title="Current Session"
              value={heartbeat?.current_session ?? "Unknown"}
              color="cyan"
            />

            <HealthCard
              title="Collector"
              value={status?.collector ?? "Idle"}
              color="amber"
            />

            <HealthCard
              title="Version"
              value={status?.version ?? "0.9.1"}
              color="violet"
            />

          </div>
        </section>

        {/* LIVE HEARTBEAT */}

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-5">

          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">
              Live Monitoring Heartbeat
            </h2>

            <span className="text-xs text-emerald-400 animate-pulse">
              ● Auto Refresh Every 10 Seconds
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">

            <StatCard
              title="Last Scan"
              value={
                heartbeat?.last_scan_time
                  ? new Date(heartbeat.last_scan_time).toLocaleTimeString("en-IN")
                  : "--"
              }
            />

            <StatCard
              title="Next Scan"
              value={
                heartbeat?.next_scan_time
                  ? new Date(heartbeat.next_scan_time).toLocaleTimeString("en-IN")
                  : "--"
              }
            />

            <StatCard
              title="Heartbeat"
              value={
                heartbeat?.heartbeat_at
                  ? new Date(heartbeat.heartbeat_at).toLocaleTimeString("en-IN")
                  : "--"
              }
            />

            <StatCard
              title="Engine State"
              value={heartbeat?.engine_status ?? "--"}
            />

          </div>
        </section>

        {/* TODAY'S MONITORING */}

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-5">

          <h2 className="text-2xl font-semibold">
            Today's Monitoring Statistics
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

            <MetricCard
              title="Companies Scanned Today"
              value={heartbeat?.companies_scanned_today ?? 0}
              color="text-cyan-400"
            />

            <MetricCard
              title="Quarterly Results Found"
              value={heartbeat?.results_found_today ?? 0}
              color="text-emerald-400"
            />

            <MetricCard
              title="Parser Failures"
              value={heartbeat?.parser_failures_today ?? 0}
              color="text-red-400"
            />

          </div>
        </section>

        {/* MONITORING SWITCHES */}

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-5">

          <h2 className="text-2xl font-semibold">
            Monitoring Switches
          </h2>

          {settings
            .filter((s) => s.setting_type === "boolean")
            .map((setting) => (

              <div
                key={setting.id}
                className="flex justify-between items-center border-b border-slate-800 py-4"
              >

                <div>
                  <h3 className="capitalize font-medium">
                    {setting.setting_key.replaceAll("_", " ")}
                  </h3>

                  <p className="text-sm text-slate-400">
                    {setting.description}
                  </p>
                </div>

                <button
                  disabled={savingKey === setting.setting_key}
                  onClick={() => toggleSetting(setting)}
                  className={`relative w-16 h-8 rounded-full transition-all duration-300 ${
                    setting.setting_value === "true"
                      ? "bg-emerald-500"
                      : "bg-slate-700"
                  }`}
                >
                  <span
                    className={`absolute top-1 h-6 w-6 rounded-full bg-white transition-all duration-300 ${
                      setting.setting_value === "true"
                        ? "translate-x-8"
                        : "translate-x-1"
                    }`}
                  />
                </button>

              </div>

            ))}
        </section>

        {/* SCHEDULER CONFIGURATION */}

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-5">

          <h2 className="text-2xl font-semibold">
            Scheduler Configuration
          </h2>

          {settings
            .filter((s) => s.setting_type !== "boolean")
            .map((setting) => (
              <SchedulerField
                key={setting.id}
                setting={setting}
                savingKey={savingKey}
                onSave={saveSetting}
              />
            ))}

        </section>

      </div>
    </main>
  );
}

/* -------------------------------------------------------------------- */
/* COMPONENTS */
/* -------------------------------------------------------------------- */

function HealthCard({
  title,
  value,
  color,
}: {
  title: string;
  value: string;
  color: "emerald" | "cyan" | "amber" | "violet";
}) {
  const colors = {
    emerald: "text-emerald-400",
    cyan: "text-cyan-400",
    amber: "text-amber-400",
    violet: "text-violet-400",
  };

  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 p-5">
      <p className="text-sm text-slate-400">{title}</p>

      <h3 className={`mt-3 text-2xl font-bold ${colors[color]}`}>
        {value}
      </h3>
    </div>
  );
}

function StatCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-slate-950 border border-slate-800 p-4">
      <p className="text-xs text-slate-400">{title}</p>

      <h3 className="mt-3 text-lg font-semibold text-white">
        {value}
      </h3>
    </div>
  );
}

function MetricCard({
  title,
  value,
  color,
}: {
  title: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-xl bg-slate-950 border border-slate-800 p-5">
      <p className="text-sm text-slate-400">{title}</p>

      <h2 className={`mt-3 text-4xl font-bold ${color}`}>
        {value}
      </h2>
    </div>
  );
}

interface SchedulerFieldProps {
  setting: SystemSetting;
  savingKey: string | null;
  onSave: (key: string, value: string) => Promise<void>;
}

function SchedulerField({
  setting,
  savingKey,
  onSave,
}: SchedulerFieldProps) {
  const [value, setValue] = useState(setting.setting_value);

  useEffect(() => {
    setValue(setting.setting_value);
  }, [setting.setting_value]);

  const intervalOptions = ["1", "2", "5", "10", "15", "30", "60"];

  return (
    <div className="flex justify-between items-center border-b border-slate-800 py-4">

      <div>
        <h3 className="capitalize font-medium">
          {setting.setting_key.replaceAll("_", " ")}
        </h3>

        <p className="text-sm text-slate-400">
          {setting.description}
        </p>
      </div>

      <div className="flex items-center gap-3">

        {setting.setting_type === "integer" ? (
          <select
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white"
          >
            {intervalOptions.map((option) => (
              <option key={option} value={option}>
                {option} Minutes
              </option>
            ))}
          </select>
        ) : (
          <input
            type="time"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white"
          />
        )}

        <button
          disabled={savingKey === setting.setting_key}
          onClick={() => onSave(setting.setting_key, value)}
          className="rounded-lg bg-emerald-500 hover:bg-emerald-600 px-4 py-2 text-black font-semibold disabled:opacity-50"
        >
          {savingKey === setting.setting_key ? "Saving..." : "Save"}
        </button>

      </div>

    </div>
  );
}
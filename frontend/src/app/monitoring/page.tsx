"use client";

import { useEffect, useState } from "react";
import {
  fetchSystemSettings,
  fetchSystemStatus,
  updateSystemSetting,
} from "@/lib/systemApi";
import type { SystemSetting, SystemStatus } from "@/types/system";

export default function MonitoringPage() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const [statusData, settingsData] = await Promise.all([
        fetchSystemStatus(),
        fetchSystemSettings(),
      ]);

      setStatus(statusData);
      setSettings(settingsData);
    } catch (err) {
      console.error("Monitoring load failed", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function toggleSetting(setting: SystemSetting) {
    setSavingKey(setting.setting_key);

    const nextValue =
      setting.setting_value === "true" ? "false" : "true";

    try {
      await updateSystemSetting(setting.setting_key, nextValue);
      await loadData();
    } finally {
      setSavingKey(null);
    }
  }

  async function saveSetting(key: string, value: string) {
    setSavingKey(key);

    try {
      await updateSystemSetting(key, value);
      await loadData();
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

        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-emerald-400">
              Alpha India Monitoring Center
            </h1>
            <p className="text-slate-400 mt-2">
              Live NSE & BSE Monitoring Engine Configuration
            </p>
          </div>

          <button
            onClick={loadData}
            className="rounded-xl bg-slate-800 hover:bg-slate-700 px-5 py-3 text-sm"
          >
            Refresh Status
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          <StatusCard title="Engine Status" value={status?.status ?? "Unknown"} color="emerald" />
          <StatusCard title="Current Session" value={status?.current_session ?? "Unknown"} color="cyan" />
          <StatusCard title="Collector" value={status?.collector ?? "Unknown"} color="amber" />
          <StatusCard title="Version" value={status?.version ?? "Unknown"} color="violet" />
        </div>

        {/* Engine Summary */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
          <h2 className="text-2xl font-semibold">Engine Summary</h2>

          <InfoRow
            label="Monitoring Enabled"
            value={status?.monitoring_enabled ? "YES" : "NO"}
          />

          <InfoRow
            label="Market Polling Interval"
            value={`${status?.market_interval_minutes} Minutes`}
          />

          <InfoRow
            label="Post Market Polling Interval"
            value={`${status?.post_market_interval_minutes} Minutes`}
          />

          <InfoRow
            label="Last Heartbeat"
            value={new Date(status?.timestamp ?? "").toLocaleString("en-IN")}
          />
        </section>

        {/* Boolean Switches */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-5">
          <h2 className="text-2xl font-semibold text-white">
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
                  <h3 className="capitalize font-medium text-white">
                    {setting.setting_key.replaceAll("_", " ")}
                  </h3>
                  <p className="text-sm text-slate-400">
                    {setting.description}
                  </p>
                </div>

                <button
                  disabled={savingKey === setting.setting_key}
                  onClick={() => toggleSetting(setting)}
                  className={`relative h-8 w-16 rounded-full transition-all ${
                    setting.setting_value === "true"
                      ? "bg-emerald-500"
                      : "bg-slate-700"
                  }`}
                >
                  <span
                    className={`absolute top-1 h-6 w-6 rounded-full bg-white transition-all ${
                      setting.setting_value === "true"
                        ? "translate-x-8"
                        : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            ))}
        </section>

        {/* Scheduler Configuration */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-5">
          <h2 className="text-2xl font-semibold text-white">
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

/* ---------------- Status Card ---------------- */

interface StatusCardProps {
  title: string;
  value: string;
  color: "emerald" | "cyan" | "amber" | "violet";
}

function StatusCard({ title, value, color }: StatusCardProps) {
  const colors = {
    emerald: "text-emerald-400",
    cyan: "text-cyan-400",
    amber: "text-amber-400",
    violet: "text-violet-400",
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 hover:border-slate-700 transition-colors">
      <p className="text-sm text-slate-400">{title}</p>
      <h3 className={`mt-3 text-2xl font-bold ${colors[color]}`}>
        {value}
      </h3>
    </div>
  );
}

/* ---------------- Info Row ---------------- */

interface InfoRowProps {
  label: string;
  value: string;
}

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div className="flex justify-between items-center border-b border-slate-800 py-3">
      <span className="text-slate-400">{label}</span>
      <span className="font-semibold text-white">{value}</span>
    </div>
  );
}

/* ---------------- Scheduler Field ---------------- */

interface SchedulerFieldProps {
  setting: SystemSetting;
  savingKey: string | null;
  onSave: (key: string, value: string) => Promise<void>;
}

function SchedulerField({ setting, savingKey, onSave }: SchedulerFieldProps) {
  const [value, setValue] = useState(setting.setting_value);

  useEffect(() => {
    setValue(setting.setting_value);
  }, [setting.setting_value]);

  const intervalOptions = ["1", "2", "5", "10", "15", "30", "60"];

  return (
    <div className="flex justify-between items-center border-b border-slate-800 py-4">
      <div>
        <h3 className="capitalize font-medium text-white">
          {setting.setting_key.replaceAll("_", " ")}
        </h3>
        <p className="text-sm text-slate-400">{setting.description}</p>
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
{"use client";

import { useEffect, useState } from "react";

import ImportKPICards from "@/components/dashboard/ImportKPICards";

import {
  fetchImportDashboardSummary,
  ImportDashboardSummary,
} from "@/lib/importDashboardApi";

export default function DashboardPage() {
  const [summary, setSummary] =
    useState<ImportDashboardSummary | null>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);

    try {
      const data = await fetchImportDashboardSummary();
      setSummary(data);
    } catch (error) {
      console.error("Failed to load dashboard summary:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#050B14] text-white">
      <div className="mx-auto max-w-7xl px-6 py-8">

        {/* ------------------------------------------------ */}
        {/* HEADER */}
        {/* ------------------------------------------------ */}

        <div className="mb-8">
          <p className="text-sm uppercase tracking-[0.3em] text-emerald-400">
            ALPHA INDIA • MISSION CONTROL
          </p>

          <h1 className="mt-3 text-4xl font-bold">
            Historical Import Dashboard
          </h1>

          <p className="mt-2 text-slate-400">
            Monitor the progress of importing 5 years of historical
            financial data across all NSE & BSE listed companies.
          </p>
        </div>

        {/* ------------------------------------------------ */}
        {/* LIVE KPI CARDS */}
        {/* ------------------------------------------------ */}

        <ImportKPICards
          summary={summary}
          loading={loading}
        />

        {/* ------------------------------------------------ */}
        {/* IMPORT PROGRESS */}
        {/* ------------------------------------------------ */}

        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">

          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              Historical Bootstrap Progress
            </h2>

            <span className="rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-300">
              {loading
                ? "Loading..."
                : `${summary?.progress_percent ?? 0}% Complete`}
            </span>
          </div>

          <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-800">

            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-700"
              style={{
                width: `${summary?.progress_percent ?? 0}%`,
              }}
            />

          </div>

          <div className="mt-3 flex justify-between text-sm text-slate-400">
            <span>
              {loading
                ? "Loading..."
                : `${summary?.imported_companies ?? 0} Companies Imported`}
            </span>

            <span>
              {loading
                ? "Loading..."
                : `${(summary?.total_companies ?? 0) -
                    (summary?.imported_companies ?? 0)} Remaining`}
            </span>
          </div>
        </section>

        {/* ------------------------------------------------ */}
        {/* IMPORT QUEUE (Placeholder for next sprint) */}
        {/* ------------------------------------------------ */}

        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">

          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              Import Queue
            </h2>

            <span className="rounded-full bg-yellow-500/20 px-3 py-1 text-xs text-yellow-300">
              LIVE DATABASE
            </span>
          </div>

          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-800 text-slate-400">
              <tr>
                <th className="pb-3">Company</th>
                <th className="pb-3">Period</th>
                <th className="pb-3">Download</th>
                <th className="pb-3">Parser</th>
              </tr>
            </thead>

            <tbody>

              <tr className="border-b border-slate-900">
                <td className="py-4">
                  The Karnataka Bank Limited
                </td>

                <td className="py-4 text-slate-300">
                  Q1 FY27
                </td>

                <td className="py-4">
                  <span className="rounded-full bg-yellow-500/20 px-2 py-1 text-xs text-yellow-300">
                    PENDING
                  </span>
                </td>

                <td className="py-4">
                  <span className="rounded-full bg-slate-700 px-2 py-1 text-xs text-slate-300">
                    WAITING
                  </span>
                </td>
              </tr>

              <tr className="border-b border-slate-900">
                <td className="py-4">
                  The Karnataka Bank Limited
                </td>

                <td className="py-4 text-slate-300">
                  Q4 FY26
                </td>

                <td className="py-4">
                  <span className="rounded-full bg-yellow-500/20 px-2 py-1 text-xs text-yellow-300">
                    PENDING
                  </span>
                </td>

                <td className="py-4">
                  <span className="rounded-full bg-slate-700 px-2 py-1 text-xs text-slate-300">
                    WAITING
                  </span>
                </td>
              </tr>

              <tr>
                <td className="py-4">
                  The Karnataka Bank Limited
                </td>

                <td className="py-4 text-slate-300">
                  FY26 Annual
                </td>

                <td className="py-4">
                  <span className="rounded-full bg-yellow-500/20 px-2 py-1 text-xs text-yellow-300">
                    PENDING
                  </span>
                </td>

                <td className="py-4">
                  <span className="rounded-full bg-slate-700 px-2 py-1 text-xs text-slate-300">
                    WAITING
                  </span>
                </td>
              </tr>

            </tbody>
          </table>
        </section>

        {/* ------------------------------------------------ */}
        {/* IMPORT CONTROLS */}
        {/* ------------------------------------------------ */}

        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">

          <h2 className="mb-5 text-xl font-semibold">
            Import Controls
          </h2>

          <div className="flex flex-wrap gap-4">

            <button className="rounded-xl bg-emerald-600 px-5 py-3 font-semibold transition hover:bg-emerald-700">
              ▶ Start Historical Import
            </button>

            <button className="rounded-xl border border-slate-700 px-5 py-3 font-semibold transition hover:bg-slate-800">
              ⏸ Pause Import
            </button>

            <button className="rounded-xl border border-slate-700 px-5 py-3 font-semibold transition hover:bg-slate-800">
              🔄 Resume Import
            </button>

          </div>

        </section>

      </div>
    </main>
  );
}
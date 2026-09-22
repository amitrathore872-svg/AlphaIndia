"use client";

// =========================================================================
// Alpha India — High-Level Scanner Streams Mockup Review Page
// Route: /mockup-streams
// Institutional 3x3 Radar Grid mapped to Alpha India Modules
// =========================================================================

import React, { useState } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/layout/DashboardLayout";
import StreamOverviewGrid, {
  DEFAULT_ALPHA_INDIA_STREAMS,
} from "@/components/home/StreamOverviewGrid";
import {
  Sparkles,
  ArrowLeft,
  LayoutDashboard,
  CheckCircle2,
  ExternalLink,
  Eye,
  Sun,
  Moon,
} from "lucide-react";

export default function MockupStreamsPage() {
  const [themeMode, setThemeMode] = useState<"institutional-dark" | "reference-light">(
    "institutional-dark"
  );

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-20">
        {/* Top Review Bar & Action Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 p-4 text-white shadow-lg">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/40">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black tracking-tight text-white">
                  Mockup Review: High-Level Stream Overview Grid
                </h1>
                <span className="rounded bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-black text-emerald-300">
                  Sprint 35.4 Design
                </span>
              </div>
              <p className="text-xs text-slate-300">
                Format reference faithfully replicated & mapped strictly to 9 Alpha India modules.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Theme Canvas Preview Switcher */}
            <div className="flex items-center rounded-xl border border-slate-700 bg-slate-800/80 p-1 text-xs">
              <button
                onClick={() => setThemeMode("institutional-dark")}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-bold transition ${
                  themeMode === "institutional-dark"
                    ? "bg-cyan-500 text-slate-950 shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Moon className="h-3.5 w-3.5" /> Dark Terminal
              </button>
              <button
                onClick={() => setThemeMode("reference-light")}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-bold transition ${
                  themeMode === "reference-light"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Sun className="h-3.5 w-3.5" /> Reference Light Tint
              </button>
            </div>

            <Link
              href="/home"
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700 transition"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Home
            </Link>
          </div>
        </div>

        {/* Dynamic Canvas Wrapper supporting both Dark Terminal & Reference Light Tint */}
        <div
          className={`rounded-3xl p-4 sm:p-6 lg:p-8 transition-all duration-300 border ${
            themeMode === "reference-light"
              ? "bg-gradient-to-b from-[#EFF3FF] via-[#F4F6FD] to-[#E9EEF9] border-indigo-200/80 shadow-inner"
              : "bg-gradient-to-b from-[#060F1E] via-[#050B14] to-[#03070D] border-slate-800 shadow-2xl"
          }`}
        >
          {/* Stream Overview Grid Component */}
          <StreamOverviewGrid />
        </div>

        {/* Engineering & Module Mapping Summary Card */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#071322] p-5 shadow-sm">
          <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            9 Alpha India Modules Mapping Specifications
          </h2>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            {DEFAULT_ALPHA_INDIA_STREAMS.map((st, i) => (
              <div
                key={st.id}
                className="rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-900/50 p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-900 dark:text-white">
                    {i + 1}. {st.title}
                  </span>
                  <Link
                    href={st.viewHref}
                    className="text-[11px] font-bold text-indigo-500 hover:underline flex items-center gap-0.5"
                  >
                    {st.viewHref} <ExternalLink className="h-2.5 w-2.5" />
                  </Link>
                </div>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  {st.subtitle}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  {st.items.map((it) => (
                    <span
                      key={it.primary}
                      className="rounded bg-slate-200/70 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono font-bold text-slate-700 dark:text-slate-300"
                    >
                      {it.primary}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

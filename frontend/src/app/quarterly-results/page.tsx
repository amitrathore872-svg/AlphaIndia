"use client";

// =======================================================
// Alpha India — Exchange Quarterly Results & PEAD Terminal
// Unified Institutional Terminal Wrapper
// =======================================================

import Link from "next/link";
import { Zap, ArrowRight, Activity } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PeadDriftMatrix from "@/components/layout/earnings/PeadDriftMatrix";

export default function QuarterlyResultsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Unified Terminal Navigation Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-2xl border border-slate-200/80 bg-white/70 dark:border-slate-800 dark:bg-[#07111F]/90 shadow-sm backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 ring-1 ring-cyan-500/20">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold font-mono tracking-tight text-slate-900 dark:text-white">
                  Quarterly Results & PEAD Drift Radar
                </h1>
                <span className="px-2 py-0.5 text-[10px] font-bold font-mono uppercase rounded-full bg-cyan-100 dark:bg-cyan-950/80 border border-cyan-500/30 text-cyan-700 dark:text-cyan-400">
                  Athena Omega Drift Engine
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Real-time exchange earnings filings, surprise beats, operating leverage expansion, and pre-announcement momentum.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/athena-omega"
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs font-mono uppercase transition-all shadow-md shadow-cyan-950/40 cursor-pointer"
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Athena Conviction Terminal</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Embedded PEAD Quantitative Matrix */}
        <PeadDriftMatrix />
      </div>
    </DashboardLayout>
  );
}

"use client";

// =======================================================
// Alpha India — Exchange Quarterly Results & PEAD Terminal
// Unified Institutional Terminal Wrapper
// =======================================================

import Link from "next/link";
import { Zap, ArrowRight } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PeadDriftMatrix from "@/components/layout/earnings/PeadDriftMatrix";

export default function QuarterlyResultsPage() {
  return (
    <DashboardLayout>
      <div className="min-h-screen bg-[#050B14] text-slate-100 p-4 md:p-6 space-y-5">
        {/* Unified Terminal Navigation Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-cyan-950/40 via-slate-900/60 to-slate-950 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black font-mono text-white">
                  PEAD Quantitative Drift Matrix
                </h1>
                <span className="px-2 py-0.5 text-[10px] font-bold font-mono uppercase rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-400">
                  Unified Terminal
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Integrated with the Athena Omega v3.0 Earnings Intelligence Engine.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/athena-omega"
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs font-mono uppercase transition-all shadow-md shadow-cyan-950/40"
            >
              <span>Switch to FLASH Conviction</span>
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

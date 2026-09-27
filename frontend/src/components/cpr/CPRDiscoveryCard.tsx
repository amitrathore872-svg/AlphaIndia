"use client";

import React from "react";
import {
  Layers,
  Sparkles,
  Zap,
  TrendingUp,
  Activity,
  RefreshCw,
  Bell,
  ArrowUpRight,
} from "lucide-react";
import type { CPRDiscoverySummary } from "@/lib/cprApi";

interface CPRDiscoveryCardProps {
  summary: CPRDiscoverySummary | null;
  scanning: boolean;
  onTriggerScan: () => void;
  onSelectStock: (symbol: string) => void;
}

export default function CPRDiscoveryCard({
  summary,
  scanning,
  onTriggerScan,
  onSelectStock,
}: CPRDiscoveryCardProps) {
  const topStock = summary?.top_compression_stock;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-cyan-500/20 bg-gradient-to-r from-[#061224] via-[#050D1B] to-[#040812] p-5 shadow-xl backdrop-blur-md">
      {/* Background glow accent */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Left: Engine Identity */}
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-mono font-bold tracking-widest text-cyan-400 uppercase">
              Discovery Engine #11
            </span>
            <span className="rounded bg-cyan-500/15 px-2 py-0.5 text-[10px] font-mono font-bold text-cyan-300 border border-cyan-500/30">
              Narrow CPR Compression Scanner
            </span>
          </div>
          <h1 className="mt-1 text-2xl font-black font-mono tracking-tight text-white flex items-center gap-2">
            Institutional CPR Radar
          </h1>
          <p className="text-xs text-slate-400 max-w-xl">
            Detects equities whose next trading day Pivot, BC, and TC converge into a single ultra-tight band.
            Identifies extreme volatility compression primed for directional breakout.
          </p>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={onTriggerScan}
            disabled={scanning}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-500 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-cyan-900/30 hover:from-cyan-500 hover:to-cyan-400 active:scale-95 disabled:opacity-50 transition"
          >
            <RefreshCw className={`h-4 w-4 ${scanning ? "animate-spin" : ""}`} />
            {scanning ? "Scanning Universe..." : "Run CPR Scan"}
          </button>
        </div>
      </div>

      {/* KPI Counters Grid */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 border-t border-slate-800/80 pt-4">
        {/* 1. Stocks Scanned */}
        <div className="rounded-xl border border-slate-800/60 bg-slate-900/40 p-3">
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">
            Stocks Scanned
          </span>
          <span className="text-xl font-mono font-black text-white">
            {summary?.stocks_scanned?.toLocaleString() || "3,490"}
          </span>
          <span className="text-[10px] text-slate-500 block">Full NSE Universe</span>
        </div>

        {/* 2. Ultra Compression */}
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3">
          <span className="text-[10px] uppercase font-bold tracking-wider text-cyan-400 block">
            Ultra Compression (&lt;0.1%)
          </span>
          <span className="text-xl font-mono font-black text-cyan-300">
            {summary?.ultra_compression_stocks || 0}
          </span>
          <span className="text-[10px] text-cyan-400/80 block">Single-Line Coil</span>
        </div>

        {/* 3. Very Strong */}
        <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-3">
          <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-400 block">
            Very Strong (0.1–0.2%)
          </span>
          <span className="text-xl font-mono font-black text-indigo-300">
            {summary?.very_strong_stocks || 0}
          </span>
          <span className="text-[10px] text-indigo-400/80 block">High Conviction</span>
        </div>

        {/* 4. Triple CPR Confluence */}
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
          <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400 block">
            Triple CPR
          </span>
          <span className="text-xl font-mono font-black text-amber-300 flex items-center gap-1">
            <Sparkles className="h-4 w-4" /> {summary?.triple_cpr_stocks || 0}
          </span>
          <span className="text-[10px] text-amber-400/80 block">Daily + W + M Coil</span>
        </div>

        {/* 5. Alerts Triggered */}
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3">
          <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 block">
            Breakouts Today
          </span>
          <span className="text-xl font-mono font-black text-emerald-300 flex items-center gap-1">
            <Zap className="h-4 w-4" /> {summary?.breakout_today || summary?.alerts_triggered_count || 0}
          </span>
          <span className="text-[10px] text-emerald-400/80 block">Live TC Crosses</span>
        </div>

        {/* 6. Top Compression Stock */}
        <div
          onClick={() => topStock && onSelectStock(topStock.symbol)}
          className={`rounded-xl border border-cyan-500/40 bg-gradient-to-br from-cyan-950/40 to-slate-900/60 p-3 cursor-pointer transition hover:border-cyan-400 ${
            topStock ? "" : "pointer-events-none"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider text-cyan-400">
              #1 Compression
            </span>
            <ArrowUpRight className="h-3.5 w-3.5 text-cyan-400" />
          </div>
          <span className="text-lg font-mono font-black text-white block truncate">
            {topStock?.symbol || "—"}
          </span>
          <span className="text-[10px] font-mono text-cyan-300 block">
            Width: {topStock?.cpr_width_pct !== undefined ? `${topStock.cpr_width_pct.toFixed(3)}%` : "0.00%"}
          </span>
        </div>
      </div>
    </div>
  );
}

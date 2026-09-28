"use client";

import React from "react";
import {
  Activity,
  Zap,
  Radio,
  Clock,
  CheckCircle2,
  AlertCircle,
  Play,
  Square,
  RefreshCw,
  Gauge,
  Cpu,
  Layers,
  Sparkles,
  EyeOff,
} from "lucide-react";
import { type VCPProgressTelemetry } from "@/lib/vcpApi";

interface VCPProgressRibbonProps {
  telemetry: VCPProgressTelemetry | null;
  onScanNow: () => void;
  onToggleContinuous: () => void;
  onHide?: () => void;
  isActionLoading?: boolean;
}

const defaultTelemetry: VCPProgressTelemetry = {
  status: "IDLE",
  mode: "ON_DEMAND",
  is_continuous_active: false,
  total_stocks: 120,
  stocks_scanned: 0,
  remaining_stocks: 120,
  progress_pct: 0,
  opportunities_found: 0,
  cached_skipped_count: 0,
  scan_duration_seconds: 0.0,
  throughput_stocks_per_sec: 0.0,
  current_symbol: null,
  latest_picks: [],
  last_updated_timestamp: null,
  error_message: null,
};

export default function VCPProgressRibbon({
  telemetry,
  onScanNow,
  onToggleContinuous,
  onHide,
  isActionLoading = false,
}: VCPProgressRibbonProps) {
  const data = telemetry || defaultTelemetry;

  const isRunning = data.status === "RUNNING";
  const isContinuous = data.is_continuous_active;
  const progressPct = data.progress_pct || 0;

  return (
    <div className="relative rounded-xl border border-cyan-500/25 bg-white dark:bg-[#040A14]/95 p-3 sm:p-3.5 shadow-xs dark:shadow-xl backdrop-blur-md overflow-hidden space-y-2.5">
      {/* Background ambient radar glow */}
      {isContinuous && (
        <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
      )}

      {/* Header bar: Mode indicator & Quick action buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center border shrink-0 ${
              isContinuous
                ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                : isRunning
                ? "bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border-cyan-500/40 animate-pulse"
                : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700"
            }`}
          >
            {isContinuous ? (
              <Radio className="w-3.5 h-3.5 animate-spin text-emerald-500" />
            ) : isRunning ? (
              <Activity className="w-3.5 h-3.5 animate-bounce text-cyan-500" />
            ) : (
              <Zap className="w-3.5 h-3.5 text-slate-400" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 font-mono">
                Scanner Engine:
              </span>
              {isContinuous ? (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold font-mono bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 flex items-center gap-1 shadow-[0_0_8px_rgba(16,185,129,0.2)]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  LIVE CONTINUOUS MONITORING
                </span>
              ) : isRunning ? (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold font-mono bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/40 flex items-center gap-1">
                  <RefreshCw className="w-2.5 h-2.5 animate-spin text-cyan-500" />
                  ON-DEMAND SCAN RUNNING
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold font-mono bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  READY / ARMED
                </span>
              )}
            </div>

            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
              {isRunning && data.current_symbol ? (
                <span>
                  Analyzing ticker:{" "}
                  <strong className="text-cyan-700 dark:text-cyan-400 font-bold">{data.current_symbol}</strong>
                </span>
              ) : isContinuous ? (
                <span className="text-emerald-700 dark:text-emerald-400/90">
                  Continuous tick monitor running • Analyzing volume surges & candles
                </span>
              ) : (
                <span>Incremental cache primed • Unchanged stocks skipped automatically</span>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls Suite */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onScanNow}
            disabled={isRunning || isActionLoading}
            className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold font-mono tracking-wide bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 flex items-center gap-1.5 transition-all shadow-[0_0_12px_rgba(6,182,212,0.25)] disabled:opacity-50 active:scale-95 cursor-pointer"
          >
            <Play className={`w-2.5 h-2.5 fill-current ${isRunning ? "animate-pulse" : ""}`} />
            {isRunning ? "Scanning..." : "Scan Now (On-Demand)"}
          </button>

          <button
            onClick={onToggleContinuous}
            disabled={isActionLoading}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold font-mono tracking-wide border transition-all flex items-center gap-1.5 active:scale-95 cursor-pointer ${
              isContinuous
                ? "bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/40 hover:bg-rose-500/30"
                : "bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:border-cyan-500/50"
            }`}
          >
            {isContinuous ? (
              <>
                <Square className="w-2.5 h-2.5 fill-current text-rose-500" />
                Stop Monitoring
              </>
            ) : (
              <>
                <Radio className="w-2.5 h-2.5 text-cyan-600 dark:text-cyan-400" />
                Live Monitoring Mode
              </>
            )}
          </button>

          {onHide && (
            <button
              onClick={onHide}
              title="Hide Scanner Engine (can be re-opened from header)"
              className="px-2 py-1.5 rounded-lg text-[11px] font-mono text-slate-400 hover:text-slate-200 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 hover:border-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <EyeOff className="w-3 h-3 text-slate-400" />
              <span>Hide</span>
            </button>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] font-mono">
          <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Cpu className="w-2.5 h-2.5 text-cyan-600 dark:text-cyan-400" />
            Parallel Worker Pool Progress
          </span>
          <span className="text-cyan-700 dark:text-cyan-400 font-bold">
            {progressPct}% ({data.stocks_scanned}/{data.total_stocks})
          </span>
        </div>

        <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden border border-slate-200 dark:border-slate-800">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              isContinuous
                ? "bg-gradient-to-r from-emerald-500 via-cyan-400 to-amber-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
                : "bg-gradient-to-r from-cyan-500 to-emerald-400 shadow-[0_0_8px_rgba(6,182,212,0.5)]"
            }`}
            style={{ width: `${Math.max(3, Math.min(100, progressPct))}%` }}
          />
        </div>
      </div>

      {/* Telemetry Metric Chips Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 font-mono text-xs">
        <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/80 px-2.5 py-1.5 rounded-lg flex items-center justify-between lg:block">
          <span className="text-slate-500 dark:text-slate-400 text-[9px] block uppercase font-bold">Scanned / Total</span>
          <span className="text-slate-900 dark:text-white font-bold text-xs mt-0.5 block">
            {data.stocks_scanned} / {data.total_stocks}
          </span>
        </div>

        <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/80 px-2.5 py-1.5 rounded-lg flex items-center justify-between lg:block">
          <span className="text-slate-500 dark:text-slate-400 text-[9px] block uppercase font-bold">Remaining</span>
          <span className="text-amber-700 dark:text-amber-400 font-bold text-xs mt-0.5 block">
            {data.remaining_stocks} stocks
          </span>
        </div>

        <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/80 px-2.5 py-1.5 rounded-lg flex items-center justify-between lg:block">
          <span className="text-slate-500 dark:text-slate-400 text-[9px] block uppercase font-bold flex items-center gap-1">
            <Clock className="w-2.5 h-2.5 text-slate-400" />
            Scan Duration
          </span>
          <span className="text-slate-900 dark:text-white font-bold text-xs mt-0.5 block">
            {data.scan_duration_seconds.toFixed(1)}s
          </span>
        </div>

        <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/80 px-2.5 py-1.5 rounded-lg flex items-center justify-between lg:block">
          <span className="text-slate-500 dark:text-slate-400 text-[9px] block uppercase font-bold flex items-center gap-1">
            <Gauge className="w-2.5 h-2.5 text-cyan-600 dark:text-cyan-400" />
            Throughput
          </span>
          <span className="text-cyan-700 dark:text-cyan-300 font-bold text-xs mt-0.5 block">
            {data.throughput_stocks_per_sec} /sec
          </span>
        </div>

        <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/80 px-2.5 py-1.5 rounded-lg flex items-center justify-between lg:block">
          <span className="text-slate-500 dark:text-slate-400 text-[9px] block uppercase font-bold flex items-center gap-1">
            <Sparkles className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
            Opportunities
          </span>
          <span className="text-emerald-700 dark:text-emerald-400 font-bold text-xs mt-0.5 block">
            {data.opportunities_found} Setups
          </span>
        </div>

        <div className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/80 px-2.5 py-1.5 rounded-lg flex items-center justify-between lg:block">
          <span className="text-slate-500 dark:text-slate-400 text-[9px] block uppercase font-bold flex items-center gap-1">
            <Layers className="w-2.5 h-2.5 text-violet-600 dark:text-violet-400" />
            Cache
          </span>
          <span className="text-violet-700 dark:text-violet-300 font-bold text-xs mt-0.5 block">
            {data.cached_skipped_count} Skipped
          </span>
        </div>
      </div>
    </div>
  );
}

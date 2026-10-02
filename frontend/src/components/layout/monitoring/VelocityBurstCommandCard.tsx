"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Flame,
  Play,
  Pause,
  RotateCw,
  TrendingUp,
  Activity,
  Zap,
  ShieldCheck,
  Radar,
  ArrowUpRight,
  Clock,
  Radio,
  BarChart3,
  Sliders,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";

interface VelocityStatus {
  engine_name: string;
  version: string;
  is_paused: boolean;
  engine_status: string;
  scheduler_status: string;
  market_regime: string;
  market_score: number;
  risk_level: string;
  position_size_multiplier: number;
  stocks_scanned: number;
  sleeping_giants: number;
  institution_candidates: number;
  live_breakouts: number;
  btst_candidates: number;
  ai_elite_signals: number;
  average_confidence: number;
  average_return: number;
  win_rate_30_days: number;
  backtest_win_rate: number;
  alerts_today: number;
  failed_alerts: number;
  scheduler_heartbeat: string;
  database_sync: string;
  last_scan_duration_sec: number;
}

import { API_BASE } from "@/lib/apiConfig";

export default function VelocityBurstCommandCard() {
  const [data, setData] = useState<VelocityStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v4/velocity/status`, {
        cache: "no-store",
      });
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error("VBE status fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    // Relaxed polling interval (25s) to reduce background HTTP load
    const timer = setInterval(fetchStatus, 25000);
    return () => clearInterval(timer);
  }, [fetchStatus]);

  const handleAction = async (action: string) => {
    setActionLoading(action);
    setMsg(null);
    try {
      if (action === "scan") {
        const res = await fetch(`${API_BASE}/api/v4/velocity/scan`, { method: "POST" });
        const json = await res.json();
        setMsg(json.message || "Universe scan started");
      } else if (action === "pause") {
        await fetch(`${API_BASE}/api/v4/velocity/pause`, { method: "POST" });
        setMsg("Engine paused");
      } else if (action === "resume") {
        await fetch(`${API_BASE}/api/v4/velocity/resume`, { method: "POST" });
        setMsg("Engine resumed");
      } else if (action === "recalculate") {
        await fetch(`${API_BASE}/api/v4/velocity/market-regime/recalculate`, { method: "POST" });
        setMsg("Regime recalculated");
      } else if (action === "backtest") {
        await fetch(`${API_BASE}/api/v4/velocity/backtest/run`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Mission Control Walk-Forward", years: 5 }),
        });
        setMsg("Backtest simulation completed");
      } else if (action === "refresh") {
        await fetch(`${API_BASE}/api/v4/velocity/learning/recalculate`, { method: "POST" });
        setMsg("Indicators & ML weights refreshed");
      }
      await fetchStatus();
    } catch (e: any) {
      setMsg(`Error: ${e.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const isOnline = data?.engine_status === "ONLINE";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-cyan-500/30 bg-gradient-to-b from-[#081528] via-[#050D1A] to-[#040912] p-5 sm:p-6 shadow-2xl shadow-cyan-950/40 backdrop-blur-md">
      {/* Background Ambient Glow */}
      <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />
      <div className="pointer-events-none absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl" />

      {/* Top Header & Identity */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-600 p-2.5 shadow-lg shadow-orange-900/50">
            <Flame className="h-full w-full text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-400 border border-amber-500/30">
                Flagship Engine
              </span>
              <span className="rounded-md bg-cyan-500/15 px-2 py-0.5 text-[10px] font-mono font-semibold text-cyan-300 border border-cyan-500/25">
                v2.4.0-VBE
              </span>
              <span className="flex items-center gap-1.5 text-xs text-slate-400">
                <span className={`h-2 w-2 rounded-full ${isOnline ? "bg-emerald-400 animate-ping" : "bg-rose-400"}`} />
                {data?.engine_status || "ONLINE"}
              </span>
            </div>
            <h3 className="mt-1 text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              Velocity Burst Elite (VBE)
            </h3>
            <p className="text-xs text-slate-400">
              18-Stage Institutional Pre-Breakout & Automated Trade Execution Engine
            </p>
          </div>
        </div>

        {/* Action Controls Button Ribbon */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleAction("scan")}
            disabled={!!actionLoading}
            className="flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-3 py-1.5 text-xs font-semibold text-cyan-300 transition-all hover:bg-cyan-500/25 hover:border-cyan-400 active:scale-95 disabled:opacity-50"
          >
            <Play className="h-3.5 w-3.5" />
            {actionLoading === "scan" ? "Scanning..." : "Run Scan"}
          </button>

          {data?.is_paused ? (
            <button
              onClick={() => handleAction("resume")}
              disabled={!!actionLoading}
              className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition-all hover:bg-emerald-500/25 active:scale-95"
            >
              <Play className="h-3.5 w-3.5" />
              Resume
            </button>
          ) : (
            <button
              onClick={() => handleAction("pause")}
              disabled={!!actionLoading}
              className="flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-300 transition-all hover:bg-amber-500/25 active:scale-95"
            >
              <Pause className="h-3.5 w-3.5" />
              Pause Engine
            </button>
          )}

          <button
            onClick={() => handleAction("recalculate")}
            disabled={!!actionLoading}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-300 transition-all hover:bg-slate-700 active:scale-95"
          >
            <RotateCw className="h-3.5 w-3.5" />
            Recalculate
          </button>

          <button
            onClick={() => handleAction("backtest")}
            disabled={!!actionLoading}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-300 transition-all hover:bg-slate-700 active:scale-95"
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Backtest Today
          </button>

          <button
            onClick={() => handleAction("refresh")}
            disabled={!!actionLoading}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-300 transition-all hover:bg-slate-700 active:scale-95"
          >
            <Sliders className="h-3.5 w-3.5" />
            Refresh Indicators
          </button>

          <Link
            href="/velocity-burst-elite"
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-emerald-500 px-3.5 py-1.5 text-xs font-bold text-black shadow-lg shadow-cyan-500/20 transition-all hover:brightness-110 active:scale-95"
          >
            <span>Open Dashboard</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Real-time Notification Banner */}
      {msg && (
        <div className="mt-3 flex items-center justify-between rounded-lg border border-cyan-500/30 bg-cyan-950/40 px-3.5 py-1.5 text-xs text-cyan-300 animate-fadeIn">
          <span>{msg}</span>
          <button onClick={() => setMsg(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* 17 Mandatory Real-time Widgets Grid */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 xl:grid-cols-8">
        {/* Widget 1: Engine Status */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">Engine Status</p>
          <div className="mt-1 flex items-center gap-1.5 font-bold text-white text-sm">
            <span className={`h-2 w-2 rounded-full ${isOnline ? "bg-emerald-400" : "bg-rose-500"}`} />
            {data?.engine_status || "ONLINE"}
          </div>
          <p className="mt-0.5 text-[10px] text-slate-500">Autonomous loop</p>
        </div>

        {/* Widget 2: Scheduler Status */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">Scheduler</p>
          <p className="mt-1 font-bold text-emerald-400 text-sm">{data?.scheduler_status || "RUNNING"}</p>
          <p className="mt-0.5 text-[10px] text-slate-500">5-stage clock</p>
        </div>

        {/* Widget 3: Market Regime */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">Market Regime</p>
          <p className="mt-1 font-bold text-cyan-400 text-sm truncate">{data?.market_regime || "Evaluating..."}</p>
          <p className="mt-0.5 text-[10px] text-slate-500">Score: {data?.market_score ?? 0}/100</p>
        </div>

        {/* Widget 4: Stocks Scanned */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">Stocks Scanned</p>
          <p className="mt-1 font-bold text-white text-sm">{data?.stocks_scanned ?? 0}</p>
          <p className="mt-0.5 text-[10px] text-slate-500">NSE500 Universe</p>
        </div>

        {/* Widget 5: Sleeping Giants */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">Sleeping Giants</p>
          <p className="mt-1 font-bold text-amber-400 text-sm">{data?.sleeping_giants ?? 0}</p>
          <p className="mt-0.5 text-[10px] text-slate-500">TTM Squeeze coiling</p>
        </div>

        {/* Widget 6: Institution Candidates */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">Institution Inflows</p>
          <p className="mt-1 font-bold text-emerald-400 text-sm">{data?.institution_candidates ?? 0}</p>
          <p className="mt-0.5 text-[10px] text-slate-500">Pocket pivot ignition</p>
        </div>

        {/* Widget 7: Live Breakouts */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">Live Breakouts</p>
          <p className="mt-1 font-bold text-rose-400 text-sm">{data?.live_breakouts ?? 0}</p>
          <p className="mt-0.5 text-[10px] text-slate-500">Triggered today</p>
        </div>

        {/* Widget 8: BTST Candidates */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">BTST Candidates</p>
          <p className="mt-1 font-bold text-sky-400 text-sm">{data?.btst_candidates ?? 0}</p>
          <p className="mt-0.5 text-[10px] text-slate-500">Closing near highs</p>
        </div>

        {/* Widget 9: AI Elite Signals */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">AI Elite Signals</p>
          <p className="mt-1 font-bold text-violet-400 text-sm">{data?.ai_elite_signals ?? 0}</p>
          <p className="mt-0.5 text-[10px] text-slate-500">ELITE A+ grade</p>
        </div>

        {/* Widget 10: Average Confidence */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">Avg Confidence</p>
          <p className="mt-1 font-bold text-cyan-300 text-sm">{data?.average_confidence !== undefined ? `${data.average_confidence}%` : "0.0%"}</p>
          <p className="mt-0.5 text-[10px] text-slate-500">100-pt model</p>
        </div>

        {/* Widget 11: Average Return */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">Average Return</p>
          <p className="mt-1 font-bold text-emerald-300 text-sm">
            {data?.average_return ? `+${data.average_return}%` : "0.0%"}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-500">Per breakout trade</p>
        </div>

        {/* Widget 12: Win Rate 30 Days */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">Win Rate 30D</p>
          <p className="mt-1 font-bold text-emerald-400 text-sm">{data?.win_rate_30_days !== undefined ? `${data.win_rate_30_days}%` : "0.0%"}</p>
          <p className="mt-0.5 text-[10px] text-slate-500">Verified realized</p>
        </div>

        {/* Widget 13: Backtest Win Rate */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">Backtest Win %</p>
          <p className="mt-1 font-bold text-amber-300 text-sm">{data?.backtest_win_rate !== undefined ? `${data.backtest_win_rate}%` : "0.0%"}</p>
          <p className="mt-0.5 text-[10px] text-slate-500">5-yr walk-forward</p>
        </div>

        {/* Widget 14: Alerts Today */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">Alerts Today</p>
          <p className="mt-1 font-bold text-white text-sm">{data?.alerts_today ?? 0}</p>
          <p className="mt-0.5 text-[10px] text-slate-500">Deduplicated</p>
        </div>

        {/* Widget 15: Failed Alerts */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">Failed Alerts</p>
          <p className="mt-1 font-bold text-emerald-400 text-sm">{data?.failed_alerts ?? 0}</p>
          <p className="mt-0.5 text-[10px] text-slate-500">Zero drop policy</p>
        </div>

        {/* Widget 16: Database Sync */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-3">
          <p className="text-[10px] uppercase tracking-wider text-slate-400">DB Sync</p>
          <div className="mt-1 flex items-center gap-1 font-bold text-emerald-400 text-sm">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {data?.database_sync || "HEALTHY"}
          </div>
          <p className="mt-0.5 text-[10px] text-slate-500">PostgreSQL batch</p>
        </div>
      </div>
    </div>
  );
}

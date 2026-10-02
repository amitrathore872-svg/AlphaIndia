"use client";

import { useState, useEffect } from "react";
import {
  Flame,
  Search,
  Activity,
  ShieldCheck,
  Target,
  Zap,
  TrendingUp,
  BarChart3,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  Eye,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { API_BASE } from "@/lib/apiConfig";

const QUICK_SYMBOLS = ["RELIANCE", "TCS", "INFY", "TATAMOTORS", "HDFCBANK", "ICICIBANK", "BHARTIARTL", "SBIN"];

export default function CompanyVelocityTab() {
  const [symbol, setSymbol] = useState("RELIANCE");
  const [inputSym, setInputSym] = useState("RELIANCE");
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDossier = async (targetSymbol: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v4/velocity/company/${targetSymbol.trim().toUpperCase()}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setSymbol(targetSymbol.trim().toUpperCase());
      } else {
        setError(`Symbol "${targetSymbol}" not found in institutional master.`);
      }
    } catch (e: any) {
      setError(`Failed to fetch dossier: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDossier("RELIANCE");
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputSym.trim()) {
      loadDossier(inputSym.trim());
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Symbol Searcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#070E1A] p-5 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-amber-500/15 px-2.5 py-0.5 text-xs font-bold text-amber-500 border border-amber-500/30">
              Stage 16
            </span>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Flame className="h-5 w-5 text-amber-400" />
              Company Intelligence Dossier (VBE Profile)
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Complete multi-engine synthesis: Contraction timeline, institutional footprint, RS rank, and trade odds.
          </p>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={inputSym}
              onChange={(e) => setInputSym(e.target.value.toUpperCase())}
              placeholder="Enter symbol (e.g. RELIANCE)..."
              className="w-48 sm:w-64 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 pl-10 pr-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white uppercase font-mono placeholder:normal-case placeholder-slate-400 focus:border-amber-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl bg-amber-500/20 border border-amber-500/40 px-4 py-2 text-xs font-bold text-amber-400 hover:bg-amber-500/30 transition active:scale-95"
          >
            Load
          </button>
        </form>
      </div>

      {/* Quick Symbol Pills */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-500 dark:text-slate-400">Quick Inspect:</span>
        {QUICK_SYMBOLS.map((s) => (
          <button
            key={s}
            onClick={() => {
              setInputSym(s);
              loadDossier(s);
            }}
            className={`rounded-lg border px-2.5 py-1 text-xs font-mono font-semibold transition ${
              symbol === s
                ? "border-amber-500 bg-amber-500/20 text-amber-400"
                : "border-slate-700 bg-slate-800/80 text-slate-300 hover:border-slate-500"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-2xl border border-slate-800 bg-slate-900/30">
          <Activity className="h-7 w-7 animate-spin text-amber-400" />
          <p className="text-xs text-slate-400">Loading Velocity Burst Elite dossier for {inputSym}...</p>
        </div>
      )}

      {error && !loading && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-6 text-center text-xs text-rose-400">
          {error}
        </div>
      )}

      {data && !loading && (
        <div className="space-y-6">
          {/* Identity & Current Stage Banner */}
          <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-[#071324] via-[#050D19] to-[#071324] p-6 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-2xl font-black text-white font-mono">{data.symbol}</h3>
                  <span className="rounded-md bg-cyan-500/15 border border-cyan-500/30 px-2.5 py-0.5 text-xs font-bold text-cyan-300">
                    {data.company_name}
                  </span>
                  <span className="rounded-md bg-slate-800 px-2.5 py-0.5 text-xs text-slate-300">
                    {data.sector} • {data.industry}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-4 text-xs text-slate-400">
                  <span>CMP: <strong className="text-white font-mono">₹{data.current_price?.toFixed(2)}</strong></span>
                  <span>•</span>
                  <span>Market Cap: <strong className="text-white font-mono">₹{data.market_cap?.toLocaleString()} Cr</strong></span>
                  <span>•</span>
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 size={13} />
                    Current Stage: {data.current_stage}
                  </span>
                </div>
              </div>

              <Link
                href={`/stocks/${data.symbol}`}
                className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:text-white hover:border-cyan-400 transition"
              >
                <span>Full Technical Chart</span>
                <ArrowUpRight size={14} />
              </Link>
            </div>
          </div>

          {/* Sub-Engine Scores Grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-center">
              <p className="text-[10px] uppercase text-slate-400">Compression</p>
              <p className="mt-1 text-xl font-bold text-white">{data.scores.compression_score?.toFixed(0)}</p>
              <p className="text-[9px] text-slate-500">Stage 1</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-center">
              <p className="text-[10px] uppercase text-slate-400">Base Quality</p>
              <p className="mt-1 text-xl font-bold text-cyan-300">{data.scores.base_quality?.toFixed(0)}</p>
              <p className="text-[9px] text-slate-500">Stage 3</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-center">
              <p className="text-[10px] uppercase text-slate-400">Institutions</p>
              <p className="mt-1 text-xl font-bold text-emerald-400">{data.scores.institution_score?.toFixed(0)}</p>
              <p className="text-[9px] text-slate-500">Stage 4</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-center">
              <p className="text-[10px] uppercase text-slate-400">RS Rank</p>
              <p className="mt-1 text-xl font-bold text-amber-300">{data.scores.rs_score?.toFixed(0)}</p>
              <p className="text-[9px] text-slate-500">Stage 5</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-center">
              <p className="text-[10px] uppercase text-slate-400">Smart Money</p>
              <p className="mt-1 text-xl font-bold text-violet-300">{data.scores.smart_money_score?.toFixed(0)}</p>
              <p className="text-[9px] text-slate-500">Stage 7</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-center">
              <p className="text-[10px] uppercase text-slate-400">Liquidity</p>
              <p className="mt-1 text-xl font-bold text-sky-300">{data.scores.liquidity_score?.toFixed(0)}</p>
              <p className="text-[9px] text-slate-500">Stage 8</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-center">
              <p className="text-[10px] uppercase text-slate-400">News Risk</p>
              <p className="mt-1 text-xl font-bold text-rose-400">{data.scores.news_risk_score?.toFixed(0)}</p>
              <p className="text-[9px] text-slate-500">Stage 9</p>
            </div>
            <div className="rounded-xl border border-cyan-500/40 bg-cyan-950/30 p-3 text-center ring-1 ring-cyan-500/20">
              <p className="text-[10px] uppercase font-bold text-cyan-300">Conviction</p>
              <p className="mt-1 text-xl font-black text-cyan-200">{data.scores.composite_conviction}/100</p>
              <p className="text-[9px] text-cyan-400">Stage 14</p>
            </div>
          </div>

          {/* AI Narrative & Summary */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-cyan-500/30 bg-cyan-950/20 p-5">
              <h4 className="font-bold text-cyan-300 text-sm flex items-center gap-2">
                <Zap size={16} />
                AI Intelligence Thesis
              </h4>
              <p className="mt-2 text-xs text-slate-300 leading-relaxed">{data.ai_summary}</p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
              <h4 className="font-bold text-amber-300 text-sm flex items-center gap-2">
                <ShieldCheck size={16} />
                Risk & Execution Guardrail
              </h4>
              <p className="mt-2 text-xs text-slate-300 leading-relaxed">{data.risk_summary}</p>
            </div>
          </div>

          {/* Structural Details & Timeline Metrics */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-3 text-xs">
              <h4 className="font-bold text-white text-sm">Institutional Base Architecture</h4>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Pattern Detected:</span>
                <span className="font-bold text-white">{data.pattern_details.type}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Pivot Level:</span>
                <span className="font-bold text-emerald-400">₹{data.pattern_details.pivot_point}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Base Contraction Depth:</span>
                <span className="font-bold text-white">{data.pattern_details.depth_pct}%</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Status:</span>
                <span className="font-bold text-cyan-300">{data.pattern_details.status}</span>
              </div>
              <p className="text-[11px] text-slate-400 bg-slate-950/50 p-2.5 rounded-lg">
                {data.pattern_details.explanation}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 space-y-3 text-xs">
              <h4 className="font-bold text-white text-sm">Historical Signal Statistics & Win Rate</h4>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Historical Signals Evaluated:</span>
                <span className="font-bold text-white">{data.performance_metrics.total_historical_signals}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Empirical Win Rate:</span>
                <span className="font-bold text-emerald-400">{data.performance_metrics.win_rate_pct}%</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Average Breakout Expansion:</span>
                <span className="font-bold text-cyan-300">+{data.performance_metrics.average_return_pct}%</span>
              </div>
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Expected Expansion Window:</span>
                <span className="font-bold text-white">{data.performance_metrics.expected_breakout_window_days} Trading Days</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Average Holding Duration:</span>
                <span className="font-bold text-amber-300">{data.performance_metrics.average_hold_days} Days</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

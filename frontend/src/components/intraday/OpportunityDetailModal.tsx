"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { TomorrowDeepDiveItem } from "@/lib/technoFundaApi";
import {
  X,
  Flame,
  Zap,
  TrendingUp,
  Target,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  BarChart2,
  Sparkles,
  Layers,
  Award,
  Clock,
  Check,
  ChevronRight,
  PieChart,
  Sliders,
} from "lucide-react";

interface OpportunityDetailModalProps {
  opportunity: TomorrowDeepDiveItem | null;
  onClose: () => void;
}

export default function OpportunityDetailModal({
  opportunity,
  onClose,
}: OpportunityDetailModalProps) {
  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (opportunity) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [opportunity]);

  if (!opportunity) return null;

  const item = opportunity;
  const isElite = item.conviction_tier === "A+ SUPER-SETUP";
  const isHighConviction = item.conviction_tier === "A HIGH CONVICTION";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-gradient-to-br dark:from-[#081225] dark:via-[#050B14] dark:to-[#040810] shadow-2xl text-slate-800 dark:text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 dark:border-slate-800/90 bg-white/95 dark:bg-[#081225]/95 px-6 py-4 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                isElite
                  ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                  : isHighConviction
                  ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-600 dark:text-cyan-300"
                  : "bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-300"
              }`}
            >
              <Sparkles size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  {item.symbol}
                </h2>
                <span
                  className={`rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                    isElite
                      ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40"
                      : isHighConviction
                      ? "bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/40"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                  }`}
                >
                  {item.conviction_tier}
                </span>
                <span className="rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                  {item.sector}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-md">
                {item.company_name} • CMP: <span className="font-mono text-slate-900 dark:text-white font-bold">₹{item.cmp}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={item.tradingview_5m_url}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500 hover:text-slate-950 transition"
            >
              <BarChart2 size={13} />
              <span>TradingView 5m</span>
              <ArrowUpRight size={13} />
            </a>

            <button
              onClick={onClose}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/80 p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition"
              aria-label="Close details"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* MODAL BODY */}
        <div className="p-6 space-y-6">
          {/* 1. HERO ACTION BLUEPRINT (PRIMARY TRADE CARD) */}
          <div className="rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-50 via-teal-50/40 to-slate-50 dark:from-emerald-950/20 dark:via-[#06141F] dark:to-[#040D1A] p-5 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <Target size={18} className="text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                  Exact Trade Execution Blueprint
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-400">Expected Move:</span>
                <span className="text-sm font-black font-mono text-emerald-600 dark:text-emerald-400">+{item.expected_move_pct}%</span>
                {item.risk_reward && (
                  <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                    1:{item.risk_reward} Risk:Reward
                  </span>
                )}
              </div>
            </div>

            {/* 4-BOX ACTION GRID */}
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-3 shadow-xs">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">1. Buy Entry Trigger</div>
                <div className="mt-1 text-lg font-black font-mono text-slate-900 dark:text-white">
                  ₹{item.entry_trigger}
                </div>
                <div className="mt-0.5 text-[10px] text-cyan-600 dark:text-cyan-400">9:30 AM Breakout High</div>
              </div>

              <div className="rounded-lg border border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-500/5 p-3 shadow-xs">
                <div className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">2. Target 1 (Book 60%)</div>
                <div className="mt-1 text-lg font-black font-mono text-emerald-700 dark:text-emerald-300">
                  ₹{item.target_1 || item.target_price}
                </div>
                <div className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">1.2x ATR Quick Expansion</div>
              </div>

              <div className="rounded-lg border border-cyan-500/30 bg-cyan-50/60 dark:bg-cyan-500/5 p-3 shadow-xs">
                <div className="text-[11px] font-medium text-cyan-700 dark:text-cyan-400">3. Target 2 (Runner 40%)</div>
                <div className="mt-1 text-lg font-black font-mono text-cyan-700 dark:text-cyan-300">
                  ₹{item.target_2 || Math.round(item.cmp * 1.05)}
                </div>
                <div className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">2.0x ATR Explosive Push</div>
              </div>

              <div className="rounded-lg border border-rose-500/30 bg-rose-50/60 dark:bg-rose-500/5 p-3 shadow-xs">
                <div className="text-[11px] font-medium text-rose-700 dark:text-rose-400">4. Hard Stop Loss</div>
                <div className="mt-1 text-lg font-black font-mono text-rose-700 dark:text-rose-300">
                  ₹{item.stop_loss}
                </div>
                <div className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">Below VWAP / 0.75x ATR</div>
              </div>
            </div>

            {/* 9:15 - 9:30 AM MORNING GAP PLAYBOOK */}
            <div className="mt-4 rounded-lg bg-white dark:bg-slate-900/60 p-3 border border-slate-200 dark:border-slate-800/80 text-xs">
              <div className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-2">
                <Clock size={14} className="text-amber-500 dark:text-amber-400" />
                <span>Morning Opening Rules (9:15 AM - 9:30 AM)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300">
                  <div className="font-bold flex items-center gap-1">
                    <Check size={12} />
                    <span>Gap +0.2% to +1.2%: Optimal</span>
                  </div>
                  <div className="text-[10px] text-slate-600 dark:text-slate-400 mt-0.5">
                    Enter on breakout above ₹{item.entry_trigger} after 9:30 AM.
                  </div>
                </div>

                <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300">
                  <div className="font-bold flex items-center gap-1">
                    <AlertTriangle size={12} />
                    <span>Gap &gt; +2.5%: Gap Trap</span>
                  </div>
                  <div className="text-[10px] text-slate-600 dark:text-slate-400 mt-0.5">
                    Do not chase. Wait for 9:45 AM pullback to VWAP.
                  </div>
                </div>

                <div className="p-2 rounded bg-rose-500/10 border border-rose-500/20 text-rose-800 dark:text-rose-300">
                  <div className="font-bold flex items-center gap-1">
                    <X size={12} />
                    <span>Gap &lt; -0.8%: Cancel Trade</span>
                  </div>
                  <div className="text-[10px] text-slate-600 dark:text-slate-400 mt-0.5">
                    Setup invalidated. Stand aside and protect capital.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 2. THREE-PILLAR VERIFICATION AUDIT */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* PILLAR 1: VOLATILITY CONTRACTION (TOBY CRABEL) */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/50 p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-3">
                <Zap size={14} />
                <span>Volatility Contraction</span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2 rounded bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">Pattern Status:</span>
                  <span className="font-bold text-slate-900 dark:text-white">{item.pattern_contraction || "Standard"}</span>
                </div>

                <div className="flex items-center justify-between p-2 rounded bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">NR7 (Narrow Range 7):</span>
                  <span className={`font-bold ${item.is_nr7 ? "text-amber-600 dark:text-amber-400" : "text-slate-400 dark:text-slate-500"}`}>
                    {item.is_nr7 ? "ACTIVE COIL 🔥" : "No"}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 rounded bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">Inside Day (ID):</span>
                  <span className={`font-bold ${item.is_inside_day ? "text-purple-600 dark:text-purple-400" : "text-slate-400 dark:text-slate-500"}`}>
                    {item.is_inside_day ? "CONFIRMED" : "No"}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 rounded bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">Daily ATR(14):</span>
                  <span className="font-mono font-bold text-cyan-600 dark:text-cyan-300">
                    ₹{item.atr_14 || "—"} ({item.atr_pct || "—"}%)
                  </span>
                </div>
              </div>
            </div>

            {/* PILLAR 2: MULTI-TIMEFRAME ALIGNMENT */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/50 p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider mb-3">
                <Layers size={14} />
                <span>Multi-Timeframe Structure</span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2 rounded bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">1D Macro Trend:</span>
                  <span className={`font-bold ${item.trend_1d === "BULLISH" ? "text-emerald-600 dark:text-emerald-400" : "text-slate-700 dark:text-slate-300"}`}>
                    {item.trend_1d === "BULLISH" ? "Stage-2 Uptrend" : item.trend_1d}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 rounded bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">1H Momentum:</span>
                  <span className={`font-bold ${item.trend_1h === "BULLISH" ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                    {item.trend_1h}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 rounded bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">5M Micro Squeeze:</span>
                  <span className={`font-bold ${item.is_squeeze ? "text-amber-600 dark:text-amber-400" : "text-slate-400 dark:text-slate-500"}`}>
                    {item.is_squeeze ? "Coiled Squeeze" : "Normal"}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 rounded bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">Alignment Rating:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-300">{item.confluence_badge}</span>
                </div>
              </div>
            </div>

            {/* PILLAR 3: NIFTY ALPHA & SECTOR FLOW */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/50 p-4">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-3">
                <TrendingUp size={14} />
                <span>Nifty Alpha & Sector Breadth</span>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2 rounded bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">Alpha RS vs Nifty:</span>
                  <span
                    className={`font-mono font-bold ${
                      (item.rs_score ?? 0) >= 0.5 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                    }`}
                  >
                    {(item.rs_score ?? 0) > 0 ? "+" : ""}
                    {item.rs_score ?? 0}%
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 rounded bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">Alpha Status:</span>
                  <span className="font-bold text-slate-900 dark:text-white text-[11px]">{item.rs_status || "IN-LINE"}</span>
                </div>

                <div className="flex items-center justify-between p-2 rounded bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">Sector Flow ({item.sector}):</span>
                  <span className="font-mono font-bold text-cyan-600 dark:text-cyan-300">
                    {item.sector_bullish_ratio_pct}% Bullish
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 rounded bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">Nifty Benchmark:</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">{item.nifty_regime}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. LATE-SESSION FOOTPRINTS */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 p-4">
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Late-Session (3:00 - 3:30 PM) Institutional Footprints
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 text-[10px]">Close Location</span>
                <div className="font-mono font-bold text-slate-900 dark:text-white mt-0.5">{item.close_location_pct}% of day range</div>
              </div>
              <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 text-[10px]">Intraday VWAP</span>
                <div className="font-mono font-bold text-cyan-600 dark:text-cyan-400 mt-0.5">₹{item.vwap} ({item.vwap_pct > 0 ? "+" : ""}{item.vwap_pct}%)</div>
              </div>
              <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 text-[10px]">3:00-3:30 Vol Surge</span>
                <div className="font-mono font-bold text-purple-600 dark:text-purple-300 mt-0.5">{item.vol_surge_ratio}x median</div>
              </div>
              <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-slate-500 text-[10px]">5M RSI</span>
                <div className="font-mono font-bold text-slate-700 dark:text-slate-300 mt-0.5">{item.rsi_5m}</div>
              </div>
            </div>
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-600 dark:text-slate-400">Institutional Conviction Score:</span>
            <span className="text-base font-black font-mono text-emerald-600 dark:text-emerald-400">{item.conviction_score}/100</span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/techno-funda/${item.symbol}`}
              className="flex items-center gap-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-cyan-500/50 hover:text-cyan-600 dark:hover:text-white transition"
            >
              <span>Full Stock Terminal</span>
              <ChevronRight size={14} />
            </Link>

            <button
              onClick={onClose}
              className="rounded-xl bg-cyan-600 dark:bg-cyan-500 px-5 py-2 text-xs font-bold text-white dark:text-slate-950 hover:bg-cyan-500 transition shadow-lg shadow-cyan-500/20"
            >
              Done / Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

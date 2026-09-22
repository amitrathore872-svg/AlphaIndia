"use client";

import React, { useState } from "react";
import {
  TrendingUp,
  ShieldCheck,
  Zap,
  Target,
  ArrowUpRight,
  Activity,
  Layers,
  Sparkles,
  BarChart3,
  Flame,
  CheckCircle2,
  Eye,
  Percent,
  Send,
  Share2,
  Check,
} from "lucide-react";
import { type VCPStockPick } from "@/lib/vcpApi";
import { notificationsApi } from "@/lib/notificationsApi";

interface VCPCardProps {
  stock: VCPStockPick;
  onOpenChart?: (stock: VCPStockPick) => void;
}

export default function VCPCard({ stock, onOpenChart }: VCPCardProps) {
  const isElite = stock.is_elite || stock.final_ai_score >= 95;
  const [alertDispatched, setAlertDispatched] = useState(false);
  const [dispatching, setDispatching] = useState(false);

  const handleShareWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    const memo = `🎯 *ALPHA INDIA | MINERVINI VCP BREAKOUT*\n━━━━━━━━━━━━━━━━━━━━━\n🏢 *${stock.company_name || stock.symbol}* (\`${stock.symbol}\`)\n⭐ *Score:* ${stock.final_ai_score}/100 — ${stock.verdict}\n📐 *Pattern:* ${stock.vcp_stage}\n🎯 *Pivot Price:* ₹${stock.pivot_price.toLocaleString()}\n🚪 *Entry Zone:* ${stock.entry_zone}\n🛡️ *Stop Loss:* ₹${stock.stop_loss.toLocaleString()}\n🚀 *Targets:* T1: ₹${stock.target_1.toLocaleString()} | T2: ₹${stock.target_2.toLocaleString()}\n⚖️ *Risk/Reward:* ${stock.reward_risk}x | Vol: ${stock.volume_breakout_ratio}x 20DMA\n━━━━━━━━━━━━━━━━━━━━━\n📡 *Live Radar:* http://localhost:3000/vcp-discovery`;
    window.open(`https://wa.me/?text=${encodeURIComponent(memo)}`, "_blank");
  };

  const handleTriggerAlert = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setDispatching(true);
      await notificationsApi.triggerStockVCPAlert(stock.symbol, true);
      setAlertDispatched(true);
      setTimeout(() => setAlertDispatched(false), 3000);
    } catch (err) {
      console.error("Failed to trigger stock alert:", err);
    } finally {
      setDispatching(false);
    }
  };

  return (
    <div
      className={`relative rounded-2xl border transition-all duration-300 overflow-hidden ${
        isElite
          ? "bg-white dark:bg-gradient-to-b dark:from-[#071322] dark:via-[#050B14] dark:to-[#03070D] border-cyan-500/40 shadow-xs dark:shadow-[0_0_35px_rgba(6,182,212,0.15)]"
          : "bg-white dark:bg-[#050B14]/90 border-slate-200 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs dark:shadow-xl"
      }`}
    >
      {/* Top Banner Accent */}
      <div
        className={`h-1.5 w-full ${
          isElite
            ? "bg-gradient-to-r from-cyan-500 via-emerald-400 to-amber-400"
            : "bg-gradient-to-r from-emerald-500 to-cyan-500"
        }`}
      />

      <div className="p-6 space-y-6">
        {/* Header: Identity, CMP & AI Score Badge */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-2xl font-black tracking-tight text-slate-900 dark:text-white font-mono">
                {stock.symbol}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                {stock.sector}
              </span>
              {isElite ? (
                <span className="px-3 py-0.5 rounded-full text-[11px] font-bold tracking-wider bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 flex items-center gap-1 shadow-sm">
                  <Sparkles className="w-3 h-3 text-cyan-500" />
                  ELITE BREAKOUT (95+)
                </span>
              ) : (
                <span className="px-3 py-0.5 rounded-full text-[11px] font-bold tracking-wider bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-emerald-500" />
                  HIGH CONVICTION
                </span>
              )}
            </div>
            <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
              {stock.company_name} • ₹{(stock.market_cap / 1000).toFixed(1)}k Cr Market Cap
            </div>
          </div>

          {/* Institutional AI Composite Score Meter */}
          <div className="flex items-center gap-3 bg-slate-50 dark:bg-black/40 border border-slate-200 dark:border-slate-800/80 rounded-xl p-3 px-4 backdrop-blur-sm self-start sm:self-auto">
            <div className="text-right">
              <div className="text-[10px] uppercase font-bold tracking-widest text-slate-500 dark:text-slate-400">
                Final AI Score
              </div>
              <div
                className={`text-2xl font-black font-mono ${
                  isElite ? "text-cyan-600 dark:text-cyan-400" : "text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {stock.final_ai_score.toFixed(1)}
                <span className="text-xs text-slate-400 dark:text-slate-500 font-normal">/100</span>
              </div>
            </div>
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center font-black text-sm border ${
                isElite
                  ? "bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                  : "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40"
              }`}
            >
              <Zap className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Actionable Trade Execution Zone */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 bg-slate-50 dark:bg-[#03070E]/80 border border-slate-200 dark:border-slate-800/80 rounded-xl p-4">
          <div>
            <div className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400">Current CMP</div>
            <div className="text-base font-bold font-mono text-slate-900 dark:text-white mt-0.5">
              ₹{stock.cmp.toFixed(2)}
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase font-semibold text-cyan-700 dark:text-cyan-400/90 flex items-center gap-1">
              <Target className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
              Pivot Price
            </div>
            <div className="text-base font-bold font-mono text-cyan-700 dark:text-cyan-300 mt-0.5">
              ₹{stock.pivot_price.toFixed(2)}
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400">Suggested Entry</div>
            <div className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
              {stock.entry_zone}
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase font-semibold text-rose-600 dark:text-rose-400/90">Stop Loss</div>
            <div className="text-base font-bold font-mono text-rose-600 dark:text-rose-400 mt-0.5">
              ₹{stock.stop_loss.toFixed(2)}
              <span className="text-[10px] text-rose-500 ml-1 font-normal">
                (-{stock.risk_pct.toFixed(1)}%)
              </span>
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400">Target 1 (R:2.5)</div>
            <div className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
              ₹{stock.target_1.toFixed(2)}
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400">Target 2 & 3</div>
            <div className="text-xs font-bold font-mono text-emerald-700 dark:text-emerald-300 mt-1">
              ₹{stock.target_2.toFixed(0)} / ₹{stock.target_3.toFixed(0)}
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase font-semibold text-amber-700 dark:text-amber-400/90">Risk : Reward</div>
            <div className="text-base font-bold font-mono text-amber-700 dark:text-amber-300 mt-0.5">
              {stock.reward_risk}
            </div>
          </div>
        </div>

        {/* 3 Core Rules Verification & Contraction Ribbon */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Rule 1: Contraction Stage (3-5 Contractions, Successively Smaller) */}
          <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                Rule 1: 3–5 Contractions
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20">
                {stock.vcp_stage}
              </span>
            </div>
            {stock.contraction_sizes && stock.contraction_sizes.length > 0 ? (
              <div className="mt-2">
                <div className="text-xs font-mono font-bold text-cyan-700 dark:text-cyan-400">
                  {stock.contraction_sizes.map((c) => `${c}%`).join(" → ")}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Successively smaller pullbacks
                </div>
              </div>
            ) : (
              <div className="text-xs font-mono text-slate-400 mt-2">Tightening Base</div>
            )}
          </div>

          {/* Rule 2: Volume Contracts in Each Pullback */}
          <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                Rule 2: Volume Contracts
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-violet-500/10 text-violet-700 dark:text-violet-300 border border-violet-500/20">
                {stock.volume_dryup_pct}% Dry-Up
              </span>
            </div>
            <div className="mt-2">
              {stock.wave_volumes && stock.wave_volumes.length > 0 ? (
                <div className="text-xs font-mono font-bold text-violet-700 dark:text-violet-300 truncate">
                  {stock.wave_volumes.map((v) => `${(v / 1000).toFixed(0)}k`).join(" → ")}
                </div>
              ) : (
                <div className="text-xs font-mono font-bold text-violet-700 dark:text-violet-300">
                  Supply Absorbed ({stock.volume_dryup_pct}%)
                </div>
              )}
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                Lower volume in each pullback
              </div>
            </div>
          </div>

          {/* Rule 3: Breakout Volume (Biggest in 20 Days) */}
          <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                Rule 3: Breakout Volume
              </div>
              {stock.is_20d_max_vol ? (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1 animate-pulse">
                  <Sparkles className="w-2.5 h-2.5 text-amber-500" />
                  20D High Vol
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {stock.volume_breakout_ratio}x 20DMA
                </span>
              )}
            </div>
            <div className="mt-2">
              <div className="text-xs font-mono font-bold text-amber-700 dark:text-amber-300">
                {stock.is_20d_max_vol
                  ? `Biggest Volume in 20 Days (${stock.volume_breakout_ratio}x 20 DMA)`
                  : `Relative Volume: ${stock.volume_breakout_ratio}x 20 DMA`}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                {stock.is_20d_max_vol ? "Institutional volume surge" : "Coiling supply dry-up"}
              </div>
            </div>
          </div>
        </div>

        {/* 8-Gate Scoring Breakdown Progress Bar */}
        <div className="space-y-2 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 rounded-xl p-4">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <span>Gate Scoring Breakdown (Weighted Total: {stock.final_ai_score})</span>
            <span className="text-cyan-700 dark:text-cyan-400 font-mono">Institutional Threshold: &ge; 90.0</span>
          </div>
          <div className="grid grid-cols-7 gap-2 text-center text-xs">
            <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 p-2 rounded-lg">
              <div className="text-[10px] text-slate-500 dark:text-slate-400">Trend (15%)</div>
              <div className="font-mono font-bold text-slate-900 dark:text-white mt-0.5">{stock.trend_score}</div>
            </div>
            <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 p-2 rounded-lg">
              <div className="text-[10px] text-slate-500 dark:text-slate-400">VCP (20%)</div>
              <div className="font-mono font-bold text-cyan-600 dark:text-cyan-400 mt-0.5">{stock.vcp_score}</div>
            </div>
            <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 p-2 rounded-lg">
              <div className="text-[10px] text-slate-500 dark:text-slate-400">Vol Dry-up (20%)</div>
              <div className="font-mono font-bold text-violet-600 dark:text-violet-400 mt-0.5">{stock.volume_score}</div>
            </div>
            <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 p-2 rounded-lg">
              <div className="text-[10px] text-slate-500 dark:text-slate-400">Breakout (20%)</div>
              <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{stock.breakout_score}</div>
            </div>
            <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 p-2 rounded-lg">
              <div className="text-[10px] text-slate-500 dark:text-slate-400">Inst Flow (10%)</div>
              <div className="font-mono font-bold text-amber-600 dark:text-amber-400 mt-0.5">{stock.institutional_score}</div>
            </div>
            <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 p-2 rounded-lg">
              <div className="text-[10px] text-slate-500 dark:text-slate-400">Growth (10%)</div>
              <div className="font-mono font-bold text-blue-600 dark:text-blue-400 mt-0.5">{stock.growth_score}</div>
            </div>
            <div className="bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 p-2 rounded-lg">
              <div className="text-[10px] text-slate-500 dark:text-slate-400">Catalyst (5%)</div>
              <div className="font-mono font-bold text-rose-600 dark:text-rose-400 mt-0.5">{stock.catalyst_score}</div>
            </div>
          </div>
        </div>

        {/* Structured AI Verdict Box */}
        <div className="border border-cyan-500/30 bg-cyan-50/30 dark:bg-[#030914]/95 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-cyan-500/20 pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
              <span className="text-xs uppercase tracking-widest font-black text-cyan-700 dark:text-cyan-300">
                AI VERDICT:
              </span>
              <span className="text-base font-bold text-slate-900 dark:text-white">{stock.verdict}</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-slate-600 dark:text-slate-400">
              <span>Confidence:</span>
              <span className="font-bold text-cyan-700 dark:text-cyan-400">{stock.confidence}%</span>
              <span>• Time Horizon:</span>
              <span className="font-bold text-slate-900 dark:text-white">{stock.time_horizon}</span>
            </div>
          </div>

          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Why Selected:
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-700 dark:text-slate-300">
              {stock.why_selected &&
                stock.why_selected.map((bullet, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 mt-0.5 shrink-0" />
                    <span>{bullet}</span>
                  </li>
                ))}
            </ul>
          </div>

          {stock.catalyst_summary && (
            <div className="text-xs text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-200 dark:border-slate-800/80">
              <span className="font-bold text-slate-800 dark:text-slate-300">Catalyst Footprint: </span>
              {stock.catalyst_summary}
            </div>
          )}
        </div>

        {/* Interactive Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800/80">
          <div className="flex items-center gap-2">
            <button
              onClick={handleTriggerAlert}
              disabled={dispatching || alertDispatched}
              title="Broadcast alert to Telegram and Notification Center"
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition border cursor-pointer ${
                alertDispatched
                  ? "border-emerald-500/50 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                  : "border-sky-500/30 bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-500/20"
              }`}
            >
              {alertDispatched ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  Dispatched!
                </>
              ) : (
                <>
                  <Send className={`w-3.5 h-3.5 ${dispatching ? "animate-spin" : ""}`} />
                  {dispatching ? "Broadcasting..." : "Broadcast Alert"}
                </>
              )}
            </button>

            <button
              onClick={handleShareWhatsApp}
              title="Share formatted memo on WhatsApp"
              className="px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              WhatsApp
            </button>
          </div>

          {onOpenChart && (
            <button
              onClick={() => onOpenChart(stock)}
              className="px-4 py-2 rounded-xl text-xs font-bold tracking-wide bg-cyan-500 hover:bg-cyan-400 text-slate-950 flex items-center gap-1.5 transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] hover:scale-[1.02] active:scale-95 ml-auto cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              View VCP Swings & Chart
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

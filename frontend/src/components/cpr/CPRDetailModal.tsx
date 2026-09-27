"use client";

import React, { useEffect, useState } from "react";
import {
  X,
  Target,
  ShieldAlert,
  TrendingUp,
  Activity,
  Layers,
  Sparkles,
  Zap,
  CheckCircle2,
  AlertCircle,
  Clock,
  Flame,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import CPRBandVisualizer from "./CPRBandVisualizer";
import { fetchStockCPRDetail, type CPRStockDetail } from "@/lib/cprApi";

interface CPRDetailModalProps {
  symbol: string | null;
  onClose: () => void;
}

export default function CPRDetailModal({ symbol, onClose }: CPRDetailModalProps) {
  const [detail, setDetail] = useState<CPRStockDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!symbol) return;
    setLoading(true);
    setError(null);
    fetchStockCPRDetail(symbol)
      .then((data) => {
        setDetail(data);
      })
      .catch((err) => {
        console.error("Failed to load CPR detail:", err);
        setError("Unable to load detailed CPR analytics for this symbol.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [symbol]);

  if (!symbol) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-800 bg-[#070D18] p-6 shadow-2xl text-slate-100 custom-scrollbar">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-xl border border-slate-700/80 bg-slate-800/80 p-2 text-slate-400 hover:border-slate-600 hover:text-white transition"
        >
          <X className="h-5 w-5" />
        </button>

        {loading ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
            <span className="text-sm font-mono text-cyan-400">Loading Quantitative CPR Intelligence...</span>
          </div>
        ) : error || !detail ? (
          <div className="flex h-48 flex-col items-center justify-center gap-3 text-rose-400">
            <AlertCircle className="h-8 w-8" />
            <span className="text-sm font-mono">{error || "Data not available"}</span>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-black font-mono tracking-tight text-white">
                    {detail.symbol}
                  </h2>
                  <span className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-xs font-bold text-cyan-300">
                    {detail.cpr_daily.category}
                  </span>
                  {detail.quality_filters.is_triple_cpr && (
                    <span className="rounded-md border border-amber-500/40 bg-amber-500/15 px-2.5 py-0.5 text-xs font-bold text-amber-300 flex items-center gap-1">
                      <Sparkles className="h-3 w-3" /> Triple CPR
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-400 mt-0.5">
                  {detail.company_name} • <span className="text-cyan-400">{detail.sector}</span>
                </p>
              </div>

              <div className="flex items-center gap-6">
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-slate-500 block">Spot Price</span>
                  <span className="text-2xl font-mono font-bold text-white">₹{detail.current_price.toFixed(2)}</span>
                </div>
                <div className="border-l border-slate-800 pl-4">
                  <span className="text-[11px] uppercase tracking-wider text-slate-500 block">Global CPR Rank</span>
                  <span className="text-xl font-mono font-black text-cyan-400">#{detail.cpr_daily.cpr_rank}</span>
                </div>
              </div>
            </div>

            {/* CPR Confluence Band Graphic */}
            <CPRBandVisualizer
              cmp={detail.current_price}
              pivot={detail.cpr_daily.pivot}
              bc={detail.cpr_daily.bc}
              tc={detail.cpr_daily.tc}
              widthPct={detail.cpr_daily.width_pct}
            />

            {/* Triple CPR Confluence Table */}
            <div className="rounded-xl border border-slate-800 bg-[#050B14] p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                <Layers className="h-4 w-4 text-cyan-400" /> Triple Timeframe CPR Confluence Matrix
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {/* Daily CPR */}
                <div className="rounded-lg border border-slate-800/80 bg-slate-900/60 p-3">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs font-semibold text-slate-300">Daily CPR</span>
                    <span className="text-[10px] font-mono text-cyan-400 font-bold">{detail.cpr_daily.width_pct.toFixed(2)}%</span>
                  </div>
                  <div className="space-y-1 text-xs font-mono">
                    <div className="flex justify-between text-slate-400">
                      <span>TC:</span>
                      <span className="text-slate-200">₹{detail.cpr_daily.tc.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Pivot:</span>
                      <span className="text-cyan-400 font-bold">₹{detail.cpr_daily.pivot.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>BC:</span>
                      <span className="text-slate-200">₹{detail.cpr_daily.bc.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Weekly CPR */}
                <div className="rounded-lg border border-slate-800/80 bg-slate-900/60 p-3">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs font-semibold text-slate-300">Weekly CPR</span>
                    <span className={`text-[10px] font-mono font-bold ${detail.cpr_weekly.is_narrow ? "text-emerald-400" : "text-slate-400"}`}>
                      {detail.cpr_weekly.width_pct.toFixed(2)}% {detail.cpr_weekly.is_narrow && "• Tight"}
                    </span>
                  </div>
                  <div className="space-y-1 text-xs font-mono">
                    <div className="flex justify-between text-slate-400">
                      <span>TC:</span>
                      <span className="text-slate-200">₹{detail.cpr_weekly.tc.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Pivot:</span>
                      <span className="text-cyan-400 font-bold">₹{detail.cpr_weekly.pivot.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>BC:</span>
                      <span className="text-slate-200">₹{detail.cpr_weekly.bc.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Monthly CPR */}
                <div className="rounded-lg border border-slate-800/80 bg-slate-900/60 p-3">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-xs font-semibold text-slate-300">Monthly CPR</span>
                    <span className={`text-[10px] font-mono font-bold ${detail.cpr_monthly.is_narrow ? "text-emerald-400" : "text-slate-400"}`}>
                      {detail.cpr_monthly.width_pct.toFixed(2)}% {detail.cpr_monthly.is_narrow && "• Tight"}
                    </span>
                  </div>
                  <div className="space-y-1 text-xs font-mono">
                    <div className="flex justify-between text-slate-400">
                      <span>TC:</span>
                      <span className="text-slate-200">₹{detail.cpr_monthly.tc.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>Pivot:</span>
                      <span className="text-cyan-400 font-bold">₹{detail.cpr_monthly.pivot.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span>BC:</span>
                      <span className="text-slate-200">₹{detail.cpr_monthly.bc.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Trading Plan & Geometry */}
            <div className="rounded-xl border border-cyan-900/40 bg-gradient-to-br from-[#061224] to-[#040914] p-4 shadow-lg">
              <h3 className="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-3 flex items-center gap-2">
                <Target className="h-4 w-4" /> Tomorrow&apos;s Asymmetric Trading Plan
              </h3>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-5 text-center">
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
                  <span className="text-[10px] uppercase font-bold text-emerald-400 block">Buy Level (TC)</span>
                  <span className="text-lg font-mono font-black text-emerald-300">₹{detail.trading_plan.buy_level.toFixed(2)}</span>
                </div>
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3">
                  <span className="text-[10px] uppercase font-bold text-rose-400 block">Stop Loss (BC)</span>
                  <span className="text-lg font-mono font-black text-rose-300">₹{detail.trading_plan.stop_loss.toFixed(2)}</span>
                </div>
                <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-3">
                  <span className="text-[10px] uppercase font-bold text-cyan-400 block">Target 1 (+1 ATR)</span>
                  <span className="text-lg font-mono font-black text-cyan-300">₹{detail.trading_plan.target_1.toFixed(2)}</span>
                </div>
                <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 p-3">
                  <span className="text-[10px] uppercase font-bold text-cyan-400 block">Target 2 (+2 ATR)</span>
                  <span className="text-lg font-mono font-black text-cyan-300">₹{detail.trading_plan.target_2.toFixed(2)}</span>
                </div>
                <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 p-3">
                  <span className="text-[10px] uppercase font-bold text-indigo-400 block">Target 3 (Swing High)</span>
                  <span className="text-lg font-mono font-black text-indigo-300">₹{detail.trading_plan.target_3.toFixed(2)}</span>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs font-mono text-slate-400 px-1">
                <span>Risk:Reward Profile: <strong className="text-white">{detail.trading_plan.risk_reward}</strong></span>
                <span>14-Period ATR Buffer: <strong className="text-cyan-400">₹{detail.trading_plan.atr_14.toFixed(2)}</strong></span>
              </div>
            </div>

            {/* Quality Filters & Indicators Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Quality Flags */}
              <div className="rounded-xl border border-slate-800 bg-[#050B14] p-4 space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">
                  Compression Quality Checklist
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className={`p-2 rounded border flex items-center gap-2 ${detail.quality_filters.is_nr7 ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-slate-800 bg-slate-900/40 text-slate-500"}`}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> NR7 (7-Day Range Low)
                  </div>
                  <div className={`p-2 rounded border flex items-center gap-2 ${detail.quality_filters.is_inside_bar ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-slate-800 bg-slate-900/40 text-slate-500"}`}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Inside Bar Day
                  </div>
                  <div className={`p-2 rounded border flex items-center gap-2 ${detail.quality_filters.is_bollinger_squeeze ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-slate-800 bg-slate-900/40 text-slate-500"}`}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Bollinger Squeeze
                  </div>
                  <div className={`p-2 rounded border flex items-center gap-2 ${detail.quality_filters.is_atr_compression ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-slate-800 bg-slate-900/40 text-slate-500"}`}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> 60D ATR Compression
                  </div>
                  <div className={`p-2 rounded border flex items-center gap-2 ${detail.quality_filters.is_volume_dryup ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-slate-800 bg-slate-900/40 text-slate-500"}`}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Volume Dry-Up (&lt;70%)
                  </div>
                  <div className={`p-2 rounded border flex items-center gap-2 ${detail.quality_filters.is_supertrend_bullish ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-slate-800 bg-slate-900/40 text-slate-500"}`}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Supertrend Bullish
                  </div>
                </div>
              </div>

              {/* Technical Indicators */}
              <div className="rounded-xl border border-slate-800 bg-[#050B14] p-4 space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block mb-2">
                  Technical Momentum & Trend Context
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2 rounded bg-slate-900 border border-slate-800 flex justify-between">
                    <span className="text-slate-400">RSI (14):</span>
                    <span className="text-white font-bold">{detail.technical_context.rsi_14.toFixed(1)}</span>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800 flex justify-between">
                    <span className="text-slate-400">ADX (14):</span>
                    <span className="text-white font-bold">{detail.technical_context.adx_14.toFixed(1)}</span>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800 flex justify-between">
                    <span className="text-slate-400">20 DMA:</span>
                    <span className="text-cyan-400 font-bold">₹{detail.technical_context.dma_20.toFixed(2)}</span>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800 flex justify-between">
                    <span className="text-slate-400">50 DMA:</span>
                    <span className="text-slate-300 font-bold">₹{detail.technical_context.dma_50.toFixed(2)}</span>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800 flex justify-between">
                    <span className="text-slate-400">200 DMA:</span>
                    <span className="text-slate-400 font-bold">₹{detail.technical_context.dma_200.toFixed(2)}</span>
                  </div>
                  <div className="p-2 rounded bg-slate-900 border border-slate-800 flex justify-between">
                    <span className="text-slate-400">Volume Ratio:</span>
                    <span className="text-white font-bold">{detail.technical_context.volume_ratio_20d.toFixed(2)}x</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

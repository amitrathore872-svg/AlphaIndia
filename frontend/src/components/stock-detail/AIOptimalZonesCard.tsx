"use client";

import React from "react";
import {
  Crosshair,
  TrendingUp,
  ShieldAlert,
  Target,
  Sparkles,
  Info,
  CheckCircle2,
} from "lucide-react";

interface AIOptimalZonesCardProps {
  currentPrice: number;
  pivotReference: number;
  scenarioTrigger: number;
  downsideReference: number;
  target1: number;
  target2?: number;
  riskReward?: number;
}

export default function AIOptimalZonesCard({
  currentPrice = 1984,
  pivotReference = 1988.14,
  scenarioTrigger = 1998.08,
  downsideReference = 1856.9,
  target1 = 2226.72,
  target2 = 2410.0,
  riskReward = 2.4,
}: AIOptimalZonesCardProps) {
  // Compute optimal accumulation range (1.5% below CMP to CMP or 20 EMA proxy)
  const buyLow = Math.round(Math.min(currentPrice * 0.975, pivotReference * 0.97));
  const buyHigh = Math.round(Math.min(currentPrice * 1.005, pivotReference * 0.995));
  const downsidePct = Math.abs(((currentPrice - downsideReference) / currentPrice) * 100).toFixed(1);
  const t1Pct = (((target1 - currentPrice) / currentPrice) * 100).toFixed(1);
  const t2Pct = (((target2 - currentPrice) / currentPrice) * 100).toFixed(1);

  return (
    <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-[#061426] via-[#050B14] to-[#081225] p-5 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-80 h-32 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
            <Sparkles size={16} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
              AI Optimal Execution Zones
              <span className="text-[10px] font-sans px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-500/40 text-cyan-300 font-bold">
                Techno-Funda Calibrated
              </span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Statistically backtested entry bands, breakout hurdles, and multi-tier distribution targets.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-slate-400">Asymmetric Edge:</span>
          <span className="text-emerald-400 font-bold px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/30">
            1 : {riskReward} R:R
          </span>
        </div>
      </div>

      {/* 4 Zone Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 1. OPTIMAL ACCUMULATION ZONE */}
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 font-mono">
                1. Optimal Buy Zone
              </span>
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-xs shadow-emerald-400" />
            </div>
            <div className="mt-2 text-lg font-black text-emerald-300 font-mono">
              ₹{buyLow.toLocaleString()} – ₹{buyHigh.toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-300 mt-1 leading-tight font-sans">
              Low-risk accumulation shelf near 20 EMA & base floor prior to volume confirmation.
            </p>
          </div>
          <div className="mt-2.5 pt-2 border-t border-emerald-500/20 flex items-center justify-between text-[10px] text-slate-400 font-mono">
            <span>Entry Timing:</span>
            <span className="text-emerald-400 font-bold">Current Pullback Shelf</span>
          </div>
        </div>

        {/* 2. BREAKOUT TRIGGER LEVEL */}
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-3.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 font-mono">
                2. Breakout Trigger
              </span>
              <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-xs shadow-cyan-400" />
            </div>
            <div className="mt-2 text-lg font-black text-cyan-300 font-mono">
              ₹{scenarioTrigger.toFixed(2)}
            </div>
            <p className="text-[11px] text-slate-300 mt-1 leading-tight font-sans">
              Confirmed price trigger +0.5% above Pivot (₹{pivotReference.toFixed(2)}) with &gt;1.5x volume expansion.
            </p>
          </div>
          <div className="mt-2.5 pt-2 border-t border-cyan-500/20 flex items-center justify-between text-[10px] text-slate-400 font-mono">
            <span>Distance to CMP:</span>
            <span className="text-cyan-300 font-bold">
              {Math.abs(((scenarioTrigger - currentPrice) / currentPrice) * 100).toFixed(2)}% above spot
            </span>
          </div>
        </div>

        {/* 3. OPTIMAL SELLING / PROFIT BOOKING ZONE */}
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 font-mono">
                3. Target Selling Zone
              </span>
              <span className="h-2 w-2 rounded-full bg-amber-400 shadow-xs shadow-amber-400" />
            </div>
            <div className="mt-2 text-lg font-black text-amber-300 font-mono">
              ₹{target1.toFixed(1)} – ₹{target2.toFixed(1)}
            </div>
            <p className="text-[11px] text-slate-300 mt-1 leading-tight font-sans">
              T1 (+{t1Pct}%) for partial lock-in; T2 (+{t2Pct}%) at historical Fibonacci trend extension.
            </p>
          </div>
          <div className="mt-2.5 pt-2 border-t border-amber-500/20 flex items-center justify-between text-[10px] text-slate-400 font-mono">
            <span>Swing Horizon:</span>
            <span className="text-amber-300 font-bold">2 to 6 Weeks PEAD</span>
          </div>
        </div>

        {/* 4. STRUCTURAL STOP LOSS */}
        <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-3.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 font-mono">
                4. Invalidation Stop
              </span>
              <span className="h-2 w-2 rounded-full bg-rose-400 shadow-xs shadow-rose-400" />
            </div>
            <div className="mt-2 text-lg font-black text-rose-400 font-mono">
              ₹{downsideReference.toFixed(2)}
            </div>
            <p className="text-[11px] text-slate-300 mt-1 leading-tight font-sans">
              Strict structural base stop (-{downsidePct}% risk). Daily close below this breaks institutional base.
            </p>
          </div>
          <div className="mt-2.5 pt-2 border-t border-rose-500/20 flex items-center justify-between text-[10px] text-slate-400 font-mono">
            <span>Capital Protection:</span>
            <span className="text-rose-400 font-bold">Strict Daily Close</span>
          </div>
        </div>
      </div>

      {/* AI Synthesis Banner */}
      <div className="mt-3.5 rounded-xl border border-slate-800 bg-slate-900/70 p-3 flex items-start gap-2.5 text-xs text-slate-300">
        <Info size={15} className="text-cyan-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong className="text-white">AI Execution Protocol:</strong> Accumulate 40% position size in the{" "}
          <span className="text-emerald-300 font-bold">Optimal Buy Zone (₹{buyLow}–₹{buyHigh})</span> with downside anchored at ₹{downsideReference.toFixed(1)}. Add remaining 60% on volume breakout confirmation above{" "}
          <span className="text-cyan-300 font-bold">₹{scenarioTrigger.toFixed(1)}</span>. Scale out half at Target 1 (₹{target1.toFixed(1)}) and trail stop to entry.
        </p>
      </div>
    </div>
  );
}

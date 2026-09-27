"use client";

import React from "react";

interface CPRBandVisualizerProps {
  cmp: number;
  pivot: number;
  bc: number;
  tc: number;
  widthPct: number;
  compact?: boolean;
}

export default function CPRBandVisualizer({
  cmp,
  pivot,
  bc,
  tc,
  widthPct,
  compact = false,
}: CPRBandVisualizerProps) {
  const cprTop = Math.max(tc, bc);
  const cprBottom = Math.min(tc, bc);

  let bandColor = "bg-amber-500/70 text-amber-300 border-amber-500/40";
  let statusText = "Inside CPR";
  let statusBadge = "bg-amber-500/10 text-amber-400 border-amber-500/30";

  if (cmp > cprTop) {
    bandColor = "bg-emerald-500/80 text-emerald-200 border-emerald-500/40 shadow-emerald-950/40";
    statusText = "Bullish (>TC)";
    statusBadge = "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
  } else if (cmp < cprBottom) {
    bandColor = "bg-rose-500/80 text-rose-200 border-rose-500/40 shadow-rose-950/40";
    statusText = "Bearish (<BC)";
    statusBadge = "bg-rose-500/10 text-rose-400 border-rose-500/30";
  }

  // Calculate normalized price location indicator (0 to 100%)
  const span = Math.max(0.5, cprTop * 1.015 - cprBottom * 0.985);
  const locPct = Math.min(
    95,
    Math.max(5, ((cmp - cprBottom * 0.985) / span) * 100)
  );

  if (compact) {
    return (
      <div className="flex flex-col gap-1 w-28">
        <div className="relative h-2.5 w-full rounded-full bg-slate-800 overflow-hidden border border-slate-700/60">
          {/* Merged thick CPR band */}
          <div
            className={`absolute top-0 bottom-0 left-[25%] right-[25%] rounded-sm ${bandColor} transition-all duration-300`}
            title={`TC: ₹${tc.toFixed(2)} | Pivot: ₹${pivot.toFixed(2)} | BC: ₹${bc.toFixed(2)} (Width: ${widthPct.toFixed(2)}%)`}
          />
          {/* CMP marker pin */}
          <div
            className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_6px_#ffffff] rounded-full z-10 transition-all duration-300"
            style={{ left: `${locPct}%` }}
          />
        </div>
        <div className="flex justify-between items-center text-[10px] font-mono leading-none">
          <span className="text-slate-400">{widthPct.toFixed(2)}%</span>
          <span className={`px-1 py-0.5 rounded text-[9px] font-semibold border ${statusBadge}`}>
            {statusText}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-[#060D1A]/90 p-4 shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            CPR Confluence Band
          </span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${statusBadge}`}>
            {statusText}
          </span>
        </div>
        <div className="text-right">
          <span className="text-[11px] text-slate-500 uppercase tracking-wider block">Width</span>
          <span className="text-xs font-mono font-bold text-cyan-400">{widthPct.toFixed(3)}%</span>
        </div>
      </div>

      {/* Visual Band Display */}
      <div className="relative py-4 my-2">
        <div className="relative h-5 w-full rounded-lg bg-slate-900 border border-slate-800 overflow-hidden">
          {/* Merged CPR Band */}
          <div
            className={`absolute top-0 bottom-0 left-[30%] right-[30%] ${bandColor} border-l border-r shadow-md flex items-center justify-center`}
          >
            <span className="text-[10px] font-mono font-black tracking-widest uppercase opacity-90 drop-shadow">
              TC • PIVOT • BC
            </span>
          </div>

          {/* CMP Needle */}
          <div
            className="absolute top-0 bottom-0 w-1.5 bg-white shadow-[0_0_10px_#ffffff] rounded-full z-20"
            style={{ left: `${locPct}%` }}
            title={`Current Market Price: ₹${cmp.toFixed(2)}`}
          />
        </div>

        {/* Level Callouts */}
        <div className="flex justify-between items-center mt-2.5 text-xs font-mono">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500">BC (Bottom)</span>
            <span className="font-bold text-slate-300">₹{bc.toFixed(2)}</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-cyan-400">Pivot</span>
            <span className="font-bold text-cyan-300">₹{pivot.toFixed(2)}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-slate-500">TC (Top)</span>
            <span className="font-bold text-slate-300">₹{tc.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
        <span>Current Spot: <strong className="text-white font-mono">₹{cmp.toFixed(2)}</strong></span>
        <span className="text-[10px] text-slate-500 font-mono">
          {cmp > cprTop ? `+${(((cmp - cprTop) / cprTop) * 100).toFixed(2)}% above TC` : (cmp < cprBottom ? `-${(((cprBottom - cmp) / cprBottom) * 100).toFixed(2)}% below BC` : "Inside CPR line")}
        </span>
      </div>
    </div>
  );
}

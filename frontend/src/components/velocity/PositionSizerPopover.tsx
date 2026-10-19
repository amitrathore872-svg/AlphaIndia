"use client";

import React, { useState } from "react";
import { DollarSign, Sliders, ShieldAlert, ArrowUpRight } from "lucide-react";

interface PositionSizerPopoverProps {
  entryPrice: number;
  stopLoss: number;
  target1?: number;
  target2?: number;
  positionMultiplier?: number;
}

export default function PositionSizerPopover({
  entryPrice,
  stopLoss,
  target1,
  target2,
  positionMultiplier = 1.0,
}: PositionSizerPopoverProps) {
  const [accountRisk, setAccountRisk] = useState<number>(5000);

  // Safe arithmetic
  const validEntry = entryPrice > 0 ? entryPrice : 100;
  const validSL = stopLoss > 0 && stopLoss < validEntry ? stopLoss : validEntry * 0.98;
  const slDistancePerShare = Math.max(0.2, validEntry - validSL);

  // Calculate shares based on risk budget
  const effectiveRisk = accountRisk * (positionMultiplier || 1.0);
  const sharesToBuy = Math.max(1, Math.floor(effectiveRisk / slDistancePerShare));
  const totalCapitalRequired = sharesToBuy * validEntry;
  const maxLossRupees = Math.round(sharesToBuy * slDistancePerShare);

  const t1 = target1 || validEntry * 1.035;
  const t2 = target2 || validEntry * 1.06;
  const projectedGainT1 = Math.round(sharesToBuy * (t1 - validEntry));
  const projectedGainT2 = Math.round(sharesToBuy * (t2 - validEntry));
  const riskRewardT1 = (projectedGainT1 / (maxLossRupees || 1)).toFixed(1);

  return (
    <div className="rounded-xl border border-slate-800 bg-black/60 p-2 space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 text-[11px] font-bold text-slate-300">
          <Sliders className="h-3 w-3 text-cyan-400" />
          <span>1-Click Risk & Position Sizer</span>
        </div>
        <div className="flex items-center gap-1">
          {[2500, 5000, 10000].map((preset) => (
            <button
              key={preset}
              onClick={() => setAccountRisk(preset)}
              className={`rounded px-1 py-0.2 text-[9px] font-mono font-bold transition ${
                accountRisk === preset
                  ? "bg-cyan-500 text-black"
                  : "bg-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              ₹{(preset / 1000).toFixed(preset % 1000 === 0 ? 0 : 1)}k
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Slider */}
      <div className="flex items-center gap-2">
        <input
          type="range"
          min={1000}
          max={25000}
          step={500}
          value={accountRisk}
          onChange={(e) => setAccountRisk(Number(e.target.value))}
          className="h-1 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-cyan-400"
        />
        <span className="font-mono text-[11px] font-black text-cyan-300 shrink-0">
          ₹{accountRisk.toLocaleString("en-IN")}
        </span>
      </div>

      {/* Computed Sizing Metrics Bar */}
      <div className="grid grid-cols-4 gap-1.5 rounded-lg bg-slate-950/80 p-1.5 text-center border border-slate-800/80 text-[10px]">
        <div>
          <span className="block text-[8px] uppercase tracking-wider text-slate-400">Order Qty</span>
          <span className="font-mono font-bold text-white text-[11px]">{sharesToBuy} Shares</span>
        </div>
        <div>
          <span className="block text-[8px] uppercase tracking-wider text-slate-400">Total Capital</span>
          <span className="font-mono font-bold text-slate-200 text-[11px]">
            ₹{totalCapitalRequired >= 100000 ? `${(totalCapitalRequired / 100000).toFixed(2)}L` : totalCapitalRequired.toLocaleString("en-IN")}
          </span>
        </div>
        <div>
          <span className="block text-[8px] uppercase tracking-wider text-rose-400">Max Risk</span>
          <span className="font-mono font-bold text-rose-400 text-[11px]">-₹{maxLossRupees.toLocaleString("en-IN")}</span>
        </div>
        <div>
          <span className="block text-[8px] uppercase tracking-wider text-emerald-400">Target 1 PnL</span>
          <span className="font-mono font-bold text-emerald-400 text-[11px]">
            +₹{projectedGainT1.toLocaleString("en-IN")} ({riskRewardT1}R)
          </span>
        </div>
      </div>
    </div>
  );
}

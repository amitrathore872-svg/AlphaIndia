"use client";

import React from "react";
import {
  Rocket,
  Package,
  CheckCircle2,
  XCircle,
  TrendingUp,
  BarChart2,
  ShieldAlert,
  SlidersHorizontal,
} from "lucide-react";

interface MomentumDeliveryTabProps {
  symbol?: string;
  momentumScore?: number;
}

export default function MomentumDeliveryTab({
  symbol = "STOCK",
  momentumScore = 9,
}: MomentumDeliveryTabProps) {
  const momentumRules = [
    { id: 1, rule: "Daily Volume > Daily SMA(Volume, 20)", status: "PASSED", note: "Volume 2.4x higher than 20-day moving average" },
    { id: 2, rule: "Daily Close > Daily Upper Bollinger Band (20, 2)", status: "PASSED", note: "Price riding outer volatility envelope" },
    { id: 3, rule: "Weekly Close > Weekly Upper Bollinger Band (20, 2)", status: "NOT MET", note: "Weekly candle resting just below upper band (consolidation)" },
    { id: 4, rule: "Daily RSI(14) > 60", status: "PASSED", note: "Current RSI 68.4 indicating bullish momentum expansion" },
    { id: 5, rule: "Weekly RSI(14) > 60", status: "PASSED", note: "Weekly RSI 64.2 confirming macro momentum" },
    { id: 6, rule: "Monthly RSI(14) > 60", status: "PASSED", note: "Multi-timeframe momentum alignment" },
    { id: 7, rule: "Weekly WMA(30) Crossed Above / > WMA(50)", status: "PASSED", note: "Golden moving average curvature confirmed" },
    { id: 8, rule: "Weekly WMA(30) > 60", status: "PASSED", note: "Upward sloping slope gradient" },
    { id: 9, rule: "Weekly WMA(50) > 60", status: "PASSED", note: "Base support confirmed" },
    { id: 10, rule: "Daily Close > Daily Open (Bullish Candle)", status: "PASSED", note: "Constructive green candle body with lower wick absorption" },
  ];

  const deliveryHistory = [
    { date: "02 Oct", volume: "18.4L", delivVol: "13.2L", delivPct: 71.8, vsAvg: "+240%", status: "DELIVERY BREAKOUT" },
    { date: "01 Oct", volume: "12.1L", delivVol: "7.8L",  delivPct: 64.5, vsAvg: "+180%", status: "ACCUMULATION" },
    { date: "30 Sep", volume: "9.5L",  delivVol: "5.4L",  delivPct: 56.8, vsAvg: "+110%", status: "NORMAL" },
    { date: "29 Sep", volume: "8.2L",  delivVol: "4.2L",  delivPct: 51.2, vsAvg: "+85%",  status: "NORMAL" },
    { date: "26 Sep", volume: "7.0L",  delivVol: "3.1L",  delivPct: 44.3, vsAvg: "+20%",  status: "DRY UP" },
  ];

  return (
    <div className="space-y-6">
      {/* 10-Condition Momentum Verification Audit */}
      <div className="rounded-2xl border border-slate-800 bg-[#081225] p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Rocket className="text-cyan-400" size={18} />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              Momentum Verification Audit ({momentumScore} of 10 Filters Passed)
            </h3>
          </div>
          <span className="px-3 py-1 rounded-full text-xs font-bold font-mono bg-cyan-950 text-cyan-300 border border-cyan-500/40">
            HIGH CONVICTION (90%)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {momentumRules.map((r) => {
            const isPassed = r.status === "PASSED";
            return (
              <div
                key={r.id}
                className={`p-3 rounded-xl border flex items-start justify-between gap-3 ${
                  isPassed
                    ? "border-emerald-500/20 bg-emerald-950/10"
                    : "border-slate-800 bg-slate-900/40"
                }`}
              >
                <div className="flex items-start gap-2 text-xs">
                  {isPassed ? (
                    <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle size={15} className="text-slate-500 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className={`font-mono font-bold ${isPassed ? "text-white" : "text-slate-400"}`}>
                      {r.rule}
                    </div>
                    <div className="text-[11px] text-slate-400 font-sans mt-0.5">{r.note}</div>
                  </div>
                </div>

                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono shrink-0 ${
                    isPassed
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                      : "bg-slate-800 text-slate-400 border border-slate-700"
                  }`}
                >
                  {r.status}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Delivery Flow & Institutional Accumulation */}
      <div className="rounded-2xl border border-slate-800 bg-[#081225] p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Package className="text-emerald-400" size={18} />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              Delivery Volume Surge & Cash Accumulation (Past 5 Sessions)
            </h3>
          </div>
          <span className="text-xs text-emerald-400 font-bold font-mono">+240% Surge Above Baseline</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 text-[11px] uppercase">
                <th className="py-2.5 px-3">Date</th>
                <th className="py-2.5 px-3">Total Traded Vol</th>
                <th className="py-2.5 px-3">Delivery Volume</th>
                <th className="py-2.5 px-3">Delivery %</th>
                <th className="py-2.5 px-3">vs 30D Average</th>
                <th className="py-2.5 px-3 text-right">Radar Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {deliveryHistory.map((d, idx) => (
                <tr key={idx} className="hover:bg-slate-900/40 transition">
                  <td className="py-2.5 px-3 font-bold text-white">{d.date}</td>
                  <td className="py-2.5 px-3 text-slate-300">{d.volume}</td>
                  <td className="py-2.5 px-3 text-cyan-300 font-bold">{d.delivVol}</td>
                  <td className="py-2.5 px-3 font-bold text-emerald-400">{d.delivPct}%</td>
                  <td className="py-2.5 px-3 text-emerald-300">{d.vsAvg}</td>
                  <td className="py-2.5 px-3 text-right">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        d.status === "DELIVERY BREAKOUT"
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse"
                          : d.status === "ACCUMULATION"
                          ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                          : "bg-slate-800 text-slate-400 border-slate-700"
                      }`}
                    >
                      {d.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

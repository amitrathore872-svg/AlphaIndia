"use client";

// =========================================================================
// Alpha India — Priority Focus Ribbon (Daily Top 3 Actionable Ideas)
// Surfaces the top 3 highest-conviction ideas across Technical, Fundamental, and Catalyst wires
// =========================================================================

import React from "react";
import { Sparkles, TrendingUp, Trophy, ArrowRight } from "lucide-react";
export interface ActionableOpportunity {
  id?: string;
  symbol: string;
  company?: string;
  sector?: string;
  cmp: number;
  playbook?: string;
  upsidePct: number;
  keyTrigger?: string;
}

interface PriorityFocusRibbonProps {
  opportunities: ActionableOpportunity[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function PriorityFocusRibbon({
  opportunities,
  selectedId,
  onSelect,
}: PriorityFocusRibbonProps) {
  // Find top VCP/Breakout, top Earnings/Growth, and top Catalyst
  const topBreakout = opportunities.find((o) => o.playbook === "vcp") || opportunities[0];
  const topGrowth = opportunities.find((o) => o.playbook === "breakout") || opportunities[1];
  const topCatalyst = opportunities.find((o) => o.playbook === "catalyst" || o.playbook === "earnings") || opportunities[2];

  const focusList = [
    {
      category: "TECHNICAL BREAKOUT",
      badge: "★ #1 VCP PIVOT",
      badgeClass: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border-cyan-500/30",
      icon: Sparkles,
      item: topBreakout,
    },
    {
      category: "FUNDAMENTAL COMPOUNDER",
      badge: "★ #1 ACCELERATOR",
      badgeClass: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30",
      icon: TrendingUp,
      item: topGrowth,
    },
    {
      category: "MEGA CATALYST / ORDER WIN",
      badge: "★ #1 MATERIAL FILING",
      badgeClass: "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30",
      icon: Trophy,
      item: topCatalyst,
    },
  ].filter((f) => f.item);

  if (focusList.length === 0) return null;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between pb-2 text-xs">
        <span className="font-extrabold uppercase tracking-wider text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Today&apos;s 3 Priority Focus Picks
        </span>
        <span className="text-[10px] text-slate-400">
          Ranked by multi-engine quantitative conviction
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {focusList.map((focus) => {
          const item = focus.item!;
          const isSelected = selectedId === (item.id || item.symbol);
          const Icon = focus.icon;

          return (
            <div
              key={focus.category}
              onClick={() => onSelect(item.id || item.symbol)}
              className={`flex items-center justify-between rounded-xl border p-3 transition-all cursor-pointer ${
                isSelected
                  ? "border-cyan-500 bg-cyan-500/10 dark:bg-cyan-950/40 shadow-md shadow-cyan-500/10"
                  : "border-slate-200/90 dark:border-slate-800 bg-white/90 dark:bg-[#071322]/90 hover:border-slate-300 dark:hover:border-slate-700"
              }`}
            >
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`rounded-md border px-1.5 py-0.2 text-[9px] font-black uppercase tracking-tight ${focus.badgeClass}`}>
                    {focus.badge}
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold">{item.sector}</span>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="font-black text-base text-slate-900 dark:text-white">
                    {item.symbol}
                  </span>
                  <span className="font-mono text-xs font-extrabold text-slate-700 dark:text-slate-300">
                    ₹{item.cmp.toLocaleString("en-IN")}
                  </span>
                  <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                    +{item.upsidePct}% Target
                  </span>
                </div>

                <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                  {item.keyTrigger}
                </p>
              </div>

              <div className="shrink-0 flex items-center justify-center h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-900 text-slate-500 group-hover:text-cyan-500 transition">
                <Icon size={16} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

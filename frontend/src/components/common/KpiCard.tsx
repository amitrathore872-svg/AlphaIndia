// =============================================================================
// Alpha India — <KpiCard /> Shared Component
// Sprint 33.4 — UI Consistency Pass
//
// Standardizes the metric/stat tiles that appear at the top of every radar
// and screener page (Total Scanned, Signals Found, Conviction Count, etc.)
//
// Usage:
//   <KpiCard label="Total Signals" value={234} sub="Equities" />
//   <KpiCard label="Bullish" value={67} sub="Buy Signals" color="emerald" icon={<ArrowUpRight />} />
//   <KpiCard label="Last Scan" value="14:32" sub="4s latency" mono />
// =============================================================================

import React from "react";

type KpiColor =
  | "default"
  | "cyan"
  | "emerald"
  | "amber"
  | "rose"
  | "purple"
  | "indigo";

interface KpiCardProps {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  color?: KpiColor;
  icon?: React.ReactNode;
  className?: string;
}

const colorMap: Record<
  KpiColor,
  { card: string; label: string; value: string; sub: string }
> = {
  default: {
    card: "border-slate-200 dark:border-slate-800/80 bg-white dark:bg-slate-900/60 shadow-xs dark:shadow-none",
    label: "text-slate-500 dark:text-slate-400",
    value: "text-slate-900 dark:text-white",
    sub: "text-slate-400 dark:text-slate-500",
  },
  cyan: {
    card: "border-cyan-500/20 bg-cyan-50/70 dark:bg-cyan-950/20",
    label: "text-cyan-700 dark:text-cyan-400",
    value: "text-cyan-950 dark:text-cyan-300",
    sub: "text-cyan-600/80 dark:text-cyan-400/70",
  },
  emerald: {
    card: "border-emerald-500/20 bg-emerald-50/70 dark:bg-emerald-950/20",
    label: "text-emerald-700 dark:text-emerald-400",
    value: "text-emerald-950 dark:text-emerald-300",
    sub: "text-emerald-600/80 dark:text-emerald-400/70",
  },
  amber: {
    card: "border-amber-500/20 bg-amber-50/70 dark:bg-amber-950/20",
    label: "text-amber-800 dark:text-amber-400",
    value: "text-amber-950 dark:text-amber-300",
    sub: "text-amber-700/80 dark:text-amber-400/70",
  },
  rose: {
    card: "border-rose-500/20 bg-rose-50/70 dark:bg-rose-950/20",
    label: "text-rose-700 dark:text-rose-400",
    value: "text-rose-950 dark:text-rose-300",
    sub: "text-rose-600/80 dark:text-rose-400/70",
  },
  purple: {
    card: "border-purple-500/20 bg-purple-50/70 dark:bg-purple-950/20",
    label: "text-purple-700 dark:text-purple-400",
    value: "text-purple-950 dark:text-purple-300",
    sub: "text-purple-600/80 dark:text-purple-400/70",
  },
  indigo: {
    card: "border-indigo-500/20 bg-indigo-50/70 dark:bg-indigo-950/20",
    label: "text-indigo-700 dark:text-indigo-400",
    value: "text-indigo-950 dark:text-indigo-300",
    sub: "text-indigo-600/80 dark:text-indigo-400/70",
  },
};

export default function KpiCard({
  label,
  value,
  sub,
  color = "default",
  icon,
  className = "",
}: KpiCardProps) {
  const c = colorMap[color];

  return (
    <div
      className={`rounded-xl border p-3.5 flex flex-col justify-between ${c.card} ${className}`}
    >
      {/* Label row */}
      <span
        className={`flex items-center gap-1 text-[10px] uppercase font-mono font-bold tracking-wider ${c.label}`}
      >
        {icon && <span className="opacity-80">{icon}</span>}
        {label}
      </span>

      {/* Value + sub row */}
      <div className="flex items-baseline justify-between mt-1.5 gap-2">
        <span className={`text-xl font-bold font-mono ${c.value}`}>
          {value}
        </span>
        {sub && (
          <span className={`text-[10px] font-mono shrink-0 ${c.sub}`}>
            {sub}
          </span>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// Alpha India — <PageBadge /> Shared Component
// Sprint 33.4 — UI Consistency Pass
//
// Standardizes inline badges next to h1 titles.
// All h1 badges → rounded-full
// All table/row status badges → rounded-md (use StatusBadge instead)
//
// Usage:
//   <PageBadge color="cyan">20 TRIPLE SETUPS</PageBadge>
//   <PageBadge color="emerald">CASH SEGMENT</PageBadge>
//   <PageBadge color="amber">INSTITUTIONAL APEX</PageBadge>
// =============================================================================

import React from "react";

type BadgeColor =
  | "cyan"
  | "emerald"
  | "amber"
  | "rose"
  | "purple"
  | "indigo"
  | "slate";

interface PageBadgeProps {
  color?: BadgeColor;
  children: React.ReactNode;
  className?: string;
}

const colorMap: Record<BadgeColor, string> = {
  cyan: "bg-cyan-50 border-cyan-500/30 text-cyan-700 dark:bg-cyan-950/80 dark:border-cyan-800/60 dark:text-cyan-300",
  emerald: "bg-emerald-50 border-emerald-500/30 text-emerald-700 dark:bg-emerald-950/80 dark:border-emerald-700/50 dark:text-emerald-300",
  amber: "bg-amber-50 border-amber-500/30 text-amber-800 dark:bg-amber-950/80 dark:border-amber-700/50 dark:text-amber-300",
  rose: "bg-rose-50 border-rose-500/30 text-rose-700 dark:bg-rose-950/80 dark:border-rose-700/50 dark:text-rose-300",
  purple: "bg-purple-50 border-purple-500/30 text-purple-700 dark:bg-purple-950/80 dark:border-purple-700/50 dark:text-purple-300",
  indigo: "bg-indigo-50 border-indigo-500/30 text-indigo-700 dark:bg-indigo-950/80 dark:border-indigo-700/50 dark:text-indigo-300",
  slate: "bg-slate-100 border-slate-300 text-slate-700 dark:bg-slate-800/80 dark:border-slate-700/60 dark:text-slate-300",
};

export default function PageBadge({
  color = "cyan",
  children,
  className = "",
}: PageBadgeProps) {
  return (
    <span
      className={`inline-flex items-center text-xs px-2.5 py-0.5 rounded-full font-mono font-semibold border ${colorMap[color]} ${className}`}
    >
      {children}
    </span>
  );
}

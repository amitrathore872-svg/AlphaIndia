// =============================================================================
// Alpha India — <FilterPill /> & <TabStrip /> Shared Components
// Sprint 33.4 — UI Consistency Pass
//
// Replaces mixed rounded-lg/rounded-xl, font-medium/font-bold tab buttons.
//
// Usage — FilterPill (single toggle button):
//   <FilterPill active={filter === "BULLISH"} onClick={() => setFilter("BULLISH")}>
//     Bullish (67)
//   </FilterPill>
//
// Usage — TabStrip (segmented control wrapper):
//   <TabStrip>
//     <FilterPill active={...} onClick={...}>Discovery</FilterPill>
//     <FilterPill active={...} onClick={...}>Watchlist</FilterPill>
//   </TabStrip>
// =============================================================================

import React from "react";

// ── TabStrip ─────────────────────────────────────────────────────────────────

interface TabStripProps {
  children: React.ReactNode;
  className?: string;
}

export function TabStrip({ children, className = "" }: TabStripProps) {
  return (
    <div
      className={`flex items-center gap-1 bg-slate-100 dark:bg-slate-950/80 p-1 rounded-lg border border-slate-200 dark:border-slate-800/60 ${className}`}
    >
      {children}
    </div>
  );
}

// ── FilterPill ────────────────────────────────────────────────────────────────

type PillColor = "cyan" | "emerald" | "amber" | "rose" | "purple";

interface FilterPillProps {
  active?: boolean;
  onClick?: () => void;
  color?: PillColor;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

const activeColorMap: Record<PillColor, string> = {
  cyan: "bg-cyan-600 text-white shadow-md shadow-cyan-900/40",
  emerald: "bg-emerald-600 text-white shadow-md shadow-emerald-900/40",
  amber: "bg-amber-500 text-black shadow-md shadow-amber-900/40",
  rose: "bg-rose-600 text-white shadow-md shadow-rose-900/40",
  purple: "bg-purple-600 text-white shadow-md shadow-purple-900/40",
};

export function FilterPill({
  active = false,
  onClick,
  color = "cyan",
  children,
  className = "",
  disabled = false,
}: FilterPillProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
        active
          ? activeColorMap[color]
          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800/60"
      } ${className}`}
    >
      {children}
    </button>
  );
}

// ── ActionButton ──────────────────────────────────────────────────────────────
// For scan / refresh / export action buttons in the header action slot

interface ActionButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "ghost";
  children: React.ReactNode;
  className?: string;
  type?: "button" | "submit" | "reset";
}

const variantMap = {
  primary:
    "border-cyan-500/40 bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/80",
  secondary:
    "border-slate-300 dark:border-slate-700/80 bg-white dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/80 hover:text-slate-900 dark:hover:text-white",
  ghost:
    "border-slate-200 dark:border-slate-800/60 bg-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/40",
};

export function ActionButton({
  onClick,
  disabled = false,
  variant = "secondary",
  children,
  className = "",
  type = "button",
}: ActionButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${variantMap[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

// =============================================================================
// Alpha India — <PageHeader /> Shared Component
// Sprint 33.4 — UI Consistency Pass
//
// Usage:
//   <PageHeader
//     eyebrow="Institutional Candlestick Pattern Radar"
//     icon={<Flame className="w-5 h-5" />}
//     iconColor="cyan"
//     title="Algorithmic Candlestick Screener"
//     badge={{ label: "20 TRIPLE SETUPS", color: "cyan" }}
//     subtitle="Mathematical pattern recognition scanning..."
//     actions={<button ...>Rescan</button>}
//   />
// =============================================================================

import React from "react";

type AccentColor = "cyan" | "emerald" | "amber" | "purple" | "rose" | "indigo";

interface BadgeProps {
  label: string;
  color: AccentColor;
}

interface PageHeaderProps {
  /** Small eyebrow text above the title — shown in monospace */
  eyebrow?: React.ReactNode;
  /** Icon element rendered inside the icon bubble (e.g. <Flame className="w-5 h-5" />) */
  icon?: React.ReactNode;
  /** Color theme of the icon bubble */
  iconColor?: AccentColor;
  /** Main h1 page title */
  title: string;
  /** Optional badge next to the title (e.g. engine name, version) */
  badge?: BadgeProps;
  /** Optional extra badges for secondary tags */
  extraBadges?: BadgeProps[];
  /** Subtitle / description below the title */
  subtitle?: React.ReactNode;
  /** Right-side action buttons / controls */
  actions?: React.ReactNode;
  /** Additional className for outer wrapper */
  className?: string;
}

const colorMap: Record<
  AccentColor,
  { icon: string; badge: string; eyebrow: string }
> = {
  cyan: {
    icon: "bg-cyan-500/10 border-cyan-500/30 text-cyan-600 dark:text-cyan-400",
    badge: "bg-cyan-50 border-cyan-500/30 text-cyan-700 dark:bg-cyan-950/80 dark:border-cyan-800/60 dark:text-cyan-300",
    eyebrow: "text-cyan-600 dark:text-cyan-400",
  },
  emerald: {
    icon: "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
    badge: "bg-emerald-50 border-emerald-500/30 text-emerald-700 dark:bg-emerald-950/80 dark:border-emerald-700/50 dark:text-emerald-300",
    eyebrow: "text-emerald-600 dark:text-emerald-400",
  },
  amber: {
    icon: "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400",
    badge: "bg-amber-50 border-amber-500/30 text-amber-800 dark:bg-amber-950/80 dark:border-amber-700/50 dark:text-amber-300",
    eyebrow: "text-amber-600 dark:text-amber-400",
  },
  purple: {
    icon: "bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400",
    badge: "bg-purple-50 border-purple-500/30 text-purple-700 dark:bg-purple-950/80 dark:border-purple-700/50 dark:text-purple-300",
    eyebrow: "text-purple-600 dark:text-purple-400",
  },
  rose: {
    icon: "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400",
    badge: "bg-rose-50 border-rose-500/30 text-rose-700 dark:bg-rose-950/80 dark:border-rose-700/50 dark:text-rose-300",
    eyebrow: "text-rose-600 dark:text-rose-400",
  },
  indigo: {
    icon: "bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-400",
    badge: "bg-indigo-50 border-indigo-500/30 text-indigo-700 dark:bg-indigo-950/80 dark:border-indigo-700/50 dark:text-indigo-300",
    eyebrow: "text-indigo-600 dark:text-indigo-400",
  },
};

export default function PageHeader({
  eyebrow,
  icon,
  iconColor = "cyan",
  title,
  badge,
  extraBadges,
  subtitle,
  actions,
  className = "",
}: PageHeaderProps) {
  const colors = colorMap[iconColor];

  return (
    <div
      className={`flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800/80 pb-5 ${className}`}
    >
      {/* Left: Icon + title block */}
      <div className="flex items-start gap-3 min-w-0">
        {icon && (
          <div
            className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border ${colors.icon}`}
          >
            {icon}
          </div>
        )}

        <div className="min-w-0 space-y-0.5">
          {/* Eyebrow */}
          {eyebrow && (
            <div
              className={`flex items-center gap-2 font-mono text-xs uppercase tracking-widest mb-1 ${colors.eyebrow}`}
            >
              {eyebrow}
            </div>
          )}

          {/* h1 + badges row */}
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {title}
            </h1>

            {badge && (
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-semibold border ${colorMap[badge.color].badge}`}
              >
                {badge.label}
              </span>
            )}

            {extraBadges?.map((b, i) => (
              <span
                key={i}
                className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-semibold border ${colorMap[b.color].badge}`}
              >
                {b.label}
              </span>
            ))}
          </div>

          {/* Subtitle */}
          {subtitle && (
            <p className="mt-0.5 text-xs md:text-sm text-slate-600 dark:text-slate-400 max-w-3xl">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Right: Actions */}
      {actions && (
        <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}

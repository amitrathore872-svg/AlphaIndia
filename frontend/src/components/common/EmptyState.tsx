// =============================================================================
// Alpha India — <EmptyState /> Shared Component
// Sprint 33.4 — UI Consistency Pass
//
// Standardizes empty state UI across all radar/screener pages.
//
// Usage:
//   <EmptyState
//     icon={<Search className="w-8 h-8" />}
//     title="No signals found"
//     description="Try adjusting your filters or trigger a fresh scan."
//     action={<button onClick={scan}>Rescan Universe</button>}
//   />
// =============================================================================

import React from "react";
import { SearchX } from "lucide-react";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title?: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export default function EmptyState({
  icon,
  title = "No results found",
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-4 rounded-2xl border border-slate-200 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/30 px-6 py-14 text-center ${className}`}
    >
      {/* Icon */}
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 shadow-xs">
        {icon ?? <SearchX className="h-7 w-7" />}
      </div>

      {/* Text block */}
      <div className="space-y-1.5 max-w-sm">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-300">{title}</p>
        {description && (
          <p className="text-xs text-slate-600 dark:text-slate-500 leading-relaxed">{description}</p>
        )}
      </div>

      {/* Optional CTA */}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

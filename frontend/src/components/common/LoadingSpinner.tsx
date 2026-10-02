// =============================================================================
// Alpha India — <LoadingSpinner /> Shared Component
// Sprint 33.4 — UI Consistency Pass
//
// Replaces 3 different spinner approaches:
//   - rounded-full border-t-transparent divs
//   - <RefreshCw animate-spin> (wrong — RefreshCw is an action icon)
//   - <Activity animate-spin> (wrong semantic)
//
// Usage:
//   <LoadingSpinner />                        — inline sm (16px)
//   <LoadingSpinner size="md" />              — inline md (20px)
//   <LoadingSpinner size="lg" label="Scanning universe..." />  — full-page
//   <LoadingSpinner size="page" label="Loading..." />          — full-height page
// =============================================================================

import React from "react";

type SpinnerSize = "sm" | "md" | "lg" | "page";
type SpinnerColor = "cyan" | "emerald" | "amber";

interface LoadingSpinnerProps {
  size?: SpinnerSize;
  color?: SpinnerColor;
  label?: string;
  className?: string;
}

const sizeMap: Record<SpinnerSize, string> = {
  sm: "h-4 w-4 border-2",
  md: "h-5 w-5 border-2",
  lg: "h-8 w-8 border-2",
  page: "h-10 w-10 border-[3px]",
};

const colorMap: Record<SpinnerColor, string> = {
  cyan: "border-cyan-500 border-t-transparent",
  emerald: "border-emerald-500 border-t-transparent",
  amber: "border-amber-400 border-t-transparent",
};

export default function LoadingSpinner({
  size = "sm",
  color = "cyan",
  label,
  className = "",
}: LoadingSpinnerProps) {
  const isFullPage = size === "page";
  const isLarge = size === "lg" || size === "page";

  if (isFullPage || (isLarge && label)) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-3 py-12 ${isFullPage ? "min-h-[60vh]" : ""} ${className}`}
      >
        <div
          className={`animate-spin rounded-full ${sizeMap[size]} ${colorMap[color]}`}
        />
        {label && (
          <p className="text-xs font-mono text-slate-400 animate-pulse">
            {label}
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      className={`animate-spin rounded-full ${sizeMap[size]} ${colorMap[color]} ${className}`}
    />
  );
}

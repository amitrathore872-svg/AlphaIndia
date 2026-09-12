"use client";

// =======================================================
// Alpha India Design System
// Sprint 32.8.1
// Bloomberg Style Heatmap Cells
// =======================================================

interface HeatmapCellProps {
  value?: number | string | null;
  suffix?: string;
  label?: string;
}

function normalize(value: number | string | null | undefined) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function getColors(value: number) {
  if (value >= 30)
    return {
      bg: "bg-emerald-500/25",
      border: "border-emerald-500/40",
      text: "text-emerald-300",
    };

  if (value >= 20)
    return {
      bg: "bg-green-500/20",
      border: "border-green-500/30",
      text: "text-green-300",
    };

  if (value >= 10)
    return {
      bg: "bg-lime-500/20",
      border: "border-lime-500/30",
      text: "text-lime-300",
    };

  if (value >= 5)
    return {
      bg: "bg-amber-500/20",
      border: "border-amber-500/30",
      text: "text-amber-300",
    };

  if (value >= 0)
    return {
      bg: "bg-slate-800",
      border: "border-slate-700",
      text: "text-slate-300",
    };

  if (value >= -10)
    return {
      bg: "bg-red-500/15",
      border: "border-red-500/25",
      text: "text-red-300",
    };

  return {
    bg: "bg-red-600/20",
    border: "border-red-600/40",
    text: "text-red-200",
  };
}

export default function GrowthHeatmap({
  value,
  suffix = "%",
  label,
}: HeatmapCellProps) {
  const number = normalize(value);
  const colors = getColors(number);

  return (
    <div
      className={`rounded-xl border px-3 py-2 transition-all hover:scale-[1.02] ${colors.bg} ${colors.border}`}
    >
      {label && (
        <p className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">
          {label}
        </p>
      )}

      <div className={`text-sm font-bold ${colors.text}`}>
        {number > 0 ? "+" : ""}
        {number.toFixed(2)}
        {suffix}
      </div>
    </div>
  );
}

// -------------------------------------------------------
// Compact Version (Table Cell)
// -------------------------------------------------------

interface CompactHeatmapProps {
  value?: number | string | null;
}

export function CompactHeatmap({
  value,
}: CompactHeatmapProps) {
  const number = normalize(value);
  const colors = getColors(number);

  return (
    <span
      className={`inline-flex min-w-[76px] items-center justify-center rounded-lg border px-2 py-1 text-xs font-semibold ${colors.bg} ${colors.border} ${colors.text}`}
    >
      {number > 0 ? "+" : ""}
      {number.toFixed(1)}%
    </span>
  );
}
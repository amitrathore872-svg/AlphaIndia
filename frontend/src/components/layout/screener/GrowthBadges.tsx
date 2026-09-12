"use client";

// =======================================================
// Alpha India Design System
// Sprint 32.8.1
// Reusable Health + AI Score Badges
// =======================================================

interface HealthBadgeProps {
  status?: string | null;
}

interface AIScoreBadgeProps {
  score?: number | null;
}

// -------------------------------------------------------
// Health Badge
// -------------------------------------------------------

export function HealthBadge({ status }: HealthBadgeProps) {
  const value = (status ?? "PENDING").toUpperCase();

  const styles: Record<string, string> = {
    PASS: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
    WARNING: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
    FAIL: "bg-red-500/15 text-red-400 border border-red-500/30",
    PENDING: "bg-slate-700/30 text-slate-400 border border-slate-600",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold tracking-wide ${
        styles[value] || styles.PENDING
      }`}
    >
      {value}
    </span>
  );
}

// -------------------------------------------------------
// AI Score Badge
// -------------------------------------------------------

export function AIScoreBadge({ score }: AIScoreBadgeProps) {
  const value = Number(score ?? 0);

  let style =
    "bg-slate-700/30 text-slate-300 border border-slate-600";

  if (value >= 90)
    style =
      "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30";
  else if (value >= 80)
    style =
      "bg-green-500/15 text-green-400 border border-green-500/30";
  else if (value >= 70)
    style =
      "bg-amber-500/15 text-amber-400 border border-amber-500/30";
  else if (value > 0)
    style =
      "bg-red-500/15 text-red-400 border border-red-500/30";

  return (
    <span
      className={`inline-flex min-w-[54px] items-center justify-center rounded-full px-3 py-1 text-xs font-bold tracking-wide ${style}`}
    >
      {value > 0 ? value.toFixed(0) : "--"}
    </span>
  );
}

// -------------------------------------------------------
// Growth Badge (Revenue / PAT / ROCE)
// -------------------------------------------------------

interface GrowthBadgeProps {
  value?: number | string | null;
  suffix?: string;
}

export function GrowthBadge({
  value,
  suffix = "%",
}: GrowthBadgeProps) {
  const num = Number(value ?? 0);

  let style = "text-slate-300";

  if (num >= 20) style = "text-emerald-400";
  else if (num >= 10) style = "text-green-400";
  else if (num >= 5) style = "text-amber-400";
  else if (num < 0) style = "text-red-400";

  return (
    <span className={`font-semibold ${style}`}>
      {num > 0 ? "+" : ""}
      {num.toFixed(2)}
      {suffix}
    </span>
  );
}

// -------------------------------------------------------
// Market Cap Formatter
// -------------------------------------------------------

interface MarketCapBadgeProps {
  value?: number | string | null;
}

export function MarketCapBadge({ value }: MarketCapBadgeProps) {
  const amount = Number(value ?? 0);

  if (!amount || isNaN(amount)) {
    return (
      <span className="text-slate-500 text-sm">Unknown</span>
    );
  }

  let formatted = "";

  if (amount >= 100000) {
    formatted = `₹ ${(amount / 100000).toFixed(2)} L Cr`;
  } else if (amount >= 1000) {
    formatted = `₹ ${(amount / 1000).toFixed(2)} Cr`;
  } else {
    formatted = `₹ ${amount.toFixed(0)} Cr`;
  }

  return (
    <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-400">
      {formatted}
    </span>
  );
}
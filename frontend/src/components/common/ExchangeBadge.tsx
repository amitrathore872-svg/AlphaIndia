"use client";

import { useMemo } from "react";
import { Clock } from "lucide-react";

interface ExchangeBadgeProps {
  exchange?: string;
  size?: "sm" | "md";
  className?: string;
}

export function ExchangeBadge({
  exchange = "NSE",
  size = "sm",
  className = "",
}: ExchangeBadgeProps) {
  const isNse = exchange.toUpperCase().includes("NSE");
  const isBse = exchange.toUpperCase().includes("BSE");

  const colorStyle = isNse
    ? "bg-cyan-950/80 text-cyan-400 border-cyan-500/30"
    : isBse
    ? "bg-amber-950/80 text-amber-400 border-amber-500/30"
    : "bg-slate-800 text-slate-400 border-slate-700";

  const sizeStyle = size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs";

  return (
    <span
      className={`inline-flex items-center font-mono font-bold tracking-wider rounded border uppercase ${colorStyle} ${sizeStyle} ${className}`}
    >
      {exchange.toUpperCase()}
    </span>
  );
}

interface FreshnessBadgeProps {
  timestamp?: string | null;
  className?: string;
}

export function FreshnessBadge({ timestamp, className = "" }: FreshnessBadgeProps) {
  const { label, colorClass } = useMemo(() => {
    if (!timestamp) {
      return { label: "ARCHIVE", colorClass: "text-slate-500 bg-slate-900/60 border-slate-800" };
    }

    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = Math.max(0, now.getTime() - date.getTime());
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 60) {
      return {
        label: diffMinutes <= 5 ? "JUST IN" : `${diffMinutes}m ago`,
        isRecent: true,
        colorClass: "text-emerald-400 bg-emerald-950/80 border-emerald-500/40 font-bold",
      };
    }

    if (diffHours < 24) {
      return {
        label: `${diffHours}h ago`,
        isRecent: true,
        colorClass: "text-cyan-400 bg-cyan-950/70 border-cyan-500/30",
      };
    }

    if (diffDays <= 7) {
      return {
        label: `${diffDays}d ago`,
        isRecent: false,
        colorClass: "text-slate-400 bg-slate-900 border-slate-800",
      };
    }

    return {
      label: date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
      isRecent: false,
      colorClass: "text-slate-500 bg-slate-900/60 border-slate-800",
    };
  }, [timestamp]);

  return (
    <span
      className={`inline-flex items-center gap-1 font-mono text-[10px] px-2 py-0.5 rounded-full border ${colorClass} ${className}`}
    >
      <Clock className="w-2.5 h-2.5 opacity-80" />
      {label}
    </span>
  );
}

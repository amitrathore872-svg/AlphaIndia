"use client";

import React from "react";
import { TrendingUp, TrendingDown, Activity, AlertTriangle } from "lucide-react";

interface StageBadgeProps {
  stage?: string;
  stageCode?: string;
  cmp?: number;
  dma50?: number;
  dma200?: number;
  size?: "xs" | "sm" | "md";
  className?: string;
}

export default function StageBadge({
  stage,
  stageCode,
  cmp,
  dma50,
  dma200,
  size = "xs",
  className = "",
}: StageBadgeProps) {
  // Determine canonical stage key: "STAGE_1" | "STAGE_2" | "STAGE_3" | "STAGE_4"
  let resolvedStage = "STAGE_1";
  let label = "Stage 1";
  let description = "Accumulation Base: Institutional Base Building";

  const raw = (stageCode || stage || "").toUpperCase();

  if (raw.includes("STAGE_2") || raw.includes("STAGE 2") || raw.includes("MARKUP")) {
    resolvedStage = "STAGE_2";
    label = "Stage 2";
    description = "Markup Phase: Strong Institutional Uptrend (Price > 50DMA > 200DMA)";
  } else if (raw.includes("STAGE_3") || raw.includes("STAGE 3") || raw.includes("DISTRIBUTION")) {
    resolvedStage = "STAGE_3";
    label = "Stage 3";
    description = "Distribution Phase: Institutional Profit Booking (Price < 50DMA)";
  } else if (raw.includes("STAGE_4") || raw.includes("STAGE 4") || raw.includes("DOWNTREND")) {
    resolvedStage = "STAGE_4";
    label = "Stage 4";
    description = "Downtrend / Capitulation: Institutional Exit (Price < 50DMA & 200DMA)";
  } else if (raw.includes("STAGE_1") || raw.includes("STAGE 1") || raw.includes("BASE")) {
    resolvedStage = "STAGE_1";
    label = "Stage 1";
    description = "Accumulation Base: Institutional Base Building";
  } else if (cmp && dma50 && dma200) {
    if (cmp >= dma50 && dma50 >= dma200) {
      resolvedStage = "STAGE_2";
      label = "Stage 2";
      description = "Markup Phase: Strong Institutional Uptrend (Price > 50DMA > 200DMA)";
    } else if (cmp < dma50 && dma50 >= dma200) {
      resolvedStage = "STAGE_3";
      label = "Stage 3";
      description = "Distribution Phase: Institutional Profit Booking (Price < 50DMA)";
    } else if (cmp < dma50 && cmp < dma200) {
      resolvedStage = "STAGE_4";
      label = "Stage 4";
      description = "Downtrend / Capitulation: Institutional Exit (Price < 50DMA & 200DMA)";
    } else {
      resolvedStage = "STAGE_1";
      label = "Stage 1";
      description = "Accumulation Base: Institutional Base Building";
    }
  }

  // Visual styling configs
  const STYLES: Record<string, { bg: string; text: string; border: string; icon: React.ElementType }> = {
    STAGE_2: {
      bg: "bg-emerald-500/15 dark:bg-emerald-500/20",
      text: "text-emerald-700 dark:text-emerald-400",
      border: "border-emerald-500/30 dark:border-emerald-500/40",
      icon: TrendingUp,
    },
    STAGE_1: {
      bg: "bg-cyan-500/15 dark:bg-cyan-500/20",
      text: "text-cyan-700 dark:text-cyan-300",
      border: "border-cyan-500/30 dark:border-cyan-500/40",
      icon: Activity,
    },
    STAGE_3: {
      bg: "bg-amber-500/15 dark:bg-amber-500/20",
      text: "text-amber-700 dark:text-amber-400",
      border: "border-amber-500/30 dark:border-amber-500/40",
      icon: AlertTriangle,
    },
    STAGE_4: {
      bg: "bg-rose-500/15 dark:bg-rose-500/20",
      text: "text-rose-700 dark:text-rose-400",
      border: "border-rose-500/30 dark:border-rose-500/40",
      icon: TrendingDown,
    },
  };

  const currentStyle = STYLES[resolvedStage] || STYLES.STAGE_1;
  const Icon = currentStyle.icon;

  const sizeClasses = {
    xs: "text-[10px] px-1.5 py-0.5 gap-1",
    sm: "text-[11px] px-2 py-0.5 gap-1",
    md: "text-xs px-2.5 py-1 gap-1.5",
  }[size];

  return (
    <span
      className={`inline-flex items-center font-bold font-mono rounded-md border shrink-0 transition-all ${currentStyle.bg} ${currentStyle.text} ${currentStyle.border} ${sizeClasses} ${className}`}
      title={description}
    >
      <Icon className="w-2.5 h-2.5 shrink-0" />
      <span>{label}</span>
    </span>
  );
}

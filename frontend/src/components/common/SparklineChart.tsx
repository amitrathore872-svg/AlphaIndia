"use client";

import React, { useId, useMemo } from "react";

interface SparklineChartProps {
  data?: number[];
  cmp?: number;
  return90d?: number;
  return3m?: number;
  dma50?: number;
  width?: number;
  height?: number;
  color?: string;
  fillOpacity?: number;
  showDot?: boolean;
  strokeWidth?: number;
  showBadge?: boolean;
  periodLabel?: string;
  className?: string;
}

export default function SparklineChart({
  data,
  cmp,
  return90d,
  return3m,
  dma50,
  width = 86,
  height = 26,
  color,
  fillOpacity = 0.18,
  showDot = true,
  strokeWidth = 1.65,
  showBadge = false,
  periodLabel = "90D",
  className = "",
}: SparklineChartProps) {
  const gradientId = useId();

  const validPoints = useMemo(() => {
    if (data && data.length >= 2) {
      const clean = data.filter((n) => typeof n === "number" && !isNaN(n) && isFinite(n));
      if (clean.length >= 2) return clean;
    }

    // Synthesize 18-point 90-day trajectory if cmp is provided
    if (cmp && cmp > 0) {
      const effectiveRet = return90d ?? return3m ?? 4.5;
      const rFactor = 1.0 + effectiveRet / 100.0;
      const startP = rFactor > 0.05 ? cmp / rFactor : cmp * 0.92;
      const midP = dma50 && dma50 > 0 ? dma50 : (startP + cmp) / 2.0;

      const synthesized: number[] = [];
      for (let i = 0; i < 18; i++) {
        const t = i / 17.0;
        const val = (1.0 - t) ** 2 * startP + 2.0 * (1.0 - t) * t * midP + t ** 2 * cmp;
        const wave = Math.sin(t * Math.PI * 3.5) * (cmp * 0.012);
        synthesized.push(Number((val + wave).toFixed(2)));
      }
      synthesized[synthesized.length - 1] = Number(cmp.toFixed(2));
      return synthesized;
    }

    return null;
  }, [data, cmp, return90d, return3m, dma50]);

  const chartMetrics = useMemo(() => {
    if (!validPoints || validPoints.length < 2) return null;

    const min = Math.min(...validPoints);
    const max = Math.max(...validPoints);
    const range = max - min || 1;
    const padX = 3;
    const padY = 3;
    const drawW = width - padX * 2;
    const drawH = height - padY * 2;

    const coords = validPoints.map((val, idx) => {
      const x = padX + (idx / (validPoints.length - 1)) * drawW;
      const y = padY + drawH - ((val - min) / range) * drawH;
      return [x, y];
    });

    // Build smooth cubic bezier curve
    let d = `M ${coords[0][0].toFixed(1)} ${coords[0][1].toFixed(1)}`;
    for (let i = 0; i < coords.length - 1; i++) {
      const [x0, y0] = coords[i];
      const [x1, y1] = coords[i + 1];
      const mx = (x0 + x1) / 2;
      d += ` C ${mx.toFixed(1)} ${y0.toFixed(1)}, ${mx.toFixed(1)} ${y1.toFixed(1)}, ${x1.toFixed(1)} ${y1.toFixed(1)}`;
    }

    const first = coords[0];
    const last = coords[coords.length - 1];
    const fill = `${d} L ${last[0].toFixed(1)} ${height} L ${first[0].toFixed(1)} ${height} Z`;

    const firstVal = validPoints[0] || 1;
    const lastVal = validPoints[validPoints.length - 1] || 1;
    const pctChange = ((lastVal - firstVal) / firstVal) * 100;
    const isUp = pctChange >= 0;

    const defaultStroke = isUp ? "#10b981" : "#f43f5e";
    const resolvedStroke = color || defaultStroke;

    return {
      pathD: d,
      fillD: fill,
      strokeColor: resolvedStroke,
      lastX: last[0],
      lastY: last[1],
      minVal: min,
      maxVal: max,
      lastVal: lastVal,
      pctChange,
      isUp,
    };
  }, [validPoints, width, height, color]);

  if (!chartMetrics) {
    return (
      <div className={`inline-flex items-center justify-center text-slate-400 dark:text-slate-600 font-mono text-[10px] ${className}`}>
        <span className="w-12 h-0.5 bg-slate-300 dark:bg-slate-700/60 rounded-full" />
      </div>
    );
  }

  const { pathD, fillD, strokeColor, lastX, lastY, minVal, maxVal, lastVal, pctChange, isUp } = chartMetrics;

  const tooltipText = `${periodLabel} Trend: ${pctChange >= 0 ? "+" : ""}${pctChange.toFixed(1)}% | Low: ₹${minVal.toLocaleString("en-IN", { maximumFractionDigits: 1 })} | High: ₹${maxVal.toLocaleString("en-IN", { maximumFractionDigits: 1 })} | Latest: ₹${lastVal.toLocaleString("en-IN", { maximumFractionDigits: 1 })}`;

  return (
    <div
      className={`inline-flex items-center gap-1.5 group relative cursor-pointer select-none ${className}`}
      title={tooltipText}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity={fillOpacity} />
            <stop offset="100%" stopColor={strokeColor} stopOpacity={0.0} />
          </linearGradient>
        </defs>

        {/* Shaded Area under smooth curve */}
        <path d={fillD} fill={`url(#${gradientId})`} />

        {/* Smooth Bezier Line */}
        <path
          d={pathD}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Glowing terminal dot at latest price */}
        {showDot && (
          <>
            <circle
              cx={lastX}
              cy={lastY}
              r={2.8}
              fill={strokeColor}
              className="animate-pulse opacity-80"
            />
            <circle cx={lastX} cy={lastY} r={1.5} fill="#ffffff" />
          </>
        )}
      </svg>

      {showBadge && (
        <span
          className={`font-mono text-[10px] font-bold shrink-0 ${
            isUp
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-rose-600 dark:text-rose-400"
          }`}
        >
          {isUp ? "+" : ""}
          {pctChange.toFixed(1)}%
        </span>
      )}
    </div>
  );
}

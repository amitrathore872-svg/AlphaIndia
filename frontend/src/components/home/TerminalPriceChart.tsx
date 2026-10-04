"use client";

// =========================================================================
// Alpha India — Terminal Interactive Price & Execution Levels Chart
// Renders dynamic SVG price trajectory with Entry, Target, and Stop Loss levels
// =========================================================================

import React, { useState } from "react";

interface TerminalPriceChartProps {
  symbol: string;
  cmp: number;
  targetPrice: number;
  stopLoss: number;
  upsidePct: number;
  sparkline: number[];
  className?: string;
}

export default function TerminalPriceChart({
  symbol,
  cmp,
  targetPrice,
  stopLoss,
  upsidePct,
  sparkline,
  className = "",
}: TerminalPriceChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // Generate 14-day price series scaled to current CMP
  const basePrices = sparkline && sparkline.length >= 7 ? sparkline : [40, 42, 45, 43, 48, 52, 58, 62, 60, 68, 72, 75, 74, 80];
  const lastBase = basePrices[basePrices.length - 1] || 1;
  const priceData = basePrices.map((val) => Number((cmp * (val / lastBase)).toFixed(2)));

  const minPrice = Math.min(...priceData, stopLoss * 0.98);
  const maxPrice = Math.max(...priceData, targetPrice * 1.02);
  const priceRange = maxPrice - minPrice || 1;

  const width = 480;
  const height = 180;
  const paddingX = 40;
  const paddingY = 24;

  const getY = (price: number) => {
    return height - paddingY - ((price - minPrice) / priceRange) * (height - 2 * paddingY);
  };

  const getX = (idx: number) => {
    return paddingX + (idx / (priceData.length - 1)) * (width - 2 * paddingX);
  };

  const points = priceData
    .map((price, idx) => `${getX(idx).toFixed(1)},${getY(price).toFixed(1)}`)
    .join(" ");

  const areaPoints = `${getX(0)},${height - paddingY} ${points} ${getX(
    priceData.length - 1
  )},${height - paddingY}`;

  const targetY = getY(targetPrice);
  const stopLossY = getY(stopLoss);
  const cmpY = getY(cmp);

  const activeHoverPrice = hoverIndex !== null ? priceData[hoverIndex] : null;

  return (
    <div className={`relative overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/80 p-3 select-none ${className}`}>
      {/* Top Chart Header */}
      <div className="flex items-center justify-between text-xs pb-1 mb-1 border-b border-slate-200/60 dark:border-slate-800/60">
        <div className="flex items-center gap-2">
          <span className="font-mono font-black text-slate-900 dark:text-white">{symbol} Execution Levels</span>
          <span className="text-[10px] text-slate-400">14-Day Setup & Targets</span>
        </div>

        <div className="flex items-center gap-3 font-mono text-[11px]">
          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            T1: ₹{targetPrice.toLocaleString("en-IN")} (+{upsidePct}%)
          </span>
          <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 font-bold">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            SL: ₹{stopLoss.toLocaleString("en-IN")}
          </span>
        </div>
      </div>

      {/* SVG Canvas */}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-36 overflow-visible cursor-crosshair"
        onMouseLeave={() => setHoverIndex(null)}
      >
        <defs>
          <linearGradient id={`grad-${symbol}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#00F0FF" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#00F0FF" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Target Price Line (Green Dotted) */}
        {targetY >= 0 && targetY <= height && (
          <g>
            <line
              x1={paddingX}
              y1={targetY}
              x2={width - paddingX}
              y2={targetY}
              stroke="#10B981"
              strokeWidth="1.5"
              strokeDasharray="4 3"
              opacity="0.85"
            />
            <text
              x={width - paddingX + 4}
              y={targetY + 3}
              fill="#10B981"
              fontSize="9"
              fontWeight="bold"
              fontFamily="monospace"
            >
              T1
            </text>
          </g>
        )}

        {/* Stop Loss Line (Red Dotted) */}
        {stopLossY >= 0 && stopLossY <= height && (
          <g>
            <line
              x1={paddingX}
              y1={stopLossY}
              x2={width - paddingX}
              y2={stopLossY}
              stroke="#EF4444"
              strokeWidth="1.5"
              strokeDasharray="4 3"
              opacity="0.85"
            />
            <text
              x={width - paddingX + 4}
              y={stopLossY + 3}
              fill="#EF4444"
              fontSize="9"
              fontWeight="bold"
              fontFamily="monospace"
            >
              SL
            </text>
          </g>
        )}

        {/* Current Entry Level (Cyan Solid) */}
        {cmpY >= 0 && cmpY <= height && (
          <line
            x1={paddingX}
            y1={cmpY}
            x2={width - paddingX}
            y2={cmpY}
            stroke="#06B6D4"
            strokeWidth="1"
            strokeDasharray="2 2"
            opacity="0.5"
          />
        )}

        {/* Area fill */}
        <polygon fill={`url(#grad-${symbol})`} points={areaPoints} />

        {/* Price Line */}
        <polyline
          fill="none"
          stroke="#00F0FF"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />

        {/* Interactive Data Points & Hover Targets */}
        {priceData.map((price, idx) => {
          const cx = getX(idx);
          const cy = getY(price);
          const isHovered = hoverIndex === idx;

          return (
            <g key={idx} onMouseEnter={() => setHoverIndex(idx)}>
              <circle
                cx={cx}
                cy={cy}
                r={isHovered ? 5 : 2}
                fill={isHovered ? "#FFFFFF" : "#00F0FF"}
                stroke="#081426"
                strokeWidth={isHovered ? 2 : 1}
              />
              <rect
                x={cx - (width / priceData.length) / 2}
                y={0}
                width={width / priceData.length}
                height={height}
                fill="transparent"
              />
            </g>
          );
        })}

        {/* Hover Crosshair & Price Bubble */}
        {hoverIndex !== null && activeHoverPrice !== null && (
          <g>
            <line
              x1={getX(hoverIndex)}
              y1={paddingY}
              x2={getX(hoverIndex)}
              y2={height - paddingY}
              stroke="#64748B"
              strokeWidth="1"
              strokeDasharray="2 2"
            />
            <rect
              x={getX(hoverIndex) - 34}
              y={getY(activeHoverPrice) - 22}
              width="68"
              height="18"
              rx="4"
              fill="#0F172A"
              stroke="#00F0FF"
              strokeWidth="1"
            />
            <text
              x={getX(hoverIndex)}
              y={getY(activeHoverPrice) - 9}
              textAnchor="middle"
              fill="#FFFFFF"
              fontSize="10"
              fontWeight="bold"
              fontFamily="monospace"
            >
              ₹{activeHoverPrice.toLocaleString("en-IN")}
            </text>
          </g>
        )}
      </svg>

      {/* Axis Footer */}
      <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pt-1">
        <span>Day -14 (Base Setup)</span>
        <span>Today (CMP: ₹{cmp.toLocaleString("en-IN")})</span>
        <span className="text-emerald-500 font-bold">Target Zone</span>
      </div>
    </div>
  );
}

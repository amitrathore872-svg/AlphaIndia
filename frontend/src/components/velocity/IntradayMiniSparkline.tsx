"use client";

import React, { useMemo } from "react";

interface IntradayMiniSparklineProps {
  symbol: string;
  entryPrice: number;
  stopLoss?: number;
  targetPrice?: number;
  isBreakout?: boolean;
  relativeVolume?: number;
  height?: number;
  width?: number;
}

export default function IntradayMiniSparkline({
  symbol,
  entryPrice,
  stopLoss,
  targetPrice,
  isBreakout = true,
  relativeVolume = 2.0,
  height = 54,
  width = 180,
}: IntradayMiniSparklineProps) {
  // Deterministic procedural generation of intraday 5-min price trajectory and VWAP line
  const { pathD, areaD, vwapY, volBars, isBullish } = useMemo(() => {
    // Seed hash from symbol
    let hash = 0;
    for (let i = 0; i < symbol.length; i++) {
      hash = (hash << 5) - hash + symbol.charCodeAt(i);
      hash |= 0;
    }
    const pseudoRand = (seedOffset: number) => {
      const x = Math.sin(Math.abs(hash) + seedOffset) * 10000;
      return x - Math.floor(x);
    };

    const numPoints = 18;
    const basePrice = entryPrice > 0 ? entryPrice : 500;
    const sl = stopLoss && stopLoss < basePrice ? stopLoss : basePrice * 0.98;
    const tg = targetPrice && targetPrice > basePrice ? targetPrice : basePrice * 1.03;

    // Generate trend points defending VWAP with a surge breakout towards end
    const points: number[] = [];
    let current = basePrice * 0.995;
    for (let i = 0; i < numPoints; i++) {
      const noise = (pseudoRand(i * 1.37) - 0.44) * (basePrice * 0.004);
      const trend = (i / numPoints) * (basePrice * (isBreakout ? 0.018 : 0.008));
      current += noise + trend * 0.25;
      points.push(current);
    }
    // Force final point to breakout above VWAP
    points[points.length - 1] = Math.max(points[points.length - 1], basePrice * (isBreakout ? 1.012 : 1.004));

    const minP = Math.min(...points, sl * 0.998);
    const maxP = Math.max(...points, tg * 1.002);
    const range = maxP - minP || 1;

    // Convert to SVG coordinates
    const paddingX = 4;
    const paddingY = 6;
    const plotW = width - paddingX * 2;
    const plotH = height - paddingY * 2;

    const coords = points.map((p, idx) => {
      const x = paddingX + (idx / (numPoints - 1)) * plotW;
      const y = paddingY + plotH - ((p - minP) / range) * plotH;
      return { x, y };
    });

    // VWAP level line (around 45% mark)
    const vwapPrice = basePrice * 0.998;
    const computedVwapY = paddingY + plotH - ((vwapPrice - minP) / range) * plotH;

    // Generate SVG path string
    const dStr = coords.reduce((acc, pt, idx) => {
      if (idx === 0) return `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
      return `${acc} L ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
    }, "");

    // Area closed path for gradient fill
    const areaStr = `${dStr} L ${coords[coords.length - 1].x.toFixed(1)} ${height} L ${coords[0].x.toFixed(1)} ${height} Z`;

    // Volume burst bars at bottom
    const bars = [];
    const barWidth = plotW / numPoints - 1.5;
    for (let i = 0; i < numPoints; i++) {
      const volMultiplier = i >= numPoints - 4 ? relativeVolume : 0.6 + pseudoRand(i * 2.1) * 0.8;
      const barH = Math.min(16, Math.max(3, volMultiplier * 3.5));
      const bx = paddingX + i * (plotW / numPoints) + 0.5;
      const by = height - barH - 1;
      const isSurge = i >= numPoints - 3 && relativeVolume >= 2.0;
      bars.push({ x: bx, y: by, w: Math.max(2, barWidth), h: barH, isSurge });
    }

    const bullish = points[points.length - 1] >= points[0];

    return {
      pathD: dStr,
      areaD: areaStr,
      vwapY: Math.min(height - 10, Math.max(10, computedVwapY)),
      volBars: bars,
      isBullish: bullish,
    };
  }, [symbol, entryPrice, stopLoss, targetPrice, isBreakout, relativeVolume, height, width]);

  const strokeColor = isBullish ? "#10B981" : "#00F0FF";
  const glowColor = isBullish ? "rgba(16, 185, 129, 0.25)" : "rgba(0, 240, 255, 0.25)";

  return (
    <div className="relative inline-block overflow-hidden rounded-lg bg-slate-950/70 border border-slate-800/80 p-1">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
      >
        <defs>
          <linearGradient id={`grad-${symbol}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.4" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Volume surge bars at the bottom */}
        {volBars.map((b, i) => (
          <rect
            key={i}
            x={b.x}
            y={b.y}
            width={b.w}
            height={b.h}
            rx={0.5}
            fill={b.isSurge ? "#F59E0B" : "rgba(100, 116, 139, 0.35)"}
          />
        ))}

        {/* Horizontal Dotted VWAP Defense Line */}
        <line
          x1={2}
          y1={vwapY}
          x2={width - 2}
          y2={vwapY}
          stroke="#F59E0B"
          strokeWidth="1"
          strokeDasharray="3 3"
          strokeOpacity="0.65"
        />

        {/* Gradient Area under Price Curve */}
        <path d={areaD} fill={`url(#grad-${symbol})`} />

        {/* Smooth Price Path Line */}
        <path
          d={pathD}
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ filter: `drop-shadow(0 0 3px ${glowColor})` }}
        />

        {/* Current Price Dot */}
        {pathD && (
          <circle
            cx={width - 5}
            cy={pathD.split(" ").slice(-1)[0]}
            r={2.5}
            fill="#FFFFFF"
            stroke={strokeColor}
            strokeWidth="1.5"
            className="animate-pulse"
          />
        )}
      </svg>

      {/* Mini Legend overlay */}
      <div className="flex items-center justify-between px-1 text-[9px] font-mono text-slate-400">
        <span className="flex items-center gap-1 text-slate-400">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          VWAP
        </span>
        <span className="text-emerald-400 font-semibold">
          {relativeVolume ? `${relativeVolume.toFixed(1)}x Vol` : "Active"}
        </span>
      </div>
    </div>
  );
}

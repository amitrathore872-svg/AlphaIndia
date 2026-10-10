"use client";

import React from "react";

interface OrderBookSparklineProps {
  data: number[];
  direction?: "UP" | "DOWN";
  latestFormatted?: string;
  changePct?: number;
  height?: number;
}

export default function OrderBookSparkline({
  data,
  direction = "UP",
  latestFormatted,
  changePct,
  height = 36,
}: OrderBookSparklineProps) {
  if (!data || data.length === 0) {
    return <span className="text-xs text-slate-500">—</span>;
  }

  const maxVal = Math.max(...data, 1);
  const minVal = Math.min(...data);
  const isUp = direction === "UP";

  return (
    <div className="flex items-center gap-3">
      {/* Mini Bar Chart */}
      <div
        className="flex items-end gap-1.5 px-1 py-1 rounded bg-slate-900/50 border border-slate-800/60"
        style={{ height: `${height}px`, minWidth: "90px" }}
      >
        {data.map((val, idx) => {
          // Normalize height between 18% and 100%
          const barHeightPct = Math.max(18, Math.round((val / maxVal) * 100));
          const isLatest = idx === data.length - 1;

          return (
            <div
              key={idx}
              title={`Quarter ${idx + 1}: INR ${val.toLocaleString("en-IN", { maximumFractionDigits: 1 })} cr`}
              className={`w-2.5 rounded-t transition-all duration-300 ${
                isUp
                  ? isLatest
                    ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"
                    : "bg-emerald-600/70 hover:bg-emerald-500"
                  : isLatest
                  ? "bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.6)]"
                  : "bg-rose-700/70 hover:bg-rose-500"
              }`}
              style={{ height: `${barHeightPct}%` }}
            />
          );
        })}
      </div>

      {/* Metric Badge */}
      {latestFormatted && (
        <div className="flex flex-col text-right min-w-[70px]">
          <span className="text-[12px] font-mono font-semibold text-slate-200">
            {latestFormatted}
          </span>
          {changePct !== undefined && (
            <span
              className={`text-[11px] font-mono font-medium flex items-center justify-end gap-0.5 ${
                isUp ? "text-emerald-400" : "text-rose-400"
              }`}
            >
              {isUp ? "▲" : "▼"} {Math.abs(Math.round(changePct))}%
            </span>
          )}
        </div>
      )}
    </div>
  );
}

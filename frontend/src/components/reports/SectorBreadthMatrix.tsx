"use client";

import React, { useState } from "react";
import { SectorBreadthItem } from "@/lib/reportsApi";
import { Layers, ArrowUpDown, ChevronDown, ChevronUp, CheckCircle, AlertCircle } from "lucide-react";

interface SectorBreadthMatrixProps {
  sectors: SectorBreadthItem[];
}

export default function SectorBreadthMatrix({ sectors }: SectorBreadthMatrixProps) {
  const [sortBy, setSortBy] = useState<"pct" | "name" | "total">("pct");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  if (!sectors || sectors.length === 0) {
    return null;
  }

  const getPct = (item: SectorBreadthItem) => item.pct_above_dma ?? item.pct_above_20dma ?? 0;
  const getAbove = (item: SectorBreadthItem) => item.above_dma ?? item.above_20dma ?? 0;
  const getBelow = (item: SectorBreadthItem) => item.below_dma ?? item.below_20dma ?? 0;

  const sortedSectors = [...sectors].sort((a, b) => {
    let diff = 0;
    if (sortBy === "pct") {
      diff = getPct(a) - getPct(b);
    } else if (sortBy === "name") {
      diff = a.sector.localeCompare(b.sector);
    } else if (sortBy === "total") {
      diff = a.total_stocks - b.total_stocks;
    }
    return sortOrder === "desc" ? -diff : diff;
  });

  const greenCount = sectors.filter((s) => getPct(s) >= 50).length;
  const redCount = sectors.length - greenCount;

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-[#070C16] p-6 shadow-xl">
      {/* Title & Stats */}
      <div className="flex flex-col gap-3 border-b border-slate-800/70 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-cyan-400" />
            <h3 className="text-lg font-bold text-white">Sectoral Moving Average Breadth Distribution</h3>
          </div>
          <p className="mt-0.5 text-xs text-slate-400">
            Internal moving average health across {sectors.length} official NSE sectors &bull; Highlighting leadership entering the Green Zone
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 font-semibold text-emerald-300">
            {greenCount} Sectors in Green Zone (&gt;50%)
          </span>
          <span className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 font-semibold text-rose-300">
            {redCount} Sectors in Red Zone (&lt;50%)
          </span>
        </div>
      </div>

      {/* Grid of Sector Cards */}
      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {sortedSectors.map((sec) => {
          const pct = getPct(sec);
          const isGreen = pct >= 50.0;
          return (
            <div
              key={sec.sector}
              className={`rounded-xl border p-4 transition-all duration-200 ${
                isGreen
                  ? "border-emerald-500/30 bg-emerald-950/10 hover:border-emerald-500/50"
                  : "border-slate-800/80 bg-slate-900/30 hover:border-slate-700"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-semibold text-white text-sm line-clamp-1">{sec.sector}</h4>
                  <span className="text-[11px] text-slate-400">
                    {getAbove(sec)} / {sec.total_stocks} stocks above DMA
                  </span>
                </div>
                <span
                  className={`text-base font-extrabold ${
                    isGreen ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {pct.toFixed(1)}%
                </span>
              </div>

              {/* Progress Bar with 50% Marker */}
              <div className="relative mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isGreen
                      ? "bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                      : "bg-gradient-to-r from-rose-600 to-rose-400"
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                />
                {/* 50% tick mark */}
                <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-amber-400/70" />
              </div>

              <div className="mt-2 flex items-center justify-between text-[10px]">
                <span
                  className={`font-semibold ${isGreen ? "text-emerald-400" : "text-rose-400"}`}
                >
                  {isGreen ? "🟢 GREEN ZONE" : "🔴 RED ZONE"}
                </span>
                <span className="text-slate-500">50% line</span>
                <span className="text-slate-400">
                  {getBelow(sec)} below DMA
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

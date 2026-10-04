"use client";

// =========================================================================
// Alpha India — Breaking News & Filing Ticker (Continuous Horizontal Stream)
// =========================================================================

import React from "react";
import Link from "next/link";
import { Radio, ChevronRight } from "lucide-react";
import type { AnnouncementRadarItem } from "@/lib/announcementsApi";

interface BreakingNewsTickerProps {
  announcements: AnnouncementRadarItem[];
  className?: string;
}

export default function BreakingNewsTicker({
  announcements,
  className = "",
}: BreakingNewsTickerProps) {
  if (!announcements || announcements.length === 0) return null;

  return (
    <div
      className={`flex items-center overflow-hidden rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/90 dark:bg-[#071322]/90 px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 ${className}`}
    >
      {/* Ticker Lead Tag */}
      <div className="flex items-center gap-1.5 shrink-0 pr-3 border-r border-slate-200 dark:border-slate-700/80 font-black uppercase text-[10px] text-amber-600 dark:text-amber-400">
        <Radio size={12} className="animate-pulse text-amber-500" />
        <span>Live Wire</span>
      </div>

      {/* Marquee Content */}
      <div className="flex items-center gap-6 overflow-x-auto pl-3 whitespace-nowrap scrollbar-none scroll-smooth">
        {announcements.slice(0, 10).map((ann, idx) => (
          <div key={ann.id || idx} className="inline-flex items-center gap-2 text-xs">
            {ann.symbol && (
              <Link
                href={`/stocks/${ann.symbol}`}
                className="font-black text-slate-900 dark:text-white hover:text-cyan-500 transition"
              >
                {ann.symbol}
              </Link>
            )}
            <span className="text-slate-500 dark:text-slate-400 font-medium">
              {ann.headline.slice(0, 75)}{ann.headline.length > 75 ? "..." : ""}
            </span>
            {ann.deal_value_cr && (
              <span className="rounded bg-emerald-500/15 border border-emerald-500/30 px-1 py-0.2 text-[9px] font-black text-emerald-700 dark:text-emerald-300">
                ₹{ann.deal_value_cr.toLocaleString("en-IN")} Cr
              </span>
            )}
            <span className="text-slate-300 dark:text-slate-700">·</span>
          </div>
        ))}
      </div>

      <Link
        href="/announcements"
        className="shrink-0 pl-3 font-bold text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5"
      >
        <span>All</span>
        <ChevronRight size={13} />
      </Link>
    </div>
  );
}

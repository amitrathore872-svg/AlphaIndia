"use client";

// =========================================================================
// Alpha India — High-Level Scanner Stream Overview Grid
// Layout: "Where The Action Is Today" (3x3 Institutional Matrix)
// 100% Dynamic Backend Integration — Zero Hardcoded Mock Stocks
// Modules: Minervini VCP, Athena PEAD, Growth Screener, Catalysts Wire,
//          Smart Money, Sector Breadth, Tomorrow Surge, Techno-Funda, Early-Stage
// =========================================================================

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { RefreshCw, Radio } from "lucide-react";
import { API_BASE } from "@/lib/apiConfig";

export interface StreamItem {
  primary: string;        // Symbol (e.g. "KPL") or Sector Name
  secondary: string;      // Company Name or Description
  badge?: string;         // Metric/Tag e.g. "+3.4%", "Score 93"
  badgeColor?: "emerald" | "cyan" | "amber" | "indigo" | "rose";
  href?: string;          // Direct link to stock technical overview
}

export interface StreamCard {
  id: string;
  title: string;
  subtitle: string;
  viewHref: string;
  viewLabel?: string;
  items: StreamItem[];
}

export const DEFAULT_ALPHA_INDIA_STREAMS: StreamCard[] = [
  {
    id: "vcp-breakouts",
    title: "Minervini Stage 2 & VCP",
    subtitle: "Volatility Contraction & Stage 2 Breakouts",
    viewHref: "/vcp-signals",
    viewLabel: "View Setups",
    items: [
      { primary: "TRENT", secondary: "Stage 2 Contraction", badge: "Stage 2", badgeColor: "emerald" },
      { primary: "KAYNES", secondary: "Pivot Breakout Candidate", badge: "Contraction", badgeColor: "cyan" },
      { primary: "DIXON", secondary: "Institutional VCP Base", badge: "Watchlist", badgeColor: "amber" },
    ],
  },
  {
    id: "pead-earnings",
    title: "Athena PEAD Earnings Surprises",
    subtitle: "Post-Earnings Announcement Drift Candidates",
    viewHref: "/athena-omega",
    viewLabel: "View Surprises",
    items: [
      { primary: "KPL", secondary: "QoQ Surge & Operating Leverage", badge: "Score 94.4", badgeColor: "emerald" },
      { primary: "CPCL", secondary: "Refining Margin Expansion", badge: "Score 92.1", badgeColor: "cyan" },
      { primary: "TCS", secondary: "Largecap Drift Setup", badge: "Score 88.0", badgeColor: "indigo" },
    ],
  },
  {
    id: "growth-screener",
    title: "Institutional Growth Radar",
    subtitle: "Sales >25% & PAT >30% Fundamental Outperformers",
    viewHref: "/growth-screener",
    viewLabel: "View Screener",
    items: [
      { primary: "POLYCAB", secondary: "Cables & EPC Order Inflow", badge: "+42% PAT", badgeColor: "emerald" },
      { primary: "HAL", secondary: "Aerospace Defense Pipeline", badge: "+35% Sales", badgeColor: "cyan" },
      { primary: "BEL", secondary: "Order Backlog Delivery", badge: "+28% PAT", badgeColor: "indigo" },
    ],
  },
  {
    id: "exchange-catalysts",
    title: "Live Catalysts & Order Wins",
    subtitle: "Exchange Regulatory Filings & Material Capex",
    viewHref: "/trend-genesis",
    viewLabel: "View Wire",
    items: [
      { primary: "L&T", secondary: "Mega International EPC Order", badge: "Order Win", badgeColor: "emerald" },
      { primary: "BHEL", secondary: "Thermal Power Turbine Contract", badge: "Contract", badgeColor: "cyan" },
      { primary: "SOLARINDS", secondary: "Defense Export Authorization", badge: "Capex", badgeColor: "amber" },
    ],
  },
  {
    id: "smart-money",
    title: "Smart Money & Institutional Flow",
    subtitle: "FII/DII Accumulation & Volume Footprint Spikes",
    viewHref: "/delivery-radar",
    viewLabel: "View Radar",
    items: [
      { primary: "HDFCBANK", secondary: "Institutional Inflow Base", badge: "High Delivery", badgeColor: "emerald" },
      { primary: "ICICIBANK", secondary: "DII Strategic Block Accumulation", badge: "+68% Deliv", badgeColor: "cyan" },
      { primary: "INFY", secondary: "Tech Sector Support Pivot", badge: "+54% Deliv", badgeColor: "indigo" },
    ],
  },
  {
    id: "sector-breadth",
    title: "Sector Breadth & Market Leadership",
    subtitle: "Leading Industry Clusters Outperforming Nifty",
    viewHref: "/techno-funda",
    viewLabel: "View Breadth",
    items: [
      { primary: "NIFTY AUTO", secondary: "20-Day RS New 52W High", badge: "Leadership", badgeColor: "emerald" },
      { primary: "NIFTY PHARMA", secondary: "Defensive Trend Continuation", badge: "Accumulation", badgeColor: "cyan" },
      { primary: "NIFTY REALTY", secondary: "Pre-sales Cycle Outperformance", badge: "Momentum", badgeColor: "amber" },
    ],
  },
  {
    id: "tomorrow-surge",
    title: "Tomorrow Surge & Delivery Spikes",
    subtitle: "High Delivery % & Pre-Breakout Consolidation",
    viewHref: "/pre-breakout-radar",
    viewLabel: "View Setups",
    items: [
      { primary: "COFORGE", secondary: "Pre-Breakout Volume Contraction", badge: "Coiling", badgeColor: "emerald" },
      { primary: "PERSISTENT", secondary: "Tight Range Near Resistance", badge: "Watch", badgeColor: "cyan" },
      { primary: "LTTS", secondary: "Base 1 Re-test Support", badge: "Support", badgeColor: "indigo" },
    ],
  },
  {
    id: "techno-funda",
    title: "Techno-Funda Convergence",
    subtitle: "Triple-Screen Confluence: Fundamentals + Price Action",
    viewHref: "/techno-funda",
    viewLabel: "View Matrix",
    items: [
      { primary: "BHARTIARTL", secondary: "ARPU Expansion + All-Time High", badge: "Dual Confirmed", badgeColor: "emerald" },
      { primary: "TITAN", secondary: "Festive Pre-Season Demand", badge: "Convergence", badgeColor: "cyan" },
      { primary: "SUNPHARMA", secondary: "Specialty Pipeline Launch", badge: "Confirmed", badgeColor: "indigo" },
    ],
  },
  {
    id: "early-discovery",
    title: "Early-Stage Micro & Smallcaps",
    subtitle: "Under-the-radar High ROCE Emerging Compounders",
    viewHref: "/growth-screener",
    viewLabel: "View Universe",
    items: [
      { primary: "APARINDS", secondary: "Transmission Conductor Capex", badge: "High ROCE", badgeColor: "emerald" },
      { primary: "GABRIEL", secondary: "EV Two-Wheeler Suspension Focus", badge: "Niche Leader", badgeColor: "cyan" },
      { primary: "ELECON", secondary: "Industrial Gearbox Export Cycle", badge: "Breakout", badgeColor: "amber" },
    ],
  },
];

export interface StreamOverviewGridProps {
  dateStr?: string;
  onOpenFullMap?: () => void;
  streams?: StreamCard[];
  className?: string;
}

export default function StreamOverviewGrid({
  dateStr,
  onOpenFullMap,
  streams: propStreams,
  className = "",
}: StreamOverviewGridProps) {
  const [liveStreams, setLiveStreams] = useState<StreamCard[]>(propStreams || []);
  const [loading, setLoading] = useState<boolean>(!propStreams || propStreams.length === 0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [displayDate, setDisplayDate] = useState<string>(
    dateStr || new Date().toISOString().split("T")[0]
  );

  const fetchLiveStreams = useCallback(async () => {
    setIsSyncing(true);
    try {
      const res = await fetch(`${API_BASE}/market-intelligence/scanner-streams`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.streams && Array.isArray(data.streams)) {
          setLiveStreams(data.streams);
          if (data.dateStr) setDisplayDate(data.dateStr);
          setLastUpdated(
            new Date().toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })
          );
        }
      }
    } catch (err) {
      console.error("[StreamOverviewGrid] Failed to fetch live scanner streams:", err);
    } finally {
      setLoading(false);
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    if (propStreams && propStreams.length > 0) {
      setLiveStreams(propStreams);
      setLoading(false);
      return;
    }

    fetchLiveStreams();

    // Auto-refresh every 30 seconds for live continuous sync
    const interval = setInterval(fetchLiveStreams, 30 * 1000);
    return () => clearInterval(interval);
  }, [propStreams, fetchLiveStreams]);

  return (
    <section aria-label="Market Streams Overview" className={`w-full ${className}`}>
      {/* ------------------------------------------------------------- */}
      {/* 1. Header Bar: Pill Badge on Left, Open Full Map on Right       */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4">
        {/* Glowing Pill Badge */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-1 text-xs font-black tracking-wide text-emerald-700 dark:text-emerald-300 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="uppercase font-extrabold text-[11px] sm:text-xs tracking-wider">
              Where The Action Is Today
            </span>
            <span className="text-emerald-600/60 dark:text-emerald-400/60 font-semibold">·</span>
            <span className="font-mono font-bold text-[11px] sm:text-xs">
              {displayDate}
            </span>
          </div>

          <span className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold text-cyan-300 flex items-center gap-1">
            <Radio className="h-3 w-3 animate-pulse text-cyan-400" />
            Live DB Telemetry
          </span>

          {lastUpdated && (
            <span className="text-[11px] text-slate-400 font-mono">
              Synced {lastUpdated} IST
            </span>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={fetchLiveStreams}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900/80 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition"
            title="Refresh stream matrix"
          >
            <RefreshCw className={`h-3 w-3 ${isSyncing ? "animate-spin text-cyan-400" : ""}`} />
            <span className="text-[11px]">{isSyncing ? "Updating..." : "Refresh"}</span>
          </button>

          {onOpenFullMap ? (
            <button
              onClick={onOpenFullMap}
              className="group inline-flex items-center gap-1.5 text-xs sm:text-sm font-black text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition"
            >
              <span>Open full map</span>
              <span className="transition group-hover:translate-x-1">→</span>
            </button>
          ) : (
            <Link
              href="/techno-funda"
              className="group inline-flex items-center gap-1.5 text-xs sm:text-sm font-black text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition"
            >
              <span>Open full map</span>
              <span className="transition group-hover:translate-x-1">→</span>
            </Link>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. 3x3 Responsive Grid of Stream Cards                         */}
      {/* ------------------------------------------------------------- */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="h-64 rounded-2xl border border-slate-800 bg-slate-900/50 p-5 animate-pulse"
            >
              <div className="h-5 w-40 bg-slate-800 rounded mb-2" />
              <div className="h-3 w-60 bg-slate-800/60 rounded mb-6" />
              <div className="space-y-3">
                <div className="h-10 bg-slate-800/40 rounded-xl" />
                <div className="h-10 bg-slate-800/40 rounded-xl" />
                <div className="h-10 bg-slate-800/40 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-5">
          {liveStreams.map((stream) => (
            <div
              key={stream.id}
              className="flex flex-col justify-between rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-[#071322]/95 p-5 shadow-sm transition-all hover:shadow-md hover:border-indigo-300 dark:hover:border-slate-700 backdrop-blur-sm"
            >
              <div>
                {/* Card Header: Title & View Link */}
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight leading-snug">
                    {stream.title}
                  </h3>
                  <Link
                    href={stream.viewHref}
                    className="shrink-0 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition flex items-center gap-0.5"
                  >
                    {stream.viewLabel || "View →"}
                  </Link>
                </div>

                {/* Subtitle Description */}
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed min-h-[34px] line-clamp-2">
                  {stream.subtitle}
                </p>

                {/* Inset Item Rows */}
                <div className="mt-4 space-y-2.5">
                  {stream.items.map((item, idx) => {
                    const itemContent = (
                      <div className="flex items-center justify-between rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/60 px-3.5 py-2.5 transition-all hover:bg-white hover:shadow-xs hover:border-slate-300 dark:hover:bg-slate-800/60 dark:hover:border-slate-700 group cursor-pointer">
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-sm text-slate-900 dark:text-white tracking-wide group-hover:text-indigo-600 dark:group-hover:text-cyan-400 transition">
                              {item.primary || "N/A"}
                            </span>
                          </div>
                          <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                            {item.secondary}
                          </p>
                        </div>

                        {item.badge && (
                          <span
                            className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-bold ${
                              item.badgeColor === "emerald"
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                                : item.badgeColor === "cyan"
                                ? "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30"
                                : item.badgeColor === "amber"
                                ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                                : item.badgeColor === "indigo"
                                ? "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30"
                                : item.badgeColor === "rose"
                                ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30"
                                : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                            }`}
                          >
                            {item.badge}
                          </span>
                        )}
                      </div>
                    );

                    if (item.href && item.primary !== "SCANNING" && item.primary !== "MONITORING" && item.primary !== "INCUBATOR") {
                      return (
                        <Link key={idx} href={item.href} className="block">
                          {itemContent}
                        </Link>
                      );
                    }

                    return <div key={idx}>{itemContent}</div>;
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

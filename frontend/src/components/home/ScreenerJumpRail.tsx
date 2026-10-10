"use client";

// =========================================================================
// Alpha India — Screener Fast-Jump Rail (Daily One-Pager Navigation)
// Quick horizontal access to all 14 specialized market engines & radars
// =========================================================================

import React from "react";
import Link from "next/link";
import {
  TrendingUp,
  Sparkles,
  Zap,
  Flame,
  Target,
  Trophy,
  Radio,
  ShieldCheck,
  Radar,
  Layers,
  GitBranch,
  Rocket,
  Activity,
  ArrowRight,
} from "lucide-react";

export interface ScreenerShortcut {
  id: string;
  name: string;
  shortName: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
  badgeColor?: "emerald" | "cyan" | "amber" | "indigo" | "rose";
}

const SCREENER_SHORTCUTS: ScreenerShortcut[] = [
  {
    id: "growth-screener",
    name: "Growth Screener PRO",
    shortName: "Growth PRO",
    href: "/growth-screener",
    icon: TrendingUp,
    badge: "Sales/PAT",
    badgeColor: "emerald",
  },
  {
    id: "vcp-discovery",
    name: "Minervini VCP Breakouts",
    shortName: "VCP Breakout",
    href: "/vcp-discovery",
    icon: Sparkles,
    badge: "Stage 2",
    badgeColor: "cyan",
  },
  {
    id: "pead-drift-screener",
    name: "PEAD Drift Screener",
    shortName: "PEAD Screener",
    href: "/pead-drift-screener",
    icon: Zap,
    badge: "Surprises",
    badgeColor: "indigo",
  },
  {
    id: "momentum-radar",
    name: "Super Momentum Radar",
    shortName: "Super Momentum",
    href: "/momentum-radar",
    icon: Flame,
    badge: "52W Highs",
    badgeColor: "amber",
  },
  {
    id: "techno-funda",
    name: "Techno-Funda Radar",
    shortName: "Techno-Funda",
    href: "/techno-funda",
    icon: Target,
    badge: "Convergence",
    badgeColor: "emerald",
  },
  {
    id: "order-wins",
    name: "New Order Wins Wire",
    shortName: "Order Wins",
    href: "/order-wins",
    icon: Trophy,
    badge: "Contracts",
    badgeColor: "cyan",
  },
  {
    id: "announcements",
    name: "Corporate Catalysts",
    shortName: "Catalysts",
    href: "/announcements",
    icon: Radio,
    badge: "Live Wire",
    badgeColor: "amber",
  },
  {
    id: "institutional-radar",
    name: "Mutual Fund & Smart Money",
    shortName: "Smart Money",
    href: "/institutional-radar",
    icon: ShieldCheck,
    badge: "FII/DII",
    badgeColor: "indigo",
  },
  {
    id: "delivery-radar",
    name: "Delivery Breakouts",
    shortName: "Delivery Surges",
    href: "/delivery-radar",
    icon: Radar,
    badge: "Cash Flow",
    badgeColor: "cyan",
  },
  {
    id: "pre-breakout-radar",
    name: "Pre-Breakout Contraction",
    shortName: "Pre-Breakout",
    href: "/pre-breakout-radar",
    icon: Layers,
    badge: "Coiling",
    badgeColor: "emerald",
  },
  {
    id: "cup-handle",
    name: "Cup & Handle AI",
    shortName: "Cup & Handle",
    href: "/cup-handle",
    icon: GitBranch,
    badge: "Patterns",
    badgeColor: "indigo",
  },
  {
    id: "velocity-burst-elite",
    name: "Velocity Burst Elite",
    shortName: "Velocity Elite",
    href: "/velocity-burst-elite",
    icon: Rocket,
    badge: "Flagship",
    badgeColor: "rose",
  },
  {
    id: "live-intraday",
    name: "Live Intraday Radar",
    shortName: "Live Intraday",
    href: "/live-intraday",
    icon: Activity,
    badge: "VWAP",
    badgeColor: "emerald",
  },
];

export default function ScreenerJumpRail() {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between pb-2 text-xs">
        <span className="font-extrabold uppercase tracking-wider text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
          Direct Access: 14 Specialized Market Screeners
        </span>
        <span className="text-[10px] text-slate-400">
          Click any screener to launch deep-dive analysis
        </span>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {SCREENER_SHORTCUTS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              href={item.href}
              className="group flex shrink-0 items-center gap-2 rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white/90 dark:bg-[#071322]/90 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-200 transition-all hover:border-cyan-500/50 hover:bg-slate-50 dark:hover:bg-slate-800/80 hover:shadow-xs"
              title={item.name}
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-900 group-hover:scale-110 transition-transform">
                <Icon
                  size={14}
                  className="text-slate-600 dark:text-slate-400 group-hover:text-cyan-500 dark:group-hover:text-cyan-400 transition-colors"
                />
              </div>

              <span className="whitespace-nowrap font-bold text-[11px] sm:text-xs">
                {item.shortName}
              </span>

              {item.badge && (
                <span
                  className={`rounded-md px-1.5 py-0.2 text-[9px] font-black uppercase tracking-tight ${
                    item.badgeColor === "emerald"
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                      : item.badgeColor === "cyan"
                      ? "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30"
                      : item.badgeColor === "amber"
                      ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                      : item.badgeColor === "indigo"
                      ? "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30"
                      : "bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30"
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

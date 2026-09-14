"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  TrendingUp,
  FileSpreadsheet,
  Sparkles,
  Award,
  Activity,
  Cpu,
  Layers,
  Radio,
  BarChart3,
} from "lucide-react";

const menuItems = [
  {
    title: "Growth Screener",
    href: "/",
    icon: TrendingUp,
    badge: "PRO",
  },
  {
    title: "Screener Growth",
    href: "/screener-growth",
    icon: TrendingUp,
    badge: "NEW",
  },
  {
    title: "Screener Monitor",
    href: "/screener-monitoring",
    icon: Radio,
    badge: "LIVE",
  },
  {
    title: "Quarterly Results",
    href: "/quarterly-results",
    icon: FileSpreadsheet,
  },
  {
    title: "Hidden Gems",
    href: "/hidden-gems",
    icon: Sparkles,
  },
  {
    title: "AI Growth Rankings",
    href: "/rankings",
    icon: Award,
  },
  {
    title: "Market Intelligence",
    href: "/market-intelligence",
    icon: Activity,
  },
  {
    title: "Mission Control",
    href: "/monitoring",
    icon: Cpu,
  },
  {
    title: "Discovery Queue",
    href: "/queue",
    icon: Layers,
  },
  {
    title: "Live Event Stream",
    href: "/events",
    icon: Radio,
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 border-r border-slate-800/80 bg-[#060B14] lg:flex lg:flex-col select-none">
      {/* Brand Header */}
      <div className="border-b border-slate-800/80 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 shadow-sm shadow-cyan-950">
            <BarChart3 className="h-5 w-5" />
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-base font-extrabold text-white tracking-tight">Alpha India</h1>
              <span className="rounded bg-emerald-500/20 px-1.5 py-0.2 text-[9px] font-bold text-emerald-400 border border-emerald-500/30">
                PRO
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Institutional Growth Radar
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-1">
        <p className="mb-2.5 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-500">
          Financial Intelligence
        </p>

        {menuItems.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href ||
            (item.href !== "/" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.title}
              href={item.href}
              className={`group flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold transition-all duration-150 ${
                active
                  ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm shadow-cyan-950"
                  : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-100"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon
                  className={`h-4 w-4 transition-colors ${
                    active ? "text-cyan-400" : "text-slate-500 group-hover:text-slate-300"
                  }`}
                />
                <span>{item.title}</span>
              </div>

              {item.badge && (
                <span className="rounded bg-cyan-400/20 px-1.5 py-0.5 text-[9px] font-extrabold text-cyan-300">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Engine Status & System Info Footer */}
      <div className="border-t border-slate-800/80 p-4 bg-[#050912]">
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="font-mono text-[11px] font-bold text-emerald-400">
                ONLINE
              </span>
            </div>

            <span className="font-mono text-[10px] text-slate-500">v2.3.0</span>
          </div>

          <p className="mt-1 text-[10px] text-slate-400">
            Import Engine • Audit Engine
          </p>
        </div>
      </div>
    </aside>
  );
}
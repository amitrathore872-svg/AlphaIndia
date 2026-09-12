"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  TrendingUp,
  FileText,
  Gem,
  BrainCircuit,
  Scale,
  Star,
  Radar,
  History,
  Building2,
  Settings,
  Activity,
} from "lucide-react";

const navigation = [
  {
    title: "MAIN MENU",
    items: [
      { name: "Growth Screener", href: "/", icon: TrendingUp },
      {
        name: "Quarterly Results",
        href: "/quarterly-results",
        icon: FileText,
      },
      { name: "Hidden Gems", href: "/hidden-gems", icon: Gem },
    ],
  },
  {
    title: "RESEARCH",
    items: [
      {
        name: "AI Growth Rankings",
        href: "/ai-rankings",
        icon: BrainCircuit,
      },
      {
        name: "Company Comparison",
        href: "/comparison",
        icon: Scale,
      },
    ],
  },
  {
    title: "PORTFOLIO",
    items: [
      {
        name: "Watchlist Builder",
        href: "/watchlist",
        icon: Star,
      },
    ],
  },
  {
    title: "MONITORING",
    items: [
      {
        name: "Monitoring Center",
        href: "/monitoring",
        icon: Radar,
      },
      {
        name: "Activity Timeline",
        href: "/activity",
        icon: History,
      },
    ],
  },
  {
    title: "ADMINISTRATION",
    items: [
      {
        name: "Company Master",
        href: "/company-master",
        icon: Building2,
      },
      {
        name: "System Settings",
        href: "/settings",
        icon: Settings,
      },
    ],
  },
];

export default function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="sticky top-0 flex h-screen w-72 flex-col border-r border-slate-800 bg-gradient-to-b from-[#07111F] via-[#09182A] to-[#07111F]">

      {/* ========================================================= */}
      {/* Alpha India Brand */}
      {/* ========================================================= */}

      <div className="border-b border-slate-800 px-5 py-6">

        <div className="flex items-center gap-3">

          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 shadow-lg shadow-emerald-900/40">

            <LayoutDashboard size={22} className="text-black"/>

          </div>

          <div>

            <h1 className="text-lg font-bold tracking-wide text-white">
              Alpha India
            </h1>

            <p className="text-[10px] uppercase tracking-[0.28em] text-cyan-400">
              AI Growth Platform
            </p>

          </div>

        </div>

        {/* Live Engine Status */}

        <div className="mt-6 rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 p-4 backdrop-blur-sm">

          <div className="flex items-center justify-between">

            <span className="text-[10px] font-semibold uppercase tracking-[0.25em] text-emerald-400">
              LIVE MARKET ENGINE
            </span>

            <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse"/>

          </div>

          <p className="mt-2 text-xl font-bold text-emerald-300">
            ONLINE
          </p>

          <p className="mt-1 text-xs text-slate-400">
            Import Engine • Audit Engine
          </p>

          <div className="mt-3 h-px bg-slate-700"/>

          <div className="mt-3 flex items-center justify-between text-xs">

            <span className="text-slate-500">
              Warehouse
            </span>

            <span className="font-semibold text-emerald-400">
              READY
            </span>

          </div>

        </div>

      </div>

      {/* ========================================================= */}
      {/* Navigation */}
      {/* ========================================================= */}

      <div className="flex-1 overflow-y-auto px-4 py-5">

        {navigation.map((group) => (

          <div key={group.title} className="mb-7">

            <p className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-500">
              {group.title}
            </p>

            <div className="space-y-1">

              {group.items.map((item) => {

                const active =
                  pathname === item.href ||
                  pathname.startsWith(item.href + "/");

                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`group flex items-center gap-3 rounded-xl border px-3 py-3 transition-all duration-300 ${
                      active
                        ? "border-emerald-500/40 bg-gradient-to-r from-emerald-500/20 to-cyan-500/10 text-emerald-300 shadow-md shadow-emerald-900/20"
                        : "border-transparent text-slate-300 hover:border-slate-700 hover:bg-slate-900/60 hover:text-white"
                    }`}
                  >

                    <Icon
                      size={18}
                      className={`transition-transform duration-300 group-hover:scale-110 ${
                        active
                          ? "text-emerald-400"
                          : "text-slate-400 group-hover:text-cyan-400"
                      }`}
                    />

                    <span className="text-sm font-medium">
                      {item.name}
                    </span>

                  </Link>
                );

              })}

            </div>

          </div>

        ))}

      </div>

      {/* ========================================================= */}
      {/* Footer Version Card */}
      {/* ========================================================= */}

      <div className="border-t border-slate-800 p-4">

        <div className="rounded-2xl border border-slate-700 bg-gradient-to-r from-slate-900 to-slate-800 p-4">

          <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">
            VERSION
          </p>

          <h3 className="mt-1 text-xl font-bold text-white">
            v2.1.0
          </h3>

          <p className="mt-1 text-xs text-slate-400">
            Sprint 32 Premium UI Foundation
          </p>

          <div className="my-4 h-px bg-slate-700"/>

          <div className="flex items-center justify-between text-xs">

            <span className="text-slate-400">
              Financial Warehouse
            </span>

            <span className="font-semibold text-emerald-400">
              ACTIVE
            </span>

          </div>

          <div className="mt-2 flex items-center justify-between text-xs">

            <span className="text-slate-400">
              Audit Engine
            </span>

            <span className="font-semibold text-cyan-400">
              READY
            </span>

          </div>

          <div className="mt-2 flex items-center justify-between text-xs">

            <span className="text-slate-400">
              Monitoring Engine
            </span>

            <span className="font-semibold text-emerald-400">
              ONLINE
            </span>

          </div>

          <div className="mt-4 rounded-lg bg-slate-950/60 p-2 text-center">

            <p className="text-[10px] uppercase tracking-widest text-slate-500">
              BUILD
            </p>

            <p className="mt-1 font-mono text-xs text-cyan-400">
              ALPHA • SPRINT 32.2.0
            </p>

          </div>

        </div>

      </div>

    </aside>
  );
}
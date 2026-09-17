"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck, TableProperties, Sparkles, Activity } from "lucide-react";

interface SubNavProps {
  freshCount?: number;
}

export default function InstitutionalSubNav({ freshCount }: SubNavProps) {
  const pathname = usePathname();

  const tabs = [
    {
      name: "Smart Money Screener",
      href: "/institutional-radar",
      icon: ShieldCheck,
      badge: "FLOAT RADAR",
      exact: true,
    },
    {
      name: "AMC Scheme Matrix",
      href: "/institutional-radar/matrix",
      icon: TableProperties,
      badge: "FULL UNIVERSE",
      exact: false,
    },
    {
      name: "Fresh Portfolio Entries",
      href: "/institutional-radar/fresh-entries",
      icon: Sparkles,
      badge: freshCount ? `${freshCount} NEW` : "NEW INITIATIONS",
      badgeColor: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
      exact: false,
    },
  ];

  const isTabActive = (href: string, exact: boolean) => {
    if (exact) {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-1.5 backdrop-blur-md">
      <div className="flex flex-wrap items-center gap-1.5">
        {tabs.map((tab) => {
          const active = isTabActive(tab.href, tab.exact);
          const Icon = tab.icon;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`group flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
                active
                  ? "border border-cyan-500/40 bg-cyan-500/15 text-cyan-300 shadow-md shadow-cyan-950/40"
                  : "border border-transparent text-slate-400 hover:border-slate-700/70 hover:bg-slate-800/60 hover:text-slate-200"
              }`}
            >
              <Icon
                size={16}
                className={active ? "text-cyan-400" : "text-slate-400 group-hover:text-slate-200"}
              />
              <span>{tab.name}</span>
              {tab.badge && (
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-black tracking-wider uppercase ${
                    tab.badgeColor ||
                    (active
                      ? "border-cyan-500/40 bg-cyan-500/20 text-cyan-300"
                      : "border-slate-700 bg-slate-800/80 text-slate-400")
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      <div className="hidden items-center gap-2 pr-3 text-[11px] text-slate-400 sm:flex">
        <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="font-semibold text-slate-300">AMFI Monthly Disclosures Live</span>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Database,
  TrendingUp,
  Building2,
  LineChart,
  BriefcaseBusiness,
  Bell,
  Settings,
  Activity,
  ShieldCheck,
} from "lucide-react";

const menu = [
  {
    title: "MAIN MENU",
    items: [
      { label: "Dashboard", href: "/", icon: LayoutDashboard },
      { label: "Financial Warehouse", href: "/warehouse", icon: Database },
      { label: "Growth Screener", href: "/screener", icon: TrendingUp },
    ],
  },
  {
    title: "RESEARCH",
    items: [
      { label: "Company Workspace", href: "/company", icon: Building2 },
      { label: "Technical Signals", href: "/signals", icon: LineChart },
    ],
  },
  {
    title: "PORTFOLIO",
    items: [
      { label: "Portfolio OS", href: "/portfolio", icon: BriefcaseBusiness },
      { label: "Alerts", href: "/alerts", icon: Bell },
    ],
  },
  {
    title: "SYSTEM",
    items: [
      { label: "Monitoring Center", href: "/monitoring", icon: Activity },
      { label: "Audit Center", href: "/audit", icon: ShieldCheck },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

export default function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-72 h-screen bg-[#0B1525] border-r border-slate-800 flex flex-col justify-between">
      <div>
        {/* Logo */}
        <div className="px-6 py-6 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-emerald-600 flex items-center justify-center">
              <TrendingUp className="text-white" size={22} />
            </div>

            <div>
              <h1 className="text-white text-lg font-bold">
                Alpha India
              </h1>
              <p className="text-slate-400 text-xs">
                AI Growth Discovery Platform
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="px-4 py-6 space-y-7">
          {menu.map((group) => (
            <div key={group.title}>
              <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500 mb-3">
                {group.title}
              </p>

              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 rounded-xl px-3 py-3 transition-all ${
                        active
                          ? "bg-emerald-600/20 text-emerald-400 border border-emerald-600/40"
                          : "text-slate-400 hover:bg-slate-800 hover:text-white"
                      }`}
                    >
                      <Icon size={18} />
                      <span className="text-sm font-medium">
                        {item.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Version Card */}
      <div className="p-4 border-t border-slate-800">
        <div className="rounded-2xl bg-gradient-to-r from-emerald-700/20 to-cyan-700/20 border border-emerald-700/30 p-4">
          <p className="text-[10px] uppercase tracking-widest text-emerald-400">
            VERSION
          </p>

          <h3 className="text-white font-bold text-xl mt-1">
            v2.1.0
          </h3>

          <p className="text-xs text-slate-400 mt-1">
            Sprint 32 — Premium Frontend Foundation
          </p>
        </div>
      </div>
    </aside>
  );
}
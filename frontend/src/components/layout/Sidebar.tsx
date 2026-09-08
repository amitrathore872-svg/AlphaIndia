"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  TrendingUp,
  FileSpreadsheet,
  Eye,
  Bell,
  Activity,
  Settings,
  BarChart3,
} from "lucide-react";

const menuItems = [
  {
    title: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Growth Screener",
    href: "/",
    icon: TrendingUp,
  },
  {
    title: "Quarterly Results",
    href: "/quarterly-results",
    icon: FileSpreadsheet,
  },
  {
    title: "Watchlist",
    href: "/watchlist",
    icon: Eye,
  },
  {
    title: "Alerts",
    href: "/alerts",
    icon: Bell,
  },
  {
    title: "Monitoring Center",
    href: "/monitoring",
    icon: Activity,
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 hidden h-screen w-72 border-r border-slate-800 bg-slate-900 lg:flex lg:flex-col">
      {/* Logo */}
      <div className="border-b border-slate-800 px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-emerald-500/20 p-2">
            <BarChart3 className="h-7 w-7 text-emerald-400" />
          </div>

          <div>
            <h1 className="text-xl font-bold text-white">Alpha India</h1>
            <p className="text-xs text-slate-400">
              AI Growth Discovery Platform
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6">
        <p className="mb-4 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Main Menu
        </p>

        <div className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));

            return (
              <Link
                key={item.title}
                href={item.href}
                className={`group flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200 ${
                  active
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Icon className="h-5 w-5" />
                {item.title}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-800 px-6 py-5">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4">
          <p className="text-xs uppercase tracking-wider text-emerald-400">
            Version
          </p>

          <h3 className="mt-1 text-lg font-semibold text-white">v0.9.3</h3>

          <p className="mt-2 text-xs text-slate-400">
            Sprint 4.5 — Terminal UI
          </p>
        </div>
      </div>
    </aside>
  );
}
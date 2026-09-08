"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  {
    title: "Dashboard",
    items: [
      { name: "Growth Screener", href: "/", icon: "📈" },
      { name: "Quarterly Results", href: "/quarterly-results", icon: "📄" },
      { name: "Hidden Gems", href: "/hidden-gems", icon: "💎" },
    ],
  },
  {
    title: "Research",
    items: [
      { name: "AI Growth Rankings", href: "/ai-rankings", icon: "🧠" },
      { name: "Company Comparison", href: "/comparison", icon: "⚖️" },
    ],
  },
  {
    title: "Portfolio",
    items: [
      { name: "Watchlist Builder", href: "/watchlist", icon: "⭐" },
    ],
  },
  {
    title: "Monitoring",
    items: [
      { name: "Monitoring Center", href: "/monitoring", icon: "🛰️" },
      { name: "Activity Timeline", href: "/activity", icon: "📜" },
    ],
  },
  {
    title: "Administration",
    items: [
      { name: "Company Master", href: "/company-master", icon: "🏢" },
      { name: "System Settings", href: "/settings", icon: "⚙️" },
    ],
  },
];

export default function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-72 h-screen bg-slate-950 border-r border-slate-800 flex flex-col">

      {/* LOGO */}
      <div className="px-6 py-6 border-b border-slate-800">
        <h1 className="text-2xl font-bold text-emerald-400">
          Alpha India
        </h1>

        <p className="text-sm text-slate-400 mt-1">
          AI Growth Investing Terminal
        </p>

        <div className="mt-4 flex items-center gap-2 text-xs">
          <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-emerald-400">Engine Running</span>
        </div>
      </div>

      {/* NAVIGATION */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6">

        {navigation.map((group) => (
          <div key={group.title}>

            <p className="mb-2 px-2 text-xs uppercase tracking-wider text-slate-500">
              {group.title}
            </p>

            <div className="space-y-1">

              {group.items.map((item) => {
                const active =
                  pathname === item.href ||
                  pathname.startsWith(item.href + "/");

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-xl px-3 py-3 transition-all ${
                      active
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        : "text-slate-300 hover:bg-slate-900 hover:text-white"
                    }`}
                  >
                    <span className="text-lg">{item.icon}</span>

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

      {/* FOOTER */}
      <div className="border-t border-slate-800 p-5 text-xs text-slate-500">
        <p className="font-semibold text-slate-300">
          Alpha India v0.9.0
        </p>

        <p className="mt-1">
          Autonomous Monitoring Engine
        </p>
      </div>

    </aside>
  );
}
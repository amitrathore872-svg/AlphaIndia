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
  Telescope,
  ShieldCheck,
  X,
} from "lucide-react";

interface AppSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

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
    title: "SCREENER.IN (PARALLEL)",
    items: [
      {
        name: "Screener Growth",
        href: "/screener-growth",
        icon: TrendingUp,
      },
      {
        name: "Screener Monitor",
        href: "/screener-monitoring",
        icon: Radar,
      },
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
      {
        name: "Early Stage Radar",
        href: "/early-stage",
        icon: Telescope,
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
        name: "Pipeline Validation",
        href: "/monitoring/validation",
        icon: ShieldCheck,
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

export default function AppSidebar({ isOpen = false, onClose }: AppSidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/75 backdrop-blur-xs transition-opacity lg:hidden"
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-72 max-w-[85vw] flex-col border-r border-slate-200 bg-white text-slate-900 transition-all duration-300 ease-in-out dark:border-slate-800 dark:bg-gradient-to-b dark:from-[#07111F] dark:via-[#09182A] dark:to-[#07111F] dark:text-white lg:sticky lg:top-0 lg:z-30 lg:translate-x-0 ${
          isOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
      >
        {/* ========================================================= */}
        {/* Alpha India Brand */}
        {/* ========================================================= */}

        <div className="border-b border-slate-200 px-5 py-5 sm:py-6 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 shadow-lg shadow-emerald-900/40">
                <LayoutDashboard size={20} className="text-black" />
              </div>

              <div>
                <h1 className="text-base sm:text-lg font-bold tracking-wide text-slate-900 dark:text-white">
                  Alpha India
                </h1>

                <p className="text-[10px] uppercase tracking-[0.28em] text-cyan-600 dark:text-cyan-400">
                  AI Growth Platform
                </p>
              </div>
            </div>

            {/* Close Button on Mobile */}
            {onClose && (
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-300 bg-slate-100 text-slate-600 transition hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white lg:hidden"
                aria-label="Close Sidebar"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* Navigation */}
        {/* ========================================================= */}

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:py-5">
          {navigation.map((group) => (
            <div key={group.title} className="mb-6">
              <p className="mb-2.5 px-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">
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
                      onClick={() => onClose?.()}
                      className={`group flex items-center gap-3 rounded-xl border px-3 py-2.5 sm:py-3 transition-all duration-200 ${
                        active
                          ? "border-emerald-500/40 bg-gradient-to-r from-emerald-500/15 to-cyan-500/10 text-emerald-600 font-semibold shadow-xs dark:text-emerald-300 dark:shadow-md dark:shadow-emerald-900/20"
                          : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-900/60 dark:hover:text-white"
                      }`}
                    >
                      <Icon
                        size={17}
                        className={`transition-transform duration-200 group-hover:scale-110 ${
                          active
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-slate-500 group-hover:text-cyan-600 dark:text-slate-400 dark:group-hover:text-cyan-400"
                        }`}
                      />

                      <span className="text-xs sm:text-sm font-medium">
                        {item.name}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}
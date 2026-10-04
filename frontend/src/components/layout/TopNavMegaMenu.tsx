"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  LayoutDashboard,
  Star,
  Flame,
  Zap,
  ShieldCheck,
  Briefcase,
  Settings,
  Sparkles,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { NAVIGATION_CONFIG, NavItemConfig } from "@/config/navigationConfig";
import { usePageVisibility } from "@/context/PageVisibilityContext";

interface CategoryMeta {
  key: string;
  title: string;
  shortTitle: string;
  icon: React.ElementType;
  badge?: string;
  sectionTitles: string[];
}

const CATEGORIES: CategoryMeta[] = [
  {
    key: "radars",
    title: "Radars & Engines",
    shortTitle: "Radars",
    icon: Flame,
    badge: "9",
    sectionTitles: ["RADARS & ENGINES"],
  },
  {
    key: "scanners",
    title: "Opportunity Scanners",
    shortTitle: "Scanners",
    icon: Zap,
    badge: "14",
    sectionTitles: ["FAST OPPORTUNITY SCREENER"],
  },
  {
    key: "institutional",
    title: "Institutional Research",
    shortTitle: "Research",
    icon: ShieldCheck,
    badge: "NEW",
    sectionTitles: ["INSTITUTIONAL RESEARCH", "PIPELINE & TRIAGE"],
  },
  {
    key: "portfolio",
    title: "Portfolio & Swing",
    shortTitle: "Portfolio",
    icon: Briefcase,
    sectionTitles: ["PORTFOLIO"],
  },
  {
    key: "system",
    title: "Admin & Control",
    shortTitle: "System",
    icon: Settings,
    sectionTitles: ["MONITORING", "ADMINISTRATION"],
  },
];

export default function TopNavMegaMenu() {
  const pathname = usePathname();
  const { isPageHidden } = usePageVisibility();
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpenCategory(null);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenCategory(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Filter navigation by visibility
  const getVisibleItemsForSections = (sectionTitles: string[]): NavItemConfig[] => {
    return NAVIGATION_CONFIG.filter((section) =>
      sectionTitles.includes(section.title)
    ).flatMap((section) =>
      section.items.filter((item) => !isPageHidden(item.href))
    );
  };

  const isCurrentCategory = (sectionTitles: string[]) => {
    const items = getVisibleItemsForSections(sectionTitles);
    return items.some((item) => {
      if (item.href === "/" && pathname === "/") return true;
      if (item.href !== "/" && pathname?.startsWith(item.href)) return true;
      return false;
    });
  };

  const isWatchlistActive = pathname === "/watchlist";

  return (
    <nav ref={containerRef} className="relative flex items-center gap-1 sm:gap-1.5">
      {/* Brand Identity / Home Anchor */}
      <Link
        href="/home"
        className="flex items-center gap-2.5 mr-2 sm:mr-3 shrink-0 group rounded-xl p-1 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition"
        title="Alpha India — AI Growth Platform Home"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 via-cyan-500 to-blue-600 shadow-md shadow-cyan-950/40 shrink-0 transition-transform duration-200 group-hover:scale-105">
          <LayoutDashboard size={18} className="text-black" />
        </div>
        <div className="hidden xl:block text-left">
          <h1 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white leading-none flex items-center gap-1.5">
            <span>Alpha India</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded font-mono font-bold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30">
              v2.3
            </span>
          </h1>
          <p className="text-[9px] uppercase tracking-wider text-cyan-600 dark:text-cyan-400 font-semibold mt-0.5">
            AI Growth Scanner
          </p>
        </div>
      </Link>

      {/* Category Dropdowns */}
      {CATEGORIES.map((cat) => {
        const isOpen = openCategory === cat.key;
        const isActive = isCurrentCategory(cat.sectionTitles);
        const items = getVisibleItemsForSections(cat.sectionTitles);
        const Icon = cat.icon;

        if (items.length === 0) return null;

        return (
          <div key={cat.key} className="relative">
            <button
              onClick={() => setOpenCategory(isOpen ? null : cat.key)}
              onMouseEnter={() => {
                // If any dropdown is already open, switch on hover
                if (openCategory && openCategory !== cat.key) {
                  setOpenCategory(cat.key);
                }
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                isOpen
                  ? "bg-slate-200 text-slate-900 dark:bg-slate-800 dark:text-white shadow-xs"
                  : isActive
                  ? "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30"
                  : "text-slate-700 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/70"
              }`}
              aria-expanded={isOpen}
            >
              <Icon size={14} className={isActive ? "text-cyan-400" : "text-slate-400"} />
              <span className="hidden md:inline">{cat.title}</span>
              <span className="md:hidden">{cat.shortTitle}</span>
              {cat.badge && (
                <span className="hidden lg:inline-flex items-center justify-center px-1.5 py-0.2 text-[9px] font-mono font-bold rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  {cat.badge}
                </span>
              )}
              <ChevronDown
                size={12}
                className={`transition-transform duration-200 text-slate-400 ${
                  isOpen ? "rotate-180 text-cyan-400" : ""
                }`}
              />
            </button>

            {/* Mega Dropdown Panel */}
            {isOpen && (
              <div
                className="absolute left-0 top-full mt-2 z-50 w-[360px] sm:w-[540px] md:w-[680px] lg:w-[840px] max-w-[95vw] rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-2xl backdrop-blur-2xl dark:border-slate-800 dark:bg-[#07111F]/98 dark:shadow-black/70 animate-in fade-in slide-in-from-top-2 duration-150"
                style={{ maxHeight: "calc(85vh - 70px)", overflowY: "auto" }}
              >
                {/* Header ribbon */}
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80 pb-2.5 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/15 text-cyan-400">
                      <Icon size={14} />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                        {cat.title}
                      </h3>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        {items.length} institutional intelligence engines available
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-cyan-600 dark:text-cyan-400/80">
                    ESC to close
                  </span>
                </div>

                {/* Items Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {items.map((item) => {
                    const ItemIcon = item.icon;
                    const isItemActive =
                      item.href === "/"
                        ? pathname === "/"
                        : pathname?.startsWith(item.href);

                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        onClick={() => setOpenCategory(null)}
                        className={`group relative flex items-start gap-3 rounded-xl p-2.5 transition-all ${
                          isItemActive
                            ? "bg-cyan-500/15 border border-cyan-500/40 text-cyan-800 dark:text-cyan-300 shadow-sm shadow-cyan-950/30"
                            : "border border-transparent hover:border-slate-200 dark:hover:border-slate-800 hover:bg-slate-100/80 dark:hover:bg-slate-800/60 text-slate-800 dark:text-slate-200"
                        }`}
                      >
                        <div
                          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
                            isItemActive
                              ? "bg-cyan-500 text-black shadow-xs shadow-cyan-400/50"
                              : "bg-slate-100 text-slate-600 dark:bg-slate-800/80 dark:text-slate-300 group-hover:bg-cyan-500/20 group-hover:text-cyan-600 dark:group-hover:text-cyan-400"
                          }`}
                        >
                          <ItemIcon size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold truncate group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                              {item.name}
                            </span>
                            {item.badge && (
                              <span
                                className={`rounded px-1.5 py-0.2 text-[9px] font-mono font-bold shrink-0 ${
                                  item.badge === "FLAGSHIP" || item.badge === "HOT"
                                    ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30"
                                    : item.badge === "APEX" || item.badge === "AI"
                                    ? "bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30"
                                    : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                                }`}
                              >
                                {item.badge}
                              </span>
                            )}
                          </div>
                          {item.description && (
                            <p className="mt-0.5 line-clamp-1 text-[10px] text-slate-500 dark:text-slate-400">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Dedicated Watchlist Terminal Link (Always Visible) */}
      <Link
        href="/watchlist"
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all shrink-0 ${
          isWatchlistActive
            ? "bg-gradient-to-r from-amber-500/20 to-amber-600/30 text-amber-800 dark:text-amber-300 border border-amber-500/50 shadow-sm shadow-amber-950/30"
            : "text-slate-700 hover:text-amber-600 hover:bg-amber-500/10 dark:text-slate-300 dark:hover:text-amber-300"
        }`}
        title="Open Multi-Watchlist & Fullscreen Interactive Chart Terminal"
      >
        <Star
          size={14}
          className={`${
            isWatchlistActive
              ? "fill-amber-400 text-amber-400 animate-pulse"
              : "text-amber-400/80"
          }`}
        />
        <span className="hidden sm:inline">Watchlist</span>
      </Link>
    </nav>
  );
}

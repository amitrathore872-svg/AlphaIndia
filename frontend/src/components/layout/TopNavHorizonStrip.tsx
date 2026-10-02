"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAVIGATION_CONFIG } from "@/config/navigationConfig";
import { usePageVisibility } from "@/context/PageVisibilityContext";

export default function TopNavHorizonStrip() {
  const pathname = usePathname();
  const { isPageHidden } = usePageVisibility();

  // Find which section the current page belongs to
  const currentSection = NAVIGATION_CONFIG.find((section) =>
    section.items.some((item) => {
      if (item.href === "/" && pathname === "/") return true;
      if (item.href !== "/" && pathname?.startsWith(item.href)) return true;
      return false;
    })
  );

  // If on watchlist or no matching section, don't take up vertical space
  if (!currentSection || pathname === "/watchlist") {
    return null;
  }

  const visibleItems = currentSection.items.filter(
    (item) => !isPageHidden(item.href)
  );

  if (visibleItems.length <= 1) {
    return null;
  }

  return (
    <div className="hidden md:flex items-center gap-1 overflow-x-auto px-4 py-1.5 border-b border-slate-200 bg-slate-100/70 dark:border-slate-800/80 dark:bg-[#050D1A]/90 custom-scrollbar text-xs">
      <span className="text-[10px] font-mono uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 mr-2 shrink-0 flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
        {currentSection.title}:
      </span>

      <div className="flex items-center gap-1 shrink-0">
        {visibleItems.map((item) => {
          const ItemIcon = item.icon;
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname?.startsWith(item.href);

          return (
            <Link
              key={item.id}
              href={item.href}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all shrink-0 ${
                isActive
                  ? "bg-cyan-500/15 text-cyan-800 dark:text-cyan-300 font-semibold border border-cyan-500/40 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60"
              }`}
            >
              <ItemIcon
                size={13}
                className={isActive ? "text-cyan-600 dark:text-cyan-400" : "text-slate-500 dark:text-slate-400"}
              />
              <span>{item.name}</span>
              {item.badge && (
                <span
                  className={`text-[9px] font-mono px-1 py-0.2 rounded font-bold ${
                    isActive
                      ? "bg-cyan-400 text-black font-bold"
                      : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
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

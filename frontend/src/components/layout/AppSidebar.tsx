"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { NAVIGATION_CONFIG } from "@/config/navigationConfig";
import { usePageVisibility } from "@/context/PageVisibilityContext";

interface AppSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  isMobileDrawerOnly?: boolean;
}

export default function AppSidebar({
  isOpen = false,
  onClose,
  isCollapsed = false,
  onToggleCollapse,
  isMobileDrawerOnly = true,
}: AppSidebarProps) {
  const pathname = usePathname();
  const { isPageHidden } = usePageVisibility();

  // Dynamically filter out hidden pages and exclude empty sections
  const visibleNavigation = NAVIGATION_CONFIG.map((group) => ({
    ...group,
    items: group.items.filter((item) => !isPageHidden(item.href)),
  })).filter((group) => group.items.length > 0);

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
        className={`fixed inset-y-0 left-0 z-50 flex h-screen max-w-[85vw] flex-col border-r border-slate-200 bg-white text-slate-900 transition-all duration-300 ease-in-out dark:border-slate-800 dark:bg-gradient-to-b dark:from-[#07111F] dark:via-[#09182A] dark:to-[#07111F] dark:text-white ${
          isMobileDrawerOnly
            ? `lg:hidden ${isOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"} w-72`
            : `lg:sticky lg:top-0 lg:z-30 lg:translate-x-0 ${
                isOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
              } ${isCollapsed ? "w-72 lg:w-20" : "w-72"}`
        }`}
      >
        {/* ========================================================= */}
        {/* Alpha India Brand Header */}
        {/* ========================================================= */}

        <div
          className={`border-b border-slate-200 py-4.5 sm:py-5 dark:border-slate-800 transition-all duration-300 ${
            isCollapsed ? "px-2.5" : "px-4 sm:px-5"
          }`}
        >
          <div
            className={`flex items-center ${
              isCollapsed ? "flex-col justify-center gap-2.5" : "justify-between w-full"
            }`}
          >
            <Link
              href="/home"
              className="flex items-center gap-3 group shrink-0"
              title="Alpha India — AI Growth Platform"
            >
              <div className="flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 shadow-lg shadow-emerald-900/40 shrink-0 transition-transform duration-200 group-hover:scale-105">
                <LayoutDashboard size={20} className="text-black" />
              </div>

              {!isCollapsed && (
                <div className="overflow-hidden whitespace-nowrap">
                  <h1 className="text-base sm:text-lg font-bold tracking-wide text-slate-900 dark:text-white">
                    Alpha India
                  </h1>

                  <p className="text-[10px] uppercase tracking-[0.28em] text-cyan-600 dark:text-cyan-400">
                    AI Growth Platform
                  </p>
                </div>
              )}
            </Link>

            <div className="flex items-center gap-1.5">
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
        </div>

        {/* ========================================================= */}
        {/* Navigation */}
        {/* ========================================================= */}

        <div
          className={`flex-1 overflow-y-auto overflow-x-hidden ${
            isCollapsed ? "px-2 py-4" : "px-4 py-4 sm:py-5"
          }`}
        >
          {visibleNavigation.map((group) => (
            <div key={group.title} className="mb-4 sm:mb-5">
              {!isCollapsed ? (
                <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500 whitespace-nowrap overflow-hidden text-ellipsis">
                  {group.title}
                </p>
              ) : (
                <div
                  className="my-2.5 mx-1 border-t border-slate-200 dark:border-slate-800/90"
                  title={group.title}
                />
              )}

              <div className="space-y-1">
                {group.items.map((item) => {
                  const active =
                    pathname === item.href ||
                    (item.href !== "/" && pathname.startsWith(item.href + "/"));

                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => onClose?.()}
                      title={item.name}
                      className={`group flex items-center rounded-xl border transition-all duration-200 ${
                        isCollapsed
                          ? "justify-center px-2 py-2.5"
                          : "gap-3 px-3 py-2.5 sm:py-3"
                      } ${
                        active
                          ? "border-emerald-500/40 bg-gradient-to-r from-emerald-500/15 to-cyan-500/10 text-emerald-600 font-semibold shadow-xs dark:text-emerald-300 dark:shadow-md dark:shadow-emerald-900/20"
                          : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-900/60 dark:hover:text-white"
                      }`}
                    >
                      <Icon
                        size={isCollapsed ? 19 : 17}
                        className={`shrink-0 transition-transform duration-200 group-hover:scale-110 ${
                          active
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-slate-500 group-hover:text-cyan-600 dark:text-slate-400 dark:group-hover:text-cyan-400"
                        }`}
                      />

                      {!isCollapsed && (
                        <span className="text-xs sm:text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                          {item.name}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* ========================================================= */}
        {/* Bottom Collapse Toggle Footer (Desktop) */}
        {/* ========================================================= */}
        {onToggleCollapse && (
          <div className="hidden lg:block border-t border-slate-200 p-2.5 dark:border-slate-800">
            <button
              onClick={onToggleCollapse}
              className={`flex w-full items-center rounded-xl border border-slate-200/80 bg-slate-50/70 py-2.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-white ${
                isCollapsed ? "justify-center px-1.5" : "justify-between px-3"
              }`}
              title={isCollapsed ? "Maximize sidebar (Expand)" : "Minimize sidebar (Collapse)"}
              aria-label={isCollapsed ? "Maximize sidebar" : "Minimize sidebar"}
            >
              {!isCollapsed && (
                <span className="text-[11px] font-semibold tracking-wider uppercase text-slate-500 dark:text-slate-400">
                  Minimize Menu
                </span>
              )}
              {isCollapsed ? (
                <ChevronRight size={17} className="text-cyan-500" />
              ) : (
                <ChevronLeft size={17} className="text-slate-400" />
              )}
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
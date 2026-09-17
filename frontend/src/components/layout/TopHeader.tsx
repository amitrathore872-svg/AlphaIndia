"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Search,
  Bell,
  Activity,
  ShieldCheck,
  Clock3,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import ThemeToggle from "./ThemeToggle";

interface TopHeaderProps {
  onOpenSidebar?: () => void;
  isSidebarCollapsed?: boolean;
  onToggleSidebarCollapse?: () => void;
  onOpenControlCenter?: () => void;
}

export default function TopHeader({
  onOpenSidebar,
  isSidebarCollapsed = false,
  onToggleSidebarCollapse,
  onOpenControlCenter,
}: TopHeaderProps) {
  const [time, setTime] = useState("");

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          timeZone: "Asia/Kolkata",
        })
      );
    };

    updateClock();

    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-xl transition-colors duration-200 dark:border-slate-800 dark:bg-[#081225]/95">
      <div className="flex items-center justify-between px-3.5 py-2.5 sm:px-6 sm:py-3.5">
        {/* LEFT: Mobile Menu Button & Desktop Sidebar Toggle */}
        <div className="flex items-center gap-2">
          {onOpenSidebar && (
            <button
              onClick={onOpenSidebar}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 bg-slate-100 text-slate-700 transition hover:border-cyan-500/50 hover:bg-slate-200 dark:border-slate-700/80 dark:bg-slate-900/90 dark:text-slate-300 dark:hover:border-cyan-500/40 dark:hover:bg-slate-800 dark:hover:text-white lg:hidden"
              aria-label="Open Navigation Menu"
            >
              <Menu size={18} />
            </button>
          )}

          {onToggleSidebarCollapse && (
            <button
              onClick={onToggleSidebarCollapse}
              className="hidden lg:flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-100/80 text-slate-600 transition hover:border-cyan-500/50 hover:bg-slate-200 hover:text-slate-900 dark:border-slate-700/80 dark:bg-slate-900/90 dark:text-slate-300 dark:hover:border-cyan-500/40 dark:hover:bg-slate-800 dark:hover:text-white"
              title={isSidebarCollapsed ? "Expand sidebar (Maximize)" : "Collapse sidebar (Minimize)"}
              aria-label="Toggle Sidebar"
            >
              {isSidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>
          )}
        </div>

        {/* CENTER SEARCH (Desktop) */}
        <div className="hidden w-full max-w-xl lg:block mx-4">
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-100/80 px-4 py-2 transition-colors dark:border-slate-700 dark:bg-slate-900/80">
            <Search size={16} className="text-slate-400 dark:text-slate-500" />

            <input
              placeholder="Search company, symbol, sector..."
              className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none dark:text-white dark:placeholder:text-slate-500"
            />
          </div>
        </div>

        {/* RIGHT STATUS & PROFILE */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Universal Control Center & Action Logs Trigger */}
          <button
            onClick={onOpenControlCenter}
            title="Open Universal Control System & Action Logs"
            className="flex items-center gap-1.5 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2.5 sm:px-3 py-1.5 transition-all duration-200 hover:border-cyan-400 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 font-mono text-[11px] font-bold shadow-xs hover:shadow-cyan-950/40 cursor-pointer"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400" />
            </span>
            <span className="hidden sm:inline">CONTROL & LOGS</span>
            <span className="sm:hidden">CONTROL</span>
          </button>

          <Link
            href="/monitoring"
            title="Live Market Engine — View Real-time Telemetry"
            className="hidden md:flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 transition-all duration-200 hover:border-emerald-400/50 hover:bg-emerald-500/20"
          >
            <Activity size={14} className="text-emerald-500 dark:text-emerald-400" />
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 tracking-wide">
              LIVE ENGINE
            </span>
            <span className="hidden lg:inline-flex rounded-md bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 dark:text-emerald-300">
              ONLINE
            </span>
          </Link>

          <div className="hidden items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 xl:flex">
            <ShieldCheck size={14} className="text-cyan-600 dark:text-cyan-400" />
            <span className="text-[11px] font-semibold text-cyan-600 dark:text-cyan-400">
              AUDIT READY
            </span>
          </div>

          <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 md:flex dark:border-slate-700 dark:bg-slate-900">
            <Clock3 size={14} className="text-amber-500 dark:text-amber-400" />
            <span className="text-xs font-semibold text-slate-700 dark:text-white">
              {time} IST
            </span>
          </div>

          {/* Theme Toggle Button */}
          <ThemeToggle />

          <button
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 shadow-xs transition hover:border-slate-400 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800 dark:hover:text-white"
            aria-label="Notifications"
          >
            <Bell size={16} />
          </button>

          <div className="flex items-center gap-2.5 rounded-xl border border-slate-300 bg-white p-1 sm:px-2.5 sm:py-1.5 shadow-xs dark:border-slate-700 dark:bg-slate-900">
            <div className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-xs font-bold text-black shadow-sm">
              A
            </div>

            <div className="hidden lg:block">
              <p className="text-xs font-semibold text-slate-800 dark:text-white">
                Amit
              </p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Alpha India Admin
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

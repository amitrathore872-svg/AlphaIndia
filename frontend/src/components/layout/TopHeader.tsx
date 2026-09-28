"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bell,
  Activity,
  Clock3,
  Menu,
} from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import NotificationDrawer from "./notifications/NotificationDrawer";
import GlobalCompanySearch from "./GlobalCompanySearch";
import { notificationsApi } from "@/lib/notificationsApi";

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
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

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

  useEffect(() => {
    const fetchUnreadStats = async () => {
      try {
        const stats = await notificationsApi.getStats();
        setUnreadCount(stats.unread_count || 0);
      } catch {
        // Silently fail if backend is restarting
      }
    };

    fetchUnreadStats();
    const interval = setInterval(fetchUnreadStats, 12000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-xl transition-colors duration-200 dark:border-slate-800 dark:bg-[#081225]/95">
      <div className="flex items-center justify-between px-3.5 py-2.5 sm:px-6 sm:py-3.5">
        {/* LEFT: Mobile Menu Button (Mobile Only) */}
        {onOpenSidebar && (
          <div className="flex items-center lg:hidden">
            <button
              onClick={onOpenSidebar}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 bg-slate-100 text-slate-700 transition hover:border-cyan-500/50 hover:bg-slate-200 dark:border-slate-700/80 dark:bg-slate-900/90 dark:text-slate-300 dark:hover:border-cyan-500/40 dark:hover:bg-slate-800 dark:hover:text-white"
              aria-label="Open Navigation Menu"
            >
              <Menu size={18} />
            </button>
          </div>
        )}

        {/* CENTER COMPANY SEARCH (Screener.in style -> /techno-funda/[symbol]) */}
        <div className="flex-1 mx-2 sm:mx-4 flex items-center justify-center min-w-0">
          <GlobalCompanySearch />
        </div>

        {/* RIGHT STATUS & PROFILE */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
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

          <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 md:flex dark:border-slate-700 dark:bg-slate-900">
            <Clock3 size={14} className="text-amber-500 dark:text-amber-400" />
            <span className="text-xs font-semibold text-slate-700 dark:text-white">
              {time} IST
            </span>
          </div>

          {/* Theme Toggle Button */}
          <ThemeToggle />

          <button
            onClick={() => setIsNotificationOpen((prev) => !prev)}
            className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 shadow-xs transition hover:border-cyan-500/50 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-cyan-500/50 dark:hover:bg-slate-800 dark:hover:text-white"
            aria-label="Notifications"
            title="Notification Center"
          >
            <Bell size={16} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-cyan-500 px-1 text-[10px] font-bold text-black shadow-xs ring-2 ring-white dark:ring-[#081225]">
                {unreadCount > 99 ? "99+" : unreadCount}
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-60" />
              </span>
            )}
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

      {/* Slide-out Notification Drawer */}
      <NotificationDrawer
        isOpen={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
        onStatsUpdated={(stats) => setUnreadCount(stats.unread_count)}
      />
    </header>
  );
}

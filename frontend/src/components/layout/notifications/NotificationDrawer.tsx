"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  X,
  Bell,
  CheckCheck,
  RefreshCw,
  Sparkles,
  Zap,
  Radio,
  TrendingUp,
  Send,
  Share2,
  ExternalLink,
  ChevronRight,
  Check,
  Target,
} from "lucide-react";
import {
  notificationsApi,
  SystemNotificationItem,
  NotificationStats,
} from "@/lib/notificationsApi";

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onStatsUpdated?: (stats: NotificationStats) => void;
}

const CATEGORY_TABS = [
  { id: "ALL", label: "All Alerts" },
  { id: "VCP_BREAKOUT", label: "🎯 VCP Radar" },
  { id: "PRE_BREAKOUT", label: "⚡ Pre-Breakout" },
  { id: "MOMENTUM_RADAR", label: "🚀 Momentum Radar" },
  { id: "ATHENA_PEAD", label: "⚡ PEAD Flash" },
  { id: "CATALYST_ORDER", label: "📡 Catalysts" },
  { id: "GROWTH_BREAKOUT", label: "📈 Growth" },
  { id: "SMART_MONEY", label: "💼 Smart Money" },
  { id: "SYSTEM_ALERT", label: "⚙️ System" },
];

export default function NotificationDrawer({
  isOpen,
  onClose,
  onStatsUpdated,
}: NotificationDrawerProps) {
  const [notifications, setNotifications] = useState<SystemNotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const [notifData, stats] = await Promise.all([
        notificationsApi.getNotifications({
          category: selectedCategory,
          unread_only: unreadOnly,
          limit: 35,
        }),
        notificationsApi.getStats(),
      ]);
      setNotifications(notifData.notifications || []);
      if (onStatsUpdated) {
        onStatsUpdated(stats);
      }
    } catch (err) {
      console.error("Failed to load notifications:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, unreadOnly, onStatsUpdated]);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, fetchNotifications]);

  const handleMarkAsRead = async (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await notificationsApi.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      const stats = await notificationsApi.getStats();
      if (onStatsUpdated) onStatsUpdated(stats);
    } catch (err) {
      console.error("Failed to mark notification read:", err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      const stats = await notificationsApi.getStats();
      if (onStatsUpdated) onStatsUpdated(stats);
      showToast("All notifications marked as read");
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  const handleSeedTestAlerts = async () => {
    try {
      setLoading(true);
      await notificationsApi.seedTestNotifications();
      await fetchNotifications();
      showToast("Seeded fresh institutional demo alerts");
    } catch (err) {
      console.error("Failed to seed demo notifications:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await notificationsApi.archiveNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      const stats = await notificationsApi.getStats();
      if (onStatsUpdated) onStatsUpdated(stats);
    } catch (err) {
      console.error("Failed to dismiss notification:", err);
    }
  };

  const showToast = (msg: string) => {
    setActionSuccessMsg(msg);
    setTimeout(() => setActionSuccessMsg(null), 3000);
  };

  const shareOnWhatsApp = (notif: SystemNotificationItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const memo = `⚡ *ALPHA INDIA ALERT*\n━━━━━━━━━━━━━━━━━━━━━\n${notif.title}\n\n${notif.message}\n━━━━━━━━━━━━━━━━━━━━━\n📡 _Alpha India Terminal_`;
    const url = `https://wa.me/?text=${encodeURIComponent(memo)}`;
    window.open(url, "_blank");
    showToast("Opened WhatsApp Web memo share");
  };

  const shareToTelegram = async (notif: SystemNotificationItem, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await notificationsApi.broadcast({
        channels: ["TELEGRAM"],
        symbol: typeof notif.metadata?.symbol === "string" ? notif.metadata.symbol : undefined,
        title: notif.title,
        message: `${notif.title}\n\n${notif.message}`,
      });
      if (res.results?.telegram?.success) {
        showToast("Broadcast to Telegram channel successfully!");
      } else {
        const error = res.results?.telegram?.error || "Telegram not configured";
        showToast(`Telegram dispatch notice: ${error}`);
      }
    } catch (err) {
      console.error("Failed to broadcast telegram:", err);
      showToast("Configure Telegram bot in Alert Center");
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    try {
      const diffSec = Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / 1000);
      if (diffSec < 60) return "Just now";
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
      return `${Math.floor(diffSec / 86400)}d ago`;
    } catch {
      return dateStr;
    }
  };

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] overflow-hidden">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/75 backdrop-blur-xs transition-opacity"
      />

      {/* Slide-out Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 flex max-w-full pl-6 sm:pl-10 h-screen pointer-events-none">
        <div className="w-screen max-w-lg h-full max-h-screen border-l border-slate-200 dark:border-cyan-500/30 bg-white dark:bg-[#050B14] text-slate-800 dark:text-white shadow-2xl flex flex-col overflow-hidden pointer-events-auto">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#081225] px-5 py-4 shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400">
                <Bell size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold tracking-wider text-slate-900 dark:text-white uppercase">
                    Alert Center
                  </h2>
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Institutional In-App Radar & Multi-Channel Feed
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={fetchNotifications}
                disabled={loading}
                title="Refresh feed"
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
              >
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              </button>
              <button
                onClick={onClose}
                title="Close drawer"
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Quick Action Bar */}
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80 bg-slate-100/70 dark:bg-[#09152b] px-5 py-2.5 text-xs shrink-0">
            <div className="flex items-center gap-2">
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:border-cyan-500/40 hover:text-cyan-600 dark:hover:text-cyan-400 transition"
              >
                <CheckCheck size={13} />
                Mark all read
              </button>
              <button
                onClick={handleSeedTestAlerts}
                className="flex items-center gap-1.5 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/20 transition"
              >
                <Sparkles size={12} />
                Demo Seed
              </button>
            </div>

            <label className="flex items-center gap-1.5 cursor-pointer select-none text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300">
              <input
                type="checkbox"
                checked={unreadOnly}
                onChange={(e) => setUnreadOnly(e.target.checked)}
                className="rounded border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-500 focus:ring-0"
              />
              Unread only
            </label>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-1.5 overflow-x-auto border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#060e1d] px-4 py-2 shrink-0 scrollbar-none">
            {CATEGORY_TABS.map((tab) => {
              const active = selectedCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSelectedCategory(tab.id)}
                  className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
                    active
                      ? "border border-cyan-500/50 bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 font-bold shadow-xs"
                      : "border border-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-300"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Toast Notice */}
          {actionSuccessMsg && (
            <div className="mx-4 mt-2 flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-300 shrink-0">
              <Check size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>{actionSuccessMsg}</span>
            </div>
          )}

          {/* Notifications List */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2.5 overscroll-contain">
            {loading && notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-slate-500 text-xs">
                <RefreshCw size={24} className="animate-spin text-cyan-600 dark:text-cyan-500 mb-2" />
                <span>Synchronizing institutional alerts...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-56 text-center text-slate-500">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 mb-3 text-slate-400">
                  <Bell size={20} />
                </div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-300">All clear on the radar</p>
                <p className="text-xs text-slate-500 mt-1 max-w-xs">
                  No active alerts matching the selected filter. Click &quot;Demo Seed&quot; to test or wait for real-time exchange filings.
                </p>
                <button
                  onClick={handleSeedTestAlerts}
                  className="mt-4 flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-700 dark:text-cyan-400 hover:bg-cyan-500/20 transition"
                >
                  <Sparkles size={13} />
                  Seed Demo Alerts
                </button>
              </div>
            ) : (
              notifications.map((notif) => {
                const isCritical = notif.severity === "critical";
                const isSuccess = notif.severity === "success";
                const isWarning = notif.severity === "warning";

                return (
                  <div
                    key={notif.id}
                    onClick={() => !notif.is_read && handleMarkAsRead(notif.id)}
                    className={`group relative rounded-xl border p-3.5 transition cursor-pointer ${
                      notif.is_read
                        ? "border-slate-200 dark:border-slate-800/70 bg-slate-50/80 dark:bg-[#081223]/50 opacity-80 hover:opacity-100 hover:border-slate-300 dark:hover:border-slate-700"
                        : isCritical
                        ? "border-rose-300 dark:border-rose-500/30 bg-rose-50/60 dark:bg-[#160b14] hover:border-rose-500/50"
                        : "border-cyan-200 dark:border-cyan-500/30 bg-cyan-50/40 dark:bg-[#08152e] hover:border-cyan-400 dark:hover:border-cyan-500/60"
                    }`}
                  >
                    {/* Unread indicator dot */}
                    {!notif.is_read && (
                      <span className="absolute top-3 right-3 h-2 w-2 rounded-full bg-cyan-400 ring-4 ring-cyan-500/20" />
                    )}

                    <div className="flex items-start gap-2.5">
                      {/* Icon */}
                      <div
                        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-xs ${
                          isCritical
                            ? "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                            : isSuccess
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : isWarning
                            ? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            : "border-cyan-500/40 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400"
                        }`}
                      >
                        {notif.category === "VCP_BREAKOUT" ? (
                          <Target size={13} className="text-cyan-600 dark:text-cyan-400" />
                        ) : notif.category === "PRE_BREAKOUT" ? (
                          <Zap size={13} className="text-amber-600 dark:text-amber-400" />
                        ) : notif.category === "MOMENTUM_RADAR" ? (
                          <TrendingUp size={13} className="text-emerald-600 dark:text-emerald-400" />
                        ) : notif.category === "ATHENA_PEAD" ? (
                          <Zap size={13} />
                        ) : notif.category === "CATALYST_ORDER" ? (
                          <Radio size={13} />
                        ) : notif.category === "GROWTH_BREAKOUT" ? (
                          <TrendingUp size={13} />
                        ) : (
                          <Bell size={13} />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                              notif.category === "VCP_BREAKOUT"
                                ? "bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30"
                                : notif.category === "PRE_BREAKOUT"
                                ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                                : notif.category === "MOMENTUM_RADAR"
                                ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                                : isCritical
                                ? "bg-rose-500/20 text-rose-700 dark:text-rose-400"
                                : isSuccess
                                ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400"
                                : "bg-cyan-500/20 text-cyan-700 dark:text-cyan-300"
                            }`}
                          >
                            {notif.category === "VCP_BREAKOUT"
                              ? "VCP BREAKOUT"
                              : notif.category === "PRE_BREAKOUT"
                              ? "PRE-BREAKOUT A+"
                              : notif.category === "MOMENTUM_RADAR"
                              ? "MOMENTUM RADAR"
                              : notif.category.replace("_", " ")}
                          </span>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400">
                            {formatTimeAgo(notif.created_at)}
                          </span>
                        </div>

                        <h3 className="text-xs font-bold text-slate-900 dark:text-white leading-snug">
                          {notif.title}
                        </h3>

                        <p className="mt-1 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                          {notif.message}
                        </p>

                        {/* Actions bar */}
                        <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800/60">
                          <div className="flex items-center gap-1.5">
                            {/* Deep link button */}
                            {notif.action_url && (
                              <Link
                                href={notif.action_url}
                                onClick={onClose}
                                className="flex items-center gap-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 px-2 py-0.5 text-[10px] font-medium text-slate-700 dark:text-slate-300 hover:border-cyan-500/50 hover:text-cyan-600 dark:hover:text-cyan-400 transition"
                              >
                                {notif.category === "VCP_BREAKOUT" ? "VCP Radar" : "View Analysis"}
                                <ExternalLink size={10} />
                              </Link>
                            )}

                            {/* Telegram 1-click broadcast */}
                            <button
                              onClick={(e) => shareToTelegram(notif, e)}
                              title="Broadcast alert to Telegram"
                              className="flex items-center gap-1 rounded border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-700 dark:text-sky-300 hover:bg-sky-500/20 transition"
                            >
                              <Send size={10} />
                              Telegram
                            </button>

                            {/* WhatsApp 1-click share */}
                            <button
                              onClick={(e) => shareOnWhatsApp(notif, e)}
                              title="Share memo via WhatsApp"
                              className="flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 transition"
                            >
                              <Share2 size={10} />
                              WhatsApp
                            </button>
                          </div>

                          <div className="flex items-center gap-1">
                            {!notif.is_read && (
                              <button
                                onClick={(e) => handleMarkAsRead(notif.id, e)}
                                title="Mark as read"
                                className="rounded p-1 text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition"
                              >
                                <Check size={13} />
                              </button>
                            )}
                            <button
                              onClick={(e) => handleDismiss(notif.id, e)}
                              title="Archive alert"
                              className="rounded p-1 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 transition"
                            >
                              <X size={13} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Navigation */}
          <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#081225] p-3.5 shrink-0">
            <Link
              href="/alerts"
              onClick={onClose}
              className="flex items-center justify-between rounded-xl border border-cyan-500/30 bg-gradient-to-r from-cyan-50 via-blue-50/60 to-slate-50 dark:from-cyan-950/40 dark:via-blue-950/40 dark:to-slate-900 px-4 py-2.5 text-xs font-semibold text-cyan-700 dark:text-cyan-300 hover:border-cyan-400 hover:text-cyan-800 dark:hover:text-white transition group shadow-xs"
            >
              <div className="flex items-center gap-2">
                <Send size={14} className="text-cyan-600 dark:text-cyan-400" />
                <span>Configure Telegram & WhatsApp Channels</span>
              </div>
              <ChevronRight size={14} className="transition group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

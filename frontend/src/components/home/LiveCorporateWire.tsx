"use client";

// =========================================================================
// Alpha India — Live Corporate Updates & Regulatory Wire (Daily One-Pager)
// Surfaces real-time exchange corporate filings, contract wins, capex, and earnings
// =========================================================================

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Radio,
  ExternalLink,
  RefreshCw,
  Trophy,
  Zap,
  Building,
  CheckCircle2,
  AlertCircle,
  FileText,
  Clock,
} from "lucide-react";
import { fetchAnnouncements, type AnnouncementRadarItem } from "@/lib/announcementsApi";

export default function LiveCorporateWire() {
  const [items, setItems] = useState<AnnouncementRadarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filterType, setFilterType] = useState<string>("ALL");

  const loadAnnouncements = async () => {
    setIsRefreshing(true);
    try {
      const data = await fetchAnnouncements({ limit: 16, sort_by: "announcement_date", sort_order: "desc" });
      if (Array.isArray(data)) {
        setItems(data);
      }
    } catch (err) {
      console.warn("Failed to load live announcements wire:", err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadAnnouncements();
    const interval = setInterval(loadAnnouncements, 45 * 1000); // 45s live poll
    return () => clearInterval(interval);
  }, []);

  const filteredItems = items.filter((item) => {
    if (filterType === "ALL") return true;
    if (filterType === "ORDER_WIN") return item.catalyst_type?.includes("ORDER");
    if (filterType === "CAPEX") return item.catalyst_type?.includes("CAPEX");
    if (filterType === "CRITICAL") return item.impact_level === "CRITICAL";
    return true;
  });

  return (
    <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-[#071322]/95 p-5 shadow-sm backdrop-blur-md">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <Radio className="h-4 w-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                Live Corporate Updates & Regulatory Wire
              </h3>
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-black uppercase text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                Live Disclosures
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              NSE & BSE official exchange filings scanned by Alpha India AI forensic parser
            </p>
          </div>
        </div>

        {/* Filters & Refresh */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 p-1 text-xs">
            {(
              [
                { id: "ALL", label: "All Wire" },
                { id: "ORDER_WIN", label: "🏆 Order Wins" },
                { id: "CAPEX", label: "🏗️ Capex" },
                { id: "CRITICAL", label: "🔥 Critical" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterType(tab.id)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition cursor-pointer ${
                  filterType === tab.id
                    ? "bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-amber-400 border border-slate-200 dark:border-slate-700"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            onClick={loadAnnouncements}
            disabled={isRefreshing}
            className="flex items-center gap-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title="Refresh Wire"
          >
            <RefreshCw className={`h-3 w-3 ${isRefreshing ? "animate-spin text-amber-500" : ""}`} />
            <span className="hidden sm:inline text-[11px]">{isRefreshing ? "Syncing" : "Sync"}</span>
          </button>

          <Link
            href="/announcements"
            className="text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-0.5 ml-1"
          >
            Full Wire →
          </Link>
        </div>
      </div>

      {/* Wire List */}
      <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800/60 max-h-[380px] overflow-y-auto pr-1">
        {loading ? (
          <div className="space-y-3 py-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-slate-100 dark:bg-slate-900/60 animate-pulse" />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            No corporate disclosures matching filter in this window.
          </div>
        ) : (
          filteredItems.map((item, idx) => (
            <div
              key={item.id || idx}
              className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group hover:bg-slate-50/70 dark:hover:bg-slate-900/40 rounded-xl px-2 transition"
            >
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  {item.symbol ? (
                    <Link
                      href={`/stocks/${item.symbol}`}
                      className="font-black text-sm text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition"
                    >
                      {item.symbol}
                    </Link>
                  ) : (
                    <span className="font-black text-sm text-slate-900 dark:text-white">
                      {item.company_name}
                    </span>
                  )}

                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {item.company_name}
                  </span>

                  {/* Impact badge */}
                  <span
                    className={`rounded-md px-1.5 py-0.2 text-[9px] font-black uppercase ${
                      item.impact_level === "CRITICAL"
                        ? "bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30"
                        : item.impact_level === "HIGH"
                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30"
                        : "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {item.impact_level} IMPACT
                  </span>

                  {/* Catalyst Type */}
                  <span className="rounded-md border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/80 px-1.5 py-0.2 text-[9px] font-bold text-slate-700 dark:text-slate-300">
                    {item.catalyst_type?.replace(/_/g, " ")}
                  </span>

                  {item.deal_value_cr && item.deal_value_cr > 0 && (
                    <span className="rounded-md bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.2 text-[9px] font-black text-emerald-700 dark:text-emerald-300">
                      ₹{item.deal_value_cr.toLocaleString("en-IN")} Cr
                    </span>
                  )}
                </div>

                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 line-clamp-1 leading-snug">
                  {item.headline}
                </p>

                {item.ai_insight && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                    💡 <strong className="text-slate-700 dark:text-slate-300">AI Insight:</strong> {item.ai_insight}
                  </p>
                )}
              </div>

              {/* Action */}
              <div className="shrink-0 flex items-center gap-2">
                {item.current_price && (
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block">CMP</span>
                    <span className="text-xs font-black font-mono text-slate-900 dark:text-white">
                      ₹{item.current_price.toLocaleString("en-IN")}
                    </span>
                  </div>
                )}

                {item.symbol && (
                  <Link
                    href={`/stocks/${item.symbol}`}
                    className="flex items-center gap-1 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-xs font-bold text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/20 transition shadow-xs"
                  >
                    <span>View</span>
                    <ExternalLink size={12} />
                  </Link>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

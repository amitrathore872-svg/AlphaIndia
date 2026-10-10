"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Search,
  Filter,
  RefreshCw,
  Trophy,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Send,
  Building2,
  Clock,
  Sparkles,
  LayoutGrid,
  Table as TableIcon,
  ShieldCheck,
} from "lucide-react";
import {
  fetchAnnouncements,
  sendTelegramAlert,
  type AnnouncementRadarItem,
  type OrderSignificanceTier,
} from "@/lib/announcementsApi";
import OrderWinCard from "@/components/announcements/OrderWinCard";

interface OrderViewTabProps {
  onSelectOrder: (order: AnnouncementRadarItem) => void;
  onInspectHistory?: (symbol: string, companyName?: string) => void;
  onShowNotification?: (type: "success" | "error" | "info", message: string) => void;
}

export default function OrderViewTab({
  onSelectOrder,
  onInspectHistory,
  onShowNotification,
}: OrderViewTabProps) {
  const [items, setItems] = useState<AnnouncementRadarItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>("");
  const [selectedTier, setSelectedTier] = useState<OrderSignificanceTier | "">("");
  const [preset, setPreset] = useState<string>("ALL");
  const [minDealCr, setMinDealCr] = useState<number | undefined>(undefined);
  const [minRevPct, setMinRevPct] = useState<number | undefined>(undefined);
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [page, setPage] = useState<number>(1);
  const pageSize = 40;

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAnnouncements({
        catalyst_type: "ORDER_WIN",
        order_tier: selectedTier || undefined,
        deal_value_min: minDealCr,
        rev_pct_min: minRevPct,
        search: search.trim() || undefined,
        sort_by: "announcement_date",
        sort_order: "desc",
        page,
        limit: pageSize,
      });
      setItems(res || []);
    } catch (err) {
      console.error("Failed to load order announcements:", err);
      if (onShowNotification) onShowNotification("error", "Failed to load individual order disclosures.");
    } finally {
      setLoading(false);
    }
  }, [selectedTier, minDealCr, minRevPct, search, page, onShowNotification]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleApplyPreset = (p: string) => {
    setPreset(p);
    setPage(1);
    if (p === "ALL") {
      setSelectedTier("");
      setMinDealCr(undefined);
      setMinRevPct(undefined);
    } else if (p === "MEGA") {
      setSelectedTier("");
      setMinDealCr(500);
      setMinRevPct(undefined);
    } else if (p === "TRANSFORMATIONAL") {
      setSelectedTier("TRANSFORMATIONAL");
      setMinDealCr(undefined);
      setMinRevPct(undefined);
    } else if (p === "GAME_CHANGER") {
      setSelectedTier("");
      setMinDealCr(undefined);
      setMinRevPct(25.0);
    }
  };

  const handleDispatchTelegram = async (e: React.MouseEvent, item: AnnouncementRadarItem) => {
    e.stopPropagation();
    try {
      if (onShowNotification) onShowNotification("info", `Broadcasting ${item.symbol || item.company_name} alert...`);
      const res = await sendTelegramAlert(item.id);
      if (onShowNotification) onShowNotification("success", res.message || "Alert dispatched to Telegram desk!");
    } catch (err) {
      if (onShowNotification) onShowNotification("error", `Telegram dispatch failed: ${(err as Error).message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── TOP FILTER BAR ────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-[#090f1d] border border-slate-800">
        <div className="flex flex-wrap items-center gap-3">
          {/* Preset Pills */}
          <div className="flex items-center rounded-lg bg-slate-900 border border-slate-800 p-0.5">
            {[
              { id: "ALL", label: "All Orders" },
              { id: "TRANSFORMATIONAL", label: "Transformational" },
              { id: "MEGA", label: "Mega >₹500 Cr" },
              { id: "GAME_CHANGER", label: "Lift >25% Sales" },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => handleApplyPreset(p.id)}
                className={`px-3 py-1 rounded-md text-xs font-mono font-semibold transition-all ${
                  preset === p.id
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search ticker, client, or headline..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 w-52 sm:w-64 font-mono"
            />
          </div>
        </div>

        {/* View Mode & Refresh */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg bg-slate-900 border border-slate-800 p-0.5">
            <button
              onClick={() => setViewMode("table")}
              className={`p-1.5 rounded ${viewMode === "table" ? "bg-slate-800 text-cyan-300" : "text-slate-500"}`}
              title="Table View"
            >
              <TableIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("cards")}
              className={`p-1.5 rounded ${viewMode === "cards" ? "bg-slate-800 text-cyan-300" : "text-slate-500"}`}
              title="Cards View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={loadOrders}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white transition-colors"
            title="Refresh order stream"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-cyan-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* ── CONTENT: TABLE OR CARDS ───────────────────────────────────── */}
      {viewMode === "cards" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {loading && items.length === 0 ? (
            <div className="col-span-full py-20 text-center text-slate-500 font-mono text-sm">
              Loading individual order cards...
            </div>
          ) : items.length === 0 ? (
            <div className="col-span-full py-20 text-center text-slate-500 font-mono text-sm">
              No order win filings matched current criteria.
            </div>
          ) : (
            items.map((it) => (
              <OrderWinCard
                key={it.id}
                item={it}
                onSelectDrawer={(selected: AnnouncementRadarItem) => onSelectOrder(selected)}
                onSendAlert={(selected: AnnouncementRadarItem) => handleDispatchTelegram({ stopPropagation: () => {} } as any, selected)}
              />
            ))
          )}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-800 bg-[#090f1d] overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 text-[11px] uppercase tracking-wider">
                  <th className="py-3 px-4 font-sans">Company</th>
                  <th className="py-3 px-3">Date</th>
                  <th className="py-3 px-3">Deal Value</th>
                  <th className="py-3 px-3">% Sales Lift</th>
                  <th className="py-3 px-3">Client / Counterparty</th>
                  <th className="py-3 px-3">Runway</th>
                  <th className="py-3 px-4">Headline & AI Insight</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800/60">
                {loading && items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-slate-500">
                      Loading order stream...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-slate-500">
                      No order win filings found.
                    </td>
                  </tr>
                ) : (
                  items.map((it) => (
                    <tr
                      key={it.id}
                      onClick={() => onSelectOrder(it)}
                      className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                    >
                      {/* Company */}
                      <td className="py-3.5 px-4 font-sans">
                        <div className="font-semibold text-white group-hover:text-cyan-300 transition-colors">
                          {it.company_name}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                          {it.symbol || "EQUITY"}
                        </div>
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-3 text-slate-400 text-[11px]">
                        {it.announcement_date
                          ? new Date(it.announcement_date).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })
                          : "Recent"}
                      </td>

                      {/* Deal Value */}
                      <td className="py-3.5 px-3 font-semibold text-emerald-400 text-sm">
                        {it.deal_value_cr ? `₹${it.deal_value_cr.toLocaleString("en-IN", { maximumFractionDigits: 1 })} Cr` : "—"}
                      </td>

                      {/* % Sales Lift */}
                      <td className="py-3.5 px-3">
                        {it.synergy_rev_pct_ttm ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/30">
                            {it.synergy_rev_pct_ttm.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      {/* Counterparty */}
                      <td className="py-3.5 px-3">
                        {it.order_client_counterparty ? (
                          <span className="text-slate-300 font-medium">
                            {it.order_client_counterparty}
                          </span>
                        ) : (
                          <span className="text-slate-500 italic font-normal">
                            Not Disclosed
                          </span>
                        )}
                      </td>

                      {/* Execution Runway */}
                      <td className="py-3.5 px-3 text-slate-400">
                        {it.order_execution_months ? (
                          `${it.order_execution_months}M`
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      {/* Headline & Insight */}
                      <td className="py-3.5 px-4 font-sans max-w-md">
                        <div className="line-clamp-1 text-slate-200 group-hover:text-white transition-colors">
                          {it.headline}
                        </div>
                        {it.ai_insight && (
                          <div className="line-clamp-1 text-[11px] text-slate-400 mt-0.5 italic">
                            "{it.ai_insight}"
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {it.symbol && onInspectHistory && (
                            <button
                              onClick={() => onInspectHistory(it.symbol!, it.company_name)}
                              className="px-2 py-1 rounded bg-slate-800 text-[11px] text-cyan-400 hover:bg-cyan-950 border border-slate-700"
                              title="View quarterly backlog chart"
                            >
                              History
                            </button>
                          )}
                          <button
                            onClick={(e) => handleDispatchTelegram(e, it)}
                            className="p-1.5 rounded bg-slate-800/80 text-amber-400 hover:text-amber-300 hover:bg-amber-950/40"
                            title="Dispatch Telegram alert"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                          {it.pdf_url && it.pdf_url !== "-" && (
                            <a
                              href={it.pdf_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded bg-slate-800/80 text-slate-400 hover:text-white"
                              title="Original PDF"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800 bg-slate-950/50 text-xs font-mono text-slate-400">
            <span>Showing {items.length} order filings</span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1 rounded bg-slate-900 border border-slate-800 disabled:opacity-40 hover:text-white"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span>Page {page}</span>
              <button
                disabled={items.length < pageSize}
                onClick={() => setPage((p) => p + 1)}
                className="p-1 rounded bg-slate-900 border border-slate-800 disabled:opacity-40 hover:text-white"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

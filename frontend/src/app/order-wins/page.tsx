"use client";

// =======================================================
// Alpha India — Institutional Order Win & Backlog Terminal
// 1. ORDERBOOK VIEW: Momentum ranking, Top Gainers, & Sparkline Trends
// 2. ORDER VIEW: Granular Regulation 30 single-order stream & AI cards
// 3. COMPANY VIEW: Cumulative orders as % of revenue with nested accordions
// + Deep-Dive Modal: Interactive quarterly backlog history & source filing quote
// =======================================================

import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import OrderWaterfallDrawer from "@/components/announcements/OrderWaterfallDrawer";
import OrderbookViewTab from "@/components/order-wins/OrderbookViewTab";
import OrderViewTab from "@/components/order-wins/OrderViewTab";
import CompanyViewTab from "@/components/order-wins/CompanyViewTab";
import OrderBookHistoryModal from "@/components/order-wins/OrderBookHistoryModal";
import { type AnnouncementRadarItem } from "@/lib/announcementsApi";

type TerminalTab = "ORDERBOOK_VIEW" | "ORDER_VIEW" | "COMPANY_VIEW";

export default function OrderWinsPage() {
  const [activeTab, setActiveTab] = useState<TerminalTab>("ORDERBOOK_VIEW");

  // State: Modal for Order Book History (Screenshot #2)
  const [selectedHistory, setSelectedHistory] = useState<{
    symbol: string;
    companyName?: string;
  } | null>(null);

  // State: Drawer for Single Order Details
  const [selectedDrawerItem, setSelectedDrawerItem] = useState<AnnouncementRadarItem | null>(null);

  // State: Toast notification
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "info";
    message: string;
  } | null>(null);

  const showNotification = (type: "success" | "error" | "info", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4500);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-20">
        {/* ── TOAST NOTIFICATION ────────────────────────────────────────── */}
        {notification && (
          <div
            className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-md transition-all duration-300 ${
              notification.type === "success"
                ? "border-emerald-500/40 bg-emerald-950/90 text-emerald-200"
                : notification.type === "error"
                ? "border-rose-500/40 bg-rose-950/90 text-rose-200"
                : "border-cyan-500/40 bg-slate-900/90 text-cyan-200"
            }`}
          >
            <span className="text-sm font-medium">{notification.message}</span>
          </div>
        )}

        {/* ── TERMINAL HEADER & NAVIGATION TABS ────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5 pt-1">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-3">
              Tracker Dashboard
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                PRO RADAR
              </span>
            </h1>
            <p className="text-xs text-slate-400 font-mono mt-1">
              Multi-quarter backlog momentum, contract sizing vs TTM revenue, and catalyst anomaly scanner
            </p>
          </div>

          {/* 3 Master Tabs: ORDERBOOK VIEW | ORDER VIEW | COMPANY VIEW */}
          <div className="flex items-center rounded-xl bg-[#090f1e] border border-slate-800 p-1 shadow-inner">
            <button
              onClick={() => setActiveTab("ORDERBOOK_VIEW")}
              className={`px-4 py-2 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all duration-200 ${
                activeTab === "ORDERBOOK_VIEW"
                  ? "bg-[#00d09c] text-black shadow-[0_0_12px_rgba(0,208,156,0.5)]"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              ORDERBOOK VIEW
            </button>

            <button
              onClick={() => setActiveTab("ORDER_VIEW")}
              className={`px-4 py-2 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all duration-200 ${
                activeTab === "ORDER_VIEW"
                  ? "bg-[#00d09c] text-black shadow-[0_0_12px_rgba(0,208,156,0.5)]"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              ORDER VIEW
            </button>

            <button
              onClick={() => setActiveTab("COMPANY_VIEW")}
              className={`px-4 py-2 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all duration-200 ${
                activeTab === "COMPANY_VIEW"
                  ? "bg-[#00d09c] text-black shadow-[0_0_12px_rgba(0,208,156,0.5)]"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              COMPANY VIEW
            </button>
          </div>
        </div>

        {/* ── ACTIVE TAB CONTENT ────────────────────────────────────────── */}
        {activeTab === "ORDERBOOK_VIEW" && (
          <OrderbookViewTab
            onSelectCompany={(symbol, companyName) =>
              setSelectedHistory({ symbol, companyName })
            }
          />
        )}

        {activeTab === "ORDER_VIEW" && (
          <OrderViewTab
            onSelectOrder={(ord) => setSelectedDrawerItem(ord)}
            onInspectHistory={(symbol, companyName) =>
              setSelectedHistory({ symbol, companyName })
            }
            onShowNotification={showNotification}
          />
        )}

        {activeTab === "COMPANY_VIEW" && (
          <CompanyViewTab
            onInspectHistory={(symbol, companyName) =>
              setSelectedHistory({ symbol, companyName })
            }
          />
        )}

        {/* ── DEEP-DIVE MODAL: ORDER BOOK HISTORY (SCREENSHOT #2) ──────── */}
        {selectedHistory && (
          <OrderBookHistoryModal
            symbol={selectedHistory.symbol}
            companyName={selectedHistory.companyName}
            onClose={() => setSelectedHistory(null)}
          />
        )}

        {/* ── WATERFALL DRAWER: SINGLE ORDER DETAILS ────────────────────── */}
        {selectedDrawerItem && (
          <OrderWaterfallDrawer
            item={selectedDrawerItem}
            onClose={() => setSelectedDrawerItem(null)}
          />
        )}
      </div>
    </DashboardLayout>
  );
}

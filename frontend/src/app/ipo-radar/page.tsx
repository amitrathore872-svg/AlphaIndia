"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Rocket,
  Shield,
  Target,
  Clock,
  TrendingUp,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  Calendar,
  Layers,
  Sparkles,
  ArrowUpRight,
  ExternalLink,
  Lock,
  Flame,
  Info,
  BellRing,
  Send,
  Share2,
  Check,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  Download,
  Copy,
  BookOpen,
  X,
  SlidersHorizontal,
  BarChart2,
  Zap,
} from "lucide-react";
import { API_BASE } from "@/lib/apiConfig";
import { notificationsApi } from "@/lib/notificationsApi";
import AddToWatchlistButton from "@/components/watchlist/AddToWatchlistButton";
import Link from "next/link";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/common/PageHeader";
import KpiCard from "@/components/common/KpiCard";
import EmptyState from "@/components/common/EmptyState";
import { SparklineChart, StageBadge } from "@/components/common";

interface IPOSetup {
  id: number;
  symbol: string;
  company: string;
  exchange: string;
  sector: string;
  listing_date: string;
  days_since_listing: number;
  total_trading_bars: number;
  cmp: number;
  day_change_pct: number;
  day1_high: number;
  day1_low: number;
  ath: number;
  drawdown_from_ath: number;
  rvol: number;
  setup_type: string;
  setup_label: string;
  setup_status: "READY" | "TRIGGERED" | "FORMING" | "PRE_CLIFF_WATCH" | "WATCHING";
  conviction_score: number;
  pivot_price: number;
  trigger_price?: number;
  trigger_date?: string | null;
  days_since_trigger?: number | null;
  distance_to_pivot_pct: number;
  stop_loss: number;
  risk_pct: number;
  target_1: number;
  target_2: number;
  anchor_30d_date: string;
  anchor_30d_days_left: number;
  anchor_90d_date: string;
  anchor_90d_days_left: number;
  sparkline?: number[];
  return_90d_pct?: number;
  current_stage?: string;
  stage_code?: string;
  dma50?: number | null;
  dma200?: number | null;
  market_cap?: number | null;
  market_cap_category?: string;
  rationale: string;
}

interface IPOSummary {
  total_monitored: number;
  total_active_setups: number;
  new_listing_count: number;
  blue_sky_ldh_count: number;
  ipo_base_count: number;
  anchor_lockin_count: number;
  broken_phoenix_count: number;
  scanned_at: string;
}

interface LockinItem {
  symbol: string;
  company: string;
  listing_date: string;
  cliff_type: string;
  unlock_date: string;
  days_left: number;
  cmp: number;
  status: string;
  profit_status?: string;
  day1_high: number;
  day1_low: number;
  sparkline?: number[];
  return_90d_pct?: number;
}

type SortField =
  | "symbol"
  | "days_since_listing"
  | "cmp"
  | "day_change_pct"
  | "return_90d_pct"
  | "conviction_score"
  | "distance_to_pivot_pct"
  | "trigger_price"
  | "trigger_date"
  | "risk_pct"
  | "target_1"
  | "setup_status"
  | "rvol";

export default function IPORadarPage() {
  const [summary, setSummary] = useState<IPOSummary | null>(null);
  const [candidates, setCandidates] = useState<IPOSetup[]>([]);
  const [lockinCalendar, setLockinCalendar] = useState<LockinItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [rescanning, setRescanning] = useState<boolean>(false);
  const [broadcasting, setBroadcasting] = useState<boolean>(false);
  const [dispatchingSymbol, setDispatchingSymbol] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);

  // Filters
  const [search, setSearch] = useState<string>("");
  const [selectedTab, setSelectedTab] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [mcapFilter, setMcapFilter] = useState<string>("ALL");
  const [listingAgeFilter, setListingAgeFilter] = useState<string>("ALL");
  const [minScoreFilter, setMinScoreFilter] = useState<number>(0);

  // Sorting
  const [sortBy, setSortBy] = useState<SortField>("conviction_score");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Modals & Panels
  const [showCalendarModal, setShowCalendarModal] = useState<boolean>(false);
  const [showPlaybookModal, setShowPlaybookModal] = useState<boolean>(false);
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);
  const [calendarFilter, setCalendarFilter] = useState<"ALL" | "IMMINENT" | "PASSED" | "UPCOMING">("ALL");

  const showToast = (type: "success" | "error" | "info", text: string) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 5000);
  };

  const fetchData = useCallback(async (forceRefresh = false) => {
    try {
      if (forceRefresh) setRescanning(true);
      else setLoading(true);

      const refreshParam = forceRefresh ? "&force_refresh=true" : "";
      const res = await fetch(`${API_BASE}/api/v1/ipo-radar/setups?limit=150${refreshParam}`);
      if (res.ok) {
        const json = await res.json();
        setSummary(json.summary || null);
        setCandidates(json.items || []);
      }

      // Fetch lock-in calendar
      const calRes = await fetch(`${API_BASE}/api/v1/ipo-radar/lockin-calendar?days_window=45`);
      if (calRes.ok) {
        const calJson = await calRes.json();
        setLockinCalendar(calJson.calendar || []);
      }
    } catch (e) {
      console.error("Failed to fetch IPO Radar data:", e);
      showToast("error", "Failed to fetch IPO Radar data");
    } finally {
      setLoading(false);
      setRescanning(false);
    }
  }, []);

  const handleBroadcastTopAlerts = async () => {
    try {
      setBroadcasting(true);
      const res = await notificationsApi.triggerIpoScanAlerts(true, 85);
      showToast("success", `Dispatched ${res.count} Mainboard IPO alerts to external desks (Telegram & WhatsApp)!`);
    } catch (err: unknown) {
      showToast("error", `Failed to broadcast IPO alerts: ${(err as Error).message}`);
    } finally {
      setBroadcasting(false);
    }
  };

  const handleDispatchTelegram = async (item: IPOSetup) => {
    try {
      setDispatchingSymbol(item.symbol);
      showToast("info", `Sending Telegram Alert for ${item.symbol}...`);
      const res = await fetch(`${API_BASE}/api/v1/ipo-radar/dispatch-telegram`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: item.symbol, force: true }),
      });
      const data = await res.json();
      if (data.success) {
        showToast("success", `⚡ Telegram alert for ${item.symbol} dispatched to bot!`);
      } else {
        showToast("error", `Failed to send Telegram alert: ${data.error || "Unknown error"}`);
      }
    } catch (err: unknown) {
      showToast("error", `Error dispatching Telegram alert: ${(err as Error).message}`);
    } finally {
      setDispatchingSymbol(null);
    }
  };

  const handleBroadcastSingle = async (item: IPOSetup) => {
    try {
      showToast("info", `Formatting & broadcasting ${item.symbol} to external channels...`);
      const res = await notificationsApi.triggerIpoScanAlerts(true, Math.min(item.conviction_score, 80));
      showToast("success", `Alert for ${item.symbol} broadcasted successfully! (${res.count} total dispatched)`);
    } catch (err: unknown) {
      showToast("error", `Failed to dispatch alert for ${item.symbol}: ${(err as Error).message}`);
    }
  };

  const handleShareToWhatsApp = (item: IPOSetup) => {
    const isTriggered = item.setup_status === "TRIGGERED";
    const trigVal = item.trigger_price ?? item.pivot_price;
    const trigLine = isTriggered
      ? `⚡ *Trigger Price:* ₹${trigVal.toFixed(1)} (Triggered: ${item.trigger_date || "Recent Session"}${item.days_since_trigger !== null && item.days_since_trigger !== undefined ? ` • ${item.days_since_trigger}d ago` : ""})\n`
      : `📍 *Pivot Trigger:* ₹${trigVal.toFixed(1)} (Awaiting Breakout)\n`;

    const text =
      `🚀 *ALPHA INDIA RADAR | MAINBOARD IPO SETUP*\n\n` +
      `📌 *Symbol:* ${item.symbol} (${item.exchange})\n` +
      `🏢 *Company:* ${item.company}\n` +
      `⚡ *Setup:* ${item.setup_label} [${item.setup_type}]\n` +
      `🎯 *Conviction:* ${item.conviction_score}/100 [${item.setup_status}]\n` +
      `💰 *CMP:* ₹${item.cmp.toFixed(1)} (${item.day_change_pct >= 0 ? "+" : ""}${item.day_change_pct}%)\n` +
      trigLine +
      `🛑 *Stop Loss:* ₹${item.stop_loss.toFixed(1)} (-${item.risk_pct}%)\n` +
      `🎯 *Target 1 (Book 50%):* ₹${item.target_1.toFixed(1)} (+15% 2R Rule)\n` +
      `🚀 *Target 2 (Runner):* ₹${item.target_2.toFixed(1)}\n\n` +
      `💡 *Institutional Rule:* Book 50% at Target 1, shift stop to Breakeven, trail runner on 20 EMA.\n` +
      `📝 *Rationale:* ${item.rationale}`;

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const handleCopySymbols = () => {
    const symbols = filteredCandidates.map((c) => c.symbol).join(", ");
    if (!symbols) {
      showToast("info", "No symbols match the current filters to copy.");
      return;
    }
    navigator.clipboard.writeText(symbols);
    showToast("success", `Copied ${filteredCandidates.length} symbols to clipboard! Ready for TradingView or Watchlist.`);
  };

  const handleExportCSV = () => {
    if (filteredCandidates.length === 0) {
      showToast("info", "No candidates to export.");
      return;
    }
    const headers = [
      "Symbol",
      "Company",
      "Exchange",
      "Sector",
      "Listing Date",
      "Days Since Listing",
      "CMP",
      "Day Change %",
      "90D Return %",
      "Stage",
      "Setup Type",
      "Setup Status",
      "Conviction Score",
      "Day 1 High",
      "Day 1 Low",
      "Pivot Price",
      "Trigger Price",
      "Trigger Date",
      "Days Since Trigger",
      "Distance To Pivot %",
      "Stop Loss",
      "Risk %",
      "Target 1 (+15%)",
      "Target 2 Runner",
      "Relative Volume",
      "30D Anchor Date",
      "90D Anchor Date",
    ];

    const rows = filteredCandidates.map((c) => [
      c.symbol,
      `"${c.company.replace(/"/g, '""')}"`,
      c.exchange,
      `"${c.sector || "General"}"`,
      c.listing_date,
      c.days_since_listing,
      c.cmp.toFixed(2),
      c.day_change_pct,
      c.return_90d_pct || 0,
      c.current_stage || "Stage 1",
      c.setup_type,
      c.setup_status,
      c.conviction_score,
      c.day1_high.toFixed(2),
      c.day1_low.toFixed(2),
      c.pivot_price.toFixed(2),
      (c.trigger_price ?? c.pivot_price).toFixed(2),
      c.trigger_date || "Pending",
      c.days_since_trigger !== null && c.days_since_trigger !== undefined ? c.days_since_trigger : "N/A",
      c.distance_to_pivot_pct,
      c.stop_loss.toFixed(2),
      c.risk_pct,
      c.target_1.toFixed(2),
      c.target_2.toFixed(2),
      c.rvol,
      c.anchor_30d_date,
      c.anchor_90d_date,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const dateStr = new Date().toISOString().split("T")[0];
    link.setAttribute("download", `AlphaIndia_Mainboard_IPO_Radar_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("success", `Exported ${filteredCandidates.length} IPO setups to CSV!`);
  };

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      // Default to ascending for symbol, otherwise descending
      setSortOrder(field === "symbol" || field === "risk_pct" ? "asc" : "desc");
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter candidates
  const filteredCandidates = useMemo(() => {
    return candidates
      .filter((item) => {
        // Search
        if (search.trim()) {
          const q = search.toLowerCase();
          if (!item.symbol.toLowerCase().includes(q) && !item.company.toLowerCase().includes(q)) {
            return false;
          }
        }

        // Tab Filter
        if (selectedTab === "NEW") {
          const isFresh = item.setup_type === "NEW_LISTING" || (item.days_since_listing || 999) <= 60;
          if (!isFresh) return false;
        }
        if (selectedTab === "LDH" && !item.setup_type.includes("LDH")) return false;
        if (selectedTab === "BASE" && !item.setup_type.includes("BASE")) return false;
        if (
          selectedTab === "ANCHOR" &&
          !item.setup_type.includes("ANCHOR") &&
          Math.abs(item.anchor_30d_days_left) > 7
        )
          return false;
        if (selectedTab === "PHOENIX" && item.setup_type !== "BROKEN_PHOENIX") return false;

        // Status Filter
        if (statusFilter !== "ALL" && item.setup_status !== statusFilter) return false;

        // Market Cap Filter
        if (mcapFilter !== "ALL") {
          const mcap = item.market_cap || 0;
          if (mcapFilter === "LARGE" && mcap < 20000) return false;
          if (mcapFilter === "MID" && (mcap < 5000 || mcap >= 20000)) return false;
          if (mcapFilter === "SMALL" && (mcap <= 0 || mcap >= 5000)) return false;
        }

        // Listing Age Filter
        if (listingAgeFilter !== "ALL") {
          const days = item.days_since_listing || 0;
          if (listingAgeFilter === "FRESH_30D" && days > 30) return false;
          if (listingAgeFilter === "BASE_3M" && (days <= 30 || days > 90)) return false;
          if (listingAgeFilter === "BASE_1Y" && (days <= 90 || days > 365)) return false;
        }

        // Min Score Filter
        if (minScoreFilter > 0 && item.conviction_score < minScoreFilter) return false;

        return true;
      })
      .sort((a, b) => {
        let valA: any = a[sortBy];
        let valB: any = b[sortBy];

        if (typeof valA === "string") valA = valA.toLowerCase();
        if (typeof valB === "string") valB = valB.toLowerCase();

        if (valA === undefined || valA === null) valA = -999999;
        if (valB === undefined || valB === null) valB = -999999;

        if (valA < valB) return sortOrder === "asc" ? -1 : 1;
        if (valA > valB) return sortOrder === "asc" ? 1 : -1;
        return 0;
      });
  }, [
    candidates,
    search,
    selectedTab,
    statusFilter,
    mcapFilter,
    listingAgeFilter,
    minScoreFilter,
    sortBy,
    sortOrder,
  ]);

  // Filtered Lockin Items
  const filteredLockins = useMemo(() => {
    return lockinCalendar.filter((item) => {
      if (calendarFilter === "IMMINENT") return item.days_left >= 0 && item.days_left <= 3;
      if (calendarFilter === "PASSED") return item.days_left < 0;
      if (calendarFilter === "UPCOMING") return item.days_left > 3;
      return true;
    });
  }, [lockinCalendar, calendarFilter]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Top Header */}
        <PageHeader
          eyebrow="MAINBOARD RADAR"
          icon={<Rocket className="w-5 h-5" />}
          iconColor="cyan"
          title="Mainboard IPO Radar"
          badge={{ label: "MAINBOARD ONLY", color: "emerald" }}
          extraBadges={[
            { label: "ZERO SME", color: "indigo" },
            { label: "AUTO-DISCOVERY ACTIVE", color: "purple" },
          ]}
          subtitle="Tracks Day 1 Listings, Blue-Sky Breakouts, IPO Base Cheats, SEBI 30D/90D Anchor Lock-in Exhaustion & Turnarounds."
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setShowPlaybookModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20 transition-all text-xs font-semibold cursor-pointer"
                title="View Institutional Playbook & Setup Rules"
              >
                <BookOpen className="w-4 h-4 text-indigo-400" />
                <span>Playbook</span>
              </button>

              <button
                onClick={() => setShowCalendarModal(!showCalendarModal)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-xs font-semibold cursor-pointer ${
                  showCalendarModal
                    ? "bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-xs shadow-amber-500/30"
                    : "bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20"
                }`}
              >
                <Lock className="w-4 h-4" />
                <span>Anchor Lock-In ({lockinCalendar.length})</span>
              </button>

              <button
                onClick={handleCopySymbols}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 transition-all text-xs font-semibold cursor-pointer"
                title="Copy comma-separated symbol list to clipboard"
              >
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>Copy Symbols</span>
              </button>

              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 transition-all text-xs font-semibold cursor-pointer"
                title="Download filtered IPO candidates as CSV"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>Export CSV</span>
              </button>

              <button
                onClick={handleBroadcastTopAlerts}
                disabled={broadcasting}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cyan-500/20 border border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/30 hover:text-white transition-all text-xs font-semibold disabled:opacity-50 cursor-pointer shadow-xs shadow-cyan-500/20"
                title="Broadcast institutional Telegram & WhatsApp alerts for all triggered and high-conviction IPO setups"
              >
                <Send className={`w-3.5 h-3.5 text-cyan-400 ${broadcasting ? "animate-spin" : ""}`} />
                <span>{broadcasting ? "Dispatching..." : "Telegram Alerts"}</span>
              </button>

              <button
                onClick={() => fetchData(true)}
                disabled={rescanning || loading}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-cyan-600/20 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-600/30 hover:border-cyan-400 transition-all text-xs font-semibold disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${rescanning ? "animate-spin text-cyan-400" : ""}`} />
                <span>{rescanning ? "Scanning..." : "Re-Scan"}</span>
              </button>
            </div>
          }
        />

        {/* Live Toast Banner */}
        {toastMsg && (
          <div
            className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between animate-in fade-in slide-in-from-top-2 ${
              toastMsg.type === "success"
                ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                : toastMsg.type === "error"
                ? "bg-rose-500/15 border-rose-500/40 text-rose-300"
                : "bg-cyan-500/15 border-cyan-500/40 text-cyan-300"
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} />
              <span>{toastMsg.text}</span>
            </div>
            <button
              onClick={() => setToastMsg(null)}
              className="text-slate-400 hover:text-white text-xs cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Top Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiCard
            label="Monitored Mainboard"
            value={summary ? summary.total_monitored : "--"}
            sub="NSE/BSE Listed (2.5Y)"
            icon={<Layers className="w-4 h-4 text-slate-400" />}
          />
          <KpiCard
            label="Fresh Listings (<60D)"
            value={summary ? summary.new_listing_count : "--"}
            sub="Discovery Phase (0-60D)"
            color="purple"
            icon={<Sparkles className="w-4 h-4 text-purple-400" />}
          />
          <KpiCard
            label="Blue-Sky (LDH)"
            value={summary ? summary.blue_sky_ldh_count : "--"}
            sub="Zero Overhead Supply"
            color="cyan"
            icon={<Flame className="w-4 h-4 text-cyan-400" />}
          />
          <KpiCard
            label="IPO Base & Cheats"
            value={summary ? summary.ipo_base_count : "--"}
            sub="VCP Supply Dry-Up"
            color="emerald"
            icon={<Target className="w-4 h-4 text-emerald-400" />}
          />
          <KpiCard
            label="Anchor Cliff Radar"
            value={summary ? summary.anchor_lockin_count : "--"}
            sub="30D/90D Unlock Window"
            color="amber"
            icon={<Clock className="w-4 h-4 text-amber-400" />}
          />
        </div>

        {/* Institutional Strategy Playbook Modal */}
        {showPlaybookModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
            <div className="max-w-3xl w-full bg-[#0a1120] border border-cyan-500/30 rounded-2xl p-6 shadow-2xl space-y-5 text-xs text-slate-300">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400">
                    <Rocket className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-base">Alpha India Mainboard IPO Playbook</h3>
                    <p className="text-slate-400 text-xs">
                      Institutional screening methodology based on Minervini, O&apos;Neil, and SEBI Lock-in Dynamics
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPlaybookModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-900/80 border border-cyan-500/20 space-y-2">
                  <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
                    <Flame className="w-4 h-4" />
                    <span>1. Blue-Sky LDH Breakouts</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed text-[11px]">
                    Stocks trading above their <strong>Listing Day High (Day 1 High)</strong> have{" "}
                    <strong>zero trapped overhead supply</strong>. When accompanied by Relative Volume &gt; 1.25x, this
                    signals aggressive institutional accumulation into unchartered price territory.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/80 border border-emerald-500/20 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                    <Target className="w-4 h-4" />
                    <span>2. IPO Base &amp; Cheat Pivots</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed text-[11px]">
                    Between Days 12 to 70, premier IPOs consolidate into shallow, constructive bases (&lt; 25% depth).
                    The <strong>Cheat entry</strong> triggers when volatility contracts with 3-day volume dry-up,
                    offering a lower-risk entry before clearing Day 1 High.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/80 border border-amber-500/20 space-y-2">
                  <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                    <Clock className="w-4 h-4" />
                    <span>3. SEBI 30D / 90D Anchor Expiry</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed text-[11px]">
                    SEBI mandates 50% anchor shares unlock on <strong>Day 30</strong> and the remaining on{" "}
                    <strong>Day 90</strong>. Weak hands dump before the cliff; institutional absorption occurs when the stock
                    holds above its prior 5-day swing low post-unlock.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/80 border border-purple-500/20 space-y-2">
                  <div className="flex items-center gap-2 text-purple-400 font-bold text-sm">
                    <TrendingUp className="w-4 h-4" />
                    <span>4. Broken Phoenix Reclaims</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed text-[11px]">
                    IPOs that crashed &gt; 35% from ATH after early hype, build a 6-month base, and reclaim both 20 and 50
                    EMAs on high volume. High upside Stage 1 bottoming reversal.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30 flex items-start gap-3">
                <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <div className="text-[11px] text-cyan-200">
                  <strong>The 2R Partial Book Execution Rule:</strong> Always take 50% off the table at{" "}
                  <strong>Target 1 (+15%)</strong>. Instantly advance Stop Loss to Breakeven (Entry Price). Trail the
                  runner on 10/20 EMA to capture multi-bagger upside with zero downside risk.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Lock-In Calendar Drawer */}
        {showCalendarModal && (
          <div className="mb-6 p-4 rounded-xl bg-slate-900/95 border border-amber-500/30 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <Calendar className="w-5 h-5 text-amber-400" />
                <h3 className="font-semibold text-white">Upcoming SEBI Anchor Investor Lock-In Expirations</h3>
                <span className="text-xs px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded font-mono">
                  Window: Next 45 Days
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                  {(["ALL", "IMMINENT", "PASSED", "UPCOMING"] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setCalendarFilter(filter)}
                      className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                        calendarFilter === filter
                          ? "bg-amber-500 text-slate-950"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      {filter === "ALL"
                        ? "All"
                        : filter === "IMMINENT"
                        ? "Imminent (0-3D)"
                        : filter === "PASSED"
                        ? "Absorption Zone"
                        : "Upcoming"}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setShowCalendarModal(false)}
                  className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded bg-slate-800"
                >
                  Close
                </button>
              </div>
            </div>

            {filteredLockins.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No anchor expirations match this window.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
                {filteredLockins.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-amber-500/50 transition-all space-y-2.5"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <Link
                            href={`/stocks/${encodeURIComponent(item.symbol)}?from=/ipo-radar`}
                            className="font-bold text-white hover:text-cyan-400 tracking-wide transition-colors"
                          >
                            {item.symbol}
                          </Link>
                          <a
                            href={`https://in.tradingview.com/chart/?symbol=NSE:${item.symbol}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-slate-500 hover:text-cyan-400"
                            title="Open TradingView Chart"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                        <div className="text-xs text-slate-400 truncate max-w-[190px]">{item.company}</div>
                      </div>
                      <span
                        className={`text-[11px] px-2 py-0.5 rounded font-semibold ${
                          item.days_left <= 0
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                            : item.days_left <= 3
                            ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse"
                            : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                        }`}
                      >
                        {item.days_left < 0
                          ? `${Math.abs(item.days_left)}d Ago (Absorption)`
                          : item.days_left === 0
                          ? "TODAY"
                          : `In ${item.days_left} Days`}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 grid grid-cols-2 text-xs gap-y-1">
                      <div>
                        <span className="text-slate-500">Unlock: </span>
                        <span className="text-slate-300 font-mono">{item.unlock_date}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-500">Type: </span>
                        <span className="text-amber-400 font-medium">
                          {item.cliff_type.includes("30") ? "30D (50%)" : "90D (100%)"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500">CMP: </span>
                        <span className="text-white font-mono font-semibold">₹{item.cmp.toFixed(1)}</span>
                      </div>
                      <div className="text-right">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                            item.profit_status === "IN_PROFIT"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                              : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                          }`}
                        >
                          {item.profit_status === "IN_PROFIT" ? "Holding Profit" : "At/Near Lows"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Primary Filter Tabs Ribbon */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto shadow-xs">
            {[
              { id: "ALL", label: "All Mainboard Setups" },
              { id: "NEW", label: `Fresh Listings (<60D)${summary?.new_listing_count ? ` (${summary.new_listing_count})` : ""}` },
              { id: "LDH", label: "Blue-Sky (LDH) Breakout" },
              { id: "BASE", label: "IPO Base & Cheat" },
              { id: "ANCHOR", label: "Anchor Expiry Radar" },
              { id: "PHOENIX", label: "Broken Phoenix Reclaims" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedTab === tab.id
                    ? "bg-cyan-500 text-slate-950 shadow-xs shadow-cyan-500/20"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800/60"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search symbol or company..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:border-cyan-500 w-full md:w-64 shadow-xs"
            />
          </div>
        </div>

        {/* Secondary Dimension Filters Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-900/60 border border-slate-800 rounded-xl text-xs">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-slate-400">
              <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
              <span className="font-semibold uppercase tracking-wider text-[11px]">Filters:</span>
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:border-cyan-500 cursor-pointer text-xs"
            >
              <option value="ALL">All States</option>
              <option value="TRIGGERED">Triggered (Active Breakout)</option>
              <option value="READY">Ready (Near Pivot)</option>
              <option value="FORMING">Forming (Base Contraction)</option>
              <option value="PRE_CLIFF_WATCH">Pre-Cliff Watch</option>
            </select>

            {/* Market Cap Tier */}
            <select
              value={mcapFilter}
              onChange={(e) => setMcapFilter(e.target.value)}
              className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:border-cyan-500 cursor-pointer text-xs"
            >
              <option value="ALL">All Market Caps</option>
              <option value="LARGE">Large Cap (&gt; ₹20k Cr)</option>
              <option value="MID">Mid Cap (₹5k - ₹20k Cr)</option>
              <option value="SMALL">Small Cap (&lt; ₹5k Cr)</option>
            </select>

            {/* Listing Age */}
            <select
              value={listingAgeFilter}
              onChange={(e) => setListingAgeFilter(e.target.value)}
              className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:border-cyan-500 cursor-pointer text-xs"
            >
              <option value="ALL">All Listing Ages</option>
              <option value="FRESH_30D">Fresh (0-30 Days)</option>
              <option value="BASE_3M">1 to 3 Months</option>
              <option value="BASE_1Y">3 to 12 Months</option>
            </select>

            {/* Conviction Score Filter */}
            <select
              value={minScoreFilter}
              onChange={(e) => setMinScoreFilter(Number(e.target.value))}
              className="px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:border-cyan-500 cursor-pointer text-xs"
            >
              <option value={0}>All Conviction Scores</option>
              <option value={80}>High Conviction (≥ 80)</option>
              <option value={90}>Prime Setup (≥ 90)</option>
            </select>
          </div>

          <div className="flex items-center gap-2 text-slate-400 text-xs">
            <span>
              Showing <strong className="text-white">{filteredCandidates.length}</strong> of{" "}
              {candidates.length} active setups
            </span>
            {(statusFilter !== "ALL" ||
              mcapFilter !== "ALL" ||
              listingAgeFilter !== "ALL" ||
              minScoreFilter > 0 ||
              search.trim()) && (
              <button
                onClick={() => {
                  setStatusFilter("ALL");
                  setMcapFilter("ALL");
                  setListingAgeFilter("ALL");
                  setMinScoreFilter(0);
                  setSearch("");
                }}
                className="text-cyan-400 hover:text-cyan-300 font-semibold underline ml-2 cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Mainboard IPO Candidate Table */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-900/90 text-slate-600 dark:text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800 select-none">
                <tr>
                  {/* Symbol Header */}
                  <th
                    onClick={() => handleSort("symbol")}
                    className="py-3.5 px-4 cursor-pointer hover:text-cyan-400 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>Symbol / Company</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-500" />
                    </div>
                  </th>

                  {/* Listed Age Header */}
                  <th
                    onClick={() => handleSort("days_since_listing")}
                    className="py-3.5 px-4 cursor-pointer hover:text-cyan-400 transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      <span>Listed / Age</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-500" />
                    </div>
                  </th>

                  {/* CMP Header */}
                  <th
                    onClick={() => handleSort("cmp")}
                    className="py-3.5 px-4 text-right cursor-pointer hover:text-cyan-400 transition-colors"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>CMP &amp; Day %</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-500" />
                    </div>
                  </th>

                  {/* Trend 90D Header */}
                  <th
                    onClick={() => handleSort("return_90d_pct")}
                    className="py-3.5 px-4 text-center cursor-pointer hover:text-cyan-400 transition-colors"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Trend (90D)</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-500" />
                    </div>
                  </th>

                  {/* Stage Header */}
                  <th className="py-3.5 px-4 text-center">Stage</th>

                  {/* Setup Header */}
                  <th className="py-3.5 px-4">Setup Classification</th>

                  {/* Score Header */}
                  <th
                    onClick={() => handleSort("conviction_score")}
                    className="py-3.5 px-4 text-center cursor-pointer hover:text-cyan-400 transition-colors"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Score</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-500" />
                    </div>
                  </th>

                  {/* Trigger & Pivot Header */}
                  <th
                    onClick={() => handleSort("trigger_price")}
                    className="py-3.5 px-4 text-right cursor-pointer hover:text-cyan-400 transition-colors"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Trigger / Pivot</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-500" />
                    </div>
                  </th>

                  {/* Stop Loss Header */}
                  <th
                    onClick={() => handleSort("risk_pct")}
                    className="py-3.5 px-4 text-right cursor-pointer hover:text-cyan-400 transition-colors"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Stop Loss (Risk)</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-500" />
                    </div>
                  </th>

                  {/* Target Header */}
                  <th
                    onClick={() => handleSort("target_1")}
                    className="py-3.5 px-4 text-right cursor-pointer hover:text-cyan-400 transition-colors"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>2R Target (+15%)</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-500" />
                    </div>
                  </th>

                  {/* Status Header */}
                  <th
                    onClick={() => handleSort("setup_status")}
                    className="py-3.5 px-4 text-center cursor-pointer hover:text-cyan-400 transition-colors"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Status</span>
                      <ArrowUpDown className="w-3 h-3 text-slate-500" />
                    </div>
                  </th>

                  {/* Actions Header */}
                  <th className="py-3.5 px-4 text-center">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={12} className="py-12 text-center text-slate-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-cyan-400 mb-2" />
                      Scanning Mainboard IPO universe...
                    </td>
                  </tr>
                ) : filteredCandidates.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="p-8">
                      <EmptyState
                        icon={<Rocket className="h-7 w-7 text-cyan-400" />}
                        title="No active setups match the current filters"
                        description="Try selecting 'All Mainboard Setups' or resetting secondary filters."
                        action={
                          <button
                            onClick={() => {
                              setSelectedTab("ALL");
                              setStatusFilter("ALL");
                              setMcapFilter("ALL");
                              setListingAgeFilter("ALL");
                              setMinScoreFilter(0);
                              setSearch("");
                            }}
                            className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20"
                          >
                            Reset All Filters
                          </button>
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  filteredCandidates.map((item) => {
                    const isExpanded = expandedSymbol === item.symbol;
                    return (
                      <React.Fragment key={item.id}>
                        <tr
                          onClick={() => setExpandedSymbol(isExpanded ? null : item.symbol)}
                          className={`hover:bg-slate-900/50 cursor-pointer transition-colors group ${
                            isExpanded ? "bg-slate-900/40 border-b border-cyan-500/20" : ""
                          }`}
                        >
                          {/* Symbol & Company */}
                          <td className="py-3 px-4">
                            <div className="font-bold text-white transition-colors flex items-center gap-1.5">
                              <Link
                                href={`/stocks/${encodeURIComponent(item.symbol)}?from=/ipo-radar`}
                                onClick={(e) => e.stopPropagation()}
                                className="hover:text-cyan-400 hover:underline transition-colors"
                                title={`View ${item.symbol} stock details page`}
                              >
                                {item.symbol}
                              </Link>
                              <span className="text-[10px] text-slate-500 font-mono">[{item.exchange}]</span>
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5 text-cyan-400 ml-1" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-400 ml-1" />
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 truncate max-w-[190px]">{item.company}</div>
                          </td>

                          {/* Listed / Age */}
                          <td className="py-3 px-4">
                            <div className="text-slate-300 font-mono">{item.listing_date}</div>
                            <div className="text-[11px] text-slate-500">{item.days_since_listing} days ago</div>
                          </td>

                          {/* CMP & Day % */}
                          <td className="py-3 px-4 text-right">
                            <div className="font-bold text-white font-mono">₹{item.cmp.toFixed(1)}</div>
                            <div
                              className={`text-[11px] font-semibold ${
                                item.day_change_pct >= 0 ? "text-emerald-400" : "text-rose-400"
                              }`}
                            >
                              {item.day_change_pct >= 0 ? `+${item.day_change_pct}%` : `${item.day_change_pct}%`}
                            </div>
                          </td>

                          {/* Trend (90D) */}
                          <td className="py-3 px-4 text-center">
                            <SparklineChart
                              data={item.sparkline}
                              cmp={item.cmp}
                              return90d={item.return_90d_pct}
                              width={78}
                              height={22}
                              periodLabel="90D"
                              showDot={true}
                              showBadge={true}
                            />
                          </td>

                          {/* Current Stage */}
                          <td className="py-3 px-4 text-center">
                            <StageBadge
                              stage={item.current_stage}
                              stageCode={item.stage_code}
                              cmp={item.cmp}
                            />
                          </td>

                          {/* Setup Classification */}
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-200">{item.setup_label}</div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                              <span>Day 1 High: ₹{item.day1_high.toFixed(1)}</span>
                              <span>•</span>
                              <span>RVol: {item.rvol}x</span>
                            </div>
                          </td>

                          {/* Score */}
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full font-bold font-mono text-xs ${
                                item.conviction_score >= 90
                                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                                  : item.conviction_score >= 80
                                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                                  : "bg-slate-800 text-slate-300"
                              }`}
                            >
                              {item.conviction_score.toFixed(0)}
                            </span>
                          </td>

                          {/* Trigger Price & Trigger Date */}
                          <td className="py-3 px-4 text-right font-mono">
                            {item.setup_status === "TRIGGERED" ? (
                              <div>
                                <div className="text-cyan-300 font-bold flex items-center justify-end gap-1">
                                  <span className="text-[10px] text-cyan-400 font-sans font-medium uppercase tracking-tight">Trigger:</span>
                                  <span>₹{(item.trigger_price ?? item.pivot_price).toFixed(1)}</span>
                                </div>
                                <div className="text-[11px] text-emerald-400 font-sans font-medium flex items-center justify-end gap-1 mt-0.5">
                                  {item.trigger_date ? (
                                    <>
                                      <span>{item.trigger_date}</span>
                                      {item.days_since_trigger !== null && item.days_since_trigger !== undefined && (
                                        <span className="text-slate-400 font-normal">({item.days_since_trigger}d ago)</span>
                                      )}
                                    </>
                                  ) : (
                                    <span>+{(item.distance_to_pivot_pct ?? 0).toFixed(1)}% above</span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div>
                                <div className="text-slate-200 font-semibold flex items-center justify-end gap-1">
                                  <span className="text-[10px] text-slate-500 font-sans font-medium uppercase tracking-tight">Pivot:</span>
                                  <span>₹{item.pivot_price.toFixed(1)}</span>
                                </div>
                                <div className="text-[11px] text-amber-400/90 font-sans mt-0.5">
                                  {item.distance_to_pivot_pct >= 0
                                    ? `+${item.distance_to_pivot_pct.toFixed(1)}% above`
                                    : `${item.distance_to_pivot_pct.toFixed(1)}% away`}
                                </div>
                              </div>
                            )}
                          </td>

                          {/* Stop Loss (Risk) */}
                          <td className="py-3 px-4 text-right font-mono">
                            <div className="text-rose-400 font-semibold">₹{item.stop_loss.toFixed(1)}</div>
                            <div className="text-[11px] text-slate-500">-{item.risk_pct}% risk</div>
                          </td>

                          {/* 2R Target */}
                          <td className="py-3 px-4 text-right font-mono">
                            <div className="text-emerald-400 font-semibold">₹{item.target_1.toFixed(1)}</div>
                            <div className="text-[11px] text-slate-500">Runner: ₹{item.target_2.toFixed(1)}</div>
                          </td>

                          {/* Status */}
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide ${
                                item.setup_status === "TRIGGERED"
                                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 animate-pulse"
                                  : item.setup_status === "READY"
                                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/50"
                                  : item.setup_status === "PRE_CLIFF_WATCH"
                                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/50"
                                  : "bg-slate-800/80 text-slate-400 border border-slate-700"
                              }`}
                            >
                              {item.setup_status}
                            </span>
                            {item.setup_status === "TRIGGERED" && item.trigger_date && (
                              <div className="text-[10px] text-cyan-400 font-mono mt-1 font-medium">
                                {item.trigger_date}
                              </div>
                            )}
                            {item.setup_status === "READY" && (
                              <div className="text-[10px] text-emerald-400 font-sans mt-0.5">
                                Near Trigger
                              </div>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1.5">
                              <a
                                href={`https://in.tradingview.com/chart/?symbol=NSE:${item.symbol}`}
                                target="_blank"
                                rel="noreferrer"
                                title="Open TradingView Chart"
                                className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700 transition-colors"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                              <button
                                onClick={() => handleShareToWhatsApp(item)}
                                title="Share formatted memo to WhatsApp"
                                className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 transition-colors cursor-pointer"
                              >
                                <Share2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDispatchTelegram(item)}
                                disabled={dispatchingSymbol === item.symbol}
                                title="Send Instant Telegram Alert for this IPO setup"
                                className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                  dispatchingSymbol === item.symbol
                                    ? "bg-cyan-500/30 text-cyan-200 border-cyan-400 animate-pulse"
                                    : "bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/30 hover:text-white border-cyan-500/40 shadow-xs shadow-cyan-500/20"
                                }`}
                              >
                                {dispatchingSymbol === item.symbol ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Send className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Expanded Institutional Intelligence Drawer (colSpan=12) */}
                        {isExpanded && (
                          <tr className="bg-slate-950/90 border-b border-slate-800">
                            <td colSpan={12} className="p-4 bg-slate-900/30">
                              <div className="rounded-xl border border-cyan-500/20 bg-[#060e1d] p-4 space-y-4">
                                {/* Drawer Header */}
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                                  <div className="flex items-center gap-2">
                                    <Rocket className="w-4 h-4 text-cyan-400" />
                                    <span className="font-bold text-white text-sm">
                                      {item.symbol} • {item.setup_label} Deep Intelligence
                                    </span>
                                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">
                                      {item.setup_type}
                                    </span>
                                    {item.market_cap_category && (
                                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                                        {item.market_cap_category}
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2">
                                    <AddToWatchlistButton
                                      symbol={item.symbol}
                                      companyName={item.company}
                                      currentPrice={item.cmp}
                                      variant="button"
                                    />

                                    <a
                                      href={`https://in.tradingview.com/chart/?symbol=NSE:${item.symbol}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-semibold transition"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
                                      <span>TradingView Chart</span>
                                    </a>

                                    <button
                                      onClick={() => handleDispatchTelegram(item)}
                                      disabled={dispatchingSymbol === item.symbol}
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/35 hover:text-white text-xs font-semibold transition cursor-pointer shadow-xs shadow-cyan-500/20"
                                    >
                                      {dispatchingSymbol === item.symbol ? (
                                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                      ) : (
                                        <Send className="w-3.5 h-3.5" />
                                      )}
                                      <span>Send Telegram Alert</span>
                                    </button>

                                    <button
                                      onClick={() => handleShareToWhatsApp(item)}
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25 text-xs font-semibold transition cursor-pointer"
                                    >
                                      <Share2 className="w-3.5 h-3.5" />
                                      <span>Share to WhatsApp</span>
                                    </button>

                                    <Link
                                      href={`/stocks/${encodeURIComponent(item.symbol)}?from=/ipo-radar`}
                                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-600/20 text-cyan-300 hover:text-white text-xs font-semibold border border-cyan-500/30 transition"
                                    >
                                      <span>Stock Radar</span>
                                      <ArrowUpRight className="w-3.5 h-3.5" />
                                    </Link>
                                  </div>
                                </div>

                                {/* Price Structure Range Visualizer Track */}
                                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                                  <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                                    <div className="flex items-center gap-2">
                                      <BarChart2 className="w-3.5 h-3.5 text-cyan-400" />
                                      <span>Institutional Price Structure &amp; Execution Map</span>
                                    </div>
                                    <span className="text-slate-500 font-mono normal-case">
                                      CMP: ₹{item.cmp.toFixed(1)} • {item.setup_status === "TRIGGERED" ? "Trigger" : "Pivot"}: ₹{(item.trigger_price ?? item.pivot_price).toFixed(1)}
                                    </span>
                                  </div>

                                  {/* Visual Gauge Track */}
                                  <div className="relative pt-3 pb-2">
                                    {/* Base horizontal track line */}
                                    <div className="h-2 w-full rounded-full bg-slate-800 relative overflow-hidden">
                                      {/* Risk Zone (Stop Loss to Pivot) */}
                                      <div
                                        className="h-full bg-linear-to-r from-rose-500/40 via-amber-500/30 to-cyan-500/40"
                                        style={{ width: "65%" }}
                                      />
                                      {/* Target Expansion Zone */}
                                      <div
                                        className="h-full bg-linear-to-r from-cyan-500/40 to-emerald-500/60"
                                        style={{ width: "35%", marginLeft: "65%" }}
                                      />
                                    </div>

                                    {/* Level Callout Chips */}
                                    <div className="grid grid-cols-5 text-center mt-3 text-[11px] font-mono gap-1">
                                      <div className="text-left">
                                        <div className="text-slate-500 text-[10px]">Day 1 Low</div>
                                        <div className="text-slate-300 font-semibold">₹{item.day1_low.toFixed(1)}</div>
                                      </div>

                                      <div>
                                        <div className="text-rose-400 text-[10px]">Stop Loss</div>
                                        <div className="text-rose-300 font-bold">₹{item.stop_loss.toFixed(1)}</div>
                                        <div className="text-[9px] text-rose-500">(-{item.risk_pct}%)</div>
                                      </div>

                                      <div>
                                        <div className="text-cyan-400 text-[10px] font-bold">CMP (Now)</div>
                                        <div className="text-white font-extrabold text-xs">₹{item.cmp.toFixed(1)}</div>
                                        <div className="text-[9px] text-cyan-300">
                                          {item.distance_to_pivot_pct >= 0
                                            ? `+${item.distance_to_pivot_pct}% pivot`
                                            : `${item.distance_to_pivot_pct}% away`}
                                        </div>
                                      </div>

                                      <div>
                                        <div className="text-amber-400 text-[10px]">
                                          {item.setup_status === "TRIGGERED" ? "Trigger Level" : "Pivot Trigger"}
                                        </div>
                                        <div className="text-amber-300 font-bold">₹{(item.trigger_price ?? item.pivot_price).toFixed(1)}</div>
                                        <div className="text-[9px] text-amber-400 font-sans">
                                          {item.setup_status === "TRIGGERED"
                                            ? (item.trigger_date ? `${item.trigger_date}` : "TRIGGERED")
                                            : "Awaiting Breakout"}
                                        </div>
                                      </div>

                                      <div className="text-right">
                                        <div className="text-emerald-400 text-[10px]">Target 1 (2R)</div>
                                        <div className="text-emerald-300 font-bold">₹{item.target_1.toFixed(1)}</div>
                                        <div className="text-[9px] text-emerald-500">+15% Rule</div>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Three Intelligence Panels */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                                  {/* Rationale & Thesis */}
                                  <div className="space-y-1.5">
                                    <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                                      Quantitative Thesis &amp; Rationale
                                    </div>
                                    <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/80 space-y-2">
                                      <p className="text-slate-300 leading-relaxed">{item.rationale}</p>
                                      <div className="pt-2 border-t border-slate-800 text-[10px] text-cyan-300 font-medium">
                                        Execution Rule: 50% partial book at Target 1, shift stop to entry, trail runner.
                                      </div>
                                    </div>
                                  </div>

                                  {/* Listing Geometry & Price Structure */}
                                  <div className="space-y-1.5">
                                    <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                                      Listing Geometry &amp; Price Structure
                                    </div>
                                    <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/80 space-y-1.5 font-mono text-[11px]">
                                      <div className="flex justify-between">
                                        <span className="text-slate-400">Listing Date:</span>
                                        <span className="text-white">
                                          {item.listing_date} ({item.days_since_listing}d ago)
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-slate-400">Day 1 Range:</span>
                                        <span className="text-white">
                                          ₹{item.day1_low.toFixed(1)} — ₹{item.day1_high.toFixed(1)}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-slate-400">All-Time High:</span>
                                        <span className="text-cyan-400">
                                          ₹{item.ath.toFixed(1)} ({item.drawdown_from_ath}% DD)
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-slate-400">Relative Vol (RVol):</span>
                                        <span className="text-emerald-400 font-bold">{item.rvol}x</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-slate-400">90D / Period Return:</span>
                                        <span
                                          className={`font-bold ${
                                            (item.return_90d_pct || 0) >= 0 ? "text-emerald-400" : "text-rose-400"
                                          }`}
                                        >
                                          {(item.return_90d_pct || 0) >= 0 ? "+" : ""}
                                          {item.return_90d_pct || 0}%
                                        </span>
                                      </div>
                                      {item.setup_status === "TRIGGERED" && (
                                        <>
                                          <div className="flex justify-between text-cyan-300 font-semibold pt-1.5 border-t border-slate-800">
                                            <span className="text-slate-400">Trigger Price:</span>
                                            <span>₹{(item.trigger_price ?? item.pivot_price).toFixed(1)}</span>
                                          </div>
                                          <div className="flex justify-between text-emerald-400 font-medium">
                                            <span className="text-slate-400">Trigger Date:</span>
                                            <span>
                                              {item.trigger_date || "Recent Session"}
                                              {item.days_since_trigger !== null && item.days_since_trigger !== undefined && (
                                                <span className="text-slate-400 font-normal ml-1">({item.days_since_trigger}d ago)</span>
                                              )}
                                            </span>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  </div>

                                  {/* SEBI Anchor Lock-in Exhaustion */}
                                  <div className="space-y-1.5">
                                    <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                                      SEBI Anchor Lock-in Exhaustion
                                    </div>
                                    <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/80 space-y-1.5 font-mono text-[11px]">
                                      <div className="flex justify-between">
                                        <span className="text-slate-400">SEBI 30-Day Cliff:</span>
                                        <span
                                          className={
                                            item.anchor_30d_days_left <= 0 ? "text-emerald-400" : "text-amber-400"
                                          }
                                        >
                                          {item.anchor_30d_date} (
                                          {item.anchor_30d_days_left <= 0
                                            ? "Passed"
                                            : `${item.anchor_30d_days_left}d left`}
                                          )
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-slate-400">SEBI 90-Day Cliff:</span>
                                        <span
                                          className={
                                            item.anchor_90d_days_left <= 0 ? "text-emerald-400" : "text-amber-400"
                                          }
                                        >
                                          {item.anchor_90d_date} (
                                          {item.anchor_90d_days_left <= 0
                                            ? "Passed"
                                            : `${item.anchor_90d_days_left}d left`}
                                          )
                                        </span>
                                      </div>
                                      <div className="flex justify-between pt-1 border-t border-slate-800">
                                        <span className="text-slate-400">Runner Target:</span>
                                        <span className="text-cyan-300 font-bold">₹{item.target_2.toFixed(1)}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-slate-400">Institutional Stage:</span>
                                        <span className="text-emerald-300 font-bold">
                                          {item.current_stage || "Stage 1"}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Institutional Playbook Footer Ribbon */}
        <div className="mt-8 p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>
              <strong>Mainboard Execution Rule:</strong> Book 50% position at <strong>Target 1 (+15%)</strong> and
              immediately advance stop loss to <strong>Breakeven (Entry Price)</strong>. Trail the remaining 50% using
              the 10/20 EMA to capture multi-bagger runners.
            </span>
          </div>
          <div className="flex items-center gap-4 text-slate-500 font-mono text-[11px]">
            <span>SEBI 30D Quota: 50%</span>
            <span>•</span>
            <span>SEBI 90D Quota: 100%</span>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

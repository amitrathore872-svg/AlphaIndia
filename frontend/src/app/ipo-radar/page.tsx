"use client";

import React, { useState, useEffect, useCallback } from "react";
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
  distance_to_pivot_pct: number;
  stop_loss: number;
  risk_pct: number;
  target_1: number;
  target_2: number;
  anchor_30d_date: string;
  anchor_30d_days_left: number;
  anchor_90d_date: string;
  anchor_90d_days_left: number;
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
  scanned_at?: string;
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
  day1_high: number;
  day1_low: number;
}

export default function IPORadarPage() {
  const [summary, setSummary] = useState<IPOSummary | null>(null);
  const [candidates, setCandidates] = useState<IPOSetup[]>([]);
  const [lockinCalendar, setLockinCalendar] = useState<LockinItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [rescanning, setRescanning] = useState<boolean>(false);
  const [broadcasting, setBroadcasting] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null);
  const [search, setSearch] = useState<string>("");
  const [selectedTab, setSelectedTab] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [showCalendarModal, setShowCalendarModal] = useState<boolean>(false);
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);

  const showToast = (type: "success" | "error" | "info", text: string) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 5000);
  };

  const fetchData = useCallback(async (forceRefresh = false) => {
    try {
      if (forceRefresh) setRescanning(true);
      else setLoading(true);

      const refreshParam = forceRefresh ? "&force_refresh=true" : "";
      const res = await fetch(`${API_BASE}/api/v1/ipo-radar/setups?limit=100${refreshParam}`);
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

  const handleBroadcastSingle = async (item: IPOSetup) => {
    try {
      showToast("info", `Formatting & broadcasting ${item.symbol} to external channels...`);
      // Trigger scan to ensure notification persistence and live dispatch
      const res = await notificationsApi.triggerIpoScanAlerts(true, Math.min(item.conviction_score, 80));
      showToast("success", `Alert for ${item.symbol} broadcasted successfully! (${res.count} total dispatched)`);
    } catch (err: unknown) {
      showToast("error", `Failed to dispatch alert for ${item.symbol}: ${(err as Error).message}`);
    }
  };

  const handleShareToWhatsApp = (item: IPOSetup) => {
    const text = `ðŸš€ *ALPHA INDIA RADAR | MAINBOARD IPO SETUP*\n\n` +
      `ðŸ“Œ *Symbol:* ${item.symbol} (${item.exchange})\n` +
      `ðŸ¢ *Company:* ${item.company}\n` +
      `âš¡ *Setup:* ${item.setup_label} [${item.setup_type}]\n` +
      `ðŸŽ¯ *Conviction:* ${item.conviction_score}/100\n` +
      `ðŸ’° *CMP:* â‚¹${item.cmp.toFixed(1)} (${item.day_change_pct >= 0 ? "+" : ""}${item.day_change_pct}%)\n` +
      `ðŸ“ *Pivot Trigger:* â‚¹${item.pivot_price.toFixed(1)}\n` +
      `ðŸ›‘ *Stop Loss:* â‚¹${item.stop_loss.toFixed(1)} (-${item.risk_pct}%)\n` +
      `ðŸŽ¯ *Target 1 (Book 50%):* â‚¹${item.target_1.toFixed(1)} (+15% 2R Rule)\n` +
      `ðŸƒ *Target 2 (Runner):* â‚¹${item.target_2.toFixed(1)}\n\n` +
      `ðŸ’¡ *Institutional Rule:* Book 50% at Target 1, shift stop to Breakeven, trail runner on 20 EMA.\n` +
      `ðŸ”¬ *Rationale:* ${item.rationale}`;

    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter candidates
  const filteredCandidates = candidates.filter((item) => {
    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!item.symbol.toLowerCase().includes(q) && !item.company.toLowerCase().includes(q)) {
        return false;
      }
    }

    // Tab Filter
    if (selectedTab === "NEW" && item.setup_type !== "NEW_LISTING") return false;
    if (selectedTab === "LDH" && !item.setup_type.includes("LDH")) return false;
    if (selectedTab === "BASE" && !item.setup_type.includes("BASE")) return false;
    if (selectedTab === "ANCHOR" && !item.setup_type.includes("ANCHOR") && Math.abs(item.anchor_30d_days_left) > 7) return false;
    if (selectedTab === "PHOENIX" && item.setup_type !== "BROKEN_PHOENIX") return false;

    // Status Filter
    if (statusFilter !== "ALL" && item.setup_status !== statusFilter) return false;

    return true;
  });

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
                onClick={() => setShowCalendarModal(!showCalendarModal)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/20 transition-colors text-xs font-semibold cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                <span>30D Lock-In Calendar ({lockinCalendar.length})</span>
              </button>

              <button
                onClick={handleBroadcastTopAlerts}
                disabled={broadcasting}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/20 transition-all text-xs font-semibold disabled:opacity-50 cursor-pointer"
              >
                <BellRing className={`w-4 h-4 ${broadcasting ? "animate-spin text-cyan-400" : ""}`} />
                <span>{broadcasting ? "Dispatching..." : "Broadcast Alerts"}</span>
              </button>

              <button
                onClick={() => fetchData(true)}
                disabled={rescanning || loading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-600/20 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-600/30 hover:border-cyan-400 transition-all text-xs font-semibold disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${rescanning ? "animate-spin text-cyan-400" : ""}`} />
                <span>{rescanning ? "Scanning Mainboard..." : "Re-Scan Radar"}</span>
              </button>
            </div>
          }
        />

        {/* Live Toast Notification Banner */}
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
            <button onClick={() => setToastMsg(null)} className="text-slate-400 hover:text-white text-xs cursor-pointer">
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
            label="New Listings (0-7D)"
            value={summary ? summary.new_listing_count : "--"}
            sub="Day 1-7 Discovery"
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

      {/* Lock-In Calendar Drawer / Box */}
      {showCalendarModal && (
        <div className="mb-6 p-4 rounded-xl bg-slate-900/90 border border-amber-500/30 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-3">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-amber-400" />
              <h3 className="font-semibold text-white">Upcoming SEBI Anchor Investor Lock-In Expirations</h3>
              <span className="text-xs px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded font-mono">
                Next 45 Days
              </span>
            </div>
            <button
              onClick={() => setShowCalendarModal(false)}
              className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
            {lockinCalendar.map((item, idx) => (
              <div key={idx} className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 hover:border-amber-500/50 transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-bold text-white tracking-wide">{item.symbol}</span>
                    <div className="text-xs text-slate-400 truncate max-w-[180px]">{item.company}</div>
                  </div>
                  <span className={`text-[11px] px-2 py-0.5 rounded font-semibold ${
                    item.days_left <= 0 ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" :
                    item.days_left <= 3 ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse" :
                    "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  }`}>
                    {item.days_left < 0 ? `${Math.abs(item.days_left)}d Ago (Absorption)` : item.days_left === 0 ? "TODAY" : `In ${item.days_left} Days`}
                  </span>
                </div>
                <div className="mt-2.5 pt-2 border-t border-slate-800/80 grid grid-cols-2 text-xs">
                  <div>
                    <span className="text-slate-500">Unlock: </span>
                    <span className="text-slate-300 font-mono">{item.unlock_date}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500">Type: </span>
                    <span className="text-amber-400 font-medium">{item.cliff_type.includes("30") ? "30D (50%)" : "90D (Full)"}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Control Ribbon: Tabs & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        {/* Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-x-auto shadow-xs">
          {[
            { id: "ALL", label: "All Mainboard Setups" },
            { id: "NEW", label: "Brand New Listings (0-7D)" },
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

        {/* Search & Status */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search symbol or name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:border-cyan-500 w-48 md:w-60 shadow-xs"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden focus:border-cyan-500 cursor-pointer shadow-xs"
          >
            <option value="ALL" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">All States</option>
            <option value="TRIGGERED" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">Triggered (Active)</option>
            <option value="READY" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">Ready (Near Pivot)</option>
            <option value="FORMING" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">Forming (Base)</option>
          </select>
        </div>
      </div>

      {/* Mainboard IPO Candidate Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900/90 text-slate-600 dark:text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Symbol / Company</th>
                <th className="py-3.5 px-4">Listed / Age</th>
                <th className="py-3.5 px-4 text-right">CMP & Day %</th>
                <th className="py-3.5 px-4 text-center">Trend (90D)</th>
                <th className="py-3.5 px-4 text-center">Stage</th>
                <th className="py-3.5 px-4">Setup Classification</th>
                <th className="py-3.5 px-4 text-center">Score</th>
                <th className="py-3.5 px-4 text-right">Pivot / Distance</th>
                <th className="py-3.5 px-4 text-right">Stop Loss (Risk)</th>
                <th className="py-3.5 px-4 text-right">2R Target (+15%)</th>
                <th className="py-3.5 px-4 text-center">Status</th>
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
                      description="Try selecting 'All IPO Setups' or adjusting your search keyword."
                      action={
                        <button
                          onClick={() => {
                            setSelectedTab("ALL");
                            setStatusFilter("ALL");
                            setSearch("");
                          }}
                          className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20"
                        >
                          Reset Filters
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

                        <td className="py-3 px-4">
                          <div className="text-slate-300 font-mono">{item.listing_date}</div>
                          <div className="text-[11px] text-slate-500">{item.days_since_listing} days ago</div>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="font-bold text-white font-mono">â‚¹{item.cmp.toFixed(1)}</div>
                          <div className={`text-[11px] font-semibold ${item.day_change_pct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                            {item.day_change_pct >= 0 ? `+${item.day_change_pct}%` : `${item.day_change_pct}%`}
                          </div>
                        </td>

                        {/* Trend (90D) */}
                        <td className="py-3 px-4 text-center">
                          <SparklineChart
                            data={(item as any).sparkline}
                            cmp={item.cmp}
                            return90d={(item as any).return_90d_pct}
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
                            stage={(item as any).current_stage}
                            stageCode={(item as any).stage_code}
                            cmp={item.cmp}
                          />
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-200">{item.setup_label}</div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                            <span>Day 1 High: â‚¹{item.day1_high.toFixed(1)}</span>
                            <span>â€¢</span>
                            <span>RVol: {item.rvol}x</span>
                          </div>
                        </td>

                        <td className="py-3 px-4 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full font-bold font-mono text-xs ${
                            item.conviction_score >= 90 ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40" :
                            item.conviction_score >= 80 ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" :
                            "bg-slate-800 text-slate-300"
                          }`}>
                            {item.conviction_score.toFixed(0)}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right font-mono">
                          <div className="text-slate-200 font-semibold">â‚¹{item.pivot_price.toFixed(1)}</div>
                          <div className={`text-[11px] ${item.distance_to_pivot_pct >= 0 ? "text-cyan-400" : "text-slate-400"}`}>
                            {item.distance_to_pivot_pct >= 0 ? `+${item.distance_to_pivot_pct}% above` : `${item.distance_to_pivot_pct}% away`}
                          </div>
                        </td>

                        <td className="py-3 px-4 text-right font-mono">
                          <div className="text-rose-400 font-semibold">â‚¹{item.stop_loss.toFixed(1)}</div>
                          <div className="text-[11px] text-slate-500">-{item.risk_pct}% risk</div>
                        </td>

                        <td className="py-3 px-4 text-right font-mono">
                          <div className="text-emerald-400 font-semibold">â‚¹{item.target_1.toFixed(1)}</div>
                          <div className="text-[11px] text-slate-500">Runner: â‚¹{item.target_2.toFixed(1)}</div>
                        </td>

                        <td className="py-3 px-4 text-center">
                          <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide ${
                            item.setup_status === "TRIGGERED" ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 animate-pulse" :
                            item.setup_status === "READY" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/50" :
                            item.setup_status === "PRE_CLIFF_WATCH" ? "bg-amber-500/20 text-amber-300 border border-amber-500/50" :
                            "bg-slate-800/80 text-slate-400 border border-slate-700"
                          }`}>
                            {item.setup_status}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleShareToWhatsApp(item)}
                              title="Share formatted memo to WhatsApp Web"
                              className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30 transition-colors cursor-pointer"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleBroadcastSingle(item)}
                              title="Broadcast alert for this IPO setup"
                              className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 border border-cyan-500/30 transition-colors cursor-pointer"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Institutional Intelligence Drawer */}
                      {isExpanded && (
                        <tr className="bg-slate-950/90 border-b border-slate-800">
                          <td colSpan={10} className="p-4 bg-slate-900/30">
                            <div className="rounded-xl border border-cyan-500/20 bg-[#060e1d] p-4 space-y-4">
                              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                                <div className="flex items-center gap-2">
                                  <Rocket className="w-4 h-4 text-cyan-400" />
                                  <span className="font-bold text-white text-sm">
                                    {item.symbol} â€¢ {item.setup_label} Deep Intelligence
                                  </span>
                                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">
                                    {item.setup_type}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2">
                                  <AddToWatchlistButton
                                    symbol={item.symbol}
                                    companyName={item.company}
                                    currentPrice={item.cmp}
                                    variant="button"
                                  />

                                  <button
                                    onClick={() => handleBroadcastSingle(item)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/25 text-xs font-semibold transition cursor-pointer"
                                  >
                                    <Send className="w-3.5 h-3.5" />
                                    <span>Broadcast Alert</span>
                                  </button>

                                  <button
                                    onClick={() => handleShareToWhatsApp(item)}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25 text-xs font-semibold transition cursor-pointer"
                                  >
                                    <Share2 className="w-3.5 h-3.5" />
                                    <span>Share to WhatsApp</span>
                                  </button>

                                  <a
                                    href="/alerts"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold transition"
                                  >
                                    <span>Alert Center</span>
                                    <ExternalLink className="w-3.5 h-3.5" />
                                  </a>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                                <div className="space-y-1.5">
                                  <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                                    Quantitative Thesis & Rationale
                                  </div>
                                  <p className="text-slate-300 leading-relaxed bg-slate-900/60 p-3 rounded-lg border border-slate-800/80">
                                    {item.rationale}
                                  </p>
                                </div>

                                <div className="space-y-1.5">
                                  <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                                    Listing Geometry & Price Structure
                                  </div>
                                  <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/80 space-y-1 font-mono text-[11px]">
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">Listing Date:</span>
                                      <span className="text-white">{item.listing_date} ({item.days_since_listing}d ago)</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">Day 1 Range:</span>
                                      <span className="text-white">â‚¹{item.day1_low.toFixed(1)} â€” â‚¹{item.day1_high.toFixed(1)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">All-Time High:</span>
                                      <span className="text-cyan-400">â‚¹{item.ath.toFixed(1)} ({item.drawdown_from_ath}% DD)</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">Relative Vol (RVol):</span>
                                      <span className="text-emerald-400 font-bold">{item.rvol}x</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="space-y-1.5">
                                  <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                                    SEBI Anchor Lock-in Exhaustion
                                  </div>
                                  <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800/80 space-y-1 font-mono text-[11px]">
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">SEBI 30-Day Cliff:</span>
                                      <span className={item.anchor_30d_days_left <= 0 ? "text-emerald-400" : "text-amber-400"}>
                                        {item.anchor_30d_date} ({item.anchor_30d_days_left <= 0 ? "Passed" : `${item.anchor_30d_days_left}d left`})
                                      </span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-slate-400">SEBI 90-Day Cliff:</span>
                                      <span className={item.anchor_90d_days_left <= 0 ? "text-emerald-400" : "text-amber-400"}>
                                        {item.anchor_90d_date} ({item.anchor_90d_days_left <= 0 ? "Passed" : `${item.anchor_90d_days_left}d left`})
                                      </span>
                                    </div>
                                    <div className="flex justify-between pt-1 border-t border-slate-800">
                                      <span className="text-slate-400">Execution Rule:</span>
                                      <span className="text-cyan-300 font-bold">2R Partial Book (+15%)</span>
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

      {/* Institutional Playbook Footer */}
      <div className="mt-8 p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-cyan-400 flex-shrink-0" />
          <span>
            <strong>Mainboard Execution Rule:</strong> Book 50% position at <strong>Target 1 (+15%)</strong> and immediately advance stop loss to <strong>Breakeven (Entry Price)</strong>. Trail the remaining 50% using the 10/20 EMA to capture multi-bagger runners.
          </span>
        </div>
        <div className="flex items-center gap-4 text-slate-500 font-mono text-[11px]">
          <span>SEBI 30D Quota: 50%</span>
          <span>â€¢</span>
          <span>SEBI 90D Quota: 100%</span>
        </div>
      </div>
      </div>
    </DashboardLayout>
  );
}


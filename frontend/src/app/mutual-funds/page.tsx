"use client";

import { useEffect, useState, useMemo, Fragment } from "react";
import {
  mfRadarApi,
  type MFRadarScheme,
  type MFRadarSummary,
  type MFLiveIndicesResponse,
  type MFDipAlertItem,
} from "@/lib/mfRadarApi";
import MFRowInlineDrawer from "@/components/mutual-funds/MFRowInlineDrawer";
import MFChartModal from "@/components/mutual-funds/MFChartModal";
import MFCategoryHeatmap from "@/components/mutual-funds/MFCategoryHeatmap";
import MFPortfolioView from "@/components/mutual-funds/MFPortfolioView";
import {
  TrendingUp,
  TrendingDown,
  Search,
  RefreshCw,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Maximize2,
  BarChart2,
  Filter,
  ShieldAlert,
  ArrowUpDown,
  Zap,
  Layers,
  Briefcase,
  Calendar,
  DownloadCloud,
  CheckCircle2,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/common/PageHeader";
import EmptyState from "@/components/common/EmptyState";

export default function MutualFundsPage() {
  const [schemes, setSchemes] = useState<MFRadarScheme[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [summary, setSummary] = useState<MFRadarSummary | null>(null);
  const [liveIndices, setLiveIndices] = useState<MFLiveIndicesResponse | null>(null);
  const [activeAlerts, setActiveAlerts] = useState<MFDipAlertItem[]>([]);

  // Phase 4 Heatmap & Phase 5 Portfolio States
  const [activeViewTab, setActiveViewTab] = useState<"screener" | "heatmap" | "dilution" | "portfolio">("screener");
  const [heatmapData, setHeatmapData] = useState<{
    macro_commentary: string;
    heatmap: any[];
  } | null>(null);
  const [dilutionAlerts, setDilutionAlerts] = useState<any[]>([]);

  // Filtering & Sorting
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("return_6m_pct");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Chart States
  const [expandedSchemeCode, setExpandedSchemeCode] = useState<string | null>(null);
  const [modalScheme, setModalScheme] = useState<MFRadarScheme | null>(null);

  // Manual Trigger & Freshness states
  const [scanning, setScanning] = useState<boolean>(false);
  const [syncingNavs, setSyncingNavs] = useState<boolean>(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // 1. Initial Load
  const loadData = async (silent: boolean = false) => {
    if (!silent) setLoading(true);
    try {
      const [schemesRes, summaryRes, indicesRes, alertsRes, heatmapRes, dilutionRes] = await Promise.allSettled([
        mfRadarApi.getSchemes({
          category: selectedCategory === "All" ? undefined : selectedCategory,
          search: searchQuery || undefined,
          sort_by: sortBy,
          sort_order: sortOrder,
          limit: 100,
        }),
        mfRadarApi.getSummary(),
        mfRadarApi.getLiveIndices(),
        mfRadarApi.getActiveDipAlerts(),
        mfRadarApi.getCategoryHeatmap(),
        mfRadarApi.getDilutionAlerts(),
      ]);

      if (schemesRes.status === "fulfilled") {
        setSchemes(schemesRes.value.data || []);
      }
      if (summaryRes.status === "fulfilled") {
        setSummary(summaryRes.value);
      }
      if (indicesRes.status === "fulfilled") {
        setLiveIndices(indicesRes.value);
      }
      if (alertsRes.status === "fulfilled") {
        setActiveAlerts(alertsRes.value.alerts || []);
      }
      if (heatmapRes.status === "fulfilled") {
        setHeatmapData(heatmapRes.value);
      }
      if (dilutionRes.status === "fulfilled") {
        setDilutionAlerts(dilutionRes.value || []);
      }
      setLastRefreshedAt(new Date());
    } catch (e) {
      console.error("Failed to load MF Radar data:", e);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // Auto-poll live indices & dip signals every 30 seconds
    const interval = setInterval(async () => {
      try {
        const [ind, alt] = await Promise.allSettled([
          mfRadarApi.getLiveIndices(),
          mfRadarApi.getActiveDipAlerts(),
        ]);
        if (ind.status === "fulfilled") setLiveIndices(ind.value);
        if (alt.status === "fulfilled") setActiveAlerts(alt.value.alerts || []);
        setLastRefreshedAt(new Date());
      } catch {
        // silent
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [selectedCategory, sortBy, sortOrder]);

  // Handle Search Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      mfRadarApi
        .getSchemes({
          category: selectedCategory === "All" ? undefined : selectedCategory,
          search: searchQuery || undefined,
          sort_by: sortBy,
          sort_order: sortOrder,
          limit: 100,
        })
        .then((res) => setSchemes(res.data || []))
        .catch(console.error);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Trigger full AMFI Daily NAV Sync from official feed
  const handleSyncAmfiNavs = async () => {
    setSyncingNavs(true);
    setSyncMessage("Downloading official AMFI NAVAll feed & recalculating returns...");
    try {
      const res = await mfRadarApi.triggerDailySync();
      const updatedCount = res?.updated_schemes ?? 0;
      setSyncMessage(`AMFI Sync Success: ${updatedCount} schemes updated with official NAVs.`);
      await loadData();
      setTimeout(() => setSyncMessage(null), 5000);
    } catch (e) {
      console.error("AMFI sync failed:", e);
      setSyncMessage("AMFI sync failed. Please check network connection.");
      setTimeout(() => setSyncMessage(null), 5000);
    } finally {
      setSyncingNavs(false);
    }
  };

  // Trigger manual intraday dip scan
  const handleScanDipsNow = async () => {
    setScanning(true);
    try {
      await mfRadarApi.triggerDipScan(true);
      await loadData();
    } catch (e) {
      console.error("Scan failed:", e);
    } finally {
      setScanning(false);
    }
  };


  const categoriesList = [
    "All",
    "Flexi Cap",
    "Large Cap",
    "Mid Cap",
    "Small Cap",
    "Multi Cap",
    "Large & Mid Cap",
    "Focused",
    "Sectoral/Thematic",
    "ELSS",
    "Contra",
    "Value",
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* ── 1. Top Header & Lumpsum Clock Cockpit ── */}
        <PageHeader
          eyebrow="INSTITUTIONAL RADAR"
          icon={<Briefcase className="w-5 h-5" />}
          iconColor="cyan"
          title="Mutual Fund Alpha Radar"
          badge={{ label: "Sprint 39", color: "cyan" }}
          subtitle="Top 100 Pure Equity Screener • Intraday Dip Buying Radar • Dual-Tier NAV Charts"
          actions={
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Lumpsum Cutoff Window */}
              <div className="flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-[#07101E] px-3.5 py-2 text-xs">
                <Clock size={15} className="text-amber-500 dark:text-amber-400 shrink-0" />
                <div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-mono font-semibold">
                    Lumpsum Cutoff Window
                  </div>
                  <div className="flex items-center gap-1.5 font-mono font-bold text-slate-900 dark:text-white">
                    <span>Target: 14:00 IST</span>
                    {liveIndices?.is_lumpsum_window_open ? (
                      <span className="rounded bg-emerald-500/20 text-emerald-400 text-[10px] px-1.5 py-0.2">
                        WINDOW OPEN
                      </span>
                    ) : (
                      <span className="rounded bg-slate-700 text-slate-400 text-[10px] px-1.5 py-0.2">
                        CLOSED
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Data Freshness & Last Sync Status */}
              <div className="flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-[#07101E] px-3.5 py-2 text-xs">
                <Calendar size={15} className="text-cyan-500 dark:text-cyan-400 shrink-0" />
                <div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-mono font-semibold">
                    Data Freshness
                  </div>
                  <div className="flex items-center gap-2 font-mono font-bold text-slate-900 dark:text-white">
                    <span>
                      NAV:{" "}
                      {summary?.latest_nav_date
                        ? new Date(summary.latest_nav_date).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })
                        : "Current"}
                    </span>
                    <span className="text-[10px] font-normal text-slate-400">
                      • Refreshed{" "}
                      {lastRefreshedAt
                        ? lastRefreshedAt.toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })
                        : "just now"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Sync AMFI Daily NAVs Button */}
              <button
                onClick={handleSyncAmfiNavs}
                disabled={syncingNavs}
                title="Download official AMFI daily NAV feed & recalculate returns"
                className="flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500 hover:text-white dark:hover:text-slate-950 transition shadow-xs disabled:opacity-50"
              >
                <DownloadCloud size={13} className={syncingNavs ? "animate-bounce" : ""} />
                <span>{syncingNavs ? "Syncing AMFI..." : "Sync AMFI NAVs"}</span>
              </button>

              {/* Refresh View Button */}
              <button
                onClick={() => loadData()}
                disabled={loading}
                title="Reload latest screener data"
                className="flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-[#07101E] px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-white hover:bg-slate-800 transition shadow-xs disabled:opacity-50"
              >
                <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
                <span>Refresh View</span>
              </button>

              {/* Trigger Intraday Dip Scan Button */}
              <button
                onClick={handleScanDipsNow}
                disabled={scanning}
                title="Scan live benchmark indices for intraday dip buy opportunities"
                className="flex items-center gap-1.5 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-3.5 py-2 text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500 hover:text-white dark:hover:text-slate-950 transition shadow-xs disabled:opacity-50"
              >
                <Zap size={13} className={scanning ? "animate-spin" : ""} />
                <span>{scanning ? "Scanning Indices..." : "Scan Dips"}</span>
              </button>
            </div>
          }
        />

        {/* Sync Status Banner */}
        {syncMessage && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-300 shadow-sm animate-fadeIn">
            <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
            <span className="font-mono">{syncMessage}</span>
          </div>
        )}


      {/* ── 2. Live Category Benchmark Ticker Strip ── */}
      {liveIndices && liveIndices.indices && (
        <div className="mb-6 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2.5 min-w-max">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono mr-1">
              Live Benchmarks:
            </span>
            {Object.entries(liveIndices.indices).map(([k, idx]) => {
              const isNeg = idx.change_pct < 0;
              const isDipTrigger = idx.change_pct <= -1.0;
              return (
                <div
                  key={k}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs transition ${
                    isDipTrigger
                      ? "border-amber-500/50 bg-amber-500/10 text-amber-300 font-bold animate-pulse shadow-sm shadow-amber-950/40"
                      : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#071120]"
                  }`}
                >
                  <span className="text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                    {idx.name}
                  </span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {idx.last_price.toLocaleString("en-IN")}
                  </span>
                  <span
                    className={`font-mono text-[11px] font-bold flex items-center ${
                      isNeg ? "text-rose-500" : "text-emerald-500"
                    }`}
                  >
                    {isNeg ? <TrendingDown size={11} className="mr-0.5" /> : <TrendingUp size={11} className="mr-0.5" />}
                    {idx.change_pct > 0 ? "+" : ""}
                    {idx.change_pct}%
                  </span>
                  {isDipTrigger && (
                    <span className="rounded bg-amber-500/30 text-amber-300 text-[9px] px-1 py-0.2 font-bold uppercase">
                      DIP &gt; 1%
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 3. Active Dip Alert Banner ── */}
      {activeAlerts.length > 0 && (
        <div className="mb-6 rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-500/15 via-[#081326] to-amber-500/10 p-4 shadow-xl shadow-amber-950/20">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 border border-amber-500/30 shrink-0">
                <AlertTriangle size={20} className="text-amber-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                  <span>🚨 Urgent Lumpsum Dip Signals Detected Before 2:00 PM Cutoff</span>
                  <span className="rounded bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] px-2 py-0.2">
                    {activeAlerts.length} Active Today
                  </span>
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Category benchmark indices have corrected &gt; 1%. Deploy incremental lumpsum cash before 13:50 IST to capture today's depressed NAV.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {activeAlerts.slice(0, 3).map((a) => (
                <button
                  key={a.id}
                  onClick={() => setSelectedCategory(a.category)}
                  className="rounded-lg border border-amber-500/40 bg-amber-500/20 px-2.5 py-1 text-xs font-semibold text-amber-200 hover:bg-amber-500 hover:text-slate-950 transition"
                >
                  Buy {a.category} ({a.index_drop_pct}%)
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── View Mode Switcher Ribbon ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center rounded-xl border border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-[#071120] p-1 gap-1">
          <button
            onClick={() => setActiveViewTab("screener")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeViewTab === "screener"
                ? "bg-cyan-600 dark:bg-cyan-500 text-white dark:text-slate-950 font-bold shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <BarChart2 size={13} />
            <span>Top 100 Screener</span>
          </button>

          <button
            onClick={() => setActiveViewTab("heatmap")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeViewTab === "heatmap"
                ? "bg-cyan-600 dark:bg-cyan-500 text-white dark:text-slate-950 font-bold shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Layers size={13} />
            <span>Macro Rotation Heatmap</span>
          </button>

          <button
            onClick={() => setActiveViewTab("dilution")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeViewTab === "dilution"
                ? "bg-rose-600 text-white font-bold shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <ShieldAlert size={13} />
            <span>Fee Drag & Size Curse ({dilutionAlerts.length})</span>
          </button>

          <button
            onClick={() => setActiveViewTab("portfolio")}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeViewTab === "portfolio"
                ? "bg-emerald-600 dark:bg-emerald-500 text-white dark:text-slate-950 font-bold shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Briefcase size={13} />
            <span>Portfolio & Smart Swaps</span>
          </button>
        </div>

        <span className="text-[11px] text-slate-500 font-mono hidden sm:inline">
          Showing {schemes.length} Pure Equity Schemes
        </span>
      </div>

      {/* ── View 1: Macro Category Heatmap & Fee Drag Alerts ── */}
      {(activeViewTab === "heatmap" || activeViewTab === "dilution") && heatmapData && (
        <MFCategoryHeatmap
          macroCommentary={heatmapData.macro_commentary}
          heatmap={heatmapData.heatmap}
          dilutionAlerts={dilutionAlerts}
          selectedCategory={selectedCategory}
          onSelectCategory={(cat) => {
            setSelectedCategory(cat);
            setActiveViewTab("screener");
          }}
        />
      )}

      {/* ── View 2: Personal Portfolio & Smart Swaps Radar ── */}
      {activeViewTab === "portfolio" && (
        <MFPortfolioView
          availableSchemes={schemes}
          onOpenSchemeChart={(s) => setModalScheme(s)}
        />
      )}

      {/* ── View 3: Screener Table & Category Filters ── */}
      {activeViewTab === "screener" && (
        <>
          {/* Category Tabs & Search Filters */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
            {/* Category Pill Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {categoriesList.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-full px-3.5 py-1 text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? "bg-cyan-600 dark:bg-cyan-500 text-white dark:text-slate-950 font-bold shadow-md shadow-cyan-950/50"
                  : "bg-slate-100 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search & Sort Controls */}
        <div className="flex items-center gap-2.5">
          <div className="relative min-w-[220px]">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search scheme, AMC, manager..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-[#071120] pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-hidden focus:border-cyan-500"
            />
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-1 text-xs">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded-xl border border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-[#071120] px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-hidden"
            >
              <option value="return_6m_pct">Sort: 6M Return</option>
              <option value="return_3m_pct">Sort: 3M Return</option>
              <option value="return_1y_pct">Sort: 1Y Return</option>
              <option value="dip_from_52w_high_pct">Sort: Down from Peak</option>
              <option value="day_change_pct">Sort: Today's Dip %</option>
              <option value="alpha_1y">Sort: 1Y Alpha</option>
              <option value="aum_cr">Sort: AUM Size</option>
              <option value="dip_count_1y">Sort: 1Y Dip Frequency</option>
            </select>

            <button
              onClick={() => setSortOrder((v) => (v === "desc" ? "asc" : "desc"))}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-300 dark:border-slate-800 bg-slate-50 dark:bg-[#071120] text-slate-600 dark:text-slate-300 hover:text-white"
              title={`Sorting: ${sortOrder.toUpperCase()}`}
            >
              <ArrowUpDown size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ── 5. Screener Table ── */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#050B14] overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse min-w-[1100px]">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#07101E] text-slate-500 dark:text-slate-400 font-mono text-[11px] uppercase tracking-wider">
                <th className="py-3 px-3 w-8 text-center"></th>
                <th className="py-3 px-3 w-10 text-center">#</th>
                <th className="py-3 px-4 min-w-[300px]">Scheme Name & AMC</th>
                <th className="py-3 px-3 min-w-[130px]">Category</th>
                <th className="py-3 px-3 min-w-[100px] text-right">Current NAV</th>
                <th className="py-3 px-3 min-w-[95px] text-right">From Peak</th>
                <th className="py-3 px-3 min-w-[95px] text-right">1D Change</th>
                <th className="py-3 px-3 min-w-[80px] text-right">3M %</th>
                <th className="py-3 px-3 min-w-[95px] text-right font-bold text-cyan-400">6M Alpha %</th>
                <th className="py-3 px-3 min-w-[80px] text-right">1Y %</th>
                <th className="py-3 px-3 min-w-[80px] text-right">1Y Dips</th>
                <th className="py-3 px-3 min-w-[100px] text-right">AUM (₹ Cr)</th>
                <th className="py-3 px-3 min-w-[75px] text-right">TER</th>
                <th className="py-3 px-3 w-16 text-center">Chart</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={14} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="h-6 w-6 animate-spin text-cyan-500" />
                      <span>Loading Top Equity Schemes & Real-Time Performance...</span>
                    </div>
                  </td>
                </tr>
              ) : schemes.length === 0 ? (
                <tr>
                  <td colSpan={14} className="p-8">
                    <EmptyState
                      icon={<Briefcase className="h-7 w-7 text-cyan-400" />}
                      title="No schemes found matching the filters"
                      description="Try changing the category or clearing the search query."
                      action={
                        <button
                          onClick={() => {
                            setSelectedCategory("All");
                            setSearchQuery("");
                          }}
                          className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20"
                        >
                          Reset Category & Search
                        </button>
                      }
                    />
                  </td>
                </tr>
              ) : (
                schemes.map((s, idx) => {
                  const isExpanded = expandedSchemeCode === s.scheme_code;
                  const isDip = s.day_change_pct <= -1.0;
                  return (
                    <Fragment key={s.scheme_code}>
                      {/* Main Scheme Row */}
                      <tr
                        onClick={() => setExpandedSchemeCode(isExpanded ? null : s.scheme_code)}
                        className={`cursor-pointer transition-colors ${
                          isExpanded
                            ? "bg-cyan-500/10 dark:bg-cyan-950/30"
                            : isDip
                            ? "bg-amber-500/5 hover:bg-amber-500/10"
                            : "hover:bg-slate-50 dark:hover:bg-[#071120]"
                        }`}
                      >
                        {/* Expand Chevron (Option 2 Trigger) */}
                        <td className="py-3 px-3 text-slate-400">
                          {isExpanded ? <ChevronDown size={14} className="text-cyan-400" /> : <ChevronRight size={14} />}
                        </td>

                        {/* Index */}
                        <td className="py-3 px-3 text-slate-400 text-[11px]">{idx + 1}</td>

                        {/* Scheme Name & AMC */}
                        <td className="py-3 px-4 font-sans min-w-[300px]">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-slate-900 dark:text-white line-clamp-1 max-w-[280px]">
                              {s.scheme_name}
                            </span>
                            {isDip && (
                              <span className="rounded bg-amber-500/20 text-amber-300 text-[9px] px-1.5 py-0.2 font-bold font-mono">
                                DIP BUY
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                            <span>{s.amc_name}</span>
                            <span>•</span>
                            <span className="text-slate-500">Code: {s.scheme_code}</span>
                          </div>
                        </td>

                        {/* Category Badge */}
                        <td className="py-3 px-3 min-w-[130px]">
                          <span className="rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                            {s.category}
                          </span>
                        </td>

                        {/* Current NAV */}
                        <td className="py-3 px-3 text-right min-w-[105px]">
                          <div className="font-bold text-slate-900 dark:text-white">
                            ₹{s.current_nav ? s.current_nav.toFixed(2) : "N/A"}
                          </div>
                          {s.nav_date && (
                            <div className="text-[10px] text-slate-400 font-mono font-normal mt-0.5">
                              {new Date(s.nav_date).toLocaleDateString("en-IN", {
                                day: "2-digit",
                                month: "short",
                              })}
                            </div>
                          )}
                        </td>

                        {/* Down from Peak (52W High) */}
                        <td className="py-3 px-3 text-right font-mono min-w-[95px]">
                          {s.dip_from_52w_high_pct !== null && s.dip_from_52w_high_pct !== undefined ? (
                            s.dip_from_52w_high_pct <= 2.5 ? (
                              <span className="rounded bg-cyan-500/10 border border-cyan-500/30 px-1.5 py-0.2 text-[10px] font-bold text-cyan-400">
                                -{s.dip_from_52w_high_pct.toFixed(2)}%
                              </span>
                            ) : s.dip_from_52w_high_pct <= 8.5 ? (
                              <span className="rounded bg-amber-500/10 border border-amber-500/30 px-1.5 py-0.2 text-[10px] font-bold text-amber-400">
                                -{s.dip_from_52w_high_pct.toFixed(2)}%
                              </span>
                            ) : (
                              <span className="rounded bg-rose-500/10 border border-rose-500/30 px-1.5 py-0.2 text-[10px] font-bold text-rose-400">
                                -{s.dip_from_52w_high_pct.toFixed(2)}%
                              </span>
                            )
                          ) : (
                            <span className="text-slate-500">—</span>
                          )}
                        </td>

                        {/* 1D Change */}
                        <td className="py-3 px-3 text-right font-bold min-w-[95px]">
                          <span
                            className={
                              s.day_change_pct < 0
                                ? "text-rose-500 font-semibold"
                                : s.day_change_pct > 0
                                ? "text-emerald-500 font-semibold"
                                : "text-slate-400"
                            }
                          >
                            {s.day_change_pct > 0 ? "+" : ""}
                            {s.day_change_pct.toFixed(2)}%
                          </span>
                        </td>

                        {/* 3M Return */}
                        <td className="py-3 px-3 text-right min-w-[80px]">
                          <span
                            className={
                              s.return_3m_pct && s.return_3m_pct >= 0 ? "text-emerald-400" : "text-rose-400"
                            }
                          >
                            {s.return_3m_pct !== null ? `${s.return_3m_pct > 0 ? "+" : ""}${s.return_3m_pct}%` : "—"}
                          </span>
                        </td>

                        {/* 6M Alpha Return (Highlighted) */}
                        <td className="py-3 px-3 text-right font-bold text-sm min-w-[95px]">
                          <span
                            className={
                              s.return_6m_pct && s.return_6m_pct >= 0 ? "text-emerald-400 font-bold" : "text-rose-400"
                            }
                          >
                            {s.return_6m_pct !== null ? `${s.return_6m_pct > 0 ? "+" : ""}${s.return_6m_pct}%` : "—"}
                          </span>
                        </td>

                        {/* 1Y Return */}
                        <td className="py-3 px-3 text-right text-slate-300 min-w-[80px]">
                          {s.return_1y_pct !== null ? `${s.return_1y_pct > 0 ? "+" : ""}${s.return_1y_pct}%` : "—"}
                        </td>

                        {/* 1Y Dip Frequency */}
                        <td className="py-3 px-3 text-right min-w-[80px]">
                          <span className="rounded bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.2 text-[10px] font-semibold text-emerald-400">
                            {s.dip_count_1y || 0}
                          </span>
                        </td>

                        {/* AUM Size */}
                        <td className="py-3 px-3 text-right text-slate-300 min-w-[100px]">
                          ₹{s.aum_cr ? Number(s.aum_cr).toLocaleString("en-IN") : "N/A"}
                        </td>

                        {/* Expense Ratio */}
                        <td className="py-3 px-3 text-right text-cyan-400 min-w-[75px]">
                          {s.ter ? `${s.ter}%` : "0.65%"}
                        </td>

                        {/* Option 3 Button: Open Full Modal */}
                        <td className="py-3 px-3 text-center w-16" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setModalScheme(s)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/80 px-2 py-1 text-[11px] font-semibold text-slate-300 hover:border-cyan-500/50 hover:bg-cyan-500/20 hover:text-cyan-300 transition"
                            title="Open Institutional Deep-Dive Chart Modal"
                          >
                            <BarChart2 size={12} />
                            <span>Pro</span>
                          </button>
                        </td>
                      </tr>

                      {/* Option 2: Inline Row Drawer (Smooth Accordion Dropdown) */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={14} className="p-0">
                            <MFRowInlineDrawer
                              scheme={s}
                              onOpenDeepDive={() => setModalScheme(s)}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      </>
      )}

      {/* ── Option 3: Full-Screen Deep-Dive Modal ── */}
      <MFChartModal
        scheme={modalScheme}
        isOpen={!!modalScheme}
        onClose={() => setModalScheme(null)}
      />
      </div>
    </DashboardLayout>
  );
}

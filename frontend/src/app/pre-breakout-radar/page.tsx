"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  TrendingUp,
  RefreshCw,
  Search,
  Sparkles,
  Zap,
  Target,
  Flame,
  Filter,
  CheckCircle2,
  XCircle,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  ArrowUpDown,
  Layers,
  BarChart2,
  Sliders,
  ShieldCheck,
  Activity,
  Maximize2,
  X,
  Info,
  Clock,
  Crosshair,
  Gauge,
  Percent,
  Star,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import WatchlistModal from "@/components/layout/screener/WatchlistModal";
import { fetchWatchlists, fetchWatchlist } from "@/lib/watchlistApi";
import type { WatchlistSummary } from "@/types/watchlist";
import type { GrowthCompany } from "@/lib/api";
import {
  PreBreakoutOpportunity,
  PreBreakoutMetadata,
  fetchPrebreakoutOpportunities,
  triggerPrebreakoutScan,
  fetchPrebreakoutFilterOptions,
} from "@/lib/prebreakoutRadarApi";

const PATTERN_TABS = [
  { id: "ALL", label: "All Pre-Breakout Coils" },
  { id: "SUPER_COIL", label: "NR7 + Inside Day" },
  { id: "NR7", label: "NR7 Volatility Compression" },
  { id: "INSIDE_DAY", label: "Inside Day Compression" },
  { id: "VDU_CHEAT", label: "Volume Dry-Up (VDU)" },
  { id: "BB_SQUEEZE", label: "Bollinger Squeeze" },
];

export default function PreBreakoutRadarPage() {
  const [opportunities, setOpportunities] = useState<PreBreakoutOpportunity[]>([]);
  const [metadata, setMetadata] = useState<PreBreakoutMetadata | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [scanning, setScanning] = useState<boolean>(false);
  const [sectors, setSectors] = useState<string[]>([]);
  const [selectedOpportunity, setSelectedOpportunity] = useState<PreBreakoutOpportunity | null>(null);

  // Watchlist integration state
  const [watchlists, setWatchlists] = useState<WatchlistSummary[]>([]);
  const [watchlistMap, setWatchlistMap] = useState<Record<string, {
    in_watchlist: boolean;
    watchlist_id: number;
    watchlist_name: string;
    item_id: number;
    confidence_score?: number;
    comment?: string;
    target_price?: number | null;
  }>>({});
  const [selectedCompanyForWatchlist, setSelectedCompanyForWatchlist] = useState<GrowthCompany | null>(null);
  const [isWatchlistModalOpen, setIsWatchlistModalOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showWatchlistedOnly, setShowWatchlistedOnly] = useState<boolean>(false);

  // Filters & Controls
  const [activePattern, setActivePattern] = useState<string>("ALL");
  const [minScore, setMinScore] = useState<number>(60);
  const [selectedSector, setSelectedSector] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("conviction_score");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  // Position Sizing Calculator State in Modal
  const [accountRiskRupees, setAccountRiskRupees] = useState<number>(10000);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchPrebreakoutOpportunities({
        min_score: minScore,
        pattern: activePattern === "ALL" ? undefined : activePattern,
        search: searchTerm,
        sector: selectedSector === "ALL" ? undefined : selectedSector,
        sort_by: sortBy,
        sort_order: sortOrder,
        page: page,
        limit: 25,
      });

      setOpportunities(res.items || []);
      setMetadata(res.metadata || null);
      setTotalCount(res.total_count || 0);
      setTotalPages(res.total_pages || 1);
    } catch (err) {
      console.error("Failed to load pre-breakout opportunities:", err);
    } finally {
      setLoading(false);
    }
  }, [activePattern, minScore, searchTerm, selectedSector, sortBy, sortOrder, page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    fetchPrebreakoutFilterOptions()
      .then((res) => {
        if (res && res.sectors) setSectors(res.sectors);
      })
      .catch(() => {});
  }, []);

  const handleTriggerScan = async () => {
    setScanning(true);
    try {
      await triggerPrebreakoutScan();
      await loadData();
    } catch (err) {
      console.error("Failed to trigger pre-breakout scan:", err);
    } finally {
      setScanning(false);
    }
  };

  // =====================================================
  // Watchlist Data Fetching & Sync
  // =====================================================
  const loadWatchlistsData = useCallback(async () => {
    try {
      const res = await fetchWatchlists();
      if (res && res.watchlists) {
        setWatchlists(res.watchlists);
        const map: Record<
          string,
          {
            in_watchlist: boolean;
            watchlist_id: number;
            watchlist_name: string;
            item_id: number;
            confidence_score?: number;
            comment?: string;
            target_price?: number | null;
          }
        > = {};

        for (const wl of res.watchlists) {
          try {
            const detail = await fetchWatchlist(wl.id);
            if (detail && detail.items) {
              for (const it of detail.items) {
                map[it.symbol] = {
                  in_watchlist: true,
                  watchlist_id: wl.id,
                  watchlist_name: wl.name,
                  item_id: it.id,
                  confidence_score: it.confidence_score,
                  comment: it.comment,
                  target_price: it.target_price,
                };
              }
            }
          } catch {
            // continue
          }
        }
        setWatchlistMap(map);
      }
    } catch (err) {
      console.warn("Failed to load watchlists for prebreakout:", err);
    }
  }, []);

  useEffect(() => {
    loadWatchlistsData();
  }, [loadWatchlistsData]);

  const openWatchlistModal = (opp: PreBreakoutOpportunity) => {
    const wlInfo = watchlistMap[opp.symbol];
    const companyAdapter: GrowthCompany = {
      index: 0,
      symbol: opp.symbol,
      company: opp.company_name || opp.symbol,
      sector: opp.sector,
      industry: null,
      exchange: "NSE",
      cmp: opp.cmp,
      market_cap: null,
      market_cap_category: null,
      pe_ratio: null,
      industry_pe: null,
      pb_ratio: null,
      peg_ratio: null,
      roce: null,
      roe: null,
      opm: null,
      sales_growth_yoy: null,
      sales_growth_qoq: null,
      profit_growth_yoy: null,
      profit_growth_qoq: null,
      sales_cagr_3y: null,
      profit_cagr_3y: null,
      health_score: opp.conviction_score,
      result_date: null,
      conviction_score:
        wlInfo?.confidence_score ??
        Math.min(5, Math.max(1, Math.round(opp.conviction_score / 20))),
      watchlist_comment:
        wlInfo?.comment ??
        `Pre-Breakout Setup: ${opp.primary_pattern} (${opp.setup_tier}). Cheat Entry: ₹${opp.blueprint.cheat_entry}, SL: ₹${opp.blueprint.stop_loss} (${opp.blueprint.risk_pct}%), Target 1: ₹${opp.blueprint.target_1} (R:R ${opp.blueprint.risk_reward}:1)`,
      target_price: wlInfo?.target_price ?? opp.blueprint.target_1,
      in_watchlist: wlInfo?.in_watchlist ?? false,
      watchlist_id: wlInfo?.watchlist_id ?? null,
      watchlist_item_id: wlInfo?.item_id ?? null,
    };
    setSelectedCompanyForWatchlist(companyAdapter);
    setIsWatchlistModalOpen(true);
  };

  const handleWatchlistUpdated = (
    symbol: string,
    action: "added" | "updated" | "removed",
    data?: {
      watchlistId: number;
      watchlistName: string;
      convictionScore: number;
      comment?: string;
      targetPrice?: number | null;
    }
  ) => {
    setWatchlistMap((prev) => {
      const next = { ...prev };
      if (action === "removed") {
        delete next[symbol];
      } else if (data) {
        next[symbol] = {
          in_watchlist: true,
          watchlist_id: data.watchlistId,
          watchlist_name: data.watchlistName,
          item_id: next[symbol]?.item_id || Date.now(),
          confidence_score: data.convictionScore,
          comment: data.comment,
          target_price: data.targetPrice ?? undefined,
        };
      }
      return next;
    });

    if (action === "removed") {
      setToastMessage(`${symbol} removed from watchlist`);
    } else {
      setToastMessage(
        `${symbol} saved to ${data?.watchlistName || "Watchlist"} (${data?.convictionScore}★)`
      );
    }
    setTimeout(() => setToastMessage(null), 4000);
  };

  const displayedOpportunities = useMemo(() => {
    if (!showWatchlistedOnly) return opportunities;
    return opportunities.filter((opp) => Boolean(watchlistMap[opp.symbol]?.in_watchlist));
  }, [opportunities, showWatchlistedOnly, watchlistMap]);

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* HEADER & BANNER */}
        <div className="rounded-2xl border border-slate-800 bg-[#07111F]/90 p-5 shadow-xl backdrop-blur-md">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  <Crosshair className="h-5 w-5" />
                </div>
                <h1 className="text-xl md:text-2xl font-black font-mono tracking-tight text-white">
                  PRE-BREAKOUT CHEAT RADAR
                </h1>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-mono font-bold text-emerald-300">
                  BUY BEFORE THE MOVE
                </span>
                <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-xs font-mono font-bold text-cyan-400">
                  3.5:1+ ASYMMETRIC R:R
                </span>
              </div>
              <p className="text-xs md:text-sm text-slate-400 max-w-3xl">
                Scans liquid equities in quiet, high-compression volatility coils with extreme supply exhaustion (Volume Dry-Up) right beneath resistance. Enters on the contraction low to capture explosive +10% to +20% breakouts with tiny 3% risk.
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleTriggerScan}
                disabled={scanning}
                className="flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-950/60 px-4 py-2 text-xs font-mono font-bold text-emerald-300 hover:bg-emerald-900/80 transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${scanning ? "animate-spin" : ""}`} />
                <span>{scanning ? "Scanning Universe..." : "Trigger Live Scan"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* METRICS & TELEMETRY RIBBON */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="rounded-xl border border-slate-800/80 bg-slate-950/80 p-3.5 flex flex-col justify-between">
            <span className="text-[10px] uppercase font-mono font-bold text-slate-400">Scanned Universe</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold font-mono text-white">{metadata?.total_scanned || 0}</span>
              <span className="text-[10px] text-slate-500 font-mono">Stocks</span>
            </div>
          </div>

          <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-3.5 flex flex-col justify-between">
            <span className="text-[10px] uppercase font-mono font-bold text-emerald-400">A+ Super Coils</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold font-mono text-emerald-300">{metadata?.super_coils_count || 0}</span>
              <span className="text-[10px] text-emerald-400/70 font-mono">Top Decile</span>
            </div>
          </div>

          <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-3.5 flex flex-col justify-between">
            <span className="text-[10px] uppercase font-mono font-bold text-cyan-400">High Conviction</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold font-mono text-cyan-300">{metadata?.high_conviction_count || 0}</span>
              <span className="text-[10px] text-cyan-400/70 font-mono">&gt;= 70 Pts</span>
            </div>
          </div>

          <div className="rounded-xl border border-purple-500/20 bg-purple-950/20 p-3.5 flex flex-col justify-between">
            <span className="text-[10px] uppercase font-mono font-bold text-purple-400">NR7 / Inside Days</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold font-mono text-purple-300">
                {(metadata?.nr7_count || 0) + (metadata?.inside_day_count || 0)}
              </span>
              <span className="text-[10px] text-purple-400/70 font-mono">Tight Coils</span>
            </div>
          </div>

          <div className="rounded-xl border border-amber-500/20 bg-amber-950/20 p-3.5 flex flex-col justify-between">
            <span className="text-[10px] uppercase font-mono font-bold text-amber-400">Volume Dry-Up (VDU)</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold font-mono text-amber-300">{metadata?.vdu_count || 0}</span>
              <span className="text-[10px] text-amber-400/70 font-mono">&lt;= 0.70x Vol</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-slate-950/80 p-3.5 flex flex-col justify-between">
            <span className="text-[10px] uppercase font-mono font-bold text-slate-400">Avg Risk:Reward</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold font-mono text-emerald-400">{metadata?.avg_risk_reward || 3.5}:1</span>
              <span className="text-[10px] text-slate-500 font-mono">Asymmetric</span>
            </div>
          </div>
        </div>

        {/* PATTERN TABS STRIP */}
        <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-xl border border-slate-800 bg-slate-950/70">
          {PATTERN_TABS.map((tab) => {
            const isActive = activePattern === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActivePattern(tab.id);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                  isActive
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                    : "text-slate-400 hover:text-white hover:bg-slate-900"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* TOOLBAR */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-800 bg-slate-950/70">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search symbol or company..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-9 pr-4 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50"
              />
            </div>

            {/* Sector Dropdown */}
            <select
              value={selectedSector}
              onChange={(e) => {
                setSelectedSector(e.target.value);
                setPage(1);
              }}
              className="py-1.5 px-3 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300 focus:outline-none focus:border-emerald-500/50"
            >
              <option value="ALL">All Sectors</option>
              {sectors.map((sec) => (
                <option key={sec} value={sec}>
                  {sec}
                </option>
              ))}
            </select>

            {/* Minimum Score */}
            <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
              <span>Conviction Tier:</span>
              <select
                value={minScore}
                onChange={(e) => {
                  setMinScore(Number(e.target.value));
                  setPage(1);
                }}
                className="bg-transparent text-emerald-300 font-bold focus:outline-none cursor-pointer"
              >
                <option value={80} className="bg-slate-900">A+ Super Coils (&gt;= 80)</option>
                <option value={70} className="bg-slate-900">A High Conviction (&gt;= 70)</option>
                <option value={60} className="bg-slate-900">B Developing (&gt;= 60)</option>
                <option value={30} className="bg-slate-900">All Scored (&gt;= 30)</option>
              </select>
            </div>

            {/* Watchlisted Only Filter Toggle */}
            <button
              type="button"
              onClick={() => setShowWatchlistedOnly((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer ${
                showWatchlistedOnly
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm shadow-amber-500/10"
                  : "bg-slate-900 text-slate-400 hover:text-slate-200 border-slate-800"
              }`}
              title="Filter to only watchlisted setups"
            >
              <Star className={`h-3.5 w-3.5 ${showWatchlistedOnly ? "fill-amber-400 text-amber-400" : ""}`} />
              <span>
                Watchlisted ({Object.keys(watchlistMap).filter((s) => opportunities.some((o) => o.symbol === s)).length})
              </span>
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 self-end md:self-auto">
            <button
              onClick={() => setViewMode("table")}
              className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition-all cursor-pointer ${
                viewMode === "table" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" : "text-slate-400 hover:text-white"
              }`}
            >
              Table View
            </button>
            <button
              onClick={() => setViewMode("cards")}
              className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition-all cursor-pointer ${
                viewMode === "cards" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" : "text-slate-400 hover:text-white"
              }`}
            >
              Cards View
            </button>
          </div>
        </div>

        {/* RESULTS SECTION */}
        {loading ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-12 text-center space-y-3">
            <RefreshCw className="h-8 w-8 text-emerald-400 animate-spin mx-auto" />
            <p className="text-sm font-mono text-slate-300">Scanning liquid equities for pre-breakout contraction coils...</p>
            <p className="text-xs font-mono text-slate-500">Checking Toby Crabel NR7, Inside Days, VDU Supply Exhaustion, and Pivot Proximity</p>
          </div>
        ) : displayedOpportunities.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-12 text-center space-y-3">
            <Info className="h-8 w-8 text-amber-400 mx-auto" />
            <p className="text-base font-bold font-mono text-white">No Matching Pre-Breakout Coils Found for Current Filters</p>
            <p className="text-xs font-mono text-slate-400 max-w-md mx-auto">
              {showWatchlistedOnly
                ? "You don't have any matching pre-breakout stocks in your watchlists currently. Click the Star icon on any stock to add it."
                : "Try switching the pattern tab to 'All Pre-Breakout Coils' or lowering the minimum conviction score to see developing setups."}
            </p>
            <button
              onClick={() => {
                setActivePattern("ALL");
                setMinScore(60);
                setSelectedSector("ALL");
                setSearchTerm("");
                setShowWatchlistedOnly(false);
              }}
              className="mt-2 px-4 py-2 rounded-xl bg-emerald-950 text-emerald-300 border border-emerald-700/50 text-xs font-mono font-bold hover:bg-emerald-900 cursor-pointer"
            >
              Reset Filters to View All Setups
            </button>
          </div>
        ) : viewMode === "table" ? (
          /* TABLE VIEW */
          <div className="rounded-2xl border border-slate-800 bg-[#07111F]/90 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-950/90 text-[10px] uppercase text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Symbol & Sector</th>
                    <th className="py-3 px-3">Price & Return</th>
                    <th className="py-3 px-3">Conviction Tier</th>
                    <th className="py-3 px-3">Primary Contraction Pattern</th>
                    <th className="py-3 px-3 text-center">Pivot Dist %</th>
                    <th className="py-3 px-3 text-center">VDU Ratio</th>
                    <th className="py-3 px-3 text-center">Daily Range</th>
                    <th className="py-3 px-3 text-center">RSI (14)</th>
                    <th className="py-3 px-3">Cheat Trade Setup</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {displayedOpportunities.map((opp) => {
                    const isPositive = opp.day_change_pct >= 0;
                    const wlInfo = watchlistMap[opp.symbol];
                    const isInWatchlist = Boolean(wlInfo?.in_watchlist);
                    return (
                      <tr
                        key={opp.symbol}
                        className="hover:bg-slate-900/60 transition-colors group cursor-pointer"
                        onClick={() => setSelectedOpportunity(opp)}
                      >
                        {/* Symbol & Name */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            {/* Watchlist Star Icon */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openWatchlistModal(opp);
                              }}
                              title={
                                isInWatchlist
                                  ? `In Watchlist: ${wlInfo.watchlist_name} (${wlInfo.confidence_score}★) - Click to edit`
                                  : `Add ${opp.symbol} to Watchlist`
                              }
                              className={`p-1.5 rounded-lg border transition-all cursor-pointer shrink-0 ${
                                isInWatchlist
                                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30"
                                  : "text-slate-600 hover:text-amber-400 hover:bg-slate-900 border-slate-800/80"
                              }`}
                            >
                              <Star className={`h-3.5 w-3.5 ${isInWatchlist ? "fill-amber-400 text-amber-400" : ""}`} />
                            </button>

                            <div className="flex flex-col">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-sm text-white group-hover:text-emerald-400 transition-colors">
                                  {opp.symbol}
                                </span>
                                {opp.setup_tier === "A+ SUPER COIL" && (
                                  <span className="p-0.5 rounded bg-emerald-500/20 text-emerald-400">
                                    <Sparkles className="h-3 w-3" />
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-slate-400 truncate max-w-[140px]">
                                {opp.company_name}
                              </span>
                              <span className="text-[9px] text-slate-500">
                                {opp.sector}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Price & Day change */}
                        <td className="py-3.5 px-3">
                          <div className="flex flex-col">
                            <span className="font-bold text-white text-sm">
                              ₹{opp.cmp.toLocaleString("en-IN")}
                            </span>
                            <span
                              className={`text-[11px] font-bold ${
                                isPositive ? "text-emerald-400" : "text-rose-400"
                              }`}
                            >
                              {isPositive ? "+" : ""}
                              {opp.day_change_pct}%
                            </span>
                          </div>
                        </td>

                        {/* Conviction Score & Tier */}
                        <td className="py-3.5 px-3">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-md text-[11px] font-bold border ${opp.tier_badge}`}
                          >
                            {opp.conviction_score} PTS • {opp.setup_tier}
                          </span>
                        </td>

                        {/* Primary Pattern */}
                        <td className="py-3.5 px-3">
                          <div className="flex flex-col gap-1">
                            <span className="font-bold text-slate-200">
                              {opp.primary_pattern}
                            </span>
                            <div className="flex flex-wrap gap-1">
                              {opp.pattern_badges.map((b, i) => (
                                <span
                                   key={i}
                                   className="text-[9px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-cyan-300"
                                 >
                                   {b}
                                 </span>
                              ))}
                            </div>
                          </div>
                        </td>

                        {/* Pivot Distance % */}
                        <td className="py-3.5 px-3 text-center">
                          <span
                            className={`inline-flex items-center font-bold text-xs ${
                              opp.metrics.dist_to_pivot_pct <= 3.0
                                ? "text-emerald-400"
                                : opp.metrics.dist_to_pivot_pct <= 4.0
                                ? "text-cyan-300"
                                : "text-slate-400"
                            }`}
                          >
                            {opp.metrics.dist_to_pivot_pct}%
                          </span>
                        </td>

                        {/* Volume Dry-Up (VDU) */}
                        <td className="py-3.5 px-3 text-center">
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded border ${
                              opp.metrics.vdu_ratio <= 0.50
                                ? "bg-emerald-950/60 text-emerald-300 border-emerald-700/40"
                                : opp.metrics.vdu_ratio <= 0.70
                                ? "bg-cyan-950/60 text-cyan-300 border-cyan-800/40"
                                : "bg-slate-900 text-slate-400 border-slate-800"
                            }`}
                          >
                            {opp.metrics.vdu_ratio}x SMA
                          </span>
                        </td>

                        {/* Daily Range % */}
                        <td className="py-3.5 px-3 text-center">
                          <span
                            className={`text-xs font-mono font-bold ${
                              opp.metrics.daily_range_pct <= 1.5 ? "text-emerald-400" : "text-slate-400"
                            }`}
                          >
                            {opp.metrics.daily_range_pct}%
                          </span>
                        </td>

                        {/* RSI 14 */}
                        <td className="py-3.5 px-3 text-center">
                          <span
                            className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${
                              opp.metrics.rsi_14 >= 50 && opp.metrics.rsi_14 <= 64
                                ? "bg-purple-500/20 text-purple-300"
                                : "text-slate-400"
                            }`}
                          >
                            {opp.metrics.rsi_14}
                          </span>
                        </td>

                        {/* Trade Blueprint */}
                        <td className="py-3.5 px-3">
                          <div className="flex flex-col text-[11px]">
                            <span className="text-emerald-400 font-bold">
                              Entry: ₹{opp.blueprint.cheat_entry}
                            </span>
                            <span className="text-slate-400 text-[10px]">
                              SL: ₹{opp.blueprint.stop_loss} ({opp.blueprint.risk_pct}%) | R:R {opp.blueprint.risk_reward}:1
                            </span>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Watchlist Star Icon */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openWatchlistModal(opp);
                              }}
                              title={
                                isInWatchlist
                                  ? `In Watchlist: ${wlInfo.watchlist_name} (${wlInfo.confidence_score}★) - Click to edit`
                                  : "Add to Watchlist"
                              }
                              className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                                isInWatchlist
                                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30"
                                  : "bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-amber-400 border-slate-800"
                              }`}
                            >
                              <Star className={`h-3.5 w-3.5 ${isInWatchlist ? "fill-amber-400 text-amber-400" : ""}`} />
                            </button>

                            <a
                              href={opp.tradingview_url}
                              target="_blank"
                              rel="noreferrer"
                              title="Open in TradingView"
                              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-emerald-400 border border-slate-800 transition-colors"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                            <Link
                              href={opp.techno_funda_url}
                              title="Deep Dive Techno-Funda"
                              className="p-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-300 border border-emerald-800/40 transition-colors"
                            >
                              <Target className="h-3.5 w-3.5" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* CARDS VIEW */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedOpportunities.map((opp) => {
              const wlInfo = watchlistMap[opp.symbol];
              const isInWatchlist = Boolean(wlInfo?.in_watchlist);
              return (
                <div
                  key={opp.symbol}
                  onClick={() => setSelectedOpportunity(opp)}
                  className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-emerald-500/50 transition-all cursor-pointer space-y-3 flex flex-col justify-between"
                >
                  <div>
                    {/* Top Bar */}
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          {/* Watchlist Star Icon */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openWatchlistModal(opp);
                            }}
                            title={
                              isInWatchlist
                                ? `In Watchlist: ${wlInfo.watchlist_name} (${wlInfo.confidence_score}★) - Click to edit`
                                : `Add ${opp.symbol} to Watchlist`
                            }
                            className={`p-1 rounded-md border transition-all cursor-pointer ${
                              isInWatchlist
                                ? "bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30"
                                : "text-slate-600 hover:text-amber-400 hover:bg-slate-900 border-slate-800/80"
                            }`}
                          >
                            <Star className={`h-3.5 w-3.5 ${isInWatchlist ? "fill-amber-400 text-amber-400" : ""}`} />
                          </button>

                          <h3 className="text-base font-bold font-mono text-white hover:text-emerald-400 transition-colors">
                            {opp.symbol}
                          </h3>
                          {opp.setup_tier === "A+ SUPER COIL" && (
                            <span className="p-0.5 rounded bg-emerald-500/20 text-emerald-400">
                              <Sparkles className="h-3 w-3" />
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 truncate max-w-[180px]">{opp.company_name}</p>
                        <span className="text-[10px] text-slate-500">{opp.sector}</span>
                      </div>

                      <div className="text-right">
                        <div className="text-base font-bold font-mono text-white">
                          ₹{opp.cmp.toLocaleString("en-IN")}
                        </div>
                        <div
                          className={`text-xs font-bold font-mono ${
                            opp.day_change_pct >= 0 ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {opp.day_change_pct >= 0 ? "+" : ""}
                          {opp.day_change_pct}%
                        </div>
                      </div>
                    </div>

                    {/* Score & Pattern */}
                    <div className="mt-2.5 flex items-center justify-between">
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${opp.tier_badge}`}>
                        {opp.conviction_score} PTS • {opp.setup_tier}
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400 font-bold">
                        R:R {opp.blueprint.risk_reward}:1
                      </span>
                    </div>

                    {/* Badges Strip */}
                    <div className="mt-2.5 flex flex-wrap gap-1">
                      {opp.pattern_badges.map((b, idx) => (
                        <span
                          key={idx}
                          className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-cyan-300"
                        >
                          {b}
                        </span>
                      ))}
                    </div>

                    {/* Coiling Matrix Grid */}
                    <div className="mt-3 grid grid-cols-3 gap-1.5 p-2 rounded-lg bg-slate-900/80 border border-slate-800/80 text-[10px] font-mono">
                      <div className="text-center">
                        <span className="text-slate-500 block text-[9px] uppercase">Pivot Dist</span>
                        <span className={`font-bold ${opp.metrics.dist_to_pivot_pct <= 3.0 ? "text-emerald-400" : "text-slate-300"}`}>
                          {opp.metrics.dist_to_pivot_pct}%
                        </span>
                      </div>
                      <div className="text-center">
                        <span className="text-slate-500 block text-[9px] uppercase">Volume Dry-Up</span>
                        <span className={`font-bold ${opp.metrics.vdu_ratio <= 0.60 ? "text-amber-400" : "text-slate-300"}`}>
                          {opp.metrics.vdu_ratio}x SMA
                        </span>
                      </div>
                      <div className="text-center">
                        <span className="text-slate-500 block text-[9px] uppercase">RSI 14</span>
                        <span className="font-bold text-purple-400">
                          {opp.metrics.rsi_14}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Trade Setup Blueprint Footer */}
                  <div className="pt-3 border-t border-slate-800/80 space-y-2">
                    <div className="flex items-center justify-between text-[10px] font-mono">
                      <span className="text-slate-400">Cheat Entry: <span className="text-white font-bold">₹{opp.blueprint.cheat_entry}</span></span>
                      <span className="text-slate-400">Target 1: <span className="text-emerald-400 font-bold">₹{opp.blueprint.target_1}</span></span>
                      <span className="text-slate-400">Stop: <span className="text-rose-400 font-bold">₹{opp.blueprint.stop_loss}</span></span>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      {/* Watchlist Quick Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openWatchlistModal(opp);
                        }}
                        className={`flex-1 py-1 px-2 rounded-lg border text-xs font-mono text-center flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                          isInWatchlist
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30"
                            : "bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-amber-400 border-slate-700"
                        }`}
                        title={
                          isInWatchlist
                            ? `In Watchlist: ${wlInfo.watchlist_name} (${wlInfo.confidence_score}★)`
                            : "Add to Watchlist"
                        }
                      >
                        <Star className={`h-3 w-3 ${isInWatchlist ? "fill-amber-400 text-amber-400" : ""}`} />
                        <span>{isInWatchlist ? "Watchlisted" : "Watchlist"}</span>
                      </button>

                      <a
                        href={opp.tradingview_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 py-1 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-mono text-center flex items-center justify-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span>TradingView</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      <Link
                        href={opp.techno_funda_url}
                        className="flex-1 py-1 px-2 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-800/60 text-xs font-mono text-center flex items-center justify-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span>Techno-Funda</span>
                        <Target className="h-3 w-3" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* PAGINATION */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-slate-950/70 text-xs font-mono text-slate-400">
            <span>
              Showing {displayedOpportunities.length} of {totalCount} coiling equities
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-30 cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span>
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-30 cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* DETAILED DRILL-DOWN & POSITION SIZING MODAL */}
        {selectedOpportunity && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
            <div className="relative w-full max-w-2xl rounded-2xl border border-slate-700 bg-[#07111F] p-5 md:p-6 shadow-2xl space-y-4">
              {/* Modal Header */}
              <div className="flex items-start justify-between border-b border-slate-800 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-black font-mono text-white">{selectedOpportunity.symbol}</h2>
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${selectedOpportunity.tier_badge}`}>
                      {selectedOpportunity.setup_tier}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">{selectedOpportunity.company_name} — {selectedOpportunity.sector}</p>
                </div>
                <button
                  onClick={() => setSelectedOpportunity(null)}
                  className="p-1 rounded-lg bg-slate-900 text-slate-400 hover:text-white border border-slate-800 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Price & Volatility Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs font-mono">
                <div>
                  <span className="text-slate-500 text-[10px] block">Current Market Price</span>
                  <span className="text-base font-bold text-white">₹{selectedOpportunity.cmp}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">20-Day Pivot High</span>
                  <span className="text-base font-bold text-cyan-300">₹{selectedOpportunity.metrics.pivot_20d}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">Distance to Pivot</span>
                  <span className="text-base font-bold text-emerald-400">{selectedOpportunity.metrics.dist_to_pivot_pct}%</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">Volume Dry-Up Ratio</span>
                  <span className="text-base font-bold text-amber-400">{selectedOpportunity.metrics.vdu_ratio}x SMA</span>
                </div>
              </div>

              {/* Trade Execution Plan */}
              <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-800/40 space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-emerald-400">
                    Asymmetric Cheat Trade Execution Blueprint
                  </span>
                  <span className="text-[10px] font-bold text-emerald-300">
                    Risk : Reward {selectedOpportunity.blueprint.risk_reward}:1
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <div>
                    <span className="text-slate-500 text-[10px] block">Cheat Entry</span>
                    <span className="font-bold text-white">₹{selectedOpportunity.blueprint.cheat_entry}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">Tight Stop Loss</span>
                    <span className="font-bold text-rose-400">₹{selectedOpportunity.blueprint.stop_loss} ({selectedOpportunity.blueprint.risk_pct}%)</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">Target 1 (+9%)</span>
                    <span className="font-bold text-emerald-400">₹{selectedOpportunity.blueprint.target_1}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">Target 2 (+18%)</span>
                    <span className="font-bold text-cyan-400">₹{selectedOpportunity.blueprint.target_2}</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-300 pt-1 border-t border-emerald-900/40">
                  {selectedOpportunity.blueprint.plan}
                </p>
              </div>

              {/* Dynamic Position Sizing Calculator */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1.5">
                    <Gauge className="h-3.5 w-3.5 text-cyan-400" />
                    <span>Exact Position Sizing Calculator</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500">Max Risk:</span>
                    <select
                      value={accountRiskRupees}
                      onChange={(e) => setAccountRiskRupees(Number(e.target.value))}
                      className="bg-slate-900 text-white px-2 py-0.5 rounded border border-slate-700 text-xs focus:outline-none"
                    >
                      <option value={5000}>₹5,000 Risk</option>
                      <option value={10000}>₹10,000 Risk</option>
                      <option value={20000}>₹20,000 Risk</option>
                      <option value={50000}>₹50,000 Risk</option>
                    </select>
                  </div>
                </div>

                {(() => {
                  const riskPerShare = Math.max(0.5, selectedOpportunity.blueprint.cheat_entry - selectedOpportunity.blueprint.stop_loss);
                  const shares = Math.floor(accountRiskRupees / riskPerShare);
                  const capitalRequired = Math.round(shares * selectedOpportunity.blueprint.cheat_entry);
                  const profitTarget1 = Math.round(shares * 0.5 * (selectedOpportunity.blueprint.target_1 - selectedOpportunity.blueprint.cheat_entry));
                  const profitTarget2 = Math.round(shares * 0.5 * (selectedOpportunity.blueprint.target_2 - selectedOpportunity.blueprint.cheat_entry));
                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-slate-300">
                      <div>
                        <span className="text-slate-500 text-[10px] block">Recommended Quantity</span>
                        <span className="text-base font-bold text-cyan-300">{shares} Shares</span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[10px] block">Capital Required</span>
                        <span className="text-base font-bold text-white">₹{capitalRequired.toLocaleString("en-IN")}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[10px] block">Target 1 Gain</span>
                        <span className="text-base font-bold text-emerald-400">+₹{profitTarget1.toLocaleString("en-IN")}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[10px] block">Target 2 Gain</span>
                        <span className="text-base font-bold text-cyan-400">+₹{profitTarget2.toLocaleString("en-IN")}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                {/* Watchlist Modal Button */}
                <button
                  type="button"
                  onClick={() => openWatchlistModal(selectedOpportunity)}
                  className={`px-4 py-2 rounded-xl font-mono font-bold text-xs flex items-center gap-1.5 cursor-pointer border transition-colors ${
                    watchlistMap[selectedOpportunity.symbol]?.in_watchlist
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30"
                      : "bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-amber-400 border-slate-700"
                  }`}
                >
                  <Star
                    className={`h-3.5 w-3.5 ${
                      watchlistMap[selectedOpportunity.symbol]?.in_watchlist
                        ? "fill-amber-400 text-amber-400"
                        : ""
                    }`}
                  />
                  <span>
                    {watchlistMap[selectedOpportunity.symbol]?.in_watchlist
                      ? "Edit Watchlist & Conviction"
                      : "Add to Watchlist"}
                  </span>
                </button>

                <a
                  href={selectedOpportunity.tradingview_url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Open in TradingView</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <Link
                  href={selectedOpportunity.techno_funda_url}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-mono font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Techno-Funda Analysis</span>
                  <Target className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Watchlist & Conviction Modal */}
        <WatchlistModal
          isOpen={isWatchlistModalOpen}
          onClose={() => setIsWatchlistModalOpen(false)}
          company={selectedCompanyForWatchlist}
          watchlists={watchlists}
          onWatchlistUpdated={handleWatchlistUpdated}
          onRefreshWatchlists={loadWatchlistsData}
        />

        {/* Floating Toast Notification */}
        {toastMessage && (
          <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl border border-amber-500/40 bg-slate-900/95 px-4 py-3 text-xs font-semibold text-amber-400 shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-3 duration-200">
            <span className="flex h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
            <span>{toastMessage}</span>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}


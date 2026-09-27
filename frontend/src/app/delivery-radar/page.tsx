"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  ShieldCheck,
  TrendingUp,
  RefreshCw,
  Search,
  Sparkles,
  Award,
  Target,
  Flame,
  Zap,
  Info,
  Clock,
  Layers,
  Crosshair,
  Activity,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import {
  DeliveryOpportunity,
  DeliveryRadarMetadata,
  fetchDeliveryOpportunities,
  triggerDeliveryScan,
} from "@/lib/deliveryRadarApi";

export default function DeliveryRadarPage() {
  const [opportunities, setOpportunities] = useState<DeliveryOpportunity[]>([]);
  const [metadata, setMetadata] = useState<DeliveryRadarMetadata | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [scanning, setScanning] = useState<boolean>(false);
  const [selectedBlueprint, setSelectedBlueprint] = useState<DeliveryOpportunity | null>(null);

  // Filters & Controls
  const [selectedTier, setSelectedTier] = useState<string>("ALL");
  const [lookbackSessions, setLookbackSessions] = useState<number>(3);
  const [setupType, setSetupType] = useState<string>("ALL");
  const [minSpike, setMinSpike] = useState<number>(1.6);
  const [minDelivPer, setMinDelivPer] = useState<number>(55.0);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("conviction_score");
  const [sortOrder, setSortOrder] = useState<string>("desc");
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchDeliveryOpportunities({
        lookback_sessions: lookbackSessions,
        min_spike: minSpike,
        min_deliv_per: minDelivPer,
        search: searchTerm,
        tier: selectedTier === "ALL" ? undefined : selectedTier,
        setup_type: setupType,
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
      console.error("Failed to load delivery opportunities:", err);
    } finally {
      setLoading(false);
    }
  }, [lookbackSessions, minSpike, minDelivPer, searchTerm, selectedTier, setupType, sortBy, sortOrder, page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleTriggerScan = async () => {
    setScanning(true);
    try {
      await triggerDeliveryScan({
        lookback_sessions: lookbackSessions,
        min_spike: minSpike,
        min_deliv_per: minDelivPer,
      });
      await loadData();
    } catch (err) {
      console.error("Scan error:", err);
    } finally {
      setScanning(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* TOP BANNER & TITLE */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-slate-200/80 bg-white/70 p-4 shadow-sm backdrop-blur-md dark:border-slate-800 dark:bg-[#0b1528]/80">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/20">
                <Flame size={18} />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Delivery Breakout Radar
              </h1>
              <span className="rounded-md border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-xs font-semibold text-purple-300">
                DUAL-ENGINE: 70% APEX / 62% SWING
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Institutional delivery accumulation scanner across Apex Snipers, Active Swings, and Stealth Watchlist.
            </p>
          </div>

          {/* Action: Run Live Scan */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleTriggerScan}
              disabled={scanning}
              className="flex items-center gap-2 rounded-lg bg-cyan-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg shadow-cyan-600/20 transition hover:bg-cyan-500 active:scale-95 disabled:opacity-50"
            >
              <RefreshCw size={14} className={scanning ? "animate-spin" : ""} />
              <span>{scanning ? "Scanning 2,290+ Equities..." : "Run Live Scan"}</span>
            </button>
          </div>
        </div>

        {/* TELEMETRY RIBBON */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {/* Card 1: Total Scanned */}
          <div className="rounded-xl border border-slate-200/80 bg-white/60 p-3 shadow-sm dark:border-slate-800/80 dark:bg-[#0b1528]/60">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-xs font-medium">Equities Scanned</span>
              <Layers size={14} className="text-slate-400" />
            </div>
            <div className="mt-1.5 text-lg font-bold text-slate-900 dark:text-white">
              {metadata?.total_scanned_symbols?.toLocaleString() || "2,296"}
            </div>
            <div className="mt-0.5 text-[10px] text-slate-400">
              Session: {metadata?.latest_session_date || "Latest"}
            </div>
          </div>

          {/* Card 2: Qualifying Setups */}
          <div className="rounded-xl border border-slate-200/80 bg-white/60 p-3 shadow-sm dark:border-slate-800/80 dark:bg-[#0b1528]/60">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-xs font-medium">Active Radar Setups</span>
              <Target size={14} className="text-cyan-400" />
            </div>
            <div className="mt-1.5 text-lg font-bold text-cyan-500 dark:text-cyan-400">
              {metadata?.qualifying_setups_count || totalCount}
            </div>
            <div className="mt-0.5 text-[10px] text-cyan-500/70">
              {metadata?.confirmed_breakouts_count || 0} Breakouts | {metadata?.ema_pullback_count || 0} Retests
            </div>
          </div>

          {/* Card 3: Apex Win Rate */}
          <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-3 shadow-sm dark:border-purple-500/20 dark:bg-[#120f26]/60">
            <div className="flex items-center justify-between text-purple-300">
              <span className="text-xs font-medium">Apex Sniper WR</span>
              <Crosshair size={14} className="text-purple-400" />
            </div>
            <div className="mt-1.5 text-lg font-bold text-purple-300">
              {metadata?.backtest_proven_stats?.win_rate_apex || "68% - 72%"}
            </div>
            <div className="mt-0.5 text-[10px] text-purple-400/80">
              {metadata?.apex_sniper_count || 0} Ultra-Selective Setups
            </div>
          </div>

          {/* Card 4: Active Swing WR */}
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 shadow-sm dark:border-emerald-500/20 dark:bg-[#0c1e1e]/60">
            <div className="flex items-center justify-between text-emerald-300">
              <span className="text-xs font-medium">Active Swing WR</span>
              <Activity size={14} className="text-emerald-400" />
            </div>
            <div className="mt-1.5 text-lg font-bold text-emerald-400">
              {metadata?.backtest_proven_stats?.win_rate_swing || "60% - 62%"}
            </div>
            <div className="mt-0.5 text-[10px] text-emerald-500/80">
              {metadata?.active_swing_count || 0} Setups (~5-8 / week)
            </div>
          </div>

          {/* Card 5: BE Lock Efficiency */}
          <div className="rounded-xl border border-slate-200/80 bg-white/60 p-3 shadow-sm dark:border-slate-800/80 dark:bg-[#0b1528]/60">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-xs font-medium">BE Lock Saved</span>
              <ShieldCheck size={14} className="text-amber-400" />
            </div>
            <div className="mt-1.5 text-lg font-bold text-amber-500 dark:text-amber-400">
              51.4%
            </div>
            <div className="mt-0.5 text-[10px] text-amber-500/70">
              Losses Averted at +2.0%
            </div>
          </div>

          {/* Card 6: Profit Factor */}
          <div className="rounded-xl border border-slate-200/80 bg-white/60 p-3 shadow-sm dark:border-slate-800/80 dark:bg-[#0b1528]/60">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-xs font-medium">Model R:R</span>
              <Award size={14} className="text-indigo-400" />
            </div>
            <div className="mt-1.5 text-lg font-bold text-indigo-400">
              {metadata?.backtest_proven_stats?.profit_factor || 1.68} PF
            </div>
            <div className="mt-0.5 text-[10px] text-indigo-400/70">
              1:3.3 Apex / 1:3.1 Swing
            </div>
          </div>
        </div>

        {/* TIER SELECTION TABS */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            {
              id: "ALL",
              label: "All Radar Signals",
              count: metadata?.qualifying_setups_count ?? totalCount,
              badge: "Full Engine",
              activeClass: "border-cyan-500 bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/30",
              defaultClass: "border-slate-200 bg-white/80 text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400",
            },
            {
              id: "APEX_SNIPER",
              label: "🎯 Apex Sniper",
              count: metadata?.apex_sniper_count ?? 0,
              badge: "70%+ WR",
              activeClass: "border-purple-500 bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/40",
              defaultClass: "border-purple-500/20 bg-purple-500/5 text-purple-400/80 hover:bg-purple-500/10",
            },
            {
              id: "ACTIVE_SWING",
              label: "⚡ Active Swing",
              count: metadata?.active_swing_count ?? 0,
              badge: "62% WR",
              activeClass: "border-emerald-500 bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40",
              defaultClass: "border-emerald-500/20 bg-emerald-500/5 text-emerald-400/80 hover:bg-emerald-500/10",
            },
            {
              id: "BASE_ACCUMULATION",
              label: "📡 Base Watchlist",
              count: metadata?.base_accumulation_count ?? 0,
              badge: "Early Flow",
              activeClass: "border-amber-500 bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/40",
              defaultClass: "border-amber-500/20 bg-amber-500/5 text-amber-400/80 hover:bg-amber-500/10",
            },
          ].map((t) => {
            const isActive = selectedTier === t.id;
            return (
              <button
                key={t.id}
                onClick={() => {
                  setSelectedTier(t.id);
                  setPage(1);
                }}
                className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
                  isActive ? t.activeClass : t.defaultClass
                }`}
              >
                <span>{t.label}</span>
                <span className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-[10px]">
                  {t.badge}
                </span>
                <span className="rounded-full bg-slate-800/80 px-2 py-0.5 text-[11px] font-bold text-white">
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* FILTER TOOLBAR */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white/60 p-3 shadow-sm dark:border-slate-800 dark:bg-[#0b1528]/60">
          {/* Left: Search & Setup Type Toggles */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search symbol or name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8 w-44 sm:w-56 rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-900 placeholder-slate-400 focus:border-cyan-500 focus:outline-none dark:border-slate-700/80 dark:bg-slate-900 dark:text-white"
              />
            </div>

            {/* Setup Type Filter */}
            <div className="flex items-center rounded-lg border border-slate-200 bg-slate-100/80 p-0.5 text-xs dark:border-slate-700/80 dark:bg-slate-900/80">
              {[
                { label: "All Setups", val: "ALL" },
                { label: "50D Breakout", val: "50D_BREAKOUT" },
                { label: "20 EMA Retest", val: "EMA20_PULLBACK" },
                { label: "Near Base", val: "NEAR_PIVOT_BASE" },
              ].map((t) => (
                <button
                  key={t.val}
                  onClick={() => {
                    setSetupType(t.val);
                    setPage(1);
                  }}
                  className={`rounded-md px-2.5 py-1 font-medium transition ${
                    setupType === t.val
                      ? "bg-white text-slate-900 shadow-sm dark:bg-cyan-600 dark:text-white"
                      : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Lookback Filter */}
            <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
              <Clock size={13} />
              <span className="hidden sm:inline">Lookback:</span>
              <select
                value={lookbackSessions}
                onChange={(e) => {
                  setLookbackSessions(Number(e.target.value));
                  setPage(1);
                }}
                className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-900 dark:border-slate-700/80 dark:bg-slate-900 dark:text-white"
              >
                <option value={1}>Latest Session</option>
                <option value={3}>Last 3 Sessions</option>
                <option value={5}>Last 5 Sessions</option>
              </select>
            </div>
          </div>

          {/* Right: Threshold Sliders & Sorting */}
          <div className="flex items-center gap-2">
            {/* Min Spike Selector */}
            <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
              <span>Spike ≥</span>
              <select
                value={minSpike}
                onChange={(e) => {
                  setMinSpike(Number(e.target.value));
                  setPage(1);
                }}
                className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-900 dark:border-slate-700/80 dark:bg-slate-900 dark:text-white"
              >
                <option value={1.5}>1.5x</option>
                <option value={1.8}>1.8x</option>
                <option value={2.0}>2.0x</option>
                <option value={2.5}>2.5x</option>
              </select>
            </div>

            {/* Min Deliv % Selector */}
            <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
              <span>Deliv ≥</span>
              <select
                value={minDelivPer}
                onChange={(e) => {
                  setMinDelivPer(Number(e.target.value));
                  setPage(1);
                }}
                className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-900 dark:border-slate-700/80 dark:bg-slate-900 dark:text-white"
              >
                <option value={55}>55%</option>
                <option value={60}>60%</option>
                <option value={65}>65%</option>
                <option value={70}>70%</option>
              </select>
            </div>
          </div>
        </div>

        {/* OPPORTUNITIES TABLE */}
        <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-[#0b1528]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-400">
                <tr>
                  <th className="py-3 pl-4 pr-3">Equity / Symbol</th>
                  <th className="px-3 py-3">Tier & Setup Structure</th>
                  <th className="px-3 py-3 text-right">Price (₹)</th>
                  <th className="px-3 py-3 text-right">Day %</th>
                  <th className="px-3 py-3 text-center">Delivery %</th>
                  <th className="px-3 py-3 text-right">10D Spike</th>
                  <th className="px-3 py-3 text-right">20D Flow (D-A/D)</th>
                  <th className="px-3 py-3 text-right">Dry-up</th>
                  <th className="px-3 py-3 text-center">RSI (14)</th>
                  <th className="px-3 py-3 text-center">Conviction Score</th>
                  <th className="py-3 pl-3 pr-4 text-center">Execution Blueprint</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="h-6 w-6 animate-spin text-cyan-500" />
                        <span>Analyzing delivery accumulation and net institutional flow...</span>
                      </div>
                    </td>
                  </tr>
                ) : opportunities.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Target className="h-8 w-8 text-slate-400" />
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          No Qualifying Setups for Selected Tier & Thresholds
                        </span>
                        <span className="text-xs text-slate-400">
                          Try switching to &apos;All Radar Signals&apos; or changing Lookback to &apos;Last 3 Sessions&apos;.
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  opportunities.map((item) => {
                    const isApex = item.conviction_tier === "APEX_SNIPER";
                    const isSwing = item.conviction_tier === "ACTIVE_SWING";
                    const isBreakout = item.setup_type === "50D_BREAKOUT";
                    const isRetest = item.setup_type === "EMA20_PULLBACK";

                    return (
                      <tr
                        key={`${item.symbol}-${item.signal_date}`}
                        className="transition hover:bg-slate-50/80 dark:hover:bg-slate-800/30"
                      >
                        {/* 1. Symbol & Company */}
                        <td className="py-3 pl-4 pr-3">
                          <div className="flex items-center gap-1.5">
                            <a
                              href={`https://in.tradingview.com/chart/?symbol=NSE:${encodeURIComponent(item.symbol.replace(/\.NS$|\.BO$/i, "").trim())}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group flex items-center gap-1 font-bold text-slate-900 transition hover:text-cyan-500 dark:text-white dark:hover:text-cyan-400"
                              title={`Open ${item.symbol} interactive chart on TradingView`}
                            >
                              <span>{item.symbol}</span>
                              <ExternalLink size={10} className="text-cyan-400 opacity-60 transition group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                            </a>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                            <a
                              href={`https://in.tradingview.com/chart/?symbol=NSE:${encodeURIComponent(item.symbol.replace(/\.NS$|\.BO$/i, "").trim())}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="max-w-[140px] truncate text-[11px] text-slate-500 hover:text-cyan-600 dark:text-slate-400 dark:hover:text-cyan-300 transition hover:underline"
                              title={`Open ${item.company_name} chart on TradingView`}
                            >
                              {item.company_name}
                            </a>
                            <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 font-mono text-[9px] font-medium text-slate-500 dark:text-slate-400">
                              {item.signal_date}
                            </span>
                          </div>
                        </td>

                        {/* 2. Tier & Setup Badge */}
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap items-center gap-1">
                            {isApex ? (
                              <span className="inline-flex items-center gap-1 rounded-md border border-purple-500/40 bg-purple-500/15 px-1.5 py-0.5 text-[10px] font-bold text-purple-300">
                                🎯 Apex Sniper
                              </span>
                            ) : isSwing ? (
                              <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                                ⚡ Active Swing
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                                📡 Base Watchlist
                              </span>
                            )}

                            {isBreakout ? (
                              <span className="inline-flex items-center gap-1 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-400">
                                <Sparkles size={9} /> Breakout
                              </span>
                            ) : isRetest ? (
                              <span className="inline-flex items-center gap-1 rounded-md border border-indigo-500/30 bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-400">
                                <Target size={9} /> 20 EMA Retest
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-slate-300">
                                Near Base ({item.pivot_distance_pct}%)
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 text-[10px] text-slate-400">
                            Dist to 20 EMA: {item.dist_to_ema20_pct > 0 ? `+${item.dist_to_ema20_pct}%` : `${item.dist_to_ema20_pct}%`}
                          </div>
                        </td>

                        {/* 3. Price */}
                        <td className="px-3 py-3 text-right font-medium text-slate-900 dark:text-white">
                          ₹{item.current_price.toLocaleString("en-IN")}
                        </td>

                        {/* 4. Day Change % */}
                        <td className="px-3 py-3 text-right">
                          <span
                            className={`font-semibold ${
                              item.day_change_pct >= 0
                                ? "text-emerald-500 dark:text-emerald-400"
                                : "text-rose-500"
                            }`}
                          >
                            {item.day_change_pct >= 0 ? "+" : ""}
                            {item.day_change_pct}%
                          </span>
                        </td>

                        {/* 5. Delivery % */}
                        <td className="px-3 py-3 text-center">
                          <div className="font-bold text-slate-900 dark:text-white">
                            {item.delivery_per}%
                          </div>
                          <div className="mx-auto mt-1 h-1.5 w-16 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{ width: `${Math.min(100, item.delivery_per)}%` }}
                            />
                          </div>
                        </td>

                        {/* 6. Volume Spike */}
                        <td className="px-3 py-3 text-right">
                          <span className="rounded bg-indigo-500/10 px-1.5 py-0.5 font-bold text-indigo-500 dark:text-indigo-400">
                            {item.delivery_spike_x}x
                          </span>
                        </td>

                        {/* 7. 20D D-A/D Accumulation Flow */}
                        <td className="px-3 py-3 text-right">
                          <div className="inline-flex items-center gap-1 font-mono font-bold">
                            <span
                              className={`rounded px-1.5 py-0.5 text-xs ${
                                (item.deliv_flow_20d || 1.0) >= 2.0
                                  ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40"
                                  : (item.deliv_flow_20d || 1.0) >= 1.25
                                  ? "bg-cyan-500/20 text-cyan-400"
                                  : "bg-slate-800 text-slate-400"
                              }`}
                            >
                              {item.deliv_flow_20d ? `${item.deliv_flow_20d}x` : "1.0x"}
                            </span>
                          </div>
                          <div className="text-[9px] text-slate-400">
                            {(item.deliv_flow_20d || 1.0) >= 1.4 ? "Net Inflow" : "Neutral"}
                          </div>
                        </td>

                        {/* 8. Dry-Up Ratio */}
                        <td className="px-3 py-3 text-right font-mono">
                          <span
                            className={`rounded px-1.5 py-0.5 ${
                              item.vol_dryup_ratio <= 1.0
                                ? "bg-emerald-500/10 font-bold text-emerald-400"
                                : "text-slate-400"
                            }`}
                          >
                            {item.vol_dryup_ratio}
                          </span>
                        </td>

                        {/* 9. RSI (14) */}
                        <td className="px-3 py-3 text-center font-mono">
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            {item.rsi_14}
                          </span>
                        </td>

                        {/* 10. Conviction Score */}
                        <td className="px-3 py-3 text-center">
                          <span
                            className={`inline-flex items-center justify-center rounded-lg px-2 py-1 text-xs font-bold ${
                              item.conviction_score >= 80
                                ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40"
                                : item.conviction_score >= 70
                                ? "bg-cyan-500/20 text-cyan-400 ring-1 ring-cyan-500/40"
                                : "bg-slate-800 text-slate-300"
                            }`}
                          >
                            {item.conviction_score}
                          </span>
                        </td>

                        {/* 11. Blueprint Action Button */}
                        <td className="py-3 pl-3 pr-4 text-center">
                          <button
                            onClick={() => setSelectedBlueprint(item)}
                            className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1.5 text-xs font-semibold text-cyan-400 transition hover:bg-cyan-500 hover:text-white"
                          >
                            <Zap size={12} />
                            <span>Trade Plan</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* TRADE BLUEPRINT MODAL / DRAWER */}
        {selectedBlueprint && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-[#0a1426]">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-slate-200 pb-4 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <a
                      href={`https://in.tradingview.com/chart/?symbol=NSE:${encodeURIComponent(selectedBlueprint.symbol.replace(/\.NS$|\.BO$/i, "").trim())}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-1.5 text-xl font-bold text-slate-900 transition hover:text-cyan-500 dark:text-white dark:hover:text-cyan-400"
                      title="Open interactive chart on TradingView"
                    >
                      <span>{selectedBlueprint.symbol}</span>
                      <ExternalLink size={14} className="text-cyan-400 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                    </a>
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-semibold ${
                        selectedBlueprint.conviction_tier === "APEX_SNIPER"
                          ? "bg-purple-500/20 text-purple-300"
                          : selectedBlueprint.conviction_tier === "ACTIVE_SWING"
                          ? "bg-emerald-500/20 text-emerald-300"
                          : "bg-amber-500/20 text-amber-300"
                      }`}
                    >
                      {selectedBlueprint.conviction_tier}
                    </span>
                    <span className="rounded bg-cyan-500/10 px-2 py-0.5 text-xs font-semibold text-cyan-400">
                      {selectedBlueprint.setup_type}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    <a
                      href={`https://in.tradingview.com/chart/?symbol=NSE:${encodeURIComponent(selectedBlueprint.symbol.replace(/\.NS$|\.BO$/i, "").trim())}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-cyan-400 hover:underline transition"
                      title="Open chart on TradingView"
                    >
                      {selectedBlueprint.company_name}
                    </a>
                    {" | "}Expected Win Rate:{" "}
                    <strong className="text-emerald-400">
                      {selectedBlueprint.blueprint.win_rate_expectation || "60% - 63%"}
                    </strong>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedBlueprint(null)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-white"
                >
                  ✕
                </button>
              </div>

              {/* Blueprint Details */}
              <div className="mt-4 space-y-4">
                {/* 4-Phase Targets Grid with Breakeven Protection */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-center">
                  {/* 1. Stop Loss */}
                  <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-2.5">
                    <div className="text-[10px] font-bold uppercase text-rose-400">
                      Stop Loss (-{selectedBlueprint.blueprint.risk_pct}%)
                    </div>
                    <div className="mt-1 text-base font-extrabold text-rose-500">
                      ₹{selectedBlueprint.blueprint.stop_loss}
                    </div>
                    <div className="mt-0.5 text-[9px] text-rose-400/80">Hard Initial Stop</div>
                  </div>

                  {/* 2. Breakeven Trigger (51% Loss Reducer) */}
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5">
                    <div className="text-[10px] font-bold uppercase text-amber-400">
                      BE Trigger (+2.0%)
                    </div>
                    <div className="mt-1 text-base font-extrabold text-amber-300">
                      ₹{selectedBlueprint.blueprint.breakeven_trigger}
                    </div>
                    <div className="mt-0.5 text-[9px] text-amber-400/80">Locks Stop to +0.4%</div>
                  </div>

                  {/* 3. Target 1 */}
                  <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-2.5">
                    <div className="text-[10px] font-bold uppercase text-cyan-400">
                      Target 1 (+5.0%)
                    </div>
                    <div className="mt-1 text-base font-extrabold text-cyan-400">
                      ₹{selectedBlueprint.blueprint.target_1}
                    </div>
                    <div className="mt-0.5 text-[9px] text-cyan-400/80">Book 50% Profit</div>
                  </div>

                  {/* 4. Target 2 */}
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-2.5">
                    <div className="text-[10px] font-bold uppercase text-emerald-400">
                      Target 2 (+10.0%)
                    </div>
                    <div className="mt-1 text-base font-extrabold text-emerald-400">
                      ₹{selectedBlueprint.blueprint.target_2}
                    </div>
                    <div className="mt-0.5 text-[9px] text-emerald-400/80">Apex Runner</div>
                  </div>
                </div>

                {/* Parameters Breakdown */}
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 text-xs dark:border-slate-800 dark:bg-slate-900/60">
                  <div className="grid grid-cols-2 gap-y-2 text-slate-600 dark:text-slate-300">
                    <div>
                      <span className="text-slate-400">Suggested Entry:</span>{" "}
                      <span className="font-semibold text-slate-900 dark:text-white">
                        ₹{selectedBlueprint.blueprint.entry_price} (CMP)
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Risk:Reward:</span>{" "}
                      <span className="font-bold text-emerald-400">
                        {selectedBlueprint.blueprint.rr_ratio}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Slot Allocation:</span>{" "}
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {selectedBlueprint.blueprint.recommended_slot_allocation}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Holding Horizon:</span>{" "}
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {selectedBlueprint.blueprint.holding_horizon}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">20D D-A/D Flow:</span>{" "}
                      <span className="font-mono font-bold text-cyan-400">
                        {selectedBlueprint.deliv_flow_20d ? `${selectedBlueprint.deliv_flow_20d}x Net Inflow` : "1.0x"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Distance to 20 EMA:</span>{" "}
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {selectedBlueprint.dist_to_ema20_pct > 0 ? `+${selectedBlueprint.dist_to_ema20_pct}%` : `${selectedBlueprint.dist_to_ema20_pct}%`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Execution Trail Rules */}
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300/90">
                  <div className="flex items-center gap-1.5 font-bold text-amber-400">
                    <Info size={14} />
                    <span>Breakeven Locking & Scaling Protocol</span>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed">
                    {selectedBlueprint.blueprint.trail_rule}
                  </p>
                </div>

                {/* Close Button */}
                <button
                  onClick={() => setSelectedBlueprint(null)}
                  className="w-full rounded-xl bg-slate-900 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700"
                >
                  Close Plan
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

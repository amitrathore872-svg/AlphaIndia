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
import AddToWatchlistButton from "@/components/watchlist/AddToWatchlistButton";
import PageHeader from "@/components/common/PageHeader";
import KpiCard from "@/components/common/KpiCard";
import EmptyState from "@/components/common/EmptyState";
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
        <PageHeader
          eyebrow="INSTITUTIONAL RADAR"
          icon={<Flame className="w-5 h-5" />}
          iconColor="emerald"
          title="Delivery Breakout Radar"
          badge={{ label: "INSTITUTIONAL APEX: 78% WIN RATE • MCAP ≥ ₹1,000 CR", color: "purple" }}
          subtitle="Institutional float absorption engine with ticket size expansion, pre-breakout contraction, and dynamic buy/sell corridors (Price ≥ ₹40, MCap ≥ ₹1,000 Cr)."
          actions={
            <button
              onClick={handleTriggerScan}
              disabled={scanning}
              className="flex items-center gap-2 rounded-lg bg-cyan-600 px-3.5 py-2 text-xs font-semibold text-white shadow-lg shadow-cyan-600/20 transition hover:bg-cyan-500 active:scale-95 disabled:opacity-50"
            >
              <RefreshCw size={14} className={scanning ? "animate-spin" : ""} />
              <span>{scanning ? "Scanning 1,400+ Quality Equities..." : "Run Live Scan"}</span>
            </button>
          }
        />

        {/* TELEMETRY RIBBON */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <KpiCard
            label="Equities Filtered"
            value={metadata?.total_scanned_symbols?.toLocaleString() || "1,473"}
            sub="MCap ≥ ₹1k Cr | Price ≥ ₹40"
            icon={<Layers className="w-4 h-4 text-slate-400" />}
          />
          <KpiCard
            label="Active Radar Setups"
            value={metadata?.qualifying_setups_count || totalCount}
            sub={`${metadata?.confirmed_breakouts_count || 0} Breakouts | ${metadata?.near_pivot_count || 0} Coiling`}
            color="cyan"
            icon={<Target className="w-4 h-4 text-cyan-400" />}
          />
          <KpiCard
            label="Apex Sniper WR"
            value={metadata?.backtest_proven_stats?.win_rate_apex || "75% - 78%"}
            sub="PF 2.40 (525 Sessions Proven)"
            color="purple"
            icon={<Crosshair className="w-4 h-4 text-purple-400" />}
          />
          <KpiCard
            label="Active Swing WR"
            value={metadata?.backtest_proven_stats?.win_rate_swing || "65% - 70%"}
            sub={`${metadata?.active_swing_count || 0} Core Swing Opportunities`}
            color="emerald"
            icon={<Activity className="w-4 h-4 text-emerald-400" />}
          />
          <KpiCard
            label="BE Shield Saved"
            value="32.7%"
            sub="Losses Averted at +1.8%"
            color="amber"
            icon={<ShieldCheck className="w-4 h-4 text-amber-400" />}
          />
          <KpiCard
            label="Model R:R"
            value={`${metadata?.backtest_proven_stats?.profit_factor || 2.40} PF`}
            sub={metadata?.backtest_proven_stats?.risk_reward || "1:3.0 Apex / 1:3.2 Swing"}
            color="indigo"
            icon={<Award className="w-4 h-4 text-indigo-400" />}
          />
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
                className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-800 dark:border-slate-700/80 dark:bg-slate-900 dark:text-white cursor-pointer shadow-xs focus:outline-hidden focus:border-cyan-500"
              >
                <option value={1} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">Latest Session</option>
                <option value={3} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">Last 3 Sessions</option>
                <option value={5} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">Last 5 Sessions</option>
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
                className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-800 dark:border-slate-700/80 dark:bg-slate-900 dark:text-white cursor-pointer shadow-xs focus:outline-hidden focus:border-cyan-500"
              >
                <option value={1.5} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">1.5x</option>
                <option value={1.8} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">1.8x</option>
                <option value={2.0} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">2.0x</option>
                <option value={2.5} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">2.5x</option>
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
                className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-800 dark:border-slate-700/80 dark:bg-slate-900 dark:text-white cursor-pointer shadow-xs focus:outline-hidden focus:border-cyan-500"
              >
                <option value={55} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">55%</option>
                <option value={60} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">60%</option>
                <option value={65} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">65%</option>
                <option value={70} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">70%</option>
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
                  <th className="py-3 pl-4 pr-3">Equity & MCap</th>
                  <th className="px-3 py-3">Tier & Setup</th>
                  <th className="px-3 py-3 text-right">CMP & Buy Status</th>
                  <th className="px-3 py-3 text-right">Day %</th>
                  <th className="px-3 py-3 text-center">Delivery %</th>
                  <th className="px-3 py-3 text-right">10D Spike</th>
                  <th className="px-3 py-3 text-right">Order Ticket</th>
                  <th className="px-3 py-3 text-right">20D Flow</th>
                  <th className="px-3 py-3 text-right">Base Squeeze</th>
                  <th className="px-3 py-3 text-center">Conviction</th>
                  <th className="py-3 pl-3 pr-4 text-center">Execution Blueprint</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="h-6 w-6 animate-spin text-cyan-500" />
                        <span>Scanning institutional delivery footprints & float absorption...</span>
                      </div>
                    </td>
                  </tr>
                ) : opportunities.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="p-8">
                      <EmptyState
                        icon={<Target className="h-7 w-7 text-cyan-400" />}
                        title="No Qualifying Setups for Selected Tier & Thresholds"
                        description="Try switching to 'All Radar Signals' or changing Lookback to 'Last 3 Sessions'."
                        action={
                          <button
                            onClick={() => {
                              setSelectedTier("ALL");
                              setLookbackSessions(3);
                            }}
                            className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20"
                          >
                            Reset Tier & Lookback
                          </button>
                        }
                      />
                    </td>
                  </tr>
                ) : (
                  opportunities.map((item) => {
                    const isApex = item.conviction_tier === "APEX_SNIPER";
                    const isSwing = item.conviction_tier === "ACTIVE_SWING";
                    const isBreakout = item.setup_type === "50D_BREAKOUT";
                    const isRetest = item.setup_type === "EMA20_PULLBACK";
                    const buyStatus = item.blueprint?.buy_status || "ACCUMULATION_BASE";

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
                            {item.market_cap_cr && (
                              <span className="rounded bg-indigo-500/10 px-1 py-0.2 font-mono text-[9px] font-bold text-indigo-400">
                                ₹{item.market_cap_cr.toLocaleString("en-IN")} Cr
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                            <a
                              href={`https://in.tradingview.com/chart/?symbol=NSE:${encodeURIComponent(item.symbol.replace(/\.NS$|\.BO$/i, "").trim())}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="max-w-[130px] truncate text-[11px] text-slate-500 hover:text-cyan-600 dark:text-slate-400 dark:hover:text-cyan-300 transition hover:underline"
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
                                🎯 Apex (78% WR)
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

                        {/* 3. Price & Buy Zone Status */}
                        <td className="px-3 py-3 text-right">
                          <div className="font-bold text-slate-900 dark:text-white">
                            ₹{item.current_price.toLocaleString("en-IN")}
                          </div>
                          <div className="mt-0.5">
                            {buyStatus === "IN_BUY_ZONE" ? (
                              <span className="inline-flex rounded bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.2 text-[9px] font-extrabold text-emerald-400">
                                🟢 In Buy Zone
                              </span>
                            ) : buyStatus === "EXTENDED_WAIT_DIP" ? (
                              <span className="inline-flex rounded bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.2 text-[9px] font-bold text-amber-400" title="Extended above pivot. Wait for dip to buy corridor.">
                                🟡 Extended: Wait Dip
                              </span>
                            ) : buyStatus === "RETEST_CONFIRMED" ? (
                              <span className="inline-flex rounded bg-cyan-500/15 border border-cyan-500/30 px-1.5 py-0.2 text-[9px] font-bold text-cyan-400">
                                🔵 Retest Bounced
                              </span>
                            ) : (
                              <span className="inline-flex rounded bg-slate-800 px-1.5 py-0.2 text-[9px] font-medium text-slate-400">
                                Base Accumulation
                              </span>
                            )}
                          </div>
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

                        {/* 7. Institutional Ticket Size Spike */}
                        <td className="px-3 py-3 text-right font-mono">
                          <span
                            className={`rounded px-1.5 py-0.5 font-bold ${
                              (item.ticket_spike_x || 1.0) >= 1.25
                                ? "bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/30"
                                : "text-slate-400"
                            }`}
                          >
                            {item.ticket_spike_x ? `${item.ticket_spike_x}x` : "1.0x"}
                          </span>
                          <div className="text-[9px] text-slate-400">Ticket Size</div>
                        </td>

                        {/* 8. 20D D-A/D Accumulation Flow */}
                        <td className="px-3 py-3 text-right">
                          <div className="inline-flex items-center gap-1 font-mono font-bold">
                            <span
                              className={`rounded px-1.5 py-0.5 text-xs ${
                                (item.deliv_flow_20d || 1.0) >= 2.0
                                  ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40"
                                  : (item.deliv_flow_20d || 1.0) >= 1.35
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

                        {/* 9. Pre-Breakout Base Squeeze */}
                        <td className="px-3 py-3 text-right font-mono">
                          <span
                            className={`rounded px-1.5 py-0.5 ${
                              (item.range_contraction_ratio || 1.0) <= 0.88
                                ? "bg-emerald-500/15 font-bold text-emerald-400"
                                : "text-slate-400"
                            }`}
                          >
                            {item.range_contraction_ratio ? `${item.range_contraction_ratio}x` : "1.0x"}
                          </span>
                          <div className="text-[9px] text-slate-400">5D/20D Squeeze</div>
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

                        {/* 11. Blueprint & Watchlist Actions */}
                        <td className="py-3 pl-3 pr-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <AddToWatchlistButton
                              symbol={item.symbol}
                              companyName={item.company_name}
                              currentPrice={item.current_price}
                              variant="star"
                            />
                            <button
                              onClick={() => setSelectedBlueprint(item)}
                              className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1.5 text-xs font-semibold text-cyan-400 transition hover:bg-cyan-500 hover:text-white"
                            >
                              <Zap size={12} />
                              <span>Trade Plan</span>
                            </button>
                          </div>
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
                          ? "bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/30"
                          : selectedBlueprint.conviction_tier === "ACTIVE_SWING"
                          ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30"
                          : "bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/30"
                      }`}
                    >
                      {selectedBlueprint.conviction_tier}
                    </span>
                    <span className="rounded bg-cyan-500/10 px-2 py-0.5 text-xs font-semibold text-cyan-400">
                      {selectedBlueprint.setup_type}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedBlueprint.company_name}</span>
                    {selectedBlueprint.market_cap_cr && (
                      <span className="rounded bg-indigo-500/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-indigo-400">
                        MCap: ₹{selectedBlueprint.market_cap_cr.toLocaleString("en-IN")} Cr
                      </span>
                    )}
                    <span>•</span>
                    <span>Win Rate Expectation:{" "}
                      <strong className="text-emerald-400">
                        {selectedBlueprint.blueprint.win_rate_expectation || "75% - 78% (Apex)"}
                      </strong>
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <AddToWatchlistButton
                    symbol={selectedBlueprint.symbol}
                    companyName={selectedBlueprint.company_name}
                    currentPrice={selectedBlueprint.current_price || selectedBlueprint.blueprint.entry_price}
                    variant="button"
                  />
                  <button
                    onClick={() => setSelectedBlueprint(null)}
                    className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-white"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Blueprint Details */}
              <div className="mt-4 space-y-4">
                {/* ZONE 1: BUY CORRIDOR & CHASE CEILING */}
                <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold uppercase tracking-wider text-cyan-400">Zone 1: Accumulation Corridor</span>
                    <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                      selectedBlueprint.blueprint.buy_status === "IN_BUY_ZONE"
                        ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40"
                        : selectedBlueprint.blueprint.buy_status === "EXTENDED_WAIT_DIP"
                        ? "bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40"
                        : "bg-cyan-500/20 text-cyan-300"
                    }`}>
                      {selectedBlueprint.blueprint.buy_status === "IN_BUY_ZONE"
                        ? "🟢 In Optimal Buy Zone"
                        : selectedBlueprint.blueprint.buy_status === "EXTENDED_WAIT_DIP"
                        ? "🟡 Extended: Limit Order on Dip"
                        : selectedBlueprint.blueprint.buy_status === "RETEST_CONFIRMED"
                        ? "🔵 Retest Support Held"
                        : "⚪ Base Accumulation"}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-black/30 p-2">
                      <div className="text-[10px] text-slate-400">Pivot Level</div>
                      <div className="font-mono text-sm font-bold text-white">₹{selectedBlueprint.blueprint.pivot_price || selectedBlueprint.blueprint.entry_price}</div>
                    </div>
                    <div className="rounded-lg bg-black/30 p-2">
                      <div className="text-[10px] text-slate-400">Ideal Buy Corridor</div>
                      <div className="font-mono text-sm font-bold text-emerald-400">
                        ₹{selectedBlueprint.blueprint.buy_corridor_min || selectedBlueprint.blueprint.entry_price} – ₹{selectedBlueprint.blueprint.buy_corridor_max || selectedBlueprint.blueprint.entry_price}
                      </div>
                    </div>
                    <div className="rounded-lg bg-black/30 p-2">
                      <div className="text-[10px] text-slate-400">Do Not Chase Above</div>
                      <div className="font-mono text-sm font-bold text-amber-400">₹{selectedBlueprint.blueprint.max_chase_price || selectedBlueprint.blueprint.entry_price}</div>
                    </div>
                  </div>
                </div>

                {/* ZONE 2 & 3: 4-PHASE TARGETS & DEFENSE GRID */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 text-center">
                  {/* Stop Loss (Structural Candle Low) */}
                  <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-2.5">
                    <div className="text-[10px] font-bold uppercase text-rose-400">
                      Stop Loss (-{selectedBlueprint.blueprint.risk_pct}%)
                    </div>
                    <div className="mt-1 text-base font-extrabold text-rose-500">
                      ₹{selectedBlueprint.blueprint.stop_loss}
                    </div>
                    <div className="mt-0.5 text-[9px] text-rose-400/80">Candle Low Defense</div>
                  </div>

                  {/* Breakeven Trigger (+1.8%) */}
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5">
                    <div className="text-[10px] font-bold uppercase text-amber-400">
                      BE Shield (+1.8%)
                    </div>
                    <div className="mt-1 text-base font-extrabold text-amber-300">
                      ₹{selectedBlueprint.blueprint.breakeven_trigger}
                    </div>
                    <div className="mt-0.5 text-[9px] text-amber-400/80">Lock Stop to Entry+0.4%</div>
                  </div>

                  {/* Target 1 (+4.2%) */}
                  <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-2.5">
                    <div className="text-[10px] font-bold uppercase text-cyan-400">
                      Target 1 (+4.2%)
                    </div>
                    <div className="mt-1 text-base font-extrabold text-cyan-400">
                      ₹{selectedBlueprint.blueprint.target_1}
                    </div>
                    <div className="mt-0.5 text-[9px] text-cyan-400/80">Book 50% Profit</div>
                  </div>

                  {/* Target 2 (+8.5%) */}
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-2.5">
                    <div className="text-[10px] font-bold uppercase text-emerald-400">
                      Target 2 (+8.5%)
                    </div>
                    <div className="mt-1 text-base font-extrabold text-emerald-400">
                      ₹{selectedBlueprint.blueprint.target_2}
                    </div>
                    <div className="mt-0.5 text-[9px] text-emerald-400/80">10 EMA Trailing Runner</div>
                  </div>
                </div>

                {/* Parameters Breakdown */}
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 text-xs dark:border-slate-800 dark:bg-slate-900/60">
                  <div className="grid grid-cols-2 gap-y-2 text-slate-600 dark:text-slate-300">
                    <div>
                      <span className="text-slate-400">Current CMP:</span>{" "}
                      <span className="font-semibold text-slate-900 dark:text-white">
                        ₹{selectedBlueprint.blueprint.entry_price}
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
                      <span className="text-slate-400">Order Ticket Expansion:</span>{" "}
                      <span className="font-mono font-bold text-purple-400">
                        {selectedBlueprint.ticket_spike_x ? `${selectedBlueprint.ticket_spike_x}x 20D Mean` : "1.0x"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Pre-Breakout Squeeze:</span>{" "}
                      <span className="font-mono font-bold text-cyan-400">
                        {selectedBlueprint.range_contraction_ratio ? `${selectedBlueprint.range_contraction_ratio}x 5D/20D` : "1.0x"}
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
                    <span>Breakeven Locking & 10 EMA Trailing Protocol</span>
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

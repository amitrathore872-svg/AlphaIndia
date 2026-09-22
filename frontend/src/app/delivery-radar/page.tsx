"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  ShieldCheck,
  TrendingUp,
  RefreshCw,
  Search,
  Sparkles,
  Award,
  Filter,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Target,
  Flame,
  ArrowUpDown,
  SlidersHorizontal,
  Compass,
  Zap,
  Info,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Clock,
  BarChart3,
  Percent,
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
  const [lookbackSessions, setLookbackSessions] = useState<number>(1);
  const [setupType, setSetupType] = useState<string>("ALL");
  const [minSpike, setMinSpike] = useState<number>(2.5);
  const [minDelivPer, setMinDelivPer] = useState<number>(65.0);
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
  }, [lookbackSessions, minSpike, minDelivPer, searchTerm, setupType, sortBy, sortOrder, page]);

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
              <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400">
                PROVEN 1.53 PF
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Institutional Equities undergoing 50-Day Breakouts & Heavy Delivery Accumulation (3.5:1 Risk:Reward Blueprint).
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
              <span>{scanning ? "Scanning 2,280+ Equities..." : "Run Live Scan"}</span>
            </button>
          </div>
        </div>

        {/* TELEMETRY RIBBON */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {/* Card 1: Total Scanned */}
          <div className="rounded-xl border border-slate-200/80 bg-white/60 p-3 shadow-sm dark:border-slate-800/80 dark:bg-[#0b1528]/60">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-xs font-medium">Equities Scanned</span>
              <Compass size={14} className="text-slate-400" />
            </div>
            <div className="mt-1.5 text-lg font-bold text-slate-900 dark:text-white">
              {metadata?.total_scanned_symbols?.toLocaleString() || "2,285"}
            </div>
            <div className="mt-0.5 text-[10px] text-slate-400">
              Session: {metadata?.latest_session_date || "Latest"}
            </div>
          </div>

          {/* Card 2: Qualifying Setups */}
          <div className="rounded-xl border border-slate-200/80 bg-white/60 p-3 shadow-sm dark:border-slate-800/80 dark:bg-[#0b1528]/60">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-xs font-medium">Active Setups</span>
              <Target size={14} className="text-cyan-400" />
            </div>
            <div className="mt-1.5 text-lg font-bold text-cyan-500 dark:text-cyan-400">
              {metadata?.qualifying_setups_count || opportunities.length}
            </div>
            <div className="mt-0.5 text-[10px] text-cyan-500/70">
              {metadata?.confirmed_breakouts_count || 0} Confirmed Breakouts
            </div>
          </div>

          {/* Card 3: Backtested Profit Factor */}
          <div className="rounded-xl border border-slate-200/80 bg-white/60 p-3 shadow-sm dark:border-slate-800/80 dark:bg-[#0b1528]/60">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-xs font-medium">Profit Factor</span>
              <Award size={14} className="text-emerald-400" />
            </div>
            <div className="mt-1.5 text-lg font-bold text-emerald-500 dark:text-emerald-400">
              {metadata?.backtest_proven_stats?.profit_factor || 1.53}
            </div>
            <div className="mt-0.5 text-[10px] text-emerald-500/70">
              Across 517 Sessions
            </div>
          </div>

          {/* Card 4: 2Y CAGR */}
          <div className="rounded-xl border border-slate-200/80 bg-white/60 p-3 shadow-sm dark:border-slate-800/80 dark:bg-[#0b1528]/60">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-xs font-medium">Net CAGR (2Y)</span>
              <TrendingUp size={14} className="text-emerald-400" />
            </div>
            <div className="mt-1.5 text-lg font-bold text-emerald-500 dark:text-emerald-400">
              +{metadata?.backtest_proven_stats?.cagr_2y || 13.47}%
            </div>
            <div className="mt-0.5 text-[10px] text-emerald-500/70">
              Net of Friction (0.15%)
            </div>
          </div>

          {/* Card 5: Max Drawdown */}
          <div className="rounded-xl border border-slate-200/80 bg-white/60 p-3 shadow-sm dark:border-slate-800/80 dark:bg-[#0b1528]/60">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-xs font-medium">Max Drawdown</span>
              <ShieldCheck size={14} className="text-amber-400" />
            </div>
            <div className="mt-1.5 text-lg font-bold text-amber-500 dark:text-amber-400">
              {metadata?.backtest_proven_stats?.max_drawdown || -8.44}%
            </div>
            <div className="mt-0.5 text-[10px] text-amber-500/70">
              Controlled Volatility
            </div>
          </div>

          {/* Card 6: Risk:Reward */}
          <div className="rounded-xl border border-slate-200/80 bg-white/60 p-3 shadow-sm dark:border-slate-800/80 dark:bg-[#0b1528]/60">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-xs font-medium">Model R:R</span>
              <Zap size={14} className="text-indigo-400" />
            </div>
            <div className="mt-1.5 text-lg font-bold text-indigo-400">
              {metadata?.backtest_proven_stats?.risk_reward || "3.5 : 1"}
            </div>
            <div className="mt-0.5 text-[10px] text-indigo-400/70">
              -4% Stop / +14% Tgt
            </div>
          </div>
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
                { label: "Near Pivot Base", val: "NEAR_PIVOT_BASE" },
              ].map((t) => (
                <button
                  key={t.val}
                  onClick={() => setSetupType(t.val)}
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
                onChange={(e) => setLookbackSessions(Number(e.target.value))}
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
                onChange={(e) => setMinSpike(Number(e.target.value))}
                className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-900 dark:border-slate-700/80 dark:bg-slate-900 dark:text-white"
              >
                <option value={2.0}>2.0x</option>
                <option value={2.5}>2.5x</option>
                <option value={3.0}>3.0x</option>
                <option value={4.0}>4.0x</option>
              </select>
            </div>

            {/* Min Deliv % Selector */}
            <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
              <span>Deliv ≥</span>
              <select
                value={minDelivPer}
                onChange={(e) => setMinDelivPer(Number(e.target.value))}
                className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-900 dark:border-slate-700/80 dark:bg-slate-900 dark:text-white"
              >
                <option value={60}>60%</option>
                <option value={65}>65%</option>
                <option value={70}>70%</option>
                <option value={75}>75%</option>
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
                  <th className="px-3 py-3">Setup Structure</th>
                  <th className="px-3 py-3 text-right">Price (₹)</th>
                  <th className="px-3 py-3 text-right">Day %</th>
                  <th className="px-3 py-3 text-center">Delivery %</th>
                  <th className="px-3 py-3 text-right">Vol Spike</th>
                  <th className="px-3 py-3 text-right">Dry-up Ratio</th>
                  <th className="px-3 py-3 text-center">RSI (14)</th>
                  <th className="px-3 py-3 text-center">Conviction Score</th>
                  <th className="py-3 pl-3 pr-4 text-center">Execution Blueprint</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="h-6 w-6 animate-spin text-cyan-500" />
                        <span>Analyzing delivery accumulation across universe...</span>
                      </div>
                    </td>
                  </tr>
                ) : opportunities.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Target className="h-8 w-8 text-slate-400" />
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          No Qualifying Setups for Current Thresholds
                        </span>
                        <span className="text-xs text-slate-400">
                          Try lowering Min Spike (e.g. 2.0x) or switching Lookback to &apos;Last 3 Sessions&apos;.
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  opportunities.map((item) => {
                    const isBreakout = item.setup_type === "50D_BREAKOUT";
                    return (
                      <tr
                        key={item.symbol}
                        className="transition hover:bg-slate-50/80 dark:hover:bg-slate-800/30"
                      >
                        {/* 1. Symbol & Company */}
                        <td className="py-3 pl-4 pr-3">
                          <div className="font-bold text-slate-900 dark:text-white">
                            {item.symbol}
                          </div>
                          <div className="max-w-[180px] truncate text-[11px] text-slate-500 dark:text-slate-400">
                            {item.company_name}
                          </div>
                        </td>

                        {/* 2. Setup Badge */}
                        <td className="px-3 py-3">
                          {isBreakout ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                              <Sparkles size={10} /> 50D Breakout
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-400">
                              <Target size={10} /> Near Base ({item.pivot_distance_pct}%)
                            </span>
                          )}
                          <div className="mt-0.5 text-[10px] text-slate-400">
                            50D High: ₹{item["50d_high"]}
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

                        {/* 7. Dry-Up Ratio */}
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

                        {/* 8. RSI (14) */}
                        <td className="px-3 py-3 text-center font-mono">
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            {item.rsi_14}
                          </span>
                        </td>

                        {/* 9. Conviction Score */}
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

                        {/* 10. Blueprint Action Button */}
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
            <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-[#0a1426]">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-slate-200 pb-4 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold text-slate-900 dark:text-white">
                      {selectedBlueprint.symbol}
                    </span>
                    <span className="rounded bg-cyan-500/10 px-2 py-0.5 text-xs font-semibold text-cyan-400">
                      {selectedBlueprint.setup_type}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {selectedBlueprint.company_name}
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
                {/* 3.5:1 Targets Grid */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3">
                    <div className="text-[10px] font-bold uppercase text-rose-400">Stop Loss (-4%)</div>
                    <div className="mt-1 text-base font-extrabold text-rose-500">
                      ₹{selectedBlueprint.blueprint.stop_loss}
                    </div>
                  </div>

                  <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3">
                    <div className="text-[10px] font-bold uppercase text-cyan-400">Target 1 (+10%)</div>
                    <div className="mt-1 text-base font-extrabold text-cyan-400">
                      ₹{selectedBlueprint.blueprint.target_1}
                    </div>
                    <div className="mt-0.5 text-[9px] text-cyan-400/80">Book 50%</div>
                  </div>

                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                    <div className="text-[10px] font-bold uppercase text-emerald-400">Target 2 (+14%)</div>
                    <div className="mt-1 text-base font-extrabold text-emerald-400">
                      ₹{selectedBlueprint.blueprint.target_2}
                    </div>
                    <div className="mt-0.5 text-[9px] text-emerald-400/80">Full Runner</div>
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
                  </div>
                </div>

                {/* Execution Trail Rules */}
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-300/90">
                  <div className="flex items-center gap-1.5 font-bold text-amber-400">
                    <Info size={14} />
                    <span>Breakeven Locking Rule</span>
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

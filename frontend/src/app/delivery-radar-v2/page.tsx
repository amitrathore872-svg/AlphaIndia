"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  ShieldCheck,
  TrendingUp,
  RefreshCw,
  Search,
  Sparkles,
  Flame,
  Zap,
  Info,
  Clock,
  Layers,
  Crosshair,
  Activity,
  AlertTriangle,
  Lock,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  SlidersHorizontal,
  PieChart,
  CheckCircle2,
  XCircle,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import DashboardLayout from "@/components/layout/DashboardLayout";
import AddToWatchlistButton from "@/components/watchlist/AddToWatchlistButton";
import PageHeader from "@/components/common/PageHeader";
import EmptyState from "@/components/common/EmptyState";
import {
  DeliveryV2Opportunity,
  DeliveryV2Metadata,
  fetchDeliveryV2Opportunities,
  fetchDeliveryV2Stats,
  triggerDeliveryV2Scan,
} from "@/lib/deliveryRadarV2Api";
import BhavcopySyncControl from "@/components/delivery/BhavcopySyncControl";

export default function DeliveryRadarV2Page() {
  const [opportunities, setOpportunities] = useState<DeliveryV2Opportunity[]>([]);
  const [metadata, setMetadata] = useState<DeliveryV2Metadata | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [scanning, setScanning] = useState<boolean>(false);
  const [selectedStock, setSelectedStock] = useState<DeliveryV2Opportunity | null>(null);

  // Filters
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [selectedArchetype, setSelectedArchetype] = useState<string>("ALL");
  const [sweetspotOnly, setSweetspotOnly] = useState<boolean>(false);
  const [minFloatMcap, setMinFloatMcap] = useState<number>(500);
  const [minFloatAbsorb5d, setMinFloatAbsorb5d] = useState<number>(1.0);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("conviction_score");
  const [sortOrder, setSortOrder] = useState<string>("desc");
  const [page, setPage] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const limit = 25;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchDeliveryV2Opportunities({
        min_float_mcap: minFloatMcap,
        min_float_absorb_5d: minFloatAbsorb5d,
        trigger_status: selectedStatus === "ALL" ? undefined : selectedStatus,
        archetype: selectedArchetype === "ALL" ? undefined : selectedArchetype,
        sweetspot_only: sweetspotOnly,
        sort_by: sortBy,
        sort_order: sortOrder,
        page: page,
        limit: limit,
      });

      let items = res.opportunities || [];
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        items = items.filter(
          (o) =>
            o.symbol.toLowerCase().includes(term) ||
            o.company_name.toLowerCase().includes(term)
        );
      }

      setOpportunities(items);
      setMetadata(res.metadata || null);
      setTotalCount(res.total || 0);
    } catch (err) {
      console.error("Failed to load Delivery Radar 2.0 data:", err);
    } finally {
      setLoading(false);
    }
  }, [minFloatMcap, minFloatAbsorb5d, selectedStatus, selectedArchetype, sweetspotOnly, sortBy, sortOrder, page, searchTerm]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleScan = async () => {
    setScanning(true);
    try {
      await triggerDeliveryV2Scan({ min_float_mcap: minFloatMcap, min_float_absorb_5d: minFloatAbsorb5d });
      await loadData();
    } catch (err) {
      console.error("Scan trigger failed:", err);
    } finally {
      setScanning(false);
    }
  };

  const totalPages = Math.ceil(totalCount / limit) || 1;

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-16 text-slate-100">
        {/* Top Header with Radar Version Switcher */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                Version 2.0 PRO
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                <PieChart className="w-6 h-6 text-emerald-400" />
                Delivery Radar 2.0
              </h1>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Multi-Day Free Float Absorption, Institutional Float Squeezes & Climax Exhaustion Shields
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <BhavcopySyncControl
              onSyncCompleted={() => {
                loadData();
              }}
            />

            {/* Version Switcher Tabs */}
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1 text-xs font-medium">
              <Link
                href="/delivery-radar"
                className="px-3 py-1.5 rounded-md text-slate-400 hover:text-slate-200 transition-colors"
              >
                Radar 1.0 (Standard)
              </Link>
              <span className="px-3 py-1.5 rounded-md bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/40">
                Radar 2.0 (Free Float)
              </span>
            </div>

            <button
              onClick={handleScan}
              disabled={scanning}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-lg shadow-emerald-900/30 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${scanning ? "animate-spin" : ""}`} />
              <span>{scanning ? "Scanning Universe..." : "Trigger 2.0 Scan"}</span>
            </button>
          </div>
        </div>

        {/* Market Regime Filter / Health Guard */}
        {metadata?.market_regime && (
          <div
            className={`p-4 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-lg ${
              metadata.market_regime.status === "BULLISH"
                ? "bg-emerald-950/30 border-emerald-500/40 text-emerald-200"
                : "bg-rose-950/30 border-rose-500/40 text-rose-200"
            }`}
          >
            <div className="flex items-center gap-3">
              <span
                className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${
                  metadata.market_regime.status === "BULLISH"
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/50"
                    : "bg-rose-500/20 text-rose-300 border border-rose-500/50"
                }`}
              >
                {metadata.market_regime.label}
              </span>
              <div>
                <div className="text-xs font-semibold text-slate-200 flex flex-wrap items-center gap-2">
                  <span>Market Breadth: {metadata.market_regime.breadth_pct}% above 20-SMA</span>
                  <span className="text-slate-500">•</span>
                  <span className="text-slate-400 font-normal">{metadata.market_regime.recommendation}</span>
                </div>
              </div>
            </div>
            <div className="text-xs font-mono px-3 py-1 bg-slate-900/90 rounded-lg border border-cyan-500/30 text-slate-300">
              Strategy: <span className="text-cyan-400 font-semibold">20-EMA Asymmetric Coil (R:R 1:4.8)</span>
            </div>
          </div>
        )}

        {/* Telemetry Stats Ribbon */}
        {metadata && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex flex-col justify-between">
              <div className="text-slate-400 text-xs font-medium flex items-center justify-between">
                <span>Session</span>
                <Clock className="w-3.5 h-3.5 text-slate-500" />
              </div>
              <div className="mt-2 text-base font-bold text-slate-100">{metadata.latest_session_date || "Live"}</div>
              <div className="text-[10px] text-slate-500 mt-1">{metadata.total_scanned_symbols} Scanned</div>
            </div>

            <div className="bg-slate-900/80 border border-emerald-500/30 rounded-xl p-3 flex flex-col justify-between shadow-lg shadow-emerald-950/20">
              <div className="text-emerald-400 text-xs font-medium flex items-center justify-between">
                <span>Volume Surge</span>
                <Flame className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              </div>
              <div className="mt-2 text-base font-bold text-emerald-300">{metadata.volume_expansion_count || 0}</div>
              <div className="text-[10px] text-emerald-400/80 mt-1">🔥 3D Turnover &ge; 2.0x</div>
            </div>

            <div className="bg-slate-900/80 border border-cyan-500/30 rounded-xl p-3 flex flex-col justify-between shadow-lg shadow-cyan-950/20">
              <div className="text-cyan-400 text-xs font-medium flex items-center justify-between">
                <span>20-EMA Coils</span>
                <Zap className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              </div>
              <div className="mt-2 text-base font-bold text-cyan-300">{metadata.asymmetric_coil_count || 0}</div>
              <div className="text-[10px] text-cyan-400/80 mt-1">⚡ Asymmetric R:R 1:4.8</div>
            </div>

            <div className="bg-slate-900/80 border border-emerald-500/20 rounded-xl p-3 flex flex-col justify-between">
              <div className="text-emerald-400 text-xs font-medium flex items-center justify-between">
                <span>Float Locks</span>
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="mt-2 text-base font-bold text-emerald-300">{metadata.stealth_lock_count || 0}</div>
              <div className="text-[10px] text-emerald-500/80 mt-1">&ge; 2.5% Float Locked</div>
            </div>

            <div className="bg-slate-900/80 border border-amber-500/20 rounded-xl p-3 flex flex-col justify-between">
              <div className="text-amber-400 text-xs font-medium flex items-center justify-between">
                <span>Dry-Up Coils</span>
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="mt-2 text-base font-bold text-amber-300">{metadata.coil_dryup_count || 0}</div>
              <div className="text-[10px] text-amber-500/80 mt-1">Pre-Breakout Coils</div>
            </div>

            <div className="bg-slate-900/80 border border-blue-500/20 rounded-xl p-3 flex flex-col justify-between">
              <div className="text-blue-400 text-xs font-medium flex items-center justify-between">
                <span>Breakouts</span>
                <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <div className="mt-2 text-base font-bold text-blue-300">{metadata.breakout_expansion_count || 0}</div>
              <div className="text-[10px] text-blue-500/80 mt-1">Fresh 20D Pivots</div>
            </div>

            <div className="bg-slate-900/80 border border-purple-500/20 rounded-xl p-3 flex flex-col justify-between">
              <div className="text-purple-400 text-xs font-medium flex items-center justify-between">
                <span>Sweetspot</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
              </div>
              <div className="mt-2 text-base font-bold text-purple-300">{metadata.sweetspot_demand_count || 0}</div>
              <div className="text-[10px] text-purple-500/80 mt-1">70-76.5% Buyers</div>
            </div>

            <div className="bg-slate-900/80 border border-rose-500/20 rounded-xl p-3 flex flex-col justify-between">
              <div className="text-rose-400 text-xs font-medium flex items-center justify-between">
                <span>Climax Traps</span>
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              </div>
              <div className="mt-2 text-base font-bold text-rose-300">{metadata.climax_warnings_count || 0}</div>
              <div className="text-[10px] text-rose-500/80 mt-1">&ge; 2% Float Shock Avoided</div>
            </div>
          </div>
        )}

        {/* Setup Status Segmented Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-800/80 pb-3">
          <button
            onClick={() => {
              setSelectedStatus("ALL");
              setPage(1);
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              selectedStatus === "ALL"
                ? "bg-slate-100 text-slate-900 shadow"
                : "bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800"
            }`}
          >
            All Setups ({metadata?.qualifying_setups_count || totalCount})
          </button>

          <button
            onClick={() => {
              setSelectedStatus("EXPANSION_BUY");
              setPage(1);
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              selectedStatus === "EXPANSION_BUY"
                ? "bg-emerald-500 text-slate-950 font-bold shadow-lg shadow-emerald-500/20"
                : "bg-emerald-950/40 text-emerald-400 hover:bg-emerald-900/50 border border-emerald-500/30"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>🔥 VOLUME SURGE</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full bg-emerald-950 text-emerald-300 font-mono text-[10px] border border-emerald-500/30">
              {metadata?.volume_expansion_count || 0}
            </span>
          </button>

          <button
            onClick={() => {
              setSelectedStatus("ASYMMETRIC_BUY");
              setPage(1);
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              selectedStatus === "ASYMMETRIC_BUY"
                ? "bg-cyan-500 text-slate-950 font-bold shadow-lg shadow-cyan-500/20"
                : "bg-cyan-950/40 text-cyan-400 hover:bg-cyan-900/50 border border-cyan-500/30"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span>⚡ 20-EMA CHEAT ENTRY</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full bg-cyan-950 text-cyan-300 font-mono text-[10px] border border-cyan-500/30">
              {metadata?.asymmetric_coil_count || 0}
            </span>
          </button>

          <button
            onClick={() => {
              setSelectedStatus("BUY_TRIGGERED");
              setPage(1);
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              selectedStatus === "BUY_TRIGGERED"
                ? "bg-emerald-500 text-slate-950 font-bold shadow-lg shadow-emerald-500/20"
                : "bg-emerald-950/40 text-emerald-400 hover:bg-emerald-900/50 border border-emerald-500/30"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>🟢 BUY TRIGGERED</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full bg-emerald-950 text-emerald-300 font-mono text-[10px] border border-emerald-500/30">
              {metadata?.buy_triggered_count ?? metadata?.breakout_expansion_count ?? 0}
            </span>
          </button>

          <button
            onClick={() => {
              setSelectedStatus("COILING_WATCHLIST");
              setPage(1);
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              selectedStatus === "COILING_WATCHLIST"
                ? "bg-amber-500 text-slate-950 font-bold shadow-lg shadow-amber-500/20"
                : "bg-amber-950/40 text-amber-400 hover:bg-amber-900/50 border border-amber-500/30"
            }`}
          >
            <span>🟡 COILING (WATCHLIST)</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-950 text-amber-300 font-mono text-[10px] border border-amber-500/30">
              {metadata?.coiling_count ?? 0}
            </span>
          </button>

          <button
            onClick={() => {
              setSelectedStatus("CLIMAX_AVOID");
              setPage(1);
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              selectedStatus === "CLIMAX_AVOID"
                ? "bg-rose-500 text-white font-bold shadow-lg shadow-rose-500/20"
                : "bg-rose-950/40 text-rose-400 hover:bg-rose-900/50 border border-rose-500/30"
            }`}
          >
            <span>⚠️ CLIMAX AVOID (SHIELD)</span>
            <span className="ml-1 px-1.5 py-0.2 rounded-full bg-rose-950 text-rose-300 font-mono text-[10px] border border-rose-500/30">
              {metadata?.climax_avoid_count ?? metadata?.climax_warnings_count ?? 0}
            </span>
          </button>
        </div>

        {/* Filter Controls Bar */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between text-xs">
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Search */}
            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search symbol..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Archetype Filter */}
            <select
              value={selectedArchetype}
              onChange={(e) => {
                setSelectedArchetype(e.target.value);
                setPage(1);
              }}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="ALL">All Archetypes</option>
              <option value="VOLUME_EXPANSION_SURGE">🔥 Multi-Day Volume Surge</option>
              <option value="ASYMMETRIC_COIL">⚡ 20-EMA Cheat Coil</option>
              <option value="STEALTH_FLOAT_LOCK">🔒 Stealth Float Lock</option>
              <option value="COIL_SUPPLY_EXHAUSTION">🟡 Supply Dry-Up Coil</option>
              <option value="BREAKOUT_EXPANSION">🚀 Breakout Expansion</option>
              <option value="MULTI_DAY_ACCUMULATION">📦 Multi-Day Accumulation</option>
              <option value="CLIMAX_SHOCK_WARNING">⚠️ Climax Shock Trap</option>
            </select>

            {/* Sweetspot Toggle */}
            <button
              onClick={() => {
                setSweetspotOnly(!sweetspotOnly);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition-all ${
                sweetspotOnly
                  ? "bg-purple-500/20 border-purple-500/50 text-purple-300 font-semibold"
                  : "bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              <Sparkles className="w-3 h-3 text-purple-400" />
              70%-76% Buyer Sweet-Spot
            </button>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            {/* Float Absorption Threshold */}
            <div className="flex items-center gap-2 text-slate-400">
              <span>Min 5D Float:</span>
              <select
                value={minFloatAbsorb5d}
                onChange={(e) => {
                  setMinFloatAbsorb5d(Number(e.target.value));
                  setPage(1);
                }}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-slate-200"
              >
                <option value={0.5}>&ge; 0.5%</option>
                <option value={1.0}>&ge; 1.0%</option>
                <option value={2.0}>&ge; 2.0%</option>
                <option value={3.0}>&ge; 3.0% (Elite)</option>
              </select>
            </div>

            {/* Sort Field */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200"
            >
              <option value="conviction_score">Sort: Conviction Score</option>
              <option value="float_absorb_5d_pct">Sort: 5D Float Absorb %</option>
              <option value="float_absorb_10d_pct">Sort: 10D Float Absorb %</option>
              <option value="buyer_demand_ratio">Sort: Buyer Demand</option>
              <option value="current_price">Sort: Price</option>
              <option value="day_change_pct">Sort: Day Change %</option>
            </select>
          </div>
        </div>

        {/* Main Opportunities Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Symbol / Sector</th>
                  <th className="py-3 px-3">Setup Status</th>
                  <th className="py-3 px-3">CMP & 20-EMA</th>
                  <th className="py-3 px-3">Free Float MCap</th>
                  <th className="py-3 px-3">5D Float Absorbed</th>
                  <th className="py-3 px-3">10D Float Absorbed</th>
                  <th className="py-3 px-3">10D Inflow Flow</th>
                  <th className="py-3 px-3">Buyer Demand</th>
                  <th className="py-3 px-4">Archetype & Trade Blueprint</th>
                  <th className="py-3 px-3 text-right">Conviction</th>
                  <th className="py-3 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {loading ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-slate-500">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
                      Loading Delivery Radar 2.0 telemetry...
                    </td>
                  </tr>
                ) : opportunities.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-slate-500">
                      {selectedStatus === "BUY_TRIGGERED" ? (
                        <div className="max-w-md mx-auto space-y-2">
                          <div className="text-amber-400 font-semibold text-sm">No Buy Triggers on Latest Session ({metadata?.latest_session_date})</div>
                          <p className="text-xs text-slate-400">
                            No stocks crossed their 20-DMA pivot today on active delivery expansion. The market is currently in an institutional coiling phase ({metadata?.coiling_count || 0} stocks absorbing float on watch).
                          </p>
                          <button
                            onClick={() => setSelectedStatus("COILING_WATCHLIST")}
                            className="mt-2 px-3 py-1 bg-amber-500/20 border border-amber-500/40 text-amber-300 rounded text-xs font-semibold hover:bg-amber-500/30 transition-colors"
                          >
                            View Coiling Watchlist Setups &rarr;
                          </button>
                        </div>
                      ) : (
                        "No stocks met the active Free Float absorption filters."
                      )}
                    </td>
                  </tr>
                ) : (
                  opportunities.map((opp) => (
                    <tr
                      key={opp.symbol}
                      onClick={() => setSelectedStock(opp)}
                      className="hover:bg-slate-800/50 cursor-pointer transition-colors"
                    >
                      {/* Symbol */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5">
                          <Link
                            href={`/stocks/${encodeURIComponent(opp.symbol.replace(/\.NS$|\.BO$/i, "").trim())}?from=/delivery-radar-v2`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-bold text-slate-100 hover:text-emerald-400 font-sans text-xs flex items-center gap-1 group transition-colors inline-flex"
                            title={`Open ${opp.symbol} stock analysis page`}
                          >
                            <span className="group-hover:underline">{opp.symbol}</span>
                            <ExternalLink className="w-3 h-3 text-slate-500 opacity-60 group-hover:opacity-100 group-hover:text-emerald-400 transition-opacity" />
                          </Link>
                        </div>
                        <div className="text-[10px] text-slate-500 font-sans truncate max-w-[140px] mt-0.5">
                          <Link
                            href={`/stocks/${encodeURIComponent(opp.symbol.replace(/\.NS$|\.BO$/i, "").trim())}?from=/delivery-radar-v2`}
                            onClick={(e) => e.stopPropagation()}
                            className="hover:text-slate-300 hover:underline transition-colors"
                            title={`Open ${opp.company_name} analysis`}
                          >
                            {opp.company_name}
                          </Link>
                        </div>
                      </td>

                      {/* Setup Status Badge */}
                      <td className="py-3 px-3 font-sans">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wide inline-flex items-center gap-1 ${
                            opp.trigger_status === "EXPANSION_BUY"
                              ? "bg-emerald-500/25 text-emerald-300 border border-emerald-500/60 shadow-sm shadow-emerald-500/30"
                              : opp.trigger_status === "ASYMMETRIC_BUY"
                              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm shadow-cyan-500/20"
                              : opp.trigger_status === "BUY_TRIGGERED"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-sm shadow-emerald-500/20"
                              : opp.trigger_status === "CLIMAX_AVOID"
                              ? "bg-rose-500/20 text-rose-300 border border-rose-500/50"
                              : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                          }`}
                        >
                          {opp.trigger_status === "EXPANSION_BUY" && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          )}
                          {opp.trigger_status === "ASYMMETRIC_BUY" && (
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                          )}
                          {opp.trigger_status === "BUY_TRIGGERED" && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          )}
                          {opp.trigger_status === "EXPANSION_BUY"
                            ? "🔥 VOLUME SURGE"
                            : opp.trigger_status === "ASYMMETRIC_BUY"
                            ? "⚡ CHEAT ENTRY"
                            : opp.trigger_status === "BUY_TRIGGERED"
                            ? "🟢 BUY TRIGGER"
                            : opp.trigger_status === "CLIMAX_AVOID"
                            ? "⚠️ CLIMAX TRAP"
                            : "🟡 COILING (WATCH)"}
                        </span>
                      </td>

                      {/* CMP */}
                      <td className="py-3 px-3">
                        <div className="text-slate-200">₹{opp.current_price.toLocaleString("en-IN")}</div>
                        <div className="flex flex-wrap items-center gap-1 mt-0.5">
                          <span
                            className={`text-[10px] ${
                              opp.day_change_pct >= 0 ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            {opp.day_change_pct >= 0 ? "+" : ""}
                            {opp.day_change_pct}%
                          </span>
                          {opp.turnover_expansion_3d !== undefined && opp.turnover_expansion_3d >= 1.8 && (
                            <span
                              className="text-[9px] px-1 py-0.2 rounded bg-emerald-950/80 text-emerald-300 font-mono border border-emerald-500/30 font-bold"
                              title="3-Day Turnover Surge vs 20D Baseline"
                            >
                              3D TO: {opp.turnover_expansion_3d}x
                            </span>
                          )}
                          {opp.dist_to_ema20_pct !== undefined && (
                            <span
                              className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-cyan-300 font-mono"
                              title="Distance to 20-EMA"
                            >
                              20E: {opp.dist_to_ema20_pct > 0 ? "+" : ""}{opp.dist_to_ema20_pct}%
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Free Float MCap */}
                      <td className="py-3 px-3">
                        <div className="text-slate-200">₹{opp.free_float_mcap_cr.toLocaleString("en-IN")} Cr</div>
                        <div className="text-[10px] text-slate-500">Float: {opp.free_float_pct}%</div>
                      </td>

                      {/* 5D Float Absorbed */}
                      <td className="py-3 px-3">
                        <div
                          className={`font-semibold ${
                            opp.float_absorb_5d_pct >= 3.0
                              ? "text-emerald-400 font-bold"
                              : opp.float_absorb_5d_pct >= 1.5
                              ? "text-cyan-400"
                              : "text-slate-300"
                          }`}
                        >
                          {opp.float_absorb_5d_pct}%
                        </div>
                        <div className="text-[10px] text-slate-500">₹{opp.net_deliv_cr_5d} Cr</div>
                      </td>

                      {/* 10D Float Absorbed */}
                      <td className="py-3 px-3">
                        <div className="text-slate-200 font-medium">{opp.float_absorb_10d_pct}%</div>
                        <div className="text-[10px] text-slate-500">₹{opp.net_deliv_cr_10d} Cr</div>
                      </td>

                      {/* 10D Inflow */}
                      <td className="py-3 px-3">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            opp.deliv_flow_10d >= 3.0
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                              : opp.deliv_flow_10d >= 1.5
                              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                              : "bg-slate-800 text-slate-400"
                          }`}
                        >
                          {opp.deliv_flow_10d}x
                        </span>
                      </td>

                      {/* Buyer Demand */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`font-semibold ${
                              opp.is_sweetspot_demand
                                ? "text-purple-400"
                                : opp.buyer_demand_ratio >= 78.0
                                ? "text-amber-400"
                                : "text-slate-300"
                            }`}
                          >
                            {opp.buyer_demand_ratio}%
                          </span>
                          {opp.is_sweetspot_demand && (
                            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                          )}
                        </div>
                        <div className="text-[9px] text-slate-500">
                          {opp.is_sweetspot_demand
                            ? "Sweetspot"
                            : opp.buyer_demand_ratio >= 78
                            ? "Circuit Band"
                            : "Balanced"}
                        </div>
                      </td>

                      {/* Archetype / Verdict & Blueprint */}
                      <td className="py-3 px-4 font-sans max-w-[240px]">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide inline-block mb-1 ${
                            opp.archetype === "VOLUME_EXPANSION_SURGE"
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 font-bold"
                              : opp.archetype === "ASYMMETRIC_COIL"
                              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold"
                              : opp.archetype === "STEALTH_FLOAT_LOCK"
                              ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                              : opp.archetype === "COIL_SUPPLY_EXHAUSTION"
                              ? "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                              : opp.archetype === "BREAKOUT_EXPANSION"
                              ? "bg-blue-500/15 text-blue-300 border border-blue-500/30"
                              : opp.archetype === "CLIMAX_SHOCK_WARNING"
                              ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold"
                              : "bg-slate-800 text-slate-300"
                          }`}
                        >
                          {opp.archetype_label}
                        </span>
                        <div className="text-[10px] text-slate-400 truncate">{opp.institutional_verdict}</div>
                        {opp.blueprint && (
                          <div className="mt-1 flex items-center gap-1.5 text-[9px] font-mono text-slate-400">
                            <span className="text-rose-400 font-semibold">SL: ₹{opp.blueprint.stop_loss}</span>
                            <span>•</span>
                            <span className="text-emerald-400 font-semibold">T1: ₹{opp.blueprint.target_1}</span>
                            <span>•</span>
                            <span className="px-1 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-500/30 font-bold">
                              R:R {opp.blueprint.rr_ratio}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Conviction Score */}
                      <td className="py-3 px-3 text-right">
                        <div
                          className={`text-sm font-bold ${
                            opp.conviction_score >= 80
                              ? "text-emerald-400"
                              : opp.conviction_score >= 65
                              ? "text-cyan-400"
                              : "text-slate-300"
                          }`}
                        >
                          {opp.conviction_score}
                        </div>
                        <div className="w-16 bg-slate-800 h-1 rounded-full ml-auto overflow-hidden mt-1">
                          <div
                            className={`h-full ${
                              opp.conviction_score >= 80
                                ? "bg-emerald-400"
                                : opp.conviction_score >= 65
                                ? "bg-cyan-400"
                                : "bg-slate-500"
                            }`}
                            style={{ width: `${opp.conviction_score}%` }}
                          />
                        </div>
                      </td>

                      {/* Action */}
                      <td
                        className="py-3 px-3 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          <AddToWatchlistButton symbol={opp.symbol} variant="star" />
                          <Link
                            href={`/delivery-radar/${encodeURIComponent(opp.symbol.replace(/\.NS$|\.BO$/i, "").trim())}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2 py-1.5 text-xs font-semibold text-cyan-400 transition hover:bg-cyan-500 hover:text-slate-950"
                            title={`Open dedicated Delivery Radar History page for ${opp.symbol}`}
                          >
                            <ExternalLink size={12} />
                            <span>History</span>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-3.5 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <div>
              Showing {opportunities.length > 0 ? (page - 1) * limit + 1 : 0} to{" "}
              {Math.min(page * limit, totalCount)} of {totalCount} setups
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded text-slate-300 disabled:opacity-40"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span>
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                className="px-2.5 py-1 bg-slate-900 border border-slate-800 rounded text-slate-300 disabled:opacity-40"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Free Float Stock Detail Modal */}
        {selectedStock && (
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedStock(null)}
          >
            <div
              className="bg-slate-900 border border-slate-800 rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl relative"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/stocks/${encodeURIComponent(selectedStock.symbol.replace(/\.NS$|\.BO$/i, "").trim())}?from=/delivery-radar-v2`}
                      className="text-xl font-bold text-white hover:text-emerald-400 hover:underline flex items-center gap-1.5 transition-colors group"
                      title={`Open ${selectedStock.symbol} Stock Page`}
                    >
                      <span>{selectedStock.symbol}</span>
                      <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-emerald-400 transition-colors" />
                    </Link>
                    <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      {selectedStock.sector}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        selectedStock.trigger_status === "ASYMMETRIC_BUY"
                          ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/50"
                          : selectedStock.trigger_status === "BUY_TRIGGERED"
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/50"
                          : selectedStock.trigger_status === "CLIMAX_AVOID"
                          ? "bg-rose-500/20 text-rose-300 border border-rose-500/50"
                          : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                      }`}
                    >
                      {selectedStock.trigger_status === "ASYMMETRIC_BUY"
                        ? "⚡ CHEAT ENTRY"
                        : selectedStock.trigger_status === "BUY_TRIGGERED"
                        ? "🟢 BUY TRIGGER"
                        : selectedStock.trigger_status === "CLIMAX_AVOID"
                        ? "⚠️ CLIMAX TRAP"
                        : "🟡 COILING (WATCH)"}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    <Link
                      href={`/stocks/${encodeURIComponent(selectedStock.symbol.replace(/\.NS$|\.BO$/i, "").trim())}?from=/delivery-radar-v2`}
                      className="hover:text-slate-200 hover:underline transition-colors"
                    >
                      {selectedStock.company_name}
                    </Link>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedStock(null)}
                  className="text-slate-400 hover:text-white text-lg font-bold"
                >
                  ✕
                </button>
              </div>

              {/* Free Float Telemetry Cards */}
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-500 uppercase">Market Cap</div>
                  <div className="text-sm font-bold text-slate-200 mt-1">₹{selectedStock.market_cap_cr} Cr</div>
                  <div className="text-[10px] text-slate-400">Promoter: {selectedStock.promoter_holding}%</div>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-emerald-500/20">
                  <div className="text-[10px] text-emerald-400 uppercase font-semibold">Free Float MCap</div>
                  <div className="text-sm font-bold text-emerald-300 mt-1">
                    ₹{selectedStock.free_float_mcap_cr} Cr
                  </div>
                  <div className="text-[10px] text-emerald-500/80">Public Float: {selectedStock.free_float_pct}%</div>
                </div>

                <div className="bg-slate-950 p-3 rounded-xl border border-cyan-500/20">
                  <div className="text-[10px] text-cyan-400 uppercase font-semibold">5D Float Absorbed</div>
                  <div className="text-sm font-bold text-cyan-300 mt-1">{selectedStock.float_absorb_5d_pct}%</div>
                  <div className="text-[10px] text-cyan-500/80">₹{selectedStock.net_deliv_cr_5d} Cr Delivered</div>
                </div>
              </div>

              {/* Mechanical Trade Blueprint (Zero-Guesswork Execution) */}
              {selectedStock.blueprint && (
                <div className="bg-slate-950 p-4 rounded-xl border border-cyan-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-300 uppercase tracking-wide">
                      <Zap className="w-3.5 h-3.5 text-cyan-400" />
                      Mechanical Trade Blueprint (R:R {selectedStock.blueprint.rr_ratio})
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30">
                      Hold: {selectedStock.blueprint.suggested_holding_days}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs font-mono">
                    <div className="p-2 rounded bg-slate-900 border border-slate-800">
                      <div className="text-[9px] text-slate-400 uppercase">Entry Corridor</div>
                      <div className="font-bold text-slate-100 text-[11px] mt-0.5">
                        ₹{selectedStock.blueprint.entry_corridor_min} - {selectedStock.blueprint.entry_corridor_max}
                      </div>
                    </div>

                    <div className="p-2 rounded bg-rose-950/30 border border-rose-500/30">
                      <div className="text-[9px] text-rose-400 uppercase font-semibold">GTT Stop Loss</div>
                      <div className="font-bold text-rose-300 text-[11px] mt-0.5">
                        ₹{selectedStock.blueprint.stop_loss} (-{selectedStock.blueprint.risk_pct}%)
                      </div>
                    </div>

                    <div className="p-2 rounded bg-amber-950/30 border border-amber-500/30">
                      <div className="text-[9px] text-amber-400 uppercase font-semibold">Breakeven Trigger</div>
                      <div className="font-bold text-amber-300 text-[11px] mt-0.5">
                        ₹{selectedStock.blueprint.breakeven_trigger} (+{selectedStock.blueprint.breakeven_gain_pct}%)
                      </div>
                    </div>

                    <div className="p-2 rounded bg-emerald-950/30 border border-emerald-500/30">
                      <div className="text-[9px] text-emerald-400 uppercase font-semibold">Targets (T1 / T2)</div>
                      <div className="font-bold text-emerald-300 text-[11px] mt-0.5">
                        ₹{selectedStock.blueprint.target_1} / ₹{selectedStock.blueprint.target_2}
                      </div>
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 leading-snug bg-slate-900/80 p-2.5 rounded border border-slate-800">
                    <span className="text-cyan-400 font-semibold">Execution Protocol: </span>
                    {selectedStock.blueprint.execution_protocol}
                  </div>
                </div>
              )}

              {/* Microstructure Metrics */}
              <div className="space-y-2 text-xs bg-slate-950/60 p-4 rounded-xl border border-slate-800 font-mono">
                {selectedStock.turnover_expansion_3d !== undefined && selectedStock.turnover_expansion_3d >= 1.5 && (
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-emerald-400 font-semibold">3-Day Turnover Surge (vs 20D):</span>
                    <span className="text-emerald-300 font-bold">{selectedStock.turnover_expansion_3d}x Baseline</span>
                  </div>
                )}
                {selectedStock.vol_expansion_3d !== undefined && selectedStock.vol_expansion_3d >= 1.5 && (
                  <div className="flex justify-between py-1 border-b border-slate-800/60">
                    <span className="text-cyan-400 font-semibold">3-Day Volume Surge (vs 20D):</span>
                    <span className="text-cyan-300 font-bold">{selectedStock.vol_expansion_3d}x Baseline</span>
                  </div>
                )}
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">10-Day Float Absorbed:</span>
                  <span className="text-slate-200 font-bold">
                    {selectedStock.float_absorb_10d_pct}% (₹{selectedStock.net_deliv_cr_10d} Cr)
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">10-Day Up/Down Deliv Flow:</span>
                  <span className="text-emerald-400 font-bold">{selectedStock.deliv_flow_10d}x Inflow</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Buyer vs Seller Demand:</span>
                  <span
                    className={`font-bold ${
                      selectedStock.is_sweetspot_demand ? "text-purple-400" : "text-slate-200"
                    }`}
                  >
                    {selectedStock.buyer_demand_ratio}%{" "}
                    {selectedStock.is_sweetspot_demand && "(Sweet-Spot 🎯)"}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Pre-Breakout Range Contraction:</span>
                  <span className="text-amber-400 font-bold">{selectedStock.range_contraction}x 20-DMA</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-slate-400">Volume Dry-Up Ratio (T-1):</span>
                  <span className="text-cyan-400 font-bold">{selectedStock.vol_dryup_ratio}x 20-DMA</span>
                </div>
              </div>

              {/* Institutional Verdict */}
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs">
                <div className="font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-emerald-400" />
                  Institutional Verdict
                </div>
                <p className="text-slate-400 leading-relaxed">{selectedStock.institutional_verdict}</p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <div className="flex items-center gap-3">
                  <Link
                    href={`/stocks/${encodeURIComponent(selectedStock.symbol.replace(/\.NS$|\.BO$/i, "").trim())}?from=/delivery-radar-v2`}
                    className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold hover:underline"
                  >
                    View Stock Analysis &rarr;
                  </Link>
                  <Link
                    href={`/delivery-radar/${encodeURIComponent(selectedStock.symbol.replace(/\.NS$|\.BO$/i, "").trim())}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-xs font-semibold text-cyan-300 hover:bg-cyan-500 hover:text-slate-950 transition"
                  >
                    <ExternalLink size={12} />
                    <span>Delivery History</span>
                  </Link>
                </div>
                <AddToWatchlistButton symbol={selectedStock.symbol} />
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
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
  ExternalLink,
  AlertCircle,
  Gauge,
  Lock,
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  Copy,
  Check,
  Calculator,
  SlidersHorizontal,
  Compass,
  ArrowRight,
  ShieldAlert,
  TableProperties,
  LayoutGrid,
  ArrowUpDown,
  X,
  BarChart3,
  Percent,
  Radio,
  ArrowUpRight,
  TrendingDown,
  FileText,
} from "lucide-react";

import DashboardLayout from "@/components/layout/DashboardLayout";
import AddToWatchlistButton from "@/components/watchlist/AddToWatchlistButton";
import { SparklineChart } from "@/components/common";
import {
  ApexSwingTicket,
  MacroTelemetry,
  FunnelStats,
  fetchApexSwingSetups,
} from "@/lib/apexSwingApi";

const ARCHETYPE_TABS = [
  { id: "ALL", label: "All Setups", icon: Flame },
  { id: "RUNAWAY_CATALYST", label: "💎 Runaway Guidance", icon: Sparkles },
  { id: "TRIPLE_ALPHA_PEAD", label: "Triple-Alpha PEAD", icon: Zap },
  { id: "ORDER_WIN_CATALYST", label: "Order Win Contracts", icon: Award },
  { id: "STEALTH_FLOAT_COIL", label: "Stealth Float Coil", icon: Lock },
  { id: "EMA20_DEFENDER", label: "20-EMA Defender", icon: ShieldCheck },
  { id: "CONSENSUS_RE_RATING", label: "Consensus Re-Rating", icon: TrendingUp },
  { id: "MOMENTUM_DRIFT", label: "Momentum Drift", icon: Activity },
];

export default function ApexSwingSniperPage() {
  const [setups, setSetups] = useState<ApexSwingTicket[]>([]);
  const [telemetry, setTelemetry] = useState<MacroTelemetry | null>(null);
  const [funnel, setFunnel] = useState<FunnelStats | null>(null);
  const [availableSectors, setAvailableSectors] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // View Mode: "table" (styled like /techno-funda) or "cards"
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  // Compact Header & Section Toggles (collapsing unnecessary vertical whitespace gap)
  const [showTelemetry, setShowTelemetry] = useState<boolean>(false);
  const [showPositionSizer, setShowPositionSizer] = useState<boolean>(false);

  // Filters & Sorting
  const [selectedArchetype, setSelectedArchetype] = useState<string>("ALL");
  const [selectedSector, setSelectedSector] = useState<string>("ALL");
  const [selectedGapFilter, setSelectedGapFilter] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [minConviction, setMinConviction] = useState<number>(0);
  const [sortBy, setSortBy] = useState<string>("conviction_score");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Pagination for table view
  const [page, setPage] = useState<number>(1);
  const limit = 25;

  // Slide-Over Quick Inspection Drawer State (Techno-Funda style)
  const [selectedTicket, setSelectedTicket] = useState<ApexSwingTicket | null>(null);

  // Interactive Risk & Position Sizing Calculator Global State
  const [portfolioCapital, setPortfolioCapital] = useState<number>(500000); // Rs. 5 Lakhs
  const [riskPerTradePct, setRiskPerTradePct] = useState<number>(1.0); // 1%
  const [expandedCalc, setExpandedCalc] = useState<Record<string, boolean>>({});
  const [copiedSymbol, setCopiedSymbol] = useState<string | null>(null);

  // Local Storage persistence for view mode
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("apex_swing_view_mode");
      if (saved === "table" || saved === "cards") {
        setViewMode(saved);
      }
    }
  }, []);

  const handleSetViewMode = (mode: "table" | "cards") => {
    setViewMode(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem("apex_swing_view_mode", mode);
    }
  };

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await fetchApexSwingSetups({
        archetype: selectedArchetype !== "ALL" ? selectedArchetype : undefined,
        sector: selectedSector !== "ALL" ? selectedSector : undefined,
        min_conviction: minConviction > 0 ? minConviction : undefined,
        search: searchTerm || undefined,
        force_refresh: isRefresh,
      });

      setSetups(res.setups || []);
      setTelemetry(res.macro_telemetry || null);
      setFunnel(res.funnel || null);
      if (res.available_sectors && res.available_sectors.length > 0) {
        setAvailableSectors(res.available_sectors);
      }
    } catch (err: any) {
      console.error("Failed to load Apex Swing setups:", err);
      setError(err?.message || "Failed to load institutional swing setups.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedArchetype, selectedSector, minConviction, searchTerm]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleCalculator = (symbol: string) => {
    setExpandedCalc((prev) => ({
      ...prev,
      [symbol]: !prev[symbol],
    }));
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
    setPage(1);
  };

  const copyTradeTicket = (ticket: ApexSwingTicket) => {
    const bp = ticket.execution_blueprint;
    const gm = ticket.gap_metrics;
    const text = `🎯 *ALPHA APEX SWING SETUP: ${ticket.symbol}*
Company: ${ticket.company_name} (${ticket.sector})
Conviction: ${ticket.conviction_score}/100 (${ticket.conviction_tier})
Archetype: ${ticket.archetype_label}
Win Rate Expectation: ${ticket.win_rate_expectation} | Macro: ${ticket.macro_regime}

⚡ *TRADING GAP & CHASE METRICS:*
• Opening Gap: ${gm?.gap_pct ? `${gm.gap_pct >= 0 ? "+" : ""}${gm.gap_pct.toFixed(2)}%` : "0.00%"} (${gm?.gap_type || "NORMAL_OPEN"})
• Chase Status: ${gm?.chase_status || "IN_CORRIDOR"} (Room to Chase: ₹${gm?.room_to_chase_rupees ?? 0})
• 52-Week High Proximity: -${ticket.dist_52w_high_pct ?? 0}%

💰 *EXECUTION BLUEPRINT:*
• CMP: ₹${ticket.current_price.toLocaleString()}
• Buy Corridor: ₹${bp.buy_corridor_min} - ₹${bp.buy_corridor_max} (Max Chase: ₹${bp.max_chase_price})
• Invalidation / SL: ₹${bp.stop_loss} (-${bp.risk_pct}%)
• Target 1 (1.8R): ₹${bp.target_1} (+${bp.reward_pct_t1}%) [Book 40%, SL to Cost]
• Target 2 (3.4R): ₹${bp.target_2} (+${bp.reward_pct_t2}%) [Book 30%, Trail on 20 EMA]
• Target 3 (Full): ₹${bp.target_3} (+${bp.reward_pct_t3}%) | R:R ${bp.rr_ratio}

📊 *THE 4-PILLAR CATALYSTS:*
• Catalyst: ${ticket.theses.catalyst}
• Sponsorship: ${ticket.theses.sponsorship}
• Consensus: ${ticket.theses.street_consensus}
• Order Flow: ${ticket.theses.order_flow}
• Event Risk: ${ticket.next_earnings_risk} (Protected)`;

    navigator.clipboard.writeText(text);
    setCopiedSymbol(ticket.symbol);
    setTimeout(() => setCopiedSymbol(null), 2500);
  };

  // Pre-calculate count per archetype
  const archetypeCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: setups.length };
    setups.forEach((s) => {
      counts[s.archetype] = (counts[s.archetype] || 0) + 1;
    });
    return counts;
  }, [setups]);

  // Client-side filtering & sorting
  const filteredAndSortedSetups = useMemo(() => {
    let list = [...setups];

    // Filter by Gap Strategy
    if (selectedGapFilter === "GAP_AND_GO") {
      list = list.filter((s) => s.gap_metrics?.gap_type === "GAP_AND_GO");
    } else if (selectedGapFilter === "BREAKAWAY") {
      list = list.filter((s) => s.gap_metrics?.gap_type === "BREAKAWAY_GAP" || s.gap_metrics?.gap_type === "GAP_AND_GO");
    } else if (selectedGapFilter === "IN_CORRIDOR") {
      list = list.filter((s) => s.gap_metrics?.chase_status === "IN_CORRIDOR");
    } else if (selectedGapFilter === "NEAR_52W_HIGH") {
      list = list.filter((s) => (s.dist_52w_high_pct ?? 100) <= 12.0);
    }

    if (!sortBy) return list;

    return list.sort((a, b) => {
      let valA: any = 0;
      let valB: any = 0;

      if (sortBy === "conviction_score") {
        valA = a.conviction_score;
        valB = b.conviction_score;
      } else if (sortBy === "current_price") {
        valA = a.current_price;
        valB = b.current_price;
      } else if (sortBy === "gap_pct") {
        valA = a.gap_metrics?.gap_pct || 0;
        valB = b.gap_metrics?.gap_pct || 0;
      } else if (sortBy === "dist_52w_high_pct") {
        valA = a.dist_52w_high_pct || 0;
        valB = b.dist_52w_high_pct || 0;
      } else if (sortBy === "reward_pct_t1") {
        valA = a.execution_blueprint?.reward_pct_t1 || 0;
        valB = b.execution_blueprint?.reward_pct_t1 || 0;
      } else if (sortBy === "rr_ratio") {
        valA = parseFloat(a.execution_blueprint?.rr_ratio) || 0;
        valB = parseFloat(b.execution_blueprint?.rr_ratio) || 0;
      } else if (sortBy === "delivery_spike_x") {
        valA = a.order_flow_metrics?.delivery_spike_x || 0;
        valB = b.order_flow_metrics?.delivery_spike_x || 0;
      } else if (sortBy === "market_cap_cr") {
        valA = a.market_cap_cr || 0;
        valB = b.market_cap_cr || 0;
      } else if (sortBy === "symbol") {
        return sortOrder === "asc"
          ? a.symbol.localeCompare(b.symbol)
          : b.symbol.localeCompare(a.symbol);
      }

      return sortOrder === "asc" ? valA - valB : valB - valA;
    });
  }, [setups, selectedGapFilter, sortBy, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedSetups.length / limit));
  const paginatedSetups = useMemo(() => {
    const start = (page - 1) * limit;
    return filteredAndSortedSetups.slice(start, start + limit);
  }, [filteredAndSortedSetups, page, limit]);

  // Position Sizing Calculation for Drawer
  const drawerSizingCalculation = useMemo(() => {
    if (!selectedTicket) return null;
    const maxRiskRupees = (portfolioCapital * riskPerTradePct) / 100;
    const riskPerShare = Math.max(
      1,
      selectedTicket.current_price - selectedTicket.execution_blueprint.stop_loss
    );
    const sharesToBuy = Math.floor(maxRiskRupees / riskPerShare);
    const totalCapital = sharesToBuy * selectedTicket.current_price;
    const portfolioAllocationPct = ((totalCapital / portfolioCapital) * 100).toFixed(1);
    const profitAtT1 =
      sharesToBuy * 0.4 * (selectedTicket.execution_blueprint.target_1 - selectedTicket.current_price);
    const profitAtT2 =
      sharesToBuy * 0.3 * (selectedTicket.execution_blueprint.target_2 - selectedTicket.current_price);
    const profitAtT3 =
      sharesToBuy * 0.3 * (selectedTicket.execution_blueprint.target_3 - selectedTicket.current_price);

    return {
      maxRiskRupees,
      riskPerShare,
      sharesToBuy,
      totalCapital,
      portfolioAllocationPct,
      profitAtT1,
      profitAtT2,
      profitAtT3,
    };
  }, [selectedTicket, portfolioCapital, riskPerTradePct]);

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-3.5 pb-12">
        {/* ========================================================= */}
        {/* 1. COMPACT INSTITUTIONAL HEADER & QUICK TELEMETRY RIBBON  */}
        {/* ========================================================= */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#070F1E] p-3.5 shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-600/30 to-emerald-500/20 border border-cyan-500/40 text-cyan-400 shrink-0 shadow-md shadow-cyan-950/40">
                <Target className="w-5 h-5 text-cyan-400 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white font-mono flex items-center gap-2">
                    APEX SWING SNIPER
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 uppercase tracking-widest">
                      Institutional v4.2 PRO
                    </span>
                  </h1>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Asymmetric Swing Radar unifying PEAD Drift, Runaway Guidance, Broker Consensus, MF Absorption &amp; Real-Time Gap Intelligence.
                </p>
              </div>
            </div>

            {/* Compact Header Summary Badges & Action Controls */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {/* Telemetry Summary Pill */}
              {telemetry && (
                <div className="hidden sm:flex items-center gap-2 rounded-lg bg-slate-100 dark:bg-slate-900/90 border border-slate-300 dark:border-slate-800 px-2.5 py-1 text-[11px] font-mono">
                  <span className="flex items-center gap-1 text-cyan-400 font-semibold">
                    <Compass size={12} />
                    {telemetry.market_bias.replace(/_/g, " ")}
                  </span>
                  <span className="text-slate-500 dark:text-slate-600">•</span>
                  <span className="text-emerald-400 font-bold">{telemetry.sizing_multiplier}x Risk</span>
                  <span className="text-slate-500 dark:text-slate-600">•</span>
                  <span className="text-slate-400">Avg R:R {telemetry.avg_risk_reward}</span>
                </div>
              )}

              {/* Toggle Macro & Waterfall */}
              <button
                onClick={() => setShowTelemetry((v) => !v)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                  showTelemetry
                    ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-xs"
                    : "bg-slate-100 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-800 hover:text-white"
                }`}
                title="Toggle Macro Telemetry & Attrition Funnel Waterfall"
              >
                <Layers size={13} className="text-cyan-400" />
                <span>{showTelemetry ? "Hide Macro & Funnel" : "Macro & Funnel"}</span>
                {showTelemetry ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>

              {/* Toggle Interactive Position Sizer */}
              <button
                onClick={() => setShowPositionSizer((v) => !v)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                  showPositionSizer
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-xs"
                    : "bg-slate-100 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-800 hover:text-white"
                }`}
                title="Toggle Interactive Capital Position Sizer"
              >
                <Calculator size={13} className="text-emerald-400" />
                <span>{showPositionSizer ? "Hide Sizer" : "Position Sizer"}</span>
                {showPositionSizer ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>

              {/* Force Rescan Button */}
              <button
                onClick={() => loadData(true)}
                disabled={refreshing || loading}
                className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-cyan-400 font-bold text-xs px-3 py-1.5 rounded-lg transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
                <span>{refreshing ? "Scanning..." : "Rescan"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 2. COLLAPSIBLE MACRO TELEMETRY & EVENT SHIELD RIBBON      */}
        {/* ========================================================= */}
        {showTelemetry && telemetry && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-fadeIn">
            {/* Market Regime */}
            <div className="bg-[#070E1A] border border-slate-800/90 rounded-xl p-3.5 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1 font-mono">
                <span>MACRO REGIME</span>
                <Compass className="w-3.5 h-3.5 text-cyan-400" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-base sm:text-lg font-black text-white font-mono uppercase tracking-tight">
                  {telemetry.market_bias.replace(/_/g, " ")}
                </span>
              </div>
              <div className="text-[10px] text-cyan-400/90 font-medium mt-0.5 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                Nifty: {telemetry.nifty_trend} · Risk: {telemetry.risk_level}
              </div>
            </div>

            {/* Position Sizing Multiplier */}
            <div className="bg-[#070E1A] border border-slate-800/90 rounded-xl p-3.5 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1 font-mono">
                <span>CAPITAL SIZING</span>
                <Gauge className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-base sm:text-lg font-black text-emerald-400 font-mono">
                  {telemetry.sizing_multiplier}x
                </span>
                <span className="text-[10px] text-slate-400">Position Multiplier</span>
              </div>
              <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                {telemetry.sizing_multiplier >= 1.0 ? "Full Risk Deployment" : "Pragmatic Risk Cushioning"}
              </div>
            </div>

            {/* Binary Event Risk Shield */}
            <div className="bg-[#070E1A] border border-slate-800/90 rounded-xl p-3.5 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1 font-mono">
                <span>EVENT RISK SHIELD</span>
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-base sm:text-lg font-black text-cyan-300 font-mono">
                  100%
                </span>
                <span className="text-[10px] text-emerald-400 font-bold uppercase">SECURED</span>
              </div>
              <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                {telemetry.blacklisted_event_count} Board Meetings Blacklisted
              </div>
            </div>

            {/* Total Asymmetric Opportunities */}
            <div className="bg-[#070E1A] border border-slate-800/90 rounded-xl p-3.5 shadow-sm relative overflow-hidden">
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1 font-mono">
                <span>ACTIVE APEX SETUPS</span>
                <Target className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-base sm:text-lg font-black text-white font-mono">
                  {setups.length}
                </span>
                <span className="text-[10px] text-amber-400 font-mono font-bold">
                  Avg R:R {telemetry.avg_risk_reward}
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                Filtered from 2,000+ NSE/BSE Universe
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 3. COLLAPSIBLE 5-STAGE ATTRITION FUNNEL WATERFALL         */}
        {/* ========================================================= */}
        {showTelemetry && funnel && (
          <div className="bg-[#050C17]/90 border border-slate-800/90 rounded-xl p-3.5 shadow-sm animate-fadeIn">
            <div className="flex items-center justify-between mb-2.5 border-b border-slate-800/80 pb-1.5">
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-[11px] font-bold text-white uppercase tracking-wider font-mono">
                  Institutional Elimination Waterfall (Zero False-Breakout Architecture)
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                Sub-60ms Execution Engine
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                <div className="text-[9px] text-slate-400 font-mono">1. UNIVERSE</div>
                <div className="text-sm font-bold text-white font-mono mt-0.5">{funnel.universe_scanned}</div>
                <div className="text-[9px] text-slate-400">Scanned Candidates</div>
              </div>
              <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                <div className="text-[9px] text-cyan-400 font-mono">2. LIQUIDITY</div>
                <div className="text-sm font-bold text-cyan-300 font-mono mt-0.5">{funnel.passed_liquidity}</div>
                <div className="text-[9px] text-slate-400">Turnover &ge; ₹1 Cr</div>
              </div>
              <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                <div className="text-[9px] text-emerald-400 font-mono">3. EVENT SHIELD</div>
                <div className="text-sm font-bold text-emerald-300 font-mono mt-0.5">{funnel.passed_event_shield}</div>
                <div className="text-[9px] text-slate-400">0 Blackout Risk</div>
              </div>
              <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                <div className="text-[9px] text-amber-400 font-mono">4. TRAP FILTER</div>
                <div className="text-sm font-bold text-amber-300 font-mono mt-0.5">{funnel.passed_extension_filter}</div>
                <div className="text-[9px] text-slate-400">No Upper Wicks</div>
              </div>
              <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                <div className="text-[9px] text-purple-400 font-mono">5. CATALYST PROOF</div>
                <div className="text-sm font-bold text-purple-300 font-mono mt-0.5">{funnel.passed_catalyst_validation}</div>
                <div className="text-[9px] text-slate-400">PEAD / Runaway / Order</div>
              </div>
              <div className="p-2 rounded-lg bg-cyan-950/40 border border-cyan-500/50 shadow-inner">
                <div className="text-[9px] text-cyan-300 font-mono font-bold">6. APEX TRADES</div>
                <div className="text-sm font-black text-cyan-200 font-mono mt-0.5">{setups.length}</div>
                <div className="text-[9px] text-cyan-400/90 font-medium">Ready for Execution</div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 4. COLLAPSIBLE GLOBAL POSITION SIZER CONTROLS BAR         */}
        {/* ========================================================= */}
        {showPositionSizer && (
          <div className="bg-[#060D19] border border-cyan-500/30 rounded-xl p-3.5 shadow-md flex flex-col md:flex-row items-center justify-between gap-3 animate-fadeIn">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400">
                <Calculator className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-white uppercase font-mono tracking-wider flex items-center gap-1.5">
                  Interactive Institutional Position Sizer
                  <span className="text-[10px] text-cyan-400 font-normal">
                    (Auto-calculates exact shares per trade)
                  </span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Golden Rule: Never risk more than 1% of total portfolio equity on any single swing setup.
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-xs">
                <span className="text-slate-400 font-mono">Portfolio Capital:</span>
                <span className="text-slate-400 font-bold">₹</span>
                <input
                  type="number"
                  value={portfolioCapital}
                  onChange={(e) => setPortfolioCapital(Number(e.target.value))}
                  className="bg-transparent text-white font-mono font-bold w-24 outline-none focus:text-cyan-400 text-right"
                />
              </div>

              <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg text-xs">
                <span className="text-slate-400 font-mono">Risk Per Trade:</span>
                <input
                  type="number"
                  step="0.25"
                  value={riskPerTradePct}
                  onChange={(e) => setRiskPerTradePct(Number(e.target.value))}
                  className="bg-transparent text-emerald-400 font-mono font-bold w-12 outline-none text-right"
                />
                <span className="text-emerald-400 font-bold">%</span>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* 5. MULTI-FILTER TOOLBAR, SECTOR SELECTOR & SEARCH         */}
        {/* ========================================================= */}
        <div className="flex flex-col gap-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#081225] p-3 shadow-xs">
          {/* Row 1: Archetype Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full no-scrollbar">
            {ARCHETYPE_TABS.map((tab) => {
              const count = archetypeCounts[tab.id] || 0;
              const isActive = selectedArchetype === tab.id;
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setSelectedArchetype(tab.id);
                    setPage(1);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? "bg-gradient-to-r from-cyan-600 to-cyan-500 text-slate-950 shadow-md shadow-cyan-950/40"
                      : "bg-slate-100 dark:bg-slate-900/80 hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <TabIcon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                  <span
                    className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                      isActive
                        ? "bg-slate-950/40 text-slate-950 font-black"
                        : "bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Row 2: Secondary Dropdowns (Sector & Gap Strategy), Search & Mode Switcher */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1 border-t border-slate-200 dark:border-slate-800/80">
            <div className="flex flex-wrap items-center gap-2">
              {/* Sector Dropdown */}
              <div className="flex items-center gap-1.5">
                <SlidersHorizontal size={13} className="text-slate-400" />
                <select
                  value={selectedSector}
                  onChange={(e) => {
                    setSelectedSector(e.target.value);
                    setPage(1);
                  }}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/90 py-1 px-2 text-xs text-slate-900 dark:text-white outline-none focus:border-cyan-500 font-medium cursor-pointer"
                >
                  <option value="ALL">All Sectors</option>
                  {availableSectors.map((sec) => (
                    <option key={sec} value={sec} className="bg-slate-900 text-white">
                      {sec}
                    </option>
                  ))}
                </select>
              </div>

              {/* Trading Gap Strategy Dropdown */}
              <div className="flex items-center gap-1.5">
                <Radio size={13} className="text-cyan-400" />
                <select
                  value={selectedGapFilter}
                  onChange={(e) => {
                    setSelectedGapFilter(e.target.value);
                    setPage(1);
                  }}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/90 py-1 px-2 text-xs text-slate-900 dark:text-white outline-none focus:border-cyan-500 font-medium cursor-pointer"
                >
                  <option value="ALL">All Gap Openings</option>
                  <option value="GAP_AND_GO">🚀 Gap-and-Go (+2.0%+)</option>
                  <option value="BREAKAWAY">⚡ Breakaway Gaps (+1.2%+)</option>
                  <option value="IN_CORRIDOR">🛡️ In Buy Corridor Only</option>
                  <option value="NEAR_52W_HIGH">🎯 Proximity &le; 12% 52W High</option>
                </select>
              </div>
            </div>

            {/* View Mode Toggle, Search Box & Setup Count */}
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              {/* View Mode Switcher */}
              <div className="flex items-center rounded-lg border border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/90 p-0.5">
                <button
                  onClick={() => handleSetViewMode("table")}
                  title="Table View (Techno-Funda Style)"
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                    viewMode === "table"
                      ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-xs"
                      : "text-slate-500 hover:text-white"
                  }`}
                >
                  <TableProperties size={13} />
                  <span>Table</span>
                </button>
                <button
                  onClick={() => handleSetViewMode("cards")}
                  title="Detailed Cards View"
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                    viewMode === "cards"
                      ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-xs"
                      : "text-slate-500 hover:text-white"
                  }`}
                >
                  <LayoutGrid size={13} />
                  <span>Cards</span>
                </button>
              </div>

              {/* Search Box */}
              <div className="relative min-w-[160px] sm:w-56">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search ticker, company..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/90 py-1.5 pl-9 pr-8 text-xs text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:border-cyan-500/60"
                />
                {searchTerm && (
                  <button
                    onClick={() => {
                      setSearchTerm("");
                      setPage(1);
                    }}
                    className="absolute right-2.5 top-2 text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Counter */}
              <div className="text-xs text-slate-400 font-mono whitespace-nowrap">
                <strong className="text-cyan-400">{filteredAndSortedSetups.length}</strong> setups
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 6. EXECUTION SETUPS: TABLE VIEW OR CARDS VIEW             */}
        {/* ========================================================= */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <RefreshCw className="w-8 h-8 animate-spin text-cyan-400" />
            <p className="text-sm font-mono tracking-wider">Synthesizing Screeners, Order Flows &amp; Gap Metrics...</p>
          </div>
        ) : filteredAndSortedSetups.length === 0 ? (
          <div className="bg-[#070E1A] border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
            <Target className="w-12 h-12 text-slate-400 mx-auto mb-3 opacity-40" />
            <h3 className="text-base font-bold text-white font-mono">No Qualifying Setups for Selected Filter</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
              Our 5 Kill Gates &amp; Event Risk Shield enforce strict institutional standards. Try loosening filters or switching archetypes.
            </p>
          </div>
        ) : viewMode === "table" ? (
          /* ========================================================= */
          /* 6A. INSTITUTIONAL COMPACT DATA TABLE (TECHNO-FUNDA STYLE) */
          /* ========================================================= */
          <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#060D1A] shadow-xs dark:shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#09152A] text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 select-none">
                  <tr>
                    <th
                      onClick={() => handleSort("symbol")}
                      className="px-4 py-3 font-semibold cursor-pointer hover:text-white transition"
                    >
                      <div className="flex items-center gap-1">
                        <span># & Symbol / Company</span>
                        <ArrowUpDown size={11} />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort("current_price")}
                      className="px-3 py-3 font-semibold cursor-pointer hover:text-white transition"
                    >
                      <div className="flex items-center gap-1">
                        <span>CMP / 52W High</span>
                        <ArrowUpDown size={11} />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort("gap_pct")}
                      className="px-3 py-3 font-semibold cursor-pointer hover:text-white transition"
                    >
                      <div className="flex items-center gap-1">
                        <span>Opening Gap & Chase</span>
                        <ArrowUpDown size={11} />
                      </div>
                    </th>
                    <th className="px-3 py-3 font-semibold">Trend</th>
                    <th
                      onClick={() => handleSort("conviction_score")}
                      className="px-3 py-3 font-semibold cursor-pointer hover:text-white transition"
                    >
                      <div className="flex items-center gap-1">
                        <span>Conviction</span>
                        <ArrowUpDown size={11} />
                      </div>
                    </th>
                    <th className="px-3 py-3 font-semibold">Archetype</th>
                    <th className="px-3 py-3 font-semibold">Buy Corridor</th>
                    <th className="px-3 py-3 font-semibold">Stop Loss</th>
                    <th
                      onClick={() => handleSort("reward_pct_t1")}
                      className="px-3 py-3 font-semibold cursor-pointer hover:text-white transition"
                    >
                      <div className="flex items-center gap-1">
                        <span>Target 1 (1.8R)</span>
                        <ArrowUpDown size={11} />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort("rr_ratio")}
                      className="px-3 py-3 font-semibold cursor-pointer hover:text-white transition"
                    >
                      <div className="flex items-center gap-1">
                        <span>Targets & R:R</span>
                        <ArrowUpDown size={11} />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort("delivery_spike_x")}
                      className="px-3 py-3 font-semibold cursor-pointer hover:text-white transition"
                    >
                      <div className="flex items-center gap-1">
                        <span>Order Flow</span>
                        <ArrowUpDown size={11} />
                      </div>
                    </th>
                    <th className="px-3 py-3 font-semibold">Primary Catalyst</th>
                    <th className="px-4 py-3 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono text-[12px]">
                  {paginatedSetups.map((ticket, idx) => {
                    const bp = ticket.execution_blueprint;
                    const ofm = ticket.order_flow_metrics;
                    const gm = ticket.gap_metrics;
                    const globalRank = (page - 1) * limit + idx + 1;

                    return (
                      <tr
                        key={ticket.symbol}
                        onClick={() => setSelectedTicket(ticket)}
                        className="cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-800/40 group"
                      >
                        {/* 1. SYMBOL & COMPANY */}
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-2">
                            <AddToWatchlistButton
                              symbol={ticket.symbol}
                              companyName={ticket.company_name}
                              currentPrice={ticket.current_price}
                              sector={ticket.sector}
                              defaultConviction={ticket.conviction_score}
                              variant="star"
                            />
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-slate-500 font-mono font-bold">
                                  #{globalRank}
                                </span>
                                <Link
                                  href={`/stocks/${ticket.symbol}`}
                                  className="font-bold text-slate-900 dark:text-white group-hover:text-cyan-400 transition hover:underline cursor-pointer"
                                >
                                  {ticket.symbol}
                                </Link>
                                {ticket.conviction_score >= 84 && (
                                  <span className="rounded bg-amber-500/15 border border-amber-500/40 px-1.5 py-0.2 text-[9px] font-sans font-bold text-amber-400 animate-pulse">
                                    ★ APEX
                                  </span>
                                )}
                                {ticket.diamond_catalyst && (
                                  <span className="rounded bg-cyan-500/15 border border-cyan-500/40 px-1.5 py-0.2 text-[9px] font-sans font-bold text-cyan-300">
                                    💎 DIAMOND
                                  </span>
                                )}
                              </div>
                              <div className="font-sans text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 max-w-[140px]">
                                {ticket.company_name}
                              </div>
                              <div className="text-[10px] text-cyan-600 dark:text-cyan-400/80 font-sans line-clamp-1">
                                {ticket.sector}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 2. CMP & 52W HIGH DISTANCE */}
                        <td className="px-3 py-3">
                          <div className="font-bold text-slate-900 dark:text-white">
                            ₹{ticket.current_price?.toLocaleString()}
                          </div>
                          <div className="text-[10px] flex items-center gap-1 font-sans">
                            <span
                              className={
                                (ticket.day_change_pct || 0) >= 0
                                  ? "text-emerald-400 font-semibold"
                                  : "text-rose-400 font-semibold"
                              }
                            >
                              {(ticket.day_change_pct || 0) >= 0 ? "+" : ""}
                              {ticket.day_change_pct?.toFixed(2)}%
                            </span>
                            <span
                              className={`font-mono text-[9px] ${
                                (ticket.dist_52w_high_pct ?? 100) <= 8.0
                                  ? "text-emerald-400 font-bold"
                                  : (ticket.dist_52w_high_pct ?? 100) <= 15.0
                                  ? "text-cyan-300"
                                  : "text-slate-500"
                              }`}
                            >
                              (-{ticket.dist_52w_high_pct ?? 0}% 52W H)
                            </span>
                          </div>
                        </td>

                        {/* 3. OPENING GAP & CHASE CORRIDOR */}
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`inline-flex items-center rounded px-1.5 py-0.2 text-[10px] font-bold font-mono border ${
                                gm?.gap_type === "GAP_AND_GO"
                                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/40"
                                  : gm?.gap_type === "BREAKAWAY_GAP"
                                  ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/40"
                                  : gm?.gap_type === "RUNAWAY_GAP"
                                  ? "bg-purple-500/15 text-purple-300 border-purple-500/40"
                                  : gm?.gap_type === "GAP_DOWN"
                                  ? "bg-rose-500/15 text-rose-400 border-rose-500/40"
                                  : "bg-slate-800 text-slate-400 border-slate-700"
                              }`}
                            >
                              {gm?.gap_pct ? `${gm.gap_pct >= 0 ? "+" : ""}${gm.gap_pct.toFixed(1)}%` : "0.0%"}
                            </span>
                            <span className="text-[10px] text-slate-400 font-sans">
                              {gm?.gap_type?.replace(/_/g, " ") || "Normal"}
                            </span>
                          </div>
                          <div className="text-[10px] font-sans mt-0.5">
                            {gm?.chase_status === "IN_CORRIDOR" ? (
                              <span className="text-emerald-400 font-semibold flex items-center gap-0.5">
                                <CheckCircle2 size={10} />
                                In Corridor (₹{gm.room_to_chase_rupees} room)
                              </span>
                            ) : gm?.chase_status === "NEAR_CEILING" ? (
                              <span className="text-amber-400 font-semibold">
                                Near Ceiling (₹{gm?.room_to_chase_rupees} room)
                              </span>
                            ) : (
                              <span className="text-rose-400 font-semibold">
                                Overextended (Don't Chase)
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 4. TREND SPARKLINE */}
                        <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                          <SparklineChart
                            data={ticket.sparkline}
                            cmp={ticket.current_price}
                            width={75}
                            height={20}
                            periodLabel="90D"
                            showDot={true}
                            showBadge={false}
                          />
                        </td>

                        {/* 5. CONVICTION SCORE */}
                        <td className="px-3 py-3 font-sans">
                          <div className="flex flex-col gap-0.5">
                            <span
                              className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-bold font-mono border ${
                                ticket.conviction_score >= 85
                                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                  : ticket.conviction_score >= 75
                                  ? "bg-cyan-500/10 text-cyan-300 border-cyan-500/30"
                                  : "bg-amber-500/10 text-amber-300 border-amber-500/30"
                              }`}
                            >
                              <Flame
                                size={12}
                                className={
                                  ticket.conviction_score >= 85 ? "text-emerald-400" : "text-cyan-400"
                                }
                              />
                              <span>{Math.round(ticket.conviction_score)}/100</span>
                            </span>
                            <div className="text-[10px] text-cyan-400 font-mono tracking-tight">
                              {ticket.win_rate_expectation}
                            </div>
                          </div>
                        </td>

                        {/* 6. ARCHETYPE */}
                        <td className="px-3 py-3 font-sans">
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold border ${
                              ticket.archetype === "RUNAWAY_CATALYST"
                                ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/40"
                                : ticket.archetype === "TRIPLE_ALPHA_PEAD"
                                ? "bg-amber-500/10 text-amber-300 border-amber-500/30"
                                : ticket.archetype === "ORDER_WIN_CATALYST"
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                : ticket.archetype === "STEALTH_FLOAT_COIL"
                                ? "bg-purple-500/10 text-purple-300 border-purple-500/30"
                                : ticket.archetype === "EMA20_DEFENDER"
                                ? "bg-cyan-500/10 text-cyan-300 border-cyan-500/30"
                                : "bg-slate-800 text-slate-300 border-slate-700"
                            }`}
                          >
                            <Sparkles size={10} />
                            {ticket.archetype_label}
                          </span>
                        </td>

                        {/* 7. BUY CORRIDOR */}
                        <td className="px-3 py-3 font-mono text-[11px]">
                          <div className="text-cyan-300 font-semibold">
                            ₹{bp.buy_corridor_min} – ₹{bp.buy_corridor_max}
                          </div>
                          <div className="text-[10px] text-amber-400 font-sans">
                            Max Chase: ₹{bp.max_chase_price}
                          </div>
                        </td>

                        {/* 8. STOP LOSS (RISK) */}
                        <td className="px-3 py-3 font-mono text-[11px]">
                          <div className="text-rose-400 font-semibold">
                            ₹{bp.stop_loss.toLocaleString()}
                          </div>
                          <div className="text-[10px] text-rose-400/80 font-sans">
                            -{bp.risk_pct}% Risk
                          </div>
                        </td>

                        {/* 9. TARGET 1 */}
                        <td className="px-3 py-3 font-mono text-[11px]">
                          <div className="text-emerald-400 font-bold">
                            ₹{bp.target_1.toLocaleString()}
                          </div>
                          <div className="text-[10px] text-emerald-400/80 font-sans">
                            +{bp.reward_pct_t1}% (Book 40%)
                          </div>
                        </td>

                        {/* 10. TARGETS & R:R */}
                        <td className="px-3 py-3 font-mono text-[11px]">
                          <div className="flex items-center gap-1.5">
                            <span className="text-white font-semibold">T2: ₹{bp.target_2}</span>
                            <span className="rounded bg-cyan-500/10 text-cyan-300 px-1.5 py-0.2 text-[9px] font-bold border border-cyan-500/30">
                              {bp.rr_ratio} R:R
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-sans">
                            T3: ₹{bp.target_3} (+{bp.reward_pct_t3}%)
                          </div>
                        </td>

                        {/* 11. ORDER FLOW & DELIVERY */}
                        <td className="px-3 py-3 font-sans">
                          <div className="flex items-center gap-1 font-mono text-[11px]">
                            <Flame
                              size={12}
                              className={
                                (ofm?.delivery_spike_x || 0) >= 2.0
                                  ? "text-amber-400"
                                  : "text-cyan-400"
                              }
                            />
                            <span className="text-slate-200 font-bold">
                              {ofm?.delivery_spike_x}x Spike
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            Del: {ofm?.delivery_per}% | ₹{ofm?.turnover_cr} Cr
                          </div>
                        </td>

                        {/* 12. PRIMARY CATALYST */}
                        <td className="px-3 py-3 font-sans max-w-[200px]">
                          <div
                            className="text-[11px] text-slate-300 line-clamp-2 leading-tight"
                            title={ticket.theses?.catalyst}
                          >
                            {ticket.theses?.catalyst}
                          </div>
                          <div className="flex items-center gap-1 mt-0.5 text-[9px] text-emerald-400 font-mono">
                            <ShieldCheck size={10} />
                            <span>Event Shield: Protected</span>
                          </div>
                        </td>

                        {/* 13. ACTIONS */}
                        <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setSelectedTicket(ticket)}
                              className="rounded bg-cyan-500/10 border border-cyan-500/30 px-2 py-1 text-[11px] font-medium text-cyan-300 hover:bg-cyan-500 hover:text-slate-950 transition cursor-pointer"
                              title="Inspect Setup Blueprint & Position Sizing"
                            >
                              <span>Inspect</span>
                            </button>

                            <button
                              onClick={() => copyTradeTicket(ticket)}
                              className="rounded bg-slate-800 border border-slate-700 p-1 text-slate-300 hover:border-cyan-500 hover:text-white transition cursor-pointer"
                              title="Copy trade ticket to clipboard"
                            >
                              {copiedSymbol === ticket.symbol ? (
                                <Check size={12} className="text-emerald-400" />
                              ) : (
                                <Copy size={12} className="text-cyan-400" />
                              )}
                            </button>

                            <Link
                              href={`/stocks/${ticket.symbol}`}
                              className="rounded bg-slate-800 border border-slate-700 p-1 text-slate-300 hover:border-cyan-500 hover:text-white transition cursor-pointer"
                              title="Full Stock Terminal"
                            >
                              <ExternalLink size={12} />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* PAGINATION (TECHNO-FUNDA STYLE) */}
            <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#081225] px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
              <div>
                Showing <span className="font-semibold text-slate-900 dark:text-white">{paginatedSetups.length}</span> of{" "}
                <span className="font-semibold text-slate-900 dark:text-white">{filteredAndSortedSetups.length}</span> Apex Swing setups
              </div>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1 font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 cursor-pointer"
                >
                  Previous
                </button>
                <span>
                  Page <strong className="text-slate-900 dark:text-white">{page}</strong> of <strong>{totalPages}</strong>
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1 font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ========================================================= */
          /* 6B. DETAILED CARDS VIEW                                   */
          /* ========================================================= */
          <div className="space-y-4">
            {filteredAndSortedSetups.map((ticket, idx) => {
              const bp = ticket.execution_blueprint;
              const ofm = ticket.order_flow_metrics;
              const gm = ticket.gap_metrics;
              const isCalcOpen = Boolean(expandedCalc[ticket.symbol]);

              // Interactive Sizing Math
              const maxRiskRupees = (portfolioCapital * riskPerTradePct) / 100;
              const riskPerShare = Math.max(1, ticket.current_price - bp.stop_loss);
              const sharesToBuy = Math.floor(maxRiskRupees / riskPerShare);
              const totalCapitalRequired = sharesToBuy * ticket.current_price;
              const portfolioAllocationPct = ((totalCapitalRequired / portfolioCapital) * 100).toFixed(1);
              const profitAtT1 = sharesToBuy * 0.4 * (bp.target_1 - ticket.current_price);
              const profitAtT2 = sharesToBuy * 0.3 * (bp.target_2 - ticket.current_price);

              return (
                <div
                  key={`${ticket.symbol}-${idx}`}
                  className="bg-[#070E1B] border border-slate-800/90 hover:border-cyan-500/40 rounded-2xl p-4 sm:p-5 shadow-lg transition-all relative overflow-hidden"
                >
                  {/* Glowing Top Edge for Apex Sniper */}
                  {ticket.conviction_score >= 84.0 && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-cyan-500 via-emerald-400 to-amber-400" />
                  )}

                  {/* Top Bar: Identity, Archetype & Conviction */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center font-mono font-black text-slate-400 shrink-0">
                        #{idx + 1}
                      </div>

                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/stocks/${ticket.symbol}`}
                            className="text-lg sm:text-xl font-black text-white hover:text-cyan-400 font-mono tracking-tight transition-colors flex items-center gap-1.5"
                          >
                            {ticket.symbol}
                            <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                          </Link>
                          <span className="text-xs text-slate-400 font-medium">
                            {ticket.company_name}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-400 font-mono">
                            {ticket.sector}
                          </span>
                          {ticket.diamond_catalyst && (
                            <span className="rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-2 py-0.5 text-[10px] font-bold font-mono">
                              💎 {ticket.diamond_catalyst.metric_highlight}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-cyan-950/60 text-cyan-300 border border-cyan-500/40 flex items-center gap-1 font-mono">
                            <Sparkles className="w-3 h-3 text-cyan-400" />
                            {ticket.archetype_label}
                          </span>

                          {/* Gap Metric Badge */}
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-300 font-mono flex items-center gap-1">
                            <span>Gap:</span>
                            <strong className={gm?.gap_pct && gm.gap_pct >= 0 ? "text-emerald-400" : "text-rose-400"}>
                              {gm?.gap_pct ? `${gm.gap_pct >= 0 ? "+" : ""}${gm.gap_pct.toFixed(2)}%` : "0%"}
                            </strong>
                            <span className="text-slate-500 font-sans">({gm?.gap_type || "Normal"})</span>
                          </span>

                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-emerald-950/40 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 font-mono">
                            <ShieldCheck className="w-3 h-3" />
                            0 Binary Risk
                          </span>

                          <span className="text-[10px] text-slate-400 font-mono">
                            MCap: ₹{ticket.market_cap_cr ? ticket.market_cap_cr.toLocaleString() : "N/A"} Cr
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Conviction Score & Action Buttons */}
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2.5 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-xl">
                        <div className="text-right">
                          <div className="text-[9px] text-slate-400 font-mono uppercase tracking-wider">
                            CONVICTION
                          </div>
                          <div className="text-[11px] font-bold text-cyan-400 font-mono">
                            {ticket.win_rate_expectation}
                          </div>
                        </div>
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-cyan-600/30 to-emerald-500/20 border border-cyan-500/50 flex flex-col items-center justify-center">
                          <span className="text-base font-black text-white font-mono leading-none">
                            {Math.round(ticket.conviction_score)}
                          </span>
                          <span className="text-[7px] text-cyan-300 font-bold uppercase mt-0.5">
                            {ticket.conviction_tier.split("_")[0]}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => copyTradeTicket(ticket)}
                        title="Copy trade ticket to clipboard"
                        className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-white transition-all cursor-pointer"
                      >
                        {copiedSymbol === ticket.symbol ? (
                          <Check className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Copy className="w-4 h-4 text-cyan-400" />
                        )}
                      </button>

                      <AddToWatchlistButton
                        symbol={ticket.symbol}
                        companyName={ticket.company_name}
                        currentPrice={ticket.current_price}
                        sector={ticket.sector}
                        defaultConviction={ticket.conviction_score}
                        variant="icon"
                        size="md"
                      />
                    </div>
                  </div>

                  {/* Execution Rupee Ladder */}
                  <div className="mt-3.5 p-3 rounded-xl bg-[#050C17] border border-slate-800/90">
                    <div className="flex items-center justify-between text-xs text-slate-400 font-mono mb-2">
                      <span className="flex items-center gap-1.5 text-white font-bold">
                        <Target className="w-3.5 h-3.5 text-cyan-400" />
                        EXACT RUPEE EXECUTION LADDER
                      </span>
                      <span className="text-cyan-400 font-bold">
                        R:R {bp.rr_ratio} · Horizon: {bp.holding_horizon}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                      <div className="p-2.5 rounded-lg bg-rose-950/20 border border-rose-500/30">
                        <div className="text-[9px] text-rose-400 font-mono font-bold flex items-center justify-between">
                          <span>HARD STOP LOSS</span>
                          <span>-{bp.risk_pct}%</span>
                        </div>
                        <div className="text-base font-black text-rose-300 font-mono mt-0.5">
                          ₹{bp.stop_loss.toLocaleString()}
                        </div>
                      </div>

                      <div className="p-2.5 rounded-lg bg-cyan-950/30 border border-cyan-500/50 shadow-inner sm:col-span-2 lg:col-span-1">
                        <div className="text-[9px] text-cyan-300 font-mono font-bold flex items-center justify-between">
                          <span>BUY CORRIDOR</span>
                          <span className="text-white">CMP ₹{ticket.current_price.toLocaleString()}</span>
                        </div>
                        <div className="text-sm sm:text-base font-black text-cyan-200 font-mono mt-0.5">
                          ₹{bp.buy_corridor_min} – ₹{bp.buy_corridor_max}
                        </div>
                        <div className="text-[9px] text-amber-400 truncate font-medium">
                          Max Chase: ₹{bp.max_chase_price}
                        </div>
                      </div>

                      <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                        <div className="text-[9px] text-slate-400 font-mono font-bold flex items-center justify-between">
                          <span>TARGET 1 (1.8R)</span>
                          <span className="text-emerald-400">+{bp.reward_pct_t1}%</span>
                        </div>
                        <div className="text-base font-black text-white font-mono mt-0.5">
                          ₹{bp.target_1.toLocaleString()}
                        </div>
                        <div className="text-[9px] text-slate-400 truncate">Book 40%, SL to Cost</div>
                      </div>

                      <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                        <div className="text-[9px] text-slate-400 font-mono font-bold flex items-center justify-between">
                          <span>TARGET 2 (3.4R)</span>
                          <span className="text-emerald-400">+{bp.reward_pct_t2}%</span>
                        </div>
                        <div className="text-base font-black text-emerald-400 font-mono mt-0.5">
                          ₹{bp.target_2.toLocaleString()}
                        </div>
                        <div className="text-[9px] text-slate-400 truncate">Book 30%, Trail 20 EMA</div>
                      </div>

                      <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                        <div className="text-[9px] text-slate-400 font-mono font-bold flex items-center justify-between">
                          <span>TARGET 3 (FULL)</span>
                          <span className="text-cyan-400">+{bp.reward_pct_t3}%</span>
                        </div>
                        <div className="text-base font-black text-cyan-300 font-mono mt-0.5">
                          ₹{bp.target_3.toLocaleString()}
                        </div>
                        <div className="text-[9px] text-slate-400 truncate">Full Institutional Target</div>
                      </div>
                    </div>
                  </div>

                  {/* 4-Pillar Qualitative Validation Grid */}
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
                      <div className="text-[9px] text-amber-400 font-mono font-bold flex items-center gap-1 mb-0.5">
                        <Zap className="w-3 h-3" />
                        1. CATALYST FIREPOWER
                      </div>
                      <div className="text-slate-200 text-[11px] leading-tight font-sans">
                        {ticket.theses.catalyst}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
                      <div className="text-[9px] text-cyan-400 font-mono font-bold flex items-center gap-1 mb-0.5">
                        <ShieldCheck className="w-3 h-3" />
                        2. CONCALL &amp; SPONSORSHIP
                      </div>
                      <div className="text-slate-200 text-[11px] leading-tight font-sans">
                        {ticket.theses.sponsorship}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
                      <div className="text-[9px] text-emerald-400 font-mono font-bold flex items-center gap-1 mb-0.5">
                        <TrendingUp className="w-3 h-3" />
                        3. STREET CONSENSUS
                      </div>
                      <div className="text-slate-200 text-[11px] leading-tight font-sans">
                        {ticket.theses.street_consensus}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80">
                      <div className="text-[9px] text-purple-400 font-mono font-bold flex items-center gap-1 mb-0.5">
                        <Flame className="w-3 h-3" />
                        4. ORDER FLOW IGNITION
                      </div>
                      <div className="text-slate-200 text-[11px] leading-tight font-sans">
                        {ticket.theses.order_flow}
                      </div>
                    </div>
                  </div>

                  {/* Interactive Sizing Accordion Toggle */}
                  <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between">
                    <button
                      onClick={() => toggleCalculator(ticket.symbol)}
                      className="text-xs text-cyan-400 hover:text-cyan-300 font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Calculator className="w-3.5 h-3.5" />
                      <span>{isCalcOpen ? "Hide Sizing Calculation" : "Calculate Exact Shares & Capital"}</span>
                      {isCalcOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>

                    <div className="text-[10px] text-slate-400 font-mono">
                      Trailing Rule: {bp.trail_rule}
                    </div>
                  </div>

                  {/* Calculator Breakdown Drawer */}
                  {isCalcOpen && (
                    <div className="mt-2.5 p-3 rounded-xl bg-slate-950/80 border border-cyan-500/30 text-xs font-mono grid grid-cols-2 sm:grid-cols-4 gap-3 animate-fadeIn">
                      <div>
                        <div className="text-[9px] text-slate-400">EXACT SHARES TO BUY</div>
                        <div className="text-sm font-bold text-cyan-300 mt-0.5">
                          {sharesToBuy} Shares
                        </div>
                        <div className="text-[9px] text-slate-400">
                          Risk: ₹{maxRiskRupees.toLocaleString()} (1% equity)
                        </div>
                      </div>

                      <div>
                        <div className="text-[9px] text-slate-400">CAPITAL REQUIRED</div>
                        <div className="text-sm font-bold text-white mt-0.5">
                          ₹{Math.round(totalCapitalRequired).toLocaleString()}
                        </div>
                        <div className="text-[9px] text-slate-400">
                          {portfolioAllocationPct}% of Portfolio
                        </div>
                      </div>

                      <div>
                        <div className="text-[9px] text-emerald-400">PROFIT AT TARGET 1 (40%)</div>
                        <div className="text-sm font-bold text-emerald-300 mt-0.5">
                          +₹{Math.round(profitAtT1).toLocaleString()}
                        </div>
                        <div className="text-[9px] text-slate-400">Move SL to cost</div>
                      </div>

                      <div>
                        <div className="text-[9px] text-emerald-400">PROFIT AT TARGET 2 (30%)</div>
                        <div className="text-sm font-bold text-emerald-400 mt-0.5">
                          +₹{Math.round(profitAtT2).toLocaleString()}
                        </div>
                        <div className="text-[9px] text-slate-400">Trail 20 EMA</div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ========================================================= */}
        {/* 7. QUICK INSPECTION SLIDE-OVER DRAWER (TECHNO-FUNDA STYLE)*/}
        {/* ========================================================= */}
        {selectedTicket && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
            <div
              className="relative flex h-full w-full max-w-xl flex-col bg-[#060D1A] border-l border-slate-800 shadow-2xl p-5 overflow-y-auto animate-in slide-in-from-right duration-300"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drawer Header */}
              <div className="flex items-start justify-between border-b border-slate-800 pb-3.5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold tracking-tight text-white font-mono">
                      {selectedTicket.symbol}
                    </span>
                    <span className="rounded-full bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 text-xs font-semibold text-cyan-400">
                      CONVICTION {Math.round(selectedTicket.conviction_score)}/100
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-slate-400 font-sans">
                    {selectedTicket.company_name} • {selectedTicket.sector}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <AddToWatchlistButton
                    symbol={selectedTicket.symbol}
                    companyName={selectedTicket.company_name}
                    currentPrice={selectedTicket.current_price}
                    sector={selectedTicket.sector}
                    defaultConviction={selectedTicket.conviction_score}
                    variant="star"
                  />
                  <button
                    onClick={() => setSelectedTicket(null)}
                    className="rounded-lg bg-slate-800/80 p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Price & Execution Corridor Summary */}
              <div className="mt-3.5 grid grid-cols-3 gap-2.5 rounded-xl border border-slate-800/80 bg-slate-900/60 p-3 font-mono">
                <div>
                  <div className="text-[10px] text-slate-500 uppercase">CMP</div>
                  <div className="text-base font-bold text-white">
                    ₹{selectedTicket.current_price?.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-cyan-400">
                    24h: {selectedTicket.day_change_pct ? `${selectedTicket.day_change_pct > 0 ? "+" : ""}${selectedTicket.day_change_pct.toFixed(2)}%` : "0.00%"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase">Stop Loss</div>
                  <div className="text-sm font-semibold text-rose-400">
                    ₹{selectedTicket.execution_blueprint.stop_loss.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-rose-400/80">
                    -{selectedTicket.execution_blueprint.risk_pct}% Risk
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase">Target 1 & R:R</div>
                  <div className="text-sm font-semibold text-emerald-400">
                    ₹{selectedTicket.execution_blueprint.target_1.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-emerald-400/80">
                    R:R {selectedTicket.execution_blueprint.rr_ratio} Asymmetric
                  </div>
                </div>
              </div>

              {/* Trading Gap Analysis Card */}
              <div className="mt-3.5 rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-3.5">
                <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2 mb-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-cyan-300 font-mono">
                    <Radio size={14} className="text-cyan-400" />
                    <span>Real-Time Trading Gap &amp; Chase Analysis</span>
                  </div>
                  <span
                    className={`rounded px-1.5 py-0.2 text-[10px] font-bold font-mono border ${
                      selectedTicket.gap_metrics?.gap_type === "GAP_AND_GO"
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                        : selectedTicket.gap_metrics?.gap_type === "BREAKAWAY_GAP"
                        ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                        : "bg-slate-800 text-slate-300 border-slate-700"
                    }`}
                  >
                    {selectedTicket.gap_metrics?.gap_type || "NORMAL_OPEN"}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center font-mono">
                  <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
                    <div className="text-[9px] text-slate-500">Opening Gap</div>
                    <div className="text-xs font-bold text-white mt-0.5">
                      {selectedTicket.gap_metrics?.gap_pct ? `${selectedTicket.gap_metrics.gap_pct >= 0 ? "+" : ""}${selectedTicket.gap_metrics.gap_pct.toFixed(2)}%` : "0.00%"}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
                    <div className="text-[9px] text-slate-500">Chase Status</div>
                    <div className={`text-xs font-bold mt-0.5 ${
                      selectedTicket.gap_metrics?.chase_status === "IN_CORRIDOR"
                        ? "text-emerald-400"
                        : selectedTicket.gap_metrics?.chase_status === "NEAR_CEILING"
                        ? "text-amber-400"
                        : "text-rose-400"
                    }`}>
                      {selectedTicket.gap_metrics?.chase_status?.replace(/_/g, " ") || "IN CORRIDOR"}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
                    <div className="text-[9px] text-slate-500">Room to Chase</div>
                    <div className="text-xs font-bold text-cyan-300 mt-0.5">
                      ₹{selectedTicket.gap_metrics?.room_to_chase_rupees ?? 0}
                    </div>
                  </div>
                  <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800">
                    <div className="text-[9px] text-slate-500">52W High Proximity</div>
                    <div className="text-xs font-bold text-amber-300 mt-0.5">
                      -{selectedTicket.dist_52w_high_pct ?? 0}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Diamond Runaway Catalyst Spotlight (if present) */}
              {selectedTicket.diamond_catalyst && (
                <div className="mt-3.5 rounded-xl border border-cyan-500/40 bg-gradient-to-r from-cyan-950/40 to-slate-900/60 p-3.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-300 uppercase tracking-wider font-mono mb-1.5">
                    <Sparkles size={14} className="text-cyan-400" />
                    <span>Diamond Runaway Guidance Trigger</span>
                    <span className="rounded bg-cyan-500/20 text-cyan-200 px-1.5 py-0.2 text-[9px] font-bold">
                      {selectedTicket.diamond_catalyst.conviction_tier}
                    </span>
                  </div>
                  <div className="text-xs font-bold text-white font-sans">
                    {selectedTicket.diamond_catalyst.headline}
                  </div>
                  {selectedTicket.diamond_catalyst.verbatim_quote && (
                    <blockquote className="mt-2 pl-2.5 border-l-2 border-cyan-500/50 text-[11px] text-slate-300 italic font-sans leading-relaxed bg-slate-950/40 py-1 pr-2 rounded-r">
                      "{selectedTicket.diamond_catalyst.verbatim_quote}"
                    </blockquote>
                  )}
                </div>
              )}

              {/* Exact Rupee Corridor Ladder */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-300">
                    <Target size={14} className="text-cyan-400" />
                    <span>Exact Rupee Execution Corridor</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Horizon: {selectedTicket.execution_blueprint.holding_horizon}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-3">
                    <div className="text-[10px] text-cyan-400 uppercase font-bold">Buy Corridor</div>
                    <div className="text-sm font-bold text-white mt-0.5">
                      ₹{selectedTicket.execution_blueprint.buy_corridor_min} – ₹{selectedTicket.execution_blueprint.buy_corridor_max}
                    </div>
                    <div className="text-[10px] text-amber-400 mt-1">
                      Max Chase: ₹{selectedTicket.execution_blueprint.max_chase_price}
                    </div>
                  </div>

                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3">
                    <div className="text-[10px] text-emerald-400 uppercase font-bold">Target 2 (3.4R)</div>
                    <div className="text-sm font-bold text-white mt-0.5">
                      ₹{selectedTicket.execution_blueprint.target_2.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-emerald-300 mt-1">
                      +{selectedTicket.execution_blueprint.reward_pct_t2}% (Trail 20-EMA)
                    </div>
                  </div>
                </div>
              </div>

              {/* 4-Pillar Qualitative Validation Grid */}
              <div className="mt-4">
                <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
                  <Sparkles size={14} className="text-amber-400" />
                  <span>The 4-Pillar Catalysts</span>
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 text-xs">
                  <div className="rounded-xl border border-amber-500/30 bg-amber-950/10 p-3">
                    <div className="text-[10px] text-amber-400 font-mono font-bold flex items-center gap-1 mb-1">
                      <Zap size={12} />
                      <span>Catalyst Firepower</span>
                    </div>
                    <p className="text-slate-300 leading-relaxed font-sans text-[11px]">
                      {selectedTicket.theses.catalyst}
                    </p>
                  </div>

                  <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/10 p-3">
                    <div className="text-[10px] text-cyan-400 font-mono font-bold flex items-center gap-1 mb-1">
                      <ShieldCheck size={12} />
                      <span>Concall &amp; Sponsorship</span>
                    </div>
                    <p className="text-slate-300 leading-relaxed font-sans text-[11px]">
                      {selectedTicket.theses.sponsorship}
                    </p>
                  </div>

                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/10 p-3">
                    <div className="text-[10px] text-emerald-400 font-mono font-bold flex items-center gap-1 mb-1">
                      <TrendingUp size={12} />
                      <span>Street Consensus</span>
                    </div>
                    <p className="text-slate-300 leading-relaxed font-sans text-[11px]">
                      {selectedTicket.theses.street_consensus}
                    </p>
                  </div>

                  <div className="rounded-xl border border-purple-500/30 bg-purple-950/10 p-3">
                    <div className="text-[10px] text-purple-400 font-mono font-bold flex items-center gap-1 mb-1">
                      <Flame size={12} />
                      <span>Order Flow Ignition</span>
                    </div>
                    <p className="text-slate-300 leading-relaxed font-sans text-[11px]">
                      {selectedTicket.theses.order_flow}
                    </p>
                  </div>
                </div>
              </div>

              {/* Order Flow & Delivery Metrics */}
              <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                <div className="text-[11px] font-bold text-slate-300 uppercase font-mono tracking-wider mb-2 flex items-center gap-1.5">
                  <Flame size={13} className="text-cyan-400" />
                  <span>Order Flow &amp; Smart Money Footprint</span>
                </div>
                <div className="grid grid-cols-3 gap-2 font-mono text-center text-xs">
                  <div className="rounded-lg bg-slate-950 p-2 border border-slate-800">
                    <div className="text-[9px] text-slate-500">Delivery Spike</div>
                    <div className="text-sm font-bold text-cyan-300">
                      {selectedTicket.order_flow_metrics.delivery_spike_x}x
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-950 p-2 border border-slate-800">
                    <div className="text-[9px] text-slate-500">Delivery %</div>
                    <div className="text-sm font-bold text-emerald-400">
                      {selectedTicket.order_flow_metrics.delivery_per}%
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-950 p-2 border border-slate-800">
                    <div className="text-[9px] text-slate-500">Turnover</div>
                    <div className="text-sm font-bold text-white">
                      ₹{selectedTicket.order_flow_metrics.turnover_cr} Cr
                    </div>
                  </div>
                </div>
              </div>

              {/* Interactive Position Sizing & Capital Allocation Calculator */}
              <div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/80 p-3.5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-200">
                    <Calculator size={14} className="text-emerald-400" />
                    <span>Trade Sizing &amp; Capital Calculator</span>
                  </div>
                  <span className="rounded bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold text-cyan-400 font-mono">
                    {riskPerTradePct}% Portfolio Risk
                  </span>
                </div>

                <div className="mt-2.5 flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-sans text-[11px]">Quick Capital Size:</span>
                  <div className="flex items-center gap-1.5">
                    {[100000, 250000, 500000, 1000000].map((amt) => (
                      <button
                        key={amt}
                        onClick={() => setPortfolioCapital(amt)}
                        className={`rounded px-2 py-0.5 text-[10px] font-mono transition cursor-pointer ${
                          portfolioCapital === amt
                            ? "bg-cyan-500 text-slate-950 font-bold"
                            : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                        }`}
                      >
                        ₹{(amt / 100000).toFixed(amt >= 1000000 ? 0 : 1)}L
                      </button>
                    ))}
                  </div>
                </div>

                {drawerSizingCalculation && (
                  <div className="mt-2.5 grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-lg bg-slate-950/80 p-2.5 font-mono text-center border border-slate-800">
                    <div>
                      <div className="text-[9px] text-slate-500">Exact Shares</div>
                      <div className="text-xs font-bold text-cyan-300">
                        {drawerSizingCalculation.sharesToBuy.toLocaleString()}
                      </div>
                      <div className="text-[8px] text-slate-500">
                        Risk: ₹{Math.round(drawerSizingCalculation.maxRiskRupees).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] text-slate-500">Capital Needed</div>
                      <div className="text-xs font-bold text-white">
                        ₹{Math.round(drawerSizingCalculation.totalCapital).toLocaleString()}
                      </div>
                      <div className="text-[8px] text-slate-500">
                        {drawerSizingCalculation.portfolioAllocationPct}% Portfolio
                      </div>
                    </div>
                    <div>
                      <div className="text-[9px] text-emerald-400">Profit at T1 (40%)</div>
                      <div className="text-xs font-bold text-emerald-400">
                        +₹{Math.round(drawerSizingCalculation.profitAtT1).toLocaleString()}
                      </div>
                      <div className="text-[8px] text-slate-500">Move SL to cost</div>
                    </div>
                    <div>
                      <div className="text-[9px] text-emerald-400">Profit at T2 (30%)</div>
                      <div className="text-xs font-bold text-emerald-300">
                        +₹{Math.round(drawerSizingCalculation.profitAtT2).toLocaleString()}
                      </div>
                      <div className="text-[8px] text-slate-500">Trail 20-EMA</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="mt-5 flex flex-col sm:flex-row items-center gap-2">
                <button
                  onClick={() => copyTradeTicket(selectedTicket)}
                  className="w-full sm:flex-1 flex items-center justify-center gap-2 rounded-xl bg-cyan-500 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-cyan-400 shadow-md shadow-cyan-500/20 cursor-pointer"
                >
                  {copiedSymbol === selectedTicket.symbol ? (
                    <>
                      <Check size={14} />
                      <span>Copied Trade Setup!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span>Copy Trade Memo</span>
                    </>
                  )}
                </button>

                <Link
                  href={`/stocks/${selectedTicket.symbol}`}
                  className="w-full sm:w-auto rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-xs font-semibold text-white hover:bg-slate-700 transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Activity size={14} />
                  <span>Terminal</span>
                </Link>

                <a
                  href={`https://in.tradingview.com/symbols/NSE-${encodeURIComponent(selectedTicket.symbol)}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-xs font-semibold text-white hover:bg-slate-700 transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ExternalLink size={14} />
                  <span>TradingView</span>
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

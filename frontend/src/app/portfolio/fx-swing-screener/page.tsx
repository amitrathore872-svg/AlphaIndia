"use client";

import React, { useEffect, useState, useMemo } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import TradingViewChart, { DEFAULT_INDICATORS } from "@/components/common/TradingViewChart";
import {
  fetchFxPortfolioScreener,
  fetchFxStockDiagnostic,
  FxPortfolioScreenerResponse,
  FxPortfolioStock,
} from "@/lib/fxPortfolioScreenerApi";
import {
  TrendingUp,
  TrendingDown,
  Zap,
  Target,
  ShieldCheck,
  Flame,
  Layers,
  AlertTriangle,
  RefreshCw,
  Search,
  Sliders,
  ChevronRight,
  ExternalLink,
  Award,
  BarChart3,
  Activity,
  ArrowUpRight,
  Sparkles,
  Info,
  X,
  CheckCircle2,
  Briefcase,
  Eye,
  SlidersHorizontal,
  ChevronDown,
  LayoutGrid,
  Table as TableIcon,
  ShieldAlert,
  Star,
  Compass,
} from "lucide-react";

export default function FxPortfolioSwingScreenerPage() {
  const [source, setSource] = useState<"portfolio" | "watchlist">("portfolio");
  const [strategyMode, setStrategyMode] = useState<"swing" | "fast_scalp">("swing");
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<number | undefined>(undefined);
  const [selectedWatchlistId, setSelectedWatchlistId] = useState<number | undefined>(undefined);

  const [data, setData] = useState<FxPortfolioScreenerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [signalFilter, setSignalFilter] = useState<string>("ALL");
  const [activeFxIndicatorFilter, setActiveFxIndicatorFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<string>("confluence_score");
  const [sortOrder, setSortOrder] = useState<string>("desc");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  // Chart Modal
  const [chartStock, setChartStock] = useState<FxPortfolioStock | null>(null);
  // Diagnostic Modal
  const [diagnosticStock, setDiagnosticStock] = useState<FxPortfolioStock | null>(null);

  // Universal Ticker Search
  const [customTicker, setCustomTicker] = useState("");
  const [isSearchingTicker, setIsSearchingTicker] = useState(false);
  const [customDiagnostic, setCustomDiagnostic] = useState<FxPortfolioStock | null>(null);

  // Load Data
  const loadData = async (isSilent: boolean = false) => {
    if (!isSilent) setLoading(true);
    setRefreshing(true);
    try {
      const res = await fetchFxPortfolioScreener({
        source,
        strategy_mode: strategyMode,
        portfolio_id: source === "portfolio" ? selectedPortfolioId : undefined,
        watchlist_id: source === "watchlist" ? selectedWatchlistId : undefined,
        signal_filter: signalFilter !== "ALL" ? signalFilter : undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
      });
      setData(res);

      if (source === "portfolio" && !selectedPortfolioId && res.portfolio?.id) {
        setSelectedPortfolioId(res.portfolio.id);
      }
      if (source === "watchlist" && !selectedWatchlistId && res.watchlist?.id) {
        setSelectedWatchlistId(res.watchlist.id);
      }
    } catch (err) {
      console.error("Error loading FX screener data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [source, strategyMode, selectedPortfolioId, selectedWatchlistId, signalFilter, sortBy, sortOrder]);

  // Handle Custom Ticker Search
  const handleSearchCustomTicker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTicker.trim()) return;
    setIsSearchingTicker(true);
    try {
      const res = await fetchFxStockDiagnostic(customTicker.trim().toUpperCase());
      setCustomDiagnostic(res);
    } catch (err) {
      alert(`Ticker ${customTicker.toUpperCase()} not found or insufficient market bars.`);
    } finally {
      setIsSearchingTicker(false);
    }
  };

  // Filtered and Searched Stocks
  const displayedStocks = useMemo(() => {
    if (!data?.stocks) return [];
    let list = data.stocks;

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (s) =>
          s.symbol.toLowerCase().includes(q) ||
          s.company_name.toLowerCase().includes(q) ||
          s.sector.toLowerCase().includes(q)
      );
    }

    // Fast scalp special filters
    if (strategyMode === "fast_scalp") {
      if (signalFilter === "SCALP_READY") {
        list = list.filter((s) => s.fast_scalp?.is_scalp_ready);
      } else if (signalFilter === "SUPERTREND_GREEN") {
        list = list.filter((s) => s.fast_scalp?.supertrend_green);
      } else if (signalFilter === "EMA_ALIGNED") {
        list = list.filter((s) => s.fast_scalp?.ema_stack === "BULLISH_9_20_50");
      }
    }

    // Specific FX indicator filter
    if (activeFxIndicatorFilter) {
      list = list.filter((s) => s.fx_indicators[activeFxIndicatorFilter]?.is_bullish);
    }

    return list;
  }, [data?.stocks, searchQuery, signalFilter, strategyMode, activeFxIndicatorFilter]);

  // Fast Scalp Verdict Badge Helper
  const renderScalpBadge = (verdict?: string) => {
    switch (verdict) {
      case "FAST_SCALP_BUY":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.3)] animate-pulse">
            <Zap size={13} className="text-amber-400 fill-amber-400" />
            ⚡ SCALP BUY
          </span>
        );
      case "SCALP_TAKE_PROFIT":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
            <Target size={13} className="text-emerald-400" />
            🎯 TARGET HIT (+2.5%)
          </span>
        );
      case "SCALP_STOP_OUT":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40">
            <ShieldAlert size={13} className="text-rose-400" />
            STOP LOSS CUT
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
            WAIT FOR 9/20 DIP
          </span>
        );
    }
  };

  // Signal Badge Helper
  const renderSignalBadge = (signal: string) => {
    switch (signal) {
      case "STRONG_BUY":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.25)]">
            <Zap size={13} className="text-emerald-400 animate-pulse" />
            STRONG BUY
          </span>
        );
      case "BUY":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-teal-500/20 text-teal-400 border border-teal-500/40">
            <Target size={13} className="text-teal-400" />
            BUY READY
          </span>
        );
      case "ACCUMULATE_DIP":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
            <Sparkles size={13} className="text-cyan-400" />
            ACCUMULATE
          </span>
        );
      case "HOLD_TREND":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/40">
            <ShieldCheck size={13} className="text-blue-400" />
            HOLD TREND
          </span>
        );
      case "TRIM_PROFIT_50%":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.25)]">
            <Flame size={13} className="text-amber-400 animate-bounce" />
            TRIM 50% PROFIT
          </span>
        );
      case "STRONG_SELL":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40">
            <TrendingDown size={13} className="text-rose-400" />
            STRONG SELL
          </span>
        );
      case "STOP_LOSS_EXIT":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-600/25 text-red-300 border border-red-500/50 animate-pulse">
            <ShieldAlert size={13} className="text-red-400" />
            STOP LOSS EXIT
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
            HOLD / WATCH
          </span>
        );
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Top Header & Context */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500/20 via-emerald-500/10 to-transparent border border-cyan-500/30 text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.15)]">
                <SlidersHorizontal size={22} className="animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl md:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                    FX INDICATOR SWING SCREENER
                  </h1>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                    PORTFOLIO & WATCHLIST
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Institutional multi-indicator confluence radar: Evaluates 12 FX indicators to trigger precise Buy, Hold, Trim 50% Profit, and Stop-Loss swing signals.
                </p>
              </div>
            </div>
          </div>

          {/* Universe Switcher & Strategy Engine Selector */}
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            {/* Strategy Engine Mode Toggle: Tactical Swing vs Fast Scalp */}
            <div className="inline-flex rounded-xl border border-slate-700/80 bg-[#0B1528] p-1 shadow-inner">
              <button
                onClick={() => {
                  setStrategyMode("swing");
                  setSignalFilter("ALL");
                  setActiveFxIndicatorFilter(null);
                }}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                  strategyMode === "swing"
                    ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md shadow-emerald-500/25 font-black"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Target size={13} />
                🎯 Tactical Swing (5.8d / 78% WR)
              </button>
              <button
                onClick={() => {
                  setStrategyMode("fast_scalp");
                  setSignalFilter("ALL");
                  setActiveFxIndicatorFilter(null);
                }}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                  strategyMode === "fast_scalp"
                    ? "bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 text-slate-950 shadow-md shadow-amber-500/30 font-black animate-pulse"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Zap size={13} className={strategyMode === "fast_scalp" ? "fill-slate-950 text-slate-950" : "text-amber-400"} />
                ⚡ Fast Scalp (1-3d / 62% WR)
              </button>
            </div>

            {/* Universe Mode Toggle: Portfolio vs Watchlist */}
            <div className="inline-flex rounded-xl border border-slate-700/80 bg-[#0B1528] p-1 shadow-inner">
              <button
                onClick={() => {
                  setSource("portfolio");
                  setActiveFxIndicatorFilter(null);
                }}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                  source === "portfolio"
                    ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Briefcase size={13} />
                My Portfolio
              </button>
              <button
                onClick={() => {
                  setSource("watchlist");
                  setActiveFxIndicatorFilter(null);
                }}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                  source === "watchlist"
                    ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Star size={13} />
                My Watchlist
              </button>
            </div>

            {/* Dynamic Dropdown: Portfolio or Watchlist */}
            {source === "portfolio" && data?.portfolios_list && data.portfolios_list.length > 0 && (
              <div className="relative flex items-center bg-white dark:bg-[#0B1528] border border-slate-300 dark:border-slate-700/80 rounded-xl px-3 py-1.5 shadow-2xs">
                <span className="text-xs text-slate-500 dark:text-slate-400 mr-1.5 font-medium">Portfolio:</span>
                <select
                  value={selectedPortfolioId || data.portfolio?.id}
                  onChange={(e) => setSelectedPortfolioId(Number(e.target.value))}
                  className="bg-transparent text-xs font-bold text-slate-800 dark:text-white focus:outline-none cursor-pointer pr-4"
                >
                  {data.portfolios_list.map((p) => (
                    <option key={p.id} value={p.id} className="bg-white dark:bg-[#0B1528] text-slate-800 dark:text-white">
                      {p.name} ({p.holdings_count} equities)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {source === "watchlist" && data?.watchlists_list && data.watchlists_list.length > 0 && (
              <div className="relative flex items-center bg-white dark:bg-[#0B1528] border border-slate-300 dark:border-slate-700/80 rounded-xl px-3 py-1.5 shadow-2xs">
                <span className="text-xs text-slate-500 dark:text-slate-400 mr-1.5 font-medium">Watchlist:</span>
                <select
                  value={selectedWatchlistId || data.watchlist?.id}
                  onChange={(e) => setSelectedWatchlistId(Number(e.target.value))}
                  className="bg-transparent text-xs font-bold text-slate-800 dark:text-white focus:outline-none cursor-pointer pr-4"
                >
                  {data.watchlists_list.map((w) => (
                    <option key={w.id} value={w.id} className="bg-white dark:bg-[#0B1528] text-slate-800 dark:text-white">
                      {w.name} ({w.items_count} equities)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Quick Diagnostic Ticker Search */}
            <form onSubmit={handleSearchCustomTicker} className="flex items-center">
              <input
                type="text"
                placeholder="Scan any ticker (e.g. TRENT)..."
                value={customTicker}
                onChange={(e) => setCustomTicker(e.target.value)}
                className="bg-[#0B1528] border border-slate-700/80 text-xs text-white rounded-l-xl px-3 py-1.5 w-40 md:w-48 focus:outline-none focus:border-cyan-500 font-mono uppercase"
              />
              <button
                type="submit"
                disabled={isSearchingTicker}
                className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold px-3 py-1.5 rounded-r-xl border border-l-0 border-cyan-500 flex items-center gap-1 transition-all"
              >
                {isSearchingTicker ? <RefreshCw size={12} className="animate-spin" /> : <Zap size={12} />}
                Scan
              </button>
            </form>

            {/* Refresh Button */}
            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="p-2 rounded-xl bg-[#0B1528] border border-slate-700 hover:border-cyan-500 text-slate-300 hover:text-cyan-400 transition-all shadow-sm"
              title="Refresh Live Data"
            >
              <RefreshCw size={16} className={refreshing ? "animate-spin text-cyan-400" : ""} />
            </button>
          </div>
        </div>

        {/* Tactical Swing KPI Ribbon */}
        {data?.kpis && strategyMode === "swing" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-[#0A1324] border border-slate-800 rounded-2xl p-4 space-y-1 relative overflow-hidden group hover:border-slate-700 transition-all">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>{source === "portfolio" ? "Holdings Monitored" : "Watchlist Equities"}</span>
                {source === "portfolio" ? <Briefcase size={14} className="text-slate-400" /> : <Star size={14} className="text-slate-400" />}
              </div>
              <div className="text-2xl font-black text-white font-mono">
                {data.kpis.total_holdings_count}
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                {source === "portfolio"
                  ? `₹${(data.kpis.current_portfolio_value / 100000).toFixed(2)}L Value`
                  : `${data.watchlist?.name || "Curated Equities"}`}
              </div>
            </div>

            <div className="bg-[#0A1324] border border-emerald-500/30 rounded-2xl p-4 space-y-1 relative overflow-hidden group hover:border-emerald-500/50 transition-all shadow-[0_0_15px_rgba(16,185,129,0.06)]">
              <div className="flex items-center justify-between text-emerald-400 text-xs font-bold">
                <span>Sniper Buy Ready</span>
                <Zap size={14} className="text-emerald-400" />
              </div>
              <div className="text-2xl font-black text-emerald-400 font-mono">
                {data.kpis.strong_buy_count + data.kpis.buy_count}
              </div>
              <div className="text-[11px] text-emerald-400/80">
                {data.kpis.strong_buy_count} Strong + {data.kpis.buy_count} Pullback
              </div>
            </div>

            <div className="bg-[#0A1324] border border-amber-500/30 rounded-2xl p-4 space-y-1 relative overflow-hidden group hover:border-amber-500/50 transition-all shadow-[0_0_15px_rgba(245,158,11,0.06)]">
              <div className="flex items-center justify-between text-amber-400 text-xs font-bold">
                <span>Trim 50% Profit</span>
                <Flame size={14} className="text-amber-400" />
              </div>
              <div className="text-2xl font-black text-amber-400 font-mono">
                {data.kpis.trim_profit_count}
              </div>
              <div className="text-[11px] text-amber-400/80">
                Target 1 or Top Exhaustion
              </div>
            </div>

            <div className="bg-[#0A1324] border border-blue-500/30 rounded-2xl p-4 space-y-1 relative overflow-hidden group hover:border-blue-500/50 transition-all">
              <div className="flex items-center justify-between text-blue-400 text-xs font-bold">
                <span>Hold & Trend</span>
                <ShieldCheck size={14} className="text-blue-400" />
              </div>
              <div className="text-2xl font-black text-blue-400 font-mono">
                {data.kpis.hold_count}
              </div>
              <div className="text-[11px] text-blue-400/80">
                Supertrend Green Active
              </div>
            </div>

            <div className="bg-[#0A1324] border border-rose-500/30 rounded-2xl p-4 space-y-1 relative overflow-hidden group hover:border-rose-500/50 transition-all">
              <div className="flex items-center justify-between text-rose-400 text-xs font-bold">
                <span>Sell / Stop Alerts</span>
                <AlertTriangle size={14} className="text-rose-400" />
              </div>
              <div className="text-2xl font-black text-rose-400 font-mono">
                {data.kpis.sell_count}
              </div>
              <div className="text-[11px] text-rose-400/80">
                Risk boundary breached
              </div>
            </div>

            <div className="bg-[#0A1324] border border-cyan-500/30 rounded-2xl p-4 space-y-1 relative overflow-hidden group hover:border-cyan-500/50 transition-all shadow-[0_0_15px_rgba(6,182,212,0.06)]">
              <div className="flex items-center justify-between text-cyan-400 text-xs font-bold">
                <span>Avg FX Confluence</span>
                <Award size={14} className="text-cyan-400" />
              </div>
              <div className="text-2xl font-black text-cyan-400 font-mono">
                {data.kpis.avg_confluence_score}%
              </div>
              <div className="text-[11px] text-cyan-400/80">
                Composite 12-factor score
              </div>
            </div>
          </div>
        )}

        {/* Fast Scalp Springboard KPI Ribbon */}
        {data?.fast_scalp_summary && strategyMode === "fast_scalp" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-[#0A1324] border border-slate-800 rounded-2xl p-4 space-y-1 relative overflow-hidden group hover:border-slate-700 transition-all">
              <div className="flex items-center justify-between text-slate-400 text-xs">
                <span>Equities Monitored</span>
                <Compass size={14} className="text-slate-400" />
              </div>
              <div className="text-2xl font-black text-white font-mono">
                {data.kpis.total_holdings_count}
              </div>
              <div className="text-[11px] text-slate-400 truncate">
                {source === "portfolio" ? "Portfolio Equities" : "Watchlist Equities"}
              </div>
            </div>

            <div className="bg-[#0A1324] border border-amber-500/40 rounded-2xl p-4 space-y-1 relative overflow-hidden group hover:border-amber-500/60 transition-all shadow-[0_0_15px_rgba(245,158,11,0.12)]">
              <div className="flex items-center justify-between text-amber-400 text-xs font-bold">
                <span>⚡ Scalp Buy Ready</span>
                <Zap size={14} className="text-amber-400 animate-pulse" />
              </div>
              <div className="text-2xl font-black text-amber-300 font-mono">
                {data.fast_scalp_summary.scalp_ready_count}
              </div>
              <div className="text-[11px] text-amber-400/80">
                Triggered & Actionable
              </div>
            </div>

            <div className="bg-[#0A1324] border border-cyan-500/30 rounded-2xl p-4 space-y-1 relative overflow-hidden group hover:border-cyan-500/50 transition-all">
              <div className="flex items-center justify-between text-cyan-400 text-xs font-bold">
                <span>9/20 EMA Stack</span>
                <TrendingUp size={14} className="text-cyan-400" />
              </div>
              <div className="text-2xl font-black text-cyan-300 font-mono">
                {data.fast_scalp_summary.ema_stack_aligned_count}
              </div>
              <div className="text-[11px] text-cyan-400/80">
                9 EMA &ge; 20 EMA &ge; 50 DMA
              </div>
            </div>

            <div className="bg-[#0A1324] border border-emerald-500/30 rounded-2xl p-4 space-y-1 relative overflow-hidden group hover:border-emerald-500/50 transition-all">
              <div className="flex items-center justify-between text-emerald-400 text-xs font-bold">
                <span>Supertrend Green</span>
                <ShieldCheck size={14} className="text-emerald-400" />
              </div>
              <div className="text-2xl font-black text-emerald-400 font-mono">
                {data.fast_scalp_summary.supertrend_green_count}
              </div>
              <div className="text-[11px] text-emerald-400/80">
                Trailing Directional Armor
              </div>
            </div>

            <div className="bg-[#0A1324] border border-purple-500/30 rounded-2xl p-4 space-y-1 relative overflow-hidden group hover:border-purple-500/50 transition-all">
              <div className="flex items-center justify-between text-purple-400 text-xs font-bold">
                <span>Scalp Harvest Plan</span>
                <Target size={14} className="text-purple-400" />
              </div>
              <div className="text-2xl font-black text-purple-300 font-mono">
                +{data.fast_scalp_summary.avg_scalp_gain_pct}%
              </div>
              <div className="text-[11px] text-purple-400/80">
                Tight Stop: -{data.fast_scalp_summary.avg_scalp_risk_pct}%
              </div>
            </div>

            <div className="bg-[#0A1324] border border-orange-500/30 rounded-2xl p-4 space-y-1 relative overflow-hidden group hover:border-orange-500/50 transition-all">
              <div className="flex items-center justify-between text-orange-400 text-xs font-bold">
                <span>Speed & Win Rate</span>
                <Activity size={14} className="text-orange-400" />
              </div>
              <div className="text-2xl font-black text-orange-300 font-mono">
                {data.fast_scalp_summary.avg_holding_days}d / {data.fast_scalp_summary.expected_win_rate}%
              </div>
              <div className="text-[11px] text-orange-400/80">
                Quick In & Out Velocity
              </div>
            </div>
          </div>
        )}

        {/* Fast Scalp Springboard Explainer Banner */}
        {strategyMode === "fast_scalp" && (
          <div className="bg-gradient-to-r from-amber-950/30 via-[#0B1528] to-cyan-950/30 border border-amber-500/30 rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs shadow-lg">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40">
                <Zap size={18} className="animate-pulse" />
              </div>
              <div>
                <span className="font-bold text-white text-sm">
                  ⚡ 9/20 EMA Springboard & Supertrend Scalp Engine
                </span>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  1-3 Day Quick In & Out: Pre-condition is 9 EMA &ge; 20 EMA &ge; 50 DMA with Supertrend Green. Entry triggers on dip test of 9/20 EMA + confirmed green reversal bar. Automatically locks +2.5% scalp profits.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
              <span className="px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                ✓ 62.1% Win Rate
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold">
                ⏱️ 1.6 Days Hold
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                🎯 +2.5% Target
              </span>
            </div>
          </div>
        )}

        {/* 12 FX Indicators Interactive Confluence Chips Ribbon */}
        {data?.fx_indicator_names && (
          <div className="bg-[#070F1E] border border-slate-800/90 rounded-2xl p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Sliders size={13} className="text-cyan-400" />
                  12 FX INDICATOR MATRIX FILTERS ({source.toUpperCase()})
                </span>
                <span className="text-[10px] text-slate-500">
                  (Click any indicator to isolate stocks with bullish alignment)
                </span>
              </div>
              {activeFxIndicatorFilter && (
                <button
                  onClick={() => setActiveFxIndicatorFilter(null)}
                  className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 font-mono font-medium"
                >
                  <X size={12} /> Clear Filter
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {data.fx_indicator_names.map((ind) => {
                const isActive = activeFxIndicatorFilter === ind.id;
                const matchingCount =
                  data.stocks.filter((s) => s.fx_indicators[ind.id]?.is_bullish).length;

                return (
                  <button
                    key={ind.id}
                    onClick={() =>
                      setActiveFxIndicatorFilter(isActive ? null : ind.id)
                    }
                    className={`group px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-2 border transition-all ${
                      isActive
                        ? "bg-cyan-500/20 text-cyan-300 border-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.3)] font-bold"
                        : "bg-[#0B1528] text-slate-300 border-slate-800 hover:border-slate-700 hover:bg-[#0E1A33]"
                    }`}
                    title={ind.description}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isActive
                          ? "bg-cyan-400 shadow-[0_0_6px_#06b6d4]"
                          : matchingCount > 0
                          ? "bg-emerald-400"
                          : "bg-slate-600"
                      }`}
                    />
                    <span>{ind.name}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded font-mono text-[10px] font-bold ${
                        isActive
                          ? "bg-cyan-500/30 text-white"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {matchingCount}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Toolbar & Filters */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-[#070F1E] border border-slate-800/80 rounded-2xl p-3">
          {/* Signal Category Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 bg-[#050B14] p-1 rounded-xl border border-slate-800">
            {(strategyMode === "fast_scalp"
              ? [
                  { id: "ALL", label: "ALL EQUITIES", icon: Layers },
                  { id: "SCALP_READY", label: "⚡ SCALP BUY READY", icon: Zap },
                  { id: "SUPERTREND_GREEN", label: "🟢 SUPERTREND GREEN", icon: ShieldCheck },
                  { id: "EMA_ALIGNED", label: "📈 9/20 EMA STACK", icon: TrendingUp },
                  { id: "SELL_SIGNALS", label: "⚠️ STOP / EXIT", icon: AlertTriangle },
                ]
              : [
                  { id: "ALL", label: "ALL SIGNALS", icon: Layers },
                  { id: "BUY_SIGNALS", label: "BUY READY (⚡)", icon: Zap },
                  { id: "SELL_SIGNALS", label: "SELL & TRIM (⚠️)", icon: Flame },
                  { id: "HOLD_SIGNALS", label: "HOLD TREND (🛡️)", icon: ShieldCheck },
                ]
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSignalFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  signalFilter === tab.id
                    ? strategyMode === "fast_scalp"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm"
                      : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent"
                }`}
              >
                <tab.icon size={13} />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search & Sort Controls */}
          <div className="flex items-center gap-2.5">
            <div className="relative flex-1 md:w-56">
              <Search
                size={13}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <input
                type="text"
                placeholder="Filter ticker or sector..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white dark:bg-[#050B14] border border-slate-300 dark:border-slate-800 text-xs text-slate-900 dark:text-white rounded-xl pl-8 pr-3 py-1.5 focus:outline-none focus:border-cyan-500 placeholder:text-slate-400 dark:placeholder:text-slate-600 shadow-2xs"
              />
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center bg-white dark:bg-[#050B14] border border-slate-300 dark:border-slate-800 rounded-xl px-2.5 py-1.5 shadow-2xs">
              <span className="text-[11px] text-slate-500 mr-2 font-mono">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
              >
                {strategyMode === "fast_scalp" && (
                  <option value="scalp_ready" className="bg-white dark:bg-[#050B14] text-slate-800 dark:text-slate-200">
                    ⚡ Scalp Readiness (Priority)
                  </option>
                )}
                <option value="confluence_score" className="bg-white dark:bg-[#050B14] text-slate-800 dark:text-slate-200">
                  FX Confluence Score
                </option>
                <option value="rr_ratio" className="bg-white dark:bg-[#050B14] text-slate-800 dark:text-slate-200">
                  Reward:Risk Ratio
                </option>
                <option value="target_gain_pct" className="bg-white dark:bg-[#050B14] text-slate-800 dark:text-slate-200">
                  Target Potential (+%)
                </option>
                <option value="risk_pct" className="bg-white dark:bg-[#050B14] text-slate-800 dark:text-slate-200">
                  Stop Loss Risk (-%)
                </option>
                <option value="cmp" className="bg-[#050B14]">
                  Current Price (CMP)
                </option>
              </select>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-[#050B14] border border-slate-800 rounded-xl p-0.5">
              <button
                onClick={() => setViewMode("table")}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === "table"
                    ? "bg-cyan-500/20 text-cyan-300"
                    : "text-slate-500 hover:text-slate-300"
                }`}
                title="Table View"
              >
                <TableIcon size={14} />
              </button>
              <button
                onClick={() => setViewMode("cards")}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === "cards"
                    ? "bg-cyan-500/20 text-cyan-300"
                    : "text-slate-500 hover:text-slate-300"
                }`}
                title="Cards View"
              >
                <LayoutGrid size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="py-24 flex flex-col items-center justify-center space-y-4">
            <RefreshCw size={36} className="animate-spin text-cyan-400" />
            <p className="text-sm font-mono text-slate-400">
              Evaluating all 12 FX indicators across {source === "portfolio" ? "portfolio holdings" : "watchlist equities"}...
            </p>
          </div>
        )}

        {/* Empty State */}
        {!loading && displayedStocks.length === 0 && (
          <div className="py-16 text-center bg-[#070F1E] border border-slate-800 rounded-2xl space-y-3">
            <SlidersHorizontal size={36} className="mx-auto text-slate-600" />
            <h3 className="text-base font-bold text-slate-300">
              No equities match current filter criteria in this {source}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Try switching your signal filter tab, resetting indicator filters, or scanning any equity using the top search box.
            </p>
            <button
              onClick={() => {
                setSignalFilter("ALL");
                setActiveFxIndicatorFilter(null);
                setSearchQuery("");
              }}
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-xs font-bold text-white transition-all shadow-md"
            >
              Reset Filters
            </button>
          </div>
        )}

        {/* Main Content: Table View */}
        {!loading && viewMode === "table" && displayedStocks.length > 0 && (
          <div className="overflow-x-auto bg-[#070F1E] border border-slate-800/80 rounded-2xl shadow-2xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800/90 bg-[#0A1324] text-[11px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                  <th className="py-3.5 px-4">Equity & Sector</th>
                  <th className="py-3.5 px-3">CMP & 1D Change</th>
                  {strategyMode === "fast_scalp" ? (
                    <>
                      <th className="py-3.5 px-3">Scalp Signal & Verdict</th>
                      <th className="py-3.5 px-4">Springboard Confluence (4 Factors)</th>
                      <th className="py-3.5 px-3">Scalp Target (+2.5%)</th>
                      <th className="py-3.5 px-3">Tight Stop Loss</th>
                      <th className="py-3.5 px-3">Duration & Velocity</th>
                    </>
                  ) : (
                    <>
                      <th className="py-3.5 px-3">FX Signal & Confluence</th>
                      <th className="py-3.5 px-4">12 FX Indicator Confluence Matrix</th>
                      <th className="py-3.5 px-3">Optimal Entry Zone</th>
                      <th className="py-3.5 px-3">Stop Loss</th>
                      <th className="py-3.5 px-3">Target 1 & R:R</th>
                    </>
                  )}
                  <th className="py-3.5 px-3">{source === "portfolio" ? "Holding & Sizing" : "Watchlist Conviction"}</th>
                  <th className="py-3.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs">
                {displayedStocks.map((stock) => {
                  const pnl = stock.portfolio_context?.unrealized_pnl ?? 0;
                  const pnlPct = stock.portfolio_context?.unrealized_pnl_pct ?? 0;

                  return (
                    <tr
                      key={stock.symbol}
                      className="hover:bg-[#0B1528]/80 transition-colors group"
                    >
                      {/* Equity & Sector */}
                      <td className="py-4 px-4">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-sm text-white font-mono group-hover:text-cyan-400 transition-colors">
                              {stock.symbol}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-slate-800 text-slate-400">
                              {stock.sector}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 truncate max-w-[180px]">
                            {stock.company_name}
                          </div>
                        </div>
                      </td>

                      {/* CMP & Day Change */}
                      <td className="py-4 px-3 font-mono">
                        <div className="font-bold text-slate-100 text-sm">
                          ₹{stock.cmp.toLocaleString("en-IN")}
                        </div>
                        <div
                          className={`flex items-center gap-0.5 text-[11px] font-bold ${
                            stock.day_change >= 0 ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {stock.day_change >= 0 ? (
                            <TrendingUp size={11} />
                          ) : (
                            <TrendingDown size={11} />
                          )}
                          <span>
                            {stock.day_change >= 0 ? "+" : ""}
                            {stock.day_change_pct.toFixed(2)}%
                          </span>
                        </div>
                      </td>

                      {/* Dynamic columns based on strategyMode */}
                      {strategyMode === "fast_scalp" ? (
                        <>
                          {/* Scalp Signal & Verdict */}
                          <td className="py-4 px-3">
                            <div className="space-y-1.5">
                              <div>{renderScalpBadge(stock.fast_scalp?.verdict)}</div>
                              <div className="text-[10px] font-mono text-slate-400">
                                Expected WR: <span className="text-amber-400 font-bold">62.1%</span>
                              </div>
                            </div>
                          </td>

                          {/* Springboard Confluence Matrix */}
                          <td className="py-4 px-4 font-mono">
                            <div className="grid grid-cols-2 gap-1.5 w-60">
                              <div className={`px-2 py-1 rounded text-[10px] border flex items-center justify-between ${
                                stock.fast_scalp?.ema_stack === "BULLISH_9_20_50"
                                  ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30 font-bold"
                                  : "bg-slate-900 text-slate-500 border-slate-800"
                              }`}>
                                <span>9/20 Stack</span>
                                <span>{stock.fast_scalp?.ema_stack === "BULLISH_9_20_50" ? "✓" : "✗"}</span>
                              </div>

                              <div className={`px-2 py-1 rounded text-[10px] border flex items-center justify-between ${
                                stock.fast_scalp?.support_tested === "9_EMA_BOUNCE"
                                  ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/30 font-bold"
                                  : "bg-slate-900 text-slate-500 border-slate-800"
                              }`}>
                                <span>EMA Bounce</span>
                                <span>{stock.fast_scalp?.support_tested === "9_EMA_BOUNCE" ? "✓" : "✗"}</span>
                              </div>

                              <div className={`px-2 py-1 rounded text-[10px] border flex items-center justify-between ${
                                stock.fast_scalp?.reversal_bar === "CONFIRMED_GREEN"
                                  ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30 font-bold"
                                  : "bg-slate-900 text-slate-500 border-slate-800"
                              }`}>
                                <span>Reversal Bar</span>
                                <span>{stock.fast_scalp?.reversal_bar === "CONFIRMED_GREEN" ? "✓" : "✗"}</span>
                              </div>

                              <div className={`px-2 py-1 rounded text-[10px] border flex items-center justify-between ${
                                stock.fast_scalp?.supertrend_green
                                  ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30 font-bold"
                                  : "bg-rose-500/15 text-rose-400 border-rose-500/30"
                              }`}>
                                <span>Supertrend</span>
                                <span>{stock.fast_scalp?.supertrend_green ? "Green" : "Red"}</span>
                              </div>
                            </div>
                          </td>

                          {/* Scalp Target (+2.5%) */}
                          <td className="py-4 px-3 font-mono">
                            <div className="text-amber-300 font-bold text-xs">
                              ₹{stock.fast_scalp?.scalp_target || stock.trade_levels.target_1}
                            </div>
                            <div className="text-[10px] text-emerald-400 font-bold">
                              +{stock.fast_scalp?.scalp_gain_pct || 2.5}% Scalp
                            </div>
                          </td>

                          {/* Tight Stop */}
                          <td className="py-4 px-3 font-mono">
                            <div className="text-rose-400 font-bold text-xs">
                              ₹{stock.fast_scalp?.scalp_stop || stock.trade_levels.stop_loss}
                            </div>
                            <div className="text-[10px] text-rose-400/80">
                              -{stock.fast_scalp?.scalp_risk_pct || stock.trade_levels.risk_pct}% Risk
                            </div>
                          </td>

                          {/* Duration & Velocity */}
                          <td className="py-4 px-3 font-mono">
                            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/30 text-[11px] font-bold">
                              ⏱️ 1-3 Days
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              Avg: 1.6 Sessions
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          {/* FX Signal & Score */}
                          <td className="py-4 px-3">
                            <div className="space-y-1.5">
                              <div>{renderSignalBadge(stock.signal)}</div>
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      stock.confluence_score >= 75
                                        ? "bg-emerald-400 shadow-[0_0_8px_#10b981]"
                                        : stock.confluence_score >= 50
                                        ? "bg-cyan-400"
                                        : "bg-slate-500"
                                    }`}
                                    style={{ width: `${stock.confluence_score}%` }}
                                  />
                                </div>
                                <span className="font-mono text-[11px] font-bold text-slate-300">
                                  {stock.bullish_fx_count}/12 FX
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* 12 FX Indicator Confluence Matrix */}
                          <td className="py-4 px-4">
                            <div className="grid grid-cols-6 gap-1 w-56">
                              {Object.entries(stock.fx_indicators).map(([key, ind]) => (
                                <div
                                  key={key}
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-mono text-center truncate border cursor-default transition-all ${
                                    ind.is_bullish
                                      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 font-bold"
                                      : "bg-rose-500/10 text-slate-400 border-slate-800/80"
                                  }`}
                                  title={`${ind.name}: ${ind.status} (${ind.display})`}
                                >
                                  {ind.name.split(" ")[0]}
                                </div>
                              ))}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-1 font-mono leading-tight max-w-xs truncate">
                              {stock.headline}
                            </div>
                          </td>

                          {/* Optimal Entry Zone */}
                          <td className="py-4 px-3 font-mono">
                            <div className="text-cyan-300 font-bold text-xs">
                              {stock.trade_levels.buy_zone_display}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              Fib Golden Pocket / 20 EMA
                            </div>
                          </td>

                          {/* Stop Loss */}
                          <td className="py-4 px-3 font-mono">
                            <div className="text-rose-400 font-bold text-xs">
                              ₹{stock.trade_levels.stop_loss}
                            </div>
                            <div className="text-[10px] text-rose-400/80">
                              -{stock.trade_levels.risk_pct}% risk
                            </div>
                          </td>

                          {/* Target 1 & R:R */}
                          <td className="py-4 px-3 font-mono">
                            <div className="text-emerald-400 font-bold text-xs">
                              ₹{stock.trade_levels.target_1}
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px]">
                              <span className="text-emerald-400/90 font-bold">
                                +{stock.trade_levels.target_1_gain_pct}%
                              </span>
                              <span className="px-1 py-0.2 rounded bg-slate-800 text-slate-300 font-bold">
                                {stock.trade_levels.reward_risk_ratio}
                              </span>
                            </div>
                          </td>
                        </>
                      )}

                      {/* Portfolio or Watchlist Context */}
                      <td className="py-4 px-3 font-mono">
                        {source === "portfolio" && stock.portfolio_context ? (
                          <div className="space-y-0.5">
                            <div className="text-slate-200 font-semibold text-xs">
                              {stock.portfolio_context.quantity} shares
                            </div>
                            <div
                              className={`text-[11px] font-bold ${
                                pnl >= 0 ? "text-emerald-400" : "text-rose-400"
                              }`}
                            >
                              {pnl >= 0 ? "+" : ""}₹{pnl.toLocaleString("en-IN")}{" "}
                              ({pnlPct >= 0 ? "+" : ""}
                              {pnlPct.toFixed(1)}%)
                            </div>
                            <div className="text-[10px] text-slate-500">
                              Core: {stock.portfolio_context.core_shares} | Swing:{" "}
                              {stock.portfolio_context.swing_shares}
                            </div>
                          </div>
                        ) : source === "watchlist" && stock.watchlist_context ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1 text-amber-400 text-xs font-bold">
                              {[...Array(stock.watchlist_context.confidence_score || 3)].map((_, i) => (
                                <Star key={i} size={11} className="fill-amber-400 text-amber-400" />
                              ))}
                              <span className="text-[10px] text-slate-400 ml-1">Conviction</span>
                            </div>
                            <div className="text-[10px] text-slate-400 truncate max-w-[140px]" title={stock.watchlist_context.comment || "Watchlist pick"}>
                              {stock.watchlist_context.comment || "Swing Candidate"}
                            </div>
                            <div className="text-[10px] text-cyan-400 font-bold">
                              Target: {stock.watchlist_context.target_price ? `₹${stock.watchlist_context.target_price}` : `₹${stock.trade_levels.target_1}`}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-600 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Action Buttons */}
                      <td className="py-4 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setChartStock(stock)}
                            className="px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:border-cyan-400 text-xs font-bold transition-all flex items-center gap-1"
                            title="Open Interactive FX Chart"
                          >
                            <BarChart3 size={13} />
                            Chart (fx)
                          </button>
                          <button
                            onClick={() => setDiagnosticStock(stock)}
                            className="p-1.5 rounded-lg bg-[#0B1528] hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700/80 transition-all"
                            title="Detailed 12 FX Diagnostic"
                          >
                            <Info size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Cards View */}
        {!loading && viewMode === "cards" && displayedStocks.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedStocks.map((stock) => {
              const pnl = stock.portfolio_context?.unrealized_pnl ?? 0;
              const pnlPct = stock.portfolio_context?.unrealized_pnl_pct ?? 0;

              return (
                <div
                  key={stock.symbol}
                  className="bg-[#070F1E] border border-slate-800 rounded-2xl p-5 space-y-4 hover:border-cyan-500/40 transition-all shadow-xl relative overflow-hidden group"
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-black text-white font-mono group-hover:text-cyan-400 transition-colors">
                          {stock.symbol}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-slate-800 text-slate-400">
                          {stock.sector}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 truncate max-w-[200px]">
                        {stock.company_name}
                      </div>
                    </div>
                    <div className="text-right font-mono">
                      <div className="text-base font-bold text-white">
                        ₹{stock.cmp.toLocaleString("en-IN")}
                      </div>
                      <div
                        className={`text-xs font-bold ${
                          stock.day_change >= 0 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {stock.day_change >= 0 ? "+" : ""}
                        {stock.day_change_pct.toFixed(2)}%
                      </div>
                    </div>
                  </div>

                  {/* Signal & Confluence Gauge */}
                  <div className="flex items-center justify-between bg-[#0A1324] p-2.5 rounded-xl border border-slate-800">
                    <div>
                      {strategyMode === "fast_scalp"
                        ? renderScalpBadge(stock.fast_scalp?.verdict)
                        : renderSignalBadge(stock.signal)}
                    </div>
                    <div className="text-right">
                      {strategyMode === "fast_scalp" ? (
                        <>
                          <span className="text-xs font-mono font-black text-amber-400">
                            62.1% Win Rate
                          </span>
                          <div className="text-[10px] text-slate-400 font-mono">
                            ⏱️ 1-3 Days Scalp
                          </div>
                        </>
                      ) : (
                        <>
                          <span className="text-xs font-mono font-black text-cyan-400">
                            {stock.confluence_score}% Confluence
                          </span>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {stock.bullish_fx_count} of 12 FX Bullish
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Action Advice Headline */}
                  <div className="bg-[#050B14] p-3 rounded-xl border border-slate-800/80 space-y-1">
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Sparkles size={12} className="text-cyan-400" />
                      {stock.headline}
                    </div>
                    <div className="text-[11px] text-slate-400 leading-relaxed">
                      {stock.action_text}
                    </div>
                  </div>

                  {/* Execution Levels Grid */}
                  <div className="grid grid-cols-3 gap-2 bg-[#0A1324] p-3 rounded-xl border border-slate-800/80 font-mono text-center">
                    {strategyMode === "fast_scalp" ? (
                      <>
                        <div>
                          <div className="text-[10px] text-slate-500 uppercase">9/20 EMA Stack</div>
                          <div className={`text-xs font-bold truncate ${
                            stock.fast_scalp?.ema_stack === "BULLISH_9_20_50" ? "text-emerald-400" : "text-slate-400"
                          }`}>
                            {stock.fast_scalp?.ema_stack === "BULLISH_9_20_50" ? "ALIGNED ✓" : "NON-ALIGNED"}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-500 uppercase">Tight Stop</div>
                          <div className="text-xs font-bold text-rose-400">
                            ₹{stock.fast_scalp?.scalp_stop || stock.trade_levels.stop_loss}
                          </div>
                          <div className="text-[9px] text-rose-400/80">
                            -{stock.fast_scalp?.scalp_risk_pct || stock.trade_levels.risk_pct}%
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-500 uppercase">Scalp Target</div>
                          <div className="text-xs font-bold text-amber-300">
                            ₹{stock.fast_scalp?.scalp_target || stock.trade_levels.target_1}
                          </div>
                          <div className="text-[9px] text-emerald-400 font-bold">
                            +{stock.fast_scalp?.scalp_gain_pct || 2.5}%
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <div className="text-[10px] text-slate-500 uppercase">Buy Zone</div>
                          <div className="text-xs font-bold text-cyan-300 truncate">
                            ₹{stock.trade_levels.buy_zone_min}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-500 uppercase">Stop Loss</div>
                          <div className="text-xs font-bold text-rose-400">
                            ₹{stock.trade_levels.stop_loss}
                          </div>
                          <div className="text-[9px] text-rose-400/80">
                            -{stock.trade_levels.risk_pct}%
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-500 uppercase">Target 1</div>
                          <div className="text-xs font-bold text-emerald-400">
                            ₹{stock.trade_levels.target_1}
                          </div>
                          <div className="text-[9px] text-emerald-400/80">
                            +{stock.trade_levels.target_1_gain_pct}%
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* 12 FX Indicators Mini Matrix */}
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-mono text-slate-400 uppercase font-semibold">
                      12 FX Indicators Status:
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                      {Object.entries(stock.fx_indicators).map(([k, ind]) => (
                        <div
                          key={k}
                          className={`px-1.5 py-1 rounded text-[9px] font-mono text-center truncate border ${
                            ind.is_bullish
                              ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                              : "bg-slate-900 text-slate-500 border-slate-800"
                          }`}
                          title={`${ind.name}: ${ind.status} (${ind.display})`}
                        >
                          {ind.name.split(" ")[0]}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Context: Portfolio Holding vs Watchlist Thesis */}
                  {source === "portfolio" && stock.portfolio_context && (
                    <div className="flex items-center justify-between border-t border-slate-800/80 pt-3 text-xs font-mono">
                      <div>
                        <span className="text-slate-400">Holding: </span>
                        <span className="text-white font-bold">
                          {stock.portfolio_context.quantity} qty
                        </span>
                      </div>
                      <div
                        className={`font-bold ${
                          pnl >= 0 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {pnl >= 0 ? "+" : ""}₹{pnl.toLocaleString("en-IN")} ({pnlPct >= 0 ? "+" : ""}
                        {pnlPct.toFixed(1)}%)
                      </div>
                    </div>
                  )}

                  {source === "watchlist" && stock.watchlist_context && (
                    <div className="flex items-center justify-between border-t border-slate-800/80 pt-3 text-xs font-mono">
                      <div className="flex items-center gap-1 text-amber-400">
                        {[...Array(stock.watchlist_context.confidence_score || 3)].map((_, i) => (
                          <Star key={i} size={11} className="fill-amber-400" />
                        ))}
                      </div>
                      <div className="text-cyan-400 font-bold">
                        Target: ₹{stock.trade_levels.target_1}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => setChartStock(stock)}
                      className="flex-1 py-2 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <BarChart3 size={13} />
                      Open FX Chart
                    </button>
                    <button
                      onClick={() => setDiagnosticStock(stock)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                      title="View Detailed Diagnostic"
                    >
                      <Info size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Interactive Chart Slide-Over Modal */}
        {chartStock && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-2 md:p-6 animate-in fade-in">
            <div className="bg-[#050B14] border border-slate-800 rounded-3xl w-full max-w-6xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 md:px-6 border-b border-slate-800 bg-[#070F1E]">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                    <BarChart3 size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-black text-white font-mono">
                        {chartStock.symbol}
                      </h2>
                      <span className="text-xs text-slate-400">
                        {chartStock.company_name}
                      </span>
                      {renderSignalBadge(chartStock.signal)}
                    </div>
                    <div className="text-xs text-slate-400 font-mono">
                      CMP: ₹{chartStock.cmp} | Stop: ₹{chartStock.trade_levels.stop_loss} | Target 1: ₹{chartStock.trade_levels.target_1} | R:R {chartStock.trade_levels.reward_risk_ratio}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setChartStock(null)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Chart Body */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
                <TradingViewChart
                  symbol={chartStock.symbol}
                  exchange="NSE"
                  height={480}
                  pivotReference={chartStock.trade_levels.target_1}
                  scenarioTrigger={chartStock.trade_levels.buy_zone_max}
                  downsideReference={chartStock.trade_levels.stop_loss}
                  target1={chartStock.trade_levels.target_1}
                  alertLines={[
                    { price: chartStock.trade_levels.target_1, title: "Target 1", color: "#10b981", lineStyle: 0 },
                    { price: chartStock.trade_levels.target_2, title: "Target 2 (1.272 Fib)", color: "#06b6d4", lineStyle: 2 },
                    { price: chartStock.trade_levels.stop_loss, title: "Stop Loss", color: "#ef4444", lineStyle: 0 },
                    { price: chartStock.trade_levels.buy_zone_min, title: "Buy Zone Min", color: "#38bdf8", lineStyle: 2 },
                  ]}
                />

                {/* 12 FX Indicator Verdict Checklist */}
                <div className="bg-[#070F1E] border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
                    <span>12 FX Indicator Confluence Audit Checklist</span>
                    <span className="text-cyan-400 font-bold">
                      {chartStock.bullish_fx_count} of 12 Bullish ({chartStock.confluence_score}%)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {Object.entries(chartStock.fx_indicators).map(([k, ind]) => (
                      <div
                        key={k}
                        className={`p-2 rounded-xl border flex items-start gap-2 ${
                          ind.is_bullish
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                            : "bg-slate-900 border-slate-800 text-slate-400"
                        }`}
                      >
                        <CheckCircle2
                          size={14}
                          className={`mt-0.5 shrink-0 ${
                            ind.is_bullish ? "text-emerald-400" : "text-slate-600"
                          }`}
                        />
                        <div className="text-[11px] leading-tight">
                          <div className="font-bold">{ind.name}</div>
                          <div className="text-[10px] text-slate-400">{ind.display}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Detailed Diagnostic Modal (or Single Stock Scan Result) */}
        {(diagnosticStock || customDiagnostic) && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 md:p-6 animate-in fade-in">
            {(() => {
              const stock = diagnosticStock || customDiagnostic;
              if (!stock) return null;

              return (
                <div className="bg-[#050B14] border border-slate-800 rounded-3xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 space-y-6 shadow-2xl">
                  {/* Modal Header */}
                  <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                        <SlidersHorizontal size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-xl font-black text-white font-mono">
                            {stock.symbol}
                          </h2>
                          <span className="text-xs text-slate-400">
                            {stock.company_name}
                          </span>
                          {renderSignalBadge(stock.signal)}
                        </div>
                        <p className="text-xs text-slate-400">
                          Complete 12-factor FX indicator mathematical diagnostic & swing levels
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setDiagnosticStock(null);
                        setCustomDiagnostic(null);
                      }}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* Headline & Action */}
                  <div className="bg-[#0A1324] border border-slate-800 p-4 rounded-2xl space-y-2">
                    <div className="text-sm font-bold text-white flex items-center gap-2">
                      <Zap size={14} className="text-cyan-400" />
                      {stock.headline}
                    </div>
                    <div className="text-xs text-slate-300 leading-relaxed">
                      {stock.action_text}
                    </div>
                  </div>

                  {/* Execution Plan Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
                    <div className="bg-[#070F1E] border border-slate-800 p-3 rounded-xl text-center">
                      <div className="text-[10px] text-slate-500 uppercase">Buy Zone</div>
                      <div className="text-sm font-bold text-cyan-400">
                        {stock.trade_levels.buy_zone_display}
                      </div>
                    </div>
                    <div className="bg-[#070F1E] border border-slate-800 p-3 rounded-xl text-center">
                      <div className="text-[10px] text-slate-500 uppercase">Stop Loss</div>
                      <div className="text-sm font-bold text-rose-400">
                        ₹{stock.trade_levels.stop_loss}
                      </div>
                      <div className="text-[10px] text-rose-400/80">
                        -{stock.trade_levels.risk_pct}%
                      </div>
                    </div>
                    <div className="bg-[#070F1E] border border-slate-800 p-3 rounded-xl text-center">
                      <div className="text-[10px] text-slate-500 uppercase">Target 1</div>
                      <div className="text-sm font-bold text-emerald-400">
                        ₹{stock.trade_levels.target_1}
                      </div>
                      <div className="text-[10px] text-emerald-400/80">
                        +{stock.trade_levels.target_1_gain_pct}%
                      </div>
                    </div>
                    <div className="bg-[#070F1E] border border-slate-800 p-3 rounded-xl text-center">
                      <div className="text-[10px] text-slate-500 uppercase">Reward : Risk</div>
                      <div className="text-sm font-bold text-amber-400">
                        {stock.trade_levels.reward_risk_ratio}
                      </div>
                    </div>
                  </div>

                  {/* Fast Scalp Springboard Telemetry Card */}
                  {stock.fast_scalp && (
                    <div className="bg-[#0A1324] border border-amber-500/30 rounded-2xl p-4 space-y-3 shadow-lg">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                        <div className="flex items-center gap-2">
                          <Zap size={15} className="text-amber-400" />
                          <span className="text-xs font-mono font-bold text-amber-300 uppercase tracking-wider">
                            Fast Scalp Engine Telemetry (1-3 Day Quick In & Out)
                          </span>
                        </div>
                        <div>{renderScalpBadge(stock.fast_scalp.verdict)}</div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                        <div className={`p-2.5 rounded-xl border ${
                          stock.fast_scalp.ema_stack === "BULLISH_9_20_50"
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                            : "bg-slate-900 border-slate-800 text-slate-400"
                        }`}>
                          <div className="text-[10px] text-slate-500 uppercase">1. EMA Alignment</div>
                          <div className="font-bold text-xs mt-0.5">
                            {stock.fast_scalp.ema_stack === "BULLISH_9_20_50" ? "9 > 20 > 50 ✓" : "Non-Aligned ✗"}
                          </div>
                        </div>

                        <div className={`p-2.5 rounded-xl border ${
                          stock.fast_scalp.support_tested === "9_EMA_BOUNCE"
                            ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-300"
                            : "bg-slate-900 border-slate-800 text-slate-400"
                        }`}>
                          <div className="text-[10px] text-slate-500 uppercase">2. Dip Bounce</div>
                          <div className="font-bold text-xs mt-0.5">
                            {stock.fast_scalp.support_tested === "9_EMA_BOUNCE" ? "Tested 9/20 EMA ✓" : "No Pullback ✗"}
                          </div>
                        </div>

                        <div className={`p-2.5 rounded-xl border ${
                          stock.fast_scalp.reversal_bar === "CONFIRMED_GREEN"
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                            : "bg-slate-900 border-slate-800 text-slate-400"
                        }`}>
                          <div className="text-[10px] text-slate-500 uppercase">3. Reversal Bar</div>
                          <div className="font-bold text-xs mt-0.5">
                            {stock.fast_scalp.reversal_bar === "CONFIRMED_GREEN" ? "Green Candle ✓" : "Incomplete ✗"}
                          </div>
                        </div>

                        <div className={`p-2.5 rounded-xl border ${
                          stock.fast_scalp.supertrend_green
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                            : "bg-rose-500/10 border-rose-500/30 text-rose-300"
                        }`}>
                          <div className="text-[10px] text-slate-500 uppercase">4. Supertrend</div>
                          <div className="font-bold text-xs mt-0.5">
                            {stock.fast_scalp.supertrend_green ? "Green Bullish ✓" : "Red Bearish ✗"}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] font-mono border-t border-slate-800/80">
                        <span className="text-slate-400">
                          Scalp Target: <strong className="text-amber-300">₹{stock.fast_scalp.scalp_target}</strong> (+{stock.fast_scalp.scalp_gain_pct}%)
                        </span>
                        <span className="text-slate-400">
                          Tight Stop: <strong className="text-rose-400">₹{stock.fast_scalp.scalp_stop}</strong> (-{stock.fast_scalp.scalp_risk_pct}%)
                        </span>
                        <span className="text-purple-300 font-bold">
                          ⏱️ Max Hold: 1-3 Sessions (Avg: 1.6 Days)
                        </span>
                      </div>
                    </div>
                  )}

                  {/* 12 FX Indicators Detailed Breakdown */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
                      All 12 FX Indicators Confluence Details
                    </h4>
                    <div className="space-y-2">
                      {Object.entries(stock.fx_indicators).map(([k, ind]) => (
                        <div
                          key={k}
                          className="flex items-center justify-between p-3 rounded-xl bg-[#070F1E] border border-slate-800/80 text-xs"
                        >
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`w-2.5 h-2.5 rounded-full ${
                                ind.is_bullish ? "bg-emerald-400 shadow-[0_0_6px_#10b981]" : "bg-rose-500"
                              }`}
                            />
                            <div>
                              <div className="font-bold text-white">{ind.name}</div>
                              <div className="text-[10px] text-slate-500">{ind.category}</div>
                            </div>
                          </div>
                          <div className="text-right font-mono">
                            <div
                              className={`font-bold ${
                                ind.is_bullish ? "text-emerald-400" : "text-slate-400"
                              }`}
                            >
                              {ind.status}
                            </div>
                            <div className="text-[11px] text-slate-300">{ind.display}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                    <button
                      onClick={() => {
                        setChartStock(stock);
                        setDiagnosticStock(null);
                        setCustomDiagnostic(null);
                      }}
                      className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-md"
                    >
                      <BarChart3 size={14} /> Open Interactive Chart
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Flame,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  RefreshCw,
  SlidersHorizontal,
  ShieldAlert,
  Zap,
  CheckCircle2,
  ExternalLink,
  Target,
  BarChart3,
  Layers,
  Sparkles,
  Info,
} from "lucide-react";
import Link from "next/link";
import DashboardLayout from "@/components/layout/DashboardLayout";
import {
  PageHeader,
  KpiCard,
  LoadingSpinner,
  EmptyState,
  TabStrip,
  FilterPill,
  ActionButton,
} from "@/components/common";
import {
  fetchCandlesticks,
  fetchCandlestickSummary,
  CandlestickSignal,
  CandlestickMetadata,
  CandlestickSummaryResponse,
} from "@/lib/candlestickApi";

export default function CandlestickRadarPage() {
  const [signals, setSignals] = useState<CandlestickSignal[]>([]);
  const [metadata, setMetadata] = useState<CandlestickMetadata | null>(null);
  const [summary, setSummary] = useState<CandlestickSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [directionFilter, setDirectionFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [minScore, setMinScore] = useState<number>(60);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("ai_conviction_score");

  const loadData = useCallback(async (force = false) => {
    try {
      if (force) setIsRefreshing(true);
      else setIsLoading(true);
      setError(null);

      const [candlestickData, summaryData] = await Promise.all([
        fetchCandlesticks({
          direction: directionFilter,
          category: categoryFilter,
          min_score: minScore,
          search: searchQuery,
          sort_by: sortBy,
          sort_order: "desc",
          limit: 100,
          force_refresh: force,
        }),
        fetchCandlestickSummary(),
      ]);

      setSignals(candlestickData.signals || []);
      setMetadata(candlestickData.metadata || null);
      setSummary(summaryData || null);
    } catch (err: any) {
      console.error("Error loading candlestick radar:", err);
      setError(err?.message || "Failed to load candlestick patterns");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [directionFilter, categoryFilter, minScore, searchQuery, sortBy]);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  // Derived filter counts
  const bullCount = useMemo(() => signals.filter((s) => s.direction === "BULLISH").length, [signals]);
  const bearCount = useMemo(() => signals.filter((s) => s.direction === "BEARISH").length, [signals]);

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* ── HEADER ─────────────────────────────────────────────────── */}
        <PageHeader
          eyebrow={
            <><Flame className="w-4 h-4 text-amber-400 animate-pulse" />
            <span>Institutional Candlestick Pattern Radar • Strike &amp; TradingSim Engine</span></>
          }
          icon={<Flame className="w-5 h-5" />}
          iconColor="cyan"
          title="Algorithmic Candlestick Screener"
          badge={{ label: "20 TRIPLE & DOUBLE SETUPS", color: "cyan" }}
          subtitle="Mathematical pattern recognition scanning Morning Stars, Three White Soldiers, Engulfing bars, and Island reversals with volume expansion and DMA defense filters."
          actions={
            <>
              <ActionButton
                variant="secondary"
                onClick={() => loadData(true)}
                disabled={isRefreshing}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-cyan-400" : ""}`} />
                {isRefreshing ? "Scanning..." : "Rescan Universe"}
              </ActionButton>
              <Link
                href="/chart-patterns"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 text-xs font-semibold transition border border-cyan-500/40"
              >
                <Layers className="w-3.5 h-3.5" />
                Base Patterns
              </Link>
            </>
          }
        />

        {/* ── METRIC TILES ──────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard
            label="Total Signals"
            value={metadata?.total_signals ?? 0}
            sub={`${metadata?.universe_scanned ?? 0} Stocks`}
          />
          <KpiCard
            label="Bullish Reversals"
            value={summary?.direction_breakdown?.bullish ?? 0}
            sub="Buy Signals"
            color="emerald"
            icon={<ArrowUpRight className="w-3.5 h-3.5" />}
          />
          <KpiCard
            label="Bearish Reversals"
            value={summary?.direction_breakdown?.bearish ?? 0}
            sub="Trim / Stop"
            color="rose"
            icon={<ArrowDownRight className="w-3.5 h-3.5" />}
          />
          <KpiCard
            label="Triple Patterns"
            value={summary?.category_breakdown?.triple ?? 0}
            sub="3-Bar Confirmed"
            color="indigo"
            icon={<Layers className="w-3.5 h-3.5" />}
          />
          <KpiCard
            label="Double Patterns"
            value={summary?.category_breakdown?.double ?? 0}
            sub="Engulfing / Line"
            color="amber"
            icon={<Sparkles className="w-3.5 h-3.5" />}
          />
          <KpiCard
            label="Pin-bars / Single"
            value={summary?.category_breakdown?.single ?? 0}
            sub="Hammers / Stars"
            color="cyan"
            icon={<Zap className="w-3.5 h-3.5" />}
          />
        </div>

      {/* ── FILTER & TOOLBAR RIBBON ────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-xl p-4 mb-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 shadow-xs">
        {/* Direction Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-950 p-1 rounded-lg border border-slate-200 dark:border-slate-800/80">
          <button
            onClick={() => setDirectionFilter("ALL")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
              directionFilter === "ALL" ? "bg-cyan-600 text-white shadow" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            All Signals ({signals.length})
          </button>
          <button
            onClick={() => setDirectionFilter("BULLISH")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition ${
              directionFilter === "BULLISH"
                ? "bg-emerald-600 text-white shadow"
                : "text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400"
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5" /> Bullish ({bullCount})
          </button>
          <button
            onClick={() => setDirectionFilter("BEARISH")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1 transition ${
              directionFilter === "BEARISH"
                ? "bg-rose-600 text-white shadow"
                : "text-slate-600 dark:text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
            }`}
          >
            <ArrowDownRight className="w-3.5 h-3.5" /> Bearish ({bearCount})
          </button>
        </div>

        {/* Category & Score Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Category Dropdown */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 dark:text-slate-400 text-xs font-mono">Type:</span>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs rounded-lg px-2.5 py-1.5 font-mono focus:outline-none focus:border-cyan-500 cursor-pointer shadow-xs"
            >
              <option value="ALL">All Categories</option>
              <option value="TRIPLE">Triple Candlestick (Strike.money)</option>
              <option value="DOUBLE">Double Candlestick (Engulfing)</option>
              <option value="SINGLE">Single Candlestick (Hammers)</option>
            </select>
          </div>

          {/* Min Conviction Score */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 dark:text-slate-400 text-xs font-mono">Min Conviction:</span>
            <select
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs rounded-lg px-2.5 py-1.5 font-mono focus:outline-none focus:border-cyan-500 cursor-pointer shadow-xs"
            >
              <option value={50}>50+ (All Setups)</option>
              <option value={70}>70+ (High Probability)</option>
              <option value={80}>80+ (Elite Institutional)</option>
              <option value={90}>90+ (Ultra Sniper)</option>
            </select>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search symbol / pattern..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-200 text-xs rounded-lg pl-8 pr-3 py-1.5 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-44 md:w-56 font-mono shadow-2xs"
            />
          </div>
        </div>
      </div>

      {/* ── LOADING / ERROR STATE ─────────────────────────────────────── */}
      {isLoading && (
        <div className="py-24 text-center">
          <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-3" />
          <p className="text-slate-300 font-mono text-sm">Evaluating Candlestick Formations across universe...</p>
          <p className="text-slate-500 text-xs mt-1">Analyzing body/shadow ratios, volume expansions & DMA defenses.</p>
        </div>
      )}

      {error && !isLoading && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs mb-6 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-rose-400" />
          <span>Error loading candlestick radar: {error}</span>
        </div>
      )}

      {/* ── PATTERN CARD GRID ─────────────────────────────────────────── */}
      {!isLoading && signals.length === 0 && !error && (
        <div className="py-20 text-center bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <Info className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto mb-2" />
          <p className="text-slate-700 dark:text-slate-300 font-mono text-sm">No active candlestick patterns match current filter criteria.</p>
          <p className="text-slate-500 text-xs mt-1">Try lowering the minimum conviction score or switching category to ALL.</p>
        </div>
      )}

      {!isLoading && signals.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {signals.map((sig, idx) => {
            const isBullish = sig.direction === "BULLISH";
            const borderGlow = isBullish ? "hover:border-emerald-500/50" : "hover:border-rose-500/50";
            const badgeBg = isBullish ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" : "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30";

            return (
              <div
                key={`${sig.symbol}-${sig.pattern_key}-${idx}`}
                className={`bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl p-4 transition-all duration-200 ${borderGlow} flex flex-col justify-between shadow-xs hover:shadow-md`}
              >
                <div>
                  {/* Top Bar: Symbol, Price, Category */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-slate-900 dark:text-white font-mono">{sig.symbol}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">₹{sig.cmp.toFixed(2)}</span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{sig.trend_context.replace(/_/g, " ")}</div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border font-semibold ${badgeBg}`}>
                        {sig.direction} • {sig.category}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">{sig.timestamp}</span>
                    </div>
                  </div>

                  {/* Pattern Header */}
                  <div className="bg-slate-50 dark:bg-slate-950/70 p-3 rounded-lg border border-slate-200 dark:border-slate-800/80 mb-3 shadow-2xs">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <Flame className={`w-3.5 h-3.5 ${isBullish ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`} />
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">{sig.pattern_name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">AI Score:</span>
                        <span className={`text-xs font-mono font-bold ${sig.ai_conviction_score >= 80 ? "text-cyan-700 dark:text-cyan-400" : "text-amber-600 dark:text-amber-400"}`}>
                          {sig.ai_conviction_score}/100
                        </span>
                      </div>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 text-xs line-clamp-2 leading-relaxed">{sig.description}</p>
                  </div>

                  {/* Quantitative Signals: Volume, Confluence, RSI */}
                  <div className="grid grid-cols-3 gap-2 mb-3 text-[11px] font-mono">
                    <div className="bg-slate-50 dark:bg-slate-950/40 p-2 rounded border border-slate-200 dark:border-slate-800/60 shadow-2xs">
                      <span className="text-slate-500 text-[10px] block">Volume Surge</span>
                      <span className={`font-semibold ${sig.volume_surge_ratio >= 1.3 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-700 dark:text-slate-300"}`}>
                        {sig.volume_surge_ratio}x MA20
                      </span>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-950/40 p-2 rounded border border-slate-200 dark:border-slate-800/60 shadow-2xs">
                      <span className="text-slate-500 text-[10px] block">RSI 14</span>
                      <span className={`font-semibold ${sig.rsi_14 <= 55 ? "text-cyan-700 dark:text-cyan-400" : "text-amber-600 dark:text-amber-400"}`}>
                        {sig.rsi_14}
                      </span>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-950/40 p-2 rounded border border-slate-200 dark:border-slate-800/60 shadow-2xs">
                      <span className="text-slate-500 text-[10px] block">R:R Ratio</span>
                      <span className="font-semibold text-indigo-700 dark:text-indigo-300">{sig.risk_reward}:1</span>
                    </div>
                  </div>

                  {/* DMA Confluence Tag */}
                  <div className="flex items-center justify-between text-[11px] font-mono px-2.5 py-1.5 rounded bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-900/40 text-cyan-800 dark:text-cyan-300 mb-3 shadow-2xs">
                    <span>DMA Confluence:</span>
                    <span className="font-semibold">{sig.dma_confluence.replace(/_/g, " ")}</span>
                  </div>

                  {/* Exact Rupee Execution Blueprint */}
                  <div className="bg-slate-50 dark:bg-slate-950/80 p-3 rounded-lg border border-slate-200 dark:border-slate-800/90 text-xs font-mono space-y-1.5 mb-3 shadow-2xs">
                    <div className="flex justify-between items-center text-slate-700 dark:text-slate-300">
                      <span className="text-slate-500">Trigger Level:</span>
                      <span className="font-semibold text-slate-900 dark:text-white">₹{sig.trigger_price.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-rose-600 dark:text-rose-300">
                      <span className="text-slate-500">Invalidation Stop:</span>
                      <span className="font-semibold text-rose-600 dark:text-rose-400">₹{sig.stop_loss.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-emerald-700 dark:text-emerald-300">
                      <span className="text-slate-500">Target 1 (Harvest):</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">₹{sig.target_1.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-cyan-700 dark:text-cyan-300">
                      <span className="text-slate-500">Target 2 (Runner):</span>
                      <span className="font-semibold text-cyan-600 dark:text-cyan-400">₹{sig.target_2.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Card Footer: Quick Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800/80">
                  <span className="text-[10px] text-slate-500 font-mono">
                    Reliability: <span className="text-slate-700 dark:text-slate-300 font-semibold">{sig.reliability.replace("_", " ")}</span>
                  </span>

                  <div className="flex items-center gap-2">
                    <Link
                      href={`/stocks/${sig.symbol}`}
                      className="flex items-center gap-1 text-[11px] font-semibold text-cyan-700 dark:text-cyan-400 hover:text-cyan-600 dark:hover:text-cyan-300 transition"
                    >
                      <span>Chart & DMA</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </div>
    </DashboardLayout>
  );
}

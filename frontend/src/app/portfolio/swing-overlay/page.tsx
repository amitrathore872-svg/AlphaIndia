"use client";

import React, { useEffect, useState, useMemo } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import {
  fetchSwingDashboard,
  fetchStockDiagnostic,
  fetchStockBacktest,
  SwingDashboardResponse,
  SwingOpportunityCard,
  SwingBacktestResponse,
} from "@/lib/swingOverlayApi";
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
  Clock,
  Sparkles,
  Info,
  X,
  CheckCircle2,
  Briefcase,
  Eye,
  Compass,
} from "lucide-react";

export default function SwingOverlayPage() {
  const [source, setSource] = useState<"holdings" | "watchlist" | "universal">("holdings");
  const [data, setData] = useState<SwingDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterState, setFilterState] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Universal Ticker Search State
  const [customTicker, setCustomTicker] = useState("");
  const [isSearchingTicker, setIsSearchingTicker] = useState(false);
  const [searchedCard, setSearchedCard] = useState<SwingOpportunityCard | null>(null);

  // Modals
  const [selectedDiagnostic, setSelectedDiagnostic] = useState<SwingOpportunityCard | null>(null);
  const [selectedBacktest, setSelectedBacktest] = useState<SwingBacktestResponse | null>(null);
  const [backtestLoading, setBacktestLoading] = useState(false);

  // Load Dashboard Data
  const loadData = async (currentSource: string, isSilent: boolean = false) => {
    if (!isSilent) setLoading(true);
    setRefreshing(true);
    try {
      const res = await fetchSwingDashboard(currentSource);
      setData(res);
    } catch (err) {
      console.error("Error loading swing overlay dashboard:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData(source);
  }, [source]);

  // Handle Custom Ticker Search
  const handleSearchTicker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customTicker.trim()) return;
    setIsSearchingTicker(true);
    try {
      const card = await fetchStockDiagnostic(customTicker.trim().toUpperCase());
      setSearchedCard(card);
    } catch (err) {
      alert(`Ticker ${customTicker.toUpperCase()} not found or insufficient market bars.`);
    } finally {
      setIsSearchingTicker(false);
    }
  };

  // Open Backtest Modal
  const handleOpenBacktest = async (sym: string) => {
    setBacktestLoading(true);
    try {
      const res = await fetchStockBacktest(sym);
      setSelectedBacktest(res);
    } catch (err) {
      alert(`Could not load backtest for ${sym}`);
    } finally {
      setBacktestLoading(false);
    }
  };

  // Filter & Search Logic
  const filteredCards = useMemo(() => {
    if (!data?.opportunities) return [];
    return data.opportunities.filter((card) => {
      const matchesSearch =
        card.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        card.headline.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      if (filterState === "ALL") return true;
      if (filterState === "BUY_READY") return card.status === "BUY_READY";
      if (filterState === "PROFIT_EXHAUSTION") return card.status === "PROFIT_EXHAUSTION_SELL" || card.status === "PROFIT_ZONE";
      if (filterState === "ACCUMULATE") return card.status === "ACCUMULATE_DIP";
      if (filterState === "PULLBACK") return card.status === "PULLBACK_WATCH";
      if (filterState === "DOWNTREND") return card.status === "DOWNTREND_PAUSED";
      return true;
    });
  }, [data, filterState, searchQuery]);

  return (
    <DashboardLayout>
      <div className="space-y-4 pb-12">
        {/* ========================================================================= */}
        {/* TOP HEADER & SOURCE SELECTOR                                              */}
        {/* ========================================================================= */}
        <div className="flex flex-col gap-4 rounded-xl border border-cyan-500/20 bg-[#070f1e]/90 p-4 shadow-xl backdrop-blur-md lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/20 text-cyan-400">
                <Zap className="h-4 w-4" />
              </span>
              <h1 className="text-xl font-bold tracking-wider text-white">
                ALPHA SWING OVERLAY ENGINE <span className="text-xs font-semibold text-cyan-400">AIOSE v3.0</span>
              </h1>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Tactical 15M/1H Swings on Core Holdings & Watchlists • Fractal Swing Pivots & Adaptive Indicator DNA
            </p>
          </div>

          {/* 3-Way Mode Selector */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-slate-700/60 bg-slate-900/80 p-1">
              <button
                onClick={() => { setSource("holdings"); setSearchedCard(null); }}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  source === "holdings"
                    ? "bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/30"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                <Briefcase className="h-3.5 w-3.5" />
                Portfolio Overlay
              </button>
              <button
                onClick={() => { setSource("watchlist"); setSearchedCard(null); }}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  source === "watchlist"
                    ? "bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/30"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                <Eye className="h-3.5 w-3.5" />
                Watchlist Opportunities
              </button>
              <button
                onClick={() => { setSource("universal"); setSearchedCard(null); }}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  source === "universal"
                    ? "bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/30"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                <Compass className="h-3.5 w-3.5" />
                Universal Radar
              </button>
            </div>

            <button
              onClick={() => loadData(source, true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-700"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-cyan-400" : ""}`} />
              {refreshing ? "Scanning..." : "Re-Scan"}
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* EXECUTIVE KPI RIBBON                                                      */}
        {/* ========================================================================= */}
        {data?.kpi && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-3 shadow-lg">
              <span className="text-[10px] font-semibold tracking-wider text-emerald-400">ACTIVE SWING ALPHA</span>
              <div className="mt-1 text-lg font-extrabold text-emerald-400">
                +₹{data.kpi.active_swing_alpha_cash.toLocaleString()}
              </div>
              <span className="text-[11px] text-emerald-500/80">+{data.kpi.active_swing_alpha_pct}% excess yield</span>
            </div>

            <div className="rounded-xl border border-cyan-500/20 bg-[#081528] p-3 shadow-lg">
              <span className="text-[10px] font-semibold tracking-wider text-cyan-400">WIN RATE (60-DAY)</span>
              <div className="mt-1 text-lg font-extrabold text-white">{data.kpi.global_win_rate}%</div>
              <span className="text-[11px] text-slate-400">Verified Empirical Rate</span>
            </div>

            <div className="rounded-xl border border-cyan-500/20 bg-[#081528] p-3 shadow-lg">
              <span className="text-[10px] font-semibold tracking-wider text-cyan-400">PROFIT FACTOR</span>
              <div className="mt-1 text-lg font-extrabold text-white">{data.kpi.profit_factor}x</div>
              <span className="text-[11px] text-slate-400">Reward:Risk {data.kpi.reward_risk}</span>
            </div>

            <div className="rounded-xl border border-blue-500/20 bg-[#081528] p-3 shadow-lg">
              <span className="text-[10px] font-semibold tracking-wider text-blue-400">MONITORED STOCKS</span>
              <div className="mt-1 text-lg font-extrabold text-white">{data.kpi.monitored_stocks_count} Equities</div>
              <span className="text-[11px] text-slate-400">{data.portfolio?.name || "Active Scanner Universe"}</span>
            </div>

            <div className="rounded-xl border border-emerald-500/20 bg-[#081528] p-3 shadow-lg">
              <span className="text-[10px] font-semibold tracking-wider text-emerald-400">SNIPER BUY READY</span>
              <div className="mt-1 text-lg font-extrabold text-emerald-400">{data.kpi.buy_ready_count} Setups</div>
              <span className="text-[11px] text-slate-400">Fib Golden Pocket</span>
            </div>

            <div className="rounded-xl border border-amber-500/20 bg-[#081528] p-3 shadow-lg">
              <span className="text-[10px] font-semibold tracking-wider text-amber-400">TOP EXHAUSTION</span>
              <div className="mt-1 text-lg font-extrabold text-amber-400">{data.kpi.exhaustion_sell_count} Alerts</div>
              <span className="text-[11px] text-slate-400">Book Partial Profits</span>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* UNIVERSAL TICKER SEARCH BAR                                               */}
        {/* ========================================================================= */}
        <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-[#0a1426] p-3 sm:flex-row sm:items-center sm:justify-between">
          <form onSubmit={handleSearchTicker} className="flex flex-1 items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Universal Ticker Search (e.g. TRENT, DIXON, HAL, RELIANCE, ZOMATO)..."
                value={customTicker}
                onChange={(e) => setCustomTicker(e.target.value)}
                className="w-full rounded-lg border border-slate-700/60 bg-slate-900/90 py-2 pl-9 pr-4 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              />
            </div>
            <button
              type="submit"
              disabled={isSearchingTicker}
              className="flex items-center gap-1.5 rounded-lg bg-cyan-500 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-cyan-400"
            >
              {isSearchingTicker ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Diagnose Stock
            </button>
          </form>

          {/* Quick Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: "ALL", label: "ALL" },
              { id: "BUY_READY", label: "⚡ BUY READY" },
              { id: "PROFIT_EXHAUSTION", label: "🔴 TOP EXHAUSTION" },
              { id: "ACCUMULATE", label: "♻️ DEEP DIP" },
              { id: "PULLBACK", label: "⏳ PULLBACK" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterState(tab.id)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${
                  filterState === tab.id
                    ? "bg-slate-700 text-white shadow-sm"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* SEARCHED TICKER CARD (IF ACTIVE)                                         */}
        {/* ========================================================================= */}
        {searchedCard && (
          <div className="rounded-xl border border-cyan-500/40 bg-gradient-to-r from-cyan-950/30 to-[#070f1e] p-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
              <div className="flex items-center gap-3">
                <span className="rounded-lg bg-cyan-500/20 px-2.5 py-1 text-sm font-black tracking-wider text-cyan-400">
                  {searchedCard.symbol}
                </span>
                <span className="text-sm font-bold text-white">₹{searchedCard.cmp.toLocaleString()}</span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    searchedCard.status === "BUY_READY"
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse"
                      : searchedCard.status === "PROFIT_EXHAUSTION_SELL"
                      ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse"
                      : "bg-slate-700 text-slate-300"
                  }`}
                >
                  {searchedCard.status.replace(/_/g, " ")}
                </span>
              </div>
              <button
                onClick={() => setSearchedCard(null)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                <span className="text-[10px] text-slate-400">Optimal Buy Zone (Golden Pocket)</span>
                <div className="mt-1 text-sm font-bold text-emerald-400">{searchedCard.structure.buy_zone}</div>
                <div className="text-[10px] text-slate-500">Stop Loss: ₹{searchedCard.structure.stop_loss} (Below Swing Low)</div>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                <span className="text-[10px] text-slate-400">Sell On Top Targets</span>
                <div className="mt-1 text-sm font-bold text-amber-400">T1: ₹{searchedCard.structure.target_1}</div>
                <div className="text-[10px] text-slate-500">T2 Blow-off: ₹{searchedCard.structure.target_2} (1.272 Fib Ext)</div>
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
                <span className="text-[10px] text-slate-400">Adaptive Indicator DNA</span>
                <div className="mt-1 text-xs font-bold text-cyan-400">{searchedCard.indicator_dna.best_indicator.replace(/_/g, " ")}</div>
                <div className="text-[10px] text-slate-500">Quant Score: {searchedCard.quant_score}/100</div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedDiagnostic(searchedCard)}
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-800 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-700"
                >
                  Deep Diagnostic
                </button>
                <button
                  onClick={() => handleOpenBacktest(searchedCard.symbol)}
                  className="flex-1 rounded-lg bg-cyan-500 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-cyan-400"
                >
                  Run Backtest
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MAIN OPPORTUNITY GRID                                                     */}
        {/* ========================================================================= */}
        {loading ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3">
            <RefreshCw className="h-8 w-8 animate-spin text-cyan-400" />
            <span className="text-xs text-slate-400">Scanning market structure, swing pivots & indicator DNA...</span>
          </div>
        ) : filteredCards.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-[#070f1e] p-12 text-center">
            <Info className="mx-auto h-8 w-8 text-slate-500" />
            <h3 className="mt-2 text-sm font-bold text-white">No Stocks Match Current Filter</h3>
            <p className="mt-1 text-xs text-slate-400">Try switching tabs or resetting filter pills above.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredCards.map((card) => {
              const isBuyReady = card.status === "BUY_READY";
              const isExhaustion = card.status === "PROFIT_EXHAUSTION_SELL";
              const isDeepDip = card.status === "ACCUMULATE_DIP";

              return (
                <div
                  key={card.symbol}
                  className={`group relative flex flex-col justify-between rounded-xl border p-4 shadow-lg transition-all duration-200 hover:shadow-cyan-500/10 ${
                    isBuyReady
                      ? "border-emerald-500/50 bg-gradient-to-b from-emerald-950/20 to-[#070f1e]"
                      : isExhaustion
                      ? "border-amber-500/50 bg-gradient-to-b from-amber-950/20 to-[#070f1e]"
                      : isDeepDip
                      ? "border-cyan-500/40 bg-gradient-to-b from-cyan-950/20 to-[#070f1e]"
                      : "border-slate-800 bg-[#070f1e] hover:border-slate-700"
                  }`}
                >
                  {/* Card Header */}
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-extrabold tracking-wide text-white">{card.symbol}</span>
                          <span className="text-xs font-semibold text-slate-300">₹{card.cmp.toLocaleString()}</span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                              card.daily_trend_up
                                ? "bg-emerald-500/20 text-emerald-400"
                                : "bg-red-500/20 text-red-400"
                            }`}
                          >
                            {card.daily_trend_up ? "Daily Trend UP" : "Daily Trend DOWN"}
                          </span>
                          <span className="text-[10px] text-slate-400">RSI: {card.rsi}</span>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                          isBuyReady
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse"
                            : isExhaustion
                            ? "bg-amber-500/20 text-amber-400 border border-amber-500/40 animate-pulse"
                            : isDeepDip
                            ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                            : "bg-slate-800 text-slate-400 border border-slate-700/50"
                        }`}
                      >
                        {card.status.replace(/_/g, " ")}
                      </span>
                    </div>

                    {/* Action Headline */}
                    <div className="mt-3 rounded-lg border border-slate-800/80 bg-slate-900/70 p-2.5">
                      <div className="text-[11px] font-semibold text-slate-200">{card.headline}</div>
                      <div className="mt-0.5 text-[10px] text-slate-400">{card.action}</div>
                    </div>

                    {/* Structural Levels Grid */}
                    <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                      <div className="rounded border border-slate-800 bg-[#081222] p-2">
                        <span className="text-[9px] uppercase tracking-wider text-slate-400">Optimal Buy Zone</span>
                        <div className="mt-0.5 font-bold text-emerald-400">{card.structure.buy_zone}</div>
                        <div className="text-[9px] text-slate-500">SL: ₹{card.structure.stop_loss}</div>
                      </div>

                      <div className="rounded border border-slate-800 bg-[#081222] p-2">
                        <span className="text-[9px] uppercase tracking-wider text-slate-400">Sell on Top Targets</span>
                        <div className="mt-0.5 font-bold text-amber-400">T1: ₹{card.structure.target_1}</div>
                        <div className="text-[9px] text-slate-500">T2 Ext: ₹{card.structure.target_2}</div>
                      </div>
                    </div>

                    {/* DNA & Position Split Details */}
                    <div className="mt-3 flex items-center justify-between border-t border-slate-800/60 pt-2 text-[10px]">
                      <div className="flex items-center gap-1.5 text-cyan-400 font-medium">
                        <Sparkles className="h-3 w-3" />
                        <span>{card.indicator_dna.best_indicator.replace(/_/g, " ")} DNA</span>
                      </div>
                      <div className="font-semibold text-slate-300">
                        R:R {card.structure.reward_risk}
                      </div>
                    </div>

                    {card.holding_details && (
                      <div className="mt-2 flex items-center justify-between rounded bg-slate-900/60 px-2 py-1 text-[10px] text-slate-400">
                        <span>Core (70%): <strong className="text-white">{card.holding_details.core_shares} sh</strong></span>
                        <span>Swing Tranche: <strong className="text-cyan-400">{card.holding_details.swing_shares} sh</strong></span>
                      </div>
                    )}
                  </div>

                  {/* Card Footer Actions */}
                  <div className="mt-3 flex items-center gap-2 pt-2">
                    <button
                      onClick={() => setSelectedDiagnostic(card)}
                      className="flex-1 rounded-lg border border-slate-700 bg-slate-800/80 py-1.5 text-center text-xs font-semibold text-slate-200 transition hover:bg-slate-700"
                    >
                      Diagnostic
                    </button>
                    <button
                      onClick={() => handleOpenBacktest(card.symbol)}
                      className="flex-1 rounded-lg border border-cyan-500/30 bg-cyan-500/10 py-1.5 text-center text-xs font-bold text-cyan-400 transition hover:bg-cyan-500 hover:text-slate-950"
                    >
                      Backtest Audit
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ========================================================================= */}
        {/* DIAGNOSTIC MODAL DRAWER                                                   */}
        {/* ========================================================================= */}
        {selectedDiagnostic && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-cyan-500/30 bg-[#070f1e] p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black text-white">{selectedDiagnostic.symbol}</h2>
                    <span className="text-sm font-bold text-cyan-400">₹{selectedDiagnostic.cmp}</span>
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-300">
                      Score: {selectedDiagnostic.quant_score}/100
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{selectedDiagnostic.headline}</p>
                </div>
                <button
                  onClick={() => setSelectedDiagnostic(null)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 space-y-4 text-xs">
                {/* 4-Pillar Indicator DNA */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                  <h4 className="font-bold text-white flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-cyan-400" />
                    Adaptive Indicator DNA Weights (Historical Payoff on {selectedDiagnostic.symbol})
                  </h4>
                  <div className="mt-3 space-y-2">
                    {Object.entries(selectedDiagnostic.indicator_dna.weights).map(([k, v]) => (
                      <div key={k}>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-slate-300">{k.replace(/_/g, " ")}</span>
                          <span className="font-bold text-cyan-400">{v}%</span>
                        </div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                          <div className="h-full rounded-full bg-cyan-400" style={{ width: `${v}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Top Exhaustion Radar */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                  <h4 className="font-bold text-white flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                    Top Exhaustion Radar (Probability: {selectedDiagnostic.top_exhaustion.probability}%)
                  </h4>
                  {selectedDiagnostic.top_exhaustion.reasons.length > 0 ? (
                    <ul className="mt-2 space-y-1 text-slate-300">
                      {selectedDiagnostic.top_exhaustion.reasons.map((r, i) => (
                        <li key={i} className="flex items-center gap-1.5 text-amber-400/90">
                          <span>•</span> {r}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-slate-400">No exhaustion flags detected. Trend healthy.</p>
                  )}
                </div>

                {/* Structural Geometry Levels */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                  <h4 className="font-bold text-white flex items-center gap-1.5">
                    <Target className="h-4 w-4 text-emerald-400" />
                    Structural Geometry & Price Execution Levels
                  </h4>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div className="rounded border border-slate-800 bg-slate-950 p-2.5">
                      <span className="text-[10px] text-slate-400">Current Swing Low</span>
                      <div className="text-sm font-bold text-white">₹{selectedDiagnostic.structure.last_swing_low}</div>
                      <div className="text-[10px] text-red-400">Stop Loss: ₹{selectedDiagnostic.structure.stop_loss}</div>
                    </div>
                    <div className="rounded border border-slate-800 bg-slate-950 p-2.5">
                      <span className="text-[10px] text-slate-400">Current Swing High</span>
                      <div className="text-sm font-bold text-white">₹{selectedDiagnostic.structure.last_swing_high}</div>
                      <div className="text-[10px] text-amber-400">Target 2 (1.272 Ext): ₹{selectedDiagnostic.structure.target_2}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* BACKTEST AUDIT MODAL DRAWER                                               */}
        {/* ========================================================================= */}
        {selectedBacktest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
            <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-cyan-500/30 bg-[#070f1e] p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black text-white">{selectedBacktest.symbol} Backtest Audit</h2>
                    <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-xs font-bold text-emerald-400">
                      Win Rate: {selectedBacktest.win_rate}%
                    </span>
                    <span className="rounded bg-cyan-500/20 px-2 py-0.5 text-xs font-bold text-cyan-400">
                      Profit Factor: {selectedBacktest.profit_factor}x
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">Tested over last 90 trading days using 1H candles & Variant 9 rules</p>
                </div>
                <button
                  onClick={() => setSelectedBacktest(null)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mt-4 space-y-4 text-xs">
                {/* KPI Overview */}
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5">
                    <span className="text-[10px] text-slate-400">Total Trades</span>
                    <div className="mt-0.5 text-base font-bold text-white">{selectedBacktest.total_trades}</div>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5">
                    <span className="text-[10px] text-slate-400">Avg Win</span>
                    <div className="mt-0.5 text-base font-bold text-emerald-400">+{selectedBacktest.avg_win_pct}%</div>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5">
                    <span className="text-[10px] text-slate-400">Avg Loss</span>
                    <div className="mt-0.5 text-base font-bold text-red-400">{selectedBacktest.avg_loss_pct}%</div>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-2.5">
                    <span className="text-[10px] text-slate-400">Net Return</span>
                    <div className="mt-0.5 text-base font-bold text-cyan-400">+{selectedBacktest.net_cumulative_return_pct}%</div>
                  </div>
                </div>

                {/* Recent Trade Ledger */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                  <h4 className="font-bold text-white">Recent Trade Logs & Exit Reasons</h4>
                  <div className="mt-2 space-y-1.5">
                    {selectedBacktest.recent_trades.map((t, i) => (
                      <div key={i} className="flex items-center justify-between rounded bg-slate-950 p-2 text-[11px]">
                        <span className="font-semibold text-slate-300">
                          In: ₹{t.entry_price} → Out: ₹{t.exit_price}
                        </span>
                        <span className={`font-bold ${t.gain_pct > 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {t.gain_pct > 0 ? `+${t.gain_pct}%` : `${t.gain_pct}%`}
                        </span>
                        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-400 font-medium">
                          {t.tag}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

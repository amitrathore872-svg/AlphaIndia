"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Flame,
  Play,
  RotateCw,
  TrendingUp,
  Activity,
  Zap,
  ShieldCheck,
  Radar,
  ArrowUpRight,
  Clock,
  Radio,
  BarChart3,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Search,
  Filter,
  ArrowRight,
  ChevronRight,
  Target,
  DollarSign,
  Maximize2,
  Eye,
  Info,
  X,
  Sparkles,
  List,
  LayoutGrid,
} from "lucide-react";
import Link from "next/link";
import DashboardLayout from "@/components/layout/DashboardLayout";
import AddToWatchlistButton from "@/components/watchlist/AddToWatchlistButton";
import { API_BASE } from "@/lib/apiConfig";

export default function VelocityBurstElitePage() {
  const [activeTab, setActiveTab] = useState<
    "recommendations" | "live" | "btst"
  >("recommendations");

  // View modes (table list view vs card grid view, defaulting to high-density list)
  const [liveViewMode, setLiveViewMode] = useState<"list" | "grid">("list");
  const [recViewMode, setRecViewMode] = useState<"list" | "grid">("list");

  // State caches
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [recSummary, setRecSummary] = useState<any>(null);
  const [recCategoryFilter, setRecCategoryFilter] = useState<string>("ALL");
  const [status, setStatus] = useState<any>(null);
  const [marketRegime, setMarketRegime] = useState<any>(null);
  const [sleepingGiants, setSleepingGiants] = useState<any[]>([]);
  const [patterns, setPatterns] = useState<any[]>([]);
  const [liveSignals, setLiveSignals] = useState<any[]>([]);
  const [btstCandidates, setBtstCandidates] = useState<any[]>([]);
  const [trades, setTrades] = useState<any[]>([]);
  const [sectors, setSectors] = useState<any[]>([]);
  const [backtests, setBacktests] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [scanBusy, setScanBusy] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Filters
  const [filterConfidence, setFilterConfidence] = useState<string>("ALL");
  const [filterSector, setFilterSector] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState<string>("");

  // Explainability drawer state
  const [selectedStock, setSelectedStock] = useState<any | null>(null);
  const [stockDossier, setStockDossier] = useState<any | null>(null);
  const [dossierLoading, setDossierLoading] = useState<boolean>(false);

  // Strict distinct symbol deduplication helper
  const uniqueBySymbol = useCallback((arr: any[]) => {
    const seen = new Set<string>();
    return (arr || []).filter((item) => {
      const sym = (item?.symbol || "").toUpperCase();
      if (!sym || seen.has(sym)) return false;
      seen.add(sym);
      return true;
    });
  }, []);

  // Fetch initial data with settled promises and robust error handling
  const fetchData = useCallback(async () => {
    try {
      const results = await Promise.allSettled([
        fetch(`${API_BASE}/api/v4/velocity/status`),
        fetch(`${API_BASE}/api/v4/velocity/market-regime`),
        fetch(`${API_BASE}/api/v4/velocity/sleeping-giants?limit=50`),
        fetch(`${API_BASE}/api/v4/velocity/patterns?limit=50`),
        fetch(`${API_BASE}/api/v4/velocity/live-signals?limit=50&active_only=false`),
        fetch(`${API_BASE}/api/v4/velocity/btst?limit=50`),
        fetch(`${API_BASE}/api/v4/velocity/trade?limit=50`),
        fetch(`${API_BASE}/api/v4/velocity/sector`),
        fetch(`${API_BASE}/api/v4/velocity/backtest`),
        fetch(`${API_BASE}/api/v4/velocity/recommendations?limit_per_category=25`),
      ]);

      const [stRes, regRes, sgRes, patRes, liveRes, btstRes, trRes, secRes, btRes, recRes] = results;
      let anySuccess = false;

      if (stRes.status === "fulfilled" && stRes.value.ok) {
        setStatus(await stRes.value.json());
        anySuccess = true;
      }
      if (regRes.status === "fulfilled" && regRes.value.ok) {
        setMarketRegime(await regRes.value.json());
        anySuccess = true;
      }
      if (sgRes.status === "fulfilled" && sgRes.value.ok) {
        const j = await sgRes.value.json();
        setSleepingGiants(j.items || []);
        anySuccess = true;
      }
      if (patRes.status === "fulfilled" && patRes.value.ok) {
        const j = await patRes.value.json();
        setPatterns(j.items || []);
        anySuccess = true;
      }
      if (liveRes.status === "fulfilled" && liveRes.value.ok) {
        const j = await liveRes.value.json();
        setLiveSignals(j.items || []);
        anySuccess = true;
      }
      if (btstRes.status === "fulfilled" && btstRes.value.ok) {
        const j = await btstRes.value.json();
        setBtstCandidates(j.items || []);
        anySuccess = true;
      }
      if (trRes.status === "fulfilled" && trRes.value.ok) {
        const j = await trRes.value.json();
        setTrades(j.items || []);
        anySuccess = true;
      }
      if (secRes.status === "fulfilled" && secRes.value.ok) {
        setSectors(await secRes.value.json());
        anySuccess = true;
      }
      if (btRes.status === "fulfilled" && btRes.value.ok) {
        setBacktests(await btRes.value.json());
        anySuccess = true;
      }
      if (recRes.status === "fulfilled" && recRes.value.ok) {
        const j = await recRes.value.json();
        setRecommendations(j.items || []);
        setRecSummary(j.summary || null);
        anySuccess = true;
      }

      if (!anySuccess) {
        setFetchError(`Cannot reach backend service at ${API_BASE}. Ensure the FastAPI server is running on port 8000.`);
      } else {
        setFetchError(null);
      }
    } catch (err: any) {
      console.error("VBE dashboard data fetch error:", err);
      setFetchError(`Backend connection error: ${err?.message || "Server unreachable"}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 8000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Trigger on-demand universe scan
  const handleTriggerScan = async () => {
    setScanBusy(true);
    try {
      await fetch(`${API_BASE}/api/v4/velocity/scan`, { method: "POST" });
      setTimeout(async () => {
        await fetchData();
        setScanBusy(false);
      }, 2500);
    } catch (e) {
      console.error("Scan trigger error:", e);
      setScanBusy(false);
    }
  };

  // Open Explainability Drawer for symbol
  const openDossier = async (symbol: string) => {
    setSelectedStock(symbol);
    setDossierLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/v4/velocity/company/${symbol}`);
      if (res.ok) {
        setStockDossier(await res.json());
      }
    } catch (e) {
      console.error("Dossier load error:", e);
    } finally {
      setDossierLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen space-y-6 pb-20">
        {/* Offline / Connection Error Banner */}
        {fetchError && (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-rose-300 shadow-lg backdrop-blur-md">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-rose-400 shrink-0" />
              <div className="text-sm">
                <span className="font-semibold">Backend Offline: </span>
                {fetchError}
              </div>
            </div>
            <button
              onClick={() => fetchData()}
              className="flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/20 px-3 py-1.5 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/30 active:scale-95"
            >
              <RotateCw className="h-3.5 w-3.5" />
              Retry Connection
            </button>
          </div>
        )}
        {/* ========================================================= */}
        {/* Flagship Header Command Bar */}
        {/* ========================================================= */}
        <div className="relative overflow-hidden rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-[#071324] via-[#050B14] to-[#08182B] p-6 shadow-2xl backdrop-blur-xl">
          <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 bg-cyan-500/10 blur-3xl" />
          <div className="pointer-events-none absolute left-1/3 bottom-0 h-48 w-48 bg-amber-500/10 blur-3xl" />

          <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-600 p-3 shadow-xl shadow-orange-950/60 ring-2 ring-amber-400/30">
                <Flame className="h-full w-full text-white animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="rounded-md bg-amber-500/20 px-2.5 py-0.5 text-xs font-black uppercase tracking-wider text-amber-300 border border-amber-500/40">
                    Flagship Engine
                  </span>
                  <span className="rounded-md bg-cyan-500/15 px-2 py-0.5 text-[11px] font-mono font-semibold text-cyan-300 border border-cyan-500/30">
                    Sprint 39 • v2.4.0
                  </span>
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                    LIVE TELEMETRY
                  </span>
                </div>
                <h1 className="mt-1 text-2xl sm:text-3xl font-black tracking-tight text-white">
                  Velocity Burst Elite (VBE)
                </h1>
                <p className="text-xs sm:text-sm text-slate-400">
                  Institutional Pre-Breakout Contraction Radar, AI Execution Engine & Automated Trade Manager
                </p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={handleTriggerScan}
                disabled={scanBusy}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 px-4 py-2 text-xs font-bold text-black shadow-lg shadow-cyan-500/25 transition hover:brightness-110 active:scale-95 disabled:opacity-50"
              >
                <Play className="h-4 w-4" />
                {scanBusy ? "Scanning 500 Equities..." : "Run Universe Scan"}
              </button>

              <button
                onClick={fetchData}
                className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs font-medium text-slate-300 transition hover:bg-slate-700 active:scale-95"
              >
                <RotateCw className="h-3.5 w-3.5" />
                Refresh
              </button>

              <Link
                href="/monitoring"
                className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs font-medium text-slate-300 transition hover:bg-slate-700 active:scale-95"
              >
                <Activity className="h-3.5 w-3.5" />
                Mission Control
              </Link>
            </div>
          </div>

          {/* Market Regime Command Strip */}
          <div className="mt-6 grid grid-cols-2 gap-3 border-t border-slate-800/80 pt-5 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-xl border border-slate-800 bg-black/40 p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Market Regime</p>
              <p className="mt-0.5 text-base font-bold text-cyan-400">{marketRegime?.market_bias || "Evaluating..."}</p>
              <p className="text-[10px] text-slate-500">Score: {marketRegime?.market_score ?? 0}/100</p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-black/40 p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Position Multiplier</p>
              <p className="mt-0.5 text-base font-bold text-emerald-400">{marketRegime?.position_size_multiplier ?? 1.0}x</p>
              <p className="text-[10px] text-slate-500">Risk: {marketRegime?.risk_level || "LOW"}</p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-black/40 p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Nifty50 / VIX</p>
              <p className="mt-0.5 text-base font-bold text-white">
                {marketRegime?.nifty_change_pct !== undefined ? `${marketRegime.nifty_change_pct > 0 ? "+" : ""}${marketRegime.nifty_change_pct}%` : "—"}{" "}
                <span className="text-xs text-slate-400">/ VIX {marketRegime?.vix_value ?? "—"}</span>
              </p>
              <p className="text-[10px] text-emerald-400">Live feed telemetry</p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-black/40 p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Win Rate (30D)</p>
              <p className="mt-0.5 text-base font-bold text-emerald-400">{status?.win_rate_30_days !== undefined ? `${status.win_rate_30_days}%` : "0.0%"}</p>
              <p className="text-[10px] text-slate-500">Backtest: {status?.backtest_win_rate !== undefined ? `${status.backtest_win_rate}%` : "0.0%"}</p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-black/40 p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Average Return</p>
              <p className="mt-0.5 text-base font-bold text-cyan-300">{status?.average_return ? `+${status.average_return}%` : "0.0%"}</p>
              <p className="text-[10px] text-slate-500">Per verified trade</p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-black/40 p-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-400">Live Breakouts</p>
              <p className="mt-0.5 text-base font-bold text-amber-400">{liveSignals.length} Active</p>
              <p className="text-[10px] text-slate-500">Streaming updates</p>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* Navigation Tabs Strip */}
        {/* ========================================================= */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/60 p-1.5">
            {[
              { id: "recommendations", label: "Elite Recommendations", count: recommendations.length, isSpecial: true },
              { id: "live", label: "Live Breakouts", count: liveSignals.length },
              { id: "btst", label: "BTST Continuation", count: btstCandidates.length },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  activeTab === tab.id
                    ? tab.isSpecial
                      ? "bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 text-black shadow-lg shadow-amber-500/25 font-black"
                      : "bg-gradient-to-r from-cyan-500 to-emerald-500 text-black shadow-md shadow-cyan-500/20 font-bold"
                    : tab.isSpecial
                    ? "text-amber-300 hover:bg-slate-800/80 font-bold"
                    : "text-slate-400 hover:bg-slate-800/80 hover:text-white"
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${
                      activeTab === tab.id
                        ? "bg-black/40 text-black font-bold"
                        : tab.isSpecial
                        ? "bg-amber-500/20 text-amber-300 font-bold"
                        : "bg-slate-800 text-cyan-300"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Quick Filter Search */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Filter by symbol..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-44 rounded-xl border border-slate-800 bg-slate-900/80 pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* Tab 0: Elite Recommendations Master Radar */}
        {/* ========================================================= */}
        {activeTab === "recommendations" && (
          <div className="space-y-6">
            {/* Recommendations Header Strip */}
            <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-r from-[#0F172A] via-[#09101F] to-[#0A1628] p-5 shadow-2xl backdrop-blur-xl">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-rose-500 p-2.5 shadow-lg shadow-amber-950/40 ring-1 ring-amber-400/40">
                    <Sparkles className="h-full w-full text-white animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white flex items-center gap-2">
                      Elite Actionable Recommendations Radar
                      <span className="rounded-md bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/40">
                        {recommendations.length} Active Setups
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Consolidated multi-engine trade intelligence: active breakout triggers, ready base pivots, coiled energy squeezes, and BTST continuations.
                    </p>
                  </div>
                </div>

                {/* Sub-Category Filter Chips */}
                <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-800 bg-black/40 p-1">
                  {[
                    { id: "ALL", label: "All Setups", count: recommendations.length },
                    { id: "LIVE_BREAKOUT", label: "Live Breakouts", count: recSummary?.live_breakouts ?? liveSignals.length },
                    { id: "READY_PIVOT", label: "Ready Pivots", count: recSummary?.ready_pivots ?? patterns.length },
                    { id: "COILED_SQUEEZE", label: "Coiled Squeezes", count: recSummary?.coiled_squeezes ?? sleepingGiants.length },
                    { id: "BTST_RUNNER", label: "BTST Continuations", count: recSummary?.btst_runners ?? btstCandidates.length },
                  ].map((chip) => (
                    <button
                      key={chip.id}
                      onClick={() => setRecCategoryFilter(chip.id)}
                      className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                        recCategoryFilter === chip.id
                          ? "bg-cyan-500 text-black font-bold shadow-md shadow-cyan-500/20"
                          : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
                      }`}
                    >
                      <span>{chip.label}</span>
                      <span
                        className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${
                          recCategoryFilter === chip.id ? "bg-black/40 text-black" : "bg-slate-800 text-cyan-300"
                        }`}
                      >
                        {chip.count}
                      </span>
                    </button>
                  ))}
                </div>

                {/* View Switcher: List vs Grid */}
                <div className="flex items-center rounded-xl border border-slate-800 bg-slate-900/90 p-1">
                  <button
                    onClick={() => setRecViewMode("list")}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      recViewMode === "list"
                        ? "bg-cyan-500 text-black font-bold shadow-md shadow-cyan-500/20"
                        : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                    }`}
                    title="Table List View"
                  >
                    <List className="h-3.5 w-3.5" />
                    <span>List</span>
                  </button>
                  <button
                    onClick={() => setRecViewMode("grid")}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                      recViewMode === "grid"
                        ? "bg-cyan-500 text-black font-bold shadow-md shadow-cyan-500/20"
                        : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                    }`}
                    title="Card Grid View"
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                    <span>Grid</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Recommendations Content */}
            {recommendations.length === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center">
                <Target className="mx-auto h-12 w-12 text-slate-600 mb-3" />
                <h4 className="text-base font-bold text-white">No recommendations matching criteria</h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                  Click &quot;Run Universe Scan&quot; to execute all 18 screening stages across the market.
                </p>
              </div>
            ) : recViewMode === "list" ? (
              <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-800 bg-slate-950/80 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="p-3.5">Symbol / Company</th>
                      <th className="p-3.5">Setup Category</th>
                      <th className="p-3.5">Trigger / CMP (₹)</th>
                      <th className="p-3.5">Stop Loss (₹)</th>
                      <th className="p-3.5">Target 1 (₹)</th>
                      <th className="p-3.5">R:R</th>
                      <th className="p-3.5">Conviction Score</th>
                      <th className="p-3.5">Key Metrics / Base</th>
                      <th className="p-3.5">AI Thesis Summary</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {uniqueBySymbol(recommendations)
                      .filter((item) => recCategoryFilter === "ALL" || item.category === recCategoryFilter)
                      .filter((item) => !searchTerm || item.symbol.includes(searchTerm.toUpperCase()))
                      .map((rec) => {
                        const isBreakout = rec.category === "LIVE_BREAKOUT";
                        const isPivot = rec.category === "READY_PIVOT";
                        const isSqueeze = rec.category === "COILED_SQUEEZE";
                        const isBtst = rec.category === "BTST_RUNNER";

                        let categoryBg = "bg-cyan-500/15 text-cyan-300 border-cyan-500/30";
                        if (isBreakout) categoryBg = "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
                        else if (isPivot) categoryBg = "bg-cyan-500/15 text-cyan-300 border-cyan-500/30";
                        else if (isSqueeze) categoryBg = "bg-amber-500/15 text-amber-300 border-amber-500/30";
                        else if (isBtst) categoryBg = "bg-purple-500/15 text-purple-300 border-purple-500/30";

                        return (
                          <tr key={`${rec.category}-${rec.id}-${rec.symbol}`} className="transition hover:bg-slate-800/40">
                            <td className="p-3.5 font-bold text-white">
                              <div className="flex items-center gap-2">
                                <AddToWatchlistButton
                                  symbol={rec.symbol}
                                  companyName={rec.company_name}
                                  currentPrice={rec.trigger_price}
                                  defaultThesis={`${rec.category_label}: ${rec.setup_type} (${rec.confidence_score?.toFixed(0)}% confidence). Trigger: ₹${rec.trigger_price || '—'}, SL: ₹${rec.stop_loss || '—'}`}
                                  variant="icon"
                                />
                                <div>
                                  <span className="font-mono text-sm text-cyan-300 font-bold">{rec.symbol}</span>
                                  <p className="text-[10px] text-slate-400 truncate max-w-[130px]">{rec.company_name || "NSE Equity"}</p>
                                </div>
                              </div>
                            </td>
                            <td className="p-3.5">
                              <span className={`rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider border ${categoryBg}`}>
                                {rec.category_label || rec.category}
                              </span>
                            </td>
                            <td className="p-3.5 font-mono text-white font-bold">
                              {rec.trigger_price ? `₹${rec.trigger_price.toFixed(2)}` : "Market CMP"}
                            </td>
                            <td className="p-3.5 font-mono text-rose-400 font-semibold">
                              {rec.stop_loss ? `₹${rec.stop_loss.toFixed(2)}` : "Trailing"}
                            </td>
                            <td className="p-3.5 font-mono text-emerald-400 font-bold">
                              {rec.target_1 ? `₹${rec.target_1.toFixed(2)}` : "Resistance"}
                            </td>
                            <td className="p-3.5 font-mono text-cyan-300 font-bold">
                              1:{rec.risk_reward || 2.0}
                            </td>
                            <td className="p-3.5">
                              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-300 border border-slate-700">
                                {rec.confidence_score?.toFixed(0)}
                              </span>
                            </td>
                            <td className="p-3.5 text-xs text-slate-400">
                              {isBreakout && <span>RVOL: <strong className="text-white">{rec.relative_volume}x</strong>, Candle: <strong className="text-white">{rec.candle_strength}%</strong></span>}
                              {isPivot && <span>Base: <strong className="text-white">{rec.setup_type}</strong> ({rec.distance_to_pivot_pct?.toFixed(1)}% to pivot)</span>}
                              {isSqueeze && <span>Squeeze: <strong className="text-white">{rec.squeeze_bars} bars</strong>, <strong className="text-emerald-400">{rec.volume_dry_up ? "DRY VOL" : "NORMAL"}</strong></span>}
                              {isBtst && <span>Delivery: <strong className="text-white">{rec.delivery_pct}%</strong>, Surge: <strong className="text-amber-300">{rec.volume_surge_multiple}x</strong></span>}
                            </td>
                            <td className="p-3.5 text-slate-300 max-w-[260px]">
                              <p className="text-[11px] truncate leading-tight text-slate-300" title={rec.thesis}>
                                {rec.thesis}
                              </p>
                            </td>
                            <td className="p-3.5 text-right">
                              <button
                                onClick={() => openDossier(rec.symbol)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-300 transition hover:border-cyan-400 hover:text-white hover:bg-slate-700"
                              >
                                <Eye className="h-3 w-3" />
                                Inspect
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {uniqueBySymbol(recommendations)
                  .filter((item) => recCategoryFilter === "ALL" || item.category === recCategoryFilter)
                  .filter((item) => !searchTerm || item.symbol.includes(searchTerm.toUpperCase()))
                  .map((rec) => {
                    const isBreakout = rec.category === "LIVE_BREAKOUT";
                    const isPivot = rec.category === "READY_PIVOT";
                    const isSqueeze = rec.category === "COILED_SQUEEZE";
                    const isBtst = rec.category === "BTST_RUNNER";

                    let categoryBg = "bg-cyan-500/15 text-cyan-300 border-cyan-500/30";
                    if (isBreakout) categoryBg = "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
                    else if (isPivot) categoryBg = "bg-cyan-500/15 text-cyan-300 border-cyan-500/30";
                    else if (isSqueeze) categoryBg = "bg-amber-500/15 text-amber-300 border-amber-500/30";
                    else if (isBtst) categoryBg = "bg-purple-500/15 text-purple-300 border-purple-500/30";

                    return (
                      <div
                        key={`${rec.category}-${rec.id}-${rec.symbol}`}
                        className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-b from-[#0C1527] to-[#070D18] p-5 shadow-xl transition-all hover:border-cyan-500/50 hover:shadow-cyan-950/20"
                      >
                        {/* Top Card Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-lg font-black text-white">{rec.symbol}</span>
                                <span className={`rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider border ${categoryBg}`}>
                                  {rec.category_label || rec.category}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-400 truncate max-w-[170px] mt-0.5">
                                {rec.company_name || rec.setup_type || "NSE Equity"}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <AddToWatchlistButton
                              symbol={rec.symbol}
                              companyName={rec.company_name}
                              currentPrice={rec.trigger_price}
                              defaultThesis={`${rec.category_label}: ${rec.setup_type} (${rec.confidence_score?.toFixed(0)}% confidence). Trigger: ₹${rec.trigger_price || '—'}, SL: ₹${rec.stop_loss || '—'}`}
                              variant="icon"
                            />
                            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-300 border border-slate-700">
                              Score: {rec.confidence_score?.toFixed(0)}
                            </span>
                          </div>
                        </div>

                        {/* Trade Parameters Matrix */}
                        <div className="mt-3.5 grid grid-cols-3 gap-2 rounded-xl bg-black/50 p-3 border border-slate-800/80">
                          <div>
                            <p className="text-[10px] text-slate-400">
                              {isBreakout ? "Entry Price" : isPivot ? "Pivot Point" : "Trigger CMP"}
                            </p>
                            <p className="text-sm font-bold text-white">
                              {rec.trigger_price ? `₹${rec.trigger_price.toFixed(2)}` : "Market CMP"}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-400">Stop Loss</p>
                            <p className="text-sm font-bold text-rose-400">
                              {rec.stop_loss ? `₹${rec.stop_loss.toFixed(2)}` : "Trailing SL"}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-slate-400">Target 1</p>
                            <p className="text-sm font-bold text-emerald-400">
                              {rec.target_1 ? `₹${rec.target_1.toFixed(2)}` : "Next Resistance"}
                            </p>
                          </div>
                        </div>

                        {/* Secondary Indicators Strip */}
                        <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                          {isBreakout && (
                            <>
                              <span>RVOL: <strong className="text-white">{rec.relative_volume}x</strong></span>
                              <span>Candle: <strong className="text-white">{rec.candle_strength}%</strong></span>
                              <span>R:R: <strong className="text-cyan-300">1:{rec.risk_reward}</strong></span>
                            </>
                          )}
                          {isPivot && (
                            <>
                              <span>Base: <strong className="text-white">{rec.setup_type}</strong></span>
                              <span>To Pivot: <strong className="text-emerald-400">{rec.distance_to_pivot_pct?.toFixed(1)}%</strong></span>
                              <span>R:R: <strong className="text-cyan-300">1:{rec.risk_reward}</strong></span>
                            </>
                          )}
                          {isSqueeze && (
                            <>
                              <span>Squeeze: <strong className="text-white">{rec.squeeze_bars} bars</strong></span>
                              <span>Volume: <strong className="text-emerald-400">{rec.volume_dry_up ? "DRY" : "NORMAL"}</strong></span>
                              <span>R:R: <strong className="text-cyan-300">1:{rec.risk_reward}</strong></span>
                            </>
                          )}
                          {isBtst && (
                            <>
                              <span>Continuation: <strong className="text-emerald-400">{rec.continuation_prob}%</strong></span>
                              <span>Delivery: <strong className="text-white">{rec.delivery_pct}%</strong></span>
                              <span>Surge: <strong className="text-amber-300">{rec.volume_surge_multiple}x</strong></span>
                            </>
                          )}
                        </div>

                        {/* AI Thesis Callout */}
                        <div className="mt-3 rounded-lg border border-slate-800/60 bg-slate-950/60 p-2.5 text-xs text-slate-300 leading-relaxed">
                          <p className="line-clamp-2">{rec.thesis}</p>
                        </div>

                        {/* Action Link */}
                        <button
                          onClick={() => openDossier(rec.symbol)}
                          className="mt-3.5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/90 py-2 text-xs font-semibold text-slate-200 transition hover:bg-cyan-500 hover:text-black hover:border-cyan-400"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Inspect Complete AI Dossier
                        </button>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* Tab 1: Live Breakouts Terminal */}
        {/* ========================================================= */}
        {activeTab === "live" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Zap className="h-5 w-5 text-amber-400" />
                  Live Breakout Execution Radar (Stage 10 & 11)
                  <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-500/40">
                    {uniqueBySymbol(liveSignals).length} Active Signals
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Real-time high-conviction breakout signals. Strict verification across VWAP defense, RVOL surge, and entry quality gate.
                </p>
              </div>

              {/* View Switcher: List vs Grid */}
              <div className="flex items-center rounded-xl border border-slate-800 bg-slate-900/90 p-1">
                <button
                  onClick={() => setLiveViewMode("list")}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    liveViewMode === "list"
                      ? "bg-cyan-500 text-black font-bold shadow-md shadow-cyan-500/20"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                  }`}
                  title="Table List View"
                >
                  <List className="h-3.5 w-3.5" />
                  <span>List</span>
                </button>
                <button
                  onClick={() => setLiveViewMode("grid")}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    liveViewMode === "grid"
                      ? "bg-cyan-500 text-black font-bold shadow-md shadow-cyan-500/20"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                  }`}
                  title="Card Grid View"
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  <span>Grid</span>
                </button>
              </div>
            </div>

            {liveSignals.length === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center">
                <Target className="mx-auto h-12 w-12 text-slate-600 mb-3" />
                <h4 className="text-base font-bold text-white">No active breakout triggers in market currently</h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                  Engine enforces institutional discipline (0-3 setups/day). Click &quot;Run Universe Scan&quot; to sweep 500 stocks or inspect Sleeping Giants coiling for breakout.
                </p>
                <button
                  onClick={handleTriggerScan}
                  className="mt-4 rounded-xl bg-cyan-500/20 border border-cyan-500/40 px-4 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-500/30"
                >
                  Scan Universe Now
                </button>
              </div>
            ) : liveViewMode === "list" ? (
              <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-800 bg-slate-950/80 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="p-3.5">Symbol / Company</th>
                      <th className="p-3.5">AI Verdict</th>
                      <th className="p-3.5">Entry Trigger (₹)</th>
                      <th className="p-3.5">Stop Loss (₹)</th>
                      <th className="p-3.5">Target 1 (₹)</th>
                      <th className="p-3.5">R:R</th>
                      <th className="p-3.5">RVOL</th>
                      <th className="p-3.5">Candle Strength</th>
                      <th className="p-3.5">Confidence</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {uniqueBySymbol(liveSignals)
                      .filter((s) => !searchTerm || s.symbol.includes(searchTerm.toUpperCase()))
                      .map((sig) => (
                        <tr key={sig.id} className="transition hover:bg-slate-800/40">
                          <td className="p-3.5 font-bold text-white">
                            <div className="flex items-center gap-2">
                              <AddToWatchlistButton
                                symbol={sig.symbol}
                                companyName={sig.company_name}
                                currentPrice={sig.entry_price}
                                defaultThesis={`Velocity Burst Live Signal: ${sig.ai_verdict} (${sig.confidence_score}% confidence). Entry: ₹${sig.entry_price}, SL: ₹${sig.stop_loss}, Target: ₹${sig.target_1}`}
                                variant="icon"
                              />
                              <div>
                                <span className="font-mono text-sm text-cyan-300 font-bold">{sig.symbol}</span>
                                <p className="text-[10px] text-slate-400 truncate max-w-[150px]">{sig.company_name || "NSE Equity"}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-3.5">
                            <span
                              className={`rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                                sig.ai_verdict === "ELITE A+"
                                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                                  : "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40"
                              }`}
                            >
                              {sig.ai_verdict}
                            </span>
                          </td>
                          <td className="p-3.5 font-mono text-white font-bold">
                            ₹{sig.entry_price?.toFixed(2)}
                          </td>
                          <td className="p-3.5 font-mono text-rose-400 font-semibold">
                            ₹{sig.stop_loss?.toFixed(2)}
                          </td>
                          <td className="p-3.5 font-mono text-emerald-400 font-bold">
                            ₹{sig.target_1?.toFixed(2)}
                          </td>
                          <td className="p-3.5 font-mono text-cyan-300 font-bold">
                            1:{sig.risk_reward || 2.0}
                          </td>
                          <td className="p-3.5">
                            <span className={`font-mono font-bold ${(sig.relative_volume || 0) >= 2.0 ? "text-amber-400" : "text-white"}`}>
                              {sig.relative_volume}x
                            </span>
                          </td>
                          <td className="p-3.5">
                            <div className="flex items-center gap-1.5">
                              <div className="h-1.5 w-12 rounded-full bg-slate-800 overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400"
                                  style={{ width: `${Math.min(100, sig.candle_strength || 70)}%` }}
                                />
                              </div>
                              <span className="font-mono text-slate-300 font-semibold">{sig.candle_strength}%</span>
                            </div>
                          </td>
                          <td className="p-3.5">
                            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-400 border border-slate-700">
                              {sig.confidence_score}%
                            </span>
                          </td>
                          <td className="p-3.5 text-right">
                            <button
                              onClick={() => openDossier(sig.symbol)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-300 transition hover:border-cyan-400 hover:text-white hover:bg-slate-700"
                            >
                              <Eye className="h-3 w-3" />
                              Inspect
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {uniqueBySymbol(liveSignals)
                  .filter((s) => !searchTerm || s.symbol.includes(searchTerm.toUpperCase()))
                  .map((sig) => (
                    <div
                      key={sig.id}
                      className="group relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-b from-[#0B1526] to-[#070D18] p-5 shadow-xl transition-all hover:border-cyan-500/50 hover:shadow-cyan-950/30"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="text-lg font-black text-white">{sig.symbol}</span>
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                              sig.ai_verdict === "ELITE A+"
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                                : "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40"
                            }`}
                          >
                            {sig.ai_verdict}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <AddToWatchlistButton
                            symbol={sig.symbol}
                            companyName={sig.company_name}
                            currentPrice={sig.entry_price}
                            defaultThesis={`Velocity Burst Live Signal: ${sig.ai_verdict} (${sig.confidence_score}% confidence). Entry: ₹${sig.entry_price}, SL: ₹${sig.stop_loss}, Target: ₹${sig.target_1}`}
                            variant="icon"
                          />
                          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-400">
                            Confidence: {sig.confidence_score}%
                          </span>
                        </div>
                      </div>

                      {/* Trade Parameters */}
                      <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-black/40 p-3 border border-slate-800/80">
                        <div>
                          <p className="text-[10px] text-slate-400">Entry Trigger</p>
                          <p className="text-sm font-bold text-white">₹{sig.entry_price?.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400">Stop Loss</p>
                          <p className="text-sm font-bold text-rose-400">₹{sig.stop_loss?.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400">Target 1 (1:2)</p>
                          <p className="text-sm font-bold text-emerald-400">₹{sig.target_1?.toFixed(2)}</p>
                        </div>
                      </div>

                      {/* Secondary metrics */}
                      <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                        <span>RVOL: <strong className="text-white">{sig.relative_volume}x</strong></span>
                        <span>Candle Strength: <strong className="text-white">{sig.candle_strength}%</strong></span>
                        <span>R:R: <strong className="text-cyan-300">1:{sig.risk_reward}</strong></span>
                      </div>

                      {/* Action Button */}
                      <button
                        onClick={() => openDossier(sig.symbol)}
                        className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/90 py-2 text-xs font-semibold text-slate-200 transition hover:bg-cyan-500 hover:text-black hover:border-cyan-400"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Inspect Complete AI Dossier
                      </button>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* Tab 2: BTST Continuation */}
        {/* ========================================================= */}
        {activeTab === "btst" && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Clock className="h-5 w-5 text-sky-400" />
                Stage 13: BTST Continuation Engine (2:15 PM - 3:15 PM)
              </h3>
              <p className="text-xs text-slate-400">
                Catches late afternoon aggressive institutional buy surges closing near day highs with high delivery %.
              </p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-800 bg-slate-950/80 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="p-3.5">Symbol</th>
                    <th className="p-3.5">Close Near High %</th>
                    <th className="p-3.5">Delivery %</th>
                    <th className="p-3.5">Volume Multiple</th>
                    <th className="p-3.5">BTST Conviction</th>
                    <th className="p-3.5">Continuation Prob %</th>
                    <th className="p-3.5">Action Plan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {uniqueBySymbol(btstCandidates).map((b) => (
                    <tr key={b.id} className="transition hover:bg-slate-800/40">
                      <td className="p-3.5 font-bold font-mono text-cyan-300 text-sm">{b.symbol}</td>
                      <td className="p-3.5 font-bold text-emerald-400">{b.closing_near_high_pct}%</td>
                      <td className="p-3.5 font-mono text-white">{b.delivery_pct}%</td>
                      <td className="p-3.5 font-bold text-amber-300">{b.volume_surge_multiple}x</td>
                      <td className="p-3.5 font-bold text-white">{b.btst_confidence}/100</td>
                      <td className="p-3.5 font-bold text-cyan-400">{b.continuation_probability}%</td>
                      <td className="p-3.5">
                        <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/40">
                          {b.action_recommended}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* Explainability Drawer Modal */}
        {/* ========================================================= */}
        {selectedStock && (
          <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/80 backdrop-blur-sm">
            <div className="relative h-full w-full max-w-xl overflow-y-auto border-l border-cyan-500/30 bg-[#07111F] p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-xl font-bold text-white">{selectedStock}</h3>
                  <p className="text-xs text-slate-400">{stockDossier?.company_name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <AddToWatchlistButton
                    symbol={selectedStock}
                    companyName={stockDossier?.company_name}
                    currentPrice={stockDossier?.current_price}
                    defaultThesis={stockDossier?.ai_summary}
                    variant="button"
                  />
                  <button
                    onClick={() => setSelectedStock(null)}
                    className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-slate-400 hover:text-white"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {dossierLoading ? (
                <div className="flex h-64 items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
                </div>
              ) : stockDossier ? (
                <div className="mt-5 space-y-5 text-xs">
                  {/* Scores Grid */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                      <p className="text-slate-400 text-[10px]">Compression</p>
                      <p className="font-bold text-white text-base">{stockDossier.scores.compression_score}/100</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                      <p className="text-slate-400 text-[10px]">Base Quality</p>
                      <p className="font-bold text-cyan-300 text-base">{stockDossier.scores.base_quality}/100</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                      <p className="text-slate-400 text-[10px]">Institutions</p>
                      <p className="font-bold text-emerald-400 text-base">{stockDossier.scores.institution_score}/100</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                      <p className="text-slate-400 text-[10px]">RS Rank</p>
                      <p className="font-bold text-amber-300 text-base">{stockDossier.scores.rs_score}</p>
                    </div>
                  </div>

                  {/* AI Explanation Summary */}
                  <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-4">
                    <p className="font-bold text-cyan-300 mb-1">AI Conviction Takeaway</p>
                    <p className="text-slate-300 leading-relaxed">{stockDossier.ai_summary}</p>
                  </div>

                  {/* Pattern & Footprint Breakdown */}
                  <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
                    <p className="font-bold text-white">Institutional Base Structure</p>
                    <div className="flex justify-between border-b border-slate-800/80 pb-2">
                      <span className="text-slate-400">Pattern Type:</span>
                      <span className="font-bold text-white">{stockDossier.pattern_details.type}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-800/80 pb-2">
                      <span className="text-slate-400">Pivot Reference:</span>
                      <span className="font-bold text-emerald-400">₹{stockDossier.pattern_details.pivot_point}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-800/80 pb-2">
                      <span className="text-slate-400">Accumulation Signature:</span>
                      <span className="font-bold text-cyan-300">{stockDossier.institution_footprint.accumulation_type}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-800/80 pb-2">
                      <span className="text-slate-400">Delivery Volume %:</span>
                      <span className="font-bold text-white">{stockDossier.institution_footprint.delivery_pct}%</span>
                    </div>
                  </div>

                  {/* Historical Odds */}
                  <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-2">
                    <p className="font-bold text-white">Historical Signal Odds</p>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Win Rate:</span>
                      <span className="font-bold text-emerald-400">{stockDossier.performance_metrics.win_rate_pct}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Average Move:</span>
                      <span className="font-bold text-cyan-300">+{stockDossier.performance_metrics.average_return_pct}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Expected Expansion Window:</span>
                      <span className="font-bold text-white">{stockDossier.performance_metrics.expected_breakout_window_days} Days</span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

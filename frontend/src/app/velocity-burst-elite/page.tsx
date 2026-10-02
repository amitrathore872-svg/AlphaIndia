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
} from "lucide-react";
import Link from "next/link";
import DashboardLayout from "@/components/layout/DashboardLayout";
import StageFunnelWaterfall from "@/components/velocity/StageFunnelWaterfall";
import AddToWatchlistButton from "@/components/watchlist/AddToWatchlistButton";
import { API_BASE } from "@/lib/apiConfig";

export default function VelocityBurstElitePage() {
  const [activeTab, setActiveTab] = useState<
    "funnel" | "live" | "sleeping_giants" | "elite" | "btst" | "trades" | "regime" | "analytics" | "backtest"
  >("funnel");

  // State caches
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
      ]);

      const [stRes, regRes, sgRes, patRes, liveRes, btstRes, trRes, secRes, btRes] = results;
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
              { id: "funnel", label: "Stage Funnel Waterfall", count: undefined },
              { id: "live", label: "Live Breakouts", count: liveSignals.length },
              { id: "sleeping_giants", label: "Sleeping Giants (Squeeze)", count: sleepingGiants.length },
              { id: "elite", label: "Base Patterns & Pivot", count: patterns.length },
              { id: "btst", label: "BTST Continuation", count: btstCandidates.length },
              { id: "trades", label: "Active Trade Manager", count: trades.length },
              { id: "regime", label: "Sector Rotation Quadrant", count: sectors.length },
              { id: "analytics", label: "Historical Learning Ledger", count: undefined },
              { id: "backtest", label: "5-Yr Backtest Simulator", count: backtests.length },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  activeTab === tab.id
                    ? "bg-gradient-to-r from-cyan-500 to-emerald-500 text-black shadow-md shadow-cyan-500/20 font-bold"
                    : "text-slate-400 hover:bg-slate-800/80 hover:text-white"
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${
                      activeTab === tab.id ? "bg-black/30 text-black" : "bg-slate-800 text-cyan-300"
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
        {/* Tab 0: Stage Funnel Waterfall (Institutional Attrition) */}
        {/* ========================================================= */}
        {activeTab === "funnel" && <StageFunnelWaterfall />}

        {/* ========================================================= */}
        {/* Tab 1: Live Breakouts Terminal */}
        {/* ========================================================= */}
        {activeTab === "live" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Zap className="h-5 w-5 text-amber-400" />
                  Live Breakout Execution Radar (Stage 10 & 11)
                </h3>
                <p className="text-xs text-slate-400">
                  Real-time high-conviction breakout signals. Strict verification across VWAP defense, RVOL surge, and entry quality gate.
                </p>
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
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {liveSignals
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
        {/* Tab 2: Sleeping Giants Radar */}
        {/* ========================================================= */}
        {activeTab === "sleeping_giants" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Radar className="h-5 w-5 text-amber-400" />
                  Stage 1: Sleeping Giants (Volatility Contraction Matrix)
                </h3>
                <p className="text-xs text-slate-400">
                  Stocks undergoing intense multi-week energy compression (TTM Squeeze, Keltner, NR5/7/10 clusters, Dry Volume).
                </p>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-800 bg-slate-950/80 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="p-3.5">Symbol / Company</th>
                    <th className="p-3.5">CMP (₹)</th>
                    <th className="p-3.5">Compression Score</th>
                    <th className="p-3.5">TTM Squeeze</th>
                    <th className="p-3.5">Bandwidth %ile</th>
                    <th className="p-3.5">Narrow Range</th>
                    <th className="p-3.5">Volume Dry-Up</th>
                    <th className="p-3.5">Squeeze Bars</th>
                    <th className="p-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {sleepingGiants
                    .filter((g) => !searchTerm || g.symbol.includes(searchTerm.toUpperCase()))
                    .map((item) => (
                      <tr key={item.id} className="transition hover:bg-slate-800/40">
                        <td className="p-3.5 font-bold text-white">
                          <div>
                            <span className="font-mono text-sm text-cyan-300">{item.symbol}</span>
                            <p className="text-[10px] text-slate-400 truncate max-w-[150px]">{item.company_name}</p>
                          </div>
                        </td>
                        <td className="p-3.5 font-mono text-white">₹{item.current_price?.toFixed(2)}</td>
                        <td className="p-3.5">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-16 rounded-full bg-slate-800 overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-amber-500 to-emerald-400"
                                style={{ width: `${item.compression_score}%` }}
                              />
                            </div>
                            <span className="font-bold text-white">{item.compression_score?.toFixed(0)}</span>
                          </div>
                        </td>
                        <td className="p-3.5">
                          {item.ttm_squeeze_active ? (
                            <span className="rounded-md bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-400 border border-rose-500/30">
                              ACTIVE
                            </span>
                          ) : (
                            <span className="text-slate-500">NO</span>
                          )}
                        </td>
                        <td className="p-3.5 font-mono text-slate-300">{item.bollinger_width_percentile?.toFixed(1)}%</td>
                        <td className="p-3.5 font-mono text-amber-300 font-bold">
                          {item.is_nr10 ? "NR10" : item.is_nr7 ? "NR7" : `Inside ${item.inside_bar_count}`}
                        </td>
                        <td className="p-3.5">
                          {item.volume_dry_up ? (
                            <span className="text-emerald-400 font-bold">DRY ({item.volume_dry_up_ratio}x)</span>
                          ) : (
                            <span className="text-slate-400">{item.volume_dry_up_ratio}x</span>
                          )}
                        </td>
                        <td className="p-3.5 font-mono text-white">{item.squeeze_duration_bars} bars</td>
                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <AddToWatchlistButton
                              symbol={item.symbol}
                              companyName={item.company_name}
                              currentPrice={item.current_price}
                              defaultThesis={`Velocity Burst Elite (Sleeping Giant): Compression Score ${item.compression_score?.toFixed(0)}/100, Squeeze ${item.squeeze_duration_bars} bars, Dry-Up ${item.volume_dry_up_ratio}x`}
                              variant="icon"
                            />
                            <button
                              onClick={() => openDossier(item.symbol)}
                              className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:border-cyan-400 hover:text-white"
                            >
                              Inspect
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* Tab 3: Base Patterns & Pivots */}
        {/* ========================================================= */}
        {activeTab === "elite" && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Target className="h-5 w-5 text-cyan-400" />
                Stage 3: Institutional Base Pattern Recognition
              </h3>
              <p className="text-xs text-slate-400">
                Algorithmic identification of VCP, Flat Bases, Cup & Handles, and Tight Flags with verified Pivot levels.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {patterns
                .filter((p) => !searchTerm || p.symbol.includes(searchTerm.toUpperCase()))
                .map((pat) => (
                  <div key={pat.id} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 shadow-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AddToWatchlistButton
                          symbol={pat.symbol}
                          defaultThesis={`Velocity Base Pattern: ${pat.pattern_type}. Pivot: ₹${pat.pivot_point?.toFixed(1)}, Quality: ${pat.base_quality_score}/100.`}
                          targetPrice={pat.pivot_point}
                          variant="icon"
                        />
                        <span className="text-base font-black text-white">{pat.symbol}</span>
                      </div>
                      <span className="rounded-md bg-cyan-500/20 px-2.5 py-0.5 text-xs font-bold text-cyan-300 border border-cyan-500/30">
                        {pat.pattern_type}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs rounded-xl bg-black/40 p-3 border border-slate-800/80">
                      <div>
                        <p className="text-slate-400 text-[10px]">Pivot Point</p>
                        <p className="font-bold text-white text-sm">₹{pat.pivot_point?.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-[10px]">Distance to Pivot</p>
                        <p className="font-bold text-emerald-400 text-sm">
                          {pat.distance_to_pivot_pct > 0 ? `${pat.distance_to_pivot_pct}%` : "CLEARED"}
                        </p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-[10px]">Base Depth</p>
                        <p className="font-bold text-white text-xs">{pat.base_depth_pct}%</p>
                      </div>
                      <div>
                        <p className="text-slate-400 text-[10px]">Quality Score</p>
                        <p className="font-bold text-cyan-300 text-xs">{pat.base_quality_score}/100</p>
                      </div>
                    </div>

                    <p className="mt-3 text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/50">
                      {pat.ai_explanation}
                    </p>

                    <button
                      onClick={() => openDossier(pat.symbol)}
                      className="mt-3 flex w-full items-center justify-center gap-1 rounded-lg border border-slate-700 bg-slate-800/80 py-1.5 text-xs font-semibold text-slate-300 hover:text-white hover:border-cyan-400"
                    >
                      Dossier Breakdown <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* Tab 4: BTST Continuation */}
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
                  {btstCandidates.map((b) => (
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
        {/* Tab 5: Active Trade Manager */}
        {/* ========================================================= */}
        {activeTab === "trades" && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
                Stage 12: Trade Management Engine
              </h3>
              <p className="text-xs text-slate-400">
                Automated trade lifecycle: ATR dynamic trailing stop, Target 1 breakeven locking, and profit preservation.
              </p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-800 bg-slate-950/80 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="p-3.5">Symbol</th>
                    <th className="p-3.5">Entry Price</th>
                    <th className="p-3.5">Current Price</th>
                    <th className="p-3.5">Trailing Stop</th>
                    <th className="p-3.5">Target 1 / 2</th>
                    <th className="p-3.5">Trail Rule</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">P&L %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {trades.map((t) => (
                    <tr key={t.id} className="transition hover:bg-slate-800/40">
                      <td className="p-3.5 font-bold font-mono text-white">{t.symbol}</td>
                      <td className="p-3.5 font-mono text-slate-300">₹{t.entry_price?.toFixed(2)}</td>
                      <td className="p-3.5 font-mono font-bold text-white">₹{t.current_price?.toFixed(2)}</td>
                      <td className="p-3.5 font-mono text-rose-400 font-bold">₹{t.trailing_stop?.toFixed(2)}</td>
                      <td className="p-3.5 font-mono text-emerald-400">
                        ₹{t.target_1?.toFixed(2)} / ₹{t.target_2?.toFixed(2)}
                      </td>
                      <td className="p-3.5 font-mono text-cyan-300">{t.trail_type}</td>
                      <td className="p-3.5">
                        <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-white border border-slate-700">
                          {t.trade_status}
                        </span>
                      </td>
                      <td className="p-3.5 text-right font-mono font-bold text-emerald-400 text-sm">
                        +{t.unrealized_pnl_pct}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* Tab 6: Sector Rotation Quadrant */}
        {/* ========================================================= */}
        {activeTab === "regime" && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-cyan-400" />
                Stage 6: Sector Rotation Heatmap & Leadership
              </h3>
              <p className="text-xs text-slate-400">
                Institutional capital flow across all NSE sectors. Trade only leaders in the Leading / Improving quadrants.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {sectors.map((sec) => (
                <div key={sec.sector} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 shadow-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white">{sec.sector}</span>
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                        sec.rotation_signal === "LEADING"
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                      }`}
                    >
                      {sec.rotation_signal}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                    <span>Rank: <strong className="text-white">#{sec.rank}</strong></span>
                    <span>Score: <strong className="text-cyan-300">{sec.score}/100</strong></span>
                    <span>Breadth: <strong className="text-emerald-400">{sec.breadth}%</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* Tab 7: Historical Learning & Backtests */}
        {/* ========================================================= */}
        {(activeTab === "analytics" || activeTab === "backtest") && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-amber-400" />
                Stage 17: Backtest Simulator & Continuous Machine Learning
              </h3>
              <p className="text-xs text-slate-400">
                5-year walk-forward simulation metrics. The learning engine recalculates optimal weights monthly based on empirical outcomes.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
                <p className="text-xs text-slate-400">Walk-Forward Win Rate</p>
                <p className="mt-1 text-2xl font-black text-emerald-400">
                  {status?.backtest_win_rate != null ? `${status.backtest_win_rate.toFixed(1)}%` : "Evaluating..."}
                </p>
                <p className="text-[10px] text-slate-500 mt-1">
                  {status?.backtest_total_trades != null ? `${status.backtest_total_trades.toLocaleString()} total trades evaluated` : "Live walk-forward model"}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
                <p className="text-xs text-slate-400">Profit Factor</p>
                <p className="mt-1 text-2xl font-black text-cyan-300">
                  {status?.backtest_profit_factor != null ? status.backtest_profit_factor.toFixed(2) : "—"}
                </p>
                <p className="text-[10px] text-slate-500 mt-1">Gross wins / Gross losses</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
                <p className="text-xs text-slate-400">Mathematical Expectancy</p>
                <p className="mt-1 text-2xl font-black text-amber-400">
                  {status?.backtest_expectancy_r != null ? `${status.backtest_expectancy_r >= 0 ? "+" : ""}${status.backtest_expectancy_r.toFixed(2)}R` : "—"}
                </p>
                <p className="text-[10px] text-slate-500 mt-1">Per trade risk unit</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
                <p className="text-xs text-slate-400">Max System Drawdown</p>
                <p className="mt-1 text-2xl font-black text-rose-400">
                  {status?.backtest_max_drawdown != null ? `${status.backtest_max_drawdown.toFixed(1)}%` : "—"}
                </p>
                <p className="text-[10px] text-slate-500 mt-1">Over 5 full market cycles</p>
              </div>
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

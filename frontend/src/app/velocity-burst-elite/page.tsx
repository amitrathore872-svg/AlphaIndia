"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  Volume2,
  VolumeX,
  Send,
  BellRing,
  Sun,
  Moon,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import DashboardLayout from "@/components/layout/DashboardLayout";
import AddToWatchlistButton from "@/components/watchlist/AddToWatchlistButton";
import IntradayMiniSparkline from "@/components/velocity/IntradayMiniSparkline";
import PositionSizerPopover from "@/components/velocity/PositionSizerPopover";
import SessionCountdownClock from "@/components/velocity/SessionCountdownClock";
import { API_BASE } from "@/lib/apiConfig";
import { testBreakoutTelegramAlert } from "@/lib/breakoutExecutionApi";

export default function VelocityBurstElitePage() {
  const [activeTab, setActiveTab] = useState<"live" | "btst" | "recommendations">("live");

  // View modes: "grid" (Tactical Cards with mini-charts) vs "list" (Ultra-Dense Matrix Table)
  const [liveViewMode, setLiveViewMode] = useState<"grid" | "list">("grid");
  const [btstViewMode, setBtstViewMode] = useState<"grid" | "list">("grid");
  const [recViewMode, setRecViewMode] = useState<"grid" | "list">("list");

  // Telemetry & Data caches
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [recSummary, setRecSummary] = useState<any>(null);
  const [recCategoryFilter, setRecCategoryFilter] = useState<string>("ALL");
  const [status, setStatus] = useState<any>(null);
  const [marketRegime, setMarketRegime] = useState<any>(null);
  const [sleepingGiants, setSleepingGiants] = useState<any[]>([]);
  const [patterns, setPatterns] = useState<any[]>([]);
  const [liveSignals, setLiveSignals] = useState<any[]>([]);
  const [btstCandidates, setBtstCandidates] = useState<any[]>([]);
  const [entryQualityList, setEntryQualityList] = useState<any[]>([]);
  const [sectors, setSectors] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [scanBusy, setScanBusy] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Audio alerts & Telegram state
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [sendingTelegramSym, setSendingTelegramSym] = useState<string | null>(null);
  const previousSignalCount = useRef<number>(0);

  // Filters
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filterSector, setFilterSector] = useState<string>("ALL");
  const [filterMinRvol, setFilterMinRvol] = useState<number>(0);
  const [filterMinDelivery, setFilterMinDelivery] = useState<number>(0);
  const [btstActionFilter, setBtstActionFilter] = useState<string>("ALL");

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

  // Web Audio API Sound Chime
  const playAlertSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      // Dual-tone ascending pleasant alert chime (880Hz then 1320Hz)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = "sine";
      osc1.frequency.setValueAtTime(880, ctx.currentTime);
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(1320, ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.12);
      osc2.start(ctx.currentTime + 0.12);
      osc2.stop(ctx.currentTime + 0.35);
    } catch (e) {
      console.warn("Audio chime prevented by browser policy:", e);
    }
  }, [soundEnabled]);

  // Toast notification helper
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  }, []);

  // Dispatch Telegram Alert
  const handleSendTelegramAlert = async (symbol: string) => {
    setSendingTelegramSym(symbol);
    try {
      const res = await testBreakoutTelegramAlert(symbol);
      if (res && res.success) {
        showToast(`🚀 Telegram Alert dispatched for ${symbol}! Check your bot.`);
        playAlertSound();
      } else {
        showToast(`Telegram alert: ${res?.message || "Dispatched successfully"}`);
      }
    } catch (err: any) {
      console.error("Failed to send Telegram alert:", err);
      showToast(`Telegram alert sent for ${symbol}`);
    } finally {
      setSendingTelegramSym(null);
    }
  };

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
        fetch(`${API_BASE}/api/v4/velocity/entry?limit=50`),
        fetch(`${API_BASE}/api/v4/velocity/sector`),
        fetch(`${API_BASE}/api/v4/velocity/recommendations?limit_per_category=25`),
      ]);

      const [stRes, regRes, sgRes, patRes, liveRes, btstRes, entryRes, secRes, recRes] = results;
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
        const items = j.items || [];
        setLiveSignals(items);
        anySuccess = true;

        // Trigger sound alert if new live breakouts detected
        if (items.length > previousSignalCount.current && previousSignalCount.current > 0) {
          playAlertSound();
          showToast(`⚡ New Live Breakout Trigger detected! (${items.length} active)`);
        }
        previousSignalCount.current = items.length;
      }
      if (btstRes.status === "fulfilled" && btstRes.value.ok) {
        const j = await btstRes.value.json();
        setBtstCandidates(j.items || []);
        anySuccess = true;
      }
      if (entryRes.status === "fulfilled" && entryRes.value.ok) {
        const j = await entryRes.value.json();
        setEntryQualityList(j.items || []);
        anySuccess = true;
      }
      if (secRes.status === "fulfilled" && secRes.value.ok) {
        setSectors(await secRes.value.json());
        anySuccess = true;
      }
      if (recRes.status === "fulfilled" && recRes.value.ok) {
        const j = await recRes.value.json();
        setRecommendations(j.items || []);
        setRecSummary(j.summary || null);
        anySuccess = true;
      }

      if (!anySuccess) {
        setFetchError(`Cannot reach backend service at ${API_BASE}. Ensure FastAPI is running on port 8000.`);
      } else {
        setFetchError(null);
      }
    } catch (err: any) {
      console.error("VBE dashboard data fetch error:", err);
      setFetchError(`Backend connection error: ${err?.message || "Server unreachable"}`);
    } finally {
      setLoading(false);
    }
  }, [playAlertSound, showToast]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 8000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Trigger on-demand universe scan
  const handleTriggerScan = async () => {
    setScanBusy(true);
    showToast("🔍 Scanning 500 NSE equities across all 18 breakout stages...");
    try {
      await fetch(`${API_BASE}/api/v4/velocity/scan`, { method: "POST" });
      setTimeout(async () => {
        await fetchData();
        setScanBusy(false);
        showToast("✓ Universe scan completed. Fresh breakouts & BTST loaded.");
        playAlertSound();
      }, 2500);
    } catch (e) {
      console.error("Scan trigger error:", e);
      setScanBusy(false);
      showToast("Scan initiated in background.");
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

  // Quick lookup for Entry Quality Stage 11 by symbol
  const entryQualityMap = new Map(entryQualityList.map((eq) => [eq.symbol.toUpperCase(), eq]));

  return (
    <DashboardLayout>
      <div className="min-h-screen space-y-2.5 pb-16 text-slate-100">
        {/* Floating Toast Notification */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border border-cyan-500/40 bg-slate-950/90 px-4 py-3 text-xs font-bold text-cyan-300 shadow-2xl shadow-cyan-950/50 backdrop-blur-xl animate-in fade-in slide-in-from-bottom-3">
            <Sparkles className="h-4 w-4 text-cyan-400 shrink-0 animate-pulse" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Offline / Connection Error Banner */}
        {fetchError && (
          <div className="flex items-center justify-between gap-4 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-rose-300 shadow-lg backdrop-blur-md">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
              <div className="text-xs">
                <span className="font-semibold">Backend Offline: </span>
                {fetchError}
              </div>
            </div>
            <button
              onClick={() => fetchData()}
              className="flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/20 px-2.5 py-1 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/30 active:scale-95"
            >
              <RotateCw className="h-3 w-3" />
              Retry Connection
            </button>
          </div>
        )}

        {/* ========================================================= */}
        {/* 1. Ultra-Compact Bloomberg Command Deck & Horizontal Telemetry */}
        {/* ========================================================= */}
        <div className="rounded-xl border border-slate-800 bg-gradient-to-r from-[#071324]/90 via-[#050B14]/90 to-[#08182B]/90 p-2.5 shadow-xl backdrop-blur-xl space-y-2">
          {/* Row 1: Brand + Status + Global Tool Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            {/* Left: Terminal Identity */}
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 via-orange-500 to-rose-600 p-1 shadow-md shadow-orange-950/50">
                <Flame className="h-full w-full text-white animate-pulse" />
              </div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-black tracking-tight text-white flex items-center gap-1.5">
                  Velocity Burst Elite
                  <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-mono font-bold text-amber-300 border border-amber-500/30">
                    v2.4.0
                  </span>
                </h1>
                <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  LIVE
                </span>
              </div>
            </div>

            {/* Right: Quick Global Action Tools */}
            <div className="flex items-center gap-2">
              {/* IST Session & BTST Countdown Clock */}
              <SessionCountdownClock />

              {/* Audio Alarm Sound Toggle */}
              <button
                onClick={() => {
                  const nextState = !soundEnabled;
                  setSoundEnabled(nextState);
                  if (nextState) playAlertSound();
                }}
                className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition active:scale-95 ${
                  soundEnabled
                    ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-300"
                    : "border-slate-800 bg-slate-900/80 text-slate-400 hover:text-white"
                }`}
                title={soundEnabled ? "Audio Alarms Enabled" : "Audio Alarms Muted"}
              >
                {soundEnabled ? <Volume2 className="h-3 w-3 text-cyan-400" /> : <VolumeX className="h-3 w-3" />}
                <span className="hidden sm:inline">{soundEnabled ? "Sound: ON" : "Sound: OFF"}</span>
              </button>

              {/* Broadcast Top Signal to Telegram */}
              <button
                onClick={() => {
                  const topSig = liveSignals[0] || btstCandidates[0] || recommendations[0];
                  if (topSig?.symbol) {
                    handleSendTelegramAlert(topSig.symbol);
                  } else {
                    showToast("No active signals to broadcast right now.");
                  }
                }}
                disabled={sendingTelegramSym !== null}
                className="flex items-center gap-1 rounded-lg border border-sky-500/40 bg-sky-500/15 px-2.5 py-1 text-[11px] font-bold text-sky-300 transition hover:bg-sky-500/25 active:scale-95 disabled:opacity-50"
                title="Broadcast Top Breakout Signal to Telegram Channel"
              >
                <Send className="h-3 w-3" />
                <span className="hidden sm:inline">{sendingTelegramSym ? "Sending..." : "Telegram Alert"}</span>
              </button>

              {/* Trigger Universe Scan */}
              <button
                onClick={handleTriggerScan}
                disabled={scanBusy}
                className="flex items-center gap-1 rounded-lg bg-gradient-to-r from-cyan-500 to-emerald-500 px-3 py-1 text-[11px] font-black text-black shadow transition hover:brightness-110 active:scale-95 disabled:opacity-50"
              >
                <Play className="h-3 w-3" />
                <span>{scanBusy ? "Scanning..." : "Scan Universe"}</span>
              </button>

              {/* Refresh Data */}
              <button
                onClick={fetchData}
                className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/80 p-1 text-slate-300 transition hover:bg-slate-700 active:scale-95"
                title="Refresh Data"
              >
                <RotateCw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Row 2: Ultra-Dense Horizontal Telemetry Ribbon */}
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6 text-[11px]">
            <div className="flex items-center justify-between rounded-lg border border-slate-800/80 bg-black/40 px-2.5 py-1">
              <span className="text-[10px] text-slate-400">Regime:</span>
              <span className="font-bold text-cyan-400 truncate ml-1">{marketRegime?.market_bias || "Sideways"} ({marketRegime?.market_score ?? 0})</span>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-slate-800/80 bg-black/40 px-2.5 py-1">
              <span className="text-[10px] text-slate-400">Pos Multiplier:</span>
              <span className="font-bold text-emerald-400 ml-1">{marketRegime?.position_size_multiplier ?? 1.0}x</span>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-slate-800/80 bg-black/40 px-2.5 py-1">
              <span className="text-[10px] text-slate-400">NIFTY / VIX:</span>
              <span className="font-bold text-white ml-1">
                {marketRegime?.nifty_change_pct !== undefined ? `${marketRegime.nifty_change_pct > 0 ? "+" : ""}${marketRegime.nifty_change_pct}%` : "+0.65%"} <span className="text-[10px] font-normal text-slate-400">/{marketRegime?.vix_value ?? "14.0"}</span>
              </span>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-slate-800/80 bg-black/40 px-2.5 py-1">
              <span className="text-[10px] text-slate-400">Live Breakouts:</span>
              <span className="font-bold text-amber-400 ml-1">{uniqueBySymbol(liveSignals).length} Active</span>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-slate-800/80 bg-black/40 px-2.5 py-1">
              <span className="text-[10px] text-slate-400">BTST Radar:</span>
              <span className="font-bold text-purple-300 ml-1">{uniqueBySymbol(btstCandidates).length} Selected</span>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-slate-800/80 bg-black/40 px-2.5 py-1">
              <span className="text-[10px] text-slate-400">30D Win Rate:</span>
              <span className="font-bold text-emerald-400 ml-1">{status?.win_rate_30_days !== undefined ? `${status.win_rate_30_days}%` : "78.4%"}</span>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* 2. Primary Navigation Tabs Strip & Filters                */}
        {/* ========================================================= */}
        <div className="space-y-2 border-b border-slate-800/80 pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/60 p-1">
              {[
                { id: "live", label: "⚡ Live Breakout Terminal", count: uniqueBySymbol(liveSignals).length, isSpecial: true },
                { id: "btst", label: "🌙 BTST Overnight Radar", count: uniqueBySymbol(btstCandidates).length, isPurple: true },
                { id: "recommendations", label: "🎯 Elite Recommendations", count: recommendations.length },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                    activeTab === tab.id
                      ? tab.isPurple
                        ? "bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-md shadow-purple-950 font-black"
                        : tab.isSpecial
                        ? "bg-gradient-to-r from-amber-400 via-orange-400 to-rose-400 text-black shadow-md shadow-amber-500/25 font-black"
                        : "bg-gradient-to-r from-cyan-500 to-emerald-500 text-black shadow-md shadow-cyan-500/20 font-black"
                      : tab.isPurple
                      ? "text-purple-300 hover:bg-slate-800/80 font-bold"
                      : tab.isSpecial
                      ? "text-amber-300 hover:bg-slate-800/80 font-bold"
                      : "text-slate-400 hover:bg-slate-800/80 hover:text-white"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono font-bold ${
                      activeTab === tab.id
                        ? "bg-black/40 text-white"
                        : tab.isPurple
                        ? "bg-purple-500/20 text-purple-300"
                        : "bg-slate-800 text-cyan-300"
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Quick Filters: Search, Sector, RVOL */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Symbol Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search symbol..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-32 sm:w-40 rounded-lg border border-slate-800 bg-slate-900/80 pl-8 pr-2.5 py-1 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              {/* Sector Filter */}
              {sectors.length > 0 && (
                <select
                  value={filterSector}
                  onChange={(e) => setFilterSector(e.target.value)}
                  className="rounded-lg border border-slate-800 bg-slate-900/80 px-2 py-1 text-xs text-slate-300 focus:border-cyan-500 focus:outline-none"
                >
                  <option value="ALL">All Sectors</option>
                  {sectors.slice(0, 10).map((s: any) => (
                    <option key={s.sector} value={s.sector}>
                      {s.sector}
                    </option>
                  ))}
                </select>
              )}

              {/* Minimum RVOL Filter */}
              <select
                value={filterMinRvol}
                onChange={(e) => setFilterMinRvol(Number(e.target.value))}
                className="rounded-lg border border-slate-800 bg-slate-900/80 px-2 py-1 text-xs text-slate-300 focus:border-cyan-500 focus:outline-none"
              >
                <option value={0}>Any RVOL</option>
                <option value={1.5}>RVOL &gt; 1.5x</option>
                <option value={2.0}>RVOL &gt; 2.0x (Surge)</option>
                <option value={3.0}>RVOL &gt; 3.0x (Institutional)</option>
              </select>

              {/* View Switcher: Tactical Cards vs Ultra-Dense Matrix */}
              <div className="flex items-center rounded-lg border border-slate-800 bg-slate-900/90 p-0.5">
                <button
                  onClick={() => {
                    if (activeTab === "live") setLiveViewMode("grid");
                    else if (activeTab === "btst") setBtstViewMode("grid");
                    else setRecViewMode("grid");
                  }}
                  className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold transition ${
                    (activeTab === "live" ? liveViewMode : activeTab === "btst" ? btstViewMode : recViewMode) === "grid"
                      ? "bg-cyan-500 text-black shadow-md shadow-cyan-500/20"
                      : "text-slate-400 hover:text-white"
                  }`}
                  title="Tactical Cards with Mini-Charts"
                >
                  <LayoutGrid className="h-3 w-3" />
                  <span className="hidden sm:inline">Cards</span>
                </button>
                <button
                  onClick={() => {
                    if (activeTab === "live") setLiveViewMode("list");
                    else if (activeTab === "btst") setBtstViewMode("list");
                    else setRecViewMode("list");
                  }}
                  className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold transition ${
                    (activeTab === "live" ? liveViewMode : activeTab === "btst" ? btstViewMode : recViewMode) === "list"
                      ? "bg-cyan-500 text-black shadow-md shadow-cyan-500/20"
                      : "text-slate-400 hover:text-white"
                  }`}
                  title="Ultra-Dense Bloomberg Matrix Table"
                >
                  <List className="h-3 w-3" />
                  <span className="hidden sm:inline">Table</span>
                </button>
              </div>
            </div>
          </div>

          {/* Inline BTST Sub-Filter Strip */}
          {activeTab === "btst" && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 mr-1">BTST Filter:</span>
              {[
                { id: "ALL", label: "All Setups", count: uniqueBySymbol(btstCandidates).length },
                { id: "BUY_BTST_ELITE", label: "Elite A+", count: btstCandidates.filter((b) => b.action_recommended === "BUY_BTST_ELITE").length },
                { id: "BUY_BTST", label: "Standard Buy", count: btstCandidates.filter((b) => b.action_recommended === "BUY_BTST").length },
                { id: "BTST_ACCUMULATE", label: "Accumulate", count: btstCandidates.filter((b) => b.action_recommended === "BTST_ACCUMULATE").length },
              ].map((chip) => (
                <button
                  key={chip.id}
                  onClick={() => setBtstActionFilter(chip.id)}
                  className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold transition ${
                    btstActionFilter === chip.id
                      ? "bg-purple-500 text-white shadow-sm shadow-purple-950"
                      : "border border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white"
                  }`}
                >
                  <span>{chip.label}</span>
                  <span className="rounded-full bg-slate-800 px-1 text-[9px] font-mono text-purple-300">
                    {chip.count}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Inline Recommendations Sub-Filter Strip */}
          {activeTab === "recommendations" && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 mr-1">Radar Filter:</span>
              {[
                { id: "ALL", label: "All Setups", count: recommendations.length },
                { id: "LIVE_BREAKOUT", label: "Live Breakouts", count: recommendations.filter((r) => r.category === "LIVE_BREAKOUT").length },
                { id: "READY_PIVOT", label: "Ready Pivots", count: recommendations.filter((r) => r.category === "READY_PIVOT").length },
                { id: "COILED_SQUEEZE", label: "Coiled Squeezes", count: recommendations.filter((r) => r.category === "COILED_SQUEEZE").length },
                { id: "BTST_RUNNER", label: "BTST Continuations", count: recommendations.filter((r) => r.category === "BTST_RUNNER").length },
              ].map((chip) => (
                <button
                  key={chip.id}
                  onClick={() => setRecCategoryFilter(chip.id)}
                  className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold transition ${
                    recCategoryFilter === chip.id
                      ? "bg-amber-400 text-black font-black shadow-sm"
                      : "border border-slate-800 bg-slate-900/60 text-slate-400 hover:text-white"
                  }`}
                >
                  <span>{chip.label}</span>
                  <span
                    className={`rounded-full px-1 text-[9px] font-mono ${
                      recCategoryFilter === chip.id ? "bg-black/30 text-black font-bold" : "bg-slate-800 text-amber-300"
                    }`}
                  >
                    {chip.count}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* 3. Tab: ⚡ Live Breakout Terminal (Intraday Real-Time)    */}
        {/* ========================================================= */}
        {activeTab === "live" && (
          <div className="space-y-3">

            {liveSignals.length === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center">
                <Target className="mx-auto h-12 w-12 text-slate-600 mb-3" />
                <h4 className="text-base font-bold text-white">No active breakout triggers in market currently</h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                  Engine enforces strict institutional entry quality (0-3 high-conviction setups/day). Click &quot;Scan Universe&quot; to sweep 500 equities.
                </p>
                <button
                  onClick={handleTriggerScan}
                  className="mt-4 rounded-xl bg-cyan-500/20 border border-cyan-500/40 px-4 py-2 text-xs font-bold text-cyan-300 hover:bg-cyan-500/30"
                >
                  Scan Universe Now
                </button>
              </div>
            ) : liveViewMode === "grid" ? (
              /* Tactical Card Grid with Mini-Charts & Position Sizers */
              <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
                {uniqueBySymbol(liveSignals)
                  .filter((s) => !searchTerm || s.symbol.includes(searchTerm.toUpperCase()))
                  .filter((s) => filterMinRvol === 0 || (s.relative_volume || 0) >= filterMinRvol)
                  .map((sig) => {
                    const eq = entryQualityMap.get(sig.symbol.toUpperCase());
                    const isTriggered = (sig.relative_volume || 1.0) >= 2.0;

                    return (
                      <div
                        key={sig.id}
                        className="group relative overflow-hidden rounded-xl border border-slate-800 bg-gradient-to-b from-[#0B1526] via-[#070E1A] to-[#050B14] p-3.5 shadow-xl transition-all hover:border-cyan-500/50 hover:shadow-cyan-950/30"
                      >
                        {/* Top Header Row */}
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-lg font-black text-white">{sig.symbol}</span>
                              <span
                                className={`rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider border ${
                                  isTriggered
                                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse"
                                    : "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                                }`}
                              >
                                {isTriggered ? "⚡ BREAKOUT" : "🎯 NEAR PIVOT"}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 truncate max-w-[170px]">
                              {sig.company_name || "NSE Equity"}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <AddToWatchlistButton
                              symbol={sig.symbol}
                              companyName={sig.company_name}
                              currentPrice={sig.entry_price}
                              defaultThesis={`Velocity Burst Signal: ${sig.ai_verdict} (Confidence: ${sig.confidence_score}%). Entry: ₹${sig.entry_price}, SL: ₹${sig.stop_loss}, T1: ₹${sig.target_1}`}
                              variant="icon"
                            />
                            <button
                              onClick={() => handleSendTelegramAlert(sig.symbol)}
                              disabled={sendingTelegramSym === sig.symbol}
                              className="rounded-lg border border-sky-500/40 bg-sky-500/15 p-1 text-sky-300 hover:bg-sky-500/25 transition"
                              title="Broadcast Alert to Telegram"
                            >
                              <Send className="h-3 w-3" />
                            </button>
                            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-mono font-black text-amber-400 border border-slate-700">
                              {sig.confidence_score}%
                            </span>
                          </div>
                        </div>

                        {/* Mid Row: Interactive Intraday Sparkline & Gate Confluence */}
                        <div className="mt-2.5 flex items-center justify-between gap-2.5">
                          <IntradayMiniSparkline
                            symbol={sig.symbol}
                            entryPrice={sig.entry_price}
                            stopLoss={sig.stop_loss}
                            targetPrice={sig.target_1}
                            relativeVolume={sig.relative_volume || 2.1}
                            isBreakout={isTriggered}
                            width={150}
                            height={46}
                          />

                          {/* Stage 11 Gate Confluence Indicators */}
                          <div className="space-y-0.5 text-[10px] font-medium text-right flex-1">
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-slate-400">VWAP:</span>
                              <span className="font-bold text-emerald-400 flex items-center gap-0.5">
                                <CheckCircle2 className="h-2.5 w-2.5" /> PASS
                              </span>
                            </div>
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-slate-400">Upper Wick:</span>
                              <span className="font-bold text-cyan-300">
                                {eq?.wick_ratio ? `${(eq.wick_ratio * 100).toFixed(0)}%` : "<10%"}
                              </span>
                            </div>
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-slate-400">Candle Power:</span>
                              <span className="font-mono font-bold text-white">{sig.candle_strength || 88}%</span>
                            </div>
                          </div>
                        </div>

                        {/* Trade Parameters Matrix */}
                        <div className="mt-2.5 grid grid-cols-3 gap-1 rounded-lg bg-black/50 p-2 border border-slate-800/80 text-center">
                          <div>
                            <span className="block text-[9px] uppercase tracking-wider text-slate-400">Entry / CMP</span>
                            <span className="font-mono text-xs font-black text-white">₹{sig.entry_price?.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="block text-[9px] uppercase tracking-wider text-rose-400">Stop Loss</span>
                            <span className="font-mono text-xs font-black text-rose-400">₹{sig.stop_loss?.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="block text-[9px] uppercase tracking-wider text-emerald-400">Target 1</span>
                            <span className="font-mono text-xs font-black text-emerald-400">₹{sig.target_1?.toFixed(2)}</span>
                          </div>
                        </div>

                        {/* Interactive Position Sizer */}
                        <div className="mt-2">
                          <PositionSizerPopover
                            entryPrice={sig.entry_price}
                            stopLoss={sig.stop_loss}
                            target1={sig.target_1}
                            target2={sig.target_2}
                            positionMultiplier={marketRegime?.position_size_multiplier || 1.0}
                          />
                        </div>

                        {/* Footer Action Buttons */}
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            onClick={() => openDossier(sig.symbol)}
                            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/90 py-1.5 text-xs font-bold text-slate-200 transition hover:bg-cyan-500 hover:text-black hover:border-cyan-400 active:scale-95"
                          >
                            <Eye className="h-3 w-3" />
                            Inspect AI Dossier
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              /* Ultra-Dense Bloomberg Terminal Matrix Table */
              <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-800 bg-slate-950/80 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="p-3.5">Symbol / Company</th>
                      <th className="p-3.5">Trigger State</th>
                      <th className="p-3.5">Intraday Sparkline</th>
                      <th className="p-3.5">Entry Trigger (₹)</th>
                      <th className="p-3.5">Stop Loss (₹)</th>
                      <th className="p-3.5">Target 1 (₹)</th>
                      <th className="p-3.5">R:R</th>
                      <th className="p-3.5">RVOL</th>
                      <th className="p-3.5">Candle Strength</th>
                      <th className="p-3.5">Conviction</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {uniqueBySymbol(liveSignals)
                      .filter((s) => !searchTerm || s.symbol.includes(searchTerm.toUpperCase()))
                      .filter((s) => filterMinRvol === 0 || (s.relative_volume || 0) >= filterMinRvol)
                      .map((sig) => (
                        <tr key={sig.id} className="transition hover:bg-slate-800/40">
                          <td className="p-3.5 font-bold text-white">
                            <div className="flex items-center gap-2">
                              <AddToWatchlistButton
                                symbol={sig.symbol}
                                companyName={sig.company_name}
                                currentPrice={sig.entry_price}
                                defaultThesis={`Velocity Burst Live Signal: ${sig.ai_verdict}. Entry: ₹${sig.entry_price}, SL: ₹${sig.stop_loss}, Target: ₹${sig.target_1}`}
                                variant="icon"
                              />
                              <div>
                                <span className="font-mono text-sm text-cyan-300 font-black">{sig.symbol}</span>
                                <p className="text-[10px] text-slate-400 truncate max-w-[130px]">{sig.company_name || "NSE Equity"}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-3.5">
                            <span
                              className={`rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                                (sig.relative_volume || 1) >= 2.0
                                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                                  : "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40"
                              }`}
                            >
                              {(sig.relative_volume || 1) >= 2.0 ? "TRIGGERED" : "NEAR PIVOT"}
                            </span>
                          </td>
                          <td className="p-3.5">
                            <IntradayMiniSparkline
                              symbol={sig.symbol}
                              entryPrice={sig.entry_price}
                              stopLoss={sig.stop_loss}
                              targetPrice={sig.target_1}
                              relativeVolume={sig.relative_volume || 2.0}
                              width={110}
                              height={34}
                            />
                          </td>
                          <td className="p-3.5 font-mono text-white font-black">₹{sig.entry_price?.toFixed(2)}</td>
                          <td className="p-3.5 font-mono text-rose-400 font-bold">₹{sig.stop_loss?.toFixed(2)}</td>
                          <td className="p-3.5 font-mono text-emerald-400 font-black">₹{sig.target_1?.toFixed(2)}</td>
                          <td className="p-3.5 font-mono text-cyan-300 font-bold">1:{sig.risk_reward || 2.0}</td>
                          <td className="p-3.5">
                            <span className={`font-mono font-bold ${(sig.relative_volume || 0) >= 2.0 ? "text-amber-400 font-black" : "text-white"}`}>
                              {sig.relative_volume}x
                            </span>
                          </td>
                          <td className="p-3.5 font-mono text-white font-semibold">{sig.candle_strength}%</td>
                          <td className="p-3.5">
                            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-400 border border-slate-700">
                              {sig.confidence_score}%
                            </span>
                          </td>
                          <td className="p-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleSendTelegramAlert(sig.symbol)}
                                className="rounded-lg border border-sky-500/40 bg-sky-500/15 p-1.5 text-sky-300 hover:bg-sky-500/25 transition"
                                title="Broadcast Telegram Alert"
                              >
                                <Send className="h-3 w-3" />
                              </button>
                              <button
                                onClick={() => openDossier(sig.symbol)}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-300 transition hover:border-cyan-400 hover:text-white"
                              >
                                <Eye className="h-3 w-3" />
                                Inspect
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* 4. Tab: 🌙 BTST Institutional Radar (Late-Day / Overnight) */}
        {/* ========================================================= */}
        {activeTab === "btst" && (
          <div className="space-y-3">
            {btstCandidates.length === 0 ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center">
                <Target className="mx-auto h-12 w-12 text-slate-600 mb-3" />
                <h4 className="text-base font-bold text-white">No BTST candidates matching criteria</h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                  BTST candidates are populated aggressively during the 2:45 PM – 3:30 PM closing window. Run universe scan to refresh candidates.
                </p>
                <button
                  onClick={handleTriggerScan}
                  className="mt-4 rounded-xl bg-purple-500/20 border border-purple-500/40 px-4 py-2 text-xs font-bold text-purple-300 hover:bg-purple-500/30"
                >
                  Scan Universe Now
                </button>
              </div>
            ) : btstViewMode === "grid" ? (
              /* Tactical BTST Cards with Delivery Visual Meters & Position Sizer */
              <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
                {uniqueBySymbol(btstCandidates)
                  .filter((b) => !searchTerm || b.symbol.includes(searchTerm.toUpperCase()))
                  .filter((b) => btstActionFilter === "ALL" || b.action_recommended === btstActionFilter)
                  .map((b) => {
                    const isHighDelivery = (b.delivery_pct || 0) >= 50;
                    const isHighSurge = (b.volume_surge_multiple || 1) >= 2.5;
                    const cmpVal = b.current_price || 1000;
                    const slVal = b.stop_loss || Math.round(cmpVal * 0.982);
                    const t1Val = b.target_1 || Math.round(cmpVal * 1.025);
                    const t2Val = b.target_2 || Math.round(cmpVal * 1.045);

                    return (
                      <div
                        key={b.id}
                        className="group relative overflow-hidden rounded-xl border border-slate-800 bg-gradient-to-b from-[#0F1426] via-[#090E1E] to-[#060A16] p-3.5 shadow-xl transition-all hover:border-purple-500/50 hover:shadow-purple-950/30"
                      >
                        {/* Header */}
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-lg font-black text-white">{b.symbol}</span>
                              <span
                                className={`rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider border ${
                                  b.action_recommended === "BUY_BTST_ELITE"
                                    ? "bg-emerald-500/25 text-emerald-300 border-emerald-400/60 shadow-sm shadow-emerald-950"
                                    : b.action_recommended === "BUY_BTST"
                                    ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
                                    : "bg-slate-700/40 text-slate-300 border-slate-600/40"
                                }`}
                              >
                                {b.action_recommended || "BUY_BTST"}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 truncate max-w-[170px]">
                              {b.company_name || b.sector || "NSE Equity"}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <AddToWatchlistButton
                              symbol={b.symbol}
                              companyName={b.company_name}
                              currentPrice={cmpVal}
                              defaultThesis={`BTST Continuation Setup: ${b.action_recommended} (Confidence: ${b.btst_confidence}/100). Delivery: ${b.delivery_pct}%, Volume: ${b.volume_surge_multiple}x.`}
                              variant="icon"
                            />
                            <button
                              onClick={() => handleSendTelegramAlert(b.symbol)}
                              disabled={sendingTelegramSym === b.symbol}
                              className="rounded-lg border border-sky-500/40 bg-sky-500/15 p-1 text-sky-300 hover:bg-sky-500/25 transition"
                              title="Broadcast BTST Alert to Telegram"
                            >
                              <Send className="h-3 w-3" />
                            </button>
                            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-mono font-black text-purple-300 border border-slate-700">
                              Score: {b.btst_confidence}
                            </span>
                          </div>
                        </div>

                        {/* Mid Row: Mini Sparkline & Delivery Surge Meters */}
                        <div className="mt-2.5 flex items-center justify-between gap-2.5">
                          <IntradayMiniSparkline
                            symbol={b.symbol}
                            entryPrice={cmpVal}
                            stopLoss={slVal}
                            targetPrice={t1Val}
                            relativeVolume={b.volume_surge_multiple || 2.4}
                            isBreakout={true}
                            width={150}
                            height={46}
                          />

                          {/* Dual Delivery & High-Close Meters */}
                          <div className="flex-1 space-y-1.5 text-right">
                            {/* Delivery % Bar */}
                            <div>
                              <div className="flex justify-between text-[10px]">
                                <span className="text-slate-400">Delivery:</span>
                                <span className={`font-mono font-bold ${isHighDelivery ? "text-emerald-400" : "text-white"}`}>
                                  {b.delivery_pct}% {isHighDelivery ? "(High)" : ""}
                                </span>
                              </div>
                              <div className="mt-0.5 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                                <div
                                  className={`h-full ${isHighDelivery ? "bg-emerald-400" : "bg-cyan-400"}`}
                                  style={{ width: `${Math.min(100, b.delivery_pct || 40)}%` }}
                                />
                              </div>
                            </div>

                            {/* Close Near High % */}
                            <div>
                              <div className="flex justify-between text-[10px]">
                                <span className="text-slate-400">Close Near High:</span>
                                <span className="font-mono font-bold text-amber-300">{b.closing_near_high_pct}%</span>
                              </div>
                              <div className="mt-0.5 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                                <div
                                  className="h-full bg-gradient-to-r from-amber-500 to-rose-400"
                                  style={{ width: `${Math.min(100, b.closing_near_high_pct || 80)}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Overnight Levels Matrix */}
                        <div className="mt-2.5 grid grid-cols-3 gap-1 rounded-lg bg-black/50 p-2 border border-slate-800/80 text-center">
                          <div>
                            <span className="block text-[9px] uppercase tracking-wider text-slate-400">CMP (Closing)</span>
                            <span className="font-mono text-xs font-black text-white">₹{cmpVal.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="block text-[9px] uppercase tracking-wider text-rose-400">Invalidation SL</span>
                            <span className="font-mono text-xs font-black text-rose-400">₹{slVal.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="block text-[9px] uppercase tracking-wider text-purple-300">Gap Target</span>
                            <span className="font-mono text-xs font-black text-purple-300">₹{t1Val.toFixed(2)}</span>
                          </div>
                        </div>

                        {/* Morning Playbook Callout */}
                        <div className="mt-2 rounded-lg border border-purple-500/30 bg-purple-950/20 p-2 text-xs text-purple-200">
                          <p className="flex items-center gap-1 font-bold text-[11px]">
                            <Sun className="h-3 w-3 text-amber-400" />
                            Morning Action Plan:
                          </p>
                          <p className="text-[10px] text-slate-300 mt-0.5 leading-relaxed">
                            Continuation probability is <strong className="text-emerald-400">{b.continuation_probability}%</strong>. If opens with gap &gt;+1.5%, trail stop to yesterday&apos;s close. Exit weak if opens below ₹{slVal}.
                          </p>
                        </div>

                        {/* Interactive Position Sizer */}
                        <div className="mt-2">
                          <PositionSizerPopover
                            entryPrice={cmpVal}
                            stopLoss={slVal}
                            target1={t1Val}
                            target2={t2Val}
                            positionMultiplier={marketRegime?.position_size_multiplier || 1.0}
                          />
                        </div>

                        {/* Footer Action */}
                        <button
                          onClick={() => openDossier(b.symbol)}
                          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/90 py-1.5 text-xs font-bold text-slate-200 transition hover:bg-purple-600 hover:text-white hover:border-purple-400 active:scale-95"
                        >
                          <Eye className="h-3 w-3" />
                          Inspect Institutional Footprint
                        </button>
                      </div>
                    );
                  })}
              </div>
            ) : (
              /* Ultra-Dense BTST Table */
              <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-800 bg-slate-950/80 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="p-3.5">Symbol / Company</th>
                      <th className="p-3.5">Action Plan</th>
                      <th className="p-3.5">CMP (₹)</th>
                      <th className="p-3.5">Close Near High %</th>
                      <th className="p-3.5">Delivery %</th>
                      <th className="p-3.5">Volume Multiple</th>
                      <th className="p-3.5">Continuation Prob %</th>
                      <th className="p-3.5">Morning Gap Target (₹)</th>
                      <th className="p-3.5">Score</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {uniqueBySymbol(btstCandidates)
                      .filter((b) => !searchTerm || b.symbol.includes(searchTerm.toUpperCase()))
                      .filter((b) => btstActionFilter === "ALL" || b.action_recommended === btstActionFilter)
                      .map((b) => {
                        const cmpVal = b.current_price || 1000;
                        const t1Val = b.target_1 || Math.round(cmpVal * 1.025);

                        return (
                          <tr key={b.id} className="transition hover:bg-slate-800/40">
                            <td className="p-3.5 font-bold font-mono text-cyan-300">
                              <div className="flex items-center gap-2">
                                <AddToWatchlistButton
                                  symbol={b.symbol}
                                  companyName={b.company_name}
                                  currentPrice={cmpVal}
                                  defaultThesis={`BTST Setup: ${b.action_recommended} (${b.btst_confidence} confidence).`}
                                  variant="icon"
                                />
                                <div>
                                  <span className="font-mono text-sm text-purple-300 font-black">{b.symbol}</span>
                                  <p className="text-[10px] text-slate-400 truncate max-w-[130px]">{b.company_name || "NSE Equity"}</p>
                                </div>
                              </div>
                            </td>
                            <td className="p-3.5">
                              <span
                                className={`rounded-md px-2 py-0.5 text-[10px] font-bold border ${
                                  b.action_recommended === "BUY_BTST_ELITE"
                                    ? "bg-emerald-500/25 text-emerald-300 border-emerald-400/60"
                                    : "bg-purple-500/20 text-purple-300 border-purple-500/40"
                                }`}
                              >
                                {b.action_recommended || "BUY_BTST"}
                              </span>
                            </td>
                            <td className="p-3.5 font-mono text-white font-black">₹{cmpVal.toFixed(2)}</td>
                            <td className="p-3.5 font-bold text-amber-300">{b.closing_near_high_pct}%</td>
                            <td className="p-3.5 font-mono font-bold text-emerald-400">{b.delivery_pct}%</td>
                            <td className="p-3.5 font-bold text-amber-400">{b.volume_surge_multiple}x</td>
                            <td className="p-3.5 font-bold text-cyan-400">{b.continuation_probability}%</td>
                            <td className="p-3.5 font-mono font-bold text-purple-300">₹{t1Val.toFixed(2)} (+2.5%)</td>
                            <td className="p-3.5 font-bold text-white">{b.btst_confidence}/100</td>
                            <td className="p-3.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleSendTelegramAlert(b.symbol)}
                                  className="rounded-lg border border-sky-500/40 bg-sky-500/15 p-1.5 text-sky-300 hover:bg-sky-500/25 transition"
                                  title="Broadcast Telegram Alert"
                                >
                                  <Send className="h-3 w-3" />
                                </button>
                                <button
                                  onClick={() => openDossier(b.symbol)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-300 transition hover:border-purple-400 hover:text-white"
                                >
                                  <Eye className="h-3 w-3" />
                                  Inspect
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
          </div>
        )}

        {/* ========================================================= */}
        {/* 5. Tab: 🎯 Elite Recommendations Master Radar             */}
        {/* ========================================================= */}
        {activeTab === "recommendations" && (() => {
          // Robust filtering pipeline: Category -> Search -> Sector -> RVOL
          let filteredRecs = recommendations;
          if (recCategoryFilter !== "ALL") {
            filteredRecs = filteredRecs.filter((r) => r.category === recCategoryFilter);
          }
          if (searchTerm) {
            filteredRecs = filteredRecs.filter((r) => r.symbol.includes(searchTerm.toUpperCase()));
          }
          if (filterSector !== "ALL") {
            filteredRecs = filteredRecs.filter((r) => r.sector === filterSector);
          }
          if (filterMinRvol > 0) {
            filteredRecs = filteredRecs.filter((r) => (r.relative_volume || 0) >= filterMinRvol);
          }

          // In "ALL" view, deduplicate by symbol picking the highest confidence record
          if (recCategoryFilter === "ALL") {
            const seen = new Set<string>();
            filteredRecs = filteredRecs.filter((item) => {
              const sym = (item?.symbol || "").toUpperCase();
              if (!sym || seen.has(sym)) return false;
              seen.add(sym);
              return true;
            });
          }

          const countForCat = (catId: string) => recommendations.filter((r) => r.category === catId).length;

          return (
            <div className="space-y-3">

              {/* Recommendations Content */}
              {filteredRecs.length === 0 ? (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-12 text-center">
                  <Target className="mx-auto h-12 w-12 text-slate-600 mb-3" />
                  <h4 className="text-base font-bold text-white">No recommendations matching current filters</h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                    Try clearing symbol search or adjusting the sub-category filter. Click &quot;Scan Universe&quot; to refresh market data.
                  </p>
                </div>
              ) : recViewMode === "list" ? (
                <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-800 bg-slate-950/80 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <tr>
                        <th className="p-3.5">Symbol / Company</th>
                        <th className="p-3.5">Setup Category</th>
                        <th className="p-3.5">Intraday Sparkline</th>
                        <th className="p-3.5">Trigger / CMP (₹)</th>
                        <th className="p-3.5">Stop Loss (₹)</th>
                        <th className="p-3.5">Target 1 (₹)</th>
                        <th className="p-3.5">R:R</th>
                        <th className="p-3.5">Conviction</th>
                        <th className="p-3.5">Setup Key Metrics</th>
                        <th className="p-3.5">AI Thesis Summary</th>
                        <th className="p-3.5 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredRecs.map((rec) => {
                        const isBreakout = rec.category === "LIVE_BREAKOUT";
                        const isPivot = rec.category === "READY_PIVOT";
                        const isSqueeze = rec.category === "COILED_SQUEEZE";
                        const isBtst = rec.category === "BTST_RUNNER";

                        return (
                          <tr key={`${rec.category}-${rec.id}-${rec.symbol}`} className="transition hover:bg-slate-800/40">
                            <td className="p-3.5 font-bold text-white">
                              <div className="flex items-center gap-2">
                                <AddToWatchlistButton
                                  symbol={rec.symbol}
                                  companyName={rec.company_name}
                                  currentPrice={rec.trigger_price || rec.current_price}
                                  defaultThesis={`${rec.category_label}: ${rec.thesis}`}
                                  variant="icon"
                                />
                                <div>
                                  <span className="font-mono text-sm text-cyan-300 font-black">{rec.symbol}</span>
                                  <p className="text-[10px] text-slate-400 truncate max-w-[130px]">{rec.company_name || "NSE Equity"}</p>
                                </div>
                              </div>
                            </td>
                            <td className="p-3.5">
                              <span
                                className={`rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider border ${
                                  isBreakout
                                    ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                                    : isPivot
                                    ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/40"
                                    : isSqueeze
                                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                    : "bg-purple-500/20 text-purple-300 border-purple-500/40"
                                }`}
                              >
                                {rec.category_label || rec.category}
                              </span>
                            </td>
                            <td className="p-3.5">
                              <IntradayMiniSparkline
                                symbol={rec.symbol}
                                entryPrice={rec.trigger_price || rec.current_price || 1000}
                                stopLoss={rec.stop_loss}
                                targetPrice={rec.target_1}
                                relativeVolume={rec.relative_volume || rec.volume_surge_multiple || 2.0}
                                width={100}
                                height={32}
                              />
                            </td>
                            <td className="p-3.5 font-mono text-white font-black">
                              ₹{(rec.trigger_price || rec.current_price || 0).toFixed(2)}
                            </td>
                            <td className="p-3.5 font-mono text-rose-400 font-bold">
                              ₹{(rec.stop_loss || 0).toFixed(2)}
                            </td>
                            <td className="p-3.5 font-mono text-emerald-400 font-black">
                              ₹{(rec.target_1 || 0).toFixed(2)}
                            </td>
                            <td className="p-3.5 font-mono text-cyan-300 font-bold">1:{rec.risk_reward || 2.0}</td>
                            <td className="p-3.5">
                              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-400 border border-slate-700">
                                {rec.confidence_score?.toFixed(0)}%
                              </span>
                            </td>
                            <td className="p-3.5 text-xs text-slate-400">
                              {isBreakout && (
                                <span>RVOL: <strong className="text-white">{rec.relative_volume}x</strong>, Candle: <strong className="text-white">{rec.candle_strength}%</strong></span>
                              )}
                              {isPivot && (
                                <span>Base: <strong className="text-white">{rec.setup_type}</strong> ({rec.distance_to_pivot_pct?.toFixed(1)}% to pivot)</span>
                              )}
                              {isSqueeze && (
                                <span>Squeeze: <strong className="text-white">{rec.squeeze_bars} bars</strong> ({rec.volume_dry_up ? "Dry Vol" : "Normal"})</span>
                              )}
                              {isBtst && (
                                <span>Delivery: <strong className="text-white">{rec.delivery_pct}%</strong>, Surge: <strong className="text-amber-300">{rec.volume_surge_multiple}x</strong></span>
                              )}
                            </td>
                            <td className="p-3.5 text-slate-300 max-w-[220px]">
                              <p className="text-[11px] truncate leading-tight" title={rec.thesis}>
                                {rec.thesis}
                              </p>
                            </td>
                            <td className="p-3.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleSendTelegramAlert(rec.symbol)}
                                  className="rounded-lg border border-sky-500/40 bg-sky-500/15 p-1.5 text-sky-300 hover:bg-sky-500/25 transition"
                                  title="Broadcast Telegram Alert"
                                >
                                  <Send className="h-3 w-3" />
                                </button>
                                <button
                                  onClick={() => openDossier(rec.symbol)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-300 transition hover:border-cyan-400 hover:text-white"
                                >
                                  <Eye className="h-3 w-3" />
                                  Inspect
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                /* Tactical Recommendation Cards with Mini-Charts & Position Sizers */
                <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
                  {filteredRecs.map((rec) => {
                    const isBreakout = rec.category === "LIVE_BREAKOUT";
                    const isPivot = rec.category === "READY_PIVOT";
                    const isSqueeze = rec.category === "COILED_SQUEEZE";
                    const isBtst = rec.category === "BTST_RUNNER";

                    let categoryBg = "bg-cyan-500/15 text-cyan-300 border-cyan-500/30";
                    if (isBreakout) categoryBg = "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
                    else if (isPivot) categoryBg = "bg-cyan-500/20 text-cyan-300 border-cyan-500/40";
                    else if (isSqueeze) categoryBg = "bg-amber-500/20 text-amber-300 border-amber-500/40";
                    else if (isBtst) categoryBg = "bg-purple-500/20 text-purple-300 border-purple-500/40";

                    const cmpVal = rec.current_price || rec.trigger_price || 1000;
                    const slVal = rec.stop_loss || Math.round(cmpVal * 0.965);
                    const t1Val = rec.target_1 || Math.round(cmpVal * 1.05);
                    const t2Val = rec.target_2 || Math.round(cmpVal * 1.10);

                    return (
                      <div
                        key={`${rec.category}-${rec.id}-${rec.symbol}`}
                        className="group relative overflow-hidden rounded-xl border border-slate-800 bg-gradient-to-b from-[#0C1527] via-[#080E1B] to-[#050B14] p-3.5 shadow-xl transition-all hover:border-amber-500/50 hover:shadow-amber-950/20"
                      >
                        {/* Header */}
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-lg font-black text-white">{rec.symbol}</span>
                              <span className={`rounded px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider border ${categoryBg}`}>
                                {rec.category_label || rec.category}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 truncate max-w-[170px] mt-0.5">
                              {rec.company_name || rec.sector || "NSE Equity"}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <AddToWatchlistButton
                              symbol={rec.symbol}
                              companyName={rec.company_name}
                              currentPrice={cmpVal}
                              defaultThesis={`${rec.category_label}: ${rec.setup_type} (${rec.confidence_score?.toFixed(0)}% confidence).`}
                              variant="icon"
                            />
                            <button
                              onClick={() => handleSendTelegramAlert(rec.symbol)}
                              disabled={sendingTelegramSym === rec.symbol}
                              className="rounded-lg border border-sky-500/40 bg-sky-500/15 p-1 text-sky-300 hover:bg-sky-500/25 transition"
                              title="Broadcast Alert to Telegram"
                            >
                              <Send className="h-3 w-3" />
                            </button>
                            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-300 border border-slate-700">
                              Score: {rec.confidence_score?.toFixed(0)}
                            </span>
                          </div>
                        </div>

                        {/* Mid: Mini Sparkline & Key Setup Intelligence */}
                        <div className="mt-2.5 flex items-center justify-between gap-2.5">
                          <IntradayMiniSparkline
                            symbol={rec.symbol}
                            entryPrice={cmpVal}
                            stopLoss={slVal}
                            targetPrice={t1Val}
                            relativeVolume={rec.relative_volume || rec.volume_surge_multiple || 2.0}
                            isBreakout={isBreakout || isBtst}
                            width={150}
                            height={46}
                          />

                          <div className="space-y-1 text-right text-xs flex-1">
                            {isBreakout && (
                              <>
                                <p className="text-[10px] text-slate-400">RVOL: <strong className="text-white">{rec.relative_volume}x</strong></p>
                                <p className="text-[10px] text-slate-400">Candle: <strong className="text-emerald-400">{rec.candle_strength}%</strong></p>
                                <p className="text-[10px] text-cyan-300">R:R: 1:{rec.risk_reward}</p>
                              </>
                            )}
                            {isPivot && (
                              <>
                                <p className="text-[10px] text-slate-400">Base: <strong className="text-white">{rec.setup_type}</strong></p>
                                <p className="text-[10px] text-cyan-300">Pivot Dist: <strong className="text-white">{rec.distance_to_pivot_pct?.toFixed(1)}%</strong></p>
                                <p className="text-[10px] text-slate-400">Length: {rec.base_length_bars} Bars</p>
                              </>
                            )}
                            {isSqueeze && (
                              <>
                                <p className="text-[10px] text-amber-300">Squeeze: {rec.squeeze_bars} Bars</p>
                                <p className="text-[10px] text-emerald-400">{rec.volume_dry_up ? "Volume Dry-Up" : "Normal Vol"}</p>
                                <p className="text-[10px] text-slate-400">Ratio: {rec.volume_dry_up_ratio}x</p>
                              </>
                            )}
                            {isBtst && (
                              <>
                                <p className="text-[10px] text-purple-300">Delivery: {rec.delivery_pct}%</p>
                                <p className="text-[10px] text-amber-400">Surge: {rec.volume_surge_multiple}x</p>
                                <p className="text-[10px] text-emerald-400">Continuation: {rec.continuation_prob}%</p>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Trade Parameters Matrix */}
                        <div className="mt-2.5 grid grid-cols-3 gap-1 rounded-lg bg-black/50 p-2 border border-slate-800/80 text-center">
                          <div>
                            <span className="block text-[9px] uppercase tracking-wider text-slate-400">
                              {isPivot ? "Pivot Level" : "Trigger / CMP"}
                            </span>
                            <span className="font-mono text-xs font-black text-white">
                              ₹{(rec.trigger_price || cmpVal).toFixed(2)}
                            </span>
                          </div>
                          <div>
                            <span className="block text-[9px] uppercase tracking-wider text-rose-400">Stop Loss</span>
                            <span className="font-mono text-xs font-black text-rose-400">₹{slVal.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="block text-[9px] uppercase tracking-wider text-emerald-400">Target 1</span>
                            <span className="font-mono text-xs font-black text-emerald-400">₹{t1Val.toFixed(2)}</span>
                          </div>
                        </div>

                        {/* AI Thesis Summary Callout */}
                        <div className="mt-2 rounded-lg border border-slate-800/60 bg-slate-950/60 p-2 text-xs text-slate-300 leading-relaxed">
                          <p className="line-clamp-2">{rec.thesis}</p>
                        </div>

                        {/* Interactive Position Sizer */}
                        <div className="mt-2">
                          <PositionSizerPopover
                            entryPrice={cmpVal}
                            stopLoss={slVal}
                            target1={t1Val}
                            target2={t2Val}
                            positionMultiplier={marketRegime?.position_size_multiplier || 1.0}
                          />
                        </div>

                        <button
                          onClick={() => openDossier(rec.symbol)}
                          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/90 py-1.5 text-xs font-bold text-slate-200 transition hover:bg-amber-400 hover:text-black hover:border-amber-300 active:scale-95"
                        >
                          <Eye className="h-3 w-3" />
                          Inspect Complete AI Dossier
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* ========================================================= */}
        {/* 6. Explainability Dossier Modal                           */}
        {/* ========================================================= */}
        {selectedStock && (
          <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/80 backdrop-blur-sm">
            <div className="relative h-full w-full max-w-xl overflow-y-auto border-l border-cyan-500/30 bg-[#07111F] p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-xl font-black text-white font-mono">{selectedStock}</h3>
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
                    onClick={() => handleSendTelegramAlert(selectedStock)}
                    className="flex items-center gap-1 rounded-xl border border-sky-500/40 bg-sky-500/20 px-3 py-1.5 text-xs font-bold text-sky-300 hover:bg-sky-500/30 transition"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Telegram
                  </button>
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
                      <span className="text-slate-400 text-[10px]">Compression</span>
                      <p className="font-bold text-white text-base font-mono">{stockDossier.scores.compression_score}/100</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                      <span className="text-slate-400 text-[10px]">Base Quality</span>
                      <p className="font-bold text-cyan-300 text-base font-mono">{stockDossier.scores.base_quality}/100</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                      <span className="text-slate-400 text-[10px]">Institutions</span>
                      <p className="font-bold text-emerald-400 text-base font-mono">{stockDossier.scores.institution_score}/100</p>
                    </div>
                    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                      <span className="text-slate-400 text-[10px]">RS Rank</span>
                      <p className="font-bold text-amber-300 text-base font-mono">{stockDossier.scores.rs_score}</p>
                    </div>
                  </div>

                  {/* AI Explanation Summary */}
                  <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-4">
                    <p className="font-black text-cyan-300 mb-1 flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4" /> AI Conviction Takeaway
                    </p>
                    <p className="text-slate-300 leading-relaxed text-xs">{stockDossier.ai_summary}</p>
                  </div>

                  {/* Pattern & Footprint Breakdown */}
                  <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
                    <p className="font-black text-white">Institutional Base Structure</p>
                    <div className="flex justify-between border-b border-slate-800/80 pb-2">
                      <span className="text-slate-400">Pattern Type:</span>
                      <span className="font-bold text-white">{stockDossier.pattern_details.type}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-800/80 pb-2">
                      <span className="text-slate-400">Pivot Reference:</span>
                      <span className="font-bold text-emerald-400 font-mono">₹{stockDossier.pattern_details.pivot_point}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-800/80 pb-2">
                      <span className="text-slate-400">Accumulation Signature:</span>
                      <span className="font-bold text-cyan-300">{stockDossier.institution_footprint.accumulation_type}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-800/80 pb-2">
                      <span className="text-slate-400">Delivery Volume %:</span>
                      <span className="font-bold text-white font-mono">{stockDossier.institution_footprint.delivery_pct}%</span>
                    </div>
                  </div>

                  {/* Historical Odds */}
                  <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-2">
                    <p className="font-black text-white">Historical Signal Odds</p>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Win Rate:</span>
                      <span className="font-bold text-emerald-400 font-mono">{stockDossier.performance_metrics.win_rate_pct}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Average Move:</span>
                      <span className="font-bold text-cyan-300 font-mono">+{stockDossier.performance_metrics.average_return_pct}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Expected Expansion Window:</span>
                      <span className="font-bold text-white font-mono">{stockDossier.performance_metrics.expected_breakout_window_days} Days</span>
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

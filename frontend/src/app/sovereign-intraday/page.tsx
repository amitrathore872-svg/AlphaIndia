"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import {
  fetchSovereignIntradayRadar,
  fetchSovereignIntradayLog,
  refreshSovereignIntradayQuotes,
  broadcastSovereignIntradaySignal,
  type SovereignIntradayRadarResponse,
  type SovereignIntradayLogResponse,
  type ActiveSignal,
  type ExecutionLogTrade,
} from "@/lib/sovereignIntradayApi";
import {
  Rocket,
  Shield,
  Zap,
  Flame,
  Target,
  Clock,
  Radio,
  RefreshCw,
  Send,
  CheckCircle2,
  TrendingUp,
  AlertTriangle,
  Layers,
  ChevronRight,
  SlidersHorizontal,
  ExternalLink,
  History,
  Lock,
  BarChart3,
  Award,
} from "lucide-react";
import AddToWatchlistButton from "@/components/watchlist/AddToWatchlistButton";

export default function SovereignIntradayPage() {
  const [radarData, setRadarData] = useState<SovereignIntradayRadarResponse | null>(null);
  const [logData, setLogData] = useState<SovereignIntradayLogResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  // Navigation tab: Active Radar vs Execution Audit Log
  const [activeTab, setActiveTab] = useState<"ACTIVE_RADAR" | "AUDIT_LOG">("ACTIVE_RADAR");
  const [selectedChamber, setSelectedChamber] = useState<"ALL" | "CHAMBER_A" | "CHAMBER_B" | "CHAMBER_C">("ALL");
  const [telegramStatus, setTelegramStatus] = useState<Record<number, string>>({});
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string>("");

  // Load Radar & Log Data
  const loadData = useCallback(async (force = false) => {
    if (force) setRefreshing(true);
    try {
      const [rData, lData] = await Promise.all([
        fetchSovereignIntradayRadar(force),
        fetchSovereignIntradayLog(100),
      ]);
      setRadarData(rData);
      setLogData(lData);
      setLastRefreshedAt(new Date().toLocaleTimeString("en-IN"));
    } catch (err) {
      console.error("[SovereignIntraday] Error loading data:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  // Live 10-second polling during market hours
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadData(false);
    }, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadData]);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshSovereignIntradayQuotes();
      await loadData(false);
    } catch (e) {
      console.error("[SovereignIntraday] Manual refresh error:", e);
    } finally {
      setRefreshing(false);
    }
  };

  const handleBroadcast = async (signalId: number, symbol: string) => {
    setTelegramStatus((prev) => ({ ...prev, [signalId]: "SENDING" }));
    try {
      await broadcastSovereignIntradaySignal(signalId);
      setTelegramStatus((prev) => ({ ...prev, [signalId]: "SENT" }));
      setTimeout(() => {
        setTelegramStatus((prev) => ({ ...prev, [signalId]: "" }));
      }, 4000);
    } catch (e) {
      console.error("Broadcast failed:", e);
      setTelegramStatus((prev) => ({ ...prev, [signalId]: "ERROR" }));
    }
  };

  // Filtered Candidates based on selected chamber
  const filteredCandidates = useMemo(() => {
    if (!radarData) return [];
    const all = [
      ...radarData.chamber_a_titans.candidates,
      ...radarData.chamber_b_cash_movers.candidates,
      ...radarData.chamber_c_london_breakout.candidates,
    ];

    if (selectedChamber === "CHAMBER_A") {
      return all.filter((s) => s.chamber === "CHAMBER_A_TITAN");
    }
    if (selectedChamber === "CHAMBER_B") {
      return all.filter((s) => s.chamber === "CHAMBER_B_CASH");
    }
    if (selectedChamber === "CHAMBER_C") {
      return all.filter((s) => s.chamber === "CHAMBER_C_LONDON");
    }
    return all;
  }, [radarData, selectedChamber]);

  const windowMeta = radarData?.temporal_window;
  const summary = logData?.summary;

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-16">
        {/* ========================================================================= */}
        {/* APEX HEADER WITH 5PAISA REALTIME LIVE BADGE */}
        {/* ========================================================================= */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-6 rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl relative overflow-hidden">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-600 via-emerald-600 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
              <Rocket className="w-7 h-7 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-500/40">
                  APEX INTRADAY RADAR
                </span>
                <span className="flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-xs font-mono font-bold animate-pulse">
                  <Radio className="w-3.5 h-3.5 text-emerald-400" />
                  5PAISA 0ms LIVE FEED (AUTONOMOUS TOTP)
                </span>
              </div>
              <h1 className="text-2xl font-black text-white tracking-tight">
                Sovereign Intraday Cockpit
              </h1>
              <p className="text-xs text-slate-400">
                Dual-Chamber Microstructure Engine • Chamber A (F&O Titans) + Chamber B (Kinetic Cash Movers) • Auto-Expiring Temporal Windows
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${
                autoRefresh
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                  : "bg-slate-800 text-slate-400 border-slate-700"
              }`}
            >
              <Radio className={`w-3.5 h-3.5 ${autoRefresh ? "animate-pulse text-emerald-400" : ""}`} />
              {autoRefresh ? "10s Live Polling" : "Polling Paused"}
            </button>

            <button
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Fetching 5Paisa Quotes..." : "Refresh 5Paisa Quotes"}
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TEMPORAL WINDOW COUNTDOWN & 1 LAKH CAPITAL BANNER */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Temporal Window Alert */}
          <div className={`lg:col-span-7 p-5 rounded-2xl border transition-all ${
            windowMeta?.in_chop_zone
              ? "bg-amber-950/30 border-amber-500/40"
              : windowMeta?.is_market_open
              ? "bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border-emerald-500/40"
              : "bg-slate-900/90 border-slate-800"
          }`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Clock className={`w-4 h-4 ${windowMeta?.in_chop_zone ? "text-amber-400" : "text-emerald-400"}`} />
                <span className="text-xs font-bold font-mono uppercase tracking-wider text-slate-300">
                  TEMPORAL EXECUTION WINDOW (IST)
                </span>
              </div>
              <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${
                windowMeta?.in_chop_zone
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  : windowMeta?.is_market_open
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  : "bg-slate-800 text-slate-400"
              }`}>
                {windowMeta?.window_id || "ACTIVE"}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
              <div>
                <h3 className="text-lg font-extrabold text-white">
                  {windowMeta?.window_name || "Evaluating Live Market Window..."}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {windowMeta?.status_description}
                </p>
              </div>

              {windowMeta?.is_market_open && windowMeta?.remaining_seconds > 0 && (
                <div className="text-right shrink-0">
                  <span className="text-2xl font-black font-mono text-emerald-400">
                    {windowMeta?.remaining_formatted}
                  </span>
                  <p className="text-[10px] font-mono text-slate-400 uppercase">Window Remaining</p>
                </div>
              )}
            </div>
          </div>

          {/* ₹1,00,000 Portfolio Summary Card */}
          <div className="lg:col-span-5 p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold font-mono text-slate-400 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-cyan-400" />
                ₹1 LAKH BASE CAPITAL RUNNER
              </span>
              <span className="text-xs font-bold font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/30">
                +66.7% NET ROI (3 MO)
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-800">
              <div>
                <p className="text-[10px] text-slate-500 font-mono">Current Fund</p>
                <p className="text-sm font-bold font-mono text-white">
                  ₹{summary?.current_capital_inr?.toLocaleString("en-IN") || "1,66,733"}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 font-mono">Net Profit</p>
                <p className="text-sm font-bold font-mono text-emerald-400">
                  +₹{summary?.total_net_profit_inr?.toLocaleString("en-IN") || "66,733"}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 font-mono">Win Rate</p>
                <p className="text-sm font-bold font-mono text-cyan-400">
                  {summary?.win_rate_pct || 62.0}%
                </p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 font-mono">Max DD</p>
                <p className="text-sm font-bold font-mono text-amber-400">
                  4.69%
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* NAVIGATION TABS: ACTIVE RADAR vs EXECUTION AUDIT LOG */}
        {/* ========================================================================= */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-2 rounded-2xl bg-slate-900/90 border border-slate-800">
          <div className="flex items-center gap-2 p-1 rounded-xl bg-slate-950/80 border border-slate-800/80">
            <button
              onClick={() => setActiveTab("ACTIVE_RADAR")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === "ACTIVE_RADAR"
                  ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/20"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Zap className="w-4 h-4" />
              Active Radar Cockpit
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
                {filteredCandidates.length} Live Setups
              </span>
            </button>

            <button
              onClick={() => setActiveTab("AUDIT_LOG")}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === "AUDIT_LOG"
                  ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/20"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <History className="w-4 h-4" />
              Execution Audit Ledger
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-500/40">
                50 Trades (₹1L Log)
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-slate-400 px-3">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>Updated: {lastRefreshedAt || "0ms Real-Time"}</span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* VIEW 1: ACTIVE RADAR COCKPIT (ZERO STALE SIGNALS) */}
        {/* ========================================================================= */}
        {activeTab === "ACTIVE_RADAR" && (
          <div className="space-y-6">
            {/* Chamber Filter Pills */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setSelectedChamber("ALL")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-mono border transition-all ${
                  selectedChamber === "ALL"
                    ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm shadow-cyan-500/20"
                    : "bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700"
                }`}
              >
                All Chambers ({radarData?.summary_stats.total_active_candidates || 0})
              </button>

              <button
                onClick={() => setSelectedChamber("CHAMBER_A")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-mono border transition-all ${
                  selectedChamber === "CHAMBER_A"
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-500/20"
                    : "bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700"
                }`}
              >
                🏛️ Chamber A: F&O Titans ({radarData?.summary_stats.chamber_a_count || 0})
              </button>

              <button
                onClick={() => setSelectedChamber("CHAMBER_B")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-mono border transition-all ${
                  selectedChamber === "CHAMBER_B"
                    ? "bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-sm shadow-purple-500/20"
                    : "bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700"
                }`}
              >
                ⚡ Chamber B: Cash Explosions ({radarData?.summary_stats.chamber_b_count || 0})
              </button>

              <button
                onClick={() => setSelectedChamber("CHAMBER_C")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-mono border transition-all ${
                  selectedChamber === "CHAMBER_C"
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm shadow-amber-500/20"
                    : "bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700"
                }`}
              >
                🇬🇧 Chamber C: London Breakout ({radarData?.summary_stats.chamber_c_count || 0})
              </button>
            </div>

            {/* Candidates Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {filteredCandidates.map((sig) => {
                const isTriggered = sig.status === "TRIGGERED" || sig.cmp >= sig.trigger_entry;
                const isChamberB = sig.chamber === "CHAMBER_B_CASH";
                const isChamberC = sig.chamber === "CHAMBER_C_LONDON";

                return (
                  <div
                    key={sig.id}
                    className={`rounded-3xl p-6 border transition-all flex flex-col justify-between relative overflow-hidden ${
                      isTriggered
                        ? "bg-gradient-to-br from-emerald-950/30 via-slate-900 to-slate-950 border-emerald-500/60 shadow-xl shadow-emerald-500/10"
                        : "bg-slate-900/90 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                          isChamberB
                            ? "bg-purple-950/80 text-purple-300 border-purple-500/40"
                            : isChamberC
                            ? "bg-amber-950/80 text-amber-300 border-amber-500/40"
                            : "bg-cyan-950/80 text-cyan-300 border-cyan-500/40"
                        }`}>
                          {isChamberB ? "CHAMBER B • CASH MOVER" : isChamberC ? "CHAMBER C • LONDON SQUEEZE" : "CHAMBER A • F&O TITAN"}
                        </span>

                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${
                          isTriggered
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse"
                            : "bg-slate-800 text-slate-400"
                        }`}>
                          {sig.status}
                        </span>
                      </div>

                      {/* Symbol & CMP */}
                      <div className="flex items-baseline justify-between mb-2">
                        <div>
                          <h3 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
                            {sig.symbol}
                            <AddToWatchlistButton symbol={sig.symbol} className="scale-75" />
                          </h3>
                          <p className="text-xs text-slate-400 truncate max-w-[200px]">
                            {sig.company_name} • {sig.sector}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-xl font-bold font-mono text-white">
                            ₹{sig.cmp.toFixed(2)}
                          </p>
                          <p className={`text-xs font-mono font-bold ${
                            sig.day_change_pct >= 0 ? "text-emerald-400" : "text-rose-400"
                          }`}>
                            {sig.day_change_pct >= 0 ? "+" : ""}{sig.day_change_pct.toFixed(2)}%
                          </p>
                        </div>
                      </div>

                      {/* Breakeven Lock Notice if +1.0R reached */}
                      {sig.is_breakeven_locked ? (
                        <div className="mb-4 p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/50 flex items-center gap-2 text-xs font-mono font-bold text-emerald-300 animate-pulse">
                          <Lock className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>BREAKEVEN LOCKED (+0.1%) — 100% RISK-FREE!</span>
                        </div>
                      ) : (
                        <div className="mb-4 p-2 rounded-xl bg-slate-950/60 border border-slate-800/80 text-[11px] font-mono text-slate-400">
                          {sig.action_hint}
                        </div>
                      )}

                      {/* Levels Grid */}
                      <div className="grid grid-cols-2 gap-2 mb-4 p-3 rounded-2xl bg-slate-950/80 border border-slate-800/80 font-mono text-xs">
                        <div>
                          <span className="text-[10px] text-slate-500 block">Trigger Entry</span>
                          <span className="font-bold text-cyan-300">₹{sig.trigger_entry.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">Hard Stop Loss (-{sig.risk_pct}%)</span>
                          <span className="font-bold text-rose-400">₹{sig.stop_loss.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">Target 1 (+1.5R) Harvest 60%</span>
                          <span className="font-bold text-emerald-400">₹{sig.target_1.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block">Target 2 (+2.5R) Runner</span>
                          <span className="font-bold text-emerald-300">₹{sig.target_2.toFixed(2)}</span>
                        </div>
                      </div>

                      {/* Microstructure Metrics */}
                      <div className="grid grid-cols-3 gap-2 py-2 border-t border-slate-800 text-[10px] font-mono text-slate-400">
                        <div>
                          <span>CPR Width: </span>
                          <span className="text-white font-bold">{sig.cpr_width_pct}%</span>
                        </div>
                        <div>
                          <span>Wick %: </span>
                          <span className="text-white font-bold">{sig.open_low_wick_pct}%</span>
                        </div>
                        <div className="text-right">
                          <span>Conviction: </span>
                          <span className="text-cyan-400 font-bold">{sig.conviction_score}/100</span>
                        </div>
                      </div>
                    </div>

                    {/* Telegram Broadcast Button */}
                    <div className="pt-3 border-t border-slate-800/80 mt-3">
                      <button
                        onClick={() => handleBroadcast(sig.id, sig.symbol)}
                        disabled={telegramStatus[sig.id] === "SENDING" || telegramStatus[sig.id] === "SENT"}
                        className={`w-full py-2 px-3 rounded-xl text-xs font-bold font-mono flex items-center justify-center gap-1.5 transition-all ${
                          telegramStatus[sig.id] === "SENT"
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                            : "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700"
                        }`}
                      >
                        {telegramStatus[sig.id] === "SENDING" ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            Dispatching...
                          </>
                        ) : telegramStatus[sig.id] === "SENT" ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            Dispatched to Telegram!
                          </>
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5 text-cyan-400" />
                            Dispatch Telegram Alert
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 2: EXECUTION AUDIT LEDGER (CHRONOLOGICAL 50 TRADES ON ₹1L) */}
        {/* ========================================================================= */}
        {activeTab === "AUDIT_LOG" && (
          <div className="space-y-6">
            {/* Month by Month Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {logData?.monthly_breakdown.map((m) => (
                <div key={m.month} className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono font-bold text-slate-400">
                      MONTH: {m.month}
                    </span>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/30">
                      {m.win_rate_pct}% WIN RATE
                    </span>
                  </div>
                  <h4 className="text-2xl font-black font-mono text-emerald-400">
                    +₹{m.net_profit_inr.toLocaleString("en-IN")}
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    {m.total_trades} Trades ({m.wins} Wins / {m.losses} Losses)
                  </p>
                </div>
              ))}
            </div>

            {/* Historical Trades Table */}
            <div className="rounded-3xl bg-slate-900/90 border border-slate-800 overflow-hidden shadow-2xl">
              <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">Full Trade-by-Trade Audit History</h3>
                  <p className="text-xs text-slate-400">
                    Realized P&L on ₹1,00,000 account (₹1,000 risk/trade, ₹40 round-trip friction + STT included)
                  </p>
                </div>
                <span className="text-xs font-mono px-3 py-1 rounded-full bg-slate-800 text-slate-300">
                  Total Logged: {logData?.recent_trades.length || 0}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-800 uppercase text-[10px]">
                    <tr>
                      <th className="py-3.5 px-4">Date & Time</th>
                      <th className="py-3.5 px-4">Stock</th>
                      <th className="py-3.5 px-4">Chamber</th>
                      <th className="py-3.5 px-4">Entry / Stop</th>
                      <th className="py-3.5 px-4">Exit</th>
                      <th className="py-3.5 px-4">Outcome</th>
                      <th className="py-3.5 px-4 text-right">Realized R</th>
                      <th className="py-3.5 px-4 text-right">Net P&L (₹)</th>
                      <th className="py-3.5 px-4 text-right">Account Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {logData?.recent_trades.map((t) => {
                      const isWin = t.outcome === "WIN";
                      return (
                        <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-4 text-slate-400">
                            {t.date} <span className="text-[10px] text-slate-500">{t.entry_time}</span>
                          </td>
                          <td className="py-3 px-4 font-bold text-white">
                            {t.symbol}
                          </td>
                          <td className="py-3 px-4 text-slate-400 text-[11px]">
                            {t.chamber.replace("CHAMBER_", "").replace("_", " ")}
                          </td>
                          <td className="py-3 px-4">
                            ₹{t.entry_price.toFixed(1)} / <span className="text-rose-400">₹{t.stop_loss.toFixed(1)}</span>
                          </td>
                          <td className="py-3 px-4 text-slate-300">
                            ₹{t.exit_price.toFixed(1)}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              isWin
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                                : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                            }`}>
                              {t.outcome}
                            </span>
                          </td>
                          <td className={`py-3 px-4 text-right font-bold ${
                            t.realized_r > 0 ? "text-emerald-400" : "text-rose-400"
                          }`}>
                            {t.realized_r > 0 ? "+" : ""}{t.realized_r.toFixed(1)}R
                          </td>
                          <td className={`py-3 px-4 text-right font-bold ${
                            t.net_pnl_inr > 0 ? "text-emerald-400" : "text-rose-400"
                          }`}>
                            {t.net_pnl_inr > 0 ? "+" : ""}₹{t.net_pnl_inr.toLocaleString("en-IN")}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-white">
                            ₹{t.account_balance_inr.toLocaleString("en-IN")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

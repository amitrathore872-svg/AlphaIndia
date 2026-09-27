"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Zap,
  TrendingUp,
  RefreshCw,
  Search,
  Bell,
  BellRing,
  Volume2,
  VolumeX,
  Target,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Flame,
  ArrowUpRight,
  ExternalLink,
  Trash2,
  RotateCcw,
  Sliders,
  DollarSign,
  Layers,
  ChevronRight,
  Clock,
  Sparkles,
  Info,
  Send,
} from "lucide-react";
import {
  BreakoutExecutionCandidate,
  BreakoutExecutionStats,
  BreakoutExecutionStatus,
  fetchBreakoutCandidates,
  checkBreakoutStatusNow,
  removeBreakoutCandidate,
  resetBreakoutCandidateAlert,
  autoEnrollTopBreakoutCandidates,
  testBreakoutTelegramAlert,
} from "@/lib/breakoutExecutionApi";

interface BreakoutExecutionCockpitProps {
  onSwitchToScreener?: () => void;
  toastMessage?: string | null;
  setToastMessage?: (msg: string | null) => void;
}

export default function BreakoutExecutionCockpit({
  onSwitchToScreener,
  toastMessage,
  setToastMessage,
}: BreakoutExecutionCockpitProps) {
  const [candidates, setCandidates] = useState<BreakoutExecutionCandidate[]>([]);
  const [stats, setStats] = useState<BreakoutExecutionStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [checking, setChecking] = useState<boolean>(false);
  const [enrolling, setEnrolling] = useState<boolean>(false);

  // Filters & Controls
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(15); // seconds (0 = off)
  const [countdown, setCountdown] = useState<number>(15);

  // Position Sizing Calculator Global State
  const [accountRiskRupees, setAccountRiskRupees] = useState<number>(5000);
  const [activeCalculatorSym, setActiveCalculatorSym] = useState<string | null>(null);
  const [sendingTelegramSym, setSendingTelegramSym] = useState<string | null>(null);

  const handleSendTelegramAlert = async (symbol: string) => {
    setSendingTelegramSym(symbol);
    try {
      const res = await testBreakoutTelegramAlert(symbol);
      if (res && res.success) {
        if (setToastMessage) {
          setToastMessage(`🚀 Telegram Breakout Alert sent for ${symbol}! Check your bot.`);
        }
      } else {
        if (setToastMessage) {
          setToastMessage(`Telegram alert: ${res?.message || "Dispatched"}`);
        }
      }
    } catch (err) {
      console.error("Failed to send Telegram alert:", err);
      if (setToastMessage) {
        setToastMessage(`Error sending Telegram alert for ${symbol}`);
      }
    } finally {
      setSendingTelegramSym(null);
    }
  };

  // Audio Chime via Web Audio API
  const playAlertSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();

      // Dual tone pleasant chime (880Hz then 1320Hz)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = "sine";
      osc1.frequency.setValueAtTime(880, ctx.currentTime);
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(1320, ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.15);
      osc2.start(ctx.currentTime + 0.12);
      osc2.stop(ctx.currentTime + 0.45);
    } catch {
      // Audio autoplay restrictions or unsupported
    }
  }, [soundEnabled]);

  const loadCandidates = useCallback(async (quiet: boolean = false) => {
    if (!quiet) setLoading(true);
    try {
      const res = await fetchBreakoutCandidates(statusFilter);
      setCandidates(res.items || []);
      setStats(res.stats || null);
    } catch (err) {
      console.error("Failed to load breakout execution candidates:", err);
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadCandidates();
  }, [loadCandidates]);

  // Live Auto-Refresh countdown loop
  useEffect(() => {
    if (autoRefreshInterval <= 0) return;

    setCountdown(autoRefreshInterval);
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          // Trigger evaluation
          handleCheckNow(true);
          return autoRefreshInterval;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [autoRefreshInterval]);

  const handleCheckNow = async (quiet: boolean = false) => {
    if (checking) return;
    setChecking(true);
    try {
      const res = await checkBreakoutStatusNow();
      if (res && res.stats) setStats(res.stats);
      if (res && res.newly_triggered && res.newly_triggered.length > 0) {
        playAlertSound();
        const syms = res.newly_triggered.join(", ");
        if (setToastMessage) {
          setToastMessage(`🚨 BREAKOUT TRIGGERED NOW: ${syms}! Buy Zone Active.`);
        }
      }
      await loadCandidates(true);
    } catch (err) {
      console.error("Error during live breakout check:", err);
    } finally {
      setChecking(false);
      setCountdown(autoRefreshInterval);
    }
  };

  const handleAutoEnroll = async () => {
    setEnrolling(true);
    try {
      const res = await autoEnrollTopBreakoutCandidates(10, 70);
      if (res && res.enrolled_count !== undefined) {
        if (setToastMessage) {
          setToastMessage(`Enrolled Top ${res.enrolled_count} A+ Coils into Execution Engine!`);
        }
        await loadCandidates();
      }
    } catch (err) {
      console.error("Error auto-enrolling coils:", err);
    } finally {
      setEnrolling(false);
    }
  };

  const handleRemove = async (symbol: string) => {
    try {
      await removeBreakoutCandidate(symbol);
      setCandidates((prev) => prev.filter((c) => c.symbol !== symbol));
      if (setToastMessage) setToastMessage(`${symbol} removed from Breakout Watcher.`);
    } catch (err) {
      console.error("Failed to remove candidate:", err);
    }
  };

  const handleReset = async (symbol: string) => {
    try {
      await resetBreakoutCandidateAlert(symbol);
      if (setToastMessage) setToastMessage(`Alert re-armed for ${symbol}.`);
      await loadCandidates(true);
    } catch (err) {
      console.error("Failed to reset alert:", err);
    }
  };

  // Filter by search
  const filteredCandidates = candidates.filter((c) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      c.symbol.toLowerCase().includes(term) ||
      (c.company_name && c.company_name.toLowerCase().includes(term)) ||
      (c.sector && c.sector.toLowerCase().includes(term))
    );
  });

  const getStatusBadge = (status: BreakoutExecutionStatus, distPct: number | null | undefined) => {
    const safeDist = typeof distPct === "number" && !isNaN(distPct) ? distPct : 0.0;
    switch (status) {
      case "TRIGGERED":
        return (
          <div className="relative inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.3)] animate-pulse">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            <Zap className="h-3.5 w-3.5 text-emerald-400" />
            <span>TRIGGERED • BUY NOW</span>
          </div>
        );
      case "READY":
        return (
          <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
            <Flame className="h-3.5 w-3.5 text-amber-400" />
            <span>READY ({safeDist.toFixed(1)}% to Pivot)</span>
          </div>
        );
      case "COILING":
        return (
          <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-mono font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
            <Target className="h-3.5 w-3.5 text-cyan-400" />
            <span>COILING IN BASE</span>
          </div>
        );
      case "EXTENDED":
        return (
          <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-mono font-medium bg-slate-800 text-slate-400 border border-slate-700">
            <AlertTriangle className="h-3.5 w-3.5 text-slate-400" />
            <span>EXTENDED (+{Math.abs(safeDist).toFixed(1)}%)</span>
          </div>
        );
      case "FAILED":
        return (
          <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-mono font-medium bg-rose-500/10 text-rose-400 border border-rose-500/30">
            <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />
            <span>BROKE SUPPORT</span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. TOP TELEMETRY RIBBON */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="rounded-xl border border-slate-800/80 bg-[#07111F]/90 p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-slate-400">Total Watched</span>
            <Target className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-white">
              {stats?.total_watched ?? candidates.length}
            </span>
            <span className="text-xs text-slate-500 font-mono">candidates</span>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/20 p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-emerald-400 font-bold">Triggered (Buy Zone)</span>
            <Zap className="h-4 w-4 text-emerald-400 animate-pulse" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-emerald-300">
              {stats?.triggered_count ?? 0}
            </span>
            <span className="text-xs text-emerald-500 font-mono font-bold">ACTIVE ENTRY</span>
          </div>
        </div>

        <div className="rounded-xl border border-amber-500/40 bg-amber-950/20 p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-amber-400 font-bold">Ready Imminent (&lt;1%)</span>
            <Flame className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-amber-300">
              {stats?.ready_count ?? 0}
            </span>
            <span className="text-xs text-amber-500 font-mono">apex tightening</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800/80 bg-[#07111F]/90 p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-slate-400">Coiling in Base</span>
            <Layers className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-white">
              {stats?.coiling_count ?? 0}
            </span>
            <span className="text-xs text-slate-500 font-mono">compressing</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800/80 bg-[#07111F]/90 p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase text-slate-400">Avg Risk:Reward</span>
            <TrendingUp className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-emerald-400">
              {stats?.avg_risk_reward ? `${stats.avg_risk_reward}:1` : "3.4:1"}
            </span>
            <span className="text-xs text-slate-500 font-mono">payoff</span>
          </div>
        </div>
      </div>

      {/* 2. ENGINE CONTROL & ACTION TOOLBAR */}
      <div className="rounded-2xl border border-slate-800 bg-[#07111F]/90 p-4 shadow-xl backdrop-blur-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Status Filters */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: "ALL", label: "All Watched", count: stats?.total_watched },
              { id: "TRIGGERED", label: "⚡ Triggered", count: stats?.triggered_count, color: "text-emerald-400" },
              { id: "READY", label: "🔥 Ready (<1%)", count: stats?.ready_count, color: "text-amber-400" },
              { id: "COILING", label: "Coiling Bases", count: stats?.coiling_count },
              { id: "EXTENDED", label: "Extended", count: stats?.extended_count },
              { id: "FAILED", label: "Failed", count: stats?.failed_count },
            ].map((tab) => {
              const active = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-mono font-semibold transition-all cursor-pointer ${
                    active
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent"
                  }`}
                >
                  <span className={tab.color || ""}>{tab.label}</span>
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className="rounded-full bg-slate-800 px-1.5 py-0.2 text-[10px] text-slate-300">
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Controls: Search, Sound, Auto-Refresh, Check Now */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search */}
            <div className="relative w-40 sm:w-48">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                placeholder="Filter symbols..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-900/80 py-1.5 pl-8 pr-3 text-xs font-mono text-slate-200 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            {/* Sound Toggle */}
            <button
              onClick={() => {
                setSoundEnabled(!soundEnabled);
                if (!soundEnabled) playAlertSound();
              }}
              title={soundEnabled ? "Breakout Audio Chime Enabled" : "Audio Chime Muted"}
              className={`p-2 rounded-xl border transition-all cursor-pointer ${
                soundEnabled
                  ? "border-emerald-500/40 bg-emerald-950/40 text-emerald-300"
                  : "border-slate-800 bg-slate-900 text-slate-500"
              }`}
            >
              {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            </button>

            {/* Auto-Refresh Cadence */}
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/80 px-2.5 py-1.5 text-xs font-mono text-slate-400">
              <Clock className="h-3.5 w-3.5 text-cyan-400" />
              <span>{countdown}s</span>
              <div className="h-3 w-px bg-slate-700" />
              <select
                value={autoRefreshInterval}
                onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
                className="bg-transparent text-slate-200 focus:outline-none cursor-pointer text-xs"
              >
                <option value={10}>10s</option>
                <option value={15}>15s</option>
                <option value={30}>30s</option>
                <option value={60}>60s</option>
                <option value={0}>Manual</option>
              </select>
            </div>

            {/* Check Now */}
            <button
              onClick={() => handleCheckNow(false)}
              disabled={checking}
              className="flex items-center gap-1.5 rounded-xl border border-cyan-500/40 bg-cyan-950/50 px-3.5 py-1.5 text-xs font-mono font-bold text-cyan-300 hover:bg-cyan-900/60 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${checking ? "animate-spin" : ""}`} />
              <span>{checking ? "Checking..." : "Check Now"}</span>
            </button>

            {/* Auto-Enroll Top 10 */}
            <button
              onClick={handleAutoEnroll}
              disabled={enrolling}
              className="flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-950/60 px-3.5 py-1.5 text-xs font-mono font-bold text-emerald-300 hover:bg-emerald-900/80 transition-all cursor-pointer disabled:opacity-50"
            >
              <Sparkles className={`h-3.5 w-3.5 ${enrolling ? "animate-spin" : ""}`} />
              <span>{enrolling ? "Enrolling..." : "Auto-Watch Top 10"}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. EXECUTION CARDS CONTAINER */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-16 rounded-2xl border border-slate-800 bg-[#07111F]/70">
          <RefreshCw className="h-8 w-8 animate-spin text-cyan-400 mb-3" />
          <p className="text-sm font-mono text-slate-400">Loading Breakout Watcher Radar...</p>
        </div>
      ) : filteredCandidates.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 rounded-2xl border border-slate-800 bg-[#07111F]/70 text-center">
          <Target className="h-12 w-12 text-slate-600 mb-4" />
          <h3 className="text-lg font-bold font-mono text-white mb-1">No Breakout Candidates Watched</h3>
          <p className="text-xs text-slate-400 max-w-md mb-5">
            You don&apos;t have any setups in the Breakout Execution Engine. Auto-watch the top 10 A+ coils or switch to the screener to pick individual setups.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={handleAutoEnroll}
              disabled={enrolling}
              className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-mono font-bold text-slate-950 hover:bg-emerald-400 transition-all cursor-pointer"
            >
              <Sparkles className="h-4 w-4" />
              <span>Auto-Watch Top 10 A+ Coils</span>
            </button>
            {onSwitchToScreener && (
              <button
                onClick={onSwitchToScreener}
                className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2 text-xs font-mono font-medium text-slate-300 hover:bg-slate-700 transition-all cursor-pointer"
              >
                <span>Browse Pre-Breakout Coils</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredCandidates.map((c) => {
            const currentCmp = typeof c.current_cmp === "number" && !isNaN(c.current_cmp) ? c.current_cmp : (c.added_at_cmp || 0);
            const triggerPrice = typeof c.trigger_price === "number" && !isNaN(c.trigger_price) ? c.trigger_price : currentCmp;
            const stopLoss = typeof c.stop_loss === "number" && !isNaN(c.stop_loss) ? c.stop_loss : (currentCmp * 0.968);
            const target1 = typeof c.target_1 === "number" && !isNaN(c.target_1) ? c.target_1 : (triggerPrice * 1.09);
            const target2 = typeof c.target_2 === "number" && !isNaN(c.target_2) ? c.target_2 : (triggerPrice * 1.18);
            const buyZoneMax = typeof c.buy_zone_max === "number" && !isNaN(c.buy_zone_max) ? c.buy_zone_max : (triggerPrice * 1.015);
            const dayChangePct = typeof c.day_change_pct === "number" && !isNaN(c.day_change_pct) ? c.day_change_pct : 0.0;
            const distPct = typeof c.distance_to_trigger_pct === "number" && !isNaN(c.distance_to_trigger_pct) ? c.distance_to_trigger_pct : 0.0;
            const volPace = typeof c.volume_pace_ratio === "number" && !isNaN(c.volume_pace_ratio) ? c.volume_pace_ratio : 1.0;
            const riskReward = typeof c.risk_reward === "number" && !isNaN(c.risk_reward) ? c.risk_reward : 3.0;

            const isTriggered = c.execution_status === "TRIGGERED";
            const isReady = c.execution_status === "READY";
            const isCalcOpen = activeCalculatorSym === c.symbol;

            // Position Sizing Calculation
            const riskPerShare = Math.max(0.5, triggerPrice - stopLoss);
            const calculatedShares = Math.max(1, Math.floor(accountRiskRupees / riskPerShare));
            const totalOutlay = Math.round(calculatedShares * triggerPrice);
            const expectedProfitT1 = Math.round(calculatedShares * (target1 - triggerPrice));
            const expectedProfitT2 = Math.round(calculatedShares * (target2 - triggerPrice));
            const riskFloorPct = triggerPrice > 0 ? (((triggerPrice - stopLoss) / triggerPrice) * 100).toFixed(1) : "3.2";

            return (
              <div
                key={c.id}
                className={`relative rounded-2xl border transition-all p-5 shadow-xl backdrop-blur-md ${
                  isTriggered
                    ? "border-emerald-500/60 bg-gradient-to-br from-[#061c14] to-[#07131a] shadow-[0_0_25px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/40"
                    : isReady
                    ? "border-amber-500/50 bg-gradient-to-br from-[#1a1407] to-[#07111F] shadow-[0_0_20px_rgba(245,158,11,0.1)]"
                    : "border-slate-800 bg-[#07111F]/90 hover:border-slate-700"
                }`}
              >
                {/* Top Row: Symbol, Badges, Status */}
                <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/techno-funda/${c.symbol}`}
                        className="text-lg font-black font-mono tracking-tight text-white hover:text-cyan-400 transition-colors flex items-center gap-1.5"
                      >
                        <span>{c.symbol}</span>
                        <ArrowUpRight className="h-4 w-4 text-slate-500" />
                      </Link>
                      <span className="rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-300">
                        {c.pattern_tag}
                      </span>
                      <span className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-mono font-bold text-cyan-400">
                        {c.conviction_score} PTS
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 truncate max-w-xs mt-0.5">
                      {c.company_name} • <span className="text-slate-500">{c.sector}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {getStatusBadge(c.execution_status, distPct)}
                  </div>
                </div>

                {/* Price & Execution Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 rounded-xl border border-slate-800/80 bg-slate-900/60 p-3 mb-3 font-mono">
                  <div>
                    <div className="text-[10px] uppercase text-slate-400">Current CMP</div>
                    <div className="text-sm font-bold text-white flex items-baseline gap-1 mt-0.5">
                      <span>₹{currentCmp.toFixed(2)}</span>
                      <span
                        className={`text-[10px] ${
                          dayChangePct >= 0 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {dayChangePct >= 0 ? "+" : ""}
                        {dayChangePct.toFixed(2)}%
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] uppercase text-amber-400 font-bold">Trigger / Pivot</div>
                    <div className="text-sm font-black text-amber-300 mt-0.5">
                      ₹{triggerPrice.toFixed(2)}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] uppercase text-slate-400">Dist to Trigger</div>
                    <div
                      className={`text-sm font-bold mt-0.5 ${
                        distPct <= 0
                          ? "text-emerald-400"
                          : distPct <= 1.2
                          ? "text-amber-400"
                          : "text-cyan-400"
                      }`}
                    >
                      {distPct <= 0 ? "BROKEN OUT" : `${distPct.toFixed(2)}%`}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] uppercase text-slate-400">Volume Pace</div>
                    <div className="text-sm font-bold text-slate-200 mt-0.5">
                      {volPace.toFixed(2)}x
                    </div>
                  </div>
                </div>

                {/* Trade Execution Plan Levels */}
                <div className="space-y-2 mb-3 font-mono text-xs">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1 text-emerald-400 font-bold">
                      <Target className="h-3 w-3" />
                      Buy Zone: ₹{triggerPrice.toFixed(2)} – ₹{buyZoneMax.toFixed(2)} (+1.5% max)
                    </span>
                    <span className="text-cyan-400 font-bold">R:R {riskReward}:1</span>
                  </div>

                  {/* Level progression bar */}
                  <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
                    <div className="rounded-lg border border-rose-500/30 bg-rose-950/20 p-1.5">
                      <span className="text-rose-400 block font-bold">STOP LOSS</span>
                      <span className="text-white">₹{stopLoss.toFixed(2)}</span>
                    </div>
                    <div className="rounded-lg border border-cyan-500/30 bg-cyan-950/20 p-1.5">
                      <span className="text-cyan-400 block font-bold">TARGET 1 (+9%)</span>
                      <span className="text-white">₹{target1.toFixed(2)}</span>
                    </div>
                    <div className="rounded-lg border border-purple-500/30 bg-purple-950/20 p-1.5">
                      <span className="text-purple-400 block font-bold">TARGET 2 (+18%)</span>
                      <span className="text-white">₹{target2.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Position Sizing Calculator Drawer (Expandable) */}
                {isCalcOpen && (
                  <div className="rounded-xl border border-cyan-500/30 bg-slate-900/90 p-3 mb-3 font-mono text-xs space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-cyan-400 font-bold flex items-center gap-1.5">
                        <DollarSign className="h-3.5 w-3.5" />
                        Position Sizing & Risk Calculator
                      </span>
                      <span className="text-[10px] text-slate-400">Risk floor: {riskFloorPct}%</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <label className="text-[10px] text-slate-400 block mb-1">Max Risk Rupee (₹)</label>
                        <input
                          type="number"
                          value={accountRiskRupees}
                          onChange={(e) => setAccountRiskRupees(Math.max(500, Number(e.target.value)))}
                          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-white focus:border-cyan-400 focus:outline-none"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] text-slate-400 block mb-1">Recommended Shares</label>
                        <div className="rounded-lg border border-slate-700 bg-slate-950/60 px-2.5 py-1 text-xs font-bold text-emerald-400">
                          {calculatedShares} QTY
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-1 text-[10px] border-t border-slate-800">
                      <div>
                        <span className="text-slate-500 block">Total Outlay</span>
                        <span className="text-white font-bold">₹{totalOutlay.toLocaleString("en-IN")}</span>
                      </div>
                      <div>
                        <span className="text-emerald-500 block">T1 Profit (+9%)</span>
                        <span className="text-emerald-400 font-bold">+₹{expectedProfitT1.toLocaleString("en-IN")}</span>
                      </div>
                      <div>
                        <span className="text-purple-500 block">T2 Profit (+18%)</span>
                        <span className="text-purple-400 font-bold">+₹{expectedProfitT2.toLocaleString("en-IN")}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Footer Action Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveCalculatorSym(isCalcOpen ? null : c.symbol)}
                      className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] transition-all cursor-pointer ${
                        isCalcOpen
                          ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                          : "text-slate-400 hover:text-slate-200 border border-slate-800"
                      }`}
                    >
                      <DollarSign className="h-3 w-3" />
                      <span>{isCalcOpen ? "Hide Size" : "Position Size"}</span>
                    </button>

                    {c.alert_dispatched && (
                      <button
                        onClick={() => handleReset(c.symbol)}
                        className="flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-300 hover:bg-amber-500/20 transition-all cursor-pointer"
                        title="Re-arm notification for new triggers"
                      >
                        <RotateCcw className="h-3 w-3" />
                        <span>Re-arm Alert</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleSendTelegramAlert(c.symbol)}
                      disabled={sendingTelegramSym === c.symbol}
                      className="flex items-center gap-1 rounded-lg border border-cyan-500/30 bg-cyan-950/40 px-2.5 py-1 text-[11px] text-cyan-300 hover:bg-cyan-900/60 transition-all cursor-pointer disabled:opacity-50"
                      title="Send Breakout Alert to Telegram"
                    >
                      <Send className="h-3 w-3" />
                      <span>{sendingTelegramSym === c.symbol ? "Sending..." : "Telegram"}</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={c.tradingview_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 rounded-lg border border-slate-800 px-2.5 py-1 text-[11px] text-slate-400 hover:text-cyan-400 transition-colors"
                    >
                      <span>Chart</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>

                    <button
                      onClick={() => handleRemove(c.symbol)}
                      className="p-1.5 rounded-lg border border-slate-800 text-slate-500 hover:text-rose-400 hover:border-rose-500/30 transition-colors cursor-pointer"
                      title="Remove from Execution Engine"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

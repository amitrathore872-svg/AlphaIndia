"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  TrendingUp,
  Zap,
  Target,
  Shield,
  BarChart3,
  RefreshCw,
  Search,
  ChevronDown,
  Activity,
  Award,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  ChevronUp,
  ChevronRight,
  Cpu,
  Layers,
} from "lucide-react";
import AddToWatchlistButton from "@/components/watchlist/AddToWatchlistButton";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PageHeader from "@/components/common/PageHeader";
import KpiCard from "@/components/common/KpiCard";
import EmptyState from "@/components/common/EmptyState";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface CupData {
  prior_high: number;
  cup_low: number;
  right_rim: number;
  depth_pct: number;
  width_weeks: number;
  symmetry_score: number;
  symmetry_label: string;
  right_lip_recovery: number;
}

interface HandleData {
  handle_high: number;
  handle_low: number;
  depth_pct: number;
  width_weeks: number;
  in_upper_half: boolean;
  volume_contracting: boolean;
}

interface VolumeData {
  avg_vol_50d: number;
  breakout_vol_ratio: number;
  base_drying_up: boolean;
  recovery_surge: boolean;
  handle_contraction: boolean;
  breakout_confirmed: boolean;
  volume_score: number;
}

interface TrendData {
  daily_rsi: number;
  weekly_rsi: number;
  monthly_rsi: number;
  above_10w_ema: boolean;
  rsi_zone_ok: boolean;
  price_vs_200d_sma: number;
  trend_score: number;
}

interface BaseData {
  handle_std_pct: number;
  inside_bar_count: number;
  gap_down_count: number;
  tight_action: boolean;
  volatility_contracting: boolean;
  base_score: number;
}

interface RSData {
  stock_12w_return: number;
  nifty_12w_return: number;
  outperformance: number;
  rs_percentile: number;
  outperforms: boolean;
  rs_score: number;
}

interface FundamentalsData {
  revenue_growth_pct: number | null;
  pat_growth_pct: number | null;
  roce_pct: number | null;
  health_score: number | null;
  revenue_positive: boolean;
  pat_positive: boolean;
  roce_adequate: boolean;
  data_available: boolean;
  fundamental_score: number;
}

interface Pattern {
  symbol: string;
  company_name: string;
  sector: string;
  exchange: string;
  cmp: number;
  day_change: number;
  day_change_pct: number;
  pivot_buy_point: number;
  stop_loss_tight: number;
  stop_loss_wide: number;
  target_1: number;
  target_2: number;
  risk_reward: number;
  ai_conviction_score: number;
  conviction_tier: string;
  tier_badge: string;
  stages_passed: number;
  stage_gates: Record<string, boolean>;
  cup: CupData;
  handle: HandleData;
  volume: VolumeData;
  trend: TrendData;
  base: BaseData;
  rs: RSData;
  fundamentals: FundamentalsData;
  tradingview_url: string;
  techno_funda_url: string;
}

interface Metadata {
  total_scanned: number;
  patterns_found: number;
  elite_count: number;
  high_conviction_count: number;
  developing_count: number;
  breakout_ready_count: number;
  avg_conviction_score: number;
  scan_duration_seconds: number;
  last_scan_time: string;
}

interface ScanData {
  metadata: Metadata;
  total_count: number;
  page: number;
  total_pages: number;
  items: Pattern[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

import { API_BASE } from "@/lib/apiConfig";

const SECTORS = [
  "ALL", "IT & Tech", "Banking - Private", "Banking - PSU",
  "Financial Services", "Pharma & Healthcare", "Capital Goods & Power",
  "Defence & Aerospace", "Automotive", "Metals & Mining",
  "Consumer & Retail", "Oil, Gas & Energy", "Realty & Infra",
];

const SORT_OPTIONS = [
  { value: "ai_conviction_score", label: "AI Score" },
  { value: "breakout_vol_ratio", label: "Volume Surge" },
  { value: "risk_reward", label: "Risk/Reward" },
  { value: "symmetry", label: "Cup Symmetry" },
  { value: "weekly_rsi", label: "Weekly RSI" },
  { value: "day_change_pct", label: "Day Change %" },
  { value: "cmp", label: "Price" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Utility helpers
// ─────────────────────────────────────────────────────────────────────────────

const fmt = (n: number, d = 2) => n?.toFixed(d) ?? "—";
const fmtVol = (n: number) => {
  if (!n) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toFixed(0);
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function ConvictionBadge({ score, tier }: { score: number; tier: string }) {
  let colorClass = "bg-amber-500/10 text-amber-400 border-amber-500/30";
  if (score >= 82) colorClass = "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
  else if (score >= 70) colorClass = "bg-cyan-500/10 text-cyan-400 border-cyan-500/30";

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold tracking-wide ${colorClass}`}>
      {score >= 82 && <Award className="w-2.5 h-2.5" />}
      {tier === "HIGH CONVICTION" && <Zap className="w-2.5 h-2.5" />}
      {tier === "DEVELOPING" && <Activity className="w-2.5 h-2.5" />}
      {tier}
    </span>
  );
}

function StageGateRow({ label, passed }: { label: string; passed: boolean }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-white/5 last:border-0">
      <span className="text-[11px] text-slate-400">{label}</span>
      {passed ? (
        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
      ) : (
        <XCircle className="w-3.5 h-3.5 text-slate-600" />
      )}
    </div>
  );
}

function ScoreBar({ label, score, max, color }: { label: string; score: number; max: number; color: string }) {
  const pct = Math.min(100, (score / max) * 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px]">
        <span className="text-slate-400">{label}</span>
        <span className="text-white font-mono">{fmt(score, 0)}/{max}</span>
      </div>
      <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function PatternCard({ pattern, expanded, onToggle }: {
  pattern: Pattern;
  expanded: boolean;
  onToggle: () => void;
}) {
  const isPositive = pattern.day_change_pct >= 0;
  const breakoutReady = pattern.volume.breakout_confirmed;

  return (
    <div className={`
      relative rounded-xl border transition-all duration-200 overflow-hidden
      ${expanded ? "border-cyan-500/40 bg-slate-900/80" : "border-slate-800/60 bg-slate-900/40 hover:border-slate-700/60"}
    `}>
      {/* Breakout indicator strip */}
      {breakoutReady && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500 to-cyan-500" />
      )}

      {/* ── Main row ── */}
      <div
        className="flex items-center gap-4 px-5 py-4 cursor-pointer"
        onClick={onToggle}
      >
        {/* AI Score ring */}
        <div className="flex-shrink-0 relative w-14 h-14">
          <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r="24" fill="none" stroke="#1e293b" strokeWidth="4" />
            <circle
              cx="28" cy="28" r="24"
              fill="none"
              stroke={pattern.ai_conviction_score >= 82 ? "#10b981" : pattern.ai_conviction_score >= 70 ? "#06b6d4" : "#f59e0b"}
              strokeWidth="4"
              strokeDasharray={`${(pattern.ai_conviction_score / 100) * 150.8} 150.8`}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white">
            {pattern.ai_conviction_score}
          </span>
        </div>

        {/* Symbol + Company */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-bold text-white tracking-wide">{pattern.symbol}</span>
            <ConvictionBadge score={pattern.ai_conviction_score} tier={pattern.conviction_tier} />
            {breakoutReady && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                <Zap className="w-2.5 h-2.5" /> BREAKOUT
              </span>
            )}
          </div>
          <div className="text-[11px] text-slate-400 truncate mt-0.5">{pattern.company_name}</div>
          <div className="text-[10px] text-slate-600 mt-0.5">{pattern.sector}</div>
        </div>

        {/* CMP + Change */}
        <div className="text-right flex-shrink-0">
          <div className="text-lg font-mono font-bold text-white">₹{fmt(pattern.cmp)}</div>
          <div className={`text-xs font-mono font-semibold ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
            {isPositive ? <ArrowUpRight className="w-3 h-3 inline" /> : <ArrowDownRight className="w-3 h-3 inline" />}
            {fmt(Math.abs(pattern.day_change_pct))}%
          </div>
        </div>

        {/* Key metrics grid */}
        <div className="hidden lg:grid grid-cols-3 gap-x-6 text-center flex-shrink-0">
          <div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wide">Buy Point</div>
            <div className="text-sm font-mono text-cyan-400 font-semibold">₹{fmt(pattern.pivot_buy_point)}</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wide">Target</div>
            <div className="text-sm font-mono text-emerald-400 font-semibold">₹{fmt(pattern.target_1)}</div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wide">R:R</div>
            <div className="text-sm font-mono text-amber-400 font-semibold">{fmt(pattern.risk_reward)}×</div>
          </div>
        </div>

        {/* Cup geometry quick stats */}
        <div className="hidden xl:flex flex-col items-end gap-1 flex-shrink-0 text-right">
          <div className="text-[10px] text-slate-500">
            Cup <span className="text-white font-mono">{fmt(pattern.cup.depth_pct)}%</span> deep ·{" "}
            <span className="text-white font-mono">{fmt(pattern.cup.width_weeks, 0)}w</span> wide
          </div>
          <div className="text-[10px] text-slate-500">
            Symmetry{" "}
            <span className={`font-bold ${pattern.cup.symmetry_score >= 70 ? "text-emerald-400" : pattern.cup.symmetry_score >= 50 ? "text-amber-400" : "text-red-400"}`}>
              {pattern.cup.symmetry_label}
            </span>
          </div>
          <div className="text-[10px] text-slate-500">
            Vol surge{" "}
            <span className="text-cyan-400 font-mono">{fmt(pattern.volume.breakout_vol_ratio)}×</span>
          </div>
        </div>

        {/* Watchlist + Expand icon */}
        <div className="flex items-center gap-2 flex-shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
          <AddToWatchlistButton
            symbol={pattern.symbol}
            companyName={pattern.company_name}
            currentPrice={pattern.cmp}
            variant="button"
          />
          <div className="text-slate-500">
            {expanded
              ? <ChevronDown className="w-4 h-4" />
              : <ChevronRight className="w-4 h-4" />}
          </div>
        </div>
      </div>

      {/* ── Expanded Detail Panel ── */}
      {expanded && (
        <div className="border-t border-slate-800/60 px-5 pb-5 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">

            {/* Cup & Handle Geometry */}
            <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/30">
              <h4 className="text-[11px] font-bold text-cyan-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <Layers className="w-3 h-3" /> Cup Geometry
              </h4>
              <div className="space-y-2 text-[11px]">
                <div className="flex justify-between"><span className="text-slate-400">Prior High</span><span className="font-mono text-white">₹{fmt(pattern.cup.prior_high)}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Cup Low</span><span className="font-mono text-white">₹{fmt(pattern.cup.cup_low)}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Right Rim</span><span className="font-mono text-white">₹{fmt(pattern.cup.right_rim)}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Cup Depth</span><span className={`font-mono font-bold ${pattern.cup.depth_pct <= 35 ? "text-emerald-400" : "text-amber-400"}`}>{fmt(pattern.cup.depth_pct)}%</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Width</span><span className="font-mono text-white">{fmt(pattern.cup.width_weeks, 0)} weeks</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Right Lip</span><span className="font-mono text-white">{fmt(pattern.cup.right_lip_recovery)}%</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Symmetry</span>
                  <span className={`font-bold ${pattern.cup.symmetry_score >= 70 ? "text-emerald-400" : "text-amber-400"}`}>
                    {fmt(pattern.cup.symmetry_score)}% ({pattern.cup.symmetry_label})
                  </span>
                </div>
                <div className="border-t border-slate-700/40 pt-2 mt-2">
                  <div className="text-slate-400 mb-1">Handle</div>
                  <div className="flex justify-between"><span className="text-slate-500">Drift</span><span className="font-mono text-white">{fmt(pattern.handle.depth_pct)}%</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Width</span><span className="font-mono text-white">{fmt(pattern.handle.width_weeks, 0)}w</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Upper Half</span>
                    {pattern.handle.in_upper_half ? <CheckCircle className="w-3 h-3 text-emerald-400" /> : <XCircle className="w-3 h-3 text-red-400" />}
                  </div>
                  <div className="flex justify-between"><span className="text-slate-500">Vol Contracting</span>
                    {pattern.handle.volume_contracting ? <CheckCircle className="w-3 h-3 text-emerald-400" /> : <XCircle className="w-3 h-3 text-red-400" />}
                  </div>
                </div>
              </div>
            </div>

            {/* Volume + Trend */}
            <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/30">
              <h4 className="text-[11px] font-bold text-emerald-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <BarChart3 className="w-3 h-3" /> Volume & Trend
              </h4>
              <div className="space-y-1.5 text-[11px] mb-3">
                <div className="flex justify-between"><span className="text-slate-400">Breakout Vol Ratio</span>
                  <span className={`font-mono font-bold ${pattern.volume.breakout_vol_ratio >= 1.5 ? "text-emerald-400" : "text-amber-400"}`}>
                    {fmt(pattern.volume.breakout_vol_ratio)}×
                  </span>
                </div>
                <div className="flex justify-between"><span className="text-slate-400">50d Avg Vol</span><span className="font-mono text-white">{fmtVol(pattern.volume.avg_vol_50d)}</span></div>
                <StageGateRow label="Base Drying Up" passed={pattern.volume.base_drying_up} />
                <StageGateRow label="Recovery Surge" passed={pattern.volume.recovery_surge} />
                <StageGateRow label="Handle Contraction" passed={pattern.volume.handle_contraction} />
                <StageGateRow label="Breakout Confirmed" passed={pattern.volume.breakout_confirmed} />
              </div>
              <div className="border-t border-slate-700/40 pt-3 space-y-1.5">
                <div className="flex justify-between text-[11px]"><span className="text-slate-400">Daily RSI</span>
                  <span className={`font-mono font-bold ${pattern.trend.daily_rsi >= 60 ? "text-emerald-400" : "text-amber-400"}`}>{fmt(pattern.trend.daily_rsi, 1)}</span>
                </div>
                <div className="flex justify-between text-[11px]"><span className="text-slate-400">Weekly RSI</span>
                  <span className={`font-mono font-bold ${pattern.trend.weekly_rsi >= 55 ? "text-emerald-400" : "text-amber-400"}`}>{fmt(pattern.trend.weekly_rsi, 1)}</span>
                </div>
                <div className="flex justify-between text-[11px]"><span className="text-slate-400">Monthly RSI</span>
                  <span className={`font-mono font-bold ${pattern.trend.monthly_rsi >= 55 ? "text-emerald-400" : "text-amber-400"}`}>{fmt(pattern.trend.monthly_rsi, 1)}</span>
                </div>
                <div className="flex justify-between text-[11px]"><span className="text-slate-400">vs 200d SMA</span>
                  <span className={`font-mono font-bold ${pattern.trend.price_vs_200d_sma >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {pattern.trend.price_vs_200d_sma >= 0 ? "+" : ""}{fmt(pattern.trend.price_vs_200d_sma)}%
                  </span>
                </div>
                <StageGateRow label="Above 10W EMA" passed={pattern.trend.above_10w_ema} />
                <StageGateRow label="RSI Zone OK" passed={pattern.trend.rsi_zone_ok} />
              </div>
            </div>

            {/* Trade Blueprint */}
            <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/30">
              <h4 className="text-[11px] font-bold text-amber-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <Target className="w-3 h-3" /> Trade Blueprint
              </h4>
              <div className="space-y-3">
                <div className="bg-cyan-500/5 border border-cyan-500/20 rounded p-2">
                  <div className="text-[9px] text-cyan-400 uppercase tracking-widest mb-0.5">Buy Point (Pivot)</div>
                  <div className="text-xl font-mono font-bold text-cyan-400">₹{fmt(pattern.pivot_buy_point)}</div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-emerald-500/5 border border-emerald-500/20 rounded p-2">
                    <div className="text-[9px] text-emerald-400 uppercase tracking-widest mb-0.5">Target 1 (+12%)</div>
                    <div className="text-sm font-mono font-bold text-emerald-400">₹{fmt(pattern.target_1)}</div>
                  </div>
                  <div className="bg-emerald-500/5 border border-emerald-500/20 rounded p-2">
                    <div className="text-[9px] text-emerald-400 uppercase tracking-widest mb-0.5">Target 2 (Meas.)</div>
                    <div className="text-sm font-mono font-bold text-emerald-400">₹{fmt(pattern.target_2)}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-red-500/5 border border-red-500/20 rounded p-2">
                    <div className="text-[9px] text-red-400 uppercase tracking-widest mb-0.5">Stop (Tight)</div>
                    <div className="text-sm font-mono font-bold text-red-400">₹{fmt(pattern.stop_loss_tight)}</div>
                  </div>
                  <div className="bg-red-500/5 border border-red-500/20 rounded p-2">
                    <div className="text-[9px] text-red-400 uppercase tracking-widest mb-0.5">Stop (Wide)</div>
                    <div className="text-sm font-mono font-bold text-red-400">₹{fmt(pattern.stop_loss_wide)}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between bg-amber-500/5 border border-amber-500/20 rounded p-2">
                  <span className="text-[10px] text-amber-400 uppercase tracking-widest">Risk : Reward</span>
                  <span className="text-lg font-mono font-bold text-amber-400">{fmt(pattern.risk_reward)}×</span>
                </div>
              </div>

              {/* Fundamentals */}
              <div className="mt-3 pt-3 border-t border-slate-700/40">
                <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <Shield className="w-3 h-3" /> Fundamentals
                </div>
                {pattern.fundamentals.data_available ? (
                  <div className="space-y-1 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Revenue Growth</span>
                      <span className={`font-mono font-bold ${pattern.fundamentals.revenue_positive ? "text-emerald-400" : "text-red-400"}`}>
                        {pattern.fundamentals.revenue_growth_pct !== null ? `${fmt(pattern.fundamentals.revenue_growth_pct)}%` : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">PAT Growth</span>
                      <span className={`font-mono font-bold ${pattern.fundamentals.pat_positive ? "text-emerald-400" : "text-red-400"}`}>
                        {pattern.fundamentals.pat_growth_pct !== null ? `${fmt(pattern.fundamentals.pat_growth_pct)}%` : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">ROCE</span>
                      <span className={`font-mono font-bold ${pattern.fundamentals.roce_adequate ? "text-emerald-400" : "text-amber-400"}`}>
                        {pattern.fundamentals.roce_pct !== null ? `${fmt(pattern.fundamentals.roce_pct)}%` : "—"}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-[10px] text-slate-600">Financial data not yet ingested</div>
                )}
              </div>
            </div>

            {/* AI Score Breakdown + Stage Gates */}
            <div className="bg-slate-800/30 rounded-lg p-4 border border-slate-700/30">
              <h4 className="text-[11px] font-bold text-purple-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <Cpu className="w-3 h-3" /> AI Score Breakdown
              </h4>
              <div className="space-y-2 mb-4">
                <ScoreBar label="Cup Geometry" score={Math.round(pattern.cup.symmetry_score / 5)} max={20} color="bg-cyan-500" />
                <ScoreBar label="Base Quality" score={pattern.base.base_score} max={20} color="bg-purple-500" />
                <ScoreBar label="Volume Pattern" score={pattern.volume.volume_score} max={20} color="bg-emerald-500" />
                <ScoreBar label="Trend Quality" score={pattern.trend.trend_score} max={15} color="bg-blue-500" />
                <ScoreBar label="Relative Strength" score={pattern.rs.rs_score} max={15} color="bg-amber-500" />
                <ScoreBar label="Fundamentals" score={pattern.fundamentals.fundamental_score} max={10} color="bg-rose-500" />
              </div>

              <div className="border-t border-slate-700/40 pt-3">
                <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-2">Stage Gates ({pattern.stages_passed}/8)</div>
                <StageGateRow label="Cup Geometry" passed={pattern.stage_gates.cup_geometry} />
                <StageGateRow label="Handle Geometry" passed={pattern.stage_gates.handle_geometry} />
                <StageGateRow label="Volume Signature" passed={pattern.stage_gates.volume_signature} />
                <StageGateRow label="Trend Integrity" passed={pattern.stage_gates.trend_integrity} />
                <StageGateRow label="Base Quality" passed={pattern.stage_gates.base_quality} />
                <StageGateRow label="Relative Strength" passed={pattern.stage_gates.relative_strength} />
                <StageGateRow label="Fundamentals" passed={pattern.stage_gates.fundamentals} />
                <StageGateRow label="Conviction ≥ 60" passed={pattern.stage_gates.conviction_threshold} />
              </div>

              <div className="flex gap-2 mt-4 flex-wrap">
                <AddToWatchlistButton
                  symbol={pattern.symbol}
                  companyName={pattern.company_name}
                  currentPrice={pattern.cmp}
                  variant="button"
                />
                <a
                  href={pattern.tradingview_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-cyan-400 border border-cyan-500/30 rounded py-1.5 hover:bg-cyan-500/10 transition-colors"
                >
                  <Eye className="w-3 h-3" /> TradingView
                </a>
                <a
                  href={pattern.techno_funda_url}
                  className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-amber-400 border border-amber-500/30 rounded py-1.5 hover:bg-amber-500/10 transition-colors"
                >
                  <TrendingUp className="w-3 h-3" /> Techno-Funda
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────────────────────

export default function CupHandlePage() {
  const [data, setData] = useState<ScanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [sector, setSector] = useState("ALL");
  const [sortBy, setSortBy] = useState("ai_conviction_score");
  const [sortOrder, setSortOrder] = useState("desc");
  const [minScore, setMinScore] = useState(60);
  const [breakoutOnly, setBreakoutOnly] = useState(false);
  const [page, setPage] = useState(1);

  // Expanded cards
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpand = (sym: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(sym)) next.delete(sym);
      else next.add(sym);
      return next;
    });
  };

  const fetchData = useCallback(
    async (force = false) => {
      try {
        const params = new URLSearchParams({
          min_score: String(minScore),
          search: search || "",
          sector: sector === "ALL" ? "" : sector,
          sort_by: sortBy,
          sort_order: sortOrder,
          breakout_only: String(breakoutOnly),
          page: String(page),
          limit: "20",
        });
        const url = `${API_BASE}/api/v1/cup-handle?${params}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setData(json);
        setError(null);
      } catch (e: any) {
        setError(e.message ?? "Failed to load");
      } finally {
        setLoading(false);
        setScanning(false);
      }
    },
    [minScore, search, sector, sortBy, sortOrder, breakoutOnly, page]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const triggerScan = async () => {
    setScanning(true);
    try {
      await fetch(`${API_BASE}/api/v1/cup-handle/scan`, { method: "POST" });
      setTimeout(() => fetchData(true), 2000);
    } catch {
      setScanning(false);
    }
  };

  const meta = data?.metadata;
  const patterns = data?.items ?? [];

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* ─── Header ─── */}
        <PageHeader
          eyebrow="CLASSICAL PATTERN RADAR"
          icon={<TrendingUp className="w-5 h-5" />}
          iconColor="cyan"
          title="Cup & Handle AI Engine"
          badge={{ label: "8-STAGE AI GATING", color: "cyan" }}
          subtitle="High Conviction Breakout Scanner · Multi-stage geometry validation & volume confirmation"
          actions={
            <div className="flex items-center gap-3">
              {meta && (
                <div className="hidden md:flex items-center gap-1.5 text-[10px] text-slate-500 font-mono">
                  <Clock className="w-3 h-3" />
                  {meta.last_scan_time}
                </div>
              )}
              <button
                onClick={triggerScan}
                disabled={scanning}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-semibold hover:bg-cyan-500/20 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${scanning ? "animate-spin" : ""}`} />
                {scanning ? "Scanning…" : "Fresh Scan"}
              </button>
            </div>
          }
        />

        {/* ─── Stats Strip ─── */}
        {meta && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <KpiCard
              label="Universe Scanned"
              value={meta.total_scanned}
            />
            <KpiCard
              label="Patterns Found"
              value={meta.patterns_found}
              color="cyan"
            />
            <KpiCard
              label="ELITE"
              value={meta.elite_count}
              color="emerald"
            />
            <KpiCard
              label="HIGH CONVICTION"
              value={meta.high_conviction_count}
              color="cyan"
            />
            <KpiCard
              label="DEVELOPING"
              value={meta.developing_count}
              color="amber"
            />
            <KpiCard
              label="Breakout Ready"
              value={meta.breakout_ready_count}
              color="emerald"
            />
            <KpiCard
              label="Avg AI Score"
              value={fmt(meta.avg_conviction_score, 1)}
              color="purple"
            />
          </div>
        )}

        {/* ─── Filters Bar ─── */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Symbol or company…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="bg-white dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700/40 rounded-lg pl-8 pr-4 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 w-52 shadow-2xs"
            />
          </div>

          {/* Sector */}
          <div className="relative">
            <select
              value={sector}
              onChange={(e) => { setSector(e.target.value); setPage(1); }}
              className="bg-white dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700/40 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-white appearance-none pr-8 focus:outline-none focus:border-cyan-500/50 cursor-pointer shadow-xs"
            >
              {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Sort */}
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-white dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700/40 rounded-lg px-3 py-2 text-sm text-slate-800 dark:text-white appearance-none pr-8 focus:outline-none focus:border-cyan-500/50 cursor-pointer shadow-xs"
            >
              {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Sort order toggle */}
          <button
            onClick={() => setSortOrder((o) => o === "desc" ? "asc" : "desc")}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700/40 text-sm text-slate-700 dark:text-slate-300 hover:border-slate-400 dark:hover:border-slate-600 transition-colors shadow-2xs"
          >
            {sortOrder === "desc" ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            {sortOrder === "desc" ? "Highest" : "Lowest"}
          </button>

          {/* Min score */}
          <div className="flex items-center gap-2 bg-white dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700/40 rounded-lg px-3 py-2 shadow-2xs">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Min Score</span>
            <input
              type="number"
              min={0} max={99}
              value={minScore}
              onChange={(e) => { setMinScore(Number(e.target.value)); setPage(1); }}
              className="bg-transparent w-10 text-sm text-slate-900 dark:text-white font-mono focus:outline-none"
            />
          </div>

          {/* Breakout toggle */}
          <button
            onClick={() => { setBreakoutOnly((v) => !v); setPage(1); }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-semibold transition-colors shadow-2xs ${
              breakoutOnly
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                : "bg-white dark:bg-slate-800/60 border-slate-300 dark:border-slate-700/40 text-slate-600 dark:text-slate-400"
            }`}
          >
            <Zap className="w-3.5 h-3.5" /> Breakout Only
          </button>

          <div className="ml-auto text-[11px] text-slate-500 font-mono">
            {data?.total_count ?? 0} results
          </div>
        </div>

        {/* ─── Pattern Cards ─── */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-12 h-12 rounded-full border-2 border-cyan-500/30 border-t-cyan-500 animate-spin" />
            <p className="text-slate-500 text-sm">Running 8-stage AI analysis across liquid universe…</p>
          </div>
        ) : error ? (
          <div className="flex items-center gap-3 text-red-500 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-4">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        ) : patterns.length === 0 ? (
          <EmptyState
            icon={<TrendingUp className="w-7 h-7 text-cyan-500 dark:text-cyan-400" />}
            title="No patterns match current filters"
            description="Try lowering the minimum conviction score or remove sector filters to view developing patterns."
            action={
              <button
                onClick={() => {
                  setMinScore(60);
                  setSector("ALL");
                  setSearch("");
                  setBreakoutOnly(false);
                }}
                className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/20"
              >
                Reset Filters
              </button>
            }
          />
        ) : (
          <div className="space-y-3">
            {patterns.map((p) => (
              <PatternCard
                key={p.symbol}
                pattern={p}
                expanded={expanded.has(p.symbol)}
                onToggle={() => toggleExpand(p.symbol)}
              />
            ))}
          </div>
        )}

        {/* ─── Pagination ─── */}
        {data && data.total_pages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-4">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-4 py-2 rounded-lg bg-white dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700/40 text-sm text-slate-700 dark:text-slate-300 disabled:opacity-40 hover:border-slate-400 dark:hover:border-slate-600 transition-colors shadow-2xs"
            >
              Previous
            </button>
            <span className="text-sm text-slate-500">
              Page {page} of {data.total_pages}
            </span>
            <button
              disabled={page >= data.total_pages}
              onClick={() => setPage((p) => p + 1)}
              className="px-4 py-2 rounded-lg bg-white dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700/40 text-sm text-slate-700 dark:text-slate-300 disabled:opacity-40 hover:border-slate-400 dark:hover:border-slate-600 transition-colors shadow-2xs"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

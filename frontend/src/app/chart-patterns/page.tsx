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
  Clock,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  ChevronUp,
  ChevronRight,
  Layers,
  Cpu,
  CheckCircle2,
  ExternalLink,
  Copy,
  Check,
  Play,
  Square,
  Sparkles,
} from "lucide-react";
import AddToWatchlistButton from "@/components/watchlist/AddToWatchlistButton";
import DashboardLayout from "@/components/layout/DashboardLayout";

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Types
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface PatternMetrics {
  base_high?: number;
  base_low?: number;
  weekly_std_pct?: number;
  vol_contracting?: boolean;
  price_position_pct?: number;
  price_vs_200d_sma?: number;
  left_low?: number;
  right_low?: number;
  low_diff_pct?: number;
  mid_pivot?: number;
  pivot_height_pct?: number;
  resistance_level?: number;
  resistance_touches?: number;
  resistance_flatness_pct?: number;
  higher_lows?: number;
  support_slope?: number;
  pattern_height_pct?: number;
  pole_gain_pct?: number;
  pole_bars?: number;
  flag_top?: number;
  flag_bottom?: number;
  flag_depth_pct?: number;
  flag_bars?: number;
  is_htf?: boolean;
}

interface PatternItem {
  symbol: string;
  company_name: string;
  sector: string;
  exchange: string;
  pattern_type: "FLAT_BASE" | "DOUBLE_BOTTOM" | "ASCENDING_TRIANGLE" | "BULL_FLAG" | "HIGH_TIGHT_FLAG";
  pattern_label: string;
  cmp: number;
  day_change: number;
  day_change_pct: number;
  pivot_buy_point: number;
  stop_loss: number;
  target_1: number;
  target_2: number;
  risk_reward: number;
  pattern_depth_pct: number;
  pattern_width_weeks: number;
  volume_ratio: number;
  ai_conviction_score: number;
  conviction_tier: string;
  tier_badge: string;
  breakout_distance_pct: number;
  is_near_breakout: boolean;
  is_breakout: boolean;
  daily_rsi: number;
  weekly_rsi: number;
  price_vs_200d_sma: number;
  pattern_metrics: PatternMetrics;
  tradingview_url?: string;
  techno_funda_url?: string;
}

interface Metadata {
  total_patterns: number;
  total_symbols_with_patterns?: number;
  pattern_breakdown: Record<string, number>;
  elite_count: number;
  high_conviction_count?: number;
  scan_duration_seconds?: number;
  last_scan_time?: string;
  scheduler_mode?: string;
}

interface ApiResponse {
  metadata: Metadata;
  total_count: number;
  page: number;
  limit: number;
  total_pages: number;
  patterns: PatternItem[];
}

interface SchedulerStatus {
  status: string;
  universe_size: number;
  scanned_count: number;
  coverage_pct: number;
  active_patterns: number;
  pattern_breakdown: Record<string, number>;
  elite_count: number;
  last_tick_time?: string;
  last_tick_batch_size?: number;
  last_tick_duration_sec?: number;
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Constants
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

import { API_BASE } from "@/lib/apiConfig";

const PATTERN_CONFIG: Record<string, { label: string; color: string; border: string; bg: string; text: string; desc?: string }> = {
  ALL: {
    label: "All Patterns",
    color: "indigo",
    border: "border-indigo-300 dark:border-indigo-500/30",
    bg: "bg-indigo-50 dark:bg-indigo-500/10",
    text: "text-indigo-700 dark:text-indigo-300",
  },
  INVERSE_HEAD_AND_SHOULDERS: {
    label: "Inverse Head & Shoulders",
    color: "purple",
    border: "border-purple-300 dark:border-purple-500/40",
    bg: "bg-purple-50 dark:bg-purple-950/40",
    text: "text-purple-800 dark:text-purple-300",
    desc: "Triple trough reversal with ascending right shoulder breakout",
  },
  FLAT_BASE: {
    label: "Flat Base",
    color: "cyan",
    border: "border-cyan-300 dark:border-cyan-500/40",
    bg: "bg-cyan-50 dark:bg-cyan-950/40",
    text: "text-cyan-800 dark:text-cyan-300",
    desc: "Tight consolidation <15% depth, volume drying up",
  },
  DOUBLE_BOTTOM: {
    label: "Double Bottom (W)",
    color: "emerald",
    border: "border-emerald-300 dark:border-emerald-500/40",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    text: "text-emerald-800 dark:text-emerald-300",
    desc: "Two symmetrical lows, volume shift, pivot breakout",
  },
  ASCENDING_TRIANGLE: {
    label: "Ascending Triangle",
    color: "amber",
    border: "border-amber-300 dark:border-amber-500/40",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-800 dark:text-amber-300",
    desc: "Horizontal resistance + rising higher lows",
  },
  BULL_FLAG: {
    label: "Bull Flag",
    color: "purple",
    border: "border-purple-300 dark:border-purple-500/40",
    bg: "bg-purple-50 dark:bg-purple-950/40",
    text: "text-purple-800 dark:text-purple-300",
    desc: "15-60% pole with tight, orderly downward flag",
  },
  HIGH_TIGHT_FLAG: {
    label: "High Tight Flag",
    color: "rose",
    border: "border-rose-300 dark:border-rose-500/40",
    bg: "bg-rose-50 dark:bg-rose-950/40",
    text: "text-rose-800 dark:text-rose-300",
    desc: "100%+ explosive move in â‰¤8 weeks (Minervini Elite)",
  },
};

const SECTORS = [
  "ALL",
  "IT & Tech",
  "Banking - Private",
  "Banking - PSU",
  "Financial Services",
  "Pharma & Healthcare",
  "Capital Goods & Power",
  "Defence & Aerospace",
  "Automotive",
  "Metals & Mining",
  "Consumer & Retail",
  "Oil, Gas & Energy",
  "Realty & Infra",
];

const SORT_OPTIONS = [
  { value: "ai_conviction_score", label: "AI Conviction Score" },
  { value: "breakout_distance_pct", label: "Proximity to Breakout" },
  { value: "risk_reward", label: "Risk / Reward Ratio" },
  { value: "daily_rsi", label: "Daily RSI" },
  { value: "volume_ratio", label: "Volume Surge Ratio" },
  { value: "cmp", label: "Price (CMP)" },
];

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Helpers
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const fmt = (n: number | undefined | null, d = 2) =>
  n !== undefined && n !== null && !isNaN(n) ? n.toFixed(d) : "—";

function ConvictionBadge({ score, tier }: { score: number; tier: string }) {
  let badgeCls = "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-500/40";
  if (score >= 82) {
    badgeCls = "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40 shadow-xs";
  } else if (score >= 70) {
    badgeCls = "bg-cyan-50 dark:bg-cyan-950/40 text-cyan-800 dark:text-cyan-300 border-cyan-300 dark:border-cyan-500/40 shadow-xs";
  }

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-mono font-bold tracking-wider ${badgeCls}`}>
      {score >= 82 ? (
        <Award className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
      ) : score >= 70 ? (
        <Zap className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
      ) : (
        <Activity className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
      )}
      <span>{score}</span>
      <span className="text-[10px] opacity-80 tracking-normal font-sans">{tier}</span>
    </div>
  );
}

function PatternTypeBadge({ type }: { type: string }) {
  const conf = PATTERN_CONFIG[type] || PATTERN_CONFIG.FLAT_BASE;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded border text-[11px] font-semibold tracking-wide ${conf.bg} ${conf.border} ${conf.text}`}
    >
      <Layers className="w-3 h-3" />
      {conf.label}
    </span>
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Pattern Card Component
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function PatternCard({
  item,
  expanded,
  onToggle,
}: {
  item: PatternItem;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const m = item.pattern_metrics || {};

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = `🎯 [Alpha India] ${item.symbol} (${item.pattern_label})\n` +
      `AI Score: ${item.ai_conviction_score}/100 (${item.conviction_tier})\n` +
      `CMP: ₹${fmt(item.cmp)} | Pivot Buy Point: ₹${fmt(item.pivot_buy_point)} (${fmt(item.breakout_distance_pct)}% from pivot)\n` +
      `Stop Loss: ₹${fmt(item.stop_loss)} | Target 1: ₹${fmt(item.target_1)} | Target 2: ₹${fmt(item.target_2)}\n` +
      `Risk/Reward: ${fmt(item.risk_reward)}:1 | Base Width: ${fmt(item.pattern_width_weeks, 1)}w | Depth: ${fmt(item.pattern_depth_pct)}%`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isNear = item.is_near_breakout || Math.abs(item.breakout_distance_pct) <= 2.5;

  return (
    <div
      onClick={onToggle}
      className={`group cursor-pointer rounded-xl border transition-all duration-200 bg-white dark:bg-[#111a30] hover:border-indigo-400 dark:hover:border-indigo-500/50 ${
        isNear
          ? "border-emerald-500/60 dark:border-emerald-500/40 shadow-sm shadow-emerald-500/10"
          : "border-slate-200/90 dark:border-indigo-500/20 shadow-xs hover:shadow-md"
      }`}
    >
      {/* â”€â”€ Main Summary Row â”€â”€ */}
      <div className="p-4 sm:p-5 flex flex-col gap-4">
        {/* Top line: Symbol, badges, price & score */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-lg font-black tracking-wide text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {item.symbol}
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700/60">
                  {item.exchange}
                </span>
                {isNear && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40 text-[10px] font-bold animate-pulse">
                    <Zap className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" /> NEAR BREAKOUT
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[280px] sm:max-w-[360px] mt-0.5">
                {item.company_name} â€¢ <span className="text-slate-600 dark:text-slate-400 font-medium">{item.sector}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <PatternTypeBadge type={item.pattern_type} />
            <ConvictionBadge score={item.ai_conviction_score} tier={item.conviction_tier} />

            <button
              onClick={handleCopy}
              title="Copy Trade Blueprint"
              className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-800/80 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors shadow-2xs"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>

            <div onClick={(e) => e.stopPropagation()}>
              <AddToWatchlistButton
                symbol={item.symbol}
                companyName={item.company_name}
                currentPrice={item.cmp}
                variant="star"
              />
            </div>

            <div className="text-slate-400 dark:text-slate-500">
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </div>
        </div>

        {/* Metric Badges Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800/60 text-xs">
          {/* CMP */}
          <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#0c1326] border border-slate-200/80 dark:border-slate-800/80">
            <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">CMP</div>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="font-mono font-bold text-slate-900 dark:text-white text-sm">₹{fmt(item.cmp)}</span>
              <span
                className={`font-mono text-[11px] font-bold ${
                  item.day_change_pct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                }`}
              >
                {item.day_change_pct >= 0 ? "+" : ""}
                {fmt(item.day_change_pct)}%
              </span>
            </div>
          </div>

          {/* Pivot Buy Point */}
          <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#0c1326] border border-slate-200/80 dark:border-slate-800/80">
            <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Pivot Point</div>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="font-mono font-bold text-indigo-700 dark:text-cyan-300 text-sm">₹{fmt(item.pivot_buy_point)}</span>
              <span
                className={`font-mono text-[10px] font-bold ${
                  item.breakout_distance_pct <= 2.5
                    ? "text-emerald-600 dark:text-emerald-400"
                    : item.breakout_distance_pct <= 5
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-slate-500 dark:text-slate-400"
                }`}
              >
                {item.breakout_distance_pct > 0 ? "+" : ""}
                {fmt(item.breakout_distance_pct)}%
              </span>
            </div>
          </div>

          {/* Targets & Invalidation */}
          <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#0c1326] border border-slate-200/80 dark:border-slate-800/80">
            <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">T1 / Stop</div>
            <div className="flex items-baseline gap-1.5 mt-0.5 font-mono text-[11px]">
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">₹{fmt(item.target_1)}</span>
              <span className="text-slate-400">/</span>
              <span className="text-rose-600 dark:text-rose-400 font-bold">₹{fmt(item.stop_loss)}</span>
            </div>
          </div>

          {/* Risk/Reward */}
          <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#0c1326] border border-slate-200/80 dark:border-slate-800/80">
            <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Risk:Reward</div>
            <div className="mt-0.5 font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm">
              {fmt(item.risk_reward)}:1
            </div>
          </div>

          {/* Base Geometry */}
          <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#0c1326] border border-slate-200/80 dark:border-slate-800/80">
            <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Base Depth / Width</div>
            <div className="mt-0.5 font-mono text-[11px]">
              <span className="text-amber-700 dark:text-amber-300 font-bold">{fmt(item.pattern_depth_pct)}%</span>
              <span className="text-slate-500"> across </span>
              <span className="text-slate-900 dark:text-white font-bold">{fmt(item.pattern_width_weeks, 1)}w</span>
            </div>
          </div>

          {/* RSI & 200 SMA */}
          <div className="p-2 rounded-lg bg-slate-50 dark:bg-[#0c1326] border border-slate-200/80 dark:border-slate-800/80">
            <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">RSI / 200 SMA</div>
            <div className="flex items-baseline gap-1 mt-0.5 font-mono text-[11px]">
              <span className="text-cyan-700 dark:text-cyan-300 font-bold">D:{fmt(item.daily_rsi, 0)}</span>
              <span className="text-slate-400">|</span>
              <span className="text-slate-900 dark:text-white font-bold">W:{fmt(item.weekly_rsi, 0)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* â”€â”€ Expanded Deep-Dive Blueprint â”€â”€ */}
      {expanded && (
        <div className="px-4 pb-5 pt-3 border-t border-slate-200 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-950/40 space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider">
            <span>Pattern Intelligence & Execution Blueprint</span>
            <div className="flex items-center gap-3">
              <a
                href={item.tradingview_url || `https://in.tradingview.com/symbols/NSE-${item.symbol}/`}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-indigo-600 dark:text-cyan-400 hover:text-indigo-800 dark:hover:text-cyan-300 font-medium transition-colors"
              >
                <span>TradingView Chart</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href={`/techno-funda/${item.symbol}?from=/chart-patterns`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 font-medium transition-colors"
              >
                <span>Techno-Funda Radar</span>
                <ChevronRight className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* Pattern specific telemetry */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            {item.pattern_type === "FLAT_BASE" && (
              <>
                <div className="p-2.5 rounded-lg bg-white dark:bg-[#0c1326] border border-slate-200 dark:border-slate-800">
                  <div className="text-slate-500 text-[10px]">Base High / Low</div>
                  <div className="font-mono text-slate-800 dark:text-slate-200 mt-1 font-semibold">
                    ₹{fmt(m.base_high)} / ₹{fmt(m.base_low)}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-white dark:bg-[#0c1326] border border-slate-200 dark:border-slate-800">
                  <div className="text-slate-500 text-[10px]">Tightness (Weekly Std)</div>
                  <div className="font-mono text-indigo-600 dark:text-cyan-400 mt-1 font-semibold">
                    {fmt(m.weekly_std_pct)}%
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-white dark:bg-[#0c1326] border border-slate-200 dark:border-slate-800">
                  <div className="text-slate-500 text-[10px]">Volume Contraction</div>
                  <div className="font-mono text-emerald-600 dark:text-emerald-400 mt-1 font-semibold">
                    {m.vol_contracting ? "Confirmed Drying Up" : "Normalizing"}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-white dark:bg-[#0c1326] border border-slate-200 dark:border-slate-800">
                  <div className="text-slate-500 text-[10px]">52-Week Range Pos.</div>
                  <div className="font-mono text-slate-900 dark:text-white mt-1 font-semibold">
                    {fmt(m.price_position_pct, 1)}% from Low
                  </div>
                </div>
              </>
            )}

            {item.pattern_type === "DOUBLE_BOTTOM" && (
              <>
                <div className="p-2.5 rounded-lg bg-white dark:bg-[#0c1326] border border-slate-200 dark:border-slate-800">
                  <div className="text-slate-500 text-[10px]">Lows (L1 / L2)</div>
                  <div className="font-mono text-slate-800 dark:text-slate-200 mt-1 font-semibold">
                    ₹{fmt(m.left_low)} / ₹{fmt(m.right_low)}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-white dark:bg-[#0c1326] border border-slate-200 dark:border-slate-800">
                  <div className="text-slate-500 text-[10px]">Low Symmetry Diff</div>
                  <div className="font-mono text-emerald-600 dark:text-emerald-400 mt-1 font-semibold">
                    {fmt(m.low_diff_pct)}% (Symmetrical)
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-white dark:bg-[#0c1326] border border-slate-200 dark:border-slate-800">
                  <div className="text-slate-500 text-[10px]">Middle Pivot Peak</div>
                  <div className="font-mono text-indigo-600 dark:text-cyan-300 mt-1 font-semibold">
                    ₹{fmt(m.mid_pivot)} (+{fmt(m.pivot_height_pct)}%)
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-white dark:bg-[#0c1326] border border-slate-200 dark:border-slate-800">
                  <div className="text-slate-500 text-[10px]">Accumulation Shift</div>
                  <div className="font-mono text-emerald-600 dark:text-emerald-400 mt-1 font-semibold">
                    Right Low Vol Drying Up
                  </div>
                </div>
              </>
            )}

            {item.pattern_type === "ASCENDING_TRIANGLE" && (
              <>
                <div className="p-2.5 rounded-lg bg-white dark:bg-[#0c1326] border border-slate-200 dark:border-slate-800">
                  <div className="text-slate-500 text-[10px]">Horizontal Resistance</div>
                  <div className="font-mono text-indigo-600 dark:text-cyan-300 mt-1 font-semibold">
                    ₹{fmt(m.resistance_level)}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-white dark:bg-[#0c1326] border border-slate-200 dark:border-slate-800">
                  <div className="text-slate-500 text-[10px]">Resistance Touches</div>
                  <div className="font-mono text-amber-700 dark:text-amber-300 mt-1 font-semibold">
                    {m.resistance_touches} Tests (Flatness {fmt(m.resistance_flatness_pct)}%)
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-white dark:bg-[#0c1326] border border-slate-200 dark:border-slate-800">
                  <div className="text-slate-500 text-[10px]">Rising Support Slope</div>
                  <div className="font-mono text-emerald-600 dark:text-emerald-400 mt-1 font-semibold">
                    +{fmt(m.support_slope, 3)} ({m.higher_lows} Higher Lows)
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-white dark:bg-[#0c1326] border border-slate-200 dark:border-slate-800">
                  <div className="text-slate-500 text-[10px]">Pattern Height</div>
                  <div className="font-mono text-slate-900 dark:text-white mt-1 font-semibold">
                    {fmt(m.pattern_height_pct)}% Consolidation
                  </div>
                </div>
              </>
            )}

            {(item.pattern_type === "BULL_FLAG" || item.pattern_type === "HIGH_TIGHT_FLAG") && (
              <>
                <div className="p-2.5 rounded-lg bg-white dark:bg-[#0c1326] border border-slate-200 dark:border-slate-800">
                  <div className="text-slate-500 text-[10px]">Prior Flag Pole Move</div>
                  <div className="font-mono text-emerald-600 dark:text-emerald-400 mt-1 font-semibold">
                    +{fmt(m.pole_gain_pct)}% in {m.pole_bars} Sessions
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-white dark:bg-[#0c1326] border border-slate-200 dark:border-slate-800">
                  <div className="text-slate-500 text-[10px]">Flag Pullback Depth</div>
                  <div className="font-mono text-amber-700 dark:text-amber-300 mt-1 font-semibold">
                    {fmt(m.flag_depth_pct)}% across {m.flag_bars} Bars
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-white dark:bg-[#0c1326] border border-slate-200 dark:border-slate-800">
                  <div className="text-slate-500 text-[10px]">Flag Boundary Range</div>
                  <div className="font-mono text-slate-800 dark:text-slate-200 mt-1 font-semibold">
                    ₹{fmt(m.flag_top)} — ₹{fmt(m.flag_bottom)}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-white dark:bg-[#0c1326] border border-slate-200 dark:border-slate-800">
                  <div className="text-slate-500 text-[10px]">Setup Category</div>
                  <div className={`font-mono mt-1 font-semibold ${m.is_htf ? "text-rose-600 dark:text-rose-400" : "text-purple-600 dark:text-purple-400"}`}>
                    {m.is_htf ? "Minervini High Tight Flag" : "Standard Bull Flag"}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Trade Execution Plan Card */}
          <div className="p-3.5 rounded-lg bg-white dark:bg-[#111a30] border border-slate-200 dark:border-indigo-500/20 text-xs flex flex-wrap items-center justify-between gap-4 shadow-xs">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-indigo-600 dark:text-cyan-400" />
              <span className="font-bold text-slate-900 dark:text-white">Execution Plan:</span>
              <span className="text-slate-600 dark:text-slate-400">
                Enter on breakout candle above <strong className="text-indigo-700 dark:text-cyan-300">₹{fmt(item.pivot_buy_point)}</strong> with volume &gt; 1.5Ã— 50 DMA.
              </span>
            </div>
            <div className="flex items-center gap-4 text-slate-700 dark:text-slate-300 font-medium">
              <div>
                Stop Loss: <strong className="text-rose-600 dark:text-rose-400 font-bold">₹{fmt(item.stop_loss)}</strong>
              </div>
              <div>
                Target 1 (+10%): <strong className="text-emerald-600 dark:text-emerald-400 font-bold">₹{fmt(item.target_1)}</strong>
              </div>
              <div>
                Target 2 (+20%): <strong className="text-emerald-700 dark:text-emerald-300 font-bold">₹{fmt(item.target_2)}</strong>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Main Page Component
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function ChartPatternsPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [schedulerStatus, setSchedulerStatus] = useState<SchedulerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedPattern, setSelectedPattern] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [minScore, setMinScore] = useState<number>(60);
  const [breakoutOnly, setBreakoutOnly] = useState(false);
  const [selectedSector, setSelectedSector] = useState("ALL");
  const [exchange, setExchange] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState("ai_conviction_score");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);

  // UI state
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpand = (symbol: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) next.delete(symbol);
      else next.add(symbol);
      return next;
    });
  };

  // â”€â”€ Fetch telemetry â”€â”€
  const fetchSchedulerStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/chart-patterns/scheduler/status`);
      if (res.ok) {
        const json = await res.json();
        setSchedulerStatus(json);
      }
    } catch {
      // Background poll failure is non-blocking
    }
  }, []);

  // â”€â”€ Fetch patterns â”€â”€
  const fetchPatterns = useCallback(
    async (force = false) => {
      try {
        if (force) setRefreshing(true);
        else setLoading(true);
        setError(null);

        const params = new URLSearchParams({
          page: String(page),
          limit: "50",
          min_score: String(minScore),
          sort_by: sortBy,
          sort_order: sortOrder,
        });

        if (selectedPattern !== "ALL") params.append("pattern_type", selectedPattern);
        if (selectedSector !== "ALL") params.append("sector", selectedSector);
        if (exchange !== "ALL") params.append("exchange", exchange);
        if (search.trim()) params.append("search", search.trim());
        if (breakoutOnly) params.append("is_breakout", "true");
        if (force) params.append("force_refresh", "true");

        const res = await fetch(`${API_BASE}/api/v1/chart-patterns?${params.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to load chart patterns`);

        const json: ApiResponse = await res.json();
        setData(json);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Error fetching patterns");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [page, minScore, sortBy, sortOrder, selectedPattern, selectedSector, exchange, search, breakoutOnly]
  );

  useEffect(() => {
    fetchPatterns();
  }, [fetchPatterns]);

  useEffect(() => {
    fetchSchedulerStatus();
    const interval = setInterval(fetchSchedulerStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchSchedulerStatus]);

  const handleStartScheduler = async () => {
    try {
      await fetch(`${API_BASE}/api/v1/chart-patterns/scheduler/start`, { method: "POST" });
      fetchSchedulerStatus();
    } catch (e) {
      console.error(e);
    }
  };

  const handleStopScheduler = async () => {
    try {
      await fetch(`${API_BASE}/api/v1/chart-patterns/scheduler/stop`, { method: "POST" });
      fetchSchedulerStatus();
    } catch (e) {
      console.error(e);
    }
  };

  const metadata = data?.metadata;
  const breakdown = metadata?.pattern_breakdown || {};
  const patterns = data?.patterns || [];

  return (
    <DashboardLayout>
      <div className="space-y-6 font-sans">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-600 dark:text-cyan-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-wider uppercase text-slate-900 dark:text-white font-mono">
                  Multi-Pattern Radar
                </h1>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-cyan-300 border border-indigo-200 dark:border-cyan-500/40 font-bold">
                  v2.3 INSTITUTIONAL
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Autonomous Chart Pattern Detection across 4000+ NSE & BSE Equities
              </p>
            </div>
          </div>

          {/* Live Scanner Telemetry Pill */}
          <div className="flex items-center gap-3 text-xs">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 font-mono shadow-xs">
              <div
                className={`w-2 h-2 rounded-full ${
                  schedulerStatus?.status === "RUNNING"
                    ? "bg-emerald-500 dark:bg-emerald-400 animate-ping"
                    : "bg-amber-500"
                }`}
              />
              <span className="text-slate-500 dark:text-slate-400">Scheduler:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">
                {schedulerStatus?.status || "RUNNING"}
              </span>
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <span className="text-slate-500 dark:text-slate-400">Universe:</span>
              <span className="text-indigo-600 dark:text-cyan-400 font-bold">
                {schedulerStatus?.universe_size || 8598}
              </span>
              <span className="text-slate-300 dark:text-slate-600">|</span>
              <span className="text-slate-500 dark:text-slate-400">Scanned:</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                {schedulerStatus?.scanned_count || 0}
              </span>
            </div>

            {/* Quick Rescan Button */}
            <button
              onClick={() => fetchPatterns(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-cyan-300 text-xs font-semibold transition-all disabled:opacity-50 shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
              <span>{refreshing ? "Scanningâ€¦" : "Fresh Scan"}</span>
            </button>
          </div>
        </div>

        {/* â”€â”€ Pattern Category Pill Selector Bar â”€â”€ */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-3 pt-1 flex items-center gap-2 overflow-x-auto no-scrollbar text-xs">
          {(["ALL", "INVERSE_HEAD_AND_SHOULDERS", "FLAT_BASE", "DOUBLE_BOTTOM", "ASCENDING_TRIANGLE", "BULL_FLAG", "HIGH_TIGHT_FLAG"] as const).map(
            (pKey) => {
              const conf = PATTERN_CONFIG[pKey] || PATTERN_CONFIG.ALL;
              const count = pKey === "ALL" ? data?.total_count || 0 : breakdown[pKey] || 0;
              const isSelected = selectedPattern === pKey;

              return (
                <button
                  key={pKey}
                  onClick={() => {
                    setSelectedPattern(pKey);
                    setPage(1);
                  }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border font-medium whitespace-nowrap transition-all shadow-xs ${
                    isSelected
                      ? `${conf.bg} ${conf.border} ${conf.text} font-bold shadow-xs`
                      : "bg-white dark:bg-slate-900/50 border-slate-200 dark:border-slate-800/80 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-slate-300"
                  }`}
                >
                  <span>{conf.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                      isSelected ? "bg-indigo-600/15 dark:bg-white/20 text-indigo-800 dark:text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            }
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* â”€â”€ Institutional Stats Bar â”€â”€ */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 rounded-xl bg-white dark:bg-[#111a30] border border-slate-200/90 dark:border-indigo-500/20 shadow-xs dark:shadow-md">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 uppercase font-semibold tracking-wider">
              Total Patterns Active
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-bold text-slate-900 dark:text-white">
                {data?.total_count || 0}
              </span>
              <span className="text-xs text-slate-500">patterns</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-[#111a30] border border-emerald-300/80 dark:border-emerald-500/20 shadow-xs dark:shadow-md">
            <div className="text-[11px] text-emerald-700 dark:text-emerald-400 uppercase font-semibold tracking-wider flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              Elite Setups (Score â‰¥ 82)
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {metadata?.elite_count || 0}
              </span>
              <span className="text-xs text-slate-500">highest conviction</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-[#111a30] border border-cyan-300/80 dark:border-cyan-500/20 shadow-xs dark:shadow-md">
            <div className="text-[11px] text-cyan-800 dark:text-cyan-300 uppercase font-semibold tracking-wider flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              Near Breakout (&lt;2.5%)
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-bold text-cyan-700 dark:text-cyan-300">
                {patterns.filter((p) => p.is_near_breakout || Math.abs(p.breakout_distance_pct) <= 2.5).length}
              </span>
              <span className="text-xs text-slate-500">ready to trigger</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-white dark:bg-[#111a30] border border-slate-200/90 dark:border-indigo-500/20 shadow-xs dark:shadow-md">
            <div className="text-[11px] text-slate-500 dark:text-slate-400 uppercase font-semibold tracking-wider">
              Last Scan Cycle
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-mono text-xs text-slate-700 dark:text-slate-300 font-semibold truncate">
                {metadata?.last_scan_time || "Continuous background loop"}
              </span>
            </div>
          </div>
        </div>

        {/* â”€â”€ Filters & Search Control Bar â”€â”€ */}
        <div className="p-4 rounded-xl bg-white dark:bg-[#111a30] border border-slate-200/90 dark:border-indigo-500/20 shadow-xs dark:shadow-md flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Search box */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="Search Symbol / Companyâ€¦"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-50 dark:bg-[#0c1326] border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-indigo-500/60 shadow-2xs"
            />
          </div>

          {/* Sector filter */}
          <div className="flex items-center gap-2">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Sector:</span>
            <select
              value={selectedSector}
              onChange={(e) => {
                setSelectedSector(e.target.value);
                setPage(1);
              }}
              className="bg-white dark:bg-[#0c1326] border border-slate-300 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500/60 cursor-pointer shadow-xs"
            >
              {SECTORS.map((sec) => (
                <option key={sec} value={sec}>
                  {sec}
                </option>
              ))}
            </select>
          </div>

          {/* Min Score filter */}
          <div className="flex items-center gap-2">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Min Score:</span>
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#0c1326] border border-slate-200 dark:border-slate-800 rounded-lg p-0.5 shadow-2xs">
              {[0, 60, 70, 82].map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setMinScore(s);
                    setPage(1);
                  }}
                  className={`px-2 py-1 rounded text-[11px] font-mono font-semibold transition-colors ${
                    minScore === s
                      ? "bg-indigo-600/15 dark:bg-indigo-500/25 text-indigo-800 dark:text-cyan-300 font-bold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  {s === 0 ? "All" : `${s}+`}
                </button>
              ))}
            </div>
          </div>

          {/* Breakout Only toggle */}
          <button
            onClick={() => {
              setBreakoutOnly((b) => !b);
              setPage(1);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-semibold transition-colors shadow-2xs ${
              breakoutOnly
                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40"
                : "bg-white dark:bg-[#0c1326] border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Near Breakout Only</span>
          </button>

          {/* Sort By */}
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Sort:</span>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setPage(1);
              }}
              className="bg-white dark:bg-[#0c1326] border border-slate-300 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500/60 cursor-pointer shadow-xs"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* â”€â”€ Pattern Cards List â”€â”€ */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-12 h-12 rounded-full border-2 border-cyan-500/30 border-t-cyan-500 animate-spin" />
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
              Scanning 5 institutional chart patterns across the equity universeâ€¦
            </p>
          </div>
        ) : error ? (
          <div className="flex items-center gap-3 text-rose-500 dark:text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-xl p-4">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        ) : patterns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 border border-dashed border-slate-300 dark:border-slate-800 rounded-xl bg-white/50 dark:bg-transparent">
            <TrendingUp className="w-10 h-10 text-slate-400 dark:text-slate-600" />
            <p className="text-slate-600 dark:text-slate-400 font-semibold text-sm">No patterns match current filter criteria</p>
            <p className="text-slate-500 dark:text-slate-600 text-xs">
              Try adjusting the minimum score or switching to &quot;All Patterns&quot;
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {patterns.map((item) => (
              <PatternCard
                key={`${item.symbol}-${item.pattern_type}`}
                item={item}
                expanded={expanded.has(`${item.symbol}-${item.pattern_type}`)}
                onToggle={() => toggleExpand(`${item.symbol}-${item.pattern_type}`)}
              />
            ))}
          </div>
        )}

        {/* â”€â”€ Pagination â”€â”€ */}
        {data && data.total_pages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-4">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-4 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 disabled:opacity-40 hover:border-slate-300 dark:hover:border-slate-700 transition-colors shadow-2xs"
            >
              Previous
            </button>
            <span className="text-xs text-slate-500">
              Page {page} of {data.total_pages} ({data.total_count} total setups)
            </span>
            <button
              disabled={page >= data.total_pages}
              onClick={() => setPage((p) => p + 1)}
              className="px-4 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 disabled:opacity-40 hover:border-slate-300 dark:hover:border-slate-700 transition-colors shadow-2xs"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}


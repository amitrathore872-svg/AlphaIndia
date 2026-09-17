"use client";

// =======================================================
// Alpha India — Announcements & Catalyst AI Radar
// Live corporate filings, 80% noise filter & AI growth insights
// Bloomberg dark aesthetic · cyan/amber/emerald accents
// =======================================================

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Radio,
  RefreshCw,
  Flame,
  Zap,
  FileCheck,
  TrendingDown,
  Shuffle,
  ExternalLink,
  FileText,
  Clock,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
  RotateCcw,
  Filter,
  Building2,
  Layers,
  Send,
  BookmarkPlus,
  X,
  TrendingUp,
  Percent,
  Coins,
  ShieldCheck,
  Maximize2,
  Target,
  Crosshair,
  ArrowUpRight,
  LayoutGrid,
  List,
  Calendar,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Gauge,
  type LucideIcon,
} from "lucide-react";


import DashboardLayout from "@/components/layout/DashboardLayout";
import TerminalSearch from "@/components/common/TerminalSearch";
import {
  fetchAnnouncements,
  fetchAnnouncementStats,
  fetchLiveWireStatus,
  triggerLiveWirePoll,
  triggerAnnouncementsSync,
  sendTelegramAlert,
  addCatalystToWatchlist,
  type AnnouncementRadarItem,
  type AnnouncementStats,
  type CatalystType,
  type LiveWireTelemetry,
} from "@/lib/announcementsApi";


// -------------------------------------------------------
// Configuration
// -------------------------------------------------------

interface CatalystPillConfig {
  label: string;
  type: CatalystType | "";
  icon: typeof Flame;
  color: string;
  activeBg: string;
  border: string;
}

const CATALYST_PILLS: CatalystPillConfig[] = [
  {
    label: "All Catalysts",
    type: "",
    icon: Layers,
    color: "text-slate-300",
    activeBg: "bg-slate-800 text-white border-slate-600",
    border: "border-slate-800",
  },
  {
    label: "Capex Commissioning",
    type: "CAPEX_COMMISSIONING",
    icon: Flame,
    color: "text-emerald-400",
    activeBg: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
    border: "border-emerald-500/20",
  },
  {
    label: "Mega Order Wins",
    type: "ORDER_WIN",
    icon: Zap,
    color: "text-amber-400",
    activeBg: "bg-amber-500/20 text-amber-300 border-amber-500/40",
    border: "border-amber-500/20",
  },
  {
    label: "USFDA / Reg Clearances",
    type: "USFDA_REGULATORY",
    icon: FileCheck,
    color: "text-cyan-400",
    activeBg: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
    border: "border-cyan-500/20",
  },
  {
    label: "Deleveraging / Debt-Free",
    type: "DELEVERAGING",
    icon: TrendingDown,
    color: "text-blue-400",
    activeBg: "bg-blue-500/20 text-blue-300 border-blue-500/40",
    border: "border-blue-500/20",
  },
  {
    label: "Demerger Value Unlock",
    type: "DEMERGER_UNLOCK",
    icon: Shuffle,
    color: "text-purple-400",
    activeBg: "bg-purple-500/20 text-purple-300 border-purple-500/40",
    border: "border-purple-500/20",
  },
];

const IMPACT_COLORS: Record<string, { badge: string; text: string; bg: string }> = {
  CRITICAL: {
    badge: "border-red-500/40 bg-red-500/10 text-red-400",
    text: "text-red-400",
    bg: "bg-red-500/5",
  },
  HIGH: {
    badge: "border-amber-500/40 bg-amber-500/10 text-amber-400",
    text: "text-amber-400",
    bg: "bg-amber-500/5",
  },
  MEDIUM: {
    badge: "border-cyan-500/40 bg-cyan-500/10 text-cyan-400",
    text: "text-cyan-400",
    bg: "bg-cyan-500/5",
  },
  NOISE: {
    badge: "border-slate-700 bg-slate-800 text-slate-400",
    text: "text-slate-400",
    bg: "bg-slate-900/20",
  },
};

interface MultiSelectOption {
  value: string;
  label: string;
  shortLabel?: string;
  icon?: LucideIcon;
  color?: string;
  count?: number;
}

interface MultiSelectDropdownProps {
  id: string;
  title: string;
  icon: LucideIcon;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (newSelected: string[]) => void;


  accentColor?: "cyan" | "emerald" | "amber" | "purple" | "blue";
  placeholder?: string;
}

function MultiSelectDropdown({
  id,
  title,
  icon: Icon,
  options,
  selected,
  onChange,
  accentColor = "cyan",
  placeholder,
}: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const toggleOption = (val: string) => {
    if (selected.includes(val)) {
      onChange(selected.filter((x) => x !== val));
    } else {
      onChange([...selected, val]);
    }
  };

  const handleSelectAll = () => {
    onChange(options.map((o) => o.value));
  };

  const handleClear = () => {
    onChange([]);
  };

  const hasSelection = selected.length > 0;
  const isAllSelected = selected.length === options.length && options.length > 0;

  // Compute trigger label
  let triggerText = placeholder || `All ${title}`;
  if (selected.length === 1) {
    const matched = options.find((o) => o.value === selected[0]);
    if (matched) triggerText = matched.shortLabel || matched.label;
  } else if (selected.length > 1) {
    triggerText = `${title} (${selected.length})`;
  }

  const accentClasses = {
    cyan: "border-cyan-500/50 bg-cyan-500/15 text-cyan-300 shadow-sm shadow-cyan-950/40",
    emerald: "border-emerald-500/50 bg-emerald-500/15 text-emerald-300 shadow-sm shadow-emerald-950/40",
    amber: "border-amber-500/50 bg-amber-500/15 text-amber-300 shadow-sm shadow-amber-950/40",
    purple: "border-purple-500/50 bg-purple-500/15 text-purple-300 shadow-sm shadow-purple-950/40",
    blue: "border-blue-500/50 bg-blue-500/15 text-blue-300 shadow-sm shadow-blue-950/40",
  }[accentColor];

  const checkColorClasses = {
    cyan: "border-cyan-500 bg-cyan-500 text-black",
    emerald: "border-emerald-500 bg-emerald-500 text-black",
    amber: "border-amber-500 bg-amber-500 text-black",
    purple: "border-purple-500 bg-purple-500 text-white",
    blue: "border-blue-500 bg-blue-500 text-white",
  }[accentColor];

  return (
    <div ref={dropdownRef} className="relative">
      <button
        id={id}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
          hasSelection
            ? accentClasses
            : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-600 hover:text-white"
        }`}
      >
        <Icon size={13} className={hasSelection ? "text-current" : "text-slate-400"} />
        <span className="truncate max-w-[130px]">{triggerText}</span>
        {hasSelection && (
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/20 text-[10px] font-mono font-bold">
            {selected.length}
          </span>
        )}
        <ChevronDown size={12} className={`text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
        {hasSelection && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            className="ml-0.5 rounded-full p-0.5 text-slate-400 hover:bg-white/20 hover:text-white"
            title="Clear selection"
          >
            <X size={11} />
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-2 w-72 rounded-2xl border border-slate-700 bg-[#0B1527] p-2.5 shadow-2xl backdrop-blur-xl z-50">
          {/* Header */}
          <div className="mb-2 flex items-center justify-between px-1.5 pb-2 border-b border-slate-800">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              {title} <span className="text-slate-500 font-normal">({selected.length}/{options.length})</span>
            </span>
            <div className="flex items-center gap-2 text-[11px]">
              {!isAllSelected && (
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  All
                </button>
              )}
              {hasSelection && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="font-medium text-slate-400 hover:text-rose-400 transition-colors"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Options List */}
          <div className="flex flex-col gap-1 max-h-64 overflow-y-auto pr-1">
            {options.map((opt) => {
              const isChecked = selected.includes(opt.value);
              const OptIcon = opt.icon;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleOption(opt.value)}
                  className={`flex items-center justify-between gap-2 rounded-xl p-2 text-left text-xs transition-colors ${
                    isChecked
                      ? "bg-slate-800/90 text-white font-medium"
                      : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border transition-colors ${
                        isChecked
                          ? checkColorClasses
                          : "border-slate-600 bg-slate-900"
                      }`}
                    >
                      {isChecked && <Check size={11} strokeWidth={3} />}
                    </div>
                    {OptIcon && <OptIcon size={13} className={opt.color || "text-slate-400"} />}
                    <span className="truncate">{opt.label}</span>
                  </div>
                  {opt.count !== undefined && (
                    <span className="flex-shrink-0 rounded-full bg-slate-800 px-1.5 py-0.2 font-mono text-[10px] text-slate-400">
                      {opt.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

interface DateFilterDropdownProps {
  id?: string;
  announcementDateFrom: string;
  announcementDateTo: string;
  recommendationDateFrom: string;
  recommendationDateTo: string;
  onChange: (dates: {
    announcementDateFrom: string;
    announcementDateTo: string;
    recommendationDateFrom: string;
    recommendationDateTo: string;
  }) => void;
}

function DateFilterDropdown({
  id = "filter-dates",
  announcementDateFrom,
  announcementDateTo,
  recommendationDateFrom,
  recommendationDateTo,
  onChange,
}: DateFilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const [localAnnFrom, setLocalAnnFrom] = useState(announcementDateFrom);
  const [localAnnTo, setLocalAnnTo] = useState(announcementDateTo);
  const [localRecFrom, setLocalRecFrom] = useState(recommendationDateFrom);
  const [localRecTo, setLocalRecTo] = useState(recommendationDateTo);

  useEffect(() => {
    setLocalAnnFrom(announcementDateFrom);
    setLocalAnnTo(announcementDateTo);
    setLocalRecFrom(recommendationDateFrom);
    setLocalRecTo(recommendationDateTo);
  }, [announcementDateFrom, announcementDateTo, recommendationDateFrom, recommendationDateTo]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const hasSelection = Boolean(
    announcementDateFrom || announcementDateTo || recommendationDateFrom || recommendationDateTo
  );

  const handleClear = () => {
    setLocalAnnFrom("");
    setLocalAnnTo("");
    setLocalRecFrom("");
    setLocalRecTo("");
    onChange({
      announcementDateFrom: "",
      announcementDateTo: "",
      recommendationDateFrom: "",
      recommendationDateTo: "",
    });
  };

  const handleApply = () => {
    onChange({
      announcementDateFrom: localAnnFrom,
      announcementDateTo: localAnnTo,
      recommendationDateFrom: localRecFrom,
      recommendationDateTo: localRecTo,
    });
    setIsOpen(false);
  };

  const setPreset = (days: number | "today" | "all") => {
    if (days === "all") {
      handleClear();
      setIsOpen(false);
      return;
    }
    const todayStr = new Date().toISOString().split("T")[0];
    if (days === "today") {
      setLocalAnnFrom(todayStr);
      setLocalAnnTo(todayStr);
      onChange({
        announcementDateFrom: todayStr,
        announcementDateTo: todayStr,
        recommendationDateFrom: localRecFrom,
        recommendationDateTo: localRecTo,
      });
      setIsOpen(false);
      return;
    }
    const d = new Date();
    d.setDate(d.getDate() - days);
    const fromStr = d.toISOString().split("T")[0];
    setLocalAnnFrom(fromStr);
    setLocalAnnTo(todayStr);
    onChange({
      announcementDateFrom: fromStr,
      announcementDateTo: todayStr,
      recommendationDateFrom: localRecFrom,
      recommendationDateTo: localRecTo,
    });
    setIsOpen(false);
  };

  let triggerLabel = "All Dates";
  if (announcementDateFrom || announcementDateTo) {
    if (announcementDateFrom && announcementDateTo && announcementDateFrom === announcementDateTo) {
      triggerLabel = `Ann: ${announcementDateFrom.slice(5)}`;
    } else if (announcementDateFrom && announcementDateTo) {
      triggerLabel = `Ann: ${announcementDateFrom.slice(5)} → ${announcementDateTo.slice(5)}`;
    } else if (announcementDateFrom) {
      triggerLabel = `Ann ≥ ${announcementDateFrom.slice(5)}`;
    } else {
      triggerLabel = `Ann ≤ ${announcementDateTo.slice(5)}`;
    }
  } else if (recommendationDateFrom || recommendationDateTo) {
    triggerLabel = "Rec Dates Set";
  }

  return (
    <div ref={containerRef} className="relative" id={id}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
          hasSelection
            ? "border-cyan-500/50 bg-cyan-500/20 text-cyan-300 shadow-sm"
            : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-600 hover:text-white"
        }`}
      >
        <Calendar size={13} className={hasSelection ? "text-cyan-400" : "text-slate-400"} />
        <span className="truncate max-w-[140px]">{triggerLabel}</span>
        {hasSelection && (
          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-cyan-400/20 text-[10px] font-mono font-bold text-cyan-300">
            ✓
          </span>
        )}
        <ChevronDown size={12} className={`text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
        {hasSelection && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            className="ml-0.5 rounded-full p-0.5 text-slate-400 hover:bg-white/20 hover:text-white"
            title="Clear date filters"
          >
            <X size={11} />
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-2 w-80 rounded-2xl border border-slate-700 bg-[#0B1527] p-3 shadow-2xl backdrop-blur-xl z-50">
          {/* Header */}
          <div className="mb-2.5 flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Filter by Dates
            </span>
            {hasSelection && (
              <button
                type="button"
                onClick={handleClear}
                className="text-[11px] font-medium text-slate-400 hover:text-rose-400 transition-colors"
              >
                Reset
              </button>
            )}
          </div>

          {/* Quick Presets */}
          <div className="mb-3">
            <span className="text-[10px] font-bold uppercase text-slate-500 mb-1.5 block">Quick Filing Presets</span>
            <div className="grid grid-cols-4 gap-1">
              <button
                type="button"
                onClick={() => setPreset("today")}
                className="rounded-lg border border-slate-700 bg-slate-900/80 px-2 py-1 text-[10px] font-semibold text-slate-300 hover:border-cyan-500/40 hover:text-cyan-400"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setPreset(7)}
                className="rounded-lg border border-slate-700 bg-slate-900/80 px-2 py-1 text-[10px] font-semibold text-slate-300 hover:border-cyan-500/40 hover:text-cyan-400"
              >
                Last 7D
              </button>
              <button
                type="button"
                onClick={() => setPreset(30)}
                className="rounded-lg border border-slate-700 bg-slate-900/80 px-2 py-1 text-[10px] font-semibold text-slate-300 hover:border-cyan-500/40 hover:text-cyan-400"
              >
                Last 30D
              </button>
              <button
                type="button"
                onClick={() => setPreset("all")}
                className="rounded-lg border border-slate-700 bg-slate-900/80 px-2 py-1 text-[10px] font-semibold text-slate-300 hover:border-cyan-500/40 hover:text-cyan-400"
              >
                All
              </button>
            </div>
          </div>

          {/* Announcement Date Range */}
          <div className="mb-3 rounded-xl border border-slate-800 bg-slate-900/50 p-2.5">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-cyan-400 mb-2">
              <Clock size={11} />
              <span>Announcement Date</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] uppercase text-slate-500 block mb-0.5">From</label>
                <input
                  type="date"
                  value={localAnnFrom}
                  onChange={(e) => setLocalAnnFrom(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-200 focus:border-cyan-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[9px] uppercase text-slate-500 block mb-0.5">To</label>
                <input
                  type="date"
                  value={localAnnTo}
                  onChange={(e) => setLocalAnnTo(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-200 focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Recommendation Date Range */}
          <div className="mb-3 rounded-xl border border-slate-800 bg-slate-900/50 p-2.5">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-emerald-400 mb-2">
              <Target size={11} />
              <span>Recommendation Date</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9px] uppercase text-slate-500 block mb-0.5">From</label>
                <input
                  type="date"
                  value={localRecFrom}
                  onChange={(e) => setLocalRecFrom(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-200 focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[9px] uppercase text-slate-500 block mb-0.5">To</label>
                <input
                  type="date"
                  value={localRecTo}
                  onChange={(e) => setLocalRecTo(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-200 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-lg px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="rounded-lg bg-cyan-500 px-3 py-1 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition-colors shadow-sm"
            >
              Apply Filter
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const VERTICAL_OPTIONS: MultiSelectOption[] = [
  { value: "EARNINGS_ACCELERATION", label: "Earnings Shock (PEAD)", shortLabel: "Earnings PEAD", icon: Zap, color: "text-emerald-400" },
  { value: "BASE_BREAKOUT", label: "Wyckoff Base Breakout", shortLabel: "Base Breakout", icon: TrendingUp, color: "text-cyan-400" },
  { value: "INSTITUTIONAL_CONSENSUS", label: "Institutional AMC Consensus", shortLabel: "AMC Consensus", icon: ShieldCheck, color: "text-blue-400" },
  { value: "OPERATING_LEVERAGE", label: "Operating Leverage", shortLabel: "Op. Leverage", icon: Percent, color: "text-amber-400" },
  { value: "TURNAROUND_INFLECTION", label: "Turnaround Inflection", shortLabel: "Turnaround", icon: Shuffle, color: "text-purple-400" },
  { value: "EXCHANGE_CATALYST", label: "Exchange Filings (Capex/Orders)", shortLabel: "Exchange Catalysts", icon: FileText, color: "text-rose-400" },
];

const RECOMMENDATION_OPTIONS: MultiSelectOption[] = [
  { value: "STRONG_BUY", label: "Strong Buy (>25% Upside)", shortLabel: "Strong Buy", icon: Target, color: "text-emerald-400" },
  { value: "TACTICAL_BUY", label: "Tactical Buy", shortLabel: "Tactical Buy", icon: Crosshair, color: "text-cyan-400" },
  { value: "ACCUMULATE", label: "Accumulate", shortLabel: "Accumulate", icon: Flame, color: "text-amber-400" },
  { value: "WATCHLIST_ONLY", label: "Watchlist Only", shortLabel: "Watchlist Only", icon: Clock, color: "text-slate-400" },
];

const ABSORPTION_OPTIONS: MultiSelectOption[] = [
  { value: "FRESH_TRIGGER", label: "🟢 Fresh Trigger (<6% Move)", shortLabel: "🟢 Fresh (<6%)", color: "text-emerald-400" },
  { value: "IN_EXPANSION", label: "🟡 In Momentum (+6% to +20%)", shortLabel: "🟡 Momentum", color: "text-amber-400" },
  { value: "PRICED_IN", label: "🔴 Priced In (>20% Caution)", shortLabel: "🔴 Priced In", color: "text-red-400" },
];

const VELOCITY_OPTIONS: MultiSelectOption[] = [
  { value: "FAST_UNDER_30D", label: "⚡ Fast (< 30 Days)", shortLabel: "⚡ <30D Fast", icon: Zap, color: "text-amber-400" },
  { value: "SWING_30_60D", label: "⏱️ Swing (30–60 Days)", shortLabel: "⏱️ 30–60D Swing", icon: Clock, color: "text-cyan-400" },
  { value: "CYCLE_60_120D", label: "📈 Medium Cycle (60–120 Days)", shortLabel: "📈 60–120D Cycle", icon: TrendingUp, color: "text-blue-400" },
  { value: "10-25", label: "10–25 Days (Breakouts)", shortLabel: "10–25D", icon: Zap, color: "text-emerald-400" },
  { value: "15-35", label: "15–35 Days (PEAD Drift)", shortLabel: "15–35D", icon: Sparkles, color: "text-amber-300" },
  { value: "20-50", label: "20–50 Days (Margin Surge)", shortLabel: "20–50D", icon: TrendingUp, color: "text-cyan-300" },
  { value: "30-65", label: "30–65 Days (AMC Consensus)", shortLabel: "30–65D", icon: ShieldCheck, color: "text-blue-300" },
  { value: "40-75", label: "40–75 Days (Orders Milestone)", shortLabel: "40–75D", icon: FileText, color: "text-purple-300" },
  { value: "60-120", label: "60–120 Days (Demergers/Capex)", shortLabel: "60–120D", icon: Layers, color: "text-indigo-300" },
];

// -------------------------------------------------------
// Main Page Component
// -------------------------------------------------------

export default function AnnouncementsRadarPage() {
  const [items, setItems] = useState<AnnouncementRadarItem[]>([]);
  const [stats, setStats] = useState<AnnouncementStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Drawer state
  const [selectedDrawerItem, setSelectedDrawerItem] = useState<AnnouncementRadarItem | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  // Filters
  const [selectedVerticals, setSelectedVerticals] = useState<string[]>([]);
  const [selectedRecommendations, setSelectedRecommendations] = useState<string[]>([]);
  const [selectedHorizons, setSelectedHorizons] = useState<string[]>([]);
  const [selectedVelocities, setSelectedVelocities] = useState<string[]>([]);
  const [feedSource, setFeedSource] = useState<"ALL" | "POLL_WIRE" | "CATALYST">("ALL");
  const [activeCatalyst, setActiveCatalyst] = useState<string>("");
  const [impactFilter, setImpactFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [listedOnly, setListedOnly] = useState(false);
  const [announcementDateFrom, setAnnouncementDateFrom] = useState<string>("");
  const [announcementDateTo, setAnnouncementDateTo] = useState<string>("");
  const [recommendationDateFrom, setRecommendationDateFrom] = useState<string>("");
  const [recommendationDateTo, setRecommendationDateTo] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("announcement_date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(30);
  const [viewMode, setViewMode] = useState<"list" | "cards">("list");
  const [liveWire, setLiveWire] = useState<LiveWireTelemetry | null>(null);
  const [wirePolling, setWirePolling] = useState(false);

  // ─── Table Column Sorting Handler ─────────────────────
  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      if (column === "company_name" || column === "symbol" || column === "vertical_archetype") {
        setSortOrder("asc");
      } else {
        setSortOrder("desc");
      }
    }
    setPage(1);
  };

  const renderSortHeader = (title: string, columnKey: string, align: "left" | "right" | "center" = "left", sticky: boolean = false) => {
    const isActive = sortBy === columnKey;
    return (
      <th
        onClick={() => handleSort(columnKey)}
        className={`py-3 px-3 cursor-pointer select-none transition-colors hover:text-cyan-300 hover:bg-slate-800/60 ${
          align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"
        } ${sticky ? "sticky left-0 bg-slate-900/95 z-20 shadow-[3px_0_8px_rgba(0,0,0,0.6)]" : ""} ${
          isActive ? "text-cyan-400 font-bold" : "text-slate-400"
        }`}
      >
        <div className={`inline-flex items-center gap-1.5 ${align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start"}`}>
          <span>{title}</span>
          {isActive ? (
            sortOrder === "asc" ? (
              <ArrowUp size={12} className="text-cyan-400 shrink-0" />
            ) : (
              <ArrowDown size={12} className="text-cyan-400 shrink-0" />
            )
          ) : (
            <ArrowUpDown size={11} className="text-slate-600 opacity-50 hover:opacity-100 shrink-0" />
          )}
        </div>
      </th>
    );
  };

  // ─── Toast Helper ────────────────────────────────────
  const showToast = useCallback((msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  // ─── Data Loader ─────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [announcementsData, statsData, wireStatus] = await Promise.all([
        fetchAnnouncements({
          page,
          limit: pageSize,
          feed_source: feedSource !== "ALL" ? feedSource : undefined,
          catalyst_type: activeCatalyst || undefined,
          vertical_archetype: selectedVerticals.length > 0 ? selectedVerticals : undefined,
          absorption_status: selectedHorizons.length > 0 ? selectedHorizons : undefined,
          velocity: selectedVelocities.length > 0 ? selectedVelocities : undefined,
          impact_level: impactFilter || undefined,
          recommendation: selectedRecommendations.length > 0 ? selectedRecommendations : undefined,
          search: search || undefined,
          listed_only: listedOnly || undefined,
          announcement_date_from: announcementDateFrom || undefined,
          announcement_date_to: announcementDateTo || undefined,
          recommendation_date_from: recommendationDateFrom || undefined,
          recommendation_date_to: recommendationDateTo || undefined,
          sort_by: sortBy,
          sort_order: sortOrder,
        }),
        fetchAnnouncementStats(),
        fetchLiveWireStatus().catch(() => null),
      ]);
      setItems(announcementsData);
      setStats(statsData);
      if (wireStatus) setLiveWire(wireStatus);
    } catch {
      showToast("Failed to load announcements radar", "err");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, feedSource, activeCatalyst, selectedVerticals, selectedHorizons, selectedRecommendations, selectedVelocities, impactFilter, search, listedOnly, announcementDateFrom, announcementDateTo, recommendationDateFrom, recommendationDateTo, sortBy, sortOrder, showToast]);

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      fetchLiveWireStatus().then(setLiveWire).catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, [loadData]);

  // ─── Live Wire Batch Poll ────────────────────────────
  const handleTriggerWirePoll = async () => {
    setWirePolling(true);
    try {
      const res = await triggerLiveWirePoll();
      setLiveWire(res.telemetry);
      showToast(`Scanned ${res.result?.scanned ?? 0} filings, found ${res.result?.catalysts ?? 0} new catalysts!`);
      loadData();
    } catch {
      showToast("Live wire poll failed", "err");
    } finally {
      setWirePolling(false);
    }
  };

  // ─── Manual Ingestion Trigger ────────────────────────
  const handleTriggerSync = async () => {
    setSyncing(true);
    try {
      const res = await triggerAnnouncementsSync();
      showToast(res.message || "Announcements ingestion triggered");
      setTimeout(() => loadData(), 2000);
    } catch {
      showToast("Failed to trigger sync", "err");
    } finally {
      setSyncing(false);
    }
  };

  // ─── Watchlist & Alert Actions ───────────────────────
  const handleAddToWatchlist = async (item: AnnouncementRadarItem) => {
    setActionInProgress("watchlist");
    try {
      const res = await addCatalystToWatchlist(item.id);
      showToast(res.message);
    } catch {
      showToast("Failed to add to watchlist", "err");
    } finally {
      setActionInProgress(null);
    }
  };

  const handleSendTelegram = async (item: AnnouncementRadarItem) => {
    setActionInProgress("telegram");
    try {
      const res = await sendTelegramAlert(item.id);
      showToast(res.message);
    } catch {
      showToast("Failed to send Telegram alert", "err");
    } finally {
      setActionInProgress(null);
    }
  };

  const verticalOptions: MultiSelectOption[] = VERTICAL_OPTIONS.map((opt) => ({
    ...opt,
    count: stats?.by_vertical?.[opt.value] ?? 0,
  }));

  const recommendationOptions: MultiSelectOption[] = RECOMMENDATION_OPTIONS.map((opt) => ({
    ...opt,
    count: stats?.by_recommendation?.[opt.value] ?? 0,
  }));

  const horizonOptions: MultiSelectOption[] = ABSORPTION_OPTIONS.map((opt) => ({
    ...opt,
    count: stats?.by_absorption?.[opt.value] ?? 0,
  }));

  const velocityOptions: MultiSelectOption[] = VELOCITY_OPTIONS.map((opt) => ({
    ...opt,
    count: stats?.by_velocity?.[opt.value] ?? 0,
  }));

  const hasAnyFilterActive =
    feedSource !== "ALL" ||
    selectedVerticals.length > 0 ||
    selectedRecommendations.length > 0 ||
    selectedHorizons.length > 0 ||
    selectedVelocities.length > 0 ||
    activeCatalyst !== "" ||
    impactFilter !== "" ||
    search !== "" ||
    listedOnly ||
    Boolean(announcementDateFrom || announcementDateTo || recommendationDateFrom || recommendationDateTo);

  const handleResetAllFilters = () => {
    setFeedSource("ALL");
    setSelectedVerticals([]);
    setSelectedRecommendations([]);
    setSelectedHorizons([]);
    setSelectedVelocities([]);
    setActiveCatalyst("");
    setImpactFilter("");
    setSearch("");
    setListedOnly(false);
    setAnnouncementDateFrom("");
    setAnnouncementDateTo("");
    setRecommendationDateFrom("");
    setRecommendationDateTo("");
    setPage(1);
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 p-6">

        {/* ── Top Header ──────────────────────────────────── */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-950/40">
              <Radio size={24} className="text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold tracking-tight text-white">
                  Announcements & Catalyst Radar
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Live Data Pulse
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-400">
                AI-curated growth inflection points from Screener.in & BSE/NSE filings · 80% noise filtered
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-poll-live-wire"
              onClick={handleTriggerWirePoll}
              disabled={wirePolling}
              className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs font-semibold text-emerald-400 transition-all hover:bg-emerald-500/20 disabled:opacity-50"
            >
              {wirePolling ? <Loader2 size={14} className="animate-spin" /> : <Radio size={14} />}
              {wirePolling ? "Polling BSE/NSE…" : "Poll Wire Now"}
            </button>
            <button
              id="btn-sync-announcements"
              onClick={handleTriggerSync}
              disabled={syncing}
              className="flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2.5 text-xs font-semibold text-cyan-400 transition-all hover:bg-cyan-500/20 disabled:opacity-50"
            >
              {syncing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {syncing ? "Extracting…" : "Run Catalyst AI"}
            </button>
            <button
              id="btn-refresh-announcements"
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-xs font-semibold text-slate-300 transition-all hover:border-slate-600 hover:text-white disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>

        {/* ── 📡 Live Wire Real-Time Telemetry Bar ──────────────── */}
        {liveWire && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/20 bg-emerald-950/20 px-4 py-2.5 text-xs text-slate-300">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 font-bold text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                Live Exchange Wire: {liveWire.is_running ? "RUNNING (60s loop)" : "IDLE"}
              </span>
              <span className="text-slate-500">|</span>
              <span className="text-slate-400">
                Filings Scanned: <span className="font-semibold text-white">{liveWire.total_filings_scanned}</span>
              </span>
              <span className="text-slate-500">|</span>
              <span className="text-slate-400">
                Catalysts Extracted: <span className="font-semibold text-emerald-400">{liveWire.catalysts_discovered}</span>
              </span>
              <span className="text-slate-500">|</span>
              <span className="text-slate-400">
                Warehouse Cursor: <span className="font-mono text-cyan-400">#{liveWire.current_cursor_offset} / 2,084</span>
              </span>
            </div>
            {liveWire.last_poll_time && (
              <span className="text-[11px] text-slate-400">
                Last Poll: <span className="text-slate-300">{new Date(liveWire.last_poll_time).toLocaleTimeString()}</span>
              </span>
            )}
          </div>
        )}

        {/* ── Intelligence Feed Stream Selector (All vs Poll Wire vs Catalyst Results) ── */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-[#0A1628]/90 p-2.5 shadow-xl backdrop-blur-md">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mr-1 px-1">
              Feed Stream:
            </span>
            <button
              id="btn-feed-all"
              type="button"
              onClick={() => {
                setFeedSource("ALL");
                setPage(1);
              }}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                feedSource === "ALL"
                  ? "bg-slate-800 text-white shadow-md border border-slate-600"
                  : "border border-transparent text-slate-400 hover:text-white hover:bg-slate-800/50"
              }`}
            >
              <Layers size={13} className={feedSource === "ALL" ? "text-cyan-400" : "text-slate-400"} />
              <span>All Intelligence</span>
              <span className="rounded-full bg-slate-900 px-1.5 py-0.2 text-[10px] font-mono text-slate-300">
                {stats?.by_feed_source?.ALL ?? stats?.total ?? 0}
              </span>
            </button>

            <button
              id="btn-feed-poll-wire"
              type="button"
              onClick={() => {
                setFeedSource("POLL_WIRE");
                setPage(1);
              }}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                feedSource === "POLL_WIRE"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-md shadow-emerald-950/40"
                  : "border border-transparent text-slate-400 hover:text-emerald-300 hover:bg-emerald-500/10"
              }`}
            >
              <Radio size={13} className={feedSource === "POLL_WIRE" ? "animate-pulse text-emerald-400" : "text-emerald-400"} />
              <span>Live Poll Wire</span>
              <span className="rounded-full bg-emerald-950/80 border border-emerald-500/30 px-1.5 py-0.2 text-[10px] font-mono text-emerald-400 font-semibold">
                {stats?.by_feed_source?.POLL_WIRE ?? 86}
              </span>
            </button>

            <button
              id="btn-feed-catalysts"
              type="button"
              onClick={() => {
                setFeedSource("CATALYST");
                setPage(1);
              }}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all ${
                feedSource === "CATALYST"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-md shadow-cyan-950/40"
                  : "border border-transparent text-slate-400 hover:text-cyan-300 hover:bg-cyan-500/10"
              }`}
            >
              <Sparkles size={13} className="text-cyan-400" />
              <span>Catalyst AI Results</span>
              <span className="rounded-full bg-cyan-950/80 border border-cyan-500/30 px-1.5 py-0.2 text-[10px] font-mono text-cyan-400 font-semibold">
                {stats?.by_feed_source?.CATALYST ?? 61}
              </span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-400 px-2">
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span className="text-slate-300">Poll Wire: Direct BSE/NSE Filings</span>
            </span>
            <span className="text-slate-600">|</span>
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
              <span className="text-slate-300">Catalyst: Growth Archetypes</span>
            </span>
          </div>
        </div>

        {/* ── Quick Catalyst Filter Pills (1 sleek category row) ──────────── */}
        <div className="flex flex-wrap items-center gap-2">
          {CATALYST_PILLS.map((pill) => {
            const Icon = pill.icon;
            const isSelected = activeCatalyst === pill.type;
            const count = pill.type === ""
              ? stats?.total ?? 0
              : stats?.by_catalyst[pill.type] ?? 0;

            return (
              <button
                key={pill.label}
                onClick={() => {
                  setActiveCatalyst(pill.type);
                  setPage(1);
                }}
                className={`flex items-center gap-2 rounded-xl border px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  isSelected
                    ? pill.activeBg + " shadow-md"
                    : "border-slate-800 bg-[#0A1628] text-slate-400 hover:border-slate-700 hover:text-slate-200"
                }`}
              >
                <Icon size={14} className={isSelected ? "text-current" : pill.color} />
                <span>{pill.label}</span>
                <span className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${
                  isSelected ? "bg-white/20 text-white" : "bg-slate-800 text-slate-400"
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* ── Unified High-Density Filter Toolbar ──────────────────── */}
        <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-slate-800 bg-[#0A1628] p-2.5">
          {/* Search */}
          <TerminalSearch
            value={search}
            onChange={(val) => {
              setSearch(val);
              setPage(1);
            }}
            placeholder="Search ticker, company, catalyst headline..."
            className="flex-1 min-w-44"
          />

          {/* 1. Institutional Verticals Multiselect Dropdown */}
          <MultiSelectDropdown
            id="filter-verticals"
            title="Verticals"
            placeholder="All Verticals"
            icon={Sparkles}
            options={verticalOptions}
            selected={selectedVerticals}
            onChange={(vals) => {
              setSelectedVerticals(vals);
              setPage(1);
            }}
            accentColor="cyan"
          />

          {/* 2. Buy Conviction Multiselect Dropdown */}
          <MultiSelectDropdown
            id="filter-conviction"
            title="Conviction"
            placeholder="All Conviction"
            icon={Target}
            options={recommendationOptions}
            selected={selectedRecommendations}
            onChange={(vals) => {
              setSelectedRecommendations(vals);
              setPage(1);
            }}
            accentColor="emerald"
          />

          {/* 3. Catalyst Horizon Multiselect Dropdown */}
          <MultiSelectDropdown
            id="filter-horizon"
            title="Horizon"
            placeholder="All Horizons"
            icon={Clock}
            options={horizonOptions}
            selected={selectedHorizons}
            onChange={(vals) => {
              setSelectedHorizons(vals);
              setPage(1);
            }}
            accentColor="amber"
          />

          {/* 4. Velocity Multiselect Dropdown */}
          <MultiSelectDropdown
            id="filter-velocity"
            title="Velocity"
            placeholder="All Velocities"
            icon={Gauge}
            options={velocityOptions}
            selected={selectedVelocities}
            onChange={(vals) => {
              setSelectedVelocities(vals);
              setPage(1);
            }}
            accentColor="purple"
          />

          {/* 5. Date Filter Dropdown */}
          <DateFilterDropdown
            id="filter-dates"
            announcementDateFrom={announcementDateFrom}
            announcementDateTo={announcementDateTo}
            recommendationDateFrom={recommendationDateFrom}
            recommendationDateTo={recommendationDateTo}
            onChange={({ announcementDateFrom: af, announcementDateTo: at, recommendationDateFrom: rf, recommendationDateTo: rt }) => {
              setAnnouncementDateFrom(af);
              setAnnouncementDateTo(at);
              setRecommendationDateFrom(rf);
              setRecommendationDateTo(rt);
              setPage(1);
            }}
          />

          {/* Impact Level Dropdown */}
          <select
            id="filter-impact-level"
            value={impactFilter}
            onChange={(e) => {
              setImpactFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-300 focus:border-cyan-500/50 focus:outline-none"
          >
            <option value="">All Impact Tiers</option>
            <option value="CRITICAL">🔥 Critical (&gt;= 8.5)</option>
            <option value="HIGH">⚡ High (&gt;= 7.5)</option>
            <option value="MEDIUM">ℹ️ Medium</option>
          </select>

          {/* Feed Stream Dropdown */}
          <select
            id="filter-feed-source-select"
            value={feedSource}
            onChange={(e) => {
              setFeedSource(e.target.value as "ALL" | "POLL_WIRE" | "CATALYST");
              setPage(1);
            }}
            className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-300 focus:border-cyan-500/50 focus:outline-none"
          >

            <option value="ALL">🌐 All Sources ({stats?.by_feed_source?.ALL ?? stats?.total ?? 0})</option>
            <option value="POLL_WIRE">📡 Live Poll Wire ({stats?.by_feed_source?.POLL_WIRE ?? 86})</option>
            <option value="CATALYST">⚡ Catalyst AI ({stats?.by_feed_source?.CATALYST ?? 61})</option>
          </select>

          {/* Listed Only Toggle */}
          <button
            id="filter-listed-toggle"
            type="button"
            onClick={() => {
              setListedOnly((v) => !v);
              setPage(1);
            }}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
              listedOnly
                ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-300 shadow-sm"
                : "border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${listedOnly ? "bg-emerald-400 animate-pulse" : "bg-slate-600"}`} />
            Listed Only
          </button>

          {/* Sort By */}
          <div className="flex items-center gap-1.5">
            <select
              id="select-sort-by"
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-300 focus:border-cyan-500/50 focus:outline-none"
            >
              <option value="announcement_date">📅 Announcement Date</option>
              <option value="recommendation_date">🎯 Recommendation Date</option>
              <option value="est_velocity_days">⚡ Velocity Horizon</option>
              <option value="upside_pct">🚀 Upside Potential (%)</option>
              <option value="conviction_score">🏆 Conviction Score</option>
              <option value="realized_move_pct">⚡ Realized Move (%)</option>
              <option value="impact_score">Impact Score</option>
              <option value="current_price">CMP (₹)</option>
              <option value="deal_value_cr">Deal Value (₹ Cr)</option>
              <option value="company_name">Company Name (A-Z)</option>
            </select>

            {/* Sort Order Button */}
            <button
              type="button"
              onClick={() => setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))}
              className="flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-900 px-2 py-2 text-xs font-semibold text-slate-300 hover:border-slate-600 hover:text-white transition-all"
              title={`Toggle sort order (Current: ${sortOrder.toUpperCase()})`}
            >
              {sortOrder === "asc" ? <ArrowUp size={13} className="text-cyan-400" /> : <ArrowDown size={13} className="text-cyan-400" />}
              <span className="text-[10px] font-mono">{sortOrder.toUpperCase()}</span>
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center rounded-xl border border-slate-700 bg-slate-900 p-0.5">
            <button
              id="btn-view-list"
              type="button"
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${
                viewMode === "list"
                  ? "bg-cyan-500/20 text-cyan-300 shadow-sm border border-cyan-500/40"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="Compact List View (Maximum entries per screen)"
            >
              <List size={13} />
              <span>List</span>
            </button>
            <button
              id="btn-view-cards"
              type="button"
              onClick={() => setViewMode("cards")}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all ${
                viewMode === "cards"
                  ? "bg-cyan-500/20 text-cyan-300 shadow-sm border border-cyan-500/40"
                  : "text-slate-400 hover:text-slate-200"
              }`}
              title="Expanded Cards View"
            >
              <LayoutGrid size={13} />
              <span>Cards</span>
            </button>
          </div>

          {/* Reset All Filters Button */}
          {hasAnyFilterActive && (
            <button
              type="button"
              onClick={handleResetAllFilters}
              className="flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-2.5 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 transition-all shadow-sm"
              title="Reset all active filters"
            >
              <RotateCcw size={12} />
              <span>Reset</span>
            </button>
          )}

          <span className="ml-auto text-xs text-slate-500 pl-2">
            {items.length} item{items.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* ── Active Filter Chips (if any active) ──────────── */}
        {hasAnyFilterActive && (
          <div className="flex flex-wrap items-center gap-1.5 px-1 -mt-2">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mr-1 flex items-center gap-1">
              <Filter size={10} /> Active Filters:
            </span>

            {feedSource !== "ALL" && (
              <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                feedSource === "POLL_WIRE"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                  : "border-cyan-500/40 bg-cyan-500/10 text-cyan-300"
              }`}>
                {feedSource === "POLL_WIRE" ? <Radio size={10} className="text-emerald-400 animate-pulse" /> : <Sparkles size={10} className="text-cyan-400" />}
                <span>Stream: {feedSource === "POLL_WIRE" ? "Live Poll Wire" : "Catalyst AI"}</span>
                <button
                  type="button"
                  onClick={() => {
                    setFeedSource("ALL");
                    setPage(1);
                  }}
                  className="hover:text-white"
                >
                  <X size={10} />
                </button>
              </span>
            )}

            {selectedVerticals.map((v) => {
              const opt = VERTICAL_OPTIONS.find((o) => o.value === v);
              return (
                <span
                  key={v}
                  className="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-[11px] font-medium text-cyan-300"
                >
                  <span>{opt?.shortLabel || opt?.label || v}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedVerticals((prev) => prev.filter((x) => x !== v));
                      setPage(1);
                    }}
                    className="hover:text-white"
                  >
                    <X size={10} />
                  </button>
                </span>
              );
            })}

            {selectedRecommendations.map((r) => {
              const opt = RECOMMENDATION_OPTIONS.find((o) => o.value === r);
              return (
                <span
                  key={r}
                  className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300"
                >
                  <span>{opt?.shortLabel || opt?.label || r}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRecommendations((prev) => prev.filter((x) => x !== r));
                      setPage(1);
                    }}
                    className="hover:text-white"
                  >
                    <X size={10} />
                  </button>
                </span>
              );
            })}

            {selectedHorizons.map((h) => {
              const opt = ABSORPTION_OPTIONS.find((o) => o.value === h);
              return (
                <span
                  key={h}
                  className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-300"
                >
                  <span>{opt?.shortLabel || opt?.label || h}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedHorizons((prev) => prev.filter((x) => x !== h));
                      setPage(1);
                    }}
                    className="hover:text-white"
                  >
                    <X size={10} />
                  </button>
                </span>
              );
            })}

            {selectedVelocities.map((v) => {
              const opt = VELOCITY_OPTIONS.find((o) => o.value === v);
              return (
                <span
                  key={v}
                  className="inline-flex items-center gap-1 rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-0.5 text-[11px] font-medium text-purple-300"
                >
                  <Gauge size={10} />
                  <span>{opt?.shortLabel || opt?.label || v}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedVelocities((prev) => prev.filter((x) => x !== v));
                      setPage(1);
                    }}
                    className="hover:text-white"
                  >
                    <X size={10} />
                  </button>
                </span>
              );
            })}

            {(announcementDateFrom || announcementDateTo) && (
              <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-[11px] font-medium text-cyan-300">
                <Clock size={10} />
                <span>
                  Announcement: {announcementDateFrom || "Start"} to {announcementDateTo || "Now"}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setAnnouncementDateFrom("");
                    setAnnouncementDateTo("");
                    setPage(1);
                  }}
                  className="hover:text-white"
                >
                  <X size={10} />
                </button>
              </span>
            )}

            {(recommendationDateFrom || recommendationDateTo) && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300">
                <Target size={10} />
                <span>
                  Recommendation: {recommendationDateFrom || "Start"} to {recommendationDateTo || "Now"}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setRecommendationDateFrom("");
                    setRecommendationDateTo("");
                    setPage(1);
                  }}
                  className="hover:text-white"
                >
                  <X size={10} />
                </button>
              </span>
            )}

            {activeCatalyst && (
              <span className="inline-flex items-center gap-1 rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-0.5 text-[11px] font-medium text-purple-300">
                <span>{CATALYST_PILLS.find((c) => c.type === activeCatalyst)?.label || activeCatalyst}</span>
                <button
                  type="button"
                  onClick={() => {
                    setActiveCatalyst("");
                    setPage(1);
                  }}
                  className="hover:text-white"
                >
                  <X size={10} />
                </button>
              </span>
            )}

            {impactFilter && (
              <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-medium text-rose-300">
                <span>Impact: {impactFilter}</span>
                <button
                  type="button"
                  onClick={() => {
                    setImpactFilter("");
                    setPage(1);
                  }}
                  className="hover:text-white"
                >
                  <X size={10} />
                </button>
              </span>
            )}

            {search && (
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800 px-2.5 py-0.5 text-[11px] font-medium text-slate-300">
                <span>&quot;{search}&quot;</span>
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setPage(1);
                  }}
                  className="hover:text-white"
                >
                  <X size={10} />
                </button>
              </span>
            )}

            <button
              type="button"
              onClick={handleResetAllFilters}
              className="text-[10px] text-slate-400 hover:text-rose-400 underline ml-1"
            >
              Clear all
            </button>
          </div>
        )}

        {/* ── Announcement Cards Stream ───────────────────── */}
        <div className="flex flex-col gap-4">
          {loading && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800 bg-[#07111F] py-20">
              <Loader2 size={28} className="animate-spin text-cyan-500" />
              <p className="mt-3 text-xs text-slate-400">Scanning corporate filings & evaluating catalysts…</p>
            </div>
          )}

          {!loading && items.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-800 bg-[#07111F] py-20 text-center">
              <Radio size={36} className="text-slate-700" />
              <p className="mt-3 text-sm font-semibold text-slate-400">No catalyst announcements match your filters.</p>
              <p className="mt-1 text-xs text-slate-600">Try selecting &quot;All Catalysts&quot; or running a live discovery extraction.</p>
            </div>

          )}

          {/* ── Table / List View ─────────────────────────────── */}
          {!loading && items.length > 0 && viewMode === "list" && (
            <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-[#07111F] shadow-2xl">
              <table className="w-full text-left border-collapse min-w-[1300px]">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/90 text-[11px] font-bold uppercase tracking-wider text-slate-400 select-none">
                    {renderSortHeader("Company / Symbol", "company_name", "left", true)}
                    {renderSortHeader("Vertical / Catalyst", "vertical_archetype", "left")}
                    {renderSortHeader("Regime", "trend_regime", "left")}
                    {renderSortHeader("Trigger P₀ → CMP", "current_price", "right")}
                    {renderSortHeader("Move / Status", "realized_move_pct", "center")}
                    {renderSortHeader("Conviction", "conviction_score", "center")}
                    {renderSortHeader("Target & Upside", "upside_pct", "right")}
                    {renderSortHeader("Velocity", "est_velocity_days", "center")}
                    {renderSortHeader("Impact", "impact_score", "center")}
                    {renderSortHeader("Announcement Date", "announcement_date", "right")}
                    {renderSortHeader("Recommendation Date", "recommendation_date", "right")}
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {items.map((item) => {
                    const screenerUrl = `https://www.screener.in/company/${item.symbol ? item.symbol : encodeURIComponent(item.company_name)}/consolidated/#documents`;
                    const impactCfg = IMPACT_COLORS[item.impact_level] ?? IMPACT_COLORS.MEDIUM;
                    const p0 = item.price_at_announcement ?? item.current_price;
                    const cmp = item.current_price;
                    const movePct = item.realized_move_pct;

                    return (
                      <tr
                        key={item.id}
                        onClick={() => setSelectedDrawerItem(item)}
                        className="group transition-colors hover:bg-cyan-950/25 cursor-pointer"
                      >
                        {/* Company / Symbol */}
                        <td className="sticky left-0 bg-[#07111F] z-10 py-3 px-4 shadow-[3px_0_8px_rgba(0,0,0,0.6)]">
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-white group-hover:text-cyan-400 transition-colors">
                                {item.company_name}
                              </span>
                              {item.symbol && (
                                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-cyan-400">
                                  {item.symbol}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              {item.is_listed && (
                                <span className="text-[9px] font-mono font-medium text-emerald-400">
                                  NSE/BSE
                                </span>
                              )}
                              {item.category === "Live Exchange Filing" ? (
                                <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.2 text-[8px] font-semibold text-emerald-300">
                                  <Radio size={8} className="animate-pulse text-emerald-400" />
                                  Poll Wire
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded bg-cyan-500/15 border border-cyan-500/30 px-1.5 py-0.2 text-[8px] font-semibold text-cyan-300">
                                  <Sparkles size={8} className="text-cyan-400" />
                                  Catalyst AI
                                </span>
                              )}
                              <a
                                href={screenerUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-0.5 text-[9px] text-slate-400 hover:text-cyan-300 transition-colors"
                                title="View on Screener.in"
                              >
                                <span>Screener</span>
                                <ExternalLink size={8} />
                              </a>
                            </div>
                          </div>
                        </td>

                        {/* Vertical / Catalyst */}
                        <td className="py-3 px-3">
                          <div className="flex flex-col gap-1 items-start">
                            {item.vertical_archetype && (
                              <span className="rounded border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-cyan-300">
                                {item.vertical_archetype.replace(/_/g, " ")}
                              </span>
                            )}
                            <span className="text-[10px] text-slate-400 font-medium">
                              {item.catalyst_type.replace(/_/g, " ")}
                            </span>
                          </div>
                        </td>

                        {/* Trend Regime */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          {item.trend_regime === "GOLDEN_TREND" ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                              Golden Trend
                            </span>
                          ) : item.trend_regime === "DOWNTREND_TRAP" ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                              Downtrend Trap
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                              Early Breakout
                            </span>
                          )}
                        </td>

                        {/* Trigger P0 -> CMP */}
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <div className="font-mono text-xs font-semibold text-white">
                            {cmp ? `₹${cmp.toLocaleString("en-IN")}` : "—"}
                          </div>
                          {p0 && (
                            <div className="font-mono text-[10px] text-slate-500">
                              P₀: ₹{p0.toLocaleString("en-IN")}
                            </div>
                          )}
                        </td>

                        {/* Move / Status */}
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          {movePct != null && (
                            <div className={`font-mono text-xs font-bold ${movePct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                              {movePct >= 0 ? `+${movePct.toFixed(1)}%` : `${movePct.toFixed(1)}%`}
                            </div>
                          )}
                          {item.absorption_status ? (
                            <span className={`inline-block mt-0.5 text-[9px] font-bold uppercase tracking-wider ${
                              item.absorption_status === "FRESH_TRIGGER"
                                ? "text-cyan-400"
                                : item.absorption_status === "IN_EXPANSION"
                                ? "text-amber-400"
                                : item.absorption_status === "STOPPED_OUT"
                                ? "text-red-400"
                                : "text-slate-400"
                            }`}>
                              {item.absorption_status.replace(/_/g, " ")}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-600">—</span>
                          )}
                        </td>

                        {/* Conviction */}
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          {item.recommendation ? (
                            <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                              item.recommendation === "STRONG_BUY"
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                : item.recommendation === "TACTICAL_BUY"
                                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                                : item.recommendation === "WATCHLIST_ONLY"
                                ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            }`}>
                              <Target size={10} />
                              {item.recommendation.replace(/_/g, " ")}
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>

                        {/* Target & Upside */}
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          {item.upside_pct != null ? (
                            <>
                              <div className="font-mono text-xs font-bold text-emerald-400">
                                +{item.upside_pct.toFixed(1)}%
                              </div>
                              {item.target_price && (
                                <div className="font-mono text-[10px] text-slate-400">
                                  ₹{item.target_price.toLocaleString("en-IN")}
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>

                        {/* Velocity */}
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          {item.est_velocity_days ? (
                            <span className="inline-flex items-center gap-1 rounded bg-slate-800/80 px-2 py-0.5 text-[10px] font-mono text-cyan-300">
                              <Clock size={9} />
                              {item.est_velocity_days}
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>

                        {/* Impact */}
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${impactCfg.badge}`}>
                            {item.impact_score.toFixed(1)}
                          </span>
                        </td>

                        {/* Announcement Date */}
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <div className="text-[11px] text-slate-200 font-medium font-mono">
                            {item.announcement_date || item.published_at ? new Date(item.announcement_date || item.published_at).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            }) : "—"}
                          </div>
                          <div className="text-[9px] text-cyan-400/90 font-mono">
                            {item.announcement_date || item.published_at ? new Date(item.announcement_date || item.published_at).toLocaleTimeString("en-IN", {
                              hour: "2-digit",
                              minute: "2-digit",
                            }) : ""}
                          </div>
                        </td>

                        {/* Recommendation Date */}
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <div className="text-[11px] text-emerald-300 font-medium font-mono">
                            {item.recommendation_date || item.published_at ? new Date(item.recommendation_date || item.published_at).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            }) : "—"}
                          </div>
                          <div className="text-[9px] text-slate-500 font-mono">
                            {item.recommendation_date || item.published_at ? new Date(item.recommendation_date || item.published_at).toLocaleTimeString("en-IN", {
                              hour: "2-digit",
                              minute: "2-digit",
                            }) : ""}
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedDrawerItem(item);
                              }}
                              className="rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-[10px] font-semibold text-cyan-300 transition-colors hover:border-cyan-500 hover:bg-cyan-950/40"
                              title="Open Deep Dive Drawer"
                            >
                              Deep Dive
                            </button>
                            {item.pdf_url && (
                              <a
                                href={item.pdf_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="rounded-lg border border-slate-700 bg-slate-800/80 p-1 text-slate-400 hover:border-cyan-500 hover:text-cyan-300"
                                title="View original exchange PDF"
                              >
                                <FileText size={12} />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── Cards View ─────────────────────────────────────── */}
          {!loading && items.length > 0 && viewMode === "cards" && (
            <div className="flex flex-col gap-4">
              {items.map((item) => {
                const screenerUrl = `https://www.screener.in/company/${item.symbol ? item.symbol : encodeURIComponent(item.company_name)}/consolidated/#documents`;
                const impactCfg = IMPACT_COLORS[item.impact_level] ?? IMPACT_COLORS.MEDIUM;

                return (
                  <div
                    key={item.id}
                    className="group relative flex flex-col gap-4 rounded-2xl border border-slate-800 bg-[#07111F] p-5 transition-all duration-200 hover:border-slate-700 hover:bg-[#0A1628] hover:shadow-xl hover:shadow-cyan-950/20"
                  >
                    {/* Card Header */}
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Company Name & Ticker */}
                        <span className="text-base font-bold text-white tracking-tight">
                          {item.company_name}
                        </span>
                        {item.symbol && (
                          <span className="rounded bg-slate-800 px-2 py-0.5 text-xs font-mono font-semibold text-cyan-400">
                            {item.symbol}
                          </span>
                        )}
                        {item.is_listed && (
                          <span className="rounded bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.2 text-[9px] font-mono font-medium text-emerald-400">
                            NSE/BSE
                          </span>
                        )}
                        {item.category === "Live Exchange Filing" ? (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[9px] font-semibold text-emerald-300">
                            <Radio size={9} className="animate-pulse text-emerald-400" />
                            Poll Wire
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-cyan-500/15 border border-cyan-500/30 px-2 py-0.5 text-[9px] font-semibold text-cyan-300">
                            <Sparkles size={9} className="text-cyan-400" />
                            Catalyst AI
                          </span>
                        )}

                        {/* Vertical Archetype Tag */}
                        {item.vertical_archetype && (
                          <span className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase text-cyan-300">
                            {item.vertical_archetype.replace(/_/g, " ")}
                          </span>
                        )}

                        {/* Screener Link */}
                        <a
                          href={screenerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded bg-slate-800/80 px-2 py-0.5 text-[10px] font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-cyan-300"
                          title="View financials on Screener.in"
                        >
                          <Building2 size={10} className="text-cyan-400" />
                          <span>Screener.in</span>
                          <ExternalLink size={9} className="opacity-70" />
                        </a>
                      </div>

                      {/* Badges & Scores */}
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Trend Regime */}
                        {item.trend_regime === "GOLDEN_TREND" ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            Golden Trend
                          </span>
                        ) : item.trend_regime === "DOWNTREND_TRAP" ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-red-500/40 bg-red-500/10 px-2.5 py-0.5 text-[10px] font-bold text-red-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                            Downtrend Trap
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-bold text-amber-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                            Early Breakout
                          </span>
                        )}

                        {/* Velocity Horizon */}
                        {item.est_velocity_days && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-[10px] font-bold font-mono text-cyan-300">
                            <Clock size={10} className="text-cyan-400" />
                            ⏱️ {item.est_velocity_days}
                          </span>
                        )}

                        {/* Catalyst Badge */}
                        <span className="rounded-full border border-slate-700 bg-slate-800 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-300">
                          {item.catalyst_type.replace(/_/g, " ")}
                        </span>

                        {/* Impact Score */}
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${impactCfg.badge}`}>
                          {item.impact_level} {item.impact_score.toFixed(1)}/10
                        </span>
                      </div>
                    </div>

                    {/* Headline */}
                    <h3 className="text-sm font-semibold text-slate-200 leading-snug">
                      {item.headline}
                    </h3>

                    {/* AI Growth Insight Box */}
                    {item.ai_insight && (
                      <div className="relative rounded-xl border border-cyan-500/20 bg-gradient-to-r from-cyan-950/30 via-slate-900/50 to-slate-900/30 p-3.5">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-cyan-400 mb-1">
                          <Sparkles size={11} className="animate-spin-slow" />
                          <span>AI Growth & Capacity Insight</span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          {item.ai_insight}
                        </p>
                      </div>
                    )}

                    {/* 🎯 Buy Recommendation & Valuation Bridge Banner */}
                    {item.recommendation && (
                      <div className={`relative overflow-hidden rounded-xl border p-4 transition-all shadow-md ${
                        item.recommendation === "STRONG_BUY"
                          ? "border-emerald-500/40 bg-gradient-to-r from-emerald-950/40 via-[#071722] to-slate-900/80 shadow-emerald-950/20"
                          : item.recommendation === "TACTICAL_BUY"
                          ? "border-cyan-500/40 bg-gradient-to-r from-cyan-950/40 via-[#071722] to-slate-900/80 shadow-cyan-950/20"
                          : item.recommendation === "WATCHLIST_ONLY"
                          ? "border-rose-500/40 bg-gradient-to-r from-rose-950/40 via-[#071722] to-slate-900/80 shadow-rose-950/20"
                          : "border-amber-500/40 bg-gradient-to-r from-amber-950/40 via-[#071722] to-slate-900/80 shadow-amber-950/20"
                      }`}>
                        {/* Recommendation Header */}
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                          <div className="flex items-center gap-2.5">
                            <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-black tracking-wider uppercase shadow-sm ${
                              item.recommendation === "STRONG_BUY"
                                ? "bg-emerald-400 text-slate-950 shadow-emerald-500/20"
                                : item.recommendation === "TACTICAL_BUY"
                                ? "bg-cyan-400 text-slate-950 shadow-cyan-500/20"
                                : item.recommendation === "WATCHLIST_ONLY"
                                ? "bg-rose-500 text-white shadow-rose-500/20"
                                : "bg-amber-400 text-slate-950 shadow-amber-500/20"
                            }`}>
                              <Target size={13} className="shrink-0" />
                              {item.recommendation.replace(/_/g, " ")}
                            </span>

                            {item.conviction_score !== null && item.conviction_score !== undefined && (
                              <span className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-900/90 px-2 py-0.5 text-xs font-mono text-slate-300">
                                Conviction: <strong className={item.conviction_score >= 85 ? "text-emerald-400" : "text-amber-400"}>{item.conviction_score}%</strong>
                              </span>
                            )}
                          </div>

                          {/* Target Price & Upside Callout */}
                          <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
                            {item.current_price && (
                              <div className="flex flex-col text-right">
                                <span className="text-[10px] text-slate-400 uppercase">CMP</span>
                                <span className="font-semibold text-slate-200">₹{item.current_price.toLocaleString("en-IN")}</span>
                              </div>
                            )}

                            {item.target_price && (
                              <div className="flex flex-col text-right">
                                <span className="text-[10px] text-emerald-400 uppercase font-semibold">Target Price</span>
                                <span className="font-bold text-emerald-300 text-sm">₹{item.target_price.toLocaleString("en-IN")}</span>
                              </div>
                            )}

                            {item.upside_pct !== null && item.upside_pct !== undefined && (
                              <div className="flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 font-bold text-emerald-300">
                                <ArrowUpRight size={14} className="text-emerald-400" />
                                <span className="text-xs">+{item.upside_pct}%</span>
                              </div>
                            )}

                            {item.stop_loss && (
                              <div className="flex flex-col text-right">
                                <span className="text-[10px] text-rose-400 uppercase">Stop Loss</span>
                                <span className="font-semibold text-rose-400">₹{item.stop_loss.toLocaleString("en-IN")}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* ⚡ Realized Move & Absorption Status Bar */}
                        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs">
                          <div className="flex flex-wrap items-center gap-3 font-mono text-[11px]">
                            <span className="text-slate-400">
                              Base Trigger (P₀): <strong className="text-white">₹{item.price_at_announcement?.toLocaleString("en-IN") || item.current_price?.toLocaleString("en-IN")}</strong>
                            </span>
                            <span className="text-slate-500">•</span>
                            <span className="text-slate-400">
                              Realized Move: <strong className={item.realized_move_pct && item.realized_move_pct > 20 ? "text-amber-400" : "text-emerald-400"}>+{item.realized_move_pct || 0}%</strong>
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {item.absorption_status === "FRESH_TRIGGER" ? (
                              <span className="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                                🟢 Fresh Trigger (Optimal Risk/Reward)
                              </span>
                            ) : item.absorption_status === "IN_EXPANSION" ? (
                              <span className="rounded-full border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
                                🟡 In Expansion (Momentum Drift)
                              </span>
                            ) : (
                              <span className="rounded-full border border-rose-500/40 bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-300">
                                🔴 Priced In ({item.realized_move_pct}% Move — Caution)
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Forward EPS & PE Valuation Bridge */}
                        <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3 text-xs">
                          {item.current_eps && item.forward_eps && (
                            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2.5">
                              <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-semibold">Forward EPS Bridge</span>
                              <div className="mt-1 flex items-center gap-1.5 font-mono">
                                <span className="text-slate-300">₹{item.current_eps}</span>
                                <span className="text-cyan-400 text-[10px]">➔</span>
                                <span className="font-bold text-emerald-400">₹{item.forward_eps}</span>
                                <span className="text-[10px] text-emerald-400/80 ml-auto">
                                  (+{(((item.forward_eps - item.current_eps) / item.current_eps) * 100).toFixed(0)}%)
                                </span>
                              </div>
                            </div>
                          )}

                          {item.valuation_pe && item.fair_pe && (
                            <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2.5">
                              <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-semibold">Valuation Multiple</span>
                              <div className="mt-1 flex items-center gap-1.5 font-mono">
                                <span className="text-slate-300">{item.valuation_pe}x P/E</span>
                                <span className="text-slate-500 text-[10px]">vs Fair</span>
                                <span className="font-bold text-amber-400">{item.fair_pe}x</span>
                              </div>
                            </div>
                          )}

                          {item.buy_thesis && (
                            <div className={`rounded-lg border border-slate-800 bg-slate-950/60 p-2.5 ${!item.current_eps ? "sm:col-span-3" : ""}`}>
                              <span className="text-[10px] uppercase tracking-wider text-cyan-400 block font-bold">Institutional Buy Thesis</span>
                              <p className="mt-1 text-slate-300 line-clamp-2 text-[11px] leading-relaxed">
                                {item.buy_thesis}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 📊 Balance Sheet Synergy Box */}
                    {(item.synergy_cwip_cr || item.synergy_rev_addition_cr || item.synergy_interest_saved_cr) && (
                      <div className="rounded-xl border border-emerald-500/30 bg-[#06151E]/80 p-3.5 shadow-sm">
                        <div className="flex items-center justify-between gap-2 border-b border-emerald-500/20 pb-2 mb-2.5">
                          <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                            <Coins size={12} />
                            <span>Balance Sheet Synergy & Runway Impact</span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400">
                            Status: <strong className="text-emerald-300">{item.momentum_status || "EARLY"}</strong>
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs">
                          {item.synergy_cwip_cr && (
                            <div className="flex flex-col">
                              <span className="text-[10px] text-slate-400">CWIP Conversion</span>
                              <span className="font-mono font-bold text-white mt-0.5">
                                ₹{item.synergy_cwip_cr.toLocaleString("en-IN")} Cr
                              </span>
                            </div>
                          )}

                          {item.synergy_rev_addition_cr && (
                            <div className="flex flex-col">
                              <span className="text-[10px] text-slate-400">Est. Revenue Addition</span>
                              <span className="font-mono font-bold text-emerald-400 mt-0.5">
                                +₹{item.synergy_rev_addition_cr.toLocaleString("en-IN")} Cr
                                {item.synergy_rev_pct_ttm && (
                                  <span className="text-[10px] text-slate-400 ml-1">
                                    (+{item.synergy_rev_pct_ttm}%)
                                  </span>
                                )}
                              </span>
                            </div>
                          )}

                          {item.synergy_ebitda_addition_cr && (
                            <div className="flex flex-col">
                              <span className="text-[10px] text-slate-400">
                                Incr. EBITDA ({item.synergy_ebitda_margin_pct}%)
                              </span>
                              <span className="font-mono font-bold text-cyan-400 mt-0.5">
                                +₹{item.synergy_ebitda_addition_cr.toLocaleString("en-IN")} Cr
                              </span>
                            </div>
                          )}

                          {item.synergy_interest_saved_cr && (
                            <div className="flex flex-col">
                              <span className="text-[10px] text-slate-400">Interest Cost Saved</span>
                              <span className="font-mono font-bold text-amber-400 mt-0.5">
                                ₹{item.synergy_interest_saved_cr.toLocaleString("en-IN")} Cr/yr
                                {item.synergy_pat_accretion_pct && (
                                  <span className="text-[10px] text-emerald-400 ml-1">
                                    (+{item.synergy_pat_accretion_pct}% PAT)
                                  </span>
                                )}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Card Footer: Dual Dates & Actions */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80 text-xs text-slate-500">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="flex items-center gap-1 text-[11px] font-mono text-slate-400" title="Exchange Filing / Quarterly Announcement Date">
                          <Clock size={11} className="text-cyan-400" />
                          Filed: {new Date(item.announcement_date || item.published_at).toLocaleString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <span className="text-slate-600">•</span>
                        <span className="flex items-center gap-1 text-[11px] font-mono text-emerald-400/90" title="Engine Recommendation Evaluation Date">
                          <Target size={11} className="text-emerald-400" />
                          Rec: {new Date(item.recommendation_date || item.published_at).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                        {item.deal_value_cr && (
                          <>
                            <span className="text-slate-600">•</span>
                            <span className="font-mono font-semibold text-amber-400 text-[11px]">
                              Deal Value: ₹{item.deal_value_cr.toLocaleString("en-IN")} Cr
                            </span>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Slide-over Drawer Trigger */}
                        <button
                          onClick={() => setSelectedDrawerItem(item)}
                          className="flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-[11px] font-semibold text-cyan-300 transition-all hover:bg-cyan-500/20"
                        >
                          <Maximize2 size={11} />
                          <span>Filing Analysis</span>
                        </button>

                        {/* PDF Filing Link */}
                        {item.pdf_url && (
                          <a
                            href={item.pdf_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1 text-[11px] font-semibold text-slate-300 transition-all hover:border-cyan-500/50 hover:bg-slate-700 hover:text-white"
                          >
                            <FileText size={11} className="text-cyan-400" />
                            <span>PDF Filing</span>
                            <ExternalLink size={10} className="opacity-60" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Pagination ──────────────────────────────────── */}
        <div className="flex items-center justify-between border-t border-slate-800 px-4 py-3">
          <p className="text-xs text-slate-500">Page {page}</p>
          <div className="flex items-center gap-2">
            <button
              id="btn-page-prev"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 disabled:opacity-40 hover:border-cyan-500/40 hover:text-cyan-400"
            >
              <ChevronLeft size={12} /> Prev
            </button>
            <button
              id="btn-page-next"
              onClick={() => setPage((p) => p + 1)}
              disabled={items.length < pageSize}
              className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 disabled:opacity-40 hover:border-cyan-500/40 hover:text-cyan-400"
            >
              Next <ChevronRight size={12} />
            </button>
          </div>
        </div>

      </div>

      {/* ── Slide-Over Filing Analysis Drawer ────────────── */}
      {selectedDrawerItem && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative flex h-full w-full max-w-xl flex-col border-l border-slate-800 bg-[#06101E] p-6 shadow-2xl overflow-y-auto">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-400">
                  Filing & Synergy Analysis Drawer
                </span>
                <h2 className="text-xl font-bold text-white mt-0.5">
                  {selectedDrawerItem.company_name}
                </h2>
                {selectedDrawerItem.symbol && (
                  <span className="font-mono text-xs text-slate-400">
                    NSE/BSE: {selectedDrawerItem.symbol}
                  </span>
                )}
              </div>
              <button
                onClick={() => setSelectedDrawerItem(null)}
                className="rounded-xl border border-slate-700 bg-slate-800 p-2 text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex flex-col gap-5 py-5">
              {/* Highlight Badges */}
              <div className="flex flex-wrap items-center gap-2">
                {selectedDrawerItem.vertical_archetype && (
                  <span className="rounded-full border border-cyan-500/40 bg-cyan-500/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-cyan-300">
                    {selectedDrawerItem.vertical_archetype.replace(/_/g, " ")}
                  </span>
                )}
                <span className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-slate-300">
                  {selectedDrawerItem.catalyst_type.replace(/_/g, " ")}
                </span>
                <span className="rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-red-400">
                  {selectedDrawerItem.impact_level} {selectedDrawerItem.impact_score.toFixed(1)}/10
                </span>
                {selectedDrawerItem.est_velocity_days && (
                  <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400 font-mono">
                    ⏱️ +20% Horizon: {selectedDrawerItem.est_velocity_days}
                  </span>
                )}
              </div>

              {/* Timing & Absorption Summary Bar */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-xl border border-slate-800 bg-[#09172A] p-3.5 text-xs font-mono">
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400 uppercase font-sans">Announcement Date</span>
                  <span className="font-semibold text-slate-200 mt-0.5">
                    {new Date(selectedDrawerItem.announcement_date || selectedDrawerItem.published_at).toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400 uppercase font-sans">Recommendation Date</span>
                  <span className="font-semibold text-emerald-400 mt-0.5">
                    {new Date(selectedDrawerItem.recommendation_date || selectedDrawerItem.published_at).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400 uppercase font-sans">Base Price (P₀)</span>
                  <span className="font-semibold text-white mt-0.5">
                    ₹{selectedDrawerItem.price_at_announcement?.toLocaleString("en-IN") || selectedDrawerItem.current_price?.toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400 uppercase font-sans">Realized Absorption</span>
                  <span className={`font-bold mt-0.5 ${selectedDrawerItem.realized_move_pct && selectedDrawerItem.realized_move_pct > 20 ? "text-amber-400" : "text-emerald-400"}`}>
                    +{selectedDrawerItem.realized_move_pct || 0}% ({selectedDrawerItem.absorption_status || "FRESH"})
                  </span>
                </div>
              </div>

              {/* Headline */}
              <div className="rounded-xl border border-slate-800 bg-[#09172A] p-4">
                <span className="text-[10px] uppercase font-bold text-slate-400">Filing Subject</span>
                <p className="text-sm font-semibold text-white mt-1">
                  {selectedDrawerItem.headline}
                </p>
              </div>

              {/* AI Growth Takeaway */}
              {selectedDrawerItem.ai_insight && (
                <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-4">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-cyan-400 mb-1.5">
                    <Sparkles size={13} />
                    <span>AI Revenue & Operating Leverage Takeaway</span>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed">
                    {selectedDrawerItem.ai_insight}
                  </p>
                </div>
              )}

              {/* 🎯 Buy Recommendation & Risk/Reward Matrix */}
              {selectedDrawerItem.recommendation && (
                <div className="rounded-xl border border-emerald-500/40 bg-[#061824] p-4 shadow-lg">
                  <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2.5 mb-3">
                    <div className="flex items-center gap-2">
                      <Target size={14} className="text-emerald-400" />
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                        Institutional Buy Recommendation
                      </span>
                    </div>
                    <span className="rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-0.5 text-[10px] font-black uppercase">
                      {selectedDrawerItem.recommendation.replace(/_/g, " ")}
                    </span>
                  </div>

                  {/* Conviction & Risk/Reward Summary */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-xs mb-3">
                    <div className="bg-slate-950/60 rounded-lg p-2 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Target Price</span>
                      <span className="font-mono font-bold text-emerald-400 text-sm">
                        ₹{selectedDrawerItem.target_price?.toLocaleString("en-IN")}
                      </span>
                      {selectedDrawerItem.upside_pct && (
                        <span className="text-[10px] text-emerald-300 font-semibold block">
                          +{selectedDrawerItem.upside_pct}% Upside
                        </span>
                      )}
                    </div>

                    <div className="bg-slate-950/60 rounded-lg p-2 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Current CMP</span>
                      <span className="font-mono font-semibold text-white text-sm">
                        ₹{selectedDrawerItem.current_price?.toLocaleString("en-IN")}
                      </span>
                      <span className="text-[10px] text-slate-400 block">Live Price</span>
                    </div>

                    <div className="bg-slate-950/60 rounded-lg p-2 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Stop Loss</span>
                      <span className="font-mono font-semibold text-rose-400 text-sm">
                        ₹{selectedDrawerItem.stop_loss?.toLocaleString("en-IN")}
                      </span>
                      <span className="text-[10px] text-rose-400/80 block">Capital Protection</span>
                    </div>

                    <div className="bg-slate-950/60 rounded-lg p-2 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Risk : Reward</span>
                      {(() => {
                        const upside = (selectedDrawerItem.target_price || 0) - (selectedDrawerItem.current_price || 0);
                        const downside = (selectedDrawerItem.current_price || 0) - (selectedDrawerItem.stop_loss || 0);
                        const ratio = downside > 0 ? (upside / downside).toFixed(1) : "N/A";
                        return (
                          <>
                            <span className="font-mono font-black text-cyan-300 text-sm">
                              1 : {ratio}
                            </span>
                            <span className="text-[10px] text-cyan-400/80 block">Institutional Grade</span>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Forward EPS Bridge & Valuation Multiple */}
                  {(selectedDrawerItem.forward_eps || selectedDrawerItem.valuation_pe) && (
                    <div className="space-y-2 border-t border-emerald-500/10 pt-2.5 text-xs">
                      {selectedDrawerItem.current_eps && selectedDrawerItem.forward_eps && (
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Forward EPS Expansion:</span>
                          <span className="font-mono font-bold text-white">
                            ₹{selectedDrawerItem.current_eps} <span className="text-cyan-400">➔</span> <span className="text-emerald-400">₹{selectedDrawerItem.forward_eps}</span>
                          </span>
                        </div>
                      )}
                      {selectedDrawerItem.valuation_pe && selectedDrawerItem.fair_pe && (
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Current vs. Fair P/E Multiple:</span>
                          <span className="font-mono font-bold text-amber-300">
                            {selectedDrawerItem.valuation_pe}x <span className="text-slate-500">vs</span> {selectedDrawerItem.fair_pe}x
                          </span>
                        </div>
                      )}
                      {selectedDrawerItem.conviction_score && (
                        <div className="flex justify-between items-center">
                          <span className="text-slate-400">Quant Conviction Score:</span>
                          <span className="font-mono font-black text-emerald-400">
                            {selectedDrawerItem.conviction_score}%
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Institutional Buy Thesis */}
                  {selectedDrawerItem.buy_thesis && (
                    <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/70 p-3">
                      <span className="text-[10px] uppercase tracking-wider text-cyan-400 block font-bold mb-1">
                        Detailed Investment Thesis
                      </span>
                      <p className="text-xs text-slate-200 leading-relaxed">
                        {selectedDrawerItem.buy_thesis}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Balance Sheet Synergy Matrix */}
              <div className="rounded-xl border border-emerald-500/30 bg-[#061824] p-4">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-400 mb-3">
                  <Coins size={13} />
                  <span>Financial Synergy Calculation</span>
                </div>

                <div className="space-y-2.5 text-xs">
                  {selectedDrawerItem.synergy_cwip_cr && (
                    <div className="flex justify-between border-b border-emerald-500/10 pb-1.5">
                      <span className="text-slate-400">CWIP Conversion:</span>
                      <span className="font-mono font-bold text-white">
                        ₹{selectedDrawerItem.synergy_cwip_cr.toLocaleString("en-IN")} Cr
                      </span>
                    </div>
                  )}

                  {selectedDrawerItem.synergy_rev_addition_cr && (
                    <div className="flex justify-between border-b border-emerald-500/10 pb-1.5">
                      <span className="text-slate-400">Est. Annual Revenue Addition:</span>
                      <span className="font-mono font-bold text-emerald-400">
                        +₹{selectedDrawerItem.synergy_rev_addition_cr.toLocaleString("en-IN")} Cr
                        {selectedDrawerItem.synergy_rev_pct_ttm && ` (+${selectedDrawerItem.synergy_rev_pct_ttm}% TTM Sales)`}
                      </span>
                    </div>
                  )}

                  {selectedDrawerItem.synergy_ebitda_addition_cr && (
                    <div className="flex justify-between border-b border-emerald-500/10 pb-1.5">
                      <span className="text-slate-400">
                        Incremental EBITDA ({selectedDrawerItem.synergy_ebitda_margin_pct}% margin):
                      </span>
                      <span className="font-mono font-bold text-cyan-400">
                        +₹{selectedDrawerItem.synergy_ebitda_addition_cr.toLocaleString("en-IN")} Cr
                      </span>
                    </div>
                  )}

                  {selectedDrawerItem.synergy_interest_saved_cr && (
                    <div className="flex justify-between border-b border-emerald-500/10 pb-1.5">
                      <span className="text-slate-400">Annual Interest Saved:</span>
                      <span className="font-mono font-bold text-amber-400">
                        ₹{selectedDrawerItem.synergy_interest_saved_cr.toLocaleString("en-IN")} Cr
                        {selectedDrawerItem.synergy_pat_accretion_pct && ` (+${selectedDrawerItem.synergy_pat_accretion_pct}% PAT)`}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Official Document Highlights */}
              <div className="rounded-xl border border-slate-800 bg-[#09172A] p-4">
                <span className="text-[10px] uppercase font-bold text-slate-400 mb-2 block">
                  Official Exchange Filing Highlight
                </span>
                <div className="rounded-lg border border-cyan-500/20 bg-slate-950/80 p-3 font-mono text-[11px] text-slate-300 leading-relaxed">
                  <p>
                    [EXCHANGE FILING EXCERPT]:{" "}
                    <span className="bg-cyan-500/20 text-cyan-200 px-1 py-0.5 rounded font-semibold">
                      {selectedDrawerItem.headline}
                    </span>
                  </p>
                  {selectedDrawerItem.filing_description && (
                    <p className="mt-2 text-slate-400">
                      {selectedDrawerItem.filing_description}
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2.5 pt-2">
                <button
                  onClick={() => handleAddToWatchlist(selectedDrawerItem)}
                  disabled={actionInProgress === "watchlist"}
                  className="flex items-center justify-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 py-2.5 text-xs font-bold text-cyan-300 transition-all hover:bg-cyan-500/20"
                >
                  <BookmarkPlus size={14} />
                  <span>+ Add to Catalyst Watchlist</span>
                </button>

                <button
                  onClick={() => handleSendTelegram(selectedDrawerItem)}
                  disabled={actionInProgress === "telegram"}
                  className="flex items-center justify-center gap-2 rounded-xl border border-blue-500/40 bg-blue-500/10 py-2.5 text-xs font-bold text-blue-300 transition-all hover:bg-blue-500/20"
                >
                  <Send size={14} />
                  <span>🚀 Send Real-Time Telegram Alert</span>
                </button>

                {selectedDrawerItem.pdf_url && (
                  <a
                    href={selectedDrawerItem.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-xs font-semibold text-white transition-all hover:border-slate-600"
                  >
                    <FileText size={14} className="text-cyan-400" />
                    <span>Open Full PDF in New Window</span>
                    <ExternalLink size={12} className="opacity-70" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast Notification ─────────────────────────── */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border px-5 py-3 shadow-2xl backdrop-blur-sm text-sm font-medium transition-all animate-in slide-in-from-bottom-4 ${
            toast.type === "ok"
              ? "border-emerald-500/40 bg-emerald-950/90 text-emerald-300"
              : "border-red-500/40 bg-red-950/90 text-red-300"
          }`}
        >
          {toast.type === "ok" ? (
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle size={16} className="text-red-400 shrink-0" />
          )}
          {toast.msg}
        </div>
      )}
    </DashboardLayout>
  );
}

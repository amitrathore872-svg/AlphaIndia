"use client";

// =======================================================
// Alpha India Growth Screener PRO
// Institutional Bloomberg Terminal Table
// Sprint 33.4.2 — Grouped Header & Real Yahoo Financials
// =======================================================

import React from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Star,
  TrendingUp,
} from "lucide-react";
import type { GrowthCompany } from "@/lib/api";
import { SparklineChart } from "@/components/common";
import {
  ALL_AVAILABLE_COLUMNS,
  type ColumnDefinition,
} from "@/components/layout/earnings/quarterlyColumnsConfig";

export type TableDensity = "default" | "compact";

interface GrowthTableProps {
  companies: GrowthCompany[];
  loading: boolean;

  page: number;
  totalPages: number;
  totalCompanies: number;
  limit: number;
  onLimitChange?: (newLimit: number) => void;

  sortBy: string;
  sortOrder: "asc" | "desc";
  onSort: (column: string) => void;

  onPrevious: () => void;
  onNext: () => void;
  onFirst?: () => void;
  onLast?: () => void;

  density?: TableDensity;
  onOpenWatchlist?: (company: GrowthCompany) => void;
  selectedColumnIds?: string[];
}

// =======================================================
// Sortable Header Component
// =======================================================

function SortHeader({
  label,
  column,
  sortBy,
  sortOrder,
  onSort,
  align = "right",
  className = "",
}: {
  label: string;
  column: string;
  sortBy: string;
  sortOrder: "asc" | "desc";
  onSort: (column: string) => void;
  align?: "left" | "center" | "right";
  className?: string;
}) {
  const active = sortBy === column;

  const justifyClass =
    align === "left"
      ? "justify-start"
      : align === "center"
      ? "justify-center"
      : "justify-end";

  return (
    <button
      onClick={() => onSort(column)}
      className={`group flex items-center gap-1.5 w-full text-xs font-semibold tracking-wider transition ${justifyClass} ${
        active ? "text-cyan-600 dark:text-cyan-400" : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
      } ${className}`}
      title={`Sort by ${label}`}
    >
      <span className="truncate">{label}</span>

      {!active && (
        <ArrowUpDown
          size={12}
          className="text-slate-400 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition"
        />
      )}

      {active &&
        (sortOrder === "asc" ? (
          <ArrowUp size={13} className="text-cyan-600 dark:text-cyan-400 shrink-0" />
        ) : (
          <ArrowDown size={13} className="text-cyan-600 dark:text-cyan-400 shrink-0" />
        ))}
    </button>
  );
}

// =======================================================
// Value Formatters
// =======================================================

function formatPrice(val: number | null | undefined) {
  if (val === null || val === undefined || Number.isNaN(val)) {
    return <span className="text-slate-400 dark:text-slate-600">--</span>;
  }
  return (
    <span className="font-mono text-slate-800 dark:text-slate-100">
      ₹{val.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </span>
  );
}

function formatCrores(val: number | null | undefined) {
  if (val === null || val === undefined || Number.isNaN(val)) {
    return <span className="text-slate-400 dark:text-slate-600">--</span>;
  }
  return (
    <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
      {Math.round(val).toLocaleString("en-IN")}
    </span>
  );
}

function formatRatio(val: number | null | undefined) {
  if (val === null || val === undefined || Number.isNaN(val)) {
    return <span className="text-slate-400 dark:text-slate-600">--</span>;
  }
  return <span className="font-mono text-slate-700 dark:text-slate-300">{val.toFixed(2)}</span>;
}

function formatPercentMargin(val: number | null | undefined) {
  if (val === null || val === undefined || Number.isNaN(val)) {
    return <span className="text-slate-400 dark:text-slate-600">--</span>;
  }
  return (
    <span
      className={`font-mono ${
        val >= 20
          ? "text-emerald-600 dark:text-emerald-400 font-semibold"
          : val >= 10
          ? "text-slate-700 dark:text-slate-200"
          : val < 0
          ? "text-rose-600 dark:text-rose-400"
          : "text-slate-500 dark:text-slate-400"
      }`}
    >
      {val.toFixed(1)}%
    </span>
  );
}

function formatGrowth(val: number | null | undefined) {
  if (val === null || val === undefined || Number.isNaN(val)) {
    return <span className="text-slate-400 dark:text-slate-600">--</span>;
  }
  if (val > 0) {
    return (
      <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
        +{val.toFixed(1)}%
      </span>
    );
  }
  if (val < 0) {
    return (
      <span className="font-mono font-semibold text-rose-600 dark:text-rose-400">
        {val.toFixed(1)}%
      </span>
    );
  }
  return <span className="font-mono text-slate-500 dark:text-slate-400">0.0%</span>;
}

function renderHealthPill(score: number | null | undefined, isCompact = false) {
  if (score === null || score === undefined) {
    return <span className="text-slate-400 dark:text-slate-600">--</span>;
  }

  const pillPad = isCompact ? "px-1.5 py-0 text-[10px]" : "px-2.5 py-0.5 text-xs";

  if (score >= 80) {
    return (
      <span className={`inline-flex items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/30 font-mono font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 dark:shadow-sm dark:shadow-emerald-950 ${pillPad}`}>
        {Math.round(score)}
      </span>
    );
  }
  if (score >= 60) {
    return (
      <span className={`inline-flex items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/30 font-mono font-bold text-amber-700 dark:bg-amber-500/15 dark:text-amber-400 dark:shadow-sm dark:shadow-amber-950 ${pillPad}`}>
        {Math.round(score)}
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded border border-rose-500/30 bg-rose-500/10 font-mono font-bold text-rose-700 dark:border-rose-800/80 dark:bg-rose-950/40 dark:text-rose-400 ${pillPad}`}>
      {score.toFixed(1)}
    </span>
  );
}

function formatLastUpdated(dateStr?: string | null): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "—";
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diffSec < 60) return "Just now";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
  } catch {
    return "—";
  }
}

function renderGrowthColumnCell(
  col: ColumnDefinition,
  company: GrowthCompany,
  isCompact: boolean
) {
  let val: any = (company as any)[col.id];

  if (val === undefined || val === null) {
    if (col.id === "current_price") val = company.cmp;
    else if (col.id === "stock_pe") val = company.pe_ratio;
    else if (col.id === "price_to_book") val = company.pb_ratio;
    else if (col.id === "quarterly_sales_yoy") val = company.sales_growth_yoy ?? company.revenue_growth;
    else if (col.id === "quarterly_pat_yoy") val = company.profit_growth_yoy ?? company.pat_growth;
    else if (col.id === "revenue_growth_qoq") val = company.sales_growth_qoq;
    else if (col.id === "pat_growth_qoq") val = company.profit_growth_qoq;
    else if (col.id === "opm_latest") val = company.opm;
    else if (col.id === "sales_growth_3yr") val = company.sales_cagr_3y;
    else if (col.id === "profit_growth_3yr") val = company.profit_cagr_3y;
  }

  if (col.id === "current_stage") {
    const cmp = company.cmp ?? company.current_price;
    const d50 = company.dma_50;
    const d200 = company.dma_200;
    let stage = company.current_stage;
    let badgeClass = "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
    let dotClass = "bg-emerald-400";

    if (!stage) {
      if (cmp && d50 && d200) {
        if (cmp >= d50 && d50 >= d200) {
          stage = "Stage 2 (Markup)";
          badgeClass = "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
          dotClass = "bg-emerald-400 animate-pulse";
        } else if (cmp < d50 && d50 >= d200) {
          stage = "Stage 3 (Distribution)";
          badgeClass = "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-400";
          dotClass = "bg-amber-400";
        } else if (cmp < d50 && cmp < d200) {
          stage = "Stage 4 (Downtrend)";
          badgeClass = "border-rose-500/40 bg-rose-500/15 text-rose-700 dark:text-rose-400";
          dotClass = "bg-rose-400";
        } else {
          stage = "Stage 1 (Base)";
          badgeClass = "border-cyan-500/40 bg-cyan-500/15 text-cyan-700 dark:text-cyan-400";
          dotClass = "bg-cyan-400";
        }
      } else if (company.return_3m !== null && company.return_3m !== undefined) {
        if (company.return_3m >= 8.0) {
          stage = "Stage 2 (Markup)";
          badgeClass = "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
          dotClass = "bg-emerald-400 animate-pulse";
        } else if (company.return_3m <= -8.0) {
          stage = "Stage 4 (Downtrend)";
          badgeClass = "border-rose-500/40 bg-rose-500/15 text-rose-700 dark:text-rose-400";
          dotClass = "bg-rose-400";
        } else {
          stage = "Stage 1 (Base)";
          badgeClass = "border-cyan-500/40 bg-cyan-500/15 text-cyan-700 dark:text-cyan-400";
          dotClass = "bg-cyan-400";
        }
      } else {
        stage = "Stage 2 (Markup)";
      }
    }

    return (
      <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${badgeClass}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
        <span>{stage}</span>
      </span>
    );
  }

  if (col.id === "sparkline") {
    const cmp = company.cmp ?? company.current_price ?? 100;
    const r3m = company.return_3m ?? 10;
    const startP = cmp / (1 + (r3m / 100) * 0.7);
    const diff = cmp - startP;
    const sparkline = company.sparkline || [
      startP,
      startP + diff * 0.2,
      startP + diff * 0.35,
      startP + diff * 0.5,
      startP + diff * 0.7,
      startP + diff * 0.85,
      cmp,
    ];

    return (
      <Link href={`/stocks/${encodeURIComponent(company.symbol)}`} className="inline-block hover:opacity-80 transition" title={`Open ${company.symbol} chart`}>
        <SparklineChart data={sparkline} width={80} height={22} showDot={true} showBadge={true} periodLabel="90D" />
      </Link>
    );
  }

  if (col.id === "piotroski_score") {
    const s = company.piotroski_score;
    if (s === null || s === undefined) return <span className="text-slate-400 dark:text-slate-600 font-mono text-xs">—</span>;
    return (
      <span
        className={`inline-block px-1.5 py-0.5 rounded font-mono font-bold ${isCompact ? "text-[10px]" : "text-xs"} ${
          s >= 7
            ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30"
            : s >= 5
            ? "bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 border border-cyan-500/30"
            : "bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30"
        }`}
      >
        {s}/9
      </span>
    );
  }

  if (col.id === "broker_conviction_score") {
    const s = (company as any).broker_conviction_score ?? (company as any).conviction_score;
    if (s === null || s === undefined) return <span className="text-slate-400 dark:text-slate-600 font-mono text-xs">—</span>;
    return (
      <span
        className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded font-mono font-bold ${isCompact ? "text-[10px]" : "text-xs"} ${
          s >= 85
            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
            : s >= 70
            ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40"
            : "bg-amber-500/20 text-amber-400 border border-amber-500/40"
        }`}
      >
        ★ {Number(s).toFixed(0)}
      </span>
    );
  }

  if (col.id === "pead_score") {
    const s = company.pead_score;
    if (s === null || s === undefined) return <span className="text-slate-400 dark:text-slate-600 font-mono text-xs">—</span>;
    return (
      <span
        className={`inline-block px-1.5 py-0.5 rounded font-mono font-bold ${isCompact ? "text-[10px]" : "text-xs"} ${
          s >= 80
            ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/40"
            : s >= 65
            ? "bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 border border-cyan-500/40"
            : "bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/40"
        }`}
      >
        {s.toFixed(0)}
      </span>
    );
  }

  if (col.id === "health_score") {
    return renderHealthPill(company.health_score, isCompact);
  }

  if (val === null || val === undefined || (typeof val === "number" && isNaN(val))) {
    return <span className="text-slate-400 dark:text-slate-600 font-mono text-xs">—</span>;
  }

  switch (col.format) {
    case "currency_cr":
      return formatCrores(typeof val === "number" ? val : parseFloat(val));
    case "currency_rs":
      return formatPrice(typeof val === "number" ? val : parseFloat(val));
    case "growth_percent":
      return formatGrowth(typeof val === "number" ? val : parseFloat(val));
    case "percent":
      return formatPercentMargin(typeof val === "number" ? val : parseFloat(val));
    case "ratio":
    case "multiple":
      return formatRatio(typeof val === "number" ? val : parseFloat(val));
    case "integer":
      return (
        <span className="font-mono text-slate-800 dark:text-slate-200">
          {Math.round(typeof val === "number" ? val : parseFloat(val))}
        </span>
      );
    case "date":
      return <span className="font-mono text-xs text-slate-600 dark:text-slate-300">{String(val).slice(0, 10)}</span>;
    default:
      return <span className="font-mono text-slate-700 dark:text-slate-300">{String(val)}</span>;
  }
}

// =======================================================
// Main Growth Table Component
// =======================================================

export default function GrowthTable({
  companies,
  loading,
  page,
  totalPages,
  totalCompanies,
  limit,
  onLimitChange,
  sortBy,
  sortOrder,
  onSort,
  onPrevious,
  onNext,
  onFirst,
  onLast,
  density = "default",
  onOpenWatchlist,
  selectedColumnIds,
}: GrowthTableProps) {
  const isCompact = density === "compact";

  const activeColumnDefs = React.useMemo(() => {
    if (!selectedColumnIds || selectedColumnIds.length === 0) return null;
    const map = new Map<string, ColumnDefinition>();
    ALL_AVAILABLE_COLUMNS.forEach((c) => map.set(c.id, c));
    return selectedColumnIds
      .map((id) => map.get(id))
      .filter((c): c is ColumnDefinition => c !== undefined);
  }, [selectedColumnIds]);

  const totalCols = activeColumnDefs ? 3 + activeColumnDefs.length + 1 : 16;

  const thPy = isCompact ? "py-1.5" : "py-3";
  const thSubPy = isCompact ? "py-1" : "py-1.5";
  const cellPy = isCompact ? "py-1.5" : "py-2.5 sm:py-3";
  const cellPx = isCompact ? "px-2" : "px-3";
  const cellFont = isCompact ? "text-[11px]" : "text-xs";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-md dark:border-slate-800/80 dark:bg-[#080E1A] dark:shadow-2xl overflow-hidden backdrop-blur-md">
      {/* Table Scrollable Container */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-xs">
          {/* Table Header */}
          <thead className="sticky top-0 z-20 bg-slate-100 text-slate-600 dark:bg-[#060B14] dark:text-slate-400 select-none shadow-xs dark:shadow-md">
            {activeColumnDefs ? (
              <tr className={`border-b border-slate-200 dark:border-slate-800 ${isCompact ? "text-[10px]" : "text-[11px]"} uppercase tracking-wider font-semibold`}>
                <th
                  className={`sticky left-0 z-30 bg-slate-100 dark:bg-[#060B14] px-2.5 sm:px-3 ${thPy} text-center w-11 sm:w-12 text-slate-400 dark:text-slate-500 border-r border-slate-200 dark:border-slate-800 shadow-[2px_0_6px_rgba(0,0,0,0.06)] dark:shadow-[2px_0_6px_rgba(0,0,0,0.5)]`}
                >
                  #
                </th>

                <th
                  className={`sticky left-11 sm:left-12 z-30 bg-slate-100 dark:bg-[#060B14] px-3 sm:px-4 ${thPy} text-left min-w-[160px] sm:min-w-[200px] border-r border-slate-200 dark:border-slate-800 shadow-[4px_0_8px_rgba(0,0,0,0.06)] dark:shadow-[4px_0_8px_rgba(0,0,0,0.5)]`}
                >
                  <SortHeader
                    label="Company"
                    column="company"
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onSort={onSort}
                    align="left"
                  />
                </th>

                <th className={`${cellPx} ${thPy} text-center min-w-[85px] sm:min-w-[100px] border-r border-slate-200/80 dark:border-slate-800/60`}>
                  <SortHeader
                    label="Conviction"
                    column="conviction"
                    sortBy={sortBy}
                    sortOrder={sortOrder}
                    onSort={onSort}
                    align="center"
                  />
                </th>

                {activeColumnDefs.map((col) => (
                  <th
                    key={col.id}
                    className={`${cellPx} ${thPy} border-r border-slate-200/80 dark:border-slate-800/60 ${
                      col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
                    } ${col.minWidth || "min-w-[85px]"}`}
                  >
                    <SortHeader
                      label={col.shortLabel}
                      column={col.sortKey}
                      sortBy={sortBy}
                      sortOrder={sortOrder}
                      onSort={onSort}
                      align={col.align}
                    />
                  </th>
                ))}

                <th className={`${cellPx} ${thPy} text-center min-w-[70px]`}>
                  Actions
                </th>
              </tr>
            ) : (
              <>
                {/* Top Header Row */}
                <tr className={`border-b border-slate-200 dark:border-slate-800 ${isCompact ? "text-[10px]" : "text-[11px]"} uppercase tracking-wider font-semibold`}>
              <th
                rowSpan={2}
                className={`sticky left-0 z-30 bg-slate-100 dark:bg-[#060B14] px-2.5 sm:px-3 ${thPy} text-center w-11 sm:w-12 text-slate-400 dark:text-slate-500 border-r border-slate-200 dark:border-slate-800 shadow-[2px_0_6px_rgba(0,0,0,0.06)] dark:shadow-[2px_0_6px_rgba(0,0,0,0.5)]`}
              >
                #
              </th>

              <th
                rowSpan={2}
                className={`sticky left-11 sm:left-12 z-30 bg-slate-100 dark:bg-[#060B14] px-3 sm:px-4 ${thPy} text-left min-w-[160px] sm:min-w-[200px] border-r border-slate-200 dark:border-slate-800 shadow-[4px_0_8px_rgba(0,0,0,0.06)] dark:shadow-[4px_0_8px_rgba(0,0,0,0.5)]`}
              >
                <SortHeader
                  label="Company"
                  column="company"
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  onSort={onSort}
                  align="left"
                />
              </th>

              <th rowSpan={2} className={`${cellPx} ${thPy} text-center min-w-[85px] sm:min-w-[100px] border-r border-slate-200/80 dark:border-slate-800/60`}>
                <SortHeader
                  label="Conviction"
                  column="conviction"
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  onSort={onSort}
                  align="center"
                />
              </th>

              <th rowSpan={2} className={`${cellPx} ${thPy} text-right min-w-[95px] border-r border-slate-200/80 dark:border-slate-800/60`}>
                <SortHeader
                  label="CMP (₹)"
                  column="cmp"
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  onSort={onSort}
                />
              </th>

              <th rowSpan={2} className={`${cellPx} ${thPy} text-right min-w-[110px] border-r border-slate-200/80 dark:border-slate-800/60`}>
                <SortHeader
                  label="MCap (₹ Cr)"
                  column="market_cap"
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  onSort={onSort}
                />
              </th>

              <th rowSpan={2} className={`${cellPx} ${thPy} text-right min-w-[65px] border-r border-slate-200/80 dark:border-slate-800/60`}>
                <SortHeader
                  label="P/E"
                  column="pe_ratio"
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  onSort={onSort}
                />
              </th>

              <th rowSpan={2} className={`${cellPx} ${thPy} text-right min-w-[65px] border-r border-slate-200/80 dark:border-slate-800/60 text-slate-500 dark:text-slate-400`}>
                Ind P/E
              </th>

              <th rowSpan={2} className={`${cellPx} ${thPy} text-right min-w-[65px] border-r border-slate-200/80 dark:border-slate-800/60`}>
                <SortHeader
                  label="P/B"
                  column="pb_ratio"
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  onSort={onSort}
                />
              </th>

              <th rowSpan={2} className={`${cellPx} ${thPy} text-right min-w-[75px] border-r border-slate-200/80 dark:border-slate-800/60`}>
                <SortHeader
                  label="ROCE (%)"
                  column="roce"
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  onSort={onSort}
                />
              </th>

              <th rowSpan={2} className={`${cellPx} ${thPy} text-right min-w-[75px] border-r border-slate-200/80 dark:border-slate-800/60`}>
                <SortHeader
                  label="ROE (%)"
                  column="roe"
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  onSort={onSort}
                />
              </th>

              <th rowSpan={2} className={`${cellPx} ${thPy} text-right min-w-[70px] border-r border-slate-200/80 dark:border-slate-800/60`}>
                <SortHeader
                  label="OPM (%)"
                  column="opm"
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  onSort={onSort}
                />
              </th>

              {/* Grouped Sales Growth */}
              <th
                colSpan={2}
                className={`${cellPx} ${thSubPy} text-center border-b border-r border-slate-200 dark:border-slate-800/80 bg-cyan-50 text-cyan-700 dark:bg-cyan-950/20 dark:text-cyan-400 font-bold`}
              >
                Sales Growth (%)
              </th>

              {/* Grouped Profit Growth */}
              <th
                colSpan={2}
                className={`${cellPx} ${thSubPy} text-center border-b border-r border-slate-200 dark:border-slate-800/80 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 font-bold`}
              >
                Profit Growth (%)
              </th>

              <th rowSpan={2} className={`${cellPx} ${thPy} text-right min-w-[100px] border-r border-slate-200/80 dark:border-slate-800/60`}>
                <SortHeader
                  label="Sales 3Y CAGR"
                  column="sales_cagr_3y"
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  onSort={onSort}
                />
              </th>

              <th rowSpan={2} className={`${cellPx} ${thPy} text-right min-w-[100px] border-r border-slate-200/80 dark:border-slate-800/60`}>
                <SortHeader
                  label="Profit 3Y CAGR"
                  column="profit_cagr_3y"
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  onSort={onSort}
                />
              </th>

              <th rowSpan={2} className={`${cellPx} ${thPy} text-center min-w-[90px] border-r border-slate-200/80 dark:border-slate-800/60`}>
                <SortHeader
                  label="Health Score"
                  column="health_score"
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  onSort={onSort}
                  align="center"
                />
              </th>

              <th rowSpan={2} className={`${cellPx} ${thPy} text-center min-w-[95px]`}>
                <SortHeader
                  label="Last Updated"
                  column="last_updated"
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  onSort={onSort}
                  align="center"
                />
              </th>
            </tr>

            {/* Subheader Row for YoY & QoQ */}
            <tr className={`border-b border-slate-200 dark:border-slate-800 ${isCompact ? "text-[9px]" : "text-[10px]"} uppercase font-semibold`}>
              <th className={`${cellPx} ${thSubPy} text-right min-w-[70px] bg-cyan-50/50 dark:bg-cyan-950/10 border-r border-slate-200/80 dark:border-slate-800/60`}>
                <SortHeader
                  label="YoY"
                  column="sales_growth_yoy"
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  onSort={onSort}
                />
              </th>

              <th className={`${cellPx} ${thSubPy} text-right min-w-[70px] bg-cyan-50/50 dark:bg-cyan-950/10 border-r border-slate-200/80 dark:border-slate-800/60`}>
                <SortHeader
                  label="QoQ"
                  column="sales_growth_qoq"
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  onSort={onSort}
                />
              </th>

              <th className={`${cellPx} ${thSubPy} text-right min-w-[70px] bg-emerald-50/50 dark:bg-emerald-950/10 border-r border-slate-200/80 dark:border-slate-800/60`}>
                <SortHeader
                  label="YoY"
                  column="profit_growth_yoy"
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  onSort={onSort}
                />
              </th>

              <th className={`${cellPx} ${thSubPy} text-right min-w-[70px] bg-emerald-50/50 dark:bg-emerald-950/10 border-r border-slate-200/80 dark:border-slate-800/60`}>
                <SortHeader
                  label="QoQ"
                  column="profit_growth_qoq"
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  onSort={onSort}
                />
              </th>
            </tr>
              </>
            )}
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-slate-200/80 dark:divide-slate-800/50">
            {loading ? (
              <tr>
                <td colSpan={totalCols} className="py-20 text-center text-slate-500 dark:text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-3">
                    <div className="h-7 w-7 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
                    <p className="text-xs uppercase tracking-widest text-cyan-600 dark:text-cyan-400">
                      Scanning Financial Warehouse...
                    </p>
                  </div>
                </td>
              </tr>
            ) : companies.length === 0 ? (
              <tr>
                <td colSpan={totalCols} className="py-20 text-center text-slate-500">
                  <p className="text-sm">No companies matched your screener criteria.</p>
                  <p className="text-xs text-slate-400 dark:text-slate-600 mt-1">
                    Try adjusting your sector, market cap, or valuation ratio filters.
                  </p>
                </td>
              </tr>
            ) : (
              companies.map((company, idx) => {
                const rowIndex = (page - 1) * limit + idx + 1;

                return (
                  <tr
                    key={`${company.symbol}-${idx}`}
                    className="group transition-colors duration-150 hover:bg-slate-50/90 dark:hover:bg-slate-800/40"
                  >
                    {/* Index (Sticky Column 1) */}
                    <td className={`sticky left-0 z-10 bg-white group-hover:bg-slate-50 dark:bg-[#080E1A] dark:group-hover:bg-[#0D1829] px-2.5 sm:px-3 ${cellPy} text-center text-slate-400 dark:text-slate-500 font-mono border-r border-slate-200/80 dark:border-slate-800/60 shadow-[2px_0_6px_rgba(0,0,0,0.04)] dark:shadow-[2px_0_6px_rgba(0,0,0,0.4)] transition-colors ${cellFont}`}>
                      {rowIndex}
                    </td>

                    {/* Company (Sticky Column 2) */}
                    <td className={`sticky left-11 sm:left-12 z-10 bg-white group-hover:bg-slate-50 dark:bg-[#080E1A] dark:group-hover:bg-[#0D1829] px-3 sm:px-4 ${cellPy} border-r border-slate-200/80 dark:border-slate-800/60 shadow-[4px_0_8px_rgba(0,0,0,0.04)] dark:shadow-[4px_0_8px_rgba(0,0,0,0.4)] transition-colors`}>
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/stocks/${company.symbol}`}
                          className={`${
                            isCompact
                              ? "text-xs font-semibold"
                              : "text-xs sm:text-sm font-semibold"
                          } text-slate-900 group-hover:text-cyan-600 dark:text-slate-100 dark:group-hover:text-cyan-400 transition inline-flex items-center gap-1.5`}
                          title={`Open complete Technical Overview for ${company.company} (${company.symbol})`}
                        >
                          <span className={`truncate ${isCompact ? "max-w-[130px] sm:max-w-[180px]" : "max-w-[150px] sm:max-w-[210px]"}`}>{company.company}</span>
                        </Link>
                        <a
                          href={`https://www.screener.in/company/${company.symbol}/`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-400 hover:text-cyan-600 dark:text-slate-600 dark:hover:text-cyan-400 p-0.5 rounded transition shrink-0"
                          title="Open on Screener.in"
                        >
                          <ExternalLink size={isCompact ? 10 : 11} />
                        </a>
                      </div>
                    </td>

                    {/* Conviction Score & Watchlist Star Action */}
                    <td className={`${cellPx} ${cellPy} text-center border-r border-slate-200/60 dark:border-slate-800/40`}>
                      <button
                        type="button"
                        onClick={() => onOpenWatchlist?.(company)}
                        className={`inline-flex items-center gap-1.5 rounded-lg border transition-all cursor-pointer ${
                          isCompact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs"
                        } ${
                          company.in_watchlist
                            ? company.conviction_score === 5
                              ? "border-amber-500/40 bg-amber-500/15 text-amber-500 hover:bg-amber-500/25 font-bold shadow-xs"
                              : company.conviction_score === 4
                              ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/25 font-semibold shadow-xs"
                              : company.conviction_score === 3
                              ? "border-blue-500/40 bg-blue-500/15 text-blue-600 dark:text-blue-400 hover:bg-blue-500/25 font-semibold"
                              : "border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/40 text-slate-600 dark:text-slate-300 hover:bg-slate-200"
                            : "border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 text-slate-400 hover:border-amber-400/80 hover:text-amber-500 hover:bg-amber-500/5"
                        }`}
                        title={
                          company.in_watchlist
                            ? `In ${company.watchlist_name ?? "Watchlist"}: ${company.conviction_score ?? 3}★ Conviction. Click to edit.`
                            : "Click to add to Watchlist & rate Conviction"
                        }
                      >
                        <Star
                          size={isCompact ? 11 : 12}
                          className={
                            company.in_watchlist
                              ? "fill-amber-400 text-amber-400"
                              : "text-slate-400 group-hover:text-amber-400 transition"
                          }
                        />
                        <span className="font-mono font-semibold">
                          {company.in_watchlist ? `${company.conviction_score ?? 3}★` : "Add"}
                        </span>
                      </button>
                    </td>

                    {/* Dynamic Columns or Standard Columns */}
                    {activeColumnDefs ? (
                      <>
                        {activeColumnDefs.map((col) => (
                          <td
                            key={col.id}
                            className={`${cellPx} ${cellPy} border-r border-slate-200/60 dark:border-slate-800/40 font-mono ${cellFont} ${
                              col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
                            }`}
                          >
                            {renderGrowthColumnCell(col, company, isCompact)}
                          </td>
                        ))}
                        <td className={`${cellPx} ${cellPy} text-center`}>
                          <div className="flex items-center justify-center gap-1.5">
                            <a
                              href={`https://in.tradingview.com/chart/?symbol=${company.exchange || "NSE"}:${company.symbol}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-500/10 hover:bg-cyan-500/20 dark:bg-cyan-950/60 dark:hover:bg-cyan-900/60 text-cyan-700 hover:text-cyan-800 dark:text-cyan-300 border border-cyan-500/30 text-[10px] font-semibold font-mono transition-all cursor-pointer shadow-2xs"
                              title={`Open ${company.symbol} Chart on TradingView`}
                            >
                              <TrendingUp className="w-3 h-3 text-cyan-500" />
                              <span>TV</span>
                            </a>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        {/* CMP (₹) */}
                        <td className={`${cellPx} ${cellPy} text-right border-r border-slate-200/60 dark:border-slate-800/40 font-mono ${cellFont}`}>
                          {formatPrice(company.cmp)}
                        </td>

                        {/* MCap (₹ Cr) */}
                        <td className={`${cellPx} ${cellPy} text-right border-r border-slate-200/60 dark:border-slate-800/40 font-mono ${cellFont}`}>
                          {formatCrores(company.market_cap)}
                        </td>

                        {/* P/E */}
                        <td className={`${cellPx} ${cellPy} text-right border-r border-slate-200/60 dark:border-slate-800/40 font-mono ${cellFont}`}>
                          {formatRatio(company.pe_ratio)}
                        </td>

                        {/* Ind P/E */}
                        <td className={`${cellPx} ${cellPy} text-right border-r border-slate-200/60 dark:border-slate-800/40 font-mono text-slate-500 dark:text-slate-400 ${cellFont}`}>
                          {formatRatio(company.industry_pe)}
                        </td>

                        {/* P/B */}
                        <td className={`${cellPx} ${cellPy} text-right border-r border-slate-200/60 dark:border-slate-800/40 font-mono ${cellFont}`}>
                          {formatRatio(company.pb_ratio)}
                        </td>

                        {/* ROCE (%) */}
                        <td className={`${cellPx} ${cellPy} text-right border-r border-slate-200/60 dark:border-slate-800/40 font-mono ${cellFont}`}>
                          {formatPercentMargin(company.roce)}
                        </td>

                        {/* ROE (%) */}
                        <td className={`${cellPx} ${cellPy} text-right border-r border-slate-200/60 dark:border-slate-800/40 font-mono ${cellFont}`}>
                          {formatPercentMargin(company.roe)}
                        </td>

                        {/* OPM (%) */}
                        <td className={`${cellPx} ${cellPy} text-right border-r border-slate-200/60 dark:border-slate-800/40 font-mono ${cellFont}`}>
                          {formatPercentMargin(company.opm)}
                        </td>

                        {/* Sales Growth YoY */}
                        <td className={`${cellPx} ${cellPy} text-right border-r border-slate-200/60 dark:border-slate-800/40 bg-cyan-50/30 dark:bg-cyan-950/5 font-mono ${cellFont}`}>
                          {formatGrowth(company.sales_growth_yoy ?? (typeof company.revenue_growth === "number" ? company.revenue_growth : null))}
                        </td>

                        {/* Sales Growth QoQ */}
                        <td className={`${cellPx} ${cellPy} text-right border-r border-slate-200/60 dark:border-slate-800/40 bg-cyan-50/30 dark:bg-cyan-950/5 font-mono ${cellFont}`}>
                          {formatGrowth(company.sales_growth_qoq)}
                        </td>

                        {/* Profit Growth YoY */}
                        <td className={`${cellPx} ${cellPy} text-right border-r border-slate-200/60 dark:border-slate-800/40 bg-emerald-50/30 dark:bg-emerald-950/5 font-mono ${cellFont}`}>
                          {formatGrowth(company.profit_growth_yoy ?? (typeof company.pat_growth === "number" ? company.pat_growth : null))}
                        </td>

                        {/* Profit Growth QoQ */}
                        <td className={`${cellPx} ${cellPy} text-right border-r border-slate-200/60 dark:border-slate-800/40 bg-emerald-50/30 dark:bg-emerald-950/5 font-mono ${cellFont}`}>
                          {formatGrowth(company.profit_growth_qoq)}
                        </td>

                        {/* Sales 3Y CAGR */}
                        <td className={`${cellPx} ${cellPy} text-right border-r border-slate-200/60 dark:border-slate-800/40 font-mono ${cellFont}`}>
                          {formatGrowth(company.sales_cagr_3y)}
                        </td>

                        {/* Profit 3Y CAGR */}
                        <td className={`${cellPx} ${cellPy} text-right border-r border-slate-200/60 dark:border-slate-800/40 font-mono ${cellFont}`}>
                          {formatGrowth(company.profit_cagr_3y)}
                        </td>

                        {/* Health Score */}
                        <td className={`${cellPx} ${cellPy} text-center border-r border-slate-200/60 dark:border-slate-800/40`}>
                          {renderHealthPill(company.health_score, isCompact)}
                        </td>

                        {/* Last Updated */}
                        <td className={`${cellPx} ${cellPy} text-center font-mono text-slate-500 dark:text-slate-400 ${cellFont}`}>
                          <span className={`inline-flex items-center gap-1 rounded bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300 ${isCompact ? "px-1.5 py-0 text-[10px]" : "px-2 py-0.5 text-[11px]"}`}>
                            {formatLastUpdated(company.last_updated)}
                          </span>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Pagination Ribbon */}
      <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-3.5 py-3 sm:px-5 sm:py-4 sm:flex-row sm:items-center sm:justify-between text-xs text-slate-600 dark:border-slate-800 dark:bg-[#060B14] dark:text-slate-400">
        <div className="flex flex-wrap items-center justify-between sm:justify-start gap-2.5 sm:gap-4">
          <p className="text-[11px] sm:text-xs">
            Showing{" "}
            <span className="font-semibold text-slate-900 dark:text-white">
              {totalCompanies === 0 ? 0 : (page - 1) * limit + 1}
            </span>{" "}
            to{" "}
            <span className="font-semibold text-slate-900 dark:text-white">
              {Math.min(page * limit, totalCompanies)}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-cyan-600 dark:text-cyan-400">
              {totalCompanies.toLocaleString()}
            </span>{" "}
            companies
          </p>

          {onLimitChange && (
            <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] sm:text-xs">
              <span className="text-slate-500">Rows:</span>
              <select
                value={limit}
                onChange={(e) => onLimitChange(Number(e.target.value))}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-800 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:focus:border-cyan-400 cursor-pointer shadow-xs"
              >
                <option value={10} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">10</option>
                <option value={25} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">25</option>
                <option value={50} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">50</option>
                <option value={100} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">100</option>
              </select>
            </div>
          )}
        </div>

        {/* Page Controls */}
        <div className="flex items-center justify-center sm:justify-end gap-1.5 w-full sm:w-auto">
          {onFirst && (
            <button
              onClick={onFirst}
              disabled={page === 1 || loading}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-600 transition hover:border-cyan-500 hover:text-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:border-cyan-400 dark:hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
              title="First Page"
            >
              <ChevronsLeft size={16} />
            </button>
          )}

          <button
            onClick={onPrevious}
            disabled={page === 1 || loading}
            className="flex h-8 items-center gap-1 rounded-lg border border-slate-300 px-2.5 sm:px-3 text-slate-700 transition hover:border-cyan-500 hover:text-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:border-cyan-400 dark:hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronLeft size={15} />
            <span className="hidden xs:inline">Prev</span>
          </button>

          <div className="flex h-8 items-center rounded-lg bg-slate-200/80 border border-slate-300 px-3 font-mono text-cyan-700 font-semibold text-xs dark:bg-slate-900 dark:border-slate-800 dark:text-cyan-400">
            {page} / {Math.max(1, totalPages)}
          </div>

          <button
            onClick={onNext}
            disabled={page >= totalPages || loading}
            className="flex h-8 items-center gap-1 rounded-lg border border-slate-300 px-2.5 sm:px-3 text-slate-700 transition hover:border-cyan-500 hover:text-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:border-cyan-400 dark:hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
          >
            <span className="hidden xs:inline">Next</span>
            <ChevronRight size={15} />
          </button>

          {onLast && (
            <button
              onClick={onLast}
              disabled={page >= totalPages || loading}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-300 text-slate-600 transition hover:border-cyan-500 hover:text-slate-900 dark:border-slate-800 dark:text-slate-400 dark:hover:border-cyan-400 dark:hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
              title="Last Page"
            >
              <ChevronsRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
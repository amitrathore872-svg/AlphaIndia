"use client";

// =======================================================
// Alpha India Growth Screener Toolbar
// Sprint 33.4.2 — Institutional Filter Ribbon
// =======================================================

import React, { useState } from "react";
import {
  Search,
  RotateCcw,
  Download,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Star,
  Terminal,
} from "lucide-react";
import type { ScreenerFiltersState } from "@/lib/api";
import type { TableDensity } from "./GrowthTable";
import { FormulaScreenerModal } from "@/components/screener/FormulaScreenerModal";

interface ScreenerToolbarProps {
  search: string;
  setSearch: (value: string) => void;
  onSearch: () => void;

  filters: ScreenerFiltersState;
  onFilterChange: (key: keyof ScreenerFiltersState, value: string | number | boolean) => void;
  onResetFilters: () => void;

  onExportCSV: () => void;

  availableSectors?: string[];
  totalResults?: number;

  density?: TableDensity;
  onDensityChange?: (density: TableDensity) => void;
}

export default function ScreenerToolbar({
  search,
  setSearch,
  onSearch,
  filters,
  onFilterChange,
  onResetFilters,
  onExportCSV,
  availableSectors = [],
  totalResults,
  density = "default",
  onDensityChange,
}: ScreenerToolbarProps) {
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [isFormulaModalOpen, setIsFormulaModalOpen] = useState(false);

  // Count active non-default filters
  const activeFilterCount =
    Object.entries(filters).filter(
      ([, val]) => val && val !== "ALL" && val !== false
    ).length + (search.trim() ? 1 : 0);

  return (
    <div className="space-y-3">
      {/* Top Bar: Title + Search + Quick Actions */}
      <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between border-b border-slate-200 pb-2.5 dark:border-slate-800/80">
        {/* Concise Title */}
        <div className="shrink-0 flex items-center">
          <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap dark:text-white">
            Growth Screener
          </h1>
        </div>

        {/* Right Controls: Search + Density + Export */}
        <div className="flex flex-1 items-center justify-between lg:justify-end gap-2 flex-wrap sm:flex-nowrap">
          {/* Universal Search Bar */}
          <div className="relative w-full sm:w-60 md:w-64 lg:w-72">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
            </div>

            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSearch();
              }}
              placeholder="Search company, symbol or sector..."
              className="w-full rounded-xl border border-slate-300 bg-white py-1.5 pl-8 pr-20 text-xs text-slate-900 placeholder:text-slate-400 transition focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-400/30 dark:border-slate-800 dark:bg-[#060B14] dark:text-white dark:placeholder:text-slate-500 dark:focus:border-cyan-400"
            />

            <div className="absolute inset-y-0 right-1 flex items-center gap-1 pr-0.5">
              {search.trim() && (
                <button
                  onClick={() => {
                    setSearch("");
                    onSearch();
                  }}
                  className="rounded-md px-1 py-0.5 text-[10px] text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                >
                  Clear
                </button>
              )}

              <button
                onClick={onSearch}
                className="rounded-lg bg-cyan-500/15 border border-cyan-500/30 px-2 py-0.5 text-[11px] font-semibold text-cyan-600 transition hover:bg-cyan-500/25 dark:bg-cyan-500/20 dark:text-cyan-300 dark:hover:bg-cyan-500/30"
              >
                Search
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Mobile Filter Toggle Button */}
            <button
              onClick={() => setFiltersExpanded(!filtersExpanded)}
              className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-medium transition sm:hidden ${
                filtersExpanded || activeFilterCount > 0
                  ? "border-cyan-500/50 bg-cyan-50 text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-300"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              <SlidersHorizontal size={13} />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-cyan-500/20 px-1.5 py-0.2 font-mono text-[10px] font-bold text-cyan-700 dark:bg-cyan-500/30 dark:text-cyan-300">
                  {activeFilterCount}
                </span>
              )}
              {filtersExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>

            {activeFilterCount > 0 && (
              <button
                onClick={onResetFilters}
                className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:border-rose-400 hover:text-rose-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:border-rose-500/40 dark:hover:text-rose-400"
                title="Reset all filters to default"
              >
                <RotateCcw size={12} />
                <span>Reset</span>
                <span className="ml-0.5 rounded-full bg-cyan-500/10 px-1.5 py-0.2 font-mono text-[10px] text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300">
                  {activeFilterCount}
                </span>
              </button>
            )}

            {/* Watchlist Quick Filter Toggle */}
            <button
              type="button"
              onClick={() => onFilterChange("watchlist_only", !filters.watchlist_only)}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold shadow-xs transition cursor-pointer ${
                filters.watchlist_only
                  ? "border-amber-500 bg-amber-500/15 text-amber-500 font-bold"
                  : "border-slate-300 bg-white text-slate-700 hover:border-amber-400 hover:text-amber-500 dark:border-slate-700/80 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:border-amber-400"
              }`}
              title={filters.watchlist_only ? "Showing Watchlist stocks only" : "Filter by Watchlist"}
            >
              <Star
                size={12}
                className={filters.watchlist_only ? "fill-amber-500 text-amber-500" : "text-slate-400"}
              />
              <span className="hidden xs:inline">Watchlist</span>
            </button>

            {/* Quick Segmented Density Selector: Compact | Default */}
            {onDensityChange && (
              <div className="flex items-center rounded-xl border border-slate-300 bg-slate-100 p-0.5 text-xs shadow-2xs dark:border-slate-800 dark:bg-[#060B14]">
                <button
                  type="button"
                  onClick={() => onDensityChange("compact")}
                  className={`px-2.5 py-1 rounded-lg text-xs transition ${
                    density === "compact"
                      ? "bg-white text-cyan-700 font-semibold border border-slate-300 shadow-xs dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/40"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  }`}
                  title="Compact View — Dense rows to view maximum data"
                >
                  Compact
                </button>
                <button
                  type="button"
                  onClick={() => onDensityChange("default")}
                  className={`px-2.5 py-1 rounded-lg text-xs transition ${
                    density === "default"
                      ? "bg-white text-cyan-700 font-semibold border border-slate-300 shadow-xs dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/40"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  }`}
                  title="Default View — Standard balanced view"
                >
                  Default
                </button>
              </div>
            )}

            {/* Formula Screener Launcher */}
            <button
              type="button"
              onClick={() => setIsFormulaModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-600 hover:bg-cyan-500/20 hover:border-cyan-400 dark:border-cyan-500/40 dark:bg-cyan-500/10 dark:text-cyan-400 dark:hover:bg-cyan-500/20 dark:hover:border-cyan-300 shadow-xs transition cursor-pointer"
              title="Build custom quantitative screener queries with AST formula builder"
            >
              <Terminal size={12} className="text-cyan-600 dark:text-cyan-400" />
              <span className="hidden xs:inline">Formula Builder</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30">
                PRO
              </span>
            </button>

            <button
              onClick={onExportCSV}
              className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700/80 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:bg-slate-700/60 dark:hover:text-white cursor-pointer"
              title="Export filtered results to CSV"
            >
              <Download size={12} className="text-cyan-600 dark:text-cyan-400" />
              <span className="hidden xs:inline">Export</span>
              <span>CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Dynamic Filter Ribbon */}
      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-800/80 dark:bg-[#080E1A] dark:shadow-lg">
        <div className="flex items-center justify-between mb-2.5 px-1">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={13} className="text-cyan-600 dark:text-cyan-400" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Market Intelligence Filters
            </span>
          </div>

          <div className="flex items-center gap-3">
            {totalResults !== undefined && (
              <span className="text-[10px] sm:text-[11px] text-slate-500 font-mono">
                {totalResults.toLocaleString()} active matches
              </span>
            )}

            {/* Desktop / tablet expand/collapse toggle */}
            <button
              onClick={() => setFiltersExpanded(!filtersExpanded)}
              className="hidden sm:flex items-center gap-1 text-[11px] text-slate-500 hover:text-cyan-600 dark:hover:text-cyan-400 transition"
            >
              <span>{filtersExpanded ? "Compact" : "View"}</span>
              {filtersExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>
        </div>

        <div
          className={`grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-9 ${
            filtersExpanded ? "grid" : "hidden sm:grid"
          }`}
        >
          {/* Conviction Score Filter */}
          <FilterSelect
            label="Conviction"
            value={filters.min_conviction || "ALL"}
            onChange={(val) => onFilterChange("min_conviction", val)}
            options={[
              { label: "All Conviction", value: "ALL" },
              { label: "5★ Max Conviction", value: "5" },
              { label: "≥ 4★ High Conviction", value: "4" },
              { label: "≥ 3★ Radar", value: "3" },
            ]}
          />

          {/* Sector */}
          <FilterSelect
            label="Sector"
            value={filters.sector}
            onChange={(val) => onFilterChange("sector", val)}
            options={[
              { label: "All Sectors", value: "ALL" },
              ...(availableSectors.length > 0
                ? availableSectors.map((s) => ({ label: s, value: s }))
                : [
                    { label: "Financial Services", value: "Financial Services" },
                    { label: "Information Technology", value: "Information Technology" },
                    { label: "Real Estate", value: "Real Estate" },
                    { label: "Automobile", value: "Automobile" },
                    { label: "Pharmaceuticals", value: "Pharmaceuticals" },
                    { label: "Energy & Utilities", value: "Energy & Utilities" },
                    { label: "Capital Goods", value: "Capital Goods" },
                    { label: "Consumer Goods", value: "Consumer Goods" },
                  ]),
            ]}
          />

          {/* Exchange */}
          <FilterSelect
            label="Exchange"
            value={filters.exchange}
            onChange={(val) => onFilterChange("exchange", val)}
            options={[
              { label: "All Exchanges", value: "ALL" },
              { label: "NSE", value: "NSE" },
              { label: "BSE", value: "BSE" },
            ]}
          />

          {/* Market Cap */}
          <FilterSelect
            label="Market Cap"
            value={filters.market_cap_category}
            onChange={(val) => onFilterChange("market_cap_category", val)}
            options={[
              { label: "All Caps", value: "ALL" },
              { label: "Large Cap (≥ ₹20k Cr)", value: "LARGE" },
              { label: "Mid Cap (₹5k - ₹20k Cr)", value: "MID" },
              { label: "Small Cap (< ₹5k Cr)", value: "SMALL" },
            ]}
          />

          {/* P/E Ratio */}
          <FilterSelect
            label="P/E Ratio"
            value={filters.pe_range}
            onChange={(val) => onFilterChange("pe_range", val)}
            options={[
              { label: "All P/E", value: "ALL" },
              { label: "< 15 (Value)", value: "lt15" },
              { label: "15 - 30 (Moderate)", value: "15-30" },
              { label: "30 - 50 (Growth)", value: "30-50" },
              { label: "> 50 (High Multiple)", value: "gt50" },
            ]}
          />

          {/* P/B Ratio */}
          <FilterSelect
            label="P/B Ratio"
            value={filters.pb_range}
            onChange={(val) => onFilterChange("pb_range", val)}
            options={[
              { label: "All P/B", value: "ALL" },
              { label: "< 2 (Low)", value: "lt2" },
              { label: "2 - 5 (Moderate)", value: "2-5" },
              { label: "> 5 (Premium)", value: "gt5" },
            ]}
          />

          {/* ROCE */}
          <FilterSelect
            label="ROCE (%)"
            value={filters.roce_min}
            onChange={(val) => onFilterChange("roce_min", val)}
            options={[
              { label: "All ROCE", value: "ALL" },
              { label: "> 15%", value: "15" },
              { label: "> 20%", value: "20" },
              { label: "> 25%", value: "25" },
            ]}
          />

          {/* ROE */}
          <FilterSelect
            label="ROE (%)"
            value={filters.roe_min}
            onChange={(val) => onFilterChange("roe_min", val)}
            options={[
              { label: "All ROE", value: "ALL" },
              { label: "> 12%", value: "12" },
              { label: "> 18%", value: "18" },
              { label: "> 25%", value: "25" },
            ]}
          />

          {/* Health Score */}
          <FilterSelect
            label="Health Score"
            value={filters.health_score_range}
            onChange={(val) => onFilterChange("health_score_range", val)}
            options={[
              { label: "All Scores", value: "ALL" },
              { label: "80 - 100 (Strong)", value: "80-100" },
              { label: "60 - 79 (Moderate)", value: "60-79" },
              { label: "< 60 (Weak)", value: "lt60" },
            ]}
          />
        </div>
      </div>

      {/* Formula Screener Modal */}
      <FormulaScreenerModal
        isOpen={isFormulaModalOpen}
        onClose={() => setIsFormulaModalOpen(false)}
      />
    </div>
  );
}

// =======================================================
// Reusable Dropdown Chip Component
// =======================================================

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: { label: string; value: string }[];
}) {
  const isFiltered = value && value !== "ALL";

  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </label>

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full appearance-none truncate rounded-lg border px-2.5 py-1.5 text-xs outline-none transition cursor-pointer ${
          isFiltered
            ? "border-cyan-500 bg-cyan-50 text-cyan-700 font-semibold dark:border-cyan-500/50 dark:bg-cyan-950/20 dark:text-cyan-300"
            : "border-slate-200 bg-slate-50 text-slate-800 hover:border-slate-300 dark:border-slate-800 dark:bg-[#060B14] dark:text-slate-300 dark:hover:border-slate-700"
        }`}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-white text-slate-900 dark:bg-slate-900 dark:text-white">
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
"use client";

// =======================================================
// Alpha India — Screener.in Style Column Customizer Modal
// High-Fidelity Replication of Screener.in Peer Column Editor
// Dark Bloomberg Institutional Aesthetic (#050B14)
// =======================================================

import { useState, useMemo, useEffect } from "react";
import {
  X,
  Search,
  RotateCcw,
  Check,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Info,
  SlidersHorizontal,
} from "lucide-react";
import {
  ALL_AVAILABLE_COLUMNS,
  CATEGORY_TABS,
  MOST_USED_COLUMN_IDS,
  COLUMN_PRESETS,
  DEFAULT_SCREENER_COLUMN_IDS,
  type ColumnCategory,
  type ColumnDefinition,
} from "./quarterlyColumnsConfig";

interface QuarterlyColumnCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedColumnIds: string[];
  onSave: (newColumnIds: string[]) => void;
  onResetDefaults: () => void;
}

export default function QuarterlyColumnCustomizerModal({
  isOpen,
  onClose,
  selectedColumnIds,
  onSave,
  onResetDefaults,
}: QuarterlyColumnCustomizerModalProps) {
  // Local working copy of selected columns
  const [currentSelection, setCurrentSelection] = useState<string[]>(selectedColumnIds);
  const [activeCategory, setActiveCategory] = useState<ColumnCategory>("most_used");
  const [searchQuery, setSearchQuery] = useState("");

  // Sync selection when modal opens or selectedColumnIds changes
  useEffect(() => {
    if (isOpen) {
      setCurrentSelection(selectedColumnIds);
    }
  }, [isOpen, selectedColumnIds]);

  // Toggle individual column
  const handleToggleColumn = (id: string) => {
    setCurrentSelection((prev) => {
      if (prev.includes(id)) {
        return prev.filter((colId) => colId !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  // Move column left/right in active order
  const handleMoveColumn = (index: number, direction: "left" | "right") => {
    const targetIndex = direction === "left" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= currentSelection.length) return;
    const newArr = [...currentSelection];
    const temp = newArr[index];
    newArr[index] = newArr[targetIndex];
    newArr[targetIndex] = temp;
    setCurrentSelection(newArr);
  };

  // Apply a preset
  const handleApplyPreset = (presetIds: string[]) => {
    setCurrentSelection([...presetIds]);
  };

  // Reset to default columns
  const handleReset = () => {
    setCurrentSelection([...DEFAULT_SCREENER_COLUMN_IDS]);
    onResetDefaults();
  };

  // Save and close
  const handleSave = () => {
    onSave(currentSelection);
    onClose();
  };

  // Filter columns based on search query or active category
  const filteredColumns = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      return ALL_AVAILABLE_COLUMNS.filter(
        (col) =>
          col.label.toLowerCase().includes(q) ||
          col.shortLabel.toLowerCase().includes(q) ||
          col.description.toLowerCase().includes(q) ||
          col.id.toLowerCase().includes(q)
      );
    }

    if (activeCategory === "most_used") {
      return ALL_AVAILABLE_COLUMNS.filter((col) => MOST_USED_COLUMN_IDS.includes(col.id));
    }

    return ALL_AVAILABLE_COLUMNS.filter((col) => col.category === activeCategory);
  }, [searchQuery, activeCategory]);

  // Group filtered columns into 3 columns: RECENT, PRECEDING, HISTORICAL
  const groupedBySubCategory = useMemo(() => {
    const recent: ColumnDefinition[] = [];
    const preceding: ColumnDefinition[] = [];
    const historical: ColumnDefinition[] = [];

    filteredColumns.forEach((col) => {
      if (col.subCategory === "RECENT") {
        recent.push(col);
      } else if (col.subCategory === "PRECEDING") {
        preceding.push(col);
      } else {
        historical.push(col);
      }
    });

    // If a subcategory is empty in the current view, distribute evenly across 3 columns
    if (recent.length === 0 || (preceding.length === 0 && historical.length === 0)) {
      const col1: ColumnDefinition[] = [];
      const col2: ColumnDefinition[] = [];
      const col3: ColumnDefinition[] = [];
      filteredColumns.forEach((col, idx) => {
        if (idx % 3 === 0) col1.push(col);
        else if (idx % 3 === 1) col2.push(col);
        else col3.push(col);
      });
      return {
        recent: col1,
        preceding: col2,
        historical: col3,
        customLabels: { recent: "METRICS (A)", preceding: "METRICS (B)", historical: "METRICS (C)" },
      };
    }

    return {
      recent,
      preceding,
      historical,
      customLabels: { recent: "RECENT", preceding: "PRECEDING", historical: "HISTORICAL" },
    };
  }, [filteredColumns]);

  // Active columns metadata
  const activeColMap = useMemo(() => {
    const map = new Map<string, ColumnDefinition>();
    ALL_AVAILABLE_COLUMNS.forEach((c) => map.set(c.id, c));
    return map;
  }, []);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col w-full max-w-5xl max-h-[90vh] rounded-2xl bg-white dark:bg-[#07111F] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ================================================================= */}
        {/* 1. TOP ACTION BAR (Exact Screener.in arrangement)                */}
        {/* ================================================================= */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800/80 bg-slate-50/70 dark:bg-[#050B14]/80">
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white dark:text-slate-950 text-xs font-mono font-bold uppercase tracking-wider transition-all shadow-md shadow-cyan-950/40 cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>SAVE COLUMNS</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 text-xs font-mono font-bold uppercase tracking-wider hover:bg-slate-100 dark:hover:bg-slate-700 transition-all cursor-pointer"
            >
              CANCEL
            </button>
            <span className="hidden sm:inline-block text-xs font-mono text-slate-500 ml-2">
              <strong className="text-cyan-600 dark:text-cyan-400 font-bold">{currentSelection.length}</strong> columns selected
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleReset}
              className="px-3 py-1.5 rounded-lg border border-amber-500/40 dark:border-rose-500/40 text-amber-700 dark:text-rose-400 bg-amber-50/50 dark:bg-rose-950/20 text-xs font-mono font-bold uppercase tracking-wider hover:bg-amber-100 dark:hover:bg-rose-950/40 transition-all cursor-pointer flex items-center gap-1.5"
              title="Reset to Screener.in standard default columns"
            >
              <RotateCcw className="w-3 h-3" />
              <span>RESET DEFAULTS</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ================================================================= */}
        {/* 2. SEARCH & HORIZONTAL CATEGORY TABS                             */}
        {/* ================================================================= */}
        <div className="px-6 pt-4 pb-2 border-b border-slate-200 dark:border-slate-800/60 bg-white dark:bg-[#07111F] space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Filter Ratios Search Input */}
            <div className="w-full sm:max-w-sm">
              <label className="block text-[11px] font-mono font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1">
                Filter Ratios
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="eg. return on capital, opm, sales, debt..."
                  className="w-full pl-3 pr-8 py-2 rounded-lg bg-slate-100 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 font-mono"
                />
                {searchQuery ? (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                )}
              </div>
            </div>

            {/* Presets Quick Picker */}
            <div className="flex items-center gap-1.5 flex-wrap sm:justify-end">
              <span className="text-[11px] font-mono text-slate-400 font-semibold mr-1 flex items-center gap-1">
                <SlidersHorizontal className="w-3 h-3 text-cyan-500" />
                Presets:
              </span>
              {COLUMN_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleApplyPreset(p.columnIds)}
                  className="px-2 py-1 rounded text-[11px] font-mono font-semibold bg-slate-100 hover:bg-cyan-100 text-slate-700 dark:bg-slate-800 dark:hover:bg-cyan-950/60 dark:text-slate-300 dark:hover:text-cyan-300 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Horizontal Category Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pt-1 pb-1 scrollbar-none text-xs font-mono">
            {CATEGORY_TABS.map((tab) => {
              const active = activeCategory === tab.id && !searchQuery;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveCategory(tab.id);
                    setSearchQuery("");
                  }}
                  className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-all cursor-pointer font-bold ${
                    active
                      ? "bg-cyan-500/15 border border-cyan-500/40 text-cyan-700 dark:text-cyan-300"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ================================================================= */}
        {/* 3. 3-COLUMN SELECTION GRID (Matching Screener.in layout)          */}
        {/* ================================================================= */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {filteredColumns.length === 0 ? (
            <div className="py-12 text-center text-slate-400 font-mono text-xs">
              No matching financial metric found for &quot;{searchQuery}&quot;. Try another search term.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Column 1: RECENT */}
              <div>
                <h4 className="text-[11px] font-mono font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-200 dark:border-slate-800/80 pb-1">
                  {groupedBySubCategory.customLabels.recent}
                </h4>
                <div className="space-y-2">
                  {groupedBySubCategory.recent.map((col) => {
                    const isChecked = currentSelection.includes(col.id);
                    return (
                      <label
                        key={col.id}
                        className={`flex items-start gap-2.5 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors cursor-pointer select-none ${
                          isChecked ? "text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-400"
                        }`}
                        title={col.description}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleColumn(col.id)}
                          className="mt-0.5 rounded border-slate-300 dark:border-slate-700 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                        />
                        <div className="flex flex-col">
                          <span className={`text-xs font-mono ${isChecked ? "font-bold" : "font-medium"}`}>
                            {col.label}
                          </span>
                          <span className="text-[10px] text-slate-400 truncate max-w-[240px]">
                            {col.description}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Column 2: PRECEDING */}
              <div>
                <h4 className="text-[11px] font-mono font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-200 dark:border-slate-800/80 pb-1">
                  {groupedBySubCategory.customLabels.preceding}
                </h4>
                <div className="space-y-2">
                  {groupedBySubCategory.preceding.map((col) => {
                    const isChecked = currentSelection.includes(col.id);
                    return (
                      <label
                        key={col.id}
                        className={`flex items-start gap-2.5 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors cursor-pointer select-none ${
                          isChecked ? "text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-400"
                        }`}
                        title={col.description}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleColumn(col.id)}
                          className="mt-0.5 rounded border-slate-300 dark:border-slate-700 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                        />
                        <div className="flex flex-col">
                          <span className={`text-xs font-mono ${isChecked ? "font-bold" : "font-medium"}`}>
                            {col.label}
                          </span>
                          <span className="text-[10px] text-slate-400 truncate max-w-[240px]">
                            {col.description}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Column 3: HISTORICAL */}
              <div>
                <h4 className="text-[11px] font-mono font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3 border-b border-slate-200 dark:border-slate-800/80 pb-1">
                  {groupedBySubCategory.customLabels.historical}
                </h4>
                <div className="space-y-2">
                  {groupedBySubCategory.historical.map((col) => {
                    const isChecked = currentSelection.includes(col.id);
                    return (
                      <label
                        key={col.id}
                        className={`flex items-start gap-2.5 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors cursor-pointer select-none ${
                          isChecked ? "text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-400"
                        }`}
                        title={col.description}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleColumn(col.id)}
                          className="mt-0.5 rounded border-slate-300 dark:border-slate-700 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
                        />
                        <div className="flex flex-col">
                          <span className={`text-xs font-mono ${isChecked ? "font-bold" : "font-medium"}`}>
                            {col.label}
                          </span>
                          <span className="text-[10px] text-slate-400 truncate max-w-[240px]">
                            {col.description}
                          </span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ================================================================= */}
        {/* 4. ACTIVE COLUMNS ORDER STRIP (Bottom Bar)                        */}
        {/* ================================================================= */}
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#050B14]/90 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Active Table Columns ({currentSelection.length}) · Reorder or Remove:
            </span>
            <button
              onClick={() => setCurrentSelection([])}
              className="text-[10px] font-mono text-rose-500 hover:text-rose-400 uppercase font-bold cursor-pointer"
            >
              Clear All
            </button>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {currentSelection.map((colId, index) => {
              const def = activeColMap.get(colId);
              const label = def?.shortLabel || colId;
              return (
                <div
                  key={colId}
                  className="flex items-center gap-1 pl-2 pr-1 py-1 rounded-md bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-xs font-mono text-slate-800 dark:text-slate-200 shrink-0 shadow-2xs group"
                >
                  <span className="text-[10px] text-cyan-600 dark:text-cyan-400 font-bold mr-0.5">
                    {index + 1}.
                  </span>
                  <span className="font-semibold">{label}</span>

                  <div className="flex items-center ml-1">
                    <button
                      onClick={() => handleMoveColumn(index, "left")}
                      disabled={index === 0}
                      className="p-0.5 text-slate-400 hover:text-cyan-500 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                      title="Move column left"
                    >
                      <ChevronLeft className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleMoveColumn(index, "right")}
                      disabled={index === currentSelection.length - 1}
                      className="p-0.5 text-slate-400 hover:text-cyan-500 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                      title="Move column right"
                    >
                      <ChevronRight className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleToggleColumn(colId)}
                      className="p-0.5 text-slate-400 hover:text-rose-500 cursor-pointer ml-0.5"
                      title="Remove column"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

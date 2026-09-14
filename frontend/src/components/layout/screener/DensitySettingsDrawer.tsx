"use client";

import React from "react";
import { X, Check, Sliders, Eye, Sparkles } from "lucide-react";

export type TableDensity = "default" | "comfortable" | "compact";

interface DensitySettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  density: TableDensity;
  onDensityChange: (density: TableDensity) => void;
}

export default function DensitySettingsDrawer({
  isOpen,
  onClose,
  density,
  onDensityChange,
}: DensitySettingsDrawerProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity"
        aria-hidden="true"
      />

      {/* Slide-in Drawer */}
      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col border-l border-slate-800 bg-[#0A1220] shadow-2xl transition-transform duration-300 ease-in-out"
        role="dialog"
        aria-label="Quick Settings"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800/90 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Sliders size={16} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Quick settings</h2>
              <p className="text-[11px] text-slate-400">Customize view & readability</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700/60 bg-slate-800/60 text-slate-400 transition hover:bg-slate-700 hover:text-white"
            aria-label="Close Settings"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Section: Density */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Density
              </h3>
              <span className="text-[10px] uppercase font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-800/40 px-2 py-0.5 rounded-md">
                Active: {density}
              </span>
            </div>

            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Adjust spacing and row height in the screener table to read more data or focus comfortably.
            </p>

            <div className="space-y-3">
              {/* 1. DEFAULT */}
              <button
                type="button"
                onClick={() => onDensityChange("default")}
                className={`group w-full flex items-center justify-between p-3.5 rounded-xl border text-left transition-all ${
                  density === "default"
                    ? "border-cyan-500 bg-cyan-950/20 shadow-md shadow-cyan-950/40"
                    : "border-slate-800 bg-slate-900/50 hover:border-slate-700 hover:bg-slate-900/80"
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Radio Indicator */}
                  <div
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition ${
                      density === "default"
                        ? "border-cyan-400 bg-cyan-400"
                        : "border-slate-600 group-hover:border-slate-400"
                    }`}
                  >
                    {density === "default" && (
                      <div className="h-1.5 w-1.5 rounded-full bg-[#0A1220]" />
                    )}
                  </div>

                  <div>
                    <span className="text-sm font-semibold text-white group-hover:text-cyan-300 transition">
                      Default
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Standard balanced row height and metric pills
                    </p>
                  </div>
                </div>

                {/* Graphical Preview Card (Gmail Default Style) */}
                <div className="shrink-0 w-24 h-14 rounded-lg border border-slate-700/80 bg-slate-950/80 p-1.5 flex flex-col justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-[2px] border border-slate-600" />
                    <div className="h-1.5 w-12 rounded bg-slate-600" />
                  </div>
                  <div className="flex items-center gap-1 pl-4">
                    <div className="h-4 w-14 rounded bg-cyan-500/25 border border-cyan-500/40 flex items-center justify-center">
                      <div className="h-1.5 w-8 rounded bg-cyan-300" />
                    </div>
                  </div>
                </div>
              </button>

              {/* 2. COMFORTABLE */}
              <button
                type="button"
                onClick={() => onDensityChange("comfortable")}
                className={`group w-full flex items-center justify-between p-3.5 rounded-xl border text-left transition-all ${
                  density === "comfortable"
                    ? "border-cyan-500 bg-cyan-950/20 shadow-md shadow-cyan-950/40"
                    : "border-slate-800 bg-slate-900/50 hover:border-slate-700 hover:bg-slate-900/80"
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Radio Indicator */}
                  <div
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition ${
                      density === "comfortable"
                        ? "border-cyan-400 bg-cyan-400"
                        : "border-slate-600 group-hover:border-slate-400"
                    }`}
                  >
                    {density === "comfortable" && (
                      <div className="h-1.5 w-1.5 rounded-full bg-[#0A1220]" />
                    )}
                  </div>

                  <div>
                    <span className="text-sm font-semibold text-white group-hover:text-cyan-300 transition">
                      Comfortable
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Spacious padding & relaxed reading layout
                    </p>
                  </div>
                </div>

                {/* Graphical Preview Card (Gmail Comfortable Style) */}
                <div className="shrink-0 w-24 h-14 rounded-lg border border-slate-700/80 bg-slate-950/80 p-2 flex flex-col justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-[2px] border border-slate-600" />
                    <div className="h-1.5 w-14 rounded bg-slate-500" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-[2px] border border-slate-600" />
                    <div className="h-1.5 w-11 rounded bg-slate-500" />
                  </div>
                </div>
              </button>

              {/* 3. COMPACT */}
              <button
                type="button"
                onClick={() => onDensityChange("compact")}
                className={`group w-full flex items-center justify-between p-3.5 rounded-xl border text-left transition-all ${
                  density === "compact"
                    ? "border-cyan-500 bg-cyan-950/20 shadow-md shadow-cyan-950/40"
                    : "border-slate-800 bg-slate-900/50 hover:border-slate-700 hover:bg-slate-900/80"
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Radio Indicator */}
                  <div
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition ${
                      density === "compact"
                        ? "border-cyan-400 bg-cyan-400"
                        : "border-slate-600 group-hover:border-slate-400"
                    }`}
                  >
                    {density === "compact" && (
                      <div className="h-1.5 w-1.5 rounded-full bg-[#0A1220]" />
                    )}
                  </div>

                  <div>
                    <span className="text-sm font-semibold text-white group-hover:text-cyan-300 transition">
                      Compact
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Dense rows to view maximum companies on screen
                    </p>
                  </div>
                </div>

                {/* Graphical Preview Card (Gmail Compact Style) */}
                <div className="shrink-0 w-24 h-14 rounded-lg border border-slate-700/80 bg-slate-950/80 p-1.5 flex flex-col justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-[2px] border border-slate-600" />
                    <div className="h-1 w-14 rounded bg-slate-500" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-[2px] border border-slate-600" />
                    <div className="h-1 w-12 rounded bg-slate-500" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-[2px] border border-slate-600" />
                    <div className="h-1 w-15 rounded bg-slate-500" />
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Institutional Note */}
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/10 p-3.5 text-xs text-slate-300">
            <div className="flex items-center gap-1.5 font-semibold text-cyan-400 mb-1">
              <Sparkles size={13} />
              <span>Pro Tip for Financial Analysis</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Use <strong className="text-white font-medium">Compact</strong> mode when scanning across all 5,000+ equities for quick ratio comparisons, and <strong className="text-white font-medium">Comfortable</strong> when presenting or reviewing specific stocks.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-800 p-4 bg-[#080E1A]">
          <button
            onClick={onClose}
            className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 py-2.5 text-center text-xs font-bold text-black shadow-md shadow-cyan-900/30 transition hover:opacity-95"
          >
            Apply & Close
          </button>
        </div>
      </aside>
    </>
  );
}

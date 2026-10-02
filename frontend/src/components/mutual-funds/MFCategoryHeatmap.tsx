"use client";

import { memo } from "react";
import {
  TrendingUp,
  TrendingDown,
  Layers,
  Flame,
  AlertTriangle,
  Info,
  ArrowRight,
  ShieldAlert,
  Zap,
} from "lucide-react";

interface CategoryItem {
  category: string;
  fund_count: number;
  total_aum_cr: number;
  avg_1m_pct: number;
  avg_3m_pct: number;
  avg_6m_pct: number;
  avg_1y_pct: number;
  regime: string;
  regime_color: string;
  signal_message: string;
  top_fund_name: string;
  top_fund_code: string | null;
  top_fund_6m: number | null;
}

interface DilutionAlert {
  type: string;
  severity: string;
  scheme_code: string;
  scheme_name: string;
  category: string;
  aum_cr: number;
  ter: number;
  headline: string;
  reason: string;
  suggested_action: string;
}

interface MFCategoryHeatmapProps {
  macroCommentary: string;
  heatmap: CategoryItem[];
  dilutionAlerts: DilutionAlert[];
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
}

function MFCategoryHeatmap({
  macroCommentary,
  heatmap,
  dilutionAlerts,
  selectedCategory,
  onSelectCategory,
}: MFCategoryHeatmapProps) {
  return (
    <div className="flex flex-col gap-5 mb-8">
      {/* ── Macro Capital Rotation Commentary Ribbon ── */}
      {macroCommentary && (
        <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-cyan-950/40 via-[#071120] to-cyan-950/20 p-4 shadow-lg shadow-cyan-950/20">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/20 border border-cyan-500/40 shrink-0 mt-0.5">
              <Zap size={18} className="text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-cyan-300 font-mono uppercase tracking-wider">
                  Macro Institutional Capital Rotation Radar
                </span>
                <span className="rounded bg-cyan-500/20 text-cyan-300 text-[10px] px-2 py-0.2 font-mono">
                  Live Style Regime
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                {macroCommentary}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Category Heatmap Grid ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono flex items-center gap-2">
            <Layers size={14} className="text-cyan-400" />
            Category Relative Strength Heatmap (Click to Filter Table)
          </h3>
          <span className="text-[11px] text-slate-500 font-mono">
            Ranked by 6-Month Institutional Outperformance
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {heatmap.map((item) => {
            const isSelected = selectedCategory === item.category;
            const isLeading = item.regime === "LEADING";
            const isLagging = item.regime === "LAGGING";

            return (
              <div
                key={item.category}
                onClick={() => onSelectCategory(item.category)}
                className={`cursor-pointer rounded-2xl border p-4 transition-all duration-200 relative overflow-hidden group ${
                  isSelected
                    ? "border-cyan-500 bg-cyan-950/30 shadow-lg shadow-cyan-950/40 ring-1 ring-cyan-500"
                    : isLeading
                    ? "border-emerald-500/40 bg-[#07131F] hover:border-emerald-500/70"
                    : isLagging
                    ? "border-slate-800 bg-[#070F1C] hover:border-slate-700"
                    : "border-slate-800 bg-[#071120] hover:border-slate-700"
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm text-white font-mono group-hover:text-cyan-400 transition">
                    {item.category}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold font-mono uppercase ${
                      item.regime === "LEADING"
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                        : item.regime === "ACCELERATING"
                        ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                        : item.regime === "CONSOLIDATING"
                        ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40"
                        : "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                    }`}
                  >
                    {item.regime}
                  </span>
                </div>

                {/* 6M & 3M Return Metrics */}
                <div className="grid grid-cols-2 gap-2 my-2.5 pt-2 border-t border-slate-800/80">
                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-mono">Avg 6M Return</span>
                    <strong
                      className={`text-sm font-bold font-mono ${
                        item.avg_6m_pct >= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {item.avg_6m_pct > 0 ? "+" : ""}{item.avg_6m_pct}%
                    </strong>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 block uppercase font-mono">Avg 3M Return</span>
                    <strong
                      className={`text-sm font-bold font-mono ${
                        item.avg_3m_pct >= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {item.avg_3m_pct > 0 ? "+" : ""}{item.avg_3m_pct}%
                    </strong>
                  </div>
                </div>

                {/* Top Fund in Category */}
                <div className="mt-2 pt-2 border-t border-slate-800/60 text-[11px]">
                  <span className="text-slate-500 block text-[10px]">Category Leader (6M):</span>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-slate-200 font-semibold truncate max-w-[150px]" title={item.top_fund_name}>
                      {item.top_fund_name}
                    </span>
                    <span className="text-emerald-400 font-mono font-bold shrink-0">
                      +{item.top_fund_6m}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Closet Indexers & Size Curse Warnings (Alpha Saviors) ── */}
      {dilutionAlerts.length > 0 && (
        <div className="rounded-2xl border border-rose-500/30 bg-[#0B101D] p-4">
          <div className="flex items-center justify-between mb-3 border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <ShieldAlert size={16} className="text-rose-400" />
              <h4 className="text-xs font-bold text-white font-mono uppercase tracking-wider">
                Fee Drag & AUM Dilution Warnings ({dilutionAlerts.length} Flagged)
              </h4>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">
              Save 0.8% - 1.2% in unnecessary active fee drag
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {dilutionAlerts.slice(0, 6).map((al, idx) => (
              <div
                key={`${al.scheme_code}-${idx}`}
                className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-3 text-xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-slate-200 font-mono text-[11px] truncate max-w-[180px]">
                      {al.scheme_name}
                    </span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded font-mono ${
                        al.type === "CLOSET_INDEXER"
                          ? "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                          : "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                      }`}
                    >
                      {al.type === "CLOSET_INDEXER" ? "CLOSET INDEX" : "SIZE DILUTION"}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {al.reason}
                  </p>
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between text-[10px]">
                  <span className="text-slate-500">TER: <strong className="text-rose-400">{al.ter}%</strong></span>
                  <span className="text-cyan-400 font-semibold font-mono">Action: Swap to Index/Agile</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(MFCategoryHeatmap);

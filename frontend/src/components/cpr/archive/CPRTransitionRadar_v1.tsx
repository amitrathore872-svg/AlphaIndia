"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Layers,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  Search,
  RefreshCw,
  Flame,
  Zap,
  Sparkles,
  ShieldCheck,
  Compass,
} from "lucide-react";
import { fetchCPRTransitions, type CPRTransitionItem } from "@/lib/cprApi";

interface CPRTransitionRadarProps {
  onSelectStock: (symbol: string) => void;
}

export default function CPRTransitionRadar({ onSelectStock }: CPRTransitionRadarProps) {
  const [timeframe, setTimeframe] = useState<"daily" | "weekly" | "monthly">("monthly");
  const [minTurnoverCr, setMinTurnoverCr] = useState<number>(1.0);
  const [minMarketCapCr, setMinMarketCapCr] = useState<number>(1000);
  const [minPrice, setMinPrice] = useState<number>(30);
  const [filterMode, setFilterMode] = useState<"elite_only" | "retest_only" | "breakout_only" | "coiled_only" | "all">("elite_only");
  const [items, setItems] = useState<CPRTransitionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>("");

  const loadTransitions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCPRTransitions(timeframe, minTurnoverCr, minMarketCapCr, minPrice, 60, filterMode);
      setItems(data || []);
    } catch (err) {
      console.error("Failed to load CPR transitions:", err);
    } finally {
      setLoading(false);
    }
  }, [timeframe, minTurnoverCr, minMarketCapCr, minPrice, filterMode]);

  useEffect(() => {
    loadTransitions();
  }, [loadTransitions]);

  const filteredItems = items.filter((item) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      item.symbol.toLowerCase().includes(q) ||
      item.company_name.toLowerCase().includes(q) ||
      item.sector.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-[#04101E] via-[#091B2E] to-[#04101E] p-6 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-inner">
                <Compass className="h-5 w-5 animate-spin-slow" />
              </div>
              <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                Institutional Breakout &amp; Retest Engine
                <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-mono font-bold text-emerald-300 border border-emerald-500/30">
                  ALL 8 GAPS AUDITED
                </span>
              </h2>
            </div>
            <p className="mt-2 text-xs text-slate-300 max-w-2xl leading-relaxed">
              Filters out classical bull traps by auditing <span className="text-emerald-300 font-semibold">Value Migration (Higher-Value CPR)</span>,{" "}
              <span className="text-cyan-300 font-semibold">Coiled Open (No Gap Exhaustion)</span>,{" "}
              <span className="text-amber-300 font-semibold">Overhead Runway (No 200 DMA Walls)</span>, and{" "}
              <span className="text-emerald-400 font-semibold">Throwback Retests (55%–61% Win Rate)</span> with ATR noise-cushioned stop losses.
            </p>
          </div>

          {/* Timeframe Pill Switcher */}
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-700/80 bg-slate-900/90 p-1.5 shadow-inner">
            <button
              onClick={() => setTimeframe("daily")}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition font-mono ${
                timeframe === "daily"
                  ? "bg-cyan-500 text-slate-950 shadow-md font-extrabold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Zap className="h-3.5 w-3.5" />
              Daily Squeeze
            </button>
            <button
              onClick={() => setTimeframe("weekly")}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition font-mono ${
                timeframe === "weekly"
                  ? "bg-cyan-500 text-slate-950 shadow-md font-extrabold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Weekly Squeeze
            </button>
            <button
              onClick={() => setTimeframe("monthly")}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition font-mono ${
                timeframe === "monthly"
                  ? "bg-cyan-500 text-slate-950 shadow-md font-extrabold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Flame className="h-3.5 w-3.5" />
              Monthly Squeeze
            </button>
          </div>
        </div>

        {/* Setup & Entry Mode Filter Buttons */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-800/80 pt-4">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-2">Institutional Filter:</span>
          <button
            onClick={() => setFilterMode("elite_only")}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold font-mono transition border ${
              filterMode === "elite_only"
                ? "bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-950/40"
                : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            ⭐ A+ Institutional (All 8 Gaps Fixed: 55-61% Win Rate)
          </button>
          <button
            onClick={() => setFilterMode("retest_only")}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold font-mono transition border ${
              filterMode === "retest_only"
                ? "bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-md shadow-cyan-950/40"
                : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            🔄 Retest Confirmed (Pullback Entry)
          </button>
          <button
            onClick={() => setFilterMode("breakout_only")}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold font-mono transition border ${
              filterMode === "breakout_only"
                ? "bg-teal-500/20 border-teal-500 text-teal-300 shadow-md shadow-teal-950/40"
                : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            🔥 All Active Breakouts
          </button>
          <button
            onClick={() => setFilterMode("coiled_only")}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold font-mono transition border ${
              filterMode === "coiled_only"
                ? "bg-amber-500/20 border-amber-500 text-amber-300 shadow-md shadow-amber-950/40"
                : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            ⏳ Coiled at CPR (Watchlist)
          </button>
          <button
            onClick={() => setFilterMode("all")}
            className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold font-mono transition border ${
              filterMode === "all"
                ? "bg-slate-700/50 border-slate-600 text-white"
                : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            🌐 All Setups
          </button>
        </div>

        {/* Filter bar: Search, Market Cap, Penny Filter, and Min Turnover */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/40 pt-3">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search ticker, company or sector..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-700/80 bg-slate-900/80 py-1.5 pl-9 pr-4 text-xs font-mono text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Market Cap >= 1000 Cr Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">M-Cap:</span>
              {[
                { label: "≥ ₹1,000 Cr", val: 1000 },
                { label: "≥ ₹2,500 Cr", val: 2500 },
                { label: "≥ ₹5,000 Cr", val: 5000 },
                { label: "All M-Cap", val: 0 },
              ].map((opt) => (
                <button
                  key={opt.val}
                  onClick={() => setMinMarketCapCr(opt.val)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-mono font-bold transition border ${
                    minMarketCapCr === opt.val
                      ? "bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm"
                      : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Penny Stock Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Penny Filter:</span>
              {[
                { label: "≥ ₹30", val: 30 },
                { label: "≥ ₹50", val: 50 },
                { label: "≥ ₹100", val: 100 },
                { label: "All Prices", val: 0 },
              ].map((opt) => (
                <button
                  key={opt.val}
                  onClick={() => setMinPrice(opt.val)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-mono font-bold transition border ${
                    minPrice === opt.val
                      ? "bg-cyan-500/20 border-cyan-500 text-cyan-300 shadow-sm"
                      : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Liquidity / Turnover Filter */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Liquidity:</span>
              {[1.0, 2.0, 5.0].map((val) => (
                <button
                  key={val}
                  onClick={() => setMinTurnoverCr(val)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-mono font-bold transition border ${
                    minTurnoverCr === val
                      ? "bg-teal-500/20 border-teal-500 text-teal-300"
                      : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  &gt; ₹{val} Cr
                </button>
              ))}
              <button
                onClick={loadTransitions}
                disabled={loading}
                className="ml-2 flex items-center gap-1 rounded-lg bg-slate-800/80 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-700 transition"
                title="Refresh Transitions"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Transition Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#070D18]/90 shadow-xl backdrop-blur-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 bg-slate-900/60 font-mono text-[11px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-4 py-3.5">Stock &amp; Market Cap</th>
                <th className="px-4 py-3.5 text-right">CMP (₹)</th>
                <th className="px-4 py-3.5 text-center">Quality Grade</th>
                <th className="px-4 py-3.5 text-center">Gap Audit Pillars</th>
                <th className="px-4 py-3.5 text-center">Trade Entry Plan (Buffered)</th>
                <th className="px-4 py-3.5 text-center">Volume Ratio</th>
                <th className="px-4 py-3.5 text-center">Setup State</th>
                <th className="px-4 py-3.5 text-right">Turnover / Vol</th>
                <th className="px-4 py-3.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <RefreshCw className="mx-auto h-6 w-6 animate-spin text-cyan-400" />
                    <p className="mt-2 text-xs">Auditing {timeframe} setups across all 8 structural gap filters...</p>
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    No stocks matching current filters for {timeframe} timeframe (M-Cap ≥ ₹{minMarketCapCr} Cr, Price ≥ ₹{minPrice}).
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isRetest = item.status === "RETEST_CONFIRMED";
                  const isBreakout = item.status === "BREAKOUT_ACTIVE";
                  const isInside = item.status === "SQUEEZED_AT_CPR";
                  const isBreakdown = item.status === "BREAKDOWN";

                  return (
                    <tr
                      key={item.symbol}
                      className="transition hover:bg-cyan-950/20 cursor-pointer"
                      onClick={() => onSelectStock(item.symbol)}
                    >
                      {/* Symbol & Name & Market Cap */}
                      <td className="px-4 py-3">
                        <div className="font-bold text-white flex items-center gap-1.5">
                          {item.symbol}
                          {item.is_gap_free_elite && (
                            <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300 border border-emerald-500/40">
                              ELITE
                            </span>
                          )}
                          {item.market_cap_category && (
                            <span className="rounded bg-slate-800/80 px-1.5 py-0.2 text-[8px] font-bold text-cyan-300 border border-cyan-800/40">
                              {item.market_cap_category}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate max-w-[150px]">
                          {item.company_name}
                        </div>
                        <div className="flex items-center gap-1.5 text-[9px] mt-0.5">
                          <span className="text-cyan-400/80">{item.sector}</span>
                          <span className="text-slate-500">•</span>
                          <span className="text-emerald-400 font-bold">
                            ₹{item.market_cap_cr ? Math.round(item.market_cap_cr).toLocaleString("en-IN") : "--"} Cr
                          </span>
                        </div>
                      </td>

                      {/* CMP */}
                      <td className="px-4 py-3 text-right font-bold text-white">
                        ₹{item.cmp.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        {item.breakout_pct !== undefined && item.breakout_pct > 0 && (
                          <div className="text-[9px] text-emerald-400 font-normal">
                            +{item.breakout_pct}% above TC
                          </div>
                        )}
                      </td>

                      {/* Quality Grade */}
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`rounded-lg px-2.5 py-1 text-[10px] font-bold font-mono border ${
                            item.grade === "A+ INSTITUTIONAL"
                              ? "bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm"
                              : item.grade === "A BREAKOUT"
                              ? "bg-teal-500/20 border-teal-500 text-teal-300"
                              : item.grade === "LOWER_VALUE_TRAP"
                              ? "bg-rose-500/20 border-rose-500 text-rose-300"
                              : item.grade === "COILED READY"
                              ? "bg-amber-500/20 border-amber-500 text-amber-300"
                              : "bg-slate-800 border-slate-700 text-slate-300"
                          }`}
                        >
                          {item.grade || "COILED"}
                        </span>
                        <div className="text-[9px] text-slate-400 mt-1">
                          {item.compression_ratio}x Vol Squeeze
                        </div>
                      </td>

                      {/* Gap Audit Pillars */}
                      <td className="px-4 py-3 text-center text-[10px]">
                        <div className="flex flex-col gap-1 items-center">
                          <div className="flex items-center gap-1.5">
                            {/* Value Migration */}
                            <span
                              className={`rounded px-1.5 py-0.5 text-[9px] font-bold border ${
                                item.value_relationship === "HIGHER_VALUE"
                                  ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-300"
                                  : item.value_relationship === "LOWER_VALUE"
                                  ? "bg-rose-950/60 border-rose-500/40 text-rose-300"
                                  : "bg-cyan-950/60 border-cyan-500/40 text-cyan-300"
                              }`}
                              title="Value Migration relative to prior period CPR"
                            >
                              {item.value_relationship || "INSIDE_VALUE"}
                            </span>

                            {/* Open Quality */}
                            {item.is_coiled_open !== undefined && (
                              <span
                                className={`rounded px-1.5 py-0.5 text-[9px] font-bold border ${
                                  item.is_coiled_open
                                    ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-300"
                                    : "bg-rose-950/60 border-rose-500/40 text-rose-300"
                                }`}
                                title={item.is_coiled_open ? "Coiled Open: No exhaustion" : "Gap-Up Exhaustion Risk"}
                              >
                                {item.is_coiled_open ? "Flat Open" : "Gap Trap"}
                              </span>
                            )}
                          </div>

                          {/* Runway Clearance & Spread */}
                          <div className="flex items-center gap-1.5 text-[9px] text-slate-400">
                            <span
                              className={item.has_clear_runway ? "text-emerald-400" : "text-amber-400"}
                              title="Airspace to nearest 20-day high / 200 DMA"
                            >
                              {item.has_clear_runway ? "✓ Clear Runway" : "⚠ Resistance Near"}
                            </span>
                            <span>•</span>
                            <span title="3 CPR Lines Spread">Spread: {item.cpr_spread_pct.toFixed(3)}%</span>
                          </div>
                        </div>
                      </td>

                      {/* Trade Entry Plan */}
                      <td className="px-4 py-3 text-center text-[10px]">
                        {item.entry_price ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center justify-center gap-2">
                              <span className="text-emerald-400 font-bold" title="Entry at TC / Retest">
                                Buy: ₹{item.entry_price}
                              </span>
                              <span className="text-rose-400" title="ATR-Noise Cushioned Stop Loss">
                                SL: ₹{item.stop_loss}
                              </span>
                            </div>
                            <div className="flex items-center justify-center gap-2 text-[9px] text-slate-300">
                              <span title="Target 1 (+1.5R)">T1: ₹{item.target_1}</span>
                              <span title="Target 2 (+2.5R)">T2: ₹{item.target_2}</span>
                              <span className="text-cyan-400 font-bold">({item.risk_reward})</span>
                            </div>
                          </div>
                        ) : (
                          <div className="text-slate-400">Trigger: &gt; ₹{item.breakout_trigger}</div>
                        )}
                      </td>

                      {/* Volume Ratio */}
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`rounded px-2 py-0.5 font-bold ${
                            (item.volume_ratio_20d || 1) >= 1.5
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              : (item.volume_ratio_20d || 1) >= 1.0
                              ? "bg-slate-800 text-slate-300 border border-slate-700"
                              : "bg-slate-900 text-slate-500"
                          }`}
                        >
                          {item.volume_ratio_20d ? `${item.volume_ratio_20d.toFixed(1)}x` : "1.0x"}
                        </span>
                        <div className="text-[9px] text-slate-400 mt-1">20d Avg Vol</div>
                      </td>

                      {/* Setup State */}
                      <td className="px-4 py-3 text-center">
                        {isRetest && (
                          <div className="inline-flex flex-col items-center">
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-1 text-[10px] font-bold text-emerald-300 border border-emerald-500/40 shadow-sm shadow-emerald-950/50">
                              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                              RETEST CONFIRMED
                            </span>
                            <span className="text-[9px] text-emerald-400 mt-0.5">Tested ₹{item.tc} as Support</span>
                          </div>
                        )}
                        {isBreakout && (
                          <div className="inline-flex flex-col items-center">
                            <span className="inline-flex items-center gap-1 rounded-full bg-teal-500/20 px-2.5 py-1 text-[10px] font-bold text-teal-300 border border-teal-500/40 shadow-sm shadow-teal-950/50">
                              BREAKOUT ACTIVE
                            </span>
                            <span className="text-[9px] text-teal-400 mt-0.5">&gt; TC ₹{item.tc}</span>
                          </div>
                        )}
                        {isInside && (
                          <div className="inline-flex flex-col items-center">
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2.5 py-1 text-[10px] font-bold text-amber-300 border border-amber-500/40">
                              COILED AT CPR
                            </span>
                            <span className="text-[9px] text-amber-400 mt-0.5">Trigger: &gt; ₹{item.tc}</span>
                          </div>
                        )}
                        {isBreakdown && (
                          <div className="inline-flex flex-col items-center">
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/20 px-2.5 py-1 text-[10px] font-bold text-rose-300 border border-rose-500/40">
                              BREAKDOWN (&lt; BC)
                            </span>
                            <span className="text-[9px] text-rose-400 mt-0.5">&lt; BC ₹{item.bc}</span>
                          </div>
                        )}
                      </td>

                      {/* Turnover & 20d Volume */}
                      <td className="px-4 py-3 text-right">
                        <div className="font-bold text-slate-200">₹{item.turnover_cr.toFixed(2)} Cr</div>
                        <div className="text-[9px] text-slate-400">
                          {item.avg_volume_20d
                            ? item.avg_volume_20d >= 100000
                              ? `${(item.avg_volume_20d / 100000).toFixed(1)}L vol`
                              : `${Math.round(item.avg_volume_20d / 1000)}k vol`
                            : ""}
                        </div>
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => onSelectStock(item.symbol)}
                          className="rounded-lg bg-cyan-500/10 px-2.5 py-1.5 text-[11px] font-bold text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/20 transition"
                        >
                          Deep Dive
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

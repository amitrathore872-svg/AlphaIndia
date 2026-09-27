"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Layers,
  Search,
  RefreshCw,
  Zap,
  ShieldCheck,
  Compass,
  Clock,
  Calendar,
  SlidersHorizontal,
  ArrowUpDown,
  ExternalLink,
} from "lucide-react";
import { fetchZerodhaCPR, type ZerodhaCPRItem } from "@/lib/cprApi";

interface CPRTransitionRadarProps {
  onSelectStock: (symbol: string) => void;
}

export default function CPRTransitionRadar({ onSelectStock }: CPRTransitionRadarProps) {
  const [timeframe, setTimeframe] = useState<"hourly" | "daily" | "weekly" | "monthly">("daily");
  const [maxWidthPct, setMaxWidthPct] = useState<number | undefined>(0.35);
  const [maxDistPct, setMaxDistPct] = useState<number | undefined>(2.0);
  const [sortBy, setSortBy] = useState<string>("cpr_width_pct");
  const [minTurnoverCr, setMinTurnoverCr] = useState<number>(1.0);
  const [minMarketCapCr, setMinMarketCapCr] = useState<number>(1000);
  const [minPrice, setMinPrice] = useState<number>(30);
  const [items, setItems] = useState<ZerodhaCPRItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>("");

  const loadZerodhaData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchZerodhaCPR(
        timeframe,
        maxWidthPct,
        maxDistPct,
        minTurnoverCr,
        minMarketCapCr,
        minPrice,
        sortBy,
        80
      );
      setItems(data || []);
    } catch (err) {
      console.error("Failed to load Zerodha CPR data:", err);
    } finally {
      setLoading(false);
    }
  }, [timeframe, maxWidthPct, maxDistPct, minTurnoverCr, minMarketCapCr, minPrice, sortBy]);

  useEffect(() => {
    loadZerodhaData();
  }, [loadZerodhaData]);

  const filteredItems = items.filter((item) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      item.symbol.toLowerCase().includes(q) ||
      item.company_name.toLowerCase().includes(q) ||
      item.sector.toLowerCase().includes(q)
    );
  });

  const getPositionBadge = (pos: string) => {
    switch (pos) {
      case "AT_TC":
        return <span className="rounded bg-cyan-500/20 px-2 py-0.5 text-[11px] font-mono font-bold text-cyan-300 border border-cyan-500/40">TESTING TC</span>;
      case "AT_BC":
        return <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[11px] font-mono font-bold text-amber-300 border border-amber-500/40">TESTING BC</span>;
      case "AT_PIVOT":
        return <span className="rounded bg-indigo-500/20 px-2 py-0.5 text-[11px] font-mono font-bold text-indigo-300 border border-indigo-500/40">AT PIVOT</span>;
      case "INSIDE_CPR":
        return <span className="rounded bg-purple-500/20 px-2 py-0.5 text-[11px] font-mono font-bold text-purple-300 border border-purple-500/40">INSIDE CPR</span>;
      case "ABOVE_CPR":
        return <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[11px] font-mono font-bold text-emerald-300 border border-emerald-500/40">ABOVE CPR</span>;
      case "BELOW_CPR":
        return <span className="rounded bg-rose-500/20 px-2 py-0.5 text-[11px] font-mono font-bold text-rose-300 border border-rose-500/40">BELOW CPR</span>;
      default:
        return <span className="rounded bg-slate-700/40 px-2 py-0.5 text-[11px] font-mono text-slate-300">{pos}</span>;
    }
  };

  const getWidthBadge = (w: number) => {
    if (w <= 0.05) return <span className="text-emerald-400 font-bold">Ultra-Tight</span>;
    if (w <= 0.15) return <span className="text-cyan-400 font-semibold">Tight</span>;
    if (w <= 0.30) return <span className="text-blue-300">Moderate</span>;
    return <span className="text-slate-400">Normal</span>;
  };

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-[#04101E] via-[#091B2E] to-[#04101E] p-6 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 shadow-inner">
                <Compass className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                Zerodha CPR Scanner
                <span className="rounded-full bg-cyan-500/20 px-2.5 py-0.5 text-[10px] font-mono font-bold text-cyan-300 border border-cyan-500/30">
                  ALL TIMEFRAMES
                </span>
              </h2>
            </div>
            <p className="mt-2 text-xs text-slate-300 max-w-2xl leading-relaxed">
              Real-time scanner matching Zerodha Kite CPR indicator formulas:{" "}
              <span className="text-cyan-300 font-mono font-semibold">Pivot = (H+L+C)/3</span>,{" "}
              <span className="text-emerald-300 font-mono font-semibold">BC = (H+L)/2</span>,{" "}
              <span className="text-amber-300 font-mono font-semibold">TC = (2*P) - BC</span>.{" "}
              Filters for <span className="text-white font-semibold">3 Lines Close (Narrow CPR)</span> and{" "}
              <span className="text-white font-semibold">Stock Close to CPR Line</span>.
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
              <span className="inline-flex items-center gap-1 rounded bg-slate-800/80 px-2 py-0.5 border border-slate-700 font-mono">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                M-Cap &ge; ₹1,000 Cr
              </span>
              <span className="inline-flex items-center gap-1 rounded bg-slate-800/80 px-2 py-0.5 border border-slate-700 font-mono">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                Turnover &ge; ₹1.0 Cr
              </span>
              <span className="inline-flex items-center gap-1 rounded bg-slate-800/80 px-2 py-0.5 border border-slate-700 font-mono">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                Price &ge; ₹30 (No Pennies)
              </span>
            </div>
          </div>

          {/* Timeframe Pill Switcher */}
          <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-700/80 bg-slate-900/90 p-1.5 shadow-inner">
            <button
              onClick={() => setTimeframe("hourly")}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition font-mono ${
                timeframe === "hourly"
                  ? "bg-amber-500 text-slate-950 shadow-md font-extrabold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              Hourly (60m)
            </button>
            <button
              onClick={() => setTimeframe("daily")}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition font-mono ${
                timeframe === "daily"
                  ? "bg-cyan-500 text-slate-950 shadow-md font-extrabold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Zap className="h-3.5 w-3.5" />
              Daily (1D)
            </button>
            <button
              onClick={() => setTimeframe("weekly")}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition font-mono ${
                timeframe === "weekly"
                  ? "bg-emerald-500 text-slate-950 shadow-md font-extrabold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Calendar className="h-3.5 w-3.5" />
              Weekly (1W)
            </button>
            <button
              onClick={() => setTimeframe("monthly")}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition font-mono ${
                timeframe === "monthly"
                  ? "bg-purple-500 text-slate-950 shadow-md font-extrabold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              Monthly (1M)
            </button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* 3 Lines Close Filter */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-400 font-mono text-[11px]">3 Lines Close (Width):</span>
              <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-lg border border-slate-700/60 font-mono text-[11px]">
                <button
                  onClick={() => setMaxWidthPct(0.10)}
                  className={`px-2 py-0.5 rounded ${maxWidthPct === 0.10 ? "bg-cyan-500/30 text-cyan-300 font-bold border border-cyan-500/40" : "text-slate-400 hover:text-white"}`}
                >
                  &le; 0.10% (Ultra)
                </button>
                <button
                  onClick={() => setMaxWidthPct(0.20)}
                  className={`px-2 py-0.5 rounded ${maxWidthPct === 0.20 ? "bg-cyan-500/30 text-cyan-300 font-bold border border-cyan-500/40" : "text-slate-400 hover:text-white"}`}
                >
                  &le; 0.20% (Tight)
                </button>
                <button
                  onClick={() => setMaxWidthPct(0.35)}
                  className={`px-2 py-0.5 rounded ${maxWidthPct === 0.35 ? "bg-cyan-500/30 text-cyan-300 font-bold border border-cyan-500/40" : "text-slate-400 hover:text-white"}`}
                >
                  &le; 0.35% (All Close)
                </button>
                <button
                  onClick={() => setMaxWidthPct(undefined)}
                  className={`px-2 py-0.5 rounded ${maxWidthPct === undefined ? "bg-slate-700 text-white font-bold" : "text-slate-400 hover:text-white"}`}
                >
                  Any Width
                </button>
              </div>
            </div>

            {/* Stock Close to CPR Distance Filter */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-slate-400 font-mono text-[11px]">Stock Close to CPR:</span>
              <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-lg border border-slate-700/60 font-mono text-[11px]">
                <button
                  onClick={() => setMaxDistPct(0.5)}
                  className={`px-2 py-0.5 rounded ${maxDistPct === 0.5 ? "bg-emerald-500/30 text-emerald-300 font-bold border border-emerald-500/40" : "text-slate-400 hover:text-white"}`}
                >
                  &le; 0.5% (At CPR)
                </button>
                <button
                  onClick={() => setMaxDistPct(1.0)}
                  className={`px-2 py-0.5 rounded ${maxDistPct === 1.0 ? "bg-emerald-500/30 text-emerald-300 font-bold border border-emerald-500/40" : "text-slate-400 hover:text-white"}`}
                >
                  &le; 1.0% (Near)
                </button>
                <button
                  onClick={() => setMaxDistPct(2.0)}
                  className={`px-2 py-0.5 rounded ${maxDistPct === 2.0 ? "bg-emerald-500/30 text-emerald-300 font-bold border border-emerald-500/40" : "text-slate-400 hover:text-white"}`}
                >
                  &le; 2.0%
                </button>
                <button
                  onClick={() => setMaxDistPct(undefined)}
                  className={`px-2 py-0.5 rounded ${maxDistPct === undefined ? "bg-slate-700 text-white font-bold" : "text-slate-400 hover:text-white"}`}
                >
                  Any Dist
                </button>
              </div>
            </div>
          </div>

          {/* Sort By Selector & Refresh */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-slate-900/80 px-2 py-1 rounded-lg border border-slate-700/60 text-xs font-mono">
              <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-transparent text-slate-200 outline-none text-xs cursor-pointer"
              >
                <option value="cpr_width_pct" className="bg-slate-900 text-slate-200">Narrowest CPR First</option>
                <option value="dist_to_cpr_pct" className="bg-slate-900 text-slate-200">Closest to CPR First</option>
                <option value="turnover_cr" className="bg-slate-900 text-slate-200">Highest Turnover</option>
                <option value="market_cap_cr" className="bg-slate-900 text-slate-200">Highest Market Cap</option>
              </select>
            </div>

            <button
              onClick={() => loadZerodhaData()}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition"
              title="Refresh Scanner"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-cyan-400" : ""}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-[#071322]/80 px-4 py-2.5 shadow-md">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search stock symbol, company name, or sector..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-700/80 bg-slate-900/90 py-1.5 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
          />
        </div>
        <div className="text-xs text-slate-400 font-mono">
          Found <span className="font-bold text-cyan-400">{filteredItems.length}</span> qualified setups
        </div>
      </div>

      {/* Main Results Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-[#06101E] shadow-xl">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-800 bg-slate-900/80 text-[11px] font-mono uppercase tracking-wider text-slate-400">
            <tr>
              <th className="py-3 px-4">Stock / Company</th>
              <th className="py-3 px-3">CMP</th>
              <th className="py-3 px-3">Pivot (P)</th>
              <th className="py-3 px-3">BC (Bottom)</th>
              <th className="py-3 px-3">TC (Top)</th>
              <th className="py-3 px-3">3-Lines Width</th>
              <th className="py-3 px-3">Dist to CPR</th>
              <th className="py-3 px-3">Position</th>
              <th className="py-3 px-3">Turnover</th>
              <th className="py-3 px-3">Market Cap</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {loading ? (
              <tr>
                <td colSpan={11} className="py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <RefreshCw className="h-6 w-6 animate-spin text-cyan-400" />
                    <span>Scanning Zerodha CPR across {timeframe.toUpperCase()} universe...</span>
                  </div>
                </td>
              </tr>
            ) : filteredItems.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-12 text-center text-slate-400">
                  No stocks found matching the criteria. Try loosening the width or distance filters.
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => (
                <tr
                  key={item.symbol}
                  className="hover:bg-slate-800/40 transition cursor-pointer"
                  onClick={() => onSelectStock(item.symbol)}
                >
                  <td className="py-3 px-4">
                    <div className="font-bold text-white flex items-center gap-1.5">
                      {item.symbol}
                      <span className="rounded bg-slate-800 px-1.5 py-0.2 text-[9px] text-slate-400">
                        {item.market_cap_category}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 truncate max-w-[180px] font-sans">
                      {item.company_name}
                    </div>
                  </td>
                  <td className="py-3 px-3 font-bold text-white">
                    ₹{item.cmp.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-3 text-cyan-300 font-semibold">
                    ₹{item.pivot.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-3 text-amber-300">
                    ₹{item.bc.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-3 text-emerald-300">
                    ₹{item.tc.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-white">{item.cpr_width_pct}%</span>
                      <span className="text-[10px]">{getWidthBadge(item.cpr_width_pct)}</span>
                    </div>
                    <div className="text-[10px] text-slate-500">₹{item.cpr_width} pts</div>
                  </td>
                  <td className="py-3 px-3 font-semibold">
                    <span className={item.dist_to_cpr_pct <= 0.5 ? "text-emerald-400" : item.dist_to_cpr_pct <= 1.0 ? "text-cyan-300" : "text-slate-300"}>
                      {item.dist_to_cpr_pct}%
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    {getPositionBadge(item.cpr_position)}
                  </td>
                  <td className="py-3 px-3 text-slate-300">
                    ₹{item.turnover_cr.toFixed(1)} Cr
                  </td>
                  <td className="py-3 px-3 text-slate-400">
                    ₹{Math.round(item.market_cap_cr).toLocaleString("en-IN")} Cr
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectStock(item.symbol);
                      }}
                      className="inline-flex items-center gap-1 rounded bg-cyan-500/20 px-2.5 py-1 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/30 transition border border-cyan-500/40"
                    >
                      Deep Dive
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

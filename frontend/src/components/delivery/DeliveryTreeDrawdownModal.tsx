"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Activity,
  Layers,
  Sparkles,
  Zap,
  ShieldAlert,
  ArrowDownRight,
  RefreshCw,
  ExternalLink,
  X,
  Maximize2,
  Minimize2,
  Calendar,
  Filter,
} from "lucide-react";
import {
  DeliveryTreeResponse,
  DeliveryWeekNode,
  DeliveryDayNode,
  fetchDeliveryTreeBreakdown,
} from "@/lib/deliveryRadarApi";

interface DeliveryTreeDrawdownModalProps {
  symbol: string | null;
  companyName?: string;
  onClose: () => void;
}

export default function DeliveryTreeDrawdownModal({
  symbol,
  companyName,
  onClose,
}: DeliveryTreeDrawdownModalProps) {
  const [data, setData] = useState<DeliveryTreeResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedWeeks, setExpandedWeeks] = useState<Record<string, boolean>>({});
  const [dayFilter, setDayFilter] = useState<"ALL" | "GREEN" | "HIGH_DELIV">("ALL");

  useEffect(() => {
    if (!symbol) return;
    let isMounted = true;
    setLoading(true);
    setError(null);

    fetchDeliveryTreeBreakdown(symbol, 30)
      .then((res) => {
        if (!isMounted) return;
        setData(res);
        // By default, expand the latest 2 weeks
        const initialExpanded: Record<string, boolean> = {};
        res.weeks.forEach((w, idx) => {
          initialExpanded[w.week_key] = idx < 2; // expand most recent 2 weeks
        });
        setExpandedWeeks(initialExpanded);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "Failed to load 30-day delivery tree.");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [symbol]);

  const toggleWeek = (weekKey: string) => {
    setExpandedWeeks((prev) => ({
      ...prev,
      [weekKey]: !prev[weekKey],
    }));
  };

  const expandAll = () => {
    if (!data) return;
    const allExp: Record<string, boolean> = {};
    data.weeks.forEach((w) => {
      allExp[w.week_key] = true;
    });
    setExpandedWeeks(allExp);
  };

  const collapseAll = () => {
    setExpandedWeeks({});
  };

  if (!symbol) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-5 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-[#070e1b] overflow-hidden">
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
                  {symbol}
                </span>
                {data?.month_summary?.blast_badge && (
                  <span className="rounded-md border border-cyan-500/30 bg-cyan-500/15 px-2.5 py-0.5 text-xs font-semibold text-cyan-300">
                    {data.month_summary.blast_badge}
                  </span>
                )}
                <a
                  href={`https://in.tradingview.com/chart/?symbol=NSE:${encodeURIComponent(symbol.replace(/\.NS$|\.BO$/i, "").trim())}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-400 hover:text-cyan-400 transition"
                  title="Open on TradingView"
                >
                  <ExternalLink size={13} />
                </a>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <span>{companyName || symbol}</span>
                <span>•</span>
                <span className="text-slate-400">30-Day Month → Week → Day Delivery & Drawdown Tree</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/delivery-radar/${encodeURIComponent(symbol)}`}
              className="flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-500 hover:text-slate-950 transition shadow-xs"
              title={`Open full dedicated delivery radar page for ${symbol}`}
            >
              <Maximize2 size={13} />
              <span className="hidden sm:inline">Dedicated Page</span>
            </Link>

            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
              title="Close modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
              <RefreshCw className="h-8 w-8 animate-spin text-cyan-400" />
              <p className="text-sm font-medium">Reconstructing 30-day session delivery tree & drawdowns...</p>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-300">
              {error}
            </div>
          ) : data ? (
            <>
              {/* MONTH OVERVIEW METRIC RIBBON */}
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6 text-xs">
                {/* 1. Month Return */}
                <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800/80 dark:bg-slate-900/60">
                  <span className="text-[10px] uppercase font-bold text-slate-400">30D Return</span>
                  <div className={`mt-1 text-base font-extrabold flex items-center gap-1 ${data.month_summary.month_return_pct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {data.month_summary.month_return_pct >= 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
                    <span>{data.month_summary.month_return_pct >= 0 ? `+${data.month_summary.month_return_pct}%` : `${data.month_summary.month_return_pct}%`}</span>
                  </div>
                  <span className="text-[10px] text-slate-400">₹{data.month_summary.start_price} → ₹{data.month_summary.end_price}</span>
                </div>

                {/* 2. Month Max Drawdown */}
                <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800/80 dark:bg-slate-900/60">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Peak-to-Trough DD</span>
                  <div className="mt-1 text-base font-extrabold text-amber-400 flex items-center gap-1">
                    <ArrowDownRight size={15} />
                    <span>{data.month_summary.month_max_drawdown_pct}%</span>
                  </div>
                  <span className="text-[10px] text-slate-400">Peak: ₹{data.month_summary.month_peak_price}</span>
                </div>

                {/* 3. Pullback From Peak */}
                <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800/80 dark:bg-slate-900/60">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Current Pivot Dist</span>
                  <div className="mt-1 text-base font-extrabold text-cyan-400">
                    {data.month_summary.current_drawdown_from_peak_pct}%
                  </div>
                  <span className="text-[10px] text-slate-400">{Math.abs(data.month_summary.current_drawdown_from_peak_pct) <= 3.5 ? "Near 30D Pivot" : "Consolidating"}</span>
                </div>

                {/* 4. Total Net Demat Turnover */}
                <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800/80 dark:bg-slate-900/60">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Demat Absorbed</span>
                  <div className="mt-1 text-base font-extrabold text-indigo-400">
                    ₹{data.month_summary.total_delivery_cr} Cr
                  </div>
                  <span className="text-[10px] text-slate-400">Avg Deliv: {data.month_summary.avg_delivery_per}%</span>
                </div>

                {/* 5. D-A/D Flow Imbalance */}
                <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800/80 dark:bg-slate-900/60">
                  <span className="text-[10px] uppercase font-bold text-slate-400">30D Flow Ratio</span>
                  <div className={`mt-1 text-base font-extrabold ${data.month_summary.delivery_flow_imbalance_ratio >= 1.5 ? "text-emerald-400" : "text-slate-300"}`}>
                    {data.month_summary.delivery_flow_imbalance_ratio}x
                  </div>
                  <span className="text-[10px] text-slate-400">{data.month_summary.green_days_count} Green vs {data.month_summary.red_days_count} Red</span>
                </div>

                {/* 6. Volatility Squeeze */}
                <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800/80 dark:bg-slate-900/60">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Base Squeeze</span>
                  <div className={`mt-1 text-base font-extrabold ${data.month_summary.range_squeeze_ratio <= 0.85 ? "text-emerald-400" : "text-slate-300"}`}>
                    {data.month_summary.range_squeeze_ratio}x
                  </div>
                  <span className="text-[10px] text-slate-400">{data.month_summary.range_squeeze_ratio <= 0.85 ? "Spring Coiling" : "Normal Volatility"}</span>
                </div>
              </div>

              {/* TREE CONTROLS & FILTER */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-slate-50/70 p-2.5 dark:border-slate-800/80 dark:bg-slate-900/40 text-xs">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <Calendar size={13} className="text-cyan-400" />
                  <span className="font-semibold text-slate-200">
                    Date Range: {data.month_summary.start_date} – {data.month_summary.end_date}
                  </span>
                  <span>({data.lookback_sessions} Market Sessions)</span>
                </div>

                <div className="flex items-center gap-2">
                  {/* Day Filter */}
                  <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/60 p-0.5">
                    <button
                      onClick={() => setDayFilter("ALL")}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${dayFilter === "ALL" ? "bg-cyan-600 text-white" : "text-slate-400 hover:text-white"}`}
                    >
                      All Sessions
                    </button>
                    <button
                      onClick={() => setDayFilter("GREEN")}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${dayFilter === "GREEN" ? "bg-emerald-600 text-white" : "text-slate-400 hover:text-white"}`}
                    >
                      Green Days
                    </button>
                    <button
                      onClick={() => setDayFilter("HIGH_DELIV")}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition ${dayFilter === "HIGH_DELIV" ? "bg-purple-600 text-white" : "text-slate-400 hover:text-white"}`}
                    >
                      Deliv ≥55%
                    </button>
                  </div>

                  <button
                    onClick={expandAll}
                    className="flex items-center gap-1 rounded-lg border border-slate-700/80 bg-slate-800/60 px-2.5 py-1 text-[11px] text-slate-300 hover:bg-slate-700"
                  >
                    <Maximize2 size={11} />
                    <span>Expand All</span>
                  </button>
                  <button
                    onClick={collapseAll}
                    className="flex items-center gap-1 rounded-lg border border-slate-700/80 bg-slate-800/60 px-2.5 py-1 text-[11px] text-slate-300 hover:bg-slate-700"
                  >
                    <Minimize2 size={11} />
                    <span>Collapse</span>
                  </button>
                </div>
              </div>

              {/* TREE BREAKDOWN: WEEKS & DAYS */}
              <div className="space-y-3 font-sans">
                {data.weeks.map((week) => {
                  const isExpanded = !!expandedWeeks[week.week_key];
                  const filteredDays = week.days
                    .filter((d) => {
                      if (dayFilter === "GREEN") return d.is_green;
                      if (dayFilter === "HIGH_DELIV") return d.delivery_per >= 55.0;
                      return true;
                    })
                    .sort((a, b) => b.date.localeCompare(a.date));

                  return (
                    <div
                      key={week.week_key}
                      className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#0a1324] overflow-hidden transition"
                    >
                      {/* WEEK BRANCH HEADER */}
                      <button
                        onClick={() => toggleWeek(week.week_key)}
                        className="flex w-full items-center justify-between p-3.5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/40"
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 dark:bg-slate-800 text-slate-400">
                            {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                          </span>
                          <div>
                            <span className="font-bold text-slate-900 dark:text-white text-xs">
                              {week.week_label}
                            </span>
                            <span className="ml-2 rounded bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 text-[10px] font-mono text-slate-500 dark:text-slate-400">
                              {week.days.length} trading days
                            </span>
                          </div>
                        </div>

                        {/* Week KPI Badges */}
                        <div className="flex items-center gap-3 text-xs">
                          {/* Week Return */}
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-400">Return:</span>
                            <span className={`font-mono font-bold ${week.week_return_pct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                              {week.week_return_pct >= 0 ? `+${week.week_return_pct}%` : `${week.week_return_pct}%`}
                            </span>
                          </div>

                          {/* Week Drawdown */}
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-400">Week DD:</span>
                            <span className="font-mono font-bold text-amber-400">
                              {week.week_drawdown_pct}%
                            </span>
                          </div>

                          {/* Week Delivery Turnover */}
                          <div className="hidden sm:flex items-center gap-1">
                            <span className="text-[10px] text-slate-400">Deliv Absorbed:</span>
                            <span className="font-mono font-bold text-indigo-400">
                              ₹{week.total_delivery_cr} Cr
                            </span>
                          </div>

                          {/* Week Avg Delivery % */}
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-400">Avg Deliv:</span>
                            <span className={`font-mono font-bold ${week.avg_delivery_per >= 58 ? "text-emerald-400" : "text-slate-300"}`}>
                              {week.avg_delivery_per}%
                            </span>
                          </div>

                          {/* Net Bias Badge */}
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${week.net_flow_bias === "ACCUMULATION" ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-700 text-slate-300"}`}>
                            {week.net_flow_bias === "ACCUMULATION" ? "Inflow" : "Range"}
                          </span>
                        </div>
                      </button>

                      {/* DAYS LEAF LIST */}
                      {isExpanded && (
                        <div className="border-t border-slate-200/60 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#070e1b]/70 p-3 pl-6">
                          {filteredDays.length === 0 ? (
                            <p className="py-2 text-center text-xs text-slate-500">
                              No sessions match current filter in this week.
                            </p>
                          ) : (
                            <div className="space-y-2 border-l-2 border-slate-200 dark:border-slate-800/80 pl-3">
                              {filteredDays.map((day) => {
                                return (
                                  <div
                                    key={day.date}
                                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200/50 dark:border-slate-800/60 bg-white/70 dark:bg-slate-900/50 p-2.5 text-xs transition hover:bg-slate-100/70 dark:hover:bg-slate-800/40"
                                  >
                                    {/* Left: Date, Day Name & Price */}
                                    <div className="flex items-center gap-2.5 min-w-[200px]">
                                      <div className={`h-2 w-2 rounded-full ${day.is_green ? "bg-emerald-400 shadow-sm shadow-emerald-400/50" : "bg-rose-400"}`} />
                                      <div>
                                        <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                                          <span>{day.day_label}</span>
                                          <span className="font-mono text-slate-400 text-[11px]">(₹{day.close})</span>
                                        </div>
                                        <div className="text-[10px] text-slate-400">
                                          O: ₹{day.open} | H: ₹{day.high} | L: ₹{day.low}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Return & Drawdown from 30D Peak */}
                                    <div className="flex items-center gap-3">
                                      <div className="text-right">
                                        <div className={`font-mono font-bold ${day.return_pct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                                          {day.return_pct >= 0 ? `+${day.return_pct}%` : `${day.return_pct}%`}
                                        </div>
                                        <div className="text-[9px] text-slate-400">Day Return</div>
                                      </div>

                                      <div className="text-right">
                                        <div className="font-mono font-bold text-amber-400">
                                          {day.drawdown_from_month_peak_pct}%
                                        </div>
                                        <div className="text-[9px] text-slate-400">From 30D High</div>
                                      </div>
                                    </div>

                                    {/* Delivery % & Progress Bar */}
                                    <div className="w-28 text-center">
                                      <div className="font-mono font-bold text-slate-200 flex items-center justify-between">
                                        <span className="text-[10px] text-slate-400">Deliv:</span>
                                        <span className={day.delivery_per >= 60 ? "text-emerald-400" : "text-slate-300"}>
                                          {day.delivery_per}%
                                        </span>
                                      </div>
                                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                                        <div
                                          className={`h-full rounded-full ${day.delivery_per >= 60 ? "bg-emerald-400" : day.delivery_per >= 50 ? "bg-cyan-400" : "bg-slate-500"}`}
                                          style={{ width: `${Math.min(100, day.delivery_per)}%` }}
                                        />
                                      </div>
                                    </div>

                                    {/* Spike & Demat Turnover */}
                                    <div className="text-right hidden sm:block">
                                      <div className="font-mono font-bold text-indigo-400">
                                        {day.delivery_spike_x}x Spike
                                      </div>
                                      <div className="text-[9px] text-slate-400">₹{day.delivery_turnover_cr} Cr Demat</div>
                                    </div>

                                    {/* Candle Signature Tag */}
                                    <div>
                                      <span
                                        className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                                          day.candle_type === "BLAST_EXPANSION"
                                            ? "bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/40"
                                            : day.candle_type === "HIGH_ACCUMULATION"
                                            ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40"
                                            : day.candle_type === "CONTROLLED_DIP"
                                            ? "bg-amber-500/20 text-amber-300"
                                            : day.candle_type === "BASE_COIL"
                                            ? "bg-slate-700/60 text-slate-300"
                                            : "bg-slate-800 text-slate-400"
                                        }`}
                                      >
                                        {day.candle_label}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : null}
        </div>

        {/* FOOTER */}
        <div className="border-t border-slate-200 px-5 py-3 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-900/60 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <Zap size={14} className="text-cyan-400" />
            <span>Green = Delivery Inflow / Absorption • Amber = Controlled Volatility Contraction / Dry-Up</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-800 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

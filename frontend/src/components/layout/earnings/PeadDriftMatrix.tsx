"use client";

// =======================================================
// Alpha India — PEAD Quantitative Drift Matrix Component
// Sprint 34 Institutional PEAD Engine
// =======================================================

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  FileText,
  Zap,
  Sparkles,
  ExternalLink,
  RefreshCw,
  X,
  ShieldCheck,
} from "lucide-react";

import {
  fetchQuarterlyResults,
  fetchQuarterlySummary,
  triggerExchangeScan,
  type QuarterlyResultItem,
  type QuarterlySummaryResponse,
} from "@/lib/quarterlyResultsApi";
import TerminalSearch from "@/components/common/TerminalSearch";
import { ExchangeBadge } from "@/components/common/ExchangeBadge";

// Format currency in Indian notation
function formatINR(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return "—";
  if (Math.abs(val) >= 1000) {
    return `₹${(val / 1000).toFixed(1)}k Cr`;
  }
  return `₹${val.toFixed(1)} Cr`;
}

// Format growth % with color
function formatGrowth(val: number | null | undefined) {
  if (val === null || val === undefined || isNaN(val)) {
    return <span className="text-slate-500 font-mono text-xs">—</span>;
  }
  const isPos = val > 0;
  const isZero = val === 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 font-bold font-mono text-xs ${
        isZero ? "text-slate-400" : isPos ? "text-emerald-400" : "text-rose-400"
      }`}
    >
      {isPos ? "+" : ""}
      {val.toFixed(1)}%
    </span>
  );
}

// Tier badge helper
function getPeadTierBadge(tier: string, score: number) {
  switch (tier) {
    case "ELITE":
    case "ELITE_PEAD":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 border border-emerald-500/40 text-emerald-300">
          <Zap className="w-2.5 h-2.5 text-emerald-400" />
          Elite PEAD ({score.toFixed(0)})
        </span>
      );
    case "STRONG":
    case "STRONG_PEAD":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-cyan-500/15 border border-cyan-500/40 text-cyan-300">
          <Sparkles className="w-2.5 h-2.5 text-cyan-400" />
          Strong ({score.toFixed(0)})
        </span>
      );
    case "MODERATE":
    case "MODERATE_PEAD":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-amber-500/15 border border-amber-500/40 text-amber-300">
          Moderate ({score.toFixed(0)})
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider bg-slate-800 border border-slate-700 text-slate-400">
          Neutral ({score.toFixed(0)})
        </span>
      );
  }
}

export interface PeadDriftMatrixProps {
  initialSearch?: string;
  onAuditAthena?: (symbol: string) => void;
}

export default function PeadDriftMatrix({ initialSearch = "", onAuditAthena }: PeadDriftMatrixProps = {}) {
  const [items, setItems] = useState<QuarterlyResultItem[]>([]);
  const [summary, setSummary] = useState<QuarterlySummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  // Filters & Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState(initialSearch);
  const [exchange, setExchange] = useState("ALL");
  const [period, setPeriod] = useState("ALL");
  const [peadTab, setPeadTab] = useState<"ALL" | "PEAD_ONLY" | "ELITE">("ALL");
  const [sortBy, setSortBy] = useState("pead_score");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  // Keep search in sync if initialSearch prop updates
  useEffect(() => {
    if (initialSearch) {
      setSearch(initialSearch);
      setPage(1);
    }
  }, [initialSearch]);

  // Selected item for drawer
  const [selectedItem, setSelectedItem] = useState<QuarterlyResultItem | null>(null);

  // Load summary stats once
  const loadSummary = useCallback(async () => {
    try {
      const s = await fetchQuarterlySummary();
      setSummary(s);
    } catch (err) {
      console.error("Failed to load quarterly summary:", err);
    }
  }, []);

  // Load table data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchQuarterlyResults({
        page,
        limit,
        search,
        exchange: exchange === "ALL" ? undefined : exchange,
        period: period === "ALL" ? undefined : period,
        pead_only: peadTab === "PEAD_ONLY" || peadTab === "ELITE" ? true : undefined,
        pead_tier: peadTab === "ELITE" ? "ELITE" : undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
      });

      setItems(res.results);
      setTotal(res.total);
      setTotalPages(res.pages);
    } catch (err) {
      console.error("Failed to load quarterly results:", err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search, exchange, period, peadTab, sortBy, sortOrder]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle live scan
  const handleTriggerScan = async () => {
    setScanning(true);
    try {
      await triggerExchangeScan();
      setTimeout(() => {
        loadSummary();
        loadData();
        setScanning(false);
      }, 1500);
    } catch (err) {
      console.error("Failed to trigger scan:", err);
      setScanning(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* ================================================================= */}
      {/* PEAD Summary Metric Strip                                         */}
      {/* ================================================================= */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
          <span className="text-[10px] font-mono uppercase text-slate-400">Total Filings Tracked</span>
          <p className="text-xl font-black font-mono text-white mt-0.5">
            {summary?.total_filings ? summary.total_filings.toLocaleString() : "—"}
          </p>
        </div>

        <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-3">
          <span className="text-[10px] font-mono uppercase text-cyan-400">PEAD Candidates</span>
          <p className="text-xl font-black font-mono text-cyan-300 mt-0.5">
            {summary?.pead_candidates ? summary.pead_candidates.toLocaleString() : "—"}
          </p>
        </div>

        <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-3">
          <span className="text-[10px] font-mono uppercase text-emerald-400">Elite Drift Picks (80+)</span>
          <p className="text-xl font-black font-mono text-emerald-300 mt-0.5">
            {summary?.elite_pead ? summary.elite_pead.toLocaleString() : "—"}
          </p>
        </div>

        <div className="rounded-xl border border-amber-500/20 bg-amber-950/20 p-3 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-mono uppercase text-amber-400">Top PEAD Pick</span>
            <p className="text-base font-black font-mono text-amber-300 mt-0.5 truncate max-w-[120px]">
              {summary?.top_pead_pick?.symbol || "—"}
            </p>
          </div>
          {summary?.top_pead_pick && (
            <span className="text-xs font-bold font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {summary.top_pead_pick.pead_score.toFixed(0)} Score
            </span>
          )}
        </div>
      </div>

      {/* ================================================================= */}
      {/* Filter & Search Toolbar                                           */}
      {/* ================================================================= */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/80 p-3 rounded-xl border border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          {/* PEAD Tab Selector */}
          <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => { setPeadTab("ALL"); setPage(1); }}
              className={`px-3 py-1 rounded font-bold transition-all ${
                peadTab === "ALL" ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40" : "text-slate-400 hover:text-white"
              }`}
            >
              All Filings
            </button>
            <button
              onClick={() => { setPeadTab("PEAD_ONLY"); setPage(1); }}
              className={`px-3 py-1 rounded font-bold transition-all ${
                peadTab === "PEAD_ONLY" ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40" : "text-slate-400 hover:text-white"
              }`}
            >
              PEAD Candidates
            </button>
            <button
              onClick={() => { setPeadTab("ELITE"); setPage(1); }}
              className={`px-3 py-1 rounded font-bold transition-all ${
                peadTab === "ELITE" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" : "text-slate-400 hover:text-white"
              }`}
            >
              Elite Picks
            </button>
          </div>

          {/* Period Selector */}
          {summary?.available_periods && summary.available_periods.length > 0 && (
            <select
              value={period}
              onChange={(e) => { setPeriod(e.target.value); setPage(1); }}
              className="bg-slate-950/80 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500 font-mono"
            >
              <option value="ALL">All Periods</option>
              {summary.available_periods.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          )}

          {/* Exchange Filter */}
          <select
            value={exchange}
            onChange={(e) => { setExchange(e.target.value); setPage(1); }}
            className="bg-slate-950/80 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500 font-mono"
          >
            <option value="ALL">All Exchanges</option>
            <option value="NSE">NSE Only</option>
            <option value="BSE">BSE Only</option>
          </select>
        </div>

        {/* Search & Actions */}
        <div className="flex items-center gap-2">
          <TerminalSearch
            value={search}
            onChange={(val) => { setSearch(val); setPage(1); }}
            placeholder="Filter ticker / company..."
            className="w-48 md:w-60"
          />

          <button
            onClick={handleTriggerScan}
            disabled={scanning}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 text-xs font-bold uppercase font-mono transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${scanning ? "animate-spin" : ""}`} />
            {scanning ? "Scanning..." : "Scan Exchange"}
          </button>
        </div>
      </div>

      {/* ================================================================= */}
      {/* PEAD Quantitative Table                                           */}
      {/* ================================================================= */}
      <div className="rounded-xl border border-slate-800 bg-[#081225]/90 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-sans">
            <thead>
              <tr className="border-b border-slate-800/90 bg-slate-900/90 text-[11px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                <th className="py-3 px-3">Company / Equities</th>
                <th className="py-3 px-2 text-center">Exch</th>
                <th className="py-3 px-2">Period</th>
                <th className="py-3 px-3">PEAD Drift Score</th>
                <th className="py-3 px-3 text-right">Revenue (₹ Cr)</th>
                <th className="py-3 px-3 text-right">PAT (₹ Cr)</th>
                <th className="py-3 px-2 text-center">Op. Leverage</th>
                <th className="py-3 px-3 text-center">Exchange Filing</th>
                <th className="py-3 px-2 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-14 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RefreshCw className="w-5 h-5 text-cyan-400 animate-spin" />
                      <span className="text-xs font-mono">Computing PEAD Drift & Operating Leverage...</span>
                    </div>
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-14 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <FileText className="w-8 h-8 text-slate-600" />
                      <span className="text-sm font-semibold text-slate-300">No quarterly results found</span>
                      <span className="text-xs text-slate-500 font-mono">
                        Adjust your filters or trigger a live exchange scan.
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                items.map((row) => {
                  const isSelected = selectedItem?.id === row.id;

                  return (
                    <tr
                      key={`${row.id}-${row.symbol}`}
                      className={`transition-colors hover:bg-slate-800/40 cursor-pointer ${
                        isSelected ? "bg-cyan-950/30 border-l-2 border-cyan-400" : ""
                      }`}
                      onClick={() => setSelectedItem(row)}
                    >
                      {/* Company / Symbol */}
                      <td className="py-2.5 px-3">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-white hover:text-cyan-300 text-[13px] font-mono">
                              {row.symbol}
                            </span>
                            {row.is_elite_pead && (
                              <Zap className="w-3 h-3 text-emerald-400 shrink-0" />
                            )}
                            {row.athena_conviction_grade && (
                              <span
                                className="px-1.5 py-0.2 rounded text-[9px] font-black font-mono uppercase bg-cyan-950/80 border border-cyan-500/40 text-cyan-300"
                                title={`Athena Conviction: ${row.athena_conviction_score}/100 (${row.athena_signal || "Conviction"})`}
                              >
                                {row.athena_conviction_grade}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400 truncate max-w-[180px]">
                            {row.company_name}
                          </span>
                        </div>
                      </td>

                      {/* Exchange */}
                      <td className="py-2.5 px-2 text-center">
                        <ExchangeBadge exchange={row.exchange} />
                      </td>

                      {/* Period */}
                      <td className="py-2.5 px-2">
                        <div className="flex flex-col">
                          <span className="font-bold text-white text-[11px] font-mono">
                            {row.period}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {row.announcement_date || "Recent"}
                          </span>
                        </div>
                      </td>

                      {/* PEAD Score & Drift */}
                      <td className="py-2.5 px-3">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            {getPeadTierBadge(row.pead_tier, row.pead_score)}
                            <span className="text-[10px] text-slate-400 font-mono font-semibold">
                              {row.drift_days}
                            </span>
                          </div>
                          <div className="w-28 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                row.pead_score >= 85
                                  ? "bg-emerald-400"
                                  : row.pead_score >= 70
                                  ? "bg-cyan-400"
                                  : row.pead_score >= 55
                                  ? "bg-amber-400"
                                  : "bg-slate-600"
                              }`}
                              style={{ width: `${Math.min(row.pead_score, 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Revenue */}
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex flex-col items-end font-mono">
                          <span className="font-bold text-slate-200">
                            {formatINR(row.revenue)}
                          </span>
                          {formatGrowth(row.revenue_growth)}
                        </div>
                      </td>

                      {/* PAT */}
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex flex-col items-end font-mono">
                          <span className="font-bold text-white">
                            {formatINR(row.net_profit)}
                          </span>
                          {formatGrowth(row.pat_growth)}
                        </div>
                      </td>

                      {/* Operating Leverage */}
                      <td className="py-2.5 px-2 text-center">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-bold font-mono ${
                            row.operating_leverage_ratio >= 1.5
                              ? "text-emerald-300 bg-emerald-500/10"
                              : row.operating_leverage_ratio > 1.0
                              ? "text-cyan-300 bg-cyan-500/10"
                              : "text-slate-400"
                          }`}
                        >
                          {row.operating_leverage_ratio > 0
                            ? `${row.operating_leverage_ratio}x`
                            : "—"}
                        </span>
                      </td>

                      {/* Exchange Filing Link */}
                      <td className="py-2.5 px-3 text-center">
                        {row.pdf_url ? (
                          <a
                            href={row.pdf_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-cyan-950/60 text-cyan-300 border border-slate-700 hover:border-cyan-500/40 text-[11px] font-semibold transition-all shadow-sm font-mono"
                          >
                            <FileText className="w-3 h-3 text-cyan-400" />
                            PDF
                            <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                          </a>
                        ) : (
                          <span className="text-slate-600 text-[10px] font-mono">Pending</span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-2.5 px-2 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedItem(row);
                          }}
                          className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold transition-all font-mono"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800 bg-slate-900/90 text-xs font-mono text-slate-400">
          <span>
            Showing <strong className="text-white">{items.length}</strong> of{" "}
            <strong className="text-white">{total}</strong> quarterly filings
          </span>

          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Previous
            </button>
            <span>
              Page {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* Slide-over Inspection Drawer                                      */}
      {/* ================================================================= */}
      {selectedItem && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end"
          onClick={() => setSelectedItem(null)}
        >
          <div
            className="w-full max-w-lg bg-[#050B14] border-l border-slate-800 p-6 overflow-y-auto space-y-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-black font-mono text-white">
                    {selectedItem.symbol}
                  </h3>
                  <ExchangeBadge exchange={selectedItem.exchange} />
                  {getPeadTierBadge(selectedItem.pead_tier, selectedItem.pead_score)}
                </div>
                <p className="text-xs text-slate-400 mt-1">{selectedItem.company_name}</p>
                {selectedItem.sector && (
                  <p className="text-[11px] text-cyan-400 font-mono mt-0.5">{selectedItem.sector}</p>
                )}
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* PEAD Thesis */}
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-4">
              <span className="text-[10px] font-mono font-bold uppercase text-cyan-400 tracking-wider">
                PEAD Quantitative Thesis
              </span>
              <p className="text-xs text-slate-200 mt-1.5 leading-relaxed font-sans">
                {selectedItem.pead_thesis}
              </p>
            </div>

            {/* Athena Omega 5-Gate Audit Banner */}
            <div className="rounded-xl border border-cyan-500/30 bg-gradient-to-r from-cyan-950/40 via-slate-900 to-slate-950 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold font-mono text-cyan-300">
                  <Zap className="w-4 h-4 text-cyan-400" />
                  ATHENA OMEGA 5-GATE AUDIT
                </div>
                {selectedItem.athena_conviction_grade && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    Grade: {selectedItem.athena_conviction_grade} ({selectedItem.athena_conviction_score?.toFixed(0)}/100)
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                Deep-dive into 200-Point Business Shock, Forensic Quality, Piotroski tests, and Fair Value upside target for {selectedItem.symbol}.
              </p>
              <div className="flex items-center gap-2 pt-1">
                {onAuditAthena ? (
                  <button
                    onClick={() => onAuditAthena(selectedItem.symbol)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs font-mono uppercase transition-all shadow-md shadow-cyan-950/40"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    Audit 5 Gates in Terminal
                  </button>
                ) : (
                  <Link
                    href={`/athena-omega?search=${encodeURIComponent(selectedItem.symbol)}&tab=flash`}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs font-mono uppercase transition-all shadow-md shadow-cyan-950/40"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    Audit 5 Gates in Terminal
                  </Link>
                )}
              </div>
            </div>

            {/* 4 Pillars Breakdown */}
            <div className="space-y-3">
              <h4 className="text-xs font-mono font-bold uppercase text-slate-400 tracking-wider">
                4-Pillar Drift Assessment
              </h4>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/60">
                  <span className="text-[10px] text-slate-500 uppercase font-mono">Earnings Power</span>
                  <p className="text-base font-black font-mono text-emerald-400 mt-0.5">
                    {selectedItem.pillar_breakdown?.earnings_power?.toFixed(1) || "—"} / 100
                  </p>
                </div>
                <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/60">
                  <span className="text-[10px] text-slate-500 uppercase font-mono">Operating Leverage</span>
                  <p className="text-base font-black font-mono text-cyan-400 mt-0.5">
                    {selectedItem.pillar_breakdown?.operating_leverage?.toFixed(1) || "—"} / 100
                  </p>
                </div>
                <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/60">
                  <span className="text-[10px] text-slate-500 uppercase font-mono">Capital Efficiency</span>
                  <p className="text-base font-black font-mono text-amber-400 mt-0.5">
                    {selectedItem.pillar_breakdown?.capital_efficiency?.toFixed(1) || "—"} / 100
                  </p>
                </div>
                <div className="p-3 rounded-lg border border-slate-800 bg-slate-900/60">
                  <span className="text-[10px] text-slate-500 uppercase font-mono">Trend Drift</span>
                  <p className="text-base font-black font-mono text-rose-400 mt-0.5">
                    {selectedItem.pillar_breakdown?.trend_drift?.toFixed(1) || "—"} / 100
                  </p>
                </div>
              </div>
            </div>

            {/* Financial Highlights */}
            <div className="space-y-3 border-t border-slate-800 pt-4">
              <h4 className="text-xs font-mono font-bold uppercase text-slate-400 tracking-wider">
                Reported Financials ({selectedItem.period})
              </h4>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="flex justify-between p-2 rounded bg-slate-900/40 border border-slate-800">
                  <span className="text-slate-400">Revenue</span>
                  <span className="font-bold text-white">{formatINR(selectedItem.revenue)}</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-slate-900/40 border border-slate-800">
                  <span className="text-slate-400">Revenue YoY</span>
                  <span>{formatGrowth(selectedItem.revenue_growth)}</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-slate-900/40 border border-slate-800">
                  <span className="text-slate-400">Net Profit</span>
                  <span className="font-bold text-white">{formatINR(selectedItem.net_profit)}</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-slate-900/40 border border-slate-800">
                  <span className="text-slate-400">PAT YoY</span>
                  <span>{formatGrowth(selectedItem.pat_growth)}</span>
                </div>
                <div className="flex justify-between p-2 rounded bg-slate-900/40 border border-slate-800">
                  <span className="text-slate-400">Op. Margin</span>
                  <span className="font-bold text-slate-200">
                    {selectedItem.opm ? `${selectedItem.opm.toFixed(1)}%` : "—"}
                  </span>
                </div>
                <div className="flex justify-between p-2 rounded bg-slate-900/40 border border-slate-800">
                  <span className="text-slate-400">Op. Leverage</span>
                  <span className="font-bold text-cyan-300">
                    {selectedItem.operating_leverage_ratio > 0
                      ? `${selectedItem.operating_leverage_ratio}x`
                      : "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* PDF Link Button */}
            {selectedItem.pdf_url && (
              <a
                href={selectedItem.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs uppercase font-mono transition-all shadow-lg shadow-cyan-950/40"
              >
                <FileText className="w-4 h-4" />
                Open Official Filing PDF
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

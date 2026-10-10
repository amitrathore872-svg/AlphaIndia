"use client";

import React, { useState, useEffect, useCallback, Fragment } from "react";
import {
  Search,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ExternalLink,
  ChevronLeft,
  SlidersHorizontal,
  FileText,
  AlertCircle,
  Building2,
} from "lucide-react";
import {
  fetchCompanyView,
  type CompanyViewItem,
  type CompanyViewResponse,
} from "@/lib/announcementsApi";

const MCAP_STEPS = [0, 100, 500, 2000, 10000, 100000];

interface CompanyViewTabProps {
  onInspectHistory?: (symbol: string, companyName?: string) => void;
}

export default function CompanyViewTab({ onInspectHistory }: CompanyViewTabProps) {
  const [timeframe, setTimeframe] = useState<string>("6M");
  const [minRevenuePct, setMinRevenuePct] = useState<number>(0);
  const [mcapSliderIndex, setMcapSliderIndex] = useState<number>(2); // 500 Cr default
  const [search, setSearch] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const pageSize = 50;

  const [data, setData] = useState<CompanyViewResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const currentMinMcap = MCAP_STEPS[mcapSliderIndex];

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchCompanyView({
        timeframe,
        min_revenue_pct: minRevenuePct,
        min_market_cap_cr: currentMinMcap,
        search: search.trim() || undefined,
        page,
        limit: pageSize,
      });
      setData(res);
    } catch (err) {
      console.error("Failed to load company view:", err);
    } finally {
      setLoading(false);
    }
  }, [timeframe, minRevenuePct, currentMinMcap, search, page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const getMcapLabel = (idx: number) => {
    const val = MCAP_STEPS[idx];
    if (val === 0) return "All";
    if (val >= 100000) return "₹1L Cr+";
    if (val >= 10000) return "₹10k Cr+";
    if (val >= 2000) return "₹2k Cr+";
    return `Over ₹${val} cr`;
  };

  return (
    <div className="space-y-6">
      {/* ── TOP DISCLAIMER ────────────────────────────────────────────── */}
      <div className="p-3.5 rounded-xl bg-slate-900/50 border border-slate-800/80 text-xs text-slate-400 leading-relaxed font-mono">
        <span className="text-amber-400 font-semibold">Note:</span> Order details are extracted using AI and may contain errors. Please verify the information by checking the PDF documents before making any business decisions.
      </div>

      {/* ── FILTER CONTROLS (MATCHING SCREENSHOT 3) ───────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-[#090f1d] border border-slate-800">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search company..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 w-48 sm:w-60 font-mono"
            />
          </div>

          {/* Timeframe Dropdown */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono">
            <span className="text-slate-400">Timeframe</span>
            <select
              value={timeframe}
              onChange={(e) => {
                setTimeframe(e.target.value);
                setPage(1);
              }}
              className="bg-transparent text-cyan-300 font-semibold focus:outline-none cursor-pointer"
            >
              <option value="3M" className="bg-slate-900 text-white">3 months</option>
              <option value="6M" className="bg-slate-900 text-white">6 months</option>
              <option value="1Y" className="bg-slate-900 text-white">1 year</option>
              <option value="ALL" className="bg-slate-900 text-white">All time</option>
            </select>
          </div>

          {/* Min Revenue % Input */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono">
            <span className="text-slate-400">Min Revenue %</span>
            <input
              type="number"
              value={minRevenuePct}
              onChange={(e) => {
                setMinRevenuePct(Number(e.target.value) || 0);
                setPage(1);
              }}
              className="w-14 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-center font-bold text-emerald-400 focus:outline-none focus:border-cyan-400"
            />
          </div>

          {/* Market Cap Slider */}
          <div className="flex items-center gap-3 px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400">
                Market Cap: <span className="text-cyan-300 font-bold">{getMcapLabel(mcapSliderIndex)}</span>
              </span>
              <input
                type="range"
                min={0}
                max={MCAP_STEPS.length - 1}
                value={mcapSliderIndex}
                onChange={(e) => {
                  setMcapSliderIndex(Number(e.target.value));
                  setPage(1);
                }}
                className="w-28 sm:w-36 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>
            <div className="hidden sm:flex items-center gap-1 text-[9px] text-slate-500">
              <span>0</span>
              <span>·</span>
              <span>500</span>
              <span>·</span>
              <span>10k</span>
            </div>
          </div>
        </div>

        {/* Refresh Button */}
        <button
          onClick={loadData}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300 hover:text-white hover:border-slate-700 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-cyan-400" : ""}`} />
          REFRESH
        </button>
      </div>

      {/* ── TABLE SUBTITLE ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between text-xs font-mono text-slate-400 pt-1">
        <span>Each company as a percentage of their revenue</span>
        <span>
          Sorted by <span className="text-emerald-400 font-semibold">Orders as % of Revenue ↓</span>
        </span>
      </div>

      {/* ── MAIN ACCORDION TABLE (SCREENSHOT 3) ───────────────────────── */}
      <div className="rounded-xl border border-slate-800 bg-[#090f1d] overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse font-mono">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 text-[11px] uppercase tracking-wider">
                <th className="py-3 px-4 w-10"></th>
                <th className="py-3 px-4 font-sans">Company Name</th>
                <th className="py-3 px-4 text-emerald-400">↓ Orders as % of Revenue</th>
                <th className="py-3 px-4">Order Count</th>
                <th className="py-3 px-4">Total Order Value</th>
                <th className="py-3 px-4">Company Revenue</th>
                <th className="py-3 px-4">Market Cap</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/60">
              {loading && (!data || data.items.length === 0) ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-500">
                    Aggregating company order-to-revenue ratios...
                  </td>
                </tr>
              ) : !data || data.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-500">
                    No companies matched current filter thresholds.
                  </td>
                </tr>
              ) : (
                data.items.map((row) => {
                  const key = row.symbol || row.company_name;
                  const isExpanded = expandedKeys.has(key);

                  return (
                    <Fragment key={key}>
                      <tr
                        className={`hover:bg-slate-800/40 cursor-pointer transition-colors ${
                          isExpanded ? "bg-slate-800/30" : ""
                        }`}
                        onClick={() => toggleExpand(key)}
                      >
                        {/* Expand Chevron */}
                        <td className="py-3.5 px-4 text-slate-400">
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-cyan-400 transition-transform" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-slate-500 group-hover:text-slate-300" />
                          )}
                        </td>

                        {/* Company Name */}
                        <td className="py-3.5 px-4 font-sans font-medium text-slate-200">
                          <div className="flex items-center gap-2">
                            <span className="text-cyan-400 hover:underline cursor-pointer transition-colors">
                              {row.company_name}
                            </span>
                            {row.symbol && onInspectHistory && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onInspectHistory(row.symbol, row.company_name);
                                }}
                                title="View quarterly order book history chart"
                                className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 hover:text-cyan-300 border border-slate-700"
                              >
                                History
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Orders as % of Revenue (Green Pill Badge) */}
                        <td className="py-3.5 px-4">
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 shadow-sm">
                            {row.orders_as_pct_of_revenue.toFixed(2)}%
                          </span>
                        </td>

                        {/* Order Count */}
                        <td className="py-3.5 px-4 text-slate-300">
                          {row.order_count} {row.order_count === 1 ? "orders" : "orders"}
                        </td>

                        {/* Total Order Value */}
                        <td className="py-3.5 px-4 font-semibold text-emerald-400">
                          ₹{row.total_order_value.toLocaleString("en-IN", { maximumFractionDigits: 1 })} Cr
                        </td>

                        {/* Company Revenue */}
                        <td className="py-3.5 px-4">
                          <span className="text-slate-200">
                            ₹{row.company_revenue.toLocaleString("en-IN", { maximumFractionDigits: 1 })} Cr
                          </span>{" "}
                          <span className="text-[10px] text-slate-500">({row.revenue_basis})</span>
                        </td>

                        {/* Market Cap */}
                        <td className="py-3.5 px-4 text-slate-300">
                          ₹{Math.round(row.market_cap).toLocaleString("en-IN")} Cr
                        </td>
                      </tr>

                      {/* Expandable Accordion Sub-Table (SCREENSHOT 4) */}
                      {isExpanded && (
                        <tr className="bg-[#070d18]">
                          <td colSpan={7} className="p-5 pl-10 border-b border-slate-800">
                            <div className="space-y-3">
                              <h4 className="text-sm md:text-base font-bold text-white font-sans tracking-tight">
                                Individual Orders
                              </h4>

                              <div className="overflow-x-auto rounded-lg border border-slate-800 bg-[#090f1e]">
                                <table className="w-full text-left text-xs border-collapse font-mono">
                                  <thead>
                                    <tr className="border-b border-slate-800 text-[11px] text-slate-400 bg-slate-950/70">
                                      <th className="py-2.5 px-3.5 font-medium">Date ↓</th>
                                      <th className="py-2.5 px-3.5 font-medium">Customer</th>
                                      <th className="py-2.5 px-3.5 font-medium">Order Type</th>
                                      <th className="py-2.5 px-3.5 font-medium">Contract Value</th>
                                      <th className="py-2.5 px-3.5 font-medium">Duration</th>
                                      <th className="py-2.5 px-3.5 font-medium">Annual Value</th>
                                      <th className="py-2.5 px-3.5 font-medium">Revenue %</th>
                                      <th className="py-2.5 px-3.5 text-right font-medium">PDF</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-800/60">
                                    {row.orders.map((ord) => (
                                      <tr
                                        key={ord.id}
                                        className="hover:bg-slate-800/40 transition-colors"
                                      >
                                        <td className="py-2.5 px-3.5 text-slate-300 whitespace-nowrap">
                                          {ord.date}
                                        </td>
                                        <td className="py-2.5 px-3.5 text-slate-300">
                                          {ord.customer}
                                        </td>
                                        <td className="py-2.5 px-3.5 text-slate-400">
                                          {ord.order_type}
                                        </td>
                                        <td className="py-2.5 px-3.5 text-emerald-400 font-semibold whitespace-nowrap">
                                          ₹{ord.contract_value_cr.toLocaleString("en-IN", { maximumFractionDigits: 1 })} Cr
                                        </td>
                                        <td className="py-2.5 px-3.5 text-slate-300 whitespace-nowrap">
                                          {ord.duration}
                                        </td>
                                        <td className="py-2.5 px-3.5 text-slate-200 whitespace-nowrap">
                                          ₹{ord.annual_value_cr.toLocaleString("en-IN", { maximumFractionDigits: 1 })} Cr
                                        </td>
                                        <td className="py-2.5 px-3.5 whitespace-nowrap">
                                          <span
                                            className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${
                                              ord.revenue_pct >= 1.0
                                                ? "bg-emerald-950/80 text-emerald-300 border border-emerald-500/30"
                                                : "text-slate-500"
                                            }`}
                                          >
                                            {ord.revenue_pct.toFixed(1)}%
                                          </span>
                                        </td>
                                        <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                                          <div className="flex items-center justify-end gap-1.5">
                                            {ord.pdf_url && ord.pdf_url !== "-" ? (
                                              <a
                                                href={ord.pdf_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-900 transition-colors inline-flex items-center gap-1"
                                                title={ord.pdf_url.toLowerCase().endsWith(".pdf") || ord.pdf_url.includes("AnnPdfOpen") ? "View official filing PDF" : "View official exchange filings"}
                                              >
                                                {ord.pdf_url.toLowerCase().endsWith(".pdf") || ord.pdf_url.includes("AnnPdfOpen") ? "PDF" : "Filing"}
                                              </a>
                                            ) : (
                                              <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800/60 text-slate-500 font-mono" title="No direct PDF in filing">
                                                —
                                              </span>
                                            )}
                                            {onInspectHistory && (
                                              <button
                                                onClick={() => onInspectHistory(row.symbol, row.company_name)}
                                                className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 hover:text-cyan-300 hover:bg-slate-700 transition-colors"
                                                title="View quarterly backlog history"
                                              >
                                                His
                                              </button>
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {data && data.total_pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800 bg-slate-950/50 text-xs font-mono text-slate-400">
            <span>
              Showing {data.items.length} of {data.total_companies} companies
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1 rounded bg-slate-900 border border-slate-800 disabled:opacity-40 hover:text-white"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span>
                Page {page} of {data.total_pages}
              </span>
              <button
                disabled={page >= data.total_pages}
                onClick={() => setPage((p) => Math.min(data.total_pages, p + 1))}
                className="p-1 rounded bg-slate-900 border border-slate-800 disabled:opacity-40 hover:text-white"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

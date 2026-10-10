"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Search,
  Filter,
  RefreshCw,
  AlertTriangle,
  ArrowUpDown,
  TrendingUp,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import {
  fetchOrderbookView,
  type OrderbookCompanyItem,
  type OrderbookTopGainer,
  type OrderbookViewResponse,
} from "@/lib/announcementsApi";
import OrderBookSparkline from "./OrderBookSparkline";

interface OrderbookViewTabProps {
  onSelectCompany: (symbol: string, companyName?: string) => void;
}

export default function OrderbookViewTab({ onSelectCompany }: OrderbookViewTabProps) {
  const [timeframe, setTimeframe] = useState<"1Y" | "6M" | "3M">("1Y");
  const [minOrderBook, setMinOrderBook] = useState<number>(0);
  const [minMarketCap, setMinMarketCap] = useState<number>(0);
  const [search, setSearch] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("growth_pct");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState<number>(1);
  const pageSize = 50;

  const [data, setData] = useState<OrderbookViewResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchOrderbookView({
        timeframe,
        min_order_book_cr: minOrderBook,
        min_market_cap_cr: minMarketCap,
        search: search.trim() || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
        page,
        limit: pageSize,
      });
      setData(res);
    } catch (err) {
      console.error("Failed to load orderbook view:", err);
    } finally {
      setLoading(false);
    }
  }, [timeframe, minOrderBook, minMarketCap, search, sortBy, sortOrder, page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "desc" ? "asc" : "desc");
    } else {
      setSortBy(field);
      setSortOrder("desc");
    }
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* ── TOP FILTER CONTROLS ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-[#090f1d] border border-slate-800">
        <div className="flex flex-wrap items-center gap-3">
          {/* Timeframe Pills */}
          <div className="flex items-center rounded-lg bg-slate-900 border border-slate-800 p-0.5">
            {(["3M", "6M", "1Y"] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => {
                  setTimeframe(tf);
                  setPage(1);
                }}
                className={`px-3 py-1 rounded-md text-xs font-mono font-semibold transition-all ${
                  timeframe === tf
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          {/* Min Order Book Input */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs">
            <span className="text-slate-400 font-mono">Min order book</span>
            <input
              type="number"
              placeholder="0"
              value={minOrderBook === 0 ? "" : minOrderBook}
              onChange={(e) => {
                const val = e.target.value === "" ? 0 : Number(e.target.value);
                setMinOrderBook(isNaN(val) ? 0 : val);
                setPage(1);
              }}
              className="w-16 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-center font-mono font-bold text-emerald-400 focus:outline-none focus:border-cyan-400"
            />
            <span className="text-slate-500 font-mono">₹ cr</span>
          </div>

          {/* Min Market Cap Input */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs">
            <span className="text-slate-400 font-mono">Min market cap</span>
            <input
              type="number"
              placeholder="0"
              value={minMarketCap === 0 ? "" : minMarketCap}
              onChange={(e) => {
                const val = e.target.value === "" ? 0 : Number(e.target.value);
                setMinMarketCap(isNaN(val) ? 0 : val);
                setPage(1);
              }}
              className="w-16 bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-center font-mono font-bold text-cyan-400 focus:outline-none focus:border-cyan-400"
            />
            <span className="text-slate-500 font-mono">₹ cr</span>
          </div>
        </div>

        {/* Right Disclaimer & Refresh */}
        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-950/20 border border-amber-600/30 text-[11px] text-amber-300 font-mono">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>Important: AI-extracted, may contain errors. Verify against the source PDF.</span>
          </div>

          <button
            onClick={loadData}
            title="Refresh Order Book Radar"
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-cyan-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* ── HERO RIBBON: TOP GAINERS ────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            Top Gainers — last {timeframe === "1Y" ? "1 year" : timeframe === "6M" ? "6 months" : "3 months"}
          </h3>
        </div>

        <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-800">
          {(data?.top_gainers || []).map((g) => (
            <div
              key={g.symbol}
              onClick={() => onSelectCompany(g.symbol, g.company_name)}
              className="flex-shrink-0 w-64 p-3.5 rounded-xl bg-[#0a1120] border border-slate-800/90 hover:border-cyan-500/50 hover:bg-[#0d162b] cursor-pointer transition-all duration-200 group"
            >
              <div className="flex items-start justify-between">
                <span className="text-[11px] font-mono text-slate-400">#{g.rank}</span>
                <span className="text-xs font-mono font-bold text-emerald-400">
                  +{Math.round(g.growth_pct)}%
                </span>
              </div>

              <div className="mt-1">
                <h4 className="text-sm font-semibold text-white truncate group-hover:text-cyan-300 transition-colors">
                  {g.company_name}
                </h4>
                <p className="text-[11px] font-mono text-slate-500">{g.exchange}: {g.symbol}</p>
              </div>

              <div className="mt-2.5 flex items-end justify-between">
                <span className="text-xs font-mono font-semibold text-emerald-400">
                  {g.order_book_formatted}
                </span>
                {/* Mini Sparkline in Top Card */}
                <div className="flex items-end gap-1 h-6">
                  {g.sparkline_data.slice(-5).map((val, i) => {
                    const maxV = Math.max(...g.sparkline_data, 1);
                    const hPct = Math.max(20, Math.round((val / maxV) * 100));
                    return (
                      <div
                        key={i}
                        className="w-1.5 rounded-t bg-emerald-500/80 group-hover:bg-emerald-400"
                        style={{ height: `${hPct}%` }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── MAIN TABLE CONTROLS ────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <p className="text-xs font-mono text-slate-400">
          All companies · sorted by{" "}
          <span className="text-slate-200">
            {sortBy === "growth_pct" ? "momentum growth" : sortBy.replace(/_/g, " ")}
          </span>{" "}
          — click <span className="text-cyan-400 cursor-pointer" onClick={() => handleSort("growth_pct")}>"Growth"</span> to rank by momentum instead.
        </p>

        <div className="flex items-center gap-2">
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
        </div>
      </div>

      {/* ── MAIN TABLE ────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-800 bg-[#090f1d] overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/70 text-slate-400 font-mono text-[11px] uppercase tracking-wider">
                <th
                  onClick={() => handleSort("company_name")}
                  className="py-3 px-4 cursor-pointer hover:text-white"
                >
                  <div className="flex items-center gap-1.5">
                    Company
                    <ArrowUpDown className="w-3 h-3 text-slate-600" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("growth_pct")}
                  className="py-3 px-3 cursor-pointer hover:text-white"
                >
                  <div className="flex items-center gap-1.5">
                    Growth ({timeframe})
                    <ArrowUpDown className="w-3 h-3 text-cyan-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("order_book_cr")}
                  className="py-3 px-3 cursor-pointer hover:text-white"
                >
                  <div className="flex items-center gap-1.5">
                    Order Book
                    <ArrowUpDown className="w-3 h-3 text-slate-600" />
                  </div>
                </th>
                <th className="py-3 px-3">Revenue</th>
                <th
                  onClick={() => handleSort("book_to_revenue")}
                  className="py-3 px-3 cursor-pointer hover:text-white"
                >
                  <div className="flex items-center gap-1.5">
                    Book / Revenue
                    <ArrowUpDown className="w-3 h-3 text-slate-600" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort("market_cap_cr")}
                  className="py-3 px-3 cursor-pointer hover:text-white"
                >
                  <div className="flex items-center gap-1.5">
                    Market Cap
                    <ArrowUpDown className="w-3 h-3 text-slate-600" />
                  </div>
                </th>
                <th className="py-3 px-3">As of Date</th>
                <th
                  onClick={() => handleSort("last_updated")}
                  className="py-3 px-3 cursor-pointer hover:text-white"
                >
                  <div className="flex items-center gap-1.5">
                    Last Updated ↓
                    <ArrowUpDown className="w-3 h-3 text-slate-600" />
                  </div>
                </th>
                <th className="py-3 px-4">Order Book History</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/60 font-mono">
              {loading && (!data || data.items.length === 0) ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-slate-500">
                    Loading verified order books...
                  </td>
                </tr>
              ) : !data || data.items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-slate-500">
                    No companies matched current filter thresholds.
                  </td>
                </tr>
              ) : (
                data.items.map((row) => {
                  const isHighMultiple = row.book_to_revenue >= 1.5;
                  const isPositiveGrowth = (row.growth_pct || 0) >= 0;

                  return (
                    <tr
                      key={row.symbol}
                      onClick={() => onSelectCompany(row.symbol, row.company_name)}
                      className="hover:bg-slate-800/40 cursor-pointer transition-colors group"
                    >
                      {/* Company Name & Symbol */}
                      <td className="py-3.5 px-4 font-sans">
                        <div className="font-semibold text-white group-hover:text-cyan-300 transition-colors">
                          {row.company_name}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                          {row.exchange}: {row.symbol} · BSE: {row.bse_code}
                        </div>
                      </td>

                      {/* Growth % */}
                      <td className="py-3.5 px-3">
                        {row.growth_pct !== null ? (
                          <span
                            className={`font-bold ${
                              isPositiveGrowth ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            {isPositiveGrowth ? "+" : ""}
                            {Math.round(row.growth_pct)}%
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>

                      {/* Order Book */}
                      <td className="py-3.5 px-3 font-semibold text-emerald-400">
                        {row.order_book_formatted}
                      </td>

                      {/* Revenue */}
                      <td className="py-3.5 px-3">
                        <div className="text-slate-200">{row.revenue_formatted}</div>
                        <div className="text-[10px] text-slate-500">{row.revenue_basis}</div>
                      </td>

                      {/* Book / Revenue Multiple */}
                      <td className="py-3.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-bold ${
                            isHighMultiple
                              ? "bg-cyan-950/60 text-cyan-300 border border-cyan-500/30"
                              : "text-slate-300"
                          }`}
                        >
                          {row.book_to_revenue_formatted}
                        </span>
                      </td>

                      {/* Market Cap */}
                      <td className="py-3.5 px-3 text-slate-300">
                        ₹{Math.round(row.market_cap_cr).toLocaleString("en-IN")} Cr
                      </td>

                      {/* As of Date */}
                      <td className="py-3.5 px-3 text-slate-400 text-[11px]">
                        {row.as_of_date}
                      </td>

                      {/* Last Updated */}
                      <td className="py-3.5 px-3 text-slate-400 text-[11px]">
                        {row.last_updated}
                      </td>

                      {/* Order Book History Sparkline */}
                      <td className="py-3.5 px-4">
                        <OrderBookSparkline
                          data={row.sparkline_data}
                          direction={row.sparkline_meta.direction}
                          latestFormatted={row.sparkline_meta.latest_formatted}
                          changePct={row.sparkline_meta.change_pct}
                        />
                      </td>
                    </tr>
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

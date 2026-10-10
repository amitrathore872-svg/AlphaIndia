"use client";

import React, { useState, useEffect } from "react";
import { X, ExternalLink, Calendar, Layers, TrendingUp, FileText, Loader2 } from "lucide-react";
import { fetchOrderbookHistory, type OrderbookHistoryResponse, type OrderbookHistoryBar } from "@/lib/announcementsApi";

interface OrderBookHistoryModalProps {
  symbol: string | null;
  companyName?: string;
  onClose: () => void;
}

export default function OrderBookHistoryModal({
  symbol,
  companyName,
  onClose,
}: OrderBookHistoryModalProps) {
  const [data, setData] = useState<OrderbookHistoryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBar, setSelectedBar] = useState<OrderbookHistoryBar | null>(null);
  const [hoveredBar, setHoveredBar] = useState<OrderbookHistoryBar | null>(null);

  useEffect(() => {
    if (!symbol) return;
    let isMounted = true;
    setLoading(true);
    setError(null);

    fetchOrderbookHistory(symbol)
      .then((res) => {
        if (isMounted) {
          setData(res);
          if (res.history_bars && res.history_bars.length > 0) {
            setSelectedBar(res.history_bars[res.history_bars.length - 1]);
          }
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error("Failed to load order book history:", err);
          setError("Failed to load historical order book series.");
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [symbol]);

  if (!symbol) return null;

  const displayName = data?.company_name || companyName || symbol;
  const bars = data?.history_bars || [];
  const maxVal = bars.length > 0 ? Math.max(...bars.map((b) => b.value_cr), 1) : 1;
  const yTicks = [
    Math.round(maxVal * 1.15),
    Math.round(maxVal * 0.85),
    Math.round(maxVal * 0.55),
    Math.round(maxVal * 0.25),
    0,
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[92vh] overflow-y-auto rounded-2xl bg-[#0c1322] border border-slate-700/70 shadow-2xl shadow-cyan-950/40 text-slate-100 p-6 md:p-8">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="mb-6">
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            Order Book History — <span className="text-cyan-300">{displayName}</span>
          </h2>
          <p className="text-xs font-mono text-slate-400 mt-0.5">all values in INR crore</p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
            <span className="text-sm">Retrieving verified quarterly backlog series...</span>
          </div>
        ) : error ? (
          <div className="py-16 text-center text-rose-400">
            <p className="text-sm">{error}</p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-1.5 rounded-lg bg-slate-800 text-xs font-medium text-slate-300 hover:bg-slate-700"
            >
              Close
            </button>
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Top Metric Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-900/70 border border-slate-800/80">
              <div>
                <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">
                  Latest order book
                </span>
                <span className="text-lg md:text-xl font-bold font-mono text-emerald-400 block mt-0.5">
                  INR {data.latest_order_book_cr.toLocaleString("en-IN", { maximumFractionDigits: 1 })} cr
                </span>
              </div>

              <div>
                <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">
                  As of
                </span>
                <span className="text-sm md:text-base font-medium text-slate-200 block mt-1">
                  {data.as_of_date}
                </span>
              </div>

              <div>
                <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block">
                  Data points
                </span>
                <span className="text-sm md:text-base font-semibold font-mono text-slate-200 block mt-1">
                  {data.data_points_count}
                </span>
              </div>

              <div>
                <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider block mb-1">
                  Order-book growth
                </span>
                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="text-emerald-400 font-semibold">
                    3M: +{Math.round(data.growth_metrics.growth_3m)}%
                  </span>
                  <span className="text-slate-600">|</span>
                  <span className="text-emerald-400 font-semibold">
                    6M: +{Math.round(data.growth_metrics.growth_6m)}%
                  </span>
                  <span className="text-slate-600">|</span>
                  <span className="text-emerald-400 font-bold">
                    1Y: +{Math.round(data.growth_metrics.growth_1y)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Interactive Bar Chart Section */}
            <div className="relative p-5 rounded-xl bg-[#090f1c] border border-slate-800">
              {/* Tooltip Overlay */}
              {(hoveredBar || selectedBar) && (
                <div className="absolute top-4 left-6 z-10 px-3.5 py-2 rounded-lg bg-slate-950/95 border border-cyan-500/40 shadow-xl backdrop-blur-md">
                  <div className="text-[11px] font-mono text-slate-300">
                    <span className="text-cyan-400 font-semibold">
                      {(hoveredBar || selectedBar)?.quarter}
                    </span>{" "}
                    — as of {(hoveredBar || selectedBar)?.as_of_date}
                  </div>
                  <div className="text-xs font-mono font-bold text-emerald-400 mt-0.5">
                    Order Book : INR {(hoveredBar || selectedBar)?.value_cr.toLocaleString("en-IN", { maximumFractionDigits: 1 })} cr
                  </div>
                </div>
              )}

              {/* Chart Canvas */}
              <div className="pt-14 pb-2">
                <div className="h-64 flex items-end justify-between gap-2 md:gap-3 border-b border-slate-700/60 pb-1 relative">
                  {/* Horizontal grid lines */}
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-20">
                    <div className="border-b border-dashed border-slate-400 w-full" />
                    <div className="border-b border-dashed border-slate-400 w-full" />
                    <div className="border-b border-dashed border-slate-400 w-full" />
                    <div className="border-b border-dashed border-slate-400 w-full" />
                  </div>

                  {bars.map((bar, idx) => {
                    const heightPct = Math.max(12, Math.round((bar.value_cr / (yTicks[0] || maxVal)) * 100));
                    const isSelected = selectedBar?.quarter === bar.quarter;
                    const isHovered = hoveredBar?.quarter === bar.quarter;
                    const isLast = idx === bars.length - 1;

                    return (
                      <div
                        key={idx}
                        className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer"
                        onMouseEnter={() => setHoveredBar(bar)}
                        onMouseLeave={() => setHoveredBar(null)}
                        onClick={() => setSelectedBar(bar)}
                      >
                        {/* Value label on top of bar */}
                        <span
                          className={`text-[10px] md:text-[11px] font-mono font-medium mb-1 transition-colors ${
                            isSelected || isHovered
                              ? "text-cyan-300 font-bold"
                              : isLast
                              ? "text-emerald-300 font-bold"
                              : "text-slate-400"
                          }`}
                        >
                          {bar.formatted_label}
                        </span>

                        {/* Bar Pillar */}
                        <div
                          className={`w-full max-w-[48px] rounded-t-sm transition-all duration-300 ${
                            isSelected
                              ? "bg-gradient-to-t from-cyan-600 to-cyan-400 shadow-[0_0_16px_rgba(34,211,238,0.5)]"
                              : isLast
                              ? "bg-gradient-to-t from-emerald-600 to-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.4)]"
                              : "bg-emerald-600/70 hover:bg-emerald-500/90"
                          }`}
                          style={{ height: `${heightPct}%` }}
                        />

                        {/* Quarter Axis Label */}
                        <span
                          className={`text-[9px] md:text-[10px] font-mono mt-2 truncate w-full text-center ${
                            isSelected || isHovered ? "text-cyan-300 font-bold" : "text-slate-500"
                          }`}
                        >
                          {bar.quarter}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Bottom Filing Citation & Verification Box */}
            <div className="relative rounded-xl bg-slate-900/60 border border-slate-800 p-4 pl-5 border-l-4 border-l-cyan-400">
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 block">
                From the filing
              </span>
              <p className="text-sm md:text-[15px] font-medium text-slate-200 italic mt-1 leading-relaxed">
                "{selectedBar?.filing_quote || data.filing_quote}"
              </p>

              <div className="flex flex-wrap items-center justify-between gap-3 mt-3 pt-2 border-t border-slate-800/80 text-xs">
                <span className="text-slate-500 font-mono text-[11px]">
                  Tip: click a bar to open its source filing.
                </span>
                {(() => {
                  const targetUrl = selectedBar?.source_pdf_url || data.source_pdf_url;
                  if (!targetUrl || targetUrl === "-") {
                    return (
                      <span className="text-slate-500 font-mono text-xs flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" />
                        No direct filing link
                      </span>
                    );
                  }
                  const isPdf = targetUrl.toLowerCase().endsWith(".pdf") || targetUrl.includes("AnnPdfOpen");
                  return (
                    <a
                      href={targetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 font-semibold text-cyan-400 hover:text-cyan-300 transition-colors bg-cyan-950/30 border border-cyan-800/40 px-2.5 py-1 rounded-md"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      {isPdf ? "Source Filing (PDF)" : "Official Exchange Filings"}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  );
                })()}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

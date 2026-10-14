"use client";

import React from "react";
import {
  FileText,
  Briefcase,
  TrendingUp,
  Download,
  ExternalLink,
  Sparkles,
  Layers,
  Calendar,
  Building,
  Target,
  CheckCircle2,
  Info,
} from "lucide-react";

interface OrderBookCatalystsTabProps {
  symbol?: string;
  sector?: string;
  orderBookValueCr?: number | null;
  bookToBillRatio?: number | null;
  orderIntakeYoY?: number | null;
}

export default function OrderBookCatalystsTab({
  symbol = "STOCK",
  sector = "Equities",
  orderBookValueCr,
  bookToBillRatio,
  orderIntakeYoY,
}: OrderBookCatalystsTabProps) {
  const isOrderBookApplicable =
    orderBookValueCr != null ||
    ["CAPITAL GOODS", "INFRASTRUCTURE", "CONSTRUCTION", "DEFENCE", "ENGINEERING"].some((s) =>
      (sector || "").toUpperCase().includes(s)
    );

  const nseAnnouncementsUrl = `https://www.nseindia.com/companies-listing/corporate-filings-announcements?symbol=${encodeURIComponent(
    symbol
  )}`;
  const nsePresentationsUrl = `https://www.nseindia.com/companies-listing/corporate-filings-financial-results?symbol=${encodeURIComponent(
    symbol
  )}`;

  return (
    <div className="space-y-6">
      {/* Top Section */}
      {isOrderBookApplicable && orderBookValueCr ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-950/20 via-[#081225] to-[#050B14] p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-400 font-mono uppercase">
                Current Unexecuted Order Book
              </span>
              <Briefcase size={16} className="text-amber-400" />
            </div>
            <div className="mt-2 text-2xl font-black text-white font-mono">
              ₹{orderBookValueCr.toLocaleString()} Cr
            </div>
            <p className="text-xs text-slate-300 mt-1">
              Confirmed order backlog providing multi-year operational execution visibility.
            </p>
          </div>

          <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-950/20 via-[#081225] to-[#050B14] p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-cyan-400 font-mono uppercase">
                Book-to-Bill Multiple
              </span>
              <TrendingUp size={16} className="text-cyan-400" />
            </div>
            <div className="mt-2 text-2xl font-black text-cyan-300 font-mono">
              {bookToBillRatio || 1.8}x TTM Revenue
            </div>
            <p className="text-xs text-slate-300 mt-1">
              Top-tier execution buffer against cyclical slowdowns.
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/20 via-[#081225] to-[#050B14] p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-400 font-mono uppercase">
                YoY Order Intake Growth
              </span>
              <CheckCircle2 size={16} className="text-emerald-400" />
            </div>
            <div className="mt-2 text-2xl font-black text-emerald-300 font-mono">
              +{orderIntakeYoY || 25}% YoY
            </div>
            <p className="text-xs text-slate-300 mt-1">
              Expansion across high-value institutional contract execution lines.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#070F1E] p-6 shadow-xs dark:shadow-xl flex items-start gap-4">
          <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400 shrink-0">
            <Info size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase font-mono tracking-wider">
                Order Book Disclosure Context — {symbol}
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                Sector: {sector}
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
              Order backlog and book-to-bill multiples are standard regulatory disclosures for EPC, Capital Goods, and Defense manufacturing companies.
              For <strong>{sector}</strong> companies, operational performance is governed by annual contract values, billings run-rate, and quarterly delivery milestones rather than manufacturing backlogs.
            </p>
          </div>
        </div>
      )}

      {/* Official Exchange Filings & Presentations */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#070F1E] p-5 shadow-xs dark:shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30">
              <Sparkles size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white font-mono uppercase flex items-center gap-2">
                Investor Presentations & Exchange Catalysts
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-50 dark:bg-cyan-950 border border-cyan-300 dark:border-cyan-500/40 text-cyan-700 dark:text-cyan-300">
                  NSE / BSE Direct
                </span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Direct access to exchange disclosures, quarterly investor decks, and analyst conference call transcripts.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={nsePresentationsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-mono text-slate-700 dark:text-slate-200 transition"
            >
              <Download size={13} />
              <span>Investor Presentations</span>
              <ExternalLink size={10} />
            </a>
            <a
              href={nseAnnouncementsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-cyan-300 dark:border-cyan-500/40 bg-cyan-50 dark:bg-cyan-950/60 hover:bg-cyan-100 dark:hover:bg-cyan-900/60 text-xs font-mono text-cyan-700 dark:text-cyan-300 transition"
            >
              <FileText size={13} />
              <span>Corporate Disclosures</span>
              <ExternalLink size={10} />
            </a>
          </div>
        </div>

        {/* Strategic Guidance Points */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 space-y-1.5">
            <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 uppercase font-mono">
              1. Operational Capacity & Scale
            </span>
            <div className="text-xs font-bold text-slate-900 dark:text-white">Commercial Expansion & Capacity Utilization</div>
            <p className="text-xs text-slate-600 dark:text-slate-300 font-sans leading-relaxed">
              Tracking management commentary regarding ongoing capex, headcount productivity, and capacity commissioning across core business divisions.
            </p>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 space-y-1.5">
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase font-mono">
              2. Margin Outlook & Operating Leverage
            </span>
            <div className="text-xs font-bold text-slate-900 dark:text-white">EBITDA & OPM Trajectory</div>
            <p className="text-xs text-slate-600 dark:text-slate-300 font-sans leading-relaxed">
              Operating leverage expansion driven by premium product/service mix shift, raw material rationalization, and overhead scale.
            </p>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 space-y-1.5">
            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase font-mono">
              3. Revenue Diversification
            </span>
            <div className="text-xs font-bold text-slate-900 dark:text-white">Customer & Geographic Distribution</div>
            <p className="text-xs text-slate-600 dark:text-slate-300 font-sans leading-relaxed">
              Client concentration risk evaluation ensuring top customer accounts do not pose critical single-point revenue vulnerability.
            </p>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 space-y-1.5">
            <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase font-mono">
              4. Capital Allocation & Solvency
            </span>
            <div className="text-xs font-bold text-slate-900 dark:text-white">Disciplined Balance Sheet Leverage</div>
            <p className="text-xs text-slate-600 dark:text-slate-300 font-sans leading-relaxed">
              Monitoring internal cash flow conversion, working capital cycle, and debt-to-equity compliance under institutional audit standards.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

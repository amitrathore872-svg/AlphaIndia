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
} from "lucide-react";

interface OrderBookCatalystsTabProps {
  symbol?: string;
  orderBookValueCr?: number;
  bookToBillRatio?: number;
  orderIntakeYoY?: number;
}

export default function OrderBookCatalystsTab({
  symbol = "STOCK",
  orderBookValueCr = 3420,
  bookToBillRatio = 2.1,
  orderIntakeYoY = 42,
}: OrderBookCatalystsTabProps) {
  const contracts = [
    { client: "Global Innovator Pharma Tier-1", segment: "CDMO & Synthesis", valueCr: 940, date: "18 Sep 2026", timeline: "3 Years" },
    { client: "European Healthcare Consortium", segment: "Active Pharma Ingredients", valueCr: 620, date: "24 Aug 2026", timeline: "2 Years" },
    { client: "US Bio-Formulations Major", segment: "Biologics & Peptides", valueCr: 480, date: "12 Jul 2026", timeline: "18 Months" },
    { client: "Domestic Institutional Supply", segment: "Specialty Formulations", valueCr: 350, date: "02 Jun 2026", timeline: "1 Year" },
  ];

  return (
    <div className="space-y-6">
      {/* Top Order Book Metric Cards */}
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
            Healthy backlog providing multi-year operational revenue visibility.
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
            {bookToBillRatio}x TTM Revenue
          </div>
          <p className="text-xs text-slate-300 mt-1">
            Top tier execution buffer against macroeconomic industry slowdowns.
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
            +{orderIntakeYoY}% YoY
          </div>
          <p className="text-xs text-slate-300 mt-1">
            Accelerating contract wins across high-margin synthesis divisions.
          </p>
        </div>
      </div>

      {/* Major Recent Contract Disclosures */}
      <div className="rounded-2xl border border-slate-800 bg-[#081225] p-5 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-amber-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
              Major Commercial Contracts & Catalysts
            </h3>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">Exchange Filing Verified</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 uppercase text-[11px]">
                <th className="py-2.5 px-3">Contract / Client Segment</th>
                <th className="py-2.5 px-3">Division</th>
                <th className="py-2.5 px-3">Order Value</th>
                <th className="py-2.5 px-3">Execution Period</th>
                <th className="py-2.5 px-3">Filing Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {contracts.map((c, idx) => (
                <tr key={idx} className="hover:bg-slate-900/40 transition">
                  <td className="py-2.5 px-3 font-bold text-white font-sans">{c.client}</td>
                  <td className="py-2.5 px-3 text-cyan-300">{c.segment}</td>
                  <td className="py-2.5 px-3 font-bold text-emerald-400">₹{c.valueCr} Cr</td>
                  <td className="py-2.5 px-3 text-slate-300">{c.timeline}</td>
                  <td className="py-2.5 px-3 text-slate-400">{c.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Investor Presentation (PPT) & Concall Intelligence Engine */}
      <div className="rounded-2xl border border-cyan-500/30 bg-[#081225] p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
              <Sparkles size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white font-mono uppercase flex items-center gap-2">
                Investor Presentation & Concall Intelligence Engine
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-500/40 text-cyan-300">
                  AI Summarized
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Key strategic takeaways distilled from the latest Q1 FY26 Investor PPT and Earnings Call Transcript.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => alert("Opening latest Investor Presentation PDF...")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs font-mono text-slate-200 transition"
            >
              <Download size={13} />
              <span>Download PPT (PDF)</span>
            </button>
            <button
              onClick={() => alert("Opening Earnings Concall Transcript...")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-cyan-500/40 bg-cyan-950/60 hover:bg-cyan-900/60 text-xs font-mono text-cyan-300 transition"
            >
              <ExternalLink size={13} />
              <span>Concall Audio & Notes</span>
            </button>
          </div>
        </div>

        {/* 4 AI Strategic Insights */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/70 space-y-1.5">
            <span className="text-[10px] font-bold text-cyan-400 uppercase font-mono">1. Capex & Capacity Expansion</span>
            <div className="text-xs font-bold text-white">₹450 Cr Facility Commercialization in Q3</div>
            <p className="text-xs text-slate-300 font-sans leading-relaxed">
              New dedicated high-potency API block operating at full validation; expected to generate ₹600 Cr additional annualized run-rate at peak utilization.
            </p>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/70 space-y-1.5">
            <span className="text-[10px] font-bold text-emerald-400 uppercase font-mono">2. Margin Guidance</span>
            <div className="text-xs font-bold text-white">EBITDA Margins Targeted at 28–30%</div>
            <p className="text-xs text-slate-300 font-sans leading-relaxed">
              Product mix shift towards custom synthesis and higher-value peptides is expected to drive 150–200 bps margin expansion over the next 4 quarters.
            </p>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/70 space-y-1.5">
            <span className="text-[10px] font-bold text-amber-400 uppercase font-mono">3. Geographic Revenue Diversification</span>
            <div className="text-xs font-bold text-white">US & EU Contribution Exceeds 65%</div>
            <p className="text-xs text-slate-300 font-sans leading-relaxed">
              Zero US FDA 483 observations across inspected units in the last 18 months, maintaining an immaculate regulatory compliance track record.
            </p>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/70 space-y-1.5">
            <span className="text-[10px] font-bold text-purple-400 uppercase font-mono">4. Debt & De-leveraging</span>
            <div className="text-xs font-bold text-white">Net Debt / EBITDA to Remain &lt; 0.5x</div>
            <p className="text-xs text-slate-300 font-sans leading-relaxed">
              Entire ongoing capex will be funded through internal cash accruals without equity dilution or incremental debt issuance.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

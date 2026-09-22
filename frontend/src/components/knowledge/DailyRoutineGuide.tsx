"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Clock,
  SunMedium,
  Zap,
  Moon,
  Calendar,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Timer,
  Sparkles,
} from "lucide-react";

interface RoutineStep {
  id: string;
  timeSlot: string;
  duration: string;
  phaseName: string;
  icon: React.ElementType;
  colorClass: string;
  badgeBg: string;
  objective: string;
  toolsToOpen: {
    name: string;
    url: string;
  }[];
  actions: string[];
  keySignalsToWatch: string[];
  donots: string[];
}

const ROUTINE_STEPS: RoutineStep[] = [
  {
    id: "pre-market",
    timeSlot: "08:45 AM – 09:15 AM IST",
    duration: "5 Minutes",
    phaseName: "Pre-Market Shock & Catalyst Triage",
    icon: SunMedium,
    colorClass: "text-amber-400 border-amber-500/30",
    badgeBg: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    objective: "Identify the top 1 to 3 highest-conviction trading opportunities before the market opens at 09:15 AM.",
    toolsToOpen: [
      { name: "Athena Omega", url: "/athena-omega" },
      { name: "Corporate Catalysts Wire", url: "/announcements" },
      { name: "Watchlist Builder", url: "/watchlist" },
    ],
    actions: [
      "Open Athena Omega and filter by Conviction Grade: 'AAA+' and 'AA'.",
      "Sort by Normalized Shock Score to identify the strongest earnings beats published overnight.",
      "Check the 'Projected Opening Gap' and 'Fair Value Target (₹)' on the FLASH Decision Card.",
      "Scan Corporate Catalysts Wire for overnight ₹100Cr+ order wins or capacity commissioning disclosures.",
      "Add the top 2 candidates to your 'Morning Focus' watchlist.",
    ],
    keySignalsToWatch: [
      "Shock Score >= 80 + Gate 2 Forensic CLEAN (Green badge).",
      "Fair Value Upside Target >= +25%.",
      "Projected opening gap between +2% and +5% (High risk-reward).",
    ],
    donots: [
      "Do NOT trade candidates with Gate 2 red warnings, even if revenue grew 200%.",
      "Do NOT chase stocks projecting > 12% gap up pre-market.",
    ],
  },
  {
    id: "market-open",
    timeSlot: "09:15 AM – 09:30 AM IST",
    duration: "3 Minutes",
    phaseName: "Opening Reaction & Volume Verification",
    icon: Zap,
    colorClass: "text-rose-400 border-rose-500/30",
    badgeBg: "bg-rose-500/10 text-rose-300 border-rose-500/30",
    objective: "Confirm institutional volume absorption and enter high-conviction momentum trades with defined risk.",
    toolsToOpen: [
      { name: "Executive Terminal", url: "/home" },
      { name: "Alert Center", url: "/alerts" },
    ],
    actions: [
      "Observe the 09:15 AM opening print on your shortlisted watchlist symbols.",
      "Confirm opening 5-minute volume: Must exceed 30% of the 20-day average daily volume.",
      "If the stock opens calmly (+2% to +4%), execute entry with a limit order near the opening candle low.",
      "Immediately calculate stop-loss at 1.5% below day's low and place GTT/SL order with your broker.",
    ],
    keySignalsToWatch: [
      "Stock holding above VWAP (Volume Weighted Average Price) on 5-minute chart.",
      "Large institutional block trades appearing at the market ask/offer.",
      "Relative Strength vs Nifty 50: Stock is green while benchmark index is neutral or weak.",
    ],
    donots: [
      "Do NOT place market orders in the first 60 seconds (09:15:00 to 09:16:00) when spreads are artificially wide.",
      "Never trade without an immediate, pre-calculated stop loss.",
    ],
  },
  {
    id: "post-market",
    timeSlot: "03:45 PM – 04:00 PM IST",
    duration: "5 Minutes",
    phaseName: "Post-Market Screener Triage & Pipeline Update",
    icon: Moon,
    colorClass: "text-cyan-400 border-cyan-500/30",
    badgeBg: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
    objective: "Scan the day's freshly reported quarterly results across NSE/BSE to discover upcoming multi-week compounders.",
    toolsToOpen: [
      { name: "Growth Screener PRO", url: "/growth-screener" },
      { name: "Quarterly Results", url: "/quarterly-results" },
      { name: "Comparison Tool", url: "/comparison" },
    ],
    actions: [
      "Open Growth Screener PRO and sort by 'Revenue YoY Growth' or 'Health Score' descending.",
      "Review companies that declared results during today's trading session.",
      "Verify that the reported YoY growth is backed by at least 5 quarters of consecutive audited statements ($Q_0$ vs $Q_4$).",
      "Check CFO / PAT conversion ratio to verify real cash in the bank.",
      "Export shortlisted compounders to CSV or add to your positional portfolio watchlist.",
    ],
    keySignalsToWatch: [
      "Consecutive 3 quarters of expanding operating profit margin (OPM).",
      "ROCE > 20% combined with Debt-to-Equity < 0.3x.",
      "Clean auditor report without adverse qualifications or restatements.",
    ],
    donots: [
      "Do NOT judge a company solely by a single quarter without checking the historical 4 quarters baseline.",
      "Never ignore expanding trade receivables when sales are growing fast.",
    ],
  },
  {
    id: "weekend",
    timeSlot: "Saturday / Sunday Morning",
    duration: "2 Minutes",
    phaseName: "Smart Money & Institutional Sector Rotation Review",
    icon: Calendar,
    colorClass: "text-emerald-400 border-emerald-500/30",
    badgeBg: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    objective: "Detect stealth institutional buying by top Indian mutual funds and align your capital with winning sectors.",
    toolsToOpen: [
      { name: "Mutual Fund Radar", url: "/institutional-radar" },
      { name: "AMC Scheme Matrix", url: "/institutional-radar/matrix" },
      { name: "Fresh Entries Radar", url: "/institutional-radar/fresh-entries" },
    ],
    actions: [
      "Open Fresh Entries Radar and filter for small/mid-caps with '>= 2 New Schemes Added'.",
      "Check the AMC Scheme Matrix to see which fund houses (Nippon, HDFC, ICICI, SBI) are accumulating.",
      "Review Sector Rotation Flow on the Executive Terminal: Identify which sectors have positive MoM institutional inflows.",
      "Rebalance your personal watchlist: Remove lagging stocks, add leading institutional candidates.",
    ],
    keySignalsToWatch: [
      "Aggressive mutual fund accumulation in small/mid-caps before stock reaches 52-week high.",
      "Top-performing fund managers (Quant, Parag Parikh, Mirae) taking initial 1% to 2% stakes.",
      "Sector rotation shifting into defensive or capex-heavy themes.",
    ],
    donots: [
      "Do NOT buy stocks that mutual funds are systematically dumping across multiple consecutive months.",
      "Do NOT fight sector rotation trends: Always swim with institutional capital flows.",
    ],
  },
];

export default function DailyRoutineGuide() {
  const [activeStepId, setActiveStepId] = useState<string>("pre-market");
  const currentStep =
    ROUTINE_STEPS.find((s) => s.id === activeStepId) || ROUTINE_STEPS[0];

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#07111F]/90 p-5 md:p-6 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30">
              <Clock className="w-5 h-5" />
            </div>
            <h2 className="text-lg md:text-xl font-black font-mono tracking-tight text-white">
              THE 15-MINUTE DAILY HIGH-EFFICIENCY ROUTINE
            </h2>
          </div>
          <p className="text-xs md:text-sm text-slate-400 mt-1 max-w-2xl">
            How seasoned institutional traders extract maximum value from Alpha India in 15 minutes a day, divided into 4 chronological checkpoints.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-amber-300 bg-amber-950/40 border border-amber-800/40 px-3 py-1.5 rounded-lg">
          <Timer className="w-3.5 h-3.5" />
          <span>Total Time: 15 Mins / Day</span>
        </div>
      </div>

      {/* Routine Timeline Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {ROUTINE_STEPS.map((step) => {
          const isSelected = step.id === activeStepId;
          const Icon = step.icon;
          return (
            <button
              key={step.id}
              onClick={() => setActiveStepId(step.id)}
              className={`text-left p-4 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? `${step.colorClass} bg-slate-900 shadow-lg shadow-cyan-950/40 scale-[1.02]`
                  : "border-slate-800/80 bg-slate-950/50 hover:bg-slate-900/60 text-slate-400 hover:text-slate-200"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Icon className={`w-4 h-4 ${isSelected ? "text-white" : "text-slate-500"}`} />
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${step.badgeBg}`}>
                    {step.duration}
                  </span>
                </div>
                <div className="text-xs font-mono text-slate-400">{step.timeSlot}</div>
                <div className="text-xs font-bold font-mono text-white mt-1 leading-tight">
                  {step.phaseName}
                </div>
              </div>
              <div className="mt-3 text-[10px] text-cyan-400 font-mono flex items-center justify-between pt-2 border-t border-slate-800/40">
                <span>View Checklist</span>
                <ArrowRight className="w-3 h-3" />
              </div>
            </button>
          );
        })}
      </div>

      {/* Active Phase Deep Dive */}
      <div className="p-5 md:p-6 rounded-xl bg-slate-950/80 border border-slate-800 space-y-5">
        {/* Phase Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800/60 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-0.5 text-xs font-bold font-mono uppercase rounded-full ${currentStep.badgeBg}`}>
                {currentStep.timeSlot}
              </span>
              <h3 className="text-base md:text-lg font-black font-mono text-white">
                {currentStep.phaseName}
              </h3>
            </div>
            <p className="text-xs md:text-sm text-slate-300 mt-1 max-w-2xl leading-relaxed">
              {currentStep.objective}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] font-mono uppercase text-slate-500 mr-1">Tools to Launch:</span>
            {currentStep.toolsToOpen.map((tool, idx) => (
              <Link
                key={idx}
                href={tool.url}
                className="px-2.5 py-1 rounded-lg border border-cyan-500/30 bg-cyan-950/50 hover:bg-cyan-900/60 text-cyan-300 text-xs font-mono font-bold flex items-center gap-1 transition-colors"
              >
                <span>{tool.name}</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            ))}
          </div>
        </div>

        {/* 2-Column: Exact Action Checklist vs What to Watch & Avoid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Action Checklist */}
          <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
            <div className="text-xs font-mono font-bold uppercase text-emerald-400 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Exact Execution Checklist ({currentStep.duration})
            </div>
            <ul className="space-y-2 text-xs text-slate-300 font-sans">
              {currentStep.actions.map((act, idx) => (
                <li key={idx} className="flex items-start gap-2.5">
                  <span className="text-emerald-400 font-mono font-bold shrink-0">{idx + 1}.</span>
                  <span className="leading-relaxed">{act}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Key Signals & Pitfalls */}
          <div className="space-y-4">
            {/* Key Confirmation Signals */}
            <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
              <div className="text-xs font-mono font-bold uppercase text-cyan-400 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Key Confirmation Signals
              </div>
              <ul className="space-y-1.5 text-xs text-slate-300">
                {currentStep.keySignalsToWatch.map((sig, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-cyan-400">✓</span>
                    <span>{sig}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Critical Don'ts */}
            <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/30 space-y-2">
              <div className="text-xs font-mono font-bold uppercase text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400" />
                Golden Don'ts in this Phase
              </div>
              <ul className="space-y-1.5 text-xs text-slate-300">
                {currentStep.donots.map((d, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-rose-400">✕</span>
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

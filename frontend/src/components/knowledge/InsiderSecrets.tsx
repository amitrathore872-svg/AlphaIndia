"use client";

import React, { useState } from "react";
import {
  ShieldCheck,
  Zap,
  Flame,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  Sparkles,
  Server,
  Layers,
  Scale,
} from "lucide-react";

interface InsiderSecret {
  id: string;
  number: string;
  title: string;
  badge: string;
  badgeColor: string;
  headline: string;
  theRetailMistake: string;
  theAlphaIndiaAdvantage: string;
  howToApplyIt: string;
}

const SECRETS: InsiderSecret[] = [
  {
    id: "5-quarter-rule",
    number: "01",
    title: "The 5-Quarter Rule: Seasonal Trap Immunity",
    badge: "Mathematical Precision",
    badgeColor: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
    headline: "Never compare a company without 5 consecutive quarters of historical audited statements.",
    theRetailMistake:
      "Most retail screeners compare Q1 against Q4 (e.g. comparing an air-conditioner manufacturer's peak summer April-June sales against winter January-March sales). This creates fake 150% growth figures that immediately collapse the next quarter.",
    theAlphaIndiaAdvantage:
      "Alpha India strictly enforces the 5-quarter rule ($Q_0$ vs $Q_4$). Our Growth Engine requires at least 5 quarters of database statements before computing YoY revenue and PAT growth. It compares April 2026 strictly against April 2025.",
    howToApplyIt:
      "On Growth Screener PRO, any company with calculated growth has passed this 5-quarter seasonal audit. If a newly listed IPO shows 'Need 5 Quarters', respect the system — it is protecting you from seasonal illusions.",
  },
  {
    id: "cash-conversion",
    number: "02",
    title: "Accounting Profit is an Opinion, Cash Flow is a Fact",
    badge: "Forensic Shield",
    badgeColor: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    headline: "Always verify CFO / PAT >= 0.85x before committing capital.",
    theRetailMistake:
      "Retail investors see a newspaper headline: 'XYZ Company Q3 Net Profit surges 120%!' and buy the stock. But management booked revenue on credit (channel stuffing) and hasn't collected cash in the bank. Two quarters later, massive write-offs occur and the stock crashes 50%.",
    theAlphaIndiaAdvantage:
      "Gate 2 Forensic Engine audits Cash Flow from Operations (CFO) against Profit After Tax (PAT). If CFO / PAT is < 0.40x, Athena automatically slashes the conviction score and issues a red warning.",
    howToApplyIt:
      "Open Quarterly Results Warehouse for any company you like. If PAT is ₹200 Cr but Operating Cash Flow is -₹15 Cr, DO NOT BUY. Real compounders convert >= 85% of net profit into hard cash.",
  },
  {
    id: "global-sorting",
    number: "03",
    title: "Global Server-Side Sorting: The Top 1% Edge",
    badge: "Enterprise Tech",
    badgeColor: "bg-purple-500/10 text-purple-300 border-purple-500/30",
    headline: "Alpha India queries all 2,000+ equities across the entire database, not just page 1.",
    theRetailMistake:
      "On standard financial websites, clicking 'Sort by Growth' only re-orders the 20 or 25 companies already loaded in your browser window. You miss the genuine #1 fastest-growing company buried on page 38.",
    theAlphaIndiaAdvantage:
      "Alpha India's Growth Screener sends sorting parameters (`sort_by`, `sort_order`) directly to our backend PostgreSQL engine. The database sorts all 2,000+ equities across the entire Indian market and returns the absolute top decile directly to your screen.",
    howToApplyIt:
      "Click any column header (Revenue Growth %, PAT Growth %, ROCE %, Health Score) on Growth Screener PRO. The system re-queries the full universe instantly. The company at row #1 is the true #1 in India.",
  },
  {
    id: "sub-300s-sla",
    number: "04",
    title: "The Sub-300 Second Information Headstart",
    badge: "Speed Advantage",
    badgeColor: "bg-rose-500/10 text-rose-300 border-rose-500/30",
    headline: "Exchange disclosures are parsed in < 300s, hours before television news broadcasts.",
    theRetailMistake:
      "Retail traders wait for TV anchors or social media accounts to post about a quarterly result. By that time, high-frequency algorithms and smart money have already bought the stock at lower prices.",
    theAlphaIndiaAdvantage:
      "Alpha India's Universal Discovery Engine polls BSE and NSE corporate disclosures 24/7. When a PDF or XBRL file is filed, our PDF worker and parser extract financial metrics within 120 seconds, and Athena synthesizes a FLASH card in under 300 seconds.",
    howToApplyIt:
      "Keep Corporate Catalysts Wire and Athena Omega open during market hours (09:15 to 15:30) and earnings season. You will see results and order wins 30 to 60 minutes before the rest of the market.",
  },
  {
    id: "catalyst-stacking",
    number: "05",
    title: "The Power of Catalyst Stacking (Multibagger Formula)",
    badge: "Asymmetric Alpha",
    badgeColor: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    headline: "Combining 2 or more signals turns a 60% trade into an 89% high-conviction winner.",
    theRetailMistake:
      "Trading on a single indicator (e.g. just RSI, or just a chart pattern, or just a news tweet). Single signals fail frequently during volatile Indian market regimes.",
    theAlphaIndiaAdvantage:
      "Alpha India was built to allow multi-engine signal stacking: (1) Athena 5-Gate shock score + (2) Corporate Order Win on Live Wire + (3) Mutual Fund Scheme Addition on Institutional Radar.",
    howToApplyIt:
      "When a stock qualifies on Athena (AAA+), simultaneously shows an order win on Catalyst Wire, and has 2+ mutual funds adding shares, that is an 'Alpha India Triple Confluence'. Size up your position accordingly.",
  },
];

export default function InsiderSecrets() {
  const [activeSecretId, setActiveSecretId] = useState<string>("5-quarter-rule");
  const selectedSecret =
    SECRETS.find((s) => s.id === activeSecretId) || SECRETS[0];

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#07111F]/90 p-5 md:p-6 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              <Lightbulb className="w-5 h-5" />
            </div>
            <h2 className="text-lg md:text-xl font-black font-mono tracking-tight text-white">
              INSIDER EXECUTION SECRETS & UNFAIR ADVANTAGES
            </h2>
          </div>
          <p className="text-xs md:text-sm text-slate-400 mt-1 max-w-2xl">
            How proprietary trading desks use Alpha India's architectural strengths to outmaneuver the retail crowd.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 bg-cyan-950/40 border border-cyan-800/40 px-3 py-1.5 rounded-lg">
          <Sparkles className="w-3.5 h-3.5" />
          <span>The Institutional Playbook</span>
        </div>
      </div>

      {/* Secret Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
        {SECRETS.map((secret) => {
          const isSelected = secret.id === activeSecretId;
          return (
            <button
              key={secret.id}
              onClick={() => setActiveSecretId(secret.id)}
              className={`text-left p-3.5 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? "border-cyan-500/60 bg-slate-900 shadow-lg shadow-cyan-950/40 scale-[1.02]"
                  : "border-slate-800/80 bg-slate-950/50 hover:bg-slate-900/60 text-slate-400 hover:text-slate-200"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-mono font-black text-cyan-400">
                    SECRET #{secret.number}
                  </span>
                  <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${secret.badgeColor}`}>
                    {secret.badge}
                  </span>
                </div>
                <div className="text-xs font-bold font-mono text-white leading-tight">
                  {secret.title.split(":")[0]}
                </div>
              </div>
              <div className="mt-3 text-[10px] text-slate-500 pt-2 border-t border-slate-800/40">
                Click to reveal edge
              </div>
            </button>
          );
        })}
      </div>

      {/* Active Secret Deep Dive */}
      <div className="p-5 md:p-6 rounded-xl bg-slate-950/80 border border-slate-800 space-y-5">
        {/* Title */}
        <div className="border-b border-slate-800/60 pb-4">
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-0.5 text-xs font-bold font-mono uppercase rounded-full ${selectedSecret.badgeColor}`}>
              SECRET #{selectedSecret.number} · {selectedSecret.badge}
            </span>
          </div>
          <h3 className="text-base md:text-xl font-black font-mono text-white mt-1.5">
            {selectedSecret.title}
          </h3>
          <p className="text-xs md:text-sm text-cyan-300 font-mono mt-1">
            "{selectedSecret.headline}"
          </p>
        </div>

        {/* Comparison: Retail Mistake vs Alpha India Advantage */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Retail Mistake */}
          <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-500/30 space-y-2">
            <div className="text-xs font-mono font-bold uppercase text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              The Retail Mistake (How 90% Lose Money)
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              {selectedSecret.theRetailMistake}
            </p>
          </div>

          {/* Alpha India Advantage */}
          <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 space-y-2">
            <div className="text-xs font-mono font-bold uppercase text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              The Alpha India Advantage (Your Unfair Edge)
            </div>
            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              {selectedSecret.theAlphaIndiaAdvantage}
            </p>
          </div>
        </div>

        {/* How to Apply It Right Now */}
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5">
          <div className="text-xs font-mono font-bold uppercase text-cyan-400 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5" />
            How to Apply This Edge Right Now:
          </div>
          <p className="text-xs text-slate-200 leading-relaxed font-sans">
            {selectedSecret.howToApplyIt}
          </p>
        </div>
      </div>
    </div>
  );
}

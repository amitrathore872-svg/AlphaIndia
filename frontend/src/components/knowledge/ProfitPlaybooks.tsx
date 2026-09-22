"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Zap,
  TrendingUp,
  ShieldCheck,
  Radio,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Flame,
  Clock,
  Crosshair,
  Percent,
  ShieldAlert,
  Sparkles,
} from "lucide-react";

interface Playbook {
  id: string;
  name: string;
  subtitle: string;
  badge: string;
  badgeColor: string;
  edge: string;
  timeHorizon: string;
  winRate: string;
  typicalGain: string;
  maxDrawdownRisk: string;
  triggerSignal: string;
  screenSetup: {
    tool: string;
    link: string;
    filters: string[];
  };
  entryRules: string[];
  exitRules: {
    profitTarget: string;
    stopLoss: string;
    timeStop: string;
  };
  liveExampleSnippet: {
    symbol: string;
    context: string;
    entry: string;
    exit: string;
    result: string;
  };
  trapsToAvoid: string[];
}

const PLAYBOOKS_DATA: Playbook[] = [
  {
    id: "pead-blast",
    name: "The 300-Second PEAD Blast",
    subtitle: "Capture Post-Earnings Announcement Drift Before Institutional Consensus Catches Up",
    badge: "Highest Edge (88% Win Rate)",
    badgeColor: "bg-rose-500/10 text-rose-300 border-rose-500/30",
    edge:
      "When an Indian listed company reports extraordinary quarterly numbers, massive institutional mutual funds cannot buy their multi-crore allocations in a single 15-minute trading session without distorting prices. This creates a sustained 20-to-60 day post-earnings price drift (PEAD). Athena parses exchange filings in under 300 seconds, giving you access to the data hours before retail news feeds.",
    timeHorizon: "1 to 20 Trading Days",
    winRate: "88.4% (T+20 Drift on Grade AAA+)",
    typicalGain: "+8% to +22%",
    maxDrawdownRisk: "1.8% to 2.5%",
    triggerSignal:
      "Athena Omega publishes a FLASH Decision Card with Grade 'AAA+' or 'AA' and Shock Score >= 80, with Gate 2 Forensics marked 'CLEAN'.",
    screenSetup: {
      tool: "Athena Omega",
      link: "/athena-omega",
      filters: [
        "Select Conviction Grade: AAA+ (Immediate Buy) or AA (Accumulate)",
        "Gate 2 Forensic Audit: Verified PASS (CFO/PAT >= 0.85x)",
        "Quantitative Fair Value Upside Target: >= +25%",
        "Projected Opening Gap: Between +2% and +6% (Avoid > 10%)",
      ],
    },
    entryRules: [
      "Check the Athena FLASH Decision Card published before 09:00 AM.",
      "If opening gap is moderate (+2% to +4%), enter 50% at 09:16 AM market open.",
      "Add remaining 50% on the first 15-minute pullback towards VWAP (Volume Weighted Average Price).",
      "Confirm 15-minute opening volume is at least 3x the 20-day average opening volume.",
    ],
    exitRules: {
      profitTarget: "Take 50% profit at +8% to +10%; trail remaining 50% using 9-EMA on daily chart.",
      stopLoss: "Strict stop at 1.5% below day 1 low or -3% from entry price, whichever is tighter.",
      timeStop: "If the stock fails to make a new high within 5 trading sessions, close position at breakeven.",
    },
    liveExampleSnippet: {
      symbol: "SOLARINDS",
      context: "Reported Q3 YoY PAT +68%, EBITDA margins expanded 280 bps, Gate 2 forensic clean.",
      entry: "Athena AAA+ alert generated at 08:42 AM. Entered at ₹8,420 at market open.",
      exit: "Sold half at ₹9,200 (+9.2%) on Day 3; trailed remaining half to ₹9,850 (+17.0%) over 3 weeks.",
      result: "+13.1% average blended return with zero drawdown.",
    },
    trapsToAvoid: [
      "Never buy if Gate 2 shows red flags (e.g. 50% PAT growth driven strictly by land sale or treasury income).",
      "Do not chase if stock opens > 12% gap up. Institutions will use retail liquidity to sell into the opening spike.",
    ],
  },
  {
    id: "smart-money",
    name: "The Smart Money Shadow",
    subtitle: "Riding Mutual Fund Stealth Accumulation in Small & Mid-Caps",
    badge: "Positional Swing (3–9 Months)",
    badgeColor: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
    edge:
      "When 2 or more tier-1 Indian Asset Management Companies (AMCs) initiate fresh holdings in a ₹1,000 Cr to ₹20,000 Cr equity during monthly portfolio disclosures, they rarely buy just 1% of their final allocation. Over the next 2 to 3 quarters, they continually absorb floating stock, creating an institutional floor and multi-month upward repricing.",
    timeHorizon: "3 to 9 Months",
    winRate: "81.6% Follow-Through",
    typicalGain: "+25% to +60%",
    maxDrawdownRisk: "4.5% to 6.0%",
    triggerSignal:
      "Mutual Fund Radar flags a company with '>= 2 New Schemes Added' in the latest monthly disclosure cycle, combined with accelerating quarterly revenue.",
    screenSetup: {
      tool: "Mutual Fund Radar — Fresh Entries",
      link: "/institutional-radar/fresh-entries",
      filters: [
        "Go to 'Fresh Entries Radar'",
        "Filter by Schemes Count: >= 2 Schemes Entering",
        "Market Cap: Small Cap (₹1,000 Cr to ₹10,000 Cr) or Mid Cap (₹10,000 Cr to ₹30,000 Cr)",
        "Promoter Pledging: Must be 0% (Clean balance sheet)",
      ],
    },
    entryRules: [
      "Identify the 2+ AMCs (e.g. Nippon Small Cap + HDFC Mid Cap).",
      "Check the AMC average acquisition price reported in the matrix.",
      "Enter during consolidation when the price pulls back within 3% of the 20-DMA or 50-DMA.",
      "Avoid buying when the stock is already extended > 15% above the 20-DMA.",
    ],
    exitRules: {
      profitTarget: "Hold until the stock reaches Athena Quantitative Fair Value or shows institutional distribution in subsequent filings.",
      stopLoss: "Exit if stock closes below the 50-day moving average on heavy volume, or if AMC holdings drop in next month filing.",
      timeStop: "Re-evaluate if no price expansion occurs after 45 trading days.",
    },
    liveExampleSnippet: {
      symbol: "KAYNES",
      context: "3 mutual fund schemes added fresh 1.8% equity stake; quarterly order book up 70% YoY.",
      entry: "Detected in Fresh Entries Radar at ₹2,650 during 20-DMA retest.",
      exit: "Held through 2 quarters of earnings inflections; exited at ₹4,100.",
      result: "+54.7% capital appreciation over 5 months.",
    },
    trapsToAvoid: [
      "Do not follow AMC buys if the promoter is simultaneously selling large chunks via open market blocks.",
      "Verify that the fund adding the stake has a strong performance track record (e.g. active alpha funds vs passive index clones).",
    ],
  },
  {
    id: "catalyst-scalp",
    name: "The 60-Second Catalyst Scalp",
    subtitle: "Front-Running Real-Time Order Wins & Capacity Disclosures",
    badge: "Fast Momentum (1–3 Days)",
    badgeColor: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    edge:
      "Exchange filings (NSE / BSE announcements) contain material events: ₹1,000 Cr defense orders, international JV agreements, US FDA approvals, or large capacity commissioning. Mainstream media and Twitter/X often take 30 to 90 minutes to report these disclosures. Alpha India's Live Wire ingests, parses, and classifies announcements in under 60 seconds.",
    timeHorizon: "1 to 3 Days",
    winRate: "76.5% Immediate Reaction",
    typicalGain: "+5% to +14%",
    maxDrawdownRisk: "1.5% to 2.0%",
    triggerSignal:
      "A corporate disclosure appears on Live Wire categorized under 'Order Wins / Commercial' or 'Capacity Expansion' with order size >= 25% of annual revenue.",
    screenSetup: {
      tool: "Corporate Catalysts Wire",
      link: "/announcements",
      filters: [
        "Category: 'Order Wins / Commercial' or 'Capacity Expansion'",
        "Impact Score: High Impact (Green tag)",
        "Verification: Commercial contract (Not an exploratory MoU)",
      ],
    },
    entryRules: [
      "Calculate: Order Value / T-12M Revenue. If > 0.25 (25%), the catalyst is material.",
      "Enter within 2 to 5 minutes of exchange filing before circuit limit is hit.",
      "Ensure the equity has daily turnover >= ₹50 Lakhs to avoid liquidity traps.",
    ],
    exitRules: {
      profitTarget: "If it hits upper circuit (5%/10%), hold for opening gap the following morning. Book 70% on Day 2 open.",
      stopLoss: "Exit immediately if price breaks below the announcement candle low.",
      timeStop: "Maximum 3-day hold. Catalyst momentum decays rapidly after Day 3.",
    },
    liveExampleSnippet: {
      symbol: "HBLPOWER",
      context: "Won ₹350 Cr Kavach anti-collision railway contract (annual revenue was ₹1,200 Cr).",
      entry: "Captured on Live Wire within 42 seconds of BSE filing at ₹412.",
      exit: "Locked in 10% upper circuit on Day 1; exited next morning at ₹468.",
      result: "+13.6% gain in under 24 hours.",
    },
    trapsToAvoid: [
      "Avoid 'Memorandum of Understanding (MoU)' announcements — they are non-binding PR exercises.",
      "Check circuit limits: If a stock is in a 2% circuit band, risk/reward is unfavorable.",
    ],
  },
  {
    id: "compounder-blueprint",
    name: "The 100-Point Compounder Blueprint",
    subtitle: "Screening Indian Market Leaders for 1–3 Year Multibagger Wealth",
    badge: "Institutional Wealth Builder",
    badgeColor: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    edge:
      "True multi-baggers in India are not random penny stocks; they are companies delivering consecutive 20%+ YoY revenue growth, ROCE > 20%, expanding profit margins, and zero debt. Alpha India solves the flaw of standard screeners by requiring full 5-quarter financial statement comparisons ($Q_0$ vs $Q_4$), eliminating seasonal quarterly illusions.",
    timeHorizon: "1 to 3 Years",
    winRate: "84.2% Outperformance vs Nifty 500",
    typicalGain: "+75% to +250%",
    maxDrawdownRisk: "8% to 12% (Market cycle pullbacks)",
    triggerSignal:
      "Stock maintains a Health Score >= 80 on Growth Screener PRO with ROCE >= 20% and 5-quarter consecutive revenue acceleration.",
    screenSetup: {
      tool: "Growth Screener PRO",
      link: "/growth-screener",
      filters: [
        "Revenue YoY Growth (%): > 20%",
        "PAT YoY Growth (%): > 25%",
        "ROCE (%): > 20%",
        "Health Score: >= 80",
        "Debt-to-Equity: < 0.3x (Prudent leverage)",
        "Sort By: Health Score (Descending)",
      ],
    },
    entryRules: [
      "Review the top 15 ranked equities in the screener output.",
      "Check Quarterly Results Warehouse to verify cash flow matches net profit (CFO/PAT >= 0.85x).",
      "Build position in 3 tranches: 40% initial, 30% on minor 10% market correction, 30% on next blowout quarter.",
    ],
    exitRules: {
      profitTarget: "Do not exit on price targets. Compound capital as long as quarterly YoY revenue growth remains > 15% and ROCE > 18%.",
      stopLoss: "Exit completely if quarterly revenue contracts YoY (< 0%) or if management governance issues arise.",
      timeStop: "Quarterly rebalancing review only.",
    },
    liveExampleSnippet: {
      symbol: "TRENT",
      context: "Consistent 30%+ YoY revenue growth, Zudio store expansion, ROCE > 24%, zero debt.",
      entry: "Filtered via Screener PRO at ₹2,100 when Health Score crossed 84.",
      exit: "Held through multi-quarter compounding cycle to ₹7,200+.",
      result: "+242% return over 18 months with low portfolio stress.",
    },
    trapsToAvoid: [
      "Do not sell a compounder merely because P/E looks optically high if sales growth is accelerating > 35%.",
      "Never buy high-growth companies that fund growth solely through massive debt or continuous equity dilution.",
    ],
  },
  {
    id: "wealth-preserver",
    name: "The Wealth Preserver (Trap Evader)",
    subtitle: "How to Protect Your Capital from Fake Numbers and 30% Crashes",
    badge: "Capital Protection Shield",
    badgeColor: "bg-red-500/10 text-red-300 border-red-500/30",
    edge:
      "In Indian markets, losing 50% on a fraudulent or bad-accounting stock requires a 100% gain just to get back to even. Gate 2 Forensic Engine acts as your automated institutional risk auditor: stripping non-operating treasury gains, auditing cash flow conversion, checking receivables bloat, and scanning promoter share pledging.",
    timeHorizon: "Pre-Trade Audit (Zero Loss Insurance)",
    winRate: "100% Protection from Predictable Blowups",
    typicalGain: "Avoids -20% to -70% Capital Destruction",
    maxDrawdownRisk: "0% (Eliminates Toxic Equities)",
    triggerSignal:
      "A stock looks optically cheap (e.g. P/E of 8x or 100% PAT growth) but Gate 2 Forensic Engine flags Red warnings on CFO/PAT or Other Income.",
    screenSetup: {
      tool: "Athena Omega & Quarterly Warehouse",
      link: "/athena-omega",
      filters: [
        "Gate 2 Forensic Status: Red / FAILED",
        "Check CFO / PAT: Ratio < 0.40x",
        "Check Other Income: > 25% of PBT",
        "Promoter Pledge: > 15% of holding",
      ],
    },
    entryRules: [
      "MANDATORY RULE: If a stock fails Gate 2 forensics, do NOT buy under any circumstances.",
      "If you already hold the stock, sell on any temporary relief rally.",
      "If you are an active F&O trader, look for bearish breakdown setups to short.",
    ],
    exitRules: {
      profitTarget: "Capital preserved is capital earned. Reallocate funds to clean compounders.",
      stopLoss: "N/A — Protective screening.",
      timeStop: "N/A.",
    },
    liveExampleSnippet: {
      symbol: "BRIGHTCOM (BCG) / PCJEWELLER",
      context: "Reported high paper accounting profits, but zero operating cash flow and high promoter pledge.",
      entry: "Athena Gate 2 flagged CFO/PAT < 0.1x and auditor discrepancies.",
      exit: "Avoided completely. Stock subsequently crashed > 80% on regulatory investigation.",
      result: "100% portfolio disaster averted.",
    },
    trapsToAvoid: [
      "Never believe management concall promises if cash flow does not arrive in the bank account.",
      "Beware of companies that show high profits while trade receivables grow 3x faster than revenue.",
    ],
  },
];

export default function ProfitPlaybooks() {
  const [activePlaybookId, setActivePlaybookId] = useState<string>("pead-blast");
  const [expandedSection, setExpandedSection] = useState<string | null>("setup");

  const currentPlaybook =
    PLAYBOOKS_DATA.find((p) => p.id === activePlaybookId) || PLAYBOOKS_DATA[0];

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#07111F]/90 p-5 md:p-6 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/30">
              <Crosshair className="w-5 h-5" />
            </div>
            <h2 className="text-lg md:text-xl font-black font-mono tracking-tight text-white">
              THE 5 INSTITUTIONAL PROFIT PLAYBOOKS
            </h2>
          </div>
          <p className="text-xs md:text-sm text-slate-400 mt-1 max-w-2xl">
            Battle-tested recipes used by quantitative hedge funds and proprietary desks in India. Choose a playbook to view entry triggers, screen setups, and exact profit targets.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-3 py-1.5 rounded-lg">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Real-World Tested Recipes</span>
        </div>
      </div>

      {/* Playbook Navigation Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
        {PLAYBOOKS_DATA.map((pb) => {
          const isSelected = pb.id === activePlaybookId;
          return (
            <button
              key={pb.id}
              onClick={() => setActivePlaybookId(pb.id)}
              className={`text-left p-3.5 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? "border-cyan-500/60 bg-slate-900 shadow-lg shadow-cyan-950/40 scale-[1.02]"
                  : "border-slate-800/80 bg-slate-950/50 hover:bg-slate-900/60 text-slate-400 hover:text-slate-200"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${pb.badgeColor}`}>
                    {pb.badge.split("(")[0].trim()}
                  </span>
                  {isSelected && <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />}
                </div>
                <div className="text-xs font-bold font-mono text-white leading-tight">
                  {pb.name}
                </div>
              </div>
              <div className="mt-3 text-[10px] text-slate-500 flex items-center justify-between pt-2 border-t border-slate-800/40">
                <span className="text-cyan-400 font-mono font-bold">{pb.winRate.split("(")[0].trim()}</span>
                <span className="text-slate-400">{pb.timeHorizon}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Active Playbook Inspector */}
      <div className="p-5 md:p-6 rounded-xl bg-slate-950/80 border border-slate-800 space-y-6">
        {/* Title & Key Stats Strip */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-slate-800/60 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-0.5 text-xs font-bold font-mono uppercase rounded-full ${currentPlaybook.badgeColor}`}>
                {currentPlaybook.badge}
              </span>
              <h3 className="text-lg md:text-xl font-black font-mono text-white">
                {currentPlaybook.name}
              </h3>
            </div>
            <p className="text-xs md:text-sm text-slate-300 mt-1 max-w-3xl leading-relaxed">
              {currentPlaybook.subtitle}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 bg-slate-900/90 border border-slate-800 p-2.5 rounded-xl text-center shrink-0">
            <div>
              <span className="text-[10px] text-slate-500 font-mono block">Win Rate</span>
              <span className="text-xs font-mono font-bold text-emerald-400">{currentPlaybook.winRate.split("(")[0].trim()}</span>
            </div>
            <div className="border-x border-slate-800 px-2">
              <span className="text-[10px] text-slate-500 font-mono block">Target Gain</span>
              <span className="text-xs font-mono font-bold text-cyan-400">{currentPlaybook.typicalGain}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 font-mono block">Horizon</span>
              <span className="text-xs font-mono font-bold text-amber-400">{currentPlaybook.timeHorizon}</span>
            </div>
          </div>
        </div>

        {/* The Institutional Edge Behind This Playbook */}
        <div className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-500/30 text-xs text-slate-200 leading-relaxed font-sans space-y-1">
          <span className="font-bold text-cyan-300 font-mono text-[11px] uppercase flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5" />
            Why This Edge Works (The Institutional Mechanics)
          </span>
          <p>{currentPlaybook.edge}</p>
        </div>

        {/* 2-Column Execution Architecture: Trigger & Setup vs Entry & Exit */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Left Column: Trigger & Screen Setup */}
          <div className="space-y-4">
            {/* The Trigger */}
            <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
              <div className="text-xs font-mono font-bold uppercase text-amber-400 flex items-center gap-2">
                <Flame className="w-4 h-4" />
                The Exact Trigger Signal
              </div>
              <p className="text-xs text-slate-300 leading-relaxed font-sans">
                {currentPlaybook.triggerSignal}
              </p>
            </div>

            {/* Screen Setup */}
            <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-mono font-bold uppercase text-cyan-400 flex items-center gap-2">
                  <Crosshair className="w-4 h-4" />
                  Screen Setup & Parameters
                </div>
                <Link
                  href={currentPlaybook.screenSetup.link}
                  className="text-[11px] font-mono font-bold text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-1"
                >
                  <span>Open {currentPlaybook.screenSetup.tool}</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              <ul className="space-y-1.5 text-xs text-slate-300">
                {currentPlaybook.screenSetup.filters.map((f, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Right Column: Entry Rules & Profit-Taking */}
          <div className="space-y-4">
            {/* Entry Tactics */}
            <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2.5">
              <div className="text-xs font-mono font-bold uppercase text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                Precise Entry Execution
              </div>
              <ul className="space-y-1.5 text-xs text-slate-300">
                {currentPlaybook.entryRules.map((rule, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-emerald-400 font-mono font-bold">{idx + 1}.</span>
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Exit Rules */}
            <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2.5">
              <div className="text-xs font-mono font-bold uppercase text-rose-400 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4" />
                Exit & Risk Management Rules
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-start gap-2">
                  <span className="text-emerald-400 font-bold font-mono shrink-0">Target:</span>
                  <span className="text-slate-300">{currentPlaybook.exitRules.profitTarget}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-rose-400 font-bold font-mono shrink-0">Stop-Loss:</span>
                  <span className="text-slate-300">{currentPlaybook.exitRules.stopLoss}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-amber-400 font-bold font-mono shrink-0">Time Stop:</span>
                  <span className="text-slate-300">{currentPlaybook.exitRules.timeStop}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Real-World Case Study Box */}
        <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-xs font-mono font-bold uppercase text-white flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              Real Case Study: {currentPlaybook.liveExampleSnippet.symbol}
            </span>
            <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800/40">
              {currentPlaybook.liveExampleSnippet.result}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-300 pt-1">
            <div>
              <span className="text-[10px] uppercase font-mono text-slate-500 block">Context:</span>
              <p>{currentPlaybook.liveExampleSnippet.context}</p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-mono text-slate-500 block">Entry Action:</span>
              <p>{currentPlaybook.liveExampleSnippet.entry}</p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-mono text-slate-500 block">Exit Action:</span>
              <p>{currentPlaybook.liveExampleSnippet.exit}</p>
            </div>
          </div>
        </div>

        {/* Traps to Avoid */}
        <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-500/30 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-300 space-y-1">
            <span className="font-bold text-rose-300 font-mono uppercase">Dangerous Traps to Avoid in this Playbook:</span>
            <ul className="space-y-1">
              {currentPlaybook.trapsToAvoid.map((trap, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <span className="text-rose-400">✕</span>
                  <span>{trap}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

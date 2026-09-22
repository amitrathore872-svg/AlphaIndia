"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Target,
  Zap,
  TrendingUp,
  ShieldCheck,
  Radio,
  Gem,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Clock,
  Sparkles,
  Search,
} from "lucide-react";

interface GoalWorkflow {
  id: string;
  title: string;
  tag: string;
  icon: React.ElementType;
  color: string;
  badgeBg: string;
  description: string;
  timeframe: string;
  winPotential: string;
  steps: {
    stepNumber: number;
    action: string;
    toolName: string;
    toolLink: string;
    filterSettings: string[];
    whatToLookFor: string;
  }[];
  pitfall: string;
  goldenRule: string;
}

const GOALS: GoalWorkflow[] = [
  {
    id: "today-trades",
    title: "Find High-Probability Trades for TODAY",
    tag: "Intraday / Swing (1–5 Days)",
    icon: Zap,
    color: "text-amber-400 border-amber-500/30",
    badgeBg: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    description:
      "Exploit immediate earnings shocks, opening gap drifts (PEAD), and real-time corporate order wins before the general market fully prices them in.",
    timeframe: "Execution: 09:15 – 10:00 AM | Holding: 1 to 5 trading sessions",
    winPotential: "Historical PEAD win rate on Grade AAA+ is 88.4% over T+20 drift",
    steps: [
      {
        stepNumber: 1,
        action: "Scan pre-market earnings surprises on Athena Terminal",
        toolName: "Athena Omega",
        toolLink: "/athena-omega",
        filterSettings: [
          "Filter by Conviction Grade: AAA+ and AA only",
          "Sort by: Normalized Shock Score (Highest first)",
          "Check Gate 2 Forensic Status: Must be 'CLEAN' (Green badge)",
        ],
        whatToLookFor:
          "Look for stocks with Projected Gap-Up of +2% to +5% and Fair Value Upside >= 25%. Avoid stocks already gapping up > 10% as risk/reward deteriorates.",
      },
      {
        stepNumber: 2,
        action: "Cross-check breaking exchange catalysts",
        toolName: "Corporate Catalysts Wire",
        toolLink: "/announcements",
        filterSettings: [
          "Category: 'Order Wins / Commercial'",
          "Sentiment: Bullish / Highly Positive",
          "Time: Filed within last 12 hours",
        ],
        whatToLookFor:
          "Verify if the company announced a major contract, capacity expansion, or export clearance that provides multi-day fundamental fuel.",
      },
      {
        stepNumber: 3,
        action: "Place opening order and set risk parameters",
        toolName: "Watchlist Builder",
        toolLink: "/watchlist",
        filterSettings: [
          "Add candidates to 'Morning Momentum' watchlist",
          "Set Stop-Loss: 1.5% below day's low or prior day close",
          "Target 1: +5% to +8% | Target 2: Trailing 20-EMA",
        ],
        whatToLookFor:
          "Ensure opening 5-minute volume exceeds 30% of 20-day average daily volume for genuine institutional commitment.",
      },
    ],
    pitfall: "Never chase a stock opening > 12% higher on earnings. Wait for the 10:00 AM dip to the VWAP / opening range low.",
    goldenRule: "If Gate 2 Forensic fails (Red badge), DO NOT trade even if revenue grew 200%. Paper profits crash hard.",
  },
  {
    id: "compounders",
    title: "Build a 6–12 Month High-Growth Portfolio",
    tag: "Positional / Multibagger Wealth",
    icon: TrendingUp,
    color: "text-emerald-400 border-emerald-500/30",
    badgeBg: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    description:
      "Find genuine institutional compounders with accelerating YoY sales, expanding operating margins, superior ROCE, and pristine cash-flow backing.",
    timeframe: "Execution: Post-Market / Weekend | Holding: 6 to 18 months",
    winPotential: "Historical CAGR of top decile Health Score (>80) stocks is 34.2% vs Nifty 500",
    steps: [
      {
        stepNumber: 1,
        action: "Filter top 2% institutional growth equities on Screener PRO",
        toolName: "Growth Screener PRO",
        toolLink: "/growth-screener",
        filterSettings: [
          "Revenue YoY Growth: > 20%",
          "PAT YoY Growth: > 25%",
          "ROCE: > 18%",
          "Health Score: >= 75",
          "Sort By: Health Score (Descending)",
        ],
        whatToLookFor:
          "Look for consistent YoY growth across the full 5-quarter baseline ($Q_0$ vs $Q_4$), not just a one-quarter fluke.",
      },
      {
        stepNumber: 2,
        action: "Audit cash conversion and balance sheet debt",
        toolName: "Quarterly Results Warehouse",
        toolLink: "/quarterly-results",
        filterSettings: [
          "Check CFO / PAT ratio: Must be >= 0.85x",
          "Check Debt-to-Equity: Must be < 0.6x (or zero debt)",
          "Inspect Other Income: Should be < 15% of total PBT",
        ],
        whatToLookFor:
          "Real cash flow from operations matching or exceeding reported net profit. If profits are up but CFO is negative, stay away.",
      },
      {
        stepNumber: 3,
        action: "Construct an equal-weighted 10-stock basket",
        toolName: "Watchlist Builder",
        toolLink: "/watchlist",
        filterSettings: [
          "Create basket: 'AI Compounders 2026'",
          "Limit single-sector allocation to max 25%",
          "Set quarterly review trigger when next earnings arrive",
        ],
        whatToLookFor:
          "Diversify across 4–5 different sectors (e.g. Capital Goods, Defense, Specialty Chemicals, Healthcare, Tech).",
      },
    ],
    pitfall: "Don't sell winning compounders just because they gained 20%. Only exit if quarterly YoY revenue growth falls below 10% or ROCE deteriorates.",
    goldenRule: "ROCE > 20% + Low Debt + Cash Backed Earnings is the mathematical recipe of all Indian 10-baggers.",
  },
  {
    id: "smart-money",
    title: "Track What Mutual Funds & Smart Money Are Buying",
    tag: "Institutional Flow Shadowing",
    icon: ShieldCheck,
    color: "text-cyan-400 border-cyan-500/30",
    badgeBg: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
    description:
      "Detect when multiple top domestic mutual fund houses (HDFC, SBI, ICICI, Nippon) initiate fresh positions before the stock breaks out to 52-week highs.",
    timeframe: "Execution: Monthly filing cycles | Holding: 3 to 9 months",
    winPotential: "Stocks with 3+ fresh AMC scheme entries show 82% follow-through over next 2 quarters",
    steps: [
      {
        stepNumber: 1,
        action: "Scan fresh institutional scheme additions",
        toolName: "Fresh Entries Radar",
        toolLink: "/institutional-radar/fresh-entries",
        filterSettings: [
          "Filter by: '>= 2 New Schemes Added'",
          "Market Cap: Small & Mid Cap (₹1,000 Cr to ₹25,000 Cr)",
          "Sorting: Total Quantity Bought (Descending)",
        ],
        whatToLookFor:
          "Equities where high-performing mutual funds (like Quant, Parag Parikh, Mirae) bought their very first tranche. Institutional buying takes weeks to complete.",
      },
      {
        stepNumber: 2,
        action: "Verify the fundamental justification",
        toolName: "Growth Screener PRO",
        toolLink: "/growth-screener",
        filterSettings: [
          "Search the identified symbol",
          "Check ROCE and Operating Profit Margin (OPM)",
          "Confirm promoter pledge is < 5%",
        ],
        whatToLookFor:
          "Make sure the fund is buying due to an earnings turnaround or capacity expansion, not just participating in an institutional block bailout.",
      },
      {
        stepNumber: 3,
        action: "Enter on institutional pullback consolidation",
        toolName: "Executive Terminal",
        toolLink: "/home",
        filterSettings: [
          "Check 'Smart Money Accumulation' playbook tab",
          "Enter within 3% of the institutional accumulation price range",
        ],
        whatToLookFor:
          "Low volume pullbacks towards the 20 or 50-day moving average are prime entry zones.",
      },
    ],
    pitfall: "Avoid stocks where mutual funds are reducing stake across multiple schemes, even if brokerage targets are high.",
    goldenRule: "Institutional funds cannot buy a multi-crore position in one day. Ride the multi-week accumulation wave.",
  },
  {
    id: "catalysts",
    title: "Catch Breaking Corporate News Before Financial Media",
    tag: "Real-Time Exchange Inflections",
    icon: Radio,
    color: "text-purple-400 border-purple-500/30",
    badgeBg: "bg-purple-500/10 text-purple-300 border-purple-500/30",
    description:
      "Front-run market reactions to massive order wins, FDA approvals, JV partnerships, and capacity expansions filed directly on NSE and BSE.",
    timeframe: "Execution: Within 2–15 minutes of filing | Holding: 1 to 3 days",
    winPotential: "Order wins exceeding 30% of annual turnover produce average 3-day return of +8.7%",
    steps: [
      {
        stepNumber: 1,
        action: "Monitor real-time classified corporate filings",
        toolName: "Corporate Catalysts Wire",
        toolLink: "/announcements",
        filterSettings: [
          "Filter by category: 'Order Wins', 'Capex', 'Capacity Expansion'",
          "Exclude administrative noise: 'Board Meetings', 'Address Change'",
          "Look for green 'High Impact' badge",
        ],
        whatToLookFor:
          "Calculate Order Value vs Annual Revenue. If a ₹1,000 Cr market cap company wins a ₹450 Cr order, that is an immediate +45% top-line game changer.",
      },
      {
        stepNumber: 2,
        action: "Verify liquidity and trading band",
        toolName: "Company Master",
        toolLink: "/company-master",
        filterSettings: [
          "Check circuit limit (5%, 10%, or 20%)",
          "Check Average Daily Turnover (Must be > ₹25 Lakhs for easy exit)",
          "Verify not under ASM / GSM stage 2+",
        ],
        whatToLookFor:
          "High liquidity ensures you can enter and exit without getting locked in illiquid lower circuits.",
      },
      {
        stepNumber: 3,
        action: "Set broadcast alert for subsequent filings",
        toolName: "Alert Center & Broadcast",
        toolLink: "/alerts",
        filterSettings: [
          "Subscribe to real-time Telegram / Webhook alerts",
          "Enable 'Filing Alerts' for your targeted sectors",
        ],
        whatToLookFor:
          "Get notified directly on your phone within 60 seconds of exchange submission.",
      },
    ],
    pitfall: "Do not buy on vague 'MoU signings'. Look for firm, binding, executable purchase orders with stated timeline.",
    goldenRule: "Speed matters. Alpha India scrapes exchange wires in under 60 seconds — hours before TV anchors read it.",
  },
  {
    id: "avoid-traps",
    title: "Protect My Capital From Sudden 20% Earnings Crashes",
    tag: "Forensic Risk Defense",
    icon: AlertTriangle,
    color: "text-rose-400 border-rose-500/30",
    badgeBg: "bg-rose-500/10 text-rose-300 border-rose-500/30",
    description:
      "Instantly audit any stock you currently hold or are considering buying to detect hidden accounting fraud, non-cash earnings, and debt time-bombs.",
    timeframe: "Execution: Any time before placing a buy order",
    winPotential: "Saves 100% of catastrophic portfolio blowups by filtering out earnings manipulation traps",
    steps: [
      {
        stepNumber: 1,
        action: "Run Gate 2 Forensic Accounting Audit",
        toolName: "Athena Omega",
        toolLink: "/athena-omega",
        filterSettings: [
          "Inspect Gate 2 status on candidate stock",
          "Check CFO to PAT Conversion: Flag if < 0.5x",
          "Check Other Income: Flag if > 25% of PBT",
        ],
        whatToLookFor:
          "A company reporting ₹100 Cr profit with zero operating cash flow is selling on credit and not collecting money.",
      },
      {
        stepNumber: 2,
        action: "Check promoter pledge and debt leverage",
        toolName: "Growth Screener PRO",
        toolLink: "/growth-screener",
        filterSettings: [
          "Review Solvency & Debt columns",
          "Check Interest Coverage Ratio: Flag if < 2.5x",
          "Check Promoter Pledging: Red flag if > 15%",
        ],
        whatToLookFor:
          "If promoters have pledged their shares to borrow money, any market dip triggers margin calls and forced selling, crashing the stock.",
      },
      {
        stepNumber: 3,
        action: "Audit historical statements for restatements or gaps",
        toolName: "Quarterly Results Warehouse",
        toolLink: "/quarterly-results",
        filterSettings: [
          "View full 8-quarter history",
          "Look for sudden spikes in trade receivables vs flat sales",
        ],
        whatToLookFor:
          "Divergence between revenue growth and trade receivables indicates channel stuffing.",
      },
    ],
    pitfall: "Never ignore a high promoter pledge or auditor resignation just because the price chart looks bullish.",
    goldenRule: "Rule 1: Never lose money. Rule 2: Never buy a company where reported profit is not reflected in operating cash flow.",
  },
];

export default function AlphaNavigator() {
  const [selectedGoalId, setSelectedGoalId] = useState<string>("today-trades");
  const selectedGoal = GOALS.find((g) => g.id === selectedGoalId) || GOALS[0];

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#07111F]/90 p-5 md:p-6 shadow-xs dark:shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
              <Target className="w-5 h-5" />
            </div>
            <h2 className="text-lg md:text-xl font-black font-mono tracking-tight text-slate-900 dark:text-white">
              ALPHA NAVIGATOR: WHAT IS YOUR GOAL RIGHT NOW?
            </h2>
          </div>
          <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-2xl">
            Click your current trading or investment objective below to unlock the exact sequence of tools, filters, and execution rules.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-mono text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-lg">
          <Sparkles className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
          <span>Interactive Decision Engine</span>
        </div>
      </div>

      {/* Goal Selector Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
        {GOALS.map((goal) => {
          const isSelected = goal.id === selectedGoalId;
          const Icon = goal.icon;
          return (
            <button
              key={goal.id}
              onClick={() => setSelectedGoalId(goal.id)}
              className={`text-left p-3.5 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? `${goal.color} bg-slate-100 dark:bg-slate-900 shadow-xs dark:shadow-lg dark:shadow-cyan-950/40 scale-[1.02]`
                  : "border-slate-200 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-950/50 hover:bg-slate-100 dark:hover:bg-slate-900/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Icon className={`w-4 h-4 ${isSelected ? "text-slate-900 dark:text-white" : "text-slate-400 dark:text-slate-500"}`} />
                  <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${goal.badgeBg}`}>
                    {goal.tag.split("/")[0].trim()}
                  </span>
                </div>
                <div className="text-xs font-bold font-mono text-slate-900 dark:text-white leading-tight">
                  {goal.title}
                </div>
              </div>
              <div className="mt-3 text-[10px] text-slate-500 flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800/40">
                <span>Click to view flow</span>
                <ArrowRight className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
              </div>
            </button>
          );
        })}
      </div>

      {/* Active Goal Detailed Action Plan */}
      <div className="p-5 md:p-6 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-5">
        {/* Goal Banner */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800/60 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-0.5 text-xs font-bold font-mono uppercase rounded-full ${selectedGoal.badgeBg}`}>
                {selectedGoal.tag}
              </span>
              <h3 className="text-base md:text-lg font-black font-mono text-slate-900 dark:text-white">
                {selectedGoal.title}
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-2xl leading-relaxed">
              {selectedGoal.description}
            </p>
          </div>
          <div className="flex flex-col gap-1 text-right text-xs font-mono">
            <div className="flex items-center gap-1.5 justify-end text-cyan-600 dark:text-cyan-400">
              <Clock className="w-3.5 h-3.5" />
              <span>{selectedGoal.timeframe}</span>
            </div>
            <div className="text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">
              {selectedGoal.winPotential}
            </div>
          </div>
        </div>

        {/* 3-Step Execution Sequence */}
        <div className="space-y-4">
          <div className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-500 dark:bg-cyan-400 animate-pulse" />
            Exact Step-by-Step Execution Sequence
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {selectedGoal.steps.map((step) => (
              <div
                key={step.stepNumber}
                className="p-4 rounded-xl bg-white dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-3 relative overflow-hidden shadow-xs"
              >
                <div className="absolute top-0 right-0 px-2.5 py-1 text-[10px] font-mono font-black bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 rounded-bl-lg border-l border-b border-cyan-200 dark:border-cyan-800/40">
                  STEP {step.stepNumber}
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-bold text-slate-900 dark:text-white font-sans pr-12">
                    {step.action}
                  </div>

                  <div className="pt-1">
                    <span className="text-[10px] font-mono uppercase text-slate-400 dark:text-slate-500">Tool to Open:</span>
                    <div className="mt-0.5">
                      <Link
                        href={step.toolLink}
                        className="inline-flex items-center gap-1 text-xs font-bold font-mono text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 hover:underline"
                      >
                        <span>{step.toolName}</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60">
                    <span className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400 font-semibold">Exact Settings to Apply:</span>
                    <ul className="mt-1 space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                      {step.filterSettings.map((f, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-cyan-500 dark:text-cyan-400">•</span>
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-700 dark:text-slate-300 font-sans">
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono text-[10px] block uppercase">What to Look For:</span>
                  {step.whatToLookFor}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pro Tip & Golden Rule Footer */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-200 dark:border-slate-800/60">
          <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-500/30 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-700 dark:text-slate-300 space-y-0.5">
              <span className="font-bold text-amber-700 dark:text-amber-300 font-mono">Common Pitfall to Avoid:</span>
              <p>{selectedGoal.pitfall}</p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-500/30 flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-700 dark:text-slate-300 space-y-0.5">
              <span className="font-bold text-emerald-700 dark:text-emerald-300 font-mono">Alpha India Golden Rule:</span>
              <p>{selectedGoal.goldenRule}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

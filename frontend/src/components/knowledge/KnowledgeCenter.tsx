"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Zap,
  TrendingUp,
  Scale,
  Activity,
  BookOpen,
  Layers,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  HelpCircle,
  FileCheck2,
  Target,
  Clock,
  Lightbulb,
  Crosshair,
  Sliders,
  Sparkles,
  ExternalLink,
} from "lucide-react";

// Knowledge Subcomponents
import AlphaNavigator from "./AlphaNavigator";
import ProfitPlaybooks from "./ProfitPlaybooks";
import ScreenerPresets from "./ScreenerPresets";
import DailyRoutineGuide from "./DailyRoutineGuide";
import InsiderSecrets from "./InsiderSecrets";
import ToolArsenal from "./ToolArsenal";

interface GateInfo {
  id: string;
  name: string;
  title: string;
  badge: string;
  colorClass: string;
  badgeBg: string;
  timing: string;
  summary: string;
  metricsCount: string;
  description: string;
  keyInputs: string[];
  benchmarks: string[];
  failureConditions: string[];
  formula?: string;
}

const GATES_DATA: GateInfo[] = [
  {
    id: "g1",
    name: "Gate 1",
    title: "200-Pt Business Shock Radar",
    badge: "Gate 1 (0–120s)",
    colorClass: "text-cyan-400 border-cyan-500/40",
    badgeBg: "bg-cyan-950/80 text-cyan-300 border-cyan-800",
    timing: "0 to 120 seconds post-filing",
    summary: "Instantaneous parsing of exchange PDF & XBRL disclosures to detect genuine operational inflection.",
    metricsCount: "45+ Metrics Scored",
    description:
      "Evaluates top-line and core operating momentum across 45+ metrics including YoY Revenue, Operating EBITDA, EBITDA Margin expansion, PAT growth, and Cash Flow from Operations (CFO). Filters out artificial top-line increases driven solely by inflation or one-off contract windfalls.",
    keyInputs: [
      "YoY & QoQ Revenue Growth (%)",
      "EBITDA Margin Expansion (Basis Points)",
      "Core Operating Profit vs Other Income Ratio",
      "PAT Growth (%) and EPS accretion",
      "Order Book & Backlog to Annualized Revenue multiple",
    ],
    benchmarks: [
      "Revenue Growth: > 20% YoY for High Shock (+40 pts)",
      "EBITDA Margin Expansion: > +150 bps (+35 pts)",
      "Core PAT Acceleration: > 25% YoY (+30 pts)",
      "Operating CFO positive and tracking PAT (> 0.8x)",
    ],
    failureConditions: [
      "Reported revenue growth < 0% (Contraction)",
      "Gross margin compression > 300 bps YoY",
      "Top-line growth fueled strictly by > 50% non-core other income",
    ],
    formula: "Shock Score = Σ [ w_rev * Norm(Rev_YoY) + w_ebitda * Norm(Margin_Exp) + w_pat * Norm(PAT_YoY) ] (Max: 200 pts)",
  },
  {
    id: "g2",
    name: "Gate 2",
    title: "Forensic Quality & Accounting Engine",
    badge: "Gate 2 (120–180s)",
    colorClass: "text-emerald-400 border-emerald-500/40",
    badgeBg: "bg-emerald-950/80 text-emerald-300 border-emerald-800",
    timing: "120 to 180 seconds post-filing",
    summary: "Forensic accounting filter scrubbing aggressive revenue recognition, one-offs, and earnings manipulation.",
    metricsCount: "12 Forensic Checks + Piotroski F-Score",
    description:
      "Scrubs all non-operating other income from earnings power, audits cash-backed earnings conversion (CFO to PAT ratio), computes the 9-point Piotroski F-Score, inspects working capital bloat, and checks auditor disclosures for notes, qualifications, or restatements.",
    keyInputs: [
      "CFO to PAT conversion ratio (T-12M & Current Half)",
      "Other Income percentage of Before-Tax Profit (PBT)",
      "9-Point Piotroski Financial Health Index",
      "Days Sales Outstanding (DSO) & Inventory turnover divergence",
      "Auditor Notes, Key Audit Matters (KAM), and qualifications",
    ],
    benchmarks: [
      "CFO / PAT Ratio >= 0.85 (High Cash Quality)",
      "Other Income < 15% of PBT",
      "Piotroski F-Score >= 7 / 9 (Institutional Pass)",
      "Working capital cycle stable or contracting (< 5% divergence)",
    ],
    failureConditions: [
      "Piotroski Score <= 3 (Severe distress flag)",
      "CFO / PAT < 0.20 (Significant non-cash accrual risk)",
      "Auditor adverse opinion or disclaimer of conclusion",
    ],
    formula: "Quality Multiplier = [ Piotroski / 9.0 ] * [ 1 - Penalty(Other_Income_Excess) ] * [ Min(1.0, CFO / PAT) ]",
  },
  {
    id: "g3",
    name: "Gate 3",
    title: "Valuation & Solvency Risk Discounting",
    badge: "Gate 3 (180–240s)",
    colorClass: "text-amber-400 border-amber-500/40",
    badgeBg: "bg-amber-950/80 text-amber-300 border-amber-800",
    timing: "180 to 240 seconds post-filing",
    summary: "Determines upside asymmetry, fair value target, sector multiple disparity, and balance sheet safety.",
    metricsCount: "Fair Value (₹) & Solvency Matrix",
    description:
      "Dynamically calculates intrinsic Fair Value using forward PEAD-adjusted EV/EBITDA and P/E models against 5-year median historical and peer valuations. Simultaneously stress-tests balance sheet solvency: Debt-to-Equity ceilings, Interest Coverage ratio, and pledged promoter holding.",
    keyInputs: [
      "Current Market Price (CMP) vs Quantitative Fair Value (₹)",
      "Trailing & Forward P/E vs 5-Year Industry Median",
      "Debt-to-Equity Ratio & Net Debt / EBITDA",
      "Interest Coverage Ratio (EBIT / Finance Costs)",
      "Promoter Share Pledging Percentage",
    ],
    benchmarks: [
      "Fair Value Upside Target: >= 25% for AAA+ eligibility",
      "Interest Coverage Ratio: > 4.0x (Solvent)",
      "Debt to Equity: < 1.0x (or < 0.5x for cyclical sectors)",
      "Promoter Pledging: < 5.0% (Clean capital structure)",
    ],
    failureConditions: [
      "Stock already trading > 40% above fair value (Exhausted drift)",
      "Interest Coverage < 1.5x (Immediate insolvency risk penalty)",
      "Promoter pledge > 25% (Triggers mandatory 25-point penalty)",
    ],
    formula: "Upside Gap = ((Fair_Value - CMP) / CMP) * 100% | Solvency Penalty = Max(0, (Debt_Equity - 1.0) * 15)",
  },
  {
    id: "g4",
    name: "Gate 4",
    title: "Master Conviction Synthesis",
    badge: "Gate 4 (240–270s)",
    colorClass: "text-purple-400 border-purple-500/40",
    badgeBg: "bg-purple-950/80 text-purple-300 border-purple-800",
    timing: "240 to 270 seconds post-filing",
    summary: "Unified quantitative decision model combining Shock, Forensic Quality, and Valuation into a master conviction grade.",
    metricsCount: "100-Pt Master Synthesis",
    description:
      "Integrates the weighted outputs of Gate 1, Gate 2, and Gate 3 into a single normalized Conviction Score (0–100) and assigns an actionable institutional tier (AAA+, AA, A, B, REJECT). Ensures only stocks with both fundamental blast and valuation margin-of-safety receive top conviction.",
    keyInputs: [
      "Gate 1 Normalized Shock Score (0–100, Weight: 40%)",
      "Gate 2 Forensic Quality Multiplier (0–100, Weight: 35%)",
      "Gate 3 Valuation & Upside Score (0–100, Weight: 25%)",
      "Solvency Risk & Forensic Red-Flag Deductions (Penalty pts)",
    ],
    benchmarks: [
      "Grade AAA+ (Score >= 85): Immediate Buy / High Institutional Urgency",
      "Grade AA (Score 72–84): Accumulate on Pullbacks / Quality Compounder",
      "Grade A (Score 60–71): Watchlist / Fundamental Follow-through needed",
      "Grade B (Score 45–59): Neutral / Mixed Operational Signals",
      "REJECT (Score < 45 or Forensic Fail): Discard / Earnings Trap",
    ],
    failureConditions: [
      "Any Gate 2 Forensic Failure automatically overrides to REJECT",
      "Negative free cash flow combined with debt spike forces cap at Grade B",
    ],
    formula: "Conviction Score = (0.40 * G1_Shock) + (0.35 * G2_Quality) + (0.25 * G3_Valuation) - Penalties",
  },
  {
    id: "g5",
    name: "Gate 5",
    title: "FLASH Decision Card & PEAD Execution",
    badge: "Gate 5 (270–300s)",
    colorClass: "text-rose-400 border-rose-500/40",
    badgeBg: "bg-rose-950/80 text-rose-300 border-rose-800",
    timing: "270 to 300 seconds post-filing",
    summary: "Instant distribution of actionable institutional execution briefs with PEAD drift targets before market opening.",
    metricsCount: "Real-Time Terminal Dispatch",
    description:
      "Publishes the comprehensive FLASH Decision Card directly to the Athena Terminal and institutional broadcast webhooks. Formulates exact price drift trajectories: projected Gap-Up percentage, 1-Day reaction, 1-Week PEAD drift, and 1-Month trend continuation target.",
    keyInputs: [
      "Gate 4 Master Conviction Grade & Final Score",
      "Historical PEAD Drift Velocity for the specific industry",
      "Opening Gap-Up projection model vs pre-market liquidity",
      "Pre-configured Stop-loss benchmark and fair-value target price",
    ],
    benchmarks: [
      "Decision Publication SLA: < 300 seconds (5 minutes total)",
      "Projected 1W PEAD Drift: +6% to +14% for AAA+ grade",
      "Risk/Reward Ratio: Minimum 1:3 against technical stop loss",
    ],
    failureConditions: [
      "Liquidity constraint (Average Daily Turnover < ₹10 Lakhs)",
      "ASM/GSM exchange surveillance stage > 2",
    ],
    formula: "Expected Drift = Beta * Shock_Delta + Historical_PEAD_Drift_Mean * Conviction_Grade_Weight",
  },
];

const FORENSIC_CHECKS = [
  {
    name: "Cash-to-Accrual Conversion",
    target: "CFO / PAT >= 0.85x",
    risk: "High non-cash accrual risk if < 0.3x; earnings may be paper profits.",
    gate: "Gate 2",
  },
  {
    name: "Other Income Stripping",
    target: "< 15% of PBT",
    risk: "PBT inflated by asset sales or treasury gains instead of core business sales.",
    gate: "Gate 2",
  },
  {
    name: "Piotroski 9-Point Score",
    target: ">= 7 of 9 points",
    risk: "Scores <= 4 indicate deteriorating liquidity, margin decay, or dilution.",
    gate: "Gate 2",
  },
  {
    name: "Working Capital Divergence",
    target: "DSO change < +10 days",
    risk: "Aggressive revenue booking with channel stuffing or delayed collections.",
    gate: "Gate 2",
  },
  {
    name: "Interest Coverage Ratio",
    target: "EBIT / Interest > 3.5x",
    risk: "Earnings vulnerable to interest rate shocks; solvency stress.",
    gate: "Gate 3",
  },
  {
    name: "Promoter Share Pledging",
    target: "< 5.0% of promoter holding",
    risk: "Forced liquidation risk during market corrections if pledge > 20%.",
    gate: "Gate 3",
  },
];

export default function KnowledgeCenter() {
  const [activeTab, setActiveTab] = useState<
    "navigator" | "playbooks" | "presets" | "routine" | "secrets" | "tools" | "athena"
  >("navigator");

  const [selectedGateId, setSelectedGateId] = useState<string>("g1");
  const selectedGate =
    GATES_DATA.find((g) => g.id === selectedGateId) || GATES_DATA[0];

  return (
    <div className="space-y-6">
      {/* =========================================================================
          HERO HEADER: Institutional Profit & Playbook Command Hub
      ========================================================================= */}
      <div className="p-5 md:p-6 rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-cyan-50 via-white to-slate-50 dark:from-cyan-950/40 dark:via-slate-900/90 dark:to-slate-950 shadow-sm dark:shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-gradient-to-l from-emerald-500/10 via-cyan-500/10 to-transparent pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 dark:from-emerald-500/20 dark:to-cyan-500/20 border border-cyan-500/40 text-cyan-600 dark:text-cyan-400 shrink-0">
              <BookOpen className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl md:text-2xl font-black font-mono tracking-tight text-slate-900 dark:text-white">
                  ALPHA INDIA KNOWLEDGE & PROFIT ACADEMY
                </h1>
                <span className="px-2.5 py-0.5 text-[10px] font-bold font-mono uppercase rounded-full bg-emerald-100 dark:bg-emerald-950 border border-emerald-500/40 text-emerald-800 dark:text-emerald-300">
                  Sprint 35.3 · Institutional Edge
                </span>
              </div>
              <p className="text-xs md:text-sm text-slate-600 dark:text-slate-300 mt-1 max-w-3xl leading-relaxed">
                Practical, high-win-rate playbooks, screener cheat codes, daily execution routines, and quant strategies to extract maximum alpha and profit from Indian equity markets.
              </p>
            </div>
          </div>

          {/* Quick Stats & Quick Launcher */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Link
              href="/growth-screener"
              className="px-3 py-1.5 rounded-lg bg-cyan-50 dark:bg-cyan-950/80 border border-cyan-500/40 text-cyan-700 dark:text-cyan-300 text-xs font-mono font-bold flex items-center gap-1.5 hover:bg-cyan-100 dark:hover:bg-cyan-900/80 transition-colors"
            >
              <span>Launch Screener</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
            <Link
              href="/athena-omega"
              className="px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/80 border border-rose-500/40 text-rose-700 dark:text-rose-300 text-xs font-mono font-bold flex items-center gap-1.5 hover:bg-rose-100 dark:hover:bg-rose-900/80 transition-colors"
            >
              <span>Open Athena</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
            <Link
              href="/announcements"
              className="px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/80 border border-amber-500/40 text-amber-700 dark:text-amber-300 text-xs font-mono font-bold flex items-center gap-1.5 hover:bg-amber-100 dark:hover:bg-amber-900/80 transition-colors"
            >
              <span>Live Wire</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex flex-wrap items-center gap-2 mt-5 pt-4 border-t border-slate-200 dark:border-slate-800/80">
          <button
            onClick={() => setActiveTab("navigator")}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer ${
              activeTab === "navigator"
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 shadow-xs dark:shadow-emerald-950"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800"
            }`}
          >
            <Target className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
            Alpha Navigator (Action Finder)
          </button>

          <button
            onClick={() => setActiveTab("playbooks")}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer ${
              activeTab === "playbooks"
                ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/40 shadow-xs dark:shadow-rose-950"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800"
            }`}
          >
            <Crosshair className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
            The 5 Profit Playbooks
          </button>

          <button
            onClick={() => setActiveTab("presets")}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer ${
              activeTab === "presets"
                ? "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/40 shadow-xs dark:shadow-cyan-950"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800"
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-cyan-500 dark:text-cyan-400" />
            1-Click Screener Presets
          </button>

          <button
            onClick={() => setActiveTab("routine")}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer ${
              activeTab === "routine"
                ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/40 shadow-xs dark:shadow-amber-950"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800"
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
            15-Min Daily Routine
          </button>

          <button
            onClick={() => setActiveTab("secrets")}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer ${
              activeTab === "secrets"
                ? "bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/40 shadow-xs dark:shadow-purple-950"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800"
            }`}
          >
            <Lightbulb className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" />
            Insider Secrets & Unfair Edge
          </button>

          <button
            onClick={() => setActiveTab("tools")}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer ${
              activeTab === "tools"
                ? "bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/40 shadow-xs dark:shadow-blue-950"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
            Tool Arsenal Launchboard
          </button>

          <button
            onClick={() => setActiveTab("athena")}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer ${
              activeTab === "athena"
                ? "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/40 shadow-xs dark:shadow-cyan-950"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-500 dark:text-cyan-400" />
            Athena 5-Gate Quant Engine
          </button>
        </div>
      </div>

      {/* =========================================================================
          TAB 1: ALPHA NAVIGATOR (INTERACTIVE GOAL ENGINE)
      ========================================================================= */}
      {activeTab === "navigator" && <AlphaNavigator />}

      {/* =========================================================================
          TAB 2: THE 5 PROFIT PLAYBOOKS
      ========================================================================= */}
      {activeTab === "playbooks" && <ProfitPlaybooks />}

      {/* =========================================================================
          TAB 3: 1-CLICK SCREENER PRESETS & CHEAT CODES
      ========================================================================= */}
      {activeTab === "presets" && <ScreenerPresets />}

      {/* =========================================================================
          TAB 4: THE 15-MINUTE DAILY HIGH-EFFICIENCY ROUTINE
      ========================================================================= */}
      {activeTab === "routine" && <DailyRoutineGuide />}

      {/* =========================================================================
          TAB 5: INSIDER SECRETS & UNFAIR ADVANTAGES
      ========================================================================= */}
      {activeTab === "secrets" && <InsiderSecrets />}

      {/* =========================================================================
          TAB 6: TOOL ARSENAL & LAUNCHBOARD
      ========================================================================= */}
      {activeTab === "tools" && <ToolArsenal />}

      {/* =========================================================================
          TAB 7: ATHENA 5-GATE QUANT METHODOLOGY
      ========================================================================= */}
      {activeTab === "athena" && (
        <div className="space-y-6">
          {/* Quick Overview Strip */}
          <div className="p-4 rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-xs">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase font-mono flex items-center gap-2 mb-3">
              <Layers className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
              The 5 Sequential Decision Gates Overview
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-2.5">
              {GATES_DATA.map((gate) => {
                const isSelected = selectedGateId === gate.id;
                return (
                  <button
                    key={gate.id}
                    onClick={() => setSelectedGateId(gate.id)}
                    className={`text-left p-3 rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? `${gate.colorClass} bg-slate-50 dark:bg-slate-950 shadow-xs dark:shadow-md`
                        : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold font-mono uppercase">{gate.badge}</span>
                      {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />}
                    </div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white mt-1 line-clamp-1">{gate.title}</div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-tight">
                      {gate.summary}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Detailed Gate Deep-Dive Inspector */}
          <div className="p-5 md:p-6 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-5 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 text-xs font-bold font-mono uppercase rounded-full ${selectedGate.badgeBg}`}>
                    {selectedGate.badge}
                  </span>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white font-mono">{selectedGate.title}</h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Latency SLA: <span className="text-slate-800 dark:text-slate-200 font-mono font-bold">{selectedGate.timing}</span> · Scrutiny Scope: <span className="text-cyan-600 dark:text-cyan-400 font-mono font-semibold">{selectedGate.metricsCount}</span>
                </p>
              </div>

              {selectedGate.formula && (
                <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] font-mono text-cyan-700 dark:text-cyan-300">
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase">Quant Formula</div>
                  {selectedGate.formula}
                </div>
              )}
            </div>

            {/* Description Paragraph */}
            <p className="text-xs md:text-sm text-slate-700 dark:text-slate-200 leading-relaxed font-sans">
              {selectedGate.description}
            </p>

            {/* 3 Columns: Inputs, Benchmarks, Failure Criteria */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/90 space-y-2">
                <div className="text-xs font-mono font-bold uppercase text-cyan-600 dark:text-cyan-400 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5" />
                  Primary Scrutiny Inputs
                </div>
                <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300 font-sans">
                  {selectedGate.keyInputs.map((input, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-cyan-500 dark:text-cyan-400 mt-0.5">•</span>
                      <span>{input}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/90 space-y-2">
                <div className="text-xs font-mono font-bold uppercase text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Pass & Excellence Benchmarks
                </div>
                <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300 font-sans">
                  {selectedGate.benchmarks.map((bm, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-emerald-500 dark:text-emerald-400 mt-0.5">✓</span>
                      <span>{bm}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/90 space-y-2">
                <div className="text-xs font-mono font-bold uppercase text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Failure & Rejection Flags
                </div>
                <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300 font-sans">
                  {selectedGate.failureConditions.map((fc, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-rose-500 dark:text-rose-400 mt-0.5">✕</span>
                      <span>{fc}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Forensic Audits Grid */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 space-y-4 shadow-xs">
            <h2 className="text-base font-bold text-slate-900 dark:text-white font-mono flex items-center gap-2">
              <FileCheck2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              12 Institutional Forensic Health Audits (Gate 2 Heuristics)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              {FORENSIC_CHECKS.map((check, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-white font-mono">{check.name}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 border border-slate-200 dark:border-slate-800">
                      {check.gate}
                    </span>
                  </div>
                  <div className="text-xs font-mono text-emerald-600 dark:text-emerald-400">
                    Target: <span className="font-bold">{check.target}</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 font-sans leading-tight">
                    {check.risk}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

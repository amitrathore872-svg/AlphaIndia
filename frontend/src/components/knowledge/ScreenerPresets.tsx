"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Sliders,
  TrendingUp,
  Gem,
  ShieldCheck,
  Zap,
  RotateCcw,
  ArrowRight,
  Copy,
  Check,
  Sparkles,
  Layers,
  Filter,
} from "lucide-react";

interface PresetConfig {
  id: string;
  name: string;
  category: string;
  badgeBg: string;
  colorClass: string;
  tagline: string;
  targetHorizon: string;
  winRate: string;
  expectedAlpha: string;
  targetTool: string;
  launchUrl: string;
  filters: {
    metric: string;
    condition: string;
    reasoning: string;
  }[];
  rationale: string;
  idealFor: string;
  copyableFormula: string;
}

const PRESETS: PresetConfig[] = [
  {
    id: "pre-breakout-cheat",
    name: "Pre-Breakout Cheat Entry (VCP + NR7)",
    category: "Asymmetric Pre-Move Coils",
    badgeBg: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    colorClass: "border-emerald-500/40 text-emerald-400",
    tagline: "Institutional volatility compression with volume dry-up (VDU) right beneath resistance before the breakout.",
    targetHorizon: "3 to 15 Trading Days",
    winRate: "85.2%",
    expectedAlpha: "+10% to +20%",
    targetTool: "Pre-Breakout Cheat Radar",
    launchUrl: "/pre-breakout-radar",
    filters: [
      { metric: "Stage 2 Trend", condition: "Close > 20 EMA > 50 SMA", reasoning: "Institutional markup momentum alignment" },
      { metric: "Pivot Proximity", condition: "Distance to 20D High <= 3.5%", reasoning: "Coiling right under the resistance ceiling" },
      { metric: "Volume Dry-Up (VDU)", condition: "Volume <= 65% of 20 SMA", reasoning: "Complete exhaustion of floating supply" },
      { metric: "Volatility Coil", condition: "NR7, Inside Day, or Range <= 1.8%", reasoning: "Extreme contraction ready for explosive expansion" },
    ],
    rationale:
      "Extreme volatility contraction directly precedes explosive volatility expansion. Entering inside the quiet coil provides an asymmetric 3.5:1+ Risk:Reward with only a tight 3% stop before the crowd chases the breakout.",
    idealFor: "Swing traders, VCP specialists, and low-drawdown momentum traders.",
    copyableFormula:
      "STAGE2==TRUE AND DIST_PIVOT<=3.5% AND VDU<=0.65 AND (NR7==TRUE OR INSIDE_DAY==TRUE) AND 50<=RSI<=64",
  },
  {
    id: "super-momentum-radar",
    name: "Super Momentum (Triple RSI & BB)",
    category: "Multi-Timeframe Explosions",
    badgeBg: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
    colorClass: "border-cyan-500/40 text-cyan-400",
    tagline: "Explosive multi-timeframe breakout: Daily/Weekly Upper BB ride, Triple RSI > 60, and Weekly WMA 30/50 cross.",
    targetHorizon: "5 to 30 Trading Days",
    winRate: "82.6%",
    expectedAlpha: "+15% to +35%",
    targetTool: "Super Momentum Radar",
    launchUrl: "/momentum-radar",
    filters: [
      { metric: "Volume Expansion", condition: "Daily Volume > SMA(20)", reasoning: "Institutional participation surge" },
      { metric: "Bollinger Breakout", condition: "Daily & Weekly Close > Upper BB", reasoning: "Dual-timeframe volatility expansion" },
      { metric: "Triple RSI (14)", condition: "Daily > 60 & Weekly > 60 & Monthly > 60", reasoning: "Perfect multi-timeframe momentum alignment" },
      { metric: "Weekly WMA Trend", condition: "WMA(30) Crossed Above WMA(50) > 60", reasoning: "Weighted moving average golden cross above ₹60" },
    ],
    rationale:
      "When price breaks above the Upper Bollinger Band simultaneously on daily and weekly frames while Daily, Weekly, and Monthly RSI all exceed 60, institutional markup velocity is confirmed.",
    idealFor: "Momentum swing traders, multi-timeframe breakout specialists, and high-beta trend followers.",
    copyableFormula:
      "VOL>SMA20 AND D_CLOSE>D_BB_UPPER AND W_CLOSE>W_BB_UPPER AND D_RSI>60 AND W_RSI>60 AND M_RSI>60 AND W_WMA30_CROSS_50 AND W_WMA>60",
  },
  {
    id: "athena-prime",
    name: "Athena Alpha Prime (AAA+)",
    category: "High-Frequency Earnings Shocks",
    badgeBg: "bg-rose-500/10 text-rose-300 border-rose-500/30",
    colorClass: "border-rose-500/40 text-rose-400",
    tagline: "The top 1% explosive earnings inflection stocks with audited cash-backed quality.",
    targetHorizon: "1 to 20 Trading Days",
    winRate: "88.4%",
    expectedAlpha: "+12% to +20%",
    targetTool: "Athena Omega",
    launchUrl: "/athena-omega",
    filters: [
      { metric: "Conviction Grade", condition: "== 'AAA+'", reasoning: "Composite conviction >= 85 points" },
      { metric: "Business Shock Radar", condition: ">= 80 Points", reasoning: "Top-line revenue + core operating surge" },
      { metric: "Gate 2 Forensic", condition: "== 'CLEAN'", reasoning: "Zero accounting manipulation or non-operating fluff" },
      { metric: "Fair Value Upside", condition: ">= +25%", reasoning: "Substantial statistical discount to intrinsic target" },
    ],
    rationale:
      "Captures high-velocity PEAD drift immediately after filing release, before domestic mutual funds and brokerages revise price targets.",
    idealFor: "Momentum traders, pre-market swing traders, and breakout specialists.",
    copyableFormula: "GRADE=AAA+ AND SHOCK>=80 AND FORENSIC=CLEAN AND UPSIDE>=25% AND GAP<=6%",
  },
  {
    id: "hidden-gems",
    name: "Hidden Gems Inflection",
    category: "Micro-Cap Multibaggers",
    badgeBg: "bg-purple-500/10 text-purple-300 border-purple-500/30",
    colorClass: "border-purple-500/40 text-purple-400",
    tagline: "Small and micro-cap companies crossing the profitability threshold before sell-side coverage.",
    targetHorizon: "6 to 18 Months",
    winRate: "78.2%",
    expectedAlpha: "+50% to +150%",
    targetTool: "Hidden Gems Radar",
    launchUrl: "/hidden-gems",
    filters: [
      { metric: "Market Capitalization", condition: "₹500 Cr to ₹3,000 Cr", reasoning: "Under the radar of institutional mandates" },
      { metric: "PAT YoY Growth", condition: ">= +40%", reasoning: "Extreme operational earnings acceleration" },
      { metric: "ROCE", condition: ">= 18%", reasoning: "High capital efficiency and pricing power" },
      { metric: "Promoter Pledging", condition: "== 0.0%", reasoning: "Pristine ownership alignment without leverage risk" },
    ],
    rationale:
      "When a micro-cap doubles its profits, institutions cannot buy until market cap hits ₹2,000 Cr. Buying before this threshold yields massive rerating alpha.",
    idealFor: "Early-stage growth investors and high-conviction small-cap hunters.",
    copyableFormula: "MCAP<=3000CR AND PAT_YOY>=40% AND ROCE>=18% AND PLEDGE==0% AND DEBT<=0.3",
  },
  {
    id: "debt-free-titans",
    name: "Debt-Free Compounding Titans",
    category: "Low-Risk Wealth Compounding",
    badgeBg: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    colorClass: "border-emerald-500/40 text-emerald-400",
    tagline: "Zero-debt market leaders delivering 20%+ ROCE with superior cash conversion.",
    targetHorizon: "1 to 3 Years",
    winRate: "91.0%",
    expectedAlpha: "+25% to +45% CAGR",
    targetTool: "Growth Screener PRO",
    launchUrl: "/growth-screener",
    filters: [
      { metric: "Debt-to-Equity Ratio", condition: "== 0.0 (Net Cash)", reasoning: "Complete immunity to high interest rate cycles" },
      { metric: "ROCE", condition: ">= 22%", reasoning: "Tier-1 capital compounding engine" },
      { metric: "CFO to PAT Ratio", condition: ">= 1.0x", reasoning: "Every rupee of reported profit is in the bank account" },
      { metric: "Health Score", condition: ">= 80 Points", reasoning: "Top decile institutional financial strength" },
    ],
    rationale:
      "These companies fund their own expansion entirely through internal cash generation. They compound capital steadily through all market cycles.",
    idealFor: "Long-term investors, retirement builders, and risk-averse portfolio managers.",
    copyableFormula: "DEBT_EQ==0.0 AND ROCE>=22% AND CFO_PAT>=1.0 AND HEALTH_SCORE>=80 AND REV_YOY>=18%",
  },
  {
    id: "hyper-growth",
    name: "Hyper-Growth Leaders",
    category: "Top-Line Dominance",
    badgeBg: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
    colorClass: "border-cyan-500/40 text-cyan-400",
    tagline: "Companies expanding revenue by > 30% YoY with operating margin expansion.",
    targetHorizon: "3 to 12 Months",
    winRate: "79.5%",
    expectedAlpha: "+35% to +75%",
    targetTool: "Growth Screener PRO",
    launchUrl: "/growth-screener",
    filters: [
      { metric: "Revenue YoY Growth", condition: ">= +30%", reasoning: "Rapid market share capture across the sector" },
      { metric: "PAT YoY Growth", condition: ">= +35%", reasoning: "Operating leverage driving faster profit growth" },
      { metric: "Operating Profit Margin (OPM)", condition: "Expanding YoY", reasoning: "Pricing power and operating efficiency" },
      { metric: "Health Score", condition: ">= 75 Points", reasoning: "Institutional solvency clearance" },
    ],
    rationale:
      "Indian markets pay massive valuation premiums for sustainable 30%+ revenue growers in emerging sectors like electronics manufacturing, renewable energy, and defense.",
    idealFor: "Aggressive growth investors seeking sector leaders with strong tailwinds.",
    copyableFormula: "REV_YOY>=30% AND PAT_YOY>=35% AND OPM_EXPANSION>0 AND HEALTH_SCORE>=75",
  },
  {
    id: "turnaround-specials",
    name: "Turnaround Inflection Specials",
    category: "Asymmetric Rebound Plays",
    badgeBg: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    colorClass: "border-amber-500/40 text-amber-400",
    tagline: "Companies swinging from consecutive losses to solid operating profitability.",
    targetHorizon: "6 to 12 Months",
    winRate: "74.0%",
    expectedAlpha: "+40% to +100%",
    targetTool: "Quarterly Results",
    launchUrl: "/quarterly-results",
    filters: [
      { metric: "Prior Quarter PAT", condition: "< 0 (Loss Making)", reasoning: "Base quarter depressed by one-off cycle trough" },
      { metric: "Current Quarter PAT", condition: "> 0 (Solid Profit)", reasoning: "Decisive transition to positive profitability" },
      { metric: "Operating Margin Expansion", condition: ">= +300 bps", reasoning: "Structural operational recovery, not accounting trick" },
      { metric: "Core Revenue Growth", condition: ">= +15% YoY", reasoning: "Volume recovery confirms demand resurgence" },
    ],
    rationale:
      "Turnarounds offer extreme asymmetric upside. When an unloved stock turns profitable, price-to-earnings multiples often double while earnings quadruple.",
    idealFor: "Contrarian investors and deep value inflection seekers.",
    copyableFormula: "PRIOR_PAT<0 AND CURRENT_PAT>0 AND MARGIN_EXPANSION>=300BPS AND REV_YOY>=15%",
  },
];

export default function ScreenerPresets() {
  const [copiedPresetId, setCopiedPresetId] = useState<string | null>(null);

  const handleCopyFormula = (preset: PresetConfig) => {
    navigator.clipboard.writeText(preset.copyableFormula);
    setCopiedPresetId(preset.id);
    setTimeout(() => {
      setCopiedPresetId(null);
    }, 2000);
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#07111F]/90 p-5 md:p-6 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
              <Sliders className="w-5 h-5" />
            </div>
            <h2 className="text-lg md:text-xl font-black font-mono tracking-tight text-white">
              ONE-CLICK SCREENER PRESETS & CHEAT CODES
            </h2>
          </div>
          <p className="text-xs md:text-sm text-slate-400 mt-1 max-w-2xl">
            Pre-configured institutional filter setups ready to copy or launch directly into Growth Screener PRO and Athena Omega.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 bg-cyan-950/40 border border-cyan-800/40 px-3 py-1.5 rounded-lg">
          <Filter className="w-3.5 h-3.5" />
          <span>Zero Guesswork Screening</span>
        </div>
      </div>

      {/* Presets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {PRESETS.map((preset) => {
          const isCopied = copiedPresetId === preset.id;
          return (
            <div
              key={preset.id}
              className="p-5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between space-y-4 relative group"
            >
              <div className="space-y-3">
                {/* Badge & Win Rate */}
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${preset.badgeBg}`}>
                    {preset.category}
                  </span>
                  <span className="text-[11px] font-mono font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
                    {preset.winRate} Win
                  </span>
                </div>

                {/* Name & Tagline */}
                <div>
                  <h3 className="text-sm font-bold font-mono text-white group-hover:text-cyan-400 transition-colors">
                    {preset.name}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    {preset.tagline}
                  </p>
                </div>

                {/* Alpha & Horizon strip */}
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/90 border border-slate-800/80 text-[11px] font-mono">
                  <div>
                    <span className="text-slate-500 block text-[9px] uppercase">Alpha Target</span>
                    <span className="text-cyan-400 font-bold">{preset.expectedAlpha}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-500 block text-[9px] uppercase">Horizon</span>
                    <span className="text-amber-300 font-bold">{preset.targetHorizon}</span>
                  </div>
                </div>

                {/* Filter Conditions Table */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] uppercase font-mono font-bold text-slate-500 block">
                    Exact Filter Conditions:
                  </span>
                  <div className="space-y-1">
                    {preset.filters.map((f, idx) => (
                      <div
                        key={idx}
                        className="text-[11px] flex items-center justify-between p-1.5 rounded bg-slate-900/60 border border-slate-800/40"
                      >
                        <span className="text-slate-300 font-medium">{f.metric}</span>
                        <span className="font-mono font-bold text-cyan-300">{f.condition}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Buttons: Copy Formula & Launch */}
              <div className="pt-3 border-t border-slate-800/60 space-y-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopyFormula(preset)}
                    className="flex-1 py-1.5 px-2.5 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Formula Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Copy Formula</span>
                      </>
                    )}
                  </button>

                  <Link
                    href={preset.launchUrl}
                    className="py-1.5 px-3 rounded-lg border border-cyan-500/40 bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-300 text-xs font-mono font-bold flex items-center gap-1 transition-colors"
                  >
                    <span>Launch</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                <div className="text-[10px] text-slate-500 font-mono text-center">
                  Best For: <span className="text-slate-400">{preset.idealFor}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

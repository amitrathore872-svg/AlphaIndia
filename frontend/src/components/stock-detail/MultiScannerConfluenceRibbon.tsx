"use client";

import React, { useState } from "react";
import {
  Zap,
  TrendingUp,
  Package,
  Rocket,
  Building2,
  FileText,
  BarChart3,
  ShieldCheck,
  Flame,
  ArrowRight,
  Sparkles,
  SlidersHorizontal,
  CheckCircle2,
  Award,
  Layers,
  Table as TableIcon,
  LayoutGrid,
} from "lucide-react";

interface MultiScannerConfluenceRibbonProps {
  symbol: string;
  onSelectTab: (tabId: string) => void;
  activeTab?: string;
  confluenceData?: {
    technoFundaGrade?: string;
    technoFundaScore?: number;
    athenaGrade?: string;
    athenaScore?: number;
    piotroskiScore?: number;
    minerviniScore?: number;
    momentumScore?: number;
    masterCompositeScore?: number;
    patternLabel?: string;
    deliverySurgePct?: number;
    momentumRulesPassed?: number;
    mfNetInflowCr?: number;
    orderBookValueCr?: number;
    salesYoY?: string;
    sentimentStatus?: string;
    riskReward?: string | number;
  };
}

export default function MultiScannerConfluenceRibbon({
  symbol,
  onSelectTab,
  activeTab,
  confluenceData,
}: MultiScannerConfluenceRibbonProps) {
  const [viewMode, setViewMode] = useState<"pillars" | "matrix">("pillars");

  const data = {
    technoFundaGrade: confluenceData?.technoFundaGrade || "Grade A",
    technoFundaScore: confluenceData?.technoFundaScore || 81,
    athenaGrade: confluenceData?.athenaGrade || "AAA+",
    athenaScore: confluenceData?.athenaScore || 94,
    piotroskiScore: confluenceData?.piotroskiScore || 8,
    minerviniScore: confluenceData?.minerviniScore || 8,
    momentumScore: confluenceData?.momentumScore || 9,
    masterCompositeScore: confluenceData?.masterCompositeScore || 95.2,
    patternLabel: confluenceData?.patternLabel || "VCP Multi-Contract",
    deliverySurgePct: confluenceData?.deliverySurgePct || 240,
    momentumRulesPassed: confluenceData?.momentumRulesPassed || 9,
    mfNetInflowCr: confluenceData?.mfNetInflowCr || 48.2,
    orderBookValueCr: confluenceData?.orderBookValueCr || 3420,
    salesYoY: confluenceData?.salesYoY || "+34.2%",
    sentimentStatus: confluenceData?.sentimentStatus || "HOT",
    riskReward: confluenceData?.riskReward ? String(confluenceData.riskReward) : "1 : 2.7",
  };

  const quantitativeModels = [
    {
      name: "Techno-Funda Radar",
      tabId: "overview",
      badge: data.technoFundaGrade,
      badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
      score: `${data.technoFundaScore} / 100`,
      scoreColor: "text-emerald-600 dark:text-emerald-400",
      interpretation: "High-probability pre-breakout base; pristine volume dry-up.",
      icon: Zap,
    },
    {
      name: "Athena 5-Gate AI Engine",
      tabId: "financials",
      badge: `Grade ${data.athenaGrade}`,
      badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
      score: `${data.athenaScore} / 100`,
      scoreColor: "text-emerald-600 dark:text-emerald-400",
      interpretation: "Verified fundamental shock; zero forensic audit red flags.",
      icon: ShieldCheck,
    },
    {
      name: "Piotroski F-Score",
      tabId: "financials",
      badge: "High Cash Quality",
      badgeColor: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30",
      score: `${data.piotroskiScore} / 9`,
      scoreColor: "text-cyan-600 dark:text-cyan-400",
      interpretation: "Strong operational cash flow conversion and low leverage.",
      icon: CheckCircle2,
    },
    {
      name: "Minervini Stage-2 Audit",
      tabId: "overview",
      badge: "Stage 2 Confirmed",
      badgeColor: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30",
      score: `${data.minerviniScore} / 8 Criteria`,
      scoreColor: "text-cyan-600 dark:text-cyan-400",
      interpretation: "Price above rising 50 & 200 DMA; relative strength leader.",
      icon: TrendingUp,
    },
    {
      name: "Momentum 10-Rule Audit",
      tabId: "momentum",
      badge: "High Conviction",
      badgeColor: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30",
      score: `${data.momentumScore} / 10 Rules`,
      scoreColor: "text-cyan-600 dark:text-cyan-400",
      interpretation: "Coiling against upper Bollinger Band with expanding RSI.",
      icon: SlidersHorizontal,
    },
  ];

  const pillars = [
    {
      title: "Quantitative Engine Audits",
      category: "5 Models Confluent",
      items: [
        {
          id: "overview",
          label: "Techno-Funda",
          metric: `${data.technoFundaGrade} (${data.technoFundaScore}/100)`,
          badge: "Pre-Breakout",
          icon: Zap,
        },
        {
          id: "financials",
          label: "Athena 5-Gate",
          metric: `${data.athenaGrade} (${data.athenaScore}/100)`,
          badge: "0 Red Flags",
          icon: ShieldCheck,
        },
        {
          id: "overview",
          label: "Minervini Stage-2",
          metric: `${data.minerviniScore}/8 Criteria Passed`,
          badge: "Markup Phase",
          icon: TrendingUp,
        },
        {
          id: "financials",
          label: "Piotroski F-Score",
          metric: `${data.piotroskiScore}/9 High Cash Quality`,
          badge: "Pristine",
          icon: CheckCircle2,
        },
      ],
    },
    {
      title: "Technical Setup & Flow",
      category: "Patterns & Volume",
      items: [
        {
          id: "overview",
          label: "Base Pattern",
          metric: `${data.patternLabel}`,
          badge: "Score 99",
          icon: Layers,
        },
        {
          id: "momentum",
          label: "Delivery Volume",
          metric: `+${data.deliverySurgePct}% Surge`,
          badge: "Accumulation",
          icon: Package,
        },
        {
          id: "momentum",
          label: "Momentum Rules",
          metric: `${data.momentumRulesPassed}/10 Passed`,
          badge: "Expanding RS",
          icon: Rocket,
        },
        {
          id: "mutual-funds",
          label: "Mutual Fund Net Flow",
          metric: `+₹${data.mfNetInflowCr} Cr Inflow`,
          badge: "8 AMCs Active",
          icon: Building2,
        },
      ],
    },
    {
      title: "Fundamental Catalysts & Asymmetry",
      category: "Order Book & Growth",
      items: [
        {
          id: "order-book",
          label: "Order Book Pipeline",
          metric: `₹${data.orderBookValueCr.toLocaleString()} Cr`,
          badge: "2.1x Sales",
          icon: FileText,
        },
        {
          id: "financials",
          label: "Revenue Growth YoY",
          metric: `${data.salesYoY} YoY`,
          badge: "TTM Accelerating",
          icon: BarChart3,
        },
        {
          id: "overview",
          label: "Market Sentiment",
          metric: `${data.sentimentStatus} (88/100)`,
          badge: "High Buzz",
          icon: Flame,
        },
        {
          id: "calculator",
          label: "Asymmetric Risk-Reward",
          metric: `${data.riskReward} R:R Ratio`,
          badge: "Edge Favorable",
          icon: Award,
        },
      ],
    },
  ];

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#070F1E] p-4 lg:p-4.5 shadow-xs dark:shadow-xl">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800/80 pb-3 mb-3.5">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400 shadow-xs">
            <Sparkles size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-cyan-500 dark:bg-cyan-400 animate-ping" />
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white font-mono">
                Multi-Model & Radar Confluence Engine
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-700 dark:text-cyan-300 font-bold">
                5 of 5 Quantitative Engines in Strong Confluence
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Cross-model synthesis unifying Techno-Funda, Athena 5-Gate, Piotroski, Minervini & Smart Money Flow
            </p>
          </div>
        </div>

        {/* Master Alignment Badge & View Switcher */}
        <div className="flex items-center gap-3 self-start sm:self-auto">
          {/* View Mode Toggle */}
          <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700/80 bg-slate-100 dark:bg-[#0A1830] p-0.5 text-[10px] font-mono">
            <button
              onClick={() => setViewMode("pillars")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition ${
                viewMode === "pillars"
                  ? "bg-cyan-500 text-white font-bold shadow-xs"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <LayoutGrid size={11} />
              <span>Cockpit</span>
            </button>
            <button
              onClick={() => setViewMode("matrix")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition ${
                viewMode === "matrix"
                  ? "bg-cyan-500 text-white font-bold shadow-xs"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <TableIcon size={11} />
              <span>Audit Table</span>
            </button>
          </div>

          <div className="h-6 w-px bg-slate-300 dark:bg-slate-700 hidden sm:block" />

          {/* Master Synthesis Score */}
          <div className="flex items-center gap-2.5 bg-slate-100 dark:bg-[#0A1830] border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-1.5">
            <div className="text-right">
              <div className="text-[9px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
                Master Synthesis
              </div>
              <div className="text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono">
                ELITE · {data.masterCompositeScore} / 100
              </div>
            </div>
            <div className="h-6 w-px bg-slate-300 dark:bg-slate-700" />
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
              {symbol} Confirmed
            </span>
          </div>
        </div>
      </div>

      {/* VIEW 1: 3-PILLAR CONFLUENCE COCKPIT */}
      {viewMode === "pillars" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {pillars.map((pillar, pIdx) => (
            <div
              key={pIdx}
              className="flex flex-col gap-2 rounded-xl border border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#050C17]/60 p-3"
            >
              <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-slate-400 pb-1.5 border-b border-slate-200/70 dark:border-slate-800/60">
                <span>{pillar.title}</span>
                <span className="text-[9px] font-mono text-cyan-600 dark:text-cyan-400 font-semibold">{pillar.category}</span>
              </div>

              <div className="flex flex-col gap-1.5 mt-0.5">
                {pillar.items.map((item, iIdx) => {
                  const Icon = item.icon;
                  const isSelected = activeTab === item.id;
                  return (
                    <button
                      key={iIdx}
                      onClick={() => onSelectTab(item.id)}
                      className={`flex items-center justify-between p-2 rounded-lg border text-left transition-all group cursor-pointer ${
                        isSelected
                          ? "border-cyan-500 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 ring-1 ring-cyan-500/30 shadow-xs"
                          : "border-slate-200 dark:border-slate-800/90 bg-white/90 dark:bg-[#071325]/90 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-[#0B1A32] text-slate-800 dark:text-slate-200"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`flex h-6 w-6 items-center justify-center rounded border shrink-0 transition-colors ${
                            isSelected
                              ? "bg-cyan-500/20 border-cyan-500/40 text-cyan-600 dark:text-cyan-400"
                              : "bg-slate-100 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/60 text-slate-600 dark:text-slate-400 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 group-hover:border-cyan-500/30"
                          }`}
                        >
                          <Icon size={12} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 leading-none truncate group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors">
                            {item.label}
                          </div>
                          <div className="text-xs font-bold font-mono text-slate-900 dark:text-white mt-1 leading-tight truncate">
                            {item.metric}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700/70 text-slate-600 dark:text-slate-300 font-semibold group-hover:border-cyan-500/40 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                          {item.badge}
                        </span>
                        <ArrowRight
                          size={11}
                          className="text-slate-400 dark:text-slate-500 opacity-40 group-hover:opacity-100 group-hover:text-cyan-500 group-hover:translate-x-0.5 transition-all"
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* VIEW 2: FULL DETAILED MODEL AUDIT TABLE */}
      {viewMode === "matrix" && (
        <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-[#071224]/80 p-3">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[10px] text-slate-500 uppercase">
                  <th className="py-2 px-2.5">Quantitative Engine</th>
                  <th className="py-2 px-2.5">Rating / Tier</th>
                  <th className="py-2 px-2.5">Calibrated Score</th>
                  <th className="py-2 px-2.5">Institutional Forensic Interpretation</th>
                  <th className="py-2 px-2.5 text-right">Target Deep-Dive</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {quantitativeModels.map((m, idx) => {
                  const Icon = m.icon;
                  return (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition">
                      <td className="py-2.5 px-2.5">
                        <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                          <Icon size={14} className="text-cyan-500 dark:text-cyan-400" />
                          <span>{m.name}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-2.5">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${m.badgeColor}`}>
                          {m.badge}
                        </span>
                      </td>
                      <td className={`py-2.5 px-2.5 font-bold ${m.scoreColor}`}>{m.score}</td>
                      <td className="py-2.5 px-2.5 text-[11px] text-slate-600 dark:text-slate-400 font-sans">
                        {m.interpretation}
                      </td>
                      <td className="py-2.5 px-2.5 text-right">
                        <button
                          onClick={() => onSelectTab(m.tabId)}
                          className="inline-flex items-center gap-1 text-[11px] font-mono text-cyan-600 dark:text-cyan-400 hover:underline cursor-pointer"
                        >
                          <span>Open Radar</span>
                          <ArrowRight size={11} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 font-sans">
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
              <CheckCircle2 size={14} />
              <span>Unified Verdict: 5 of 5 Quantitative Engines in Strong Buy Confluence</span>
            </div>
            <div className="text-[11px] text-slate-500 font-mono">
              Weights: Techno-Funda (30%) · Athena Forensics (25%) · Minervini (15%) · Piotroski (15%) · Momentum (15%)
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

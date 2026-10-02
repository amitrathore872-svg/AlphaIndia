"use client";

import React from "react";
import {
  SlidersHorizontal,
  CheckCircle2,
  ShieldCheck,
  Zap,
  TrendingUp,
  Award,
  Sparkles,
} from "lucide-react";

interface CompositeRatingMatrixProps {
  technoFundaScore?: number;
  technoFundaGrade?: string;
  athenaScore?: number;
  athenaGrade?: string;
  piotroskiScore?: number;
  minerviniScore?: number;
  momentumScore?: number;
  masterCompositeScore?: number;
}

export default function CompositeRatingMatrix({
  technoFundaScore = 99,
  technoFundaGrade = "Grade A",
  athenaScore = 94,
  athenaGrade = "AAA+",
  piotroskiScore = 8,
  minerviniScore = 8,
  momentumScore = 9,
  masterCompositeScore = 95.2,
}: CompositeRatingMatrixProps) {
  const models = [
    {
      name: "Techno-Funda Radar",
      badge: technoFundaGrade,
      badgeColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
      score: `${technoFundaScore} / 100`,
      scoreColor: "text-emerald-400",
      interpretation: "High-probability pre-breakout base; pristine volume dry-up.",
      icon: Zap,
    },
    {
      name: "Athena 5-Gate AI Engine",
      badge: `Grade ${athenaGrade}`,
      badgeColor: "bg-rose-500/20 text-rose-300 border-rose-500/40",
      score: `${athenaScore} / 100`,
      scoreColor: "text-rose-400",
      interpretation: "Verified fundamental shock; zero forensic audit red flags.",
      icon: ShieldCheck,
    },
    {
      name: "Piotroski F-Score",
      badge: "High Cash Quality",
      badgeColor: "bg-cyan-500/20 text-cyan-300 border-cyan-500/40",
      score: `${piotroskiScore} / 9`,
      scoreColor: "text-cyan-400",
      interpretation: "Strong operational cash flow conversion and low leverage.",
      icon: CheckCircle2,
    },
    {
      name: "Minervini Stage-2",
      badge: "Stage 2 Confirmed",
      badgeColor: "bg-purple-500/20 text-purple-300 border-purple-500/40",
      score: `${minerviniScore} / 8 Criteria`,
      scoreColor: "text-purple-400",
      interpretation: "Price above rising 50 & 200 DMA; relative strength leader.",
      icon: TrendingUp,
    },
    {
      name: "Momentum 10-Rule Audit",
      badge: "High Conviction",
      badgeColor: "bg-amber-500/20 text-amber-300 border-amber-500/40",
      score: `${momentumScore} / 10 Rules`,
      scoreColor: "text-amber-400",
      interpretation: "Coiling against upper Bollinger Band with expanding RSI.",
      icon: SlidersHorizontal,
    },
  ];

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#081225] p-5 shadow-xl flex flex-col justify-between">
      <div>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Award size={18} className="text-cyan-400" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 font-mono">
              Composite Multi-Model Rating Matrix
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400 font-mono">Master Synthesis:</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-black font-mono bg-cyan-950 text-cyan-300 border border-cyan-500/50">
              ELITE · {masterCompositeScore}/100
            </span>
          </div>
        </div>

        {/* Rating Table */}
        <div className="mt-3.5 overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] text-slate-500 uppercase">
                <th className="py-2 px-2">Rating Model</th>
                <th className="py-2 px-2">Grade / Tier</th>
                <th className="py-2 px-2">Score</th>
                <th className="py-2 px-2 hidden sm:table-cell">Institutional Interpretation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {models.map((m, idx) => {
                const Icon = m.icon;
                return (
                  <tr key={idx} className="hover:bg-slate-900/40 transition">
                    <td className="py-2.5 px-2">
                      <div className="flex items-center gap-1.5 font-bold text-white">
                        <Icon size={13} className="text-slate-400" />
                        <span>{m.name}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-2">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold border ${m.badgeColor}`}>
                        {m.badge}
                      </span>
                    </td>
                    <td className={`py-2.5 px-2 font-bold ${m.scoreColor}`}>
                      {m.score}
                    </td>
                    <td className="py-2.5 px-2 text-[11px] text-slate-400 hidden sm:table-cell font-sans">
                      {m.interpretation}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Synthesis Verdict */}
      <div className="mt-3.5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-300 font-sans">
        <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
          <CheckCircle2 size={14} />
          <span>Unified Verdict: 5 of 5 Quantitative Engines in Strong Buy Confluence</span>
        </div>
      </div>
    </div>
  );
}

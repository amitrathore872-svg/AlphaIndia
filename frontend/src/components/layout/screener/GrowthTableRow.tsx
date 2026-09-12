"use client";

// =======================================================
// Alpha India Design System
// Sprint 32.8.1
// Premium Bloomberg Company Row
// =======================================================

import { Building2, ChevronRight } from "lucide-react";

import type { GrowthCompany } from "@/lib/api";

import {
  HealthBadge,
  AIScoreBadge,
  MarketCapBadge,
} from "./GrowthBadges";

import { CompactHeatmap } from "./GrowthHeatmap";

interface GrowthTableRowProps {
  company: GrowthCompany;
  index: number;
  onClick?: (company: GrowthCompany) => void;
}

export default function GrowthTableRow({
  company,
  index,
  onClick,
}: GrowthTableRowProps) {
  return (
    <tr
      onClick={() => onClick?.(company)}
      className="group cursor-pointer border-b border-slate-800 transition-all duration-200 hover:bg-slate-900/70 hover:shadow-lg"
    >
      {/* Row Number */}
      <td className="px-4 py-4 text-sm text-slate-500 font-medium">
        {index + 1}
      </td>

      {/* Company */}
      <td className="px-4 py-4">
        <div className="flex items-center gap-3">

          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <Building2 className="h-5 w-5 text-emerald-400" />
          </div>

          <div className="min-w-0">
            <a
              href={`https://www.screener.in/company/${company.symbol}/`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="truncate font-semibold text-white transition hover:text-emerald-400 hover:underline"
            >
              {company.company}
            </a>
            
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
              <span>{company.symbol}</span>

              <span>•</span>

              <span>{company.exchange}</span>

              <span>•</span>

              <span>{company.series}</span>
            </div>
          </div>

        </div>
      </td>

      {/* Sector */}
      <td className="px-4 py-4">
        <div className="flex flex-col gap-1">

          <span className="inline-flex w-fit rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 text-xs font-medium text-cyan-300">
            {company.sector || "Unknown"}
          </span>

          <span className="truncate text-xs text-slate-500 max-w-[140px]">
            {company.industry || "Industry Unknown"}
          </span>

        </div>
      </td>

      {/* Revenue Growth */}
      <td className="px-4 py-4 text-center">
        <CompactHeatmap value={company.revenue_growth} />
      </td>

      {/* PAT Growth */}
      <td className="px-4 py-4 text-center">
        <CompactHeatmap value={company.pat_growth} />
      </td>

      {/* ROCE */}
      <td className="px-4 py-4 text-center">
        <CompactHeatmap value={company.roce} />
      </td>

      {/* AI Score */}
      <td className="px-4 py-4 text-center">
        <AIScoreBadge score={company.ai_score} />
      </td>

      {/* Health */}
      <td className="px-4 py-4 text-center">
        <HealthBadge status={company.health_status} />
      </td>

      {/* Market Cap */}
      <td className="px-4 py-4">
        <MarketCapBadge value={company.market_cap} />
      </td>

      {/* Arrow */}
      <td className="px-4 py-4 text-right">
        <ChevronRight className="h-5 w-5 text-slate-600 transition group-hover:text-emerald-400 group-hover:translate-x-1" />
      </td>
    </tr>
  );
}
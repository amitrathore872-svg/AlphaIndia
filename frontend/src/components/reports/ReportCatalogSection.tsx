"use client";

import React from "react";
import { ReportCatalogItem } from "@/lib/reportsApi";
import { FileBarChart, CheckCircle2, Clock, Sparkles, ArrowRight } from "lucide-react";

interface ReportCatalogSectionProps {
  catalog: ReportCatalogItem[];
  activeReportId: string;
  onSelectReport: (id: string) => void;
}

export default function ReportCatalogSection({
  catalog,
  activeReportId,
  onSelectReport,
}: ReportCatalogSectionProps) {
  if (!catalog || catalog.length === 0) return null;

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-[#070C16] p-6 shadow-xl">
      <div className="flex flex-col gap-2 border-b border-slate-800/70 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <FileBarChart className="h-5 w-5 text-cyan-400" />
            <h3 className="text-lg font-bold text-white">Institutional Reports Catalog</h3>
          </div>
          <p className="mt-0.5 text-xs text-slate-400">
            Multi-report research radar suite &bull; Quantitative breadth, structural health, and exchange volume indicators
          </p>
        </div>
        <span className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300">
          {catalog.length} Institutional Reports Available / In Pipeline
        </span>
      </div>

      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {catalog.map((report) => {
          const isActive = report.id === activeReportId;
          const isLive = report.status === "LIVE";

          return (
            <div
              key={report.id}
              onClick={() => isLive && onSelectReport(report.id)}
              className={`group relative rounded-xl border p-4 transition-all duration-200 ${
                isActive
                  ? "border-cyan-500/60 bg-gradient-to-br from-cyan-950/30 via-slate-900/60 to-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.15)] ring-1 ring-cyan-500/40"
                  : isLive
                  ? "border-slate-800/80 bg-slate-900/30 hover:border-slate-700 hover:bg-slate-900/50 cursor-pointer"
                  : "border-slate-800/40 bg-slate-950/40 opacity-75 cursor-not-allowed"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    report.badge === "FLAGSHIP"
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      : report.badge === "NEW"
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                      : report.badge === "SECTORS"
                      ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                      : "bg-slate-800 text-slate-400 border border-slate-700"
                  }`}
                >
                  {report.badge}
                </span>

                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                    isLive ? "text-emerald-400" : "text-amber-400/80"
                  }`}
                >
                  {isLive ? (
                    <>
                      <CheckCircle2 className="h-3 w-3" />
                      LIVE
                    </>
                  ) : (
                    <>
                      <Clock className="h-3 w-3" />
                      ROADMAP
                    </>
                  )}
                </span>
              </div>

              <h4 className="mt-2.5 font-bold text-white text-sm group-hover:text-cyan-300 transition">
                {report.title}
              </h4>
              <p className="mt-1 text-xs text-slate-400 line-clamp-2 leading-relaxed">
                {report.description}
              </p>

              {/* Metrics Pills */}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {report.key_metrics.slice(0, 3).map((m) => (
                  <span
                    key={m}
                    className="rounded bg-slate-800/80 px-1.5 py-0.5 text-[10px] text-slate-300"
                  >
                    {m}
                  </span>
                ))}
              </div>

              {/* Footer status */}
              <div className="mt-4 flex items-center justify-between border-t border-slate-800/60 pt-2.5 text-[11px]">
                <span className="text-slate-500">{report.frequency}</span>
                {isLive && (
                  <span
                    className={`font-semibold flex items-center gap-1 ${
                      isActive ? "text-cyan-400" : "text-slate-400 group-hover:text-white"
                    }`}
                  >
                    {isActive ? "Viewing Now" : "Launch Report"}
                    <ArrowRight className="h-3 w-3" />
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

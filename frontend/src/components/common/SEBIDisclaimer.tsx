import React from "react";
import { ShieldAlert, Info } from "lucide-react";

export function SEBIDisclaimer() {
  return (
    <footer className="border-t border-slate-800/80 bg-[#050B14]/90 text-slate-500 py-6 px-4 md:px-8 mt-12 text-xs font-mono">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-slate-300">
              SEBI Statutory Regulatory Disclaimer &amp; Risk Disclosure
            </p>
            <p className="text-slate-400 leading-relaxed max-w-4xl">
              Alpha India is a financial intelligence research operating system and computational scanner for Indian listed equities (NSE &amp; BSE). 
              We are <strong className="text-slate-200 font-semibold">NOT</strong> a SEBI Registered Investment Advisor (RIA) or Research Analyst (RA). 
              All scores, technical indicators, catalysts, PEAD ratings, and quantitative metrics are generated algorithmically for educational, analytical, and informational purposes only.
              Investments in securities markets are subject to market risks. Read all related scheme documents and perform independent due diligence before taking financial positions.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-[11px] text-slate-500 shrink-0 border-l border-slate-800 pl-4">
          <div className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-cyan-400" />
            <span>Platform v2.3.1 PRO</span>
          </div>
          <span>•</span>
          <span>© {new Date().getFullYear()} Alpha India Terminal</span>
        </div>
      </div>
    </footer>
  );
}

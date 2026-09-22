"use client";

import React, { useEffect, useState } from "react";
import { X, Filter, AlertTriangle, ShieldCheck, CheckCircle2, RefreshCw } from "lucide-react";
import { fetchVCPRejections, type VCPRejectionResponse } from "@/lib/vcpApi";

interface VCPFunnelModalProps {
  onClose: () => void;
}

export default function VCPFunnelModal({ onClose }: VCPFunnelModalProps) {
  const [data, setData] = useState<VCPRejectionResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVCPRejections(60)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load rejections:", err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-4xl rounded-2xl bg-white dark:bg-[#050B14] border border-cyan-500/40 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#071322]">
          <div className="flex items-center gap-3">
            <Filter className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            <div>
              <div className="text-base font-bold text-slate-900 dark:text-white">
                8-Gate Rejection Funnel & Institutional Audit Log
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Transparent explainability for every filtered equity on {data?.scan_date || "Today"}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-200 dark:bg-slate-800/80 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-cyan-600 dark:text-cyan-400 gap-2">
              <RefreshCw className="w-5 h-5 animate-spin" />
              <span className="text-sm font-semibold">Loading rejection audit logs...</span>
            </div>
          ) : (
            <>
              {/* Gate Breakdown Stats */}
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                  Rejection Counts by Gate
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {data?.gate_breakdown &&
                    Object.entries(data.gate_breakdown).map(([gate, count]) => (
                      <div
                        key={gate}
                        className="bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 p-3 rounded-xl"
                      >
                        <div className="text-[10px] text-slate-600 dark:text-slate-400 font-semibold truncate">
                          {gate.replace("GATE_", "GATE ")}
                        </div>
                        <div className="text-lg font-bold font-mono text-rose-600 dark:text-rose-400 mt-0.5">
                          {count}{" "}
                          <span className="text-xs text-slate-400 dark:text-slate-500 font-normal">rejected</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Rejection Samples Table */}
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                  Sample Filter Explanations ({data?.rejection_samples?.length || 0} Records)
                </div>
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-950/40 shadow-xs">
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="bg-slate-50 dark:bg-slate-900/90 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase">
                      <tr>
                        <th className="py-2.5 px-4 font-semibold">Symbol</th>
                        <th className="py-2.5 px-4 font-semibold">Gate Failed</th>
                        <th className="py-2.5 px-4 font-semibold">Audit Explanation</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-950/40">
                      {data?.rejection_samples && data.rejection_samples.length > 0 ? (
                        data.rejection_samples.map((r, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                            <td className="py-2.5 px-4 font-bold text-slate-900 dark:text-white">{r.symbol}</td>
                            <td className="py-2.5 px-4">
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">
                                {r.gate_failed}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300 text-[11px] font-sans">
                              {r.reason}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} className="py-6 text-center text-slate-500 font-sans">
                            No rejections logged for this scan date.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import DashboardLayout from "@/components/layout/DashboardLayout";
import AthenaUnifiedCockpit from "@/components/layout/athena/AthenaUnifiedCockpit";
import { Zap, RefreshCw } from "lucide-react";
import { useState } from "react";
import { triggerExchangeScan } from "@/lib/athenaApi";

export default function PeadDriftScreenerPage() {
  const [scanning, setScanning] = useState(false);

  const handleTriggerScan = async () => {
    setScanning(true);
    try {
      await triggerExchangeScan();
      setTimeout(() => {
        setScanning(false);
        window.location.reload();
      }, 1500);
    } catch (err) {
      console.error("Failed to trigger scan:", err);
      setScanning(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* PEAD Drift Screener Header & Telemetry */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800/80 pb-3 sm:pb-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2 sm:p-2.5 rounded-xl bg-gradient-to-tr from-cyan-600/20 to-emerald-500/15 dark:from-cyan-600/30 dark:to-emerald-500/20 border border-cyan-500/40 text-cyan-600 dark:text-cyan-400 shrink-0">
                <Zap className="w-5 h-5 sm:w-6 sm:h-6 animate-pulse text-cyan-600 dark:text-cyan-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white font-mono">
                    PEAD DRIFT SCREENER
                  </h1>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-0.5">
                  Pure Earnings Intelligence. No Market Noise. Exchange-First Filing Capture &amp; Post-Earnings Announcement Drift Radar.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={handleTriggerScan}
              disabled={scanning}
              className="flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white dark:text-slate-950 font-bold text-xs uppercase px-4 py-2.5 rounded-lg transition-all shadow-xs dark:shadow-lg dark:shadow-cyan-950/50 disabled:opacity-50 cursor-pointer w-full sm:w-auto min-h-[40px]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${scanning ? "animate-spin" : ""}`} />
              <span>{scanning ? "Scanning Feeds..." : "Scan NSE & BSE"}</span>
            </button>
          </div>
        </div>

        {/* Master PEAD Screener Terminal */}
        <AthenaUnifiedCockpit />
      </div>
    </DashboardLayout>
  );
}

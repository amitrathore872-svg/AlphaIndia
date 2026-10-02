"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ShieldCheck,
  TableProperties,
  Sparkles,
  Calendar,
  Clock,
  RefreshCw,
  Info,
  X,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { fetchFilingStatus, triggerFilingSync, FilingStatusResponse } from "@/lib/institutionalApi";

interface SubNavProps {
  freshCount?: number;
}

export default function InstitutionalSubNav({ freshCount }: SubNavProps) {
  const pathname = usePathname();
  const [filingInfo, setFilingInfo] = useState<FilingStatusResponse | null>(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchFilingStatus()
      .then((data) => {
        if (mounted) setFilingInfo(data);
      })
      .catch((err) => console.error("Error fetching MF filing status:", err));
    return () => {
      mounted = false;
    };
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setSyncSuccessMsg(null);
    try {
      const res = await triggerFilingSync(false);
      setSyncSuccessMsg(
        `Successfully ingested ${res.period_name || "period"} (${res.holdings_upserted || 0} holdings, ${res.fresh_entries_count || 0} new entries)!`
      );
      // Refresh status
      const updated = await fetchFilingStatus();
      setFilingInfo(updated);
    } catch (e: any) {
      setSyncSuccessMsg(`Sync error: ${e.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const tabs = [
    {
      name: "Smart Money Screener",
      href: "/institutional-radar",
      icon: ShieldCheck,
      badge: "FLOAT RADAR",
      exact: true,
    },
    {
      name: "AMC Scheme Matrix",
      href: "/institutional-radar/matrix",
      icon: TableProperties,
      badge: "FULL UNIVERSE",
      exact: false,
    },
    {
      name: "Mutual Funds New Entries",
      href: "/institutional-radar/fresh-entries",
      icon: Sparkles,
      badge: freshCount ? `${freshCount} NEW` : "NEW INITIATIONS",
      badgeColor: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
      exact: false,
    },
  ];

  const isTabActive = (href: string, exact: boolean) => {
    if (exact) {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  const latestMonth = filingInfo?.database_snapshot?.latest_holding_date
    ? new Date(filingInfo.database_snapshot.latest_holding_date).toLocaleDateString("en-US", {
        month: "short",
        year: "numeric",
      })
    : "Aug 2026";

  const nextDeadline = filingInfo?.filing_lifecycle?.sebi_filing_deadline_ist || "10th of every month";

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/60 p-1.5 backdrop-blur-md shadow-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          {tabs.map((tab) => {
            const active = isTabActive(tab.href, tab.exact);
            const Icon = tab.icon;

            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`group flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
                  active
                    ? "border border-cyan-500/40 bg-cyan-500/15 text-cyan-800 dark:text-cyan-300 shadow-xs"
                    : "border border-transparent text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700/70 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                <Icon
                  size={16}
                  className={active ? "text-cyan-600 dark:text-cyan-400" : "text-slate-500 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200"}
                />
                <span>{tab.name}</span>
                {tab.badge && (
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-black tracking-wider uppercase ${
                      tab.badgeColor ||
                      (active
                        ? "border-cyan-500/40 bg-cyan-500/20 text-cyan-800 dark:text-cyan-300"
                        : "border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-400")
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Regulatory Filing Calendar Pill & Trigger Button */}
        <div className="flex items-center gap-2.5 pr-2">
          <button
            onClick={() => setShowScheduleModal(true)}
            className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 px-3 py-1.5 text-xs transition-colors hover:border-cyan-500/40 hover:bg-slate-100 dark:hover:bg-slate-800/60"
            title="Click to view SEBI / AMFI filing schedule and engine sync details"
          >
            <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-500 dark:text-slate-400">Filed:</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{latestMonth}</span>
            <span className="text-slate-400 dark:text-slate-600">|</span>
            <span className="text-slate-500 dark:text-slate-400 hidden sm:inline">Next Due:</span>
            <span className="font-semibold text-cyan-700 dark:text-cyan-400 hidden sm:inline">10th of Month</span>
            <Info size={13} className="text-slate-400 ml-1" />
          </button>
        </div>
      </div>

      {/* Filing Schedule & Engine Sync Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#070D18] p-6 shadow-2xl">
            <button
              onClick={() => setShowScheduleModal(false)}
              className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30">
                <Calendar size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Mutual Fund Filing Calendar & Engine Radar</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400">SEBI Reg 59A & LODR Reg 31 Statutory Disclosure Radar</p>
              </div>
            </div>

            <div className="mt-5 space-y-3.5">
              {/* Snapshot Card */}
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-900/60 p-3">
                  <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Database Snapshot</span>
                  <div className="mt-1 text-sm font-bold text-slate-900 dark:text-white">
                    {filingInfo?.database_snapshot?.latest_holding_date || "Aug 2026"}
                  </div>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
                    {filingInfo?.database_snapshot?.total_holdings_rows?.toLocaleString() || "32,500+"} records
                  </span>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-900/60 p-3">
                  <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Upcoming Month</span>
                  <div className="mt-1 text-sm font-bold text-cyan-700 dark:text-cyan-400">
                    {filingInfo?.filing_lifecycle?.target_period_name || "Next Month"}
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">Month-End Snapshot</span>
                </div>

                <div className="col-span-2 sm:col-span-1 rounded-xl border border-cyan-500/30 bg-cyan-50 dark:bg-cyan-950/20 p-3">
                  <span className="text-[10px] uppercase font-bold text-cyan-800 dark:text-cyan-300">Mandatory Deadline</span>
                  <div className="mt-1 text-sm font-bold text-cyan-900 dark:text-cyan-200">
                    {nextDeadline}
                  </div>
                  <span className="text-[10px] text-cyan-700 dark:text-cyan-400/80">SEBI 10-Day Rule</span>
                </div>
              </div>

              {/* Regulatory Milestones */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40 p-4 space-y-2.5 text-xs">
                <div className="font-bold text-slate-800 dark:text-slate-300 flex items-center gap-1.5">
                  <Clock size={14} className="text-cyan-600 dark:text-cyan-400" />
                  <span>When Exactly Are Filings Posted?</span>
                </div>

                <div className="space-y-2 text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 size={13} className="text-emerald-500 mt-0.5 shrink-0" />
                    <span>
                      <strong className="text-slate-800 dark:text-slate-200">AMFI Scheme Portfolios (SEBI Reg 59A):</strong> Disclosed by all 16 AMCs{" "}
                      <strong className="text-cyan-700 dark:text-cyan-400">within 10 calendar days</strong> of month-end (by the 10th of every month at 23:59 IST).
                    </span>
                  </div>

                  <div className="flex items-start gap-2">
                    <CheckCircle2 size={13} className="text-emerald-500 mt-0.5 shrink-0" />
                    <span>
                      <strong className="text-slate-800 dark:text-slate-200">Shareholding Patterns (SEBI LODR Reg 31):</strong> Listed companies file institutional ownership breakdown{" "}
                      <strong className="text-cyan-700 dark:text-cyan-400">within 21 calendar days</strong> of each quarter-end (e.g. 21st Oct for Q2).
                    </span>
                  </div>

                  <div className="flex items-start gap-2">
                    <CheckCircle2 size={13} className="text-emerald-500 mt-0.5 shrink-0" />
                    <span>
                      <strong className="text-slate-800 dark:text-slate-200">Substantial Acquisition (SEBI SAST Reg 29):</strong> Disclosed continuously within{" "}
                      <strong className="text-cyan-700 dark:text-cyan-400">2 working days</strong> of any &plusmn;2% change or crossing 5%.
                    </span>
                  </div>
                </div>
              </div>

              {/* Autonomous Scheduler Status */}
              <div className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3.5">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <div>
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Autonomous Radar Scheduler Active</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400">
                      Supervises every 30m; automatically ingests filings once disclosure window triggers.
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/20 px-3 py-1.5 text-xs font-bold text-cyan-300 hover:bg-cyan-500/30 transition-all disabled:opacity-50"
                >
                  <RefreshCw size={13} className={syncing ? "animate-spin" : ""} />
                  <span>{syncing ? "Syncing..." : "Sync Engine Now"}</span>
                </button>
              </div>

              {syncSuccessMsg && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-300">
                  {syncSuccessMsg}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

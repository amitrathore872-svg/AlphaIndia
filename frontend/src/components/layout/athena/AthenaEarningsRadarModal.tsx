"use client";

// =========================================================================
// Alpha India — Athena Earnings Radar & Calendar Modal
// Visualizes upcoming board meetings from the official NSE event calendar,
// tracks live disclosures, and audits surprise filings without prior notices.
// Bloomberg Dark Aesthetic (#050B14) · Zero Synthetic Data
// =========================================================================

import { useState, useEffect, useMemo } from "react";
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  X,
  ExternalLink,
  ChevronRight,
  Filter,
  Sparkles,
} from "lucide-react";
import {
  fetchUpcomingEarnings,
  fetchTodaysEarnings,
  fetchCalendarStats,
  triggerCalendarSync,
  type EarningsCalendarItem,
  type CalendarStatsResponse,
} from "@/lib/earningsCalendarApi";

interface AthenaEarningsRadarModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AthenaEarningsRadarModal({
  isOpen,
  onClose,
}: AthenaEarningsRadarModalProps) {
  const [activeTab, setActiveTab] = useState<"upcoming" | "today" | "surprises">("upcoming");
  const [items, setItems] = useState<EarningsCalendarItem[]>([]);
  const [stats, setStats] = useState<CalendarStatsResponse["stats"] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, upRes, todayRes] = await Promise.all([
        fetchCalendarStats(),
        fetchUpcomingEarnings(30, 250),
        fetchTodaysEarnings(),
      ]);

      if (statsRes?.stats) {
        setStats(statsRes.stats);
      }

      if (activeTab === "today") {
        setItems(todayRes?.results || []);
      } else if (activeTab === "surprises") {
        const surprises = (todayRes?.results || []).filter(
          (r) => r.status === "UNSCHEDULED_SURPRISE"
        );
        setItems(surprises);
      } else {
        setItems(upRes?.results || []);
      }
    } catch (err) {
      console.error("[AthenaEarningsRadar] Load error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, activeTab]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await triggerCalendarSync();
      await loadData();
    } finally {
      setSyncing(false);
    }
  };

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase().trim();
    return items.filter(
      (item) =>
        item.symbol.toLowerCase().includes(q) ||
        (item.company_name && item.company_name.toLowerCase().includes(q)) ||
        (item.details && item.details.toLowerCase().includes(q))
    );
  }, [items, searchQuery]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl max-h-[90vh] flex flex-col rounded-2xl border border-slate-800 bg-[#050B14] shadow-2xl shadow-cyan-950/40 text-slate-100 overflow-hidden">
        
        {/* Header Ribbon */}
        <div className="flex items-center justify-between border-b border-slate-800/80 px-6 py-4 bg-gradient-to-r from-slate-950 via-[#071322] to-slate-950">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-950/80 border border-cyan-500/30 text-cyan-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold font-mono tracking-tight text-white uppercase">
                  ATHENA OMEGA EARNINGS RADAR
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-black font-mono uppercase bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  OFFICIAL NSE CALENDAR
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Reconciling scheduled board meeting intimations against live exchange disclosures.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-950/70 border border-cyan-500/40 hover:bg-cyan-900/50 text-cyan-300 text-xs font-mono font-bold transition-all disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
              <span>{syncing ? "Syncing NSE..." : "Sync Official Feed"}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Telemetry Metrics Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-6 py-3 border-b border-slate-800/60 bg-slate-950/60 font-mono text-xs">
          <div className="flex flex-col">
            <span className="text-[11px] text-slate-400 uppercase">Upcoming (Next 30D)</span>
            <span className="text-sm font-bold text-cyan-300">
              {stats?.upcoming_next_14d ?? items.length} Meetings
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] text-slate-400 uppercase">Due Today</span>
            <span className="text-sm font-bold text-amber-400">
              {stats?.due_today ?? 0} Companies
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] text-slate-400 uppercase">Reconciled / Completed</span>
            <span className="text-sm font-bold text-emerald-400">
              {stats?.completed_reconciled ?? 0} Disclosures
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] text-slate-400 uppercase">Unscheduled Surprises</span>
            <span className="text-sm font-bold text-rose-400">
              {stats?.unscheduled_surprises ?? 0} Filings
            </span>
          </div>
        </div>

        {/* Search & Tabs Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-6 py-3 border-b border-slate-800/60 bg-slate-950/40">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-slate-800 font-mono text-xs">
            <button
              onClick={() => setActiveTab("upcoming")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                activeTab === "upcoming"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Upcoming Schedule ({items.length})
            </button>
            <button
              onClick={() => setActiveTab("today")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                activeTab === "today"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Today's Radar ({stats?.due_today ?? 0})
            </button>
            <button
              onClick={() => setActiveTab("surprises")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                activeTab === "surprises"
                  ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Surprise Disclosures ({stats?.unscheduled_surprises ?? 0})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search symbol, company..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 font-mono focus:outline-none focus:border-cyan-500/80"
            />
          </div>
        </div>

        {/* Content Table Area */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 font-mono text-xs gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-cyan-400" />
              <span>Fetching official exchange calendar intimations...</span>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400 font-mono text-xs">
              <Calendar className="w-10 h-10 text-slate-600 mb-2" />
              <p className="text-sm font-bold text-slate-300">No scheduled meetings found</p>
              <p className="text-slate-500 mt-1 max-w-sm">
                {searchQuery
                  ? `No entries match "${searchQuery}". Try searching another symbol.`
                  : activeTab === "surprises"
                  ? "No unscheduled surprise filings detected today. All filings matched prior calendar notices."
                  : "Sync the official NSE feed to ingest the latest advance notices."}
              </p>
            </div>
          ) : (
            <div className="border border-slate-800/80 rounded-xl overflow-hidden bg-slate-950/40">
              <table className="w-full text-left font-mono text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-900/80 border-b border-slate-800 text-[11px] text-slate-400 uppercase tracking-wider">
                    <th className="py-2.5 px-4 font-bold">Company / Symbol</th>
                    <th className="py-2.5 px-3 font-bold">Meeting Date</th>
                    <th className="py-2.5 px-3 font-bold">Purpose / Period</th>
                    <th className="py-2.5 px-3 font-bold">Status</th>
                    <th className="py-2.5 px-4 font-bold text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40">
                  {filteredItems.map((item) => {
                    const meetingD = new Date(item.meeting_date);
                    const formattedDate = meetingD.toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    });

                    // Days calculation
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const diffDays = Math.ceil((meetingD.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-slate-900/60 transition-colors group"
                      >
                        {/* Company & Symbol */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-cyan-300 text-sm">
                              {item.symbol}
                            </span>
                            <span className="px-1.5 py-0.2 rounded text-[9px] bg-slate-900 border border-slate-800 text-slate-400">
                              {item.exchange}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 truncate max-w-xs mt-0.5">
                            {item.company_name}
                          </div>
                        </td>

                        {/* Meeting Date */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="font-medium text-slate-200">{formattedDate}</div>
                          <div className="text-[10px] text-slate-500">
                            {diffDays === 0
                              ? "Today"
                              : diffDays === 1
                              ? "Tomorrow"
                              : diffDays > 0
                              ? `in ${diffDays} days`
                              : `${Math.abs(diffDays)} days ago`}
                          </div>
                        </td>

                        {/* Purpose & Fiscal Period */}
                        <td className="py-3 px-3">
                          <div className="font-medium text-white">{item.purpose}</div>
                          {item.fiscal_period && (
                            <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded text-[10px] bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 font-bold">
                              {item.fiscal_period}
                            </span>
                          )}
                        </td>

                        {/* Status Badge */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          {item.status === "TODAY" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-amber-500/20 border border-amber-500/50 text-amber-300">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                              MEETING TODAY
                            </span>
                          ) : item.status === "COMPLETED" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-emerald-500/20 border border-emerald-500/40 text-emerald-300">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              RECONCILED
                            </span>
                          ) : item.status === "UNSCHEDULED_SURPRISE" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-rose-500/20 border border-rose-500/40 text-rose-300">
                              <AlertTriangle className="w-3 h-3 text-rose-400" />
                              SURPRISE FILING
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 border border-slate-700/60 text-cyan-400">
                              <Clock className="w-3 h-3 text-cyan-400" />
                              SCHEDULED
                            </span>
                          )}
                        </td>

                        {/* Details snippet */}
                        <td className="py-3 px-4 text-right">
                          <div className="text-[11px] text-slate-400 max-w-xs ml-auto truncate" title={item.details || ""}>
                            {item.details || "Board meeting for quarterly financial results approval."}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-800/80 px-6 py-3 bg-slate-950 font-mono text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Source:</span>
            <span className="text-slate-300">NSE Official Event Calendar API (Equities)</span>
          </div>
          <div>
            Showing <span className="text-white font-bold">{filteredItems.length}</span> entries
          </div>
        </div>

      </div>
    </div>
  );
}

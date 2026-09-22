"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/layout/DashboardLayout";
import VCPChartModal from "@/components/vcp/VCPChartModal";
import {
  fetchVCPTrackRecord,
  type VCPSignalRecord,
  type VCPTrackRecordResponse,
  type VCPStockPick,
} from "@/lib/vcpApi";
import {
  Target,
  ShieldCheck,
  TrendingUp,
  Activity,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  Flame,
  Award,
  Calendar,
  Layers,
  Eye,
} from "lucide-react";

type FilterTab = "ALL" | "ACTIVE" | "TARGET_MET" | "STOP_HIT" | "CLOSED";

export default function VCPSignalsPage() {
  const [data, setData] = useState<VCPTrackRecordResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState<FilterTab>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStockForChart, setSelectedStockForChart] = useState<VCPStockPick | null>(null);

  useEffect(() => {
    loadSignals();
  }, [currentTab, searchQuery]);

  const loadSignals = async () => {
    setLoading(true);
    try {
      let tradeState = "ALL";
      let statusFilter = "ALL";

      if (currentTab === "ACTIVE") {
        tradeState = "ACTIVE";
      } else if (currentTab === "CLOSED") {
        tradeState = "CLOSED";
      } else if (currentTab === "TARGET_MET") {
        statusFilter = "TARGET_MET";
      } else if (currentTab === "STOP_HIT") {
        statusFilter = "STOP_HIT";
      }

      const res = await fetchVCPTrackRecord(tradeState, statusFilter, searchQuery || undefined);
      setData(res);
    } catch (err) {
      console.error("Failed to load VCP track record:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChart = (sig: VCPSignalRecord) => {
    // Map VCPSignalRecord to VCPStockPick structure for VCPChartModal
    const mockPick: VCPStockPick = {
      symbol: sig.symbol,
      company_name: sig.company_name,
      sector: sig.sector,
      market_cap: 15000,
      cmp: sig.cmp,
      pivot_price: sig.entry_price,
      entry_zone: `₹${(sig.entry_price * 0.998).toFixed(1)}–${(sig.entry_price * 1.015).toFixed(1)}`,
      stop_loss: sig.stop_loss,
      risk_pct: sig.risk_pct,
      target_1: sig.target_1,
      target_2: sig.target_2,
      target_3: sig.target_3,
      reward_risk: sig.reward_risk,
      vcp_stage: sig.vcp_stage,
      contraction_sizes: [16.4, 9.2, 4.1],
      volume_breakout_ratio: 2.8,
      volume_dryup_pct: 72,
      trend_score: 92,
      vcp_score: 94,
      volume_score: 90,
      breakout_score: 93,
      institutional_score: 95,
      growth_score: 91,
      catalyst_score: 94,
      final_ai_score: sig.final_ai_score,
      verdict: sig.verdict,
      confidence: 96,
      time_horizon: "2–8 Weeks",
      why_selected: [
        `${sig.vcp_stage} completed.`,
        `Current return: ${sig.return_pct > 0 ? "+" : ""}${sig.return_pct}%.`,
        `Trade status: ${sig.status}.`,
      ],
      is_elite: sig.is_elite,
    };
    setSelectedStockForChart(mockPick);
  };

  const kpi = data?.kpi;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800/80 pb-6">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
                <Award className="w-5 h-5" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white font-mono">
                VCP TOP PICKS & TRADE STATUS
              </h1>
              <span className="px-3 py-1 rounded-full text-xs font-bold font-mono tracking-wider bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                LIFECYCLE TRACK RECORD • REAL-TIME CMP
              </span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-3xl">
              Chronological ledger of all recommended institutional VCP breakouts with exact recommendation timestamp,
              real-time status (Target Met vs Stop Loss Hit), current return %, and holding duration.
            </p>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-3">
            <Link
              href="/vcp-discovery"
              className="px-4 py-2 rounded-xl text-xs font-bold font-mono tracking-wide bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-cyan-700 dark:text-cyan-300 border border-slate-300 dark:border-slate-700 hover:border-cyan-500/40 transition-all flex items-center gap-2"
            >
              <Target className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              Open Live Discovery Radar
            </Link>

            <button
              onClick={loadSignals}
              className="px-3.5 py-2 rounded-xl text-xs font-bold font-mono bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-all flex items-center gap-1.5 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Portfolio KPI Ribbon */}
        {kpi && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 font-mono text-xs">
            <div className="bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/80 p-3.5 rounded-xl shadow-xs">
              <span className="text-slate-500 dark:text-slate-400 text-[10px] block uppercase font-bold">Total Picks</span>
              <span className="text-2xl font-black text-slate-900 dark:text-white mt-1 block">
                {kpi.total_signals}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">All-time institutional setups</span>
            </div>

            <div className="bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/80 p-3.5 rounded-xl shadow-xs">
              <span className="text-slate-500 dark:text-slate-400 text-[10px] block uppercase font-bold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Active Trades
              </span>
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block">
                {kpi.active_trades}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">Currently running</span>
            </div>

            <div className="bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/80 p-3.5 rounded-xl shadow-xs">
              <span className="text-slate-500 dark:text-slate-400 text-[10px] block uppercase font-bold">Closed Trades</span>
              <span className="text-2xl font-black text-slate-700 dark:text-slate-300 mt-1 block">
                {kpi.closed_trades}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">Profit taken / stopped</span>
            </div>

            <div className="bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/80 p-3.5 rounded-xl shadow-xs">
              <span className="text-slate-500 dark:text-slate-400 text-[10px] block uppercase font-bold">Win Rate</span>
              <span className="text-2xl font-black text-cyan-600 dark:text-cyan-400 mt-1 block">
                {kpi.win_rate_pct}%
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">Resolved trade accuracy</span>
            </div>

            <div className="bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/80 p-3.5 rounded-xl shadow-xs">
              <span className="text-slate-500 dark:text-slate-400 text-[10px] block uppercase font-bold">Targets Met</span>
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block">
                {kpi.targets_met}
              </span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400/80">T1, T2 or T3 achieved</span>
            </div>

            <div className="bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/80 p-3.5 rounded-xl shadow-xs">
              <span className="text-slate-500 dark:text-slate-400 text-[10px] block uppercase font-bold">Stop Losses Hit</span>
              <span className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1 block">
                {kpi.stop_losses_hit}
              </span>
              <span className="text-[10px] text-rose-600 dark:text-rose-400/80">Protected at guardrail</span>
            </div>

            <div className="bg-white dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/80 p-3.5 rounded-xl shadow-xs">
              <span className="text-slate-500 dark:text-slate-400 text-[10px] block uppercase font-bold">Avg Win Gain</span>
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block">
                +{kpi.average_gain_pct}%
              </span>
              <span className="text-[10px] text-rose-600 dark:text-rose-400">Avg Loss: {kpi.average_loss_pct}%</span>
            </div>
          </div>
        )}

        {/* Filters & Search Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-[#040A14] border border-slate-200 dark:border-slate-800/80 p-3 rounded-xl shadow-xs">
          {/* Filter Tabs */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setCurrentTab("ALL")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold font-mono tracking-wide transition-all ${
                currentTab === "ALL"
                  ? "bg-cyan-500 text-slate-950 shadow-[0_0_10px_rgba(6,182,212,0.3)]"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900/60"
              }`}
            >
              All Signals ({data?.kpi?.total_signals || 0})
            </button>

            <button
              onClick={() => setCurrentTab("ACTIVE")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold font-mono tracking-wide transition-all flex items-center gap-1.5 ${
                currentTab === "ACTIVE"
                  ? "bg-emerald-500 text-slate-950 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900/60"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Active Trades ({data?.kpi?.active_trades || 0})
            </button>

            <button
              onClick={() => setCurrentTab("TARGET_MET")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold font-mono tracking-wide transition-all ${
                currentTab === "TARGET_MET"
                  ? "bg-cyan-500 text-slate-950 shadow-[0_0_10px_rgba(6,182,212,0.3)]"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900/60"
              }`}
            >
              Targets Met ({data?.kpi?.targets_met || 0})
            </button>

            <button
              onClick={() => setCurrentTab("STOP_HIT")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold font-mono tracking-wide transition-all ${
                currentTab === "STOP_HIT"
                  ? "bg-rose-500 text-white shadow-[0_0_10px_rgba(239,68,68,0.3)]"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900/60"
              }`}
            >
              Stop Loss Hit ({data?.kpi?.stop_losses_hit || 0})
            </button>

            <button
              onClick={() => setCurrentTab("CLOSED")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold font-mono tracking-wide transition-all ${
                currentTab === "CLOSED"
                  ? "bg-slate-700 text-white"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900/60"
              }`}
            >
              Closed Trades ({data?.kpi?.closed_trades || 0})
            </button>
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ticker, company, sector..."
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>
        </div>

        {/* Signals Ledger Table */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden bg-white dark:bg-slate-950/70 shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-50 dark:bg-slate-900/90 text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">Stock / Company</th>
                  <th className="py-3.5 px-4 font-semibold">Recommended Timestamp</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Entry / Pivot</th>
                  <th className="py-3.5 px-4 font-semibold text-right">CMP (Live)</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Gain / Return</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Stop Loss</th>
                  <th className="py-3.5 px-4 font-semibold">Targets (T1 / T2 / T3)</th>
                  <th className="py-3.5 px-4 font-semibold text-center">Current Status</th>
                  <th className="py-3.5 px-4 font-semibold text-center">Trade State</th>
                  <th className="py-3.5 px-4 font-semibold text-center">Holding</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-slate-950/40">
                {loading ? (
                  <tr>
                    <td colSpan={11} className="py-16 text-center text-cyan-600 dark:text-cyan-400">
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        <span className="text-sm font-semibold">Calculating real-time trade performance...</span>
                      </div>
                    </td>
                  </tr>
                ) : data?.items && data.items.length > 0 ? (
                  data.items.map((sig, idx) => {
                    const isPositive = sig.return_pct > 0;
                    const isTargetMet = sig.status.includes("TARGET");
                    const isStopHit = sig.status === "STOP_LOSS_HIT";
                    const isActive = sig.trade_state === "ACTIVE";

                    return (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                        {/* Stock & Company */}
                        <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-black tracking-tight">{sig.symbol}</span>
                            {sig.is_elite && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30">
                                ELITE
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-sans truncate max-w-[150px]">
                            {sig.company_name}
                          </div>
                          <div className="text-[9px] text-slate-400 dark:text-slate-500 font-mono">
                            {sig.sector}
                          </div>
                        </td>

                        {/* Recommendation Date & Exact Timestamp */}
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                          <div className="flex items-center gap-1.5 text-xs text-slate-900 dark:text-white font-semibold">
                            <Calendar className="w-3 h-3 text-cyan-600 dark:text-cyan-400" />
                            {sig.recommended_at}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                            {sig.vcp_stage} • Score {sig.final_ai_score}
                          </div>
                        </td>

                        {/* Entry / Pivot Price */}
                        <td className="py-3.5 px-4 text-right font-bold text-slate-700 dark:text-slate-200">
                          ₹{sig.entry_price.toFixed(2)}
                        </td>

                        {/* Current Market Price (CMP) */}
                        <td className="py-3.5 px-4 text-right font-bold text-slate-900 dark:text-white">
                          ₹{sig.cmp.toFixed(2)}
                        </td>

                        {/* Return % */}
                        <td className="py-3.5 px-4 text-right">
                          <span
                            className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-bold font-mono ${
                              isPositive
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30"
                                : sig.return_pct < 0
                                ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/30"
                                : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                            }`}
                          >
                            {isPositive ? (
                              <ArrowUpRight className="w-3 h-3" />
                            ) : sig.return_pct < 0 ? (
                              <ArrowDownRight className="w-3 h-3" />
                            ) : null}
                            {isPositive ? "+" : ""}
                            {sig.return_pct.toFixed(2)}%
                          </span>
                        </td>

                        {/* Stop Loss */}
                        <td className="py-3.5 px-4 text-right text-rose-600 dark:text-rose-400 font-semibold">
                          ₹{sig.stop_loss.toFixed(2)}
                          <span className="text-[10px] text-slate-500 dark:text-slate-500 block">
                            (-{sig.risk_pct.toFixed(1)}%)
                          </span>
                        </td>

                        {/* Targets T1, T2, T3 */}
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                sig.cmp >= sig.target_1
                                  ? "bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/40 line-through"
                                  : "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800"
                              }`}
                            >
                              T1: ₹{sig.target_1.toFixed(0)}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                sig.cmp >= sig.target_2
                                  ? "bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/40 line-through"
                                  : "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800"
                              }`}
                            >
                              T2: ₹{sig.target_2.toFixed(0)}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                sig.cmp >= sig.target_3
                                  ? "bg-cyan-500/20 text-cyan-800 dark:text-cyan-300 border border-cyan-500/40 line-through"
                                  : "bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800"
                              }`}
                            >
                              T3: ₹{sig.target_3.toFixed(0)}
                            </span>
                          </div>
                        </td>

                        {/* Current Status Badge */}
                        <td className="py-3.5 px-4 text-center">
                          {isTargetMet ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 inline-flex items-center gap-1 shadow-xs">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                              {sig.status.replace(/_/g, " ")}
                            </span>
                          ) : isStopHit ? (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/40 inline-flex items-center gap-1 shadow-xs">
                              <AlertTriangle className="w-3 h-3 text-rose-600 dark:text-rose-400" />
                              STOP LOSS HIT
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/40 inline-flex items-center gap-1 shadow-xs">
                              <Activity className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                              ACTIVE RUNNING
                            </span>
                          )}
                        </td>

                        {/* Trade State (ACTIVE vs CLOSED) */}
                        <td className="py-3.5 px-4 text-center">
                          {isActive ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 inline-flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                              ACTIVE
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 inline-block">
                              CLOSED
                            </span>
                          )}
                        </td>

                        {/* Holding Duration */}
                        <td className="py-3.5 px-4 text-center text-slate-600 dark:text-slate-400 font-semibold">
                          {sig.days_held}d
                        </td>

                        {/* Action: View Chart */}
                        <td className="py-3.5 px-4 text-right">
                          <button
                            onClick={() => handleOpenChart(sig)}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
                            title="Inspect Lightweight Chart"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-slate-500 dark:text-slate-400 font-sans">
                      No signals found matching your current filter criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Interactive Chart Modal */}
      {selectedStockForChart && (
        <VCPChartModal
          stock={selectedStockForChart}
          onClose={() => setSelectedStockForChart(null)}
        />
      )}
    </DashboardLayout>
  );
}

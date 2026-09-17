"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  ShieldCheck,
  TrendingUp,
  RefreshCw,
  Search,
  Sparkles,
  PieChart,
  Award,
  Filter,
  ArrowUpRight,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Star,
  Target,
  Flame,
  ArrowUpDown,
  TableProperties,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import StockInstitutionalModal from "@/components/institutional/StockInstitutionalModal";
import SectorRotationCard from "@/components/institutional/SectorRotationCard";
import InstitutionalSubNav from "@/components/institutional/InstitutionalSubNav";
import {
  MacroTelemetry,
  ScreenerItem,
  SectorFlowItem,
  StarFundManager,
  CapCounts,
  fetchMacroTelemetry,
  fetchInstitutionalRadar,
  fetchSectorRotation,
  fetchStarFundManagers,
} from "@/lib/institutionalApi";

export default function InstitutionalRadarPage() {
  const [telemetry, setTelemetry] = useState<MacroTelemetry | null>(null);
  const [items, setItems] = useState<ScreenerItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Filters
  const [capCategory, setCapCategory] = useState<string>("ALL");
  const [capCounts, setCapCounts] = useState<CapCounts>({
    ALL: 0,
    LARGE: 0,
    MID: 0,
    SMALL: 0,
    MICRO: 0,
  });
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedFilter, setSelectedFilter] = useState<string>("ALL");
  const [selectedSector, setSelectedSector] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<string>("smart_money_score");
  const [sortOrder, setSortOrder] = useState<string>("desc");

  // Macro Tab (Sector Rotation & Star Managers)
  const [showMacro, setShowMacro] = useState<boolean>(false);
  const [sectorFlows, setSectorFlows] = useState<SectorFlowItem[]>([]);
  const [fundManagers, setFundManagers] = useState<StarFundManager[]>([]);

  // Modal State
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, radarRes, sectorRes, mgrRes] = await Promise.all([
        fetchMacroTelemetry(),
        fetchInstitutionalRadar({
          page,
          limit: 20,
          search: searchTerm || undefined,
          sector: selectedSector !== "ALL" ? selectedSector : undefined,
          market_cap_category: capCategory !== "ALL" ? capCategory : undefined,
          filter_type: selectedFilter !== "ALL" ? selectedFilter : undefined,
          sort_by: sortBy,
          sort_order: sortOrder,
        }),
        fetchSectorRotation(),
        fetchStarFundManagers(),
      ]);

      setTelemetry(statsRes);
      setItems(radarRes.items);
      setTotalPages(radarRes.pages);
      setTotalCount(radarRes.total);
      if (radarRes.cap_counts) {
        setCapCounts(radarRes.cap_counts);
      }
      setSectorFlows(sectorRes);
      setFundManagers(mgrRes);
    } catch (err) {
      console.error("Error loading institutional data:", err);
    } finally {
      setLoading(false);
    }
  }, [page, searchTerm, selectedFilter, selectedSector, capCategory, sortBy, sortOrder]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "desc" ? "asc" : "desc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
  };

  return (
    <DashboardLayout>
      <div className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8">
        {/* TOP INSTITUTIONAL NAVIGATION SUB-NAV */}
        <InstitutionalSubNav />

        {/* HEADER TITLE & ACTION BAR */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 shadow-lg shadow-cyan-950/30">
              <ShieldCheck size={26} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                  Mutual Fund Intelligence Engine
                </h1>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-400">
                  SMART MONEY RADAR
                </span>
                <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-xs font-bold text-cyan-400">
                  {totalCount} EQUITIES
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Institutional Float Absorption &bull; Monthly AMFI Portfolio Filings &bull; Active Alpha Conviction
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowMacro(!showMacro)}
              className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition shadow-sm ${
                showMacro
                  ? "border-cyan-500 bg-cyan-500/20 text-cyan-300"
                  : "border-slate-700 bg-slate-800/80 text-slate-300 hover:border-slate-600 hover:text-white"
              }`}
            >
              <PieChart size={15} />
              {showMacro ? "Hide Sector & Manager Heatmap" : "View Sector Rotation & Star Managers"}
            </button>

            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs font-bold text-slate-300 hover:border-slate-600 hover:text-white transition disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? "animate-spin text-cyan-400" : ""} />
              Refresh
            </button>
          </div>
        </div>

        {/* MACRO TELEMETRY CARDS */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-slate-800 bg-[#080E1A]/90 p-5 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">
                Institutional Smart Money Avg
              </span>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <Target size={15} />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-3">
              <span className="text-3xl font-black text-white">
                {telemetry?.smart_money_avg ?? "72.4"}
              </span>
              <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-[11px] font-bold text-emerald-400">
                STRONG INTAKE
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Benchmark institutional accumulation index
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#080E1A]/90 p-5 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">
                Net Mutual Fund Inflows
              </span>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <TrendingUp size={15} />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-3">
              <span className="text-3xl font-black text-emerald-400">
                +₹{telemetry?.total_inflows_cr.toLocaleString("en-IN") ?? "4,820"} Cr
              </span>
              <span className="text-xs font-semibold text-emerald-400">MoM Net</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Monthly AMFI Filings Reporting
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#080E1A]/90 p-5 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">
                Active Alpha Schemes Flow
              </span>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <Award size={15} />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-3">
              <span className="text-3xl font-black text-cyan-300">
                ₹{telemetry?.active_schemes_inflow_cr.toLocaleString("en-IN") ?? "3,952"} Cr
              </span>
              <span className="text-xs font-medium text-slate-400">Pure Alpha</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Excluding Passive Beta / Index ETFs
            </p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#080E1A]/90 p-5 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">
                Stealth Base Accumulation Alerts
              </span>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Flame size={15} />
              </span>
            </div>
            <div className="mt-3 flex items-baseline gap-3">
              <span className="text-3xl font-black text-amber-400">
                {telemetry?.stealth_alerts_count ?? 8}
              </span>
              <span className="rounded-md bg-amber-500/20 px-2 py-0.5 text-[11px] font-bold text-amber-300">
                ACTIONABLE
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              High Delivery + Float Consolidation
            </p>
          </div>
        </div>

        {/* EXPANDABLE SECTOR ROTATION & FUND MANAGER RADAR */}
        {showMacro && (
          <div className="animate-in fade-in slide-in-from-top-4 duration-300">
            <SectorRotationCard
              sectorFlows={sectorFlows}
              fundManagers={fundManagers}
              onSelectStock={(sym) => setSelectedSymbol(sym)}
            />
          </div>
        )}

        {/* MARKET CAP CATEGORY FILTER RIBBON */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: "ALL", label: "All Caps", count: capCounts.ALL, color: "text-slate-200" },
            { id: "LARGE", label: "Large Cap", count: capCounts.LARGE, color: "text-cyan-400", desc: "> ₹20,000 Cr" },
            { id: "MID", label: "Mid Cap", count: capCounts.MID, color: "text-emerald-400", desc: "₹5,000 - ₹20,000 Cr" },
            { id: "SMALL", label: "Small Cap", count: capCounts.SMALL, color: "text-amber-400", desc: "₹1,000 - ₹5,000 Cr" },
            { id: "MICRO", label: "Micro Cap", count: capCounts.MICRO, color: "text-slate-400", desc: "< ₹1,000 Cr" },
          ].map((cat) => {
            const active = capCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  setCapCategory(cat.id);
                  setPage(1);
                }}
                className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition-all shadow-sm ${
                  active
                    ? "border-cyan-500 bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/40"
                    : "border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:bg-slate-800/60 hover:text-slate-200"
                }`}
              >
                <span className={active ? "text-cyan-300 font-extrabold" : cat.color}>
                  {cat.label}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                    active ? "bg-cyan-500 text-slate-950" : "bg-slate-800 text-slate-400"
                  }`}
                >
                  {cat.count}
                </span>
                {cat.desc && (
                  <span className="hidden text-[10px] text-slate-400 font-normal lg:inline">
                    ({cat.desc})
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* SEARCH & FILTERS CONTROLS */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-[#080E1A]/90 p-4 shadow-lg">
          {/* SEARCH INPUT */}
          <div className="flex w-full max-w-sm items-center gap-2.5 rounded-xl border border-slate-700 bg-slate-900/80 px-3.5 py-2">
            <Search size={16} className="text-slate-400" />
            <input
              type="text"
              placeholder="Search ticker, company name..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full bg-transparent text-xs text-white placeholder:text-slate-500 outline-none"
            />
          </div>

          {/* FILTER PILLS */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
            {[
              { id: "ALL", label: "All Setups" },
              { id: "stealth", label: "Stealth Accumulation" },
              { id: "consensus", label: "Consensus Bets" },
              { id: "aggressive_add", label: "Float Absorbed > 2%" },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  setSelectedFilter(f.id);
                  setPage(1);
                }}
                className={`rounded-xl px-3 py-1.5 transition ${
                  selectedFilter === f.id
                    ? "border border-cyan-500/50 bg-cyan-500/20 text-cyan-300"
                    : "border border-slate-800 bg-slate-900/80 text-slate-400 hover:text-white"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* SECTOR SELECT */}
          <div className="flex items-center gap-2 text-xs">
            <Filter size={14} className="text-slate-400" />
            <select
              value={selectedSector}
              onChange={(e) => {
                setSelectedSector(e.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-200 outline-none"
            >
              <option value="ALL">All Sectors</option>
              <option value="Electronics EMS">Electronics EMS</option>
              <option value="Capital Goods">Capital Goods</option>
              <option value="Renewable Power">Renewable Power</option>
              <option value="Private Banks">Private Banks</option>
              <option value="Retail">Retail & Consumer</option>
              <option value="Defence">Defence & Rail</option>
              <option value="Cables">Cables & Infra</option>
            </select>
          </div>
        </div>

        {/* PRIMARY INSTITUTIONAL SCREENER TABLE */}
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#080E1A]/90 shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-400">
                  <th className="py-3.5 px-4 text-center">Cap Tier</th>
                  <th className="py-3.5 pl-4 pr-4 font-semibold">Ticker & Company Name</th>
                  <th
                    onClick={() => handleSort("smart_money_score")}
                    className="cursor-pointer py-3.5 px-4 font-semibold hover:text-white transition"
                  >
                    <div className="flex items-center gap-1.5">
                      Smart Money Score (0-100)
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("active_alpha_schemes_holding")}
                    className="cursor-pointer py-3.5 px-4 font-semibold hover:text-white transition"
                  >
                    <div className="flex items-center gap-1.5">
                      Active Alpha Funds
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("net_value_flow_mom_cr")}
                    className="cursor-pointer py-3.5 px-4 font-semibold hover:text-white transition text-right"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      Net MoM Flow (₹ Cr)
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("float_absorption_pct")}
                    className="cursor-pointer py-3.5 px-4 font-semibold hover:text-white transition text-right"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      Free Float Absorbed %
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th className="py-3.5 px-4 font-semibold text-center">Star Conviction</th>
                  <th className="py-3.5 pr-6 pl-4 font-semibold text-right">Action Buy Zone</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="h-7 w-7 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
                        <span>Loading Institutional Radar...</span>
                      </div>
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-16 text-center text-slate-400">
                      No institutional records found matching criteria.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const catBadge =
                      item.market_cap_category === "LARGE"
                        ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-400"
                        : item.market_cap_category === "MID"
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                        : item.market_cap_category === "SMALL"
                        ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                        : "border-slate-600 bg-slate-800 text-slate-400";

                    return (
                      <tr
                        key={item.company_id}
                        onClick={() => setSelectedSymbol(item.symbol)}
                        className="cursor-pointer hover:bg-slate-800/40 transition group"
                      >
                        {/* CAP TIER BADGE */}
                        <td className="py-3.5 px-4 text-center">
                          <span
                            className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-black tracking-wider uppercase ${catBadge}`}
                          >
                            {item.market_cap_category || "MICRO"}
                          </span>
                        </td>

                        {/* TICKER & COMPANY */}
                        <td className="py-3.5 pl-4 pr-4">
                          <div className="flex items-center gap-2.5">
                            <span className="font-bold text-white text-sm font-mono group-hover:text-cyan-400 transition">
                              {item.symbol}
                            </span>
                            {item.is_stealth_accumulation && (
                              <span className="rounded bg-cyan-500/20 px-1.5 py-0.5 text-[10px] font-bold text-cyan-300 flex items-center gap-0.5 border border-cyan-500/30">
                                <Sparkles size={10} /> STEALTH
                              </span>
                            )}
                            {item.is_consensus_bet && (
                              <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300 flex items-center gap-0.5 border border-emerald-500/30">
                                CONSENSUS
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                            <span className="truncate max-w-[220px]">{item.company_name}</span>
                            &bull;
                            <span className="text-slate-500">{item.sector}</span>
                          </div>
                        </td>

                        {/* SMART MONEY SCORE GAUGE */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700 bg-slate-900/90 font-mono font-black text-sm text-cyan-400 shadow-inner">
                              {item.smart_money_score}
                            </div>
                            <div className="w-20">
                              <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                                <div
                                  style={{ width: `${item.smart_money_score}%` }}
                                  className={`h-full rounded-full ${
                                    item.smart_money_score >= 80
                                      ? "bg-gradient-to-r from-cyan-400 to-emerald-400"
                                      : item.smart_money_score >= 65
                                      ? "bg-cyan-400"
                                      : "bg-amber-400"
                                  }`}
                                />
                              </div>
                              <span className="text-[9px] text-slate-500 mt-0.5 block">
                                {item.smart_money_score >= 80 ? "Heavy Accumulation" : "Steady Intake"}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* ACTIVE ALPHA FUNDS */}
                        <td className="py-3.5 px-4 font-mono">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-white text-sm">
                              {item.active_alpha_schemes}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              / {item.total_schemes} Total
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500">
                            ₹{item.total_value_cr.toLocaleString("en-IN")} Cr AUM
                          </div>
                        </td>

                        {/* NET MOM FLOW */}
                        <td className="py-3.5 px-4 text-right font-mono">
                          <span
                            className={`font-bold ${
                              item.net_value_flow_mom_cr > 0
                                ? "text-emerald-400"
                                : item.net_value_flow_mom_cr < 0
                                ? "text-red-400"
                                : "text-slate-400"
                            }`}
                          >
                            {item.net_value_flow_mom_cr > 0 ? "+" : ""}
                            ₹{item.net_value_flow_mom_cr.toLocaleString("en-IN")} Cr
                          </span>
                          <div className="text-[10px] text-slate-500">
                            {item.net_shares_flow_mom > 0 ? "+" : ""}
                            {(item.net_shares_flow_mom / 100000).toFixed(1)}L shares
                          </div>
                        </td>

                        {/* FLOAT ABSORPTION */}
                        <td className="py-3.5 px-4 text-right font-mono">
                          <div className="flex items-center justify-end gap-1 font-bold text-cyan-300">
                            <span>{item.float_absorption_pct}%</span>
                            {item.float_absorption_pct >= 2.0 && (
                              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping" />
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {item.pct_of_equity}% Equity
                          </div>
                        </td>

                        {/* STAR MANAGERS */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {Array.from({ length: item.star_manager_count }).map((_, i) => (
                              <Star key={i} size={12} className="fill-amber-400 text-amber-400" />
                            ))}
                            {item.star_manager_count === 0 && (
                              <span className="text-slate-600 text-xs">—</span>
                            )}
                          </div>
                        </td>

                        {/* ACTION BUY ZONE */}
                        <td className="py-3.5 pr-6 pl-4 text-right">
                          <span
                            className={`inline-block rounded-lg px-2.5 py-1 text-[11px] font-black tracking-wider uppercase border ${
                              item.action_recommendation === "STRONG BUY"
                                ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-300"
                                : item.action_recommendation === "ACCUMULATE"
                                ? "border-cyan-500/40 bg-cyan-500/20 text-cyan-300"
                                : "border-slate-700 bg-slate-800 text-slate-400"
                            }`}
                          >
                            {item.action_recommendation}
                          </span>
                          <div className="text-[10px] text-slate-400 mt-1 font-mono">
                            Target: ₹{item.target_price.toLocaleString("en-IN")}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* PAGINATION BAR */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-800 px-6 py-4 text-xs text-slate-400">
            <div>
              Showing <strong className="text-white">{(page - 1) * 20 + 1}</strong> to{" "}
              <strong className="text-white">{Math.min(page * 20, totalCount)}</strong> of{" "}
              <strong className="text-cyan-400">{totalCount}</strong> institutional records
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 font-bold text-slate-300 hover:border-slate-700 hover:bg-slate-800 hover:text-white transition disabled:opacity-40"
              >
                <ChevronLeft size={14} />
                Previous
              </button>

              <span className="px-2 font-mono font-bold text-white">
                Page {page} of {totalPages}
              </span>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                className="flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 font-bold text-slate-300 hover:border-slate-700 hover:bg-slate-800 hover:text-white transition disabled:opacity-40"
              >
                Next
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* 5-QUESTION STOCK INSTITUTIONAL INTELLIGENCE MODAL */}
        {selectedSymbol && (
          <StockInstitutionalModal
            symbol={selectedSymbol}
            onClose={() => setSelectedSymbol(null)}
          />
        )}
      </div>
    </DashboardLayout>
  );
}

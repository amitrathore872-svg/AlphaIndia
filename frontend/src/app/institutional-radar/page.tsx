"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
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
  ExternalLink,
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
import { SparklineChart } from "@/components/common";
import StockInstitutionalModal from "@/components/institutional/StockInstitutionalModal";
import SectorRotationCard from "@/components/institutional/SectorRotationCard";
import InstitutionalSubNav from "@/components/institutional/InstitutionalSubNav";
import AddToWatchlistButton from "@/components/watchlist/AddToWatchlistButton";
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
      <div className="flex-1 space-y-4">
        {/* TOP INSTITUTIONAL NAVIGATION SUB-NAV */}
        <InstitutionalSubNav />

        {/* HEADER TITLE & ACTION BAR */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800/80 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 shadow-sm shadow-cyan-950/20">
              <ShieldCheck size={26} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                  Mutual Fund Intelligence Engine
                </h1>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                  SMART MONEY RADAR
                </span>
                <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-xs font-bold text-cyan-700 dark:text-cyan-400">
                  {totalCount} EQUITIES
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                Institutional Float Absorption &bull; Monthly AMFI Portfolio Filings &bull; Active Alpha Conviction
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowMacro(!showMacro)}
              className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition shadow-xs ${
                showMacro
                  ? "border-cyan-500 bg-cyan-500/15 text-cyan-700 dark:text-cyan-300"
                  : "border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <PieChart size={15} />
              {showMacro ? "Hide Sector & Manager Heatmap" : "View Sector Rotation & Star Managers"}
            </button>

            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800/80 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? "animate-spin text-cyan-600 dark:text-cyan-400" : ""} />
              Refresh
            </button>
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
            { id: "ALL", label: "All Caps", count: capCounts.ALL, color: "text-slate-800 dark:text-slate-200" },
            { id: "LARGE", label: "Large Cap", count: capCounts.LARGE, color: "text-cyan-700 dark:text-cyan-400", desc: "> ₹20,000 Cr" },
            { id: "MID", label: "Mid Cap", count: capCounts.MID, color: "text-emerald-700 dark:text-emerald-400", desc: "₹5,000 - ₹20,000 Cr" },
            { id: "SMALL", label: "Small Cap", count: capCounts.SMALL, color: "text-amber-800 dark:text-amber-400", desc: "₹1,000 - ₹5,000 Cr" },
            { id: "MICRO", label: "Micro Cap", count: capCounts.MICRO, color: "text-slate-600 dark:text-slate-400", desc: "< ₹1,000 Cr" },
          ].map((cat) => {
            const active = capCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => {
                  setCapCategory(cat.id);
                  setPage(1);
                }}
                className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition-all shadow-xs ${
                  active
                    ? "border-cyan-500 bg-cyan-500/15 text-cyan-800 dark:text-cyan-300 ring-1 ring-cyan-500/40"
                    : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                <span className={active ? "text-cyan-700 dark:text-cyan-300 font-extrabold" : cat.color}>
                  {cat.label}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                    active ? "bg-cyan-500 text-slate-950" : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-400"
                  }`}
                >
                  {cat.count}
                </span>
                {cat.desc && (
                  <span className="hidden text-[10px] text-slate-500 dark:text-slate-400 font-normal lg:inline">
                    ({cat.desc})
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* SEARCH & FILTERS CONTROLS */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#080E1A]/90 p-4 shadow-xs dark:shadow-lg">
          {/* SEARCH INPUT */}
          <div className="flex w-full max-w-sm items-center gap-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/80 px-3.5 py-2">
            <Search size={16} className="text-slate-400" />
            <input
              type="text"
              placeholder="Search ticker, company name..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full bg-transparent text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none"
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
                    ? "border border-cyan-500/50 bg-cyan-500/20 text-cyan-800 dark:text-cyan-300"
                    : "border border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900/80 text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/80"
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
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/80 px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
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
        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#080E1A]/90 shadow-xs dark:shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 text-slate-600 dark:text-slate-400">
                  <th className="py-3.5 px-3 text-center">Cap Tier</th>
                  <th className="py-3.5 pl-4 pr-4 font-semibold">Ticker & Company Name</th>
                  <th className="py-3.5 px-3 text-center font-semibold">Current Stage</th>
                  <th className="py-3.5 px-3 text-center font-semibold">Trend (90D)</th>
                  <th
                    onClick={() => handleSort("smart_money_score")}
                    className="cursor-pointer py-3.5 px-4 font-semibold hover:text-slate-900 dark:hover:text-white transition"
                  >
                    <div className="flex items-center gap-1.5">
                      Smart Money Score (0-100)
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("active_alpha_schemes_holding")}
                    className="cursor-pointer py-3.5 px-4 font-semibold hover:text-slate-900 dark:hover:text-white transition"
                  >
                    <div className="flex items-center gap-1.5">
                      Active Alpha Funds
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("net_value_flow_mom_cr")}
                    className="cursor-pointer py-3.5 px-4 font-semibold hover:text-slate-900 dark:hover:text-white transition text-right"
                  >
                    <div className="flex items-center justify-end gap-1.5">
                      Net MoM Flow (₹ Cr)
                      <ArrowUpDown size={12} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("float_absorption_pct")}
                    className="cursor-pointer py-3.5 px-4 font-semibold hover:text-slate-900 dark:hover:text-white transition text-right"
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

              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={10} className="py-16 text-center text-slate-500 dark:text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="h-7 w-7 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
                        <span>Loading Institutional Radar...</span>
                      </div>
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-16 text-center text-slate-500 dark:text-slate-400">
                      No institutional records found matching criteria.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const catBadge =
                      item.market_cap_category === "LARGE"
                        ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-700 dark:text-cyan-400"
                        : item.market_cap_category === "MID"
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        : item.market_cap_category === "SMALL"
                        ? "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-400"
                        : "border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400";

                    const isStage2 = item.stage_code === "STAGE_2";
                    const isStage1 = item.stage_code === "STAGE_1";
                    const isStage3 = item.stage_code === "STAGE_3";

                    const stageBadgeClass = isStage2
                      ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold shadow-xs"
                      : isStage1
                      ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 font-bold"
                      : isStage3
                      ? "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-400 font-bold"
                      : "border-rose-500/40 bg-rose-500/15 text-rose-700 dark:text-rose-400 font-bold";

                    const stageDotClass = isStage2
                      ? "bg-emerald-400 animate-pulse"
                      : isStage1
                      ? "bg-cyan-400"
                      : isStage3
                      ? "bg-amber-400"
                      : "bg-rose-400";

                    return (
                      <tr
                        key={item.company_id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition group"
                      >
                        {/* CAP TIER BADGE */}
                        <td className="py-3.5 px-3 text-center">
                          <span
                            className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-black tracking-wider uppercase ${catBadge}`}
                          >
                            {item.market_cap_category || "MICRO"}
                          </span>
                        </td>

                        {/* TICKER & COMPANY (DIRECT STOCK DETAIL LINK) */}
                        <td className="py-3.5 pl-4 pr-4">
                          <div className="flex items-center gap-2.5">
                            <AddToWatchlistButton
                              symbol={item.symbol}
                              companyName={item.company_name}
                              variant="star"
                            />
                            <Link
                              href={`/stocks/${encodeURIComponent(item.symbol)}?from=/institutional-radar`}
                              className="font-bold text-slate-900 dark:text-white text-sm font-mono hover:text-cyan-600 dark:hover:text-cyan-400 transition inline-flex items-center gap-1"
                              title={`Open ${item.symbol} Technical Detail Page`}
                            >
                              <span>{item.symbol}</span>
                              <ExternalLink size={11} className="text-cyan-600 dark:text-cyan-400 opacity-60 group-hover:opacity-100" />
                            </Link>
                            {item.is_stealth_accumulation && (
                              <span className="rounded bg-cyan-500/15 px-1.5 py-0.5 text-[10px] font-bold text-cyan-800 dark:text-cyan-300 flex items-center gap-0.5 border border-cyan-500/30">
                                <Sparkles size={10} /> STEALTH
                              </span>
                            )}
                            {item.is_consensus_bet && (
                              <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-0.5 border border-emerald-500/30">
                                CONSENSUS
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-2">
                            <Link
                              href={`/stocks/${encodeURIComponent(item.symbol)}?from=/institutional-radar`}
                              className="truncate max-w-[200px] text-slate-700 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 transition"
                            >
                              {item.company_name}
                            </Link>
                            &bull;
                            <span className="text-slate-400 dark:text-slate-500">{item.sector}</span>
                          </div>
                        </td>

                        {/* CURRENT STAGE */}
                        <td className="py-3.5 px-3 text-center">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] tracking-wide uppercase ${stageBadgeClass}`}
                            title={`Stan Weinstein / Minervini Stage: ${item.current_stage || "Stage 2 (Markup)"}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${stageDotClass}`} />
                            <span>{item.current_stage || "Stage 2 (Markup)"}</span>
                          </span>
                        </td>

                        {/* SPARKLINE GRAPH ON ROW */}
                        <td className="py-3.5 px-3 text-center">
                          <Link
                            href={`/stocks/${encodeURIComponent(item.symbol)}?from=/institutional-radar`}
                            className="inline-block hover:opacity-80 transition"
                            title={`View interactive price history for ${item.symbol}`}
                          >
                            <SparklineChart
                              data={item.sparkline}
                              width={82}
                              height={24}
                              showDot={true}
                              showBadge={true}
                              periodLabel="90D"
                            />
                          </Link>
                        </td>

                        {/* SMART MONEY SCORE GAUGE */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900/90 font-mono font-black text-sm text-cyan-700 dark:text-cyan-400 shadow-inner">
                              {item.smart_money_score}
                            </div>
                            <div className="w-20">
                              <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                                <div
                                  style={{ width: `${item.smart_money_score}%` }}
                                  className={`h-full rounded-full ${
                                    item.smart_money_score >= 80
                                      ? "bg-gradient-to-r from-cyan-500 to-emerald-500"
                                      : item.smart_money_score >= 65
                                      ? "bg-cyan-500"
                                      : "bg-amber-500"
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
                            <span className="font-bold text-slate-900 dark:text-white text-sm">
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
                                ? "text-emerald-600 dark:text-emerald-400"
                                : item.net_value_flow_mom_cr < 0
                                ? "text-red-600 dark:text-red-400"
                                : "text-slate-500 dark:text-slate-400"
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
                          <div className="flex items-center justify-end gap-1 font-bold text-cyan-700 dark:text-cyan-300">
                            <span>{item.float_absorption_pct}%</span>
                            {item.float_absorption_pct >= 2.0 && (
                              <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-ping" />
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
                              <Star key={i} size={12} className="fill-amber-400 text-amber-500 dark:text-amber-400" />
                            ))}
                            {item.star_manager_count === 0 && (
                              <span className="text-slate-400 dark:text-slate-600 text-xs">—</span>
                            )}
                          </div>
                        </td>

                        {/* ACTION BUY ZONE */}
                        <td className="py-3.5 pr-6 pl-4 text-right">
                          <div className="flex flex-col items-end gap-1">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`inline-block rounded-lg px-2 py-0.5 text-[10px] font-black tracking-wider uppercase border ${
                                  item.action_recommendation === "STRONG BUY"
                                    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300"
                                    : item.action_recommendation === "ACCUMULATE"
                                    ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-800 dark:text-cyan-300"
                                    : "border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                                }`}
                              >
                                {item.action_recommendation}
                              </span>
                              <Link
                                href={`/stocks/${encodeURIComponent(item.symbol)}?from=/institutional-radar`}
                                className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/20 transition shadow-xs inline-flex items-center gap-0.5"
                                title={`Open ${item.symbol} Stock Detail Page`}
                              >
                                <span>Stock</span>
                                <ArrowUpRight size={10} />
                              </Link>
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                              Target: ₹{item.target_price.toLocaleString("en-IN")}
                            </div>
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
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 px-6 py-4 text-xs text-slate-600 dark:text-slate-400">
            <div>
              Showing <strong className="text-slate-900 dark:text-white">{(page - 1) * 20 + 1}</strong> to{" "}
              <strong className="text-slate-900 dark:text-white">{Math.min(page * 20, totalCount)}</strong> of{" "}
              <strong className="text-cyan-700 dark:text-cyan-400">{totalCount}</strong> institutional records
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loading}
                className="flex items-center gap-1 rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition disabled:opacity-40"
              >
                <ChevronLeft size={14} />
                Previous
              </button>

              <span className="px-2 font-mono font-bold text-slate-800 dark:text-white">
                Page {page} of {totalPages}
              </span>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loading}
                className="flex items-center gap-1 rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-1.5 font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition disabled:opacity-40"
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


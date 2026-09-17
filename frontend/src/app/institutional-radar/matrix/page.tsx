"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  TableProperties,
  Search,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  CheckSquare,
  Square,
  ArrowUpRight,
  X,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import InstitutionalSubNav from "@/components/institutional/InstitutionalSubNav";
import StockInstitutionalModal from "@/components/institutional/StockInstitutionalModal";
import {
  MatrixResponse,
  SchemeInfo,
  CapCounts,
  fetchInstitutionalMatrix,
  fetchSchemesList,
} from "@/lib/institutionalApi";


type ViewMode = "combined" | "pct_only" | "value_only";

export default function AmcSchemeMatrixPage() {
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<MatrixResponse | null>(null);
  const [allSchemes, setAllSchemes] = useState<SchemeInfo[]>([]);

  // Filter States
  const [capCategory, setCapCategory] = useState<string>("ALL");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedSector, setSelectedSector] = useState<string>("ALL");
  const [schemeCategory, setSchemeCategory] = useState<string>("ALL");
  const [selectedSchemeIds, setSelectedSchemeIds] = useState<number[]>([]);
  const [sortBy, setSortBy] = useState<string>("market_cap");
  const [sortOrder, setSortOrder] = useState<string>("desc");
  const [viewMode, setViewMode] = useState<ViewMode>("combined");

  // Pagination
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(50);

  // Scheme Selector Drawer / Modal
  const [showSchemeDrawer, setShowSchemeDrawer] = useState<boolean>(false);

  // Stock Detail Modal
  const [modalSymbol, setModalSymbol] = useState<string | null>(null);

  // Initial load of all available schemes for column picker
  useEffect(() => {
    async function loadSchemes() {
      try {
        const schemes = await fetchSchemesList();
        setAllSchemes(schemes);
      } catch (err) {
        console.error("Failed to load schemes list:", err);
      }
    }
    loadSchemes();
  }, []);

  // Fetch Matrix Data
  const loadMatrix = useCallback(async () => {
    setLoading(true);
    try {
      const schemeIdsParam =
        selectedSchemeIds.length > 0 ? selectedSchemeIds.join(",") : undefined;

      const res = await fetchInstitutionalMatrix({
        market_cap_category: capCategory !== "ALL" ? capCategory : undefined,
        search: searchTerm || undefined,
        sector: selectedSector !== "ALL" ? selectedSector : undefined,
        scheme_category: schemeCategory !== "ALL" ? schemeCategory : undefined,
        scheme_ids: schemeIdsParam,
        page,
        limit,
        sort_by: sortBy,
        sort_order: sortOrder,
      });

      setData(res);
    } catch (err) {
      console.error("Error fetching matrix data:", err);
    } finally {
      setLoading(false);
    }
  }, [
    capCategory,
    searchTerm,
    selectedSector,
    schemeCategory,
    selectedSchemeIds,
    page,
    limit,
    sortBy,
    sortOrder,
  ]);

  useEffect(() => {
    loadMatrix();
  }, [loadMatrix]);

  // Handle Cap Ribbon Click
  const handleCapChange = (cat: string) => {
    setCapCategory(cat);
    setPage(1);
  };

  // Toggle scheme in drawer
  const toggleSchemeId = (id: number) => {
    setSelectedSchemeIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Select all schemes
  const selectAllSchemes = () => {
    setSelectedSchemeIds([]);
  };

  // Select top 10 flagship
  const selectTop10Flagship = () => {
    const top10 = allSchemes.slice(0, 10).map((s) => s.id);
    setSelectedSchemeIds(top10);
  };

  const capCounts: CapCounts = data?.cap_counts || {
    ALL: 0,
    LARGE: 0,
    MID: 0,
    SMALL: 0,
    MICRO: 0,
  };

  return (
    <DashboardLayout>
      <div className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8">
        {/* TOP INSTITUTIONAL NAVIGATION SUB-NAV */}
        <InstitutionalSubNav />

        {/* HEADER TITLE & DESK ACTIONS */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 shadow-lg shadow-cyan-950/30">
              <TableProperties size={26} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                  Full-Universe AMC Scheme Matrix
                </h1>
                <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-xs font-bold text-cyan-400">
                  {data?.total || 0} EQUITIES
                </span>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-400">
                  {data?.schemes?.length || 0} AMC SCHEMES
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Cross-scheme institutional holding weights, deployment capital, and MoM allocation shifts across Indian AMCs.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* View Mode Toggle */}
            <div className="flex items-center rounded-xl border border-slate-700 bg-slate-800/80 p-1">
              <button
                onClick={() => setViewMode("combined")}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                  viewMode === "combined"
                    ? "bg-cyan-500 text-slate-950 shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
                title="Show % Weight and ₹ Cr Value"
              >
                Combined
              </button>
              <button
                onClick={() => setViewMode("pct_only")}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                  viewMode === "pct_only"
                    ? "bg-cyan-500 text-slate-950 shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
                title="Show Weight % Only"
              >
                % Weight
              </button>
              <button
                onClick={() => setViewMode("value_only")}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                  viewMode === "value_only"
                    ? "bg-cyan-500 text-slate-950 shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
                title="Show Rupee Value Only"
              >
                ₹ Cr
              </button>
            </div>

            {/* Column Selector Trigger */}
            <button
              onClick={() => setShowSchemeDrawer(true)}
              className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs font-bold text-slate-300 hover:border-slate-600 hover:text-white transition"
            >
              <SlidersHorizontal size={14} className="text-cyan-400" />
              <span>Schemes ({data?.schemes?.length || 0})</span>
            </button>

            {/* Refresh */}
            <button
              onClick={loadMatrix}
              disabled={loading}
              className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-2 text-xs font-bold text-slate-300 hover:border-slate-600 hover:text-white transition disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? "animate-spin text-cyan-400" : ""} />
              Refresh
            </button>
          </div>
        </div>

        {/* MARKET CAP CATEGORY FILTER RIBBON */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: "ALL", label: "All Caps", count: capCounts.ALL, color: "text-slate-200" },
            { id: "LARGE", label: "Large Cap", count: capCounts.LARGE, color: "text-cyan-400", border: "border-cyan-500/40", desc: "> ₹20,000 Cr" },
            { id: "MID", label: "Mid Cap", count: capCounts.MID, color: "text-emerald-400", border: "border-emerald-500/40", desc: "₹5,000 - ₹20,000 Cr" },
            { id: "SMALL", label: "Small Cap", count: capCounts.SMALL, color: "text-amber-400", border: "border-amber-500/40", desc: "₹1,000 - ₹5,000 Cr" },
            { id: "MICRO", label: "Micro Cap", count: capCounts.MICRO, color: "text-slate-400", border: "border-slate-600", desc: "< ₹1,000 Cr" },
          ].map((cat) => {
            const active = capCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => handleCapChange(cat.id)}
                className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition-all shadow-sm ${
                  active
                    ? "border-cyan-500 bg-cyan-500/15 text-cyan-300 shadow-cyan-950/40 ring-1 ring-cyan-500/40"
                    : "border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:bg-slate-800/60 hover:text-slate-200"
                }`}
              >
                <span className={active ? "text-cyan-300 font-extrabold" : cat.color}>
                  {cat.label}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                    active
                      ? "bg-cyan-500 text-slate-950"
                      : "bg-slate-800 text-slate-400"
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

        {/* SEARCH & SECONDARY FILTERS TOOLBAR */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800/80 bg-slate-900/40 p-3">
          <div className="flex flex-1 flex-wrap items-center gap-2.5">
            {/* Search */}
            <div className="relative min-w-[240px] flex-1 sm:max-w-xs">
              <Search
                size={14}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                placeholder="Search symbol, company name..."
                className="w-full rounded-xl border border-slate-800 bg-slate-950/70 py-2 pl-9 pr-4 text-xs text-white placeholder-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Scheme Category Filter */}
            <select
              value={schemeCategory}
              onChange={(e) => {
                setSchemeCategory(e.target.value);
                setPage(1);
              }}
              className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs font-semibold text-slate-300 focus:border-cyan-500 focus:outline-none"
            >
              <option value="ALL">All AMC Mandates</option>
              <option value="FLEXI_CAP">Flexi & Multi Cap Funds</option>
              <option value="LARGE_CAP">Large Cap Funds</option>
              <option value="MID_CAP">Mid Cap Funds</option>
              <option value="SMALL_CAP">Small Cap Funds</option>
            </select>

            {/* Sort Options */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-xs font-semibold text-slate-300 focus:border-cyan-500 focus:outline-none"
            >
              <option value="market_cap">Sort: Market Cap</option>
              <option value="total_mf_pct">Sort: Mutual Fund %</option>
              <option value="total_value_cr">Sort: Institutional ₹ Cr</option>
              <option value="smart_money_score">Sort: Smart Money Score</option>
              <option value="symbol">Sort: Ticker Symbol</option>
            </select>
          </div>

          {/* Page size & Legend */}
          <div className="flex items-center gap-3">
            {/* Directional Legend */}
            <div className="hidden items-center gap-3 text-[11px] text-slate-400 xl:flex">
              <span className="flex items-center gap-1 font-semibold text-emerald-400">
                <span>▲</span> Added MoM
              </span>
              <span className="flex items-center gap-1 font-semibold text-red-400">
                <span>▼</span> Trimmed MoM
              </span>
              <span className="flex items-center gap-1 font-semibold text-cyan-400">
                <span>★</span> Fresh Entry
              </span>
              <span className="flex items-center gap-1 text-slate-400">
                <span>—</span> Not Held
              </span>
            </div>

            <select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="rounded-xl border border-slate-800 bg-slate-950/70 px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none"
            >
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
            </select>
          </div>
        </div>

        {/* CROSS-TABULATED AMC MATRIX TABLE WITH STICKY HEADERS & STICKY LEFT COLUMNS */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md shadow-2xl">
          {loading && (
            <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs">
              <div className="flex items-center gap-3 rounded-2xl border border-cyan-500/40 bg-slate-900 px-5 py-3 shadow-2xl">
                <RefreshCw size={18} className="animate-spin text-cyan-400" />
                <span className="text-xs font-black tracking-wide text-cyan-200">
                  BUILDING INSTITUTIONAL MATRIX...
                </span>
              </div>
            </div>
          )}

          <div className="overflow-x-auto max-h-[720px] scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-slate-900">
            <table className="w-full border-collapse text-left text-xs">
              {/* TABLE HEADER */}
              <thead className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/95 text-[11px] font-black uppercase tracking-wider text-slate-400 backdrop-blur-md">
                <tr>
                  {/* Sticky Col 1: Market Cap Badge */}
                  <th className="sticky left-0 z-35 min-w-[85px] border-r border-slate-800/80 bg-slate-950 px-3 py-3.5 text-center">
                    Cap Tier
                  </th>

                  {/* Sticky Col 2: Stock Symbol & Name */}
                  <th className="sticky left-[85px] z-35 min-w-[210px] border-r border-slate-800/80 bg-slate-950 px-4 py-3.5">
                    Ticker & Company Name
                  </th>

                  {/* Sticky Col 3: Sector & Total Inst % */}
                  <th className="sticky left-[295px] z-35 min-w-[130px] border-r border-slate-700 bg-slate-950 px-3 py-3.5 text-right shadow-[3px_0_10px_rgba(0,0,0,0.6)]">
                    Total Inst %
                  </th>

                  {/* Dynamic AMC Scheme Columns */}
                  {data?.schemes?.map((scheme) => (
                    <th
                      key={scheme.id}
                      className="min-w-[155px] border-r border-slate-800/60 px-3 py-3 text-center transition-colors hover:bg-slate-900/80"
                    >
                      <div className="flex flex-col items-center">
                        <span className="font-extrabold text-slate-200 text-center leading-tight line-clamp-1" title={scheme.scheme_name}>
                          {scheme.scheme_name}
                        </span>
                        <div className="mt-1 flex items-center gap-1.5 text-[10px] font-bold text-cyan-400">
                          <span className="rounded bg-slate-800/90 px-1.5 py-0.5 text-slate-300">
                            {scheme.amc_name.replace("Mutual Fund", "MF")}
                          </span>
                          <span className="text-slate-400">₹{(scheme.aum_cr / 1000).toFixed(1)}k Cr</span>
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              {/* TABLE BODY */}
              <tbody className="divide-y divide-slate-800/60 text-slate-300 font-medium">
                {data?.items?.length === 0 ? (
                  <tr>
                    <td
                      colSpan={(data?.schemes?.length || 0) + 3}
                      className="py-16 text-center text-slate-400"
                    >
                      <TableProperties size={36} className="mx-auto mb-2 text-slate-400" />
                      <p className="text-sm font-semibold">No companies found matching current filters.</p>
                      <p className="text-xs text-slate-400 mt-1">Try selecting &quot;All Caps&quot; or broadening search criteria.</p>
                    </td>

                  </tr>
                ) : (
                  data?.items?.map((stock) => {
                    const catBadge =
                      stock.market_cap_category === "LARGE"
                        ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-400"
                        : stock.market_cap_category === "MID"
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                        : stock.market_cap_category === "SMALL"
                        ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                        : "border-slate-600 bg-slate-800 text-slate-400";

                    return (
                      <tr
                        key={stock.company_id}
                        className="group hover:bg-slate-800/40 transition-colors"
                      >
                        {/* Sticky Col 1: Cap Badge */}
                        <td className="sticky left-0 z-20 border-r border-slate-800/80 bg-slate-950 px-3 py-3 text-center group-hover:bg-slate-900 transition-colors">
                          <span
                            className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-black tracking-wider uppercase ${catBadge}`}
                          >
                            {stock.market_cap_category || "MICRO"}
                          </span>
                        </td>

                        {/* Sticky Col 2: Stock Symbol & Company Name */}
                        <td
                          onClick={() => setModalSymbol(stock.symbol)}
                          className="sticky left-[85px] z-20 cursor-pointer border-r border-slate-800/80 bg-slate-950 px-4 py-3 group-hover:bg-slate-900 transition-colors"
                        >
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1.5">
                              <span className="font-extrabold text-white text-sm tracking-wide group-hover:text-cyan-400 transition-colors">
                                {stock.symbol}
                              </span>
                              <ArrowUpRight size={12} className="text-slate-400 group-hover:text-cyan-400 transition-colors" />
                            </div>
                            <span className="text-[11px] text-slate-400 line-clamp-1">
                              {stock.company_name}
                            </span>
                            <span className="text-[10px] text-slate-400 mt-0.5">
                              {stock.sector}
                            </span>
                          </div>
                        </td>

                        {/* Sticky Col 3: Total Institutional Ownership */}
                        <td className="sticky left-[295px] z-20 border-r border-slate-700 bg-slate-950 px-3 py-3 text-right shadow-[3px_0_10px_rgba(0,0,0,0.6)] group-hover:bg-slate-900 transition-colors">
                          <div className="flex flex-col items-end">
                            <span className="font-mono font-black text-cyan-300 text-xs">
                              {stock.total_mf_weight_pct.toFixed(2)}%
                            </span>
                            <span className="font-mono text-[10px] text-slate-400">
                              ₹{stock.total_mf_value_cr.toLocaleString("en-IN")} Cr
                            </span>
                            <span className="text-[9px] text-emerald-400 font-semibold">
                              {stock.total_schemes_holding} Schemes
                            </span>
                          </div>
                        </td>

                        {/* Dynamic Scheme Cells */}
                        {data?.schemes?.map((scheme) => {
                          const holding = stock.holdings?.[scheme.id.toString()];

                          if (!holding) {
                            return (
                              <td
                                key={scheme.id}
                                className="border-r border-slate-800/50 px-3 py-3 text-center text-slate-400 font-mono text-xs"
                              >
                                —
                              </td>
                            );
                          }

                          // Trend Arrow & Color
                          let trendIcon = null;
                          let trendColor = "text-slate-400";
                          let trendBg = "bg-transparent";

                          if (holding.trend === "NEW" || holding.holding_status === "NEW_ENTRY") {
                            trendIcon = "★";
                            trendColor = "text-cyan-300 font-extrabold";
                            trendBg = "bg-cyan-500/15 border-cyan-500/40";
                          } else if (holding.trend === "UP") {
                            trendIcon = "▲";
                            trendColor = "text-emerald-400 font-bold";
                            trendBg = "bg-emerald-500/10";
                          } else if (holding.trend === "DOWN") {
                            trendIcon = "▼";
                            trendColor = "text-red-400 font-bold";
                            trendBg = "bg-red-500/10";
                          }

                          return (
                            <td
                              key={scheme.id}
                              onClick={() => setModalSymbol(stock.symbol)}
                              className="cursor-pointer border-r border-slate-800/50 px-2.5 py-2 text-center transition-colors hover:bg-cyan-950/20"
                            >
                              <div className={`mx-auto rounded-lg border border-transparent p-1.5 transition-all ${trendBg}`}>
                                {/* Combined View */}
                                {viewMode === "combined" && (
                                  <div className="flex flex-col items-center">
                                    <div className="flex items-center gap-1 font-mono text-xs font-bold text-slate-100">
                                      {trendIcon && (
                                        <span className={trendColor}>{trendIcon}</span>
                                      )}
                                      <span>{holding.weight_pct.toFixed(2)}%</span>
                                    </div>
                                    <span className="font-mono text-[10px] text-slate-400">
                                      ₹{holding.market_value_cr.toLocaleString("en-IN")} Cr
                                    </span>
                                    {holding.mom_shares_change_pct !== 0 && (
                                      <span
                                        className={`text-[9px] font-bold ${
                                          holding.mom_shares_change_pct > 0
                                            ? "text-emerald-400"
                                            : "text-red-400"
                                        }`}
                                      >
                                        {holding.mom_shares_change_pct > 0 ? "+" : ""}
                                        {holding.mom_shares_change_pct.toFixed(1)}%
                                      </span>
                                    )}
                                  </div>
                                )}

                                {/* % Weight Only View */}
                                {viewMode === "pct_only" && (
                                  <div className="flex items-center justify-center gap-1 font-mono text-xs font-bold text-slate-100">
                                    {trendIcon && (
                                      <span className={trendColor}>{trendIcon}</span>
                                    )}
                                    <span>{holding.weight_pct.toFixed(2)}%</span>
                                  </div>
                                )}

                                {/* Rupee Value Only View */}
                                {viewMode === "value_only" && (
                                  <div className="flex items-center justify-center gap-1 font-mono text-xs font-bold text-slate-100">
                                    {trendIcon && (
                                      <span className={trendColor}>{trendIcon}</span>
                                    )}
                                    <span>₹{holding.market_value_cr.toLocaleString("en-IN")} Cr</span>
                                  </div>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* TABLE FOOTER / PAGINATION */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-800 bg-slate-950 px-4 py-3.5 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span>
                Showing{" "}
                <strong className="text-white">
                  {data?.items?.length ? (page - 1) * limit + 1 : 0}
                </strong>{" "}
                to{" "}
                <strong className="text-white">
                  {Math.min(page * limit, data?.total || 0)}
                </strong>{" "}
                of <strong className="text-cyan-400">{data?.total || 0}</strong> companies
              </span>
              <span className="text-slate-400">&bull;</span>
              <span>
                AMFI Report Date: <strong className="text-slate-300">{data?.latest_report_date || "Aug 2024"}</strong>
              </span>
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
                Page {page} of {data?.pages || 1}
              </span>

              <button
                onClick={() => setPage((p) => Math.min(data?.pages || 1, p + 1))}
                disabled={page >= (data?.pages || 1) || loading}
                className="flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 font-bold text-slate-300 hover:border-slate-700 hover:bg-slate-800 hover:text-white transition disabled:opacity-40"
              >
                Next
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* SCHEME SELECTOR MODAL DRAWER */}
        {showSchemeDrawer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal size={18} className="text-cyan-400" />
                  <h3 className="text-base font-black text-white">
                    Customize AMC Scheme Columns ({allSchemes.length} Available)
                  </h3>
                </div>
                <button
                  onClick={() => setShowSchemeDrawer(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Quick Presets */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={selectAllSchemes}
                  className={`rounded-lg px-3 py-1 text-xs font-bold transition ${
                    selectedSchemeIds.length === 0
                      ? "bg-cyan-500 text-slate-950 font-black"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  All Schemes ({allSchemes.length})
                </button>
                <button
                  onClick={selectTop10Flagship}
                  className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-bold text-slate-300 hover:bg-slate-700 transition"
                >
                  Top 10 Flagship Funds
                </button>
              </div>

              {/* Schemes Grid */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-slate-700">
                {allSchemes.map((s) => {
                  const isChecked =
                    selectedSchemeIds.length === 0 || selectedSchemeIds.includes(s.id);

                  return (
                    <div
                      key={s.id}
                      onClick={() => toggleSchemeId(s.id)}
                      className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-800/80 bg-slate-950/60 p-3 hover:border-slate-700 hover:bg-slate-800/50 transition"
                    >
                      <div className="flex items-center gap-3">
                        {isChecked ? (
                          <CheckSquare size={16} className="text-cyan-400" />
                        ) : (
                          <Square size={16} className="text-slate-400" />
                        )}
                        <div>
                          <div className="text-xs font-bold text-white">{s.scheme_name}</div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-2">
                            <span>{s.amc_name}</span>
                            <span>&bull;</span>
                            <span className="text-cyan-400">{s.category}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-mono text-xs font-bold text-slate-300">
                          ₹{s.aum_cr.toLocaleString("en-IN")} Cr
                        </span>
                        <div className="text-[10px] text-slate-400">{s.fund_manager_name || "Institutional"}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Drawer Actions */}
              <div className="flex items-center justify-end gap-3 border-t border-slate-800 pt-3">
                <button
                  onClick={() => setShowSchemeDrawer(false)}
                  className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-bold text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowSchemeDrawer(false);
                    loadMatrix();
                  }}
                  className="rounded-xl bg-cyan-500 px-5 py-2 text-xs font-black text-slate-950 shadow-md shadow-cyan-950/50 hover:bg-cyan-400 transition"
                >
                  Apply Columns
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 5-QUESTION STOCK INSTITUTIONAL MODAL */}
        {modalSymbol && (
          <StockInstitutionalModal
            symbol={modalSymbol}
            onClose={() => setModalSymbol(null)}
          />
        )}
      </div>
    </DashboardLayout>
  );
}

"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/layout/DashboardLayout";
import AddToWatchlistButton from "@/components/watchlist/AddToWatchlistButton";
import { SparklineChart, StageBadge } from "@/components/common";
import {
  fetchTechnoFundaScreener,
  fetchTechnoFundaSummary,
  type TechnoFundaItem,
  type TechnoFundaSummary,
} from "@/lib/technoFundaApi";
import { fetchGrowthFilters } from "@/lib/api";
import {
  TrendingUp,
  Activity,
  Zap,
  Target,
  Search,
  Filter,
  ArrowUpRight,
  ShieldCheck,
  ChevronRight,
  SlidersHorizontal,
  X,
  ExternalLink,
  Flame,
  CheckCircle2,
  AlertTriangle,
  Award,
  Layers,
  ArrowUpDown,
  BarChart3,
  Percent,
  Sparkles,
  Info,
  DollarSign,
  Calculator,
  Compass,
} from "lucide-react";

const STRATEGY_PRESETS = [
  {
    id: "TOP_1_PERCENT_SNIPER",
    label: "★ Top 1% Sniper Bets",
    icon: Target,
    color: "amber",
    desc: "The absolute elite confluence: CANSLIM ≥ 85, within ≤ 6% of 52W High, Smart Money FII+DII ≥ 12%, and Minervini 8/8",
  },
  {
    id: "CANSLIM_TITANS",
    label: "CANSLIM Titans",
    icon: Flame,
    color: "emerald",
    desc: "Composite Score ≥ 80 with high earnings acceleration & Stage 2 trend",
  },
  {
    id: "EARNINGS_ACCELERATORS",
    label: "Earnings Accelerators (C-Factor)",
    icon: Zap,
    color: "cyan",
    desc: "Blockbuster quarterly PAT growth ≥ 35% YoY with top-line confirmation",
  },
  {
    id: "INSTITUTIONAL_FAVORITES",
    label: "Institutional Sponsorship (I-Factor)",
    icon: Award,
    color: "blue",
    desc: "High FII + DII holding (≥ 18%) in active Stage 2 institutional accumulation",
  },
  {
    id: "NEW_HIGHS_52W",
    label: "52W High Breakouts (N-Factor)",
    icon: Target,
    color: "purple",
    desc: "Within ≤ 6% of 52-Week High coiled in Stage 2 markup structure",
  },
  {
    id: "VALUE_GROWTH",
    label: "Undervalued Growth / PEG",
    icon: Sparkles,
    color: "amber",
    desc: "Reasonable valuation (P/E ≤ 35), PAT YoY ≥ 25% and ROCE ≥ 18%",
  },
  {
    id: "STAGE_2_LEADERS",
    label: "Stage 2 Leaders (L-Factor)",
    icon: TrendingUp,
    color: "teal",
    desc: "CMP > 50 DMA > 200 DMA with sweet-spot RSI momentum launchpad",
  },
  {
    id: "ALL",
    label: "All Qualified Equities",
    icon: Layers,
    color: "slate",
    desc: "Complete filtered universe of active equities (M-Cap ≥ ₹150 Cr)",
  },
];

export default function TechnoFundaPage() {
  const [items, setItems] = useState<TechnoFundaItem[]>([]);
  const [summary, setSummary] = useState<TechnoFundaSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activePreset, setActivePreset] = useState("TOP_1_PERCENT_SNIPER");
  const [selectedSector, setSelectedSector] = useState("ALL");
  const [sortBy, setSortBy] = useState("canslim_score");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Quick Inspection Drawer State
  const [selectedStock, setSelectedStock] = useState<TechnoFundaItem | null>(null);
  const [accountRiskRupees, setAccountRiskRupees] = useState<number>(10000);
  const [sectors, setSectors] = useState<string[]>([]);
  const [urlInitialized, setUrlInitialized] = useState(false);

  // Read URL query parameters on initial client mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const pPreset = params.get("preset");
      const pSector = params.get("sector");
      const pSearch = params.get("search");
      const pSort = params.get("sort_by");
      const pOrder = params.get("sort_order") as "asc" | "desc" | null;
      const pPage = params.get("page");

      if (pPreset && STRATEGY_PRESETS.some((p) => p.id === pPreset)) {
        setActivePreset(pPreset);
      }
      if (pSector) {
        setSelectedSector(pSector);
      }
      if (pSearch) {
        setSearch(pSearch);
        setDebouncedSearch(pSearch);
      }
      if (pSort) {
        setSortBy(pSort);
      }
      if (pOrder && (pOrder === "asc" || pOrder === "desc")) {
        setSortOrder(pOrder);
      }
      if (pPage && parseInt(pPage, 10) > 0) {
        setPage(parseInt(pPage, 10));
      }
      setUrlInitialized(true);
    }
  }, []);

  // Sync state back to URL for bookmarkability and deep-linking
  useEffect(() => {
    if (!urlInitialized || typeof window === "undefined") return;

    const params = new URLSearchParams();
    if (activePreset && activePreset !== "TOP_1_PERCENT_SNIPER") {
      params.set("preset", activePreset);
    }
    if (selectedSector && selectedSector !== "ALL") {
      params.set("sector", selectedSector);
    }
    if (debouncedSearch) {
      params.set("search", debouncedSearch);
    }
    if (sortBy && sortBy !== "canslim_score") {
      params.set("sort_by", sortBy);
    }
    if (sortOrder && sortOrder !== "desc") {
      params.set("sort_order", sortOrder);
    }
    if (page > 1) {
      params.set("page", String(page));
    }

    const query = params.toString();
    const newUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history.replaceState(null, "", newUrl);
  }, [urlInitialized, activePreset, selectedSector, debouncedSearch, sortBy, sortOrder, page]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Load summary stats and sectors once
  useEffect(() => {
    fetchTechnoFundaSummary()
      .then(setSummary)
      .catch((err) => console.error("Summary error:", err));

    fetchGrowthFilters()
      .then((res) => {
        if (res?.sectors && Array.isArray(res.sectors)) {
          setSectors(res.sectors.filter(Boolean));
        }
      })
      .catch((err) => console.error("Sectors error:", err));
  }, []);

  // Fetch screener data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchTechnoFundaScreener({
        page,
        limit,
        search: debouncedSearch,
        preset: activePreset === "ALL" ? undefined : activePreset,
        sector: selectedSector === "ALL" ? undefined : selectedSector,
        sort_by: sortBy,
        sort_order: sortOrder,
        min_market_cap: 150,
      });
      setItems(res.items);
      setTotalPages(res.total_pages);
      setTotalCount(res.total);
    } catch (err) {
      console.error("Failed to load screener data:", err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, activePreset, selectedSector, sortBy, sortOrder]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePresetChange = (presetId: string) => {
    setActivePreset(presetId);
    setPage(1);
  };

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
    setPage(1);
  };

  // Position Sizing Calculation for selected stock in drawer
  const sizingCalculation = useMemo(() => {
    if (!selectedStock) return null;
    const cmp = selectedStock.current_price;
    const stop = selectedStock.downside_reference;
    const trigger = selectedStock.scenario_trigger || cmp;
    const riskPerShare = Math.max(1, trigger - stop);
    const sharesToBuy = Math.floor(accountRiskRupees / riskPerShare);
    const totalCapital = sharesToBuy * trigger;
    const riskAmount = sharesToBuy * riskPerShare;
    const profitTarget1 = sharesToBuy * Math.max(0, (selectedStock.target_1 || trigger * 1.1) - trigger);
    const profitTarget2 = sharesToBuy * Math.max(0, (selectedStock.target_2 || trigger * 1.2) - trigger);

    return {
      riskPerShare,
      sharesToBuy,
      totalCapital,
      riskAmount,
      profitTarget1,
      profitTarget2,
    };
  }, [selectedStock, accountRiskRupees]);

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-4">
        {/* COMPACT TOP HEADER */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#081225] p-3.5 shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <Flame size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-white sm:text-lg">
                  CANSLIM Growth Radar & Institutional Super-Stock Scanner
                </h1>
                <span className="rounded-full bg-emerald-100 dark:bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:text-emerald-400 border border-emerald-500/20">
                  Top 1% Bets
                </span>
              </div>
            </div>
          </div>

          {/* Preset Selector, Sector Selector, Search & Candidate Count */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Strategy Preset */}
            <div className="flex items-center gap-1.5">
              <SlidersHorizontal size={13} className="text-slate-400 shrink-0" />
              <select
                value={activePreset}
                onChange={(e) => handlePresetChange(e.target.value)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/90 py-1.5 px-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-emerald-500 font-medium cursor-pointer"
              >
                {STRATEGY_PRESETS.map((p) => (
                  <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Sector Filter */}
            <div className="flex items-center gap-1.5">
              <Filter size={13} className="text-slate-400 shrink-0" />
              <select
                value={selectedSector}
                onChange={(e) => {
                  setSelectedSector(e.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/90 py-1.5 px-2.5 text-xs text-slate-900 dark:text-white outline-none focus:border-cyan-500 font-medium cursor-pointer max-w-[150px] truncate"
              >
                <option value="ALL" className="bg-slate-900 text-white">All Sectors</option>
                {sectors.map((sec) => (
                  <option key={sec} value={sec} className="bg-slate-900 text-white">
                    {sec}
                  </option>
                ))}
              </select>
            </div>

            {/* Search */}
            <div className="relative min-w-[170px] sm:w-56">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search symbol e.g. MCX..."
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/90 py-1.5 pl-9 pr-8 text-xs text-slate-900 dark:text-white placeholder-slate-500 outline-none focus:border-emerald-500"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-white"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Active Filters Reset Badge */}
            {(activePreset !== "TOP_1_PERCENT_SNIPER" || selectedSector !== "ALL" || search) && (
              <button
                onClick={() => {
                  setActivePreset("TOP_1_PERCENT_SNIPER");
                  setSelectedSector("ALL");
                  setSearch("");
                  setPage(1);
                }}
                className="flex items-center gap-1 rounded-lg bg-rose-500/10 border border-rose-500/20 px-2 py-1 text-[11px] font-medium text-rose-400 hover:bg-rose-500/20 transition"
                title="Reset all active filters"
              >
                <X size={12} />
                <span>Reset</span>
              </button>
            )}

            <div className="text-xs text-slate-500 font-mono whitespace-nowrap ml-auto sm:ml-0">
              <strong className="text-slate-900 dark:text-emerald-400">{totalCount}</strong> candidates
            </div>
          </div>
        </div>

        {/* MACRO BREADTH & CONFLUENCE TELEMETRY RIBBON */}
        {summary && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {/* Total Screened */}
            <div
              onClick={() => handlePresetChange("ALL")}
              className={`group cursor-pointer rounded-xl border p-3 transition shadow-xs ${
                activePreset === "ALL"
                  ? "border-emerald-500/50 bg-emerald-500/10 dark:bg-emerald-950/20"
                  : "border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#081225] hover:border-slate-300 dark:hover:border-slate-700"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Universe Scanned
                </span>
                <Layers size={14} className="text-slate-400 group-hover:text-emerald-400 transition" />
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-xl font-extrabold text-slate-900 dark:text-white font-mono">
                  {summary.total_screened.toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-500 font-sans">Equities</span>
              </div>
              <div className="mt-0.5 text-[10px] text-cyan-600 dark:text-cyan-400/80 font-medium">
                M-Cap ≥ ₹150 Cr Active
              </div>
            </div>

            {/* Stage 2 Leaders */}
            <div
              onClick={() => handlePresetChange("STAGE_2_LEADERS")}
              className={`group cursor-pointer rounded-xl border p-3 transition shadow-xs ${
                activePreset === "STAGE_2_LEADERS"
                  ? "border-teal-500/50 bg-teal-500/10 dark:bg-teal-950/20"
                  : "border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#081225] hover:border-teal-500/30"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Stage 2 Markup
                </span>
                <TrendingUp size={14} className="text-teal-400" />
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-xl font-extrabold text-teal-600 dark:text-teal-400 font-mono">
                  {summary.stage_2_count.toLocaleString()}
                </span>
                <span className="text-[10px] text-teal-500 font-bold font-mono">
                  ({summary.stage_2_ratio_pct}%)
                </span>
              </div>
              <div className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                CMP &gt; 50 DMA &gt; 200 DMA
              </div>
            </div>

            {/* Blockbuster Earnings Accelerators */}
            <div
              onClick={() => handlePresetChange("EARNINGS_ACCELERATORS")}
              className={`group cursor-pointer rounded-xl border p-3 transition shadow-xs ${
                activePreset === "EARNINGS_ACCELERATORS"
                  ? "border-cyan-500/50 bg-cyan-500/10 dark:bg-cyan-950/20"
                  : "border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#081225] hover:border-cyan-500/30"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  PAT Accelerators
                </span>
                <Zap size={14} className="text-cyan-400" />
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-xl font-extrabold text-cyan-600 dark:text-cyan-400 font-mono">
                  {summary.earnings_accelerator_count?.toLocaleString() ?? "—"}
                </span>
                <span className="text-[10px] text-cyan-500 font-sans">Growth Titans</span>
              </div>
              <div className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                Quarterly PAT YoY ≥ 35%
              </div>
            </div>

            {/* Near 52W High Breakouts */}
            <div
              onClick={() => handlePresetChange("NEW_HIGHS_52W")}
              className={`group cursor-pointer rounded-xl border p-3 transition shadow-xs ${
                activePreset === "NEW_HIGHS_52W"
                  ? "border-purple-500/50 bg-purple-500/10 dark:bg-purple-950/20"
                  : "border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#081225] hover:border-purple-500/30"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Near 52W High
                </span>
                <Target size={14} className="text-purple-400" />
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-xl font-extrabold text-purple-600 dark:text-purple-400 font-mono">
                  {summary.near_52w_high_count?.toLocaleString() ?? "—"}
                </span>
                <span className="text-[10px] text-purple-500 font-sans">Coiled Setups</span>
              </div>
              <div className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                Within ≤ 6% of 52W High
              </div>
            </div>
          </div>
        )}

        {/* DATA TABLE */}
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#060D1A] shadow-xs dark:shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
              <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#09152A] text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 select-none">
                <tr>
                  <th className="px-4 py-3 font-semibold">Symbol & Company</th>
                  <th
                    onClick={() => handleSort("current_price")}
                    className="px-3 py-3 font-semibold cursor-pointer hover:text-white transition"
                  >
                    <div className="flex items-center gap-1">
                      <span>CMP / 52W High</span>
                      <ArrowUpDown size={11} />
                    </div>
                  </th>
                  <th className="px-3 py-3 font-semibold">Trend (90D)</th>
                  <th
                    onClick={() => handleSort("canslim_score")}
                    className="px-3 py-3 font-semibold cursor-pointer hover:text-white transition"
                  >
                    <div className="flex items-center gap-1">
                      <span>CANSLIM Score</span>
                      <ArrowUpDown size={11} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("funda_score")}
                    className="px-3 py-3 font-semibold cursor-pointer hover:text-white transition"
                    title="Click to sort by Fundamental Score"
                  >
                    <div className="flex items-center gap-1">
                      <span>Dual Score [F | T]</span>
                      <ArrowUpDown size={11} />
                    </div>
                  </th>
                  <th className="px-3 py-3 font-semibold">Archetype</th>
                  <th
                    onClick={() => handleSort("quarterly_pat_yoy")}
                    className="px-3 py-3 font-semibold cursor-pointer hover:text-white transition"
                  >
                    <div className="flex items-center gap-1">
                      <span>Current Qtr (C)</span>
                      <ArrowUpDown size={11} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("roce")}
                    className="px-3 py-3 font-semibold cursor-pointer hover:text-white transition"
                  >
                    <div className="flex items-center gap-1">
                      <span>Annual (A & S)</span>
                      <ArrowUpDown size={11} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("institutional_holding")}
                    className="px-3 py-3 font-semibold cursor-pointer hover:text-white transition"
                  >
                    <div className="flex items-center gap-1">
                      <span>Inst. (I)</span>
                      <ArrowUpDown size={11} />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("minervini_pass_count")}
                    className="px-3 py-3 font-semibold cursor-pointer hover:text-white transition"
                    title="Click to sort by Minervini Criteria Pass Count"
                  >
                    <div className="flex items-center gap-1">
                      <span>Minervini Criteria</span>
                      <ArrowUpDown size={11} />
                    </div>
                  </th>
                  <th className="px-3 py-3 font-semibold">Execution Plan</th>
                  <th className="px-4 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono text-[12px]">
                {loading ? (
                  <tr>
                    <td colSpan={12} className="py-14 text-center text-slate-400 dark:text-slate-500 font-sans">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Activity className="h-6 w-6 animate-spin text-emerald-500 dark:text-emerald-400" />
                        <span>Evaluating CANSLIM growth acceleration and Stage-2 momentum...</span>
                      </div>
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-14 text-center font-sans">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800/80 border border-slate-700 text-slate-400">
                          <Target size={24} />
                        </div>
                        <div className="max-w-md">
                          <div className="text-sm font-bold text-white">No Matching CANSLIM Equities Found</div>
                          <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                            No equities currently match the confluence criteria for preset{" "}
                            <span className="font-semibold text-emerald-400">
                              {STRATEGY_PRESETS.find((p) => p.id === activePreset)?.label || activePreset}
                            </span>
                            {selectedSector !== "ALL" && (
                              <span> in sector <span className="font-semibold text-cyan-400">{selectedSector}</span></span>
                            )}
                            {debouncedSearch && (
                              <span> with search &ldquo;<span className="font-semibold text-amber-400">{debouncedSearch}</span>&rdquo;</span>
                            )}.
                          </p>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          {(activePreset !== "ALL" || selectedSector !== "ALL" || search) && (
                            <button
                              onClick={() => {
                                setActivePreset("ALL");
                                setSelectedSector("ALL");
                                setSearch("");
                                setPage(1);
                              }}
                              className="flex items-center gap-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/25 transition"
                            >
                              <span>Reset All Filters</span>
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setActivePreset("CANSLIM_TITANS");
                              setSelectedSector("ALL");
                              setSearch("");
                              setPage(1);
                            }}
                            className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white transition"
                          >
                            View CANSLIM Titans (87)
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedStock(item)}
                      className="cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-800/40 group"
                    >
                      {/* SYMBOL */}
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-2">
                          <AddToWatchlistButton
                            symbol={item.symbol}
                            companyName={item.company_name}
                            currentPrice={item.current_price}
                            variant="star"
                          />
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span
                                onClick={() => setSelectedStock(item)}
                                className="font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition hover:underline cursor-pointer"
                              >
                                {item.symbol}
                              </span>
                              {item.is_top_1_percent && (
                                <span className="rounded bg-amber-500/15 border border-amber-500/40 px-1.5 py-0.2 text-[9px] font-sans font-bold text-amber-400 animate-pulse">
                                  ★ TOP 1%
                                </span>
                              )}
                              {item.market_cap_category && (
                                <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.2 text-[9px] font-sans font-medium text-slate-500 dark:text-slate-400">
                                  {item.market_cap_category}
                                </span>
                              )}
                            </div>
                            <div className="font-sans text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 max-w-[140px]">
                              {item.company_name}
                            </div>
                            <div className="text-[10px] text-cyan-600 dark:text-cyan-400/80 font-sans line-clamp-1">
                              {item.sector}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* CMP & 52W HIGH RANGE */}
                      <td className="px-3 py-3">
                        <div className="font-bold text-slate-900 dark:text-white">
                          ₹{item.current_price?.toLocaleString()}
                        </div>
                        <div className="text-[10px] flex items-center gap-1">
                          <span
                            className={
                              (item.dist_52w_high_pct || 0) <= 5.0
                                ? "text-emerald-400 font-bold"
                                : (item.dist_52w_high_pct || 0) <= 12.0
                                ? "text-cyan-400"
                                : "text-slate-400"
                            }
                          >
                            -{item.dist_52w_high_pct}%
                          </span>
                          <span className="text-slate-500 font-sans">of 52W High</span>
                        </div>
                        {item.high_52_week && (
                          <div className="text-[10px] text-slate-500 font-sans">
                            ₹{item.high_52_week.toLocaleString()}
                          </div>
                        )}
                      </td>

                      {/* TREND SPARKLINE */}
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        <SparklineChart
                          data={(item as any).sparkline}
                          cmp={item.current_price}
                          return90d={(item as any).return_90d_pct}
                          return3m={item.return_3m}
                          width={75}
                          height={20}
                          periodLabel="90D"
                          showDot={true}
                          showBadge={true}
                        />
                      </td>

                      {/* CANSLIM SCORE */}
                      <td className="px-3 py-3 font-sans">
                        <div className="flex flex-col gap-0.5">
                          <span
                            className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-bold font-mono border ${
                              item.canslim_score >= 88
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                : item.canslim_score >= 78
                                ? "bg-cyan-500/10 text-cyan-300 border-cyan-500/30"
                                : "bg-amber-500/10 text-amber-300 border-amber-500/30"
                            }`}
                          >
                            <Flame size={12} className={item.canslim_score >= 88 ? "text-emerald-400" : "text-cyan-400"} />
                            <span>{item.canslim_score}/100</span>
                          </span>
                          {item.sniper_alpha_score ? (
                            <div className="text-[10px] text-amber-400 font-mono font-bold tracking-tight">
                              Sniper: {item.sniper_alpha_score}
                            </div>
                          ) : (
                            <div className="text-[10px] text-slate-500 font-mono tracking-tight">
                              C:{item.c_score} A:{item.a_score} N:{item.n_score}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* DUAL SCORE [F | T] */}
                      <td className="px-3 py-3 font-sans">
                        <div className="flex items-center gap-1 font-mono text-[11px]">
                          <span className="text-emerald-400 font-semibold" title="Fundamental Score (out of 50)">
                            F:{item.funda_score}
                          </span>
                          <span className="text-slate-600">|</span>
                          <span className="text-cyan-400 font-semibold" title="Technical Stage-2 Score (out of 50)">
                            T:{item.techno_score}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-sans">
                          {item.funda_score >= 40 && item.techno_score >= 40
                            ? "Elite Confluence"
                            : item.funda_score >= 40
                            ? "Funda Driven"
                            : "Momentum Driven"}
                        </div>
                      </td>

                      {/* ARCHETYPE */}
                      <td className="px-3 py-3 font-sans">
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold border ${
                            item.archetype === "CANSLIM_TITAN"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : item.archetype === "EARNINGS_ACCELERATOR"
                              ? "bg-cyan-500/10 text-cyan-300 border-cyan-500/30"
                              : item.archetype === "NEW_HIGH_BREAKOUT"
                              ? "bg-purple-500/10 text-purple-300 border-purple-500/30"
                              : item.archetype === "INSTITUTIONAL_LEADER"
                              ? "bg-blue-500/10 text-blue-300 border-blue-500/30"
                              : "bg-slate-800 text-slate-300 border-slate-700"
                          }`}
                        >
                          {item.archetype_label || item.archetype}
                        </span>
                      </td>

                      {/* CURRENT QUARTER (C) */}
                      <td className="px-3 py-3 font-mono text-[11px]">
                        <div className="flex flex-col">
                          <span
                            className={
                              (item.quarterly_pat_yoy || 0) >= 50
                                ? "text-emerald-400 font-bold"
                                : (item.quarterly_pat_yoy || 0) >= 25
                                ? "text-cyan-300 font-semibold"
                                : "text-slate-300"
                            }
                          >
                            PAT: +{item.quarterly_pat_yoy ?? "—"}%
                          </span>
                          <span className="text-[10px] text-slate-500">
                            Sales: +{item.quarterly_sales_yoy ?? "—"}%
                          </span>
                        </div>
                      </td>

                      {/* ANNUAL (A & S) */}
                      <td className="px-3 py-3 font-mono text-[11px]">
                        <div className="flex flex-col">
                          <span
                            className={
                              (item.roce || 0) >= 25
                                ? "text-emerald-400 font-bold"
                                : (item.roce || 0) >= 18
                                ? "text-cyan-300"
                                : "text-slate-300"
                            }
                          >
                            ROCE: {item.roce ? `${item.roce}%` : "—"}
                          </span>
                          <span className="text-[10px] text-slate-500 font-sans">
                            Piotroski {item.piotroski_score ? `${item.piotroski_score}/9` : "—"}
                          </span>
                        </div>
                      </td>

                      {/* INSTITUTIONAL (I) */}
                      <td className="px-3 py-3 font-sans">
                        <div className="flex items-center gap-1 font-mono text-[11px]">
                          <ShieldCheck
                            size={12}
                            className={
                              (item.institutional_holding || 0) >= 25
                                ? "text-emerald-400"
                                : (item.institutional_holding || 0) >= 15
                                ? "text-cyan-400"
                                : "text-slate-500"
                            }
                          />
                          <span className="text-slate-200 font-semibold">
                            {item.institutional_holding ? `${item.institutional_holding}%` : "—"}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          FII: {item.fii_holding || 0}%
                        </div>
                      </td>

                      {/* MINERVINI CRITERIA */}
                      <td className="px-3 py-3 font-sans">
                        <span
                          className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold border ${
                            (item.minervini_pass_count || 0) >= 7
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : (item.minervini_pass_count || 0) >= 5
                              ? "bg-cyan-500/10 text-cyan-300 border-cyan-500/30"
                              : "bg-slate-800 text-slate-400 border-slate-700"
                          }`}
                        >
                          <CheckCircle2 size={11} />
                          <span>{item.minervini_pass_count || 0}/8 Passed</span>
                        </span>
                      </td>

                      {/* EXECUTION PLAN */}
                      <td className="px-3 py-3 font-mono text-[11px]">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-cyan-400 font-semibold">
                            Piv: ₹{item.pivot_reference?.toLocaleString()}
                          </span>
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                            <span className="text-rose-400/90 font-mono">SL: ₹{item.downside_reference}</span>
                            <span>•</span>
                            <span className="text-emerald-400/90 font-mono">R:R {item.risk_reward}:1</span>
                          </div>
                        </div>
                      </td>

                      {/* ACTIONS */}
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedStock(item)}
                            className="rounded bg-emerald-500/10 border border-emerald-500/30 px-2 py-1 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500 hover:text-slate-950 transition"
                            title="Inspect CANSLIM Checklist & Position Sizing"
                          >
                            <span>Inspect</span>
                          </button>
                          <Link
                            href={`/techno-funda/${encodeURIComponent(item.symbol)}?from=${encodeURIComponent(
                              typeof window !== "undefined" ? window.location.pathname + window.location.search : "/techno-funda"
                            )}`}
                            className="rounded bg-slate-800 border border-slate-700 px-2 py-1 text-[11px] font-medium text-slate-300 hover:border-cyan-500 hover:text-white transition"
                            title="Full Stock Terminal"
                          >
                            <ExternalLink size={12} />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* PAGINATION */}
          <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#081225] px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
            <div>
              Showing <span className="font-semibold text-slate-900 dark:text-white">{items.length}</span> of{" "}
              <span className="font-semibold text-slate-900 dark:text-white">{totalCount}</span> CANSLIM candidates
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1 font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40"
              >
                Previous
              </button>
              <span>
                Page <strong className="text-slate-900 dark:text-white">{page}</strong> of <strong>{totalPages}</strong>
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-1 font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {/* QUICK INSPECTION SLIDE-OVER DRAWER */}
        {selectedStock && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
            <div
              className="relative flex h-full w-full max-w-xl flex-col bg-[#060D1A] border-l border-slate-800 shadow-2xl p-6 overflow-y-auto animate-in slide-in-from-right duration-300"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drawer Header */}
              <div className="flex items-start justify-between border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold tracking-tight text-white font-mono">
                      {selectedStock.symbol}
                    </span>
                    <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-semibold text-emerald-400">
                      CANSLIM {selectedStock.canslim_score}/100
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-slate-400 font-sans">
                    {selectedStock.company_name} • {selectedStock.sector}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <AddToWatchlistButton
                    symbol={selectedStock.symbol}
                    companyName={selectedStock.company_name}
                    currentPrice={selectedStock.current_price}
                    variant="star"
                  />
                  <button
                    onClick={() => setSelectedStock(null)}
                    className="rounded-lg bg-slate-800/80 p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Price & Quick Telemetry Header */}
              <div className="mt-4 grid grid-cols-3 gap-2.5 rounded-xl border border-slate-800/80 bg-slate-900/60 p-3 font-mono">
                <div>
                  <div className="text-[10px] text-slate-500 uppercase">CMP</div>
                  <div className="text-base font-bold text-white">₹{selectedStock.current_price?.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase">52W High</div>
                  <div className="text-sm font-semibold text-slate-300">
                    ₹{selectedStock.high_52_week?.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-emerald-400">-{selectedStock.dist_52w_high_pct}% away</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500 uppercase">Dual Conviction</div>
                  <div className="text-sm font-semibold text-cyan-300">
                    F:{selectedStock.funda_score} | T:{selectedStock.techno_score}
                  </div>
                  <div className="text-[10px] text-slate-400">out of 50 each</div>
                </div>
              </div>

              {/* CANSLIM 6-FACTOR CHECKLIST CARDS */}
              <div className="mt-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-300">
                    <Flame size={14} className="text-emerald-400" />
                    <span>CANSLIM 6-Pillar Breakdown</span>
                  </div>
                  <span className="text-[11px] text-slate-500">William O'Neil Institutional Matrix</span>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {selectedStock.canslim_checklist &&
                    Object.entries(selectedStock.canslim_checklist).map(([key, item]) => {
                      const isPass = item.status === "PASS";
                      const isWarn = item.status === "WARN";
                      return (
                        <div
                          key={key}
                          className={`rounded-xl border p-3 flex flex-col justify-between ${
                            isPass
                              ? "border-emerald-500/30 bg-emerald-950/10"
                              : isWarn
                              ? "border-amber-500/30 bg-amber-950/10"
                              : "border-slate-800 bg-slate-900/40"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 font-mono text-xs font-bold text-white">
                              <span
                                className={`flex h-5 w-5 items-center justify-center rounded text-[11px] font-bold ${
                                  isPass ? "bg-emerald-500 text-slate-950" : "bg-slate-800 text-slate-300"
                                }`}
                              >
                                {key}
                              </span>
                              <span>{item.title}</span>
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">
                              {item.points}/{item.max_points} pts
                            </span>
                          </div>

                          <div className="mt-2">
                            <div className="text-xs font-bold text-slate-200">{item.value}</div>
                            <div className="text-[10px] text-slate-400 font-sans mt-0.5">{item.detail}</div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* MINERVINI 8-POINT CRITERIA GRID */}
              <div className="mt-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-300">
                    <CheckCircle2 size={14} className="text-cyan-400" />
                    <span>Minervini Trend Template ({selectedStock.minervini_pass_count || 0}/8 Passed)</span>
                  </div>
                </div>

                <div className="mt-2.5 grid grid-cols-2 gap-2 text-[11px] font-sans">
                  {selectedStock.minervini_criteria && (
                    <>
                      <div
                        className={`rounded-lg border px-2.5 py-1.5 flex items-center gap-1.5 ${
                          selectedStock.minervini_criteria.cmp_above_50
                            ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300"
                            : "border-slate-800 bg-slate-900/40 text-slate-500"
                        }`}
                      >
                        <CheckCircle2 size={13} />
                        <span>CMP above 50 DMA</span>
                      </div>

                      <div
                        className={`rounded-lg border px-2.5 py-1.5 flex items-center gap-1.5 ${
                          selectedStock.minervini_criteria.cmp_above_150_200
                            ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300"
                            : "border-slate-800 bg-slate-900/40 text-slate-500"
                        }`}
                      >
                        <CheckCircle2 size={13} />
                        <span>CMP above 200 DMA</span>
                      </div>

                      <div
                        className={`rounded-lg border px-2.5 py-1.5 flex items-center gap-1.5 ${
                          selectedStock.minervini_criteria.dma_50_above_200
                            ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300"
                            : "border-slate-800 bg-slate-900/40 text-slate-500"
                        }`}
                      >
                        <CheckCircle2 size={13} />
                        <span>50 DMA &gt; 200 DMA</span>
                      </div>

                      <div
                        className={`rounded-lg border px-2.5 py-1.5 flex items-center gap-1.5 ${
                          selectedStock.minervini_criteria.cmp_within_52w_high_25pct
                            ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300"
                            : "border-slate-800 bg-slate-900/40 text-slate-500"
                        }`}
                      >
                        <CheckCircle2 size={13} />
                        <span>Within 25% of 52W High</span>
                      </div>

                      <div
                        className={`rounded-lg border px-2.5 py-1.5 flex items-center gap-1.5 ${
                          selectedStock.minervini_criteria.cmp_above_52w_low_30pct
                            ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300"
                            : "border-slate-800 bg-slate-900/40 text-slate-500"
                        }`}
                      >
                        <CheckCircle2 size={13} />
                        <span>≥ 30% above 52W Low</span>
                      </div>

                      <div
                        className={`rounded-lg border px-2.5 py-1.5 flex items-center gap-1.5 ${
                          selectedStock.minervini_criteria.rs_momentum_pass
                            ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300"
                            : "border-slate-800 bg-slate-900/40 text-slate-500"
                        }`}
                      >
                        <CheckCircle2 size={13} />
                        <span>RSI Launchpad (50-68)</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* ASYMMETRIC TRADE EXECUTION & POSITION SIZING */}
              <div className="mt-5 rounded-xl border border-slate-800 bg-slate-900/80 p-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-200">
                    <Calculator size={14} className="text-emerald-400" />
                    <span>Trade Execution & Position Sizing</span>
                  </div>
                  <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 font-mono">
                    R:R {selectedStock.risk_reward}:1 Asymmetric
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-4 gap-2 text-center font-mono">
                  <div className="rounded-lg bg-slate-950 p-2 border border-slate-800">
                    <div className="text-[10px] text-slate-500">Trigger Buy</div>
                    <div className="text-xs font-bold text-cyan-400">₹{selectedStock.scenario_trigger}</div>
                  </div>
                  <div className="rounded-lg bg-slate-950 p-2 border border-slate-800">
                    <div className="text-[10px] text-slate-500">Stop Loss</div>
                    <div className="text-xs font-bold text-rose-400">₹{selectedStock.downside_reference}</div>
                    <div className="text-[9px] text-slate-500">-{selectedStock.downside_pct}%</div>
                  </div>
                  <div className="rounded-lg bg-slate-950 p-2 border border-slate-800">
                    <div className="text-[10px] text-slate-500">Target 1 (1:2)</div>
                    <div className="text-xs font-bold text-emerald-400">₹{selectedStock.target_1}</div>
                  </div>
                  <div className="rounded-lg bg-slate-950 p-2 border border-slate-800">
                    <div className="text-[10px] text-slate-500">Target 2 (1:3)</div>
                    <div className="text-xs font-bold text-emerald-300">₹{selectedStock.target_2}</div>
                  </div>
                </div>

                {/* Interactive Account Risk Calculator */}
                <div className="mt-4 pt-3 border-t border-slate-800/80">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-sans">Max Account Risk (₹):</span>
                    <div className="flex items-center gap-2">
                      {[5000, 10000, 25000, 50000].map((amt) => (
                        <button
                          key={amt}
                          onClick={() => setAccountRiskRupees(amt)}
                          className={`rounded px-2 py-0.5 text-[10px] font-mono transition ${
                            accountRiskRupees === amt
                              ? "bg-emerald-500 text-slate-950 font-bold"
                              : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                          }`}
                        >
                          ₹{(amt / 1000).toFixed(0)}k
                        </button>
                      ))}
                    </div>
                  </div>

                  {sizingCalculation && (
                    <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-slate-950/80 p-2.5 font-mono text-center border border-slate-800">
                      <div>
                        <div className="text-[10px] text-slate-500">Shares to Buy</div>
                        <div className="text-sm font-bold text-emerald-400">
                          {sizingCalculation.sharesToBuy.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500">Capital Needed</div>
                        <div className="text-sm font-bold text-slate-200">
                          ₹{Math.round(sizingCalculation.totalCapital).toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-500">Profit at T1</div>
                        <div className="text-sm font-bold text-emerald-400">
                          +₹{Math.round(sizingCalculation.profitTarget1).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 flex items-center gap-3">
                <Link
                  href={`/techno-funda/${encodeURIComponent(selectedStock.symbol)}?from=${encodeURIComponent(
                    typeof window !== "undefined" ? window.location.pathname + window.location.search : "/techno-funda"
                  )}`}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-2.5 text-xs font-bold text-slate-950 transition hover:bg-emerald-400 shadow-md shadow-emerald-500/20"
                >
                  <Activity size={14} />
                  <span>Full {selectedStock.symbol} CANSLIM Terminal</span>
                  <ArrowUpRight size={14} />
                </Link>

                <a
                  href={`https://in.tradingview.com/symbols/NSE-${encodeURIComponent(selectedStock.symbol)}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-700 transition flex items-center gap-1.5"
                >
                  <ExternalLink size={14} />
                  <span>TradingView</span>
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

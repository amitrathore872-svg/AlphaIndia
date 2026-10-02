"use client";

// =======================================================
// Alpha India — Order Win Radar & Cumulative Backlog Terminal
// Institutional contract sizing, cumulative backlog intelligence,
// Book-to-Bill multiple vs TTM revenue, order velocity & forward price targets
// Bloomberg dark aesthetic · cyan/emerald/amber/purple accents
// =======================================================

import { useEffect, useState, useCallback, useMemo, Fragment } from "react";
import Link from "next/link";
import {
  Trophy,
  TrendingUp,
  Clock,
  Sparkles,
  Layers,
  Award,
  Zap,
  Target,
  Calendar,
  ExternalLink,
  RotateCcw,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  ArrowUpDown,
  ArrowUpRight,
  ArrowRight,
  Send,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Maximize2,
  BarChart3,
  LayoutGrid,
  Table as TableIcon,
  ShieldCheck,
  Check,
  AlertCircle,
  FileText,
  Building2,
  Briefcase,
  Landmark,
  Flame,
  Activity,
  Compass,
} from "lucide-react";

import DashboardLayout from "@/components/layout/DashboardLayout";
import {
  PageHeader,
  ActionButton,
  LoadingSpinner,
  EmptyState,
} from "@/components/common";
import OrderWinCard from "@/components/announcements/OrderWinCard";
import OrderWaterfallDrawer from "@/components/announcements/OrderWaterfallDrawer";
import {
  fetchAnnouncements,
  fetchOrderWinAnalytics,
  fetchCumulativeOrderBooks,
  triggerOrderWinsAnalysis,
  triggerAnnouncementsSync,
  sendTelegramAlert,
  type AnnouncementRadarItem,
  type OrderWinAnalytics,
  type OrderSignificanceTier,
  type CumulativeCompanyOrderBook,
  type CumulativeBacklogSummary,
  type CumulativeOrderSummary,
} from "@/lib/announcementsApi";

type MainTab = "company_leaderboard" | "single_orders";
type ViewMode = "cards" | "table";

const TIER_CONFIG: Record<
  string,
  { label: string; tier: OrderSignificanceTier | ""; color: string; border: string; bg: string; dot: string; desc: string }
> = {
  ALL: {
    label: "All Orders",
    tier: "",
    color: "text-slate-200",
    border: "border-slate-700",
    bg: "bg-slate-900/80",
    dot: "bg-slate-400",
    desc: "Complete tracked universe of commercial order filings",
  },
  TRANSFORMATIONAL: {
    label: "Transformational",
    tier: "TRANSFORMATIONAL",
    color: "text-purple-300",
    border: "border-purple-500/40",
    bg: "bg-purple-950/20",
    dot: "bg-purple-400 shadow-purple-500/50 shadow-sm",
    desc: "Mega contracts >50% TTM sales altering forward earnings trajectory",
  },
  HIGH_IMPACT: {
    label: "High Impact",
    tier: "HIGH_IMPACT",
    color: "text-amber-300",
    border: "border-amber-500/40",
    bg: "bg-amber-950/20",
    dot: "bg-amber-400 shadow-amber-500/50 shadow-sm",
    desc: "Substantial revenue lift (20–50% TTM sales) & multi-quarter runway",
  },
  MODERATE: {
    label: "Moderate",
    tier: "MODERATE",
    color: "text-cyan-300",
    border: "border-cyan-500/40",
    bg: "bg-cyan-950/20",
    dot: "bg-cyan-400 shadow-cyan-500/50 shadow-sm",
    desc: "Steady backlog replenishment (5–20% TTM sales)",
  },
  ROUTINE: {
    label: "Routine",
    tier: "ROUTINE",
    color: "text-slate-400",
    border: "border-slate-800",
    bg: "bg-slate-900/30",
    dot: "bg-slate-500",
    desc: "Standard recurring operational orders (<5% TTM sales)",
  },
};

const STRENGTH_TIERS: Record<
  string,
  { label: string; color: string; border: string; bg: string; dot: string; desc: string }
> = {
  TRANSFORMATIONAL_SURGE: {
    label: "Transformational Surge",
    color: "text-purple-300",
    border: "border-purple-500/40",
    bg: "bg-purple-950/30",
    dot: "bg-purple-400 shadow-purple-500/50 shadow-sm",
    desc: "Backlog ≥1.5x TTM Revenue or mega order book exceeding ₹2,000 Cr",
  },
  HIGH_VISIBILITY: {
    label: "High Visibility",
    color: "text-emerald-300",
    border: "border-emerald-500/40",
    bg: "bg-emerald-950/30",
    dot: "bg-emerald-400 shadow-emerald-500/50 shadow-sm",
    desc: "Backlog 0.75x–1.5x TTM Revenue providing multi-quarter earnings lock",
  },
  EXPANDING_BACKLOG: {
    label: "Expanding Backlog",
    color: "text-cyan-300",
    border: "border-cyan-500/40",
    bg: "bg-cyan-950/30",
    dot: "bg-cyan-400 shadow-cyan-500/50 shadow-sm",
    desc: "Steady backlog accumulation (0.3x–0.75x TTM Revenue)",
  },
  STEADY_REPLENISHMENT: {
    label: "Steady Replenishment",
    color: "text-slate-400",
    border: "border-slate-800",
    bg: "bg-slate-900/40",
    dot: "bg-slate-500",
    desc: "Operational replacement orders maintaining run-rate",
  },
};

export default function OrderWinsPage() {
  // Top-Level Navigation
  const [activeTab, setActiveTab] = useState<MainTab>("company_leaderboard");

  // State: Cumulative Company Order Books
  const [cumulativeBooks, setCumulativeBooks] = useState<CumulativeCompanyOrderBook[]>([]);
  const [cumulativeSummary, setCumulativeSummary] = useState<CumulativeBacklogSummary | null>(null);
  const [cumulativeLoading, setCumulativeLoading] = useState<boolean>(true);
  const [cumulativeSearch, setCumulativeSearch] = useState<string>("");
  const [cumulativePreset, setCumulativePreset] = useState<string>("ALL");
  const [cumulativeTier, setCumulativeTier] = useState<string>("ALL");
  const [cumulativeVelocity, setCumulativeVelocity] = useState<string>("ALL");
  const [cumulativeSovereignOnly, setCumulativeSovereignOnly] = useState<boolean>(false);
  const [cumulativeMinDealCr, setCumulativeMinDealCr] = useState<number | undefined>(undefined);
  const [cumulativeMinB2B, setCumulativeMinB2B] = useState<number | undefined>(undefined);
  const [cumulativeSortBy, setCumulativeSortBy] = useState<string>("total_deal_cr");
  const [cumulativeSortOrder, setCumulativeSortOrder] = useState<"asc" | "desc">("desc");
  const [cumulativePage, setCumulativePage] = useState<number>(1);
  const [cumulativeTotalCount, setCumulativeTotalCount] = useState<number>(0);
  const [expandedCompanyKey, setExpandedCompanyKey] = useState<string | null>(null);

  // State: Individual Single Orders
  const [items, setItems] = useState<AnnouncementRadarItem[]>([]);
  const [analytics, setAnalytics] = useState<OrderWinAnalytics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [analyzingAll, setAnalyzingAll] = useState<boolean>(false);
  const [syncingExchange, setSyncingExchange] = useState<boolean>(false);

  // State: Filters for Single Orders
  const [selectedTier, setSelectedTier] = useState<OrderSignificanceTier | "">("");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedPreset, setSelectedPreset] = useState<string>("ALL");
  const [minDealCr, setMinDealCr] = useState<number | undefined>(undefined);
  const [minRevPct, setMinRevPct] = useState<number | undefined>(undefined);
  const [counterpartyFilter, setCounterpartyFilter] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("announcement_date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState<number>(1);
  const pageSize = 40;

  // State: Drawer & Notification
  const [selectedDrawerItem, setSelectedDrawerItem] = useState<AnnouncementRadarItem | null>(null);
  const [notification, setNotification] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  const showNotification = (type: "success" | "error" | "info", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4500);
  };

  // Pre-index cumulative backlog lookup by symbol / company name for single orders cross-referencing
  const companyCumulativeMap = useMemo(() => {
    const map = new Map<string, CumulativeCompanyOrderBook>();
    for (const b of cumulativeBooks) {
      if (b.symbol) {
        map.set(b.symbol.toUpperCase(), b);
        map.set(b.symbol.replace(/\.NS$|\.BO$/i, "").toUpperCase(), b);
      }
      if (b.company_name) {
        map.set(b.company_name.toLowerCase().trim(), b);
      }
    }
    return map;
  }, [cumulativeBooks]);

  // Load cumulative order books
  const loadCumulativeBooks = useCallback(async () => {
    setCumulativeLoading(true);
    try {
      const res = await fetchCumulativeOrderBooks({
        min_deal_cr: cumulativeMinDealCr,
        min_book_to_bill: cumulativeMinB2B,
        order_velocity: cumulativeVelocity === "ALL" ? undefined : cumulativeVelocity,
        strength_tier: cumulativeTier === "ALL" ? undefined : cumulativeTier,
        sovereign_only: cumulativeSovereignOnly,
        search: cumulativeSearch.trim() || undefined,
        sort_by: cumulativeSortBy,
        sort_order: cumulativeSortOrder,
        page: cumulativePage,
        limit: 30,
      });
      setCumulativeBooks(res.items || []);
      setCumulativeSummary(res.summary || null);
      setCumulativeTotalCount(res.total_companies || 0);
    } catch (err) {
      console.error("Failed to load cumulative order books:", err);
      showNotification("error", "Failed to load company cumulative order books.");
    } finally {
      setCumulativeLoading(false);
    }
  }, [
    cumulativeMinDealCr,
    cumulativeMinB2B,
    cumulativeVelocity,
    cumulativeTier,
    cumulativeSovereignOnly,
    cumulativeSearch,
    cumulativeSortBy,
    cumulativeSortOrder,
    cumulativePage,
  ]);

  // Load single orders list
  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchAnnouncements({
        catalyst_type: "ORDER_WIN",
        order_tier: selectedTier || undefined,
        deal_value_min: minDealCr,
        rev_pct_min: minRevPct,
        search: (counterpartyFilter ? `${counterpartyFilter} ${searchQuery}` : searchQuery).trim() || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
        page,
        limit: pageSize,
      });
      setItems(res || []);
    } catch (err) {
      console.error("Failed to fetch single order wins:", err);
      showNotification("error", "Failed to load order win filings. Check backend connection.");
    } finally {
      setLoading(false);
    }
  }, [selectedTier, minDealCr, minRevPct, counterpartyFilter, searchQuery, sortBy, sortOrder, page]);

  // Load analytics summary
  const loadAnalytics = useCallback(async () => {
    try {
      const data = await fetchOrderWinAnalytics();
      setAnalytics(data);
    } catch (err) {
      console.error("Failed to load order win analytics:", err);
    }
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  useEffect(() => {
    loadCumulativeBooks();
  }, [loadCumulativeBooks]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Handle Preset Filters for Cumulative Leaderboard
  const handleApplyCumulativePreset = (preset: string) => {
    setCumulativePreset(preset);
    setCumulativePage(1);

    if (preset === "ALL") {
      setCumulativeTier("ALL");
      setCumulativeVelocity("ALL");
      setCumulativeSovereignOnly(false);
      setCumulativeMinDealCr(undefined);
      setCumulativeMinB2B(undefined);
    } else if (preset === "TRANSFORMATIONAL") {
      setCumulativeTier("TRANSFORMATIONAL_SURGE");
      setCumulativeVelocity("ALL");
      setCumulativeSovereignOnly(false);
      setCumulativeMinDealCr(undefined);
      setCumulativeMinB2B(undefined);
    } else if (preset === "SURGING_30D") {
      setCumulativeTier("ALL");
      setCumulativeVelocity("SURGING_30D");
      setCumulativeSovereignOnly(false);
      setCumulativeMinDealCr(undefined);
      setCumulativeMinB2B(undefined);
    } else if (preset === "SOVEREIGN") {
      setCumulativeTier("ALL");
      setCumulativeVelocity("ALL");
      setCumulativeSovereignOnly(true);
      setCumulativeMinDealCr(undefined);
      setCumulativeMinB2B(undefined);
    } else if (preset === "MEGA_500CR") {
      setCumulativeTier("ALL");
      setCumulativeVelocity("ALL");
      setCumulativeSovereignOnly(false);
      setCumulativeMinDealCr(500);
      setCumulativeMinB2B(undefined);
    }
  };

  // Handle Preset Filters for Single Orders
  const handleApplyPreset = (preset: string) => {
    setSelectedPreset(preset);
    setPage(1);

    if (preset === "ALL") {
      setSelectedTier("");
      setMinDealCr(undefined);
      setMinRevPct(undefined);
      setCounterpartyFilter("");
    } else if (preset === "MEGA") {
      setMinDealCr(500);
      setMinRevPct(undefined);
      setCounterpartyFilter("");
    } else if (preset === "GAME_CHANGER") {
      setMinDealCr(undefined);
      setMinRevPct(25.0);
      setCounterpartyFilter("");
    } else if (preset === "SOVEREIGN") {
      setMinDealCr(undefined);
      setMinRevPct(undefined);
      setCounterpartyFilter("Railways OR NHAI OR ONGC OR SECI OR Defence OR Transco");
    } else if (preset === "TRANSFORMATIONAL") {
      setSelectedTier("TRANSFORMATIONAL");
      setMinDealCr(undefined);
      setMinRevPct(undefined);
      setCounterpartyFilter("");
    }
  };

  // Action: Switch to Single Orders filtered by company
  const handleDrilldownCompany = (company: CumulativeCompanyOrderBook) => {
    setActiveTab("single_orders");
    setSearchQuery(company.symbol || company.company_name);
    setPage(1);
    showNotification("info", `Showing all individual order disclosures for ${company.symbol || company.company_name}`);
  };

  // Action: Switch to Cumulative Leaderboard filtered by company
  const handleInspectCompanyBacklog = (symbolOrName: string) => {
    setActiveTab("company_leaderboard");
    setCumulativeSearch(symbolOrName);
    setCumulativePage(1);
    showNotification("info", `Viewing cumulative order book for ${symbolOrName}`);
  };

  // Trigger systematic re-analysis
  const handleReanalyzeAll = async () => {
    setAnalyzingAll(true);
    showNotification("info", "Executing quantitative AI model across all order disclosures...");
    try {
      const res = await triggerOrderWinsAnalysis(1500);
      showNotification("success", res.message || "Processed all order wins into institutional AI cards.");
      await Promise.all([loadAnalytics(), loadCumulativeBooks(), loadOrders()]);
    } catch (err) {
      showNotification("error", `Analysis backfill error: ${(err as Error).message}`);
    } finally {
      setAnalyzingAll(false);
    }
  };

  // Trigger exchange poll
  const handleSyncExchange = async () => {
    setSyncingExchange(true);
    showNotification("info", "Connecting to NSE/BSE corporate announcements feed...");
    try {
      const res = await triggerAnnouncementsSync();
      showNotification("success", res.message || "Exchange filings synchronization finished.");
      await Promise.all([loadAnalytics(), loadCumulativeBooks(), loadOrders()]);
    } catch (err) {
      showNotification("error", `Sync error: ${(err as Error).message}`);
    } finally {
      setSyncingExchange(false);
    }
  };

  // Handle Telegram dispatch
  const handleSendTelegramAlert = async (item: AnnouncementRadarItem) => {
    try {
      showNotification("info", `Broadcasting ${item.symbol || item.company_name} Order Win alert to Telegram...`);
      const res = await sendTelegramAlert(item.id);
      showNotification("success", res.message || "Alert dispatched to Telegram desk!");
    } catch (err) {
      showNotification("error", `Failed to dispatch alert: ${(err as Error).message}`);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-5 pb-20">
        {/* ── TOAST NOTIFICATION ────────────────────────────────────────── */}
        {notification && (
          <div
            className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-md transition-all duration-300 ${
              notification.type === "success"
                ? "border-emerald-500/40 bg-emerald-950/90 text-emerald-200"
                : notification.type === "error"
                ? "border-rose-500/40 bg-rose-950/90 text-rose-200"
                : "border-cyan-500/40 bg-cyan-950/90 text-cyan-200"
            }`}
          >
            {notification.type === "success" ? (
              <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
            ) : notification.type === "error" ? (
              <AlertCircle size={18} className="text-rose-400 shrink-0" />
            ) : (
              <Sparkles size={18} className="text-cyan-400 shrink-0" />
            )}
            <span className="text-xs font-medium">{notification.message}</span>
            <button onClick={() => setNotification(null)} className="ml-2 opacity-60 hover:opacity-100">
              <X size={14} />
            </button>
          </div>
        )}

        {/* ── PAGE HEADER ───────────────────────────────────────────────── */}
        <PageHeader
          icon={<Trophy size={20} />}
          iconColor="amber"
          title="New Order Win Screener"
          badge={{ label: "INSTITUTIONAL CONTRACT TERMINAL", color: "cyan" }}
          subtitle="Company-level cumulative order strength, Book-to-Bill multiple vs TTM revenue, order velocity & individual contract disclosures"
          actions={
            <>
              <ActionButton
                onClick={handleSyncExchange}
                disabled={syncingExchange}
                variant="secondary"
              >
                <RefreshCw size={13} className={syncingExchange ? "animate-spin text-cyan-400" : ""} />
                {syncingExchange ? "Syncing..." : "Sync Exchange"}
              </ActionButton>
              <ActionButton
                onClick={handleReanalyzeAll}
                disabled={analyzingAll}
                variant="secondary"
              >
                <Zap size={13} className={analyzingAll ? "animate-pulse text-amber-300" : "text-amber-400"} />
                {analyzingAll ? "Calculating..." : "Re-Score Orders"}
              </ActionButton>
            </>
          }
        />

        {/* ── MAIN TAB SWITCHER (DUAL PERSPECTIVE) ───────────────────── */}
            <div className="mt-6 flex border-b border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setActiveTab("company_leaderboard")}
                className={`flex items-center gap-2 px-5 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
                  activeTab === "company_leaderboard"
                    ? "border-cyan-500 dark:border-cyan-400 text-cyan-700 dark:text-cyan-300 bg-cyan-500/10 font-black"
                    : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900/40"
                }`}
              >
                <Building2 size={15} />
                <span>Company Order Books & Cumulative Strength</span>
                <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-cyan-700 dark:text-cyan-400 border border-slate-200 dark:border-slate-700">
                  {cumulativeTotalCount || 312}
                </span>
              </button>

              <button
                onClick={() => setActiveTab("single_orders")}
                className={`flex items-center gap-2 px-5 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${
                  activeTab === "single_orders"
                    ? "border-amber-500 dark:border-amber-400 text-amber-700 dark:text-amber-300 bg-amber-500/10 font-black"
                    : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900/40"
                }`}
              >
                <Briefcase size={15} />
                <span>Individual Order Feed (Single Orders)</span>
                <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-amber-700 dark:text-amber-400 border border-slate-200 dark:border-slate-700">
                  {analytics?.total_orders || 522}
                </span>
              </button>
            </div>

        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/* TAB 1: COMPANY ORDER BOOKS & CUMULATIVE STRENGTH                     */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        {activeTab === "company_leaderboard" && (
          <div className="flex-1 flex flex-col">
            {/* Filter Toolbar for Cumulative Leaderboard */}
            <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-[#07111F] px-4 py-4 sm:px-8">
              <div className="mx-auto max-w-7xl flex flex-col gap-4">
                {/* Presets */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1">
                      <Filter size={12} className="text-cyan-600 dark:text-cyan-400" />
                      Backlog Presets:
                    </span>
                    {[
                      { id: "ALL", label: "All Companies" },
                      { id: "TRANSFORMATIONAL", label: "⭐ Transformational (≥1.5x TTM / ₹2k Cr)" },
                      { id: "SURGING_30D", label: "🔥 Surging Inflows (Last 30D)" },
                      { id: "SOVEREIGN", label: "🏛️ Sovereign / PSU Clients" },
                      { id: "MEGA_500CR", label: "💎 Backlog ≥₹500 Cr" },
                    ].map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => handleApplyCumulativePreset(preset.id)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                          cumulativePreset === preset.id
                            ? "bg-cyan-500/20 text-cyan-800 dark:text-cyan-300 border border-cyan-500/40"
                            : "bg-white dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 shadow-2xs"
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  {/* Reset Filters */}
                  {(cumulativePreset !== "ALL" || cumulativeSearch) && (
                    <button
                      onClick={() => {
                        handleApplyCumulativePreset("ALL");
                        setCumulativeSearch("");
                      }}
                      className="flex items-center gap-1 text-xs text-rose-500 dark:text-rose-400 hover:text-rose-600 dark:hover:text-rose-300 underline underline-offset-4"
                    >
                      <RotateCcw size={11} />
                      Reset filters
                    </button>
                  )}
                </div>

                {/* Search, Sorters & Velocity */}
                <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
                  {/* Search Box */}
                  <div className="relative flex-1 max-w-md">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                    <input
                      type="text"
                      value={cumulativeSearch}
                      onChange={(e) => {
                        setCumulativeSearch(e.target.value);
                        setCumulativePage(1);
                      }}
                      placeholder="Search company name, symbol, or client..."
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950/80 pl-9 pr-8 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 shadow-2xs"
                    />
                    {cumulativeSearch && (
                      <button
                        onClick={() => setCumulativeSearch("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  {/* Sorting Controls */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Rank by:</span>
                    <select
                      value={cumulativeSortBy}
                      onChange={(e) => setCumulativeSortBy(e.target.value)}
                      className="rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:border-cyan-500 focus:outline-none cursor-pointer shadow-xs"
                    >
                      <option value="total_deal_cr">Cumulative Backlog (₹ Cr)</option>
                      <option value="book_to_bill_multiple">Book-to-Bill Multiple (vs TTM)</option>
                      <option value="order_count">Number of Contracts Won</option>
                      <option value="latest_order_date">Latest Contract Date</option>
                      <option value="total_quarterly_run_rate_cr">Quarterly Run-Rate Lift (+₹ Cr)</option>
                    </select>
                    <button
                      onClick={() => setCumulativeSortOrder(cumulativeSortOrder === "asc" ? "desc" : "asc")}
                      className="rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 p-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white shadow-xs"
                      title={`Toggle sort order (Current: ${cumulativeSortOrder.toUpperCase()})`}
                    >
                      <ArrowUpDown size={14} className={cumulativeSortOrder === "asc" ? "rotate-180 transition-transform" : "transition-transform"} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Main Cumulative Leaderboard Table */}
            <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8 flex-1 w-full">
              {cumulativeLoading ? (
                <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-500">
                  <RefreshCw size={28} className="animate-spin text-cyan-400" />
                  <span className="text-sm font-mono tracking-wide">Calculating cumulative order book strength & Book-to-Bill multiples...</span>
                </div>
              ) : cumulativeBooks.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 p-12 text-center shadow-xs">
                  <Building2 size={40} className="mx-auto text-slate-400 dark:text-slate-600 mb-3" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">No Companies Found</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                    No corporate order books match your filters. Try resetting the presets or clearing search terms.
                  </p>
                  <button
                    onClick={() => handleApplyCumulativePreset("ALL")}
                    className="mt-4 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-xs font-bold text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/20"
                  >
                    Reset Backlog Filters
                  </button>
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 backdrop-blur-md shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                      <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-100/90 dark:bg-slate-900/90 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                        <tr>
                          <th className="px-4 py-3.5">Company & Ticker</th>
                          <th className="px-3 py-3.5 text-center">Strength Tier</th>
                          <th className="px-3 py-3.5 text-center">Contracts</th>
                          <th className="px-3 py-3.5 text-right">Disclosed Backlog</th>
                          <th className="px-3 py-3.5 text-right">Book-to-Bill</th>
                          <th className="px-3 py-3.5 text-center">Velocity</th>
                          <th className="px-3 py-3.5 text-center">Client Profile</th>
                          <th className="px-3 py-3.5">Key Clients</th>
                          <th className="px-3 py-3.5 text-right">Latest Win</th>
                          <th className="px-4 py-3.5 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 font-mono">
                        {cumulativeBooks.map((company) => {
                          const tier = (company.strength_tier || "STEADY_REPLENISHMENT").toUpperCase();
                          const tierStyle = STRENGTH_TIERS[tier] || STRENGTH_TIERS.STEADY_REPLENISHMENT;
                          const compKey = company.symbol || company.company_name;
                          const isExpanded = expandedCompanyKey === compKey;

                          const b2b = company.book_to_bill_multiple;
                          const runway = company.backlog_coverage_years;
                          const sovPct = company.sovereign_client_pct;
                          const latestDate = company.latest_order_date
                            ? new Date(company.latest_order_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" })
                            : "—";

                          return (
                            <Fragment key={compKey}>
                              <tr
                                className={`hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-colors group cursor-pointer ${isExpanded ? "bg-slate-50/80 dark:bg-slate-900/40" : ""}`}
                                onClick={() => setExpandedCompanyKey(isExpanded ? null : compKey)}
                              >
                                {/* Company & Ticker */}
                                <td className="px-4 py-3.5 font-sans">
                                  <div className="flex items-center gap-2">
                                    {company.symbol ? (
                                      <a
                                        href={`https://in.tradingview.com/chart/?symbol=NSE:${encodeURIComponent(company.symbol.replace(/\.NS$|\.BO$/i, ""))}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="inline-flex items-center gap-1.5 font-bold text-slate-900 dark:text-white hover:text-cyan-600 dark:hover:text-cyan-300 hover:underline transition-colors"
                                        title={`Open ${company.symbol} chart on TradingView`}
                                      >
                                        <span>{company.company_name}</span>
                                        <ExternalLink size={11} className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity text-cyan-600 dark:text-cyan-400 shrink-0" />
                                      </a>
                                    ) : (
                                      <span className="font-bold text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-300 transition-colors">
                                        {company.company_name}
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-0.5 font-mono text-[10px]">
                                    {company.symbol && (
                                      <span className="rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.2 font-bold text-cyan-700 dark:text-cyan-400">
                                        {company.symbol}
                                      </span>
                                    )}
                                    {company.exchange && (
                                      <span className="rounded bg-emerald-500/10 border border-emerald-500/30 px-1 py-0.2 text-[8px] text-emerald-600 dark:text-emerald-400">
                                        {company.exchange}
                                      </span>
                                    )}
                                    {company.sector && company.sector !== "Unknown" && (
                                      <span className="text-slate-500 font-sans text-[10px] truncate max-w-[130px]">
                                        {company.sector}
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {/* Strength Tier */}
                                <td className="px-3 py-3.5 text-center whitespace-nowrap">
                                  <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${tierStyle.color} ${tierStyle.border} ${tierStyle.bg}`}>
                                    <span className={`h-1.5 w-1.5 rounded-full ${tierStyle.dot}`} />
                                    <span>{tierStyle.label}</span>
                                  </span>
                                </td>

                                {/* Contracts Won */}
                                <td className="px-3 py-3.5 text-center whitespace-nowrap">
                                  <span className="rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2.5 py-1 text-xs font-bold text-slate-800 dark:text-white shadow-2xs">
                                    {company.order_count} {company.order_count === 1 ? "Order" : "Orders"}
                                  </span>
                                </td>

                                {/* Cumulative Deal Value */}
                                <td className="px-3 py-3.5 text-right font-black text-slate-900 dark:text-white whitespace-nowrap">
                                  {company.total_deal_cr > 0 ? (
                                    <div className="text-sm font-bold text-amber-600 dark:text-amber-300">
                                      ₹{company.total_deal_cr.toLocaleString("en-IN", { maximumFractionDigits: 1 })} Cr
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 dark:text-slate-500 font-normal">Disclosed in Filings</span>
                                  )}
                                  {company.total_quarterly_run_rate_cr > 0 && (
                                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                                      +₹{company.total_quarterly_run_rate_cr.toLocaleString("en-IN", { maximumFractionDigits: 1 })} Cr / Qtr
                                    </div>
                                  )}
                                </td>

                                {/* Book-to-Bill Multiple vs TTM Sales */}
                                <td className="px-3 py-3.5 text-right whitespace-nowrap">
                                  {b2b !== null ? (
                                    <div>
                                      <div className={`font-black text-xs ${b2b >= 1.5 ? "text-purple-600 dark:text-purple-300" : b2b >= 0.75 ? "text-emerald-600 dark:text-emerald-300" : "text-cyan-700 dark:text-cyan-300"}`}>
                                        {b2b.toFixed(2)}x TTM
                                      </div>
                                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                                        Sales: ₹{company.ttm_revenue_cr.toLocaleString("en-IN", { maximumFractionDigits: 0 })} Cr
                                      </div>
                                    </div>
                                  ) : (
                                    <div>
                                      <span className="text-slate-400 dark:text-slate-600">—</span>
                                      <div className="text-[10px] text-slate-500">Runway ~{runway}y</div>
                                    </div>
                                  )}
                                </td>

                                {/* Order Intake Velocity */}
                                <td className="px-3 py-3.5 text-center whitespace-nowrap">
                                  {company.order_velocity_signal === "SURGING_30D" ? (
                                    <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 border border-amber-500/40 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
                                      <Flame size={11} className="text-amber-500 dark:text-amber-400" />
                                      SURGING (30D)
                                    </span>
                                  ) : company.order_velocity_signal === "ACCELERATING" ? (
                                    <span className="inline-flex items-center gap-1 rounded-md bg-cyan-500/15 border border-cyan-500/40 px-2 py-0.5 text-[10px] font-bold text-cyan-700 dark:text-cyan-300">
                                      <Zap size={11} className="text-cyan-500 dark:text-cyan-400" />
                                      ACCELERATING
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-400">
                                      <ShieldCheck size={11} className="text-slate-500 dark:text-slate-400" />
                                      ESTABLISHED
                                    </span>
                                  )}
                                </td>

                                {/* Sovereign Client Profile */}
                                <td className="px-3 py-3.5 text-center whitespace-nowrap">
                                  {sovPct >= 40.0 ? (
                                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                                      <Landmark size={11} className="text-emerald-600 dark:text-emerald-400" />
                                      {sovPct.toFixed(0)}% Sovereign
                                    </span>
                                  ) : sovPct > 0 ? (
                                    <span className="text-[11px] text-slate-600 dark:text-slate-400">
                                      {sovPct.toFixed(0)}% PSU
                                    </span>
                                  ) : (
                                    <span className="text-[11px] text-slate-500 font-sans">
                                      Private Commercial
                                    </span>
                                  )}
                                </td>

                                {/* Top Counterparties */}
                                <td className="px-3 py-3.5">
                                  {company.top_counterparties && company.top_counterparties.length > 0 ? (
                                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                                      {company.top_counterparties.slice(0, 2).map((cp) => (
                                        <span key={cp} className="rounded bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-1.5 py-0.2 text-[10px] text-slate-700 dark:text-slate-300 truncate max-w-[120px]" title={cp}>
                                          {cp}
                                        </span>
                                      ))}
                                      {company.top_counterparties.length > 2 && (
                                        <span className="text-[10px] text-slate-500 font-sans">
                                          +{company.top_counterparties.length - 2}
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-slate-400 dark:text-slate-600 text-[11px]">—</span>
                                  )}
                                </td>

                                {/* Latest Win Date */}
                                <td className="px-3 py-3.5 text-right text-slate-500 dark:text-slate-400 text-[11px] whitespace-nowrap">
                                  {latestDate}
                                </td>

                                {/* Actions */}
                                <td className="px-4 py-3.5 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex items-center justify-center gap-1.5">
                                    <button
                                      onClick={() => setExpandedCompanyKey(isExpanded ? null : compKey)}
                                      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition-all ${
                                        isExpanded
                                          ? "bg-cyan-500/20 text-cyan-800 dark:text-cyan-300 border border-cyan-500/40"
                                          : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 shadow-2xs"
                                      }`}
                                      title={isExpanded ? "Collapse contracts" : "Expand contract breakdown"}
                                    >
                                      <span>Contracts</span>
                                      {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                    </button>

                                    <button
                                      onClick={() => handleDrilldownCompany(company)}
                                      className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1.5 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 hover:text-amber-700 dark:hover:text-amber-300 transition-all shadow-2xs"
                                      title="Open individual order feed for this company"
                                    >
                                      <Briefcase size={12} />
                                    </button>
                                  </div>
                                </td>
                              </tr>

                              {/* ── EXPANDABLE INLINE CONTRACT ACCORDION ─────────────── */}
                              {isExpanded && (
                                <tr className="bg-slate-50/90 dark:bg-[#060D1A] border-b border-cyan-500/20">
                                  <td colSpan={10} className="p-4 sm:p-6">
                                    <div className="rounded-xl border border-cyan-500/30 bg-white dark:bg-slate-950/80 p-4 shadow-md">
                                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3 mb-3">
                                        <div className="flex items-center gap-2">
                                          <Trophy size={16} className="text-amber-500 dark:text-amber-400" />
                                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                                            Contract Disclosures Breakdown ({company.orders?.length || 0} Wins)
                                          </h4>
                                          <span className="text-[11px] font-mono text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/80 border border-cyan-200 dark:border-cyan-800/40 px-2 py-0.5 rounded">
                                            Total Disclosed: ₹{company.total_deal_cr.toLocaleString("en-IN")} Cr
                                          </span>
                                        </div>

                                        <button
                                          onClick={() => handleDrilldownCompany(company)}
                                          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-500/20"
                                        >
                                          <span>View All in Single Orders Feed</span>
                                          <ArrowRight size={12} />
                                        </button>
                                      </div>

                                      {/* Orders List */}
                                      <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                                        {company.orders?.map((ord, idx) => {
                                          const ordDate = ord.filing_date
                                            ? new Date(ord.filing_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                                            : "—";

                                          return (
                                            <div
                                              key={ord.id || idx}
                                              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-slate-200 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-900/60 p-3 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                                            >
                                              <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                  <span className="text-slate-500 dark:text-slate-400 font-mono text-[11px] whitespace-nowrap">
                                                    {ordDate}
                                                  </span>
                                                  {ord.counterparty && (
                                                    <span className="rounded bg-blue-500/15 border border-blue-500/30 px-1.5 py-0.2 text-[9px] font-mono text-blue-700 dark:text-blue-300">
                                                      Client: {ord.counterparty}
                                                    </span>
                                                  )}
                                                  {ord.significance_tier && (
                                                    <span className="rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.2 text-[9px] font-mono text-cyan-700 dark:text-cyan-400 uppercase">
                                                      {ord.significance_tier}
                                                    </span>
                                                  )}
                                                </div>
                                                <p className="text-xs font-sans text-slate-800 dark:text-slate-200 mt-1 line-clamp-1">
                                                  {ord.headline}
                                                </p>
                                              </div>

                                              <div className="flex items-center gap-4 sm:gap-6 shrink-0">
                                                {/* Deal size */}
                                                <div className="text-right">
                                                  <div className="text-xs font-bold font-mono text-amber-600 dark:text-amber-300">
                                                    {ord.deal_value_cr ? `₹${ord.deal_value_cr.toLocaleString("en-IN")} Cr` : "Disclosed"}
                                                  </div>
                                                  {ord.rev_pct_ttm && (
                                                    <div className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                                                      +{ord.rev_pct_ttm.toFixed(1)}% TTM
                                                    </div>
                                                  )}
                                                </div>

                                                {/* Runway */}
                                                <div className="text-center font-mono text-[10px] text-cyan-700 dark:text-cyan-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded">
                                                  {ord.execution_months || 18}m
                                                </div>

                                                {/* Actions */}
                                                <div className="flex items-center gap-1.5">
                                                  {ord.pdf_url && (
                                                    <a
                                                      href={ord.pdf_url}
                                                      target="_blank"
                                                      rel="noopener noreferrer"
                                                      className="rounded p-1 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800"
                                                      title="Official Exchange PDF Filing"
                                                    >
                                                      <FileText size={13} />
                                                    </a>
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Cumulative Pagination */}
              {cumulativeBooks.length > 0 && (
                <div className="mt-8 flex items-center justify-between border-t border-slate-200 dark:border-slate-800/80 pt-4 text-xs text-slate-500 dark:text-slate-400">
                  <div className="font-mono">
                    Showing Page <strong className="text-slate-900 dark:text-white">{cumulativePage}</strong> (up to 30 companies / page)
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCumulativePage((p) => Math.max(1, p - 1))}
                      disabled={cumulativePage <= 1}
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 px-3 py-1.5 font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 shadow-2xs"
                    >
                      <ChevronLeft size={14} />
                      <span>Previous</span>
                    </button>
                    <button
                      onClick={() => setCumulativePage((p) => p + 1)}
                      disabled={cumulativeBooks.length < 30}
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 px-3 py-1.5 font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 shadow-2xs"
                    >
                      <span>Next</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═════════════════════════════════════════════════════════════════════ */}
        {/* TAB 2: INDIVIDUAL SINGLE ORDER FILINGS (CARDS VS IMPACT TABLE)        */}
        {/* ═════════════════════════════════════════════════════════════════════ */}
        {activeTab === "single_orders" && (
          <div className="flex-1 flex flex-col">
            {/* Filter Toolbar for Single Orders */}
            <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-[#07111F] px-4 py-4 sm:px-8">
              <div className="mx-auto max-w-7xl flex flex-col gap-4">
                {/* Sizing & Client Presets Ribbon */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mr-1 flex items-center gap-1">
                      <Filter size={12} className="text-cyan-600 dark:text-cyan-400" />
                      Single Order Presets:
                    </span>
                    {[
                      { id: "ALL", label: "All Contracts" },
                      { id: "MEGA", label: "🔥 Mega Wins (₹500Cr+)" },
                      { id: "GAME_CHANGER", label: "🚀 Game Changers (>25% TTM)" },
                      { id: "SOVEREIGN", label: "🏛️ Sovereign / PSU Clients" },
                      { id: "TRANSFORMATIONAL", label: "⭐ Transformational (Score 80+)" },
                    ].map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => handleApplyPreset(preset.id)}
                        className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                          selectedPreset === preset.id
                            ? "bg-cyan-500/20 text-cyan-800 dark:text-cyan-300 border border-cyan-500/40"
                            : "bg-white dark:bg-slate-900/80 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 shadow-2xs"
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>

                  {/* View Mode Toggle */}
                  <div className="flex items-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-1 shadow-2xs">
                    <button
                      onClick={() => setViewMode("cards")}
                      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                        viewMode === "cards" ? "bg-cyan-500/20 text-cyan-800 dark:text-cyan-300 border border-cyan-500/40" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                      title="Card-based AI Investment Views"
                    >
                      <LayoutGrid size={13} />
                      <span>Cards</span>
                    </button>
                    <button
                      onClick={() => setViewMode("table")}
                      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                        viewMode === "table" ? "bg-cyan-500/20 text-cyan-800 dark:text-cyan-300 border border-cyan-500/40" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                      title="High-density Bloomberg Impact Table"
                    >
                      <TableIcon size={13} />
                      <span>Impact Table</span>
                    </button>
                  </div>
                </div>

                {/* Search, Sorters & Sovereign Counterparty Chips */}
                <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
                  {/* Search Box */}
                  <div className="relative flex-1 max-w-md">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setPage(1);
                      }}
                      placeholder="Search by Symbol, Company, Client, or Keyword..."
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950/80 pl-9 pr-8 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 shadow-2xs"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  {/* Reset Filters */}
                  {(selectedTier || minDealCr || minRevPct || counterpartyFilter || searchQuery) && (
                    <button
                      onClick={() => {
                        handleApplyPreset("ALL");
                        setSearchQuery("");
                      }}
                      className="flex items-center gap-1 text-xs text-rose-500 dark:text-rose-400 hover:text-rose-600 dark:hover:text-rose-300 underline underline-offset-4"
                    >
                      <RotateCcw size={11} />
                      Reset filters
                    </button>
                  )}

                  {/* Sorting Selection */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Sort by:</span>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:border-cyan-500 focus:outline-none cursor-pointer shadow-xs"
                    >
                      <option value="announcement_date">Filing Date</option>
                      <option value="deal_value_cr">Deal Size (₹ Cr)</option>
                      <option value="synergy_rev_pct_ttm">% of TTM Sales</option>
                      <option value="order_significance_score">Significance Score</option>
                      <option value="order_quarterly_rev_cr">Quarterly Run-Rate (+₹ Cr)</option>
                      <option value="order_earnings_impact_cr">Annualized PAT (+₹ Cr)</option>
                      <option value="upside_pct">Target Upside %</option>
                    </select>
                    <button
                      onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
                      className="rounded-lg border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 p-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white shadow-xs"
                      title={`Toggle sort order (Current: ${sortOrder.toUpperCase()})`}
                    >
                      <ArrowUpDown size={14} className={sortOrder === "asc" ? "rotate-180 transition-transform" : "transition-transform"} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Single Orders Content: Cards or Table */}
            <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8 flex-1 w-full">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-500">
                  <RefreshCw size={28} className="animate-spin text-cyan-400" />
                  <span className="text-sm font-mono tracking-wide">Executing quantitative intelligence radar...</span>
                </div>
              ) : items.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 p-12 text-center shadow-xs">
                  <Trophy size={40} className="mx-auto text-slate-400 dark:text-slate-600 mb-3" />
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">No Order Win Announcements Found</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
                    No filings match the current filters. Try relaxing the search parameters or triggering a sync.
                  </p>
                  <button
                    onClick={() => handleApplyPreset("ALL")}
                    className="mt-4 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-xs font-bold text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/20"
                  >
                    Reset All Filters
                  </button>
                </div>
              ) : viewMode === "cards" ? (
                /* VIEW MODE 1: CARDS */
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                  {items.map((item) => {
                    const lookupKey = (item.symbol ? item.symbol.replace(/\.NS$|\.BO$/i, "").toUpperCase() : item.company_name?.toLowerCase().trim()) || "";
                    const cumBook = companyCumulativeMap.get(lookupKey);

                    return (
                      <div key={item.id} className="relative flex flex-col">
                        {/* Cumulative Backlog Context Pill on Card */}
                        {cumBook && cumBook.order_count > 1 && (
                          <div className="mb-2 flex items-center justify-between rounded-lg bg-slate-100 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 px-3 py-1.5 text-[11px] font-mono shadow-2xs">
                            <span className="text-slate-600 dark:text-slate-400">
                              Part of <strong className="text-amber-700 dark:text-amber-300">₹{cumBook.total_deal_cr.toLocaleString("en-IN")} Cr Backlog</strong> ({cumBook.order_count} wins)
                              {cumBook.book_to_bill_multiple ? ` · ${cumBook.book_to_bill_multiple.toFixed(2)}x TTM` : ""}
                            </span>
                            <button
                              onClick={() => handleInspectCompanyBacklog(item.symbol || item.company_name)}
                              className="text-cyan-700 dark:text-cyan-400 hover:text-cyan-800 dark:hover:text-cyan-300 font-bold hover:underline flex items-center gap-0.5"
                            >
                              <span>View Company Backlog</span>
                              <ArrowRight size={10} />
                            </button>
                          </div>
                        )}
                        <OrderWinCard
                          item={item}
                          onSelectDrawer={(selected) => setSelectedDrawerItem(selected)}
                          onSendAlert={handleSendTelegramAlert}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* VIEW MODE 2: HIGH-DENSITY BLOOMBERG IMPACT TABLE */
                <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60 backdrop-blur-md shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                      <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-100/90 dark:bg-slate-900/90 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                        <tr>
                          <th className="px-4 py-3">Company & Ticker</th>
                          <th className="px-3 py-3">Filing Date</th>
                          <th className="px-3 py-3 text-right">Deal Value</th>
                          <th className="px-3 py-3 text-right">% TTM Sales</th>
                          <th className="px-3 py-3 text-center">Runway</th>
                          <th className="px-3 py-3 text-right">Run-Rate / Qtr</th>
                          <th className="px-3 py-3 text-right">PAT Impact</th>
                          <th className="px-3 py-3 text-center">Score & Tier</th>
                          <th className="px-3 py-3 text-right">CMP & Target</th>
                          <th className="px-4 py-3 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60 font-mono">
                        {items.map((item) => {
                          const tier = (item.order_significance_tier || "HIGH_IMPACT").toUpperCase();
                          const tierStyle = TIER_CONFIG[tier] || TIER_CONFIG.HIGH_IMPACT;
                          const dealValue = item.deal_value_cr ?? item.synergy_rev_addition_cr;
                          const revPct = item.synergy_rev_pct_ttm;
                          const months = item.order_execution_months || 18;
                          const quarters = Math.max(1, Math.round(months / 3));
                          const quarterlyRev = item.order_quarterly_rev_cr ?? (dealValue ? Math.round((dealValue / quarters) * 10) / 10 : null);
                          const patImpact = item.order_earnings_impact_cr ?? item.synergy_ebitda_addition_cr;
                          const cmp = item.current_price || 100;
                          const target = item.target_price || Math.round(cmp * 1.30);
                          const upside = item.upside_pct || Math.round(((target - cmp) / cmp) * 100);

                          const filingDate = item.announcement_date || item.published_at;
                          const dateStr = filingDate ? new Date(filingDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" }) : "—";

                          const lookupKey = (item.symbol ? item.symbol.replace(/\.NS$|\.BO$/i, "").toUpperCase() : item.company_name?.toLowerCase().trim()) || "";
                          const cumBook = companyCumulativeMap.get(lookupKey);

                          return (
                            <tr
                              key={item.id}
                              className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors group cursor-pointer"
                              onClick={() => setSelectedDrawerItem(item)}
                            >
                              {/* Company & Ticker */}
                              <td className="px-4 py-3 font-sans">
                                {item.symbol ? (
                                  <a
                                    href={`https://in.tradingview.com/chart/?symbol=NSE:${encodeURIComponent(item.symbol.replace(/\.NS$|\.BO$/i, ""))}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-1.5 font-bold text-slate-900 dark:text-white hover:text-cyan-600 dark:hover:text-cyan-300 hover:underline transition-colors"
                                    title={`Open ${item.symbol} chart on TradingView`}
                                  >
                                    <span>{item.company_name}</span>
                                    <ExternalLink size={11} className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity text-cyan-600 dark:text-cyan-400 shrink-0" />
                                  </a>
                                ) : (
                                  <div className="font-bold text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-300 transition-colors">
                                    {item.company_name}
                                  </div>
                                )}
                                <div className="flex flex-wrap items-center gap-1.5 mt-0.5 font-mono">
                                  {item.symbol && (
                                    <span className="rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-1.5 py-0.2 text-[10px] font-bold text-cyan-700 dark:text-cyan-400">
                                      {item.symbol}
                                    </span>
                                  )}
                                  {item.is_listed && (
                                    <span className="rounded bg-emerald-500/10 border border-emerald-500/30 px-1 py-0.2 text-[8px] text-emerald-600 dark:text-emerald-400">
                                      NSE
                                    </span>
                                  )}
                                  {cumBook && cumBook.order_count > 1 && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleInspectCompanyBacklog(item.symbol || item.company_name);
                                      }}
                                      className="rounded bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.2 text-[9px] text-amber-700 dark:text-amber-300 hover:bg-amber-500/25 transition-all"
                                      title="View company cumulative backlog"
                                    >
                                      ₹{cumBook.total_deal_cr.toLocaleString("en-IN", { maximumFractionDigits: 0 })} Cr ({cumBook.order_count} wins)
                                    </button>
                                  )}
                                </div>
                              </td>

                              {/* Date */}
                              <td className="px-3 py-3 text-slate-500 dark:text-slate-400 text-[11px] whitespace-nowrap">
                                {dateStr}
                              </td>

                              {/* Deal Value */}
                              <td className="px-3 py-3 text-right font-black text-slate-900 dark:text-white whitespace-nowrap">
                                {dealValue ? `₹${dealValue.toLocaleString("en-IN")} Cr` : <span className="text-slate-400 dark:text-slate-500 font-normal">Disclosed</span>}
                              </td>

                              {/* % TTM Sales */}
                              <td className="px-3 py-3 text-right whitespace-nowrap">
                                {revPct ? (
                                  <span className={`font-bold ${revPct >= 25 ? "text-purple-600 dark:text-purple-300" : revPct >= 10 ? "text-amber-600 dark:text-amber-300" : "text-cyan-700 dark:text-cyan-300"}`}>
                                    +{revPct.toFixed(1)}%
                                  </span>
                                ) : (
                                  <span className="text-slate-400 dark:text-slate-600">—</span>
                                )}
                              </td>

                              {/* Runway */}
                              <td className="px-3 py-3 text-center whitespace-nowrap">
                                <span className="rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 text-[11px] font-semibold text-cyan-700 dark:text-cyan-300">
                                  {months}m ({quarters}Q)
                                </span>
                              </td>

                              {/* Quarterly Run-Rate */}
                              <td className="px-3 py-3 text-right text-emerald-600 dark:text-emerald-400 font-bold whitespace-nowrap">
                                {quarterlyRev ? `+₹${quarterlyRev.toLocaleString("en-IN")} Cr` : "—"}
                              </td>

                              {/* PAT Accretion */}
                              <td className="px-3 py-3 text-right text-purple-600 dark:text-purple-300 font-bold whitespace-nowrap">
                                {patImpact ? `+₹${patImpact.toLocaleString("en-IN")} Cr` : "—"}
                              </td>

                              {/* Score & Tier */}
                              <td className="px-3 py-3 text-center whitespace-nowrap">
                                <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${tierStyle.color} ${tierStyle.border} ${tierStyle.bg}`}>
                                  <Award size={10} />
                                  <span>{tier.replace(/_/g, " ")}</span>
                                  <span className="text-slate-900 dark:text-white ml-0.5">
                                    {(item.order_significance_score ?? 80).toFixed(0)}
                                  </span>
                                </span>
                              </td>

                              {/* CMP & Target */}
                              <td className="px-3 py-3 text-right whitespace-nowrap">
                                <div className="text-slate-800 dark:text-slate-200">₹{cmp.toFixed(1)}</div>
                                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                                  ₹{target.toFixed(1)} (+{upside}%)
                                </div>
                              </td>

                              {/* Actions */}
                              <td className="px-4 py-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => setSelectedDrawerItem(item)}
                                    className="rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-transparent p-1.5 text-cyan-700 dark:text-cyan-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white shadow-2xs"
                                    title="Open Milestone Waterfall Drawer"
                                  >
                                    <Maximize2 size={13} />
                                  </button>
                                  <button
                                    onClick={() => handleSendTelegramAlert(item)}
                                    className="rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-transparent p-1.5 text-amber-600 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-600/30 hover:text-amber-700 dark:hover:text-white shadow-2xs"
                                    title="Broadcast Alert to Telegram"
                                  >
                                    <Send size={13} />
                                  </button>
                                  {item.pdf_url && (
                                    <a
                                      href={item.pdf_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-transparent p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white shadow-2xs"
                                      title="View Official Exchange PDF Filing"
                                    >
                                      <FileText size={13} />
                                    </a>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Single Orders Pagination */}
              {items.length > 0 && (
                <div className="mt-8 flex items-center justify-between border-t border-slate-200 dark:border-slate-800/80 pt-4 text-xs text-slate-500 dark:text-slate-400">
                  <div className="font-mono">
                    Showing Page <strong className="text-slate-900 dark:text-white">{page}</strong> (up to {pageSize} records / page)
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 px-3 py-1.5 font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 shadow-2xs"
                    >
                      <ChevronLeft size={14} />
                      <span>Previous</span>
                    </button>
                    <button
                      onClick={() => setPage((p) => p + 1)}
                      disabled={items.length < pageSize}
                      className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 px-3 py-1.5 font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 shadow-2xs"
                    >
                      <span>Next</span>
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── SLIDE-OVER WATERFALL & MILESTONE DRAWER ───────────────────── */}
        {selectedDrawerItem && (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
            <div
              className="relative flex h-full w-full max-w-2xl flex-col border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-[#060D1A] shadow-2xl overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drawer Header */}
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#060D1A]/95 px-6 py-4 backdrop-blur-md">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-600 dark:text-amber-400">
                    <Trophy size={16} />
                  </span>
                  <div>
                    <h2 className="text-base font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                      {selectedDrawerItem.company_name}
                      {selectedDrawerItem.symbol && (
                        <span className="font-mono text-xs text-cyan-700 dark:text-cyan-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                          {selectedDrawerItem.symbol}
                        </span>
                      )}
                    </h2>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">Quarterly Realization Waterfall & Milestone Analytics</span>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedDrawerItem(null)}
                  className="rounded-lg p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="p-6">
                <OrderWaterfallDrawer item={selectedDrawerItem} showNavigationLink={true} />
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

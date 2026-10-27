"use client";

// =======================================================
// Alpha India — Investor Intelligence & Concall Radar Terminal
// Quarterly AI Analysis, Latest-First Feed & Management Commitment Ledger
// Bloomberg Dark Institutional Aesthetic · #050B14 · Cyan/Emerald/Amber
// =======================================================

import { useEffect, useState, useCallback, useId } from "react";
import {
  FileText,
  Search,
  RefreshCw,
  Sparkles,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Activity,
  Layers,
  ShieldAlert,
  Target,
  BarChart2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Mic,
  Zap,
  Database,
  Cpu,
  Flame,
  Scale,
  AlertCircle,
  Calendar,
  Filter,
  Check,
  XCircle,
  HelpCircle,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  LayoutList,
  LayoutGrid,
  Building2,
  PieChart,
  Award,
} from "lucide-react";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { PageHeader, LoadingSpinner, EmptyState } from "@/components/common";
import InvestorIntelligenceDrawer from "@/components/investor-intelligence/InvestorIntelligenceDrawer";
import DiamondCatalystRadar from "@/components/investor-intelligence/DiamondCatalystRadar";
import {
  fetchInvestorFeed,
  fetchQuarterlyCoverage,
  fetchCommitmentsLedger,
  fetchCommitmentsSummary,
  reprocessDocument,
  triggerBackfill,
  triggerCompanyHarvest,
  triggerAnalyzeLatest,
  formatGuidanceChanges,
  type InvestorInsightItem,
  type QuarterlyCoverageResponse,
  type CommitmentItem,
  type CommitmentSummaryResponse,
} from "@/lib/investorIntelligenceApi";

const STANCE_FILTERS = [
  { id: "ALL", label: "All Stances" },
  { id: "STRONG_GROWTH_LEADER", label: "Growth Leaders", color: "text-emerald-400" },
  { id: "ACCUMULATE_ON_DIPS", label: "Accumulate on Dips", color: "text-cyan-400" },
  { id: "STEADY_COMPOUNDER", label: "Steady Compounders", color: "text-blue-400" },
  { id: "TURNAROUND_CANDIDATE", label: "Turnarounds", color: "text-amber-400" },
  { id: "AVOID_OR_HEADWINDS", label: "Headwinds / Caution", color: "text-rose-400" },
];

const THESIS_FILTERS = [
  { id: "ALL", label: "All Thesis Impacts" },
  { id: "STRENGTHENING", label: "Strengthening Thesis", color: "text-emerald-400" },
  { id: "NEUTRAL", label: "Neutral Thesis", color: "text-slate-300" },
  { id: "WEAKENING", label: "Weakening Thesis", color: "text-rose-400" },
];

const STATUS_FILTERS = [
  { id: "ALL", label: "All Analysis Statuses" },
  { id: "ANALYZED", label: "Analyzed by AI", color: "text-emerald-400" },
  { id: "PENDING", label: "Pending Analysis", color: "text-amber-400" },
  { id: "FAILED", label: "Processing Failed", color: "text-rose-400" },
];

export default function InvestorIntelligencePage() {
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<"DIAMOND_RADAR" | "FEED" | "COVERAGE" | "COMMITMENTS">("DIAMOND_RADAR");

  // Global Quarter Selection
  const [coverageData, setCoverageData] = useState<QuarterlyCoverageResponse | null>(null);
  const [selectedQuarter, setSelectedQuarter] = useState<string>("ALL");
  const [coverageLoading, setCoverageLoading] = useState<boolean>(false);

  // Latest Intelligence Feed State
  const [feedItems, setFeedItems] = useState<InvestorInsightItem[]>([]);
  const [feedTotal, setFeedTotal] = useState<number>(0);
  const [feedLoading, setFeedLoading] = useState<boolean>(true);
  const [feedPage, setFeedPage] = useState<number>(1);
  const [feedLimit, setFeedLimit] = useState<number>(30);
  const [feedViewMode, setFeedViewMode] = useState<"COMPACT" | "DETAILED">("COMPACT");
  const [expandedRowId, setExpandedRowId] = useState<number | null>(null);
  const [deduplicateStocks, setDeduplicateStocks] = useState<boolean>(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedStance, setSelectedStance] = useState<string>("ALL");
  const [selectedThesis, setSelectedThesis] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");
  const [selectedDocType, setSelectedDocType] = useState<string>("ALL");

  // Commitments Ledger State
  const [commitments, setCommitments] = useState<CommitmentItem[]>([]);
  const [commitmentsTotal, setCommitmentsTotal] = useState<number>(0);
  const [commitmentsLoading, setCommitmentsLoading] = useState<boolean>(false);
  const [commitmentsPage, setCommitmentsPage] = useState<number>(1);
  const [commitmentStatusFilter, setCommitmentStatusFilter] = useState<string>("ALL");
  const [commitmentCategoryFilter, setCommitmentCategoryFilter] = useState<string>("ALL");
  const [commitmentTypeFilter, setCommitmentTypeFilter] = useState<string>("ALL");
  const [overallSummary, setOverallSummary] = useState<CommitmentSummaryResponse | null>(null);

  // Drilldown Modal
  const [drilldownCategory, setDrilldownCategory] = useState<string | null>(null);
  const [drilldownTitle, setDrilldownTitle] = useState<string>("");
  const [drilldownItems, setDrilldownItems] = useState<any[]>([]);
  const [isDrilldownOpen, setIsDrilldownOpen] = useState<boolean>(false);

  // Drawer details
  const [activeSymbolForDrawer, setActiveSymbolForDrawer] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  // Manual actions
  const [inputSymbol, setInputSymbol] = useState<string>("");
  const [actionInProgress, setActionInProgress] = useState<boolean>(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // 1. Load Quarterly Coverage Dashboard Data
  const loadCoverage = useCallback(async (quarter?: string) => {
    setCoverageLoading(true);
    try {
      const qParam = quarter && quarter !== "ALL" ? quarter : undefined;
      const data = await fetchQuarterlyCoverage(qParam);
      setCoverageData(data);
      if (quarter && quarter !== "ALL") {
        setSelectedQuarter(quarter);
      }
    } catch (err) {
      console.error("Error fetching quarterly coverage:", err);
    } finally {
      setCoverageLoading(false);
    }
  }, []);

  // 2. Load Feed (Sorted primarily by announcement_date desc)
  const loadFeed = useCallback(async () => {
    setFeedLoading(true);
    try {
      const res = await fetchInvestorFeed({
        quarter: selectedQuarter === "ALL" ? undefined : selectedQuarter,
        stance: selectedStance === "ALL" ? undefined : selectedStance,
        thesis_impact: selectedThesis === "ALL" ? undefined : selectedThesis,
        analysis_status: selectedStatus === "ALL" ? undefined : selectedStatus,
        doc_type: selectedDocType === "ALL" ? undefined : selectedDocType,
        symbol: searchQuery ? searchQuery.trim().toUpperCase() : undefined,
        deduplicate_stocks: deduplicateStocks,
        page: feedPage,
        limit: feedLimit,
      });
      setFeedItems(res.items);
      setFeedTotal(res.total);
    } catch (err) {
      console.error("Error fetching investor feed:", err);
    } finally {
      setFeedLoading(false);
    }
  }, [selectedQuarter, selectedStance, selectedThesis, selectedStatus, selectedDocType, searchQuery, deduplicateStocks, feedPage, feedLimit]);

  // 3. Load Commitments Ledger
  const loadCommitments = useCallback(async () => {
    setCommitmentsLoading(true);
    try {
      const [ledger, summary] = await Promise.all([
        fetchCommitmentsLedger({
          quarter: selectedQuarter === "ALL" ? undefined : selectedQuarter,
          status: commitmentStatusFilter === "ALL" ? undefined : commitmentStatusFilter,
          category: commitmentCategoryFilter === "ALL" ? undefined : commitmentCategoryFilter,
          is_financial_target:
            commitmentTypeFilter === "FINANCIAL"
              ? true
              : commitmentTypeFilter === "QUALITATIVE"
              ? false
              : undefined,
          page: commitmentsPage,
          limit: 25,
        }),
        fetchCommitmentsSummary(),
      ]);
      setCommitments(ledger.items);
      setCommitmentsTotal(ledger.total);
      setOverallSummary(summary);
    } catch (err) {
      console.error("Error fetching commitments ledger:", err);
    } finally {
      setCommitmentsLoading(false);
    }
  }, [selectedQuarter, commitmentStatusFilter, commitmentCategoryFilter, commitmentTypeFilter, commitmentsPage]);

  useEffect(() => {
    loadCoverage(selectedQuarter);
  }, [loadCoverage, selectedQuarter]);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  useEffect(() => {
    if (activeTab === "COMMITMENTS") {
      loadCommitments();
    }
  }, [activeTab, loadCommitments]);

  // Reprocess single failed/pending document
  const handleReprocess = async (docId: number) => {
    setActionInProgress(true);
    setActionMessage(null);
    try {
      const res = await reprocessDocument(docId);
      setActionMessage(`Document #${docId} reprocessed: ${res.status}`);
      await loadFeed();
      await loadCoverage(selectedQuarter);
    } catch (e: any) {
      setActionMessage(`Reprocess error: ${e.message}`);
    } finally {
      setActionInProgress(false);
    }
  };

  // Backfill next pending documents
  const handleTriggerBackfill = async () => {
    setActionInProgress(true);
    setActionMessage(null);
    try {
      const res = await triggerBackfill(10);
      setActionMessage(`Backfill initiated: ${res.processed} documents analyzed, ${res.total_commitments_extracted} commitments recorded.`);
      await loadFeed();
      await loadCoverage(selectedQuarter);
      if (activeTab === "COMMITMENTS") await loadCommitments();
    } catch (e: any) {
      setActionMessage(`Backfill error: ${e.message}`);
    } finally {
      setActionInProgress(false);
    }
  };

  // Single stock on-demand harvest
  const handleHarvestSingle = async () => {
    const sym = inputSymbol.trim().toUpperCase();
    if (!sym) return;
    setActionInProgress(true);
    setActionMessage(null);
    try {
      await triggerCompanyHarvest(sym);
      await triggerAnalyzeLatest(sym);
      setInputSymbol("");
      setActionMessage(`Discovered & analyzed presentations for ${sym}`);
      await loadFeed();
      await loadCoverage(selectedQuarter);
      setActiveSymbolForDrawer(sym);
      setIsDrawerOpen(true);
    } catch (e: any) {
      setActionMessage(`Harvest error: ${e.message}`);
    } finally {
      setActionInProgress(false);
    }
  };

  // Drilldown Modal Handler
  const openDrilldown = (cat: string, title: string, items: any[]) => {
    setDrilldownCategory(cat);
    setDrilldownTitle(title);
    setDrilldownItems(items);
    setIsDrilldownOpen(true);
  };

  const getThesisBadge = (thesis: string) => {
    switch (thesis) {
      case "STRENGTHENING":
        return {
          bg: "bg-emerald-950/70 text-emerald-400 border-emerald-500/50",
          icon: <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />,
          label: "Strengthening Thesis",
        };
      case "WEAKENING":
        return {
          bg: "bg-rose-950/70 text-rose-400 border-rose-500/50",
          icon: <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />,
          label: "Weakening Thesis",
        };
      default:
        return {
          bg: "bg-slate-900/80 text-slate-300 border-slate-700/60",
          icon: <Scale className="w-3.5 h-3.5 text-slate-400" />,
          label: "Neutral Thesis",
        };
    }
  };

  const getStanceBadge = (stance?: string | null) => {
    switch (stance?.toUpperCase()) {
      case "STRONG_GROWTH_LEADER":
        return {
          bg: "bg-emerald-950/80 text-emerald-300 border-emerald-500/50",
          label: "Strong Growth Leader",
        };
      case "ACCUMULATE_ON_DIPS":
        return {
          bg: "bg-cyan-950/80 text-cyan-300 border-cyan-500/50",
          label: "Accumulate on Dips",
        };
      case "STEADY_COMPOUNDER":
        return {
          bg: "bg-blue-950/80 text-blue-300 border-blue-500/50",
          label: "Steady Compounder",
        };
      case "TURNAROUND_CANDIDATE":
        return {
          bg: "bg-amber-950/80 text-amber-300 border-amber-500/50",
          label: "Turnaround Candidate",
        };
      case "CYCLICAL_PEAK":
        return {
          bg: "bg-purple-950/80 text-purple-300 border-purple-500/50",
          label: "Cyclical Peak",
        };
      case "AVOID_OR_HEADWINDS":
        return {
          bg: "bg-rose-950/80 text-rose-300 border-rose-500/50",
          label: "Avoid / Headwinds",
        };
      default:
        return {
          bg: "bg-slate-900/80 border-slate-700 text-slate-300",
          label: stance ? stance.replace(/_/g, " ") : "Pending Analysis",
        };
    }
  };

  const getCommitmentStatusBadge = (status: string) => {
    switch (status) {
      case "MET":
        return "bg-emerald-950/80 text-emerald-400 border-emerald-500/60";
      case "PARTIALLY_MET":
        return "bg-cyan-950/80 text-cyan-400 border-cyan-500/60";
      case "MISSED":
        return "bg-rose-950/80 text-rose-400 border-rose-500/60";
      case "ON_TRACK":
        return "bg-blue-950/80 text-blue-400 border-blue-500/60";
      case "DELAYED":
        return "bg-amber-950/80 text-amber-400 border-amber-500/60";
      case "REVISED":
        return "bg-purple-950/80 text-purple-400 border-purple-500/60";
      case "NOT_YET_DUE":
        return "bg-slate-900/80 text-slate-400 border-slate-700";
      default:
        return "bg-slate-900 text-slate-400 border-slate-800";
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-16">
        {/* =======================================================
            1. PAGE HEADER & GLOBAL QUARTER SELECTOR
           ======================================================= */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-cyan-900/40 pb-5">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-cyan-500/10 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                <Cpu className="w-4 h-4" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white">
                Investor Intelligence & Management Radar
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 uppercase tracking-wider">
                Quarterly Engine v2.3
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl">
              Tracks official investor presentations, analyzes quarterly commentary with AI, extracts management commitments, and rigorously evaluates historical delivery across quarters.
            </p>
          </div>

          {/* Quarter Selector & Action Bar */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 bg-[#0A1222] border border-cyan-900/60 rounded-xl px-3 py-1.5 shadow-inner">
              <Calendar className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-mono text-slate-400">Quarter:</span>
              <select
                aria-label="Quarter Selector"
                value={selectedQuarter}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedQuarter(val);
                  loadCoverage(val);
                  setFeedPage(1);
                  setCommitmentsPage(1);
                }}
                className="bg-transparent text-sm font-mono font-bold text-cyan-300 focus:outline-hidden cursor-pointer"
              >
                <option value="ALL" className="bg-[#070D18] text-slate-200">
                  ALL Quarters (Market-Wide)
                </option>
                {coverageData?.available_quarters?.map((q) => (
                  <option key={q.fiscal_period} value={q.fiscal_period} className="bg-[#070D18] text-slate-200">
                    {q.fiscal_period} ({q.count})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => {
                loadCoverage(selectedQuarter);
                loadFeed();
                if (activeTab === "COMMITMENTS") loadCommitments();
              }}
              className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-cyan-400 transition cursor-pointer"
              title="Refresh Current View"
            >
              <RefreshCw className={`w-4 h-4 ${feedLoading || coverageLoading ? "animate-spin text-cyan-400" : ""}`} />
            </button>
          </div>
        </div>

        {/* Global Action & Notification Bar */}
        {actionMessage && (
          <div className="p-3 rounded-xl bg-cyan-950/60 border border-cyan-500/50 text-xs font-mono text-cyan-300 flex items-center justify-between animate-fadeIn">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span>{actionMessage}</span>
            </div>
            <button
              onClick={() => setActionMessage(null)}
              className="text-slate-400 hover:text-white text-xs font-mono"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* =======================================================
            TOP INTERACTIVE NAVIGATION TABS
           ======================================================= */}
        <div className="flex items-center justify-between border-b border-cyan-950 pb-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("DIAMOND_RADAR")}
              className={`px-4 py-2 rounded-lg text-xs font-mono font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === "DIAMOND_RADAR"
                  ? "bg-gradient-to-r from-emerald-600/30 to-cyan-600/20 text-emerald-300 border-2 border-emerald-500/80 shadow-md shadow-emerald-950/40"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent"
              }`}
            >
              <Award className="w-3.5 h-3.5 text-emerald-400" />
              💎 Diamond Catalyst Radar (Runaway Triggers)
            </button>

            <button
              onClick={() => setActiveTab("FEED")}
              className={`px-4 py-2 rounded-lg text-xs font-mono font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === "FEED"
                  ? "bg-cyan-600/20 text-cyan-300 border border-cyan-500/50 shadow-md"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent"
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              Latest Filings Feed ({feedTotal})
            </button>

            <button
              onClick={() => setActiveTab("COVERAGE")}
              className={`px-4 py-2 rounded-lg text-xs font-mono font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === "COVERAGE"
                  ? "bg-emerald-600/20 text-emerald-300 border border-emerald-500/50 shadow-md"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent"
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5 text-emerald-400" />
              Coverage Health ({selectedQuarter})
            </button>

            <button
              onClick={() => setActiveTab("COMMITMENTS")}
              className={`px-4 py-2 rounded-lg text-xs font-mono font-bold transition flex items-center gap-2 cursor-pointer ${
                activeTab === "COMMITMENTS"
                  ? "bg-amber-600/20 text-amber-300 border border-amber-500/50 shadow-md"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent"
              }`}
            >
              <Target className="w-3.5 h-3.5 text-amber-400" />
              Commitments Ledger ({commitmentsTotal})
            </button>
          </div>

          {/* Quick On-Demand Harvester */}
          <div className="hidden md:flex items-center gap-2">
            <input
              type="text"
              placeholder="Symbol (e.g. TATAELXSI)"
              value={inputSymbol}
              onChange={(e) => setInputSymbol(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleHarvestSingle()}
              className="px-2.5 py-1 text-xs font-mono bg-[#0A1222] border border-cyan-950 rounded-lg text-white placeholder-slate-500 focus:outline-hidden focus:border-cyan-500 w-36 uppercase"
            />
            <button
              onClick={handleHarvestSingle}
              disabled={actionInProgress || !inputSymbol.trim()}
              className="px-3 py-1 rounded-lg bg-cyan-950/80 hover:bg-cyan-900/80 border border-cyan-700/60 text-cyan-300 text-xs font-mono font-medium disabled:opacity-40 transition cursor-pointer"
            >
              Harvest PPT
            </button>
          </div>
        </div>

        {/* =======================================================
            TAB 0: 💎 DIAMOND CATALYST RADAR (RUNAWAY GUIDANCE TRIGGERS)
           ======================================================= */}
        {activeTab === "DIAMOND_RADAR" && (
          <DiamondCatalystRadar
            onSelectSymbol={(sym) => {
              setActiveSymbolForDrawer(sym);
              setIsDrawerOpen(true);
            }}
          />
        )}

        {/* =======================================================
            TAB 1: LATEST INVESTOR INTELLIGENCE FEED (Newest First)
           ======================================================= */}
        {activeTab === "FEED" && (
          <div className="space-y-5">
            {/* Filter & Search Bar */}
            <div className="p-3.5 rounded-xl bg-[#080E1A] border border-cyan-950 space-y-3">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search by stock symbol or company name..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setFeedPage(1);
                    }}
                    className="w-full bg-[#050B14] border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-cyan-500 font-mono"
                  />
                </div>

                <div className="flex items-center gap-2 flex-wrap text-xs">
                  {/* Status Filter */}
                  <select
                    aria-label="Filter by Analysis Status"
                    value={selectedStatus}
                    onChange={(e) => {
                      setSelectedStatus(e.target.value);
                      setFeedPage(1);
                    }}
                    className="bg-[#050B14] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-300 focus:outline-hidden focus:border-cyan-500"
                  >
                    {STATUS_FILTERS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>

                  {/* Thesis Filter */}
                  <select
                    aria-label="Filter by Thesis Impact"
                    value={selectedThesis}
                    onChange={(e) => {
                      setSelectedThesis(e.target.value);
                      setFeedPage(1);
                    }}
                    className="bg-[#050B14] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-300 focus:outline-hidden focus:border-cyan-500"
                  >
                    {THESIS_FILTERS.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>

                  {/* Stance Filter */}
                  <select
                    aria-label="Filter by Institutional Stance"
                    value={selectedStance}
                    onChange={(e) => {
                      setSelectedStance(e.target.value);
                      setFeedPage(1);
                    }}
                    className="bg-[#050B14] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-300 focus:outline-hidden focus:border-cyan-500"
                  >
                    {STANCE_FILTERS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>

                  {/* Doc Type Filter */}
                  <select
                    aria-label="Filter by Document Type"
                    value={selectedDocType}
                    onChange={(e) => {
                      setSelectedDocType(e.target.value);
                      setFeedPage(1);
                    }}
                    className="bg-[#050B14] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-300 focus:outline-hidden focus:border-cyan-500"
                  >
                    <option value="ALL">All Documents</option>
                    <option value="INVESTOR_PRESENTATION">Investor Presentations</option>
                    <option value="CONCALL_TRANSCRIPT">Concall Transcripts</option>
                  </select>

                  {/* Deduplicate Stocks Toggle Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setDeduplicateStocks(!deduplicateStocks);
                      setFeedPage(1);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono transition cursor-pointer ${
                      deduplicateStocks
                        ? "bg-cyan-950/90 border-cyan-500/60 text-cyan-300 font-bold shadow-xs shadow-cyan-950"
                        : "bg-[#050B14] border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                    title={deduplicateStocks ? "Currently showing 1 unified card per stock" : "Currently showing raw filings"}
                  >
                    <Layers className="w-3.5 h-3.5 text-cyan-400" />
                    <span>{deduplicateStocks ? "1 Card / Stock" : "All Filings"}</span>
                  </button>

                  {/* View Mode Switcher */}
                  <div className="flex items-center rounded-lg bg-[#050B14] border border-slate-800 p-0.5 text-xs font-mono">
                    <button
                      type="button"
                      onClick={() => setFeedViewMode("COMPACT")}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition cursor-pointer ${
                        feedViewMode === "COMPACT"
                          ? "bg-cyan-950 text-cyan-300 font-bold border border-cyan-700/60 shadow-xs"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                      title="Row-by-Row High-Density Compact View"
                    >
                      <LayoutList className="w-3.5 h-3.5" />
                      <span>Compact Rows</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFeedViewMode("DETAILED")}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition cursor-pointer ${
                        feedViewMode === "DETAILED"
                          ? "bg-cyan-950 text-cyan-300 font-bold border border-cyan-700/60 shadow-xs"
                          : "text-slate-400 hover:text-slate-200"
                      }`}
                      title="Detailed Multi-Section Card View"
                    >
                      <LayoutGrid className="w-3.5 h-3.5" />
                      <span>Detailed Cards</span>
                    </button>
                  </div>

                  {/* Rows per page selector */}
                  <div className="flex items-center gap-1.5 text-xs font-mono text-slate-400">
                    <span className="hidden sm:inline">Rows:</span>
                    <select
                      aria-label="Rows per page"
                      value={feedLimit}
                      onChange={(e) => {
                        setFeedLimit(Number(e.target.value));
                        setFeedPage(1);
                      }}
                      className="bg-[#050B14] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-cyan-300 focus:outline-hidden focus:border-cyan-500 cursor-pointer"
                    >
                      <option value={15}>15 / page</option>
                      <option value={30}>30 / page</option>
                      <option value={50}>50 / page</option>
                      <option value={100}>100 / page</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Feed Sorting Notification */}
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 border-t border-slate-900 pt-2">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-cyan-400" />
                  Primary Ordering: <strong>Actual Publication Date (Newest First)</strong> · View: <strong className="text-cyan-300">{feedViewMode === "COMPACT" ? "Compact Row-by-Row" : "Detailed Cards"}</strong>
                </span>
                <span>
                  Showing {feedItems.length} of {feedTotal} {deduplicateStocks ? "unique companies" : "presentations"}
                </span>
              </div>
            </div>

            {/* Presentation Feed Content */}
            {feedLoading ? (
              <div className="py-20 flex flex-col items-center justify-center space-y-3">
                <RefreshCw className="w-8 h-8 animate-spin text-cyan-400" />
                <span className="text-xs font-mono text-slate-400">Loading latest quarterly intelligence feed...</span>
              </div>
            ) : feedItems.length === 0 ? (
              <EmptyState
                title="No Presentations Found"
                description={`No presentations match the current quarter (${selectedQuarter}) or active filters.`}
              />
            ) : (
              <div className="space-y-4">
                {/* COMPACT ROW-BY-ROW VIEW */}
                {feedViewMode === "COMPACT" ? (
                  <div className="rounded-xl border border-cyan-950/80 bg-[#070D18] overflow-hidden shadow-2xl">
                    {/* Header Row */}
                    <div className="hidden lg:grid lg:grid-cols-12 gap-3 px-4 py-3 bg-[#0A1222] border-b border-cyan-950 text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400">
                      <div className="col-span-3">Company & Available Filings</div>
                      <div className="col-span-2">Stance & Thesis</div>
                      <div className="col-span-2">Execution & Conviction</div>
                      <div className="col-span-3">Executive Thesis & Catalyst</div>
                      <div className="col-span-2 text-right">Commitments & Actions</div>
                    </div>

                    {/* High-Density Rows */}
                    <div className="divide-y divide-cyan-950/60">
                      {feedItems.map((item) => {
                        const isAnalyzed = item.ai_analysis_status === "ANALYZED";
                        const isPending = item.ai_analysis_status === "PENDING";
                        const isFailed = item.ai_analysis_status === "FAILED";
                        const thesisStyle = getThesisBadge(item.thesis_impact);
                        const stanceStyle = getStanceBadge(item.institutional_stance);
                        const isRowExpanded = expandedRowId === item.document_id;

                        return (
                          <div
                            key={`feed-compact-${item.document_id}`}
                            className="hover:bg-[#0A1426] transition-colors duration-150"
                          >
                            {/* Main Compact Row */}
                            <div className="p-3 sm:px-4 sm:py-2.5 grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
                              {/* Col 1: Company, Symbol & Filings (col-span-3) */}
                              <div className="col-span-3 space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <button
                                    onClick={() => {
                                      setActiveSymbolForDrawer(item.symbol);
                                      setIsDrawerOpen(true);
                                    }}
                                    className="text-sm font-black font-mono text-white hover:text-cyan-300 transition flex items-center gap-1 cursor-pointer"
                                  >
                                    {item.symbol}
                                    <ArrowUpRight className="w-3.5 h-3.5 text-cyan-400 opacity-60" />
                                  </button>
                                  <span className="text-[11px] text-slate-400 truncate max-w-[140px]" title={item.company_name || ""}>
                                    {item.company_name}
                                  </span>
                                  {item.sector && (
                                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 shrink-0">
                                      {item.sector}
                                    </span>
                                  )}
                                </div>

                                {/* Filings Pills */}
                                <div className="flex items-center gap-1.5 flex-wrap text-[10px] font-mono">
                                  <span className="px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-800/60 text-cyan-300 font-bold">
                                    {item.fiscal_period || "Current"}
                                  </span>
                                  {item.related_filings && item.related_filings.length > 0 ? (
                                    item.related_filings.map((rf) => (
                                      <span
                                        key={`rf-comp-${rf.id}`}
                                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border ${
                                          rf.is_primary
                                            ? "bg-cyan-950/80 border-cyan-600/50 text-cyan-200"
                                            : "bg-slate-900/60 border-slate-800 text-slate-400"
                                        }`}
                                      >
                                        <span className={`w-1.5 h-1.5 rounded-full ${rf.status === "ANALYZED" ? "bg-emerald-400" : "bg-amber-400"}`} />
                                        <span>{rf.doc_type === "INVESTOR_PRESENTATION" ? "PPT" : rf.doc_type === "CONCALL_TRANSCRIPT" ? "Concall" : "Audio"}</span>
                                        {rf.pdf_url && (
                                          <a href={rf.pdf_url} target="_blank" rel="noreferrer" className="text-cyan-400 hover:text-cyan-200">
                                            <ExternalLink className="w-2.5 h-2.5" />
                                          </a>
                                        )}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                                      {item.doc_type?.replace(/_/g, " ")}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Col 2: Stance & Thesis (col-span-2) */}
                              <div className="col-span-2 space-y-1">
                                {isAnalyzed ? (
                                  <>
                                    <div className="flex items-center gap-1.5">
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border font-mono truncate max-w-[170px] ${stanceStyle.bg}`} title={stanceStyle.label}>
                                        {stanceStyle.label}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1 text-[10px] font-mono">
                                      <span className={`px-1.5 py-0.5 rounded border flex items-center gap-1 ${thesisStyle.bg}`}>
                                        {thesisStyle.icon}
                                        <span>{item.thesis_impact}</span>
                                      </span>
                                    </div>
                                  </>
                                ) : isPending ? (
                                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/80 border border-amber-500/50 text-amber-300 font-bold flex items-center gap-1 w-fit">
                                    <Clock className="w-3 h-3 animate-spin text-amber-400" />
                                    PENDING AI
                                  </span>
                                ) : (
                                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950/80 border border-rose-500/50 text-rose-300 font-bold flex items-center gap-1 w-fit">
                                    <AlertCircle className="w-3 h-3 text-rose-400" />
                                    FAILED
                                  </span>
                                )}
                              </div>

                              {/* Col 3: Execution & Conviction (col-span-2) */}
                              <div className="col-span-2 space-y-1 text-xs font-mono">
                                {isAnalyzed ? (
                                  <>
                                    <div className="flex items-center gap-2">
                                      <span className="text-slate-400 text-[10px]">Conviction:</span>
                                      <span className="font-bold text-white text-[11px]">
                                        {item.growth_conviction_score !== null && item.growth_conviction_score !== undefined
                                          ? `${item.growth_conviction_score}/100`
                                          : "—"}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px]">
                                      <span className="text-slate-500">Tone:</span>
                                      <span className="text-cyan-300 font-semibold truncate">
                                        {item.management_tone ? item.management_tone.replace(/_/g, " ") : "NEUTRAL"}
                                      </span>
                                    </div>
                                  </>
                                ) : (
                                  <span className="text-[11px] text-slate-500 italic">Analysis queued</span>
                                )}
                              </div>

                              {/* Col 4: Executive Thesis & Catalyst (col-span-3) */}
                              <div className="col-span-3 text-xs leading-relaxed">
                                {item.is_transformational_catalyst && item.catalyst_headline ? (
                                  <div className="space-y-0.5">
                                    <span className="text-[9px] font-mono font-bold text-amber-400 uppercase flex items-center gap-1">
                                      <Sparkles className="w-2.5 h-2.5" />
                                      Catalyst:
                                    </span>
                                    <p className="text-[11px] font-medium text-amber-200 line-clamp-1" title={item.catalyst_headline}>
                                      {item.catalyst_headline}
                                    </p>
                                  </div>
                                ) : (
                                  <p className="text-[11px] text-slate-300 line-clamp-2" title={item.executive_thesis || ""}>
                                    {item.executive_thesis || "Awaiting AI synthesis extraction..."}
                                  </p>
                                )}
                              </div>

                              {/* Col 5: Commitments & Quick Actions (col-span-2) */}
                              <div className="col-span-2 flex items-center justify-between lg:justify-end gap-2 text-right">
                                <div className="text-left lg:text-right space-y-0.5">
                                  <div className="text-[10px] font-mono text-amber-400 flex items-center lg:justify-end gap-1 font-bold">
                                    <Target className="w-3 h-3 text-amber-400" />
                                    <span>{item.commitments_count || 0} Targets</span>
                                  </div>
                                  <div className="text-[10px] font-mono text-slate-500">
                                    {item.announcement_date
                                      ? new Date(item.announcement_date).toLocaleDateString("en-IN", {
                                          month: "short",
                                          day: "numeric",
                                        })
                                      : "Pending"}
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    onClick={() => {
                                      setActiveSymbolForDrawer(item.symbol);
                                      setIsDrawerOpen(true);
                                    }}
                                    className="px-2.5 py-1 rounded bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-600/40 text-cyan-300 text-xs font-mono font-medium transition cursor-pointer flex items-center gap-1"
                                    title="Open Full Intelligence Terminal Drawer"
                                  >
                                    <span>Inspect</span>
                                    <ArrowUpRight className="w-3 h-3" />
                                  </button>

                                  {/* Inline Toggle Chevron */}
                                  <button
                                    onClick={() => setExpandedRowId(isRowExpanded ? null : item.document_id)}
                                    className="p-1 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-cyan-300 transition cursor-pointer"
                                    title={isRowExpanded ? "Collapse inline preview" : "Expand inline preview"}
                                  >
                                    {isRowExpanded ? <ChevronUp className="w-3.5 h-3.5 text-cyan-400" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Expandable Inline Details Tray */}
                            {isRowExpanded && (
                              <div className="px-4 py-3 bg-[#050B14] border-t border-cyan-950/80 space-y-3 text-xs">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {/* Positives */}
                                  <div className="p-2.5 rounded bg-emerald-950/20 border border-emerald-900/40 space-y-1">
                                    <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase flex items-center gap-1">
                                      <TrendingUp className="w-3 h-3" /> Major Positives:
                                    </span>
                                    <ul className="space-y-1 text-slate-300 text-[11px]">
                                      {item.positive_developments && item.positive_developments.length > 0 ? (
                                        item.positive_developments.slice(0, 3).map((p, idx) => (
                                          <li key={idx} className="flex items-start gap-1.5">
                                            <span className="text-emerald-400 font-mono">•</span>
                                            <span>{p}</span>
                                          </li>
                                        ))
                                      ) : (
                                        <li className="text-slate-500 italic">No specific positive triggers logged</li>
                                      )}
                                    </ul>
                                  </div>

                                  {/* Negatives */}
                                  <div className="p-2.5 rounded bg-rose-950/20 border border-rose-900/40 space-y-1">
                                    <span className="text-[10px] font-mono font-bold text-rose-400 uppercase flex items-center gap-1">
                                      <AlertTriangle className="w-3 h-3" /> Material Risks & Headwinds:
                                    </span>
                                    <ul className="space-y-1 text-slate-300 text-[11px]">
                                      {item.negative_developments && item.negative_developments.length > 0 ? (
                                        item.negative_developments.slice(0, 3).map((n, idx) => (
                                          <li key={idx} className="flex items-start gap-1.5">
                                            <span className="text-rose-400 font-mono">•</span>
                                            <span>{n}</span>
                                          </li>
                                        ))
                                      ) : (
                                        <li className="text-slate-500 italic">No critical headwinds logged</li>
                                      )}
                                    </ul>
                                  </div>
                                </div>

                                {item.guidance_changes && formatGuidanceChanges(item.guidance_changes) && (
                                  <div className="text-[11px] font-mono p-2 rounded bg-cyan-950/40 border border-cyan-900/60 text-cyan-200">
                                    <strong className="text-cyan-300">Guidance Revision: </strong>
                                    {formatGuidanceChanges(item.guidance_changes)}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  /* DETAILED CARDS VIEW */
                  <div className="space-y-4">
                {feedItems.map((item) => {
                  const isAnalyzed = item.ai_analysis_status === "ANALYZED";
                  const isPending = item.ai_analysis_status === "PENDING";
                  const isFailed = item.ai_analysis_status === "FAILED";
                  const thesisStyle = getThesisBadge(item.thesis_impact);

                  return (
                    <div
                      key={`feed-doc-${item.document_id}`}
                      className="rounded-xl border border-cyan-950 hover:border-cyan-800/60 bg-gradient-to-r from-[#070D18] to-[#0A1222] p-5 transition shadow-lg space-y-3.5"
                    >
                      {/* Top Header Row */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-cyan-950 pb-3">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => {
                              setActiveSymbolForDrawer(item.symbol);
                              setIsDrawerOpen(true);
                            }}
                            className="text-lg font-black font-mono text-white hover:text-cyan-300 transition flex items-center gap-1.5 cursor-pointer"
                          >
                            {item.symbol}
                            <ArrowUpRight className="w-4 h-4 text-cyan-400 opacity-60" />
                          </button>
                          <span className="text-xs text-slate-300 font-medium">
                            {item.company_name}
                          </span>
                          {item.sector && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                              {item.sector}
                            </span>
                          )}
                        </div>

                        {/* Badges & Date */}
                        <div className="flex items-center gap-2 flex-wrap text-xs font-mono">
                          {/* Announcement Date */}
                          <div className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-300 flex items-center gap-1.5 text-[11px]">
                            <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                            <span>
                              {item.announcement_date
                                ? new Date(item.announcement_date).toLocaleDateString("en-IN", {
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                  })
                                : "Publication Date Pending"}
                            </span>
                          </div>

                          {/* Fiscal Quarter */}
                          <span className="px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-800 text-cyan-300 font-bold">
                            {item.fiscal_period || "Current"}
                          </span>

                          {/* Status Badge */}
                          {isAnalyzed ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              ANALYZED
                            </span>
                          ) : isPending ? (
                            <span className="px-2 py-0.5 rounded bg-amber-950/80 border border-amber-500/50 text-amber-300 font-bold flex items-center gap-1">
                              <Clock className="w-3 h-3 text-amber-400 animate-spin" />
                              PENDING AI ANALYSIS
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-rose-950/80 border border-rose-500/50 text-rose-300 font-bold flex items-center gap-1">
                              <AlertCircle className="w-3 h-3 text-rose-400" />
                              PROCESSING FAILED
                            </span>
                          )}

                          {/* Thesis Impact Badge */}
                          {isAnalyzed && (
                            <span className={`px-2 py-0.5 rounded border text-[11px] font-bold flex items-center gap-1.5 ${thesisStyle.bg}`}>
                              {thesisStyle.icon}
                              {thesisStyle.label}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Unified Filings Pills Row (When stock has multiple filings in this period) */}
                      {item.related_filings && item.related_filings.length > 1 && (
                        <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg bg-black/40 border border-cyan-950/80 text-xs font-mono">
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold flex items-center gap-1 shrink-0">
                            <Layers className="w-3 h-3 text-cyan-400" />
                            All Filings ({item.related_filings.length}):
                          </span>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {item.related_filings.map((rf) => (
                              <div
                                key={`rf-${rf.id}`}
                                className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] border transition ${
                                  rf.is_primary
                                    ? "bg-cyan-950/90 border-cyan-600/70 text-cyan-200 font-semibold"
                                    : "bg-slate-900/80 border-slate-800 text-slate-300 hover:border-cyan-800"
                                }`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    rf.status === "ANALYZED"
                                      ? "bg-emerald-400"
                                      : rf.status === "FAILED"
                                      ? "bg-rose-400"
                                      : "bg-amber-400"
                                  }`}
                                />
                                <span>{rf.doc_type.replace(/_/g, " ")}</span>
                                {rf.pdf_url && (
                                  <a
                                    href={rf.pdf_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-cyan-400 hover:text-cyan-200 ml-0.5 inline-flex items-center"
                                    title="Open filing source PDF"
                                  >
                                    <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Content Body */}
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {/* Column 1: Executive Summary & Thesis */}
                        <div className="lg:col-span-2 space-y-3">
                          <div>
                            <span className="text-[10px] uppercase font-mono tracking-wider text-slate-500 block mb-1">
                              Quarterly Presentation Synthesis
                            </span>
                            <p className="text-xs text-slate-200 leading-relaxed font-sans">
                              {item.executive_thesis}
                            </p>
                          </div>

                          {/* Positive vs Negative Developments */}
                          {isAnalyzed && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                              {/* Major Positives */}
                              {item.positive_developments && item.positive_developments.length > 0 && (
                                <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-900/50 space-y-1">
                                  <span className="text-[10px] font-mono font-bold text-emerald-400 flex items-center gap-1 uppercase">
                                    <TrendingUp className="w-3 h-3" />
                                    Positive Developments:
                                  </span>
                                  <ul className="space-y-1 text-[11px] text-slate-300">
                                    {item.positive_developments.slice(0, 3).map((p, idx) => (
                                      <li key={idx} className="flex items-start gap-1.5">
                                        <span className="text-emerald-400 shrink-0">•</span>
                                        <span>{p}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Major Negatives / Risks */}
                              {item.negative_developments && item.negative_developments.length > 0 && (
                                <div className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-900/50 space-y-1">
                                  <span className="text-[10px] font-mono font-bold text-rose-400 flex items-center gap-1 uppercase">
                                    <AlertTriangle className="w-3 h-3" />
                                    Headwinds & Margin Risks:
                                  </span>
                                  <ul className="space-y-1 text-[11px] text-slate-300">
                                    {item.negative_developments.slice(0, 3).map((n, idx) => (
                                      <li key={idx} className="flex items-start gap-1.5">
                                        <span className="text-rose-400 shrink-0">•</span>
                                        <span>{n}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Guidance Changes */}
                          {item.guidance_changes && formatGuidanceChanges(item.guidance_changes) && (
                            <div className="text-[11px] font-mono p-2 rounded bg-cyan-950/40 border border-cyan-900/60 text-cyan-200">
                              <span className="font-bold text-cyan-300">Guidance Revision: </span>
                              {formatGuidanceChanges(item.guidance_changes)}
                            </div>
                          )}
                        </div>

                        {/* Column 2: Key Metrics & Commitment Summary */}
                        <div className="rounded-xl bg-[#050A14] border border-cyan-950 p-3 space-y-3 flex flex-col justify-between">
                          <div className="space-y-2.5 text-xs font-mono">
                            <span className="text-[10px] uppercase text-slate-500 font-bold tracking-wider block">
                              Execution Conviction
                            </span>

                            <div className="flex items-center justify-between">
                              <span className="text-slate-400">Growth Conviction:</span>
                              <span className="font-bold text-white">
                                {isAnalyzed && item.growth_conviction_score !== null && item.growth_conviction_score !== undefined
                                  ? `${item.growth_conviction_score}/100`
                                  : "—"}
                              </span>
                            </div>

                            <div className="flex items-center justify-between">
                              <span className="text-slate-400">Management Tone:</span>
                              <span className="font-bold text-cyan-300">
                                {isAnalyzed && item.management_tone ? item.management_tone : "PENDING"}
                              </span>
                            </div>

                            <div className="flex items-center justify-between">
                              <span className="text-slate-400">Extracted Commitments:</span>
                              <span className="font-bold text-amber-400 flex items-center gap-1">
                                <Target className="w-3 h-3 text-amber-400" />
                                {item.commitments_count || 0} Commitments
                              </span>
                            </div>

                            {item.processing_error && (
                              <div className="p-2 rounded bg-rose-950/60 border border-rose-800 text-[10px] text-rose-300">
                                <strong>Error: </strong> {item.processing_error}
                              </div>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="pt-2 border-t border-slate-900 flex items-center gap-2 flex-wrap">
                            {item.pdf_url && (
                              <a
                                href={item.pdf_url}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-cyan-400 hover:text-cyan-300 text-xs font-mono transition flex items-center gap-1"
                              >
                                <ExternalLink className="w-3 h-3" />
                                Source Filing
                              </a>
                            )}

                            <button
                              onClick={() => {
                                setActiveSymbolForDrawer(item.symbol);
                                setIsDrawerOpen(true);
                              }}
                              className="px-2.5 py-1 rounded-lg bg-cyan-950/80 hover:bg-cyan-900/80 border border-cyan-600/40 text-cyan-300 text-xs font-mono font-medium transition flex items-center gap-1 cursor-pointer"
                            >
                              <Sparkles className="w-3 h-3" />
                              Full Deep Dive
                            </button>

                            {(!isAnalyzed || isFailed) && (
                              <button
                                onClick={() => handleReprocess(item.document_id)}
                                disabled={actionInProgress}
                                className="px-2 py-1 rounded-lg bg-amber-950/80 hover:bg-amber-900/80 border border-amber-600/40 text-amber-300 text-xs font-mono transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              >
                                <RefreshCw className="w-3 h-3" />
                                Reprocess
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                  </div>
                )}

                {/* Pagination Controls */}
                <div className="flex items-center justify-between border-t border-cyan-950 pt-4 text-xs font-mono">
                  <span className="text-slate-400">
                    Page {feedPage} of {Math.max(1, Math.ceil(feedTotal / feedLimit))}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setFeedPage((p) => Math.max(1, p - 1))}
                      disabled={feedPage <= 1}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-40 transition cursor-pointer"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setFeedPage((p) => p + 1)}
                      disabled={feedPage * feedLimit >= feedTotal}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white disabled:opacity-40 transition cursor-pointer"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =======================================================
            TAB 2: QUARTERLY COVERAGE & PROCESSING HEALTH DASHBOARD
           ======================================================= */}
        {activeTab === "COVERAGE" && coverageData && (
          <div className="space-y-6">
            {/* Live Metrics Grid (Requirements 1 - 8) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
              {/* Metric 1: Total Presentations Discovered */}
              <div
                onClick={() =>
                  openDrilldown(
                    "discovered",
                    `Discovered Presentations (${selectedQuarter})`,
                    [
                      ...(coverageData.drilldown_records.ANALYZED || []),
                      ...(coverageData.drilldown_records.EXTRACTED_NOT_ANALYZED || []),
                      ...(coverageData.drilldown_records.DOWNLOADED_NOT_EXTRACTED || []),
                      ...(coverageData.drilldown_records.DISCOVERED_NOT_DOWNLOADED || []),
                      ...(coverageData.drilldown_records.FAILED || []),
                    ]
                  )
                }
                className="p-3.5 rounded-xl bg-[#070D18] border border-cyan-950 hover:border-cyan-600/50 transition cursor-pointer flex flex-col justify-between"
              >
                <div className="flex items-center justify-between text-slate-500 uppercase text-[10px]">
                  <span>1. Discovered PPTs</span>
                  <Database className="w-3.5 h-3.5 text-cyan-500" />
                </div>
                <div className="text-2xl font-black text-cyan-400 mt-1">
                  {coverageData.total_discovered}
                </div>
                <span className="text-[10px] text-slate-500">Official Filings</span>
              </div>

              {/* Metric 2: Successfully Analyzed by AI */}
              <div
                onClick={() =>
                  openDrilldown(
                    "analyzed",
                    `AI Analyzed Presentations (${selectedQuarter})`,
                    coverageData.drilldown_records.ANALYZED || []
                  )
                }
                className="p-3.5 rounded-xl bg-[#070D18] border border-cyan-950 hover:border-emerald-600/50 transition cursor-pointer flex flex-col justify-between"
              >
                <div className="flex items-center justify-between text-slate-500 uppercase text-[10px]">
                  <span>2. Analyzed by AI</span>
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div className="text-2xl font-black text-emerald-400 mt-1">
                  {coverageData.analyzed_count}{" "}
                  <span className="text-xs font-normal text-emerald-300 font-mono">
                    ({coverageData.analyzed_percentage}%)
                  </span>
                </div>
                <span className="text-[10px] text-slate-500">Synthesized Reports</span>
              </div>

              {/* Metric 3: Pending Analyses */}
              <div
                onClick={() =>
                  openDrilldown(
                    "pending",
                    `Pending AI Analysis Queue (${selectedQuarter})`,
                    [
                      ...(coverageData.drilldown_records.EXTRACTED_NOT_ANALYZED || []),
                      ...(coverageData.drilldown_records.DOWNLOADED_NOT_EXTRACTED || []),
                      ...(coverageData.drilldown_records.DISCOVERED_NOT_DOWNLOADED || []),
                    ]
                  )
                }
                className="p-3.5 rounded-xl bg-[#070D18] border border-cyan-950 hover:border-amber-600/50 transition cursor-pointer flex flex-col justify-between"
              >
                <div className="flex items-center justify-between text-slate-500 uppercase text-[10px]">
                  <span>3. Pending Queue</span>
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <div className="text-2xl font-black text-amber-400 mt-1">
                  {coverageData.pending_count}
                </div>
                <span className="text-[10px] text-slate-500">Awaiting LLM Pass</span>
              </div>

              {/* Metric 4: Failed Downloads/Analyses */}
              <div
                onClick={() =>
                  openDrilldown(
                    "failed",
                    `Failed Processing Records (${selectedQuarter})`,
                    coverageData.drilldown_records.FAILED || []
                  )
                }
                className="p-3.5 rounded-xl bg-[#070D18] border border-cyan-950 hover:border-rose-600/50 transition cursor-pointer flex flex-col justify-between"
              >
                <div className="flex items-center justify-between text-slate-500 uppercase text-[10px]">
                  <span>4. Failed / Errored</span>
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                </div>
                <div className="text-2xl font-black text-rose-400 mt-1">
                  {coverageData.failed_count}
                </div>
                <span className="text-[10px] text-slate-500">Eligible for Reprocess</span>
              </div>

              {/* Metric 5: Companies Covered */}
              <div className="p-3.5 rounded-xl bg-[#070D18] border border-cyan-950 flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-500 uppercase text-[10px]">
                  <span>5. Equities Covered</span>
                  <Building2 className="w-3.5 h-3.5 text-blue-400" />
                </div>
                <div className="text-2xl font-black text-white mt-1">
                  {coverageData.companies_covered}
                </div>
                <span className="text-[10px] text-slate-500">Unique Symbols</span>
              </div>

              {/* Metric 6: Commitments Extracted */}
              <div className="p-3.5 rounded-xl bg-[#070D18] border border-cyan-950 flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-500 uppercase text-[10px]">
                  <span>6. Extracted Commitments</span>
                  <Target className="w-3.5 h-3.5 text-purple-400" />
                </div>
                <div className="text-2xl font-black text-purple-400 mt-1">
                  {coverageData.commitments_extracted}
                </div>
                <span className="text-[10px] text-slate-500">In Active Ledger</span>
              </div>

              {/* Metric 7: Commitments Due for Evaluation */}
              <div className="p-3.5 rounded-xl bg-[#070D18] border border-cyan-950 flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-500 uppercase text-[10px]">
                  <span>7. Commitments Due</span>
                  <Activity className="w-3.5 h-3.5 text-amber-300" />
                </div>
                <div className="text-2xl font-black text-amber-300 mt-1">
                  {coverageData.commitments_due}
                </div>
                <span className="text-[10px] text-slate-500">Evaluation Horizon Reached</span>
              </div>

              {/* Metric 8: Assessed Delivery Rate */}
              <div className="p-3.5 rounded-xl bg-[#070D18] border border-cyan-950 flex flex-col justify-between">
                <div className="flex items-center justify-between text-slate-500 uppercase text-[10px]">
                  <span>8. Delivery Scorecard</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                </div>
                <div className="text-2xl font-black text-emerald-400 mt-1">
                  {(() => {
                    const assessable = (coverageData.commitments_met || 0) + (coverageData.commitments_partially_met || 0) + (coverageData.commitments_missed || 0);
                    return assessable > 0 ? `${Math.round(((coverageData.commitments_met || 0) / assessable) * 100)}%` : "N/A";
                  })()}
                </div>
                <span className="text-[10px] text-slate-400">
                  {coverageData.commitments_met} Met / {coverageData.commitments_missed} Missed
                </span>
              </div>
            </div>

            {/* Ingestion & Processing Pipeline Health Breakdown (Distinguishing 5 stages) */}
            <div className="p-4 rounded-xl border border-cyan-950 bg-[#080E1A] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-cyan-400" />
                  Presentation Processing Pipeline Health Stages
                </span>
                <button
                  onClick={handleTriggerBackfill}
                  disabled={actionInProgress}
                  className="px-3 py-1 rounded-lg bg-cyan-950 border border-cyan-700/60 text-cyan-300 text-xs font-mono font-medium hover:bg-cyan-900 transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${actionInProgress ? "animate-spin" : ""}`} />
                  Backfill Pending Queue
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs font-mono">
                <div
                  onClick={() =>
                    openDrilldown(
                      "not_downloaded",
                      "Stage 1: Discovered, Not Yet Downloaded",
                      coverageData.drilldown_records.DISCOVERED_NOT_DOWNLOADED || []
                    )
                  }
                  className="p-3 rounded-lg bg-[#050B14] border border-slate-800 hover:border-slate-600 transition cursor-pointer"
                >
                  <span className="text-[10px] text-slate-500 uppercase block">1. Not Downloaded</span>
                  <span className="text-lg font-bold text-slate-300 mt-1 block">
                    {coverageData.drilldown_records.DISCOVERED_NOT_DOWNLOADED?.length || 0}
                  </span>
                  <span className="text-[9px] text-slate-500">URL Indexed</span>
                </div>

                <div
                  onClick={() =>
                    openDrilldown(
                      "downloaded_not_extracted",
                      "Stage 2: Downloaded, Not Extracted",
                      coverageData.drilldown_records.DOWNLOADED_NOT_EXTRACTED || []
                    )
                  }
                  className="p-3 rounded-lg bg-[#050B14] border border-slate-800 hover:border-slate-600 transition cursor-pointer"
                >
                  <span className="text-[10px] text-slate-500 uppercase block">2. Not Extracted</span>
                  <span className="text-lg font-bold text-slate-300 mt-1 block">
                    {coverageData.drilldown_records.DOWNLOADED_NOT_EXTRACTED?.length || 0}
                  </span>
                  <span className="text-[9px] text-slate-500">PDF Cached</span>
                </div>

                <div
                  onClick={() =>
                    openDrilldown(
                      "extracted_not_analyzed",
                      "Stage 3: Extracted, Pending AI Pass",
                      coverageData.drilldown_records.EXTRACTED_NOT_ANALYZED || []
                    )
                  }
                  className="p-3 rounded-lg bg-[#050B14] border border-slate-800 hover:border-amber-600 transition cursor-pointer"
                >
                  <span className="text-[10px] text-amber-500 uppercase block">3. Pending AI</span>
                  <span className="text-lg font-bold text-amber-400 mt-1 block">
                    {coverageData.drilldown_records.EXTRACTED_NOT_ANALYZED?.length || 0}
                  </span>
                  <span className="text-[9px] text-slate-500">In Prompt Queue</span>
                </div>

                <div
                  onClick={() =>
                    openDrilldown(
                      "analyzed",
                      "Stage 4: Analysis Fully Completed",
                      coverageData.drilldown_records.ANALYZED || []
                    )
                  }
                  className="p-3 rounded-lg bg-[#050B14] border border-slate-800 hover:border-emerald-600 transition cursor-pointer"
                >
                  <span className="text-[10px] text-emerald-500 uppercase block">4. Completed</span>
                  <span className="text-lg font-bold text-emerald-400 mt-1 block">
                    {coverageData.drilldown_records.ANALYZED?.length || 0}
                  </span>
                  <span className="text-[9px] text-slate-500">Persisted & Indexed</span>
                </div>

                <div
                  onClick={() =>
                    openDrilldown(
                      "failed",
                      "Stage 5: Processing Errored / Failed",
                      coverageData.drilldown_records.FAILED || []
                    )
                  }
                  className="p-3 rounded-lg bg-[#050B14] border border-slate-800 hover:border-rose-600 transition cursor-pointer"
                >
                  <span className="text-[10px] text-rose-500 uppercase block">5. Processing Failed</span>
                  <span className="text-lg font-bold text-rose-400 mt-1 block">
                    {coverageData.drilldown_records.FAILED?.length || 0}
                  </span>
                  <span className="text-[9px] text-slate-500">Retry Available</span>
                </div>
              </div>
            </div>

            {/* Historical Quarter-over-Quarter Trend Table */}
            <div className="p-4 rounded-xl border border-cyan-950 bg-[#080E1A] space-y-3">
              <span className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <BarChart2 className="w-4 h-4 text-cyan-400" />
                Quarter-over-Quarter Ingestion & Commitment Comparison
              </span>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-cyan-950 text-slate-500 uppercase text-[10px]">
                      <th className="py-2 px-3">Reporting Quarter</th>
                      <th className="py-2 px-3">Discovered PPTs</th>
                      <th className="py-2 px-3">AI Analyzed</th>
                      <th className="py-2 px-3">Completion Rate</th>
                      <th className="py-2 px-3">Companies Covered</th>
                      <th className="py-2 px-3">Extracted Commitments</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900">
                    {coverageData.available_quarters?.map((q) => {
                      const isCurrentActive = q.fiscal_period === selectedQuarter;
                      return (
                        <tr
                          key={q.fiscal_period}
                          onClick={() => {
                            setSelectedQuarter(q.fiscal_period);
                            loadCoverage(q.fiscal_period);
                          }}
                          className={`hover:bg-slate-900/60 cursor-pointer transition ${
                            isCurrentActive ? "bg-cyan-950/30 font-bold" : ""
                          }`}
                          title={`Click to filter radar to ${q.fiscal_period}`}
                        >
                          <td className="py-2 px-3 font-bold text-cyan-300 flex items-center gap-1.5">
                            {q.fiscal_period}
                            {isCurrentActive && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-900/80 text-cyan-300 border border-cyan-700/60 font-mono">
                                ACTIVE
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-slate-200">{q.count}</td>
                          <td className="py-2 px-3 text-emerald-400">
                            {q.analyzed_count !== undefined ? q.analyzed_count : (isCurrentActive ? coverageData.analyzed_count : "—")}
                          </td>
                          <td className="py-2 px-3 text-slate-300">
                            {q.completion_rate !== undefined
                              ? `${q.completion_rate}%`
                              : (isCurrentActive ? `${coverageData.analyzed_percentage}%` : "—")}
                          </td>
                          <td className="py-2 px-3 text-white">
                            {q.companies_covered !== undefined ? q.companies_covered : (isCurrentActive ? coverageData.companies_covered : "—")}
                          </td>
                          <td className="py-2 px-3 text-amber-400">
                            {q.commitments_count !== undefined ? q.commitments_count : (isCurrentActive ? coverageData.commitments_extracted : "—")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* =======================================================
            TAB 3: MANAGEMENT COMMITMENT LEDGER (Quarter-by-Quarter)
           ======================================================= */}
        {activeTab === "COMMITMENTS" && (
          <div className="space-y-6">
            {/* Delivery Scorecard Banner */}
            {overallSummary && (
              <div className="p-4 rounded-xl border border-cyan-900/60 bg-gradient-to-r from-[#070D18] via-[#0A1222] to-[#070D18] space-y-4 shadow-xl">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-cyan-950 pb-3">
                  <div>
                    <h3 className="text-sm font-mono font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                      <Target className="w-4 h-4 text-cyan-400" />
                      Executive Delivery Scorecard (All Universe)
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Delivery Rate Formula:{" "}
                      <code className="text-cyan-300 bg-black/40 px-1 py-0.5 rounded">
                        Met / (Met + Partially Met + Missed) × 100%
                      </code>
                      . Excludes pending upcoming targets.
                    </p>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-mono">
                    <div className="p-2 rounded bg-slate-950 border border-cyan-950">
                      <span className="text-[10px] text-slate-500 uppercase block">Delivery Rate:</span>
                      <span className="text-xl font-black text-emerald-400">
                        {overallSummary.delivery_rate_pct !== null ? `${overallSummary.delivery_rate_pct}%` : "N/A"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3 text-xs font-mono">
                  <div className="p-2.5 rounded bg-black/40 border border-slate-900">
                    <span className="text-[10px] text-slate-500 uppercase block">Total Recorded</span>
                    <span className="text-base font-bold text-white mt-0.5 block">
                      {overallSummary.total_recorded}
                    </span>
                  </div>

                  <div className="p-2.5 rounded bg-black/40 border border-slate-900">
                    <span className="text-[10px] text-emerald-500 uppercase block">Commitments Met</span>
                    <span className="text-base font-bold text-emerald-400 mt-0.5 block">
                      {overallSummary.commitments_met}
                    </span>
                  </div>

                  <div className="p-2.5 rounded bg-black/40 border border-slate-900">
                    <span className="text-[10px] text-cyan-500 uppercase block">Partially Met</span>
                    <span className="text-base font-bold text-cyan-400 mt-0.5 block">
                      {overallSummary.commitments_partially_met}
                    </span>
                  </div>

                  <div className="p-2.5 rounded bg-black/40 border border-slate-900">
                    <span className="text-[10px] text-rose-500 uppercase block">Missed Targets</span>
                    <span className="text-base font-bold text-rose-400 mt-0.5 block">
                      {overallSummary.commitments_missed}
                    </span>
                  </div>

                  <div className="p-2.5 rounded bg-black/40 border border-slate-900">
                    <span className="text-[10px] text-amber-500 uppercase block">Delayed / Revised</span>
                    <span className="text-base font-bold text-amber-400 mt-0.5 block">
                      {overallSummary.commitments_delayed + overallSummary.commitments_revised}
                    </span>
                  </div>

                  <div className="p-2.5 rounded bg-black/40 border border-slate-900">
                    <span className="text-[10px] text-slate-500 uppercase block">Not Yet Due</span>
                    <span className="text-base font-bold text-slate-400 mt-0.5 block">
                      {overallSummary.not_yet_due}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Commitments Ledger Filter Bar */}
            <div className="p-3.5 rounded-xl bg-[#080E1A] border border-cyan-950 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-slate-400 uppercase text-[10px]">Filter Status:</span>
                <select
                  aria-label="Filter Commitment Status"
                  value={commitmentStatusFilter}
                  onChange={(e) => {
                    setCommitmentStatusFilter(e.target.value);
                    setCommitmentsPage(1);
                  }}
                  className="bg-[#050B14] border border-slate-800 rounded-lg px-2.5 py-1 text-slate-300"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="MET">Met</option>
                  <option value="PARTIALLY_MET">Partially Met</option>
                  <option value="MISSED">Missed</option>
                  <option value="ON_TRACK">On Track</option>
                  <option value="DELAYED">Delayed</option>
                  <option value="REVISED">Revised</option>
                  <option value="NOT_YET_DUE">Not Yet Due</option>
                  <option value="UNABLE_TO_VERIFY">Unable to Verify</option>
                </select>

                <span className="text-slate-400 uppercase text-[10px] ml-2">Type:</span>
                <select
                  aria-label="Filter Commitment Type"
                  value={commitmentTypeFilter}
                  onChange={(e) => {
                    setCommitmentTypeFilter(e.target.value);
                    setCommitmentsPage(1);
                  }}
                  className="bg-[#050B14] border border-slate-800 rounded-lg px-2.5 py-1 text-slate-300"
                >
                  <option value="ALL">Financial & Qualitative</option>
                  <option value="FINANCIAL">Financial Numerical Targets Only</option>
                  <option value="QUALITATIVE">Qualitative Milestones Only</option>
                </select>

                <span className="text-slate-400 uppercase text-[10px] ml-2">Category:</span>
                <select
                  aria-label="Filter Commitment Category"
                  value={commitmentCategoryFilter}
                  onChange={(e) => {
                    setCommitmentCategoryFilter(e.target.value);
                    setCommitmentsPage(1);
                  }}
                  className="bg-[#050B14] border border-slate-800 rounded-lg px-2.5 py-1 text-slate-300"
                >
                  <option value="ALL">All Categories</option>
                  <option value="FINANCIAL_TARGET">Financial Target</option>
                  <option value="CAPEX_EXPANSION">Capex & Capacity Expansion</option>
                  <option value="OPERATIONAL_METRIC">Operational KPI</option>
                  <option value="PRODUCT_LAUNCH">Product / Geography Launch</option>
                  <option value="DEBT_REDUCTION">Debt Reduction</option>
                </select>
              </div>

              <div className="text-[11px] text-slate-400">
                Total: <strong>{commitmentsTotal}</strong> commitments recorded
              </div>
            </div>

            {/* Commitments Chronological Timeline List */}
            {commitmentsLoading ? (
              <div className="py-20 flex flex-col items-center justify-center space-y-3">
                <RefreshCw className="w-8 h-8 animate-spin text-cyan-400" />
                <span className="text-xs font-mono text-slate-400">Loading management commitments ledger...</span>
              </div>
            ) : commitments.length === 0 ? (
              <EmptyState
                title="No Commitments Found"
                description="No commitments match your selected filters or quarter."
              />
            ) : (
              <div className="space-y-3.5">
                {commitments.map((c) => {
                  const statusBadge = getCommitmentStatusBadge(c.status);

                  return (
                    <div
                      key={c.commitment_id || c.id}
                      className="p-4 rounded-xl border border-cyan-950 bg-[#070D18] hover:border-cyan-800/60 transition space-y-3 shadow-md"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-cyan-950 pb-2.5">
                        <div className="flex items-center gap-2.5">
                          <button
                            onClick={() => {
                              setActiveSymbolForDrawer(c.symbol);
                              setIsDrawerOpen(true);
                            }}
                            className="text-sm font-bold font-mono text-white hover:text-cyan-300 transition"
                          >
                            {c.symbol}
                          </button>
                          <span className="text-xs text-slate-400">{c.company_name || c.symbol}</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                            {c.category.replace(/_/g, " ")}
                          </span>
                          {c.is_financial_target ? (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                              NUMERICAL TARGET
                            </span>
                          ) : (
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800">
                              QUALITATIVE MILESTONE
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-slate-400">Target Deadline:</span>
                          <span className="text-xs font-mono font-bold text-cyan-300">
                            {c.target_period || "Open"}
                          </span>
                          <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${statusBadge}`}>
                            {c.status.replace(/_/g, " ")}
                          </span>
                        </div>
                      </div>

                      {/* Management Exact Statement */}
                      <div className="text-xs text-slate-200">
                        <p className="font-semibold text-slate-100 mb-1">{c.statement}</p>
                        {c.exact_quote && (
                          <p className="italic text-slate-400 text-[11px] bg-black/40 p-2 rounded border border-slate-900">
                            &ldquo;{c.exact_quote}&rdquo;
                            {c.page_or_slide && (
                              <span className="text-slate-500 font-mono not-italic ml-2">
                                [Source: {c.page_or_slide}]
                              </span>
                            )}
                          </p>
                        )}
                      </div>

                      {/* Target & Delivery Evaluation Ground Reality */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 text-xs">
                        <div className="p-2.5 rounded bg-[#050A14] border border-cyan-950 space-y-1">
                          <span className="text-[10px] font-mono text-slate-400 uppercase block">
                            Target Guideline:
                          </span>
                          <span className="text-white font-mono font-bold">
                            {c.target_value || "Operational Milestone"}
                          </span>
                          {c.metric && <span className="text-slate-400 text-[11px] block">Metric: {c.metric}</span>}
                        </div>

                        <div className="p-2.5 rounded bg-[#050A14] border border-cyan-950 space-y-1">
                          <span className="text-[10px] font-mono text-emerald-400 uppercase block">
                            Audited Delivery Outcome:
                          </span>
                          <span className="text-white font-mono font-bold">
                            {c.actual_result || "Awaiting subsequent financial quarter verification"}
                          </span>
                          {c.assessment_rationale && (
                            <span className="text-slate-400 text-[11px] block">
                              Rationale: {c.assessment_rationale}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Evidence Citations */}
                      {c.evidence_quote && (
                        <div className="text-[11px] font-mono text-slate-400 pt-1 flex items-start gap-1">
                          <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                          <span>
                            <strong>Subsequent Disclosure Citation: </strong> {c.evidence_quote}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* =======================================================
            DRILL-DOWN MODAL FOR PROCESSING STAGES & METRICS
           ======================================================= */}
        {isDrilldownOpen && (
          <div className="fixed inset-0 z-50 overflow-hidden bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-[#070D18] border border-cyan-900/60 rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl">
              <div className="p-4 border-b border-cyan-950 flex items-center justify-between bg-[#0A1222]">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-sm font-mono font-bold text-white">{drilldownTitle}</h3>
                  <span className="text-xs font-mono text-cyan-300 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">
                    {drilldownItems.length} records
                  </span>
                </div>
                <button
                  onClick={() => setIsDrilldownOpen(false)}
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                {drilldownItems.length === 0 ? (
                  <div className="text-center py-10 text-xs font-mono text-slate-400">
                    No presentation records in this stage.
                  </div>
                ) : (
                  drilldownItems.map((doc, idx) => (
                    <div
                      key={doc.id || idx}
                      className="p-3 rounded-lg bg-[#050A14] border border-slate-800/80 flex items-center justify-between text-xs font-mono hover:border-cyan-800/60 transition"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{doc.symbol}</span>
                          <span className="text-slate-400">{doc.company_name}</span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Publication: {doc.announcement_date || "Unknown"}
                          {doc.error && <span className="text-rose-400 ml-2">Error: {doc.error}</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {doc.pdf_url && (
                          <a
                            href={doc.pdf_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-cyan-400 hover:text-cyan-300 text-[11px] flex items-center gap-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                            PDF
                          </a>
                        )}

                        <button
                          onClick={() => {
                            if (doc.id) handleReprocess(doc.id);
                          }}
                          className="px-2 py-0.5 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-800 text-cyan-300 text-[10px] cursor-pointer"
                        >
                          Reprocess
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* =======================================================
            DEEP-DIVE SLIDEOUT DRAWER
           ======================================================= */}
        <InvestorIntelligenceDrawer
          symbol={activeSymbolForDrawer}
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
        />
      </div>
    </DashboardLayout>
  );
}

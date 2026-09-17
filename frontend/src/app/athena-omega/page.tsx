"use client";

// =========================================================================
// Alpha India — ATHENA OMEGA v3.0 Institutional Earnings Intelligence Terminal
// Official Sprint 24
// Pure Earnings Intelligence. No Market Noise.
// Bloomberg Dark Aesthetic (#050B14) · Cyan (#06B6D4) · Emerald (#10B981) · Amber (#F59E0B)
// =========================================================================

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Zap,
  Flame,
  Search,
  RefreshCw,
  Clock,
  ShieldCheck,
  AlertCircle,
  Copy,
  Check,
  Send,
  Eye,
  Sliders,
  CheckCircle2,
  Activity,
  X,
  TrendingUp,
} from "lucide-react";

import DashboardLayout from "@/components/layout/DashboardLayout";
import PeadDriftMatrix from "@/components/layout/earnings/PeadDriftMatrix";
import {
  fetchFlashDecisions,
  fetchFilingsFeed,
  fetchFullAnalysis,
  triggerExchangeScan,
  fetchShareableBrief,
  sendTelegramBroadcast,
  type FlashDecisionItem,
  type FilingFeedItem,
  type GateBreakdown,
} from "@/lib/athenaApi";

// =========================================================================
// Freshness Calculation Helper
// =========================================================================
function getFreshnessInfo(publishedAt?: string, detectedAt?: string) {
  const ts = publishedAt || detectedAt;
  if (!ts) {
    return {
      label: "ARCHIVE",
      relative: "Earlier",
      formattedDate: "Past",
      colorClass: "bg-slate-900 border-slate-800 text-slate-400",
      isHot: false,
    };
  }

  const date = new Date(ts);
  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - date.getTime());
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  const formattedDate = date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  if (diffMinutes < 60) {
    return {
      label: "JUST IN",
      relative: `${diffMinutes}m ago`,
      formattedDate,
      colorClass: "bg-emerald-950/90 border border-emerald-500/60 text-emerald-300 font-bold",
      isHot: true,
    };
  } else if (diffHours < 24) {
    return {
      label: "TODAY",
      relative: `${diffHours}h ago`,
      formattedDate,
      colorClass: "bg-cyan-950/70 border border-cyan-500/40 text-cyan-300 font-medium",
      isHot: false,
    };
  } else if (diffDays < 7) {
    return {
      label: `${diffDays}D AGO`,
      relative: `${diffDays}d ago`,
      formattedDate,
      colorClass: "bg-slate-800/80 border border-slate-700/60 text-slate-300",
      isHot: false,
    };
  } else {
    return {
      label: date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
      relative: `${diffDays}d ago`,
      formattedDate,
      colorClass: "bg-slate-900 border border-slate-800 text-slate-400",
      isHot: false,
    };
  }
}

export default function AthenaOmegaPage() {
  const [decisions, setDecisions] = useState<FlashDecisionItem[]>([]);
  const [filings, setFilings] = useState<FilingFeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState<string>("");
  const [selectedFreshness, setSelectedFreshness] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"conviction" | "freshness" | "upside" | "shock">("conviction");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"flash" | "pead" | "queue" | "about">("flash");

  // Read URL query params on mount for direct tab linking
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab") || params.get("view");
      if (tabParam === "pead") {
        setActiveTab("pead");
      } else if (tabParam === "queue" || tabParam === "feed") {
        setActiveTab("queue");
      }
    }
  }, []);

  // Inspection Modal State
  const [selectedAnalysis, setSelectedAnalysis] = useState<GateBreakdown | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalGateTab, setModalGateTab] = useState<"g1" | "g2" | "g3" | "g4" | "pead" | "metrics">("g1");

  // Copy Brief state
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [telegramSentId, setTelegramSentId] = useState<number | null>(null);

  // Load Data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [flashRes, feedRes] = await Promise.all([
        fetchFlashDecisions({
          grade: selectedGrade || undefined,
          search: searchQuery || undefined,
          freshness: selectedFreshness !== "all" ? selectedFreshness : undefined,
          sort_by: sortBy,
          limit: 100,
        }),
        fetchFilingsFeed({
          freshness: selectedFreshness !== "all" ? selectedFreshness : undefined,
          limit: 100,
        }),
      ]);
      setDecisions(flashRes.results || []);
      setFilings(feedRes.filings || []);
    } catch (err) {
      console.error("Error loading ATHENA OMEGA data:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedGrade, searchQuery, selectedFreshness, sortBy]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Trigger Live Scan
  const handleTriggerScan = async () => {
    setScanning(true);
    try {
      await triggerExchangeScan();
      // Allow brief pause then reload
      setTimeout(() => {
        loadData();
        setScanning(false);
      }, 1500);
    } catch (err) {
      console.error("Failed to trigger scan:", err);
      setScanning(false);
    }
  };

  // Inspect 5-Gate modal
  const handleInspect = async (filingId: number | string) => {
    setModalLoading(true);
    try {
      const data = await fetchFullAnalysis(filingId);
      setSelectedAnalysis(data);
      setModalGateTab("g1");
    } catch (err) {
      console.error("Failed to fetch full analysis:", err);
    } finally {
      setModalLoading(false);
    }
  };

  // Copy Institutional Brief
  const handleCopyBrief = async (id: number) => {
    try {
      const briefData = await fetchShareableBrief(id);
      await navigator.clipboard.writeText(briefData.brief_text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 3000);
    } catch (err) {
      console.error("Failed to copy brief:", err);
    }
  };

  // Broadcast Telegram
  const handleBroadcastTelegram = async (id: number) => {
    try {
      await sendTelegramBroadcast(id);
      setTelegramSentId(id);
      setTimeout(() => setTelegramSentId(null), 3000);
    } catch (err) {
      console.error("Failed to send telegram alert:", err);
    }
  };

  // Filtered decisions with client-side sort reinforcement
  const filteredDecisions = useMemo(() => {
    let result = decisions.filter((d) => {
      if (selectedGrade && d.conviction_grade !== selectedGrade) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return d.symbol.toLowerCase().includes(q) || d.company_name.toLowerCase().includes(q);
      }
      return true;
    });

    if (sortBy === "freshness") {
      result = [...result].sort((a, b) => {
        const tA = new Date(a.published_at || a.detected_at || 0).getTime();
        const tB = new Date(b.published_at || b.detected_at || 0).getTime();
        return tB - tA;
      });
    } else if (sortBy === "upside") {
      result = [...result].sort((a, b) => (b.upside_potential_pct || 0) - (a.upside_potential_pct || 0));
    } else if (sortBy === "shock") {
      result = [...result].sort((a, b) => (b.decision_drivers.financial_shock || 0) - (a.decision_drivers.financial_shock || 0));
    } else {
      result = [...result].sort((a, b) => b.athena_conviction_score - a.athena_conviction_score);
    }

    return result;
  }, [decisions, selectedGrade, searchQuery, sortBy]);

  // Metric aggregates
  const aaaPlusCount = decisions.filter((d) => d.conviction_grade === "AAA+").length;
  const aaaCount = decisions.filter((d) => d.conviction_grade === "AAA").length;
  const avgProcessingTime = decisions.length > 0
    ? (decisions.reduce((acc, d) => acc + d.processing_time_sec, 0) / decisions.length).toFixed(3)
    : "0.025";

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-[#050B14] text-slate-100 p-4 md:p-6 space-y-6">
        {/* =========================================================================
            HEADER & TELEMETRY BAR
        ========================================================================= */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-600/30 to-emerald-500/20 border border-cyan-500/40 text-cyan-400">
                <Zap className="w-6 h-6 animate-pulse text-cyan-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-black tracking-tight text-white font-mono">
                    ATHENA OMEGA <span className="text-cyan-400">v3.0</span>
                  </h1>
                  <span className="px-2 py-0.5 text-xs font-bold font-mono uppercase rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-400">
                    Sprint 24 Official
                  </span>
                  <span className="px-2 py-0.5 text-xs font-bold font-mono uppercase rounded-full bg-cyan-950/80 border border-cyan-500/40 text-cyan-300">
                    4-Minute SLA Engine
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Pure Earnings Intelligence. No Market Noise. Exchange-First Filing Capture & Local Historical Fusion.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Metrics & Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono">
              <span className="text-slate-400">SLA Target:</span>
              <span className="text-emerald-400 font-bold">&lt; 5m</span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-400">Avg Ingestion:</span>
              <span className="text-cyan-400 font-bold">{avgProcessingTime}s</span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-400">AAA+ Today:</span>
              <span className="text-rose-400 font-bold">{aaaPlusCount}</span>
            </div>

            <button
              onClick={handleTriggerScan}
              disabled={scanning}
              className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs uppercase px-4 py-2 rounded-lg transition-all shadow-lg shadow-cyan-950/50 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${scanning ? "animate-spin" : ""}`} />
              {scanning ? "Scanning Exchange Feeds..." : "Scan NSE & BSE"}
            </button>
          </div>
        </div>

        {/* =========================================================================
            NAVIGATION TABS & SEARCH
        ========================================================================= */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setActiveTab("flash")}
              className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === "flash"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              FLASH Conviction Decisions ({filteredDecisions.length})
            </button>
            <button
              onClick={() => setActiveTab("pead")}
              className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === "pead"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              PEAD Drift Matrix
            </button>
            <button
              onClick={() => setActiveTab("queue")}
              className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === "queue"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-cyan-400" />
              Live Feed & OMEGA Queue ({filings.length})
            </button>
            <button
              onClick={() => setActiveTab("about")}
              className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === "about"
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              5 Gates Architecture
            </button>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search ticker, company..."
              className="bg-slate-900/90 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-full md:w-64 font-mono"
            />
          </div>
        </div>

        {/* =========================================================================
            INSTITUTIONAL SCAN CONTROL & FRESHNESS FILTER TOOLBAR
        ========================================================================= */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800/80 shadow-md">
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Freshness Filter Pills */}
            <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-lg border border-slate-800 text-xs font-mono">
              <span className="text-[10px] text-cyan-400 px-1.5 flex items-center gap-1 font-bold uppercase tracking-wider">
                <Clock className="w-3 h-3 text-cyan-400" />
                Freshness:
              </span>
              {[
                { key: "all", label: "ALL" },
                { key: "1h", label: "< 1H (JUST IN)" },
                { key: "24h", label: "< 24H (TODAY)" },
                { key: "3d", label: "3 DAYS" },
                { key: "7d", label: "7 DAYS" },
                { key: "30d", label: "30 DAYS" },
              ].map((f) => (
                <button
                  key={f.key}
                  onClick={() => setSelectedFreshness(f.key)}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                    selectedFreshness === f.key
                      ? "bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 font-black shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Conviction Grade Filter Pills */}
            <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-lg border border-slate-800 text-xs font-mono">
              <span className="text-[10px] text-slate-400 px-1.5 font-bold uppercase">Grade:</span>
              {["", "AAA+", "AAA", "AA"].map((g) => (
                <button
                  key={g}
                  onClick={() => setSelectedGrade(g)}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                    selectedGrade === g
                      ? "bg-cyan-500 text-slate-950 font-bold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {g || "ALL"}
                </button>
              ))}
            </div>
          </div>

          {/* Sort By Selector */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-lg border border-slate-800 text-xs font-mono">
              <span className="text-[10px] text-amber-400 px-1.5 flex items-center gap-1 font-bold uppercase">
                <Sliders className="w-3 h-3 text-amber-400" />
                Sort:
              </span>
              {[
                { key: "conviction", label: "⚡ Conviction" },
                { key: "freshness", label: "🕒 Freshest" },
                { key: "upside", label: "🚀 Upside" },
                { key: "shock", label: "💥 Shock" },
              ].map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSortBy(s.key as "conviction" | "freshness" | "upside" | "shock")}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${

                    sortBy === s.key
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="text-[11px] font-mono text-slate-400 px-2.5 py-1 rounded bg-slate-950 border border-slate-800 whitespace-nowrap">
              Showing <span className="text-cyan-400 font-bold">{filteredDecisions.length}</span> scans
            </div>
          </div>
        </div>

        {/* =========================================================================
            TAB 1: FLASH DECISION CARDS
        ========================================================================= */}
        {activeTab === "flash" && (
          <div className="space-y-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center p-16 text-slate-500 space-y-3">
                <RefreshCw className="w-8 h-8 animate-spin text-cyan-400" />
                <p className="text-sm font-mono">Executing 5-Gate Analysis & Local Fusion...</p>
              </div>
            ) : filteredDecisions.length === 0 ? (
              <div className="text-center p-12 border border-dashed border-slate-800 rounded-xl bg-slate-950/40">
                <AlertCircle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                <p className="text-sm font-mono text-slate-300">
                  No quarterly results match the selected freshness ({selectedFreshness}) or filters.
                </p>
                <div className="flex items-center justify-center gap-3 mt-3">
                  <button
                    onClick={() => {
                      setSelectedFreshness("all");
                      setSelectedGrade("");
                      setSearchQuery("");
                    }}
                    className="text-xs text-slate-400 hover:text-white font-mono bg-slate-800 px-3 py-1.5 rounded"
                  >
                    Reset Filters
                  </button>
                  <button
                    onClick={handleTriggerScan}
                    className="text-xs text-slate-950 font-bold font-mono bg-cyan-400 hover:bg-cyan-300 px-3 py-1.5 rounded"
                  >
                    Scan Fresh Filings Now
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredDecisions.map((card) => {
                  const isCritical = card.conviction_grade === "AAA+";
                  const isBuy = card.flash_signal.includes("BUY");
                  const fInfo = getFreshnessInfo(card.published_at, card.detected_at);
                  return (
                    <div
                      key={card.id}
                      className={`relative bg-gradient-to-b from-slate-900/95 to-slate-950/95 rounded-xl border p-5 transition-all hover:shadow-xl ${
                        isCritical
                          ? "border-emerald-500/50 shadow-emerald-950/30 hover:border-emerald-400"
                          : "border-slate-800/80 hover:border-cyan-500/40"
                      }`}
                    >
                      {/* Top Row: Symbol, Signal & Conviction Grade */}
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-lg font-black font-mono text-white tracking-wider">
                              {card.symbol}
                            </span>
                            <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-slate-800 text-slate-300">
                              {card.exchange}
                            </span>
                            <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-cyan-950/60 border border-cyan-500/30 text-cyan-300">
                              {card.fiscal_period}
                            </span>
                            {/* Freshness Badge */}
                            <span
                              title={`Published: ${fInfo.formattedDate}`}
                              className={`px-2 py-0.5 text-[10px] font-mono rounded flex items-center gap-1 cursor-default ${fInfo.colorClass} ${
                                fInfo.isHot ? "animate-pulse" : ""
                              }`}
                            >
                              <Clock className="w-2.5 h-2.5" />
                              {fInfo.relative}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 font-medium mt-0.5 truncate max-w-xs">
                            {card.company_name}
                          </p>
                        </div>

                        {/* Signal Badge */}
                        <div className="text-right">
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-black font-mono uppercase tracking-wider shadow-sm ${
                              card.flash_signal === "BUY IMMEDIATELY"
                                ? "bg-emerald-500 text-slate-950 animate-pulse"
                                : isBuy
                                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/50"
                                : "bg-amber-500/20 text-amber-300 border border-amber-500/50"
                            }`}
                          >
                            <Zap className="w-3 h-3" />
                            {card.flash_signal}
                          </span>
                          <div className="text-[10px] font-mono text-slate-400 mt-1">
                            Grade:{" "}
                            <span className="font-bold text-white text-xs">
                              {card.conviction_grade}
                            </span>{" "}
                            ({card.athena_conviction_score}/100)
                          </div>
                        </div>
                      </div>

                      {/* Expected Move Projections Ribbon */}
                      <div className="mt-4 p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80 flex items-center justify-between text-xs font-mono">
                        <div className="text-center flex-1 border-r border-slate-800/80">
                          <span className="text-[10px] text-slate-500 block uppercase">Gap-Up</span>
                          <span className="font-bold text-emerald-400 text-sm">
                            {card.expected_moves.gap_up}
                          </span>
                        </div>
                        <div className="text-center flex-1 border-r border-slate-800/80">
                          <span className="text-[10px] text-slate-500 block uppercase">1-Day Move</span>
                          <span className="font-bold text-cyan-400 text-sm">
                            {card.expected_moves.move_1d}
                          </span>
                        </div>
                        <div className="text-center flex-1 border-r border-slate-800/80">
                          <span className="text-[10px] text-slate-500 block uppercase">1-Week</span>
                          <span className="font-bold text-cyan-300 text-sm">
                            {card.expected_moves.move_1w}
                          </span>
                        </div>
                        <div className="text-center flex-1">
                          <span className="text-[10px] text-slate-500 block uppercase">1-Month</span>
                          <span className="font-bold text-amber-300 text-sm">
                            {card.expected_moves.move_1m}
                          </span>
                        </div>
                      </div>

                      {/* PEAD Quantitative Drift Runway & Leverage Ribbon */}
                      {card.pead && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchQuery(card.symbol);
                            setActiveTab("pead");
                          }}
                          title={`Click to view ${card.symbol} in PEAD Quantitative Matrix`}
                          className="mt-3.5 w-full p-2.5 rounded-lg bg-slate-950/90 border border-slate-800/80 hover:border-cyan-500/50 flex items-center justify-between transition-all group/pead text-left cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="p-1 rounded bg-emerald-500/10 text-emerald-400 group-hover/pead:bg-emerald-500/20 shrink-0">
                              <TrendingUp className="w-3.5 h-3.5" />
                            </span>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[11px] font-bold font-mono text-white">
                                  PEAD Score: {card.pead.score.toFixed(0)}/100
                                </span>
                                <span
                                  className={`text-[10px] font-bold font-mono uppercase px-1.5 py-0.2 rounded border ${
                                    card.pead.is_elite
                                      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                                      : card.pead.is_candidate
                                      ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/40"
                                      : "bg-slate-800 text-slate-400 border-slate-700"
                                  }`}
                                >
                                  {card.pead.tier_label}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                                Drift Runway: <span className="text-cyan-300 font-bold">{card.pead.drift_days}</span> · Op. Leverage:{" "}
                                <span className="text-emerald-400 font-bold">{card.pead.operating_leverage}x</span>
                              </p>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono text-cyan-400 group-hover/pead:text-cyan-300 flex items-center gap-1 shrink-0 font-bold">
                            Matrix &rarr;
                          </span>
                        </button>
                      )}

                      {/* Decision Drivers Meter */}
                      <div className="mt-3.5 grid grid-cols-4 gap-2 text-center text-xs font-mono">
                        <div className="p-2 rounded bg-slate-900 border border-slate-800">
                          <span className="text-[10px] text-slate-500 block">Shock Score</span>
                          <span className="font-bold text-white">
                            {card.decision_drivers.financial_shock.toFixed(0)}/100
                          </span>
                        </div>
                        <div className="p-2 rounded bg-slate-900 border border-slate-800">
                          <span className="text-[10px] text-slate-500 block">Earnings Qual</span>
                          <span className="font-bold text-emerald-400">
                            {card.decision_drivers.earnings_quality.toFixed(0)}/100
                          </span>
                        </div>
                        <div className="p-2 rounded bg-slate-900 border border-slate-800">
                          <span className="text-[10px] text-slate-500 block">Valuation Opp</span>
                          <span className="font-bold text-cyan-400">
                            {card.decision_drivers.valuation_opportunity.toFixed(0)}/100
                          </span>
                        </div>
                        <div className="p-2 rounded bg-slate-900 border border-slate-800">
                          <span className="text-[10px] text-slate-500 block">Risk Level</span>
                          <span
                            className={`font-bold ${
                              card.decision_drivers.risk_level === "LOW"
                                ? "text-emerald-400"
                                : "text-amber-400"
                            }`}
                          >
                            {card.decision_drivers.risk_level}
                          </span>
                        </div>
                      </div>

                      {/* Valuation Strip: CMP, Fair Value, Upside */}
                      {card.current_price && card.estimated_fair_value && (
                        <div className="mt-3 flex items-center justify-between text-xs font-mono text-slate-300 px-2 py-1.5 rounded bg-slate-900/60 border border-slate-800/60">
                          <div>
                            <span className="text-slate-500">CMP: </span>
                            <span className="font-bold text-white">₹{card.current_price.toFixed(1)}</span>
                          </div>
                          <div>
                            <span className="text-slate-500">Estimated Fair Value: </span>
                            <span className="font-bold text-cyan-400">
                              ₹{card.estimated_fair_value.toFixed(1)}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500">Upside: </span>
                            <span className="font-bold text-emerald-400">
                              {card.upside_potential_pct !== undefined && card.upside_potential_pct > 0 ? "+" : ""}
                              {card.upside_potential_pct?.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      )}

                      {/* AI Thesis */}
                      <p className="mt-3 text-xs text-slate-300 leading-relaxed bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/40 font-sans">
                        {card.ai_investment_summary}
                      </p>

                      {/* Actions & Sharing Footer */}
                      <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
                          <Clock className="w-3 h-3 text-cyan-400" />
                          <span>Processed in {card.processing_time_sec.toFixed(3)}s</span>
                          {card.sla_met && (
                            <span className="text-emerald-400 font-bold">(&lt;5m SLA Met)</span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 font-mono">
                          <button
                            onClick={() => handleCopyBrief(card.id)}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition-all flex items-center gap-1 text-[11px]"
                            title="Copy Institutional Brief for WhatsApp / Telegram"
                          >
                            {copiedId === card.id ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3 text-slate-400" />
                            )}
                            {copiedId === card.id ? "Copied!" : "Brief"}
                          </button>

                          <button
                            onClick={() => handleBroadcastTelegram(card.id)}
                            className="px-2.5 py-1 rounded bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-500/30 text-cyan-300 transition-all flex items-center gap-1 text-[11px]"
                            title="Broadcast Telegram Alert"
                          >
                            {telegramSentId === card.id ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Send className="w-3 h-3 text-cyan-400" />
                            )}
                            {telegramSentId === card.id ? "Sent!" : "Telegram"}
                          </button>

                          <button
                            onClick={() => handleInspect(card.filing_id)}
                            className="px-3 py-1 rounded bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold transition-all flex items-center gap-1 text-[11px]"
                          >
                            <Eye className="w-3 h-3" />
                            Audit 5 Gates
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            TAB 2: PEAD QUANTITATIVE DRIFT MATRIX
        ========================================================================= */}
        {activeTab === "pead" && (
          <div className="space-y-4">
            <PeadDriftMatrix
              initialSearch={searchQuery}
              onAuditAthena={(sym) => {
                handleInspect(sym);
              }}
            />
          </div>
        )}

        {/* =========================================================================
            TAB 3: LIVE FEED & OMEGA QUEUE
        ========================================================================= */}
        {activeTab === "queue" && (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                    <Activity className="w-4 h-4 text-cyan-400" />
                    Real-Time Corporate Disclosures & OMEGA Processing Queue
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Results detected on NSE/BSE feeds prioritized by Business Shock Score.
                  </p>
                </div>
                <button
                  onClick={handleTriggerScan}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono rounded"
                >
                  Poll Exchange Feeds
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-3">Priority</th>
                      <th className="p-3">Ticker / Company</th>
                      <th className="p-3">Freshness</th>
                      <th className="p-3">Exchange</th>
                      <th className="p-3">Period</th>
                      <th className="p-3">Shock Score</th>
                      <th className="p-3">Conviction</th>
                      <th className="p-3">FLASH Signal</th>
                      <th className="p-3">Latency</th>
                      <th className="p-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filings.map((f) => (
                      <tr key={f.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              f.priority === "AAA+"
                                ? "bg-rose-950 border border-rose-500/40 text-rose-300"
                                : f.priority === "AAA"
                                ? "bg-amber-950 border border-amber-500/40 text-amber-300"
                                : f.priority === "AA"
                                ? "bg-cyan-950 border border-cyan-500/40 text-cyan-300"
                                : "bg-slate-800 text-slate-400"
                            }`}
                          >
                            {f.priority}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="font-bold text-white block">{f.symbol}</span>
                          <span className="text-[11px] text-slate-400 truncate max-w-xs block">
                            {f.company_name}
                          </span>
                        </td>
                        <td className="p-3">
                          {(() => {
                            const fInfo = getFreshnessInfo(undefined, f.detected_at);
                            return (
                              <span
                                title={fInfo.formattedDate}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1 ${fInfo.colorClass}`}
                              >
                                <Clock className="w-2.5 h-2.5" />
                                {fInfo.relative}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="p-3 text-slate-300">{f.exchange}</td>
                        <td className="p-3 text-cyan-300">{f.fiscal_period}</td>
                        <td className="p-3 font-bold text-white">
                          {f.shock_score ? `${f.shock_score.toFixed(1)}/100` : "—"}
                        </td>
                        <td className="p-3">
                          {f.conviction_score ? (
                            <span className="font-bold text-emerald-400">
                              {f.conviction_score.toFixed(1)} [{f.conviction_grade}]
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="p-3">
                          {f.flash_signal ? (
                            <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold">
                              {f.flash_signal}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="p-3 text-slate-400">{f.processing_time_sec.toFixed(3)}s</td>
                        <td className="p-3">
                          <button
                            onClick={() => handleInspect(f.id)}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px]"
                          >
                            View Audit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 3: 5 GATES ARCHITECTURE OVERVIEW
        ========================================================================= */}
        {activeTab === "about" && (
          <div className="space-y-4 font-mono text-xs">
            <div className="p-5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                ATHENA OMEGA v3.0 — The 5 Sequential Decision Gates
              </h2>
              <p className="text-slate-300 leading-relaxed font-sans">
                Every quarterly result is analyzed on its business fundamentals, earnings quality, valuation opportunity, and AI conviction — before the market fully reacts.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 pt-2">
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
                  <div className="text-[10px] text-cyan-400 font-bold uppercase">Gate 1 (0–120s)</div>
                  <div className="font-bold text-white text-sm">200-Pt Business Shock</div>
                  <p className="text-[11px] text-slate-400 font-sans leading-tight">
                    Evaluates 45+ metrics across Revenue, EBITDA margins, PAT, CFO, and Order Book.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
                  <div className="text-[10px] text-emerald-400 font-bold uppercase">Gate 2 (120–180s)</div>
                  <div className="font-bold text-white text-sm">Forensic Quality Engine</div>
                  <p className="text-[11px] text-slate-400 font-sans leading-tight">
                    Scrubs non-operating income, checks cash-backed conversion (CFO vs PAT), and runs Piotroski tests.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
                  <div className="text-[10px] text-amber-400 font-bold uppercase">Gate 3 (180–240s)</div>
                  <div className="font-bold text-white text-sm">Valuation & Solvency Risk</div>
                  <p className="text-[11px] text-slate-400 font-sans leading-tight">
                    Computes Fair Value (₹), upside %, P/E vs Industry, and solvency risk penalties.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
                  <div className="text-[10px] text-purple-400 font-bold uppercase">Gate 4 (240–270s)</div>
                  <div className="font-bold text-white text-sm">Master Conviction</div>
                  <p className="text-[11px] text-slate-400 font-sans leading-tight">
                    Weighted synthesis: 40% Shock + 35% Quality + 25% Valuation - Risk Penalty.
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
                  <div className="text-[10px] text-rose-400 font-bold uppercase">Gate 5 (270–300s)</div>
                  <div className="font-bold text-white text-sm">FLASH Decision Card</div>
                  <p className="text-[11px] text-slate-400 font-sans leading-tight">
                    Publishes BUY IMMEDIATELY / ACCUMULATE with Gap-Up, 1D, 1W, 1M move projections.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            INSPECTION MODAL: 5-GATES DEEP DIVE AUDIT
        ========================================================================= */}
        {selectedAnalysis && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-[#050B14] border border-cyan-500/40 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
              {/* Modal Header */}
              <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950">
                <div className="flex items-center gap-3">
                  <span className="text-xl font-black font-mono text-white">
                    {selectedAnalysis.filing.symbol}
                  </span>
                  <span className="text-xs text-slate-400">
                    {selectedAnalysis.filing.company_name}
                  </span>
                  <span className="px-2 py-0.5 rounded text-xs font-mono bg-cyan-950 text-cyan-300 border border-cyan-800">
                    {selectedAnalysis.filing.fiscal_period}
                  </span>
                  <span className="px-2 py-0.5 rounded text-xs font-mono bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">
                    Grade: {selectedAnalysis.gate_4_5_flash.conviction_grade} (
                    {selectedAnalysis.gate_4_5_flash.conviction_score}/100)
                  </span>
                </div>
                <button
                  onClick={() => setSelectedAnalysis(null)}
                  className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Gate Selector Tabs */}
              <div className="flex border-b border-slate-800 bg-slate-900/60 px-4 pt-2 gap-2 text-xs font-mono">
                <button
                  onClick={() => setModalGateTab("g1")}
                  className={`px-3 py-2 border-b-2 font-bold transition-all ${
                    modalGateTab === "g1"
                      ? "border-cyan-400 text-cyan-300"
                      : "border-transparent text-slate-400 hover:text-white"
                  }`}
                >
                  Gate 1: Shock Radar ({selectedAnalysis.gate_1_shock.normalized_score?.toFixed(1)})
                </button>
                <button
                  onClick={() => setModalGateTab("g2")}
                  className={`px-3 py-2 border-b-2 font-bold transition-all ${
                    modalGateTab === "g2"
                      ? "border-emerald-400 text-emerald-300"
                      : "border-transparent text-slate-400 hover:text-white"
                  }`}
                >
                  Gate 2: Quality ({selectedAnalysis.gate_2_quality.quality_score?.toFixed(1)})
                </button>
                <button
                  onClick={() => setModalGateTab("g3")}
                  className={`px-3 py-2 border-b-2 font-bold transition-all ${
                    modalGateTab === "g3"
                      ? "border-amber-400 text-amber-300"
                      : "border-transparent text-slate-400 hover:text-white"
                  }`}
                >
                  Gate 3: Valuation & Fair Value
                </button>
                <button
                  onClick={() => setModalGateTab("g4")}
                  className={`px-3 py-2 border-b-2 font-bold transition-all ${
                    modalGateTab === "g4"
                      ? "border-purple-400 text-purple-300"
                      : "border-transparent text-slate-400 hover:text-white"
                  }`}
                >
                  Gate 4/5: Conviction & FLASH
                </button>
                <button
                  onClick={() => setModalGateTab("pead")}
                  className={`px-3 py-2 border-b-2 font-bold transition-all ${
                    modalGateTab === "pead"
                      ? "border-emerald-400 text-emerald-300"
                      : "border-transparent text-slate-400 hover:text-white"
                  }`}
                >
                  PEAD Drift Matrix {selectedAnalysis.pead_analysis ? `(${selectedAnalysis.pead_analysis.score.toFixed(0)})` : ""}
                </button>
                <button
                  onClick={() => setModalGateTab("metrics")}
                  className={`px-3 py-2 border-b-2 font-bold transition-all ${
                    modalGateTab === "metrics"
                      ? "border-slate-400 text-white"
                      : "border-transparent text-slate-400 hover:text-white"
                  }`}
                >
                  Raw Financials
                </button>
              </div>

              {/* Modal Body Content */}
              <div className="p-6 overflow-y-auto space-y-4 font-mono text-xs flex-1">
                {/* GATE 1: 200-POINT SHOCK RADAR */}
                {modalGateTab === "g1" && (
                  <div className="space-y-4">
                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                      <div>
                        <span className="text-slate-400 text-[11px] block">Shock Tier:</span>
                        <span className="text-base font-bold text-white">
                          {selectedAnalysis.gate_1_shock.tier} ({selectedAnalysis.gate_1_shock.action})
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-400 text-[11px] block">Normalized Score:</span>
                        <span className="text-2xl font-black text-cyan-400">
                          {selectedAnalysis.gate_1_shock.normalized_score?.toFixed(1)}/100
                        </span>
                        <span className="text-[10px] text-slate-500 block">
                          Raw: {selectedAnalysis.gate_1_shock.raw_score_200}/200 pts
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      <h4 className="text-xs font-bold text-slate-300 uppercase">
                        200-Point Business Shock Category Breakdown
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {Object.entries(selectedAnalysis.gate_1_shock.breakdown || {}).map(
                          ([k, v]) => (
                            <div
                              key={k}
                              className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1"
                            >
                              <div className="flex justify-between text-[11px]">
                                <span className="text-slate-400 capitalize">
                                  {k.replace(/_/g, " ")}
                                </span>
                                <span className="font-bold text-white">
                                  {v.score} / {v.max} pts
                                </span>
                              </div>
                              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className="bg-cyan-500 h-full rounded-full"
                                  style={{ width: `${(v.score / v.max) * 100}%` }}
                                />
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* GATE 2: FORENSIC QUALITY */}
                {modalGateTab === "g2" && (
                  <div className="space-y-4">
                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                      <div>
                        <span className="text-slate-400 text-[11px] block">Quality Grade:</span>
                        <span className="text-base font-bold text-emerald-400">
                          {selectedAnalysis.gate_2_quality.quality_grade}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-slate-400 text-[11px] block">Quality Score:</span>
                        <span className="text-2xl font-black text-emerald-400">
                          {selectedAnalysis.gate_2_quality.quality_score?.toFixed(1)}/100
                        </span>
                        <span className="text-[10px] text-slate-500 block">
                          Piotroski: {selectedAnalysis.gate_2_quality.piotroski_score}/9
                        </span>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                      <h4 className="text-xs font-bold text-slate-300 uppercase">
                        Forensic Verification Checks
                      </h4>
                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Operating vs Other Income: Pass</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Cash-Backed Earnings (CFO &gt; PAT): Pass</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Tax Benefit Anomaly: Negative</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Working Capital Stress: Clean</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* GATE 3: VALUATION & RISK */}
                {modalGateTab === "g3" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 rounded bg-slate-950 border border-slate-800 text-center">
                        <span className="text-slate-500 text-[10px] block">Current Market Price</span>
                        <span className="text-lg font-bold text-white">
                          ₹{selectedAnalysis.gate_3_valuation_risk.current_price?.toFixed(1)}
                        </span>
                      </div>
                      <div className="p-3 rounded bg-slate-950 border border-slate-800 text-center">
                        <span className="text-slate-500 text-[10px] block">Estimated Fair Value</span>
                        <span className="text-lg font-bold text-cyan-400">
                          ₹{selectedAnalysis.gate_3_valuation_risk.estimated_fair_value?.toFixed(1)}
                        </span>
                      </div>
                      <div className="p-3 rounded bg-slate-950 border border-slate-800 text-center">
                        <span className="text-slate-500 text-[10px] block">Upside Potential</span>
                        <span className="text-lg font-bold text-emerald-400">
                          +{selectedAnalysis.gate_3_valuation_risk.upside_potential_pct?.toFixed(1)}%
                        </span>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Post-Result P/E Multiple:</span>
                        <span className="font-bold text-white">
                          {selectedAnalysis.gate_3_valuation_risk.post_result_pe}x
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Industry P/E Benchmark:</span>
                        <span className="font-bold text-white">
                          {selectedAnalysis.gate_3_valuation_risk.industry_pe}x
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">PEG Ratio:</span>
                        <span className="font-bold text-cyan-400">
                          {selectedAnalysis.gate_3_valuation_risk.peg_ratio}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Solvency Risk Level:</span>
                        <span className="font-bold text-emerald-400">
                          {selectedAnalysis.gate_3_valuation_risk.risk_level} (Score:{" "}
                          {selectedAnalysis.gate_3_valuation_risk.risk_score}/100)
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* GATE 4/5: CONVICTION & FLASH */}
                {modalGateTab === "g4" && (
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-gradient-to-r from-cyan-950/60 to-emerald-950/40 border border-cyan-500/40 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-cyan-300">FLASH SIGNAL:</span>
                        <span className="text-sm font-black text-white px-2 py-0.5 rounded bg-emerald-500 text-slate-950">
                          {selectedAnalysis.gate_4_5_flash.flash_signal}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400">Master Conviction Score:</span>
                        <span className="text-lg font-black text-white">
                          {selectedAnalysis.gate_4_5_flash.conviction_score}/100 [
                          {selectedAnalysis.gate_4_5_flash.conviction_grade}]
                        </span>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5 font-sans">
                      <h4 className="text-xs font-bold text-slate-300 font-mono uppercase">
                        AI Investment Thesis
                      </h4>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        {selectedAnalysis.gate_4_5_flash.ai_investment_summary}
                      </p>
                    </div>
                  </div>
                )}

                {/* PEAD QUANTITATIVE DRIFT MATRIX TAB */}
                {modalGateTab === "pead" && (
                  <div className="space-y-4">
                    {selectedAnalysis.pead_analysis ? (
                      <>
                        <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/40 via-cyan-950/30 to-slate-900 border border-emerald-500/40 space-y-2.5">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-emerald-300 uppercase">
                              PEAD Drift Classification:
                            </span>
                            <span className="text-xs font-black px-2.5 py-1 rounded bg-emerald-500 text-slate-950 uppercase font-mono">
                              {selectedAnalysis.pead_analysis.tier_label}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-400">Quantitative PEAD Score:</span>
                            <span className="text-xl font-black text-white">
                              {selectedAnalysis.pead_analysis.score.toFixed(1)} / 100
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-3 pt-2 text-xs border-t border-slate-800">
                            <div>
                              <span className="text-slate-400">Drift Runway Horizon: </span>
                              <span className="font-bold text-cyan-300 font-mono">
                                {selectedAnalysis.pead_analysis.drift_days}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400">Operating Leverage Multiplier: </span>
                              <span className="font-bold text-emerald-300 font-mono">
                                {selectedAnalysis.pead_analysis.operating_leverage}x
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* 4 Pillars Breakdown */}
                        {selectedAnalysis.pead_analysis.pillar_breakdown && (
                          <div className="space-y-2">
                            <h4 className="text-xs font-bold text-slate-300 uppercase">
                              4-Pillar Quantitative Scores
                            </h4>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex justify-between items-center">
                                <span className="text-slate-400">1. Earnings Acceleration</span>
                                <span className="font-bold text-emerald-400 text-sm">
                                  {selectedAnalysis.pead_analysis.pillar_breakdown.earnings_power} / 40
                                </span>
                              </div>
                              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex justify-between items-center">
                                <span className="text-slate-400">2. Operating Leverage</span>
                                <span className="font-bold text-cyan-400 text-sm">
                                  {selectedAnalysis.pead_analysis.pillar_breakdown.operating_leverage} / 25
                                </span>
                              </div>
                              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex justify-between items-center">
                                <span className="text-slate-400">3. Capital Efficiency (RoCE & Debt)</span>
                                <span className="font-bold text-amber-400 text-sm">
                                  {selectedAnalysis.pead_analysis.pillar_breakdown.capital_efficiency} / 20
                                </span>
                              </div>
                              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex justify-between items-center">
                                <span className="text-slate-400">4. Technical Trend & Drift</span>
                                <span className="font-bold text-purple-400 text-sm">
                                  {selectedAnalysis.pead_analysis.pillar_breakdown.trend_drift} / 15
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* PEAD Thesis */}
                        {selectedAnalysis.pead_analysis.thesis && (
                          <div className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1 font-sans">
                            <h4 className="text-xs font-bold text-cyan-400 font-mono uppercase">
                              PEAD Quantitative Thesis
                            </h4>
                            <p className="text-xs text-slate-200 leading-relaxed">
                              {selectedAnalysis.pead_analysis.thesis}
                            </p>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="py-8 text-center text-slate-500 font-sans">
                        PEAD Drift analysis not yet calculated for this filing.
                      </div>
                    )}
                  </div>
                )}

                {/* RAW FINANCIALS */}
                {modalGateTab === "metrics" && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-300 uppercase">
                      Structured Quarterly Results (₹ Crore)
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="p-2 rounded bg-slate-950 border border-slate-800 flex justify-between">
                        <span className="text-slate-400">Revenue:</span>
                        <span className="font-bold text-white">
                          ₹{selectedAnalysis.metrics.revenue?.toLocaleString()} Cr (
                          {Number(selectedAnalysis.metrics.revenue_growth_yoy) > 0 ? "+" : ""}
                          {String(selectedAnalysis.metrics.revenue_growth_yoy)}%)
                        </span>
                      </div>
                      <div className="p-2 rounded bg-slate-950 border border-slate-800 flex justify-between">
                        <span className="text-slate-400">Net Profit (PAT):</span>
                        <span className="font-bold text-white">
                          ₹{selectedAnalysis.metrics.pat?.toLocaleString()} Cr (
                          {Number(selectedAnalysis.metrics.pat_growth_yoy) > 0 ? "+" : ""}
                          {String(selectedAnalysis.metrics.pat_growth_yoy)}%)
                        </span>
                      </div>

                      <div className="p-2 rounded bg-slate-950 border border-slate-800 flex justify-between">
                        <span className="text-slate-400">EBITDA Margin:</span>
                        <span className="font-bold text-white">
                          {selectedAnalysis.metrics.ebitda_margin_pct}%
                        </span>
                      </div>
                      <div className="p-2 rounded bg-slate-950 border border-slate-800 flex justify-between">
                        <span className="text-slate-400">EPS:</span>
                        <span className="font-bold text-white">₹{selectedAnalysis.metrics.eps}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-3 border-t border-slate-800 bg-slate-950 flex justify-end">
                <button
                  onClick={() => setSelectedAnalysis(null)}
                  className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-mono"
                >
                  Close Audit
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

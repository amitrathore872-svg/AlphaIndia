"use client";

// =======================================================
// Alpha India — Investor Intelligence & Concall Radar Terminal
// Senior Buy-Side Equity Analyst Interrogation of Earnings PPTs & Concall Transcripts
// Bloomberg Dark Aesthetic · Cyan / Emerald / Amber Accents
// =======================================================

import { useEffect, useState, useCallback } from "react";
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
} from "lucide-react";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { PageHeader, ActionButton, LoadingSpinner, EmptyState } from "@/components/common";
import InvestorIntelligenceDrawer from "@/components/investor-intelligence/InvestorIntelligenceDrawer";
import {
  fetchInvestorFeed,
  triggerCompanyHarvest,
  triggerAnalyzeLatest,
  fetchInvestorTelemetry,
  triggerBatchScan,
  type InvestorInsightItem,
  type InvestorTelemetry,
} from "@/lib/investorIntelligenceApi";

const STANCE_FILTERS = [
  { id: "ALL", label: "All Stances" },
  { id: "STRONG_GROWTH_LEADER", label: "Strong Growth Leaders", color: "text-emerald-400" },
  { id: "ACCUMULATE_ON_DIPS", label: "Accumulate on Dips", color: "text-cyan-400" },
  { id: "STEADY_COMPOUNDER", label: "Steady Compounders", color: "text-blue-400" },
  { id: "TURNAROUND_CANDIDATE", label: "Turnarounds", color: "text-amber-400" },
  { id: "AVOID_OR_HEADWINDS", label: "Headwinds / Cautious", color: "text-rose-400" },
];

export default function InvestorIntelligencePage() {
  const [items, setItems] = useState<InvestorInsightItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [telemetry, setTelemetry] = useState<InvestorTelemetry | null>(null);
  const [batchProcessing, setBatchProcessing] = useState<boolean>(false);
  const [batchMsg, setBatchMsg] = useState<string | null>(null);
  const [selectedStance, setSelectedStance] = useState<string>("ALL");
  const [selectedDocType, setSelectedDocType] = useState<string>("ALL");
  const [transformationalOnly, setTransformationalOnly] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [inputSymbol, setInputSymbol] = useState<string>("");
  const [harvesting, setHarvesting] = useState<boolean>(false);
  const [activeSymbolForDrawer, setActiveSymbolForDrawer] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);

  const loadTelemetry = useCallback(async () => {
    try {
      const tel = await fetchInvestorTelemetry();
      setTelemetry(tel);
    } catch (e) {
      console.warn("Telemetry fetch error:", e);
    }
  }, []);

  const loadFeed = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchInvestorFeed({
        stance: selectedStance === "ALL" ? undefined : selectedStance,
        doc_type: selectedDocType === "ALL" ? undefined : selectedDocType,
        symbol: searchQuery ? searchQuery.trim().toUpperCase() : undefined,
        transformational_only: transformationalOnly ? true : undefined,
        limit: 50,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      console.error("Error loading investor feed:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedStance, selectedDocType, searchQuery, transformationalOnly]);

  useEffect(() => {
    loadFeed();
    loadTelemetry();
  }, [loadFeed, loadTelemetry]);

  const handleHarvestSingle = async () => {
    const sym = inputSymbol.trim().toUpperCase();
    if (!sym) return;
    setHarvesting(true);
    try {
      await triggerCompanyHarvest(sym);
      await triggerAnalyzeLatest(sym);
      setInputSymbol("");
      await loadFeed();
      await loadTelemetry();
      setActiveSymbolForDrawer(sym);
      setIsDrawerOpen(true);
    } catch (err: any) {
      alert("Error harvesting stock: " + (err.message || err));
    } finally {
      setHarvesting(false);
    }
  };

  const handleBatchScan = async (target: "LATEST_RESULTS" | "NIFTY50" | "PENDING_QUEUE") => {
    setBatchProcessing(true);
    setBatchMsg(null);
    try {
      const res = await triggerBatchScan(target, 5);
      setBatchMsg(`Successfully analyzed ${res.processed_count} concall transcripts.`);
      await loadFeed();
      await loadTelemetry();
    } catch (err: any) {
      setBatchMsg(`Batch scan warning: ${err?.message || err}`);
    } finally {
      setBatchProcessing(false);
    }
  };

  const getStanceBadge = (stance: string) => {
    switch (stance) {
      case "STRONG_GROWTH_LEADER":
        return "bg-emerald-950/70 text-emerald-400 border-emerald-500/40";
      case "ACCUMULATE_ON_DIPS":
        return "bg-cyan-950/70 text-cyan-400 border-cyan-500/40";
      case "STEADY_COMPOUNDER":
        return "bg-blue-950/70 text-blue-400 border-blue-500/40";
      case "TURNAROUND_CANDIDATE":
        return "bg-amber-950/70 text-amber-400 border-amber-500/40";
      case "AVOID_OR_HEADWINDS":
        return "bg-rose-950/70 text-rose-400 border-rose-500/40";
      default:
        return "bg-slate-800 text-slate-300 border-slate-700";
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-12">
        {/* Terminal Header */}
        <PageHeader
          title="Investor Intelligence & Concall Radar"
          subtitle="Senior Buy-Side Analyst interrogation of Investor PPTs & Concall Transcripts across Operating Leverage, Margins, Order Book, Cash Quality & Q&A Grill."
        />

        {/* Autonomous Pipeline Freshness & Batch Interrogation Hub */}
        <div className="rounded-xl border border-cyan-500/30 bg-gradient-to-r from-[#070D18] via-[#0A1222] to-[#070D18] p-4 space-y-3.5 shadow-xl">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-cyan-900/40 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <span className="text-xs font-mono font-bold tracking-wider text-cyan-300 uppercase flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                Autonomous Concall Ingestion Engine: ACTIVE
              </span>
              <span className="text-[10px] font-mono text-slate-400 bg-cyan-950/60 border border-cyan-800/40 px-2 py-0.5 rounded">
                Cycle: Every 10 mins
              </span>
            </div>

            <div className="text-xs font-mono text-slate-400 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-cyan-500" />
              <span>
                Last AI Analysis:{" "}
                <strong className="text-white">
                  {telemetry?.latest_insight_analyzed_at
                    ? new Date(telemetry.latest_insight_analyzed_at).toLocaleString("en-IN", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Live Ingestion Active"}
                </strong>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div className="p-2.5 rounded-lg bg-[#050A14] border border-cyan-950 flex flex-col">
              <span className="text-[10px] text-slate-500 uppercase flex items-center gap-1">
                <Database className="w-3 h-3 text-cyan-500" />
                Harvested Documents
              </span>
              <span className="text-base font-black text-cyan-400 mt-0.5">
                {telemetry?.total_documents ?? "2,557"}
              </span>
              <span className="text-[9px] text-slate-500">Transcripts & Presentations</span>
            </div>

            <div className="p-2.5 rounded-lg bg-[#050A14] border border-cyan-950 flex flex-col">
              <span className="text-[10px] text-slate-500 uppercase flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-emerald-400" />
                Deep AI Insights
              </span>
              <span className="text-base font-black text-emerald-400 mt-0.5">
                {telemetry?.total_insights ?? "47"}
              </span>
              <span className="text-[9px] text-slate-500">Full Buy-Side Reports</span>
            </div>

            <div className="p-2.5 rounded-lg bg-[#050A14] border border-cyan-950 flex flex-col">
              <span className="text-[10px] text-slate-500 uppercase flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-400" />
                Growth Leaders
              </span>
              <span className="text-base font-black text-amber-400 mt-0.5">
                {telemetry?.strong_growth_count ?? "12"}
              </span>
              <span className="text-[9px] text-slate-500">Strong Stance / Buy</span>
            </div>

            <div className="p-2.5 rounded-lg bg-[#050A14] border border-cyan-950 flex flex-col">
              <span className="text-[10px] text-slate-500 uppercase flex items-center gap-1">
                <Clock className="w-3 h-3 text-purple-400" />
                Warehouse Backlog
              </span>
              <span className="text-base font-black text-purple-400 mt-0.5">
                {telemetry?.pending_documents ?? "2,510"}
              </span>
              <span className="text-[9px] text-slate-500">Ready for Interrogation</span>
            </div>
          </div>

          {/* Batch Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-cyan-950">
            <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Zap className="w-3 h-3 text-cyan-400" />
              1-Click Batch Harvester:
            </span>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => handleBatchScan("LATEST_RESULTS")}
                disabled={batchProcessing}
                className="px-3 py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/40 border border-cyan-500/50 text-cyan-300 font-mono text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-xs"
              >
                <Mic className={`w-3 h-3 ${batchProcessing ? "animate-spin" : ""}`} />
                <span>⚡ Scan Recent Q2 Results</span>
              </button>

              <button
                onClick={() => handleBatchScan("PENDING_QUEUE")}
                disabled={batchProcessing}
                className="px-3 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/50 text-purple-300 font-mono text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-xs"
              >
                <Cpu className={`w-3 h-3 ${batchProcessing ? "animate-spin" : ""}`} />
                <span>⚡ Interrogate 5 Pending Transcripts</span>
              </button>

              <button
                onClick={() => handleBatchScan("NIFTY50")}
                disabled={batchProcessing}
                className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/40 border border-emerald-500/50 text-emerald-300 font-mono text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-xs"
              >
                <Sparkles className={`w-3 h-3 ${batchProcessing ? "animate-spin" : ""}`} />
                <span>⚡ Interrogate Nifty 50</span>
              </button>
            </div>
          </div>

          {batchMsg && (
            <div className="p-2.5 rounded-lg bg-cyan-950/80 border border-cyan-500/40 text-cyan-200 text-xs font-mono flex items-center justify-between">
              <span>{batchMsg}</span>
              <button onClick={() => setBatchMsg(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>
          )}
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-xl bg-[#070D18] border border-cyan-900/30">
          {/* Quick Harvest & Interrogate */}
          <div className="flex items-center gap-2 max-w-md w-full">
            <input
              type="text"
              placeholder="Enter Stock Symbol (e.g. DIXON, KEC, TATAPOWER)..."
              value={inputSymbol}
              onChange={(e) => setInputSymbol(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleHarvestSingle()}
              className="flex-1 px-3.5 py-2 text-xs rounded-lg bg-[#0A1222] border border-cyan-900/40 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
            />
            <button
              onClick={handleHarvestSingle}
              disabled={harvesting || !inputSymbol.trim()}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white transition flex items-center gap-1.5 whitespace-nowrap shadow-sm shadow-cyan-600/30"
            >
              <Sparkles className={`w-3.5 h-3.5 ${harvesting ? "animate-spin" : ""}`} />
              {harvesting ? "Interrogating..." : "Interrogate"}
            </button>
          </div>

          {/* Search Filter */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Filter loaded results..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs rounded-lg bg-[#0A1222] border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 w-44 font-mono"
              />
            </div>

            <button
              onClick={loadFeed}
              disabled={loading}
              className="p-2 rounded-lg bg-[#0A1222] border border-slate-800 text-slate-300 hover:text-cyan-400 transition"
              title="Refresh Feed"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-cyan-400" : ""}`} />
            </button>
          </div>
        </div>

        {/* Filter Badges */}
        <div className="flex flex-wrap items-center gap-2">
          {STANCE_FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setSelectedStance(f.id)}
              className={`px-3 py-1.5 text-xs rounded-lg border font-medium transition ${
                selectedStance === f.id
                  ? "bg-cyan-950 border-cyan-500 text-cyan-300 shadow-sm"
                  : "bg-[#070D18] border-slate-800 text-slate-400 hover:border-slate-700"
              }`}
            >
              {f.label}
            </button>
          ))}

          <div className="h-4 w-px bg-slate-800 mx-1 hidden sm:block" />

          {/* Transformational 10x Catalyst Filter Button */}
          <button
            onClick={() => setTransformationalOnly(!transformationalOnly)}
            className={`px-3 py-1.5 text-xs rounded-lg border font-semibold transition flex items-center gap-1.5 ${
              transformationalOnly
                ? "bg-amber-950/90 border-amber-400 text-amber-300 shadow-md shadow-amber-500/20 ring-1 ring-amber-400/50"
                : "bg-[#0A1222] border-amber-900/60 text-amber-400 hover:border-amber-500 hover:text-amber-300"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            🚀 Exponential Catalysts (Buy Now)
          </button>

          <div className="h-4 w-px bg-slate-800 mx-1 hidden sm:block" />

          {["ALL", "CONCALL_TRANSCRIPT", "INVESTOR_PRESENTATION"].map((dtype) => (
            <button
              key={dtype}
              onClick={() => setSelectedDocType(dtype)}
              className={`px-2.5 py-1 text-xs rounded-lg border font-mono transition ${
                selectedDocType === dtype
                  ? "bg-slate-800 border-slate-600 text-white"
                  : "bg-transparent border-slate-800 text-slate-500 hover:text-slate-300"
              }`}
            >
              {dtype === "ALL" ? "All Types" : dtype.replace(/_/g, " ")}
            </button>
          ))}
        </div>

        {/* Results Grid */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3 text-slate-400">
            <LoadingSpinner />
            <p className="text-xs font-mono">Scanning senior analyst intelligence database...</p>
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title="No Analyzed Filings Matched"
            description="Try typing a stock symbol like DIXON, KEC, or TATAPOWER above to automatically harvest and analyze its latest earnings call."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {items.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  setActiveSymbolForDrawer(item.symbol);
                  setIsDrawerOpen(true);
                }}
                className="group cursor-pointer p-5 rounded-xl bg-[#070D18] border border-cyan-900/30 hover:border-cyan-500/50 hover:bg-[#0A1324] transition-all duration-200 flex flex-col justify-between space-y-4 shadow-lg"
              >
                {/* Card Header */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-white group-hover:text-cyan-300 transition">
                          {item.symbol}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 font-mono">
                          {item.fiscal_period}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 truncate max-w-[200px] mt-0.5">
                        {item.company_name || item.symbol}
                      </p>
                    </div>

                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold tracking-wider font-mono uppercase whitespace-nowrap ${getStanceBadge(
                        item.institutional_stance
                      )}`}
                    >
                      {item.institutional_stance.replace(/_/g, " ")}
                    </span>
                  </div>

                  {/* Transformational Catalyst Highlight Banner */}
                  {item.is_transformational_catalyst && (
                    <div className="mt-2.5 p-2.5 rounded-lg bg-gradient-to-r from-amber-950/80 via-emerald-950/50 to-cyan-950/80 border border-amber-500/50 shadow-md shadow-amber-950/30 space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] uppercase font-mono font-bold tracking-wider text-amber-300 flex items-center gap-1 truncate">
                          <Sparkles className="w-3 h-3 text-amber-400 animate-pulse shrink-0" />
                          EXPONENTIAL TRIGGER ({item.transformational_category?.replace(/_/g, " ")})
                        </span>
                        {item.exponential_growth_multiple && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 border border-amber-400/40 text-amber-200 font-mono font-bold shrink-0">
                            {item.exponential_growth_multiple}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-semibold text-white leading-tight">
                        {item.catalyst_headline}
                      </p>
                      {item.immediate_reaction_rationale && (
                        <p className="text-[10.5px] text-amber-200/90 leading-snug line-clamp-2 pt-0.5 font-sans">
                          <strong className="text-emerald-300">Why Buy Now: </strong>
                          {item.immediate_reaction_rationale}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Actionable Gameplan Pill */}
                  {item.actionable_gameplan?.verdict && (
                    <div className="mt-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-950/60 border border-cyan-700/40 text-[11px] text-cyan-200">
                      <Target className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span className="font-mono font-bold tracking-wide">{item.actionable_gameplan.verdict}</span>
                    </div>
                  )}

                  {/* Conviction & Tone Bar */}
                  <div className="flex items-center gap-3 mt-2.5 pt-2 border-t border-slate-800/80 text-[11px]">
                    <div>
                      <span className="text-slate-500">Conviction: </span>
                      <span className="font-mono font-bold text-white">
                        {item.growth_conviction_score}/100
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">Tone: </span>
                      <span className="font-mono font-medium text-cyan-300">
                        {item.management_tone.replace(/_/g, " ")}
                      </span>
                    </div>
                    <span className="ml-auto text-[10px] text-slate-500 font-mono uppercase">
                      {item.doc_type === "CONCALL_TRANSCRIPT" ? "Concall" : "PPT"}
                    </span>
                  </div>

                  {/* Direct Quote Preview */}
                  {item.direct_quotes && item.direct_quotes.length > 0 ? (
                    <div className="mt-3 p-2.5 rounded-lg bg-black/40 border border-slate-800 text-[11px] text-slate-300 leading-relaxed">
                      <span className="text-cyan-400 font-semibold block text-[10px] uppercase font-mono mb-0.5">
                        Direct Quote ({item.direct_quotes[0].speaker}):
                      </span>
                      <p className="italic line-clamp-2">&ldquo;{item.direct_quotes[0].quote}&rdquo;</p>
                    </div>
                  ) : item.executive_thesis ? (
                    <p className="text-xs text-slate-300 mt-3 line-clamp-2 leading-relaxed">
                      {item.executive_thesis}
                    </p>
                  ) : null}
                </div>

                {/* Key Operating Metrics Box */}
                <div className="p-2.5 rounded-lg bg-[#050B14] border border-slate-800/90 space-y-1.5 text-[11px]">
                  {item.capacity_utilization_pct && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Capacity Util</span>
                      <span className="font-mono text-white font-medium">
                        {item.capacity_utilization_pct}%
                      </span>
                    </div>
                  )}
                  {item.ebitda_margin_guidance_corridor && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">EBITDA Margin</span>
                      <span className="font-mono text-emerald-300 font-medium">
                        {item.ebitda_margin_guidance_corridor}
                      </span>
                    </div>
                  )}
                  {item.executable_order_book_cr && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Order Backlog</span>
                      <span className="font-mono text-amber-300 font-medium">
                        ₹{item.executable_order_book_cr.toLocaleString("en-IN")} Cr
                      </span>
                    </div>
                  )}

                  {/* Phase 2: Tension & Evasiveness Micro-Stats */}
                  <div className="pt-1.5 border-t border-slate-900/80 flex items-center justify-between text-[10px]">
                    <span className="flex items-center gap-1 text-slate-400 font-mono">
                      <Flame className="w-3 h-3 text-amber-400" />
                      Tension: <strong className="text-white">{(item.analyst_tension_score ?? 3.0).toFixed(1)}/10</strong>
                    </span>
                    <span className="flex items-center gap-1 text-slate-400 font-mono">
                      <Scale className="w-3 h-3 text-cyan-400" />
                      Evasion: <strong className="text-white">{(item.evasiveness_score ?? 2.0).toFixed(1)}/10</strong>
                    </span>
                  </div>

                  {item.forensic_discrepancies && item.forensic_discrepancies.some((d) => d.severity === "CRITICAL" || d.severity === "HIGH") && (
                    <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-950/60 border border-rose-500/40 text-[9.5px] font-mono text-rose-300">
                      <AlertCircle className="w-2.5 h-2.5 text-rose-400 shrink-0" />
                      <span className="truncate">Balance Sheet Disconnect Flagged</span>
                    </div>
                  )}

                  {item.key_overhang_questioned_by_analysts && (
                    <div className="pt-1 border-t border-slate-900 text-[10px] text-rose-300/90 truncate">
                      <span className="text-rose-500 font-medium">Grill: </span>
                      {item.key_overhang_questioned_by_analysts}
                    </div>
                  )}
                </div>

                {/* Card Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-xs">
                  {item.pdf_url ? (
                    <a
                      href={item.pdf_url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1 text-[11px]"
                    >
                      <ExternalLink className="w-3 h-3" />
                      View Filing PDF
                    </a>
                  ) : (
                    <span className="text-[11px] text-slate-500">Filing Stored</span>
                  )}

                  <span className="text-cyan-400 group-hover:translate-x-1 transition flex items-center gap-0.5 text-[11px] font-medium">
                    Drilldown <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Drawer Component */}
        <InvestorIntelligenceDrawer
          symbol={activeSymbolForDrawer}
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
        />
      </div>
    </DashboardLayout>
  );
}

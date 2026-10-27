"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Sparkles,
  Zap,
  TrendingUp,
  ShieldCheck,
  ShieldAlert,
  Target,
  Layers,
  ArrowUpRight,
  ExternalLink,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  RefreshCw,
  Cpu,
  Flame,
  Scale,
  Award,
  ChevronRight,
  SlidersHorizontal,
} from "lucide-react";
import {
  fetchRunawayTriggers,
  type RunawayTriggerItem,
  type RunawayTriggersResponse,
} from "@/lib/investorIntelligenceApi";

interface Props {
  onSelectSymbol: (symbol: string) => void;
}

const ARCHETYPES = [
  { id: "ALL", label: "All Catalysts" },
  { id: "ORDER_BOOK_EXPLOSION", label: "Order Book Explosion (Book/Bill > 2.5x)" },
  { id: "CAPACITY_INFLECTION_COD", label: "Capacity 2x/3x & COD Commercialization" },
  { id: "MARGIN_CORRIDOR_JUMP", label: "Margin Corridor Jump (+200-500 bps)" },
  { id: "SUNRISE_MONOPOLY_PLI", label: "Sunrise Monopoly / PLI Moat" },
  { id: "DELEVERAGING_DEBT_FREE", label: "Debt-Free / Rapid Deleveraging" },
  { id: "ACCELERATING_EARNINGS_BEAT", label: "Earnings Beat & Acceleration" },
];

const CONVICTION_TIERS = [
  { id: "ALL", label: "All Conviction Tiers" },
  { id: "DIAMOND_SOLID", label: "💎 Diamond Solid (85-100 Score, 3-Way Verified)" },
  { id: "COILED_SPRING", label: "🌀 Coiled Spring (Stage 1 Base Consolidation)" },
  { id: "SPECULATIVE_CATALYST", label: "⚡ Early Trigger (Watchlist Setup)" },
  { id: "NARRATIVE_TRAP", label: "⚠️ Narrative Trap (Stage 4 / Weak Accounting)" },
];

export default function DiamondCatalystRadar({ onSelectSymbol }: Props) {
  const [data, setData] = useState<RunawayTriggersResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>("");
  const [selectedArchetype, setSelectedArchetype] = useState<string>("ALL");
  const [selectedTier, setSelectedTier] = useState<string>("DIAMOND_SOLID");
  const [stage2Only, setStage2Only] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchRunawayTriggers({
        archetype: selectedArchetype,
        conviction_tier: selectedTier,
        stage_2_only: stage2Only,
        search: search.trim() || undefined,
        page,
        limit: 30,
      });
      setData(res);
    } catch (err) {
      console.error("Error loading runaway triggers:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedArchetype, selectedTier, stage2Only, search, page]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case "DIAMOND_SOLID":
        return {
          bg: "bg-emerald-950/90 text-emerald-300 border-emerald-500/80 shadow-xs shadow-emerald-500/20",
          icon: <Award className="w-3.5 h-3.5 text-emerald-400" />,
          label: "Diamond Solid (Runaway Buy)",
        };
      case "COILED_SPRING":
        return {
          bg: "bg-cyan-950/90 text-cyan-300 border-cyan-500/80",
          icon: <Zap className="w-3.5 h-3.5 text-cyan-400" />,
          label: "Coiled Spring (Base Breakout)",
        };
      case "SPECULATIVE_CATALYST":
        return {
          bg: "bg-amber-950/80 text-amber-300 border-amber-500/60",
          icon: <Clock className="w-3.5 h-3.5 text-amber-400" />,
          label: "Early Catalyst Watchlist",
        };
      default:
        return {
          bg: "bg-rose-950/90 text-rose-300 border-rose-500/80",
          icon: <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />,
          label: "Narrative Trap (Stage 4 / Red Flags)",
        };
    }
  };

  const getArchetypePill = (archetype: string) => {
    switch (archetype) {
      case "ORDER_BOOK_EXPLOSION":
        return "bg-purple-950/80 text-purple-300 border-purple-500/60";
      case "CAPACITY_INFLECTION_COD":
        return "bg-amber-950/80 text-amber-300 border-amber-500/60";
      case "MARGIN_CORRIDOR_JUMP":
        return "bg-cyan-950/80 text-cyan-300 border-cyan-500/60";
      case "SUNRISE_MONOPOLY_PLI":
        return "bg-blue-950/80 text-blue-300 border-blue-500/60";
      case "DELEVERAGING_DEBT_FREE":
        return "bg-emerald-950/80 text-emerald-300 border-emerald-500/60";
      default:
        return "bg-slate-900 text-slate-300 border-slate-700";
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* =======================================================
          1. INSTITUTIONAL RADAR KPI RIBBON
         ======================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3 rounded-xl bg-gradient-to-br from-[#0A1628] to-[#07101E] border border-cyan-900/50 shadow-inner space-y-1">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase text-slate-400">
            <span>Universe Screened</span>
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-xl font-bold font-mono text-white">
            {data?.kpis.total_screened || 0}
          </div>
          <p className="text-[10px] text-slate-500">Transcripts & Presentations</p>
        </div>

        <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-950/40 via-[#0A1628] to-[#07101E] border border-emerald-500/40 shadow-inner space-y-1">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase text-emerald-400 font-bold">
            <span>💎 Diamond Solid</span>
            <Award className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-300">
            {data?.kpis.diamond_solid_count || 0}
          </div>
          <p className="text-[10px] text-emerald-400/70">3-Way Validated Winners</p>
        </div>

        <div className="p-3 rounded-xl bg-gradient-to-br from-[#0A1628] to-[#07101E] border border-cyan-800/40 shadow-inner space-y-1">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase text-cyan-300">
            <span>🌀 Coiled Springs</span>
            <Zap className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-xl font-bold font-mono text-cyan-200">
            {data?.kpis.coiled_spring_count || 0}
          </div>
          <p className="text-[10px] text-slate-500">Stage 1 Base Setups</p>
        </div>

        <div className="p-3 rounded-xl bg-gradient-to-br from-[#0A1628] to-[#07101E] border border-purple-800/40 shadow-inner space-y-1">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase text-purple-300">
            <span>Order Book 3x</span>
            <Layers className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-xl font-bold font-mono text-purple-200">
            {data?.kpis.order_book_explosions || 0}
          </div>
          <p className="text-[10px] text-slate-500">Multi-Year Backlog Moat</p>
        </div>

        <div className="p-3 rounded-xl bg-gradient-to-br from-[#0A1628] to-[#07101E] border border-amber-800/40 shadow-inner space-y-1">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase text-amber-300">
            <span>COD / Capex 2x</span>
            <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-xl font-bold font-mono text-amber-200">
            {data?.kpis.capacity_inflections || 0}
          </div>
          <p className="text-[10px] text-slate-500">Commercialization Online</p>
        </div>

        <div className="p-3 rounded-xl bg-gradient-to-br from-[#0A1628] to-[#07101E] border border-blue-800/40 shadow-inner space-y-1">
          <div className="flex items-center justify-between text-[10px] font-mono uppercase text-blue-300">
            <span>Sunrise / PLI</span>
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="text-xl font-bold font-mono text-blue-200">
            {data?.kpis.sunrise_monopolies || 0}
          </div>
          <p className="text-[10px] text-slate-500">Sovereign Strategic Moat</p>
        </div>
      </div>

      {/* =======================================================
          2. FILTER & SEARCH CONTROL CONSOLE
         ======================================================= */}
      <div className="p-4 rounded-xl bg-[#080E1A] border border-cyan-950 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search symbol, company name, or catalyst..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full bg-[#050B14] border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-hidden focus:border-cyan-500 font-mono"
            />
          </div>

          {/* Filter Dropdowns */}
          <div className="flex items-center gap-2 flex-wrap text-xs font-mono">
            {/* Conviction Tier */}
            <select
              aria-label="Filter by Conviction Tier"
              value={selectedTier}
              onChange={(e) => {
                setSelectedTier(e.target.value);
                setPage(1);
              }}
              className="bg-[#050B14] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-cyan-300 focus:outline-hidden focus:border-cyan-500 cursor-pointer"
            >
              {CONVICTION_TIERS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>

            {/* Archetype Filter */}
            <select
              aria-label="Filter by Catalyst Archetype"
              value={selectedArchetype}
              onChange={(e) => {
                setSelectedArchetype(e.target.value);
                setPage(1);
              }}
              className="bg-[#050B14] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-hidden focus:border-cyan-500 cursor-pointer"
            >
              {ARCHETYPES.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>

            {/* Stage 2 Toggle */}
            <button
              type="button"
              onClick={() => {
                setStage2Only(!stage2Only);
                setPage(1);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs transition cursor-pointer ${
                stage2Only
                  ? "bg-emerald-950/90 border-emerald-500/60 text-emerald-300 font-bold"
                  : "bg-[#050B14] border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
              title="Filter stocks in confirmed Stan Weinstein Stage 2 Uptrend (CMP > 50 DMA > 200 DMA)"
            >
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <span>{stage2Only ? "Stage 2 Uptrend ONLY" : "All Technical Stages"}</span>
            </button>

            <button
              onClick={() => loadData()}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-300 hover:text-cyan-400 transition cursor-pointer"
              title="Refresh Radar"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-cyan-400" : ""}`} />
            </button>
          </div>
        </div>

        {/* Informative Guidance Banner */}
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 border-t border-slate-900 pt-2">
          <span className="flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              <strong>Diamond Solid Framework:</strong> Requires simultaneous confirmation of{" "}
              <strong className="text-cyan-300">1. Forward Guidance Spark</strong> +{" "}
              <strong className="text-emerald-300">2. Clean Accounting Fuel</strong> +{" "}
              <strong className="text-amber-300">3. Weinstein Stage 2 Price Harmony</strong>.
            </span>
          </span>
          <span>Showing {data?.items.length || 0} of {data?.total || 0} candidates</span>
        </div>
      </div>

      {/* =======================================================
          3. HIGH-VELOCITY DIAMOND CARDS
         ======================================================= */}
      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin text-cyan-400" />
          <span className="text-xs font-mono text-slate-400">Interrogating filings & computing 3-way quantitative validations...</span>
        </div>
      ) : !data || data.items.length === 0 ? (
        <div className="py-16 text-center rounded-2xl bg-[#08101E] border border-cyan-950 p-6 space-y-3">
          <ShieldAlert className="w-10 h-10 text-amber-400 mx-auto" />
          <h3 className="text-base font-bold text-white font-mono">No Candidates Passed the Selected Filter</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Try switching the conviction tier to &ldquo;All Conviction Tiers&rdquo; or unchecking the &ldquo;Stage 2 Uptrend ONLY&rdquo; filter to view early-stage base setups.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {data.items.map((item) => {
            const tierBadge = getTierBadge(item.conviction_tier);
            const archetypeClass = getArchetypePill(item.archetype);

            return (
              <div
                key={`catalyst-${item.symbol}`}
                className="p-5 rounded-2xl bg-[#070D18] border border-cyan-950/80 hover:border-cyan-700/60 transition-all duration-200 shadow-xl space-y-4 hover:shadow-cyan-950/40"
              >
                {/* Header Row: Symbol, Score, Archetype, Date */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-cyan-950/60 pb-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      onClick={() => onSelectSymbol(item.symbol)}
                      className="text-lg font-black font-mono text-white hover:text-cyan-300 transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>{item.symbol}</span>
                      <ArrowUpRight className="w-4 h-4 text-cyan-400 opacity-70" />
                    </button>
                    <span className="text-xs text-slate-300 font-medium">
                      {item.company_name}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                      {item.fiscal_period}
                    </span>
                    {item.announcement_date && (
                      <span className="text-[10px] font-mono text-slate-500">
                        {new Date(item.announcement_date).toLocaleDateString("en-IN", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Archetype Pill */}
                    <span className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-lg border uppercase tracking-wider ${archetypeClass}`}>
                      {item.archetype.replace(/_/g, " ")}
                    </span>

                    {/* Diamond Score Badge */}
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#0A1628] border border-cyan-500/50 shadow-inner">
                      <span className="text-[10px] font-mono uppercase text-slate-400 font-semibold">Diamond Score:</span>
                      <span className="text-sm font-black font-mono text-emerald-300">
                        {item.diamond_score}/100
                      </span>
                    </div>

                    {/* Conviction Tier Badge */}
                    <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded-xl border flex items-center gap-1.5 ${tierBadge.bg}`}>
                      {tierBadge.icon}
                      <span>{tierBadge.label}</span>
                    </span>
                  </div>
                </div>

                {/* Catalyst Headline & Highlight */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-950/80 border border-amber-500/50 text-amber-300">
                      ⚡ Trigger: {item.metric_highlight}
                    </span>
                    <h3 className="text-sm font-bold text-white tracking-tight">
                      {item.headline}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed font-sans">
                    {item.institutional_rationale}
                  </p>
                  {item.verbatim_quote && (
                    <div className="p-2.5 rounded-lg bg-[#050B14] border border-cyan-900/30 text-xs italic text-cyan-200/90 font-sans">
                      &ldquo;{item.verbatim_quote}&rdquo;
                    </div>
                  )}
                </div>

                {/* 3-Way Quantitative Validation Matrix */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                  {/* Pillar A: Forward Guidance Spark */}
                  <div className="p-3 rounded-xl bg-[#050B14] border border-cyan-950 space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-cyan-400 font-bold flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                        1. Guidance Spark
                      </span>
                      <span className="text-[11px] font-bold text-white">
                        {item.scores.guidance_score}/35 pts
                      </span>
                    </div>
                    <div className="space-y-1 text-[11px]">
                      {item.guidance_validation.checks.map((c, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-slate-300">
                          {c.passed ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                          )}
                          <span className="leading-snug">{c.detail}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Pillar B: Accounting & Balance Sheet Fuel */}
                  <div className="p-3 rounded-xl bg-[#050B14] border border-cyan-950 space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                        2. Accounting Fuel
                      </span>
                      <span className="text-[11px] font-bold text-white">
                        {item.scores.financial_score}/35 pts
                      </span>
                    </div>
                    <div className="space-y-1 text-[11px]">
                      {item.financial_validation.checks.map((c, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-slate-300">
                          {c.passed ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                          )}
                          <span className="leading-snug">{c.detail}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Pillar C: Institutional Stage 2 Price Harmony */}
                  <div className="p-3 rounded-xl bg-[#050B14] border border-cyan-950 space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-amber-400 font-bold flex items-center gap-1.5">
                        <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                        3. Stage 2 Harmony
                      </span>
                      <span className="text-[11px] font-bold text-white">
                        {item.scores.technical_score}/30 pts
                      </span>
                    </div>
                    <div className="space-y-1 text-[11px]">
                      {item.technical_validation.checks.map((c, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-slate-300">
                          {c.passed ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                          )}
                          <span className="leading-snug">{c.detail}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Institutional Trade Gameplan & Actions */}
                <div className="p-3.5 rounded-xl bg-gradient-to-r from-[#0C1B33] to-[#0A1628] border border-cyan-500/30 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono uppercase font-bold tracking-wider text-cyan-400 flex items-center gap-1">
                        <Target className="w-3 h-3 text-cyan-400" /> Gameplan:
                      </span>
                      <span className="font-bold text-white font-mono text-[11px]">
                        {item.gameplan.verdict}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300">
                        {item.gameplan.horizon}
                      </span>
                    </div>
                    <p className="text-slate-300 text-[11px]">
                      <strong className="text-cyan-300">Entry:</strong> {item.gameplan.entry_trigger} ·{" "}
                      <strong className="text-rose-300">Invalidation:</strong> {item.gameplan.invalidation_level}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.pdf_url && (
                      <a
                        href={item.pdf_url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition flex items-center gap-1.5 font-mono text-xs cursor-pointer"
                        title="View Official Filing PDF"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Filing PDF</span>
                      </a>
                    )}

                    <button
                      onClick={() => onSelectSymbol(item.symbol)}
                      className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-mono font-bold transition flex items-center gap-1.5 shadow-lg shadow-cyan-900/50 cursor-pointer"
                    >
                      <span>Inspect Deep Terminal</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

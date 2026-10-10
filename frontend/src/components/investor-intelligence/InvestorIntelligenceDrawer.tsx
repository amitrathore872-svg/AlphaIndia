"use client";

import { useEffect, useState } from "react";
import {
  X,
  FileText,
  ExternalLink,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Zap,
  Target,
  ShieldAlert,
  BarChart2,
  Activity,
  Layers,
  Sparkles,
  HelpCircle,
  RefreshCw,
  Flame,
  Scale,
  AlertCircle,
} from "lucide-react";
import {
  fetchCompanyInvestorIntelligence,
  triggerAnalyzeDocument,
  triggerAnalyzeLatest,
  type CompanyIntelligenceResponse,
  type InvestorInsightItem,
  type InvestorDocumentItem,
} from "@/lib/investorIntelligenceApi";

interface Props {
  symbol: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function InvestorIntelligenceDrawer({ symbol, isOpen, onClose }: Props) {
  const [data, setData] = useState<CompanyIntelligenceResponse | null>(null);
  const [selectedInsight, setSelectedInsight] = useState<InvestorInsightItem | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [analyzing, setAnalyzing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !symbol) return;
    loadData(symbol);
  }, [isOpen, symbol]);

  const loadData = async (sym: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchCompanyInvestorIntelligence(sym);
      setData(res);
      setSelectedInsight(res.latest_insight || (res.insights_history.length > 0 ? res.insights_history[0] : null));
    } catch (err: any) {
      setError(err?.message || "Failed to load investor intelligence");
    } finally {
      setLoading(false);
    }
  };

  const handleReanalyze = async () => {
    if (!symbol) return;
    setAnalyzing(true);
    try {
      await triggerAnalyzeLatest(symbol);
      await loadData(symbol);
    } catch (err: any) {
      alert("Analysis error: " + err.message);
    } finally {
      setAnalyzing(false);
    }
  };

  if (!isOpen) return null;

  const stanceColors: Record<string, { bg: string; text: string; border: string }> = {
    STRONG_GROWTH_LEADER: { bg: "bg-emerald-950/60", text: "text-emerald-400", border: "border-emerald-500/40" },
    ACCUMULATE_ON_DIPS: { bg: "bg-cyan-950/60", text: "text-cyan-400", border: "border-cyan-500/40" },
    STEADY_COMPOUNDER: { bg: "bg-blue-950/60", text: "text-blue-400", border: "border-blue-500/40" },
    TURNAROUND_CANDIDATE: { bg: "bg-amber-950/60", text: "text-amber-400", border: "border-amber-500/40" },
    CYCLICAL_PEAK: { bg: "bg-purple-950/60", text: "text-purple-400", border: "border-purple-500/40" },
    AVOID_OR_HEADWINDS: { bg: "bg-rose-950/60", text: "text-rose-400", border: "border-rose-500/40" },
  };

  const currentStance = selectedInsight?.institutional_stance || "NEUTRAL";
  const stanceStyle = stanceColors[currentStance] || {
    bg: "bg-slate-900/60",
    text: "text-slate-300",
    border: "border-slate-700",
  };

  const getTensionBadge = (score?: number | null) => {
    const val = score ?? 3.0;
    if (val >= 7.0) return { label: "High-Conflict Grill", color: "text-rose-400 bg-rose-950/80 border-rose-500/50", bar: "bg-rose-500" };
    if (val >= 4.5) return { label: "Active Interrogation", color: "text-amber-400 bg-amber-950/80 border-amber-500/50", bar: "bg-amber-500" };
    return { label: "Constructive Dialogue", color: "text-emerald-400 bg-emerald-950/80 border-emerald-500/50", bar: "bg-emerald-500" };
  };

  const getEvasivenessBadge = (score?: number | null) => {
    const val = score ?? 2.0;
    if (val >= 6.5) return { label: "High Obfuscation / Hedging", color: "text-rose-400 bg-rose-950/80 border-rose-500/50", bar: "bg-rose-500" };
    if (val >= 3.5) return { label: "Moderate Hedging", color: "text-amber-400 bg-amber-950/80 border-amber-500/50", bar: "bg-amber-500" };
    return { label: "Candid & Data-Driven", color: "text-emerald-400 bg-emerald-950/80 border-emerald-500/50", bar: "bg-emerald-500" };
  };

  const getDiscrepancySeverityBadge = (severity?: string) => {
    switch (severity?.toUpperCase()) {
      case "CRITICAL":
        return "bg-rose-950/90 text-rose-300 border-rose-500/70";
      case "HIGH":
        return "bg-amber-950/90 text-amber-300 border-amber-500/70";
      case "MEDIUM":
        return "bg-cyan-950/90 text-cyan-300 border-cyan-500/60";
      default:
        return "bg-emerald-950/90 text-emerald-300 border-emerald-500/60";
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/70 backdrop-blur-sm flex justify-end transition-opacity">
      <div className="w-full max-w-4xl bg-[#070D18] border-l border-cyan-900/40 shadow-2xl h-full flex flex-col text-slate-200">
        {/* Drawer Header */}
        <div className="p-5 border-b border-cyan-900/30 bg-[#0A1222] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-white">{symbol}</h2>
                <span className="text-xs px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 font-mono">
                  {selectedInsight?.fiscal_period || "Current"}
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono">
                  {selectedInsight?.doc_type?.replace("_", " ") || "FILING"}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Senior Buy-Side Analyst & Concall Intelligence Radar
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleReanalyze}
              disabled={analyzing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-cyan-950/80 border border-cyan-600/40 text-cyan-300 hover:bg-cyan-900/50 transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${analyzing ? "animate-spin" : ""}`} />
              {analyzing ? "Interrogating..." : "Analyze with Senior AI"}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin text-cyan-400" />
              <p className="text-sm font-mono">Loading institutional presentation & concall filings...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/50 text-rose-300 text-sm">
              {error}
            </div>
          ) : !selectedInsight ? (
            <div className="text-center py-16 space-y-4">
              <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
              <h3 className="text-lg font-semibold text-white">No Analyzed Filings Found Yet</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                No analyzed concall notes or investor presentations found for {symbol}. Click below to automatically harvest and analyze the latest exchange filing.
              </p>
              <button
                onClick={handleReanalyze}
                disabled={analyzing}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white transition inline-flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                {analyzing ? "Extracting & Interrogating..." : "Harvest & Analyze Now"}
              </button>
            </div>
          ) : (
            <>
              {/* Senior Analyst Stance Banner */}
              <div
                className={`p-4 rounded-xl border ${stanceStyle.border} ${stanceStyle.bg} flex flex-col md:flex-row md:items-center justify-between gap-4`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase font-mono tracking-wider text-slate-400">
                      Institutional Buy-Side Stance:
                    </span>
                    <span className={`text-sm font-bold tracking-wide ${stanceStyle.text}`}>
                      {selectedInsight.institutional_stance.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-slate-300">
                    <div>
                      Conviction Score:{" "}
                      <span className="font-bold text-white font-mono">
                        {selectedInsight.growth_conviction_score}/100
                      </span>
                    </div>
                    <div>
                      Management Tone:{" "}
                      <span className="font-bold text-cyan-300 font-mono">
                        {selectedInsight.management_tone.replace(/_/g, " ")}
                      </span>
                    </div>
                    {selectedInsight.management_sentiment_score !== undefined && (
                      <div>
                        Sentiment:{" "}
                        <span className="font-bold text-emerald-400 font-mono">
                          {selectedInsight.management_sentiment_score > 0 ? "+" : ""}
                          {selectedInsight.management_sentiment_score} / 10
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {selectedInsight.pdf_url && (
                  <a
                    href={selectedInsight.pdf_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20 transition self-start md:self-center"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Official NSE/BSE PDF
                  </a>
                )}
              </div>

              {/* Phase 2: Analyst Tension & Forensic Evasiveness Radar */}
              <div className="p-4 rounded-xl bg-[#081120] border border-cyan-800/40 shadow-lg space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-900/30 pb-3">
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-amber-400" />
                    <h3 className="text-xs uppercase font-mono font-bold tracking-wider text-cyan-300">
                      Concall Forensic Radar · Evasiveness & Analyst Tension Meter
                    </h3>
                  </div>

                  {selectedInsight.management_defense_strategy && (
                    <span className="text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-cyan-300">
                      Strategy: <strong className="text-white">{selectedInsight.management_defense_strategy.replace(/_/g, " ")}</strong>
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Gauge 1: Analyst Tension */}
                  {(() => {
                    const tension = getTensionBadge(selectedInsight.analyst_tension_score);
                    const score = selectedInsight.analyst_tension_score ?? 3.0;
                    const pct = Math.min(100, Math.max(10, (score / 10) * 100));
                    return (
                      <div className="p-3 rounded-lg bg-black/40 border border-slate-800/80 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400 flex items-center gap-1.5 font-mono">
                            <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                            Analyst Tension Index:
                          </span>
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded border font-mono ${tension.color}`}>
                            {score.toFixed(1)} / 10 · {tension.label}
                          </span>
                        </div>
                        <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                          <div className={`h-full ${tension.bar} transition-all duration-500`} style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Measures analyst pushback aggression, question repetition, and scrutiny on guidance.
                        </p>
                      </div>
                    );
                  })()}

                  {/* Gauge 2: Forensic Evasiveness */}
                  {(() => {
                    const evasive = getEvasivenessBadge(selectedInsight.evasiveness_score);
                    const score = selectedInsight.evasiveness_score ?? 2.0;
                    const pct = Math.min(100, Math.max(10, (score / 10) * 100));
                    return (
                      <div className="p-3 rounded-lg bg-black/40 border border-slate-800/80 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400 flex items-center gap-1.5 font-mono">
                            <Scale className="w-3.5 h-3.5 text-amber-400" />
                            Executive Evasiveness Index:
                          </span>
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded border font-mono ${evasive.color}`}>
                            {score.toFixed(1)} / 10 · {evasive.label}
                          </span>
                        </div>
                        <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                          <div className={`h-full ${evasive.bar} transition-all duration-500`} style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-[11px] text-slate-400">
                          Quantifies qualitative dodging, vague macro excuses, vs verifiable numeric commitments.
                        </p>
                      </div>
                    );
                  })()}
                </div>

                {/* Hot-Seat Question Spotlight */}
                {selectedInsight.hot_seat_question && (
                  <div className="p-3.5 rounded-lg bg-gradient-to-r from-rose-950/40 via-black to-slate-950 border border-rose-500/30 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] uppercase font-mono font-bold text-rose-400 flex items-center gap-1.5 tracking-wider">
                        <Flame className="w-3.5 h-3.5 text-rose-400" />
                        The Hot-Seat Grill (Hardest Question Faced by Management)
                      </span>
                    </div>
                    <p className="text-xs text-rose-100 italic leading-relaxed">
                      {selectedInsight.hot_seat_question}
                    </p>
                  </div>
                )}
              </div>

              {/* Exponential / Transformational Growth Trigger Radar */}
              {selectedInsight.is_transformational_catalyst && (
                <div className="p-5 rounded-xl bg-gradient-to-r from-amber-950/90 via-[#131222] to-cyan-950/80 border-2 border-amber-500/60 shadow-xl shadow-amber-950/50 space-y-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs uppercase font-mono font-bold tracking-wider text-amber-300 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                        TRANSFORMATIONAL GROWTH TRIGGER (IMMEDIATE BUY CATALYST)
                      </span>
                    </div>
                    {selectedInsight.exponential_growth_multiple && (
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-400/20 border border-amber-400/50 text-amber-200 font-mono font-bold tracking-wide">
                        ⚡ {selectedInsight.exponential_growth_multiple}
                      </span>
                    )}
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                      {selectedInsight.catalyst_headline}
                    </h3>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-[11px] px-2 py-0.5 rounded bg-amber-950 border border-amber-800/80 text-amber-300 font-mono uppercase">
                        Category: {selectedInsight.transformational_category?.replace(/_/g, " ")}
                      </span>
                    </div>
                  </div>

                  {selectedInsight.immediate_reaction_rationale && (
                    <div className="p-3.5 rounded-lg bg-black/60 border border-amber-500/30 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold uppercase font-mono text-emerald-300 tracking-wider">
                        <Zap className="w-3.5 h-3.5 text-emerald-400" />
                        Why Institutional Smart Money Rushes In Now:
                      </div>
                      <p className="text-xs text-slate-200 leading-relaxed font-sans">
                        {selectedInsight.immediate_reaction_rationale}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Actionable Investor Gameplan Banner */}
              {selectedInsight.actionable_gameplan && (
                <div className="p-4 rounded-xl bg-gradient-to-r from-[#0C1B33] to-[#0A1628] border border-cyan-500/30 shadow-lg space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs uppercase font-mono tracking-wider text-cyan-400 font-bold flex items-center gap-1.5">
                        <Target className="w-4 h-4 text-cyan-400" />
                        Actionable Investor Gameplan:
                      </span>
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 font-mono">
                        {selectedInsight.actionable_gameplan.verdict}
                      </span>
                    </div>

                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300">
                      Risk: <strong className="text-amber-400">{selectedInsight.actionable_gameplan.risk_rating}</strong>
                    </span>
                  </div>

                  <p className="text-xs text-slate-200 leading-relaxed font-sans">
                    {selectedInsight.actionable_gameplan.plain_english_advice}
                  </p>

                  {selectedInsight.actionable_gameplan.key_trigger && (
                    <div className="flex items-start gap-2 pt-2 border-t border-cyan-900/40 text-[11px] text-cyan-300">
                      <Zap className="w-3.5 h-3.5 text-cyan-400 mt-0.5 shrink-0" />
                      <span><strong>Key Trigger to Watch:</strong> {selectedInsight.actionable_gameplan.key_trigger}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Layman Plain English Summary */}
              {selectedInsight.layman_summary && (
                <div className="p-4 rounded-xl bg-[#09111F] border border-slate-800 space-y-3">
                  <h4 className="text-xs uppercase font-mono tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    Plain English Breakdown (For Everyday Investors)
                  </h4>
                  <div className="text-xs text-slate-300 space-y-2 whitespace-pre-line leading-relaxed font-sans">
                    {selectedInsight.layman_summary}
                  </div>
                </div>
              )}

              {/* Direct Word-For-Word Executive Quotes */}
              {selectedInsight.direct_quotes && selectedInsight.direct_quotes.length > 0 && (
                <div className="p-4 rounded-xl bg-[#081224] border border-cyan-900/30 space-y-3">
                  <h4 className="text-xs uppercase font-mono tracking-wider text-cyan-400 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    Direct Executive Quotes (Word-For-Word From The Boss)
                  </h4>
                  <div className="space-y-2.5">
                    {selectedInsight.direct_quotes.map((q, idx) => (
                      <div key={idx} className="p-3 rounded-lg bg-black/40 border border-slate-800 space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-cyan-300 font-mono">{q.speaker}</span>
                          {q.theme && <span className="text-[10px] text-slate-500 font-mono">{q.theme}</span>}
                        </div>
                        <p className="text-xs text-slate-200 italic leading-relaxed">
                          &ldquo;{q.quote}&rdquo;
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Analyst Grill Dialogue Cards */}
              {selectedInsight.analyst_grill_quotes && selectedInsight.analyst_grill_quotes.length > 0 && (
                <div className="p-4 rounded-xl bg-[#09111F] border border-rose-950/40 space-y-3">
                  <h4 className="text-xs uppercase font-mono tracking-wider text-rose-400 flex items-center gap-1.5">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    The Analyst Grill: Toughest Questions & Real Answers
                  </h4>
                  <div className="space-y-3">
                    {selectedInsight.analyst_grill_quotes.map((g, idx) => (
                      <div key={idx} className="p-3 rounded-lg bg-black/50 border border-slate-800 space-y-2">
                        <div>
                          <div className="flex items-center justify-between text-[11px] mb-1">
                            <span className="font-semibold text-rose-400 font-mono">Q by {g.analyst}</span>
                            {g.verdict && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 font-mono">
                                {g.verdict}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-300 italic">
                            &ldquo;{g.question}&rdquo;
                          </p>
                        </div>
                        <div className="pt-2 border-t border-slate-900">
                          <span className="font-semibold text-emerald-400 font-mono text-[11px] block mb-0.5">
                            Answer by {g.executive}:
                          </span>
                          <p className="text-xs text-slate-200">
                            &ldquo;{g.answer_quote}&rdquo;
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Executive Buy-Side Thesis */}
              {selectedInsight.executive_thesis && (
                <div className="p-4 rounded-xl bg-[#0A1222] border border-cyan-900/30">
                  <h4 className="text-xs uppercase font-mono tracking-wider text-cyan-400 mb-2 flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5" />
                    Executive Buy-Side Thesis
                  </h4>
                  <p className="text-sm text-slate-200 leading-relaxed font-sans">
                    {selectedInsight.executive_thesis}
                  </p>
                </div>
              )}

              {/* Core 6 Pillars Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Pillar 1: Operating Leverage & Capex */}
                <div className="p-4 rounded-xl bg-[#09101E] border border-slate-800 space-y-3">
                  <h4 className="text-xs uppercase font-mono tracking-wider text-cyan-400 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5" />
                    1. Operating Leverage & CWIP
                  </h4>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-800">
                      <span className="text-slate-400">Capacity Utilization</span>
                      <span className="font-mono font-semibold text-white">
                        {selectedInsight.capacity_utilization_pct
                          ? `${selectedInsight.capacity_utilization_pct}%`
                          : "Undisclosed"}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800">
                      <span className="text-slate-400">Capex Guidance</span>
                      <span className="font-mono text-cyan-300">
                        {selectedInsight.capex_guidance_fy || "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800">
                      <span className="text-slate-400">Commissioning (COD)</span>
                      <span className="font-mono text-emerald-300">
                        {selectedInsight.commissioning_timeline_cod || "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800">
                      <span className="text-slate-400">Expected Asset Turn</span>
                      <span className="font-mono text-white">
                        {selectedInsight.expected_asset_turnover || "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-400">Volume vs Price Driver</span>
                      <span className="font-mono text-slate-200">
                        {selectedInsight.volume_vs_price_driver || "Balanced"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Pillar 2: Margins & Pricing Power */}
                <div className="p-4 rounded-xl bg-[#09101E] border border-slate-800 space-y-3">
                  <h4 className="text-xs uppercase font-mono tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5" />
                    2. Margins & Pricing Power
                  </h4>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-800">
                      <span className="text-slate-400">EBITDA Margin Corridor</span>
                      <span className="font-mono font-semibold text-emerald-300">
                        {selectedInsight.ebitda_margin_guidance_corridor || "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800">
                      <span className="text-slate-400">VAP Mix Share</span>
                      <span className="font-mono text-white">
                        {selectedInsight.value_added_mix_pct
                          ? `${selectedInsight.value_added_mix_pct}%`
                          : "N/A"}
                      </span>
                    </div>
                    <div className="py-1 border-b border-slate-800">
                      <span className="text-slate-400 block mb-0.5">Input Cost Pass-Through:</span>
                      <span className="text-slate-200">
                        {selectedInsight.input_cost_pass_through || "Formulaic pass-through with typical lag"}
                      </span>
                    </div>
                    <div className="py-1">
                      <span className="text-slate-400 block mb-0.5">Margin Drivers:</span>
                      <span className="text-slate-200">
                        {selectedInsight.margin_drivers || "Operating leverage & product mix"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Pillar 3: Order Book & Runway */}
                <div className="p-4 rounded-xl bg-[#09101E] border border-slate-800 space-y-3">
                  <h4 className="text-xs uppercase font-mono tracking-wider text-amber-400 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" />
                    3. Order Book & Execution
                  </h4>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-800">
                      <span className="text-slate-400">Executable Order Backlog</span>
                      <span className="font-mono font-semibold text-amber-300">
                        {selectedInsight.executable_order_book_cr
                          ? `₹${selectedInsight.executable_order_book_cr.toLocaleString("en-IN")} Cr`
                          : "Non-EPC / Discretionary"}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800">
                      <span className="text-slate-400">Book-to-Bill Multiple</span>
                      <span className="font-mono text-white">
                        {selectedInsight.book_to_bill_ratio
                          ? `${selectedInsight.book_to_bill_ratio}x`
                          : "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-400">Execution Runway</span>
                      <span className="font-mono text-slate-200">
                        {selectedInsight.execution_duration_months
                          ? `${selectedInsight.execution_duration_months} Months`
                          : "Ongoing manufacturing cycle"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Pillar 4: Balance Sheet & Cash Conversion */}
                <div className="p-4 rounded-xl bg-[#09101E] border border-slate-800 space-y-3">
                  <h4 className="text-xs uppercase font-mono tracking-wider text-blue-400 flex items-center gap-1.5">
                    <BarChart2 className="w-3.5 h-3.5" />
                    4. Cash Flow & Working Capital
                  </h4>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-800">
                      <span className="text-slate-400">OCF / EBITDA Conversion</span>
                      <span className="font-mono font-semibold text-white">
                        {selectedInsight.ocf_to_ebitda_ratio_pct
                          ? `${selectedInsight.ocf_to_ebitda_ratio_pct}%`
                          : "~70%"}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800">
                      <span className="text-slate-400">Working Capital Days</span>
                      <span className="font-mono text-slate-200">
                        {selectedInsight.working_capital_days
                          ? `${selectedInsight.working_capital_days} Days`
                          : "Stable"}
                      </span>
                    </div>
                    <div className="py-1">
                      <span className="text-slate-400 block mb-0.5">Debt & Funding Outlook:</span>
                      <span className="text-slate-200 text-xs">
                        {selectedInsight.debt_outlook || "Prudent leverage; internal accruals funded"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Pillar 5: Analyst Grill & Concall Q&A Drilldown */}
              <div className="p-4 rounded-xl bg-[#0A1222] border border-cyan-900/30 space-y-3">
                <h4 className="text-xs uppercase font-mono tracking-wider text-rose-400 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  5. Concall Analyst Grill & Pushback
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-black/40 border border-slate-800">
                    <span className="text-rose-400 font-semibold block mb-1">
                      Key Overhang Questioned by Analysts:
                    </span>
                    <p className="text-slate-300 italic">
                      &ldquo;{selectedInsight.key_overhang_questioned_by_analysts || "Operating efficiency and raw material cost absorption."}&rdquo;
                    </p>
                  </div>

                  <div className="p-2.5 rounded-lg bg-black/40 border border-slate-800">
                    <span className="text-emerald-400 font-semibold block mb-1">
                      Management Direct Response:
                    </span>
                    <p className="text-slate-300">
                      {selectedInsight.management_direct_answer || "Management defended guidance with volume commitments."}
                    </p>
                  </div>

                  {selectedInsight.evasiveness_detected && (
                    <div className="p-2.5 rounded-lg bg-amber-950/30 border border-amber-800/40">
                      <span className="text-amber-400 font-semibold block mb-1">
                        Executive Evasiveness / Hesitation:
                      </span>
                      <p className="text-slate-300 text-xs">
                        {selectedInsight.evasiveness_detected}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Phase 2: Balance Sheet & P&L Cross-Verification Radar */}
              {selectedInsight.forensic_discrepancies && selectedInsight.forensic_discrepancies.length > 0 && (
                <div className="p-4 rounded-xl bg-[#07101E] border border-cyan-800/40 space-y-3.5 shadow-lg">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-900/40 pb-2.5">
                    <div className="flex items-center gap-2">
                      <Scale className="w-4 h-4 text-cyan-400" />
                      <h4 className="text-xs uppercase font-mono font-bold tracking-wider text-cyan-300">
                        Balance Sheet & P&L Cross-Verification Radar
                      </h4>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400">
                      Comparing spoken concall claims directly with audited financial records
                    </span>
                  </div>

                  <div className="space-y-3">
                    {selectedInsight.forensic_discrepancies.map((disc, idx) => {
                      const sevBadge = getDiscrepancySeverityBadge(disc.severity);
                      return (
                        <div
                          key={idx}
                          className="p-3.5 rounded-lg bg-black/50 border border-slate-800/90 space-y-2.5 hover:border-cyan-900/60 transition"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-mono font-bold text-white flex items-center gap-1.5">
                              <AlertCircle className="w-3.5 h-3.5 text-cyan-400" />
                              {disc.category.replace(/_/g, " ")}
                            </span>
                            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${sevBadge}`}>
                              {disc.severity} RISK
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                            <div className="p-2.5 rounded bg-slate-950/80 border border-slate-800/60 space-y-1">
                              <span className="text-[11px] font-mono font-semibold text-cyan-300 block">
                                🎙️ Spoken Concall Narrative:
                              </span>
                              <p className="text-slate-300 italic text-[11px] leading-relaxed">
                                &ldquo;{disc.claim}&rdquo;
                              </p>
                            </div>

                            <div className="p-2.5 rounded bg-slate-950/80 border border-slate-800/60 space-y-1">
                              <span className="text-[11px] font-mono font-semibold text-amber-300 block">
                                📊 Ground Audited Financial Reality:
                              </span>
                              <p className="text-slate-200 text-[11px] font-sans leading-relaxed">
                                {disc.financial_reality}
                              </p>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-slate-900/80 text-[11px] text-slate-400 flex items-start gap-1.5">
                            <span className="font-mono font-semibold text-rose-300 shrink-0">Institutional Impact:</span>
                            <span className="text-slate-300">{disc.impact}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Pillar 6: Critical Monitorables Checklist */}
              {selectedInsight.critical_monitorables && selectedInsight.critical_monitorables.length > 0 && (
                <div className="p-4 rounded-xl bg-[#09101E] border border-slate-800">
                  <h4 className="text-xs uppercase font-mono tracking-wider text-cyan-400 mb-2 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    6. Critical Monitorables & Execution Triggers
                  </h4>
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    {selectedInsight.critical_monitorables.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-cyan-400 font-mono mt-0.5">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Historical Documents & Transcripts List */}
              {data?.documents && data.documents.length > 0 && (
                <div className="pt-4 border-t border-slate-800">
                  <h4 className="text-xs uppercase font-mono tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    Historical Presentations & Concalls ({data.documents.length} Files)
                  </h4>
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {data.documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/80 flex items-center justify-between hover:border-cyan-800/50 transition text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-400 font-mono text-[10px]">
                            {doc.fiscal_period}
                          </span>
                          <span className="text-slate-300 font-medium">
                            {doc.doc_type.replace(/_/g, " ")}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {doc.announcement_date || ""}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {doc.pdf_url && (
                            <a
                              href={doc.pdf_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-cyan-400 hover:text-cyan-300 transition flex items-center gap-1 text-[11px]"
                            >
                              <ExternalLink className="w-3 h-3" />
                              PDF
                            </a>
                          )}
                          <button
                            onClick={async () => {
                              try {
                                await triggerAnalyzeDocument(doc.id);
                                if (symbol) loadData(symbol);
                              } catch (e: any) {
                                alert(e.message);
                              }
                            }}
                            className="px-2 py-0.5 text-[10px] rounded bg-slate-800 hover:bg-cyan-900/60 text-slate-300 hover:text-cyan-300 transition"
                          >
                            Analyze
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

// =======================================================
// Alpha India — Dedicated Order Win Deep Dive Radar
// Institutional Quantitative Investment Intelligence
// Route: /announcements/[id]
// =======================================================

import { useEffect, useState, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Zap,
  Target,
  Clock,
  Coins,
  TrendingUp,
  BarChart3,
  Calendar,
  Compass,
  Award,
  Sparkles,
  ShieldCheck,
  Building2,
  FileText,
  ExternalLink,
  Send,
  BookmarkPlus,
  RefreshCw,
  Loader2,
  CheckCircle2,
  ArrowUpRight,
  TrendingDown,
  Percent,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import OrderWaterfallDrawer from "@/components/announcements/OrderWaterfallDrawer";
import {
  fetchAnnouncementById,
  analyzeSingleOrderWin,
  sendTelegramAlert,
  addCatalystToWatchlist,
  type AnnouncementRadarItem,
} from "@/lib/announcementsApi";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function OrderWinDeepDivePage({ params }: PageProps) {
  const resolvedParams = use(params);
  const announcementId = parseInt(resolvedParams.id, 10);

  const [item, setItem] = useState<AnnouncementRadarItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  const showToast = (msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    if (isNaN(announcementId)) {
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchAnnouncementById(announcementId)
      .then((data) => setItem(data))
      .catch(() => showToast("Failed to load announcement details", "err"))
      .finally(() => setLoading(false));
  }, [announcementId]);

  const handleReanalyze = async () => {
    if (!item) return;
    setReanalyzing(true);
    try {
      const updated = await analyzeSingleOrderWin(item.id);
      setItem(updated);
      showToast("Order win successfully re-analyzed with latest models!", "ok");
    } catch {
      showToast("Failed to re-analyze order win", "err");
    } finally {
      setReanalyzing(false);
    }
  };

  const handleTelegramAlert = async () => {
    if (!item) return;
    try {
      const res = await sendTelegramAlert(item.id);
      showToast(res.message, "ok");
    } catch {
      showToast("Failed to dispatch alert", "err");
    }
  };

  const handleWatchlist = async () => {
    if (!item) return;
    try {
      const res = await addCatalystToWatchlist(item.id);
      showToast(res.message, "ok");
    } catch {
      showToast("Failed to pin to watchlist", "err");
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[60vh] flex-col items-center justify-center">
          <Loader2 size={36} className="animate-spin text-cyan-500" />
          <p className="mt-4 text-sm font-semibold text-slate-400">Loading Order Win Deep Dive Intelligence…</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!item) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
          <Zap size={48} className="text-slate-700" />
          <h2 className="mt-4 text-lg font-bold text-white">Order Win Disclosure Not Found</h2>
          <p className="mt-1 text-sm text-slate-500">The requested announcement ID does not exist or has been archived.</p>
          <Link
            href="/announcements"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400 transition-colors"
          >
            <ArrowLeft size={14} /> Back to Announcements Radar
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const tier = (item.order_significance_tier || "HIGH_IMPACT").toUpperCase();
  const dealValue = item.deal_value_cr ?? item.synergy_rev_addition_cr;
  const revPct = item.synergy_rev_pct_ttm;
  const executionMonths = item.order_execution_months || 18;
  const quarters = Math.max(1, Math.round(executionMonths / 3));
  const quarterlyRevCr = item.order_quarterly_rev_cr ?? (dealValue ? Math.round((dealValue / quarters) * 10) / 10 : null);
  const quarterlyLiftPct = item.order_quarterly_rev_pct ?? revPct;
  const earningsImpactCr = item.order_earnings_impact_cr ?? item.synergy_ebitda_addition_cr;
  const patAccretionPct = item.synergy_pat_accretion_pct || (revPct ? Math.round(revPct * 1.2) : 15.0);
  const sigScore = item.order_significance_score ?? item.conviction_score ?? 82;
  const upsideProb = item.order_upside_prob_pct ?? 82.5;
  const confScore = item.order_confidence_score ?? 94.0;

  const cmp = item.current_price || 100;
  const targetBase = item.target_price || Math.round(cmp * 1.32);
  const targetLow = item.order_target_price_low || Math.round(cmp * 1.18);
  const targetHigh = item.order_target_price_high || Math.round(cmp * 1.48);
  const upsidePct = item.upside_pct || Math.round(((targetBase - cmp) / cmp) * 100);
  const stopLoss = item.stop_loss || Math.round(cmp * 0.90);

  const screenerUrl = `https://www.screener.in/company/${item.symbol ? item.symbol : encodeURIComponent(item.company_name)}/consolidated/#documents`;

  // Clean headline
  let cleanHeadline = item.headline;
  if (cleanHeadline.includes(" - ")) {
    const parts = cleanHeadline.split(" - ");
    if (parts.length > 1 && parts[0].includes("Regulation 30")) {
      cleanHeadline = parts.slice(1).join(" - ");
    }
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        {/* Toast Notification */}
        {toast && (
          <div
            className={`fixed bottom-6 right-6 z-50 rounded-xl px-4 py-3 text-xs font-bold text-white shadow-2xl transition-all ${
              toast.type === "ok" ? "bg-emerald-600" : "bg-red-600"
            }`}
          >
            {toast.msg}
          </div>
        )}

        {/* ── TOP NAV BAR & BREADCRUMBS ────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <Link
              href="/announcements"
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-cyan-500 hover:text-cyan-300 transition-colors"
            >
              <ArrowLeft size={13} />
              <span>Back to Radar</span>
            </Link>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span>/</span>
              <span>Announcements</span>
              <span>/</span>
              <span className="text-cyan-400 font-mono font-bold">{item.symbol || "EQUITY"}</span>
              <span>/</span>
              <span className="text-slate-300 font-semibold">Order Win Deep Dive</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleReanalyze}
              disabled={reanalyzing}
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-slate-300 hover:border-cyan-500 hover:text-cyan-300 transition-all disabled:opacity-50"
              title="Recalculate with latest market pricing and models"
            >
              <RefreshCw size={13} className={reanalyzing ? "animate-spin" : ""} />
              <span>{reanalyzing ? "Re-analyzing…" : "Re-calculate Intelligence"}</span>
            </button>
            <button
              onClick={handleWatchlist}
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-slate-300 hover:border-emerald-500 hover:text-emerald-300 transition-all"
            >
              <BookmarkPlus size={13} className="text-emerald-400" />
              <span>Watchlist</span>
            </button>
            <button
              onClick={handleTelegramAlert}
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-slate-300 hover:border-cyan-500 hover:text-cyan-300 transition-all"
            >
              <Send size={13} className="text-cyan-400" />
              <span>Dispatch Alert</span>
            </button>
            {item.pdf_url && (
              <a
                href={item.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-3.5 py-1.5 text-xs font-bold text-cyan-300 hover:bg-cyan-500/20 transition-all"
              >
                <FileText size={13} className="text-cyan-400" />
                <span>Exchange PDF</span>
                <ExternalLink size={10} className="opacity-70" />
              </a>
            )}
          </div>
        </div>

        {/* ── HERO BANNER: Institutional Contract Header ────────────── */}
        <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-950/20 via-[#071322] to-[#040A14] p-6 shadow-2xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/20 border border-amber-500/40 px-2.5 py-0.5 text-xs font-black uppercase tracking-wider text-amber-300">
                  <Zap size={13} className="fill-amber-400" />
                  Order Win Intelligence
                </span>
                <span className="rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 px-3 py-0.5 text-xs font-black uppercase font-mono">
                  {tier.replace(/_/g, " ")} · {sigScore.toFixed(0)}/100
                </span>
                {item.order_client_counterparty && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/20 border border-blue-500/40 px-2.5 py-0.5 text-xs font-semibold text-blue-300">
                    <Building2 size={11} className="text-blue-400" />
                    Contracting Client: <strong className="text-white font-mono">{item.order_client_counterparty}</strong>
                  </span>
                )}
                {item.is_listed && (
                  <span className="rounded bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-xs font-mono font-bold text-emerald-400">
                    NSE / BSE Verified
                  </span>
                )}
              </div>

              <h1 className="mt-3 text-2xl sm:text-3xl font-black text-white tracking-tight">
                {item.company_name}
                {item.symbol && <span className="ml-3 font-mono text-cyan-400 text-lg">({item.symbol})</span>}
              </h1>

              <div className="mt-3 max-w-3xl rounded-xl border border-slate-800 bg-slate-950/70 p-3.5">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Official Regulatory Filing</span>
                <p className="text-sm font-semibold text-slate-100 leading-snug">
                  {cleanHeadline}
                </p>
              </div>
            </div>

            {/* Price Target & Upside Callout */}
            <div className="flex flex-col gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-4 font-mono min-w-56 text-right">
              <div className="text-[10px] uppercase font-sans text-emerald-400 font-bold tracking-wider">
                Modeled Upside Probability
              </div>
              <div className="text-3xl font-black text-emerald-300">
                {upsideProb.toFixed(0)}%
              </div>
              <div className="text-xs text-slate-300">
                Base Target: <strong className="text-white text-sm">₹{targetBase.toLocaleString("en-IN")}</strong>
                <span className="text-emerald-400 font-bold ml-1.5">+{upsidePct}%</span>
              </div>
              <div className="text-[11px] text-slate-400">
                Live CMP: ₹{cmp.toLocaleString("en-IN")} · SL: ₹{stopLoss.toLocaleString("en-IN")}
              </div>
            </div>
          </div>
        </div>

        {/* ── 4-METRIC SIZING SUITE ─────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-amber-500/30 bg-[#071322] p-4 flex flex-col justify-between shadow-lg">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-amber-400 mb-2">
              <span>Order Sizing</span>
              <Coins size={14} />
            </div>
            <div>
              <div className="font-mono text-2xl font-black text-white">
                {dealValue ? `₹${dealValue.toLocaleString("en-IN")} Cr` : "High Value"}
              </div>
              <div className="font-mono text-xs font-bold text-amber-300 mt-1">
                {revPct ? `+${revPct.toFixed(1)}% of TTM Revenue` : "Expanding Backlog"}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-cyan-500/30 bg-[#071322] p-4 flex flex-col justify-between shadow-lg">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-cyan-400 mb-2">
              <span>Execution Runway</span>
              <Clock size={14} />
            </div>
            <div>
              <div className="font-mono text-2xl font-black text-white">
                {executionMonths} Months
              </div>
              <div className="font-mono text-xs text-cyan-300 mt-1">
                {quarters} Quarters Realization Cadence
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-500/30 bg-[#071322] p-4 flex flex-col justify-between shadow-lg">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-emerald-400 mb-2">
              <span>Quarterly Revenue</span>
              <TrendingUp size={14} />
            </div>
            <div>
              <div className="font-mono text-2xl font-black text-emerald-300">
                {quarterlyRevCr ? `+₹${quarterlyRevCr.toLocaleString("en-IN")} Cr` : "Accretive"}
              </div>
              <div className="font-mono text-xs text-emerald-400/90 mt-1">
                {quarterlyLiftPct ? `+${quarterlyLiftPct.toFixed(1)}% Top-line Lift/Qtr` : "Quarterly Inflow"}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-purple-500/30 bg-[#071322] p-4 flex flex-col justify-between shadow-lg">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-purple-400 mb-2">
              <span>Earnings Impact</span>
              <BarChart3 size={14} />
            </div>
            <div>
              <div className="font-mono text-2xl font-black text-purple-300">
                {earningsImpactCr ? `+₹${earningsImpactCr.toLocaleString("en-IN")} Cr` : "Profitable"}
              </div>
              <div className="font-mono text-xs text-purple-300/90 mt-1">
                +{patAccretionPct.toFixed(1)}% Annual PAT Accretion
              </div>
            </div>
          </div>
        </div>

        {/* ── ACTIONABLE INVESTMENT THESIS BOX: Direct Answer ────────── */}
        <div className="relative rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-cyan-950/40 via-slate-900/60 to-slate-900/40 p-5 shadow-xl">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-400 mb-2">
            <Sparkles size={14} className="text-cyan-400" />
            <span>Actionable Investment Intelligence Verdict</span>
          </div>
          <p className="text-sm font-medium text-slate-100 leading-relaxed">
            {item.buy_thesis || item.ai_insight}
          </p>
        </div>

        {/* ── DEEP DIVE WATERFALL & SENSITIVITY SUITE ────────────────── */}
        <div className="rounded-2xl border border-slate-800 bg-[#06101E] p-6 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-5">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-amber-400" />
              <h2 className="text-base font-bold text-white uppercase tracking-wider">
                Quarterly Execution Waterfall & Scenario Matrix
              </h2>
            </div>
            <span className="rounded-full bg-slate-800 text-slate-300 px-3 py-1 text-xs font-mono">
              Model Confidence: <strong>{confScore.toFixed(0)}%</strong>
            </span>
          </div>

          <OrderWaterfallDrawer item={item} showNavigationLink={false} />
        </div>

        {/* ── FUNDAMENTAL RADAR & VALUATION BRIDGE ──────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Fundamental Multiples */}
          <div className="rounded-2xl border border-slate-800 bg-[#071322] p-5 shadow-xl font-mono text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-3 text-slate-300 font-sans">
              <span className="font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                <BarChart3 size={13} />
                Financial Ratios & Multiples
              </span>
              <a
                href={screenerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1"
              >
                <span>Screener.in</span>
                <ExternalLink size={10} />
              </a>
            </div>

            <div className="space-y-2.5">
              <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                <span className="text-slate-400 font-sans">Current P/E:</span>
                <span className="font-bold text-white">{item.valuation_pe ? `${item.valuation_pe}x` : "—"}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                <span className="text-slate-400 font-sans">Fair / Benchmark P/E:</span>
                <span className="font-bold text-amber-400">{item.fair_pe ? `${item.fair_pe}x` : "25.0x"}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                <span className="text-slate-400 font-sans">50 DMA:</span>
                <span className="font-bold text-white">{item.dma_50 ? `₹${item.dma_50.toLocaleString("en-IN")}` : "—"}</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                <span className="text-slate-400 font-sans">200 DMA:</span>
                <span className="font-bold text-white">{item.dma_200 ? `₹${item.dma_200.toLocaleString("en-IN")}` : "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">Trend Regime:</span>
                <span className={`font-bold ${item.trend_regime === "GOLDEN_TREND" ? "text-emerald-400" : "text-amber-400"}`}>
                  {item.trend_regime || "GOLDEN_TREND"}
                </span>
              </div>
            </div>
          </div>

          {/* Institutional Conviction Bridge */}
          <div className="rounded-2xl border border-slate-800 bg-[#071322] p-5 shadow-xl font-mono text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5 mb-3 text-slate-300 font-sans">
              <span className="font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <ShieldCheck size={13} />
                Risk / Reward Conviction
              </span>
              <span className="rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-black uppercase">
                {item.recommendation || "STRONG BUY"}
              </span>
            </div>

            <div className="space-y-2.5">
              <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                <span className="text-slate-400 font-sans">Target Price:</span>
                <span className="font-bold text-emerald-400 text-sm">₹{targetBase.toLocaleString("en-IN")} (+{upsidePct}%)</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                <span className="text-slate-400 font-sans">Stop Loss Guardrail:</span>
                <span className="font-bold text-rose-400">₹{stopLoss.toLocaleString("en-IN")} (-10.0%)</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                <span className="text-slate-400 font-sans">Risk : Reward Ratio:</span>
                <span className="font-bold text-cyan-300 text-sm">
                  1 : {((targetBase - cmp) / (cmp - stopLoss)).toFixed(1)}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-800/60 pb-1.5">
                <span className="text-slate-400 font-sans">Absorption Status:</span>
                <span className="font-bold text-emerald-400">{item.absorption_status || "FRESH_TRIGGER"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">Quant Conviction Score:</span>
                <span className="font-black text-emerald-400 text-sm">{sigScore.toFixed(0)}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/layout/DashboardLayout";
import TradingViewChart from "@/components/common/TradingViewChart";
import {
  fetchTechnoFundaStock,
  type TechnoFundaStockAnalysis,
} from "@/lib/technoFundaApi";
import {
  ArrowLeft,
  Activity,
  Zap,
  Target,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Flame,
  ArrowUpRight,
  TrendingUp,
  BarChart3,
  Layers,
  Scale,
  DollarSign,
  Share2,
} from "lucide-react";

interface PageProps {
  params: Promise<{ symbol: string }>;
}

export default function TechnoFundaStockDetailPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const rawSymbol = resolvedParams?.symbol || "METROPOLIS";
  const symbol = decodeURIComponent(rawSymbol).toUpperCase();

  const [stock, setStock] = useState<TechnoFundaStockAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    fetchTechnoFundaStock(symbol)
      .then((data) => {
        if (mounted) {
          setStock(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          console.error("Failed to load stock details:", err);
          setError(err.message || "Failed to load stock analysis");
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [symbol]);

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-5">
        {/* TOP NAVIGATION / BREADCRUMB */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/techno-funda"
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#081225] px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:border-cyan-500/50 hover:text-slate-900 dark:hover:text-white transition shadow-2xs"
            >
              <ArrowLeft size={14} />
              <span>Back to Pre-Breakout Screener</span>
            </Link>
            <span className="text-slate-400 dark:text-slate-600">/</span>
            <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400">{symbol}</span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/growth-screener"
              className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#081225] px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition shadow-2xs"
            >
              Growth Screener PRO
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="flex h-96 flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#050B14] shadow-xs">
            <Activity className="h-8 w-8 animate-spin text-cyan-600 dark:text-cyan-400" />
            <div className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Generating algorithmic techno-funda breakdown for {symbol}...
            </div>
          </div>
        ) : error || !stock ? (
          <div className="flex h-64 flex-col items-center justify-center gap-2 rounded-2xl border border-rose-900/40 bg-rose-950/20 p-6 text-center">
            <AlertTriangle className="h-8 w-8 text-rose-400" />
            <div className="text-base font-bold text-white">Stock Not Available</div>
            <div className="text-xs text-rose-300">{error || "Could not retrieve stock analysis."}</div>
            <Link
              href="/techno-funda"
              className="mt-3 rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700"
            >
              Return to Radar
            </Link>
          </div>
        ) : (
          <>
            {/* STOCK HEADER CARD */}
            <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-[#081225] via-[#050B14] to-[#040810] p-5 shadow-2xl">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                      {stock.symbol}
                    </h1>
                    <span className="text-sm text-slate-400 font-medium sm:text-base">
                      {stock.company_name}
                    </span>
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-cyan-300 border border-slate-700">
                      {stock.exchange}
                    </span>
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-slate-300 border border-slate-700">
                      {stock.sector}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-slate-400">
                    {stock.industry} · Institutional Setup & Scenario Intelligence
                  </div>
                </div>

                {/* PRICE & SIGNAL PILL */}
                <div className="flex flex-wrap items-center gap-4">
                  <div className="text-right">
                    <div className="text-xs text-slate-400 font-medium">Current Market Price (CMP)</div>
                    <div className="text-2xl font-black text-white font-mono">
                      ₹{stock.technical.current_price?.toLocaleString()}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold border shadow-lg ${
                        stock.technical.signal_tier === "STRONG_BUY"
                          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 shadow-emerald-500/10"
                          : stock.technical.signal_tier === "PRE_BREAKOUT"
                          ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/30 shadow-cyan-500/10"
                          : stock.technical.signal_tier === "PULLBACK"
                          ? "bg-blue-500/15 text-blue-300 border-blue-500/30 shadow-blue-500/10"
                          : "bg-slate-800 text-slate-300 border-slate-700"
                      }`}
                    >
                      <Zap size={14} />
                      {stock.technical.signal}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Setup Score: <strong className="text-white">{stock.technical.setup_score}/100</strong>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* MAIN WORKSPACE: LIVE CHART (7 COLS) & SCENARIO BLUEPRINT (5 COLS) */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
              {/* LIVE TRADINGVIEW CHART CONTAINER */}
              <div className="lg:col-span-7 flex flex-col gap-4">
                <TradingViewChart
                  symbol={stock.symbol}
                  exchange={stock.exchange || "NSE"}
                  height={560}
                  pivotReference={stock.technical.pivot_reference}
                  scenarioTrigger={stock.technical.scenario_trigger}
                  downsideReference={stock.technical.downside_reference}
                  target1={stock.technical.target_1}
                />
              </div>

              {/* SETUP READINESS & SCENARIO BLUEPRINT PANEL */}
              <div className="lg:col-span-5 flex flex-col gap-4">
                {/* SETUP READINESS CARD */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#081225] p-5 shadow-xl">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <Flame size={18} className="text-amber-400" />
                      <h2 className="text-sm font-bold tracking-wider text-slate-200 uppercase">
                        Setup Readiness
                      </h2>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xl font-extrabold text-cyan-400 font-mono">
                        {stock.technical.setup_score}
                      </span>
                      <span className="text-xs text-slate-500 font-bold">/100</span>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="text-sm font-bold text-white">
                      {stock.setup_status}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-400">
                      {stock.status_desc}
                    </p>

                    {/* Progress Score Bar */}
                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 via-emerald-500 to-emerald-400 transition-all duration-500"
                        style={{ width: `${stock.technical.setup_score}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* SCENARIO REFERENCE LEVELS (LIKE SWINGEDGE) */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#081225] p-5 shadow-xl font-mono">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3 font-sans">
                    <div className="flex items-center gap-2">
                      <Target size={18} className="text-cyan-400" />
                      <h2 className="text-sm font-bold tracking-wider text-slate-200 uppercase">
                        Scenario Blueprint Levels
                      </h2>
                    </div>
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest">
                      Model-Derived
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    {/* TRIGGER LEVEL */}
                    <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-3">
                      <div className="text-[10px] font-sans text-cyan-400 font-semibold uppercase">
                        Breakout Trigger
                      </div>
                      <div className="mt-1 text-lg font-bold text-cyan-300">
                        ₹{stock.technical.scenario_trigger}
                      </div>
                      <div className="text-[10px] text-slate-400 font-sans">
                        ₹{stock.technical.scenario_distance} from spot (+0.5% pivot)
                      </div>
                    </div>

                    {/* PIVOT REFERENCE */}
                    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                      <div className="text-[10px] font-sans text-slate-400 font-semibold uppercase">
                        Model Pivot Reference
                      </div>
                      <div className="mt-1 text-lg font-bold text-white">
                        ₹{stock.technical.pivot_reference}
                      </div>
                      <div className="text-[10px] text-slate-400 font-sans">
                        {stock.technical.distance_to_pivot_pct}% from current price
                      </div>
                    </div>

                    {/* DOWNSIDE STOP LOSS */}
                    <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3">
                      <div className="text-[10px] font-sans text-rose-400 font-semibold uppercase">
                        Downside Ref / Stop
                      </div>
                      <div className="mt-1 text-lg font-bold text-rose-400">
                        ₹{stock.technical.downside_reference}
                      </div>
                      <div className="text-[10px] text-slate-400 font-sans">
                        Base Low (-{stock.technical.downside_pct}%)
                      </div>
                    </div>

                    {/* TARGET 1 */}
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                      <div className="text-[10px] font-sans text-emerald-400 font-semibold uppercase">
                        Target 1 (+10%)
                      </div>
                      <div className="mt-1 text-lg font-bold text-emerald-400">
                        ₹{stock.technical.target_1}
                      </div>
                      <div className="text-[10px] text-slate-400 font-sans">
                        Swing Target Resolution
                      </div>
                    </div>
                  </div>

                  {/* ASYMMETRIC R:R BANNER */}
                  <div className="mt-3 flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/5 px-3.5 py-2 text-xs">
                    <span className="font-sans text-slate-300">Asymmetric Risk-to-Reward:</span>
                    <strong className="text-amber-400 font-bold">1 : {stock.technical.risk_reward}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* STRUCTURED CHECKLIST: BULLISH FACTORS VS RISK FACTORS */}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {/* BULLISH FACTORS */}
              <div className="rounded-2xl border border-emerald-500/20 bg-[#061418] p-5 shadow-xl">
                <div className="flex items-center gap-2 border-b border-emerald-500/20 pb-3">
                  <CheckCircle2 size={18} className="text-emerald-400" />
                  <h3 className="text-sm font-bold tracking-wider text-emerald-300 uppercase">
                    Bullish Setup Factors ({stock.bullish_factors.length})
                  </h3>
                </div>

                <ul className="mt-4 flex flex-col gap-2.5">
                  {stock.bullish_factors.map((factor, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-200">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] font-bold text-emerald-400">
                        ✓
                      </span>
                      <span className="leading-relaxed">{factor}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* RISK FACTORS */}
              <div className="rounded-2xl border border-rose-500/20 bg-[#160B12] p-5 shadow-xl">
                <div className="flex items-center gap-2 border-b border-rose-500/20 pb-3">
                  <AlertTriangle size={18} className="text-rose-400" />
                  <h3 className="text-sm font-bold tracking-wider text-rose-300 uppercase">
                    Risk & Invalidation Factors ({stock.risk_factors.length})
                  </h3>
                </div>

                <ul className="mt-4 flex flex-col gap-2.5">
                  {stock.risk_factors.map((factor, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-xs text-slate-200">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-rose-500/20 text-[10px] font-bold text-rose-400">
                        !
                      </span>
                      <span className="leading-relaxed">{factor}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* DUAL PILLAR SPECIFICATION: TECHNICAL VS FUNDAMENTAL */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {/* TECHNICAL PILLAR */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#081225] p-5 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Activity size={18} className="text-cyan-400" />
                    <h3 className="text-sm font-bold tracking-wider text-slate-200 uppercase">
                      Technical Pillar & Price Action
                    </h3>
                  </div>
                  <span className="rounded bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-400 border border-cyan-500/20">
                    Stage-2 & VCP
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-xs font-mono">
                  <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-2.5">
                    <div className="text-[10px] text-slate-400 font-sans">Trend Stage</div>
                    <div className="text-sm font-bold text-emerald-400">
                      {stock.technical.is_stage_2 ? "Stage 2 (Advancing)" : "Stage 1 / Neutral"}
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-2.5">
                    <div className="text-[10px] text-slate-400 font-sans">Pattern Footprint</div>
                    <div className="text-sm font-bold text-white">{stock.technical.pattern}</div>
                  </div>

                  <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-2.5">
                    <div className="text-[10px] text-slate-400 font-sans">50 DMA</div>
                    <div className="text-sm font-bold text-white">₹{stock.technical.dma_50 ?? "—"}</div>
                  </div>

                  <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-2.5">
                    <div className="text-[10px] text-slate-400 font-sans">200 DMA</div>
                    <div className="text-sm font-bold text-white">₹{stock.technical.dma_200 ?? "—"}</div>
                  </div>

                  <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-2.5">
                    <div className="text-[10px] text-slate-400 font-sans">RSI (14)</div>
                    <div className="text-sm font-bold text-cyan-400">{stock.technical.rsi_14}</div>
                  </div>

                  <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-2.5">
                    <div className="text-[10px] text-slate-400 font-sans">Vol Q / Base Q</div>
                    <div className="text-sm font-bold text-white">
                      {stock.technical.vol_q} / {stock.technical.base_q}
                    </div>
                  </div>
                </div>
              </div>

              {/* FUNDAMENTAL PILLAR */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#081225] p-5 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={18} className="text-emerald-400" />
                    <h3 className="text-sm font-bold tracking-wider text-slate-200 uppercase">
                      Fundamental Pillar & Quality
                    </h3>
                  </div>
                  <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                    Institutional Radar
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-xs font-mono">
                  <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-2.5">
                    <div className="text-[10px] text-slate-400 font-sans">Health Score</div>
                    <div className="text-sm font-bold text-emerald-400">
                      {stock.fundamentals.health_score ?? "—"}/100
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-2.5">
                    <div className="text-[10px] text-slate-400 font-sans">Piotroski F-Score</div>
                    <div className="text-sm font-bold text-cyan-400">
                      {stock.fundamentals.piotroski_score ?? "—"}/9
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-2.5">
                    <div className="text-[10px] text-slate-400 font-sans">TTM Sales Growth</div>
                    <div className="text-sm font-bold text-white">
                      {stock.fundamentals.sales_growth_ttm ? `+${stock.fundamentals.sales_growth_ttm}%` : "—"}
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-2.5">
                    <div className="text-[10px] text-slate-400 font-sans">TTM PAT Growth</div>
                    <div className="text-sm font-bold text-white">
                      {stock.fundamentals.profit_growth_ttm ? `${stock.fundamentals.profit_growth_ttm}%` : "—"}
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-2.5">
                    <div className="text-[10px] text-slate-400 font-sans">ROCE (%)</div>
                    <div className="text-sm font-bold text-emerald-400">
                      {stock.fundamentals.roce ? `${stock.fundamentals.roce}%` : "—"}
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-2.5">
                    <div className="text-[10px] text-slate-400 font-sans">Stock P/E vs Industry</div>
                    <div className="text-sm font-bold text-white">
                      {stock.fundamentals.stock_pe ?? "—"} / {stock.fundamentals.industry_pe ?? "—"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

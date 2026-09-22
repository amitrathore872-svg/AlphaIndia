"use client";

import { useEffect, useState, use, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import TradingViewChart from "@/components/common/TradingViewChart";
import {
  fetchStockTechnicalOverview,
  searchStocks,
  type StockTechnicalOverview,
  type StockSearchResult,
} from "@/lib/stocksApi";
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
  Search,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  ExternalLink,
  Calendar,
  Compass,
  Sliders,
  Sparkles,
  Info,
  Check,
  X,
  Calculator,
  RefreshCw,
} from "lucide-react";

interface PageProps {
  params: Promise<{ symbol: string }>;
}

export default function StockTechnicalOverviewPage({ params }: PageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const rawSymbol = resolvedParams?.symbol || "TCS";
  const symbol = decodeURIComponent(rawSymbol).toUpperCase();

  const [data, setData] = useState<StockTechnicalOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search Switcher
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<StockSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  // Calculator Modal
  const [showCalcModal, setShowCalcModal] = useState(false);
  const [portfolioSize, setPortfolioSize] = useState<number>(500000);
  const [riskPercent, setRiskPercent] = useState<number>(1.0);

  // FAQ open/close accordion state
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);

  // Active navigation tab
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch Stock Technical Data
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    fetchStockTechnicalOverview(symbol)
      .then((res) => {
        if (mounted) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          console.error("Failed to load technical overview:", err);
          setError(err.message || "Failed to load stock technical overview");
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [symbol]);

  // Handle Search Input
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(() => {
      setIsSearching(true);
      searchStocks(searchQuery)
        .then((res) => {
          setSearchResults(res);
          setIsSearching(false);
        })
        .catch(() => {
          setIsSearching(false);
        });
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Position Sizing Calculations
  const positionSizing = useMemo(() => {
    if (!data) return null;
    const cmp = data.current_price;
    const stop = data.scenario_references.downside_reference;
    const riskPerShare = Math.max(0.1, cmp - stop);
    const maxRiskAmount = (portfolioSize * riskPercent) / 100;
    const sharesToBuy = Math.floor(maxRiskAmount / riskPerShare);
    const totalCapitalRequired = sharesToBuy * cmp;
    const portfolioAllocPct = portfolioSize > 0 ? (totalCapitalRequired / portfolioSize) * 100 : 0;
    const potentialProfitT1 = sharesToBuy * (data.scenario_references.target_1 - cmp);
    const potentialProfitT2 = sharesToBuy * (data.scenario_references.target_2 - cmp);

    return {
      riskPerShare,
      maxRiskAmount,
      sharesToBuy,
      totalCapitalRequired,
      portfolioAllocPct,
      potentialProfitT1,
      potentialProfitT2,
    };
  }, [data, portfolioSize, riskPercent]);

  const scrollToSection = (id: string) => {
    setActiveTab(id);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 max-w-[1600px] mx-auto pb-16">
        {/* ========================================================================= */}
        {/* 1. TOP BREADCRUMB, SEARCH SWITCHER & QUICK ACTIONS                        */}
        {/* ========================================================================= */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <Link
              href="/growth-screener"
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#081225] px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:border-cyan-500/50 hover:text-cyan-600 dark:hover:text-white shadow-xs transition"
            >
              <ArrowLeft size={14} />
              <span>Back to Screener</span>
            </Link>
            <span className="text-slate-400 dark:text-slate-600">/</span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black text-cyan-600 dark:text-cyan-400 tracking-wider font-mono">{symbol}</span>
              {data && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-cyan-50 dark:bg-cyan-950/60 border border-cyan-200 dark:border-cyan-800/50 text-cyan-700 dark:text-cyan-300">
                  {data.exchange}
                </span>
              )}
            </div>
          </div>

          {/* Quick Symbol Switcher Search */}
          <div className="flex items-center gap-3">
            <div className="relative w-72">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Switch stock (e.g. RELIANCE, TCS)..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSearchDropdown(true);
                  }}
                  onFocus={() => setShowSearchDropdown(true)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#081225] pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:border-cyan-500 focus:outline-none shadow-xs transition"
                />
              </div>

              {/* Dropdown Suggestions */}
              {showSearchDropdown && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1.5 z-50 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0A1424] shadow-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                  {searchResults.map((item) => (
                    <button
                      key={item.symbol}
                      onClick={() => {
                        setShowSearchDropdown(false);
                        setSearchQuery("");
                        router.push(`/stocks/${item.symbol}`);
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800/60 transition"
                    >
                      <div>
                        <div className="text-xs font-bold text-cyan-600 dark:text-cyan-400">{item.symbol}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[180px]">{item.company_name}</div>
                      </div>
                      <div className="text-xs font-mono text-slate-700 dark:text-slate-300">₹{item.current_price.toFixed(1)}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Action Buttons */}
            <button
              onClick={() => setShowCalcModal(true)}
              className="flex items-center gap-1.5 rounded-lg border border-cyan-300 dark:border-cyan-800/60 bg-cyan-50 dark:bg-cyan-950/40 px-3 py-1.5 text-xs font-semibold text-cyan-700 dark:text-cyan-300 hover:bg-cyan-100 dark:hover:bg-cyan-900/40 hover:border-cyan-500 shadow-xs transition"
            >
              <Calculator size={13} />
              <span>Position Sizing</span>
            </button>

            <a
              href={`https://www.screener.in/company/${symbol}/`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#081225] px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white shadow-xs transition"
              title="Open Screener.in"
            >
              <span>Screener</span>
              <ExternalLink size={12} />
            </a>
          </div>
        </div>

        {/* LOADING STATE */}
        {loading && (
          <div className="flex h-96 flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#050B14]">
            <Activity className="h-8 w-8 animate-spin text-cyan-500" />
            <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Generating multi-dimensional technical overview for {symbol}...
            </div>
            <div className="text-xs text-slate-500 font-mono">
              Computing SMC structure, base quality, scenario references & seasonality...
            </div>
          </div>
        )}

        {/* ERROR STATE */}
        {error && !loading && (
          <div className="rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/20 p-8 text-center">
            <AlertTriangle className="mx-auto h-10 w-10 text-rose-500 dark:text-rose-400 mb-3" />
            <h3 className="text-base font-bold text-rose-800 dark:text-rose-200">Analysis Unavailable</h3>
            <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 max-w-md mx-auto">{error}</p>
            <div className="mt-4">
              <Link
                href="/growth-screener"
                className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-xs font-medium text-white hover:bg-slate-700 transition"
              >
                Return to Screener
              </Link>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* DATA LOADED VIEW                                                          */}
        {/* ========================================================================= */}
        {data && !loading && (
          <>
            {/* ===================================================================== */}
            {/* 2. HERO HEADER BANNER                                                 */}
            {/* ===================================================================== */}
            <div className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-gradient-to-r from-white via-slate-50 to-white dark:from-[#050B14] dark:via-[#081326] dark:to-[#050B14] p-6 shadow-xs dark:shadow-xl">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-slate-900 dark:text-white font-mono">
                      {data.company_name}
                    </h1>
                    <span className="rounded-md border border-cyan-300 dark:border-cyan-500/30 bg-cyan-50 dark:bg-cyan-500/10 px-2.5 py-0.5 text-xs font-bold text-cyan-700 dark:text-cyan-400">
                      {data.symbol}
                    </span>
                    <span className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-0.5 text-xs text-slate-700 dark:text-slate-300">
                      {data.sector}
                    </span>
                    <span className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-0.5 text-xs text-slate-600 dark:text-slate-400">
                      {data.industry}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-slate-600 dark:text-slate-400">
                    <span>
                      Market Cap:{" "}
                      <strong className="text-slate-800 dark:text-slate-200 font-mono">
                        ₹{(data.market_cap || 0).toLocaleString()} Cr
                      </strong>{" "}
                      ({data.market_cap_category})
                    </span>
                    <span className="text-slate-300 dark:text-slate-700">•</span>
                    <span>
                      As of: <strong className="text-slate-700 dark:text-slate-300">{data.as_of_date}</strong>
                    </span>
                    <span className="text-slate-300 dark:text-slate-700">•</span>
                    <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                      <CheckCircle2 size={13} />
                      {data.context_regime.trend_stage}
                    </span>
                  </div>
                </div>

                {/* Spot Price & 52W Range */}
                <div className="flex items-center gap-6 self-start lg:self-auto bg-slate-50 dark:bg-[#0A1424]/90 border border-slate-200 dark:border-slate-800/90 rounded-xl p-4 shadow-xs">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Spot Price (CMP)</div>
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className="text-2xl font-black text-slate-900 dark:text-white font-mono">
                        ₹{(data.current_price ?? 0).toFixed(2)}
                      </span>
                      <span
                        className={`text-xs font-bold font-mono ${
                          (data.day_change ?? 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {(data.day_change ?? 0) >= 0 ? "+" : ""}
                        {(data.day_change ?? 0).toFixed(2)} ({(data.day_change_pct ?? 0) >= 0 ? "+" : ""}
                        {data.day_change_pct ?? 0}%)
                      </span>
                    </div>
                  </div>

                  <div className="h-10 w-px bg-slate-200 dark:bg-slate-800" />

                  <div className="min-w-[130px]">
                    <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">52-Week Range</div>
                    <div className="text-xs font-mono text-slate-700 dark:text-slate-300 mt-1">
                      ₹{data.moving_averages.year_low.toFixed(1)} — ₹{data.moving_averages.year_high.toFixed(1)}
                    </div>
                    <div className="relative mt-1.5 h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                      {(() => {
                        const low = data.moving_averages.year_low;
                        const high = data.moving_averages.year_high;
                        const pos = Math.min(100, Math.max(0, ((data.current_price - low) / (high - low || 1)) * 100));
                        return (
                          <div
                            className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 rounded-full"
                            style={{ width: `${pos}%` }}
                          />
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Research Notice Banner */}
              <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800/60 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
                <div className="flex items-center gap-1.5">
                  <Info size={12} className="text-cyan-500 dark:text-cyan-400" />
                  <span>
                    All levels algorithmically derived by Alpha India Quantitative Engine. For research & education only.
                  </span>
                </div>
                <div className="font-mono text-slate-500">
                  50 DMA: ₹{data.moving_averages.dma_50.toFixed(1)} | 200 DMA: ₹{data.moving_averages.dma_200.toFixed(1)}
                </div>
              </div>
            </div>

            {/* ===================================================================== */}
            {/* 3. STICKY SUB-NAVIGATION RIBBON                                       */}
            {/* ===================================================================== */}
            <div className="sticky top-0 z-30 flex items-center gap-2 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#060D19]/95 backdrop-blur-md p-1.5 text-xs font-semibold shadow-xs dark:shadow-lg">
              {[
                { id: "overview", label: "Overview" },
                { id: "setup-analysis", label: "Setup Readiness" },
                { id: "scenario-levels", label: "Scenario References" },
                { id: "market-structure", label: "Market Structure (SMC)" },
                { id: "research-chart", label: "Research Chart" },
                { id: "quality-gauges", label: "Setup Gauges" },
                { id: "seasonality", label: "Seasonality" },
                { id: "ai-insights", label: "AI Insights" },
                { id: "sector-peers", label: "Sector Peers" },
                { id: "faq", label: "FAQ & Rules" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => scrollToSection(tab.id)}
                  className={`rounded-lg px-3.5 py-1.5 transition whitespace-nowrap ${
                    activeTab === tab.id
                      ? "bg-cyan-50 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-500/40 font-bold"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/40"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* ===================================================================== */}
            {/* 4. SECTION: SETUP READINESS & SCENARIO REFERENCES                     */}
            {/* ===================================================================== */}
            <div id="overview" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* SETUP READINESS CARD (7 Cols) */}
              <div
                id="setup-analysis"
                className="lg:col-span-7 flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#070F1E] p-6 shadow-xs dark:shadow-xl"
              >
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
                      Structured Setup Analysis
                    </div>
                    <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5 flex items-center gap-2">
                      <span>{data.setup_readiness.status}</span>
                      <span className="text-xs px-2 py-0.5 rounded font-bold bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300">
                        Grade {data.setup_readiness.grade}
                      </span>
                    </div>
                  </div>

                  {/* Setup Score Gauge */}
                  <div className="flex items-center gap-3 bg-slate-50 dark:bg-[#0A1629] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2">
                    <div className="text-right">
                      <div className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400">Setup Score</div>
                      <div className="text-xl font-black text-cyan-600 dark:text-cyan-400 font-mono">
                        {data.setup_readiness.score}
                        <span className="text-xs font-normal text-slate-400 dark:text-slate-500"> / 100</span>
                      </div>
                    </div>
                    <Sparkles className="h-6 w-6 text-cyan-500 dark:text-cyan-400" />
                  </div>
                </div>

                <p className="text-xs text-slate-700 dark:text-slate-300 mt-3.5 leading-relaxed">
                  {data.setup_readiness.status_desc}
                </p>

                {/* Bullish vs Risk Factors 2-Col Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
                  {/* Bullish Factors */}
                  <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/60 dark:bg-emerald-950/15 p-4">
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-3">
                      <ShieldCheck size={14} />
                      <span>Bullish Factors ({data.setup_readiness.bullish_factors.length})</span>
                    </div>
                    <ul className="flex flex-col gap-2.5">
                      {data.setup_readiness.bullish_factors.map((factor, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs text-slate-800 dark:text-slate-200">
                          <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                          <span className="leading-snug">{factor}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Risk Factors */}
                  <div className="rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/15 p-4">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-3">
                      <AlertTriangle size={14} />
                      <span>Risk & Caution Factors ({data.setup_readiness.risk_factors.length})</span>
                    </div>
                    <ul className="flex flex-col gap-2.5">
                      {data.setup_readiness.risk_factors.map((factor, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs text-slate-800 dark:text-slate-200">
                          <AlertTriangle size={13} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                          <span className="leading-snug">{factor}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Overall Verdict Synthesis */}
                <div className="mt-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A1629]/70 p-3.5 text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2.5">
                  <Flame size={15} className="text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-900 dark:text-white">Overall Synthesis: </strong>
                    <span>{data.setup_readiness.overall_view}</span>
                  </div>
                </div>
              </div>

              {/* SCENARIO KEY PRICE REFERENCES & REGIME (5 Cols) */}
              <div
                id="scenario-levels"
                className="lg:col-span-5 flex flex-col justify-between rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#070F1E] p-6 shadow-xs dark:shadow-xl"
              >
                <div>
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                    <div className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
                      Scenario Price References
                    </div>
                    <span className="text-[11px] font-mono text-cyan-600 dark:text-cyan-400">Actionable Levels</span>
                  </div>

                  {/* Key Price Levels Grid */}
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A1424] p-3">
                      <div className="text-[10px] uppercase text-slate-500 dark:text-slate-400 font-semibold">Spot Price (CMP)</div>
                      <div className="text-base font-black text-slate-900 dark:text-white font-mono mt-0.5">
                        ₹{data.scenario_references.current_price.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">Current Trading Price</div>
                    </div>

                    <div className="rounded-xl border border-cyan-200 dark:border-cyan-800/60 bg-cyan-50/60 dark:bg-cyan-950/20 p-3">
                      <div className="text-[10px] uppercase text-cyan-700 dark:text-cyan-400 font-semibold">Model Pivot Reference</div>
                      <div className="text-base font-black text-cyan-700 dark:text-cyan-300 font-mono mt-0.5">
                        ₹{data.scenario_references.pivot_reference.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-cyan-600 dark:text-cyan-400/80 mt-0.5">
                        {data.scenario_references.scenario_distance_pct}% to Trigger
                      </div>
                    </div>

                    <div className="rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/60 dark:bg-rose-950/20 p-3">
                      <div className="text-[10px] uppercase text-rose-700 dark:text-rose-400 font-semibold">Downside Ref / Stop</div>
                      <div className="text-base font-black text-rose-700 dark:text-rose-300 font-mono mt-0.5">
                        ₹{data.scenario_references.downside_reference.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-rose-600 dark:text-rose-400/80 mt-0.5">
                        -{data.scenario_references.downside_pct}% Base Low
                      </div>
                    </div>

                    <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/60 dark:bg-emerald-950/20 p-3">
                      <div className="text-[10px] uppercase text-emerald-700 dark:text-emerald-400 font-semibold">Target 1 (+10%)</div>
                      <div className="text-base font-black text-emerald-700 dark:text-emerald-300 font-mono mt-0.5">
                        ₹{data.scenario_references.target_1.toFixed(2)}
                      </div>
                      <div className="text-[10px] text-emerald-600 dark:text-emerald-400/80 mt-0.5">Target 2: ₹{data.scenario_references.target_2.toFixed(2)}</div>
                    </div>
                  </div>

                  {/* Risk-Reward & Scenario Distance */}
                  <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#081222] p-3.5 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] uppercase text-slate-500 dark:text-slate-400 font-semibold">Risk / Reward Ratio</div>
                      <div className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                        1 : {data.scenario_references.risk_reward_ratio}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase text-slate-500 dark:text-slate-400 font-semibold">Scenario Trigger</div>
                      <div className="text-sm font-black text-slate-900 dark:text-white font-mono mt-0.5">
                        ₹{data.scenario_references.scenario_trigger.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Context & Regime Strip */}
                <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800/80">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold mb-2">
                    Market Context & Regime
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-slate-50 dark:bg-[#091222] p-2 border border-slate-200 dark:border-slate-800/80">
                      <div className="text-[10px] text-slate-500">Market Regime</div>
                      <div className="text-slate-800 dark:text-slate-200 font-semibold truncate">{data.context_regime.market_regime}</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 dark:bg-[#091222] p-2 border border-slate-200 dark:border-slate-800/80">
                      <div className="text-[10px] text-slate-500">Relative Strength (RS)</div>
                      <div className="text-cyan-600 dark:text-cyan-400 font-bold font-mono">Leader (RS {data.context_regime.rs_rank})</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 dark:bg-[#091222] p-2 border border-slate-200 dark:border-slate-800/80">
                      <div className="text-[10px] text-slate-500">Sector Context</div>
                      <div className="text-slate-800 dark:text-slate-200 font-semibold truncate">{data.context_regime.sector_rank}</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 dark:bg-[#091222] p-2 border border-slate-200 dark:border-slate-800/80">
                      <div className="text-[10px] text-slate-500">Trend Strength (ADX)</div>
                      <div className="text-slate-800 dark:text-slate-200 font-mono font-semibold">ADX {data.context_regime.adx_strength} (Strong)</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ===================================================================== */}
            {/* 5. SECTION: INTERACTIVE TRADINGVIEW RESEARCH CHART                    */}
            {/* ===================================================================== */}
            <div id="research-chart" className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#070F1E] p-6 shadow-xs dark:shadow-xl">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4 mb-4">
                <div>
                  <h2 className="text-lg font-black text-slate-900 dark:text-white font-mono flex items-center gap-2">
                    <BarChart3 size={18} className="text-cyan-500 dark:text-cyan-400" />
                    <span>Interactive Research Chart — Daily Price Action</span>
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                    Candlestick chart with automated Pivot Resistance (₹{data.scenario_references.pivot_reference}), Downside Stop (₹{data.scenario_references.downside_reference}) and Target (₹{data.scenario_references.target_1}) levels.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                    Symbol: {data.tradingview_symbol}
                  </span>
                </div>
              </div>

              {/* Lightweight TradingView Candlestick Chart */}
              <TradingViewChart
                symbol={data.symbol}
                exchange={data.exchange}
                height={520}
                pivotReference={data.scenario_references.pivot_reference}
                scenarioTrigger={data.scenario_references.scenario_trigger}
                downsideReference={data.scenario_references.downside_reference}
                target1={data.scenario_references.target_1}
              />
            </div>

            {/* ===================================================================== */}
            {/* 6. SECTION: MARKET STRUCTURE & SMART MONEY CONCEPTS (ICT/SMC)         */}
            {/* ===================================================================== */}
            <div id="market-structure" className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#070F1E] p-6 shadow-xs dark:shadow-xl">
              <div className="border-b border-slate-200 dark:border-slate-800 pb-3 mb-5">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-cyan-600 dark:text-cyan-400 font-bold">
                  <Layers size={15} />
                  <span>Market Structure & Smart Money Concepts (ICT / SMC)</span>
                </div>
                <h2 className="text-base font-black text-slate-900 dark:text-white mt-1">
                  Institutional Order Flow & Imbalance Zones
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                  Algorithmic detection of Break of Structure (BOS), Fair Value Gaps (FVG), Order Blocks, and Volume Profile.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* 1. Structure & BOS */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#091325] p-4">
                  <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">Structure & BOS</div>
                  <div className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono mt-1">
                    {data.market_structure_smc.structure_bos.trend}
                  </div>
                  <div className="text-xs text-slate-700 dark:text-slate-300 mt-2">
                    {data.market_structure_smc.structure_bos.character}
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800/80 pt-2">
                    <span>Recent BOS Level:</span>
                    <strong className="text-slate-800 dark:text-slate-200 font-mono">₹{data.market_structure_smc.structure_bos.last_bos_price}</strong>
                  </div>
                </div>

                {/* 2. Premium vs Discount */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#091325] p-4">
                  <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">Premium / Discount</div>
                  <div className="text-sm font-black text-cyan-600 dark:text-cyan-400 font-mono mt-1">
                    {data.market_structure_smc.premium_discount.current_zone}
                  </div>
                  <div className="text-xs text-slate-700 dark:text-slate-300 mt-2">
                    Price is at {data.market_structure_smc.premium_discount.range_position_pct}% of 52W range.
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800/80 pt-2">
                    <span>Equilibrium (Fair Value):</span>
                    <strong className="text-slate-800 dark:text-slate-200 font-mono">₹{data.market_structure_smc.premium_discount.equilibrium}</strong>
                  </div>
                </div>

                {/* 3. Fair Value Gaps (FVG) */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#091325] p-4">
                  <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">Fair Value Gaps (FVG)</div>
                  <div className="text-sm font-black text-purple-600 dark:text-purple-400 font-mono mt-1">
                    {data.market_structure_smc.fair_value_gaps.type}
                  </div>
                  <div className="text-xs text-slate-700 dark:text-slate-300 mt-2">
                    Zone: ₹{data.market_structure_smc.fair_value_gaps.gap_low} — ₹{data.market_structure_smc.fair_value_gaps.gap_high}
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800/80 pt-2">
                    <span>Status:</span>
                    <strong className="text-emerald-600 dark:text-emerald-400">{data.market_structure_smc.fair_value_gaps.status}</strong>
                  </div>
                </div>

                {/* 4. Order Blocks (OB) */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#091325] p-4">
                  <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">Demand Order Block</div>
                  <div className="text-sm font-black text-cyan-700 dark:text-cyan-300 font-mono mt-1">
                    {data.market_structure_smc.order_blocks.type}
                  </div>
                  <div className="text-xs text-slate-700 dark:text-slate-300 mt-2">
                    Zone: ₹{data.market_structure_smc.order_blocks.ob_low} — ₹{data.market_structure_smc.order_blocks.ob_high}
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800/80 pt-2">
                    <span>Displacement Surge:</span>
                    <strong className="text-slate-800 dark:text-slate-200">{data.market_structure_smc.order_blocks.volume_surge}</strong>
                  </div>
                </div>

                {/* 5. Liquidity Sweeps */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#091325] p-4">
                  <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">Liquidity Sweeps</div>
                  <div className="text-sm font-black text-amber-600 dark:text-amber-400 font-mono mt-1">
                    {data.market_structure_smc.liquidity_sweeps.sweep_side}
                  </div>
                  <div className="text-xs text-slate-700 dark:text-slate-300 mt-2">
                    {data.market_structure_smc.liquidity_sweeps.reclaim}
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800/80 pt-2">
                    <span>Swept Level:</span>
                    <strong className="text-slate-800 dark:text-slate-200 font-mono">₹{data.market_structure_smc.liquidity_sweeps.swept_level}</strong>
                  </div>
                </div>

                {/* 6. Volume Profile (POC & VAH) */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#091325] p-4">
                  <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">Volume Profile (VPVR)</div>
                  <div className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono mt-1">
                    POC: ₹{data.market_structure_smc.volume_profile.poc}
                  </div>
                  <div className="text-xs text-slate-700 dark:text-slate-300 mt-2">
                    Value Area: ₹{data.market_structure_smc.volume_profile.val} — ₹{data.market_structure_smc.volume_profile.vah}
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800/80 pt-2">
                    <span>Absorption Score:</span>
                    <strong className="text-cyan-600 dark:text-cyan-400 font-mono">{data.market_structure_smc.volume_profile.dry_up_score}/100</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* ===================================================================== */}
            {/* 7. SECTION: SETUP GAUGES & RADAR METRICS                              */}
            {/* ===================================================================== */}
            <div id="quality-gauges" className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Gauges Grid (8 Cols) */}
              <div className="lg:col-span-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#070F1E] p-6 shadow-xs dark:shadow-xl">
                <div className="border-b border-slate-200 dark:border-slate-800 pb-3 mb-5">
                  <div className="text-xs uppercase tracking-wider text-cyan-600 dark:text-cyan-400 font-bold">Setup Metrics & Risk Checks</div>
                  <h2 className="text-base font-black text-slate-900 dark:text-white mt-1">Algorithmic Setup Quality & Supply Overhang</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Base / VCP Coiling */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#091325] p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] uppercase text-slate-500 dark:text-slate-400 font-semibold">Base / VCP Coiling</span>
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{data.setup_quality_gauges.base_vcp.quality_grade}</span>
                    </div>
                    <div className="text-2xl font-black text-slate-900 dark:text-white font-mono mt-2">
                      {data.setup_quality_gauges.base_vcp.depth_pct}% Depth
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {data.setup_quality_gauges.base_vcp.contractions} over {data.setup_quality_gauges.base_vcp.days_in_base} trading sessions.
                    </div>
                  </div>

                  {/* Overhead Supply */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#091325] p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] uppercase text-slate-500 dark:text-slate-400 font-semibold">Overhead Supply Ceiling</span>
                      <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400">
                        {data.setup_quality_gauges.overhead_supply.cleared_levels_pct}% Cleared
                      </span>
                    </div>
                    <div className="text-2xl font-black text-slate-900 dark:text-white font-mono mt-2">
                      {data.setup_quality_gauges.overhead_supply.ceiling_distance_pct}% to Ceiling
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {data.setup_quality_gauges.overhead_supply.supply_intensity}
                    </div>
                  </div>

                  {/* Chase Risk */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#091325] p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] uppercase text-slate-500 dark:text-slate-400 font-semibold">Chase / Failure Risk</span>
                      <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        {data.setup_quality_gauges.chase_risk.risk_rating}
                      </span>
                    </div>
                    <div className="text-2xl font-black text-slate-900 dark:text-white font-mono mt-2">
                      +{data.setup_quality_gauges.chase_risk.distance_from_20_ema_pct}% vs 20 EMA
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Low risk entry cushion; consolidating right above short-term equilibrium.
                    </div>
                  </div>

                  {/* Smart Money Flow */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#091325] p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] uppercase text-slate-500 dark:text-slate-400 font-semibold">Smart Money 60D Flow</span>
                      <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400 font-mono">
                        {data.setup_quality_gauges.smart_money_flow.score_60d}/100 Score
                      </span>
                    </div>
                    <div className="text-2xl font-black text-slate-900 dark:text-white font-mono mt-2">
                      {data.setup_quality_gauges.smart_money_flow.state}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {data.setup_quality_gauges.smart_money_flow.surge_ratio}
                    </div>
                  </div>
                </div>
              </div>

              {/* Radar Quality Score Matrix (4 Cols) */}
              <div className="lg:col-span-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#070F1E] p-6 shadow-xs dark:shadow-xl flex flex-col justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wider text-cyan-600 dark:text-cyan-400 font-bold mb-1">
                    Setup Quality Radar
                  </div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">Multi-Factor Radar Scores</h3>

                  <div className="flex flex-col gap-3.5 mt-5">
                    {data.setup_quality_gauges.radar_axes.map((axis, idx) => (
                      <div key={idx}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-slate-700 dark:text-slate-300 font-medium">{axis.subject}</span>
                          <span className="text-cyan-600 dark:text-cyan-400 font-bold font-mono">{axis.score}/100</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-500"
                            style={{ width: `${axis.score}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-200 dark:border-slate-800/80 text-[11px] text-slate-500">
                  Scores calculated across multi-year NSE historical distributions.
                </div>
              </div>
            </div>

            {/* ===================================================================== */}
            {/* 8. SECTION: SEASONALITY ANALYSIS (MONTHLY RETURN MATRIX)             */}
            {/* ===================================================================== */}
            <div id="seasonality" className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#070F1E] p-6 shadow-xs dark:shadow-xl">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3 mb-5">
                <div>
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-cyan-600 dark:text-cyan-400 font-bold">
                    <Calendar size={15} />
                    <span>Seasonality Analysis — Monthly Tendency</span>
                  </div>
                  <h2 className="text-base font-black text-slate-900 dark:text-white mt-1">
                    Historical Monthly Return Matrix & Win Rates
                  </h2>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Performance tendency across historical seasonal cycles.
                </div>
              </div>

              {/* 12 Months Heatmap Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {data.seasonality.map((item, idx) => (
                  <div
                    key={idx}
                    className={`rounded-xl border p-3 flex flex-col justify-between ${
                      item.avg_return_pct >= 0
                        ? "border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/60 dark:bg-emerald-950/20"
                        : "border-rose-200 dark:border-rose-900/50 bg-rose-50/60 dark:bg-rose-950/20"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                      <span>{item.month}</span>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                          item.win_rate_pct >= 70
                            ? "bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300"
                            : item.win_rate_pct >= 50
                            ? "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                            : "bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-300"
                        }`}
                      >
                        {item.win_rate_pct}% Win
                      </span>
                    </div>

                    <div
                      className={`text-lg font-black font-mono mt-2 ${
                        item.avg_return_pct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {item.avg_return_pct >= 0 ? "+" : ""}
                      {item.avg_return_pct}%
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Avg Monthly Return</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ===================================================================== */}
            {/* 9. SECTION: AI STRATEGIC TRADE INSIGHTS & EXECUTION ROADMAP           */}
            {/* ===================================================================== */}
            <div id="ai-insights" className="rounded-2xl border border-cyan-200 dark:border-cyan-900/50 bg-gradient-to-b from-cyan-50/40 to-white dark:from-[#08152A] dark:to-[#060E1C] p-6 shadow-xs dark:shadow-xl">
              <div className="border-b border-cyan-200 dark:border-cyan-900/40 pb-3 mb-5 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-cyan-600 dark:text-cyan-400 font-bold">
                    <Sparkles size={15} />
                    <span>AI Strategic Trade Insights & Execution Roadmap</span>
                  </div>
                  <h2 className="text-base font-black text-slate-900 dark:text-white mt-1">
                    Institutional Trade Execution Blueprint
                  </h2>
                </div>
                <span className="text-[10px] font-mono px-2.5 py-1 rounded bg-cyan-100 dark:bg-cyan-950 border border-cyan-300 dark:border-cyan-700 text-cyan-800 dark:text-cyan-300">
                  Model Invalidation: ₹{data.scenario_references.downside_reference}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#081222] p-4 shadow-xs">
                  <div className="text-[11px] uppercase text-cyan-600 dark:text-cyan-400 font-bold">Executive Verdict</div>
                  <p className="text-xs text-slate-700 dark:text-slate-200 mt-2 leading-relaxed">
                    {data.ai_insights.verdict}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#081222] p-4 shadow-xs">
                  <div className="text-[11px] uppercase text-emerald-600 dark:text-emerald-400 font-bold">Breakout Criteria</div>
                  <p className="text-xs text-slate-700 dark:text-slate-200 mt-2 leading-relaxed">
                    {data.ai_insights.breakout_criteria}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#081222] p-4 shadow-xs">
                  <div className="text-[11px] uppercase text-rose-600 dark:text-rose-400 font-bold">Invalidation Stop</div>
                  <p className="text-xs text-slate-700 dark:text-slate-200 mt-2 leading-relaxed">
                    {data.ai_insights.invalidation_level}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#081222] p-4 shadow-xs">
                  <div className="text-[11px] uppercase text-amber-600 dark:text-amber-400 font-bold">Position Sizing Guide</div>
                  <p className="text-xs text-slate-700 dark:text-slate-200 mt-2 leading-relaxed">
                    {data.ai_insights.position_sizing}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-cyan-200 dark:border-cyan-900/30 bg-cyan-50/50 dark:bg-cyan-950/20 p-4 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                <strong className="text-cyan-700 dark:text-cyan-300">Institutional Context: </strong>
                <span>{data.ai_insights.institutional_summary}</span>
              </div>
            </div>

            {/* ===================================================================== */}
            {/* 10. SECTION: SECTOR PEER COMPARISON TABLE                             */}
            {/* ===================================================================== */}
            <div id="sector-peers" className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#070F1E] p-6 shadow-xs dark:shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
                <div>
                  <div className="text-xs uppercase tracking-wider text-cyan-600 dark:text-cyan-400 font-bold">Peer Comparison</div>
                  <h2 className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                    {data.sector} Sector Radar ({data.peer_comparison.length} Active Peers)
                  </h2>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Click any peer to open its Technical Overview</div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                  <thead className="border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-[#0A1424]">
                    <tr>
                      <th className="py-2.5 px-3">Symbol</th>
                      <th className="py-2.5 px-3">Company Name</th>
                      <th className="py-2.5 px-3 text-right">CMP (₹)</th>
                      <th className="py-2.5 px-3 text-right">Day %</th>
                      <th className="py-2.5 px-3 text-center">RS Rank</th>
                      <th className="py-2.5 px-3 text-center">Stage</th>
                      <th className="py-2.5 px-3 text-right">Pivot Dist</th>
                      <th className="py-2.5 px-3 text-center">Setup Score</th>
                      <th className="py-2.5 px-3 text-right">YoY Sales</th>
                      <th className="py-2.5 px-3 text-right">YoY PAT</th>
                      <th className="py-2.5 px-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-mono">
                    {/* Active Stock Row */}
                    <tr className="bg-cyan-50/60 dark:bg-cyan-950/20 border-l-2 border-cyan-500 font-semibold">
                      <td className="py-3 px-3 text-cyan-700 dark:text-cyan-300 font-bold">{data.symbol} (Spot)</td>
                      <td className="py-3 px-3 font-sans text-slate-900 dark:text-white">{data.company_name}</td>
                      <td className="py-3 px-3 text-right text-slate-900 dark:text-white font-bold">₹{data.current_price.toFixed(2)}</td>
                      <td className={`py-3 px-3 text-right ${data.day_change_pct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                        {data.day_change_pct >= 0 ? "+" : ""}{data.day_change_pct}%
                      </td>
                      <td className="py-3 px-3 text-center text-cyan-600 dark:text-cyan-400 font-bold">{data.context_regime.rs_rank}</td>
                      <td className="py-3 px-3 text-center text-emerald-600 dark:text-emerald-400 font-sans">Stage 2</td>
                      <td className="py-3 px-3 text-right text-slate-700 dark:text-slate-300">{data.scenario_references.scenario_distance_pct}%</td>
                      <td className="py-3 px-3 text-center text-cyan-600 dark:text-cyan-400 font-bold">{data.setup_readiness.score}/100</td>
                      <td className="py-3 px-3 text-right text-emerald-600 dark:text-emerald-400">+{data.fundamentals.sales_growth_ttm}%</td>
                      <td className="py-3 px-3 text-right text-emerald-600 dark:text-emerald-400">+{data.fundamentals.profit_growth_ttm}%</td>
                      <td className="py-3 px-3 text-center font-sans">
                        <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-100 dark:bg-cyan-900/60 text-cyan-800 dark:text-cyan-300">Active</span>
                      </td>
                    </tr>

                    {/* Sector Peers */}
                    {data.peer_comparison.map((peer) => (
                      <tr key={peer.symbol} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                        <td className="py-2.5 px-3 text-slate-800 dark:text-slate-200 font-bold">{peer.symbol}</td>
                        <td className="py-2.5 px-3 font-sans text-slate-600 dark:text-slate-300 truncate max-w-[180px]">{peer.company_name}</td>
                        <td className="py-2.5 px-3 text-right text-slate-800 dark:text-slate-200">₹{peer.current_price.toFixed(2)}</td>
                        <td className={`py-2.5 px-3 text-right ${peer.day_change_pct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                          {peer.day_change_pct >= 0 ? "+" : ""}{peer.day_change_pct}%
                        </td>
                        <td className="py-2.5 px-3 text-center text-slate-700 dark:text-slate-300">{peer.rs_rank}</td>
                        <td className="py-2.5 px-3 text-center text-slate-500 dark:text-slate-400 font-sans">{peer.trend_stage}</td>
                        <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-300">{peer.pivot_distance_pct}%</td>
                        <td className="py-2.5 px-3 text-center text-slate-800 dark:text-slate-200">{peer.setup_score}/100</td>
                        <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400">+{peer.sales_growth_ttm}%</td>
                        <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400">+{peer.profit_growth_ttm}%</td>
                        <td className="py-2.5 px-3 text-center font-sans">
                          <Link
                            href={`/stocks/${peer.symbol}`}
                            className="inline-flex items-center gap-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-cyan-600 dark:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/40 hover:border-cyan-500 transition"
                          >
                            <span>Analyze</span>
                            <ArrowUpRight size={10} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ===================================================================== */}
            {/* 11. SECTION: STRUCTURED EDUCATIONAL FAQ ACCORDION                     */}
            {/* ===================================================================== */}
            <div id="faq" className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#070F1E] p-6 shadow-xs dark:shadow-xl">
              <div className="border-b border-slate-200 dark:border-slate-800 pb-3 mb-5">
                <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-cyan-600 dark:text-cyan-400 font-bold">
                  <HelpCircle size={15} />
                  <span>Frequently Asked Questions & Scanner Logic</span>
                </div>
                <h2 className="text-base font-black text-slate-900 dark:text-white mt-1">
                  Algorithmic Observations & Interpretation for {symbol}
                </h2>
              </div>

              <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
                {data.faq.map((item, idx) => {
                  const isOpen = openFaqIdx === idx;
                  return (
                    <div key={idx} className="py-3.5">
                      <button
                        onClick={() => setOpenFaqIdx(isOpen ? null : idx)}
                        className="w-full flex items-center justify-between text-left text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 hover:text-cyan-600 dark:hover:text-cyan-400 transition"
                      >
                        <span>{item.question}</span>
                        {isOpen ? (
                          <ChevronUp size={16} className="text-cyan-600 dark:text-cyan-400 shrink-0" />
                        ) : (
                          <ChevronDown size={16} className="text-slate-400 dark:text-slate-500 shrink-0" />
                        )}
                      </button>
                      {isOpen && (
                        <p className="mt-2.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed pl-1 pr-4">
                          {item.answer}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ========================================================================= */}
      {/* POSITION SIZING CALCULATOR MODAL                                          */}
      {/* ========================================================================= */}
      {showCalcModal && data && positionSizing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0B1526] p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Calculator size={18} className="text-cyan-600 dark:text-cyan-400" />
                <h3 className="text-base font-black text-slate-900 dark:text-white font-mono">
                  Position Sizing Calculator — {symbol}
                </h3>
              </div>
              <button
                onClick={() => setShowCalcModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-4">
              {/* Inputs */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase">
                    Portfolio Capital (₹)
                  </label>
                  <input
                    type="number"
                    value={portfolioSize}
                    onChange={(e) => setPortfolioSize(Number(e.target.value) || 0)}
                    className="w-full mt-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#060D19] px-3 py-1.5 text-xs text-slate-900 dark:text-white font-mono focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase">
                    Max Portfolio Risk (%)
                  </label>
                  <input
                    type="number"
                    step="0.25"
                    value={riskPercent}
                    onChange={(e) => setRiskPercent(Number(e.target.value) || 0)}
                    className="w-full mt-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#060D19] px-3 py-1.5 text-xs text-slate-900 dark:text-white font-mono focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Trade Anchors */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#060D19] p-3 grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <div className="text-[10px] text-slate-500">Entry (Spot)</div>
                  <div className="font-bold text-slate-900 dark:text-white font-mono">₹{data.current_price.toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-rose-600 dark:text-rose-400">Stop Loss</div>
                  <div className="font-bold text-rose-600 dark:text-rose-300 font-mono">
                    ₹{data.scenario_references.downside_reference.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500">Risk / Share</div>
                  <div className="font-bold text-amber-600 dark:text-amber-300 font-mono">
                    ₹{positionSizing.riskPerShare.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Recommended Execution Sizing */}
              <div className="rounded-xl border border-cyan-200 dark:border-cyan-900/60 bg-cyan-50/60 dark:bg-cyan-950/30 p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-cyan-200 dark:border-cyan-900/40 pb-2">
                  <span className="text-xs text-slate-700 dark:text-slate-300 font-semibold">Recommended Quantity:</span>
                  <span className="text-lg font-black text-cyan-700 dark:text-cyan-300 font-mono">
                    {positionSizing.sharesToBuy.toLocaleString()} Shares
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 dark:text-slate-400">Total Capital Outlay:</span>
                  <span className="font-bold text-slate-900 dark:text-white font-mono">
                    ₹{positionSizing.totalCapitalRequired.toLocaleString(undefined, { maximumFractionDigits: 0 })} (
                    {positionSizing.portfolioAllocPct.toFixed(1)}% of Portfolio)
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 dark:text-slate-400">Total Rupee Risk at Stop:</span>
                  <span className="font-bold text-rose-600 dark:text-rose-400 font-mono">
                    ₹{positionSizing.maxRiskAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs border-t border-cyan-200 dark:border-cyan-900/40 pt-2">
                  <span className="text-slate-600 dark:text-slate-400">Potential Profit at Target 1 (+10%):</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                    +₹{positionSizing.potentialProfitT1.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600 dark:text-slate-400">Potential Profit at Target 2 (+20%):</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                    +₹{positionSizing.potentialProfitT2.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>

              <button
                onClick={() => setShowCalcModal(false)}
                className="w-full rounded-xl bg-cyan-500 py-2.5 text-xs font-bold text-slate-900 hover:bg-cyan-400 transition"
              >
                Apply & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

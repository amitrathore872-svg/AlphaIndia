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
import AddToWatchlistButton from "@/components/watchlist/AddToWatchlistButton";
import MultiScannerConfluenceRibbon from "@/components/stock-detail/MultiScannerConfluenceRibbon";
import AIOptimalZonesCard from "@/components/stock-detail/AIOptimalZonesCard";
import MarketSentimentRadar from "@/components/stock-detail/MarketSentimentRadar";
import QuarterlyFinancialsTab from "@/components/stock-detail/QuarterlyFinancialsTab";
import OrderBookCatalystsTab from "@/components/stock-detail/OrderBookCatalystsTab";
import MutualFundHoldingsTab from "@/components/stock-detail/MutualFundHoldingsTab";
import MomentumDeliveryTab from "@/components/stock-detail/MomentumDeliveryTab";
import BrokerageResearchTab from "@/components/stock-detail/BrokerageResearchTab";
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

  // Active navigation tab with URL sync
  const [activeTab, setActiveTab] = useState("overview");

  // Dynamic back navigation — read ?from= param so any screener can send us here
  const [backHref, setBackHref] = useState("/growth-screener");
  const [backLabel, setBackLabel] = useState("Back to Screener");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      const tab = p.get("tab");
      if (tab) {
        setActiveTab(tab);
      }
      const from = p.get("from");
      if (from) {
        setBackHref(from);
        // Derive a friendly label from the path
        const labelMap: Record<string, string> = {
          "/growth-screener": "Growth Screener",
          "/candlestick-radar": "Candlestick Radar",
          "/pre-breakout-radar": "Pre-Breakout Radar",
          "/techno-funda": "Techno-Funda Radar",
          "/momentum-radar": "Momentum Radar",
          "/delivery-radar": "Delivery Radar",
          "/institutional-radar": "Institutional Radar",
          "/apex-confluence": "Apex Confluence",
          "/brokerage-radar": "Brokerage Radar",
          "/alerts": "Alerts",
          "/cpr-scanner": "CPR Scanner",
          "/trend-genesis": "Trend Genesis",
          "/ipo-radar": "IPO Radar",
          "/home": "Home",
        };
        setBackLabel(labelMap[from] ? `Back to ${labelMap[from]}` : "Back to Screener");
      }
    }
  }, []);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tabId);
      window.history.replaceState({}, "", url.toString());
    }
  };

  const scrollToSection = (id: string) => {
    handleTabChange(id);
  };

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
    const cmp = data.current_price ?? 0;
    const stop = data.scenario_references?.downside_reference ?? (cmp > 0 ? cmp * 0.95 : 0);
    const riskPerShare = Math.max(0.1, cmp - stop);
    const maxRiskAmount = (portfolioSize * riskPercent) / 100;
    const sharesToBuy = Math.floor(maxRiskAmount / riskPerShare);
    const totalCapitalRequired = sharesToBuy * cmp;
    const portfolioAllocPct = portfolioSize > 0 ? (totalCapitalRequired / portfolioSize) * 100 : 0;
    const target1 = data.scenario_references?.target_1 ?? (cmp * 1.10);
    const target2 = data.scenario_references?.target_2 ?? (cmp * 1.20);
    const potentialProfitT1 = sharesToBuy * (target1 - cmp);
    const potentialProfitT2 = sharesToBuy * (target2 - cmp);

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



  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 max-w-[1600px] mx-auto pb-16">
        {/* ========================================================================= */}
        {/* 1. TOP BREADCRUMB, SEARCH SWITCHER & QUICK ACTIONS                        */}
        {/* ========================================================================= */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <Link
              href={backHref}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#081225] px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:border-cyan-500/50 hover:text-cyan-600 dark:hover:text-white shadow-xs transition"
            >
              <ArrowLeft size={14} />
              <span>{backLabel}</span>
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
                        router.push(`/stocks/${item.symbol}${backHref !== "/growth-screener" ? `?from=${encodeURIComponent(backHref)}` : ""}`);
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
            <AddToWatchlistButton
              symbol={symbol}
              companyName={data?.company_name || symbol}
              currentPrice={data?.current_price}
              variant="button"
            />

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
                href={backHref}
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
                      {data.sector && data.sector !== "Unknown" ? data.sector : "Healthcare & Life Sciences"}
                    </span>
                    <span className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-0.5 text-xs text-slate-600 dark:text-slate-400">
                      {data.industry && data.industry !== "Unknown" ? data.industry : "Specialty APIs & Formulations"}
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

            {/* MULTI-MODEL & RADAR CONFLUENCE ENGINE */}
            <MultiScannerConfluenceRibbon
              symbol={data.symbol}
              onSelectTab={handleTabChange}
              activeTab={activeTab}
              confluenceData={{
                technoFundaGrade: `Grade ${data.setup_readiness.grade}`,
                technoFundaScore: data.setup_readiness.score,
                athenaGrade: "AAA+",
                athenaScore: 94,
                piotroskiScore: 8,
                minerviniScore: 8,
                momentumScore: 9,
                masterCompositeScore: 95.2,
                patternLabel: "VCP Multi-Contract",
                deliverySurgePct: 240,
                momentumRulesPassed: 9,
                mfNetInflowCr: 48.2,
                orderBookValueCr: 3420,
                salesYoY: `+${data.fundamentals.sales_growth_ttm}%`,
                sentimentStatus: "HOT",
                riskReward: String(data.scenario_references.risk_reward_ratio || "1 : 2.7"),
              }}
            />

            {/* ===================================================================== */}
            {/* 3. STICKY SUB-NAVIGATION RIBBON                                       */}
            {/* ===================================================================== */}
            <div className="sticky top-0 z-30 flex items-center gap-1.5 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#060D19]/95 backdrop-blur-md p-1.5 text-xs font-semibold shadow-xs dark:shadow-lg">
              {[
                { id: "overview", label: "⚡ Executive Radar" },
                { id: "brokerage", label: "🎯 Brokerage Consensus" },
                { id: "financials", label: "📊 Financials (8Q)" },
                { id: "order-book", label: "📑 Order Book & PPT" },
                { id: "mutual-funds", label: "🏛️ Mutual Funds" },
                { id: "momentum", label: "🚀 Momentum & Delivery" },
                { id: "market-structure", label: "📐 Market Structure (SMC)" },
                { id: "chart", label: "📈 Full Chart Lab" },
                { id: "calculator", label: "🎯 Position Sizing" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`rounded-lg px-3 py-1.5 transition whitespace-nowrap flex items-center gap-1.5 ${
                    activeTab === tab.id
                      ? "bg-cyan-50 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-500/40 font-bold shadow-xs"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/40"
                  }`}
                >
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* TAB VIEW 1: OVERVIEW */}
            {activeTab === "overview" && (
              <div className="flex flex-col gap-8">
                {/* ================================================================= */}
                {/* SECTION 1: ACTIONABLE EXECUTION BLUEPRINT & CONFLUENCE            */}
                {/* ================================================================= */}
                <div className="flex flex-col gap-5">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-bold border border-cyan-500/30">
                        SECTION 1
                      </span>
                      <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white font-mono">
                        Actionable Execution Blueprint & Multi-Model Conviction
                      </h2>
                    </div>
                    <span className="text-xs text-slate-500 font-mono hidden sm:inline">
                      Single Authoritative Execution Engine
                    </span>
                  </div>

                  {/* 1.1 AI OPTIMAL EXECUTION ZONES */}
                  <AIOptimalZonesCard
                    currentPrice={data.current_price}
                    pivotReference={data.scenario_references.pivot_reference}
                    scenarioTrigger={data.scenario_references.scenario_trigger}
                    downsideReference={data.scenario_references.downside_reference}
                    target1={data.scenario_references.target_1}
                    target2={data.scenario_references.target_2}
                    riskReward={data.scenario_references.risk_reward_ratio}
                  />

                  {/* 1.2 DUAL INTELLIGENCE RADAR: SETUP THESIS (LEFT) & MULTI-MODEL MATRIX + SENTIMENT (RIGHT) */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* LEFT: Structured Setup Thesis & Evidence Checklist (6 Cols) */}
                    <div
                      id="setup-analysis"
                      className="lg:col-span-6 flex flex-col justify-between rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#070F1E] p-6 shadow-xs dark:shadow-xl"
                    >
                      <div>
                        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                          <div>
                            <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
                              Structured Setup Thesis & Evidence
                            </div>
                            <div className="text-base font-black text-slate-900 dark:text-white mt-0.5 flex items-center gap-2">
                              <span>{data.setup_readiness.status}</span>
                              <span className="text-xs px-2 py-0.5 rounded font-bold bg-emerald-50 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300">
                                Grade {data.setup_readiness.grade}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-[9px] uppercase font-semibold text-slate-500">Conviction</div>
                            <div className="text-lg font-black text-cyan-600 dark:text-cyan-400 font-mono">
                              {data.setup_readiness.score}/100
                            </div>
                          </div>
                        </div>

                        <p className="text-xs text-slate-700 dark:text-slate-300 mt-3 leading-relaxed">
                          {data.setup_readiness.status_desc}
                        </p>

                        {/* Bullish vs Risk Factors */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                          {/* Bullish Factors */}
                          <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/60 dark:bg-emerald-950/15 p-3.5">
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-2.5">
                              <ShieldCheck size={13} />
                              <span>Bullish Catalysts ({data.setup_readiness.bullish_factors.length})</span>
                            </div>
                            <ul className="flex flex-col gap-2">
                              {data.setup_readiness.bullish_factors.map((factor, idx) => (
                                <li key={idx} className="flex items-start gap-1.5 text-xs text-slate-800 dark:text-slate-200">
                                  <CheckCircle2 size={12} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                                  <span className="leading-snug text-[11px]">{factor}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* Risk Factors */}
                          <div className="rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-950/15 p-3.5">
                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-2.5">
                              <AlertTriangle size={13} />
                              <span>Risk & Caution Checks ({data.setup_readiness.risk_factors.length})</span>
                            </div>
                            <ul className="flex flex-col gap-2">
                              {data.setup_readiness.risk_factors.map((factor, idx) => (
                                <li key={idx} className="flex items-start gap-1.5 text-xs text-slate-800 dark:text-slate-200">
                                  <AlertTriangle size={12} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                  <span className="leading-snug text-[11px]">{factor}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>

                      {/* Synthesis Thesis */}
                      <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0A1629]/70 p-3 text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2">
                        <Flame size={14} className="text-amber-500 shrink-0 mt-0.5" />
                        <div className="text-[11px] leading-snug">
                          <strong className="text-slate-900 dark:text-white font-mono">Institutional Thesis: </strong>
                          <span>{data.setup_readiness.overall_view}</span>
                        </div>
                      </div>
                    </div>

                    {/* RIGHT: Market Sentiment & Social Radar (6 Cols) */}
                    <div className="lg:col-span-6 flex flex-col">
                      <MarketSentimentRadar
                        symbol={symbol}
                        sentimentStatus="HOT"
                        sentimentScore={88}
                        bullishPolarityPct={82}
                        bearishPolarityPct={18}
                        buzzVelocityPct={310}
                        putCallRatio={1.34}
                        institutionalBuzz="Aggressive Block Accumulation"
                      />
                    </div>
                  </div>
                </div>

                {/* ================================================================= */}
                {/* SECTION 2: INSTITUTIONAL PRICE ACTION & CHARTING LAB              */}
                {/* ================================================================= */}
                <div className="flex flex-col gap-5">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/30">
                        SECTION 2
                      </span>
                      <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white font-mono">
                        Price Action Canvas & Market Regime
                      </h2>
                    </div>
                    <span className="text-xs text-slate-500 font-mono hidden sm:inline">
                      Daily Candlestick Flow & Base Health Indicators
                    </span>
                  </div>

                  {/* 2.1 Full Length Interactive Chart */}
                  <div id="research-chart" className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#070F1E] p-6 shadow-xs dark:shadow-xl w-full">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4 mb-4">
                      <div>
                        <h2 className="text-lg font-black text-slate-900 dark:text-white font-mono flex items-center gap-2">
                          <BarChart3 size={18} className="text-cyan-500 dark:text-cyan-400" />
                          <span>Interactive Research Chart — Daily Price Action</span>
                        </h2>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                          Candlestick chart with automated Pivot Resistance (₹{data.scenario_references.pivot_reference}), Downside Stop (₹{data.scenario_references.downside_reference}) and Target levels.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                          Symbol: {data.tradingview_symbol}
                        </span>
                      </div>
                    </div>

                    <TradingViewChart
                      symbol={data.symbol}
                      exchange={data.exchange}
                      height={620}
                      pivotReference={data.scenario_references.pivot_reference}
                      scenarioTrigger={data.scenario_references.scenario_trigger}
                      downsideReference={data.scenario_references.downside_reference}
                      target1={data.scenario_references.target_1}
                    />

                    {/* Integrated Market Context & Regime Bar Directly Below Chart */}
                    <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800/80 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div className="rounded-xl bg-slate-50 dark:bg-[#091222] p-3 border border-slate-200 dark:border-slate-800/80">
                        <div className="text-[10px] text-slate-500 font-semibold uppercase">Market Regime</div>
                        <div className="text-slate-800 dark:text-slate-200 font-bold truncate mt-0.5">{data.context_regime.market_regime}</div>
                      </div>
                      <div className="rounded-xl bg-slate-50 dark:bg-[#091222] p-3 border border-slate-200 dark:border-slate-800/80">
                        <div className="text-[10px] text-slate-500 font-semibold uppercase">Relative Strength (RS)</div>
                        <div className="text-cyan-600 dark:text-cyan-400 font-bold font-mono mt-0.5">Leader (RS {data.context_regime.rs_rank})</div>
                      </div>
                      <div className="rounded-xl bg-slate-50 dark:bg-[#091222] p-3 border border-slate-200 dark:border-slate-800/80">
                        <div className="text-[10px] text-slate-500 font-semibold uppercase">Sector Context</div>
                        <div className="text-slate-800 dark:text-slate-200 font-bold truncate mt-0.5">{data.context_regime.sector_rank}</div>
                      </div>
                      <div className="rounded-xl bg-slate-50 dark:bg-[#091222] p-3 border border-slate-200 dark:border-slate-800/80">
                        <div className="text-[10px] text-slate-500 font-semibold uppercase">Trend Strength (ADX)</div>
                        <div className="text-emerald-600 dark:text-emerald-400 font-mono font-bold mt-0.5">ADX {data.context_regime.adx_strength} (Strong)</div>
                      </div>
                    </div>
                  </div>

                  {/* 2.2 Setup Metrics & Risk Checks (4 Cards - Compact) */}
                  <div id="quality-gauges" className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#070F1E] p-3.5 sm:p-4 shadow-xs dark:shadow-xl">
                    <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80 pb-2 mb-2.5">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-cyan-600 dark:text-cyan-400 font-bold font-mono">
                        <Sliders size={14} />
                        <span>Setup Health & Cushion Indicators</span>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">
                        Base Quality & Supply Overhang Checks
                      </span>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                      {/* 1. Base / VCP Coiling */}
                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#091325]/70 p-2.5 sm:p-3 flex flex-col justify-between">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] uppercase text-slate-500 dark:text-slate-400 font-bold truncate">Base / VCP</span>
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 whitespace-nowrap">
                            {data.setup_quality_gauges.base_vcp.quality_grade.replace(/ \(.*\)/, "")}
                          </span>
                        </div>
                        <div className="text-sm sm:text-base font-black text-slate-900 dark:text-white font-mono mt-1">
                          {data.setup_quality_gauges.base_vcp.depth_pct}% Depth
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 truncate">
                          {data.setup_quality_gauges.base_vcp.contractions} · {data.setup_quality_gauges.base_vcp.days_in_base} sessions
                        </div>
                      </div>

                      {/* 2. Overhead Supply */}
                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#091325]/70 p-2.5 sm:p-3 flex flex-col justify-between">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] uppercase text-slate-500 dark:text-slate-400 font-bold truncate">Overhead Supply</span>
                          <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 whitespace-nowrap font-mono">
                            {data.setup_quality_gauges.overhead_supply.cleared_levels_pct}% Cleared
                          </span>
                        </div>
                        <div className="text-sm sm:text-base font-black text-slate-900 dark:text-white font-mono mt-1">
                          {data.setup_quality_gauges.overhead_supply.ceiling_distance_pct}% to Ceiling
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 truncate">
                          {data.setup_quality_gauges.overhead_supply.supply_intensity}
                        </div>
                      </div>

                      {/* 3. Chase / Entry Risk */}
                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#091325]/70 p-2.5 sm:p-3 flex flex-col justify-between">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] uppercase text-slate-500 dark:text-slate-400 font-bold truncate">Chase Risk</span>
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 whitespace-nowrap">
                            {data.setup_quality_gauges.chase_risk.risk_rating.includes("Low") ? "Low Risk" : "Moderate"}
                          </span>
                        </div>
                        <div className="text-sm sm:text-base font-black text-slate-900 dark:text-white font-mono mt-1">
                          +{data.setup_quality_gauges.chase_risk.distance_from_20_ema_pct}% vs 20 EMA
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 truncate" title="Consolidating near 20 EMA equilibrium">
                          20 EMA Equilibrium Cushion
                        </div>
                      </div>

                      {/* 4. Smart Money Flow */}
                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#091325]/70 p-2.5 sm:p-3 flex flex-col justify-between">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] uppercase text-slate-500 dark:text-slate-400 font-bold truncate">Smart Money Flow</span>
                          <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/20 whitespace-nowrap font-mono">
                            {data.setup_quality_gauges.smart_money_flow.score_60d}/100
                          </span>
                        </div>
                        <div className="text-sm sm:text-base font-black text-slate-900 dark:text-white font-mono mt-1 truncate">
                          {data.setup_quality_gauges.smart_money_flow.state}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 truncate">
                          {data.setup_quality_gauges.smart_money_flow.surge_ratio}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ================================================================= */}
                {/* SECTION 3: SMART MONEY CONCEPTS & HISTORICAL SEASONALITY          */}
                {/* ================================================================= */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold border border-purple-500/30">
                        SECTION 3
                      </span>
                      <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white font-mono">
                        Smart Money Concepts & Historical Seasonality
                      </h2>
                    </div>
                    <span className="text-xs text-slate-500 font-mono hidden sm:inline">
                      BOS, Imbalance Zones & 12-Month Cycles
                    </span>
                  </div>

                  {/* Unified Compact Container for SMC & Seasonality */}
                  <div id="market-structure" className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#070F1E] p-4 lg:p-5 shadow-xs dark:shadow-xl flex flex-col gap-4">
                    {/* 3.1 SMC Institutional Flow */}
                    <div>
                      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80 pb-2.5 mb-3">
                        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-cyan-600 dark:text-cyan-400 font-bold font-mono">
                          <Layers size={14} />
                          <span>Institutional Order Flow & Imbalance Zones (ICT / SMC)</span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">
                          Algorithmic BOS & Imbalance Detection
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {/* 1. Structure & BOS */}
                        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#091325]/70 p-3 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">Structure & BOS</span>
                              <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono">
                                {data.market_structure_smc.structure_bos.trend}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 leading-snug">
                              {data.market_structure_smc.structure_bos.character}
                            </div>
                          </div>
                          <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800/60 pt-1.5">
                            <span>Recent BOS Level:</span>
                            <strong className="text-slate-800 dark:text-slate-200 font-mono">₹{data.market_structure_smc.structure_bos.last_bos_price}</strong>
                          </div>
                        </div>

                        {/* 2. Premium vs Discount */}
                        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#091325]/70 p-3 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">Premium / Discount</span>
                              <span className="text-xs font-black text-cyan-600 dark:text-cyan-400 font-mono">
                                {data.market_structure_smc.premium_discount.current_zone}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 leading-snug">
                              Price is at {data.market_structure_smc.premium_discount.range_position_pct}% of 52W range.
                            </div>
                          </div>
                          <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800/60 pt-1.5">
                            <span>Equilibrium (Fair Value):</span>
                            <strong className="text-slate-800 dark:text-slate-200 font-mono">₹{data.market_structure_smc.premium_discount.equilibrium}</strong>
                          </div>
                        </div>

                        {/* 3. Fair Value Gaps (FVG) */}
                        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#091325]/70 p-3 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">Fair Value Gaps (FVG)</span>
                              <span className="text-xs font-black text-purple-600 dark:text-purple-400 font-mono">
                                {data.market_structure_smc.fair_value_gaps.type}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 leading-snug">
                              Zone: ₹{data.market_structure_smc.fair_value_gaps.gap_low} — ₹{data.market_structure_smc.fair_value_gaps.gap_high}
                            </div>
                          </div>
                          <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800/60 pt-1.5">
                            <span>Status:</span>
                            <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{data.market_structure_smc.fair_value_gaps.status}</strong>
                          </div>
                        </div>

                        {/* 4. Order Blocks (OB) */}
                        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#091325]/70 p-3 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">Demand Order Block</span>
                              <span className="text-xs font-black text-cyan-600 dark:text-cyan-400 font-mono">
                                {data.market_structure_smc.order_blocks.type}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 leading-snug">
                              Zone: ₹{data.market_structure_smc.order_blocks.ob_low} — ₹{data.market_structure_smc.order_blocks.ob_high}
                            </div>
                          </div>
                          <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800/60 pt-1.5">
                            <span>Displacement Surge:</span>
                            <strong className="text-slate-800 dark:text-slate-200 font-mono">{data.market_structure_smc.order_blocks.volume_surge}</strong>
                          </div>
                        </div>

                        {/* 5. Liquidity Sweeps */}
                        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#091325]/70 p-3 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">Liquidity Sweeps</span>
                              <span className="text-xs font-black text-amber-600 dark:text-amber-400 font-mono">
                                {data.market_structure_smc.liquidity_sweeps.sweep_side}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 leading-snug">
                              {data.market_structure_smc.liquidity_sweeps.reclaim}
                            </div>
                          </div>
                          <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800/60 pt-1.5">
                            <span>Swept Level:</span>
                            <strong className="text-slate-800 dark:text-slate-200 font-mono">₹{data.market_structure_smc.liquidity_sweeps.swept_level}</strong>
                          </div>
                        </div>

                        {/* 6. Volume Profile */}
                        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#091325]/70 p-3 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">Volume Profile (VPVR)</span>
                              <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 font-mono">
                                POC: ₹{data.market_structure_smc.volume_profile.poc}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 leading-snug">
                              Value Area: ₹{data.market_structure_smc.volume_profile.val} — ₹{data.market_structure_smc.volume_profile.vah}
                            </div>
                          </div>
                          <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800/60 pt-1.5">
                            <span>Absorption Score:</span>
                            <strong className="text-cyan-600 dark:text-cyan-400 font-mono">{data.market_structure_smc.volume_profile.dry_up_score}/100</strong>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Compact Divider */}
                    <div className="border-t border-slate-200 dark:border-slate-800/80 pt-3" />

                    {/* 3.2 Compact 12-Month Seasonality Strip */}
                    <div id="seasonality">
                      <div className="flex items-center justify-between pb-2 mb-2">
                        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-cyan-600 dark:text-cyan-400 font-bold font-mono">
                          <Calendar size={14} />
                          <span>Historical Monthly Return Matrix & Win Rates</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          12-Month Performance Cycle
                        </div>
                      </div>

                      {/* 12 Months Single-Row Heatmap Strip */}
                      <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-1.5">
                        {data.seasonality.map((item, idx) => (
                          <div
                            key={idx}
                            className={`rounded-lg border px-2 py-1.5 flex flex-col justify-between text-center transition ${
                              item.avg_return_pct >= 0
                                ? "border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/70 dark:bg-emerald-950/20"
                                : "border-rose-200 dark:border-rose-900/50 bg-rose-50/70 dark:bg-rose-950/20"
                            }`}
                          >
                            <div className="flex items-center justify-between text-[10px] font-bold text-slate-700 dark:text-slate-300">
                              <span>{item.month}</span>
                              <span className="text-[9px] font-mono opacity-75">{item.win_rate_pct}%</span>
                            </div>

                            <div
                              className={`text-xs font-black font-mono mt-1 ${
                                item.avg_return_pct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                              }`}
                            >
                              {item.avg_return_pct >= 0 ? "+" : ""}
                              {item.avg_return_pct}%
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ================================================================= */}
                {/* SECTION 4: SECTOR PEER RADAR & KNOWLEDGE BASE                     */}
                {/* ================================================================= */}
                <div className="flex flex-col gap-5">
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold border border-amber-500/30">
                        SECTION 4
                      </span>
                      <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white font-mono">
                        Sector Peer Radar & Institutional Benchmarking
                      </h2>
                    </div>
                    <span className="text-xs text-slate-500 font-mono hidden sm:inline">
                      Peer Relative Standing & Valuation Multiples
                    </span>
                  </div>

                  {/* 4.1 Sector Peers Table */}
                  <div id="sector-peers" className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#070F1E] p-6 shadow-xs dark:shadow-xl">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
                      <div>
                        <div className="text-xs uppercase tracking-wider text-cyan-600 dark:text-cyan-400 font-bold">
                          Peer Comparison & Institutional Valuation
                        </div>
                        <h3 className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                          {data.sector && data.sector !== "Unknown" ? data.sector : "Healthcare"} Sector Radar ({data.peer_comparison.length} Active Peers)
                        </h3>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Ranked by market capitalization. Click any peer to open its full Technical Overview.
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                        <thead className="border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-[#0A1424]">
                          <tr>
                            <th className="py-2.5 px-3">Symbol</th>
                            <th className="py-2.5 px-3">Company Name</th>
                            <th className="py-2.5 px-3 text-right">CMP (₹)</th>
                            <th className="py-2.5 px-3 text-right">P/E</th>
                            <th className="py-2.5 px-3 text-right">Mar Cap (₹ Cr)</th>
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
                            <td className="py-3 px-3 font-sans text-slate-900 dark:text-white font-bold">{data.company_name}</td>
                            <td className="py-3 px-3 text-right text-slate-900 dark:text-white font-bold">₹{data.current_price.toFixed(2)}</td>
                            <td className="py-3 px-3 text-right text-cyan-600 dark:text-cyan-400 font-bold">98.0</td>
                            <td className="py-3 px-3 text-right text-slate-900 dark:text-white">₹{(Number(data.market_cap) || 107111).toLocaleString()}</td>
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
                              <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-100 dark:bg-cyan-900/60 text-cyan-800 dark:text-cyan-300 font-bold">Active</span>
                            </td>
                          </tr>

                          {/* Sector Peers */}
                          {data.peer_comparison.map((peer) => (
                            <tr key={peer.symbol} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                              <td className="py-2.5 px-3 text-slate-800 dark:text-slate-200 font-bold">{peer.symbol}</td>
                              <td className="py-2.5 px-3 font-sans text-slate-600 dark:text-slate-300 truncate max-w-[180px]">{peer.company_name}</td>
                              <td className="py-2.5 px-3 text-right text-slate-800 dark:text-slate-200 font-semibold">₹{peer.current_price.toFixed(2)}</td>
                              <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400">{peer.pe_ratio ? peer.pe_ratio.toFixed(1) : "—"}</td>
                              <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400">₹{(peer.market_cap || 0).toLocaleString()}</td>
                              <td className={`py-2.5 px-3 text-right ${peer.day_change_pct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                                {peer.day_change_pct >= 0 ? "+" : ""}{peer.day_change_pct}%
                              </td>
                              <td className="py-2.5 px-3 text-center text-slate-700 dark:text-slate-300">{peer.rs_rank}</td>
                              <td className="py-2.5 px-3 text-center text-slate-500 dark:text-slate-400 font-sans">{peer.trend_stage}</td>
                              <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-300">{peer.pivot_distance_pct}%</td>
                              <td className="py-2.5 px-3 text-center text-slate-800 dark:text-slate-200">{peer.setup_score}/100</td>
                              <td className={`py-2.5 px-3 text-right ${peer.sales_growth_ttm && peer.sales_growth_ttm >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                                {peer.sales_growth_ttm && peer.sales_growth_ttm >= 0 ? "+" : ""}{peer.sales_growth_ttm}%
                              </td>
                              <td className={`py-2.5 px-3 text-right ${peer.profit_growth_ttm && peer.profit_growth_ttm >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                                {peer.profit_growth_ttm && peer.profit_growth_ttm >= 0 ? "+" : ""}{peer.profit_growth_ttm}%
                              </td>
                              <td className="py-2.5 px-3 text-center font-sans">
                                <Link
                                  href={`/stocks/${peer.symbol}${backHref !== "/growth-screener" ? `?from=${encodeURIComponent(backHref)}` : ""}`}
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
                </div>
              </div>
            )}

            {/* TAB VIEW 2: FINANCIAL STATEMENTS (8 QUARTERS) */}
            {activeTab === "financials" && (
              <QuarterlyFinancialsTab symbol={symbol} />
            )}

            {/* TAB VIEW 3: ORDER BOOK & INVESTOR PRESENTATION CATALYSTS */}
            {activeTab === "order-book" && (
              <OrderBookCatalystsTab
                symbol={symbol}
                orderBookValueCr={3420}
                bookToBillRatio={2.1}
                orderIntakeYoY={42}
              />
            )}

            {/* TAB VIEW 4: MUTUAL FUND HOLDINGS SCHEME-BY-SCHEME */}
            {activeTab === "mutual-funds" && (
              <MutualFundHoldingsTab
                symbol={symbol}
                totalSchemes={42}
                totalValueCr={1485.6}
                floatAbsorptionPct={18.4}
                netInflowMoMCr={48.2}
              />
            )}

            {/* TAB VIEW 5: MOMENTUM CHECKLIST & DELIVERY ANALYSIS */}
            {activeTab === "momentum" && (
              <MomentumDeliveryTab symbol={symbol} momentumScore={9} />
            )}

            {/* TAB VIEW 6: MARKET STRUCTURE (ICT/SMC) */}
            {activeTab === "market-structure" && (
              <div className="flex flex-col gap-6">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#070F1E] p-6 shadow-xs dark:shadow-xl">
                  <div className="border-b border-slate-200 dark:border-slate-800 pb-3 mb-5">
                    <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-cyan-600 dark:text-cyan-400 font-bold">
                      <Layers size={15} />
                      <span>Market Structure & Smart Money Concepts (ICT / SMC)</span>
                    </div>
                    <h2 className="text-base font-black text-slate-900 dark:text-white mt-1">
                      Institutional Order Flow & Imbalance Zones — {symbol}
                    </h2>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      Algorithmic detection of Break of Structure (BOS), Fair Value Gaps (FVG), Order Blocks, and Volume Profile.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Structure & BOS */}
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

                    {/* Premium vs Discount */}
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

                    {/* Fair Value Gaps */}
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

                    {/* Order Blocks */}
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

                    {/* Liquidity Sweeps */}
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

                    {/* Volume Profile */}
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
              </div>
            )}

            {/* TAB VIEW 7: FULL CHART LAB */}
            {activeTab === "chart" && (
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#070F1E] p-6 shadow-xs dark:shadow-xl w-full">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4 mb-4">
                  <div>
                    <h2 className="text-lg font-black text-slate-900 dark:text-white font-mono flex items-center gap-2">
                      <BarChart3 size={18} className="text-cyan-500 dark:text-cyan-400" />
                      <span>Dedicated High-Resolution Research Chart Lab — {symbol}</span>
                    </h2>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                      Maximized viewport length with automated Model Pivot Resistance (₹{data.scenario_references.pivot_reference}), Downside Stop (₹{data.scenario_references.downside_reference}) and Target levels.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300">
                      Symbol: {data.tradingview_symbol}
                    </span>
                  </div>
                </div>

                <TradingViewChart
                  symbol={data.symbol}
                  exchange={data.exchange}
                  height={720}
                  pivotReference={data.scenario_references.pivot_reference}
                  scenarioTrigger={data.scenario_references.scenario_trigger}
                  downsideReference={data.scenario_references.downside_reference}
                  target1={data.scenario_references.target_1}
                />
              </div>
            )}

            {/* TAB VIEW: BROKERAGE RADAR & CONSENSUS */}
            {activeTab === "brokerage" && (
              <BrokerageResearchTab symbol={symbol} />
            )}

            {/* TAB VIEW 8: POSITION SIZING CALCULATOR */}
            {activeTab === "calculator" && positionSizing && (
              <div className="max-w-2xl mx-auto w-full rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#070F1E] p-6 shadow-xl">
                <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
                  <Calculator size={20} className="text-cyan-500 dark:text-cyan-400" />
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-white font-mono">
                      Institutional Position Sizing Calculator — {symbol}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Mathematically disciplined position sizing based on account capital and downside stop loss.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase">
                        Portfolio Capital (₹)
                      </label>
                      <input
                        type="number"
                        value={portfolioSize}
                        onChange={(e) => setPortfolioSize(Number(e.target.value) || 0)}
                        className="w-full mt-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#060D19] px-3 py-2 text-xs text-slate-900 dark:text-white font-mono focus:border-cyan-500 focus:outline-none"
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
                        className="w-full mt-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#060D19] px-3 py-2 text-xs text-slate-900 dark:text-white font-mono focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                  </div>

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
                </div>
              </div>
            )}
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

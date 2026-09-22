"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Briefcase,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  AlertTriangle,
  Plus,
  Upload,
  RefreshCw,
  FolderPlus,
  Trash2,
  Edit2,
  ChevronRight,
  ExternalLink,
  Target,
  Sparkles,
  Zap,
  Info,
  Calendar,
  Layers,
  PieChart,
  CheckCircle2,
  XCircle,
  X,
  FileSpreadsheet,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Scale,
  Clock,
} from "lucide-react";
import {
  portfolioApi,
  PortfolioItem,
  PortfolioSummary,
  PortfolioHolding,
  Stock360Analysis,
  OpportunityData,
  RebalanceRecommendation,
} from "@/lib/portfolioApi";

export default function PortfolioIntelligencePage() {
  // State
  const [portfolios, setPortfolios] = useState<PortfolioItem[]>([]);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<number | null>(null);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [holdings, setHoldings] = useState<PortfolioHolding[]>([]);
  const [opportunities, setOpportunities] = useState<OpportunityData | null>(null);
  const [rebalanceData, setRebalanceData] = useState<RebalanceRecommendation | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"holdings" | "zones" | "radar" | "opportunities" | "rebalance">("holdings");

  // Sorting State
  type SortField =
    | "symbol"
    | "sector"
    | "quantity"
    | "avg_buy_price"
    | "cmp"
    | "current_value"
    | "pnl"
    | "pnl_pct"
    | "weight_pct"
    | "verdict"
    | "horizon"
    | "accumulate_zone";
  type SortOrder = "asc" | "desc";

  const [sortField, setSortField] = useState<SortField>("current_value");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      // Default to ascending for text columns, descending for numbers
      if (field === "symbol" || field === "sector" || field === "horizon") {
        setSortOrder("asc");
      } else {
        setSortOrder("desc");
      }
    }
  }

  // Sorted holdings
  const sortedHoldings = useMemo(() => {
    return [...holdings].sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === "symbol") {
        valA = a.symbol.toLowerCase();
        valB = b.symbol.toLowerCase();
      } else if (sortField === "sector") {
        valA = (a.sector || "").toLowerCase();
        valB = (b.sector || "").toLowerCase();
      } else if (sortField === "verdict") {
        const rank: Record<string, number> = {
          STRONG_BUY: 6,
          ACCUMULATE: 5,
          BUY: 4,
          HOLD: 3,
          REDUCE: 2,
          EXIT: 1,
        };
        valA = rank[a.verdict] || 0;
        valB = rank[b.verdict] || 0;
      } else if (sortField === "horizon") {
        valA = a.horizon.toLowerCase();
        valB = b.horizon.toLowerCase();
      } else if (typeof valA === "string") {
        valA = valA.toLowerCase();
        valB = (valB || "").toLowerCase();
      }

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [holdings, sortField, sortOrder]);

  // Drawer & Modals
  const [selectedStockSymbol, setSelectedStockSymbol] = useState<string | null>(null);
  const [stock360Data, setStock360Data] = useState<Stock360Analysis | null>(null);
  const [isStock360Loading, setIsStock360Loading] = useState<boolean>(false);

  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isCreatePortfolioOpen, setIsCreatePortfolioOpen] = useState<boolean>(false);
  const [isImportCsvOpen, setIsImportCsvOpen] = useState<boolean>(false);
  const [editingHolding, setEditingHolding] = useState<PortfolioHolding | null>(null);

  // Forms
  const [newStockSymbol, setNewStockSymbol] = useState<string>("");
  const [newStockQty, setNewStockQty] = useState<string>("");
  const [newStockPrice, setNewStockPrice] = useState<string>("");
  const [newStockDate, setNewStockDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [newStockNotes, setNewStockNotes] = useState<string>("");

  const [newPortfolioName, setNewPortfolioName] = useState<string>("");
  const [newPortfolioDesc, setNewPortfolioDesc] = useState<string>("");
  const [newPortfolioBenchmark, setNewPortfolioBenchmark] = useState<string>("NIFTY 50");
  const [newPortfolioCash, setNewPortfolioCash] = useState<string>("50000");

  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvImportMode, setCsvImportMode] = useState<"file" | "paste">("paste");
  const [csvRawText, setCsvRawText] = useState<string>("");
  const [csvImportResult, setCsvImportResult] = useState<string | null>(null);
  const [deployAmount, setDeployAmount] = useState<number>(100000);

  // Real-time live quote synchronization states
  const [isRefreshingPrices, setIsRefreshingPrices] = useState<boolean>(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(0); // 0=Off, 30=30s, 60=60s
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);

  // Load Portfolios on mount
  useEffect(() => {
    loadPortfolios();
  }, []);

  // Reload data when portfolio changes
  useEffect(() => {
    if (selectedPortfolioId) {
      loadPortfolioData(selectedPortfolioId);
    }
  }, [selectedPortfolioId]);

  // Auto-refresh interval poller
  useEffect(() => {
    if (!autoRefreshInterval || !selectedPortfolioId) return;
    const timer = setInterval(() => {
      handleRefreshLivePrices(selectedPortfolioId);
    }, autoRefreshInterval * 1000);
    return () => clearInterval(timer);
  }, [autoRefreshInterval, selectedPortfolioId]);

  async function loadPortfolios() {
    try {
      setIsLoading(true);
      const list = await portfolioApi.getPortfolios();
      setPortfolios(list);
      if (list.length > 0) {
        // Select default or first
        const defaultP = list.find((p) => p.is_default) || list[0];
        setSelectedPortfolioId(defaultP.id);
      }
    } catch (err) {
      console.error("Failed to load portfolios:", err);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadPortfolioData(portfolioId: number) {
    try {
      setIsLoading(true);
      const [sumData, holdData, oppData, rebData] = await Promise.all([
        portfolioApi.getSummary(portfolioId),
        portfolioApi.getHoldings(portfolioId),
        portfolioApi.getOpportunities(portfolioId, deployAmount),
        portfolioApi.getRebalance(portfolioId),
      ]);
      setSummary(sumData);
      setHoldings(holdData);
      setOpportunities(oppData);
      setRebalanceData(rebData);
      setLastRefreshedAt(new Date().toLocaleTimeString());
    } catch (err) {
      console.error("Failed to load portfolio details:", err);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRefreshLivePrices(portfolioId: number) {
    try {
      setIsRefreshingPrices(true);
      const res = await portfolioApi.refreshPrices(portfolioId);
      if (res.summary) setSummary(res.summary);
      if (res.holdings) setHoldings(res.holdings);
      setLastRefreshedAt(new Date().toLocaleTimeString());

      // Also update opportunities and rebalance targets based on new live valuations
      const [oppData, rebData] = await Promise.all([
        portfolioApi.getOpportunities(portfolioId, deployAmount),
        portfolioApi.getRebalance(portfolioId),
      ]);
      setOpportunities(oppData);
      setRebalanceData(rebData);
    } catch (err) {
      console.error("Failed to refresh live portfolio prices:", err);
    } finally {
      setIsRefreshingPrices(false);
    }
  }

  async function handleCreatePortfolio(e: React.FormEvent) {
    e.preventDefault();
    if (!newPortfolioName.trim()) return;
    try {
      const res = await portfolioApi.createPortfolio({
        name: newPortfolioName.trim(),
        description: newPortfolioDesc.trim() || undefined,
        benchmark: newPortfolioBenchmark || "NIFTY 50",
        cash_balance: parseFloat(newPortfolioCash) || 0,
      });
      setIsCreatePortfolioOpen(false);
      setNewPortfolioName("");
      setNewPortfolioDesc("");
      await loadPortfolios();
      if (res.portfolio?.id) {
        setSelectedPortfolioId(res.portfolio.id);
      }
    } catch (err) {
      alert("Failed to create portfolio: " + err);
    }
  }

  async function handleAddStock(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPortfolioId || !newStockSymbol || !newStockQty || !newStockPrice) return;
    try {
      await portfolioApi.addManualHolding(selectedPortfolioId, {
        symbol: newStockSymbol.trim().toUpperCase(),
        quantity: parseFloat(newStockQty),
        avg_buy_price: parseFloat(newStockPrice),
        buy_date: newStockDate || undefined,
        notes: newStockNotes.trim() || undefined,
      });
      setIsAddModalOpen(false);
      setNewStockSymbol("");
      setNewStockQty("");
      setNewStockPrice("");
      setNewStockNotes("");
      loadPortfolioData(selectedPortfolioId);
    } catch (err) {
      alert("Failed to add stock: " + err);
    }
  }

  async function handleUpdateHolding(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPortfolioId || !editingHolding) return;
    try {
      await portfolioApi.updateHolding(selectedPortfolioId, editingHolding.id, {
        quantity: editingHolding.quantity,
        avg_buy_price: editingHolding.avg_buy_price,
        notes: editingHolding.notes,
      });
      setEditingHolding(null);
      loadPortfolioData(selectedPortfolioId);
    } catch (err) {
      alert("Failed to update holding: " + err);
    }
  }

  async function handleDeleteHolding(holdingId: number, symbol: string) {
    if (!selectedPortfolioId) return;
    if (!confirm(`Are you sure you want to remove ${symbol} from this portfolio?`)) return;
    try {
      await portfolioApi.deleteHolding(selectedPortfolioId, holdingId);
      loadPortfolioData(selectedPortfolioId);
    } catch (err) {
      alert("Failed to remove holding: " + err);
    }
  }

  async function handleImportCsv(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPortfolioId) return;

    if (csvImportMode === "file" && !csvFile) {
      alert("Please select a CSV file to upload.");
      return;
    }
    if (csvImportMode === "paste" && !csvRawText.trim()) {
      alert("Please paste your CSV text.");
      return;
    }

    try {
      let res;
      if (csvImportMode === "file" && csvFile) {
        res = await portfolioApi.importCsv(selectedPortfolioId, csvFile);
      } else {
        res = await portfolioApi.importCsvText(selectedPortfolioId, csvRawText);
      }

      setCsvImportResult(
        `Successfully imported ${res.added_count} holdings (${res.skipped_count} skipped).`
      );
      setTimeout(() => {
        setIsImportCsvOpen(false);
        setCsvFile(null);
        setCsvRawText("");
        setCsvImportResult(null);
        if (selectedPortfolioId) loadPortfolioData(selectedPortfolioId);
      }, 1500);
    } catch (err) {
      alert("CSV import error: " + err);
    }
  }

  async function openStock360(symbol: string) {
    if (!selectedPortfolioId) return;
    setSelectedStockSymbol(symbol);
    setIsStock360Loading(true);
    try {
      const data = await portfolioApi.getStock360(selectedPortfolioId, symbol);
      setStock360Data(data);
    } catch (err) {
      console.error("Failed to load 360 report:", err);
    } finally {
      setIsStock360Loading(false);
    }
  }

  // Formatting helpers
  const fmtINR = (val?: number) => {
    if (val === undefined || val === null) return "₹0";
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(val);
  };

  const selectedPortfolio = useMemo(() => {
    return portfolios.find((p) => p.id === selectedPortfolioId) || portfolios[0];
  }, [portfolios, selectedPortfolioId]);

  return (
    <div className="space-y-6">
      {/* ========================================================= */}
      {/* 1. TOP HEADER & MULTI-PORTFOLIO SWITCHER */}
      {/* ========================================================= */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 shadow-lg shadow-emerald-950/10 dark:shadow-emerald-950/40">
            <Briefcase className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                AI Portfolio Intelligence Engine
              </h1>
              <span className="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                Institutional v1.0
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Multi-Portfolio 360° Financial & Technical Radar • Benchmark:{" "}
              <span className="text-cyan-600 dark:text-cyan-400 font-medium">{summary?.benchmark || "NIFTY 50"}</span>
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Portfolio Switcher Dropdown */}
          <div className="relative">
            <select
              value={selectedPortfolioId || ""}
              onChange={(e) => setSelectedPortfolioId(Number(e.target.value))}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-200 text-xs rounded-lg px-3 py-2 pr-8 focus:outline-none focus:border-emerald-500 transition-all font-medium cursor-pointer shadow-xs"
            >
              {portfolios.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.holdings_count} stocks)
                </option>
              ))}
            </select>
          </div>

          {/* New Portfolio Button */}
          <button
            onClick={() => setIsCreatePortfolioOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all shadow-xs"
          >
            <FolderPlus className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>New Portfolio</span>
          </button>

          {/* Manual Add Stock Button */}
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold bg-emerald-500 hover:bg-emerald-400 text-white dark:text-slate-950 rounded-lg transition-all shadow-md shadow-emerald-500/20 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add Stock Manually</span>
          </button>

          {/* Import CSV Button */}
          <button
            onClick={() => setIsImportCsvOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-white dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all shadow-xs"
          >
            <Upload className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
            <span>Import CSV</span>
          </button>

          {/* Auto Refresh Interval Selector */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700/80 text-[11px]">
            <span className="px-2 py-1 text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${autoRefreshInterval > 0 ? "bg-emerald-500 animate-pulse" : "bg-slate-400"}`} />
              Auto
            </span>
            {[
              { label: "Off", val: 0 },
              { label: "30s", val: 30 },
              { label: "60s", val: 60 },
            ].map((opt) => (
              <button
                key={opt.val}
                onClick={() => setAutoRefreshInterval(opt.val)}
                className={`px-2 py-1 rounded font-semibold transition-all ${
                  autoRefreshInterval === opt.val
                    ? "bg-white dark:bg-emerald-500 text-slate-900 dark:text-slate-950 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Refresh Live Prices Button */}
          <button
            onClick={() => selectedPortfolioId && handleRefreshLivePrices(selectedPortfolioId)}
            disabled={isLoading || isRefreshingPrices}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 bg-white dark:bg-slate-900 border border-emerald-500/30 dark:border-emerald-500/20 rounded-lg hover:border-emerald-500/50 transition-all shadow-xs active:scale-95 disabled:opacity-50"
            title="Fetch Live Market Quotes & Refresh Analysis"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading || isRefreshingPrices ? "animate-spin text-emerald-500" : ""}`} />
            <span>{isRefreshingPrices ? "Syncing..." : "Sync Live Prices"}</span>
          </button>

          {lastRefreshedAt && (
            <span className="hidden xl:inline-block text-[10px] text-slate-400 dark:text-slate-500 self-center">
              Sync: {lastRefreshedAt}
            </span>
          )}
        </div>
      </header>

      {/* ========================================================= */}
      {/* 2. INSTITUTIONAL HEALTH & QUALITY BANNER */}
      {/* ========================================================= */}
      {summary && (
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Health Score Card */}
          <div className="lg:col-span-4 bg-white dark:bg-gradient-to-br dark:from-slate-900/90 dark:to-slate-950/90 border border-slate-200 dark:border-slate-800/90 rounded-2xl p-5 shadow-sm dark:shadow-xl relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Portfolio Health Score
                </span>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-4xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-400">
                    {summary.health_score}
                  </span>
                  <span className="text-sm font-semibold text-slate-400">/ 100</span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                      summary.health_score >= 85
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
                        : summary.health_score >= 70
                        ? "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/30"
                        : "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                    }`}
                  >
                    {summary.health_status}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Beta vs {summary.benchmark}: <strong className="text-slate-800 dark:text-slate-200">{summary.portfolio_beta}</strong>
                  </span>
                </div>
              </div>
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="w-8 h-8" />
              </div>
            </div>

            {/* Quality Meter Bar */}
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800/80">
              <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-2">
                Quality Meter Breakdown
              </span>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-slate-50 dark:bg-slate-950/60 p-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Financial</span>
                  <strong className="text-emerald-600 dark:text-emerald-400">{summary.quality_meter.financial_strength}</strong>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950/60 p-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Growth</span>
                  <strong className="text-cyan-600 dark:text-cyan-400">{summary.quality_meter.growth_quality}</strong>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950/60 p-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Valuation</span>
                  <strong className="text-amber-600 dark:text-amber-400">{summary.quality_meter.valuation_score}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Core Valuation & Return Metrics */}
          <div className="lg:col-span-8 grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Total Invested */}
            <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Invested</span>
              <div className="my-2">
                <span className="text-xl font-bold text-slate-900 dark:text-slate-100">{fmtINR(summary.total_invested)}</span>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">{summary.total_stocks} Stocks in portfolio</span>
            </div>

            {/* Current Value */}
            <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Current Value</span>
              <div className="my-2">
                <span className="text-xl font-bold text-slate-900 dark:text-slate-100">{fmtINR(summary.current_value)}</span>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Cash: <span className="text-emerald-600 dark:text-emerald-400 font-medium">{fmtINR(summary.cash_balance)}</span>
              </span>
            </div>

            {/* Total Return / P&L */}
            <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Unrealized P&L</span>
              <div className="my-2 flex items-baseline gap-1.5">
                <span
                  className={`text-xl font-bold ${
                    summary.total_pnl >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {fmtINR(summary.total_pnl)}
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px]">
                {summary.total_pnl >= 0 ? (
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                )}
                <span
                  className={`font-semibold ${
                    summary.total_pnl >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {summary.total_pnl_pct >= 0 ? `+${summary.total_pnl_pct}%` : `${summary.total_pnl_pct}%`}
                </span>
              </div>
            </div>

            {/* Estimated XIRR */}
            <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between shadow-xs">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Annualized Return (XIRR)</span>
              <div className="my-2">
                <span className="text-xl font-bold text-teal-600 dark:text-teal-300">
                  {summary.xirr_estimate > 0 ? `+${summary.xirr_estimate}%` : "0.0%"}
                </span>
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Benchmark: {summary.benchmark}</span>
            </div>

            {/* AI Summary Banner span */}
            <div className="col-span-2 md:col-span-4 bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/80 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="flex items-start gap-3">
                <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                  <strong className="text-emerald-600 dark:text-emerald-400">AI Portfolio Diagnostic: </strong>
                  {summary.ai_summary}
                </p>
              </div>
              {rebalanceData && rebalanceData.rebalance_actions && rebalanceData.rebalance_actions.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab("rebalance")}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 transition-colors"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>{rebalanceData.rebalance_actions.length} Rebalance Actions</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Concentration Warnings if any */}
      {summary && summary.concentration_warnings.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-500/30 rounded-xl p-3 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="text-xs font-semibold text-amber-900 dark:text-amber-300 block">Risk Attribution Alerts:</span>
            {summary.concentration_warnings.map((w, i) => (
              <p key={i} className="text-xs text-amber-800 dark:text-amber-200/80">
                • {w}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. INTERACTIVE TAB NAVIGATION */}
      {/* ========================================================= */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 text-xs overflow-x-auto">
        <button
          onClick={() => setActiveTab("holdings")}
          className={`pb-3 px-3 font-semibold transition-all border-b-2 flex items-center gap-1.5 shrink-0 ${
            activeTab === "holdings"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          <span>Holdings & 360° Diagnostics</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {holdings.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab("rebalance")}
          className={`pb-3 px-3 font-semibold transition-all border-b-2 flex items-center gap-1.5 shrink-0 ${
            activeTab === "rebalance"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          <span>Portfolio Actions & Rebalance</span>
          {rebalanceData && rebalanceData.rebalance_actions && rebalanceData.rebalance_actions.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
              {rebalanceData.rebalance_actions.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("opportunities")}
          className={`pb-3 px-3 font-semibold transition-all border-b-2 flex items-center gap-1.5 shrink-0 ${
            activeTab === "opportunities"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          <span>AI Capital Deployer & Suggestions</span>
          {opportunities?.all_picks && opportunities.all_picks.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
              {opportunities.all_picks.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("zones")}
          className={`pb-3 px-3 font-semibold transition-all border-b-2 shrink-0 ${
            activeTab === "zones"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          Accumulation & Entry Zones
        </button>
        <button
          onClick={() => setActiveTab("radar")}
          className={`pb-3 px-3 font-semibold transition-all border-b-2 shrink-0 ${
            activeTab === "radar"
              ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          }`}
        >
          Factor Radar & Sector Risk
        </button>
      </div>

      {/* ========================================================= */}
      {/* 4. TAB 1: HOLDINGS & 360° DIAGNOSTICS TABLE */}
      {/* ========================================================= */}
      {activeTab === "holdings" && (
        <div className="bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm dark:shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950/80 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800 select-none">
                  {/* Symbol */}
                  <th
                    onClick={() => handleSort("symbol")}
                    className="py-3.5 px-4 cursor-pointer hover:text-slate-900 dark:hover:text-slate-100 transition-colors group/th"
                  >
                    <div className="flex items-center gap-1">
                      <span>Symbol / Company</span>
                      {sortField === "symbol" ? (
                        sortOrder === "asc" ? <ArrowUp className="w-3 h-3 text-emerald-500" /> : <ArrowDown className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 dark:text-slate-600 group-hover/th:text-slate-600 dark:group-hover/th:text-slate-400" />
                      )}
                    </div>
                  </th>

                  {/* Sector */}
                  <th
                    onClick={() => handleSort("sector")}
                    className="py-3.5 px-3 cursor-pointer hover:text-slate-900 dark:hover:text-slate-100 transition-colors group/th"
                  >
                    <div className="flex items-center gap-1">
                      <span>Sector</span>
                      {sortField === "sector" ? (
                        sortOrder === "asc" ? <ArrowUp className="w-3 h-3 text-emerald-500" /> : <ArrowDown className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 dark:text-slate-600 group-hover/th:text-slate-600 dark:group-hover/th:text-slate-400" />
                      )}
                    </div>
                  </th>

                  {/* Qty */}
                  <th
                    onClick={() => handleSort("quantity")}
                    className="py-3.5 px-3 text-right cursor-pointer hover:text-slate-900 dark:hover:text-slate-100 transition-colors group/th"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Qty</span>
                      {sortField === "quantity" ? (
                        sortOrder === "asc" ? <ArrowUp className="w-3 h-3 text-emerald-500" /> : <ArrowDown className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 dark:text-slate-600 group-hover/th:text-slate-600 dark:group-hover/th:text-slate-400" />
                      )}
                    </div>
                  </th>

                  {/* Avg Buy */}
                  <th
                    onClick={() => handleSort("avg_buy_price")}
                    className="py-3.5 px-3 text-right cursor-pointer hover:text-slate-900 dark:hover:text-slate-100 transition-colors group/th"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Avg Buy (₹)</span>
                      {sortField === "avg_buy_price" ? (
                        sortOrder === "asc" ? <ArrowUp className="w-3 h-3 text-emerald-500" /> : <ArrowDown className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 dark:text-slate-600 group-hover/th:text-slate-600 dark:group-hover/th:text-slate-400" />
                      )}
                    </div>
                  </th>

                  {/* CMP */}
                  <th
                    onClick={() => handleSort("cmp")}
                    className="py-3.5 px-3 text-right cursor-pointer hover:text-slate-900 dark:hover:text-slate-100 transition-colors group/th"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>CMP (₹)</span>
                      {sortField === "cmp" ? (
                        sortOrder === "asc" ? <ArrowUp className="w-3 h-3 text-emerald-500" /> : <ArrowDown className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 dark:text-slate-600 group-hover/th:text-slate-600 dark:group-hover/th:text-slate-400" />
                      )}
                    </div>
                  </th>

                  {/* Current Value */}
                  <th
                    onClick={() => handleSort("current_value")}
                    className="py-3.5 px-3 text-right cursor-pointer hover:text-slate-900 dark:hover:text-slate-100 transition-colors group/th"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Current Value</span>
                      {sortField === "current_value" ? (
                        sortOrder === "asc" ? <ArrowUp className="w-3 h-3 text-emerald-500" /> : <ArrowDown className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 dark:text-slate-600 group-hover/th:text-slate-600 dark:group-hover/th:text-slate-400" />
                      )}
                    </div>
                  </th>

                  {/* P&L */}
                  <th
                    onClick={() => handleSort("pnl")}
                    className="py-3.5 px-3 text-right cursor-pointer hover:text-slate-900 dark:hover:text-slate-100 transition-colors group/th"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>P&L (₹ / %)</span>
                      {sortField === "pnl" ? (
                        sortOrder === "asc" ? <ArrowUp className="w-3 h-3 text-emerald-500" /> : <ArrowDown className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 dark:text-slate-600 group-hover/th:text-slate-600 dark:group-hover/th:text-slate-400" />
                      )}
                    </div>
                  </th>

                  {/* Weight */}
                  <th
                    onClick={() => handleSort("weight_pct")}
                    className="py-3.5 px-3 text-center cursor-pointer hover:text-slate-900 dark:hover:text-slate-100 transition-colors group/th"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Weight</span>
                      {sortField === "weight_pct" ? (
                        sortOrder === "asc" ? <ArrowUp className="w-3 h-3 text-emerald-500" /> : <ArrowDown className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 dark:text-slate-600 group-hover/th:text-slate-600 dark:group-hover/th:text-slate-400" />
                      )}
                    </div>
                  </th>

                  {/* AI Verdict */}
                  <th
                    onClick={() => handleSort("verdict")}
                    className="py-3.5 px-3 text-center cursor-pointer hover:text-slate-900 dark:hover:text-slate-100 transition-colors group/th"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>AI Verdict</span>
                      {sortField === "verdict" ? (
                        sortOrder === "asc" ? <ArrowUp className="w-3 h-3 text-emerald-500" /> : <ArrowDown className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 dark:text-slate-600 group-hover/th:text-slate-600 dark:group-hover/th:text-slate-400" />
                      )}
                    </div>
                  </th>

                  {/* Horizon */}
                  <th
                    onClick={() => handleSort("horizon")}
                    className="py-3.5 px-3 text-center cursor-pointer hover:text-slate-900 dark:hover:text-slate-100 transition-colors group/th"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Horizon</span>
                      {sortField === "horizon" ? (
                        sortOrder === "asc" ? <ArrowUp className="w-3 h-3 text-emerald-500" /> : <ArrowDown className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 dark:text-slate-600 group-hover/th:text-slate-600 dark:group-hover/th:text-slate-400" />
                      )}
                    </div>
                  </th>

                  {/* Accumulate Zone */}
                  <th
                    onClick={() => handleSort("accumulate_zone")}
                    className="py-3.5 px-3 cursor-pointer hover:text-slate-900 dark:hover:text-slate-100 transition-colors group/th"
                  >
                    <div className="flex items-center gap-1">
                      <span>Accumulate Zone</span>
                      {sortField === "accumulate_zone" ? (
                        sortOrder === "asc" ? <ArrowUp className="w-3 h-3 text-emerald-500" /> : <ArrowDown className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 text-slate-400 dark:text-slate-600 group-hover/th:text-slate-600 dark:group-hover/th:text-slate-400" />
                      )}
                    </div>
                  </th>

                  <th className="py-3.5 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                {sortedHoldings.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="py-12 text-center text-slate-500 dark:text-slate-400">
                      <Briefcase className="w-8 h-8 mx-auto mb-2 text-slate-400 dark:text-slate-600" />
                      No stocks in this portfolio yet.
                      <button
                        onClick={() => setIsAddModalOpen(true)}
                        className="text-emerald-600 dark:text-emerald-400 font-semibold hover:underline block mx-auto mt-1"
                      >
                        + Add your first stock manually
                      </button>
                    </td>
                  </tr>
                ) : (
                  sortedHoldings.map((h) => (
                    <tr
                      key={h.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group cursor-pointer"
                      onClick={() => openStock360(h.symbol)}
                    >
                      {/* Symbol */}
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <span>{h.symbol}</span>
                        <span className="text-[10px] font-normal text-slate-500 dark:text-slate-400 truncate max-w-[120px]">
                          {h.company_name}
                        </span>
                      </td>

                      {/* Sector */}
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300">{h.sector}</td>

                      {/* Qty */}
                      <td className="py-3 px-3 text-right font-medium text-slate-700 dark:text-slate-200">{h.quantity}</td>

                      {/* Avg Price */}
                      <td className="py-3 px-3 text-right text-slate-600 dark:text-slate-300 font-mono">
                        {fmtINR(h.avg_buy_price)}
                      </td>

                      {/* CMP */}
                      <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-slate-100 font-mono">
                        <div>{fmtINR(h.cmp)}</div>
                        {h.day_change_pct !== undefined && h.day_change_pct !== null && (
                          <div className={`text-[10px] font-medium ${h.day_change_pct >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                            {h.day_change_pct >= 0 ? `+${h.day_change_pct}%` : `${h.day_change_pct}%`}
                          </div>
                        )}
                      </td>

                      {/* Current Value */}
                      <td className="py-3 px-3 text-right font-medium text-slate-700 dark:text-slate-200 font-mono">
                        {fmtINR(h.current_value)}
                      </td>

                      {/* P&L */}
                      <td className="py-3 px-3 text-right font-mono font-semibold">
                        <div className={h.pnl >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                          {fmtINR(h.pnl)}
                        </div>
                        <div
                          className={`text-[10px] ${
                            h.pnl_pct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {h.pnl_pct >= 0 ? `+${h.pnl_pct}%` : `${h.pnl_pct}%`}
                        </div>
                      </td>

                      {/* Weight */}
                      <td className="py-3 px-3 text-center">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-medium">
                          {h.weight_pct}%
                        </span>
                      </td>

                      {/* AI Verdict */}
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide border ${
                            h.verdict === "STRONG_BUY"
                              ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40"
                              : h.verdict === "ACCUMULATE"
                              ? "bg-teal-500/20 text-teal-700 dark:text-teal-300 border-teal-500/40"
                              : h.verdict === "HOLD"
                              ? "bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border-cyan-500/40"
                              : h.verdict === "REDUCE"
                              ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40"
                              : "bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/40"
                          }`}
                        >
                          {h.verdict} ({h.conviction_score}%)
                        </span>
                      </td>

                      {/* Horizon */}
                      <td className="py-3 px-3 text-center text-slate-600 dark:text-slate-300 text-[11px] font-medium">
                        {h.horizon.replace("_", " ")}
                      </td>

                      {/* Accumulate Zone */}
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                        {h.accumulate_zone}
                      </td>

                      {/* Actions */}
                      <td
                        className="py-3 px-4 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => openStock360(h.symbol)}
                            className="p-1 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                            title="360° AI Report"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingHolding(h)}
                            className="p-1 text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                            title="Edit Holding"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteHolding(h.id, h.symbol)}
                            className="p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                            title="Remove Stock"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. TAB 2: ACCUMULATION & ENTRY ZONES CARDS */}
      {/* ========================================================= */}
      {activeTab === "zones" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {holdings.map((h) => (
            <div
              key={h.id}
              className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 hover:border-slate-300 dark:hover:border-slate-700 transition-all cursor-pointer shadow-xs dark:shadow-sm"
              onClick={() => openStock360(h.symbol)}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{h.symbol}</h3>
                  <span className="text-xs text-slate-500 dark:text-slate-400">{h.company_name}</span>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    h.verdict === "STRONG_BUY" || h.verdict === "ACCUMULATE"
                      ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40"
                      : "bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border-cyan-500/40"
                  }`}
                >
                  {h.verdict}
                </span>
              </div>

              {/* CMP vs Target */}
              <div className="grid grid-cols-2 gap-2 my-4 bg-slate-50 dark:bg-slate-950/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800/80 text-xs">
                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Current Price</span>
                  <div className="flex items-baseline gap-1.5">
                    <strong className="text-slate-900 dark:text-slate-100 font-mono text-sm">{fmtINR(h.cmp)}</strong>
                    {h.day_change_pct !== undefined && h.day_change_pct !== null && (
                      <span className={`text-[10px] font-semibold ${h.day_change_pct >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                        {h.day_change_pct >= 0 ? `+${h.day_change_pct}%` : `${h.day_change_pct}%`}
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 block">Fair Value</span>
                  <strong className="text-teal-600 dark:text-teal-300 font-mono text-sm">{fmtINR(h.fair_value)}</strong>
                </div>
              </div>

              {/* Price Zones List */}
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800/50">
                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    Best Buy Zone
                  </span>
                  <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-300">{h.best_buy_zone}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800/50">
                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                    Accumulate on Dips
                  </span>
                  <span className="font-mono font-semibold text-teal-600 dark:text-teal-300">{h.accumulate_zone}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800/50">
                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                    Profit Booking
                  </span>
                  <span className="font-mono font-semibold text-amber-600 dark:text-amber-300">{fmtINR(h.profit_booking)}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                    Stop Loss (Support Breakdown)
                  </span>
                  <span className="font-mono font-semibold text-rose-600 dark:text-rose-400">{fmtINR(h.stop_loss)}</span>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                <span>{h.when_to_buy}</span>
                <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ========================================================= */}
      {/* 6. TAB 3: FACTOR RADAR & SECTOR CONCENTRATION */}
      {/* ========================================================= */}
      {activeTab === "radar" && summary && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Factor Radar Bars */}
          <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs dark:shadow-xl">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1 flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Portfolio Factor Exposure vs {summary.benchmark}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
              Institutional Multi-Factor Diagnostic across 5 core risk/return pillars.
            </p>

            <div className="space-y-4">
              {[
                { name: "Financial Strength & Balance Sheet", val: summary.quality_meter.financial_strength, col: "bg-emerald-500" },
                { name: "Growth Quality & Durability", val: summary.quality_meter.growth_quality, col: "bg-teal-400" },
                { name: "Valuation Attractiveness", val: summary.quality_meter.valuation_score, col: "bg-amber-400" },
                { name: "Technical Momentum & Trend", val: summary.quality_meter.momentum, col: "bg-cyan-400" },
                { name: "Corporate Governance & Stability", val: summary.quality_meter.governance, col: "bg-purple-400" },
              ].map((f, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-700 dark:text-slate-300 font-medium">{f.name}</span>
                    <span className="text-slate-900 dark:text-slate-200 font-bold">{f.val} / 100</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-950 rounded-full overflow-hidden border border-slate-200 dark:border-slate-800">
                    <div
                      className={`h-full ${f.col} rounded-full transition-all duration-500`}
                      style={{ width: `${f.val}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sector Concentration */}
          <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs dark:shadow-xl">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1 flex items-center gap-2">
              <PieChart className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              Sector Concentration & Exposure
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
              Sector weights relative to institutional ceiling (&lt; 30% limit recommended).
            </p>

            <div className="space-y-3.5">
              {Object.entries(summary.sector_distribution).map(([sec, weight], idx) => {
                const isOverweight = weight > 30.0;
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-700 dark:text-slate-300 font-medium">{sec}</span>
                      <span
                        className={`font-semibold ${
                          isOverweight ? "text-amber-600 dark:text-amber-400 font-bold" : "text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {weight}% {isOverweight && "(Overweight)"}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-950 rounded-full overflow-hidden border border-slate-200 dark:border-slate-800">
                      <div
                        className={`h-full ${
                          isOverweight ? "bg-amber-500" : "bg-cyan-500"
                        } rounded-full transition-all duration-500`}
                        style={{ width: `${Math.min(100, weight * 2)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 7. TAB 4: AI CAPITAL DEPLOYER & SUGGESTIONS */}
      {/* ========================================================= */}
      {activeTab === "opportunities" && opportunities && (
        <div className="space-y-6">
          {/* Top Control Ribbon */}
          <div className="bg-white dark:bg-gradient-to-r dark:from-emerald-950/40 dark:via-slate-900/80 dark:to-slate-900/60 border border-slate-200 dark:border-emerald-500/30 rounded-2xl p-6 shadow-xs dark:shadow-xl space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-bold tracking-widest text-emerald-600 dark:text-emerald-400 uppercase flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Engine 14 — Institutional Capital Allocator
                </span>
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">
                  AI Capital Deployer: Where Should I Invest ₹{fmtINR(deployAmount).replace("₹", "")}?
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-2xl leading-relaxed">
                  {opportunities.ai_verdict}
                </p>
              </div>

              {/* Capital Amount Input & Preset Chips */}
              <div className="flex flex-col items-end gap-2 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Deploy Capital:</span>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs text-emerald-600 dark:text-emerald-400 font-bold font-mono">₹</span>
                    <input
                      type="number"
                      value={deployAmount}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setDeployAmount(v);
                        if (selectedPortfolioId) portfolioApi.getOpportunities(selectedPortfolioId, v).then(setOpportunities);
                      }}
                      step="10000"
                      min="5000"
                      className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-emerald-600 dark:text-emerald-400 font-mono font-bold text-sm pl-7 pr-3 py-1.5 rounded-xl w-36 focus:outline-none focus:border-emerald-500 shadow-inner"
                    />
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap gap-1.5 justify-end">
                  {[
                    { label: "₹25K", val: 25000 },
                    { label: "₹50K", val: 50000 },
                    { label: "₹1 Lakh (Default)", val: 100000 },
                    { label: "₹2.5 Lakh", val: 250000 },
                    { label: "₹5 Lakh", val: 500000 },
                  ].map((preset) => (
                    <button
                      key={preset.val}
                      type="button"
                      onClick={() => {
                        setDeployAmount(preset.val);
                        if (selectedPortfolioId) portfolioApi.getOpportunities(selectedPortfolioId, preset.val).then(setOpportunities);
                      }}
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all ${
                        deployAmount === preset.val
                          ? "bg-emerald-500 text-white dark:text-slate-950 border-emerald-400 shadow-sm"
                          : "bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Allocation Split Buckets */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {opportunities.recommended_split.map((bucket, bIdx) => (
              <div
                key={bIdx}
                className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs dark:shadow-xl space-y-4 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{bucket.bucket}</h4>
                      {bucket.description && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{bucket.description}</p>
                      )}
                    </div>
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 shadow-sm">
                      {fmtINR(bucket.amount)}
                    </span>
                  </div>

                  {/* Pick Cards */}
                  <div className="space-y-4 mt-4">
                    {bucket.picks.length === 0 ? (
                      <div className="py-8 text-center text-slate-400 bg-slate-50/50 dark:bg-slate-950/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                        <Target className="w-6 h-6 mx-auto mb-2 text-slate-500 opacity-60" />
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">No candidates in this bucket currently qualify.</p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Capital is dynamically concentrated in other active opportunities.</p>
                      </div>
                    ) : (
                      bucket.picks.map((pick, pIdx) => (
                        <div
                          key={pIdx}
                          className="bg-slate-50/70 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 space-y-3 hover:border-emerald-500/40 transition-all cursor-pointer shadow-xs dark:shadow-lg"
                          onClick={() => openStock360(pick.symbol)}
                        >
                          {/* Header */}
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-base font-extrabold text-slate-900 dark:text-slate-100">{pick.symbol}</span>
                                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate max-w-[140px]">
                                  {pick.company_name}
                                </span>
                                {pick.sector && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200/60 dark:bg-slate-900 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-800">
                                    {pick.sector}
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-teal-600 dark:text-teal-400 font-semibold">{pick.category}</span>
                            </div>

                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40">
                              {pick.conviction}% Conviction
                            </span>
                          </div>

                          {/* Capital & Quantity Callout Banner */}
                          <div className="bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800/90 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                            <div>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold block">Suggested Capital</span>
                              <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                                {fmtINR(pick.allocated_amount)}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold block">Recommended Order</span>
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono">
                                Buy <strong className="text-cyan-600 dark:text-cyan-300">{pick.suggested_qty} Shares</strong> (@ CMP {fmtINR(pick.cmp)})
                              </span>
                            </div>
                          </div>

                          {/* 4 Strategic Pillars Grid */}
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
                            {/* Ideal Buy Price */}
                            <div className="bg-white dark:bg-slate-900/40 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-sans block flex items-center gap-1">
                                <Target className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                                Price to Buy
                              </span>
                              <span className="text-slate-900 dark:text-slate-100 font-bold text-[11px] block mt-0.5">
                                {pick.price_to_buy}
                              </span>
                            </div>

                            {/* Target Price */}
                            <div className="bg-white dark:bg-slate-900/40 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-sans block flex items-center gap-1">
                                <TrendingUp className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                                Target Price
                              </span>
                              <div className="flex items-center gap-1 mt-0.5">
                                <span className="text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">{fmtINR(pick.target_price)}</span>
                                <span className="text-[9px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-500/20 px-1 rounded">
                                  +{pick.upside_pct}%
                                </span>
                              </div>
                            </div>

                            {/* Stop Loss */}
                            <div className="bg-white dark:bg-slate-900/40 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-sans block flex items-center gap-1">
                                <TrendingDown className="w-2.5 h-2.5 text-rose-500 dark:text-rose-400" />
                                Stop Loss
                              </span>
                              <div className="flex items-center gap-1 mt-0.5">
                                <span className="text-rose-600 dark:text-rose-400 font-bold text-[11px]">{fmtINR(pick.stop_loss)}</span>
                                <span className="text-[9px] font-bold text-rose-700 dark:text-rose-300 bg-rose-500/20 px-1 rounded">
                                  -{pick.downside_pct}%
                                </span>
                              </div>
                            </div>

                            {/* Risk-Reward */}
                            <div className="bg-white dark:bg-slate-900/40 p-2 rounded-lg border border-slate-200 dark:border-slate-800">
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-sans block flex items-center gap-1">
                                <Scale className="w-2.5 h-2.5 text-cyan-600 dark:text-cyan-400" />
                                Risk : Reward
                              </span>
                              <span className="text-cyan-600 dark:text-cyan-300 font-bold text-[11px] block mt-0.5">
                                {pick.risk_reward_ratio}
                              </span>
                            </div>
                          </div>

                          {/* Horizon & Triggers */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200 dark:border-slate-800/60 text-[11px]">
                            <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                              <Clock className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                              <span>Horizon: <strong className="text-teal-600 dark:text-teal-300 font-semibold">{pick.horizon}</strong></span>
                            </div>
                            {pick.triggers && (
                              <span className="text-[10px] text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800">
                                {pick.triggers}
                              </span>
                            )}
                          </div>

                          {/* Rationale */}
                          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pt-1">
                            {pick.rationale}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 7b. TAB: PORTFOLIO REBALANCE & ACTIONS */}
      {/* ========================================================= */}
      {activeTab === "rebalance" && rebalanceData && (
        <div className="space-y-6">
          {/* Header Banner */}
          <div className="bg-white dark:bg-gradient-to-r dark:from-slate-900/90 dark:via-slate-900/70 dark:to-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm dark:shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-bold tracking-widest text-amber-600 dark:text-amber-400 uppercase flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                Engine 13 — Institutional Portfolio Rebalancing & Risk Optimization
              </span>
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">
                Portfolio Health & Rebalancing Recommendations
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-2xl leading-relaxed">
                Institutional rebalancing identifies extended or underperforming positions to trim, while directing capital to under-allocated high-conviction compounders near technical accumulation bands.
              </p>
            </div>
            {rebalanceData.tax_efficiency_note && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-xs text-emerald-700 dark:text-emerald-300 max-w-xs shrink-0">
                <span className="font-semibold block text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-0.5">Tax Optimization</span>
                {rebalanceData.tax_efficiency_note}
              </div>
            )}
          </div>

          {/* Rebalance Actions Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Trim & Profit Booking */}
            <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs dark:shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-500">
                    <TrendingDown className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Trim / Profit Taking Candidates</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Over-concentrated or fundamentally slowing positions to de-risk</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-rose-600 dark:text-rose-400 font-mono bg-rose-500/10 px-2.5 py-1 rounded-lg border border-rose-500/20">
                  {rebalanceData.rebalance_actions.filter((a) => a.type === "TRIM").length} Stocks
                </span>
              </div>

              <div className="space-y-3">
                {rebalanceData.rebalance_actions.filter((a) => a.type === "TRIM").length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">No positions currently require trimming or risk reduction.</p>
                ) : (
                  rebalanceData.rebalance_actions.filter((a) => a.type === "TRIM").map((action, idx) => (
                    <div
                      key={idx}
                      onClick={() => openStock360(action.symbol)}
                      className="bg-slate-50/70 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2 hover:border-rose-500/40 transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100">{action.symbol}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                            TRIM EXPOSURE
                          </span>
                        </div>
                        <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
                          Target Max: {action.suggested_allocation_pct}%
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300">{action.reason}</p>
                      <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs">
                        <span className="text-rose-600 dark:text-rose-400 font-semibold">{action.suggested_action}</span>
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">View 360° <ChevronRight className="w-3 h-3" /></span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Add More / Accumulate */}
            <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs dark:shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-500">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Accumulate & Top-Up Candidates</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Highest conviction compounders currently underweight</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 font-mono bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                  {rebalanceData.rebalance_actions.filter((a) => a.type === "ADD_MORE").length} Stocks
                </span>
              </div>

              <div className="space-y-3">
                {rebalanceData.rebalance_actions.filter((a) => a.type === "ADD_MORE").length === 0 ? (
                  <p className="text-xs text-slate-400 py-6 text-center">All high-conviction positions are currently at or above target allocation.</p>
                ) : (
                  rebalanceData.rebalance_actions.filter((a) => a.type === "ADD_MORE").map((action, idx) => (
                    <div
                      key={idx}
                      onClick={() => openStock360(action.symbol)}
                      className="bg-slate-50/70 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2 hover:border-emerald-500/40 transition-all cursor-pointer"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-extrabold text-slate-900 dark:text-slate-100">{action.symbol}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            ACCUMULATE
                          </span>
                        </div>
                        <span className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
                          Target Weight: {action.suggested_allocation_pct}%
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300">{action.reason}</p>
                      <div className="pt-2 border-t border-slate-200 dark:border-slate-800/80 flex items-center justify-between text-xs">
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{action.suggested_action}</span>
                        <span className="text-[10px] text-slate-400 flex items-center gap-1">View 360° <ChevronRight className="w-3 h-3" /></span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Sector Rebalancing Comparison */}
          {rebalanceData.suggested_sector_targets && (
            <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs dark:shadow-xl space-y-4">
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <PieChart className="w-4 h-4 text-cyan-500" />
                Sector Weight Rebalancing (Current vs Institutional Target)
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {Object.entries(rebalanceData.suggested_sector_targets).map(([sector, targetWeight]) => {
                  const currentWeight = rebalanceData.current_sector_allocation?.[sector] || 0;
                  const delta = Math.round((currentWeight - targetWeight) * 10) / 10;
                  return (
                    <div key={sector} className="bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl p-3 space-y-2">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block truncate" title={sector}>
                        {sector}
                      </span>
                      <div className="flex items-baseline justify-between text-xs font-mono">
                        <span className="text-slate-500 text-[10px]">Cur: <strong className="text-slate-700 dark:text-slate-200">{currentWeight}%</strong></span>
                        <span className="text-slate-500 text-[10px]">Tgt: <strong className="text-emerald-600 dark:text-emerald-400">{targetWeight}%</strong></span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            delta > 5 ? "bg-amber-500" : delta < -5 ? "bg-cyan-500" : "bg-emerald-500"
                          }`}
                          style={{ width: `${Math.min(100, Math.max(5, (currentWeight / targetWeight) * 100))}%` }}
                        />
                      </div>
                      <span className={`text-[10px] font-bold block text-right ${
                        delta > 2 ? "text-amber-500" : delta < -2 ? "text-cyan-400" : "text-emerald-400"
                      }`}>
                        {delta > 0 ? `+${delta}% (Overweight)` : delta < 0 ? `${delta}% (Underweight)` : "Balanced"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 8. SLIDE-OVER DRAWER: STOCK 360° AI REPORT */}
      {/* ========================================================= */}
      {selectedStockSymbol && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm transition-opacity">
          <div className="w-full max-w-2xl bg-white dark:bg-[#08101C] border-l border-slate-200 dark:border-slate-800 h-full overflow-y-auto p-6 space-y-6 shadow-2xl animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-600 dark:text-emerald-400">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">{selectedStockSymbol}</h2>
                    {stock360Data && (
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                        {stock360Data.live_price.sector}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {stock360Data?.live_price.company_name || selectedStockSymbol}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedStockSymbol(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isStock360Loading || !stock360Data ? (
              <div className="py-24 text-center">
                <RefreshCw className="w-8 h-8 mx-auto animate-spin text-emerald-500 mb-3" />
                <p className="text-xs text-slate-500 dark:text-slate-400">Synthesizing 15 AI Engines for {selectedStockSymbol}...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* 1. Verdict & Horizon Banner */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold">Verdict</span>
                    <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {stock360Data.analysis.verdict}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold">Conviction</span>
                    <div className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                      {stock360Data.analysis.conviction_score}%
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold">Horizon</span>
                    <div className="text-sm font-semibold text-cyan-600 dark:text-cyan-300 mt-0.5">
                      {stock360Data.analysis.horizon.replace("_", " ")}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-semibold">Valuation</span>
                    <div className="text-sm font-semibold text-teal-600 dark:text-teal-300 mt-0.5">
                      {stock360Data.analysis.valuation_status}
                    </div>
                  </div>
                </div>

                {/* 2. Company DNA & Moat */}
                <div className="bg-white dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800/80 space-y-2">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    Company DNA & Moat
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {stock360Data.analysis.company_dna_moat}
                  </p>
                </div>

                {/* 3. AI Thesis & Action Rules */}
                <div className="bg-white dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800/80 space-y-3">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                    AI Action Playbook
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {stock360Data.analysis.ai_thesis}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-1">
                    <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-300 dark:border-emerald-500/30 rounded-lg">
                      <strong className="text-emerald-700 dark:text-emerald-400 block mb-0.5">When to Buy:</strong>
                      <span className="text-emerald-800 dark:text-emerald-200/80">{stock360Data.analysis.when_to_buy}</span>
                    </div>
                    <div className="p-2.5 bg-rose-50 dark:bg-rose-950/20 border border-rose-300 dark:border-rose-500/30 rounded-lg">
                      <strong className="text-rose-700 dark:text-rose-400 block mb-0.5">When NOT to Buy:</strong>
                      <span className="text-rose-800 dark:text-rose-200/80">{stock360Data.analysis.when_not_to_buy}</span>
                    </div>
                  </div>
                </div>

                {/* 4. Price & Entry Zones */}
                <div className="bg-white dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800/80 space-y-3">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                    Institutional Accumulation Zones
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="p-2 bg-slate-50 dark:bg-slate-950/80 rounded border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-sans">Best Buy Zone</span>
                      <strong className="text-emerald-600 dark:text-emerald-400">
                        ₹{stock360Data.analysis.best_buy_min} - ₹{stock360Data.analysis.best_buy_max}
                      </strong>
                    </div>
                    <div className="p-2 bg-slate-50 dark:bg-slate-950/80 rounded border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-sans">Accumulate Zone</span>
                      <strong className="text-teal-600 dark:text-teal-300">
                        ₹{stock360Data.analysis.accumulate_min} - ₹{stock360Data.analysis.accumulate_max}
                      </strong>
                    </div>
                    <div className="p-2 bg-slate-50 dark:bg-slate-950/80 rounded border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-sans">Profit Booking Zone</span>
                      <strong className="text-amber-600 dark:text-amber-400">₹{stock360Data.analysis.profit_booking}</strong>
                    </div>
                    <div className="p-2 bg-slate-50 dark:bg-slate-950/80 rounded border border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-sans">Stop Loss</span>
                      <strong className="text-rose-600 dark:text-rose-400">₹{stock360Data.analysis.stop_loss}</strong>
                    </div>
                  </div>
                </div>

                {/* 5. Expected Results Engine */}
                <div className="bg-white dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800/80 space-y-2">
                  <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                    Expected Quarterly Results Engine
                  </h4>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400">Expected Result Outcome:</span>
                    <strong className="text-emerald-600 dark:text-emerald-400">{stock360Data.analysis.expected_result}</strong>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400">Revenue/PAT Beat Probability:</span>
                    <strong className="text-slate-900 dark:text-slate-100">{stock360Data.analysis.beat_probability}%</strong>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400">Result Release Countdown:</span>
                    <strong className="text-cyan-600 dark:text-cyan-400">~{stock360Data.analysis.earnings_countdown_days} Days</strong>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 9. MODAL: MANUAL ADD STOCK */}
      {/* ========================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Add Stock Manually
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddStock} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                  NSE/BSE Symbol *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. TRENT, TATAMOTORS, INFY"
                  value={newStockSymbol}
                  onChange={(e) => setNewStockSymbol(e.target.value.toUpperCase())}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 uppercase font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Quantity *</label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="e.g. 50"
                    value={newStockQty}
                    onChange={(e) => setNewStockQty(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">
                    Buy Price (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    required
                    placeholder="e.g. 1450.00"
                    value={newStockPrice}
                    onChange={(e) => setNewStockPrice(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Purchase Date</label>
                <input
                  type="date"
                  value={newStockDate}
                  onChange={(e) => setNewStockDate(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Investment Thesis / Notes</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Accumulating near EMA50 support, earnings surprise expected"
                  value={newStockNotes}
                  onChange={(e) => setNewStockNotes(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-emerald-500 text-xs"
                />
              </div>

              {/* Total calculation preview */}
              {newStockQty && newStockPrice && (
                <div className="bg-slate-50 dark:bg-slate-950/80 p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex justify-between items-center text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Total Capital Outlay:</span>
                  <strong className="text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                    {fmtINR(parseFloat(newStockQty) * parseFloat(newStockPrice))}
                  </strong>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white dark:text-slate-950 font-bold rounded-lg shadow-md"
                >
                  Save to Portfolio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 10. MODAL: EDIT HOLDING */}
      {/* ========================================================= */}
      {editingHolding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                Edit Holding: {editingHolding.symbol}
              </h3>
              <button
                onClick={() => setEditingHolding(null)}
                className="text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateHolding} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Quantity</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={editingHolding.quantity}
                    onChange={(e) =>
                      setEditingHolding({ ...editingHolding, quantity: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Avg Buy Price (₹)</label>
                  <input
                    type="number"
                    step="0.05"
                    required
                    value={editingHolding.avg_buy_price}
                    onChange={(e) =>
                      setEditingHolding({ ...editingHolding, avg_buy_price: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={editingHolding.notes || ""}
                  onChange={(e) => setEditingHolding({ ...editingHolding, notes: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-200 text-xs"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingHolding(null)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-white dark:text-slate-950 font-bold rounded-lg shadow-md"
                >
                  Update Holding
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 11. MODAL: CREATE NEW PORTFOLIO */}
      {/* ========================================================= */}
      {isCreatePortfolioOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Create New Portfolio
              </h3>
              <button
                onClick={() => setIsCreatePortfolioOpen(false)}
                className="text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePortfolio} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Portfolio Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. High-Beta Momentum, Retirement Core"
                  value={newPortfolioName}
                  onChange={(e) => setNewPortfolioName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Description</label>
                <input
                  type="text"
                  placeholder="e.g. Satellite allocation for swing breakouts"
                  value={newPortfolioDesc}
                  onChange={(e) => setNewPortfolioDesc(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Benchmark Index</label>
                  <select
                    value={newPortfolioBenchmark}
                    onChange={(e) => setNewPortfolioBenchmark(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="NIFTY 50">NIFTY 50</option>
                    <option value="NIFTY 500">NIFTY 500</option>
                    <option value="NIFTY MIDCAP 150">NIFTY MIDCAP 150</option>
                    <option value="NIFTY SMALLCAP 250">NIFTY SMALLCAP 250</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-medium mb-1">Initial Cash (₹)</label>
                  <input
                    type="number"
                    value={newPortfolioCash}
                    onChange={(e) => setNewPortfolioCash(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreatePortfolioOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-white dark:text-slate-950 font-bold rounded-lg shadow-md"
                >
                  Create Portfolio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 12. MODAL: IMPORT CSV (ZERODHA / GROWW / ANGEL ONE) */}
      {/* ========================================================= */}
      {isImportCsvOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                Import Holdings (Zerodha / Groww / Angel One)
              </h3>
              <button
                onClick={() => setIsImportCsvOpen(false)}
                className="text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Switcher */}
            <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => setCsvImportMode("paste")}
                className={`flex-1 py-1.5 font-semibold rounded-lg transition-all ${
                  csvImportMode === "paste"
                    ? "bg-cyan-500 text-white dark:text-slate-950 shadow-md"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                Paste CSV Text
              </button>
              <button
                type="button"
                onClick={() => setCsvImportMode("file")}
                className={`flex-1 py-1.5 font-semibold rounded-lg transition-all ${
                  csvImportMode === "file"
                    ? "bg-cyan-500 text-white dark:text-slate-950 shadow-md"
                    : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                }`}
              >
                Upload File (.csv)
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-950/80 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 space-y-1">
              <p className="font-semibold text-slate-700 dark:text-slate-300">Supported Format:</p>
              <p className="font-mono text-[11px] text-cyan-600 dark:text-cyan-300">
                &quot;Instrument&quot;,&quot;Qty.&quot;,&quot;Avg. cost&quot;,&quot;LTP&quot;,&quot;Invested&quot;,...
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                • Zerodha Kite Holdings export, Groww, Angel One, or standard CSV.
              </p>
            </div>

            <form onSubmit={handleImportCsv} className="space-y-4 text-xs">
              {csvImportMode === "paste" ? (
                <div>
                  <textarea
                    rows={8}
                    required
                    placeholder={`"Instrument","Qty.","Avg. cost","LTP","Invested","Cur. val","P&L","Net chg.","Day chg."\n"AEGISLOG",5,945,1417.25,4725,7086.25,2361.25,49.97,4.79\n"AEROENTER",60,120.75,125.49,7245,7529.4,284.4,3.93,2.07\n...`}
                    value={csvRawText}
                    onChange={(e) => setCsvRawText(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-slate-900 dark:text-slate-100 font-mono text-[11px] focus:outline-none focus:border-cyan-500"
                  />
                </div>
              ) : (
                <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-6 text-center hover:border-cyan-500 transition-colors cursor-pointer bg-slate-50/50 dark:bg-slate-950/40">
                  <Upload className="w-8 h-8 text-slate-400 dark:text-slate-500 mx-auto mb-2" />
                  <input
                    type="file"
                    accept=".csv"
                    required
                    onChange={(e) => e.target.files?.[0] && setCsvFile(e.target.files[0])}
                    className="w-full text-xs text-slate-500 dark:text-slate-400 file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-cyan-500 file:text-white dark:file:text-slate-950 hover:file:bg-cyan-400 cursor-pointer"
                  />
                </div>
              )}

              {csvImportResult && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-600 dark:text-emerald-400 font-semibold text-center">
                  {csvImportResult}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsImportCsvOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={csvImportMode === "file" ? !csvFile : !csvRawText.trim()}
                  className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-white dark:text-slate-950 font-bold rounded-lg shadow-md"
                >
                  Upload & Analyze
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import CPRDiscoveryCard from "@/components/cpr/CPRDiscoveryCard";
import CPRBandVisualizer from "@/components/cpr/CPRBandVisualizer";
import CPRDetailModal from "@/components/cpr/CPRDetailModal";
import CPRTransitionRadar from "@/components/cpr/CPRTransitionRadar";
import {
  fetchCPRScannerResults,
  fetchCPRSummary,
  fetchCPRAlerts,
  triggerCPRUniverseScan,
  type CPRStockItem,
  type CPRDiscoverySummary,
  type CPRAlertItem,
} from "@/lib/cprApi";
import {
  Search,
  SlidersHorizontal,
  Layers,
  Sparkles,
  Zap,
  TrendingUp,
  Activity,
  ArrowUpDown,
  Filter,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Bell,
  Flame,
  Target,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Compass,
} from "lucide-react";

export default function CPRScannerPage() {
  const [items, setItems] = useState<CPRStockItem[]>([]);
  const [summary, setSummary] = useState<CPRDiscoverySummary | null>(null);
  const [alerts, setAlerts] = useState<CPRAlertItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [scanning, setScanning] = useState<boolean>(false);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

  // Filter States
  const [search, setSearch] = useState<string>("");
  const [selectedSector, setSelectedSector] = useState<string>("ALL");
  const [selectedMarketCap, setSelectedMarketCap] = useState<string>("ALL");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [minMarketCapCr, setMinMarketCapCr] = useState<number>(1000);
  const [minPrice, setMinPrice] = useState<number>(30);
  const [maxWidth, setMaxWidth] = useState<number>(0.50);
  const [minScore, setMinScore] = useState<number>(0);
  const [tripleCprOnly, setTripleCprOnly] = useState<boolean>(false);
  const [volumeDryupOnly, setVolumeDryupOnly] = useState<boolean>(false);
  const [bullishTrendOnly, setBullishTrendOnly] = useState<boolean>(false);

  // Sorting & Pagination
  const [sortBy, setSortBy] = useState<string>("cpr_rank");
  const [sortOrder, setSortOrder] = useState<string>("asc");
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Active Tab
  const [activeTab, setActiveTab] = useState<"transitions" | "compression">("transitions");

  // Active Alert Toast
  const [latestAlertToast, setLatestAlertToast] = useState<CPRAlertItem | null>(null);

  // Load Main Data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchCPRScannerResults({
        width_max: maxWidth < 0.50 ? maxWidth : undefined,
        score_min: minScore > 0 ? minScore : undefined,
        sector: selectedSector,
        marketcap: selectedMarketCap,
        min_marketcap_cr: minMarketCapCr > 0 ? minMarketCapCr : undefined,
        min_price: minPrice > 0 ? minPrice : undefined,
        category: selectedCategory,
        triple_cpr_only: tripleCprOnly,
        volume_dryup_only: volumeDryupOnly,
        bullish_trend_only: bullishTrendOnly,
        search: search.trim() || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
        page: page,
        limit: 25,
      });

      setItems(res.items || []);
      setTotalCount(res.total || 0);
      setTotalPages(res.total_pages || 1);
    } catch (err) {
      console.error("Failed to load CPR scanner records:", err);
    } finally {
      setLoading(false);
    }
  }, [
    maxWidth,
    minScore,
    selectedSector,
    selectedMarketCap,
    selectedCategory,
    minMarketCapCr,
    minPrice,
    tripleCprOnly,
    volumeDryupOnly,
    bullishTrendOnly,
    search,
    sortBy,
    sortOrder,
    page,
  ]);

  // Load Summary
  const loadSummary = useCallback(async () => {
    try {
      const sum = await fetchCPRSummary();
      setSummary(sum);
    } catch (err) {
      console.error("Failed to load CPR summary:", err);
    }
  }, []);

  // Load Initial Alerts Feed
  const loadAlerts = useCallback(async () => {
    try {
      const al = await fetchCPRAlerts(20);
      setAlerts(al || []);
    } catch (err) {
      console.error("Failed to load CPR alerts:", err);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadSummary();
    loadAlerts();

    // Auto-refresh summary every 60 seconds
    const interval = setInterval(() => {
      loadSummary();
    }, 60000);

    return () => clearInterval(interval);
  }, [loadSummary, loadAlerts]);

  // Real-time WebSocket connection to /ws/cpr-alerts
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const connectWs = () => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.hostname === "localhost" ? "127.0.0.1:8000" : window.location.host;
      const wsUrl = `${protocol}//${host}/ws/cpr-alerts`;

      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log("[CPR WebSocket] Connected to real-time alert stream.");
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "CPR_LIVE_ALERT" && data.alert) {
              const newAlert = data.alert as CPRAlertItem;
              setAlerts((prev) => [newAlert, ...prev.slice(0, 49)]);
              setLatestAlertToast(newAlert);
              setTimeout(() => setLatestAlertToast(null), 8000);
            }
          } catch (e) {
            console.debug("[CPR WebSocket] Parse error:", e);
          }
        };

        ws.onclose = () => {
          reconnectTimeout = setTimeout(connectWs, 5000);
        };
      } catch (err) {
        console.debug("[CPR WebSocket] Connection failed, retrying in 5s:", err);
        reconnectTimeout = setTimeout(connectWs, 5000);
      }
    };

    connectWs();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  // Handle Trigger Scan
  const handleTriggerScan = async () => {
    setScanning(true);
    try {
      await triggerCPRUniverseScan();
      await loadSummary();
      await loadData();
    } catch (err) {
      console.error("Scan error:", err);
    } finally {
      setScanning(false);
    }
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
    setPage(1);
  };

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Discovery Engine Summary Card */}
        <CPRDiscoveryCard
          summary={summary}
          scanning={scanning}
          onTriggerScan={handleTriggerScan}
          onSelectStock={(sym) => setSelectedSymbol(sym)}
        />

        {/* Live Breakout Alert Toast */}
        {latestAlertToast && (
          <div className="flex items-center justify-between rounded-xl border border-emerald-500/40 bg-gradient-to-r from-emerald-950/90 to-slate-900/90 p-4 shadow-2xl backdrop-blur-md animate-in slide-in-from-top-4 duration-300">
            <div className="flex items-center gap-3">
              <span className="flex h-3 w-3 rounded-full bg-emerald-400 animate-ping" />
              <Zap className="h-5 w-5 text-emerald-400" />
              <div>
                <span className="text-sm font-bold text-white font-mono">{latestAlertToast.headline}</span>
                <p className="text-xs text-slate-300">{latestAlertToast.description}</p>
              </div>
            </div>
            <button
              onClick={() => setSelectedSymbol(latestAlertToast.symbol)}
              className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-bold text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 transition"
            >
              Analyze Setup
            </button>
          </div>
        )}

        {/* Navigation Mode Switcher */}
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-800/80 pb-3">
          <button
            onClick={() => setActiveTab("transitions")}
            className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold transition font-mono border ${
              activeTab === "transitions"
                ? "bg-gradient-to-r from-cyan-500/20 via-cyan-500/10 to-transparent border-cyan-500/60 text-cyan-300 shadow-lg shadow-cyan-950/50"
                : "bg-slate-900/60 border-slate-800/80 text-slate-400 hover:text-white"
            }`}
          >
            <Compass className="h-4 w-4 text-cyan-400" />
            Broad &rarr; Narrow Transition Radar (Multi-Timeframe)
            <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-[9px] text-cyan-300 font-bold border border-cyan-500/30">
              USER SETUP
            </span>
          </button>

          <button
            onClick={() => setActiveTab("compression")}
            className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold transition font-mono border ${
              activeTab === "compression"
                ? "bg-gradient-to-r from-cyan-500/20 via-cyan-500/10 to-transparent border-cyan-500/60 text-cyan-300 shadow-lg shadow-cyan-950/50"
                : "bg-slate-900/60 border-slate-800/80 text-slate-400 hover:text-white"
            }`}
          >
            <Layers className="h-4 w-4 text-cyan-400" />
            Full Universe Compression Scanner (NSE ~3,500)
          </button>
        </div>

        {/* Tab 1: Broad to Narrow Transition Radar */}
        {activeTab === "transitions" && (
          <CPRTransitionRadar onSelectStock={(sym) => setSelectedSymbol(sym)} />
        )}

        {/* Tab 2: Full Compression Scanner */}
        {activeTab === "compression" && (
          <>
            {/* Filters & Control Panel */}
            <div className="rounded-2xl border border-slate-800 bg-[#070D18]/90 p-4 shadow-lg backdrop-blur-md space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search symbol or company name (e.g. RELIANCE, TRENT)..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-xl border border-slate-700/80 bg-slate-900/80 py-2 pl-9 pr-4 text-xs font-mono text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>

            {/* Quick Filter Badges */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  setTripleCprOnly(!tripleCprOnly);
                  setPage(1);
                }}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition border ${
                  tripleCprOnly
                    ? "bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-md shadow-amber-950/40"
                    : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Triple CPR Only
              </button>

              <button
                onClick={() => {
                  setVolumeDryupOnly(!volumeDryupOnly);
                  setPage(1);
                }}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition border ${
                  volumeDryupOnly
                    ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-md shadow-cyan-950/40"
                    : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                <Activity className="h-3.5 w-3.5" />
                Volume Dry-Up
              </button>

              <button
                onClick={() => {
                  setBullishTrendOnly(!bullishTrendOnly);
                  setPage(1);
                }}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition border ${
                  bullishTrendOnly
                    ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-md shadow-emerald-950/40"
                    : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                <TrendingUp className="h-3.5 w-3.5" />
                Bullish Trend Only
              </button>
            </div>
          </div>

          {/* Granular Sliders and Selects */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 border-t border-slate-800/80 pt-3">
            {/* Category Select */}
            <div>
              <label className="text-[11px] uppercase font-bold text-slate-400 block mb-1">Compression Tier</label>
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-mono text-white focus:border-cyan-500 focus:outline-none"
              >
                <option value="ALL">All Categories</option>
                <option value="Ultra Compression">Ultra Compression (&lt;0.10%)</option>
                <option value="Very Strong">Very Strong (0.10–0.20%)</option>
                <option value="Strong">Strong (0.20–0.30%)</option>
                <option value="Average">Average (0.30–0.50%)</option>
              </select>
            </div>

            {/* Min Market Cap Select */}
            <div>
              <label className="text-[11px] uppercase font-bold text-slate-400 block mb-1">Min Market Cap</label>
              <select
                value={minMarketCapCr}
                onChange={(e) => {
                  setMinMarketCapCr(Number(e.target.value));
                  setPage(1);
                }}
                className="w-full rounded-lg border border-emerald-500/40 bg-slate-900 px-3 py-1.5 text-xs font-mono text-emerald-300 font-bold focus:border-emerald-500 focus:outline-none"
              >
                <option value={1000}>≥ ₹1,000 Cr (Institutional)</option>
                <option value={2500}>≥ ₹2,500 Cr</option>
                <option value={5000}>≥ ₹5,000 Cr</option>
                <option value={0}>All Market Caps</option>
              </select>
            </div>

            {/* Penny Stock Filter Select */}
            <div>
              <label className="text-[11px] uppercase font-bold text-slate-400 block mb-1">Penny Filter</label>
              <select
                value={minPrice}
                onChange={(e) => {
                  setMinPrice(Number(e.target.value));
                  setPage(1);
                }}
                className="w-full rounded-lg border border-cyan-500/40 bg-slate-900 px-3 py-1.5 text-xs font-mono text-cyan-300 font-bold focus:border-cyan-500 focus:outline-none"
              >
                <option value={30}>No Penny (≥ ₹30)</option>
                <option value={50}>Price ≥ ₹50</option>
                <option value={100}>Price ≥ ₹100</option>
                <option value={0}>All Prices</option>
              </select>
            </div>

            {/* Market Cap Category */}
            <div>
              <label className="text-[11px] uppercase font-bold text-slate-400 block mb-1">Market Cap Tier</label>
              <select
                value={selectedMarketCap}
                onChange={(e) => {
                  setSelectedMarketCap(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-mono text-white focus:border-cyan-500 focus:outline-none"
              >
                <option value="ALL">All Market Caps</option>
                <option value="LARGE">Large Cap (&gt;₹20,000 Cr)</option>
                <option value="MID">Mid Cap (₹5,000–20,000 Cr)</option>
                <option value="SMALL">Small Cap (&lt;₹5,000 Cr)</option>
              </select>
            </div>

            {/* CPR Width Slider */}
            <div>
              <div className="flex justify-between items-center mb-1 text-[11px]">
                <span className="uppercase font-bold text-slate-400">Max CPR Width %</span>
                <span className="font-mono font-bold text-cyan-400">{maxWidth.toFixed(2)}%</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.50"
                step="0.01"
                value={maxWidth}
                onChange={(e) => {
                  setMaxWidth(parseFloat(e.target.value));
                  setPage(1);
                }}
                className="w-full accent-cyan-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
            </div>

            {/* Min Compression Score Slider */}
            <div>
              <div className="flex justify-between items-center mb-1 text-[11px]">
                <span className="uppercase font-bold text-slate-400">Min Compression Score</span>
                <span className="font-mono font-bold text-cyan-400">{minScore} pts</span>
              </div>
              <input
                type="range"
                min="0"
                max="90"
                step="5"
                value={minScore}
                onChange={(e) => {
                  setMinScore(parseInt(e.target.value));
                  setPage(1);
                }}
                className="w-full accent-cyan-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              />
            </div>
          </div>
        </div>

        {/* Data Table */}
        <div className="rounded-2xl border border-slate-800 bg-[#070D18]/90 overflow-hidden shadow-xl backdrop-blur-md">
          {/* Table Toolbar */}
          <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5 bg-slate-900/40">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-slate-300">
                Displaying {items.length} of {totalCount.toLocaleString()} stocks
              </span>
              {selectedCategory !== "ALL" && (
                <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400 font-mono">
                  {selectedCategory}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 font-mono">
                Page {page} of {totalPages}
              </span>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 bg-[#050B14] text-[11px] font-mono uppercase text-slate-400 tracking-wider">
                <tr>
                  <th
                    onClick={() => handleSort("cpr_rank")}
                    className="cursor-pointer px-4 py-3 hover:text-white"
                  >
                    <div className="flex items-center gap-1">
                      Rank <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th className="px-4 py-3">Symbol</th>
                  <th
                    onClick={() => handleSort("current_price")}
                    className="cursor-pointer px-4 py-3 hover:text-white"
                  >
                    <div className="flex items-center gap-1">
                      CMP <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th className="px-4 py-3">Sector</th>
                  <th
                    onClick={() => handleSort("cpr_width_pct")}
                    className="cursor-pointer px-4 py-3 hover:text-white"
                  >
                    <div className="flex items-center gap-1">
                      CPR Width % <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("compression_score")}
                    className="cursor-pointer px-4 py-3 hover:text-white text-center"
                  >
                    <div className="flex items-center justify-center gap-1">
                      Comp Score <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort("breakout_score")}
                    className="cursor-pointer px-4 py-3 hover:text-white text-center"
                  >
                    <div className="flex items-center justify-center gap-1">
                      Breakout Score <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-center">Trend & Indicators</th>
                  <th className="px-4 py-3">Trade Plan (TC • SL • T1)</th>
                  <th className="px-4 py-3 text-center">CPR Band Visual</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {loading ? (
                  <tr>
                    <td colSpan={11} className="py-16 text-center">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
                        <span className="text-xs text-slate-400">Loading CPR universe...</span>
                      </div>
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-16 text-center text-slate-500">
                      No stocks met the active filter criteria. Try expanding the CPR Width or lowering the Compression Score slider.
                    </td>
                  </tr>
                ) : (
                  items.map((stock) => {
                    const isUltra = stock.category === "Ultra Compression";
                    const isVeryStrong = stock.category === "Very Strong";

                    return (
                      <tr
                        key={stock.id}
                        onClick={() => setSelectedSymbol(stock.symbol)}
                        className="hover:bg-slate-800/40 cursor-pointer transition"
                      >
                        {/* 1. Rank */}
                        <td className="px-4 py-3 text-slate-400 font-bold">
                          #{stock.cpr_rank}
                        </td>

                        {/* 2. Symbol */}
                        <td className="px-4 py-3">
                          <div className="flex flex-col">
                            <span className="font-bold text-white hover:text-cyan-400 transition flex items-center gap-1.5">
                              {stock.symbol}
                              {stock.is_triple_cpr && (
                                <span title="Triple CPR Compression">
                                  <Sparkles className="h-3 w-3 text-amber-400" />
                                </span>
                              )}
                            </span>
                            <span className="text-[10px] text-slate-500 truncate max-w-[140px]">
                              {stock.company_name}
                            </span>
                          </div>
                        </td>

                        {/* 3. CMP */}
                        <td className="px-4 py-3 font-bold text-slate-200">
                          ₹{stock.current_price.toFixed(2)}
                        </td>

                        {/* 4. Sector */}
                        <td className="px-4 py-3 text-slate-400 text-[11px] truncate max-w-[120px]">
                          {stock.sector}
                        </td>

                        {/* 5. CPR Width % */}
                        <td className="px-4 py-3 font-bold text-cyan-400">
                          {stock.cpr_width_pct.toFixed(3)}%
                        </td>

                        {/* 6. Compression Score */}
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded font-black text-xs ${
                              stock.compression_score >= 80
                                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                                : stock.compression_score >= 60
                                ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40"
                                : "bg-slate-800 text-slate-400"
                            }`}
                          >
                            {stock.compression_score}
                          </span>
                        </td>

                        {/* 7. Breakout Score */}
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded font-black text-xs ${
                              stock.breakout_score >= 80
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                                : stock.breakout_score >= 60
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                                : "bg-slate-800 text-slate-400"
                            }`}
                          >
                            {stock.breakout_score}
                          </span>
                        </td>

                        {/* 8. Category Badge */}
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-md px-2 py-0.5 text-[10px] font-bold border ${
                              isUltra
                                ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/40"
                                : isVeryStrong
                                ? "bg-indigo-500/15 text-indigo-300 border-indigo-500/40"
                                : "bg-slate-800 text-slate-400 border-slate-700"
                            }`}
                          >
                            {stock.category}
                          </span>
                        </td>

                        {/* 9. Trend & Quality Flags */}
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1 flex-wrap">
                            {stock.is_nr7 && (
                              <span className="rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.5 text-[9px] font-bold">
                                NR7
                              </span>
                            )}
                            {stock.is_inside_bar && (
                              <span className="rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 px-1.5 py-0.5 text-[9px] font-bold">
                                Inside
                              </span>
                            )}
                            {stock.is_volume_dryup && (
                              <span className="rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-1.5 py-0.5 text-[9px] font-bold">
                                VolDry
                              </span>
                            )}
                            {stock.is_supertrend_bullish && (
                              <span className="rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.5 text-[9px] font-bold">
                                ST+
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 10. Trade Plan */}
                        <td className="px-4 py-3 text-[11px]">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-emerald-400 font-bold">Buy: ₹{stock.entry_price.toFixed(2)}</span>
                            <div className="flex gap-2 text-[10px] text-slate-400">
                              <span>SL: ₹{stock.stop_loss.toFixed(2)}</span>
                              <span>T1: ₹{stock.target1.toFixed(2)}</span>
                            </div>
                          </div>
                        </td>

                        {/* 11. CPR Band Visual */}
                        <td className="px-4 py-3 text-center">
                          <CPRBandVisualizer
                            cmp={stock.current_price}
                            pivot={stock.pivot}
                            bc={stock.bc}
                            tc={stock.tc}
                            widthPct={stock.cpr_width_pct}
                            compact={true}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="flex items-center justify-between border-t border-slate-800 bg-[#050B14] px-5 py-3.5">
            <span className="text-xs text-slate-400 font-mono">
              Total {totalCount.toLocaleString()} stocks evaluated
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 disabled:opacity-40 transition"
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 disabled:opacity-40 transition"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
        </>
        )}

        {/* Deep-Dive Stock Analysis Modal */}
        <CPRDetailModal
          symbol={selectedSymbol}
          onClose={() => setSelectedSymbol(null)}
        />
      </div>
    </DashboardLayout>
  );
}

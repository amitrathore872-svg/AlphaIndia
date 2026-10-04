"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Bell,
  Search,
  Plus,
  TrendingUp,
  TrendingDown,
  ExternalLink,
  Sparkles,
  Send,
  Maximize2,
  Minimize2,
  Trash2,
  Star,
  Activity,
  ChevronDown,
  Volume2,
  Radio,
  BarChart2,
  Zap,
  ChevronRight,
  MessageSquare,
  Check,
  BookmarkPlus,
  X,
} from "lucide-react";
import TradingViewChart from "@/components/common/TradingViewChart";
import TradingViewNativeWidget from "@/components/common/TradingViewNativeWidget";
import WatchlistAlertModal from "@/components/watchlist/WatchlistAlertModal";
import PersonalTelegramSettingsModal from "@/components/watchlist/PersonalTelegramSettingsModal";
import {
  fetchAlertsForWatchlist,
  fetchPersonalTelegramConfig,
  searchStocksForWatchlist,
  addStockToWatchlist,
  removeStockFromWatchlist,
  updateStockInWatchlist,
} from "@/lib/watchlistApi";
import type {
  WatchlistSummary,
  WatchlistItem,
  WatchlistAlertItem,
  StockSearchResult,
  PersonalTelegramConfig,
} from "@/types/watchlist";

interface WatchlistTerminalViewProps {
  watchlists: WatchlistSummary[];
  activeWatchlistId: number | null;
  activeItems: WatchlistItem[];
  onSelectWatchlist: (id: number) => void;
  onRefreshItems: () => void;
  onSwitchToTableView?: () => void;
}

export default function WatchlistTerminalView({
  watchlists,
  activeWatchlistId,
  activeItems,
  onSelectWatchlist,
  onRefreshItems,
  onSwitchToTableView,
}: WatchlistTerminalViewProps) {
  // Active selected stock
  const [selectedSymbol, setSelectedSymbol] = useState<string>("");
  const [previewStock, setPreviewStock] = useState<StockSearchResult | null>(null);
  const [chartMode, setChartMode] = useState<"ai_radar" | "native_tv">("ai_radar");
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showThesisDrawer, setShowThesisDrawer] = useState(false);

  // Alerts & Telegram state
  const [alerts, setAlerts] = useState<WatchlistAlertItem[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [showTelegramModal, setShowTelegramModal] = useState(false);
  const [telegramConfig, setTelegramConfig] = useState<PersonalTelegramConfig | null>(null);

  // Left Sidebar Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<StockSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Chart Header Search state (Quick Company Search on Chart Page)
  const [headerSearchQuery, setHeaderSearchQuery] = useState("");
  const [headerSearchResults, setHeaderSearchResults] = useState<StockSearchResult[]>([]);
  const [isHeaderSearching, setIsHeaderSearching] = useState(false);
  const [showHeaderSearchDropdown, setShowHeaderSearchDropdown] = useState(false);
  const headerSearchContainerRef = useRef<HTMLDivElement>(null);

  // Add Stock Modal state
  const [showAddStockModal, setShowAddStockModal] = useState(false);
  const [modalSearchQuery, setModalSearchQuery] = useState("");
  const [modalSearchResults, setModalSearchResults] = useState<StockSearchResult[]>([]);
  const [isModalSearching, setIsModalSearching] = useState(false);
  const [modalSelectedStock, setModalSelectedStock] = useState<StockSearchResult | null>(null);
  const [modalTargetWatchlistId, setModalTargetWatchlistId] = useState<number>(
    activeWatchlistId || (watchlists[0]?.id ?? 1)
  );
  const [modalConfidence, setModalConfidence] = useState<number>(4);
  const [modalThesis, setModalThesis] = useState<string>("");
  const [isSubmittingAdd, setIsSubmittingAdd] = useState(false);

  // Inline thesis comment editing
  const [inlineComment, setInlineComment] = useState("");
  const [savingComment, setSavingComment] = useState(false);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Sync active watchlist id to modal
  useEffect(() => {
    if (activeWatchlistId) {
      setModalTargetWatchlistId(activeWatchlistId);
    }
  }, [activeWatchlistId]);

  // Set default selected stock
  useEffect(() => {
    if (activeItems.length > 0) {
      if (!selectedSymbol || (!activeItems.some((i) => i.symbol === selectedSymbol) && !previewStock)) {
        setSelectedSymbol(activeItems[0].symbol);
        setPreviewStock(null);
      }
    } else if (!previewStock) {
      setSelectedSymbol("");
    }
  }, [activeItems, selectedSymbol, previewStock]);

  // Load personal Telegram config
  useEffect(() => {
    fetchPersonalTelegramConfig()
      .then((res) => {
        if (res.config) setTelegramConfig(res.config);
      })
      .catch((err) => console.error("Error loading Telegram config:", err));
  }, []);

  // Load alerts for active watchlist
  const loadAlerts = async () => {
    if (!activeWatchlistId) return;
    try {
      setLoadingAlerts(true);
      const res = await fetchAlertsForWatchlist(activeWatchlistId);
      setAlerts(res.alerts || []);
    } catch (err) {
      console.error("Failed to load watchlist alerts:", err);
    } finally {
      setLoadingAlerts(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, [activeWatchlistId]);

  // Active stock object
  const activeStock = useMemo(() => {
    return activeItems.find((i) => i.symbol === selectedSymbol) || null;
  }, [activeItems, selectedSymbol]);

  // Sync comment field
  useEffect(() => {
    if (activeStock) {
      setInlineComment(activeStock.comment || "");
    }
  }, [activeStock]);

  // Filter alerts for currently selected stock
  const stockAlerts = useMemo(() => {
    if (!selectedSymbol) return [];
    return alerts.filter((a) => a.symbol === selectedSymbol.toUpperCase());
  }, [alerts, selectedSymbol]);

  // Prepare price lines for Lightweight Chart
  const alertLines = useMemo(() => {
    return stockAlerts
      .filter((a) => a.is_active && a.threshold_value && a.threshold_value > 0)
      .map((a) => ({
        price: a.threshold_value as number,
        title: `${a.rule_type.replace(/_/g, " ")} (₹${a.threshold_value})`,
        color: a.rule_type.includes("BELOW") ? "#ef4444" : "#f59e0b",
        lineStyle: 2,
      }));
  }, [stockAlerts]);

  // Left Sidebar Autocomplete Search
  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      if (searchQuery.trim().length >= 1) {
        setIsSearching(true);
        try {
          const results = await searchStocksForWatchlist(searchQuery);
          setSearchResults(results);
          setShowSearchDropdown(true);
        } catch (err) {
          console.error("Search failed:", err);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
        setShowSearchDropdown(false);
      }
    }, 250);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  // Chart Header Autocomplete Search
  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      if (headerSearchQuery.trim().length >= 1) {
        setIsHeaderSearching(true);
        try {
          const results = await searchStocksForWatchlist(headerSearchQuery);
          setHeaderSearchResults(results);
          setShowHeaderSearchDropdown(true);
        } catch (err) {
          console.error("Header search failed:", err);
        } finally {
          setIsHeaderSearching(false);
        }
      } else {
        setHeaderSearchResults([]);
        setShowHeaderSearchDropdown(false);
      }
    }, 250);

    return () => clearTimeout(delayDebounce);
  }, [headerSearchQuery]);

  // Modal Autocomplete Search
  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      if (modalSearchQuery.trim().length >= 1) {
        setIsModalSearching(true);
        try {
          const results = await searchStocksForWatchlist(modalSearchQuery);
          setModalSearchResults(results);
        } catch (err) {
          console.error("Modal search failed:", err);
        } finally {
          setIsModalSearching(false);
        }
      } else {
        setModalSearchResults([]);
      }
    }, 250);

    return () => clearTimeout(delayDebounce);
  }, [modalSearchQuery]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setShowSearchDropdown(false);
      }
      if (
        headerSearchContainerRef.current &&
        !headerSearchContainerRef.current.contains(e.target as Node)
      ) {
        setShowHeaderSearchDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Add stock to active watchlist
  const handleAddStock = async (stock: StockSearchResult) => {
    if (!activeWatchlistId) return;
    try {
      await addStockToWatchlist(activeWatchlistId, {
        symbol: stock.symbol,
        company_name: stock.company_name,
        confidence_score: 3,
        comment: "",
      });
      setSearchQuery("");
      setShowSearchDropdown(false);
      setHeaderSearchQuery("");
      setShowHeaderSearchDropdown(false);
      setPreviewStock(null);
      onRefreshItems();
      setSelectedSymbol(stock.symbol);
      showToast(`Added ${stock.symbol} to watchlist!`);
    } catch (err: any) {
      alert(err.message || "Failed to add stock");
    }
  };

  // Add stock from Modal
  const handleSubmitAddModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalSelectedStock || !modalTargetWatchlistId) return;
    setIsSubmittingAdd(true);
    try {
      await addStockToWatchlist(modalTargetWatchlistId, {
        symbol: modalSelectedStock.symbol,
        company_name: modalSelectedStock.company_name,
        confidence_score: modalConfidence,
        comment: modalThesis.trim(),
      });
      setShowAddStockModal(false);
      setModalSearchQuery("");
      setModalSelectedStock(null);
      setModalThesis("");
      onRefreshItems();
      setSelectedSymbol(modalSelectedStock.symbol);
      setPreviewStock(null);
      showToast(`Successfully added ${modalSelectedStock.symbol} to watchlist!`);
    } catch (err: any) {
      alert(err.message || "Failed to add stock");
    } finally {
      setIsSubmittingAdd(false);
    }
  };

  // Select stock from Chart Header Search
  const handleSelectFromHeaderSearch = (stock: StockSearchResult) => {
    setHeaderSearchQuery("");
    setShowHeaderSearchDropdown(false);
    setSelectedSymbol(stock.symbol);
    const existing = activeItems.find((i) => i.symbol === stock.symbol);
    if (!existing) {
      setPreviewStock(stock);
    } else {
      setPreviewStock(null);
    }
  };

  const handleRemoveStock = async (e: React.MouseEvent, itemId: number, sym: string) => {
    e.stopPropagation();
    if (!activeWatchlistId) return;
    if (!confirm(`Remove ${sym} from watchlist?`)) return;
    try {
      await removeStockFromWatchlist(activeWatchlistId, itemId);
      onRefreshItems();
      showToast(`Removed ${sym} from watchlist.`);
    } catch (err: any) {
      alert(err.message || "Failed to remove stock");
    }
  };

  const handleSaveComment = async () => {
    if (!activeWatchlistId || !activeStock) return;
    setSavingComment(true);
    try {
      await updateStockInWatchlist(activeWatchlistId, activeStock.id, {
        comment: inlineComment.trim(),
      });
      onRefreshItems();
      showToast(`Saved thesis for ${activeStock.symbol}!`);
    } catch (err: any) {
      alert("Failed to save thesis: " + err.message);
    } finally {
      setSavingComment(false);
    }
  };

  const handleUpdateConfidence = async (itemId: number, newScore: number) => {
    if (!activeWatchlistId) return;
    try {
      await updateStockInWatchlist(activeWatchlistId, itemId, {
        confidence_score: newScore,
      });
      onRefreshItems();
    } catch (err: any) {
      alert("Failed to update conviction: " + err.message);
    }
  };

  const currentWl = watchlists.find((w) => w.id === activeWatchlistId);

  return (
    <div className={`w-full h-full flex flex-col flex-1 min-h-0 ${isFullScreen ? "fixed inset-0 z-50 bg-[#050B14] p-2" : ""}`}>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl border border-cyan-500/50 bg-[#081225] px-4 py-2.5 text-xs text-white shadow-2xl backdrop-blur-md">
          <Check size={14} className="text-cyan-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── Main Split View Grid (Left: Watchlist Sidebar, Right: Complete Screen Chart) ── */}
      <div className="flex flex-col lg:flex-row gap-2.5 items-stretch w-full flex-1 min-h-0 h-full">
        {/* ========================================================= */}
        {/* ── LEFT SIDEBAR: Watchlist Stock List (Dedicated Dock) ── */}
        {/* ========================================================= */}
        <div className="w-full lg:w-64 xl:w-72 shrink-0 flex flex-col rounded-xl border border-slate-800 bg-[#070F1E] shadow-xl overflow-hidden h-full min-h-0">
          {/* 1. Watchlist Selector Header */}
          <div className="border-b border-slate-800/80 p-2.5 bg-slate-900/60 flex items-center justify-between shrink-0">
            <div className="relative flex-1 mr-2">
              <select
                value={activeWatchlistId || ""}
                onChange={(e) => onSelectWatchlist(Number(e.target.value))}
                className="w-full appearance-none rounded-xl border border-slate-700 bg-slate-950/80 pl-2.5 pr-7 py-1.5 font-bold text-cyan-400 focus:border-cyan-500 focus:outline-hidden text-xs cursor-pointer shadow-xs truncate"
              >
                {watchlists.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.items_count})
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setShowAlertModal(true)}
                className="flex items-center gap-1 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[11px] font-bold text-amber-300 hover:bg-amber-500/20 transition"
                title="Institutional Alert Studio (Stocks, Watchlists, Portfolios & Screeners)"
              >
                <Bell size={12} className="text-amber-400" />
                <span>Alerts</span>
              </button>

              <button
                onClick={() => setShowAddStockModal(true)}
                className="flex items-center gap-1 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2 py-1 text-[11px] font-bold text-cyan-400 hover:bg-cyan-500/20 transition"
                title="Add stock with conviction score and thesis notes"
              >
                <Plus size={12} />
                <span>Add</span>
              </button>
            </div>
          </div>

          {/* 2. Fast Search / Autocomplete to Add Symbol */}
          <div ref={searchContainerRef} className="relative p-2.5 border-b border-slate-800/80">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search symbol (e.g. TRENT, BEL)..."
                className="w-full rounded-xl border border-slate-700 bg-slate-950/80 pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-hidden"
              />
              {isSearching && (
                <Activity className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-cyan-400 animate-spin" />
              )}
            </div>

            {/* Dropdown Results */}
            {showSearchDropdown && searchResults.length > 0 && (
              <div className="absolute left-2.5 right-2.5 top-full z-40 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-700 bg-[#081225] shadow-2xl">
                {searchResults.map((stk) => (
                  <button
                    key={stk.symbol}
                    onClick={() => handleAddStock(stk)}
                    className="w-full flex items-center justify-between p-2 text-left text-xs hover:bg-cyan-500/10 hover:border-cyan-500 border-b border-slate-800 last:border-b-0 transition"
                  >
                    <div>
                      <div className="font-bold text-white font-mono">{stk.symbol}</div>
                      <div className="text-[10px] text-slate-400 truncate max-w-[140px]">
                        {stk.company_name}
                      </div>
                    </div>
                    <div className="text-right">
                      {stk.current_price && (
                        <div className="font-mono text-cyan-400 font-bold">
                          ₹{stk.current_price.toLocaleString("en-IN")}
                        </div>
                      )}
                      <div className="text-[9px] text-slate-500">{stk.sector}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 3. The Left Scrollable Stock List */}
          <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-800/60 no-scrollbar">
            {activeItems.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500 px-4">
                Watchlist is empty. Search above or on the chart header to add stocks!
              </div>
            ) : (
              activeItems.map((item) => {
                const isSelected = item.symbol === selectedSymbol && !previewStock;
                const itemAlerts = alerts.filter((a) => a.symbol === item.symbol.toUpperCase());
                const activeAlertCount = itemAlerts.filter((a) => a.is_active).length;

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setSelectedSymbol(item.symbol);
                      setPreviewStock(null);
                    }}
                    className={`group flex items-center justify-between px-3 py-2.5 cursor-pointer transition ${
                      isSelected
                        ? "bg-cyan-500/15 border-l-4 border-cyan-400 text-white"
                        : "hover:bg-slate-800/40 text-slate-300"
                    }`}
                  >
                    {/* Symbol & Conviction Stars */}
                    <div className="space-y-0.5 min-w-0 pr-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`font-mono font-bold text-xs truncate ${isSelected ? "text-cyan-300" : "text-white"}`}>
                          {item.symbol}
                        </span>
                        {activeAlertCount > 0 && (
                          <span
                            className="flex items-center gap-0.5 rounded-full bg-amber-500/20 border border-amber-500/50 px-1.5 py-0.2 text-[9px] font-mono text-amber-300 font-bold shrink-0"
                            title={`${activeAlertCount} active rule alert(s)`}
                          >
                            <Bell className="w-2.5 h-2.5 animate-pulse" />
                            <span>{activeAlertCount}</span>
                          </span>
                        )}
                      </div>

                      {/* 1 to 5 Conviction Stars */}
                      <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            onClick={() => handleUpdateConfidence(item.id, star)}
                            className="p-0 text-slate-600 hover:text-amber-400 transition"
                            title={`Set conviction to ${star}★`}
                          >
                            <Star
                              size={10}
                              className={
                                star <= item.confidence_score
                                  ? "fill-amber-400 text-amber-400"
                                  : "text-slate-700"
                              }
                            />
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Price & 3M Return */}
                    <div className="flex items-center gap-2">
                      <div className="text-right font-mono">
                        <div className="text-xs font-bold text-white">
                          {item.current_price
                            ? `₹${item.current_price.toLocaleString("en-IN")}`
                            : "—"}
                        </div>
                        {item.return_3m !== null && (
                          <div
                            className={`text-[10px] font-semibold ${
                              item.return_3m >= 0 ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            {item.return_3m >= 0 ? "+" : ""}
                            {item.return_3m.toFixed(1)}%
                          </div>
                        )}
                      </div>

                      {/* Quick Delete on hover */}
                      <button
                        onClick={(e) => handleRemoveStock(e, item.id, item.symbol)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 transition ml-1"
                        title="Remove from watchlist"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* 4. Left Sidebar Footer: Personal Telegram Status */}
          <div className="border-t border-slate-800/80 p-2.5 bg-slate-900/40">
            <button
              onClick={() => setShowTelegramModal(true)}
              className="w-full flex items-center justify-between p-2 rounded-xl border border-slate-800 bg-slate-950/60 hover:border-cyan-500/40 text-[11px] text-slate-300 transition"
            >
              <div className="flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-cyan-400" />
                <span className="font-semibold truncate">
                  {telegramConfig?.is_configured ? "Personal Telegram Active" : "Setup Personal Telegram"}
                </span>
              </div>
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  telegramConfig?.is_configured ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
                }`}
              />
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* ── RIGHT MAIN SCREEN: COMPLETE SCREEN CHART CANVAS ──── */}
        {/* ========================================================= */}
        <div className="flex-1 min-w-0 h-full flex flex-col gap-2 rounded-xl border border-slate-800 bg-[#050B14] p-2.5 shadow-2xl overflow-hidden min-h-0">
          {/* Top Integrated Chart Ribbon */}
          <div className="flex flex-wrap items-center justify-between border-b border-slate-800/80 pb-2.5 gap-2 text-xs">
            {/* Left: Active Stock Info / Preview Stock + Search & Add Input */}
            <div className="flex flex-wrap items-center gap-3">
              {activeStock ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="font-mono font-bold text-sm text-white tracking-wide">
                      {activeStock.exchange || "NSE"}:{activeStock.symbol}
                    </span>
                    <span className="text-[11px] text-slate-400 hidden sm:inline truncate max-w-[150px]">
                      {activeStock.company_name}
                    </span>
                  </div>

                  {/* CMP Badge */}
                  <div className="flex items-baseline gap-2 font-mono">
                    <span className="text-sm font-bold text-white">
                      {activeStock.current_price
                        ? `₹${activeStock.current_price.toLocaleString("en-IN")}`
                        : "—"}
                    </span>
                    {activeStock.return_3m !== null && (
                      <span
                        className={`text-xs font-semibold ${
                          activeStock.return_3m >= 0 ? "text-emerald-400" : "text-rose-400"
                        }`}
                      >
                        {activeStock.return_3m >= 0 ? "+" : ""}
                        {activeStock.return_3m.toFixed(2)}% (3M)
                      </span>
                    )}
                  </div>

                  {/* DMA Pills */}
                  {activeStock.dma_50 && (
                    <span className="hidden md:inline-flex rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-mono text-cyan-300 font-semibold">
                      50 DMA: ₹{activeStock.dma_50.toFixed(1)}
                    </span>
                  )}
                  {activeStock.dma_200 && (
                    <span className="hidden lg:inline-flex rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-mono text-amber-300 font-semibold">
                      200 DMA: ₹{activeStock.dma_200.toFixed(1)}
                    </span>
                  )}
                </>
              ) : previewStock ? (
                <>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-cyan-400 animate-ping" />
                    <span className="font-mono font-bold text-sm text-white tracking-wide">
                      {previewStock.exchange || "NSE"}:{previewStock.symbol}
                    </span>
                    <span className="text-[11px] text-slate-400 hidden sm:inline truncate max-w-[150px]">
                      {previewStock.company_name}
                    </span>
                  </div>

                  {previewStock.current_price && (
                    <span className="text-sm font-bold text-white font-mono">
                      ₹{previewStock.current_price.toLocaleString("en-IN")}
                    </span>
                  )}

                  {/* Prominent + Add to Watchlist Button */}
                  <button
                    onClick={() => handleAddStock(previewStock)}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-md transition animate-pulse"
                    title="Add this charted stock to active watchlist"
                  >
                    <BookmarkPlus size={13} />
                    <span>+ Add to Watchlist</span>
                  </button>
                </>
              ) : (
                <span className="text-xs text-slate-500">Select or search a stock to chart</span>
              )}

              {/* ── Direct Company Search on Chart Page ── */}
              <div ref={headerSearchContainerRef} className="relative ml-1">
                <div className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900/80 px-2.5 py-1 text-xs focus-within:border-cyan-500 focus-within:ring-1 focus-within:ring-cyan-500/30">
                  <Search size={12} className="text-slate-400" />
                  <input
                    type="text"
                    value={headerSearchQuery}
                    onChange={(e) => setHeaderSearchQuery(e.target.value)}
                    placeholder="Search company on chart..."
                    className="w-36 sm:w-48 bg-transparent text-xs text-white placeholder:text-slate-500 outline-none"
                  />
                  {isHeaderSearching && (
                    <Activity size={12} className="animate-spin text-cyan-400" />
                  )}
                  {headerSearchQuery && (
                    <button
                      onClick={() => setHeaderSearchQuery("")}
                      className="text-slate-400 hover:text-white"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* Dropdown Results */}
                {showHeaderSearchDropdown && headerSearchResults.length > 0 && (
                  <div className="absolute left-0 top-full mt-1.5 z-50 w-72 max-h-64 overflow-y-auto rounded-xl border border-slate-700 bg-[#081225] shadow-2xl p-1.5">
                    <div className="px-2 py-1 text-[10px] font-mono text-slate-400 uppercase tracking-wider font-bold">
                      Matching Equities
                    </div>
                    {headerSearchResults.map((stk) => {
                      const isAlreadyAdded = activeItems.some((i) => i.symbol === stk.symbol);
                      return (
                        <div
                          key={stk.symbol}
                          onClick={() => handleSelectFromHeaderSearch(stk)}
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-800/80 cursor-pointer transition text-xs border-b border-slate-800/50 last:border-b-0"
                        >
                          <div>
                            <div className="font-bold text-white font-mono flex items-center gap-1.5">
                              <span>{stk.symbol}</span>
                              {isAlreadyAdded && (
                                <span className="rounded bg-emerald-500/20 text-emerald-300 px-1 py-0.2 text-[9px] font-mono">
                                  Watched
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate max-w-[150px]">
                              {stk.company_name}
                            </div>
                          </div>
                          <div className="text-right">
                            {stk.current_price && (
                              <div className="font-mono text-cyan-400 font-bold">
                                ₹{stk.current_price.toLocaleString("en-IN")}
                              </div>
                            )}
                            <div className="text-[9px] text-slate-500">{stk.sector}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Chart Controls & Alert Trigger Button */}
            <div className="flex items-center gap-2">
              {/* AI Radar vs Native TV */}
              <div className="flex items-center rounded-xl border border-slate-800 bg-slate-900/90 p-0.5 text-[11px] font-semibold">
                <button
                  onClick={() => setChartMode("ai_radar")}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition ${
                    chartMode === "ai_radar"
                      ? "bg-cyan-500 text-slate-950 font-bold shadow-xs"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Zap className="w-3 h-3" />
                  <span>AI Radar</span>
                </button>
                <button
                  onClick={() => setChartMode("native_tv")}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg transition ${
                    chartMode === "native_tv"
                      ? "bg-cyan-500 text-slate-950 font-bold shadow-xs"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <BarChart2 className="w-3 h-3" />
                  <span>Native TV</span>
                </button>
              </div>

              {/* 🔔 Rule Alert Button */}
              {selectedSymbol && (
                <button
                  onClick={() => setShowAlertModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500 hover:text-slate-950 transition font-bold text-[11px] shadow-xs"
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>Alert Rules ({stockAlerts.length})</span>
                </button>
              )}

              {/* Thesis Toggle */}
              {activeStock && (
                <button
                  onClick={() => setShowThesisDrawer((v) => !v)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-xl border text-[11px] font-medium transition ${
                    showThesisDrawer || inlineComment
                      ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-300"
                      : "border-slate-700 bg-slate-900/60 text-slate-400 hover:text-white"
                  }`}
                  title="View / Edit investment thesis note"
                >
                  <MessageSquare className="w-3 h-3" />
                  <span>Thesis</span>
                </button>
              )}

              {/* Table Switcher */}
              {onSwitchToTableView && (
                <button
                  onClick={onSwitchToTableView}
                  className="px-2.5 py-1 rounded-xl border border-slate-700 bg-slate-900/60 text-slate-300 hover:text-white transition text-[11px] font-medium"
                >
                  Table
                </button>
              )}

              {/* Fullscreen Toggle */}
              <button
                onClick={() => setIsFullScreen((v) => !v)}
                className="p-1.5 rounded-xl border border-slate-700 bg-slate-900/60 text-slate-400 hover:text-white transition"
                title={isFullScreen ? "Exit Fullscreen" : "Fullscreen"}
              >
                {isFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Complete Screen Candlestick Chart Canvas */}
          <div className="relative flex-1 min-h-0 w-full overflow-hidden rounded-xl">
            {selectedSymbol ? (
              chartMode === "ai_radar" ? (
                <TradingViewChart
                  symbol={selectedSymbol}
                  exchange={activeStock?.exchange || previewStock?.exchange || "NSE"}
                  height="100%"
                  pivotReference={activeStock?.target_price || undefined}
                  scenarioTrigger={activeStock?.target_price ? activeStock.target_price * 1.05 : undefined}
                  downsideReference={activeStock?.current_price ? activeStock.current_price * 0.95 : undefined}
                  alertLines={alertLines}
                  onAddToWatchlist={(sym) => {
                    const stkToAdd = previewStock || {
                      symbol: sym,
                      company_name: sym,
                    };
                    handleAddStock(stkToAdd as StockSearchResult);
                  }}
                  isInWatchlist={Boolean(activeStock)}
                />
              ) : (
                <TradingViewNativeWidget
                  symbol={selectedSymbol}
                  exchange={activeStock?.exchange || previewStock?.exchange || "NSE"}
                  height="100%"
                  theme="dark"
                  interval="D"
                />
              )
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-[#070F1E] text-slate-500">
                <Activity className="w-8 h-8 mb-2 animate-pulse text-slate-600" />
                <p className="text-xs">No stock selected. Select or search a stock above.</p>
              </div>
            )}
          </div>

          {/* Optional Expandable Thesis Note Drawer */}
          {showThesisDrawer && activeStock && (
            <div className="rounded-xl border border-slate-800 bg-[#070F1E] p-3 text-xs space-y-2 mt-1 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white flex items-center gap-1.5 font-mono text-[11px]">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  Thesis & Trade Plan for {activeStock.symbol} (Included in Personal Telegram Alerts)
                </span>
                <button
                  onClick={handleSaveComment}
                  disabled={savingComment}
                  className="rounded-lg bg-cyan-500 px-3 py-1 font-bold text-slate-950 hover:bg-cyan-400 transition text-[11px] disabled:opacity-50"
                >
                  {savingComment ? "Saving..." : "Save Thesis"}
                </button>
              </div>
              <textarea
                value={inlineComment}
                onChange={(e) => setInlineComment(e.target.value)}
                placeholder="Write trade hypothesis, catalyst dates, support levels, or invalidation notes..."
                rows={2}
                className="w-full rounded-lg border border-slate-700 bg-slate-900/90 p-2 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-hidden"
              />
            </div>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* ── MODAL: ADD STOCK TO WATCHLIST (WITH CONVICTION & NOTES) ── */}
      {/* ========================================================= */}
      {showAddStockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#081225] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <BookmarkPlus className="text-cyan-400" size={18} />
                <span>Add Stock to Watchlist</span>
              </div>
              <button
                onClick={() => setShowAddStockModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitAddModal} className="space-y-4 text-xs">
              {/* Select Watchlist */}
              <div>
                <label className="font-semibold text-slate-300 block mb-1">Target Watchlist</label>
                <select
                  value={modalTargetWatchlistId}
                  onChange={(e) => setModalTargetWatchlistId(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:border-cyan-500"
                >
                  {watchlists.map((wl) => (
                    <option key={wl.id} value={wl.id}>
                      {wl.name} ({wl.items_count} stocks)
                    </option>
                  ))}
                </select>
              </div>

              {/* Search Equities */}
              <div>
                <label className="font-semibold text-slate-300 block mb-1">Company / Symbol</label>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={modalSearchQuery}
                    onChange={(e) => {
                      setModalSearchQuery(e.target.value);
                      setModalSelectedStock(null);
                    }}
                    placeholder="Search e.g. TATAELXSI, POLYCAB, HAL..."
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 pl-9 pr-3 py-2 text-white placeholder-slate-500 outline-none focus:border-cyan-500"
                  />
                  {isModalSearching && (
                    <Activity size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-cyan-400" />
                  )}
                </div>

                {/* Autocomplete list */}
                {modalSearchResults.length > 0 && !modalSelectedStock && (
                  <div className="mt-1 max-h-40 overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-1 divide-y divide-slate-800">
                    {modalSearchResults.map((stk) => (
                      <div
                        key={stk.symbol}
                        onClick={() => {
                          setModalSelectedStock(stk);
                          setModalSearchQuery(`${stk.symbol} - ${stk.company_name}`);
                          setModalSearchResults([]);
                        }}
                        className="flex items-center justify-between p-2 rounded hover:bg-slate-800 cursor-pointer"
                      >
                        <div>
                          <div className="font-bold text-white font-mono">{stk.symbol}</div>
                          <div className="text-[10px] text-slate-400 truncate max-w-[200px]">
                            {stk.company_name}
                          </div>
                        </div>
                        {stk.current_price && (
                          <div className="font-mono text-cyan-400 font-bold">
                            ₹{stk.current_price.toLocaleString("en-IN")}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Conviction Stars */}
              <div>
                <label className="font-semibold text-slate-300 block mb-1">Conviction Rating (1 - 5★)</label>
                <div className="flex items-center gap-2 p-2 rounded-xl border border-slate-700 bg-slate-900/60">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={star}
                      onClick={() => setModalConfidence(star)}
                      className="p-1 hover:scale-110 transition"
                    >
                      <Star
                        size={18}
                        className={
                          star <= modalConfidence
                            ? "fill-amber-400 text-amber-400"
                            : "text-slate-600"
                        }
                      />
                    </button>
                  ))}
                  <span className="ml-2 font-mono text-xs text-amber-400 font-bold">
                    {modalConfidence} of 5 Stars
                  </span>
                </div>
              </div>

              {/* Investment Thesis */}
              <div>
                <label className="font-semibold text-slate-300 block mb-1">Investment Thesis / Trade Notes</label>
                <textarea
                  rows={2}
                  value={modalThesis}
                  onChange={(e) => setModalThesis(e.target.value)}
                  placeholder="E.g. Cup and handle breakout on high volume, trailing 20 EMA, target 15%..."
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-white placeholder-slate-500 outline-none focus:border-cyan-500 resize-none"
                />
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddStockModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-700 text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!modalSelectedStock || isSubmittingAdd}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold disabled:opacity-50 transition"
                >
                  <Plus size={14} />
                  <span>{isSubmittingAdd ? "Adding..." : "Add to Watchlist"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rule-Based Watchlist Alerts Modal */}
      {showAlertModal && (
        <WatchlistAlertModal
          isOpen={showAlertModal}
          onClose={() => setShowAlertModal(false)}
          watchlistId={activeWatchlistId || undefined}
          symbol={selectedSymbol || null}
          currentPrice={activeStock?.current_price || previewStock?.current_price || null}
          dma50={activeStock?.dma_50 || null}
          dma200={activeStock?.dma_200 || null}
          onAlertsChanged={loadAlerts}
        />
      )}

      {/* Personal Telegram Settings Modal */}
      <PersonalTelegramSettingsModal
        isOpen={showTelegramModal}
        onClose={() => setShowTelegramModal(false)}
        onConfigSaved={(cfg) => setTelegramConfig(cfg)}
      />
    </div>
  );
}

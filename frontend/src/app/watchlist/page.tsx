"use client";

// =======================================================
// Alpha India Multi-Watchlist Builder
// Institutional Conviction Radar, Confidence Ranking (1-5),
// Inline Investment Thesis Notes & Live Market Fundamentals
// =======================================================

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Star,
  Plus,
  Trash2,
  Edit3,
  Search,
  TrendingUp,
  ShieldCheck,
  FolderPlus,
  ArrowUpDown,
  Check,
  X,
} from "lucide-react";

import DashboardLayout from "@/components/layout/DashboardLayout";
import {
  fetchWatchlists,
  fetchWatchlist,
  createWatchlist,
  updateWatchlist,
  deleteWatchlist,
  searchStocksForWatchlist,
  addStockToWatchlist,
  updateStockInWatchlist,
  removeStockFromWatchlist,
} from "@/lib/watchlistApi";
import type {
  WatchlistSummary,
  WatchlistItem,
  StockSearchResult,
} from "@/types/watchlist";

export default function WatchlistPage() {
  // Watchlists state
  const [watchlists, setWatchlists] = useState<WatchlistSummary[]>([]);
  const [activeWatchlistId, setActiveWatchlistId] = useState<number | null>(null);
  const [activeItems, setActiveItems] = useState<WatchlistItem[]>([]);
  const [activeSummary, setActiveSummary] = useState<{
    items_count: number;
    avg_confidence: number;
    avg_roce: number | null;
    high_conviction_count: number;
  } | null>(null);

  const [loadingWatchlists, setLoadingWatchlists] = useState(true);
  const [loadingItems, setLoadingItems] = useState(false);

  // Search & Add state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<StockSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // In-table search & filter
  const [tableSearch, setTableSearch] = useState("");
  const [confidenceFilter, setConfidenceFilter] = useState<number | "ALL">("ALL");
  const [sortBy, setSortBy] = useState<"confidence" | "roce" | "cmp" | "symbol">("confidence");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Inline comment editing states (map of itemId -> saved state)
  const [editingComments, setEditingComments] = useState<Record<number, string>>({});
  const [savedStatus, setSavedStatus] = useState<Record<number, boolean>>({});

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newWlName, setNewWlName] = useState("");
  const [newWlDesc, setNewWlDesc] = useState("");
  const [newWlColor, setNewWlColor] = useState("cyan");

  const [showEditModal, setShowEditModal] = useState(false);
  const [editWlName, setEditWlName] = useState("");
  const [editWlDesc, setEditWlDesc] = useState("");
  const [editWlColor, setEditWlColor] = useState("cyan");

  const [actionLoading, setActionLoading] = useState(false);

  // -----------------------------------------------------
  // 1. Fetch all watchlists on load
  // -----------------------------------------------------
  const loadWatchlists = useCallback(async (selectId?: number) => {
    try {
      setLoadingWatchlists(true);
      const res = await fetchWatchlists();
      setWatchlists(res.watchlists);

      if (res.watchlists.length > 0) {
        const nextId =
          selectId ||
          (activeWatchlistId && res.watchlists.some((w) => w.id === activeWatchlistId)
            ? activeWatchlistId
            : res.watchlists[0].id);
        setActiveWatchlistId(nextId);
      }
    } catch (err) {
      console.error("Failed to load watchlists:", err);
    } finally {
      setLoadingWatchlists(false);
    }
  }, [activeWatchlistId]);

  useEffect(() => {
    loadWatchlists();
  }, [loadWatchlists]);

  // -----------------------------------------------------
  // 2. Fetch items for active watchlist
  // -----------------------------------------------------
  const loadActiveWatchlist = useCallback(async (id: number) => {
    try {
      setLoadingItems(true);
      const res = await fetchWatchlist(id);
      setActiveItems(res.items);
      setActiveSummary(res.summary);

      // Initialize comment state cache
      const commentMap: Record<number, string> = {};
      res.items.forEach((item) => {
        commentMap[item.id] = item.comment || "";
      });
      setEditingComments(commentMap);
    } catch (err) {
      console.error("Failed to load watchlist items:", err);
    } finally {
      setLoadingItems(false);
    }
  }, []);

  useEffect(() => {
    if (activeWatchlistId) {
      loadActiveWatchlist(activeWatchlistId);
    }
  }, [activeWatchlistId, loadActiveWatchlist]);

  // -----------------------------------------------------
  // 3. Stock Autocomplete Search
  // -----------------------------------------------------
  useEffect(() => {
    const delayDebounce = setTimeout(async () => {
      if (searchQuery.trim().length >= 1) {
        setIsSearching(true);
        try {
          const results = await searchStocksForWatchlist(searchQuery.trim(), 10);
          setSearchResults(results);
          setShowSearchDropdown(true);
        } catch (err) {
          console.error("Stock search error:", err);
        } finally {
          setIsSearching(false);
        }
      } else {
        setSearchResults([]);
        setShowSearchDropdown(false);
      }
    }, 200);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  // Close search dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setShowSearchDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // -----------------------------------------------------
  // 4. Add Stock to Active Watchlist
  // -----------------------------------------------------
  const handleAddStock = async (stock: StockSearchResult) => {
    if (!activeWatchlistId) return;
    try {
      setActionLoading(true);
      const res = await addStockToWatchlist(activeWatchlistId, {
        symbol: stock.symbol,
        company_name: stock.company_name,
        confidence_score: 3,
        comment: "",
      });

      // Optimistic append
      setActiveItems((prev) => [res.item, ...prev]);
      setEditingComments((prev) => ({ ...prev, [res.item.id]: "" }));
      setSearchQuery("");
      setShowSearchDropdown(false);
      loadActiveWatchlist(activeWatchlistId);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add stock");
    } finally {
      setActionLoading(false);
    }
  };

  // -----------------------------------------------------
  // 5. Update Confidence Rating (1 to 5 Stars)
  // -----------------------------------------------------
  const handleSetConfidence = async (itemId: number, newScore: number) => {
    if (!activeWatchlistId) return;

    // Optimistic UI update
    setActiveItems((prev) =>
      prev.map((it) =>
        it.id === itemId ? { ...it, confidence_score: newScore } : it
      )
    );

    try {
      await updateStockInWatchlist(activeWatchlistId, itemId, {
        confidence_score: newScore,
      });
      // Refresh summary averages silently
      loadActiveWatchlist(activeWatchlistId);
    } catch (err) {
      console.error("Failed to update confidence score:", err);
    }
  };

  // -----------------------------------------------------
  // 6. Inline Comment Editing & Auto-Save
  // -----------------------------------------------------
  const handleCommentChange = (itemId: number, text: string) => {
    setEditingComments((prev) => ({ ...prev, [itemId]: text }));
  };

  const handleSaveComment = async (itemId: number) => {
    if (!activeWatchlistId) return;
    const text = editingComments[itemId] || "";

    try {
      await updateStockInWatchlist(activeWatchlistId, itemId, {
        comment: text,
      });

      // Trigger "Saved ✓" badge animation
      setSavedStatus((prev) => ({ ...prev, [itemId]: true }));
      setTimeout(() => {
        setSavedStatus((prev) => ({ ...prev, [itemId]: false }));
      }, 2000);
    } catch (err) {
      console.error("Failed to save comment:", err);
    }
  };

  // -----------------------------------------------------
  // 7. Remove Stock from Watchlist
  // -----------------------------------------------------
  const handleRemoveStock = async (itemId: number, symbol: string) => {
    if (!activeWatchlistId) return;
    if (!confirm(`Remove ${symbol} from this watchlist?`)) return;

    // Optimistic removal
    setActiveItems((prev) => prev.filter((it) => it.id !== itemId));

    try {
      await removeStockFromWatchlist(activeWatchlistId, itemId);
      loadActiveWatchlist(activeWatchlistId);
    } catch (err) {
      console.error("Failed to remove stock:", err);
    }
  };

  // -----------------------------------------------------
  // 8. Create Watchlist
  // -----------------------------------------------------
  const handleCreateWatchlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWlName.trim()) return;

    try {
      setActionLoading(true);
      const res = await createWatchlist({
        name: newWlName.trim(),
        description: newWlDesc.trim(),
        color: newWlColor,
      });

      setNewWlName("");
      setNewWlDesc("");
      setShowCreateModal(false);
      loadWatchlists(res.watchlist.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create watchlist");
    } finally {
      setActionLoading(false);
    }
  };

  // -----------------------------------------------------
  // 9. Edit Watchlist Metadata
  // -----------------------------------------------------
  const openEditModal = () => {
    const active = watchlists.find((w) => w.id === activeWatchlistId);
    if (!active) return;
    setEditWlName(active.name);
    setEditWlDesc(active.description || "");
    setEditWlColor(active.color || "cyan");
    setShowEditModal(true);
  };

  const handleUpdateWatchlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWatchlistId || !editWlName.trim()) return;

    try {
      setActionLoading(true);
      await updateWatchlist(activeWatchlistId, {
        name: editWlName.trim(),
        description: editWlDesc.trim(),
        color: editWlColor,
      });

      setShowEditModal(false);
      loadWatchlists(activeWatchlistId);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update watchlist");
    } finally {
      setActionLoading(false);
    }
  };

  // -----------------------------------------------------
  // 10. Delete Watchlist
  // -----------------------------------------------------
  const handleDeleteWatchlist = async () => {
    const active = watchlists.find((w) => w.id === activeWatchlistId);
    if (!activeWatchlistId || !active) return;
    if (
      !confirm(
        `Are you sure you want to delete the watchlist "${active.name}" and all ${activeItems.length} stocks in it?`
      )
    )
      return;

    try {
      setActionLoading(true);
      await deleteWatchlist(activeWatchlistId);
      loadWatchlists();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete watchlist");
    } finally {
      setActionLoading(false);
    }
  };

  // -----------------------------------------------------
  // 11. In-Table Filter & Sort Logic
  // -----------------------------------------------------
  const filteredAndSortedItems = activeItems
    .filter((it) => {
      // Table search
      if (tableSearch.trim()) {
        const q = tableSearch.toLowerCase();
        const matchSym = it.symbol.toLowerCase().includes(q);
        const matchName = it.company_name.toLowerCase().includes(q);
        const matchSector = it.sector.toLowerCase().includes(q);
        const matchComment = it.comment.toLowerCase().includes(q);
        if (!matchSym && !matchName && !matchSector && !matchComment) return false;
      }
      // Confidence filter
      if (confidenceFilter !== "ALL" && it.confidence_score !== confidenceFilter) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortBy === "confidence") {
        comparison = a.confidence_score - b.confidence_score;
      } else if (sortBy === "roce") {
        comparison = (a.roce ?? -999) - (b.roce ?? -999);
      } else if (sortBy === "cmp") {
        comparison = (a.current_price ?? 0) - (b.current_price ?? 0);
      } else if (sortBy === "symbol") {
        comparison = a.symbol.localeCompare(b.symbol);
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

  const activeWl = watchlists.find((w) => w.id === activeWatchlistId);

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-16">
        {/* ========================================================= */}
        {/* TOP HEADER & WATCHLIST SELECTOR TABS                      */}
        {/* ========================================================= */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#081225]/90 p-6 backdrop-blur-xl shadow-xs dark:shadow-2xl">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            {/* Title & Description */}
            <div>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-500 dark:text-amber-400 shadow-lg shadow-amber-500/10">
                  <Star className="fill-amber-500 dark:fill-amber-400 text-amber-500 dark:text-amber-400" size={20} />
                </div>
                <div>
                  <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                    Multi-Watchlist Radar
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Institutional portfolio tracker with 1-to-5 conviction scoring & thesis notes
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-2.5 text-xs font-bold text-cyan-700 dark:text-cyan-300 transition-all hover:border-cyan-400 hover:bg-cyan-500/20 hover:shadow-lg hover:shadow-cyan-500/10"
              >
                <Plus size={16} />
                <span>NEW WATCHLIST</span>
              </button>

              {activeWl && (
                <>
                  <button
                    onClick={openEditModal}
                    title="Edit watchlist details"
                    className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 px-3 py-2.5 text-xs font-medium text-slate-700 dark:text-slate-300 transition-all hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white shadow-xs"
                  >
                    <Edit3 size={14} />
                    <span>Rename</span>
                  </button>

                  <button
                    onClick={handleDeleteWatchlist}
                    title="Delete watchlist"
                    className="flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-xs font-medium text-rose-600 dark:text-rose-400 transition-all hover:bg-rose-500/20 hover:text-rose-700 dark:hover:text-rose-300 shadow-xs"
                  >
                    <Trash2 size={14} />
                    <span>Delete</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* WATCHLIST TABS */}
          <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-slate-200 dark:border-slate-800/80 pt-5">
            {loadingWatchlists ? (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent" />
                <span>Loading portfolios...</span>
              </div>
            ) : (
              watchlists.map((wl) => {
                const isActive = wl.id === activeWatchlistId;
                return (
                  <button
                    key={wl.id}
                    onClick={() => setActiveWatchlistId(wl.id)}
                    className={`group flex items-center gap-2.5 rounded-xl px-4 py-2.5 text-xs font-bold transition-all ${
                      isActive
                        ? "border border-cyan-500/60 bg-gradient-to-r from-cyan-500/20 to-blue-500/10 text-cyan-700 dark:text-cyan-300 shadow-md shadow-cyan-500/10"
                        : "border border-slate-200 dark:border-slate-800 bg-slate-100/60 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        isActive ? "bg-cyan-500 shadow-sm shadow-cyan-400" : "bg-slate-400 dark:bg-slate-600"
                      }`}
                    />
                    <span>{wl.name}</span>
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[10px] font-mono ${
                        isActive
                          ? "bg-cyan-500/30 text-cyan-800 dark:text-cyan-200"
                          : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-500 group-hover:text-slate-800 dark:group-hover:text-slate-400"
                      }`}
                    >
                      {wl.items_count}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* SUMMARY KPI CARDS                                         */}
        {/* ========================================================= */}
        {activeSummary && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {/* Total Equities */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1528]/80 p-4 shadow-xs backdrop-blur-md">
              <span className="text-[11px] font-bold tracking-wider text-slate-500 dark:text-slate-400 uppercase">
                Watched Equities
              </span>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-900 dark:text-white">
                  {activeSummary.items_count}
                </span>
                <span className="text-xs text-slate-500">stocks</span>
              </div>
            </div>

            {/* Average Conviction / Confidence */}
            <div className="rounded-xl border border-amber-500/20 bg-amber-50/70 dark:bg-amber-500/5 p-4 shadow-xs backdrop-blur-md">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold tracking-wider text-amber-700 dark:text-amber-400 uppercase">
                  Avg Conviction Rank
                </span>
                <Star size={14} className="fill-amber-500 text-amber-500 dark:fill-amber-400 dark:text-amber-400" />
              </div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-amber-600 dark:text-amber-300">
                  {activeSummary.avg_confidence}
                </span>
                <span className="text-xs text-amber-600/80 dark:text-amber-500/80 font-bold">/ 5.0</span>
              </div>
            </div>

            {/* High Conviction (4-5 Stars) */}
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-50/70 dark:bg-emerald-500/5 p-4 shadow-xs backdrop-blur-md">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold tracking-wider text-emerald-700 dark:text-emerald-400 uppercase">
                  High Conviction (4-5★)
                </span>
                <ShieldCheck size={14} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-300">
                  {activeSummary.high_conviction_count}
                </span>
                <span className="text-xs text-emerald-600/80 dark:text-emerald-500/80">picks</span>
              </div>
            </div>

            {/* Average ROCE */}
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-50/70 dark:bg-cyan-500/5 p-4 shadow-xs backdrop-blur-md">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold tracking-wider text-cyan-700 dark:text-cyan-400 uppercase">
                  Avg Portfolio ROCE
                </span>
                <TrendingUp size={14} className="text-cyan-600 dark:text-cyan-400" />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl font-black text-cyan-700 dark:text-cyan-300">
                  {activeSummary.avg_roce !== null ? `${activeSummary.avg_roce}%` : "N/A"}
                </span>
                <span className="text-xs text-cyan-600/80 dark:text-cyan-500/80 font-semibold">return</span>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* ADD STOCK SEARCH BAR & TOOLBAR                            */}
        {/* ========================================================= */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1528]/80 p-5 shadow-xs backdrop-blur-md">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            {/* AUTCOMPLETE SEARCH INPUT */}
            <div ref={searchContainerRef} className="relative w-full max-w-xl">
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/90 px-4 py-3 focus-within:border-cyan-500/70 focus-within:ring-2 focus-within:ring-cyan-500/20">
                <Search size={18} className="text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => {
                    if (searchResults.length > 0) setShowSearchDropdown(true);
                  }}
                  placeholder="Search stock to add (e.g. RELIANCE, TATAMOTORS, HDFCBANK)..."
                  className="w-full bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none"
                />
                {isSearching && (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-cyan-500 dark:border-cyan-400 border-t-transparent" />
                )}
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      setShowSearchDropdown(false);
                    }}
                    className="text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {/* SEARCH AUTOCOMPLETE DROPDOWN */}
              {showSearchDropdown && searchResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-96 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#081225] p-2 shadow-2xl backdrop-blur-2xl">
                  <div className="px-3 py-2 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                    Matching Equities ({searchResults.length})
                  </div>
                  {searchResults.map((stock) => {
                    const isAlreadyAdded = activeItems.some((i) => i.symbol === stock.symbol);
                    return (
                      <div
                        key={stock.symbol}
                        className="flex items-center justify-between rounded-lg p-2.5 transition-all hover:bg-slate-100 dark:hover:bg-slate-800/80"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 dark:text-white text-sm">{stock.symbol}</span>
                            <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-mono text-slate-600 dark:text-slate-400">
                              {stock.exchange}
                            </span>
                            {stock.sector && (
                              <span className="hidden sm:inline-block rounded bg-cyan-100 dark:bg-cyan-950/60 px-1.5 py-0.5 text-[10px] font-medium text-cyan-700 dark:text-cyan-400">
                                {stock.sector}
                              </span>
                            )}
                          </div>
                          <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                            {stock.company_name}
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-right">
                          {stock.current_price !== null && (
                            <div>
                              <div className="text-xs font-bold text-slate-900 dark:text-white">
                                ₹{stock.current_price.toLocaleString("en-IN")}
                              </div>
                              {stock.roce !== null && (
                                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                                  ROCE {stock.roce}%
                                </div>
                              )}
                            </div>
                          )}

                          <button
                            disabled={isAlreadyAdded || actionLoading}
                            onClick={() => handleAddStock(stock)}
                            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                              isAlreadyAdded
                                ? "border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/40 text-slate-400 dark:text-slate-500 cursor-not-allowed"
                                : "border border-cyan-500/50 bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/20 dark:hover:bg-cyan-500/30 hover:border-cyan-400"
                            }`}
                          >
                            {isAlreadyAdded ? (
                              <>
                                <Check size={13} />
                                <span>In List</span>
                              </>
                            ) : (
                              <>
                                <Plus size={13} />
                                <span>Add</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* TABLE FILTERS & SORT */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Table search filter */}
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 px-3 py-2 text-xs">
                <Search size={14} className="text-slate-400 dark:text-slate-500" />
                <input
                  type="text"
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  placeholder="Filter list..."
                  className="w-28 bg-transparent text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none sm:w-36"
                />
              </div>

              {/* Confidence filter */}
              <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-1 text-xs">
                {(["ALL", 5, 4, 3] as const).map((tier) => (
                  <button
                    key={String(tier)}
                    onClick={() => setConfidenceFilter(tier)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all ${
                      confidenceFilter === tier
                        ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40 shadow-sm shadow-amber-500/20"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    {tier === "ALL" ? "All" : `${tier}★`}
                  </button>
                ))}
              </div>

              {/* Sort By selector */}
              <div className="flex items-center gap-2">
                <select
                  value={sortBy}
                  onChange={(e) =>
                    setSortBy(
                      e.target.value as "confidence" | "roce" | "cmp" | "symbol"
                    )
                  }
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 outline-none shadow-xs"
                >
                  <option value="confidence">Sort: Conviction Rank</option>
                  <option value="roce">Sort: ROCE %</option>
                  <option value="cmp">Sort: Market Price</option>
                  <option value="symbol">Sort: Ticker Symbol</option>
                </select>

                <button
                  onClick={() => setSortOrder((o) => (o === "asc" ? "desc" : "asc"))}
                  className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white shadow-xs"
                  title={`Toggle order (${sortOrder.toUpperCase()})`}
                >
                  <ArrowUpDown size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* INTERACTIVE WATCHLIST TABLE                               */}
        {/* ========================================================= */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#081225]/80 shadow-xs dark:shadow-2xl backdrop-blur-md">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 font-mono uppercase text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3.5 w-12 text-center">#</th>
                  <th className="px-4 py-3.5 min-w-[200px]">Company / Symbol</th>
                  <th className="px-4 py-3.5 text-right min-w-[110px]">CMP (₹)</th>
                  <th className="px-4 py-3.5 text-right min-w-[90px]">ROCE</th>
                  <th className="px-4 py-3.5 text-right min-w-[90px]">P/E</th>
                  <th className="px-4 py-3.5 text-right min-w-[100px]">3Y Sales</th>
                  <th className="px-4 py-3.5 min-w-[210px] text-center">
                    <div className="flex items-center justify-center gap-1.5 text-amber-500 dark:text-amber-400">
                      <Star size={14} className="fill-amber-500 dark:fill-amber-400" />
                      <span>Conviction (1-5★)</span>
                    </div>
                  </th>
                  <th className="px-4 py-3.5 min-w-[320px]">Investment Thesis & Notes</th>
                  <th className="px-4 py-3.5 text-center w-16">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                {loadingItems ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center text-slate-400 dark:text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-cyan-500 dark:border-cyan-400 border-t-transparent" />
                        <span className="text-xs">Loading watchlist stocks...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredAndSortedItems.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center text-slate-400 dark:text-slate-500">
                      <div className="flex flex-col items-center justify-center gap-3">
                        <Star size={32} className="text-slate-300 dark:text-slate-600" />
                        <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">
                          No stocks in this watchlist matching criteria
                        </span>
                        <p className="text-xs text-slate-400 dark:text-slate-600 max-w-sm">
                          Use the search bar above to search any of the 8,500+ Indian equities and click &ldquo;Add&rdquo; to begin tracking conviction notes.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedItems.map((item, idx) => {
                    const isSaved = savedStatus[item.id];
                    return (
                      <tr
                        key={item.id}
                        className="group transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40"
                      >
                        {/* Index */}
                        <td className="px-4 py-3.5 text-center font-mono text-slate-400 dark:text-slate-500">
                          {idx + 1}
                        </td>

                        {/* Company / Symbol */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 dark:text-white text-sm">
                              {item.symbol}
                            </span>
                            <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[9px] font-mono text-slate-600 dark:text-slate-400">
                              {item.exchange}
                            </span>
                          </div>
                          <div className="truncate text-slate-500 dark:text-slate-400 text-[11px] max-w-[200px]">
                            {item.company_name}
                          </div>
                          <div className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                            {item.sector}
                          </div>
                        </td>

                        {/* CMP */}
                        <td className="px-4 py-3.5 text-right font-mono">
                          {item.current_price !== null ? (
                            <div>
                              <span className="font-bold text-slate-900 dark:text-white">
                                ₹{item.current_price.toLocaleString("en-IN")}
                              </span>
                              {item.return_3m !== null && (
                                <div
                                  className={`text-[10px] font-semibold ${
                                    item.return_3m >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                                  }`}
                                >
                                  {item.return_3m >= 0 ? "+" : ""}
                                  {item.return_3m}% (3M)
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-600">-</span>
                          )}
                        </td>

                        {/* ROCE */}
                        <td className="px-4 py-3.5 text-right font-mono">
                          {item.roce !== null ? (
                            <span
                              className={`font-bold ${
                                item.roce >= 20
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : item.roce >= 12
                                  ? "text-cyan-600 dark:text-cyan-400"
                                  : "text-slate-500 dark:text-slate-400"
                              }`}
                            >
                              {item.roce}%
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-600">-</span>
                          )}
                        </td>

                        {/* P/E */}
                        <td className="px-4 py-3.5 text-right font-mono text-slate-700 dark:text-slate-300">
                          {item.stock_pe !== null ? item.stock_pe : "-"}
                        </td>

                        {/* 3Y Sales */}
                        <td className="px-4 py-3.5 text-right font-mono">
                          {item.sales_growth_3yr !== null ? (
                            <span
                              className={
                                item.sales_growth_3yr >= 15
                                  ? "text-emerald-600 dark:text-emerald-400 font-bold"
                                  : "text-slate-700 dark:text-slate-300"
                              }
                            >
                              {item.sales_growth_3yr}%
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-600">-</span>
                          )}
                        </td>

                        {/* CONVICTION SCORE (1-5 STARS) */}
                        <td className="px-4 py-3.5 text-center">
                          <div className="flex flex-col items-center justify-center gap-1.5">
                            {/* Stars Clicker */}
                            <div className="flex items-center gap-1">
                              {[1, 2, 3, 4, 5].map((starVal) => {
                                const isFilled = starVal <= item.confidence_score;
                                return (
                                  <button
                                    key={starVal}
                                    type="button"
                                    onClick={() => handleSetConfidence(item.id, starVal)}
                                    title={`Set confidence to ${starVal}/5`}
                                    className="group/star p-0.5 transition-transform hover:scale-125 focus:outline-none"
                                  >
                                    <Star
                                      size={17}
                                      className={`transition-colors ${
                                        isFilled
                                          ? item.confidence_score === 5
                                            ? "fill-emerald-500 text-emerald-500 dark:fill-emerald-400 dark:text-emerald-400"
                                            : item.confidence_score === 4
                                            ? "fill-cyan-500 text-cyan-500 dark:fill-cyan-400 dark:text-cyan-400"
                                            : "fill-amber-500 text-amber-500 dark:fill-amber-400 dark:text-amber-400"
                                          : "text-slate-300 dark:text-slate-700 hover:text-slate-400"
                                      }`}
                                    />
                                  </button>
                                );
                              })}
                            </div>

                            {/* Conviction Label */}
                            <span
                              className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                                item.confidence_score === 5
                                  ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40"
                                  : item.confidence_score === 4
                                  ? "bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/40"
                                  : item.confidence_score === 3
                                  ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                              }`}
                            >
                              {item.confidence_score === 5
                                ? "5/5 Max Conviction"
                                : item.confidence_score === 4
                                ? "4/5 High Conviction"
                                : item.confidence_score === 3
                                ? "3/5 Moderate"
                                : `${item.confidence_score}/5 Watch`}
                            </span>
                          </div>
                        </td>

                        {/* INLINE EDITABLE COMMENT / THESIS */}
                        <td className="px-4 py-3.5">
                          <div className="relative">
                            <textarea
                              rows={2}
                              value={editingComments[item.id] ?? item.comment}
                              onChange={(e) =>
                                handleCommentChange(item.id, e.target.value)
                              }
                              onBlur={() => handleSaveComment(item.id)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault();
                                  handleSaveComment(item.id);
                                }
                              }}
                              placeholder="Add investment thesis, catalysts, or entry triggers..."
                              className="w-full resize-none rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/70 p-2 text-xs text-slate-900 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 outline-none transition-all focus:border-cyan-500/60 focus:bg-white dark:focus:bg-slate-900 focus:ring-1 focus:ring-cyan-500/20"
                            />

                            {/* Saved Feedback Badge */}
                            {isSaved && (
                              <div className="absolute right-2 top-2 flex items-center gap-1 rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/40 shadow-xs animate-pulse">
                                <Check size={11} />
                                <span>Saved</span>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* REMOVE ACTION */}
                        <td className="px-4 py-3.5 text-center">
                          <button
                            onClick={() => handleRemoveStock(item.id, item.symbol)}
                            title={`Remove ${item.symbol} from watchlist`}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-500/20 hover:text-rose-600 dark:hover:text-rose-400 transition-all"
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ========================================================= */}
        {/* MODAL: CREATE NEW WATCHLIST                               */}
        {/* ========================================================= */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#081225] p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                  <FolderPlus className="text-cyan-600 dark:text-cyan-400" size={20} />
                  <h3 className="text-lg font-bold">Create New Watchlist</h3>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateWatchlist} className="mt-5 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Watchlist Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newWlName}
                    onChange={(e) => setNewWlName(e.target.value)}
                    placeholder="e.g. EV & Solar Themes, Microcap Gems..."
                    className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    value={newWlDesc}
                    onChange={(e) => setNewWlDesc(e.target.value)}
                    placeholder="Brief description of this portfolio's strategy..."
                    className="mt-1 w-full resize-none rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Color Accent
                  </label>
                  <div className="mt-2 flex gap-3">
                    {[
                      { name: "cyan", class: "bg-cyan-500" },
                      { name: "emerald", class: "bg-emerald-500" },
                      { name: "amber", class: "bg-amber-500" },
                      { name: "purple", class: "bg-purple-500" },
                      { name: "blue", class: "bg-blue-500" },
                    ].map((col) => (
                      <button
                        key={col.name}
                        type="button"
                        onClick={() => setNewWlColor(col.name)}
                        className={`h-7 w-7 rounded-full ${col.class} transition-all ${
                          newWlColor === col.name
                            ? "ring-2 ring-cyan-500 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 scale-110"
                            : "opacity-60 hover:opacity-100"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading || !newWlName.trim()}
                    className="rounded-xl border border-cyan-500 bg-cyan-500/20 px-5 py-2 text-xs font-bold text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/30"
                  >
                    Create Watchlist
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* MODAL: EDIT WATCHLIST                                     */}
        {/* ========================================================= */}
        {showEditModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#081225] p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
                <div className="flex items-center gap-2 text-slate-900 dark:text-white">
                  <Edit3 className="text-cyan-600 dark:text-cyan-400" size={18} />
                  <h3 className="text-lg font-bold">Edit Watchlist</h3>
                </div>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleUpdateWatchlist} className="mt-5 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Watchlist Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={editWlName}
                    onChange={(e) => setEditWlName(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    value={editWlDesc}
                    onChange={(e) => setEditWlDesc(e.target.value)}
                    className="mt-1 w-full resize-none rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="mt-6 flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading || !editWlName.trim()}
                    className="rounded-xl border border-cyan-500 bg-cyan-500/20 px-5 py-2 text-xs font-bold text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/30"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

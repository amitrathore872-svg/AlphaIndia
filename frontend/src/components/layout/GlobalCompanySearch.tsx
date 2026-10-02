"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  X,
  TrendingUp,
  Clock,
  ArrowRight,
  Sparkles,
  Building2,
  CornerDownLeft,
  Loader2,
} from "lucide-react";
import { searchStocks, type StockSearchResult } from "@/lib/stocksApi";

const RECENT_SEARCHES_KEY = "alpha_india_recent_company_searches";
const MAX_RECENT_ITEMS = 5;

// Helper to format market cap numbers
function formatMarketCap(mcap: string | number | null | undefined): string {
  if (!mcap || mcap === "Unknown") return "";
  const num = typeof mcap === "string" ? parseFloat(mcap) : mcap;
  if (isNaN(num) || num <= 0) return "";
  if (num >= 100000) {
    return `₹${(num / 100000).toFixed(2)}L Cr`;
  }
  if (num >= 1000) {
    return `₹${(num / 1000).toFixed(1)}k Cr`;
  }
  return `₹${num.toFixed(0)} Cr`;
}

// Helper to format Indian Rupee prices
function formatPrice(price: number | undefined): string {
  if (price === undefined || price === null || price <= 0) return "";
  return `₹${price.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function GlobalCompanySearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StockSearchResult[]>([]);
  const [trending, setTrending] = useState<StockSearchResult[]>([]);
  const [recentSearches, setRecentSearches] = useState<StockSearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [isMobileModalOpen, setIsMobileModalOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const resultsListRef = useRef<HTMLDivElement>(null);

  // Load recent searches from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) {
        setRecentSearches(JSON.parse(stored));
      }
    } catch {
      // Ignore localStorage errors
    }

    // Pre-fetch default trending equities
    searchStocks("", 10)
      .then((items) => {
        if (items && items.length > 0) {
          setTrending(items);
        }
      })
      .catch(() => {});
  }, []);

  // Save selected company to recent searches
  const saveToRecentSearches = useCallback((company: StockSearchResult) => {
    try {
      setRecentSearches((prev) => {
        const filtered = prev.filter((item) => item.symbol !== company.symbol);
        const updated = [company, ...filtered].slice(0, MAX_RECENT_ITEMS);
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
        return updated;
      });
    } catch {
      // Ignore storage errors
    }
  }, []);

  const clearRecentSearches = (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
      setRecentSearches([]);
    } catch {
      // Ignore
    }
  };

  // Open Techno-Funda stock detail page for company
  const handleOpenCompany = useCallback(
    (symbol: string, companyObj?: StockSearchResult) => {
      if (!symbol || !symbol.trim()) return;
      const cleanSymbol = symbol.trim().toUpperCase();

      const itemToSave: StockSearchResult = companyObj || {
        symbol: cleanSymbol,
        company_name: cleanSymbol,
        sector: "Equities",
        current_price: 0,
      };
      saveToRecentSearches(itemToSave);

      setIsOpen(false);
      setIsMobileModalOpen(false);
      setQuery("");
      setSelectedIndex(-1);

      // Navigate to /techno-funda/[symbol]
      router.push(`/techno-funda/${cleanSymbol}`);
    },
    [router, saveToRecentSearches]
  );

  // Debounced search when query changes
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setIsLoading(false);
      setSelectedIndex(-1);
      return;
    }

    setIsLoading(true);
    const timer = setTimeout(async () => {
      try {
        const data = await searchStocks(trimmed, 12);
        setResults(data);
        setSelectedIndex(data.length > 0 ? 0 : -1);
      } catch (err) {
        console.error("Search failed:", err);
      } finally {
        setIsLoading(false);
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [query]);

  // Click outside listener to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Global hotkey: '/' or 'Ctrl+K' / 'Cmd+K' to focus search
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      const isInput =
        activeTag === "input" ||
        activeTag === "textarea" ||
        document.activeElement?.getAttribute("contenteditable") === "true";

      if (
        (e.key === "k" && (e.ctrlKey || e.metaKey)) ||
        (e.key === "/" && !isInput)
      ) {
        e.preventDefault();
        setIsOpen(true);
        if (window.innerWidth < 1024) {
          setIsMobileModalOpen(true);
          setTimeout(() => mobileInputRef.current?.focus(), 50);
        } else {
          inputRef.current?.focus();
        }
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  // Keyboard navigation within the dropdown
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const activeList =
      query.trim().length > 0
        ? results
        : recentSearches.length > 0
        ? recentSearches
        : trending;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      setSelectedIndex((prev) =>
        prev < activeList.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev > 0 ? prev - 1 : activeList.length - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && activeList[selectedIndex]) {
        handleOpenCompany(
          activeList[selectedIndex].symbol,
          activeList[selectedIndex]
        );
      } else if (results.length > 0) {
        handleOpenCompany(results[0].symbol, results[0]);
      } else if (query.trim()) {
        handleOpenCompany(query.trim());
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      setIsMobileModalOpen(false);
      inputRef.current?.blur();
      mobileInputRef.current?.blur();
    }
  };

  // Ensure active highlighted element stays scrolled into view
  useEffect(() => {
    if (selectedIndex >= 0 && resultsListRef.current) {
      const activeEl = resultsListRef.current.children[
        selectedIndex
      ] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [selectedIndex]);

  // Highlight matched substrings in company name
  const renderHighlightedText = (text: string, highlight: string) => {
    if (!highlight.trim()) return <span>{text}</span>;
    const parts = text.split(new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"));
    return (
      <span>
        {parts.map((part, i) =>
          part.toLowerCase() === highlight.toLowerCase() ? (
            <mark
              key={i}
              className="bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 font-bold px-0.5 rounded"
            >
              {part}
            </mark>
          ) : (
            part
          )
        )}
      </span>
    );
  };

  const renderCompanyItem = (
    item: StockSearchResult,
    index: number,
    isSelected: boolean
  ) => {
    const mcapFormatted = formatMarketCap(item.market_cap);
    const priceFormatted = formatPrice(item.current_price);

    return (
      <div
        key={`${item.symbol}-${index}`}
        onClick={() => handleOpenCompany(item.symbol, item)}
        onMouseEnter={() => setSelectedIndex(index)}
        className={`group relative flex cursor-pointer items-center justify-between px-3.5 py-2.5 transition-all duration-150 rounded-lg ${
          isSelected
            ? "bg-cyan-500/15 border-l-3 border-cyan-500 pl-3 dark:bg-cyan-950/40"
            : "hover:bg-slate-100 dark:hover:bg-slate-800/60 border-l-3 border-transparent"
        }`}
        role="option"
        aria-selected={isSelected}
      >
        {/* Left: Symbol & Name */}
        <div className="flex items-center gap-3 min-w-0 pr-3">
          <div className="flex h-8 w-14 shrink-0 items-center justify-center rounded-md border border-cyan-500/30 bg-cyan-500/10 font-mono text-xs font-bold text-cyan-600 dark:text-cyan-400 group-hover:border-cyan-400">
            {item.symbol}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100 group-hover:text-cyan-600 dark:group-hover:text-cyan-300">
                {renderHighlightedText(item.company_name, query)}
              </span>
              {item.exchange && (
                <span className="shrink-0 rounded bg-slate-200 dark:bg-slate-800 px-1.5 py-0.2 text-[9px] font-bold text-slate-600 dark:text-slate-400 uppercase">
                  {item.exchange}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {item.sector && <span>{item.sector}</span>}
              {item.industry && item.industry !== item.sector && (
                <>
                  <span>•</span>
                  <span className="truncate">{item.industry}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: Price, Market Cap & Action */}
        <div className="flex shrink-0 items-center gap-3 text-right">
          <div>
            {priceFormatted && (
              <div className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                {priceFormatted}
              </div>
            )}
            {mcapFormatted && (
              <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                {mcapFormatted}
              </div>
            )}
          </div>

          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-200/60 dark:bg-slate-800/80 text-slate-400 group-hover:bg-cyan-500 group-hover:text-slate-950 transition-colors">
            <ArrowRight size={13} />
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* ========================================================
          DESKTOP SEARCH BAR
         ======================================================== */}
      <div ref={containerRef} className="relative hidden w-full max-w-4xl lg:block">
        <div
          className={`flex items-center gap-2.5 rounded-xl border bg-slate-100/90 dark:bg-[#071120] px-3.5 py-2 transition-all duration-200 ${
            isOpen
              ? "border-cyan-500/70 ring-2 ring-cyan-500/20 shadow-md shadow-cyan-950/20"
              : "border-slate-200 dark:border-slate-700/80 hover:border-slate-300 dark:hover:border-slate-600"
          }`}
        >
          {isLoading ? (
            <Loader2
              size={16}
              className="animate-spin text-cyan-500 shrink-0"
            />
          ) : (
            <Search
              size={16}
              className={`shrink-0 transition-colors ${
                isOpen
                  ? "text-cyan-500"
                  : "text-slate-400 dark:text-slate-500"
              }`}
            />
          )}

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="Search company, symbol (e.g. GENSOL, RELIANCE, TCS)..."
            className="w-full bg-transparent text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 outline-none dark:text-white dark:placeholder:text-slate-500"
            autoComplete="off"
            spellCheck="false"
          />

          {query && (
            <button
              onClick={() => {
                setQuery("");
                setResults([]);
                setSelectedIndex(-1);
                inputRef.current?.focus();
              }}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-0.5"
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}

          <div className="hidden sm:flex items-center gap-1 shrink-0">
            <kbd className="rounded border border-slate-300 dark:border-slate-700 bg-slate-200/70 dark:bg-slate-800/90 px-1.5 py-0.5 text-[10px] font-mono text-slate-500 dark:text-slate-400 shadow-2xs">
              /
            </kbd>
          </div>
        </div>

        {/* ========================================================
            DESKTOP DROPDOWN RESULTS (Screener.in style)
           ======================================================== */}
        {isOpen && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-[480px] overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700/90 bg-white/98 dark:bg-[#071120]/98 backdrop-blur-2xl shadow-2xl transition-all">
            {/* 1. QUERY HAS RESULTS */}
            {query.trim().length > 0 && results.length > 0 && (
              <div>
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-3.5 py-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Building2 size={13} className="text-cyan-500" />
                    <span>Matching Equities ({results.length})</span>
                  </div>
                  <span className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                    <span>Press</span>
                    <CornerDownLeft size={10} />
                    <span>to open Techno-Funda</span>
                  </span>
                </div>

                <div
                  ref={resultsListRef}
                  className="max-h-[380px] overflow-y-auto p-1.5 space-y-0.5"
                >
                  {results.map((item, index) =>
                    renderCompanyItem(item, index, index === selectedIndex)
                  )}
                </div>
              </div>
            )}

            {/* 2. QUERY HAS NO RESULTS */}
            {query.trim().length > 0 &&
              !isLoading &&
              results.length === 0 && (
                <div className="p-4 text-center">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    No matching companies found for &quot;{query}&quot;
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    Search by company name, ticker or NSE/BSE symbol.
                  </p>
                  <button
                    onClick={() => handleOpenCompany(query.trim())}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3.5 py-1.5 text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/20 transition cursor-pointer"
                  >
                    <span>Open Techno-Funda Radar for &quot;{query.trim().toUpperCase()}&quot;</span>
                    <CornerDownLeft size={12} />
                  </button>
                </div>
              )}

            {/* 3. EMPTY QUERY: RECENT SEARCHES & TRENDING EQUITIES */}
            {!query.trim() && (
              <div className="max-h-[420px] overflow-y-auto p-2 space-y-3">
                {/* Recent Searches Section */}
                {recentSearches.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between px-2 py-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <Clock size={12} className="text-cyan-500" />
                        <span>Recent Searches</span>
                      </div>
                      <button
                        onClick={clearRecentSearches}
                        className="text-[10px] text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition"
                      >
                        Clear History
                      </button>
                    </div>

                    <div className="mt-1 space-y-0.5">
                      {recentSearches.map((item, index) =>
                        renderCompanyItem(
                          item,
                          index,
                          index === selectedIndex
                        )
                      )}
                    </div>
                  </div>
                )}

                {/* Popular / Trending Section */}
                <div>
                  <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    <TrendingUp size={12} className="text-emerald-500" />
                    <span>Popular Equities &amp; Market Bellwethers</span>
                  </div>

                  <div className="mt-1 space-y-0.5">
                    {trending.slice(0, 6).map((item, index) => {
                      const offsetIdx = recentSearches.length + index;
                      return renderCompanyItem(
                        item,
                        offsetIdx,
                        offsetIdx === selectedIndex
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Keyboard Hint Bar */}
            <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#050C17] px-3.5 py-1.5 text-[10px] text-slate-500 dark:text-slate-400 font-mono">
              <div className="flex items-center gap-3">
                <span>↑↓ Navigate</span>
                <span>↵ Open Radar</span>
                <span>Esc Close</span>
              </div>
              <div className="flex items-center gap-1 text-cyan-600 dark:text-cyan-400 font-sans font-medium">
                <Sparkles size={11} />
                <span>Opens /techno-funda/[symbol]</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================
          MOBILE SEARCH TRIGGER BUTTON
         ======================================================== */}
      <button
        onClick={() => {
          setIsMobileModalOpen(true);
          setTimeout(() => mobileInputRef.current?.focus(), 100);
        }}
        className="flex lg:hidden h-9 w-9 items-center justify-center rounded-xl border border-slate-300 bg-slate-100 text-slate-700 transition hover:border-cyan-500 hover:bg-slate-200 dark:border-slate-700/80 dark:bg-slate-900/90 dark:text-slate-300 dark:hover:border-cyan-500 dark:hover:bg-slate-800 dark:hover:text-white"
        aria-label="Search Companies"
        title="Search Companies"
      >
        <Search size={16} />
      </button>

      {/* ========================================================
          MOBILE FULLSCREEN SEARCH MODAL
         ======================================================== */}
      {isMobileModalOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-[#050C17] p-4 lg:hidden">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
            <div className="relative flex-1 flex items-center gap-2 rounded-xl border border-cyan-500/70 bg-slate-100 dark:bg-slate-900 px-3 py-2">
              <Search size={16} className="text-cyan-500 shrink-0" />
              <input
                ref={mobileInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search company or symbol..."
                className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none dark:text-white"
              />
              {query && (
                <button
                  onClick={() => setQuery("")}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  <X size={15} />
                </button>
              )}
            </div>
            <button
              onClick={() => setIsMobileModalOpen(false)}
              className="rounded-lg px-2.5 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
            >
              Cancel
            </button>
          </div>

          <div className="flex-1 overflow-y-auto pt-3">
            {query.trim().length > 0 ? (
              results.length > 0 ? (
                <div className="space-y-1">
                  {results.map((item, index) =>
                    renderCompanyItem(item, index, index === selectedIndex)
                  )}
                </div>
              ) : (
                <div className="p-4 text-center">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    No results for &quot;{query}&quot;
                  </p>
                  <button
                    onClick={() => handleOpenCompany(query.trim())}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg border border-cyan-500 bg-cyan-500/10 px-4 py-2 text-xs font-bold text-cyan-600 dark:text-cyan-400"
                  >
                    Open Techno-Funda for &quot;{query.trim().toUpperCase()}&quot;
                  </button>
                </div>
              )
            ) : (
              <div className="space-y-4">
                {recentSearches.length > 0 && (
                  <div>
                    <div className="text-[11px] font-semibold text-slate-500 px-2">
                      Recent Searches
                    </div>
                    <div className="mt-1 space-y-1">
                      {recentSearches.map((item, index) =>
                        renderCompanyItem(item, index, false)
                      )}
                    </div>
                  </div>
                )}

                <div>
                  <div className="text-[11px] font-semibold text-slate-500 px-2">
                    Popular Equities
                  </div>
                  <div className="mt-1 space-y-1">
                    {trending.slice(0, 8).map((item, index) =>
                      renderCompanyItem(item, index, false)
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import React, { useState, useCallback } from "react";
import { Star, BookmarkPlus, Check } from "lucide-react";
import WatchlistModal, {
  type WatchlistModalTarget,
} from "@/components/layout/screener/WatchlistModal";
import { fetchWatchlists } from "@/lib/watchlistApi";
import type { WatchlistSummary } from "@/types/watchlist";

export interface AddToWatchlistButtonProps {
  symbol: string;
  companyName?: string;
  currentPrice?: number | null;
  sector?: string | null;
  defaultConviction?: number;
  defaultThesis?: string;
  targetPrice?: number | null;
  variant?: "icon" | "star" | "badge" | "button";
  size?: "sm" | "md";
  className?: string;
  onAdded?: (symbol: string, conviction: number) => void;
}

// Global cached watchlists to prevent duplicate requests across table rows
let cachedWatchlists: WatchlistSummary[] | null = null;
let fetchPromise: Promise<WatchlistSummary[]> | null = null;

async function getSharedWatchlists(): Promise<WatchlistSummary[]> {
  if (cachedWatchlists && cachedWatchlists.length > 0) {
    return cachedWatchlists;
  }
  if (!fetchPromise) {
    fetchPromise = fetchWatchlists()
      .then((res) => {
        cachedWatchlists = res.watchlists || [];
        return cachedWatchlists;
      })
      .catch((err) => {
        console.error("Failed to fetch watchlists in AddToWatchlistButton:", err);
        return [];
      })
      .finally(() => {
        fetchPromise = null;
      });
  }
  return fetchPromise;
}

export default function AddToWatchlistButton({
  symbol,
  companyName,
  currentPrice,
  sector,
  defaultConviction = 4,
  defaultThesis,
  targetPrice,
  variant = "icon",
  size = "sm",
  className = "",
  onAdded,
}: AddToWatchlistButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [watchlists, setWatchlists] = useState<WatchlistSummary[]>(cachedWatchlists || []);
  const [isAdded, setIsAdded] = useState(false);

  // Do not render if symbol is blank
  if (!symbol || symbol.trim() === "") return null;

  const handleClick = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      // Ensure watchlists are loaded
      const wls = await getSharedWatchlists();
      setWatchlists(wls);
      setIsOpen(true);
    },
    []
  );

  const targetCompany: WatchlistModalTarget = {
    symbol: symbol.toUpperCase(),
    company_name: companyName || symbol.toUpperCase(),
    company: companyName || symbol.toUpperCase(),
    current_price: currentPrice ?? null,
    cmp: currentPrice ?? null,
    sector: sector ?? null,
    conviction_score: defaultConviction,
    watchlist_comment: defaultThesis ?? undefined,
    target_price: targetPrice ?? null,
  };

  const handleUpdated = (
    sym: string,
    action: "added" | "updated" | "removed",
    data?: { convictionScore: number }
  ) => {
    if (action === "added" || action === "updated") {
      setIsAdded(true);
      if (onAdded && data) {
        onAdded(sym, data.convictionScore);
      }
    } else if (action === "removed") {
      setIsAdded(false);
    }
  };

  return (
    <>
      {(variant === "icon" || variant === "star") && (
        <button
          type="button"
          onClick={handleClick}
          title={isAdded ? "In Watchlist (Click to edit conviction)" : `Add ${symbol} to Watchlist`}
          className={`flex items-center justify-center rounded-lg transition-all ${
            size === "sm" ? "h-6 w-6" : "h-7 w-7"
          } ${
            isAdded
              ? "bg-amber-500/15 border border-amber-500/40 text-amber-400 hover:bg-amber-500/25"
              : "border border-slate-700/60 bg-slate-900/60 text-slate-400 hover:border-amber-500/50 hover:bg-amber-500/10 hover:text-amber-400"
          } ${className}`}
        >
          <Star
            size={size === "sm" ? 12 : 14}
            className={isAdded ? "fill-amber-400 text-amber-400" : ""}
          />
        </button>
      )}

      {variant === "badge" && (
        <button
          type="button"
          onClick={handleClick}
          title={isAdded ? "In Watchlist (Click to edit)" : `Add ${symbol} to Watchlist`}
          className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[10px] font-semibold transition ${
            isAdded
              ? "border-amber-500/40 bg-amber-500/15 text-amber-300 font-bold"
              : "border-slate-700 bg-slate-900/80 text-slate-300 hover:border-cyan-500/50 hover:text-cyan-300"
          } ${className}`}
        >
          {isAdded ? (
            <>
              <Check size={10} className="text-amber-400" />
              <span>Watched</span>
            </>
          ) : (
            <>
              <BookmarkPlus size={10} className="text-cyan-400" />
              <span>+ Watchlist</span>
            </>
          )}
        </button>
      )}

      {variant === "button" && (
        <button
          type="button"
          onClick={handleClick}
          title={isAdded ? "In Watchlist (Click to edit)" : `Add ${symbol} to Watchlist`}
          className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
            isAdded
              ? "border-amber-500/50 bg-amber-500/15 text-amber-300"
              : "border-cyan-500/40 bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25"
          } ${className}`}
        >
          {isAdded ? (
            <>
              <Check size={13} className="text-amber-400" />
              <span>In Watchlist</span>
            </>
          ) : (
            <>
              <Star size={13} className="text-cyan-400" />
              <span>Add to Watchlist</span>
            </>
          )}
        </button>
      )}

      {isOpen && (
        <WatchlistModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          company={targetCompany}
          watchlists={watchlists}
          onWatchlistUpdated={handleUpdated}
          onRefreshWatchlists={async () => {
            cachedWatchlists = null;
            const w = await getSharedWatchlists();
            setWatchlists(w);
          }}
        />
      )}
    </>
  );
}

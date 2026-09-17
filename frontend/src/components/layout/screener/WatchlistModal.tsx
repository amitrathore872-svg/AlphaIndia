"use client";

// =======================================================
// Alpha India Watchlist & Conviction Modal
// Institutional Bloomberg Terminal Modal for Growth Screener
// =======================================================

import React, { useState, useEffect } from "react";
import {
  Star,
  X,
  Plus,
  ShieldCheck,
  TrendingUp,
  Trash2,
  Check,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import type { GrowthCompany } from "@/lib/api";
import type { WatchlistSummary } from "@/types/watchlist";
import {
  createWatchlist,
  addStockToWatchlist,
  removeStockFromWatchlist,
} from "@/lib/watchlistApi";

interface WatchlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  company: GrowthCompany | null;
  watchlists: WatchlistSummary[];
  onWatchlistUpdated: (
    symbol: string,
    action: "added" | "updated" | "removed",
    data?: {
      watchlistId: number;
      watchlistName: string;
      convictionScore: number;
      comment?: string;
      targetPrice?: number | null;
    }
  ) => void;
  onRefreshWatchlists?: () => void;
}

const CONVICTION_LEVELS: Record<number, { label: string; desc: string; color: string }> = {
  5: {
    label: "5★ Max Conviction",
    desc: "Tier 1 High-Quality Core Compounder (Strong Moat & Profit Surge)",
    color: "text-amber-500 dark:text-amber-400 border-amber-500/40 bg-amber-500/10",
  },
  4: {
    label: "4★ High Conviction",
    desc: "Solid Compounder with Accelerating Sales & High ROCE",
    color: "text-cyan-600 dark:text-cyan-400 border-cyan-500/40 bg-cyan-500/10",
  },
  3: {
    label: "3★ Moderate Conviction",
    desc: "Active Growth Radar — Monitoring Next Quarter Results",
    color: "text-blue-600 dark:text-blue-400 border-blue-500/40 bg-blue-500/10",
  },
  2: {
    label: "2★ Speculative",
    desc: "Turnaround or High Beta Momentum Opportunity",
    color: "text-slate-600 dark:text-slate-300 border-slate-400/40 bg-slate-500/10",
  },
  1: {
    label: "1★ Low Conviction",
    desc: "High Risk / Speculative Discovery Watchlist",
    color: "text-rose-600 dark:text-rose-400 border-rose-500/40 bg-rose-500/10",
  },
};

const SUGGESTED_THESIS_TAGS = [
  "High ROCE Compounder",
  "QoQ Profit Acceleration",
  "Zero Net Debt",
  "Valuation Margin of Safety",
  "Institutional FII Inflow",
  "Capex Expansion Underway",
];

export default function WatchlistModal({
  isOpen,
  onClose,
  company,
  watchlists,
  onWatchlistUpdated,
  onRefreshWatchlists,
}: WatchlistModalProps) {
  const [selectedWatchlistId, setSelectedWatchlistId] = useState<number>(0);
  const [convictionScore, setConvictionScore] = useState<number>(4);
  const [hoveredStar, setHoveredStar] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // New Watchlist Inline Creation
  const [showNewWlInput, setShowNewWlInput] = useState(false);
  const [newWlName, setNewWlName] = useState("");
  const [creatingWl, setCreatingWl] = useState(false);

  useEffect(() => {
    if (company && isOpen) {
      setErrorMessage(null);
      setConvictionScore(company.conviction_score || 4);
      setComment(
        company.watchlist_comment ||
          `High growth discovered via Screener. CMP ₹${company.cmp ?? "-"}, ROCE ${company.roce ?? "-"}%`
      );
      setTargetPrice(company.target_price ? String(company.target_price) : "");

      // Select matching watchlist or default
      if (company.watchlist_id) {
        setSelectedWatchlistId(company.watchlist_id);
      } else if (watchlists.length > 0) {
        setSelectedWatchlistId(watchlists[0].id);
      }
    }
  }, [company, isOpen, watchlists]);

  if (!isOpen || !company) return null;

  const handleCreateWatchlist = async () => {
    if (!newWlName.trim()) return;
    try {
      setCreatingWl(true);
      const res = await createWatchlist({
        name: newWlName.trim(),
        description: "Custom user conviction watchlist",
        color: "cyan",
      });
      if (res.watchlist) {
        setSelectedWatchlistId(res.watchlist.id);
        setShowNewWlInput(false);
        setNewWlName("");
        if (onRefreshWatchlists) onRefreshWatchlists();
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Could not create watchlist");
    } finally {
      setCreatingWl(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWatchlistId) {
      setErrorMessage("Please select a target watchlist.");
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);

      const targetWl = watchlists.find((w) => w.id === selectedWatchlistId);
      const targetName = targetWl ? targetWl.name : "Watchlist";

      await addStockToWatchlist(selectedWatchlistId, {
        symbol: company.symbol,
        company_name: company.company,
        confidence_score: convictionScore,
        comment: comment.trim(),
        target_price: targetPrice ? parseFloat(targetPrice) : undefined,
      });

      onWatchlistUpdated(company.symbol, company.in_watchlist ? "updated" : "added", {
        watchlistId: selectedWatchlistId,
        watchlistName: targetName,
        convictionScore,
        comment: comment.trim(),
        targetPrice: targetPrice ? parseFloat(targetPrice) : null,
      });

      onClose();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to save stock to watchlist");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async () => {
    if (!company.watchlist_item_id && !selectedWatchlistId) return;
    const confirmDelete = window.confirm(
      `Remove ${company.symbol} from your watchlist?`
    );
    if (!confirmDelete) return;

    try {
      setDeleting(true);
      setErrorMessage(null);

      const targetWlId = company.watchlist_id || selectedWatchlistId;
      const itemId = company.watchlist_item_id;

      if (itemId && targetWlId) {
        await removeStockFromWatchlist(targetWlId, itemId);
      }

      onWatchlistUpdated(company.symbol, "removed");
      onClose();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to remove stock");
    } finally {
      setDeleting(false);
    }
  };

  const activeLevel = CONVICTION_LEVELS[hoveredStar || convictionScore] || CONVICTION_LEVELS[4];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-[#080E1A] overflow-hidden text-slate-900 dark:text-slate-100">
        {/* Header Ribbon */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800 bg-slate-50/80 dark:bg-[#060B14]">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-500">
              <Star size={20} className="fill-amber-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold tracking-tight">
                  {company.company}
                </h3>
                <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {company.symbol}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                <span>CMP: ₹{company.cmp?.toLocaleString("en-IN") ?? "--"}</span>
                <span>•</span>
                <span>ROCE: {company.roce ? `${company.roce}%` : "--"}</span>
                <span>•</span>
                <span>MCap: ₹{company.market_cap ? `${Math.round(company.market_cap).toLocaleString("en-IN")} Cr` : "--"}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div className="flex items-center gap-2 px-5 py-2.5 bg-rose-500/10 border-b border-rose-500/20 text-xs text-rose-600 dark:text-rose-400">
            <AlertCircle size={14} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="p-5 space-y-4">
          {/* Target Watchlist Selector */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Target Watchlist
              </label>
              {!showNewWlInput && (
                <button
                  type="button"
                  onClick={() => setShowNewWlInput(true)}
                  className="inline-flex items-center gap-1 text-xs text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300 transition"
                >
                  <Plus size={13} />
                  <span>New Watchlist</span>
                </button>
              )}
            </div>

            {showNewWlInput ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Watchlist name (e.g. Chemical Compounders)"
                  value={newWlName}
                  onChange={(e) => setNewWlName(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  autoFocus
                />
                <button
                  type="button"
                  disabled={creatingWl || !newWlName.trim()}
                  onClick={handleCreateWatchlist}
                  className="rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-cyan-400 disabled:opacity-50 transition"
                >
                  {creatingWl ? "Adding..." : "Add"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewWlInput(false)}
                  className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <select
                value={selectedWatchlistId}
                onChange={(e) => setSelectedWatchlistId(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-cyan-500 dark:border-slate-800 dark:bg-[#060B14] dark:text-slate-200 cursor-pointer"
              >
                {watchlists.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.items_count} stocks)
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Conviction Score Ranking (1 - 5 Stars) */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800/80 dark:bg-[#060B14]">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Sparkles size={14} className="text-amber-500" />
                <span>Conviction Score Rating</span>
              </label>

              <span className={`text-xs font-bold px-2 py-0.5 rounded border ${activeLevel.color}`}>
                {activeLevel.label}
              </span>
            </div>

            {/* Interactive Stars */}
            <div className="flex items-center gap-2 my-2">
              {[1, 2, 3, 4, 5].map((star) => {
                const isLit = (hoveredStar ?? convictionScore) >= star;
                return (
                  <button
                    key={star}
                    type="button"
                    onMouseEnter={() => setHoveredStar(star)}
                    onMouseLeave={() => setHoveredStar(null)}
                    onClick={() => setConvictionScore(star)}
                    className="p-1 rounded-lg transition-transform hover:scale-125 focus:outline-none"
                    title={`Rate ${star} Stars`}
                  >
                    <Star
                      size={24}
                      className={`${
                        isLit
                          ? "fill-amber-400 text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                          : "text-slate-300 dark:text-slate-700"
                      } transition-colors`}
                    />
                  </button>
                );
              })}
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
              {activeLevel.desc}
            </p>
          </div>

          {/* Investment Thesis / Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Investment Thesis & Thesis Notes
            </label>
            <textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Why are you bullish on this growth stock? e.g. Q3 volume growth, new plant commissioned, debt reduction..."
              className="w-full rounded-lg border border-slate-300 bg-slate-50 p-2.5 text-xs text-slate-900 outline-none focus:border-cyan-500 dark:border-slate-800 dark:bg-[#060B14] dark:text-slate-200 placeholder:text-slate-400"
            />

            {/* Quick Suggestion Tags */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {SUGGESTED_THESIS_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    if (!comment.includes(tag)) {
                      setComment((prev) => (prev ? `${prev} • ${tag}` : tag));
                    }
                  }}
                  className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600 hover:border-cyan-500 hover:text-cyan-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-cyan-400 dark:hover:text-cyan-400 transition"
                >
                  + {tag}
                </button>
              ))}
            </div>
          </div>

          {/* Target Price */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Target Price (₹) <span className="font-normal text-slate-500">(Optional)</span>
            </label>
            <input
              type="number"
              step="any"
              placeholder={`e.g. ${company.cmp ? Math.round(company.cmp * 1.3) : "1500"}`}
              value={targetPrice}
              onChange={(e) => setTargetPrice(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-mono text-slate-900 outline-none focus:border-cyan-500 dark:border-slate-800 dark:bg-[#060B14] dark:text-slate-200"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
            {company.in_watchlist ? (
              <button
                type="button"
                disabled={deleting || submitting}
                onClick={handleRemove}
                className="flex items-center gap-1 text-xs font-medium text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 disabled:opacity-50 transition"
              >
                <Trash2 size={13} />
                <span>{deleting ? "Removing..." : "Remove from Watchlist"}</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-1.5 rounded-lg bg-cyan-500 px-4 py-1.5 text-xs font-semibold text-slate-950 shadow-md hover:bg-cyan-400 disabled:opacity-50 transition"
              >
                <Check size={14} />
                <span>
                  {submitting
                    ? "Saving..."
                    : company.in_watchlist
                    ? "Update Conviction"
                    : "Save to Watchlist"}
                </span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

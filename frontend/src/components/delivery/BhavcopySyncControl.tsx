"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  Calendar,
  Clock,
  Database,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import {
  BhavcopySyncStatus,
  fetchBhavcopyStatus,
  triggerBhavcopySync,
} from "@/lib/deliveryRadarApi";

interface BhavcopySyncControlProps {
  onSyncCompleted?: (status: BhavcopySyncStatus) => void;
  variant?: "compact" | "banner";
  className?: string;
}

export default function BhavcopySyncControl({
  onSyncCompleted,
  variant = "compact",
  className = "",
}: BhavcopySyncControlProps) {
  const [status, setStatus] = useState<BhavcopySyncStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetchBhavcopyStatus();
      setStatus(res);
    } catch (err) {
      console.warn("Failed to fetch bhavcopy sync status:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    setFeedback(null);
    try {
      const res = await triggerBhavcopySync(true);
      setStatus(res);
      setFeedback({
        type: "success",
        text: res.message || `Bhavcopy synced successfully (${res.latest_bhavcopy_display || "Latest"}).`,
      });
      if (onSyncCompleted) {
        onSyncCompleted(res);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to fetch bhavcopy data.";
      setFeedback({
        type: "error",
        text: msg,
      });
    } finally {
      setSyncing(false);
      // Auto-dismiss feedback after 6 seconds
      setTimeout(() => {
        setFeedback(null);
      }, 6000);
    }
  };

  const isUpToDate = status?.is_up_to_date ?? true;

  if (variant === "banner") {
    return (
      <div
        className={`relative overflow-hidden rounded-xl border border-slate-800/90 bg-gradient-to-r from-[#061224] via-[#09152b] to-[#040914] p-3.5 shadow-lg backdrop-blur-md ${className}`}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
              <Database className="h-4 w-4" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-white font-mono tracking-tight">
                  NSE Delivery Bhavcopy
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold font-mono ${
                    isUpToDate
                      ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                      : "border border-amber-500/30 bg-amber-500/10 text-amber-400"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isUpToDate ? "bg-emerald-400" : "bg-amber-400 animate-ping"
                    }`}
                  />
                  {isUpToDate ? "Up to Date" : "Sync Recommended"}
                </span>
                {status?.total_sessions ? (
                  <span className="rounded-md border border-slate-700/80 bg-slate-800/60 px-2 py-0.5 text-[10px] font-mono text-slate-300">
                    {status.total_sessions} Sessions
                  </span>
                ) : null}
              </div>

              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
                <span className="flex items-center gap-1 font-mono">
                  <Calendar className="h-3 w-3 text-cyan-400" />
                  Latest Session:{" "}
                  <strong className="text-slate-200">
                    {status?.latest_bhavcopy_display || "Loading..."}
                  </strong>
                </span>
                <span className="hidden sm:inline text-slate-600">•</span>
                <span className="flex items-center gap-1 font-mono">
                  <Clock className="h-3 w-3 text-amber-400" />
                  Last Synced:{" "}
                  <strong className="text-slate-200">
                    {status?.last_sync_display || "Loading..."}
                  </strong>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            {feedback && (
              <span
                className={`text-[11px] font-mono px-2 py-1 rounded-md border ${
                  feedback.type === "success"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                    : "border-rose-500/30 bg-rose-500/10 text-rose-300"
                }`}
              >
                {feedback.text}
              </span>
            )}

            <button
              onClick={handleSync}
              disabled={syncing || loading}
              className="group flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-gradient-to-r from-cyan-600/30 to-blue-600/30 px-3.5 py-1.5 text-xs font-semibold text-cyan-200 shadow-sm transition hover:border-cyan-400 hover:bg-cyan-500/30 hover:text-white active:scale-95 disabled:opacity-50"
            >
              <RefreshCw
                size={13}
                className={`transition-transform duration-700 ${
                  syncing ? "animate-spin text-cyan-300" : "group-hover:rotate-180"
                }`}
              />
              <span>{syncing ? "Fetching Bhavcopy..." : "Fetch Bhavcopy"}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Compact variant (perfect for top navigation toolbars / action bars)
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {/* Telemetry Indicator Pill */}
      <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/90 px-3 py-1.5 text-xs shadow-inner backdrop-blur-md">
        <div className="flex items-center gap-1.5 font-mono">
          <span
            className={`h-2 w-2 rounded-full ${
              syncing
                ? "bg-cyan-400 animate-spin"
                : isUpToDate
                ? "bg-emerald-400"
                : "bg-amber-400 animate-pulse"
            }`}
          />
          <span className="text-[11px] text-slate-400">NSE Bhavcopy:</span>
          <span className="font-semibold text-slate-200">
            {status?.latest_bhavcopy_display || (loading ? "..." : "N/A")}
          </span>
        </div>

        <span className="text-slate-700">|</span>

        <div className="hidden sm:flex items-center gap-1 font-mono text-[11px] text-slate-400">
          <Clock className="h-3 w-3 text-cyan-400/80" />
          <span>Sync:</span>
          <span className="text-slate-300">
            {status?.last_sync_display || (loading ? "..." : "Never")}
          </span>
        </div>
      </div>

      {/* Trigger Button */}
      <button
        onClick={handleSync}
        disabled={syncing || loading}
        title="Trigger fresh Bhavcopy data download from official NSE archives"
        className="flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-500/20 hover:text-white active:scale-95 disabled:opacity-50 shadow-xs"
      >
        <RefreshCw size={13} className={syncing ? "animate-spin text-cyan-400" : ""} />
        <span>{syncing ? "Fetching..." : "Fetch Bhavcopy"}</span>
      </button>

      {/* Mini notification feedback */}
      {feedback && (
        <div
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-mono shadow-sm transition-all animate-in fade-in slide-in-from-top-1 ${
            feedback.type === "success"
              ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
              : "border-rose-500/40 bg-rose-500/15 text-rose-300"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="h-3.5 w-3.5 text-rose-400 shrink-0" />
          )}
          <span className="truncate max-w-[280px]">{feedback.text}</span>
        </div>
      )}
    </div>
  );
}

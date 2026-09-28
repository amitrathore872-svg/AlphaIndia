"use client";

import { useState, useEffect } from "react";
import {
  Zap,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Copy,
  ExternalLink,
  Key,
  ShieldCheck,
  Eye,
  EyeOff,
  Clock,
  Sparkles,
} from "lucide-react";
import { API_BASE, fetchJson } from "@/lib/apiConfig";

interface DhanStatus {
  configured: boolean;
  status: "ACTIVE" | "EXPIRED" | "DATA_API_PENDING" | "NOT_CONFIGURED" | string;
  trading_api_active: boolean;
  data_api_subscribed: boolean;
  is_expired: boolean;
  client_id?: string;
  message?: string;
  metadata?: {
    valid: boolean;
    is_expired: boolean;
    expires_in_hours?: number;
    expires_in_sec?: number;
    dhan_client_id?: string;
  };
}

interface DhanFeedWidgetProps {
  onStatusChange?: (status: DhanStatus) => void;
  className?: string;
}

export default function DhanFeedWidget({ onStatusChange, className = "" }: DhanFeedWidgetProps) {
  const [status, setStatus] = useState<DhanStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refreshingPrices, setRefreshingPrices] = useState(false);
  const [newToken, setNewToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const fetchStatus = async () => {
    try {
      const data = await fetchJson<DhanStatus>("/api/companies/dhan-feed/status", { timeoutMs: 8000 });
      setStatus(data);
      if (onStatusChange) onStatusChange(data);
    } catch (err: unknown) {
      const e = err as Error;
      console.warn("[DhanFeedWidget] Backend status check note:", e?.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleUpdateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newToken.trim()) {
      setFeedback({ message: "Please paste a valid access token.", type: "error" });
      return;
    }

    setSubmitting(true);
    setFeedback(null);
    try {
      const data = await fetchJson<{
        status: string;
        connection: DhanStatus;
        refreshed_count: number;
        message: string;
        detail?: string;
      }>("/api/companies/dhan-feed/update-token", {
        method: "POST",
        body: JSON.stringify({ access_token: newToken.trim() }),
        timeoutMs: 30000,
      });

      if (data.status === "success") {
        setStatus(data.connection);
        setNewToken("");
        setFeedback({
          message: `0-Delay Feed Activated! ${data.refreshed_count || 0} active equity quotes refreshed in real-time.`,
          type: "success",
        });
        if (onStatusChange) onStatusChange(data.connection);
      } else {
        setFeedback({
          message: data.detail || data.message || "Failed to update token. Please check and try again.",
          type: "error",
        });
      }
    } catch (err: unknown) {
      const e = err as Error;
      setFeedback({ message: e?.message || "Failed to connect to backend service.", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefreshPrices = async () => {
    setRefreshingPrices(true);
    setFeedback(null);
    try {
      const data = await fetchJson<{ status: string; refreshed_count: number }>(
        "/api/companies/dhan-feed/refresh-prices?limit=60",
        { method: "POST", timeoutMs: 15000 }
      );
      if (data.status === "success") {
        setFeedback({
          message: `Instant refresh complete: ${data.refreshed_count} active equities updated with zero latency!`,
          type: "success",
        });
      }
    } catch {
      setFeedback({ message: "Failed to trigger live price refresh.", type: "error" });
    } finally {
      setRefreshingPrices(false);
    }
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setNewToken(text.trim());
        setFeedback({ message: "Pasted token from clipboard!", type: "info" });
      }
    } catch {
      setFeedback({ message: "Clipboard permission denied. Please paste manually (Ctrl+V).", type: "info" });
    }
  };

  const isActive = status?.status === "ACTIVE";
  const isExpired = status?.is_expired || status?.status === "EXPIRED";
  const hoursRemaining = status?.metadata?.expires_in_hours;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border transition-all duration-300 ${
        isActive
          ? "border-emerald-500/40 bg-gradient-to-r from-[#041315] via-[#051A18] to-[#041315] shadow-lg shadow-emerald-950/20"
          : "border-amber-500/30 bg-gradient-to-r from-[#170E04] via-[#1A1206] to-[#140C04] shadow-md"
      } p-4 sm:p-5 ${className}`}
    >
      {/* Decorative Blur Backgrounds */}
      <div
        className={`absolute top-0 right-0 -mr-12 -mt-12 h-44 w-44 rounded-full blur-3xl pointer-events-none ${
          isActive ? "bg-emerald-500/10" : "bg-amber-500/10"
        }`}
      />

      <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Status & Diagnosis */}
        <div className="space-y-1.5 max-w-xl">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase ${
                isActive
                  ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
                  : "border-amber-500/50 bg-amber-500/15 text-amber-300"
              }`}
            >
              <Zap size={11} className={isActive ? "text-emerald-400 animate-pulse" : "text-amber-400"} />
              DHANHQ ZERO-DELAY LIVE FEED
            </span>

            {/* Live Status Badge */}
            {loading ? (
              <span className="text-[11px] text-slate-400 flex items-center gap-1">
                <RefreshCw size={11} className="animate-spin" /> Checking feed status...
              </span>
            ) : isActive ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300">
                <CheckCircle2 size={11} />
                REAL-TIME ACTIVE (0s Lag)
              </span>
            ) : isExpired ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/50 bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-bold text-amber-300">
                <AlertTriangle size={11} />
                TOKEN EXPIRED (15m Yahoo Fallback)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800/80 px-2.5 py-0.5 text-[10px] font-bold text-slate-300">
                DATA APIS PENDING
              </span>
            )}

            {hoursRemaining !== undefined && hoursRemaining > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400/80 font-mono">
                <Clock size={11} />
                {hoursRemaining}h validity remaining
              </span>
            )}
          </div>

          <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
            Morning Live Feed Controller
            <span className="text-xs font-normal text-slate-400 font-mono">
              (Client ID: {status?.client_id || "1106****"})
            </span>
          </h3>

          <p className="text-xs text-slate-300 leading-relaxed">
            {isActive
              ? "All Screener, Momentum Radar, and Watchlist quotes are streaming with 0-delay real-time ticks directly from DhanHQ."
              : "Paste today's Dhan access token below to activate true zero-delay tick data for all 2,100+ listed equities."}
          </p>
        </div>

        {/* Right: Quick Portal Link */}
        <div className="flex items-center gap-2 shrink-0">
          <a
            href="https://web.dhan.co"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/70 hover:bg-slate-700/80 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white transition shadow-xs"
            title="Open Dhan Web portal to copy fresh access token"
          >
            <span>Open Dhan Portal</span>
            <ExternalLink size={12} />
          </a>

          {isActive && (
            <button
              onClick={handleRefreshPrices}
              disabled={refreshingPrices}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 px-3 py-1.5 text-xs font-bold text-emerald-300 transition shadow-xs disabled:opacity-50"
              title="Force immediate batch quote update for all active opportunities"
            >
              <RefreshCw size={12} className={refreshingPrices ? "animate-spin" : ""} />
              <span>{refreshingPrices ? "Refreshing..." : "Refresh Quotes"}</span>
            </button>
          )}
        </div>
      </div>

      {/* Token Input Form */}
      <form onSubmit={handleUpdateToken} className="mt-4 pt-3.5 border-t border-white/10">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="relative flex-1">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
              <Key size={14} />
            </div>

            <input
              type={showToken ? "text" : "password"}
              value={newToken}
              onChange={(e) => setNewToken(e.target.value)}
              placeholder="Paste today's Dhan Access Token (starts with eyJ0eX...)"
              className="w-full rounded-xl border border-slate-700/80 bg-black/40 pl-9 pr-20 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-mono transition"
            />

            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="text-slate-400 hover:text-white p-1"
                title={showToken ? "Hide token" : "Show token"}
              >
                {showToken ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
              <button
                type="button"
                onClick={handlePasteFromClipboard}
                className="text-cyan-400 hover:text-cyan-300 p-1 text-[11px] font-semibold flex items-center gap-0.5"
                title="Paste from clipboard"
              >
                <Copy size={12} />
                <span>Paste</span>
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || !newToken.trim()}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-cyan-500/60 bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 px-4 py-2 text-xs font-bold text-white shadow-md transition disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {submitting ? (
              <>
                <RefreshCw size={13} className="animate-spin" />
                <span>Connecting & Refreshing...</span>
              </>
            ) : (
              <>
                <Sparkles size={13} />
                <span>Activate 24-Hr Live Feed</span>
              </>
            )}
          </button>
        </div>

        {/* Feedback Message */}
        {feedback && (
          <div
            className={`mt-2.5 rounded-lg px-3 py-1.5 text-xs font-medium flex items-center gap-2 ${
              feedback.type === "success"
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                : feedback.type === "error"
                ? "bg-red-500/20 text-red-300 border border-red-500/30"
                : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
            }`}
          >
            {feedback.type === "success" ? (
              <CheckCircle2 size={13} className="shrink-0" />
            ) : (
              <AlertTriangle size={13} className="shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}
      </form>
    </div>
  );
}

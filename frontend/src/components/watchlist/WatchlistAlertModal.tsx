"use client";

import React, { useState, useEffect } from "react";
import {
  Bell,
  Check,
  AlertTriangle,
  Trash2,
  Send,
  Plus,
  Target,
  Shield,
  Activity,
  Zap,
  TrendingUp,
  X,
  Clock,
  Sparkles,
  Volume2,
} from "lucide-react";
import {
  fetchAlertsForSymbol,
  createWatchlistAlert,
  updateAlertStatus,
  deleteWatchlistAlert,
} from "@/lib/watchlistApi";
import type { WatchlistAlertItem, CreateWatchlistAlertPayload } from "@/types/watchlist";

interface WatchlistAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbol: string;
  watchlistId: number;
  currentPrice?: number | null;
  dma50?: number | null;
  dma200?: number | null;
  onAlertsChanged?: () => void;
}

const RULE_OPTIONS = [
  {
    type: "PRICE_CROSS_ABOVE",
    label: "Price Crosses Above Target (Resistance)",
    category: "PRICE",
    defaultOffset: 1.05, // +5%
    desc: "Triggers when price breaks above target or breakout resistance level",
  },
  {
    type: "PRICE_CROSS_BELOW",
    label: "Price Drops Below Stop-Loss (Support)",
    category: "PRICE",
    defaultOffset: 0.95, // -5%
    desc: "Triggers when price falls below support or invalidation stop level",
  },
  {
    type: "DMA_50_RECLAIM",
    label: "50 DMA Bullish Reclaim",
    category: "DMA",
    desc: "Triggers when price crosses above institutional 50-day moving average",
  },
  {
    type: "DMA_200_BOUNCE",
    label: "200 DMA Long-Term Support Test",
    category: "DMA",
    desc: "Triggers when price touches and holds the macro 200-day moving average",
  },
  {
    type: "VCP_PIVOT_BREAK",
    label: "Minervini VCP Pivot Breakout",
    category: "PATTERN",
    desc: "Triggers when volatility contraction coils tightly and breaches the pivot point",
  },
  {
    type: "VOLUME_SPIKE_2X",
    label: "Volume Surge (>= 2.0x 20D Average)",
    category: "VOLUME",
    defaultVal: 2.0,
    desc: "Triggers when trading volume explodes past institutional baseline",
  },
  {
    type: "PERCENT_SURGE_3",
    label: "Day Momentum Surge (>= +3.0%)",
    category: "MOMENTUM",
    defaultVal: 3.0,
    desc: "Triggers on powerful single-day momentum ignition",
  },
  {
    type: "MOMENTUM_MATCH_9",
    label: "Super Momentum Radar (>= 9/10 Match)",
    category: "MOMENTUM",
    desc: "Triggers when 9 out of 10 multi-timeframe momentum gates turn green",
  },
];

export default function WatchlistAlertModal({
  isOpen,
  onClose,
  symbol,
  watchlistId,
  currentPrice,
  dma50,
  dma200,
  onAlertsChanged,
}: WatchlistAlertModalProps) {
  const [activeTab, setActiveTab] = useState<"new" | "manage">("new");
  const [alerts, setAlerts] = useState<WatchlistAlertItem[]>([]);
  const [loadingAlerts, setLoadingAlerts] = useState(true);
  const [creating, setCreating] = useState(false);

  // Form State
  const [ruleType, setRuleType] = useState<string>("PRICE_CROSS_ABOVE");
  const [thresholdValue, setThresholdValue] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [notifyInApp, setNotifyInApp] = useState(true);
  const [notifyTelegram, setNotifyTelegram] = useState(true);
  const [notice, setNotice] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Load existing alerts for this symbol
  const loadAlerts = async () => {
    try {
      setLoadingAlerts(true);
      const res = await fetchAlertsForSymbol(symbol);
      setAlerts(res.alerts || []);
    } catch (err) {
      console.error("Failed to load alerts:", err);
    } finally {
      setLoadingAlerts(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadAlerts();
      setNotice(null);

      // Pre-fill threshold value based on selected rule
      if (currentPrice && currentPrice > 0) {
        setThresholdValue((currentPrice * 1.05).toFixed(2));
      } else {
        setThresholdValue("");
      }
    }
  }, [isOpen, symbol, currentPrice]);

  // Update default threshold when ruleType changes
  const handleRuleTypeChange = (newType: string) => {
    setRuleType(newType);
    if (!currentPrice || currentPrice <= 0) return;

    if (newType === "PRICE_CROSS_ABOVE") {
      setThresholdValue((currentPrice * 1.05).toFixed(2));
    } else if (newType === "PRICE_CROSS_BELOW") {
      setThresholdValue((currentPrice * 0.95).toFixed(2));
    } else if (newType === "DMA_50_RECLAIM" && dma50) {
      setThresholdValue(dma50.toFixed(2));
    } else if (newType === "DMA_200_BOUNCE" && dma200) {
      setThresholdValue(dma200.toFixed(2));
    } else if (newType === "VOLUME_SPIKE_2X") {
      setThresholdValue("2.0");
    } else if (newType === "PERCENT_SURGE_3") {
      setThresholdValue("3.0");
    } else {
      setThresholdValue("");
    }
  };

  const handleCreateAlert = async () => {
    setCreating(true);
    setNotice(null);

    try {
      const val = thresholdValue ? parseFloat(thresholdValue) : undefined;
      await createWatchlistAlert(watchlistId, {
        symbol: symbol.toUpperCase(),
        rule_type: ruleType,
        threshold_value: val,
        notes: notes.trim() || undefined,
        notify_in_app: notifyInApp,
        notify_telegram: notifyTelegram,
      });

      setNotice({ type: "success", msg: `Alert configured successfully for ${symbol}!` });
      await loadAlerts();
      if (onAlertsChanged) onAlertsChanged();
      setActiveTab("manage");
    } catch (err: any) {
      setNotice({ type: "error", msg: err.message || "Failed to create alert rule." });
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = async (alertId: number, currentStatus: string) => {
    const nextStatus = currentStatus === "ACTIVE" ? "MUTED" : "ACTIVE";
    try {
      await updateAlertStatus(alertId, nextStatus as any);
      await loadAlerts();
      if (onAlertsChanged) onAlertsChanged();
    } catch (err: any) {
      alert("Failed to update status: " + err.message);
    }
  };

  const handleDelete = async (alertId: number) => {
    if (!confirm("Are you sure you want to delete this alert rule?")) return;
    try {
      await deleteWatchlistAlert(alertId);
      await loadAlerts();
      if (onAlertsChanged) onAlertsChanged();
    } catch (err: any) {
      alert("Failed to delete alert: " + err.message);
    }
  };

  if (!isOpen) return null;

  const activeRuleConfig = RULE_OPTIONS.find((r) => r.type === ruleType);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-2xl border border-slate-700/80 bg-[#070F1E] p-6 shadow-2xl text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Bell className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-wide font-mono">
                  {symbol}
                </h2>
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-cyan-400 font-semibold border border-slate-700">
                  NSE
                </span>
                {currentPrice && (
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    CMP: ₹{currentPrice.toLocaleString("en-IN")}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Configure institutional trigger conditions & personal Telegram broadcasts
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center rounded-xl border border-slate-800 bg-slate-900/60 p-1 mb-4 text-xs font-semibold">
          <button
            onClick={() => setActiveTab("new")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition ${
              activeTab === "new"
                ? "bg-cyan-500 text-slate-950 font-bold shadow-xs"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Rule Trigger</span>
          </button>
          <button
            onClick={() => setActiveTab("manage")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition ${
              activeTab === "manage"
                ? "bg-cyan-500 text-slate-950 font-bold shadow-xs"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Active Rules ({alerts.length})</span>
          </button>
        </div>

        {/* Notice */}
        {notice && (
          <div
            className={`mb-4 flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-medium ${
              notice.type === "success"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-rose-500/30 bg-rose-500/10 text-rose-300"
            }`}
          >
            {notice.type === "success" ? <Check className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
            <span>{notice.msg}</span>
          </div>
        )}

        {/* Tab 1: Create New Rule */}
        {activeTab === "new" && (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            {/* Rule Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Select Trigger Condition
              </label>
              <select
                value={ruleType}
                onChange={(e) => handleRuleTypeChange(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3.5 py-2.5 text-xs text-white focus:border-cyan-500 focus:outline-hidden"
              >
                {RULE_OPTIONS.map((opt) => (
                  <option key={opt.type} value={opt.type}>
                    [{opt.category}] {opt.label}
                  </option>
                ))}
              </select>
              {activeRuleConfig && (
                <p className="mt-1 text-[11px] text-cyan-400/90">{activeRuleConfig.desc}</p>
              )}
            </div>

            {/* Threshold Value Field */}
            {ruleType !== "MOMENTUM_MATCH_9" && ruleType !== "VCP_PIVOT_BREAK" && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {ruleType === "VOLUME_SPIKE_2X"
                    ? "Volume Multiplier (x Avg 20D)"
                    : ruleType === "PERCENT_SURGE_3"
                    ? "Percentage Gain Threshold (%)"
                    : "Target Price Level (₹)"}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.05"
                    value={thresholdValue}
                    onChange={(e) => setThresholdValue(e.target.value)}
                    placeholder="e.g. 385.00"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3.5 py-2 font-mono text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-hidden"
                  />
                  {currentPrice && (
                    <button
                      type="button"
                      onClick={() => setThresholdValue(currentPrice.toString())}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-cyan-400 hover:underline"
                    >
                      Use CMP (₹{currentPrice})
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Thesis Note */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Trade Plan / Rationale <span className="text-slate-500 font-normal">(Included in Telegram dispatch)</span>
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Breakout above cup-and-handle pivot with expanding volume. Target: +10%."
                className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-hidden"
              />
            </div>

            {/* Notification Channels */}
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Dispatch Channels
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-800 bg-slate-900/40 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyInApp}
                    onChange={(e) => setNotifyInApp(e.target.checked)}
                    className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                  />
                  <div className="flex items-center gap-1.5 font-medium">
                    <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                    <span>In-App Audio / Visual</span>
                  </div>
                </label>

                <label className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-800 bg-slate-900/40 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyTelegram}
                    onChange={(e) => setNotifyTelegram(e.target.checked)}
                    className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                  />
                  <div className="flex items-center gap-1.5 font-medium">
                    <Send className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Personal Telegram</span>
                  </div>
                </label>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={handleCreateAlert}
                disabled={creating}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-cyan-500 py-2.5 text-xs font-bold text-slate-950 hover:bg-cyan-400 disabled:opacity-50 transition shadow-md shadow-cyan-950"
              >
                <Bell className="w-4 h-4" />
                <span>{creating ? "Arming Trigger..." : "Arm Alert Rule"}</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: Manage Existing Alerts */}
        {activeTab === "manage" && (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {loadingAlerts ? (
              <div className="py-8 text-center text-xs text-slate-400">Loading active rules...</div>
            ) : alerts.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No alert rules currently configured for {symbol}. Switch to the "New Rule Trigger" tab to create one!
              </div>
            ) : (
              alerts.map((al) => (
                <div
                  key={al.id}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-slate-800 bg-slate-900/50 hover:border-slate-700 transition"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block w-2 h-2 rounded-full ${
                          al.status === "ACTIVE"
                            ? "bg-emerald-400 animate-pulse"
                            : al.status === "TRIGGERED"
                            ? "bg-cyan-400"
                            : "bg-slate-500"
                        }`}
                      />
                      <span className="text-xs font-bold text-white">
                        {al.rule_type.replace(/_/g, " ")}
                      </span>
                      {al.threshold_value && (
                        <span className="font-mono text-xs font-bold text-cyan-400">
                          ₹{al.threshold_value}
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-mono font-semibold px-2 py-0.2 rounded-full border ${
                          al.status === "ACTIVE"
                            ? "border-emerald-500/40 text-emerald-400 bg-emerald-950/40"
                            : al.status === "TRIGGERED"
                            ? "border-cyan-500/40 text-cyan-400 bg-cyan-950/40"
                            : "border-slate-700 text-slate-400"
                        }`}
                      >
                        {al.status}
                      </span>
                    </div>

                    {al.notes && (
                      <p className="text-[11px] text-slate-400 italic">"{al.notes}"</p>
                    )}

                    <div className="flex items-center gap-3 text-[10px] text-slate-500 font-mono">
                      <span>Triggered: {al.trigger_count}x</span>
                      {al.last_triggered_at && (
                        <span>Last: {new Date(al.last_triggered_at).toLocaleTimeString()}</span>
                      )}
                      {al.notify_telegram && <span className="text-cyan-400">📲 Telegram Active</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleToggleStatus(al.id, al.status)}
                      className="px-2.5 py-1 rounded-lg border border-slate-700 text-[11px] font-semibold text-slate-300 hover:bg-slate-800 transition"
                    >
                      {al.status === "ACTIVE" ? "Mute" : "Activate"}
                    </button>
                    <button
                      onClick={() => handleDelete(al.id)}
                      className="p-1.5 rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

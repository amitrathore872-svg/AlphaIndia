"use client";

import React, { useState, useEffect } from "react";
import {
  Bell,
  Check,
  AlertTriangle,
  Send,
  ExternalLink,
  Shield,
  Zap,
  Radio,
  Clock,
  Sparkles,
  HelpCircle,
  X,
  MessageSquare,
} from "lucide-react";
import {
  fetchPersonalTelegramConfig,
  updatePersonalTelegramConfig,
  testPersonalTelegramPing,
} from "@/lib/watchlistApi";
import type { PersonalTelegramConfig } from "@/types/watchlist";

interface PersonalTelegramSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved?: (config: PersonalTelegramConfig) => void;
}

export default function PersonalTelegramSettingsModal({
  isOpen,
  onClose,
  onConfigSaved,
}: PersonalTelegramSettingsModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [chatId, setChatId] = useState("");
  const [channelName, setChannelName] = useState("Personal Watchlist Radar");
  const [botToken, setBotToken] = useState("");
  const [telegramUsername, setTelegramUsername] = useState("");
  const [isEnabled, setIsEnabled] = useState(true);

  // Granular toggles
  const [notifyPriceCross, setNotifyPriceCross] = useState(true);
  const [notifyDmaReclaim, setNotifyDmaReclaim] = useState(true);
  const [notifyVcpBreakout, setNotifyVcpBreakout] = useState(true);
  const [notifyVolumeSurge, setNotifyVolumeSurge] = useState(true);
  const [notifyTargetStop, setNotifyTargetStop] = useState(true);

  const [notice, setNotice] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setNotice(null);

    fetchPersonalTelegramConfig()
      .then((res) => {
        if (res.config) {
          setChatId(res.config.chat_id || "");
          setChannelName(res.config.channel_name || "Personal Watchlist Radar");
          setBotToken(res.config.bot_token || "");
          setTelegramUsername(res.config.telegram_username || "");
          setIsEnabled(res.config.is_enabled ?? true);
          setNotifyPriceCross(res.config.notify_price_cross ?? true);
          setNotifyDmaReclaim(res.config.notify_dma_reclaim ?? true);
          setNotifyVcpBreakout(res.config.notify_vcp_breakout ?? true);
          setNotifyVolumeSurge(res.config.notify_volume_surge ?? true);
          setNotifyTargetStop(res.config.notify_target_stop ?? true);
        }
      })
      .catch((err) => {
        console.error("Failed to load personal Telegram config:", err);
      })
      .finally(() => setLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!chatId.trim()) {
      setNotice({ type: "error", msg: "Please enter your Telegram Chat ID or Channel ID." });
      return;
    }
    setSaving(true);
    setNotice(null);

    try {
      const res = await updatePersonalTelegramConfig({
        chat_id: chatId.trim(),
        channel_name: channelName.trim(),
        bot_token: botToken.trim() || undefined,
        telegram_username: telegramUsername.trim() || undefined,
        is_enabled: isEnabled,
        notify_price_cross: notifyPriceCross,
        notify_dma_reclaim: notifyDmaReclaim,
        notify_vcp_breakout: notifyVcpBreakout,
        notify_volume_surge: notifyVolumeSurge,
        notify_target_stop: notifyTargetStop,
      });

      setNotice({ type: "success", msg: "Personal Telegram channel settings saved successfully!" });
      if (onConfigSaved) onConfigSaved(res.config);
    } catch (err: any) {
      setNotice({ type: "error", msg: err.message || "Failed to save configuration." });
    } finally {
      setSaving(false);
    }
  };

  const handleTestPing = async () => {
    if (!chatId.trim()) {
      setNotice({ type: "error", msg: "Enter a Telegram Chat ID first to test." });
      return;
    }
    setTesting(true);
    setNotice(null);

    try {
      const res = await testPersonalTelegramPing({
        chat_id: chatId.trim(),
        bot_token: botToken.trim() || undefined,
      });
      setNotice({
        type: "success",
        msg: `✅ Test ping delivered! Check your Telegram chat (${chatId}).`,
      });
    } catch (err: any) {
      setNotice({
        type: "error",
        msg: err.message || "Test ping failed. Check your chat ID and ensure you have started the bot.",
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl rounded-2xl border border-slate-700/80 bg-[#070F1E] p-6 shadow-2xl text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
                Personalized Telegram Channel
                <span className="rounded-full bg-cyan-950/80 border border-cyan-800/60 px-2 py-0.5 text-[10px] font-mono text-cyan-400 font-semibold">
                  PRIVATE RADAR
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Direct, noise-free execution alerts dispatched exclusively for your watchlist stocks
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

        {/* Notice Banner */}
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

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading Telegram settings...</div>
        ) : (
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            {/* Master Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-slate-900/60">
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-white">Enable Personal Broadcast</span>
                <p className="text-[11px] text-slate-400">Dispatch triggered watchlist rules to Telegram</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={(e) => setIsEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 bg-slate-700 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500"></div>
              </label>
            </div>

            {/* Chat ID Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-300">
                  Your Telegram Chat ID / Private Channel ID <span className="text-cyan-400">*</span>
                </label>
                <a
                  href="https://t.me/userinfobot"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-cyan-400 hover:underline flex items-center gap-1"
                >
                  <span>Find my Chat ID</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <input
                type="text"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                placeholder="e.g. 8349099576 or -100192837465"
                className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3.5 py-2 font-mono text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-hidden"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                You can enter your personal user Chat ID (from <code className="text-cyan-300">@userinfobot</code>) or a private channel ID where you added the bot as admin.
              </p>
            </div>

            {/* Channel Name & Optional Custom Bot */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Channel Name</label>
                <input
                  type="text"
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  placeholder="My Watchlist Radar"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Telegram Username</label>
                <input
                  type="text"
                  value={telegramUsername}
                  onChange={(e) => setTelegramUsername(e.target.value)}
                  placeholder="@amitrathore"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Optional Custom Bot Token */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Custom Bot Token <span className="text-[10px] text-slate-400 font-normal">(Optional — defaults to verified Alpha India Bot)</span>
              </label>
              <input
                type="password"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder="Leave blank to use default system bot"
                className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3.5 py-2 font-mono text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-hidden"
              />
            </div>

            {/* Granular Rule Filters */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Rule Alert Notification Toggles
              </span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-800 bg-slate-900/40 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyPriceCross}
                    onChange={(e) => setNotifyPriceCross(e.target.checked)}
                    className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                  />
                  <span>Price Crossing Target/Stop</span>
                </label>

                <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-800 bg-slate-900/40 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyDmaReclaim}
                    onChange={(e) => setNotifyDmaReclaim(e.target.checked)}
                    className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                  />
                  <span>50 / 200 DMA Reclaim</span>
                </label>

                <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-800 bg-slate-900/40 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyVcpBreakout}
                    onChange={(e) => setNotifyVcpBreakout(e.target.checked)}
                    className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                  />
                  <span>Minervini VCP Breakouts</span>
                </label>

                <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-800 bg-slate-900/40 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyVolumeSurge}
                    onChange={(e) => setNotifyVolumeSurge(e.target.checked)}
                    className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                  />
                  <span>Volume Surges (&gt; 2x Avg)</span>
                </label>
              </div>
            </div>

            {/* Test Ping & Setup Instructions */}
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-3 text-[11px] text-cyan-300 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Quick Setup Tip:</span>
              </div>
              <p className="text-slate-300">
                1. Open Telegram and search for <strong className="text-cyan-300">@AlphaIndiaRadarBot</strong> (or your custom bot).<br />
                2. Tap <strong className="text-cyan-300">/start</strong>.<br />
                3. Send a test ping below to verify that alerts reach your device instantly.
              </p>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-between border-t border-slate-800 pt-4 mt-5">
          <button
            onClick={handleTestPing}
            disabled={testing || !chatId.trim()}
            className="flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs font-bold text-amber-300 hover:bg-amber-500 hover:text-slate-950 disabled:opacity-50 transition shadow-xs"
          >
            <Radio className={`w-3.5 h-3.5 ${testing ? "animate-pulse" : ""}`} />
            <span>{testing ? "Dispatching Ping..." : "Send Test Ping"}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !chatId.trim()}
              className="flex items-center gap-1.5 rounded-xl bg-cyan-500 px-5 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-400 disabled:opacity-50 transition shadow-md shadow-cyan-950"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{saving ? "Saving..." : "Save Configuration"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

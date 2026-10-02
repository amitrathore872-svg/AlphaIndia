"use client";

import React, { useState, useEffect } from "react";
import {
  Send,
  Check,
  AlertTriangle,
  ExternalLink,
  Shield,
  Zap,
  Radio,
  Clock,
  Sparkles,
  HelpCircle,
  X,
  TrendingUp,
  TrendingDown,
  Scale,
  Target,
  Sliders,
} from "lucide-react";
import {
  portfolioApi,
  PortfolioTelegramConfig,
} from "@/lib/portfolioApi";

interface PortfolioTelegramModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved?: (config: PortfolioTelegramConfig) => void;
}

export default function PortfolioTelegramModal({
  isOpen,
  onClose,
  onConfigSaved,
}: PortfolioTelegramModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [chatId, setChatId] = useState("");
  const [channelName, setChannelName] = useState("Alpha India | Portfolio & Watchlist Radar");
  const [botToken, setBotToken] = useState("");
  const [telegramUsername, setTelegramUsername] = useState("");
  const [isEnabled, setIsEnabled] = useState(true);

  // Granular BUY toggles
  const [notifyPortfolioBuy, setNotifyPortfolioBuy] = useState(true);
  const [notifyWatchlistBuy, setNotifyWatchlistBuy] = useState(true);

  // Granular SELL toggles
  const [notifyPortfolioSell, setNotifyPortfolioSell] = useState(true);
  const [notifyWatchlistSell, setNotifyWatchlistSell] = useState(true);

  // Rebalance toggle
  const [notifyPortfolioRebalance, setNotifyPortfolioRebalance] = useState(true);
  const [minConvictionScore, setMinConvictionScore] = useState(75);

  const [notice, setNotice] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setNotice(null);

    portfolioApi
      .getTelegramConfig()
      .then((res) => {
        if (res.config) {
          setChatId(res.config.chat_id || "");
          setChannelName(res.config.channel_name || "Alpha India | Portfolio & Watchlist Radar");
          setBotToken(res.config.bot_token || "");
          setTelegramUsername(res.config.telegram_username || "");
          setIsEnabled(res.config.is_enabled ?? true);

          setNotifyPortfolioBuy(res.config.notify_portfolio_buy ?? true);
          setNotifyPortfolioSell(res.config.notify_portfolio_sell ?? true);
          setNotifyPortfolioRebalance(res.config.notify_portfolio_rebalance ?? true);
          setNotifyWatchlistBuy(res.config.notify_watchlist_buy ?? true);
          setNotifyWatchlistSell(res.config.notify_watchlist_sell ?? true);
          setMinConvictionScore(res.config.min_conviction_score ?? 75);
        }
      })
      .catch((err) => {
        console.error("Failed to load portfolio Telegram config:", err);
      })
      .finally(() => setLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!chatId.trim()) {
      setNotice({ type: "error", msg: "Please enter your Telegram Chat ID or Channel/Group ID." });
      return;
    }
    setSaving(true);
    setNotice(null);

    try {
      const res = await portfolioApi.updateTelegramConfig({
        chat_id: chatId.trim(),
        channel_name: channelName.trim(),
        bot_token: botToken.trim() || undefined,
        telegram_username: telegramUsername.trim() || undefined,
        is_enabled: isEnabled,
        notify_portfolio_buy: notifyPortfolioBuy,
        notify_portfolio_sell: notifyPortfolioSell,
        notify_portfolio_rebalance: notifyPortfolioRebalance,
        notify_watchlist_buy: notifyWatchlistBuy,
        notify_watchlist_sell: notifyWatchlistSell,
        min_conviction_score: minConvictionScore,
      });

      setNotice({
        type: "success",
        msg: "Dedicated Portfolio & Watchlist Telegram settings saved successfully!",
      });
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
      await portfolioApi.testTelegramPing({
        chat_id: chatId.trim(),
        bot_token: botToken.trim() || undefined,
      });
      setNotice({
        type: "success",
        msg: `✅ Test ping delivered! Check your Telegram chat/group (${chatId}).`,
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
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-700/80 bg-[#070F1E] p-6 shadow-2xl text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-wide">
                  Portfolio & Watchlist Telegram Radar
                </h2>
                <span className="rounded-full bg-cyan-950/80 border border-cyan-800/60 px-2 py-0.5 text-[10px] font-mono text-cyan-400 font-semibold">
                  SEPARATE DEDICATED CHANNEL
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Noise-free institutional BUY & SELL execution signals specifically for your holdings
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

        {/* Isolation Banner */}
        <div className="mb-4 rounded-xl border border-cyan-500/30 bg-cyan-950/30 p-3 text-xs text-cyan-300 flex items-start gap-2.5">
          <Shield className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <div className="text-[11px] leading-relaxed text-slate-300">
            <strong className="text-white">Isolated Telegram Stream:</strong> This chat/group is{" "}
            <span className="text-cyan-400 font-semibold underline underline-offset-2">completely separate</span> from public screener engine alerts.
            It delivers confidential, high-conviction BUY zone entries, profit booking targets, stop-loss breaks, and rebalancing alerts.
          </div>
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
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            {/* Master Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-800 bg-slate-900/60">
              <div className="space-y-0.5">
                <span className="text-xs font-semibold text-white">Enable Dedicated Telegram Signals</span>
                <p className="text-[11px] text-slate-400">
                  Broadcast real-time BUY & SELL triggers to this separate group
                </p>
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
                  Target Telegram Chat ID / Private Channel ID <span className="text-cyan-400">*</span>
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
                placeholder="e.g. 8349099576 or private channel -100192837465"
                className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3.5 py-2 font-mono text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-hidden"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Enter your personal user Chat ID (from <code className="text-cyan-300">@userinfobot</code>) or your private group/channel ID.
              </p>
            </div>

            {/* Channel Name & Username */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Channel / Group Label</label>
                <input
                  type="text"
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  placeholder="Alpha India | Portfolio Radar"
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
                Custom Bot Token <span className="text-[10px] text-slate-400 font-normal">(Optional — defaults to official Alpha India Bot)</span>
              </label>
              <input
                type="password"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder="Leave blank to use default verified Alpha India bot"
                className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3.5 py-2 font-mono text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-hidden"
              />
            </div>

            {/* SIGNAL TOGGLES SECTION */}
            <div className="pt-2 border-t border-slate-800 space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                Granular Execution Signal Filters
              </span>

              {/* BUY SIGNALS */}
              <div className="rounded-xl border border-emerald-900/40 bg-emerald-950/10 p-3 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
                  <TrendingUp className="w-4 h-4" />
                  <span>🟢 BUY SIGNALS RADAR</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-800 bg-slate-900/60 cursor-pointer hover:border-emerald-500/40 transition">
                    <input
                      type="checkbox"
                      checked={notifyPortfolioBuy}
                      onChange={(e) => setNotifyPortfolioBuy(e.target.checked)}
                      className="rounded border-slate-700 text-emerald-500 focus:ring-0"
                    />
                    <div>
                      <span className="font-semibold text-white">Portfolio Buy Signals</span>
                      <p className="text-[10px] text-slate-400">Best Buy & Accumulate Zones, Strong Buy upgrades</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-800 bg-slate-900/60 cursor-pointer hover:border-emerald-500/40 transition">
                    <input
                      type="checkbox"
                      checked={notifyWatchlistBuy}
                      onChange={(e) => setNotifyWatchlistBuy(e.target.checked)}
                      className="rounded border-slate-700 text-emerald-500 focus:ring-0"
                    />
                    <div>
                      <span className="font-semibold text-white">Watchlist Buy Triggers</span>
                      <p className="text-[10px] text-slate-400">Price crosses above, 50 DMA, VCP breakouts, Volume 2x</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* SELL SIGNALS */}
              <div className="rounded-xl border border-rose-900/40 bg-rose-950/10 p-3 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-rose-400">
                  <TrendingDown className="w-4 h-4" />
                  <span>🔴 SELL SIGNALS RADAR</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-800 bg-slate-900/60 cursor-pointer hover:border-rose-500/40 transition">
                    <input
                      type="checkbox"
                      checked={notifyPortfolioSell}
                      onChange={(e) => setNotifyPortfolioSell(e.target.checked)}
                      className="rounded border-slate-700 text-rose-500 focus:ring-0"
                    />
                    <div>
                      <span className="font-semibold text-white">Portfolio Sell Signals</span>
                      <p className="text-[10px] text-slate-400">Profit booking target reached, Stop loss breached, Exit downgrade</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-lg border border-slate-800 bg-slate-900/60 cursor-pointer hover:border-rose-500/40 transition">
                    <input
                      type="checkbox"
                      checked={notifyWatchlistSell}
                      onChange={(e) => setNotifyWatchlistSell(e.target.checked)}
                      className="rounded border-slate-700 text-rose-500 focus:ring-0"
                    />
                    <div>
                      <span className="font-semibold text-white">Watchlist Stop/Sell Triggers</span>
                      <p className="text-[10px] text-slate-400">Price crosses below stop, 200 DMA support breach</p>
                    </div>
                  </label>
                </div>
              </div>

              {/* REBALANCING & CONVICTION THRESHOLD */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-800 bg-slate-900/60 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notifyPortfolioRebalance}
                    onChange={(e) => setNotifyPortfolioRebalance(e.target.checked)}
                    className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                  />
                  <div>
                    <span className="font-semibold text-white flex items-center gap-1">
                      <Scale className="w-3.5 h-3.5 text-cyan-400" />
                      Rebalancing Warnings
                    </span>
                    <p className="text-[10px] text-slate-400">Trim overweight (&gt;25%) & Add underweight dips</p>
                  </div>
                </label>

                <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-900/60 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-white block">Min Conviction Score</span>
                    <span className="text-[10px] text-slate-400">Trigger Buy alerts at ≥ {minConvictionScore} pts</span>
                  </div>
                  <input
                    type="number"
                    min="50"
                    max="95"
                    value={minConvictionScore}
                    onChange={(e) => setMinConvictionScore(parseInt(e.target.value) || 75)}
                    className="w-16 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-center font-mono text-xs text-cyan-400 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* Quick Setup Tip */}
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-3 text-[11px] text-cyan-300 space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Private Group / Channel Setup Tip:</span>
              </div>
              <p className="text-slate-300">
                1. Create a private Telegram Group or Channel (e.g. &quot;My Portfolio Radar&quot;).<br />
                2. Add <strong className="text-cyan-300">@AlphaIndiaRadarBot</strong> as an Admin with message posting rights.<br />
                3. Enter the Channel ID (e.g. <code className="text-cyan-300">-100xxxxxxx</code>) or your personal Chat ID above.<br />
                4. Tap <strong>Send Test Ping</strong> to verify instant connectivity.
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

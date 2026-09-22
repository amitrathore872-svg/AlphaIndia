"use client";

import React, { useState, useEffect } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import {
  BellRing,
  Send,
  Share2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Zap,
  Radio,
  TrendingUp,
  Sliders,
  FileText,
  Copy,
  ShieldCheck,
  Info,
  Check,
  ArrowUpRight,
  Target,
  Sparkles,
  Flame,
} from "lucide-react";
import {
  notificationsApi,
  ChannelConfig,
  AlertDispatchLogItem,
  OpportunityThresholds,
  OpportunityScanResult,
  SystemNotificationItem,
} from "@/lib/notificationsApi";

interface TelegramTestResponse {
  status: string;
  bot_info?: {
    valid: boolean;
    bot_name?: string;
    bot_username?: string;
    bot_id?: number;
    error?: string;
  };
  dispatch_result?: {
    success: boolean;
    message_id?: number;
    error?: string;
  };
  error?: string;
}

export default function AlertCenterPage() {
  const [activeTab, setActiveTab] = useState<"opportunities" | "channels" | "rules" | "broadcast" | "logs">("opportunities");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error" | "info"; msg: string } | null>(null);

  // Opportunity Alert state
  const [oppRules, setOppRules] = useState<OpportunityThresholds>({
    vcp_signals_enabled: true,
    vcp_min_score: 90,
    prebreakout_a_plus_enabled: true,
    prebreakout_min_conviction: 80,
    momentum_match_9_enabled: true,
    momentum_min_matches: 9,
    momentum_conviction_79_enabled: true,
    momentum_min_conviction: 79,
    auto_broadcast_telegram: true,
    auto_broadcast_whatsapp: true,
  });
  const [oppScanning, setOppScanning] = useState(false);
  const [oppScanResult, setOppScanResult] = useState<OpportunityScanResult | null>(null);
  const [recentOpportunities, setRecentOpportunities] = useState<SystemNotificationItem[]>([]);

  // Channel configs state
  const [configs, setConfigs] = useState<Record<string, ChannelConfig>>({});
  
  // Telegram form
  const [tgToken, setTgToken] = useState("");
  const [tgChatId, setTgChatId] = useState("");
  const [tgEnabled, setTgEnabled] = useState(true);
  const [tgTesting, setTgTesting] = useState(false);
  const [tgDetecting, setTgDetecting] = useState(false);
  const [tgDiscoveredChats, setTgDiscoveredChats] = useState<
    Array<{ id: string; type: string; title: string; username?: string }>
  >([]);
  const [tgTestResult, setTgTestResult] = useState<TelegramTestResponse | null>(null);

  // WhatsApp form
  const [waApiKey, setWaApiKey] = useState("");
  const [waPhoneId, setWaPhoneId] = useState("");
  const [waRecipient, setWaRecipient] = useState("");
  const [waEnabled, setWaEnabled] = useState(true);

  // Automated rules
  const [rules, setRules] = useState({
    pead_enabled: true,
    pead_min_conviction: 80,
    catalyst_enabled: true,
    catalyst_min_cr: 1000,
    growth_enabled: true,
    growth_min_pat_pct: 50,
    smart_money_enabled: true,
    system_alerts_enabled: true,
    vcp_enabled: true,
    vcp_min_score: 90,
    vcp_elite_only: false,
  });

  // Broadcast composer state
  const [composerType, setComposerType] = useState<"PEAD" | "CATALYST" | "GROWTH" | "VCP" | "CUSTOM">("PEAD");
  const [composerSymbol, setComposerSymbol] = useState("TRENT");
  const [composerName, setComposerName] = useState("Trent Ltd");
  const [composerTitle, setComposerTitle] = useState("⚡ ATHENA FLASH: TRENT LTD (Grade AAA+)");
  const [composerMessage, setComposerMessage] = useState(
    `⚡ *ALPHA INDIA | ATHENA PEAD FLASH*\n━━━━━━━━━━━━━━━━━━━━━\n🏢 *Trent Ltd* (\`TRENT\`)\n🎯 *Signal:* STRONG BUY | *Grade:* AAA+ (94/100)\n📈 *QoQ/YoY Growth:*\n   • PAT: ₹412.5 Cr (+142.5% YoY)\n   • Revenue: ₹3,450.0 Cr (+53.8% YoY)\n🎯 *Upside Potential:* +18.5%\n💡 *Institutional Thesis:*\nAggressive retail store expansion drives exceptional operating leverage with clean earnings quality.\n━━━━━━━━━━━━━━━━━━━━━\n📡 _Dispatched via Alpha India Terminal_`
  );
  const [selectedChannels, setSelectedChannels] = useState<("TELEGRAM" | "WHATSAPP")[]>(["TELEGRAM", "WHATSAPP"]);
  const [broadcasting, setBroadcasting] = useState(false);

  // Dispatch logs
  const [logs, setLogs] = useState<AlertDispatchLogItem[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Fetch initial channel configs
  const loadConfigs = async () => {
    try {
      setLoading(true);
      const data = await notificationsApi.getChannelConfigs();
      setConfigs(data);
      if (data.TELEGRAM) {
        setTgToken(data.TELEGRAM.bot_token || "");
        setTgChatId(data.TELEGRAM.chat_id || "");
        setTgEnabled(data.TELEGRAM.is_enabled);
        if (data.TELEGRAM.auto_rules) {
          setRules((prev) => ({ ...prev, ...data.TELEGRAM.auto_rules }));
        }
      }
      if (data.WHATSAPP) {
        setWaApiKey(data.WHATSAPP.api_key || "");
        setWaPhoneId(data.WHATSAPP.phone_number_id || "");
        setWaRecipient(data.WHATSAPP.target_recipient || "");
        setWaEnabled(data.WHATSAPP.is_enabled);
      }

      // Load Opportunity Radar threshold rules & recent notifications
      try {
        const oppData = await notificationsApi.getOpportunityThresholds();
        if (oppData) setOppRules(oppData);
        const recent = await notificationsApi.getRecentOpportunities(25);
        setRecentOpportunities(recent || []);
      } catch (oppErr) {
        console.error("Failed to load opportunity thresholds:", oppErr);
      }
    } catch (err) {
      console.error("Failed to load channel configs:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleScanOpportunities = async (force: boolean = false) => {
    setOppScanning(true);
    setNotice(null);
    try {
      const res = await notificationsApi.scanOpportunityAlerts(force);
      setOppScanResult(res);
      const recent = await notificationsApi.getRecentOpportunities(25);
      setRecentOpportunities(recent || []);
      showNotification(
        "success",
        `Scan complete! Dispatched ${res.new_alerts_count} new opportunity alert(s). Skipped ${res.skipped_duplicates_count} daily duplicate(s).`
      );
    } catch (err: unknown) {
      showNotification("error", `Opportunity scan failed: ${(err as Error).message}`);
    } finally {
      setOppScanning(false);
    }
  };

  const handleSaveOpportunityRules = async () => {
    try {
      setLoading(true);
      const updated = await notificationsApi.updateOpportunityThresholds(oppRules);
      setOppRules(updated);
      showNotification("success", "Opportunity Radar alert thresholds updated and saved.");
    } catch (err: unknown) {
      showNotification("error", `Failed to save opportunity thresholds: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async () => {
    try {
      setLogsLoading(true);
      const data = await notificationsApi.getDispatchLogs({ limit: 40 });
      setLogs(data.logs || []);
    } catch (err) {
      console.error("Failed to load dispatch logs:", err);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    loadConfigs();
  }, []);

  useEffect(() => {
    if (activeTab === "logs") {
      loadLogs();
    }
  }, [activeTab]);

  const showNotification = (type: "success" | "error" | "info", msg: string) => {
    setNotice({ type, msg });
    setTimeout(() => setNotice(null), 4000);
  };

  const handleSaveTelegram = async () => {
    try {
      setLoading(true);
      await notificationsApi.saveTelegramConfig({
        bot_token: tgToken,
        chat_id: tgChatId,
        is_enabled: tgEnabled,
        auto_rules: rules,
      });
      await loadConfigs();
      showNotification("success", "Telegram channel settings successfully saved.");
    } catch (err: unknown) {
      showNotification("error", `Failed to save Telegram settings: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDetectChats = async () => {
    try {
      setTgDetecting(true);
      const res = await notificationsApi.detectTelegramChats(tgToken);
      if (res.ok && res.chats && res.chats.length > 0) {
        setTgDiscoveredChats(res.chats);
        // Automatically select the first detected chat if current chatId is blank or is the bot's own ID
        if (!tgChatId || tgChatId === "8864485951") {
          setTgChatId(res.chats[0].id);
        }
        showNotification(
          "success",
          `Found ${res.chats.length} active chat(s)! Selected ${res.chats[0].title} (${res.chats[0].id}).`
        );
      } else {
        setTgDiscoveredChats([]);
        showNotification("info", res.instructions || "No active chats found yet. Click START in @Alphaindia2026bot first.");
      }
    } catch (err: unknown) {
      showNotification("error", `Failed to detect chats: ${(err as Error).message}`);
    } finally {
      setTgDetecting(false);
    }
  };

  const handleTestTelegram = async () => {
    try {
      setTgTesting(true);
      setTgTestResult(null);
      const res = await notificationsApi.testTelegram({
        bot_token: tgToken,
        chat_id: tgChatId,
      });
      setTgTestResult(res);
      if (res.status === "ok" && res.dispatch_result?.success) {
        showNotification("success", `Ping delivered to Telegram by @${res.bot_info?.bot_username}!`);
      } else if (res.status === "ok" && res.bot_info?.valid && !res.dispatch_result) {
        showNotification("info", `Bot verified: @${res.bot_info.bot_username}. Add Chat ID to test message delivery.`);
      } else {
        showNotification("error", res.error || res.dispatch_result?.error || res.bot_info?.error || "Telegram verification failed.");
      }
    } catch (err: unknown) {
      showNotification("error", `Telegram test ping failed: ${(err as Error).message}`);
    } finally {
      setTgTesting(false);
    }
  };

  const handleSaveWhatsApp = async () => {
    try {
      setLoading(true);
      await notificationsApi.saveWhatsAppConfig({
        api_key: waApiKey,
        phone_number_id: waPhoneId,
        target_recipient: waRecipient,
        is_enabled: waEnabled,
        auto_rules: rules,
      });
      await loadConfigs();
      showNotification("success", "WhatsApp channel settings successfully saved.");
    } catch (err: unknown) {
      showNotification("error", `Failed to save WhatsApp settings: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRules = async () => {
    try {
      setLoading(true);
      await Promise.all([
        notificationsApi.saveTelegramConfig({
          bot_token: tgToken,
          chat_id: tgChatId,
          is_enabled: tgEnabled,
          auto_rules: rules,
        }),
        notificationsApi.saveWhatsAppConfig({
          api_key: waApiKey,
          phone_number_id: waPhoneId,
          target_recipient: waRecipient,
          is_enabled: waEnabled,
          auto_rules: rules,
        }),
      ]);
      showNotification("success", "Automated broadcast rules successfully updated.");
    } catch (err: unknown) {
      showNotification("error", `Failed to save rules: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyPreset = (type: "PEAD" | "CATALYST" | "GROWTH" | "VCP" | "CUSTOM") => {
    setComposerType(type);
    if (type === "VCP") {
      setComposerSymbol("DIXON");
      setComposerName("Dixon Technologies");
      setComposerTitle("🎯 VCP BREAKOUT: DIXON TECH (Score 96.2 — Elite Setup)");
      setComposerMessage(
        `🎯 *ALPHA INDIA | MINERVINI VCP BREAKOUT*\n━━━━━━━━━━━━━━━━━━━━━\n🏢 *Dixon Technologies* (\`DIXON\`)\n⭐ *Score:* 96.2/100 — ELITE SETUP (≥95)\n📐 *Pattern:* 3-Stage VCP (Supply Dry-Up: 68%)\n🎯 *Pivot Point:* ₹14,250.00 | *CMP:* ₹14,285.00\n🚪 *Entry Zone:* ₹14,220–14,460\n🛡️ *Stop Loss:* ₹13,400.00\n🚀 *Targets:* *T1:* ₹15,400.0 | *T2:* ₹16,800.0 | *T3:* ₹18,200.0\n⚖️ *Risk/Reward:* 3.8x | *Breakout Vol:* 3.4x 20DMA\n💡 *Institutional Edge:*\n   • EMS sector leader with multi-quarter margin expansion.\n   • Stage 2 Weinstein breakout with explosive volume confirmation.\n   • MF accumulation up 1.8% in latest filing.\n━━━━━━━━━━━━━━━━━━━━━\n📡 *Live Radar:* http://localhost:3000/vcp-discovery`
      );
    } else if (type === "PEAD") {
      setComposerSymbol("TRENT");
      setComposerName("Trent Ltd");
      setComposerTitle("⚡ ATHENA FLASH: TRENT LTD (Grade AAA+)");
      setComposerMessage(
        `⚡ *ALPHA INDIA | ATHENA PEAD FLASH*\n━━━━━━━━━━━━━━━━━━━━━\n🏢 *Trent Ltd* (\`TRENT\`)\n🎯 *Signal:* STRONG BUY | *Grade:* AAA+ (94/100)\n📈 *QoQ/YoY Growth:*\n   • PAT: ₹412.5 Cr (+142.5% YoY)\n   • Revenue: ₹3,450.0 Cr (+53.8% YoY)\n🎯 *Upside Potential:* +18.5%\n💡 *Institutional Thesis:*\nAggressive retail store expansion drives exceptional operating leverage with clean earnings quality.\n━━━━━━━━━━━━━━━━━━━━━\n📡 _Dispatched via Alpha India Terminal_`
      );
    } else if (type === "CATALYST") {
      setComposerSymbol("SOLARINDS");
      setComposerName("Solar Industries India");
      setComposerTitle("📡 CATALYST RADAR: SOLAR INDUSTRIES (₹2,450 Cr Order)");
      setComposerMessage(
        `📡 *ALPHA INDIA | CATALYST RADAR*\n━━━━━━━━━━━━━━━━━━━━━\n🏢 *Solar Industries* (\`SOLARINDS\`)\n⚡ *Catalyst:* DEFENSE WEAPON SUPPLY CONTRACT\n💰 *Contract Value:* ₹2,450.0 Cr\n📋 *Summary:* MoD awards specialized ammunition supply contract over 36 months.\n━━━━━━━━━━━━━━━━━━━━━\n📡 _Dispatched via Alpha India Terminal_`
      );
    } else if (type === "GROWTH") {
      setComposerSymbol("KAYNES");
      setComposerName("Kaynes Technology India");
      setComposerTitle("🚀 GROWTH BREAKOUT: KAYNES TECH (+98% YoY PAT)");
      setComposerMessage(
        `🚀 *ALPHA INDIA | GROWTH BREAKOUT*\n━━━━━━━━━━━━━━━━━━━━━\n🏢 *Kaynes Technology* (\`KAYNES\`)\n📈 *YoY PAT Growth:* +98.4%\n📊 *YoY Revenue Growth:* +64.2%\n🛡️ *Operating Margin:* 14.8% | *P/E:* 68.5x\n💡 *Breakout:* 3-year revenue CAGR crosses institutional acceleration threshold.\n━━━━━━━━━━━━━━━━━━━━━\n📡 _Dispatched via Alpha India Terminal_`
      );
    } else {
      setComposerTitle("📢 MARKET INTELLIGENCE MEMO");
      setComposerMessage(
        `📢 *ALPHA INDIA | INSTITUTIONAL MEMO*\n━━━━━━━━━━━━━━━━━━━━━\n[Write institutional trade brief or analyst takeaway here]\n━━━━━━━━━━━━━━━━━━━━━\n📡 _Dispatched via Alpha India Terminal_`
      );
    }
  };

  const handleBroadcast = async () => {
    if (selectedChannels.length === 0) {
      showNotification("error", "Please select at least one channel (Telegram or WhatsApp).");
      return;
    }

    try {
      setBroadcasting(true);
      const res = await notificationsApi.broadcast({
        channels: selectedChannels,
        symbol: composerSymbol,
        title: composerTitle,
        message: composerMessage,
      });

      const tgRes = res.results?.telegram;
      const waRes = res.results?.whatsapp;

      let msg = "Broadcast completed! ";
      if (tgRes?.success) msg += "Telegram: Sent. ";
      else if (tgRes?.error) msg += `Telegram: ${tgRes.error}. `;

      if (waRes?.mode === "click_to_chat" && typeof waRes.url === "string") {
        window.open(waRes.url, "_blank");
        msg += "WhatsApp: Opened web memo. ";
      } else if (waRes?.success) {
        msg += "WhatsApp: Sent. ";
      }

      showNotification("success", msg);
      if (activeTab === "logs") loadLogs();
    } catch (err: unknown) {
      showNotification("error", `Broadcast failed: ${(err as Error).message}`);
    } finally {
      setBroadcasting(false);
    }
  };

  const handleTriggerVCPScanAlerts = async () => {
    try {
      setLoading(true);
      const res = await notificationsApi.triggerVCPScanAlerts(true);
      showNotification("success", `Processed ${res.count} institutional VCP breakout alert(s) for today's top radar picks!`);
      if (activeTab === "logs") loadLogs();
    } catch (err: unknown) {
      showNotification("error", `Failed to trigger VCP scan alerts: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenWhatsAppWeb = () => {
    const cleanPhone = waRecipient ? waRecipient.replace(/[^0-9]/g, "") : "";
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(composerMessage)}`
      : `https://wa.me/?text=${encodeURIComponent(composerMessage)}`;
    window.open(url, "_blank");
    showNotification("info", "Opening WhatsApp Web with pre-formatted institutional memo.");
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Top Breadcrumb & Title */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800/80 pb-6">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider mb-1">
              <BellRing size={14} />
              <span>Institutional Dispatch & Communication</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              External Alert Center
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
              Multi-channel dispatch radar for Telegram bots, WhatsApp groups, and automated threshold alerts.
            </p>
          </div>

          {/* Live Channel Status Badges */}
          <div className="flex items-center gap-2.5">
            <div className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold ${
              configs.TELEGRAM?.is_enabled && configs.TELEGRAM?.bot_token
                ? "border-sky-500/40 bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300"
                : "border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400"
            }`}>
              <Send size={13} className={configs.TELEGRAM?.is_enabled ? "text-sky-500 dark:text-sky-400" : ""} />
              <span>Telegram: {configs.TELEGRAM?.is_enabled && configs.TELEGRAM?.bot_token ? "ACTIVE" : "STANDBY"}</span>
            </div>

            <div className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold ${
              configs.WHATSAPP?.is_enabled
                ? "border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400"
            }`}>
              <Share2 size={13} className={configs.WHATSAPP?.is_enabled ? "text-emerald-500 dark:text-emerald-400" : ""} />
              <span>WhatsApp: {configs.WHATSAPP?.is_enabled ? "READY (WEB/API)" : "STANDBY"}</span>
            </div>

            <button
              onClick={() => {
                loadConfigs();
                if (activeTab === "logs") loadLogs();
              }}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>

        {/* Global Notification Banner */}
        {notice && (
          <div className={`flex items-center gap-2.5 rounded-xl border p-3.5 text-xs font-medium transition ${
            notice.type === "success"
              ? "border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300"
              : notice.type === "error"
              ? "border-rose-500/40 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300"
              : "border-cyan-500/40 bg-cyan-50 dark:bg-cyan-950/40 text-cyan-800 dark:text-cyan-300"
          }`}>
            {notice.type === "success" ? (
              <CheckCircle2 size={16} className="text-emerald-500 dark:text-emerald-400 shrink-0" />
            ) : notice.type === "error" ? (
              <AlertTriangle size={16} className="text-rose-500 dark:text-rose-400 shrink-0" />
            ) : (
              <Info size={16} className="text-cyan-500 dark:text-cyan-400 shrink-0" />
            )}
            <span>{notice.msg}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 gap-1 sm:gap-2">
          <button
            onClick={() => setActiveTab("opportunities")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition ${
              activeTab === "opportunities"
                ? "border-cyan-500 text-cyan-600 dark:text-cyan-400 bg-cyan-50/50 dark:bg-cyan-500/5"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <Target size={14} />
            🎯 Opportunity Radar Alerts
          </button>

          <button
            onClick={() => setActiveTab("channels")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition ${
              activeTab === "channels"
                ? "border-cyan-500 text-cyan-600 dark:text-cyan-400 bg-cyan-50/50 dark:bg-cyan-500/5"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <Sliders size={14} />
            Channel Setup & Health
          </button>

          <button
            onClick={() => setActiveTab("rules")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition ${
              activeTab === "rules"
                ? "border-cyan-500 text-cyan-600 dark:text-cyan-400 bg-cyan-50/50 dark:bg-cyan-500/5"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <Zap size={14} />
            Automated Trigger Rules
          </button>

          <button
            onClick={() => setActiveTab("broadcast")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition ${
              activeTab === "broadcast"
                ? "border-cyan-500 text-cyan-600 dark:text-cyan-400 bg-cyan-50/50 dark:bg-cyan-500/5"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <Send size={14} />
            Broadcast Console & Composer
          </button>

        <button
          onClick={() => setActiveTab("logs")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition ${
            activeTab === "logs"
              ? "border-cyan-400 text-cyan-400 bg-cyan-500/5"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <FileText size={14} />
          Dispatch Audit Ledger
        </button>
      </div>

      {/* ========================================================= */}
      {/* TAB 0: Opportunity Radar Alerts */}
      {/* ========================================================= */}
      {activeTab === "opportunities" && (
        <div className="space-y-6">
          {/* Header Action Banner */}
          <div className="rounded-2xl border border-cyan-500/30 bg-[#071328] p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="flex h-3 w-3 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
                </span>
                <h2 className="text-lg font-black tracking-wide text-white">
                  Institutional Opportunity Radar Alerts
                </h2>
                <span className="rounded-md border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-0.5 text-[11px] font-bold text-cyan-300 font-mono">
                  LIVE 4-ENGINE MONITOR
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                Continuous radar scanning for VCP Breakouts, Pre-Breakout Tier A+ setups, and Multi-Timeframe Momentum criteria. Alerts automatically persist to the in-app notification center and broadcast to active Telegram & WhatsApp desks.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => handleScanOpportunities(true)}
                disabled={oppScanning}
                className="flex items-center gap-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 px-4 py-2.5 text-xs font-bold text-black transition shadow-md cursor-pointer disabled:opacity-50"
              >
                <RefreshCw size={14} className={oppScanning ? "animate-spin" : ""} />
                {oppScanning ? "Scanning 4 Radar Engines..." : "Run Opportunity Scan Now"}
              </button>
              <button
                onClick={handleSaveOpportunityRules}
                disabled={loading}
                className="flex items-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 px-4 py-2.5 text-xs font-semibold text-cyan-300 transition cursor-pointer"
              >
                <Check size={14} />
                Save Thresholds
              </button>
            </div>
          </div>

          {/* 4 Dedicated Opportunity Rule Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Rule 1: Minervini VCP Breakout Signals */}
            <div className={`rounded-2xl border p-5 shadow-lg transition space-y-4 ${
              oppRules.vcp_signals_enabled
                ? "border-cyan-500/40 bg-[#08152e]"
                : "border-slate-800 bg-[#060c18] opacity-70"
            }`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
                    <Target size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      1. Minervini VCP Signals
                      <span className="text-[10px] text-cyan-400 font-mono font-normal">/vcp-signals</span>
                    </h3>
                    <p className="text-[11px] text-slate-400">Mark Minervini Volatility Contraction Breakout picks</p>
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <span className="text-[11px] font-semibold text-slate-300">
                    {oppRules.vcp_signals_enabled ? "Enabled" : "Disabled"}
                  </span>
                  <input
                    type="checkbox"
                    checked={oppRules.vcp_signals_enabled}
                    onChange={(e) => setOppRules({ ...oppRules, vcp_signals_enabled: e.target.checked })}
                    className="rounded border-slate-700 bg-slate-900 text-cyan-500 h-4 w-4 cursor-pointer"
                  />
                </label>
              </div>

              <div className="text-xs text-slate-300 space-y-2">
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Dispatches high-conviction trade alerts when an institutional stock breaks out of a contracted VCP base with volume surge and risk-managed stop loss.
                </p>
                <div>
                  <div className="flex justify-between text-[11px] font-mono text-slate-300 mb-1">
                    <span>Minimum VCP AI Score:</span>
                    <span className="text-cyan-400 font-bold">{oppRules.vcp_min_score} / 100</span>
                  </div>
                  <input
                    type="range"
                    min="85"
                    max="98"
                    step="1"
                    value={oppRules.vcp_min_score}
                    onChange={(e) => setOppRules({ ...oppRules, vcp_min_score: Number(e.target.value) })}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <span className="text-[11px] text-slate-500 font-mono">Deduplicated daily per symbol</span>
                <a
                  href="/vcp-signals"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 font-semibold"
                >
                  <span>Open /vcp-signals</span>
                  <ArrowUpRight size={13} />
                </a>
              </div>
            </div>

            {/* Rule 2: Pre-Breakout Radar (Conviction Tier A+) */}
            <div className={`rounded-2xl border p-5 shadow-lg transition space-y-4 ${
              oppRules.prebreakout_a_plus_enabled
                ? "border-emerald-500/40 bg-[#071c1f]"
                : "border-slate-800 bg-[#060c18] opacity-70"
            }`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                    <Zap size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      2. Pre-Breakout Radar (Tier A+)
                      <span className="text-[10px] text-emerald-400 font-mono font-normal">/pre-breakout-radar</span>
                    </h3>
                    <p className="text-[11px] text-slate-400">Coil base setups with A+ Conviction Tier (≥80 pts)</p>
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <span className="text-[11px] font-semibold text-slate-300">
                    {oppRules.prebreakout_a_plus_enabled ? "Enabled" : "Disabled"}
                  </span>
                  <input
                    type="checkbox"
                    checked={oppRules.prebreakout_a_plus_enabled}
                    onChange={(e) => setOppRules({ ...oppRules, prebreakout_a_plus_enabled: e.target.checked })}
                    className="rounded border-slate-700 bg-slate-900 text-emerald-500 h-4 w-4 cursor-pointer"
                  />
                </label>
              </div>

              <div className="text-xs text-slate-300 space-y-2">
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Detects tight contraction coils, NR7 candles, and severe Volume Dry-Up (VDU &lt; 0.65x) <strong className="text-emerald-300">before</strong> the breakout occurs.
                </p>
                <div>
                  <div className="flex justify-between text-[11px] font-mono text-slate-300 mb-1">
                    <span>Minimum Conviction Score:</span>
                    <span className="text-emerald-400 font-bold">{oppRules.prebreakout_min_conviction} PTS (Tier A+)</span>
                  </div>
                  <input
                    type="range"
                    min="70"
                    max="95"
                    step="1"
                    value={oppRules.prebreakout_min_conviction}
                    onChange={(e) => setOppRules({ ...oppRules, prebreakout_min_conviction: Number(e.target.value) })}
                    className="w-full accent-emerald-400 cursor-pointer"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <span className="text-[11px] text-slate-500 font-mono">Alerts on A+ SUPER COIL</span>
                <a
                  href="/pre-breakout-radar"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 font-semibold"
                >
                  <span>Open /pre-breakout-radar</span>
                  <ArrowUpRight size={13} />
                </a>
              </div>
            </div>

            {/* Rule 3: Momentum Radar (Match Score >= 9) */}
            <div className={`rounded-2xl border p-5 shadow-lg transition space-y-4 ${
              oppRules.momentum_match_9_enabled
                ? "border-purple-500/40 bg-[#160d2e]"
                : "border-slate-800 bg-[#060c18] opacity-70"
            }`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-purple-500/30 bg-purple-500/10 text-purple-400">
                    <TrendingUp size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      3. Momentum Radar (Match Score ≥ 9)
                      <span className="text-[10px] text-purple-400 font-mono font-normal">/momentum-radar</span>
                    </h3>
                    <p className="text-[11px] text-slate-400">Multi-timeframe Bollinger Band & RSI confluence</p>
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <span className="text-[11px] font-semibold text-slate-300">
                    {oppRules.momentum_match_9_enabled ? "Enabled" : "Disabled"}
                  </span>
                  <input
                    type="checkbox"
                    checked={oppRules.momentum_match_9_enabled}
                    onChange={(e) => setOppRules({ ...oppRules, momentum_match_9_enabled: e.target.checked })}
                    className="rounded border-slate-700 bg-slate-900 text-purple-500 h-4 w-4 cursor-pointer"
                  />
                </label>
              </div>

              <div className="text-xs text-slate-300 space-y-2">
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Triggers alerts when a stock satisfies at least 9 of 10 conditions across Daily/Weekly BB breakouts, Triple RSI &gt; 60, and 20DMA volume surges.
                </p>
                <div>
                  <div className="flex justify-between text-[11px] font-mono text-slate-300 mb-1">
                    <span>Minimum Criteria Matched:</span>
                    <span className="text-purple-400 font-bold">{oppRules.momentum_min_matches} / 10 Conditions</span>
                  </div>
                  <input
                    type="range"
                    min="8"
                    max="10"
                    step="1"
                    value={oppRules.momentum_min_matches}
                    onChange={(e) => setOppRules({ ...oppRules, momentum_min_matches: Number(e.target.value) })}
                    className="w-full accent-purple-400 cursor-pointer"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <span className="text-[11px] text-slate-500 font-mono">Core 9/9 and Perfect 10/10</span>
                <a
                  href="/momentum-radar"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 font-semibold"
                >
                  <span>Open /momentum-radar</span>
                  <ArrowUpRight size={13} />
                </a>
              </div>
            </div>

            {/* Rule 4: Momentum Radar (Conviction Score >= 79) */}
            <div className={`rounded-2xl border p-5 shadow-lg transition space-y-4 ${
              oppRules.momentum_conviction_79_enabled
                ? "border-amber-500/40 bg-[#1e1507]"
                : "border-slate-800 bg-[#060c18] opacity-70"
            }`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
                    <Flame size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      4. Momentum Radar (Conviction 79+)
                      <span className="text-[10px] text-amber-400 font-mono font-normal">/momentum-radar</span>
                    </h3>
                    <p className="text-[11px] text-slate-400">Composite multi-timeframe conviction score (0–100)</p>
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <span className="text-[11px] font-semibold text-slate-300">
                    {oppRules.momentum_conviction_79_enabled ? "Enabled" : "Disabled"}
                  </span>
                  <input
                    type="checkbox"
                    checked={oppRules.momentum_conviction_79_enabled}
                    onChange={(e) => setOppRules({ ...oppRules, momentum_conviction_79_enabled: e.target.checked })}
                    className="rounded border-slate-700 bg-slate-900 text-amber-500 h-4 w-4 cursor-pointer"
                  />
                </label>
              </div>

              <div className="text-xs text-slate-300 space-y-2">
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Evaluates momentum velocity weighted by volume expansion ratio, WMA golden alignment, and RSI strength across daily, weekly, and monthly timeframes.
                </p>
                <div>
                  <div className="flex justify-between text-[11px] font-mono text-slate-300 mb-1">
                    <span>Minimum Conviction Score:</span>
                    <span className="text-amber-400 font-bold">{oppRules.momentum_min_conviction} PTS (79+)</span>
                  </div>
                  <input
                    type="range"
                    min="70"
                    max="92"
                    step="1"
                    value={oppRules.momentum_min_conviction}
                    onChange={(e) => setOppRules({ ...oppRules, momentum_min_conviction: Number(e.target.value) })}
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <span className="text-[11px] text-slate-500 font-mono">Weighted Velocity Score</span>
                <a
                  href="/momentum-radar"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 font-semibold"
                >
                  <span>Open /momentum-radar</span>
                  <ArrowUpRight size={13} />
                </a>
              </div>
            </div>
          </div>

          {/* External Broadcast Auto-Dispatch Toggles */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#081225] p-5 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                External Broadcast Dispatch Channels
              </h4>
              <p className="text-[11px] text-slate-400">
                When new opportunities pass the 4 thresholds above, automatically dispatch formatted memos to active channels:
              </p>
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-300 font-medium">
                <input
                  type="checkbox"
                  checked={oppRules.auto_broadcast_telegram}
                  onChange={(e) => setOppRules({ ...oppRules, auto_broadcast_telegram: e.target.checked })}
                  className="rounded border-slate-700 bg-slate-900 text-sky-500 h-4 w-4"
                />
                <span>Telegram Bot API</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-300 font-medium">
                <input
                  type="checkbox"
                  checked={oppRules.auto_broadcast_whatsapp}
                  onChange={(e) => setOppRules({ ...oppRules, auto_broadcast_whatsapp: e.target.checked })}
                  className="rounded border-slate-700 bg-slate-900 text-emerald-500 h-4 w-4"
                />
                <span>WhatsApp Desk</span>
              </label>
            </div>
          </div>

          {/* Recent Dispatched Opportunity Alerts Feed */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#081225] p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <BellRing size={16} className="text-cyan-400" />
                <h3 className="text-sm font-bold text-white">Recent Opportunity Alerts Feed</h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {recentOpportunities.length} opportunities logged
              </span>
            </div>

            {recentOpportunities.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-500">
                No opportunity alerts generated yet today. Click &quot;Run Opportunity Scan Now&quot; above to evaluate all 4 engines.
              </div>
            ) : (
              <div className="space-y-2.5">
                {recentOpportunities.map((notif) => {
                  const isCritical = notif.severity === "critical";
                  return (
                    <div
                      key={notif.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-800/80 bg-slate-900/60 hover:border-cyan-500/40 transition"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-xs ${
                          notif.category === "VCP_BREAKOUT"
                            ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-400"
                            : notif.category === "PRE_BREAKOUT"
                            ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                            : "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                        }`}>
                          {notif.category === "VCP_BREAKOUT" ? (
                            <Target size={14} />
                          ) : notif.category === "PRE_BREAKOUT" ? (
                            <Zap size={14} />
                          ) : (
                            <TrendingUp size={14} />
                          )}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase font-mono ${
                              notif.category === "VCP_BREAKOUT"
                                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                                : notif.category === "PRE_BREAKOUT"
                                ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            }`}>
                              {notif.category === "VCP_BREAKOUT" ? "VCP SIGNALS" : notif.category === "PRE_BREAKOUT" ? "PRE-BREAKOUT A+" : "MOMENTUM RADAR"}
                            </span>
                            <h4 className="text-xs font-bold text-white truncate">{notif.title}</h4>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                            {notif.message}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 shrink-0">
                        {notif.action_url && (
                          <a
                            href={notif.action_url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-300 hover:bg-cyan-500/20 transition"
                          >
                            <span>Open Radar</span>
                            <ArrowUpRight size={12} />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 1: Channel Setup & Health */}
      {/* ========================================================= */}
      {activeTab === "channels" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Telegram Card */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#081225] p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-500/30 bg-sky-500/10 text-sky-400">
                  <Send size={20} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Telegram Broadcast Bot</h2>
                  <p className="text-xs text-slate-400">Direct HTTP Bot API dispatch to channels/groups</p>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <span className="text-xs font-semibold text-slate-300">
                  {tgEnabled ? "Active" : "Disabled"}
                </span>
                <input
                  type="checkbox"
                  checked={tgEnabled}
                  onChange={(e) => setTgEnabled(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-0 h-4 w-4"
                />
              </label>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Telegram Bot Token (from @BotFather)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 7123456789:AAHq..."
                  value={tgToken}
                  onChange={(e) => setTgToken(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-hidden font-mono"
                />
                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                  <span>
                    Bot:{" "}
                    <a
                      href="https://t.me/Alphaindia2026bot"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-400 hover:underline font-semibold inline-flex items-center gap-0.5"
                    >
                      @Alphaindia2026bot <ArrowUpRight size={11} />
                    </a>
                  </span>
                  <span className="text-emerald-400 font-medium">✓ HTTP Bot API Verified</span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-300">
                    Target Channel ID / Chat ID / Group ID
                  </label>
                  <button
                    type="button"
                    onClick={handleDetectChats}
                    disabled={tgDetecting}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-400 hover:text-sky-300 bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 rounded-lg px-2 py-0.5 transition cursor-pointer"
                  >
                    <Radio size={11} className={tgDetecting ? "animate-spin" : ""} />
                    {tgDetecting ? "Detecting..." : "Auto-Detect Chat ID"}
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="e.g. @alphaindia_radar or -100123456789 or your personal user ID"
                  value={tgChatId}
                  onChange={(e) => setTgChatId(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-hidden font-mono"
                />
                
                {/* Warning if user enters the bot's own ID */}
                {(tgChatId === "8864485951" || tgChatId.includes("8864485951")) && (
                  <div className="flex items-start gap-1.5 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300 mt-2">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5 text-amber-400" />
                    <span>
                      <strong>Important:</strong> <code>8864485951</code> is the <strong>Bot&apos;s own User ID</strong>. A Telegram bot cannot message itself! To receive alerts: click <a href="https://t.me/Alphaindia2026bot" target="_blank" rel="noopener noreferrer" className="underline text-sky-300 font-semibold">@Alphaindia2026bot</a> and press <strong>Start</strong>, then click <strong>Auto-Detect Chat ID</strong> above.
                    </span>
                  </div>
                )}

                {/* Discovered Chats List */}
                {tgDiscoveredChats.length > 0 && (
                  <div className="mt-2 space-y-1.5 p-2.5 rounded-xl border border-sky-500/30 bg-sky-950/20 text-xs">
                    <p className="text-[11px] font-semibold text-sky-300">
                      Discovered Telegram Conversations ({tgDiscoveredChats.length}):
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {tgDiscoveredChats.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setTgChatId(c.id);
                            showNotification("info", `Target set to ${c.title} (${c.id})`);
                          }}
                          className={`px-2 py-1 rounded-md text-[11px] font-mono border transition ${
                            tgChatId === c.id
                              ? "bg-sky-500 text-black border-sky-400 font-bold"
                              : "bg-slate-900/80 text-sky-300 border-slate-700 hover:border-sky-500"
                          }`}
                        >
                          {c.title} ({c.id})
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quick Instruction Guide */}
                <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-3 text-[11px] text-slate-400 space-y-1.5 mt-2">
                  <p className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <Info size={12} className="text-cyan-400" />
                    How to configure your Telegram alerts:
                  </p>
                  <ul className="list-disc pl-4 space-y-1 text-slate-400">
                    <li>
                      <strong>Direct to your Telegram:</strong> Open{" "}
                      <a href="https://t.me/Alphaindia2026bot" target="_blank" rel="noopener noreferrer" className="text-sky-400 underline font-semibold">
                        @Alphaindia2026bot
                      </a>{" "}
                      and click <strong>Start</strong>. Then click <strong>Auto-Detect Chat ID</strong> above.
                    </li>
                    <li>
                      <strong>Channel broadcast:</strong> Add <span className="text-sky-300 font-mono">@Alphaindia2026bot</span> as an <strong>Administrator</strong> (with &quot;Post Messages&quot; enabled) to your Telegram channel, and enter your channel username (e.g. <span className="font-mono text-slate-300">@YourChannel</span>) or Channel ID.
                    </li>
                  </ul>
                </div>
              </div>

              {/* Test Result Box */}
              {tgTestResult && (
                <div className={`rounded-xl border p-3 text-xs space-y-1 ${
                  tgTestResult.status === "ok" && tgTestResult.dispatch_result?.success
                    ? "border-emerald-500/40 bg-emerald-950/20 text-emerald-300"
                    : tgTestResult.status === "ok" && !tgTestResult.dispatch_result
                    ? "border-sky-500/40 bg-sky-950/20 text-sky-300"
                    : "border-rose-500/40 bg-rose-950/20 text-rose-300"
                }`}>
                  <div className="font-bold flex items-center gap-1.5">
                    {tgTestResult.status === "ok" && tgTestResult.dispatch_result?.success ? (
                      <CheckCircle2 size={13} />
                    ) : (
                      <AlertTriangle size={13} />
                    )}
                    <span>
                      {tgTestResult.status === "ok" && tgTestResult.dispatch_result?.success
                        ? "Connection & Test Dispatch Verified"
                        : tgTestResult.status === "ok" && !tgTestResult.dispatch_result
                        ? "Bot Verified (Ready for Chat ID)"
                        : "Verification Failed"}
                    </span>
                  </div>
                  {tgTestResult.bot_info?.bot_username && (
                    <p>Bot Handle: @{tgTestResult.bot_info.bot_username} ({tgTestResult.bot_info.bot_name})</p>
                  )}
                  {tgTestResult.dispatch_result?.message_id && (
                    <p>Test Message Dispatched: ID #{tgTestResult.dispatch_result.message_id}</p>
                  )}
                  {tgTestResult.error && <p className="text-rose-300 mt-1">{tgTestResult.error}</p>}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={handleSaveTelegram}
                  disabled={loading}
                  className="flex-1 rounded-xl bg-sky-500 hover:bg-sky-400 px-4 py-2.5 text-xs font-bold text-black transition shadow-sm cursor-pointer"
                >
                  Save Telegram Settings
                </button>
                <button
                  onClick={handleTestTelegram}
                  disabled={tgTesting || !tgToken}
                  className="flex items-center gap-1.5 rounded-xl border border-sky-500/40 bg-sky-500/10 px-4 py-2.5 text-xs font-semibold text-sky-300 hover:bg-sky-500/20 transition disabled:opacity-50 cursor-pointer"
                >
                  <Send size={13} className={tgTesting ? "animate-spin" : ""} />
                  {tgTesting ? "Pinging..." : "Test Ping"}
                </button>
              </div>
            </div>
          </div>

          {/* WhatsApp Card */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#081225] p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                  <Share2 size={20} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">WhatsApp Alert Hub</h2>
                  <p className="text-xs text-slate-400">Zero-setup Web links & Cloud API webhook</p>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <span className="text-xs font-semibold text-slate-300">
                  {waEnabled ? "Active" : "Disabled"}
                </span>
                <input
                  type="checkbox"
                  checked={waEnabled}
                  onChange={(e) => setWaEnabled(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-0 h-4 w-4"
                />
              </label>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-3.5 text-xs text-emerald-300 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <Check size={14} />
                  Mode A: Instant 1-Click WhatsApp Share (Zero Setup)
                </p>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  Institutional trade briefs and memos automatically generate click-to-chat links (<span className="font-mono text-emerald-400">wa.me</span>) formatted with emojis and bolding. Works immediately with any phone number or internal WhatsApp desk.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Default Target Phone Number (optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. +919876543210"
                  value={waRecipient}
                  onChange={(e) => setWaRecipient(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-hidden font-mono"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Pre-fills this number for 1-click broadcasts. Leave empty to open WhatsApp contact selector.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Mode B: Meta Cloud API Token (optional for automated server dispatch)
                </label>
                <input
                  type="password"
                  placeholder="e.g. EAAB..."
                  value={waApiKey}
                  onChange={(e) => setWaApiKey(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-hidden font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Phone Number ID (Meta Cloud API)
                </label>
                <input
                  type="text"
                  placeholder="e.g. 104567890123456"
                  value={waPhoneId}
                  onChange={(e) => setWaPhoneId(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-hidden font-mono"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={handleSaveWhatsApp}
                  disabled={loading}
                  className="flex-1 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-4 py-2.5 text-xs font-bold text-black transition shadow-sm"
                >
                  Save WhatsApp Settings
                </button>
                <button
                  onClick={handleOpenWhatsAppWeb}
                  className="flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition"
                >
                  <Share2 size={13} />
                  Test 1-Click Share
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2: Automated Trigger Rules */}
      {/* ========================================================= */}
      {activeTab === "rules" && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#081225] p-6 shadow-xl space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <h2 className="text-base font-bold text-white">Automated Broadcasting Rule Triggers</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Specify high-conviction thresholds that automatically dispatch alerts to enabled external channels.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Rule 1: Athena PEAD Flash */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap size={16} className="text-cyan-400" />
                  <span className="text-xs font-bold text-white">Athena PEAD Flash Alerts</span>
                </div>
                <input
                  type="checkbox"
                  checked={rules.pead_enabled}
                  onChange={(e) => setRules({ ...rules, pead_enabled: e.target.checked })}
                  className="rounded border-slate-700 bg-slate-900 text-cyan-500 h-4 w-4"
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Dispatches immediately upon quarterly filing parsing if conviction score meets requirement.
              </p>
              <div>
                <label className="text-[11px] font-medium text-slate-300">
                  Minimum Conviction Score: <span className="text-cyan-400 font-bold">{rules.pead_min_conviction} / 100</span>
                </label>
                <input
                  type="range"
                  min="60"
                  max="95"
                  step="5"
                  value={rules.pead_min_conviction}
                  onChange={(e) => setRules({ ...rules, pead_min_conviction: Number(e.target.value) })}
                  className="w-full accent-cyan-400 mt-1"
                />
              </div>
            </div>

            {/* Rule 2: Corporate Catalyst Radar */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Radio size={16} className="text-amber-400" />
                  <span className="text-xs font-bold text-white">Corporate Catalyst Radar</span>
                </div>
                <input
                  type="checkbox"
                  checked={rules.catalyst_enabled}
                  onChange={(e) => setRules({ ...rules, catalyst_enabled: e.target.checked })}
                  className="rounded border-slate-700 bg-slate-900 text-amber-500 h-4 w-4"
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Broadcasts high-impact contract wins, acquisitions, and defense orders.
              </p>
              <div>
                <label className="text-[11px] font-medium text-slate-300">
                  Minimum Order Value: <span className="text-amber-400 font-bold">₹{rules.catalyst_min_cr} Cr</span>
                </label>
                <input
                  type="range"
                  min="200"
                  max="5000"
                  step="200"
                  value={rules.catalyst_min_cr}
                  onChange={(e) => setRules({ ...rules, catalyst_min_cr: Number(e.target.value) })}
                  className="w-full accent-amber-400 mt-1"
                />
              </div>
            </div>

            {/* Rule 3: Growth Screener Breakouts */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp size={16} className="text-emerald-400" />
                  <span className="text-xs font-bold text-white">Growth Screener Breakout</span>
                </div>
                <input
                  type="checkbox"
                  checked={rules.growth_enabled}
                  onChange={(e) => setRules({ ...rules, growth_enabled: e.target.checked })}
                  className="rounded border-slate-700 bg-slate-900 text-emerald-500 h-4 w-4"
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Triggers when a company crosses fundamental acceleration thresholds.
              </p>
              <div>
                <label className="text-[11px] font-medium text-slate-300">
                  Minimum YoY PAT Growth: <span className="text-emerald-400 font-bold">+{rules.growth_min_pat_pct}%</span>
                </label>
                <input
                  type="range"
                  min="25"
                  max="100"
                  step="5"
                  value={rules.growth_min_pat_pct}
                  onChange={(e) => setRules({ ...rules, growth_min_pat_pct: Number(e.target.value) })}
                  className="w-full accent-emerald-400 mt-1"
                />
              </div>
            </div>

            {/* Rule 4: Institutional Smart Money */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} className="text-violet-400" />
                  <span className="text-xs font-bold text-white">Institutional Block & AMC Accumulation</span>
                </div>
                <input
                  type="checkbox"
                  checked={rules.smart_money_enabled}
                  onChange={(e) => setRules({ ...rules, smart_money_enabled: e.target.checked })}
                  className="rounded border-slate-700 bg-slate-900 text-violet-500 h-4 w-4"
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Alerts when 3 or more mutual fund houses open fresh positions in the same monthly filing.
              </p>
              <div className="pt-2">
                <span className="rounded-md border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-[11px] text-violet-300 font-medium">
                  Trigger: Fresh AMC Entry in ≥ 3 Schemes
                </span>
              </div>
            </div>

            {/* Rule 5: Mark Minervini VCP Breakouts */}
            <div className="rounded-xl border border-cyan-500/30 bg-slate-900/80 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target size={16} className="text-cyan-400" />
                  <span className="text-xs font-bold text-white">Mark Minervini VCP Breakout Radar</span>
                </div>
                <input
                  type="checkbox"
                  checked={rules.vcp_enabled}
                  onChange={(e) => setRules({ ...rules, vcp_enabled: e.target.checked })}
                  className="rounded border-slate-700 bg-slate-900 text-cyan-500 h-4 w-4"
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Dispatches high-conviction breakout opportunities (score ≥ 90, pivot confirmation, supply dry-up).
              </p>
              <div>
                <div className="flex justify-between text-[11px] font-medium text-slate-300">
                  <span>Minimum VCP Score:</span>
                  <span className="text-cyan-400 font-bold">{rules.vcp_min_score} / 100</span>
                </div>
                <input
                  type="range"
                  min="85"
                  max="98"
                  step="1"
                  value={rules.vcp_min_score}
                  onChange={(e) => setRules({ ...rules, vcp_min_score: Number(e.target.value) })}
                  className="w-full accent-cyan-400 mt-1"
                />
              </div>
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] text-slate-300">
                  <input
                    type="checkbox"
                    checked={rules.vcp_elite_only}
                    onChange={(e) => setRules({ ...rules, vcp_elite_only: e.target.checked })}
                    className="rounded border-slate-700 bg-slate-900 text-cyan-500 h-3.5 w-3.5"
                  />
                  <span>Elite Setups Only (≥ 95.0)</span>
                </label>
                <a
                  href="/vcp-discovery"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-[11px] text-cyan-400 hover:underline"
                >
                  <span>Radar: /vcp-discovery</span>
                  <ArrowUpRight size={11} />
                </a>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-800">
            <button
              onClick={handleSaveRules}
              disabled={loading}
              className="rounded-xl bg-cyan-500 hover:bg-cyan-400 px-6 py-2.5 text-xs font-bold text-black transition shadow-md"
            >
              Save Rule Configuration
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 3: Broadcast Console & Composer */}
      {/* ========================================================= */}
      {activeTab === "broadcast" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Composer Inputs */}
          <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#081225] p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white">Broadcast Trade Memo</h2>
              <span className="text-xs text-slate-400">Institutional Dispatcher</span>
            </div>

            {/* Template Presets */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Load Standard Institutional Preset
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleApplyPreset("VCP")}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                    composerType === "VCP"
                      ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-300 shadow-xs"
                      : "border-slate-700 bg-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  🎯 Minervini VCP Breakout
                </button>
                <button
                  onClick={() => handleApplyPreset("PEAD")}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                    composerType === "PEAD"
                      ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-300"
                      : "border-slate-700 bg-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  ⚡ Athena PEAD Flash
                </button>
                <button
                  onClick={() => handleApplyPreset("CATALYST")}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                    composerType === "CATALYST"
                      ? "border-amber-500/50 bg-amber-500/15 text-amber-300"
                      : "border-slate-700 bg-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  📡 Catalyst Order Win
                </button>
                <button
                  onClick={() => handleApplyPreset("GROWTH")}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                    composerType === "GROWTH"
                      ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
                      : "border-slate-700 bg-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  🚀 Growth Breakout
                </button>
                <button
                  onClick={() => handleApplyPreset("CUSTOM")}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                    composerType === "CUSTOM"
                      ? "border-violet-500/50 bg-violet-500/15 text-violet-300"
                      : "border-slate-700 bg-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  📝 Custom Market Memo
                </button>
              </div>

              <div className="mt-3 flex items-center justify-between rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-2.5 px-3.5">
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <Target size={14} className="text-cyan-400" />
                  <span>On-Demand: Broadcast today&apos;s active VCP breakout opportunities to Telegram &amp; WhatsApp</span>
                </div>
                <button
                  onClick={handleTriggerVCPScanAlerts}
                  disabled={loading}
                  className="flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/20 px-3 py-1 text-xs font-bold text-cyan-300 hover:bg-cyan-500/30 transition disabled:opacity-50"
                >
                  <Sparkles size={12} />
                  Dispatch Radar Alerts
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Ticker Symbol
                </label>
                <input
                  type="text"
                  value={composerSymbol}
                  onChange={(e) => setComposerSymbol(e.target.value.toUpperCase())}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2 text-xs text-white uppercase font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Company Name
                </label>
                <input
                  type="text"
                  value={composerName}
                  onChange={(e) => setComposerName(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2 text-xs text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Headline / Alert Subject
              </label>
              <input
                type="text"
                value={composerTitle}
                onChange={(e) => setComposerTitle(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Memo Content (Markdown formatted for Telegram & WhatsApp)
              </label>
              <textarea
                rows={9}
                value={composerMessage}
                onChange={(e) => setComposerMessage(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-900/90 p-3 text-xs text-white font-mono focus:border-cyan-500 focus:outline-hidden leading-relaxed"
              />
            </div>

            {/* Target Channel Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Dispatch Targets
              </label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={selectedChannels.includes("TELEGRAM")}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedChannels([...selectedChannels, "TELEGRAM"]);
                      else setSelectedChannels(selectedChannels.filter((c) => c !== "TELEGRAM"));
                    }}
                    className="rounded border-slate-700 bg-slate-900 text-sky-500 h-4 w-4"
                  />
                  <span>Telegram Channel</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={selectedChannels.includes("WHATSAPP")}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedChannels([...selectedChannels, "WHATSAPP"]);
                      else setSelectedChannels(selectedChannels.filter((c) => c !== "WHATSAPP"));
                    }}
                    className="rounded border-slate-700 bg-slate-900 text-emerald-500 h-4 w-4"
                  />
                  <span>WhatsApp (Cloud API / 1-Click Link)</span>
                </label>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-3">
              <button
                onClick={handleBroadcast}
                disabled={broadcasting}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 px-5 py-2.5 text-xs font-bold text-black transition shadow-md disabled:opacity-50"
              >
                <Send size={14} className={broadcasting ? "animate-spin" : ""} />
                {broadcasting ? "Broadcasting..." : "Dispatch Institutional Memo"}
              </button>

              <button
                onClick={handleOpenWhatsAppWeb}
                className="flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition"
              >
                <Share2 size={13} />
                WhatsApp Web Link
              </button>
            </div>
          </div>

          {/* Live Telegram / WhatsApp Preview */}
          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#081225] p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <Send size={14} className="text-sky-400" />
                  <span className="text-xs font-bold text-white">Telegram Preview</span>
                </div>
                <span className="text-[10px] text-slate-500">Markdown Format</span>
              </div>

              <div className="rounded-xl border border-sky-500/20 bg-[#0a162d] p-4 text-xs text-slate-200 font-sans whitespace-pre-wrap leading-relaxed shadow-inner">
                {composerMessage}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#081225] p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <Share2 size={14} className="text-emerald-400" />
                  <span className="text-xs font-bold text-white">WhatsApp 1-Click Link</span>
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(composerMessage);
                    showNotification("info", "Memo copied to clipboard!");
                  }}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white"
                >
                  <Copy size={11} />
                  Copy text
                </button>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                Clicking WhatsApp Web will open your browser with the message pre-filled and styled for instant distribution to clients, internal desks, or trader groups.
              </p>

              <button
                onClick={handleOpenWhatsAppWeb}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition"
              >
                <span>Launch WhatsApp Web with Memo</span>
                <ArrowUpRight size={13} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 4: Dispatch Audit Ledger */}
      {/* ========================================================= */}
      {activeTab === "logs" && (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#081225] p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-bold text-white">Dispatch Audit Ledger</h2>
              <p className="text-xs text-slate-400">
                Immutable audit trail of all alerts sent to external channels
              </p>
            </div>
            <button
              onClick={loadLogs}
              disabled={logsLoading}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:text-white"
            >
              <RefreshCw size={12} className={logsLoading ? "animate-spin" : ""} />
              Refresh Log
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">Time</th>
                  <th className="py-2.5 px-3">Channel</th>
                  <th className="py-2.5 px-3">Ticker</th>
                  <th className="py-2.5 px-3">Recipient</th>
                  <th className="py-2.5 px-3">Payload Snippet</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {logsLoading && logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      <RefreshCw size={18} className="animate-spin text-cyan-400 mx-auto mb-2" />
                      Loading dispatch ledger...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500">
                      No external broadcasts recorded yet. Use the composer or test ping to create an entry.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/40 transition">
                      <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">
                        {new Date(log.dispatched_at).toLocaleTimeString("en-IN", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${
                          log.channel === "TELEGRAM"
                            ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                            : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        }`}>
                          {log.channel === "TELEGRAM" ? <Send size={10} /> : <Share2 size={10} />}
                          {log.channel}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-bold text-white font-mono">
                        {log.symbol || "—"}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">
                        {log.recipient || "Default Desk"}
                      </td>
                      <td className="py-2.5 px-3 max-w-md truncate text-slate-300">
                        {log.payload_preview}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                          log.status === "SUCCESS"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : log.status === "FAILED"
                            ? "bg-rose-500/20 text-rose-400"
                            : "bg-slate-700 text-slate-300"
                        }`}>
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </div>
    </DashboardLayout>
  );
}

"use client";

import React, { useState, useEffect, useMemo } from "react";
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
  Trophy,
  Crosshair,
  BarChart3,
  Layers,
  Filter,
  Boxes,
  Clock,
  Rocket,
  Globe,
  Link2,
} from "lucide-react";
import {
  notificationsApi,
  ChannelConfig,
  AlertDispatchLogItem,
  OpportunityThresholds,
  OpportunityScanResult,
  SystemNotificationItem,
} from "@/lib/notificationsApi";
import {
  fetchSovereignCockpit,
  dispatchSovereignAlert,
  SovereignCandidate,
} from "@/lib/sovereignApi";

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

type ClusterFilter = "ALL" | "BREAKOUT" | "MOMENTUM" | "INSTITUTIONAL" | "FUNDAMENTAL";

export default function AlertCenterPage() {
  const [activeTab, setActiveTab] = useState<"opportunities" | "channels" | "rules" | "broadcast" | "logs">("opportunities");
  const [clusterFilter, setClusterFilter] = useState<ClusterFilter>("ALL");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error" | "info"; msg: string } | null>(null);

  // Master Unified Radar Alert Threshold Rules (13 Institutional Engines)
  const [oppRules, setOppRules] = useState<OpportunityThresholds>({
    // 1. Minervini VCP Breakouts
    vcp_signals_enabled: true,
    vcp_min_score: 90,
    vcp_elite_only: false,
    // 2. Pre-Breakout Radar (Tier A+)
    prebreakout_a_plus_enabled: true,
    prebreakout_min_conviction: 80,
    // 3. Super Momentum Radar (Match 9)
    momentum_match_9_enabled: true,
    momentum_min_matches: 9,
    // 4. Super Momentum Radar (Conviction 79)
    momentum_conviction_79_enabled: true,
    momentum_min_conviction: 79,
    momentum_universe_enabled: true,
    momentum_min_mcap_cr: 1000,
    // 5. Tomorrow 5%+ Move Radar
    tomorrow_radar_enabled: true,
    tomorrow_min_conviction: 90,
    // 6. Order Win Radar
    order_win_enabled: true,
    order_win_min_significance: 65,
    order_win_min_deal_cr: 25,
    // 7. Corporate Catalysts
    catalysts_enabled: true,
    catalysts_min_impact: 8.5,
    // 8. Athena PEAD Flash
    athena_pead_enabled: true,
    athena_min_shock_score: 75,
    // 9. Techno-Funda Radar
    techno_funda_enabled: true,
    techno_funda_min_score: 85,
    techno_funda_max_pivot_dist: 4.0,
    // 10. Delivery Breakout Radar
    delivery_breakout_enabled: true,
    delivery_tier: "ACTIVE_SWING",
    delivery_min_spike: 1.6,
    delivery_min_pct: 55,
    delivery_min_flow_20d: 1.15,
    // 11. Institutional / Mutual Fund Smart Money
    institutional_mf_enabled: true,
    institutional_min_schemes: 3,
    institutional_min_smart_money_score: 80,
    // 12. Growth Screener PRO Breakout
    growth_screener_enabled: true,
    growth_min_pat_pct: 50,
    growth_min_sales_pct: 25,
    // 13. Live Breakout Execution Cockpit
    breakout_execution_enabled: true,
    // 14. Mainboard IPO Radar Setups
    ipo_radar_enabled: true,
    ipo_min_conviction: 85,
    ipo_blue_sky_only: false,
    // Multi-Channel External Broadcast
    auto_broadcast_telegram: true,
    auto_broadcast_whatsapp: true,
  });

  const [oppScanning, setOppScanning] = useState(false);
  const [orderWinScanning, setOrderWinScanning] = useState(false);
  const [ipoScanning, setIpoScanning] = useState(false);
  const [oppScanResult, setOppScanResult] = useState<OpportunityScanResult | null>(null);
  const [recentOpportunities, setRecentOpportunities] = useState<SystemNotificationItem[]>([]);

  // Sovereign Top 5 Actionable Picks
  const [top5ApexPicks, setTop5ApexPicks] = useState<SovereignCandidate[]>([]);
  const [loadingTop5, setLoadingTop5] = useState<boolean>(false);
  const [dispatchingAllTop5, setDispatchingAllTop5] = useState<boolean>(false);
  const [dispatchingApexSymbol, setDispatchingApexSymbol] = useState<string | null>(null);
  const [apexDispatchSuccess, setApexDispatchSuccess] = useState<string | null>(null);

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

  // Broadcast composer state
  const [composerType, setComposerType] = useState<
    | "VCP"
    | "PRE_BREAKOUT"
    | "MOMENTUM"
    | "TOMORROW"
    | "ORDER_WIN"
    | "CATALYST"
    | "PEAD"
    | "TECHNO_FUNDA"
    | "DELIVERY"
    | "SMART_MONEY"
    | "GROWTH"
    | "CUSTOM"
  >("VCP");
  const getRadarUrl = (path: string) => {
    const origin = typeof window !== "undefined" && window.location.origin ? window.location.origin : "";
    return origin ? `${origin}${path}` : path;
  };

  const getStockLinks = (symbol: string) => {
    const clean = (symbol || "").trim().toUpperCase().replace(/\.(NS|BO)$/, "");
    const origin = typeof window !== "undefined" && window.location.origin ? window.location.origin : "https://ipodesk.shop";
    const stockUrl = `${origin}/stocks/${clean}`;
    const screenerUrl = `https://www.screener.in/company/${clean}/consolidated/`;
    return `🔗 *Research & Terminal Links:*\n• 📱 [Alpha India Stock 360](${stockUrl})\n• 🌐 [Screener.in Financials](${screenerUrl})`;
  };

  const [composerSymbol, setComposerSymbol] = useState("DIXON");
  const [composerName, setComposerName] = useState("Dixon Technologies Ltd");
  const [composerTitle, setComposerTitle] = useState("🎯 VCP BREAKOUT: DIXON TECH (Score 96.2 — Elite Setup)");
  const [composerMessage, setComposerMessage] = useState(
    `🎯 *ALPHA INDIA | MINERVINI VCP BREAKOUT*\n━━━━━━━━━━━━━━━━━━━━━\n🏢 *Dixon Technologies* (\`DIXON\`)\n⭐ *Institutional Score:* 96.2/100 (ELITE SETUP ≥95)\n📐 *Pattern Archetype:* 3-Stage VCP (Supply Dry-Up: 68%)\n━━━━━━━━━━━━━━━━━━━━━\n💵 *Live CMP:* ₹14,285.00\n🎯 *Buy Trigger Price:* ₹14,250.00 (Pivot Point)\n🚪 *Entry Zone:* ₹14,220.00 – ₹14,460.00\n🚀 *Target Price:* ₹15,400.00 (+7.8%) | *T2:* ₹16,800.00 (+17.6%) | *T3:* ₹18,200.00\n🛑 *Stop Loss:* ₹13,400.00 (-6.2%)\n⚖️ *Risk:Reward:* 1:3.8 | *Breakout Vol:* 3.4x 20-DMA\n💡 *Institutional Edge:*\n   • EMS sector leader with multi-quarter margin expansion.\n   • Stage 2 Weinstein breakout with explosive volume confirmation.\n   • MF accumulation up 1.8% in latest filing.\n━━━━━━━━━━━━━━━━━━━━━\n${getStockLinks("DIXON")}\n📡 *Live Radar:* ${getRadarUrl("/vcp-discovery")}`
  );
  const [selectedChannels, setSelectedChannels] = useState<("TELEGRAM" | "WHATSAPP")[]>(["TELEGRAM", "WHATSAPP"]);
  const [broadcasting, setBroadcasting] = useState(false);

  // Dispatch logs
  const [logs, setLogs] = useState<AlertDispatchLogItem[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Load configs & thresholds
  const loadConfigs = async () => {
    try {
      setLoading(true);
      const data = await notificationsApi.getChannelConfigs();
      setConfigs(data);
      if (data.TELEGRAM) {
        setTgToken(data.TELEGRAM.bot_token || "");
        setTgChatId(data.TELEGRAM.chat_id || "");
        setTgEnabled(data.TELEGRAM.is_enabled);
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
        if (oppData) {
          setOppRules((prev) => ({ ...prev, ...oppData }));
        }
        const recent = await notificationsApi.getRecentOpportunities(35);
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
      const recent = await notificationsApi.getRecentOpportunities(35);
      setRecentOpportunities(recent || []);
      showNotification(
        "success",
        `13-Engine Scan complete! Dispatched ${res.new_alerts_count} new opportunity alert(s). Skipped ${res.skipped_duplicates_count} daily duplicate(s).`
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
      setOppRules((prev) => ({ ...prev, ...updated }));
      showNotification("success", "All 13 Institutional Radar alert thresholds updated and synchronized.");
    } catch (err: unknown) {
      showNotification("error", `Failed to save opportunity thresholds: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async () => {
    try {
      setLogsLoading(true);
      const data = await notificationsApi.getDispatchLogs({ limit: 50 });
      setLogs(data.logs || []);
    } catch (err) {
      console.error("Failed to load dispatch logs:", err);
    } finally {
      setLogsLoading(false);
    }
  };

  const loadTop5ApexPicks = async () => {
    try {
      setLoadingTop5(true);
      const data = await fetchSovereignCockpit();
      const all = [
        ...data.chamber_1_compounders.candidates,
        ...data.chamber_2_turnarounds.candidates,
      ];
      const ignition = all
        .filter((c) => c.stage === "IGNITION_READY")
        .sort((a, b) => b.composite_score - a.composite_score)
        .slice(0, 5);
      setTop5ApexPicks(ignition.length > 0 ? ignition : all.slice(0, 5));
    } catch (err) {
      console.error("Failed to load Top 5 Apex Picks:", err);
    } finally {
      setLoadingTop5(false);
    }
  };

  const handleDispatchAllTop5Alerts = async () => {
    if (top5ApexPicks.length === 0) return;
    setDispatchingAllTop5(true);
    setApexDispatchSuccess(null);
    try {
      const results = await Promise.allSettled(
        top5ApexPicks.map((p) =>
          dispatchSovereignAlert(
            p.symbol,
            "IGNITION_TRIGGER",
            `Top 5 Apex Pick: CMP ₹${p.current_price.toFixed(1)}, Buy Box ₹${p.execution.buy_box_range[0].toFixed(1)}-₹${p.execution.buy_box_range[1].toFixed(1)}, Target 1 ₹${p.execution.target_1_harvest.toFixed(1)} (+${p.execution.target_1_pct}%), Hard Stop ₹${p.execution.hard_stop_loss.toFixed(1)} (${p.execution.hard_stop_pct}%)`
          )
        )
      );

      const successful = results.filter((r) => r.status === "fulfilled").length;
      showNotification(
        "success",
        `🚀 Dispatched real-time institutional alerts for ${successful} of ${top5ApexPicks.length} Top Apex picks across In-App notifications and Telegram!`
      );
      setApexDispatchSuccess(`Successfully dispatched ${successful} of ${top5ApexPicks.length} Top 5 alerts!`);
      setTimeout(() => setApexDispatchSuccess(null), 6000);

      const recent = await notificationsApi.getRecentOpportunities(35);
      setRecentOpportunities(recent || []);
      if (activeTab === "logs") loadLogs();
    } catch (err: any) {
      showNotification("error", `Failed to dispatch Top 5 alerts: ${err?.message || "Unknown error"}`);
    } finally {
      setDispatchingAllTop5(false);
    }
  };

  const handleDispatchSingleApexAlert = async (candidate: SovereignCandidate) => {
    setDispatchingApexSymbol(candidate.symbol);
    try {
      await dispatchSovereignAlert(
        candidate.symbol,
        "IGNITION_TRIGGER",
        `Apex Pick: CMP ₹${candidate.current_price.toFixed(1)}, Buy Box ₹${candidate.execution.buy_box_range[0].toFixed(1)}-₹${candidate.execution.buy_box_range[1].toFixed(1)}, Target ₹${candidate.execution.target_1_harvest.toFixed(1)} (+${candidate.execution.target_1_pct}%)`
      );
      showNotification(
        "success",
        `🚀 Live Ignition Alert dispatched for ${candidate.symbol} to Telegram and In-App notification feed!`
      );
      const recent = await notificationsApi.getRecentOpportunities(35);
      setRecentOpportunities(recent || []);
      if (activeTab === "logs") loadLogs();
    } catch (err: any) {
      showNotification("error", `Failed to dispatch alert for ${candidate.symbol}: ${err?.message || "Error"}`);
    } finally {
      setDispatchingApexSymbol(null);
    }
  };

  const handleComposeTop5PicksMemo = () => {
    if (top5ApexPicks.length === 0) return;
    const memo = [
      `🎯 *ALPHA INDIA | TOP 5 APEX STRIKE PICKS*`,
      `━━━━━━━━━━━━━━━━━━━━━`,
      `Institutional-grade high-velocity buys inside the Buy Box today:`,
      ``,
      ...top5ApexPicks.map((p, idx) => 
        `*${idx + 1}. ${p.symbol}* (${p.company_name})\n` +
        `   • *CMP:* ₹${p.current_price.toFixed(2)} | *Conviction:* ${p.composite_score}%\n` +
        `   • *Buy Box:* ₹${p.execution.buy_box_range[0].toFixed(1)} – ₹${p.execution.buy_box_range[1].toFixed(1)}\n` +
        `   • *Target 1:* ₹${p.execution.target_1_harvest.toFixed(1)} (+${p.execution.target_1_pct}%) | *T2:* ₹${p.execution.target_2_harvest.toFixed(1)} (+${p.execution.target_2_pct}%)\n` +
        `   • *Hard Stop:* ₹${p.execution.hard_stop_loss.toFixed(1)} (${p.execution.hard_stop_pct}%)\n` +
        `   • *Stage:* ${p.stage.replace(/_/g, " ")} | *ROCE:* ${p.fundamentals.roce ? `${p.fundamentals.roce.toFixed(1)}%` : "N/A"}\n`
      ),
      `━━━━━━━━━━━━━━━━━━━━━`,
      `⚙️ *Execution Rule:* Deploy 60% Pilot at Buy Box, scale remaining 40% when up +2.5%. Strict -3.0% Hard Stop.\n`,
      `📡 *Live Sovereign Radar:* ${getRadarUrl("/sovereign-cockpit")}`,
    ].join("\n");

    setComposerType("GROWTH");
    setComposerSymbol("TOP5");
    setComposerName("Top 5 Actionable Apex Picks");
    setComposerTitle("🚀 TOP 5 APEX STRIKE PICKS (Actionable Today)");
    setComposerMessage(memo);
    setActiveTab("broadcast");
    showNotification("info", "Top 5 Picks memo loaded into Broadcast Console. Review and click Broadcast.");
  };

  useEffect(() => {
    loadConfigs();
    loadTop5ApexPicks();
  }, []);

  useEffect(() => {
    if (activeTab === "logs") {
      loadLogs();
    }
  }, [activeTab]);

  const showNotification = (type: "success" | "error" | "info", msg: string) => {
    setNotice({ type, msg });
    setTimeout(() => setNotice(null), 4500);
  };

  const handleSaveTelegram = async () => {
    try {
      setLoading(true);
      await notificationsApi.saveTelegramConfig({
        bot_token: tgToken,
        chat_id: tgChatId,
        is_enabled: tgEnabled,
        auto_rules: oppRules as unknown as Record<string, unknown>,
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
        auto_rules: oppRules as unknown as Record<string, unknown>,
      });
      await loadConfigs();
      showNotification("success", "WhatsApp channel settings successfully saved.");
    } catch (err: unknown) {
      showNotification("error", `Failed to save WhatsApp settings: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyPreset = (
    type:
      | "VCP"
      | "PRE_BREAKOUT"
      | "MOMENTUM"
      | "TOMORROW"
      | "ORDER_WIN"
      | "CATALYST"
      | "PEAD"
      | "TECHNO_FUNDA"
      | "DELIVERY"
      | "SMART_MONEY"
      | "GROWTH"
      | "CUSTOM"
  ) => {
    setComposerType(type);
    if (type === "VCP") {
      setComposerSymbol("DIXON");
      setComposerName("Dixon Technologies Ltd");
      setComposerTitle("🎯 VCP BREAKOUT: DIXON TECH (Score 96.2 — Elite Setup)");
      setComposerMessage(
        `🎯 *ALPHA INDIA | MINERVINI VCP BREAKOUT*\n━━━━━━━━━━━━━━━━━━━━━\n🏢 *Dixon Technologies* (\`DIXON\`)\n⭐ *Institutional Score:* 96.2/100 (ELITE SETUP ≥95)\n📐 *Pattern Archetype:* 3-Stage VCP (Supply Dry-Up: 68%)\n━━━━━━━━━━━━━━━━━━━━━\n💵 *Live CMP:* ₹14,285.00\n🎯 *Buy Trigger Price:* ₹14,250.00 (Pivot Point)\n🚪 *Entry Zone:* ₹14,220.00 – ₹14,460.00\n🚀 *Target Price:* ₹15,400.00 (+7.8%) | *T2:* ₹16,800.00 (+17.6%) | *T3:* ₹18,200.00\n🛑 *Stop Loss:* ₹13,400.00 (-6.2%)\n⚖️ *Risk:Reward:* 1:3.8 | *Breakout Vol:* 3.4x 20-DMA\n💡 *Institutional Edge:*\n   • EMS sector leader with multi-quarter margin expansion.\n   • Stage 2 Weinstein breakout with explosive volume confirmation.\n   • MF accumulation up 1.8% in latest filing.\n━━━━━━━━━━━━━━━━━━━━━\n${getStockLinks("DIXON")}\n📡 *Live Radar:* ${getRadarUrl("/vcp-discovery")}`
      );
    } else if (type === "PRE_BREAKOUT") {
      setComposerSymbol("ASTRAL");
      setComposerName("Astral Ltd");
      setComposerTitle("⚡ PRE-BREAKOUT A+: ASTRAL (Conviction 88 PTS • Super Coil)");
      setComposerMessage(
        `⚡ *ALPHA INDIA | PRE-BREAKOUT RADAR*\n━━━━━━━━━━━━━━━━━━━━━\n🏢 *Astral Ltd* (\`ASTRAL\`)\n⭐ *Institutional Score:* 88/100 (A+ SUPER COIL)\n📐 *Base Pattern:* 6-Week Contraction Coil (VDU: 0.52x 20-DMA)\n━━━━━━━━━━━━━━━━━━━━━\n💵 *Live CMP:* ₹2,028.50\n🎯 *Buy Trigger Price:* ₹2,050.00 (Cheat Entry)\n🚀 *Target Price:* ₹2,210.00 (+9.0%) | *T2:* ₹2,390.00 (+18.0%)\n🛑 *Stop Loss:* ₹1,965.00 (-3.1%)\n⚖️ *Risk:Reward:* 1:3.6\n💡 *Setup Analysis:*\nVolumetric supply exhaustion holding the 20-day EMA with NR7 compression candle.\n━━━━━━━━━━━━━━━━━━━━━\n${getStockLinks("ASTRAL")}\n📡 *Live Radar:* ${getRadarUrl("/pre-breakout-radar")}`
      );
    } else if (type === "MOMENTUM") {
      setComposerSymbol("POLYCAB");
      setComposerName("Polycab India Ltd");
      setComposerTitle("🚀 MOMENTUM CONFLUENCE: POLYCAB (10/10 Perfect Match • 89 PTS)");
      setComposerMessage(
        `🚀 *ALPHA INDIA | MOMENTUM RADAR*\n━━━━━━━━━━━━━━━━━━━━━\n🏢 *Polycab India* (\`POLYCAB\`)\n⭐ *Institutional Score:* 89/100 (10/10 CONFLUENCE)\n📊 *Triple RSI:* Daily 68.4 | Weekly 64.2\n📈 *Volume Surge:* 2.85x 20-DMA\n━━━━━━━━━━━━━━━━━━━━━\n💵 *Live CMP:* ₹6,495.00\n🎯 *Buy Trigger Price:* ₹6,480.00 (Momentum Breakout)\n🚀 *Target Price:* ₹7,010.00 (+8.0%) | *T2:* ₹7,530.00 (+16.0%)\n🛑 *Stop Loss:* ₹6,180.00 (-4.8%)\n⚖️ *Risk:Reward:* 1:2.9\n━━━━━━━━━━━━━━━━━━━━━\n${getStockLinks("POLYCAB")}\n📡 *Live Radar:* ${getRadarUrl("/momentum-radar")}`
      );
    } else if (type === "TOMORROW") {
      setComposerSymbol("CDSL");
      setComposerName("Central Depository Services Ltd");
      setComposerTitle("🎯 TOMORROW 5%+ RADAR: CDSL (Conviction 92 PTS • Squeeze Coil)");
      setComposerMessage(
        `🎯 *ALPHA INDIA | TOMORROW 5%+ RADAR*\n━━━━━━━━━━━━━━━━━━━━━\n🏢 *CDSL* (\`CDSL\`)\n⭐ *Institutional Score:* 92/100 (TIER A+ HIGH CONVICTION)\n📐 *Setup Structure:* NR7 Coil • RS +4.2% vs Nifty 50\n━━━━━━━━━━━━━━━━━━━━━\n💵 *Live CMP:* ₹1,482.00\n🎯 *Buy Trigger Price:* ₹1,495.00\n🚀 *Target 1:* ₹1,570.00 (+5.9%) | *Target 2:* ₹1,640.00 (+10.6%)\n🛑 *Stop Loss:* ₹1,440.00 (-2.8%)\n⚖️ *Risk:Reward:* 1:1.9\n━━━━━━━━━━━━━━━━━━━━━\n⚠️ *Execution Protocol:* Enter only if 9:15-9:30 AM gap is between +0.2% and +1.2%.\n${getStockLinks("CDSL")}\n📡 *Live Radar:* ${getRadarUrl("/intraday-radar")}`
      );
    } else if (type === "ORDER_WIN") {
      setComposerSymbol("PURVA");
      setComposerName("Puravankara Ltd");
      setComposerTitle("🏆 ORDER WIN: PURAVANKARA (₹2,600 Cr • Transformational)");
      setComposerMessage(
        `🏆 *ALPHA INDIA | ORDER WIN RADAR*\n━━━━━━━━━━━━━━━━━━━━━\n🏢 *Puravankara Ltd* (\`PURVA\`)\n⭐ *Institutional Score:* 92/100 (TRANSFORMATIONAL IMPACT)\n💰 *Order Value:* ₹2,600.0 Cr (+72.5% TTM Sales)\n🏛️ *Client/Agency:* Goregaon West Mumbai Redevelopment\n⏱️ *Runway:* 18 Months (~₹433.3 Cr/Quarter)\n📈 *Annualized PAT Impact:* +₹429.0 Cr\n━━━━━━━━━━━━━━━━━━━━━\n💵 *Live CMP:* ₹212.00\n🎯 *Buy Trigger Price:* ₹215.00 (Catalyst Trigger)\n🚀 *Target Price:* ₹339.20 (+60.0%)\n🛑 *Stop Loss:* ₹190.80 (-10.0%)\n⚖️ *Risk:Reward:* 1:5.2 | *Win Probability:* 79.8%\n💡 *Quant Thesis:*\nMajor Tier-1 metro redevelopment contract significantly enhances forward quarterly cash flows and margin visibility.\n━━━━━━━━━━━━━━━━━━━━━\n${getStockLinks("PURVA")}\n📡 *Live Radar:* ${getRadarUrl("/announcements?catalyst_type=ORDER_WIN")}`
      );
    } else if (type === "CATALYST") {
      setComposerSymbol("SOLARINDS");
      setComposerName("Solar Industries India Ltd");
      setComposerTitle("📡 CATALYST RADAR: SOLAR INDUSTRIES (₹2,450 Cr Order)");
      setComposerMessage(
        `📡 *ALPHA INDIA | CATALYST RADAR*\n━━━━━━━━━━━━━━━━━━━━━\n🏢 *Solar Industries* (\`SOLARINDS\`)\n⭐ *Institutional Score:* 91/100 (HIGH IMPACT CATALYST)\n⚡ *Catalyst:* DEFENSE WEAPON SUPPLY CONTRACT\n💰 *Contract Value:* ₹2,450.0 Cr\n📋 *Summary:* Ministry of Defence awards ammunition supply contract over 36 months.\n━━━━━━━━━━━━━━━━━━━━━\n💵 *Live CMP:* ₹9,850.00\n🎯 *Buy Trigger Price:* ₹9,920.00\n🚀 *Target Price:* ₹11,350.00 (+15.2%)\n🛑 *Stop Loss:* ₹9,220.00 (-6.4%)\n⚖️ *Risk:Reward:* 1:2.4\n━━━━━━━━━━━━━━━━━━━━━\n${getStockLinks("SOLARINDS")}\n📡 *Live Radar:* ${getRadarUrl("/announcements")}`
      );
    } else if (type === "PEAD") {
      setComposerSymbol("TRENT");
      setComposerName("Trent Ltd");
      setComposerTitle("⚡ ATHENA FLASH: TRENT LTD (Grade AAA+)");
      setComposerMessage(
        `⚡ *ALPHA INDIA | ATHENA PEAD FLASH*\n━━━━━━━━━━━━━━━━━━━━━\n🏢 *Trent Ltd* (\`TRENT\`)\n⭐ *Institutional Score:* 94/100 (GRADE: AAA+ STRONG BUY)\n📈 *QoQ/YoY Growth:*\n   • PAT: ₹412.5 Cr (+142.5% YoY)\n   • Revenue: ₹3,450.0 Cr (+53.8% YoY)\n━━━━━━━━━━━━━━━━━━━━━\n💵 *Live CMP:* ₹7,150.00\n🎯 *Buy Trigger Price:* ₹7,220.00 (PEAD Drift Entry)\n🚀 *Target Price:* ₹8,470.00 (+18.5%)\n🛑 *Stop Loss:* ₹6,650.00 (-7.0%)\n⚖️ *Risk:Reward:* 1:2.6\n💡 *Institutional Thesis:*\nAggressive retail store expansion drives exceptional operating leverage with clean earnings quality.\n━━━━━━━━━━━━━━━━━━━━━\n${getStockLinks("TRENT")}\n📡 *Live Radar:* ${getRadarUrl("/athena-omega")}`
      );
    } else if (type === "TECHNO_FUNDA") {
      setComposerSymbol("KAYNES");
      setComposerName("Kaynes Technology India Ltd");
      setComposerTitle("🎯 TECHNO-FUNDA: KAYNES (Score 91.5 • 2.1% from Pivot)");
      setComposerMessage(
        `🎯 *ALPHA INDIA | TECHNO-FUNDA RADAR*\n━━━━━━━━━━━━━━━━━━━━━\n🏢 *Kaynes Technology* (\`KAYNES\`) • Electronics EMS\n⭐ *Institutional Score:* 91.5/100 | *Health:* 82.0/100\n⚡ *Signal:* \`PRE_BREAKOUT\` | *Pattern:* VCP Base (Stage 2 Leader)\n━━━━━━━━━━━━━━━━━━━━━\n💵 *Live CMP:* ₹2,710.00\n🎯 *Buy Trigger Price:* ₹2,768.00 (Model Pivot • Distance: +2.14%)\n🚀 *Target Price:* ₹3,180.00 (+17.3%)\n🛑 *Stop Loss:* ₹2,520.00 (-7.0%)\n⚖️ *Risk:Reward:* 1:2.5\n💡 *Fundamental Acceleration:* PAT Growth +68% YoY, ROCE 22.4%.\n━━━━━━━━━━━━━━━━━━━━━\n${getStockLinks("KAYNES")}\n📡 *Live Radar:* ${getRadarUrl("/techno-funda")}`
      );
    } else if (type === "DELIVERY") {
      setComposerSymbol("WELSPUNLIV");
      setComposerName("Welspun Living Ltd");
      setComposerTitle("⚡ DELIVERY BREAKOUT: WELSPUNLIV (4.8x Surge • 68% Delivery)");
      setComposerMessage(
        `⚡ *ALPHA INDIA | DELIVERY BREAKOUT RADAR*\n━━━━━━━━━━━━━━━━━━━━━\n🏢 *Welspun Living* (\`WELSPUNLIV\`) • Textiles & Consumer\n⭐ *Institutional Score:* 88/100 (ACTIVE SWING)\n📦 *Delivery Absorption:* 68.4% (Massive Institutional Float Lock)\n📈 *Surge Multiplier:* 4.82x 10-DMA Volume\n📐 *Setup Type:* 50D BREAKOUT\n━━━━━━━━━━━━━━━━━━━━━\n💵 *Live CMP:* ₹168.50\n🎯 *Buy Trigger Price:* ₹170.00 (Volume Confirmation)\n🚀 *Target 1:* ₹185.00 (+10.0%) | *Target 2:* ₹200.00 (+18.7%)\n🛑 *Stop Loss:* ₹162.00 (-3.8%)\n⚖️ *Risk:Reward:* 1:2.6\n━━━━━━━━━━━━━━━━━━━━━\n${getStockLinks("WELSPUNLIV")}\n📡 *Live Radar:* ${getRadarUrl("/delivery-radar")}`
      );
    } else if (type === "SMART_MONEY") {
      setComposerSymbol("SUZLON");
      setComposerName("Suzlon Energy Ltd");
      setComposerTitle("🏛️ SMART MONEY RADAR: SUZLON (Score 86.4 • 5 Schemes Added)");
      setComposerMessage(
        `🏛️ *ALPHA INDIA | INSTITUTIONAL MF RADAR*\n━━━━━━━━━━━━━━━━━━━━━\n🏢 *Suzlon Energy* (\`SUZLON\`) • Green Energy Infrastructure\n⭐ *Institutional Score:* 86.4/100 (SMART MONEY ACCUMULATION)\n💼 *Fresh AMC Position Initiations:* 5 Schemes\n📊 *Net Holding Change:* +34.2%\n⏱️ *Filing Cycle:* Latest Monthly Portfolios\n━━━━━━━━━━━━━━━━━━━━━\n💵 *Live CMP:* ₹68.50\n🎯 *Buy Trigger Price:* ₹69.20 (Institutional Accumulation Pivot)\n🚀 *Target Price:* ₹82.00 (+19.7%)\n🛑 *Stop Loss:* ₹63.70 (-7.0%)\n⚖️ *Risk:Reward:* 1:2.8\n💡 *Institutional Edge:*\nMultiple Tier-1 mutual fund houses opened fresh aggressive additions post-balance sheet turnaround.\n━━━━━━━━━━━━━━━━━━━━━\n${getStockLinks("SUZLON")}\n📡 *Live Radar:* ${getRadarUrl("/institutional-radar/fresh-entries")}`
      );
    } else if (type === "GROWTH") {
      setComposerSymbol("KAYNES");
      setComposerName("Kaynes Technology India Ltd");
      setComposerTitle("🚀 GROWTH BREAKOUT: KAYNES TECH (+98% YoY PAT)");
      setComposerMessage(
        `🚀 *ALPHA INDIA | GROWTH BREAKOUT*\n━━━━━━━━━━━━━━━━━━━━━\n🏢 *Kaynes Technology* (\`KAYNES\`)\n⭐ *Institutional Score:* 93/100 (GROWTH ACCELERATION)\n📈 *YoY PAT Growth:* +98.4%\n📊 *YoY Revenue Growth:* +64.2%\n🛡️ *Operating Margin:* 14.8% | *P/E:* 68.5x\n━━━━━━━━━━━━━━━━━━━━━\n💵 *Live CMP:* ₹2,710.00\n🎯 *Buy Trigger Price:* ₹2,750.00 (Breakout Entry)\n🚀 *Target Price:* ₹3,250.00 (+19.9%)\n🛑 *Stop Loss:* ₹2,520.00 (-7.0%)\n⚖️ *Risk:Reward:* 1:2.8\n💡 *Breakout:* 3-year revenue CAGR crosses institutional acceleration threshold.\n━━━━━━━━━━━━━━━━━━━━━\n${getStockLinks("KAYNES")}\n📡 *Live Radar:* ${getRadarUrl("/growth-screener")}`
      );
    } else {
      setComposerTitle("📢 MARKET INTELLIGENCE MEMO");
      setComposerMessage(
        `📢 *ALPHA INDIA | INSTITUTIONAL MEMO*\n━━━━━━━━━━━━━━━━━━━━━\n🏢 *Company Name* (\`SYMBOL\`)\n⭐ *Institutional Score:* 88/100 (HIGH CONVICTION)\n━━━━━━━━━━━━━━━━━━━━━\n💵 *Live CMP:* ₹0.00\n🎯 *Buy Trigger Price:* ₹0.00\n🚀 *Target Price:* ₹0.00 (+15.0%)\n🛑 *Stop Loss:* ₹0.00 (-7.0%)\n⚖️ *Risk:Reward:* 1:2.1\n💡 *Institutional Edge:*\n[Write institutional trade brief or analyst takeaway here]\n━━━━━━━━━━━━━━━━━━━━━\n${getStockLinks(composerSymbol || "TCS")}\n📡 _Dispatched via Alpha India Terminal_`
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
      const recent = await notificationsApi.getRecentOpportunities(35);
      setRecentOpportunities(recent || []);
      if (activeTab === "logs") loadLogs();
    } catch (err: unknown) {
      showNotification("error", `Failed to trigger VCP scan alerts: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerOrderWinScanAlerts = async () => {
    try {
      setOrderWinScanning(true);
      const res = await notificationsApi.triggerOrderWinScanAlerts(true, oppRules.order_win_min_significance || 65);
      showNotification("success", `Processed ${res.count} institutional Order Win alert(s) dispatched to external channels!`);
      const recent = await notificationsApi.getRecentOpportunities(35);
      setRecentOpportunities(recent || []);
      if (activeTab === "logs") loadLogs();
    } catch (err: unknown) {
      showNotification("error", `Failed to trigger Order Win scan alerts: ${(err as Error).message}`);
    } finally {
      setOrderWinScanning(false);
    }
  };

  const handleTriggerIpoScanAlerts = async () => {
    try {
      setIpoScanning(true);
      const res = await notificationsApi.triggerIpoScanAlerts(true, oppRules.ipo_min_conviction || 85);
      showNotification("success", `Processed ${res.count} institutional Mainboard IPO Radar alert(s) dispatched to external channels!`);
      const recent = await notificationsApi.getRecentOpportunities(35);
      setRecentOpportunities(recent || []);
      if (activeTab === "logs") loadLogs();
    } catch (err: unknown) {
      showNotification("error", `Failed to trigger IPO scan alerts: ${(err as Error).message}`);
    } finally {
      setIpoScanning(false);
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

  // Helper for notification categories
  const getCategoryConfig = (category: string) => {
    switch (category) {
      case "VCP_BREAKOUT":
        return { label: "VCP BREAKOUT", color: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30", icon: Target };
      case "PRE_BREAKOUT":
        return { label: "PRE-BREAKOUT A+", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30", icon: Zap };
      case "MOMENTUM_RADAR":
        return { label: "MOMENTUM RADAR", color: "bg-purple-500/20 text-purple-300 border-purple-500/30", icon: TrendingUp };
      case "TOMORROW_RADAR":
        return { label: "TOMORROW 5%+", color: "bg-rose-500/20 text-rose-300 border-rose-500/30", icon: Flame };
      case "ORDER_WIN_RADAR":
        return { label: "ORDER WIN RADAR", color: "bg-amber-500/20 text-amber-300 border-amber-500/30", icon: Trophy };
      case "CATALYST_ORDER":
        return { label: "CORPORATE CATALYST", color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30", icon: Radio };
      case "ATHENA_PEAD":
        return { label: "ATHENA PEAD", color: "bg-blue-500/20 text-blue-300 border-blue-500/30", icon: Sparkles };
      case "TECHNO_FUNDA":
        return { label: "TECHNO-FUNDA", color: "bg-teal-500/20 text-teal-300 border-teal-500/30", icon: Crosshair };
      case "DELIVERY_BREAKOUT":
        return { label: "DELIVERY SURGE", color: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30", icon: Boxes };
      case "INSTITUTIONAL_MF":
        return { label: "SMART MONEY MF", color: "bg-violet-500/20 text-violet-300 border-violet-500/30", icon: ShieldCheck };
      case "GROWTH_SCREENER":
        return { label: "GROWTH PRO", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30", icon: BarChart3 };
      case "BREAKOUT_EXECUTION":
        return { label: "EXECUTION COCKPIT", color: "bg-red-500/20 text-red-300 border-red-500/30", icon: Flame };
      case "IPO_RADAR":
        return { label: "MAINBOARD IPO RADAR", color: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30", icon: Rocket };
      default:
        return { label: category.replace("_", " "), color: "bg-slate-500/20 text-slate-300 border-slate-500/30", icon: BellRing };
    }
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
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
              External Alert Center
              <span className="text-xs px-2.5 py-0.5 rounded-full border border-cyan-500/40 bg-cyan-500/10 text-cyan-400 font-mono font-semibold">
                14-ENGINE RADAR
              </span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
              Unified multi-channel dispatch radar for Telegram bot broadcasts, WhatsApp trading desks, and real-time equity opportunity triggers.
            </p>
          </div>

          {/* Live Channel Status Badges */}
          <div className="flex items-center gap-2.5">
            <div
              className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold ${
                configs.TELEGRAM?.is_enabled && configs.TELEGRAM?.bot_token
                  ? "border-sky-500/40 bg-sky-50 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300"
                  : "border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400"
              }`}
            >
              <Send size={13} className={configs.TELEGRAM?.is_enabled ? "text-sky-500 dark:text-sky-400" : ""} />
              <span>Telegram: {configs.TELEGRAM?.is_enabled && configs.TELEGRAM?.bot_token ? "ACTIVE" : "STANDBY"}</span>
            </div>

            <div
              className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-semibold ${
                configs.WHATSAPP?.is_enabled
                  ? "border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                  : "border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400"
              }`}
            >
              <Share2 size={13} className={configs.WHATSAPP?.is_enabled ? "text-emerald-500 dark:text-emerald-400" : ""} />
              <span>WhatsApp: {configs.WHATSAPP?.is_enabled ? "READY (WEB/API)" : "STANDBY"}</span>
            </div>

            <button
              onClick={() => {
                loadConfigs();
                if (activeTab === "logs") loadLogs();
              }}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>

        {/* Global Notification Banner */}
        {notice && (
          <div
            className={`flex items-center gap-2.5 rounded-xl border p-3.5 text-xs font-medium transition ${
              notice.type === "success"
                ? "border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300"
                : notice.type === "error"
                ? "border-rose-500/40 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300"
                : "border-cyan-500/40 bg-cyan-50 dark:bg-cyan-950/40 text-cyan-800 dark:text-cyan-300"
            }`}
          >
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
        <div className="flex border-b border-slate-200 dark:border-slate-800 gap-1 sm:gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab("opportunities")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === "opportunities"
                ? "border-cyan-500 text-cyan-600 dark:text-cyan-400 bg-cyan-50/50 dark:bg-cyan-500/5"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <Target size={14} />
            🎯 Radar Alert Engines (13)
          </button>

          <button
            onClick={() => setActiveTab("channels")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === "channels"
                ? "border-cyan-500 text-cyan-600 dark:text-cyan-400 bg-cyan-50/50 dark:bg-cyan-500/5"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <Sliders size={14} />
            📡 Channel Setup & Health
          </button>

          <button
            onClick={() => setActiveTab("rules")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === "rules"
                ? "border-cyan-500 text-cyan-600 dark:text-cyan-400 bg-cyan-50/50 dark:bg-cyan-500/5"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <Zap size={14} />
            ⚡ Automated Dispatch Policies
          </button>

          <button
            onClick={() => setActiveTab("broadcast")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === "broadcast"
                ? "border-cyan-500 text-cyan-600 dark:text-cyan-400 bg-cyan-50/50 dark:bg-cyan-500/5"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <Send size={14} />
            📢 Broadcast Console & Composer
          </button>

          <button
            onClick={() => setActiveTab("logs")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeTab === "logs"
                ? "border-cyan-500 text-cyan-600 dark:text-cyan-400 bg-cyan-50/50 dark:bg-cyan-500/5"
                : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            }`}
          >
            <FileText size={14} />
            📋 Dispatch Audit Ledger
          </button>
        </div>

        {/* ========================================================= */}
        {/* TAB 0: 13-Engine Opportunity Radar Alerts & Thresholds */}
        {/* ========================================================= */}
        {activeTab === "opportunities" && (
          <div className="space-y-6">
            {/* ========================================================= */}
            {/* TOP 5 APEX PICKS: HIGH-VELOCITY DISPATCH BANNER          */}
            {/* ========================================================= */}
            <div className="rounded-2xl border border-cyan-500/50 bg-gradient-to-br from-[#06142a] via-[#081832] to-[#040c1a] p-6 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
              
              <div className="relative z-10 space-y-4">
                {/* Header Row */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-cyan-500/20 pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="flex h-3 w-3 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                      </span>
                      <h3 className="text-lg font-black text-white tracking-wide flex items-center gap-2">
                        <span>⚡ TOP 5 APEX PICKS (ACTIONABLE BUYS TODAY)</span>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono">
                          IGNITION READY
                        </span>
                      </h3>
                    </div>
                    <p className="text-xs text-slate-300">
                      Evaluated by Dual-Chamber mathematical models. Strictly inside their Buy Box (&lt;3.5% of Pivot) with ≥98% conviction score.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      onClick={handleDispatchAllTop5Alerts}
                      disabled={dispatchingAllTop5 || top5ApexPicks.length === 0}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-950/60 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                    >
                      <Rocket size={15} className={dispatchingAllTop5 ? "animate-pulse" : ""} />
                      <span>{dispatchingAllTop5 ? "Broadcasting Top 5 Alerts..." : "🚀 Dispatch Alerts for Top 5 Picks"}</span>
                    </button>

                    <button
                      onClick={handleComposeTop5PicksMemo}
                      disabled={top5ApexPicks.length === 0}
                      className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-cyan-500/40 bg-cyan-950/40 hover:bg-cyan-900/50 text-cyan-300 text-xs font-semibold transition cursor-pointer"
                      title="Open formatted Top 5 digest in Telegram/WhatsApp Composer"
                    >
                      <Send size={13} />
                      <span>Compose Telegram / WA Digest</span>
                    </button>

                    <button
                      onClick={loadTop5ApexPicks}
                      disabled={loadingTop5}
                      className="p-2.5 rounded-xl border border-slate-700 bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
                      title="Refresh Top 5 Picks"
                    >
                      <RefreshCw size={14} className={loadingTop5 ? "animate-spin" : ""} />
                    </button>
                  </div>
                </div>

                {/* Dispatch Confirmation Banner */}
                {apexDispatchSuccess && (
                  <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/60 text-emerald-200 text-xs font-semibold flex items-center gap-2 animate-in fade-in duration-200">
                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                    <span>{apexDispatchSuccess}</span>
                  </div>
                )}

                {/* 5-Card Responsive Grid */}
                {loadingTop5 && top5ApexPicks.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                    <RefreshCw size={14} className="animate-spin text-cyan-400" />
                    <span>Loading Top 5 Apex Picks from Sovereign Radar...</span>
                  </div>
                ) : top5ApexPicks.length === 0 ? (
                  <div className="py-6 text-center text-xs text-slate-500">
                    No active Ignition Ready candidates at this moment. Mathematical filters ensure zero quota dilution.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    {top5ApexPicks.map((pick, idx) => (
                      <div
                        key={pick.symbol}
                        className="rounded-xl bg-slate-950/80 border border-cyan-500/30 hover:border-cyan-400 p-3.5 space-y-2.5 transition-all shadow-md group relative"
                      >
                        {/* Top: Rank & Symbol */}
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-700 text-cyan-300">
                                #{idx + 1}
                              </span>
                              <strong className="text-sm font-black text-white group-hover:text-cyan-300 transition-colors">
                                {pick.symbol}
                              </strong>
                            </div>
                            <div className="text-[10px] text-slate-400 truncate max-w-[120px] mt-0.5">
                              {pick.company_name}
                            </div>
                          </div>

                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                            {pick.composite_score}%
                          </span>
                        </div>

                        {/* Price & Buy Box */}
                        <div className="space-y-1 text-[11px] font-mono bg-slate-900/60 p-2 rounded-lg border border-slate-800">
                          <div className="flex justify-between items-center text-slate-300">
                            <span className="text-[10px] text-slate-400 font-sans">CMP:</span>
                            <span className="font-bold text-white">₹{pick.current_price.toFixed(1)}</span>
                          </div>
                          <div className="flex justify-between items-center text-emerald-400">
                            <span className="text-[10px] text-slate-400 font-sans">Buy Box:</span>
                            <span>₹{pick.execution.buy_box_range[0].toFixed(0)} - ₹{pick.execution.buy_box_range[1].toFixed(0)}</span>
                          </div>
                          <div className="flex justify-between items-center text-rose-400">
                            <span className="text-[10px] text-slate-400 font-sans">Stop (-3%):</span>
                            <span>₹{pick.execution.hard_stop_loss.toFixed(1)}</span>
                          </div>
                          <div className="flex justify-between items-center text-cyan-300">
                            <span className="text-[10px] text-slate-400 font-sans">T1 (+14%):</span>
                            <span>₹{pick.execution.target_1_harvest.toFixed(0)}</span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="grid grid-cols-2 gap-1.5 pt-1">
                          <button
                            onClick={() => handleDispatchSingleApexAlert(pick)}
                            disabled={dispatchingApexSymbol === pick.symbol}
                            className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-700/60 text-emerald-300 text-[10px] font-bold transition active:scale-95 cursor-pointer disabled:opacity-50"
                            title="Dispatch Instant Telegram & In-App Alert for this stock"
                          >
                            <Send size={11} className={dispatchingApexSymbol === pick.symbol ? "animate-pulse" : ""} />
                            <span>{dispatchingApexSymbol === pick.symbol ? "Sending..." : "Alert"}</span>
                          </button>

                          <a
                            href={`/sovereign-cockpit?symbol=${pick.symbol}`}
                            className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-[10px] font-semibold transition active:scale-95 text-center"
                            title="View in Sovereign Cockpit"
                          >
                            <ArrowUpRight size={11} className="text-cyan-400" />
                            <span>Cockpit</span>
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {/* Header Action Banner */}
            <div className="rounded-2xl border border-cyan-500/30 bg-[#071328] p-6 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-5">
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
                    14-ENGINE ACTIVE RADAR
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
                  Continuous multi-engine scanning across Minervini VCP, Pre-Breakout Coils, Multi-Timeframe Momentum, Tomorrow 5%+ Movers, Order Wins, Corporate Catalysts, Athena PEAD, Techno-Funda Pivots, Delivery Surges, Institutional MF Flows, Growth Acceleration, and Mainboard IPO Radar. Alerts auto-deduplicate daily and dispatch directly to Telegram &amp; WhatsApp.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  onClick={() => handleScanOpportunities(true)}
                  disabled={oppScanning}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 px-4 py-2.5 text-xs font-bold text-black transition shadow-md cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw size={14} className={oppScanning ? "animate-spin" : ""} />
                  {oppScanning ? "Scanning 14 Engines..." : "Run 14-Engine Opportunity Scan Now"}
                </button>

                <button
                  onClick={handleTriggerIpoScanAlerts}
                  disabled={ipoScanning}
                  className="flex items-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 px-4 py-2.5 text-xs font-semibold text-cyan-300 transition cursor-pointer disabled:opacity-50"
                >
                  <Rocket size={14} className={ipoScanning ? "animate-spin" : ""} />
                  {ipoScanning ? "Scanning IPOs..." : "Dispatch IPO Radar"}
                </button>

                <button
                  onClick={handleTriggerOrderWinScanAlerts}
                  disabled={orderWinScanning}
                  className="flex items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 px-4 py-2.5 text-xs font-semibold text-amber-300 transition cursor-pointer disabled:opacity-50"
                >
                  <Trophy size={14} className={orderWinScanning ? "animate-spin" : ""} />
                  {orderWinScanning ? "Dispatching..." : "Dispatch Order Wins"}
                </button>

                <button
                  onClick={handleSaveOpportunityRules}
                  disabled={loading}
                  className="flex items-center gap-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 px-4 py-2.5 text-xs font-semibold text-cyan-300 transition cursor-pointer"
                >
                  <Check size={14} />
                  Save All Thresholds
                </button>
              </div>
            </div>

            {/* Cluster Category Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider flex items-center gap-1.5 mr-2">
                <Filter size={12} /> Filter:
              </span>
              {[
                { id: "ALL", label: "All 14 Engines" },
                { id: "BREAKOUT", label: "Breakout & Base Patterns (5)" },
                { id: "MOMENTUM", label: "Momentum & Volatility (4)" },
                { id: "INSTITUTIONAL", label: "Smart Money & Catalysts (3)" },
                { id: "FUNDAMENTAL", label: "Growth & Earnings Surprise (2)" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setClusterFilter(tab.id as ClusterFilter)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer whitespace-nowrap ${
                    clusterFilter === tab.id
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                      : "bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-slate-200"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* 13 Engine Rule Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {/* ========================================================= */}
              {/* CLUSTER A: BREAKOUT & BASE PATTERNS */}
              {/* ========================================================= */}

              {/* Engine 1: Minervini VCP Breakouts */}
              {(clusterFilter === "ALL" || clusterFilter === "BREAKOUT") && (
                <div
                  className={`rounded-2xl border p-5 shadow-lg transition space-y-4 ${
                    oppRules.vcp_signals_enabled ? "border-cyan-500/40 bg-[#08152e]" : "border-slate-800 bg-[#060c18] opacity-60"
                  }`}
                >
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
                        {oppRules.vcp_signals_enabled ? "Active" : "Disabled"}
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
                    <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] text-slate-300 pt-1">
                      <input
                        type="checkbox"
                        checked={oppRules.vcp_elite_only || false}
                        onChange={(e) => setOppRules({ ...oppRules, vcp_elite_only: e.target.checked })}
                        className="rounded border-slate-700 bg-slate-900 text-cyan-500 h-3.5 w-3.5 cursor-pointer"
                      />
                      <span>Elite Setups Only (≥ 95.0 Score)</span>
                    </label>
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 font-mono">Deduplicated daily per symbol</span>
                    <a
                      href="/vcp-signals"
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 font-semibold"
                    >
                      <span>Open Radar</span>
                      <ArrowUpRight size={13} />
                    </a>
                  </div>
                </div>
              )}

              {/* Engine 2: Pre-Breakout Radar (Tier A+) */}
              {(clusterFilter === "ALL" || clusterFilter === "BREAKOUT") && (
                <div
                  className={`rounded-2xl border p-5 shadow-lg transition space-y-4 ${
                    oppRules.prebreakout_a_plus_enabled ? "border-emerald-500/40 bg-[#071c1f]" : "border-slate-800 bg-[#060c18] opacity-60"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                        <Zap size={20} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                          2. Pre-Breakout Radar (Tier A+)
                          <span className="text-[10px] text-emerald-400 font-mono font-normal">/pre-breakout</span>
                        </h3>
                        <p className="text-[11px] text-slate-400">Coil base setups with A+ Conviction Tier (≥80 pts)</p>
                      </div>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <span className="text-[11px] font-semibold text-slate-300">
                        {oppRules.prebreakout_a_plus_enabled ? "Active" : "Disabled"}
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
                      <span>Open Radar</span>
                      <ArrowUpRight size={13} />
                    </a>
                  </div>
                </div>
              )}

              {/* Engine 3: Techno-Funda Radar */}
              {(clusterFilter === "ALL" || clusterFilter === "BREAKOUT") && (
                <div
                  className={`rounded-2xl border p-5 shadow-lg transition space-y-4 ${
                    oppRules.techno_funda_enabled ? "border-teal-500/40 bg-[#061922]" : "border-slate-800 bg-[#060c18] opacity-60"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-teal-500/30 bg-teal-500/10 text-teal-400">
                        <Crosshair size={20} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                          3. Techno-Funda Radar
                          <span className="text-[10px] text-teal-400 font-mono font-normal">/techno-funda</span>
                        </h3>
                        <p className="text-[11px] text-slate-400">Stage-2 growth equities near resistance pivots</p>
                      </div>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <span className="text-[11px] font-semibold text-slate-300">
                        {oppRules.techno_funda_enabled ? "Active" : "Disabled"}
                      </span>
                      <input
                        type="checkbox"
                        checked={oppRules.techno_funda_enabled}
                        onChange={(e) => setOppRules({ ...oppRules, techno_funda_enabled: e.target.checked })}
                        className="rounded border-slate-700 bg-slate-900 text-teal-500 h-4 w-4 cursor-pointer"
                      />
                    </label>
                  </div>

                  <div className="text-xs text-slate-300 space-y-2">
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Combines institutional fundamental health (ROCE, YoY growth) with tight distance to pivot and Stage-2 moving average alignment.
                    </p>
                    <div>
                      <div className="flex justify-between text-[11px] font-mono text-slate-300 mb-1">
                        <span>Minimum Setup Score:</span>
                        <span className="text-teal-400 font-bold">{oppRules.techno_funda_min_score ?? 85} / 100</span>
                      </div>
                      <input
                        type="range"
                        min="75"
                        max="95"
                        step="1"
                        value={oppRules.techno_funda_min_score ?? 85}
                        onChange={(e) => setOppRules({ ...oppRules, techno_funda_min_score: Number(e.target.value) })}
                        className="w-full accent-teal-400 cursor-pointer"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] font-mono text-slate-300 mb-1">
                        <span>Max Distance to Pivot:</span>
                        <span className="text-teal-400 font-bold">≤ {oppRules.techno_funda_max_pivot_dist ?? 4.0}%</span>
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="8"
                        step="0.5"
                        value={oppRules.techno_funda_max_pivot_dist ?? 4.0}
                        onChange={(e) => setOppRules({ ...oppRules, techno_funda_max_pivot_dist: Number(e.target.value) })}
                        className="w-full accent-teal-400 cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 font-mono">Stage-2 Momentum Alignment</span>
                    <a
                      href="/techno-funda"
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-xs text-teal-400 hover:text-teal-300 font-semibold"
                    >
                      <span>Open Radar</span>
                      <ArrowUpRight size={13} />
                    </a>
                  </div>
                </div>
              )}

              {/* Engine 4: Live Breakout Execution Cockpit */}
              {(clusterFilter === "ALL" || clusterFilter === "BREAKOUT") && (
                <div
                  className={`rounded-2xl border p-5 shadow-lg transition space-y-4 ${
                    oppRules.breakout_execution_enabled ? "border-red-500/40 bg-[#1c080d]" : "border-slate-800 bg-[#060c18] opacity-60"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 text-red-400">
                        <Flame size={20} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                          4. Breakout Execution Cockpit
                          <span className="text-[10px] text-red-400 font-mono font-normal">/portfolio/swing</span>
                        </h3>
                        <p className="text-[11px] text-slate-400">Live trigger watcher with immediate buy-zone alerts</p>
                      </div>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <span className="text-[11px] font-semibold text-slate-300">
                        {oppRules.breakout_execution_enabled ? "Active" : "Disabled"}
                      </span>
                      <input
                        type="checkbox"
                        checked={oppRules.breakout_execution_enabled}
                        onChange={(e) => setOppRules({ ...oppRules, breakout_execution_enabled: e.target.checked })}
                        className="rounded border-slate-700 bg-slate-900 text-red-500 h-4 w-4 cursor-pointer"
                      />
                    </label>
                  </div>

                  <div className="text-xs text-slate-300 space-y-2">
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Continuous real-time price monitoring that automatically flags when a watchlisted stock crosses above trigger price with volume pace confirmation.
                    </p>
                    <div className="rounded-xl border border-red-500/20 bg-red-950/20 p-2.5 text-[11px] text-red-200">
                      ⚡ Action State: Dispatches instant critical alert with calculated Buy Zone (Trigger to +1.5%), strict SL, and T1/T2 profit roadmap.
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 font-mono">Live Session Quote Watcher</span>
                    <a
                      href="/portfolio/swing-overlay"
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 font-semibold"
                    >
                      <span>Open Cockpit</span>
                      <ArrowUpRight size={13} />
                    </a>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* CLUSTER B: MOMENTUM & VOLATILITY */}
              {/* ========================================================= */}

              {/* Engine 5: Momentum Radar (Match Score >= 9) */}
              {(clusterFilter === "ALL" || clusterFilter === "MOMENTUM") && (
                <div
                  className={`rounded-2xl border p-5 shadow-lg transition space-y-4 ${
                    oppRules.momentum_match_9_enabled ? "border-purple-500/40 bg-[#160d2e]" : "border-slate-800 bg-[#060c18] opacity-60"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-purple-500/30 bg-purple-500/10 text-purple-400">
                        <TrendingUp size={20} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                          5. Momentum Radar (Match ≥ 9)
                          <span className="text-[10px] text-purple-400 font-mono font-normal">/momentum</span>
                        </h3>
                        <p className="text-[11px] text-slate-400">Multi-timeframe Bollinger Band &amp; RSI confluence</p>
                      </div>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <span className="text-[11px] font-semibold text-slate-300">
                        {oppRules.momentum_match_9_enabled ? "Active" : "Disabled"}
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

                    {/* Full Universe Scan Findings Inclusion */}
                    <div className="pt-2 border-t border-purple-500/20 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <span className="text-[11px] font-bold text-purple-300 flex items-center gap-1.5">
                          <Globe size={12} className="text-purple-400" />
                          Include Full Universe Scan Findings
                        </span>
                        <p className="text-[10px] text-slate-400">
                          Dispatches alerts for non-F&amp;O equities passing institutional gates (Mcap ≥ ₹1,000 Cr &amp; Liquid)
                        </p>
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={oppRules.momentum_universe_enabled ?? true}
                          onChange={(e) => setOppRules({ ...oppRules, momentum_universe_enabled: e.target.checked })}
                          className="rounded border-slate-700 bg-slate-900 text-purple-500 h-4 w-4 cursor-pointer"
                        />
                      </label>
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
                      <span>Open Radar</span>
                      <ArrowUpRight size={13} />
                    </a>
                  </div>
                </div>
              )}

              {/* Engine 6: Momentum Radar (Conviction 79+) */}
              {(clusterFilter === "ALL" || clusterFilter === "MOMENTUM") && (
                <div
                  className={`rounded-2xl border p-5 shadow-lg transition space-y-4 ${
                    oppRules.momentum_conviction_79_enabled ? "border-amber-500/40 bg-[#1e1507]" : "border-slate-800 bg-[#060c18] opacity-60"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
                        <Flame size={20} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                          6. Momentum Radar (Conviction 79+)
                          <span className="text-[10px] text-amber-400 font-mono font-normal">/momentum</span>
                        </h3>
                        <p className="text-[11px] text-slate-400">Composite multi-timeframe conviction score (0–100)</p>
                      </div>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <span className="text-[11px] font-semibold text-slate-300">
                        {oppRules.momentum_conviction_79_enabled ? "Active" : "Disabled"}
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
                      <span>Open Radar</span>
                      <ArrowUpRight size={13} />
                    </a>
                  </div>
                </div>
              )}

              {/* Engine 7: Tomorrow 5%+ Move Radar */}
              {(clusterFilter === "ALL" || clusterFilter === "MOMENTUM") && (
                <div
                  className={`rounded-2xl border p-5 shadow-lg transition space-y-4 ${
                    oppRules.tomorrow_radar_enabled ? "border-rose-500/40 bg-[#1f0914]" : "border-slate-800 bg-[#060c18] opacity-60"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400">
                        <Flame size={20} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                          7. Tomorrow 5%+ Move Radar
                          <span className="text-[10px] text-rose-400 font-mono font-normal">/intraday-radar</span>
                        </h3>
                        <p className="text-[11px] text-slate-400">High-probability pre-market squeeze &amp; NR7 coils</p>
                      </div>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <span className="text-[11px] font-semibold text-slate-300">
                        {oppRules.tomorrow_radar_enabled ? "Active" : "Disabled"}
                      </span>
                      <input
                        type="checkbox"
                        checked={oppRules.tomorrow_radar_enabled}
                        onChange={(e) => setOppRules({ ...oppRules, tomorrow_radar_enabled: e.target.checked })}
                        className="rounded border-slate-700 bg-slate-900 text-rose-500 h-4 w-4 cursor-pointer"
                      />
                    </label>
                  </div>

                  <div className="text-xs text-slate-300 space-y-2">
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Scans 5-minute volatility squeezes, inside-day contractions, and Relative Strength (RS) outperformance versus Nifty 50 for explosive next-day follow-through.
                    </p>
                    <div>
                      <div className="flex justify-between text-[11px] font-mono text-slate-300 mb-1">
                        <span>Minimum Conviction:</span>
                        <span className="text-rose-400 font-bold">{oppRules.tomorrow_min_conviction ?? 90} PTS (Elite)</span>
                      </div>
                      <input
                        type="range"
                        min="75"
                        max="95"
                        step="1"
                        value={oppRules.tomorrow_min_conviction ?? 90}
                        onChange={(e) => setOppRules({ ...oppRules, tomorrow_min_conviction: Number(e.target.value) })}
                        className="w-full accent-rose-400 cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 font-mono">Dispatches Top 3 Curated Picks</span>
                    <a
                      href="/intraday-radar"
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 font-semibold"
                    >
                      <span>Open Radar</span>
                      <ArrowUpRight size={13} />
                    </a>
                  </div>
                </div>
              )}

              {/* Engine 8: Delivery Breakout & Flow Radar */}
              {(clusterFilter === "ALL" || clusterFilter === "MOMENTUM") && (
                <div
                  className={`rounded-2xl border p-5 shadow-lg transition space-y-4 ${
                    oppRules.delivery_breakout_enabled ? "border-indigo-500/40 bg-[#0d0f2b]" : "border-slate-800 bg-[#060c18] opacity-60"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-400">
                        <Boxes size={20} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                          8. Delivery Surge & Net Flow
                          <span className="text-[10px] text-indigo-400 font-mono font-normal">/delivery-radar</span>
                          <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-[9px] font-bold text-purple-300">
                            70% APEX / 62% SWING
                          </span>
                        </h3>
                        <p className="text-[11px] text-slate-400">Dual-engine institutional accumulation & 20D D-A/D flow</p>
                      </div>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <span className="text-[11px] font-semibold text-slate-300">
                        {oppRules.delivery_breakout_enabled ? "Active" : "Disabled"}
                      </span>
                      <input
                        type="checkbox"
                        checked={oppRules.delivery_breakout_enabled}
                        onChange={(e) => setOppRules({ ...oppRules, delivery_breakout_enabled: e.target.checked })}
                        className="rounded border-slate-700 bg-slate-900 text-indigo-500 h-4 w-4 cursor-pointer"
                      />
                    </label>
                  </div>

                  <div className="text-xs text-slate-300 space-y-3">
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Scans institutional float absorption with multi-week 20D Net Flow confirmation and 2-tranche breakeven protection roadmap (+2% BE lock, +5% T1, +10% T2).
                    </p>

                    {/* Tier Selection Dropdown */}
                    <div>
                      <div className="flex justify-between text-[11px] font-mono text-slate-300 mb-1">
                        <span>Conviction Tier Filter:</span>
                        <span className="text-indigo-400 font-bold">
                          {oppRules.delivery_tier === "APEX_SNIPER"
                            ? "🎯 Apex Sniper Only (70%+ WR)"
                            : oppRules.delivery_tier === "ALL"
                            ? "All Radar Signals"
                            : "⚡ Active Swing + Apex (62%+ WR)"}
                        </span>
                      </div>
                      <select
                        value={oppRules.delivery_tier ?? "ACTIVE_SWING"}
                        onChange={(e) => setOppRules({ ...oppRules, delivery_tier: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:border-indigo-500 focus:outline-hidden cursor-pointer shadow-xs"
                      >
                        <option value="ACTIVE_SWING" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">⚡ Active Swing + 🎯 Apex Sniper (62%+ WR) — Recommended</option>
                        <option value="APEX_SNIPER" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">🎯 Apex Sniper Only (70%+ WR) — Ultra Selective</option>
                        <option value="ALL" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">All Radar Signals (incl. Base Watchlist)</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-3 gap-3 pt-1">
                      {/* Min 20D Net Flow */}
                      <div>
                        <div className="flex justify-between text-[10px] font-mono text-slate-300 mb-1">
                          <span>20D Flow:</span>
                          <span className="text-indigo-400 font-bold">{oppRules.delivery_min_flow_20d ?? 1.15}x</span>
                        </div>
                        <input
                          type="range"
                          min="1.0"
                          max="2.5"
                          step="0.05"
                          value={oppRules.delivery_min_flow_20d ?? 1.15}
                          onChange={(e) => setOppRules({ ...oppRules, delivery_min_flow_20d: Number(e.target.value) })}
                          className="w-full accent-indigo-400 cursor-pointer"
                        />
                      </div>

                      {/* Min Surge */}
                      <div>
                        <div className="flex justify-between text-[10px] font-mono text-slate-300 mb-1">
                          <span>Min Spike:</span>
                          <span className="text-indigo-400 font-bold">{oppRules.delivery_min_spike ?? 1.6}x</span>
                        </div>
                        <input
                          type="range"
                          min="1.2"
                          max="4.0"
                          step="0.1"
                          value={oppRules.delivery_min_spike ?? 1.6}
                          onChange={(e) => setOppRules({ ...oppRules, delivery_min_spike: Number(e.target.value) })}
                          className="w-full accent-indigo-400 cursor-pointer"
                        />
                      </div>

                      {/* Min Delivery % */}
                      <div>
                        <div className="flex justify-between text-[10px] font-mono text-slate-300 mb-1">
                          <span>Min Deliv %:</span>
                          <span className="text-indigo-400 font-bold">{oppRules.delivery_min_pct ?? 55}%</span>
                        </div>
                        <input
                          type="range"
                          min="45"
                          max="80"
                          step="5"
                          value={oppRules.delivery_min_pct ?? 55}
                          onChange={(e) => setOppRules({ ...oppRules, delivery_min_pct: Number(e.target.value) })}
                          className="w-full accent-indigo-400 cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 font-mono">51.4% Saved via BE Lock • 1.68 PF</span>
                    <a
                      href="/delivery-radar"
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
                    >
                      <span>Open Radar</span>
                      <ArrowUpRight size={13} />
                    </a>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* CLUSTER C: SMART MONEY & CATALYSTS */}
              {/* ========================================================= */}

              {/* Engine 9: Order Win Radar */}
              {(clusterFilter === "ALL" || clusterFilter === "INSTITUTIONAL") && (
                <div
                  className={`rounded-2xl border p-5 shadow-lg transition space-y-4 ${
                    oppRules.order_win_enabled ? "border-amber-500/40 bg-[#1e1507]" : "border-slate-800 bg-[#060c18] opacity-60"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-400">
                        <Trophy size={20} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                          9. Order Win Radar
                          <span className="text-[10px] text-amber-400 font-mono font-normal">/order-wins</span>
                        </h3>
                        <p className="text-[11px] text-slate-400">Transformational commercial &amp; sovereign contract wins</p>
                      </div>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <span className="text-[11px] font-semibold text-slate-300">
                        {oppRules.order_win_enabled ? "Active" : "Disabled"}
                      </span>
                      <input
                        type="checkbox"
                        checked={oppRules.order_win_enabled}
                        onChange={(e) => setOppRules({ ...oppRules, order_win_enabled: e.target.checked })}
                        className="rounded border-slate-700 bg-slate-900 text-amber-500 h-4 w-4 cursor-pointer"
                      />
                    </label>
                  </div>

                  <div className="text-xs text-slate-300 space-y-2">
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Evaluates contract size vs TTM sales, margin profile, sovereign counterparty, and forward quarterly earnings accretion runway.
                    </p>
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <div className="flex justify-between text-[11px] font-mono text-slate-300 mb-1">
                          <span>Significance:</span>
                          <span className="text-amber-400 font-bold">{oppRules.order_win_min_significance ?? 65} PTS</span>
                        </div>
                        <input
                          type="range"
                          min="50"
                          max="90"
                          step="5"
                          value={oppRules.order_win_min_significance ?? 65}
                          onChange={(e) => setOppRules({ ...oppRules, order_win_min_significance: Number(e.target.value) })}
                          className="w-full accent-amber-400 cursor-pointer"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-[11px] font-mono text-slate-300 mb-1">
                          <span>Min Deal Size:</span>
                          <span className="text-amber-400 font-bold">₹{oppRules.order_win_min_deal_cr ?? 25} Cr</span>
                        </div>
                        <input
                          type="range"
                          min="10"
                          max="200"
                          step="5"
                          value={oppRules.order_win_min_deal_cr ?? 25}
                          onChange={(e) => setOppRules({ ...oppRules, order_win_min_deal_cr: Number(e.target.value) })}
                          className="w-full accent-amber-400 cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 font-mono">Real-Time Exchange NLP</span>
                    <a
                      href="/announcements?catalyst_type=ORDER_WIN"
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 font-semibold"
                    >
                      <span>Open Radar</span>
                      <ArrowUpRight size={13} />
                    </a>
                  </div>
                </div>
              )}

              {/* Engine 10: Corporate Catalyst Announcements */}
              {(clusterFilter === "ALL" || clusterFilter === "INSTITUTIONAL") && (
                <div
                  className={`rounded-2xl border p-5 shadow-lg transition space-y-4 ${
                    oppRules.catalysts_enabled ? "border-yellow-500/40 bg-[#1e1b07]" : "border-slate-800 bg-[#060c18] opacity-60"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-yellow-500/30 bg-yellow-500/10 text-yellow-400">
                        <Radio size={20} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                          10. Corporate Catalysts
                          <span className="text-[10px] text-yellow-400 font-mono font-normal">/announcements</span>
                        </h3>
                        <p className="text-[11px] text-slate-400">Acquisitions, demergers, capex, and defense filings</p>
                      </div>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <span className="text-[11px] font-semibold text-slate-300">
                        {oppRules.catalysts_enabled ? "Active" : "Disabled"}
                      </span>
                      <input
                        type="checkbox"
                        checked={oppRules.catalysts_enabled}
                        onChange={(e) => setOppRules({ ...oppRules, catalysts_enabled: e.target.checked })}
                        className="rounded border-slate-700 bg-slate-900 text-yellow-500 h-4 w-4 cursor-pointer"
                      />
                    </label>
                  </div>

                  <div className="text-xs text-slate-300 space-y-2">
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Scans live corporate disclosures from NSE/BSE feeds. Dispatches immediately when an announcement scores high material market impact.
                    </p>
                    <div>
                      <div className="flex justify-between text-[11px] font-mono text-slate-300 mb-1">
                        <span>Minimum Impact Score:</span>
                        <span className="text-yellow-400 font-bold">{oppRules.catalysts_min_impact ?? 8.5} / 10.0</span>
                      </div>
                      <input
                        type="range"
                        min="7.0"
                        max="9.5"
                        step="0.5"
                        value={oppRules.catalysts_min_impact ?? 8.5}
                        onChange={(e) => setOppRules({ ...oppRules, catalysts_min_impact: Number(e.target.value) })}
                        className="w-full accent-yellow-400 cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 font-mono">STRONG BUY Recommendations</span>
                    <a
                      href="/announcements"
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-xs text-yellow-400 hover:text-yellow-300 font-semibold"
                    >
                      <span>Open Radar</span>
                      <ArrowUpRight size={13} />
                    </a>
                  </div>
                </div>
              )}

              {/* Engine 11: Mutual Fund Smart Money & Fresh Entries */}
              {(clusterFilter === "ALL" || clusterFilter === "INSTITUTIONAL") && (
                <div
                  className={`rounded-2xl border p-5 shadow-lg transition space-y-4 ${
                    oppRules.institutional_mf_enabled ? "border-violet-500/40 bg-[#160b26]" : "border-slate-800 bg-[#060c18] opacity-60"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-violet-500/30 bg-violet-500/10 text-violet-400">
                        <ShieldCheck size={20} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                          11. Mutual Fund Smart Money
                          <span className="text-[10px] text-violet-400 font-mono font-normal">/institutional</span>
                        </h3>
                        <p className="text-[11px] text-slate-400">Fresh AMC initiations &amp; institutional block accumulation</p>
                      </div>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <span className="text-[11px] font-semibold text-slate-300">
                        {oppRules.institutional_mf_enabled ? "Active" : "Disabled"}
                      </span>
                      <input
                        type="checkbox"
                        checked={oppRules.institutional_mf_enabled}
                        onChange={(e) => setOppRules({ ...oppRules, institutional_mf_enabled: e.target.checked })}
                        className="rounded border-slate-700 bg-slate-900 text-violet-500 h-4 w-4 cursor-pointer"
                      />
                    </label>
                  </div>

                  <div className="text-xs text-slate-300 space-y-2">
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Tracks monthly filings of 40+ domestic mutual fund AMCs. Triggers when multiple schemes initiate fresh positions or score high float absorption.
                    </p>
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <div className="flex justify-between text-[11px] font-mono text-slate-300 mb-1">
                          <span>Min Schemes:</span>
                          <span className="text-violet-400 font-bold">≥ {oppRules.institutional_min_schemes ?? 3} Funds</span>
                        </div>
                        <input
                          type="range"
                          min="2"
                          max="6"
                          step="1"
                          value={oppRules.institutional_min_schemes ?? 3}
                          onChange={(e) => setOppRules({ ...oppRules, institutional_min_schemes: Number(e.target.value) })}
                          className="w-full accent-violet-400 cursor-pointer"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-[11px] font-mono text-slate-300 mb-1">
                          <span>Smart Money:</span>
                          <span className="text-violet-400 font-bold">{oppRules.institutional_min_smart_money_score ?? 80} PTS</span>
                        </div>
                        <input
                          type="range"
                          min="70"
                          max="95"
                          step="5"
                          value={oppRules.institutional_min_smart_money_score ?? 80}
                          onChange={(e) => setOppRules({ ...oppRules, institutional_min_smart_money_score: Number(e.target.value) })}
                          className="w-full accent-violet-400 cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 font-mono">Monthly Portfolio Disclosure</span>
                    <a
                      href="/institutional-radar/fresh-entries"
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 font-semibold"
                    >
                      <span>Open Radar</span>
                      <ArrowUpRight size={13} />
                    </a>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* CLUSTER D: FUNDAMENTAL ACCELERATION & EARNINGS SURPRISE */}
              {/* ========================================================= */}

              {/* Engine 12: Athena PEAD Flash */}
              {(clusterFilter === "ALL" || clusterFilter === "FUNDAMENTAL") && (
                <div
                  className={`rounded-2xl border p-5 shadow-lg transition space-y-4 ${
                    oppRules.athena_pead_enabled ? "border-blue-500/40 bg-[#081729]" : "border-slate-800 bg-[#060c18] opacity-60"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-400">
                        <Sparkles size={20} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                          12. Athena PEAD Flash
                          <span className="text-[10px] text-blue-400 font-mono font-normal">/athena-omega</span>
                        </h3>
                        <p className="text-[11px] text-slate-400">Grade AAA+/AAA post-earnings announcement drift flashes</p>
                      </div>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <span className="text-[11px] font-semibold text-slate-300">
                        {oppRules.athena_pead_enabled ? "Active" : "Disabled"}
                      </span>
                      <input
                        type="checkbox"
                        checked={oppRules.athena_pead_enabled}
                        onChange={(e) => setOppRules({ ...oppRules, athena_pead_enabled: e.target.checked })}
                        className="rounded border-slate-700 bg-slate-900 text-blue-500 h-4 w-4 cursor-pointer"
                      />
                    </label>
                  </div>

                  <div className="text-xs text-slate-300 space-y-2">
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Evaluates quarterly filings through the 5-Gate Athena engine. Fires immediately upon result parsing when financial shock and earnings quality exceed threshold.
                    </p>
                    <div>
                      <div className="flex justify-between text-[11px] font-mono text-slate-300 mb-1">
                        <span>Min Financial Shock Score:</span>
                        <span className="text-blue-400 font-bold">{oppRules.athena_min_shock_score ?? 75} / 100</span>
                      </div>
                      <input
                        type="range"
                        min="60"
                        max="95"
                        step="5"
                        value={oppRules.athena_min_shock_score ?? 75}
                        onChange={(e) => setOppRules({ ...oppRules, athena_min_shock_score: Number(e.target.value) })}
                        className="w-full accent-blue-400 cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 font-mono">5-Gate Forensic Quality Gate</span>
                    <a
                      href="/athena-omega"
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 font-semibold"
                    >
                      <span>Open Radar</span>
                      <ArrowUpRight size={13} />
                    </a>
                  </div>
                </div>
              )}

              {/* Engine 13: Growth Screener PRO Breakout */}
              {(clusterFilter === "ALL" || clusterFilter === "FUNDAMENTAL") && (
                <div
                  className={`rounded-2xl border p-5 shadow-lg transition space-y-4 ${
                    oppRules.growth_screener_enabled ? "border-emerald-500/40 bg-[#071f15]" : "border-slate-800 bg-[#060c18] opacity-60"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                        <BarChart3 size={20} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                          13. Growth Screener PRO
                          <span className="text-[10px] text-emerald-400 font-mono font-normal">/growth-screener</span>
                        </h3>
                        <p className="text-[11px] text-slate-400">Quarterly profit acceleration with healthy ROCE &amp; margins</p>
                      </div>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <span className="text-[11px] font-semibold text-slate-300">
                        {oppRules.growth_screener_enabled ? "Active" : "Disabled"}
                      </span>
                      <input
                        type="checkbox"
                        checked={oppRules.growth_screener_enabled}
                        onChange={(e) => setOppRules({ ...oppRules, growth_screener_enabled: e.target.checked })}
                        className="rounded border-slate-700 bg-slate-900 text-emerald-500 h-4 w-4 cursor-pointer"
                      />
                    </label>
                  </div>

                  <div className="text-xs text-slate-300 space-y-2">
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Surfaces fundamental acceleration leaders that cross multi-quarter YoY PAT growth acceleration and sustained revenue expansion milestones.
                    </p>
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <div className="flex justify-between text-[11px] font-mono text-slate-300 mb-1">
                          <span>Min PAT Growth:</span>
                          <span className="text-emerald-400 font-bold">+{oppRules.growth_min_pat_pct ?? 50}%</span>
                        </div>
                        <input
                          type="range"
                          min="25"
                          max="100"
                          step="5"
                          value={oppRules.growth_min_pat_pct ?? 50}
                          onChange={(e) => setOppRules({ ...oppRules, growth_min_pat_pct: Number(e.target.value) })}
                          className="w-full accent-emerald-400 cursor-pointer"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-[11px] font-mono text-slate-300 mb-1">
                          <span>Min Sales Growth:</span>
                          <span className="text-emerald-400 font-bold">+{oppRules.growth_min_sales_pct ?? 25}%</span>
                        </div>
                        <input
                          type="range"
                          min="15"
                          max="60"
                          step="5"
                          value={oppRules.growth_min_sales_pct ?? 25}
                          onChange={(e) => setOppRules({ ...oppRules, growth_min_sales_pct: Number(e.target.value) })}
                          className="w-full accent-emerald-400 cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 font-mono">Fundamental Acceleration</span>
                    <a
                      href="/growth-screener"
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 font-semibold"
                    >
                      <span>Open Screener</span>
                      <ArrowUpRight size={13} />
                    </a>
                  </div>
                </div>
              )}

              {/* Engine 14: Mainboard IPO Radar (Blue-Sky & Base Cheats) */}
              {(clusterFilter === "ALL" || clusterFilter === "BREAKOUT") && (
                <div
                  className={`rounded-2xl border p-5 shadow-lg transition space-y-4 ${
                    oppRules.ipo_radar_enabled ? "border-cyan-500/40 bg-[#071824]" : "border-slate-800 bg-[#060c18] opacity-60"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-400">
                        <Rocket size={20} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                          14. Mainboard IPO Radar
                          <span className="text-[10px] text-cyan-400 font-mono font-normal">/ipo-radar</span>
                        </h3>
                        <p className="text-[11px] text-slate-400">Blue-Sky LDH, Base Cheats &amp; SEBI 30D/90D Anchor Lock-in Exhaustion (Zero SME)</p>
                      </div>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <span className="text-[11px] font-semibold text-slate-300">
                        {oppRules.ipo_radar_enabled ? "Active" : "Disabled"}
                      </span>
                      <input
                        type="checkbox"
                        checked={oppRules.ipo_radar_enabled ?? true}
                        onChange={(e) => setOppRules({ ...oppRules, ipo_radar_enabled: e.target.checked })}
                        className="rounded border-slate-700 bg-slate-900 text-cyan-500 h-4 w-4 cursor-pointer"
                      />
                    </label>
                  </div>

                  <div className="text-xs text-slate-300 space-y-2">
                    <p className="text-[11px] text-slate-400 leading-relaxed">
                      Monitors all Mainboard NSE/BSE IPOs listed in the last 2.5 years. Dispatches alerts when price breaches Day-1 High (Blue-Sky), completes institutional VCP supply contraction, or rebounds after Anchor lock-in expiry.
                    </p>
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <div className="flex justify-between text-[11px] font-mono text-slate-300 mb-1">
                          <span>Min Conviction:</span>
                          <span className="text-cyan-400 font-bold">{oppRules.ipo_min_conviction ?? 85} / 100</span>
                        </div>
                        <input
                          type="range"
                          min="70"
                          max="95"
                          step="5"
                          value={oppRules.ipo_min_conviction ?? 85}
                          onChange={(e) => setOppRules({ ...oppRules, ipo_min_conviction: Number(e.target.value) })}
                          className="w-full accent-cyan-400 cursor-pointer"
                        />
                      </div>
                      <div className="flex items-center pt-4">
                        <label className="flex items-center gap-2 cursor-pointer select-none text-[11px] text-slate-300">
                          <input
                            type="checkbox"
                            checked={oppRules.ipo_blue_sky_only ?? false}
                            onChange={(e) => setOppRules({ ...oppRules, ipo_blue_sky_only: e.target.checked })}
                            className="rounded border-slate-700 bg-slate-900 text-cyan-500 h-4 w-4 cursor-pointer"
                          />
                          <span>Blue-Sky LDH Only (Day 1 Breakouts)</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 font-mono">Mainboard Only • 2R Rule (+15%)</span>
                    <a
                      href="/ipo-radar"
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 font-semibold"
                    >
                      <span>Open IPO Radar</span>
                      <ArrowUpRight size={13} />
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* External Broadcast Auto-Dispatch Toggles */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#081225] p-5 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Radio size={14} className="text-cyan-400" />
                  Auto-Dispatch Multi-Channel Broadcaster
                </h4>
                <p className="text-[11px] text-slate-400">
                  When new opportunities trigger in any of the 13 active radar engines above, automatically dispatch formatted memos to enabled desks:
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
                  <h3 className="text-sm font-bold text-white">Live Dispatched Radar Alerts Feed</h3>
                </div>
                <span className="text-xs text-slate-400 font-mono">
                  {recentOpportunities.length} opportunities logged today
                </span>
              </div>

              {recentOpportunities.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">
                  No opportunity alerts generated yet today. Click &quot;Run 13-Engine Opportunity Scan Now&quot; above to evaluate all engines.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {recentOpportunities.map((notif) => {
                    const catCfg = getCategoryConfig(notif.category);
                    const IconComponent = catCfg.icon;

                    return (
                      <div
                        key={notif.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-800/80 bg-slate-900/60 hover:border-cyan-500/40 transition"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <div
                            className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-xs ${catCfg.color}`}
                          >
                            <IconComponent size={14} />
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase font-mono border ${catCfg.color}`}
                              >
                                {catCfg.label}
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
                        href="https://t.me/Alphaindiaprodbot"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sky-400 hover:underline font-semibold inline-flex items-center gap-0.5"
                      >
                        @Alphaindiaprodbot <ArrowUpRight size={11} />
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
                    placeholder="e.g. -1002345678901 or @AlphaIndiaSignals"
                    value={tgChatId}
                    onChange={(e) => setTgChatId(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-sky-500 focus:outline-hidden font-mono"
                  />
                </div>

                {tgDiscoveredChats.length > 0 && (
                  <div className="rounded-xl border border-sky-500/30 bg-sky-950/20 p-3 space-y-2">
                    <span className="text-[11px] font-bold text-sky-300">Discovered Telegram Conversations:</span>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {tgDiscoveredChats.map((c) => (
                        <div
                          key={c.id}
                          onClick={() => setTgChatId(c.id)}
                          className="flex items-center justify-between p-2 rounded-lg bg-slate-900/80 hover:bg-sky-500/20 cursor-pointer border border-slate-800 text-xs transition"
                        >
                          <span className="font-semibold text-white">{c.title}</span>
                          <span className="font-mono text-[10px] text-sky-400">{c.id}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

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
                    disabled={tgTesting}
                    className="flex items-center gap-1.5 rounded-xl border border-sky-500/40 bg-sky-500/10 px-4 py-2.5 text-xs font-semibold text-sky-300 hover:bg-sky-500/20 transition cursor-pointer"
                  >
                    <Send size={13} className={tgTesting ? "animate-spin" : ""} />
                    Send Test Ping
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
                    <h2 className="text-base font-bold text-white">WhatsApp Institutional Desk</h2>
                    <p className="text-xs text-slate-400">Cloud API &amp; 1-Click Share Web Links</p>
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
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-3.5 space-y-1.5">
                  <p className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
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
                    className="flex-1 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-4 py-2.5 text-xs font-bold text-black transition shadow-sm cursor-pointer"
                  >
                    Save WhatsApp Settings
                  </button>
                  <button
                    onClick={handleOpenWhatsAppWeb}
                    className="flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition cursor-pointer"
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
        {/* TAB 2: Automated Dispatch Policies */}
        {/* ========================================================= */}
        {activeTab === "rules" && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#081225] p-6 shadow-xl space-y-6">
            <div className="border-b border-slate-800 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Zap size={18} className="text-cyan-400" />
                  Automated Broadcasting Rule Triggers &amp; Routing Matrix
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Synchronized policy triggers across all 13 institutional market radars and external dispatch channels.
                </p>
              </div>

              <button
                onClick={handleSaveOpportunityRules}
                disabled={loading}
                className="flex items-center gap-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 px-5 py-2 text-xs font-bold text-black transition shadow-md cursor-pointer self-start md:self-auto"
              >
                <Check size={14} />
                Save Policy Configuration
              </button>
            </div>

            {/* Matrix Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Engine / Radar</th>
                    <th className="py-3 px-4">Active Status</th>
                    <th className="py-3 px-4">Primary Qualification Trigger</th>
                    <th className="py-3 px-4">Daily Dedup Policy</th>
                    <th className="py-3 px-4 text-right">Action Link</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {[
                    {
                      name: "Minervini VCP Breakouts",
                      key: "vcp_signals_enabled",
                      rule: `Score ≥ ${oppRules.vcp_min_score} / 100${oppRules.vcp_elite_only ? " (Elite ≥95)" : ""}`,
                      link: "/vcp-signals",
                    },
                    {
                      name: "Pre-Breakout Coil (Tier A+)",
                      key: "prebreakout_a_plus_enabled",
                      rule: `Conviction ≥ ${oppRules.prebreakout_min_conviction} PTS (VDU < 0.65x)`,
                      link: "/pre-breakout-radar",
                    },
                    {
                      name: "Techno-Funda Radar",
                      key: "techno_funda_enabled",
                      rule: `Score ≥ ${oppRules.techno_funda_min_score ?? 85} • Pivot Dist ≤ ${oppRules.techno_funda_max_pivot_dist ?? 4.0}%`,
                      link: "/techno-funda",
                    },
                    {
                      name: "Breakout Execution Cockpit",
                      key: "breakout_execution_enabled",
                      rule: `CMP crosses trigger within Buy Zone (+1.5% max)`,
                      link: "/portfolio/swing-overlay",
                    },
                    {
                      name: "Super Momentum Confluence",
                      key: "momentum_match_9_enabled",
                      rule: `Matched ≥ ${oppRules.momentum_min_matches}/10 Conditions or Conviction ≥ ${oppRules.momentum_min_conviction} PTS`,
                      link: "/momentum-radar",
                    },
                    {
                      name: "Tomorrow 5%+ Move Radar",
                      key: "tomorrow_radar_enabled",
                      rule: `Conviction ≥ ${oppRules.tomorrow_min_conviction ?? 90} PTS (5M Squeeze + NR7)`,
                      link: "/intraday-radar",
                    },
                    {
                      name: "Delivery Breakout Surge",
                      key: "delivery_breakout_enabled",
                      rule: `Surge ≥ ${oppRules.delivery_min_spike ?? 2.5}x 10-DMA & Delivery ≥ ${oppRules.delivery_min_pct ?? 65}%`,
                      link: "/delivery-radar",
                    },
                    {
                      name: "Order Win Contracts",
                      key: "order_win_enabled",
                      rule: `Significance ≥ ${oppRules.order_win_min_significance ?? 65} PTS & Size ≥ ₹${oppRules.order_win_min_deal_cr ?? 25} Cr`,
                      link: "/announcements?catalyst_type=ORDER_WIN",
                    },
                    {
                      name: "Corporate Catalysts",
                      key: "catalysts_enabled",
                      rule: `NLP Impact Score ≥ ${oppRules.catalysts_min_impact ?? 8.5}/10.0 (Strong Buy)`,
                      link: "/announcements",
                    },
                    {
                      name: "Mutual Fund Smart Money",
                      key: "institutional_mf_enabled",
                      rule: `Fresh Entry in ≥ ${oppRules.institutional_min_schemes ?? 3} Funds or Smart Score ≥ ${oppRules.institutional_min_smart_money_score ?? 80}`,
                      link: "/institutional-radar/fresh-entries",
                    },
                    {
                      name: "Athena PEAD Flash",
                      key: "athena_pead_enabled",
                      rule: `Financial Shock Score ≥ ${oppRules.athena_min_shock_score ?? 75}/100 (AAA+/AAA)`,
                      link: "/athena-omega",
                    },
                    {
                      name: "Growth Screener PRO",
                      key: "growth_screener_enabled",
                      rule: `PAT Growth YoY ≥ +${oppRules.growth_min_pat_pct ?? 50}% & Sales YoY ≥ +${oppRules.growth_min_sales_pct ?? 25}%`,
                      link: "/growth-screener",
                    },
                    {
                      name: "Mainboard IPO Radar",
                      key: "ipo_radar_enabled",
                      rule: `Conviction ≥ ${oppRules.ipo_min_conviction ?? 85}/100 • Blue-Sky LDH & Base Cheats (Zero SME)`,
                      link: "/ipo-radar",
                    },
                  ].map((row) => {
                    const isEnabled = Boolean(oppRules[row.key as keyof OpportunityThresholds]);
                    return (
                      <tr key={row.key} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4 font-semibold text-white">{row.name}</td>
                        <td className="py-3 px-4">
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={isEnabled}
                              onChange={(e) =>
                                setOppRules({ ...oppRules, [row.key]: e.target.checked } as OpportunityThresholds)
                              }
                              className="rounded border-slate-700 bg-slate-900 text-cyan-500 h-4 w-4"
                            />
                            <span className={isEnabled ? "text-cyan-400 font-semibold" : "text-slate-500"}>
                              {isEnabled ? "ENABLED" : "PAUSED"}
                            </span>
                          </label>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-slate-300">{row.rule}</td>
                        <td className="py-3 px-4 text-slate-400 text-[11px]">18h Timezone Dedup Window</td>
                        <td className="py-3 px-4 text-right">
                          <a
                            href={row.link}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-cyan-400 hover:text-cyan-300"
                          >
                            <span>Open</span>
                            <ArrowUpRight size={11} />
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Broadcast Destination Summary */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Send size={18} className="text-sky-400 shrink-0" />
                <div>
                  <span className="text-xs font-bold text-white block">Multi-Channel Routing Status</span>
                  <span className="text-[11px] text-slate-400">
                    Dispatches to Telegram Bot ({configs.TELEGRAM?.is_enabled ? "Active" : "Disabled"}) and WhatsApp Desk ({configs.WHATSAPP?.is_enabled ? "Active" : "Disabled"}).
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setActiveTab("channels")}
                  className="rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs text-slate-300 transition cursor-pointer"
                >
                  Configure Desks
                </button>
                <button
                  onClick={handleSaveOpportunityRules}
                  className="rounded-lg bg-cyan-500 hover:bg-cyan-400 px-4 py-1.5 text-xs font-bold text-black transition cursor-pointer"
                >
                  Save Sync
                </button>
              </div>
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

              {/* Template Presets (All Engines Supported) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Load Standard Institutional Preset (11 Radar Formats)
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: "VCP", label: "🎯 Minervini VCP", color: "border-cyan-500/50 bg-cyan-500/15 text-cyan-300" },
                    { id: "PRE_BREAKOUT", label: "⚡ Pre-Breakout A+", color: "border-emerald-500/50 bg-emerald-500/15 text-emerald-300" },
                    { id: "MOMENTUM", label: "🚀 Momentum Confluence", color: "border-purple-500/50 bg-purple-500/15 text-purple-300" },
                    { id: "TOMORROW", label: "🌅 Tomorrow 5%+ Move", color: "border-rose-500/50 bg-rose-500/15 text-rose-300" },
                    { id: "ORDER_WIN", label: "🏆 Order Win Radar", color: "border-amber-500/50 bg-amber-500/15 text-amber-300" },
                    { id: "CATALYST", label: "📡 Corporate Catalyst", color: "border-yellow-500/50 bg-yellow-500/15 text-yellow-300" },
                    { id: "PEAD", label: "⚡ Athena PEAD Flash", color: "border-blue-500/50 bg-blue-500/15 text-blue-300" },
                    { id: "TECHNO_FUNDA", label: "🎯 Techno-Funda Pivot", color: "border-teal-500/50 bg-teal-500/15 text-teal-300" },
                    { id: "DELIVERY", label: "📦 Delivery Surge Breakout", color: "border-indigo-500/50 bg-indigo-500/15 text-indigo-300" },
                    { id: "SMART_MONEY", label: "🏛️ MF Smart Money", color: "border-violet-500/50 bg-violet-500/15 text-violet-300" },
                    { id: "GROWTH", label: "📈 Growth Acceleration", color: "border-emerald-500/50 bg-emerald-500/15 text-emerald-300" },
                    { id: "CUSTOM", label: "📝 Custom Memo", color: "border-slate-500/50 bg-slate-500/15 text-slate-300" },
                  ].map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => handleApplyPreset(preset.id as any)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                        composerType === preset.id ? preset.color : "border-slate-700 bg-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {/* Quick Scan Action Bar */}
                <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-2.5 px-3.5">
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <Target size={14} className="text-cyan-400 shrink-0" />
                    <span>On-Demand: Fast-trigger institutional radar picks to external desks</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={handleTriggerVCPScanAlerts}
                      disabled={loading}
                      className="flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/20 px-3 py-1 text-xs font-bold text-cyan-300 hover:bg-cyan-500/30 transition disabled:opacity-50 cursor-pointer"
                    >
                      <Sparkles size={12} />
                      Dispatch VCP
                    </button>
                    <button
                      onClick={handleTriggerOrderWinScanAlerts}
                      disabled={orderWinScanning}
                      className="flex items-center gap-1.5 rounded-lg border border-amber-500/40 bg-amber-500/20 px-3 py-1 text-xs font-bold text-amber-300 hover:bg-amber-500/30 transition disabled:opacity-50 cursor-pointer"
                    >
                      <Trophy size={12} />
                      Dispatch Orders
                    </button>
                    <button
                      onClick={handleTriggerIpoScanAlerts}
                      disabled={ipoScanning}
                      className="flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/20 px-3 py-1 text-xs font-bold text-cyan-300 hover:bg-cyan-500/30 transition disabled:opacity-50 cursor-pointer"
                    >
                      <Rocket size={12} />
                      Dispatch IPOs
                    </button>
                  </div>
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
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-300">
                    Memo Content (Markdown formatted for Telegram &amp; WhatsApp)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const links = getStockLinks(composerSymbol || "TCS");
                      if (!composerMessage.includes("Research & Terminal Links")) {
                        setComposerMessage((prev) => `${prev.trim()}\n━━━━━━━━━━━━━━━━━━━━━\n${links}`);
                        showNotification("info", `Appended Alpha India 360 & Screener.in links for ${composerSymbol || "TCS"}`);
                      } else {
                        showNotification("info", "Research links already present in memo");
                      }
                    }}
                    className="flex items-center gap-1 text-[11px] font-medium text-cyan-400 hover:text-cyan-300 transition cursor-pointer"
                  >
                    <Link2 size={12} />
                    Insert Research Links
                  </button>
                </div>
                <textarea
                  rows={12}
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
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 px-5 py-2.5 text-xs font-bold text-black transition shadow-md disabled:opacity-50 cursor-pointer"
                >
                  <Send size={14} className={broadcasting ? "animate-spin" : ""} />
                  {broadcasting ? "Broadcasting..." : "Dispatch Institutional Memo"}
                </button>

                <button
                  onClick={handleOpenWhatsAppWeb}
                  className="flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition cursor-pointer"
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
                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white cursor-pointer"
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
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition cursor-pointer"
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
                className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:text-white cursor-pointer"
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
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${
                              log.channel === "TELEGRAM"
                                ? "bg-sky-500/20 text-sky-300 border border-sky-500/30"
                                : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            }`}
                          >
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
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                              log.status === "SUCCESS"
                                ? "bg-emerald-500/20 text-emerald-400"
                                : log.status === "FAILED"
                                ? "bg-rose-500/20 text-rose-400"
                                : "bg-slate-700 text-slate-300"
                            }`}
                          >
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

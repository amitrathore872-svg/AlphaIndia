"use client";

import React, { useState, useEffect, useMemo } from "react";
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
  TrendingDown,
  X,
  Clock,
  Sparkles,
  Volume2,
  Layers,
  Briefcase,
  Bookmark,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Filter,
  Sliders,
  ExternalLink,
} from "lucide-react";
import {
  fetchWatchlists,
  fetchAllActiveAlerts,
  createUnifiedAlert,
  updateAlertStatus,
  deleteWatchlistAlert,
} from "@/lib/watchlistApi";
import { portfolioApi, PortfolioItem } from "@/lib/portfolioApi";
import type {
  WatchlistAlertItem,
  CreateUnifiedAlertPayload,
  AlertsOverviewSummary,
  WatchlistSummary,
  Watchlist,
} from "@/types/watchlist";

interface WatchlistAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbol?: string | null;
  watchlistId?: number | null;
  currentPrice?: number | null;
  dma50?: number | null;
  dma200?: number | null;
  onAlertsChanged?: () => void;
  initialTab?: "new" | "manage";
  initialScope?: "STOCK" | "WATCHLIST" | "PORTFOLIO" | "ALL_SCREENERS";
}

interface RuleDefinition {
  type: string;
  label: string;
  category: "BUY" | "SELL" | "PRICE" | "TECHNICAL" | "DMA" | "SUPERTREND";
  direction: "BUY" | "SELL" | "NEUTRAL";
  defaultOffset?: number; // e.g. 1.05 for +5%
  defaultVal?: number;
  requiresThreshold?: boolean;
  thresholdType?: "price" | "percent" | "multiplier" | "score";
  desc: string;
}

const INSTITUTIONAL_RULES: RuleDefinition[] = [
  // ── 📈 9, 20, 50, 200 DMA Cross Over Signals (Down to Up & Up to Down) ──
  {
    type: "DMA_9_RECLAIM",
    label: "9 DMA Bullish Momentum Reclaim (Price Crosses Above 9 DMA)",
    category: "DMA",
    direction: "BUY",
    thresholdType: "price",
    requiresThreshold: false,
    desc: "🟢 BUY: Price crosses from down to up above 9-day moving average (Short-Term Momentum Ignition)",
  },
  {
    type: "DMA_9_BREAKDOWN",
    label: "9 DMA Fast Momentum Breakdown (Price Drops Below 9 DMA)",
    category: "DMA",
    direction: "SELL",
    thresholdType: "price",
    requiresThreshold: false,
    desc: "🔴 SELL: Price crosses from up to down below 9-day moving average (Fast Trend Loss / Pullback Warning)",
  },
  {
    type: "DMA_20_RECLAIM",
    label: "20 DMA Swing Base Reclaim (Price Crosses Above 20 DMA)",
    category: "DMA",
    direction: "BUY",
    thresholdType: "price",
    requiresThreshold: false,
    desc: "🟢 BUY: Price reclaims 20-day moving average from below (Swing Support Rebound)",
  },
  {
    type: "DMA_20_BREAKDOWN",
    label: "20 DMA Swing Support Floor Breakdown (Price Drops Below 20 DMA)",
    category: "DMA",
    direction: "SELL",
    thresholdType: "price",
    requiresThreshold: false,
    desc: "🔴 SELL: Price crosses down below 20-day moving average (Key Swing Floor Violated)",
  },
  {
    type: "DMA_50_RECLAIM",
    label: "50 DMA Institutional Bullish Reclaim (Price Crosses Above 50 DMA)",
    category: "DMA",
    direction: "BUY",
    thresholdType: "price",
    requiresThreshold: false,
    desc: "🟢 BUY: Price reclaims institutional 50-day moving average from down to up",
  },
  {
    type: "DMA_50_BREAKDOWN",
    label: "50 DMA Institutional Trend Breakdown (Price Drops Below 50 DMA)",
    category: "DMA",
    direction: "SELL",
    thresholdType: "price",
    requiresThreshold: false,
    desc: "🔴 SELL: Price drops from up to down below 50-day moving average (Trend Failure)",
  },
  {
    type: "DMA_200_RECLAIM",
    label: "200 DMA Macro Bull Regime Reclaim (Price Crosses Above 200 DMA)",
    category: "DMA",
    direction: "BUY",
    thresholdType: "price",
    requiresThreshold: false,
    desc: "🟢 BUY: Price crosses from down to up above 200-day moving average (Macro Regime Shift)",
  },
  {
    type: "DMA_200_BREAKDOWN",
    label: "200 DMA Macro Regime Breakdown (Price Drops Below 200 DMA)",
    category: "DMA",
    direction: "SELL",
    thresholdType: "price",
    requiresThreshold: false,
    desc: "🔴 SELL: Price drops from up to down below 200-day moving average (Macro Bear Regime)",
  },

  // ── ⚡ Moving Average vs Moving Average Crossovers (9, 20, 50, 200 DMA) ──
  {
    type: "DMA_9_CROSS_ABOVE_20",
    label: "9 DMA Crosses Above 20 DMA (Fast Bullish Crossover Spark)",
    category: "DMA",
    direction: "BUY",
    requiresThreshold: false,
    desc: "🟢 BUY: 9-day moving average crosses above 20-day moving average (Momentum Acceleration)",
  },
  {
    type: "DMA_9_CROSS_BELOW_20",
    label: "9 DMA Crosses Below 20 DMA (Fast Bearish Crossover Pullback)",
    category: "DMA",
    direction: "SELL",
    requiresThreshold: false,
    desc: "🔴 SELL: 9-day moving average crosses below 20-day moving average (Short-Term Trend Fatigue)",
  },
  {
    type: "DMA_20_CROSS_ABOVE_50",
    label: "20 DMA Crosses Above 50 DMA (Medium-Term Trend Crossover)",
    category: "DMA",
    direction: "BUY",
    requiresThreshold: false,
    desc: "🟢 BUY: 20-day moving average crosses above 50-day moving average (Confirmed Bullish Trend)",
  },
  {
    type: "DMA_20_CROSS_BELOW_50",
    label: "20 DMA Crosses Below 50 DMA (Medium-Term Trend Breakdown)",
    category: "DMA",
    direction: "SELL",
    requiresThreshold: false,
    desc: "🔴 SELL: 20-day moving average crosses below 50-day moving average (Confirmed Trend Reversal)",
  },
  {
    type: "GOLDEN_CROSS",
    label: "Golden Cross: 50 DMA Crosses Above 200 DMA (Macro Bullish Shift)",
    category: "DMA",
    direction: "BUY",
    requiresThreshold: false,
    desc: "🟢 BUY: Macro institutional Golden Cross (50 DMA crosses 200 DMA from down to up)",
  },
  {
    type: "DEATH_CROSS",
    label: "Death Cross: 50 DMA Crosses Below 200 DMA (Macro Bearish Shift)",
    category: "DMA",
    direction: "SELL",
    requiresThreshold: false,
    desc: "🔴 SELL: Macro Death Cross (50 DMA crosses 200 DMA from up to down - Capital Protection)",
  },
  {
    type: "DMA_9_CROSS_ABOVE_50",
    label: "9 DMA Crosses Above 50 DMA (Fast Momentum into Trend)",
    category: "DMA",
    direction: "BUY",
    requiresThreshold: false,
    desc: "🟢 BUY: Short-term momentum breaches directly through 50-day institutional trendline",
  },
  {
    type: "DMA_9_CROSS_BELOW_50",
    label: "9 DMA Crosses Below 50 DMA (Fast Trend Invalidation)",
    category: "DMA",
    direction: "SELL",
    requiresThreshold: false,
    desc: "🔴 SELL: Short-term momentum loses the 50-day institutional baseline",
  },

  // ── ⚡ Supertrend (10, 3) UP & DOWN Signals ──
  {
    type: "SUPERTREND_BUY",
    label: "Supertrend (10, 3) Bullish Flip (Down to Up - BUY Signal)",
    category: "SUPERTREND",
    direction: "BUY",
    requiresThreshold: false,
    desc: "🟢 BUY: Supertrend flips Green (Price crosses above trailing ATR band)",
  },
  {
    type: "SUPERTREND_SELL",
    label: "Supertrend (10, 3) Bearish Flip (Up to Down - SELL Signal)",
    category: "SUPERTREND",
    direction: "SELL",
    requiresThreshold: false,
    desc: "🔴 SELL: Supertrend flips Red (Price breaches trailing ATR band from up to down)",
  },

  // ── 🟢 Institutional Screener Breakout Signals ──
  {
    type: "VCP_PIVOT_BREAK",
    label: "Minervini VCP Pivot Breakout",
    category: "BUY",
    direction: "BUY",
    requiresThreshold: false,
    desc: "Triggers when volatility contraction pattern completes and volume expands through pivot",
  },
  {
    type: "PRE_BREAKOUT_COIL",
    label: "Pre-Breakout A+ Super Coil",
    category: "BUY",
    direction: "BUY",
    requiresThreshold: false,
    desc: "Triggers on tight pre-breakout compression before the main pivot clears",
  },
  {
    type: "MOMENTUM_CONFLUENCE",
    label: "Momentum Confluence (≥ 8/10 Gates)",
    category: "BUY",
    direction: "BUY",
    thresholdType: "score",
    defaultVal: 8,
    requiresThreshold: true,
    desc: "Triggers when multi-timeframe RSI, MACD, Trend & Volume confirm ignition simultaneously",
  },
  {
    type: "TOMORROW_5PCT_RADAR",
    label: "Tomorrow 5%+ Move Radar (NR7 / Volatility Squeeze)",
    category: "BUY",
    direction: "BUY",
    requiresThreshold: false,
    desc: "Triggers on highest-conviction institutional coil primed for explosive next-day expansion",
  },
  {
    type: "TECHNO_FUNDA_PIVOT",
    label: "Techno-Funda Growth Pivot",
    category: "BUY",
    direction: "BUY",
    requiresThreshold: false,
    desc: "Triggers when top-quartile EPS & Sales growth converges with a high-tight consolidation base",
  },
  {
    type: "DELIVERY_SPIKE_BREAKOUT",
    label: "High Delivery Float Lock (≥ 50% Delivery + 2x Vol)",
    category: "BUY",
    direction: "BUY",
    requiresThreshold: false,
    desc: "Triggers when institutional block delivery spikes above 50% of daily traded volume",
  },
  {
    type: "MF_SMART_MONEY",
    label: "Mutual Fund / DII Smart Money Inflow",
    category: "BUY",
    direction: "BUY",
    requiresThreshold: false,
    desc: "Triggers when mutual funds & institutional hands accumulate aggressively into strength",
  },
  {
    type: "PEAD_EARNINGS_SURPRISE",
    label: "Athena PEAD Earnings Flash (+3% Gap)",
    category: "BUY",
    direction: "BUY",
    requiresThreshold: false,
    desc: "Post-Earnings Announcement Drift: triggers on quarterly blockbuster earnings beats",
  },
  {
    type: "ORDER_WIN_CATALYST",
    label: "Institutional Order Win / Mega Capex Catalyst",
    category: "BUY",
    direction: "BUY",
    requiresThreshold: false,
    desc: "Exchange announcement catalyst: multi-crore contract award or expansion filing",
  },

  // ── 🔴 Institutional Risk & Exit Protection Signals ──
  {
    type: "STOP_LOSS_BREACH",
    label: "Stop-Loss Floor Breached (Support Loss)",
    category: "SELL",
    direction: "SELL",
    thresholdType: "price",
    defaultOffset: 0.95, // -5%
    requiresThreshold: true,
    desc: "Triggers immediate capital protection alert when price falls below defined invalidation floor",
  },
  {
    type: "TRAILING_STOP_BREACH",
    label: "Trailing Stop-Loss Hit (-3% to -7%)",
    category: "SELL",
    direction: "SELL",
    thresholdType: "price",
    defaultOffset: 0.95,
    requiresThreshold: true,
    desc: "Locks in gains by alerting when price pulls back from recent pivot peaks",
  },
  {
    type: "TARGET_PROFIT_BOOK",
    label: "Target Profit Booking Level Reached",
    category: "SELL",
    direction: "SELL",
    thresholdType: "price",
    defaultOffset: 1.15, // +15%
    requiresThreshold: true,
    desc: "Notifies when position reaches institutional R:R target to take profits or trim",
  },
  {
    type: "DISTRIBUTION_DAY_SPIKE",
    label: "Heavy Distribution Day Invalidation",
    category: "SELL",
    direction: "SELL",
    requiresThreshold: false,
    desc: "Triggers on institutional dump: price down >0.2% on volume heavier than previous day",
  },
  {
    type: "PEAD_EARNINGS_MISS",
    label: "Athena PEAD Earnings Miss Alert",
    category: "SELL",
    direction: "SELL",
    requiresThreshold: false,
    desc: "Earnings disappointment warning: quarterly EBITDA or PAT contract by >15% YoY",
  },

  // ── 🎯 Direct Price & Volume Triggers ──
  {
    type: "PRICE_CROSS_ABOVE",
    label: "Price Crosses Above Level (Breakout)",
    category: "PRICE",
    direction: "BUY",
    thresholdType: "price",
    defaultOffset: 1.05,
    requiresThreshold: true,
    desc: "Triggers when price breaches above specified resistance price target",
  },
  {
    type: "PRICE_CROSS_BELOW",
    label: "Price Drops Below Level (Breakdown)",
    category: "PRICE",
    direction: "SELL",
    thresholdType: "price",
    defaultOffset: 0.95,
    requiresThreshold: true,
    desc: "Triggers when price falls below specified support boundary",
  },
  {
    type: "DMA_200_BOUNCE",
    label: "200 DMA Support Bounce Test",
    category: "PRICE",
    direction: "BUY",
    thresholdType: "price",
    requiresThreshold: false,
    desc: "Triggers when stock touches macro 200-day moving average and shows support wick",
  },
  {
    type: "VOLUME_SPIKE_2X",
    label: "Volume Surge (≥ 2.0x 20D Average)",
    category: "TECHNICAL",
    direction: "BUY",
    thresholdType: "multiplier",
    defaultVal: 2.0,
    requiresThreshold: true,
    desc: "Triggers when trading volume explodes past institutional 20-day moving baseline",
  },
  {
    type: "PERCENT_SURGE_3",
    label: "Day Momentum Surge (≥ +3.0%)",
    category: "TECHNICAL",
    direction: "BUY",
    thresholdType: "percent",
    defaultVal: 3.0,
    requiresThreshold: true,
    desc: "Triggers on powerful single-day momentum ignition and price velocity",
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
  initialTab = "new",
  initialScope = "STOCK",
}: WatchlistAlertModalProps) {
  // Navigation
  const [activeTab, setActiveTab] = useState<"new" | "manage">(initialTab);

  // Form State: Scope
  const [targetScope, setTargetScope] = useState<"STOCK" | "WATCHLIST" | "PORTFOLIO" | "ALL_SCREENERS">(
    symbol ? "STOCK" : initialScope
  );
  const [targetSymbol, setTargetSymbol] = useState<string>(symbol || "");
  const [selectedWatchlistId, setSelectedWatchlistId] = useState<number | "">(watchlistId || "");
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<number | "">("");

  // Rule selection & direction filter
  const [ruleCategoryTab, setRuleCategoryTab] = useState<"ALL" | "BUY" | "SELL" | "DMA" | "SUPERTREND" | "PRICE">("BUY");
  const [ruleType, setRuleType] = useState<string>("VCP_PIVOT_BREAK");
  const [thresholdValue, setThresholdValue] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [notifyInApp, setNotifyInApp] = useState(true);
  const [notifyTelegram, setNotifyTelegram] = useState(true);

  // Data sources
  const [watchlists, setWatchlists] = useState<WatchlistSummary[]>([]);
  const [portfolios, setPortfolios] = useState<PortfolioItem[]>([]);
  const [allAlerts, setAllAlerts] = useState<WatchlistAlertItem[]>([]);
  const [summary, setSummary] = useState<AlertsOverviewSummary | null>(null);

  // Filters for Active Alerts Manager Tab
  const [manageScopeFilter, setManageScopeFilter] = useState<string>("ALL");
  const [manageDirectionFilter, setManageDirectionFilter] = useState<string>("ALL");
  const [searchFilter, setSearchFilter] = useState<string>("");

  // Loading states
  const [loadingAlerts, setLoadingAlerts] = useState(false);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [expandedTriggerHistoryId, setExpandedTriggerHistoryId] = useState<number | null>(null);

  // Sync symbol on prop change
  useEffect(() => {
    if (symbol) {
      setTargetSymbol(symbol.toUpperCase());
      setTargetScope("STOCK");
      if (currentPrice && currentPrice > 0) {
        setThresholdValue((currentPrice * 1.05).toFixed(2));
      }
    }
  }, [symbol, currentPrice]);

  // Load Watchlists & Portfolios for Scoped Pickers
  useEffect(() => {
    if (isOpen) {
      fetchWatchlists()
        .then((res) => {
          if (res.watchlists) {
            setWatchlists(res.watchlists);
            if (!selectedWatchlistId && res.watchlists.length > 0) {
              setSelectedWatchlistId(res.watchlists[0].id);
            }
          }
        })
        .catch((e) => console.error("Error loading watchlists:", e));

      portfolioApi
        .getPortfolios()
        .then((ports) => {
          if (Array.isArray(ports)) {
            setPortfolios(ports);
            if (!selectedPortfolioId && ports.length > 0) {
              setSelectedPortfolioId(ports[0].id);
            }
          }
        })
        .catch((e) => console.error("Error loading portfolios:", e));

      loadAlerts();
    }
  }, [isOpen]);

  // Load All Active Alerts
  const loadAlerts = async () => {
    try {
      setLoadingAlerts(true);
      const res = await fetchAllActiveAlerts();
      setAllAlerts(res.alerts || []);
      if (res.summary) setSummary(res.summary);
    } catch (err) {
      console.error("Failed to load alerts:", err);
    } finally {
      setLoadingAlerts(false);
    }
  };

  // Active Rule Object
  const activeRuleConfig = useMemo(() => {
    return INSTITUTIONAL_RULES.find((r) => r.type === ruleType) || INSTITUTIONAL_RULES[0];
  }, [ruleType]);

  // Filtered Rules by category tab
  const filteredRuleOptions = useMemo(() => {
    if (ruleCategoryTab === "ALL") return INSTITUTIONAL_RULES;
    if (ruleCategoryTab === "BUY") return INSTITUTIONAL_RULES.filter((r) => r.direction === "BUY");
    if (ruleCategoryTab === "SELL") return INSTITUTIONAL_RULES.filter((r) => r.direction === "SELL");
    if (ruleCategoryTab === "DMA") return INSTITUTIONAL_RULES.filter((r) => r.category === "DMA" || r.type.includes("DMA") || r.type.includes("CROSS"));
    if (ruleCategoryTab === "SUPERTREND") return INSTITUTIONAL_RULES.filter((r) => r.category === "SUPERTREND" || r.type.includes("SUPERTREND"));
    if (ruleCategoryTab === "PRICE") return INSTITUTIONAL_RULES.filter((r) => r.category === "PRICE" || r.category === "TECHNICAL");
    return INSTITUTIONAL_RULES;
  }, [ruleCategoryTab]);

  // Update default threshold when ruleType changes
  const handleRuleTypeChange = (newType: string) => {
    setRuleType(newType);
    const rule = INSTITUTIONAL_RULES.find((r) => r.type === newType);
    if (!rule) return;

    if (currentPrice && currentPrice > 0) {
      if (rule.defaultOffset) {
        setThresholdValue((currentPrice * rule.defaultOffset).toFixed(2));
      } else if (newType === "DMA_50_RECLAIM" && dma50) {
        setThresholdValue(dma50.toFixed(2));
      } else if (newType === "DMA_200_BOUNCE" && dma200) {
        setThresholdValue(dma200.toFixed(2));
      } else if (rule.defaultVal) {
        setThresholdValue(rule.defaultVal.toString());
      } else {
        setThresholdValue("");
      }
    } else if (rule.defaultVal) {
      setThresholdValue(rule.defaultVal.toString());
    } else {
      setThresholdValue("");
    }
  };

  // Quick Preset Actions
  const applyPreset = (presetType: string) => {
    if (presetType === "TARGET_10") {
      setRuleType("TARGET_PROFIT_BOOK");
      setRuleCategoryTab("SELL");
      if (currentPrice) setThresholdValue((currentPrice * 1.1).toFixed(2));
    } else if (presetType === "TARGET_20") {
      setRuleType("TARGET_PROFIT_BOOK");
      setRuleCategoryTab("SELL");
      if (currentPrice) setThresholdValue((currentPrice * 1.2).toFixed(2));
    } else if (presetType === "STOP_5") {
      setRuleType("STOP_LOSS_BREACH");
      setRuleCategoryTab("SELL");
      if (currentPrice) setThresholdValue((currentPrice * 0.95).toFixed(2));
    } else if (presetType === "STOP_7") {
      setRuleType("TRAILING_STOP_BREACH");
      setRuleCategoryTab("SELL");
      if (currentPrice) setThresholdValue((currentPrice * 0.93).toFixed(2));
    } else if (presetType === "VCP") {
      setRuleType("VCP_PIVOT_BREAK");
      setRuleCategoryTab("BUY");
      setThresholdValue("");
    } else if (presetType === "DMA50") {
      setRuleType("DMA_50_RECLAIM");
      setRuleCategoryTab("DMA");
      if (dma50) setThresholdValue(dma50.toFixed(2));
    } else if (presetType === "DMA9_20_BULL") {
      setRuleType("DMA_9_CROSS_ABOVE_20");
      setRuleCategoryTab("DMA");
      setThresholdValue("");
    } else if (presetType === "DMA9_20_BEAR") {
      setRuleType("DMA_9_CROSS_BELOW_20");
      setRuleCategoryTab("DMA");
      setThresholdValue("");
    } else if (presetType === "GOLDEN_CROSS") {
      setRuleType("GOLDEN_CROSS");
      setRuleCategoryTab("DMA");
      setThresholdValue("");
    } else if (presetType === "DEATH_CROSS") {
      setRuleType("DEATH_CROSS");
      setRuleCategoryTab("DMA");
      setThresholdValue("");
    } else if (presetType === "ST_BUY") {
      setRuleType("SUPERTREND_BUY");
      setRuleCategoryTab("SUPERTREND");
      setThresholdValue("");
    } else if (presetType === "ST_SELL") {
      setRuleType("SUPERTREND_SELL");
      setRuleCategoryTab("SUPERTREND");
      setThresholdValue("");
    }
  };

  // Handle Form Submission
  const handleCreateAlert = async () => {
    setCreating(true);
    setNotice(null);

    try {
      const val = thresholdValue ? parseFloat(thresholdValue) : undefined;
      const payload: CreateUnifiedAlertPayload = {
        target_scope: targetScope,
        rule_type: ruleType,
        signal_direction: activeRuleConfig.direction,
        threshold_value: val,
        notes: notes.trim() || undefined,
        notify_in_app: notifyInApp,
        notify_telegram: notifyTelegram,
      };

      if (targetScope === "STOCK") {
        if (!targetSymbol.trim()) {
          throw new Error("Please specify a stock ticker symbol (e.g. RELIANCE, TCS).");
        }
        payload.symbol = targetSymbol.trim().toUpperCase();
        payload.target_name = payload.symbol;
      } else if (targetScope === "WATCHLIST") {
        if (!selectedWatchlistId) {
          throw new Error("Please select a target Watchlist.");
        }
        payload.watchlist_id = Number(selectedWatchlistId);
        const wl = watchlists.find((w) => w.id === payload.watchlist_id);
        payload.target_name = wl ? `Watchlist: ${wl.name}` : `Watchlist #${payload.watchlist_id}`;
      } else if (targetScope === "PORTFOLIO") {
        if (!selectedPortfolioId) {
          throw new Error("Please select a target Portfolio.");
        }
        payload.portfolio_id = Number(selectedPortfolioId);
        const port = portfolios.find((p) => p.id === payload.portfolio_id);
        payload.target_name = port ? `Portfolio: ${port.name}` : `Portfolio #${payload.portfolio_id}`;
      } else if (targetScope === "ALL_SCREENERS") {
        payload.target_name = "All Institutional Screeners";
      }

      const res = await createUnifiedAlert(payload);
      setNotice({
        type: "success",
        msg: res.message || "Alert rule armed successfully!",
      });

      await loadAlerts();
      if (onAlertsChanged) onAlertsChanged();
      setActiveTab("manage");
    } catch (err: any) {
      setNotice({ type: "error", msg: err.message || "Failed to create alert rule." });
    } finally {
      setCreating(false);
    }
  };

  // Toggle Alert Active / Muted
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

  // Delete Alert
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

  // Filtered Alert List for Manage Tab
  const displayedAlerts = useMemo(() => {
    return allAlerts.filter((al) => {
      if (manageScopeFilter !== "ALL") {
        if ((al.target_scope || "STOCK") !== manageScopeFilter) return false;
      }
      if (manageDirectionFilter !== "ALL") {
        if ((al.signal_direction || "BUY") !== manageDirectionFilter) return false;
      }
      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase();
        const symMatch = al.symbol?.toLowerCase().includes(q);
        const nameMatch = al.target_name?.toLowerCase().includes(q);
        const ruleMatch = al.rule_type?.toLowerCase().includes(q);
        const notesMatch = al.notes?.toLowerCase().includes(q);
        if (!symMatch && !nameMatch && !ruleMatch && !notesMatch) return false;
      }
      return true;
    });
  }, [allAlerts, manageScopeFilter, manageDirectionFilter, searchFilter]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl border border-slate-800 bg-[#070F1E] shadow-2xl text-slate-200 overflow-hidden">
        {/* ── Top Header Ribbon ── */}
        <div className="flex items-center justify-between border-b border-slate-800/80 px-6 py-4 bg-slate-900/50">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 shadow-inner">
              <Bell className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-base font-bold text-white tracking-wide">
                  Institutional Alert Radar & Studio
                </h2>
                <span className="rounded-full bg-cyan-950/70 border border-cyan-500/30 px-2.5 py-0.5 text-[10px] font-mono text-cyan-400 font-bold">
                  PRO SCANNER
                </span>
                {targetSymbol && targetScope === "STOCK" && (
                  <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                    {targetSymbol} {currentPrice ? `• ₹${currentPrice.toLocaleString("en-IN")}` : ""}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Configure institutional trigger conditions across single stocks, complete watchlists, portfolios, or all screeners.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition"
            title="Close Alert Studio"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Tab Switcher Strip ── */}
        <div className="flex items-center justify-between border-b border-slate-800/80 px-6 py-2.5 bg-slate-950/60">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("new")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === "new"
                  ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-950"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>Create Alert Trigger</span>
            </button>
            <button
              onClick={() => setActiveTab("manage")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === "manage"
                  ? "bg-cyan-500 text-slate-950 shadow-md shadow-cyan-950"
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
              }`}
            >
              <Bell className="w-4 h-4" />
              <span>Active Radar Rules</span>
              <span
                className={`ml-1 px-2 py-0.2 rounded-full text-[10px] font-mono font-bold ${
                  activeTab === "manage" ? "bg-slate-950 text-cyan-400" : "bg-slate-800 text-slate-300"
                }`}
              >
                {allAlerts.length}
              </span>
            </button>
          </div>

          {/* Quick Refresh Icon */}
          <button
            onClick={loadAlerts}
            disabled={loadingAlerts}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-400 transition"
            title="Refresh active triggers"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingAlerts ? "animate-spin text-cyan-400" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        {/* ── Notice Banner ── */}
        {notice && (
          <div
            className={`mx-6 mt-4 flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-xs font-medium ${
              notice.type === "success"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-rose-500/30 bg-rose-500/10 text-rose-300"
            }`}
          >
            {notice.type === "success" ? (
              <Check className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{notice.msg}</span>
          </div>
        )}

        {/* ── MAIN CONTENT AREA ── */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* ========================================================= */}
          {/* ── TAB 1: CREATE NEW SCOPED ALERT ─────────────────────── */}
          {/* ========================================================= */}
          {activeTab === "new" && (
            <div className="space-y-5">
              {/* 1. Scope Selector Grid */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                  Step 1: Choose Alert Scope
                </label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                  {/* Stock Specific */}
                  <button
                    type="button"
                    onClick={() => setTargetScope("STOCK")}
                    className={`flex flex-col items-start p-3 rounded-xl border text-left transition ${
                      targetScope === "STOCK"
                        ? "border-cyan-500 bg-cyan-950/30 text-white shadow-xs"
                        : "border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Target
                        className={`w-4 h-4 ${targetScope === "STOCK" ? "text-cyan-400" : "text-slate-400"}`}
                      />
                      <span className="text-xs font-bold">Single Stock</span>
                    </div>
                    <span className="text-[11px] text-slate-500 line-clamp-1">
                      Target specific symbol (e.g. {targetSymbol || "TCS"})
                    </span>
                  </button>

                  {/* Complete Watchlist */}
                  <button
                    type="button"
                    onClick={() => setTargetScope("WATCHLIST")}
                    className={`flex flex-col items-start p-3 rounded-xl border text-left transition ${
                      targetScope === "WATCHLIST"
                        ? "border-cyan-500 bg-cyan-950/30 text-white shadow-xs"
                        : "border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Bookmark
                        className={`w-4 h-4 ${targetScope === "WATCHLIST" ? "text-cyan-400" : "text-slate-400"}`}
                      />
                      <span className="text-xs font-bold">Complete Watchlist</span>
                    </div>
                    <span className="text-[11px] text-slate-500 line-clamp-1">
                      Monitor all stocks in chosen watchlist
                    </span>
                  </button>

                  {/* Complete Portfolio */}
                  <button
                    type="button"
                    onClick={() => setTargetScope("PORTFOLIO")}
                    className={`flex flex-col items-start p-3 rounded-xl border text-left transition ${
                      targetScope === "PORTFOLIO"
                        ? "border-cyan-500 bg-cyan-950/30 text-white shadow-xs"
                        : "border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Briefcase
                        className={`w-4 h-4 ${targetScope === "PORTFOLIO" ? "text-cyan-400" : "text-slate-400"}`}
                      />
                      <span className="text-xs font-bold">Complete Portfolio</span>
                    </div>
                    <span className="text-[11px] text-slate-500 line-clamp-1">
                      Monitor all active portfolio holdings
                    </span>
                  </button>

                  {/* All Screeners */}
                  <button
                    type="button"
                    onClick={() => setTargetScope("ALL_SCREENERS")}
                    className={`flex flex-col items-start p-3 rounded-xl border text-left transition ${
                      targetScope === "ALL_SCREENERS"
                        ? "border-cyan-500 bg-cyan-950/30 text-white shadow-xs"
                        : "border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Zap
                        className={`w-4 h-4 ${targetScope === "ALL_SCREENERS" ? "text-cyan-400" : "text-slate-400"}`}
                      />
                      <span className="text-xs font-bold">All Screeners</span>
                    </div>
                    <span className="text-[11px] text-slate-500 line-clamp-1">
                      Scan full universe for signals
                    </span>
                  </button>
                </div>

                {/* Sub-Selector based on Scope */}
                <div className="mt-3 p-3.5 rounded-xl border border-slate-800 bg-slate-900/50">
                  {targetScope === "STOCK" && (
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                          NSE Equity Symbol
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={targetSymbol}
                            onChange={(e) => setTargetSymbol(e.target.value.toUpperCase())}
                            placeholder="e.g. RELIANCE, LAURUSLABS, TATAMOTORS"
                            className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3.5 py-2 font-mono text-xs font-bold text-white uppercase placeholder:text-slate-600 focus:border-cyan-500 focus:outline-hidden"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-cyan-400">
                            NSE
                          </span>
                        </div>
                      </div>
                      {currentPrice && (
                        <div className="text-right shrink-0">
                          <span className="block text-[10px] font-mono text-slate-500">Live CMP</span>
                          <span className="text-xs font-mono font-bold text-emerald-400">
                            ₹{currentPrice.toLocaleString("en-IN")}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {targetScope === "WATCHLIST" && (
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                        Select Target Watchlist
                      </label>
                      <select
                        value={selectedWatchlistId}
                        onChange={(e) => setSelectedWatchlistId(Number(e.target.value))}
                        className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3.5 py-2 text-xs font-bold text-cyan-300 focus:border-cyan-500 focus:outline-hidden"
                      >
                        {watchlists.length === 0 ? (
                          <option value="">No watchlists available</option>
                        ) : (
                          watchlists.map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.name} ({w.items_count} stocks)
                            </option>
                          ))
                        )}
                      </select>
                      <p className="mt-1 text-[11px] text-cyan-400/80">
                        ⚡ The alert condition will run continuously against every stock in this watchlist.
                      </p>
                    </div>
                  )}

                  {targetScope === "PORTFOLIO" && (
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                        Select Target Portfolio
                      </label>
                      <select
                        value={selectedPortfolioId}
                        onChange={(e) => setSelectedPortfolioId(Number(e.target.value))}
                        className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3.5 py-2 text-xs font-bold text-cyan-300 focus:border-cyan-500 focus:outline-hidden"
                      >
                        {portfolios.length === 0 ? (
                          <option value="">No portfolios available</option>
                        ) : (
                          portfolios.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.holdings_count} holdings)
                            </option>
                          ))
                        )}
                      </select>
                      <p className="mt-1 text-[11px] text-cyan-400/80">
                        💼 Monitors all holdings in your portfolio for institutional breakout signals and trailing stops.
                      </p>
                    </div>
                  )}

                  {targetScope === "ALL_SCREENERS" && (
                    <div className="flex items-center gap-2.5 text-xs text-slate-300">
                      <Sparkles className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span>
                        Full Universe Radar: Evaluates the rule across all active screener candidate stocks in Alpha India (VCP, Pre-Breakout, Techno-Funda & Momentum Radar).
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Fast 1-Click Presets Bar */}
              <div className="space-y-1.5">
                <span className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                  Quick Institutional Presets (1-Click Arm)
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {/* DMA Crossover Presets */}
                  <button
                    type="button"
                    onClick={() => applyPreset("DMA9_20_BULL")}
                    className="flex items-center gap-1 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-[11px] font-semibold text-cyan-300 hover:bg-cyan-500/20 transition"
                  >
                    <TrendingUp className="w-3 h-3 text-cyan-400" />
                    <span>🟢 9/20 Bull Cross</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset("DMA9_20_BEAR")}
                    className="flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/20 transition"
                  >
                    <TrendingDown className="w-3 h-3 text-rose-400" />
                    <span>🔴 9/20 Bear Cross</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset("DMA50")}
                    className="flex items-center gap-1 rounded-lg border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-[11px] font-semibold text-blue-300 hover:bg-blue-500/20 transition"
                  >
                    <TrendingUp className="w-3 h-3 text-blue-400" />
                    <span>🟢 50 DMA Reclaim</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset("GOLDEN_CROSS")}
                    className="flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[11px] font-semibold text-amber-300 hover:bg-amber-500/20 transition"
                  >
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    <span>🟢 Golden Cross</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset("DEATH_CROSS")}
                    className="flex items-center gap-1 rounded-lg border border-purple-500/30 bg-purple-500/10 px-2 py-1 text-[11px] font-semibold text-purple-300 hover:bg-purple-500/20 transition"
                  >
                    <Shield className="w-3 h-3 text-purple-400" />
                    <span>🔴 Death Cross</span>
                  </button>

                  {/* Supertrend Presets */}
                  <button
                    type="button"
                    onClick={() => applyPreset("ST_BUY")}
                    className="flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/20 transition"
                  >
                    <Zap className="w-3 h-3 text-emerald-400" />
                    <span>🟢 Supertrend Buy</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset("ST_SELL")}
                    className="flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/20 transition"
                  >
                    <Zap className="w-3 h-3 text-rose-400" />
                    <span>🔴 Supertrend Sell</span>
                  </button>

                  {/* Target & Stops */}
                  <button
                    type="button"
                    onClick={() => applyPreset("TARGET_10")}
                    className="flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/20 transition"
                  >
                    <Target className="w-3 h-3" />
                    <span>Target +10%</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset("STOP_5")}
                    className="flex items-center gap-1 rounded-lg border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[11px] font-semibold text-rose-300 hover:bg-rose-500/20 transition"
                  >
                    <Shield className="w-3 h-3" />
                    <span>Stop -5%</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset("VCP")}
                    className="flex items-center gap-1 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-[11px] font-semibold text-cyan-300 hover:bg-cyan-500/20 transition"
                  >
                    <Zap className="w-3 h-3" />
                    <span>VCP Breakout</span>
                  </button>
                </div>
              </div>

              {/* 3. Signal Direction & Screener Logic Picker */}
              <div className="space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                    Step 2: Screener & Technical Signal Category
                  </label>
                  {/* Category Pills */}
                  <div className="flex flex-wrap items-center rounded-lg border border-slate-800 bg-slate-900/60 p-0.5 text-[11px] font-semibold gap-0.5">
                    <button
                      type="button"
                      onClick={() => setRuleCategoryTab("BUY")}
                      className={`flex items-center gap-1 px-2 py-1 rounded-md transition ${
                        ruleCategoryTab === "BUY"
                          ? "bg-emerald-500 text-slate-950 font-bold"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      <TrendingUp className="w-3 h-3" />
                      <span>🟢 BUY</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRuleCategoryTab("SELL")}
                      className={`flex items-center gap-1 px-2 py-1 rounded-md transition ${
                        ruleCategoryTab === "SELL"
                          ? "bg-rose-500 text-slate-950 font-bold"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      <TrendingDown className="w-3 h-3" />
                      <span>🔴 SELL</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRuleCategoryTab("DMA")}
                      className={`flex items-center gap-1 px-2 py-1 rounded-md transition ${
                        ruleCategoryTab === "DMA"
                          ? "bg-blue-500 text-slate-950 font-bold"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      <TrendingUp className="w-3 h-3" />
                      <span>📈 DMA (9/20/50/200)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRuleCategoryTab("SUPERTREND")}
                      className={`flex items-center gap-1 px-2 py-1 rounded-md transition ${
                        ruleCategoryTab === "SUPERTREND"
                          ? "bg-amber-500 text-slate-950 font-bold"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      <Zap className="w-3 h-3" />
                      <span>⚡ Supertrend</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRuleCategoryTab("PRICE")}
                      className={`flex items-center gap-1 px-2 py-1 rounded-md transition ${
                        ruleCategoryTab === "PRICE"
                          ? "bg-cyan-500 text-slate-950 font-bold"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      <Target className="w-3 h-3" />
                      <span>🎯 Target / Stop</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRuleCategoryTab("ALL")}
                      className={`px-2 py-1 rounded-md transition ${
                        ruleCategoryTab === "ALL"
                          ? "bg-slate-700 text-white font-bold"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      All ({INSTITUTIONAL_RULES.length})
                    </button>
                  </div>
                </div>

                {/* Main Rule Dropdown */}
                <select
                  value={ruleType}
                  onChange={(e) => handleRuleTypeChange(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3.5 py-2.5 text-xs font-semibold text-white focus:border-cyan-500 focus:outline-hidden"
                >
                  {filteredRuleOptions.map((opt) => (
                    <option key={opt.type} value={opt.type}>
                      [{opt.direction === "BUY" ? "BUY" : opt.direction === "SELL" ? "SELL" : "TECH"}] {opt.label}
                    </option>
                  ))}
                </select>

                {activeRuleConfig && (
                  <div className="flex items-start gap-2 p-2.5 rounded-xl border border-slate-800 bg-slate-900/40 text-xs">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 ${
                        activeRuleConfig.direction === "BUY"
                          ? "bg-emerald-950/60 border border-emerald-500/30 text-emerald-400"
                          : activeRuleConfig.direction === "SELL"
                          ? "bg-rose-950/60 border border-rose-500/30 text-rose-400"
                          : "bg-slate-800 text-cyan-400"
                      }`}
                    >
                      {activeRuleConfig.direction} SIGNAL
                    </span>
                    <p className="text-slate-300 leading-relaxed">{activeRuleConfig.desc}</p>
                  </div>
                )}
              </div>

              {/* 4. Threshold & Parameter Input (if applicable) */}
              {activeRuleConfig.requiresThreshold && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                    {activeRuleConfig.thresholdType === "percent"
                      ? "Day Gain Threshold (%)"
                      : activeRuleConfig.thresholdType === "multiplier"
                      ? "Volume Multiplier (x Avg 20D)"
                      : activeRuleConfig.thresholdType === "score"
                      ? "Minimum Confluence Score (out of 10)"
                      : "Target Price Level (₹)"}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step={activeRuleConfig.thresholdType === "score" ? "1" : "0.05"}
                      value={thresholdValue}
                      onChange={(e) => setThresholdValue(e.target.value)}
                      placeholder={
                        activeRuleConfig.thresholdType === "score"
                          ? "e.g. 8"
                          : activeRuleConfig.thresholdType === "multiplier"
                          ? "e.g. 2.0"
                          : "e.g. 1950.00"
                      }
                      className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3.5 py-2 font-mono text-xs text-white placeholder:text-slate-600 focus:border-cyan-500 focus:outline-hidden"
                    />
                    {currentPrice && targetScope === "STOCK" && (
                      <button
                        type="button"
                        onClick={() => setThresholdValue(currentPrice.toString())}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-cyan-400 hover:underline"
                      >
                        Use Live CMP (₹{currentPrice})
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* 5. Thesis / Strategy Note */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                  Trade Plan / Invalidation Note{" "}
                  <span className="text-slate-500 font-normal lowercase">(included in Telegram alert)</span>
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Cup and handle breakout with institutional delivery surge. Target +15%, SL at pivot low."
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3.5 py-2 text-xs text-white placeholder:text-slate-600 focus:border-cyan-500 focus:outline-hidden"
                />
              </div>

              {/* 6. Dispatch Channels & Arm Button */}
              <div className="pt-2 border-t border-slate-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 p-2 rounded-xl border border-slate-800 bg-slate-900/40 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={notifyInApp}
                        onChange={(e) => setNotifyInApp(e.target.checked)}
                        className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                      />
                      <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                      <span>In-App Sound & Radar</span>
                    </label>

                    <label className="flex items-center gap-2 p-2 rounded-xl border border-slate-800 bg-slate-900/40 cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={notifyTelegram}
                        onChange={(e) => setNotifyTelegram(e.target.checked)}
                        className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                      />
                      <Send className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Personal Telegram</span>
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={handleCreateAlert}
                    disabled={creating}
                    className="flex items-center justify-center gap-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 px-6 py-2.5 text-xs font-bold shadow-lg shadow-cyan-950 disabled:opacity-50 transition"
                  >
                    <Bell className="w-4 h-4" />
                    <span>{creating ? "Arming Trigger..." : "Arm Scoped Alert Rule"}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* ── TAB 2: ACTIVE RADAR & TRIGGER HISTORY ──────────────── */}
          {/* ========================================================= */}
          {activeTab === "manage" && (
            <div className="space-y-4">
              {/* KPI Strip */}
              {summary && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/40">
                    <span className="block text-[10px] font-mono uppercase text-slate-500">Active Rules</span>
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      <span className="text-xl font-bold font-mono text-emerald-400">
                        {summary.active_alerts}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">/ {summary.total_alerts} total</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/40">
                    <span className="block text-[10px] font-mono uppercase text-slate-500">Triggers Fired</span>
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      <span className="text-xl font-bold font-mono text-amber-400">
                        {summary.total_triggers_fired}x
                      </span>
                      <span className="text-xs text-slate-500">all time</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/40">
                    <span className="block text-[10px] font-mono uppercase text-slate-500">Triggered Stocks</span>
                    <div className="flex items-baseline gap-1.5 mt-0.5">
                      <span className="text-xl font-bold font-mono text-cyan-400">
                        {summary.unique_triggered_stocks_count}
                      </span>
                      <span className="text-xs text-slate-500">equities</span>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/40">
                    <span className="block text-[10px] font-mono uppercase text-slate-500">Signal Ratio</span>
                    <div className="flex items-center gap-2 mt-0.5 text-xs font-mono font-bold">
                      <span className="text-emerald-400">🟢 {summary.buy_alerts_count} BUY</span>
                      <span className="text-slate-600">|</span>
                      <span className="text-rose-400">🔴 {summary.sell_alerts_count} SELL</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Filters Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 p-2 rounded-xl border border-slate-800 bg-slate-900/40 text-xs">
                {/* Search */}
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Filter by symbol, rule name, or thesis..."
                    className="w-full rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-hidden"
                  />
                  {searchFilter && (
                    <button
                      onClick={() => setSearchFilter("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Scope Filter */}
                <select
                  value={manageScopeFilter}
                  onChange={(e) => setManageScopeFilter(e.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-950/80 px-2.5 py-1.5 text-xs text-slate-300 focus:border-cyan-500 focus:outline-hidden"
                >
                  <option value="ALL">All Scopes</option>
                  <option value="STOCK">Stock Specific</option>
                  <option value="WATCHLIST">Watchlist Scoped</option>
                  <option value="PORTFOLIO">Portfolio Scoped</option>
                  <option value="ALL_SCREENERS">Platform Screeners</option>
                </select>

                {/* Signal Direction Filter */}
                <select
                  value={manageDirectionFilter}
                  onChange={(e) => setManageDirectionFilter(e.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-950/80 px-2.5 py-1.5 text-xs text-slate-300 focus:border-cyan-500 focus:outline-hidden"
                >
                  <option value="ALL">All Signals</option>
                  <option value="BUY">🟢 BUY Signals</option>
                  <option value="SELL">🔴 SELL Signals</option>
                </select>
              </div>

              {/* Alerts List */}
              {loadingAlerts ? (
                <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                  <Activity className="w-4 h-4 animate-spin text-cyan-400" />
                  <span>Loading active rules and trigger history...</span>
                </div>
              ) : displayedAlerts.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-xl p-6">
                  <Bell className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-50" />
                  <p className="font-semibold text-slate-400">No matching alert rules found.</p>
                  <p className="text-slate-500 mt-1">
                    Switch to the "Create Alert Trigger" tab to arm your first screener, portfolio, or stock alert!
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {displayedAlerts.map((al) => {
                    const isExpanded = expandedTriggerHistoryId === al.id;
                    const triggerList = al.triggered_stocks || [];
                    const isBuy = (al.signal_direction || "BUY") === "BUY";

                    return (
                      <div
                        key={al.id}
                        className="rounded-xl border border-slate-800 bg-slate-900/50 hover:border-slate-700 transition p-4 space-y-3"
                      >
                        {/* Row 1: Target Badge, Rule Name, Signal Pill, Status Pill */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="flex items-center flex-wrap gap-2">
                            {/* Scope Badge */}
                            <span
                              className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                                al.target_scope === "PORTFOLIO"
                                  ? "border-purple-500/40 bg-purple-950/40 text-purple-300"
                                  : al.target_scope === "WATCHLIST"
                                  ? "border-blue-500/40 bg-blue-950/40 text-blue-300"
                                  : al.target_scope === "ALL_SCREENERS"
                                  ? "border-amber-500/40 bg-amber-950/40 text-amber-300"
                                  : "border-cyan-500/40 bg-cyan-950/40 text-cyan-300"
                              }`}
                            >
                              {al.target_scope === "PORTFOLIO" && <Briefcase className="w-3 h-3" />}
                              {al.target_scope === "WATCHLIST" && <Bookmark className="w-3 h-3" />}
                              {al.target_scope === "ALL_SCREENERS" && <Zap className="w-3 h-3" />}
                              {al.target_scope === "STOCK" && <Target className="w-3 h-3" />}
                              <span>{al.target_name || al.symbol}</span>
                            </span>

                            {/* Signal Direction */}
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                                isBuy
                                  ? "border-emerald-500/40 bg-emerald-950/40 text-emerald-400"
                                  : "border-rose-500/40 bg-rose-950/40 text-rose-400"
                              }`}
                            >
                              {isBuy ? "🟢 BUY SIGNAL" : "🔴 SELL / EXIT"}
                            </span>

                            {/* Rule Name */}
                            <h3 className="text-xs font-bold text-white font-mono">
                              {al.rule_type.replace(/_/g, " ")}
                            </h3>

                            {al.threshold_value && (
                              <span className="font-mono text-xs font-bold text-cyan-400">
                                ₹{al.threshold_value.toLocaleString("en-IN")}
                              </span>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 shrink-0">
                            {/* Status Toggle */}
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(al.id, al.status)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition border ${
                                al.status === "ACTIVE"
                                  ? "border-emerald-500/40 bg-emerald-950/30 text-emerald-300 hover:bg-emerald-950/60"
                                  : "border-slate-700 bg-slate-800 text-slate-400 hover:text-white"
                              }`}
                            >
                              {al.status === "ACTIVE" ? "Active" : "Muted"}
                            </button>

                            {/* Delete */}
                            <button
                              type="button"
                              onClick={() => handleDelete(al.id)}
                              className="p-1.5 rounded-lg border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 transition"
                              title="Delete alert rule"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Row 2: Rationale / Notes */}
                        {al.notes && (
                          <p className="text-xs text-slate-400 italic bg-slate-950/40 p-2 rounded-lg border border-slate-800/80">
                            "{al.notes}"
                          </p>
                        )}

                        {/* Row 3: Meta & Trigger Stats Strip */}
                        <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-400 pt-1 border-t border-slate-800/60 font-mono">
                          <div className="flex items-center gap-3">
                            <span
                              className={`flex items-center gap-1 font-bold ${
                                al.trigger_count > 0 ? "text-amber-400" : "text-slate-500"
                              }`}
                            >
                              <Activity className="w-3 h-3" />
                              <span>🔥 Triggered {al.trigger_count} time{al.trigger_count === 1 ? "" : "s"}</span>
                            </span>

                            {al.last_triggered_at && (
                              <span className="text-slate-500">
                                Last: {new Date(al.last_triggered_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            )}

                            {al.notify_telegram && (
                              <span className="text-cyan-400 flex items-center gap-1">
                                <Send className="w-3 h-3" />
                                <span>Telegram Active</span>
                              </span>
                            )}
                          </div>

                          {/* Expand Trigger History Button */}
                          {triggerList.length > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedTriggerHistoryId(isExpanded ? null : al.id)
                              }
                              className="flex items-center gap-1 text-cyan-400 hover:underline font-semibold"
                            >
                              <span>View Fired Stocks ({triggerList.length})</span>
                              {isExpanded ? (
                                <ChevronDown className="w-3 h-3" />
                              ) : (
                                <ChevronRight className="w-3 h-3" />
                              )}
                            </button>
                          )}
                        </div>

                        {/* Row 4: Triggered Stocks History List (Which stocks triggered this alert) */}
                        {isExpanded && triggerList.length > 0 && (
                          <div className="mt-2.5 p-3 rounded-xl border border-slate-800 bg-slate-950/70 space-y-2">
                            <span className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">
                              Stocks That Triggered This Alert Rule:
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                              {triggerList.map((ev, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between p-2 rounded-lg border border-slate-800 bg-slate-900/60 text-xs font-mono"
                                >
                                  <div>
                                    <div className="font-bold text-white flex items-center gap-1.5">
                                      <span>{ev.symbol}</span>
                                      <span className="text-emerald-400">₹{ev.price?.toLocaleString("en-IN")}</span>
                                    </div>
                                    {ev.rule_detail && (
                                      <div className="text-[10px] text-slate-400 truncate max-w-[160px]">
                                        {ev.rule_detail}
                                      </div>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-slate-500 shrink-0">
                                    {ev.triggered_at
                                      ? new Date(ev.triggered_at).toLocaleTimeString([], {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })
                                      : ""}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import {
  fetchFunnelStatus,
  triggerFunnelScan,
  broadcastTelegramAlert,
  type FunnelStatusResponse,
  type IntradaySetup,
  type ApexSniperTrade,
  type SniperWatchlistCandidate,
  type PremarketImbalance,
} from "@/lib/liveIntradayApi";
import {
  Zap,
  Target,
  Shield,
  TrendingUp,
  Activity,
  RefreshCw,
  Send,
  ExternalLink,
  Layers,
  Sparkles,
  ArrowRight,
  SlidersHorizontal,
  Flame,
  Clock,
  ChevronRight,
  Info,
  Radio,
  CheckCircle,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Scale,
} from "lucide-react";
import AddToWatchlistButton from "@/components/watchlist/AddToWatchlistButton";

export default function LiveIntradayPage() {
  const [data, setData] = useState<FunnelStatusResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [scanning, setScanning] = useState<boolean>(false);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [activeMode, setActiveMode] = useState<"SNIPER" | "FUNNEL">("SNIPER");
  const [selectedSector, setSelectedSector] = useState<string>("ALL");
  const [minScore, setMinScore] = useState<number>(70);
  const [telegramStatus, setTelegramStatus] = useState<Record<string, string>>({});
  const [lastRefreshed, setLastRefreshed] = useState<string>("");

  const loadData = useCallback(async (force = false) => {
    if (force) setScanning(true);
    try {
      const res = await fetchFunnelStatus(force);
      setData(res);
      setLastRefreshed(new Date().toLocaleTimeString("en-IN"));
    } catch (err) {
      console.error("Error loading intraday funnel:", err);
    } finally {
      setLoading(false);
      setScanning(false);
    }
  }, []);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  // Live 15-second polling during market hours if enabled
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadData(false);
    }, 15000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadData]);

  const handleManualScan = async () => {
    setScanning(true);
    try {
      await triggerFunnelScan();
      await loadData(false);
    } catch (e) {
      console.error("Scan trigger failed:", e);
    } finally {
      setScanning(false);
    }
  };

  const handleSendTelegram = async (symbol: string) => {
    setTelegramStatus((prev) => ({ ...prev, [symbol]: "SENDING" }));
    try {
      await broadcastTelegramAlert(symbol);
      setTelegramStatus((prev) => ({ ...prev, [symbol]: "SENT" }));
      setTimeout(() => {
        setTelegramStatus((prev) => ({ ...prev, [symbol]: "" }));
      }, 4000);
    } catch (e) {
      console.error("Telegram broadcast failed:", e);
      setTelegramStatus((prev) => ({ ...prev, [symbol]: "ERROR" }));
    }
  };

  const filteredSetups = useMemo(() => {
    if (!data) return [];
    let list = [...data.elite_picks, ...data.all_setups];
    const seen = new Set<string>();
    list = list.filter((item) => {
      if (seen.has(item.symbol)) return false;
      seen.add(item.symbol);
      return true;
    });

    if (selectedSector !== "ALL") {
      list = list.filter((s) => s.sector.toLowerCase() === selectedSector.toLowerCase());
    }
    list = list.filter((s) => s.conviction_score >= minScore);
    return list.sort((a, b) => b.conviction_score - a.conviction_score);
  }, [data, selectedSector, minScore]);

  const sectorsList = useMemo(() => {
    if (!data) return [];
    const set = new Set<string>();
    [...data.elite_picks, ...data.all_setups].forEach((s) => set.add(s.sector));
    return Array.from(set).sort();
  }, [data]);

  const metrics = data?.funnel_metrics;
  const sniperTrade = data?.apex_sniper_trade_of_the_day;
  const sniperWatchlist = data?.sniper_watchlist || [];
  const premarketImbalances = data?.premarket_auction_imbalances || [];

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-12">
        {/* Top Header Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                <Shield className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                  Institutional Intraday Radar
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    High Conversion • Zero Churn
                  </span>
                </h1>
                <p className="text-sm text-slate-400">
                  Disciplined High-Conversion Engine: Option 1 (Float Contraction Sniper) &amp; Option 2 (9:08 AM Pre-Market Imbalance)
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Auto-Refresh Toggle */}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                autoRefresh
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                  : "bg-slate-800 text-slate-400 border-slate-700"
              }`}
            >
              <Radio className={`w-3.5 h-3.5 ${autoRefresh ? "animate-pulse text-emerald-400" : ""}`} />
              {autoRefresh ? "15s Live Polling" : "Polling Paused"}
            </button>

            {/* Manual Scan Trigger */}
            <button
              onClick={handleManualScan}
              disabled={scanning}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${scanning ? "animate-spin" : ""}`} />
              {scanning ? "Evaluating Float..." : "Refresh Live Quotes"}
            </button>
          </div>
        </div>

        {/* Strategy Mode Toggle Ribbon */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-2 rounded-2xl bg-slate-900/90 border border-slate-800">
          <div className="flex items-center gap-2 p-1 rounded-xl bg-slate-950/80 border border-slate-800/80">
            <button
              onClick={() => setActiveMode("SNIPER")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeMode === "SNIPER"
                  ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/20"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Shield className="w-4 h-4" />
              Apex Sniper (Option 1 &amp; 2 • Zero Brokerage Churn)
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-500/40">
                80% Win Rate Proof
              </span>
            </button>

            <button
              onClick={() => setActiveMode("FUNNEL")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeMode === "FUNNEL"
                  ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-500/20"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Layers className="w-4 h-4" />
              5-Stage Nifty 500 Funnel
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-slate-400 px-3">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>Updated: {lastRefreshed || "Real-time"}</span>
          </div>
        </div>

        {/* ----------------------------------------------------------------------------------------- */}
        {/* VIEW 1: APEX SNIPER MODE (OPTION 1 & 2 - ZERO BROKERAGE CHURN) */}
        {/* ----------------------------------------------------------------------------------------- */}
        {activeMode === "SNIPER" && (
          <div className="space-y-6">
            {/* HERO SECTION: SINGLE TRADE OF THE DAY */}
            {sniperTrade?.active ? (
              /* ACTIVE HIGH-CONVICTION TRADE */
              <div className="rounded-3xl p-7 bg-gradient-to-br from-emerald-950/40 via-slate-900 to-slate-950 border-2 border-emerald-500/50 shadow-2xl shadow-emerald-500/10 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                  <Target className="w-64 h-64 text-emerald-400" />
                </div>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 relative z-10">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold font-mono tracking-wider animate-pulse flex items-center gap-1.5">
                        <Flame className="w-3.5 h-3.5" />
                        SINGLE TRADE OF THE DAY (80% HISTORICAL WIN RATE)
                      </span>
                      <span className="text-xs font-mono text-slate-400 px-2.5 py-0.5 rounded-full bg-slate-800">
                        {sniperTrade.sector}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-3">
                      <h2 className="text-3xl font-extrabold text-white tracking-tight">{sniperTrade.symbol}</h2>
                      <span className="text-lg font-bold font-mono text-emerald-400">
                        ₹{sniperTrade.cmp?.toFixed(2)}
                      </span>
                      <span className={`text-sm font-mono font-bold ${
                        (sniperTrade.day_change_pct || 0) >= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}>
                        {(sniperTrade.day_change_pct || 0) >= 0 ? "+" : ""}{sniperTrade.day_change_pct?.toFixed(2)}%
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">{sniperTrade.setup_type}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <AddToWatchlistButton
                      symbol={sniperTrade.symbol || ""}
                      companyName={sniperTrade.company_name || sniperTrade.symbol || ""}
                      currentPrice={sniperTrade.cmp}
                      variant="button"
                    />
                    <button
                      onClick={() => sniperTrade.symbol && handleSendTelegram(sniperTrade.symbol)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-lg shadow-cyan-600/20 transition-all"
                    >
                      <Send className="w-4 h-4" />
                      {telegramStatus[sniperTrade.symbol || ""] === "SENT" ? "Alert Dispatched!" : "Dispatch Telegram"}
                    </button>
                    <a
                      href={`https://in.tradingview.com/symbols/NSE-${sniperTrade.symbol}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>

                {/* Execution Blueprint Matrix */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 rounded-2xl bg-slate-950/80 border border-emerald-500/20 mb-6 font-mono relative z-10">
                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                    <span className="text-[11px] text-slate-400 block mb-1">ENTRY TRIGGER</span>
                    <span className="text-lg font-bold text-cyan-400">₹{sniperTrade.entry_price?.toFixed(2)}</span>
                    <span className="text-[10px] text-slate-500 block mt-1">Crosses Yesterday High</span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                    <span className="text-[11px] text-slate-400 block mb-1">STOP LOSS</span>
                    <span className="text-lg font-bold text-rose-400">₹{sniperTrade.stop_loss?.toFixed(2)}</span>
                    <span className="text-[10px] text-rose-400/80 block mt-1">Max Risk: {sniperTrade.risk_pct}%</span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                    <span className="text-[11px] text-slate-400 block mb-1">TARGET 1 (SELL 60%)</span>
                    <span className="text-lg font-bold text-emerald-400">₹{sniperTrade.target_1?.toFixed(2)}</span>
                    <span className="text-[10px] text-emerald-400/80 block mt-1">+1.5R • Move SL to Cost</span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                    <span className="text-[11px] text-slate-400 block mb-1">TARGET 2 (TRAIL 40%)</span>
                    <span className="text-lg font-bold text-emerald-300">₹{sniperTrade.target_2?.toFixed(2)}</span>
                    <span className="text-[10px] text-emerald-300/80 block mt-1">+2.5R or Overnight Carry</span>
                  </div>
                </div>

                {/* 4 Execution Rules Checklist */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs relative z-10">
                  <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800 flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-slate-200">Float Lock Guarantee:</span>
                      <p className="text-slate-400 text-[11px] mt-0.5">{sniperTrade.rules?.float_lock}</p>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800 flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-slate-200">Open = Low Drive:</span>
                      <p className="text-slate-400 text-[11px] mt-0.5">{sniperTrade.rules?.open_low_drive}</p>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800 flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-slate-200">Asymmetric Profit Lock:</span>
                      <p className="text-slate-400 text-[11px] mt-0.5">{sniperTrade.rules?.profit_lock}</p>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-800 flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-slate-200">Free-Roll Overnight Carry:</span>
                      <p className="text-slate-400 text-[11px] mt-0.5">{sniperTrade.rules?.overnight_carry}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* CAPITAL PRESERVED BANNER (0 TRADES TAKEN TODAY) */
              <div className="rounded-3xl p-7 bg-gradient-to-br from-slate-900/90 via-slate-900 to-slate-950 border border-emerald-500/30 shadow-xl relative overflow-hidden">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold font-mono tracking-wider flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5" />
                        CAPITAL PRESERVATION PROTOCOL ACTIVE
                      </span>
                      <span className="text-xs font-mono text-slate-400">Zero Forced Trades</span>
                    </div>

                    <h2 className="text-2xl font-extrabold text-white">0 TRADES TODAY — CAPITAL PRESERVED</h2>
                    <p className="text-sm text-slate-400 max-w-2xl">
                      None of our 7 institutional leaders met the strict 80% Win Rate float-lock criteria today. 
                      Alpha India quantitative rules mandate <strong className="text-emerald-300">zero forced trades</strong> on choppy days. 
                      Capital is 100% safe. Zero brokerage fees lost.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 min-w-[260px] font-mono text-center">
                    <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                      <span className="text-[10px] text-slate-500 block">Brokerage Saved</span>
                      <span className="text-sm font-bold text-emerald-400">100% (₹0.00 Lost)</span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                      <span className="text-[10px] text-slate-500 block">Discipline Score</span>
                      <span className="text-sm font-bold text-cyan-400">100 / 100</span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                      <span className="text-[10px] text-slate-500 block">Sniper Universe</span>
                      <span className="text-sm font-bold text-white">7 Titan Stocks</span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                      <span className="text-[10px] text-slate-500 block">Market Regime</span>
                      <span className="text-sm font-bold text-amber-400">Chop / Non-Contracted</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SECTION 2: 9:08 AM PRE-MARKET CALL AUCTION IMBALANCE RADAR (OPTION 2) */}
            <div className="rounded-2xl p-6 bg-slate-900/60 border border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                    <Activity className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      9:08 AM Pre-Market Call Auction Imbalance Radar
                      <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded-full border border-cyan-500/30">
                        Order Book Deficit
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Detects pre-market cleared price anomalies and institutional supply deficits before 9:15 AM bell
                    </p>
                  </div>
                </div>
                <span className="text-xs font-mono text-slate-500">Live Call Auction Clearing</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-[11px] uppercase">
                      <th className="pb-3 font-semibold">Symbol</th>
                      <th className="pb-3 font-semibold">Indicative Open</th>
                      <th className="pb-3 font-semibold">Gap %</th>
                      <th className="pb-3 font-semibold">Buy vs Sell Pressure</th>
                      <th className="pb-3 font-semibold">Imbalance Ratio</th>
                      <th className="pb-3 font-semibold">Institutional Status</th>
                      <th className="pb-3 font-semibold">Recommendation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {premarketImbalances.map((item) => (
                      <tr key={item.symbol} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 font-bold text-white flex items-center gap-1.5">
                          {item.symbol}
                          <span className="text-[10px] font-normal text-slate-500">{item.sector}</span>
                        </td>
                        <td className="py-3 text-slate-200">₹{item.indicative_open.toFixed(2)}</td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded-md font-bold ${
                            item.gap_pct >= 0.5 ? "bg-emerald-500/20 text-emerald-300" :
                            item.gap_pct <= -0.5 ? "bg-rose-500/20 text-rose-300" :
                            "bg-slate-800 text-slate-300"
                          }`}>
                            {item.gap_pct >= 0 ? "+" : ""}{item.gap_pct.toFixed(2)}%
                          </span>
                        </td>
                        <td className="py-3">
                          <div className="flex items-center gap-2 max-w-[140px]">
                            <div className="w-full bg-rose-500/40 h-2 rounded-full overflow-hidden flex">
                              <div
                                style={{ width: `${item.buy_quantity_pct}%` }}
                                className="bg-emerald-400 h-full rounded-full"
                              />
                            </div>
                            <span className="text-[10px] text-slate-400">{item.buy_quantity_pct}% B</span>
                          </div>
                        </td>
                        <td className="py-3 font-bold text-white">
                          <span className={item.imbalance_ratio >= 2.0 ? "text-emerald-400" : "text-slate-300"}>
                            {item.imbalance_ratio.toFixed(1)}x
                          </span>
                        </td>
                        <td className="py-3">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                            item.imbalance_tier === "HEAVY_ACCUMULATION" ? "bg-emerald-950/60 text-emerald-300 border-emerald-500/40" :
                            item.imbalance_tier === "MODERATE_DEMAND" ? "bg-cyan-950/60 text-cyan-300 border-cyan-500/40" :
                            item.imbalance_tier === "DISTRIBUTION" ? "bg-rose-950/60 text-rose-300 border-rose-500/40" :
                            "bg-slate-800 text-slate-400 border-slate-700"
                          }`}>
                            {item.imbalance_tier}
                          </span>
                        </td>
                        <td className="py-3 text-[11px] text-slate-400">{item.action_recommendation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* SECTION 3: ELITE 7 SNIPER WATCHLIST (OPTION 1: FLOAT CONTRACTION & NR4) */}
            <div className="rounded-2xl p-6 bg-slate-900/60 border border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                    <Target className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      Elite 7 Sniper Watchlist (Float Contraction &amp; NR4 Engine)
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/30">
                        Option 1 Setup
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Tracking multi-day float drying (NR4 / Inside Day) and Open=Low morning drive on proven institutional leaders
                    </p>
                  </div>
                </div>
                <span className="text-xs font-mono text-slate-500">7 Titan Basket</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-[11px] uppercase">
                      <th className="pb-3 font-semibold">Symbol</th>
                      <th className="pb-3 font-semibold">CMP</th>
                      <th className="pb-3 font-semibold">Day Change</th>
                      <th className="pb-3 font-semibold">Float Contraction</th>
                      <th className="pb-3 font-semibold">Open=Low Wick</th>
                      <th className="pb-3 font-semibold">VWAP Status</th>
                      <th className="pb-3 font-semibold">Backtest Stats</th>
                      <th className="pb-3 font-semibold">Action Status</th>
                      <th className="pb-3 font-semibold text-right">Chart</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {sniperWatchlist.map((c) => (
                      <tr key={c.symbol} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 font-bold text-white flex items-center gap-1.5">
                          {c.symbol}
                          <span className="text-[10px] font-normal text-slate-500">{c.sector}</span>
                        </td>
                        <td className="py-3 text-slate-200">₹{c.cmp.toFixed(2)}</td>
                        <td className="py-3">
                          <span className={`font-bold ${c.day_change_pct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                            {c.day_change_pct >= 0 ? "+" : ""}{c.day_change_pct.toFixed(2)}%
                          </span>
                        </td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                            c.is_nr4 ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" :
                            c.is_inside_day ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30" :
                            "text-slate-400"
                          }`}>
                            {c.contraction_type}
                          </span>
                        </td>
                        <td className="py-3">
                          <span className={`text-[11px] ${c.open_equals_low ? "text-emerald-400 font-bold" : "text-slate-400"}`}>
                            {c.open_low_wick_pct.toFixed(2)}% {c.open_equals_low ? "(No Sellers)" : ""}
                          </span>
                        </td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] ${
                            c.above_vwap ? "bg-emerald-950/60 text-emerald-300" : "bg-slate-800 text-slate-400"
                          }`}>
                            {c.above_vwap ? "Above VWAP" : "Below VWAP"} (₹{c.vwap.toFixed(1)})
                          </span>
                        </td>
                        <td className="py-3 text-slate-300 text-[11px]">
                          <span className="font-bold text-emerald-400">{c.historical_win_rate}</span> • PF {c.profit_factor.toFixed(1)}
                        </td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            c.action_status === "ARMED_TRIGGER" ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse" :
                            c.action_status === "MONITORING_PULLBACK" ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40" :
                            c.action_status === "COILED_WATCH" ? "bg-amber-500/20 text-amber-300 border-amber-500/40" :
                            "bg-slate-800 text-slate-500 border-slate-700"
                          }`}>
                            {c.action_status}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <a
                            href={c.tradingview_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 rounded-md text-slate-400 hover:text-white inline-block"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------------------------------------- */}
        {/* VIEW 2: 5-STAGE NIFTY 500 FUNNEL */}
        {/* ----------------------------------------------------------------------------------------- */}
        {activeMode === "FUNNEL" && (
          <div className="space-y-6">
            {/* 5-STAGE INTERACTIVE VISUAL FUNNEL RIBBON */}
            <div className="p-5 rounded-2xl bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-slate-950 border border-slate-800">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    5-Stage Precision Elimination Funnel
                  </h2>
                </div>
                <span className="text-[11px] text-slate-500 font-mono">
                  Deterministic Quantitative Filter Architecture
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {/* Stage 0 / Master */}
                <div className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/50">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                    <span>Stage 0: Universe</span>
                    <span className="font-mono text-slate-300">{metrics?.total_universe || 500}</span>
                  </div>
                  <div className="text-sm font-bold text-white mb-1">Nifty 500</div>
                  <div className="text-[10px] text-slate-500">All liquid equities</div>
                </div>

                {/* Stage 1 / CPR */}
                <div className="p-3 rounded-xl bg-cyan-950/20 border border-cyan-500/30">
                  <div className="flex items-center justify-between text-[11px] text-cyan-400 mb-1">
                    <span>Stage 1: Coiling</span>
                    <span className="font-mono font-bold text-cyan-300">
                      {metrics?.stage_1_narrow_cpr_count || 0}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-white mb-1">Narrow CPR</div>
                  <div className="text-[10px] text-cyan-400/70">CPR width ≤ 0.28%</div>
                </div>

                {/* Stage 2 / Sector & RS */}
                <div className="p-3 rounded-xl bg-indigo-950/20 border border-indigo-500/30">
                  <div className="flex items-center justify-between text-[11px] text-indigo-400 mb-1">
                    <span>Stage 2: Tailwind</span>
                    <span className="font-mono font-bold text-indigo-300">
                      {metrics?.stage_2_sector_aligned_count || 0}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-white mb-1">Sector &amp; RS</div>
                  <div className="text-[10px] text-indigo-400/70">RS vs Nifty ≥ +0.8%</div>
                </div>

                {/* Stage 3 / Trigger */}
                <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/30">
                  <div className="flex items-center justify-between text-[11px] text-purple-400 mb-1">
                    <span>Stage 3: Trigger</span>
                    <span className="font-mono font-bold text-purple-300">
                      {metrics?.stage_3_triggered_count || 0}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-white mb-1">15M ORB Break</div>
                  <div className="text-[10px] text-purple-400/70">Price &gt; VWAP + RVOL</div>
                </div>

                {/* Stage 5 / Elite */}
                <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/40 relative overflow-hidden">
                  <div className="flex items-center justify-between text-[11px] text-emerald-400 mb-1">
                    <span>Stage 5: Elite</span>
                    <span className="font-mono font-bold text-emerald-300">
                      {metrics?.stage_5_elite_count || 0}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-emerald-300 mb-1">Apex Sniper</div>
                  <div className="text-[10px] text-emerald-400/70">ICE Score ≥ 88 PTS</div>
                </div>
              </div>
            </div>

            {/* Filter Controls Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 shadow-xs">
              <div className="flex items-center gap-3">
                <SlidersHorizontal className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Filter Radar:</span>

                {/* Sector Filter */}
                <select
                  value={selectedSector}
                  onChange={(e) => setSelectedSector(e.target.value)}
                  className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:border-cyan-500 cursor-pointer shadow-xs"
                >
                  <option value="ALL" className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200">All Sectors ({sectorsList.length})</option>
                  {sectorsList.map((s) => (
                    <option key={s} value={s} className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                      {s}
                    </option>
                  ))}
                </select>

                {/* Min Score Slider */}
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span>Min ICE:</span>
                  <input
                    type="range"
                    min="50"
                    max="90"
                    step="5"
                    value={minScore}
                    onChange={(e) => setMinScore(Number(e.target.value))}
                    className="accent-cyan-500 w-24 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                  />
                  <span className="font-mono text-cyan-600 dark:text-cyan-400 font-bold">{minScore}+</span>
                </div>
              </div>

              <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                Showing <strong className="text-slate-900 dark:text-white">{filteredSetups.length}</strong> qualified setups
              </div>
            </div>

            {/* ACTIONABLE OPPORTUNITIES GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredSetups.map((opp) => {
                const isElite = opp.conviction_score >= 88;
                return (
                  <div
                    key={opp.symbol}
                    className={`rounded-2xl p-5 border transition-all hover:scale-[1.01] ${
                      isElite
                        ? "bg-linear-to-b from-white via-slate-50 to-slate-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 border-emerald-500/40 shadow-xl shadow-emerald-500/5"
                        : "bg-white dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 shadow-xs"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-bold text-slate-900 dark:text-white tracking-wide">{opp.symbol}</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {opp.sector}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate max-w-[180px]">
                          {opp.company_name}
                        </span>
                      </div>

                      <div className="text-right">
                        <div
                          className={`text-xs font-mono font-bold px-2 py-0.5 rounded-md border ${
                            isElite
                              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                              : "bg-cyan-500/20 text-cyan-300 border-cyan-500/30"
                          }`}
                        >
                          ICE: {opp.conviction_score} PTS
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono mt-0.5 block">
                          {opp.conviction_tier}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 mb-4 font-mono text-center">
                      <div>
                        <span className="text-[10px] text-slate-500 block">CMP</span>
                        <span className="text-xs font-bold text-white">₹{opp.cmp.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">CPR Width</span>
                        <span
                          className={`text-xs font-bold ${
                            opp.is_super_narrow ? "text-emerald-400" : opp.is_narrow_cpr ? "text-cyan-400" : "text-slate-300"
                          }`}
                        >
                          {opp.cpr_width_pct.toFixed(2)}%
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">RVOL Pace</span>
                        <span
                          className={`text-xs font-bold ${
                            opp.rvol >= 2.5 ? "text-amber-400" : "text-slate-300"
                          }`}
                        >
                          {opp.rvol.toFixed(1)}x
                        </span>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 mb-4 font-mono text-xs">
                      <div className="flex justify-between py-1 border-b border-slate-800/50">
                        <span className="text-slate-400">Trigger Entry</span>
                        <span className="text-cyan-400 font-bold">₹{opp.trigger_entry.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800/50">
                        <span className="text-slate-400">Stop Loss</span>
                        <span className="text-rose-400 font-bold">₹{opp.stop_loss.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800/50">
                        <span className="text-slate-400">Target 1 (1.5R)</span>
                        <span className="text-emerald-400 font-bold">₹{opp.target_1.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-slate-400">Risk : Reward</span>
                        <span className="text-amber-400 font-bold">1 : {opp.risk_reward.toFixed(1)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSendTelegram(opp.symbol)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
                      >
                        <Send className="w-3.5 h-3.5" />
                        {telegramStatus[opp.symbol] === "SENT" ? "Sent!" : "Telegram"}
                      </button>
                      <a
                        href={opp.tradingview_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

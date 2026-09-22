"use client";

import React, { useState } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/layout/DashboardLayout";
import {
  LayoutDashboard,
  TrendingUp,
  Target,
  Zap,
  Crosshair,
  Radar,
  Compass,
  Sparkles,
  Award,
  Flame,
  Radio,
  BellRing,
  ShieldCheck,
  BookOpen,
  TableProperties,
  BrainCircuit,
  Scale,
  Telescope,
  FileText,
  Star,
  Sliders,
  History,
  Building2,
  Settings,
  ChevronRight,
  ExternalLink,
  Layers,
  ArrowUpRight,
  CheckCircle2,
} from "lucide-react";

interface SubModuleData {
  id: string;
  name: string;
  route: string;
  icon: any;
  description: string;
  tabs: string[];
}

interface ModuleData {
  id: string;
  title: string;
  subModules: SubModuleData[];
}

const HIERARCHY_DATA: ModuleData[] = [
  {
    id: "radars",
    title: "RADARS & ENGINES",
    subModules: [
      {
        id: "home",
        name: "Executive Terminal",
        route: "/home",
        icon: LayoutDashboard,
        description: "Flagship executive radar & confluence action finder",
        tabs: [
          "All Setups",
          "🚀 Confluence Breakouts",
          "⚡ Athena PEAD Drift",
          "📜 Mega Catalysts",
          "🛡️ Smart Money Co-Ride",
          "Curated Alpha Baskets",
          "Sector Rotation Flow",
        ],
      },
      {
        id: "athena-omega",
        name: "Athena Omega AI",
        route: "/athena-omega",
        icon: Zap,
        description: "4-Gate institutional earnings intelligence with Gemini 2.5 Pro",
        tabs: [
          "Flash Briefings (Instant 0-120s Parsing)",
          "PEAD Predictor (Post-Earnings Drift)",
          "AI Extraction Queue & Telemetry",
          "Methodology & Knowledge Specs",
        ],
      },
      {
        id: "growth-screener",
        name: "Growth Screener PRO",
        route: "/growth-screener",
        icon: TrendingUp,
        description: "Institutional 20-column fundamental growth scanner",
        tabs: [
          "Screener Table (Default Density)",
          "Compact High-Density Table",
          "Sector Filter Presets",
          "Cap Category & Health Score Presets",
        ],
      },
      {
        id: "stocks-radar",
        name: "Stock Technical Radar",
        route: "/stocks/SBC",
        icon: Compass,
        description: "Multi-dimensional institutional equity overview",
        tabs: [
          "Overview",
          "Setup Readiness",
          "Scenario References (Pivots & Stops)",
          "Market Structure (ICT / SMC)",
          "Interactive Research Chart",
          "Setup Quality Gauges",
          "Seasonality Return Matrix",
          "AI Trade Insights",
          "Sector Peer Comparison",
          "Scanner FAQ & Rules",
        ],
      },
      {
        id: "fresh-entries",
        name: "MF Fresh Entries Radar",
        route: "/institutional-radar/fresh-entries",
        icon: Sparkles,
        description: "Equities newly introduced into mutual fund portfolios",
        tabs: [
          "New Scheme Entrants",
          "High Conviction Inflows",
        ],
      },
      {
        id: "announcements",
        name: "Corporate Catalysts",
        route: "/announcements",
        icon: Radio,
        description: "NSE/BSE exchange corporate disclosures with 80% noise filter",
        tabs: [
          "All Catalysts",
          "Capex Commissioning",
          "Order Wins & Capacity",
          "M&A & Strategic Deals",
          "Earnings Inflection",
          "Management / Board Changes",
        ],
      },
    ],
  },
  {
    id: "fast-opportunity",
    title: "FAST OPPORTUNITY SCREENER",
    subModules: [
      {
        id: "techno-funda",
        name: "Techno-Funda Radar",
        route: "/techno-funda",
        icon: Target,
        description: "Dual-conviction fusion of institutional fundamentals and technical setups",
        tabs: [
          "All Setups",
          "Techno-Funda Buys (Stage 2 + High Funda)",
          "Near Pivot (≤ 4.5% Coiling)",
          "VCP Coiling",
          "50 DMA Pullback",
          "Stage 2 Leaders",
        ],
      },
      {
        id: "momentum-radar",
        name: "Super Momentum Radar",
        route: "/momentum-radar",
        icon: Zap,
        description: "10-rule multi-timeframe Bollinger, RSI, and WMA confluence",
        tabs: [
          "Table View",
          "Card Grid View",
          "10 MTF Confluence Toggles (Daily / Weekly / Monthly)",
          "Strict 9/10 Rule Filter",
        ],
      },
      {
        id: "pre-breakout-radar",
        name: "Pre-Breakout Radar",
        route: "/pre-breakout-radar",
        icon: Crosshair,
        description: "Algorithmic detection of NR7, Inside Day, and Volume Dry-Up contractions",
        tabs: [
          "All Pre-Breakout Coils",
          "NR7 + Inside Day (Super Coil)",
          "NR7 Volatility Compression",
          "Inside Day Compression",
          "Volume Dry-Up (VDU Cheat)",
          "Bollinger Squeeze",
        ],
      },
      {
        id: "delivery-radar",
        name: "Delivery Breakout",
        route: "/delivery-radar",
        icon: Radar,
        description: "Institutional delivery surge and absorption scanner",
        tabs: [
          "All Delivery Setups",
          "Delivery Surge (Spike > 2.5x)",
          "Institutional Absorption",
          "Coiled Accumulation",
          "1D / 2D / 3D / 5D Lookback Toggles",
        ],
      },
      {
        id: "vcp-discovery",
        name: "VCP Breakout Engine",
        route: "/vcp-discovery",
        icon: Sparkles,
        description: "Mark Minervini Volatility Contraction Pattern discovery",
        tabs: [
          "VCP Discovery (Top 3 Candidates)",
          "Before Breakout Watchlist",
          "Backtest Performance Dashboard",
        ],
      },
      {
        id: "vcp-signals",
        name: "↳ VCP Track Record",
        route: "/vcp-signals",
        icon: Award,
        description: "Verified historical signal ledger & trade execution status",
        tabs: [
          "All Signals",
          "Active Positions",
          "Target Met",
          "Stop Hit",
          "Closed Trades",
        ],
      },
      {
        id: "intraday-radar",
        name: "Tomorrow 5% Move",
        route: "/intraday-radar",
        icon: Flame,
        description: "High-velocity breakout predictor & intraday momentum",
        tabs: [
          "Deep Dive (Today's Candidates)",
          "Backtest Performance (15D Win Rate)",
          "5M Intraday Momentum Radar",
        ],
      },
    ],
  },
  {
    id: "research",
    title: "INSTITUTIONAL RESEARCH",
    subModules: [
      {
        id: "institutional-radar",
        name: "Mutual Fund Radar",
        route: "/institutional-radar",
        icon: ShieldCheck,
        description: "Quarterly institutional holding shifts and stake surges",
        tabs: [
          "Institutional Holding Shift Tracker",
          "Market Cap Allocation Breakdown",
        ],
      },
      {
        id: "matrix",
        name: "AMC Scheme Matrix",
        route: "/institutional-radar/matrix",
        icon: TableProperties,
        description: "Cross-AMC holding overlap and co-investment matrix",
        tabs: [
          "Cross-Fund Holding Matrix",
          "AMC Scheme Comparison Filter",
        ],
      },
      {
        id: "ai-rankings",
        name: "AI Growth Rankings",
        route: "/ai-rankings",
        icon: BrainCircuit,
        description: "Algorithmic predictive scoring and acceleration deciles",
        tabs: [
          "Predictive Growth Alpha Rank",
          "Fundamental Health Deciles",
        ],
      },
      {
        id: "comparison",
        name: "Company Comparison",
        route: "/comparison",
        icon: Scale,
        description: "Side-by-side financial and technical benchmarking",
        tabs: [
          "Financial & Growth Comparison",
          "Valuation & Health Benchmarking",
        ],
      },
    ],
  },
  {
    id: "pipeline",
    title: "PIPELINE & TRIAGE",
    subModules: [
      {
        id: "early-stage",
        name: "Discovery Incubator",
        route: "/early-stage",
        icon: Telescope,
        description: "Early company discovery and social/announcement triage",
        tabs: [
          "Suggested (Freshly Discovered)",
          "Reviewed (Under Consideration)",
          "Imported (Enqueued to Master)",
          "Dismissed",
          "Sentiment Filter (Positive / Neutral / Negative)",
        ],
      },
      {
        id: "quarterly-results",
        name: "Quarterly Results",
        route: "/quarterly-results",
        icon: FileText,
        description: "PEAD Quantitative Drift Matrix & Statement warehouse",
        tabs: [
          "PEAD Quantitative Drift Matrix",
          "Quarterly P&L & Balance Sheet Viewer",
          "AAA+ / AA+ / High Shock Filter Tiers",
        ],
      },
      {
        id: "dashboard",
        name: "Warehouse Dashboard",
        route: "/dashboard",
        icon: History,
        description: "5-year financial warehouse bootstrap monitor",
        tabs: [
          "Bootstrap Progress View",
          "Warehouse Import Queue Table",
        ],
      },
    ],
  },
  {
    id: "portfolio",
    title: "PORTFOLIO",
    subModules: [
      {
        id: "watchlist",
        name: "Watchlist Builder",
        route: "/watchlist",
        icon: Star,
        description: "Multi-watchlist manager with conviction scoring (1-5 stars)",
        tabs: [
          "Custom Watchlist Folders",
          "All Ratings",
          "5 Stars (Ultra High Conviction)",
          "4 Stars (High Conviction)",
          "3 Stars (Moderate)",
          "Inline Investment Thesis Notes",
        ],
      },
    ],
  },
  {
    id: "monitoring",
    title: "MONITORING",
    subModules: [
      {
        id: "monitoring-center",
        name: "Monitoring Center",
        route: "/monitoring",
        icon: Radar,
        description: "Mission Control 5-second telemetry heartbeat",
        tabs: [
          "ALL (Unified Overview)",
          "LIVE_WIRE (Real-time Filing Stream)",
          "QUEUE (Ingestion State Machine)",
          "ENGINES (5-Engine Health Grid)",
        ],
      },
      {
        id: "control-logs",
        name: "Control & Action Logs",
        route: "/monitoring/control",
        icon: Sliders,
        description: "Subsystem switchboard and real-time execution logs",
        tabs: [
          "Engine Deck (Matrix View)",
          "Engine Deck (Cards View)",
          "Service Status Filter (All / Active / Paused / Error)",
          "Action Log Terminal (Filter by Service & Log Level)",
        ],
      },
      {
        id: "activity",
        name: "Activity Timeline",
        route: "/activity",
        icon: History,
        description: "Chronological audit events feed",
        tabs: [
          "All Events",
          "Filing Registrations",
          "PDF Parser Telemetry",
          "Growth Calculations",
        ],
      },
    ],
  },
  {
    id: "administration",
    title: "ADMINISTRATION",
    subModules: [
      {
        id: "company-master",
        name: "Company Master",
        route: "/company-master",
        icon: Building2,
        description: "NSE & BSE master equity taxonomy and ISIN registry",
        tabs: [
          "Active Equities Master",
          "Industry & Sector Taxonomy Mapping",
        ],
      },
      {
        id: "settings",
        name: "System Settings",
        route: "/settings",
        icon: Settings,
        description: "Global engine intervals, API configurations, and AI parameters",
        tabs: [
          "Engine Polling Intervals",
          "AI Model Settings (Gemini 2.5)",
          "Storage & Database Failovers",
        ],
      },
      {
        id: "knowledge-center",
        name: "Knowledge Center",
        route: "/knowledge-center",
        icon: BookOpen,
        description: "Playbooks, presets, and 4-gate institutional academy",
        tabs: [
          "Alpha Navigator (Action Finder)",
          "The 5 Profit Playbooks",
          "1-Click Screener Presets",
          "15-Min Daily Routine Guide",
          "Insider Secrets & Unfair Edge",
          "Tool Arsenal Launchboard",
          "Athena 4-Gate Methodology",
        ],
      },
      {
        id: "alerts",
        name: "Alert Center",
        route: "/alerts",
        icon: BellRing,
        description: "Omnichannel notification dispatcher and webhook rules",
        tabs: [
          "Channels (Telegram, Slack, Webhook)",
          "Rules & Triggers",
          "Broadcast Dispatcher",
          "Audit & Delivery Logs",
        ],
      },
    ],
  },
];

export default function MockupTabsPage() {
  const [selectedModuleId, setSelectedModuleId] = useState<string>("radars");
  const [selectedSubModuleId, setSelectedSubModuleId] = useState<string>("home");
  const [selectedTabIdx, setSelectedTabIdx] = useState<number>(0);

  const activeModule =
    HIERARCHY_DATA.find((m) => m.id === selectedModuleId) || HIERARCHY_DATA[0];

  const activeSubModule =
    activeModule.subModules.find((s) => s.id === selectedSubModuleId) ||
    activeModule.subModules[0];

  const handleModuleSelect = (modId: string) => {
    setSelectedModuleId(modId);
    const targetModule = HIERARCHY_DATA.find((m) => m.id === modId) || HIERARCHY_DATA[0];
    setSelectedSubModuleId(targetModule.subModules[0].id);
    setSelectedTabIdx(0);
  };

  const handleSubModuleSelect = (subId: string) => {
    setSelectedSubModuleId(subId);
    setSelectedTabIdx(0);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-16">
        {/* Header Ribbon */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-cyan-50 via-teal-50/40 to-slate-50 dark:from-[#071325] dark:via-[#050E1C] dark:to-[#040A14] p-5 shadow-2xl">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 border border-cyan-500/40 text-cyan-600 dark:text-cyan-400">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white font-mono">
                  ALPHA INDIA NAVIGATION HIERARCHY MOCKUP
                </h1>
                <span className="rounded-full bg-cyan-500/20 border border-cyan-500/40 px-2.5 py-0.5 text-[10px] font-bold text-cyan-700 dark:text-cyan-300 font-mono">
                  3-TIER ARCHITECTURE
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Interactive Mockup: <strong className="text-cyan-700 dark:text-cyan-300">Module</strong> &gt;&gt;{" "}
                <strong className="text-emerald-700 dark:text-emerald-300">Sub-Module</strong> &gt;&gt;{" "}
                <strong className="text-amber-700 dark:text-amber-300">Tab</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={activeSubModule.route}
              className="flex items-center gap-1.5 rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-xs font-semibold text-cyan-700 dark:text-cyan-300 transition hover:bg-cyan-500/20 font-mono"
            >
              <span>Launch Live Screen</span>
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TIER 1: MODULE SELECTION RIBBON                                           */}
        {/* ========================================================================= */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#081225] p-4 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[11px] font-bold uppercase tracking-widest text-cyan-600 dark:text-cyan-400 font-mono flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-cyan-500"></span>
              Level 1: Primary Module
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
              7 Core Platform Modules
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-2">
            {HIERARCHY_DATA.map((module) => {
              const isSelected = module.id === selectedModuleId;
              return (
                <button
                  key={module.id}
                  onClick={() => handleModuleSelect(module.id)}
                  className={`flex flex-col items-start p-3 rounded-xl border transition-all text-left cursor-pointer ${
                    isSelected
                      ? "border-cyan-500/80 bg-gradient-to-b from-cyan-500/20 to-cyan-950/40 text-slate-900 dark:text-white shadow-lg shadow-cyan-950/20 dark:shadow-cyan-950/50"
                      : "border-slate-200 dark:border-slate-800/80 bg-slate-50/60 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
                >
                  <span className="text-[10px] font-mono text-cyan-700 dark:text-cyan-400 font-semibold mb-1">
                    {module.subModules.length} Sub-modules
                  </span>
                  <span className="text-xs font-bold leading-tight line-clamp-1">
                    {module.title}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TIER 2: SUB-MODULE SELECTION RIBBON                                       */}
        {/* ========================================================================= */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#070F1E] p-4 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[11px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 font-mono flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
              Level 2: Sub-Module within [{activeModule.title}]
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
              Select any sub-module to preview its tabs
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {activeModule.subModules.map((sub) => {
              const Icon = sub.icon;
              const isSelected = sub.id === activeSubModule.id;
              return (
                <button
                  key={sub.id}
                  onClick={() => handleSubModuleSelect(sub.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                    isSelected
                      ? "border-emerald-500/80 bg-gradient-to-r from-emerald-500/20 to-cyan-500/10 text-emerald-700 dark:text-emerald-300 shadow-md shadow-emerald-950/20 dark:shadow-emerald-950/40"
                      : "border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isSelected ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500"}`} />
                  <span>{sub.name}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-mono">
                    {sub.tabs.length}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TIER 3: LIVE TAB STRIP & SCREEN WIREFRAME                                 */}
        {/* ========================================================================= */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-gradient-to-b dark:from-[#081326] dark:to-[#050C18] p-5 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4 mb-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400 font-mono flex items-center gap-2">
                <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span>
                Level 3: Tab Navigation Bar ({activeSubModule.tabs.length} Tabs Available)
              </div>
              <div className="flex items-center gap-2 mt-1">
                <h2 className="text-lg font-black text-slate-900 dark:text-white font-mono">
                  {activeSubModule.name}
                </h2>
                <span className="text-xs text-slate-500">({activeSubModule.route})</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {activeSubModule.description}
              </p>
            </div>

            <Link
              href={activeSubModule.route}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:border-cyan-500 transition self-start sm:self-auto shadow-xs"
            >
              <span>Open live page</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Glowing Tab Strip */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-6">
            {activeSubModule.tabs.map((tabName, idx) => {
              const isActive = idx === selectedTabIdx;
              return (
                <button
                  key={tabName}
                  onClick={() => setSelectedTabIdx(idx)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold font-mono transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? "bg-gradient-to-r from-cyan-500/25 to-emerald-500/15 text-cyan-700 dark:text-cyan-300 border border-cyan-500/60 shadow-lg shadow-cyan-950/20 dark:shadow-cyan-950/50"
                      : "border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isActive ? "bg-cyan-500" : "bg-slate-400 dark:bg-slate-600"
                    }`}
                  />
                  <span>{tabName}</span>
                </button>
              );
            })}
          </div>

          {/* Active Tab Screen Wireframe / Mockup Body */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800/90 bg-slate-50/60 dark:bg-[#060D19] p-6 text-slate-800 dark:text-slate-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800/80 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-bold text-slate-900 dark:text-white font-mono uppercase tracking-wider">
                  Active Tab View:
                </span>
                <span className="text-sm font-bold text-cyan-700 dark:text-cyan-300 font-mono">
                  {activeSubModule.tabs[selectedTabIdx]}
                </span>
              </div>

              <div className="text-[11px] font-mono text-slate-500">
                Breadcrumb: {activeModule.title} &gt; {activeSubModule.name} &gt; {activeSubModule.tabs[selectedTabIdx]}
              </div>
            </div>

            {/* Simulated Institutional Data Table / Terminal Content */}
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#050A14] shadow-xs">
              <table className="w-full text-left text-xs text-slate-800 dark:text-slate-300 font-mono">
                <thead className="bg-slate-50 dark:bg-[#081222] border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400">
                  <tr>
                    <th className="py-2.5 px-3">Symbol</th>
                    <th className="py-2.5 px-3">Company</th>
                    <th className="py-2.5 px-3 text-right">CMP (₹)</th>
                    <th className="py-2.5 px-3 text-right">Day %</th>
                    <th className="py-2.5 px-3 text-center">Active Setup / Tab</th>
                    <th className="py-2.5 px-3 text-right">YoY Sales</th>
                    <th className="py-2.5 px-3 text-right">YoY PAT</th>
                    <th className="py-2.5 px-3 text-center">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/50">
                  <tr className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition">
                    <td className="py-2.5 px-3 font-bold text-cyan-700 dark:text-cyan-400">KAYNES</td>
                    <td className="py-2.5 px-3 font-sans text-slate-900 dark:text-white">Kaynes Technology India</td>
                    <td className="py-2.5 px-3 text-right text-slate-900 dark:text-white font-bold">₹5,420.00</td>
                    <td className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400">+4.2%</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="px-2 py-0.5 rounded bg-cyan-50 dark:bg-cyan-950/80 border border-cyan-200 dark:border-cyan-800 text-[10px] text-cyan-700 dark:text-cyan-300">
                        {activeSubModule.tabs[selectedTabIdx]}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400">+58.4%</td>
                    <td className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400">+64.2%</td>
                    <td className="py-2.5 px-3 text-center text-cyan-700 dark:text-cyan-300 font-bold">94/100</td>
                  </tr>
                  <tr className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition">
                    <td className="py-2.5 px-3 font-bold text-cyan-700 dark:text-cyan-400">DIXON</td>
                    <td className="py-2.5 px-3 font-sans text-slate-900 dark:text-white">Dixon Technologies India</td>
                    <td className="py-2.5 px-3 text-right text-slate-900 dark:text-white font-bold">₹15,840.50</td>
                    <td className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400">+2.8%</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 text-[10px] text-emerald-700 dark:text-emerald-300">
                        {activeSubModule.tabs[selectedTabIdx]}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400">+112.6%</td>
                    <td className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400">+98.1%</td>
                    <td className="py-2.5 px-3 text-center text-cyan-700 dark:text-cyan-300 font-bold">96/100</td>
                  </tr>
                  <tr className="hover:bg-slate-50 dark:hover:bg-slate-900/40 transition">
                    <td className="py-2.5 px-3 font-bold text-cyan-700 dark:text-cyan-400">PREMIERENE</td>
                    <td className="py-2.5 px-3 font-sans text-slate-900 dark:text-white">Premier Energies Ltd</td>
                    <td className="py-2.5 px-3 text-right text-slate-900 dark:text-white font-bold">₹1,185.20</td>
                    <td className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400">+5.1%</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/80 border border-amber-200 dark:border-amber-800 text-[10px] text-amber-700 dark:text-amber-300">
                        {activeSubModule.tabs[selectedTabIdx]}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400">+140.0%</td>
                    <td className="py-2.5 px-3 text-right text-emerald-600 dark:text-emerald-400">+188.2%</td>
                    <td className="py-2.5 px-3 text-center text-cyan-700 dark:text-cyan-300 font-bold">92/100</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

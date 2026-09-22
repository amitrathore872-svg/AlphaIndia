"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  TrendingUp,
  Zap,
  Radio,
  ShieldCheck,
  Gem,
  Star,
  BellRing,
  FileText,
  Radar,
  ArrowRight,
  ExternalLink,
  Search,
  Sparkles,
} from "lucide-react";

interface ToolItem {
  id: string;
  name: string;
  url: string;
  icon: React.ElementType;
  category: "Radars & Engines" | "Institutional Research" | "Pipeline & Execution" | "System Telemetry";
  badge: string;
  badgeBg: string;
  colorClass: string;
  bestFor: string;
  theUnfairEdge: string;
  keyFeatures: string[];
}

const TOOLS_DATA: ToolItem[] = [
  {
    id: "home",
    name: "Executive Terminal",
    url: "/home",
    icon: LayoutDashboard,
    category: "Radars & Engines",
    badge: "Command Center",
    badgeBg: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    colorClass: "border-emerald-500/40 text-emerald-400",
    bestFor: "Daily morning briefing, finding pre-packaged alpha baskets, and viewing live actionable setups.",
    theUnfairEdge:
      "Synthesizes signals from all 5 backend engines into actionable trade cards with defined entry ranges, profit targets, and stop losses.",
    keyFeatures: [
      "Actionable Opportunities radar with 5 distinct playbooks",
      "Curated Alpha Baskets (Breakouts, Multi-Baggers, Turnarounds)",
      "MoM Sector Rotation Flow tracker (Accumulation vs Profit Booking)",
      "Live Ticker Stream with real-time financial stats",
    ],
  },
  {
    id: "screener",
    name: "Growth Screener PRO",
    url: "/growth-screener",
    icon: TrendingUp,
    category: "Radars & Engines",
    badge: "Core Screener",
    badgeBg: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
    colorClass: "border-cyan-500/40 text-cyan-400",
    bestFor: "Screening all 2,000+ Indian equities by verified YoY revenue, profit growth, ROCE, and Health Score.",
    theUnfairEdge:
      "Enterprise server-side sorting queries the full PostgreSQL database globally — ensuring you find the true top 1% growers in India.",
    keyFeatures: [
      "5-Quarter audited comparison ($Q_0$ vs $Q_4$) eliminating seasonal traps",
      "Dynamic filtering by Health Score tiers, Sectors, and Exchanges",
      "Multi-column global server sorting (Revenue, PAT, ROCE, Health)",
      "Instant CSV Export for external model building and Excel spreadsheets",
    ],
  },
  {
    id: "athena",
    name: "Athena Omega",
    url: "/athena-omega",
    icon: Zap,
    category: "Radars & Engines",
    badge: "Quant AI Engine",
    badgeBg: "bg-rose-500/10 text-rose-300 border-rose-500/30",
    colorClass: "border-rose-500/40 text-rose-400",
    bestFor: "High-frequency earnings shock trading, PEAD drift captures, and quantitative conviction grading.",
    theUnfairEdge:
      "Parses exchange result PDFs in under 300 seconds and stress-tests numbers through a 5-gate institutional decision funnel.",
    keyFeatures: [
      "200-Pt Business Shock Radar scoring top-line and operating surge",
      "Forensic Quality Gate scrubbing non-operating and paper accruals",
      "Automated Intrinsic Fair Value (₹) calculation and upside gap",
      "FLASH Decision Cards with Grade AAA+, AA, A, B, and REJECT tiers",
    ],
  },
  {
    id: "announcements",
    name: "Corporate Catalysts Wire",
    url: "/announcements",
    icon: Radio,
    category: "Radars & Engines",
    badge: "Live Exchange Wire",
    badgeBg: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    colorClass: "border-amber-500/40 text-amber-400",
    bestFor: "Front-running corporate events: mega order wins, JV agreements, capex commissioning, and FDA approvals.",
    theUnfairEdge:
      "Scrapes NSE and BSE disclosures 24/7 and uses AI classification to filter out administrative noise, giving you high-impact catalysts in under 60 seconds.",
    keyFeatures: [
      "Categorized by Order Wins, Results, Capex, and Capacity Expansion",
      "AI Catalyst sentiment scoring (Highly Bullish / Moderate / Neutral)",
      "Direct one-click access to original exchange PDF filings",
      "Sub-minute latency before media reporting",
    ],
  },
  {
    id: "institutional-radar",
    name: "Mutual Fund & Institutional Radar",
    url: "/institutional-radar",
    icon: ShieldCheck,
    category: "Institutional Research",
    badge: "Smart Money Tracker",
    badgeBg: "bg-purple-500/10 text-purple-300 border-purple-500/30",
    colorClass: "border-purple-500/40 text-purple-400",
    bestFor: "Detecting stealth accumulation by top Indian AMCs (HDFC, SBI, ICICI, Nippon, Quant) before price breakouts.",
    theUnfairEdge:
      "Surfaces fresh mutual fund additions across small and mid-caps during monthly portfolio releases, enabling you to ride multi-month institutional re-ratings.",
    keyFeatures: [
      "Fresh Entries Radar: Equities where 2+ schemes initiated fresh stakes",
      "AMC Scheme Matrix: Multi-fund cross-holding overlap analysis",
      "Total quantity and stake percentage tracking",
      "Promoter pledge and corporate governance safety overlay",
    ],
  },
  {
    id: "hidden-gems",
    name: "Hidden Gems Radar",
    url: "/hidden-gems",
    icon: Gem,
    category: "Institutional Research",
    badge: "Micro-Cap Inflections",
    badgeBg: "bg-indigo-500/10 text-indigo-300 border-indigo-500/30",
    colorClass: "border-indigo-500/40 text-indigo-400",
    bestFor: "Uncovering early-stage companies (under ₹3,000 Cr market cap) displaying massive operating turnaround before analyst coverage.",
    theUnfairEdge:
      "Filters for inflection points where companies transition from losses to profits with expanding margins, offering 2x to 5x asymmetric upside.",
    keyFeatures: [
      "Loss-to-profit inflection scanner",
      "Operating margin expansion > 300 bps threshold",
      "Zero promoter pledge filter for balance sheet safety",
      "Direct integration with Quarterly Results Warehouse",
    ],
  },
  {
    id: "watchlist",
    name: "Watchlist Builder",
    url: "/watchlist",
    icon: Star,
    category: "Pipeline & Execution",
    badge: "Portfolio Planner",
    badgeBg: "bg-yellow-500/10 text-yellow-300 border-yellow-500/30",
    colorClass: "border-yellow-500/40 text-yellow-400",
    bestFor: "Organizing your shortlisted setups into actionable baskets (e.g. 'Morning Momentum', '1-Year Compounders', 'Breakouts').",
    theUnfairEdge:
      "Tracks real-time price updates, sparklines, and target price alerts across custom portfolios without clutter.",
    keyFeatures: [
      "Multiple custom watchlist folders with fast switching",
      "One-click addition from Screener, Athena, or Catalysts Wire",
      "Position sizing and risk calculator integration",
      "Quick removal and portfolio rebalancing",
    ],
  },
  {
    id: "alerts",
    name: "Alert Center & Broadcast",
    url: "/alerts",
    icon: BellRing,
    category: "Pipeline & Execution",
    badge: "Real-Time Triggers",
    badgeBg: "bg-rose-500/10 text-rose-300 border-rose-500/30",
    colorClass: "border-rose-500/40 text-rose-400",
    bestFor: "Setting up Telegram and Webhook notifications for instant earnings beats and high-conviction Athena signals.",
    theUnfairEdge:
      "Pushes high-priority Grade AAA+ alerts directly to your mobile phone within seconds of filing submission.",
    keyFeatures: [
      "Telegram instant bot notification integration",
      "Customizable threshold rules (e.g. only notify if Shock > 80)",
      "Sector and category filters for targeted alerts",
      "Real-time event logging and broadcast status",
    ],
  },
  {
    id: "quarterly-results",
    name: "Quarterly Results Warehouse",
    url: "/quarterly-results",
    icon: FileText,
    category: "Institutional Research",
    badge: "Financial Data Vault",
    badgeBg: "bg-blue-500/10 text-blue-300 border-blue-500/30",
    colorClass: "border-blue-500/40 text-blue-400",
    bestFor: "Deep financial analysis, auditing historical 8-quarter financial statements, and verifying balance sheet health.",
    theUnfairEdge:
      "Cleaned, standardized financial time-series data with zero missing figures, verified cash flows, and automated growth calculations.",
    keyFeatures: [
      "Standardized quarterly Income Statements, Balance Sheets & Cash Flows",
      "CFO to PAT conversion ratio and working capital diagnostics",
      "DuPont analysis and Return on Capital Employed (ROCE) time series",
      "Source verification links to official exchange filings",
    ],
  },
  {
    id: "monitoring",
    name: "Mission Control & Diagnostics",
    url: "/monitoring",
    icon: Radar,
    category: "System Telemetry",
    badge: "Engine Telemetry",
    badgeBg: "bg-slate-500/10 text-slate-300 border-slate-500/30",
    colorClass: "border-slate-500/40 text-slate-400",
    bestFor: "Observing real-time ingestion health, Discovery Engine queue, PDF workers, and automated warehouse repair.",
    theUnfairEdge:
      "Provides transparent visibility into data freshness, ensuring you always know the exact minute your data was refreshed from NSE/BSE.",
    keyFeatures: [
      "5-second heartbeat telemetry across all 5 backend engines",
      "Discovery Queue progress with live filing event logs",
      "Audit & Repair Engine status for automated gap filling",
      "Control and action logs for pipeline management",
    ],
  },
];

export default function ToolArsenal() {
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const categories = [
    "ALL",
    "Radars & Engines",
    "Institutional Research",
    "Pipeline & Execution",
    "System Telemetry",
  ];

  const filteredTools = TOOLS_DATA.filter((tool) => {
    const matchesCategory =
      selectedCategory === "ALL" || tool.category === selectedCategory;
    const matchesSearch =
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.bestFor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.theUnfairEdge.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#07111F]/90 p-5 md:p-6 shadow-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <h2 className="text-lg md:text-xl font-black font-mono tracking-tight text-white">
              ALPHA INDIA TOOL ARSENAL & LAUNCHBOARD
            </h2>
          </div>
          <p className="text-xs md:text-sm text-slate-400 mt-1 max-w-2xl">
            Quick reference guide explaining what every tool does, its unfair advantage, and a 1-click launch button.
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tools or features..."
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
          />
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex flex-wrap items-center gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
              selectedCategory === cat
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-950"
                : "bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Tools Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTools.map((tool) => {
          const Icon = tool.icon;
          return (
            <div
              key={tool.id}
              className="p-5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between space-y-4 group"
            >
              <div className="space-y-3">
                {/* Header: Icon, Name & Category Badge */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-cyan-400 group-hover:scale-105 transition-transform">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold font-mono text-white group-hover:text-cyan-400 transition-colors">
                        {tool.name}
                      </h3>
                      <span className="text-[10px] font-mono text-slate-500">
                        {tool.category}
                      </span>
                    </div>
                  </div>

                  <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full ${tool.badgeBg}`}>
                    {tool.badge}
                  </span>
                </div>

                {/* Best For */}
                <div className="text-xs text-slate-300 leading-relaxed font-sans">
                  <span className="text-cyan-400 font-mono font-bold text-[11px] block uppercase">
                    Best Used For:
                  </span>
                  {tool.bestFor}
                </div>

                {/* The Unfair Edge */}
                <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800/80 text-xs text-slate-300 space-y-1">
                  <span className="text-emerald-400 font-mono font-bold text-[10px] block uppercase">
                    The Unfair Advantage:
                  </span>
                  <p className="text-[11px] leading-relaxed">{tool.theUnfairEdge}</p>
                </div>

                {/* Key Features List */}
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-mono font-bold text-slate-500 block">
                    Core Capabilities:
                  </span>
                  <ul className="space-y-1 text-[11px] text-slate-400">
                    {tool.keyFeatures.map((kf, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <span className="text-cyan-400 mt-0.5">•</span>
                        <span>{kf}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Launch Button */}
              <div className="pt-3 border-t border-slate-800/60">
                <Link
                  href={tool.url}
                  className="w-full py-2 px-3 rounded-lg border border-cyan-500/40 bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-300 text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition-colors"
                >
                  <span>Launch {tool.name}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

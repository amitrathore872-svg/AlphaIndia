"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  Flame,
  Zap,
  Target,
  ShieldCheck,
  TrendingUp,
  Crosshair,
  BarChart3,
  SlidersHorizontal,
  ChevronRight,
  ArrowUpRight,
  CheckCircle2,
  Info,
  Clock,
  Search,
  Sparkles,
  Layers,
  ArrowRight,
  AlertCircle,
  Activity,
  Percent,
  Compass,
  Check,
  X,
  PlayCircle,
  Award,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";

// ============================================================================
// Types
// ============================================================================
export type GenesisStage = "STAGE_1_PINCH" | "STAGE_2_IGNITION" | "STAGE_3_ANCHOR" | "STAGE_4_MARKUP";

export interface GenesisCandidate {
  symbol: string;
  name: string;
  sector: string;
  stage: GenesisStage;
  cmp: number;
  entryPrice: number;
  stopLoss: number;
  target1: number;
  target2: number;
  riskPct: number;
  rewardRisk: string;
  potentialGainPct: number;
  deliveryPct: number;
  deliverySpikeX: number;
  ribbonSpreadPct: number;
  vduDropPct: number;
  anchorHoldingPct: number;
  institutionalBacking: {
    mfSchemesAdded: number;
    salesYoY: number;
    patYoY: number;
    roce: number;
  };
  genesisScore: number;
  ignitionDate: string;
  storyContext: string;
  isFeaturedCaseStudy?: boolean;
}

// ============================================================================
// Mock Dataset - Anchored by Welspun Living Case Study
// ============================================================================
const MOCK_GENESIS_CANDIDATES: GenesisCandidate[] = [
  {
    symbol: "WELSPUNLIV",
    name: "Welspun Living Ltd",
    sector: "Consumer & Textiles",
    stage: "STAGE_3_ANCHOR",
    cmp: 168.5,
    entryPrice: 168.0,
    stopLoss: 162.5,
    target1: 198.0,
    target2: 226.0,
    riskPct: 3.27,
    rewardRisk: "1:5.8",
    potentialGainPct: 34.5,
    deliveryPct: 68.4,
    deliverySpikeX: 4.8,
    ribbonSpreadPct: 1.8,
    vduDropPct: 64.0,
    anchorHoldingPct: 82.0,
    institutionalBacking: {
      mfSchemesAdded: 4,
      salesYoY: 18.2,
      patYoY: 34.5,
      roce: 16.8,
    },
    genesisScore: 96,
    ignitionDate: "Day 3 Post-Spike (August)",
    storyContext:
      "Exact chart archetype: 50-EMA bounce with massive 4.8x delivery volume spike, followed by 3-day quiet contraction (-64% volume) holding the upper 80% of the ignition candle. Symmetrical 1:5.8 setup before the Stage-3 pivot.",
    isFeaturedCaseStudy: true,
  },
  {
    symbol: "KAYNES",
    name: "Kaynes Technology India",
    sector: "Electronics & Defence EMS",
    stage: "STAGE_3_ANCHOR",
    cmp: 2680.0,
    entryPrice: 2710.0,
    stopLoss: 2610.0,
    target1: 3120.0,
    target2: 3480.0,
    riskPct: 3.69,
    rewardRisk: "1:5.2",
    potentialGainPct: 28.4,
    deliveryPct: 72.1,
    deliverySpikeX: 3.6,
    ribbonSpreadPct: 2.1,
    vduDropPct: 58.0,
    anchorHoldingPct: 88.0,
    institutionalBacking: {
      mfSchemesAdded: 3,
      salesYoY: 42.6,
      patYoY: 68.0,
      roce: 22.4,
    },
    genesisScore: 94,
    ignitionDate: "Day 2 Post-Spike",
    storyContext:
      "High-conviction EMS player. Massive delivery absorption near 50 EMA after 6-week horizontal base. Today is an NR7 inside day on 58% volume dry-up.",
  },
  {
    symbol: "DIXON",
    name: "Dixon Technologies",
    sector: "Consumer Electronics",
    stage: "STAGE_2_IGNITION",
    cmp: 11420.0,
    entryPrice: 11450.0,
    stopLoss: 10980.0,
    target1: 12600.0,
    target2: 13800.0,
    riskPct: 4.1,
    rewardRisk: "1:4.9",
    potentialGainPct: 20.5,
    deliveryPct: 65.8,
    deliverySpikeX: 3.9,
    ribbonSpreadPct: 1.4,
    vduDropPct: 0.0,
    anchorHoldingPct: 92.0,
    institutionalBacking: {
      mfSchemesAdded: 5,
      salesYoY: 52.0,
      patYoY: 86.0,
      roce: 28.0,
    },
    genesisScore: 91,
    ignitionDate: "Today (Day 0 Spark)",
    storyContext:
      "Day 0 ignition event: Moving averages converged to 1.4% spread. Monster volume breakout candle today with 65.8% delivery off the 21 EMA.",
  },
  {
    symbol: "HBLPOWER",
    name: "HBL Power Systems",
    sector: "Rail & Defence",
    stage: "STAGE_1_PINCH",
    cmp: 512.0,
    entryPrice: 525.0,
    stopLoss: 495.0,
    target1: 595.0,
    target2: 660.0,
    riskPct: 5.71,
    rewardRisk: "1:4.5",
    potentialGainPct: 25.7,
    deliveryPct: 54.0,
    deliverySpikeX: 1.2,
    ribbonSpreadPct: 1.1,
    vduDropPct: 71.0,
    anchorHoldingPct: 60.0,
    institutionalBacking: {
      mfSchemesAdded: 2,
      salesYoY: 31.0,
      patYoY: 54.0,
      roce: 24.5,
    },
    genesisScore: 88,
    ignitionDate: "Incubating (Day 16)",
    storyContext:
      "Tinderbox stage: Coiling in a super-tight 1.1% ribbon pinch for 16 sessions. Daily volume has dried up to 0.42x 20 DMA. Primed for ignition.",
  },
  {
    symbol: "COCHINSHIP",
    name: "Cochin Shipyard Ltd",
    sector: "Defence & Shipyards",
    stage: "STAGE_4_MARKUP",
    cmp: 1845.0,
    entryPrice: 1680.0,
    stopLoss: 1720.0,
    target1: 2050.0,
    target2: 2280.0,
    riskPct: 4.2,
    rewardRisk: "1:4.1",
    potentialGainPct: 23.6,
    deliveryPct: 61.2,
    deliverySpikeX: 3.1,
    ribbonSpreadPct: 3.8,
    vduDropPct: 45.0,
    anchorHoldingPct: 95.0,
    institutionalBacking: {
      mfSchemesAdded: 3,
      salesYoY: 48.0,
      patYoY: 72.0,
      roce: 19.5,
    },
    genesisScore: 87,
    ignitionDate: "T+8 Days Since Ignition",
    storyContext:
      "Markup wave in progress. Ignited at ₹1,680 after 48h anchor hold; now riding the 10 EMA towards primary resistance at ₹2,100.",
  },
  {
    symbol: "PNCINFRA",
    name: "PNC Infratech Ltd",
    sector: "Infrastructure & Roads",
    stage: "STAGE_3_ANCHOR",
    cmp: 462.0,
    entryPrice: 465.0,
    stopLoss: 449.0,
    target1: 525.0,
    target2: 575.0,
    riskPct: 3.44,
    rewardRisk: "1:5.1",
    potentialGainPct: 23.6,
    deliveryPct: 67.5,
    deliverySpikeX: 3.2,
    ribbonSpreadPct: 1.9,
    vduDropPct: 62.0,
    anchorHoldingPct: 84.0,
    institutionalBacking: {
      mfSchemesAdded: 2,
      salesYoY: 16.5,
      patYoY: 28.0,
      roce: 18.2,
    },
    genesisScore: 89,
    ignitionDate: "Day 2 Post-Spike",
    storyContext:
      "Textbook base coil on 50 EMA. 3.2x delivery volume spike 2 days ago, followed by low-volume consolidation above ₹455 support shelf.",
  },
];

// ============================================================================
// Component
// ============================================================================
export default function TrendGenesisRadarMockup() {
  const [selectedStage, setSelectedStage] = useState<string>("ALL");
  const [minDelivery, setMinDelivery] = useState<number>(55);
  const [minSpike, setMinSpike] = useState<number>(2.5);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCandidate, setSelectedCandidate] = useState<GenesisCandidate | null>(
    MOCK_GENESIS_CANDIDATES[0]
  );
  const [activeTab, setActiveTab] = useState<"RADAR" | "BLUEPRINT" | "CASE_STUDY">("RADAR");

  // Filtering
  const filteredCandidates = useMemo(() => {
    return MOCK_GENESIS_CANDIDATES.filter((item) => {
      if (selectedStage !== "ALL" && item.stage !== selectedStage) return false;
      if (item.deliveryPct < minDelivery && item.stage !== "STAGE_1_PINCH") return false;
      if (item.deliverySpikeX < minSpike && item.stage !== "STAGE_1_PINCH") return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.symbol.toLowerCase().includes(q) ||
          item.name.toLowerCase().includes(q) ||
          item.sector.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [selectedStage, minDelivery, minSpike, searchQuery]);

  // Stage Helpers
  const getStageBadge = (stage: GenesisStage) => {
    switch (stage) {
      case "STAGE_1_PINCH":
        return {
          title: "Phase 1: Incubation / Pinch",
          color: "border-purple-500/40 text-purple-300 bg-purple-500/10",
          desc: "Tinderbox: Moving averages coiled < 2%, volume dead",
        };
      case "STAGE_2_IGNITION":
        return {
          title: "Phase 2: Genesis Spark (Day 0)",
          color: "border-amber-500/40 text-amber-300 bg-amber-500/10",
          desc: "Ignition Bar: Delivery >60%, 3x+ Volume off 50 EMA",
        };
      case "STAGE_3_ANCHOR":
        return {
          title: "Phase 3: 48h Anchor Shelf (Cheat)",
          color: "border-emerald-500/40 text-emerald-300 bg-emerald-500/10",
          desc: "The Sweet Spot: -60% VDU, holds upper half of spike candle",
        };
      case "STAGE_4_MARKUP":
        return {
          title: "Phase 4: Early Markup Active",
          color: "border-cyan-500/40 text-cyan-300 bg-cyan-500/10",
          desc: "Moving from 50 EMA to Pivot with institutional sponsorship",
        };
    }
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-[#050B14] text-slate-100 p-4 md:p-6 space-y-6">
        {/* ==================================================================== */}
        {/* Top Header */}
        {/* ==================================================================== */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/20 via-cyan-500/10 to-transparent border border-emerald-500/30 text-emerald-400 shadow-lg shadow-emerald-500/10">
                <Flame className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                    Trend Genesis Radar
                    <span className="text-xs px-2 py-0.5 rounded-md font-mono font-semibold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      Early Ignition Engine
                    </span>
                  </h1>
                </div>
                <p className="text-xs md:text-sm text-slate-400">
                  Catching Stage-2 trends at the <span className="text-emerald-300 font-medium">ignition moment</span> off the 50-EMA base, long before the retail pivot breakout.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("RADAR")}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                activeTab === "RADAR"
                  ? "bg-emerald-500 text-black font-semibold shadow-md shadow-emerald-500/20"
                  : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
              }`}
            >
              Opportunity Grid
            </button>
            <button
              onClick={() => setActiveTab("CASE_STUDY")}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                activeTab === "CASE_STUDY"
                  ? "bg-cyan-500 text-black font-semibold shadow-md shadow-cyan-500/20"
                  : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
              }`}
            >
              Welspun Living Blueprint
            </button>
            <button
              onClick={() => setActiveTab("BLUEPRINT")}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                activeTab === "BLUEPRINT"
                  ? "bg-amber-500 text-black font-semibold shadow-md shadow-amber-500/20"
                  : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
              }`}
            >
              System Logic & Math
            </button>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* KPI Telemetry Banner */}
        {/* ==================================================================== */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Coiling Bases Monitored</span>
              <Activity className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div className="text-xl font-bold font-mono text-white">48 Stocks</div>
            <div className="text-[11px] text-purple-400 flex items-center gap-1 mt-0.5">
              <span>MA Ribbon Spread &lt; 2.5%</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Day 0 Genesis Sparks</span>
              <Zap className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-xl font-bold font-mono text-amber-300">3 Today</div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Avg Deliv: <span className="text-amber-400 font-mono">68.2%</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 backdrop-blur-sm">
            <div className="flex items-center justify-between text-emerald-400 text-xs mb-1">
              <span>48h Anchor Shelves (Sweet Spot)</span>
              <Target className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-xl font-bold font-mono text-emerald-300">4 Prime Entries</div>
            <div className="text-[11px] text-emerald-400/80 mt-0.5">
              Avg R:R: <span className="font-mono font-semibold">1:5.4</span> (Risk &lt; 3.5%)
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-sm">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>Alpha Before Pivot Breakout</span>
              <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div className="text-xl font-bold font-mono text-cyan-300">+19.8%</div>
            <div className="text-[11px] text-slate-400 mt-0.5">
              Profit locked before retail enters
            </div>
          </div>
        </div>

        {/* ==================================================================== */}
        {/* Main Content Area */}
        {/* ==================================================================== */}
        {activeTab === "RADAR" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 8 Cols: Opportunity Stream & Stage Filter */}
            <div className="lg:col-span-8 space-y-4">
              {/* Lifecycle Stage Switcher */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-2.5 flex flex-wrap gap-2 items-center justify-between">
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: "ALL", label: "All Candidates", count: MOCK_GENESIS_CANDIDATES.length },
                    { id: "STAGE_3_ANCHOR", label: "Anchor Shelves (Cheat)", count: 3, highlight: true },
                    { id: "STAGE_2_IGNITION", label: "Day 0 Sparks", count: 1 },
                    { id: "STAGE_1_PINCH", label: "Incubation Pinch", count: 1 },
                    { id: "STAGE_4_MARKUP", label: "Early Markup", count: 1 },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setSelectedStage(tab.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                        selectedStage === tab.id
                          ? tab.highlight
                            ? "bg-emerald-500 text-black font-semibold shadow-md shadow-emerald-500/20"
                            : "bg-slate-700 text-white font-semibold"
                          : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                          selectedStage === tab.id
                            ? "bg-black/30 text-white"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        {tab.count}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter symbol..."
                    className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50 w-36 md:w-44"
                  />
                </div>
              </div>

              {/* Opportunity Cards List */}
              <div className="space-y-3">
                {filteredCandidates.map((candidate) => {
                  const stageMeta = getStageBadge(candidate.stage);
                  const isSelected = selectedCandidate?.symbol === candidate.symbol;

                  return (
                    <div
                      key={candidate.symbol}
                      onClick={() => setSelectedCandidate(candidate)}
                      className={`group cursor-pointer rounded-xl p-4 transition-all border relative overflow-hidden ${
                        isSelected
                          ? "bg-slate-900 border-emerald-500/50 ring-1 ring-emerald-500/30 shadow-lg shadow-emerald-950/30"
                          : "bg-slate-900/50 border-slate-800/80 hover:bg-slate-900/80 hover:border-slate-700"
                      }`}
                    >
                      {candidate.isFeaturedCaseStudy && (
                        <div className="absolute top-0 right-0 bg-gradient-to-l from-emerald-500/30 to-transparent px-3 py-0.5 text-[10px] font-mono text-emerald-300 font-semibold border-b border-l border-emerald-500/30 rounded-bl-lg">
                          ★ Welspun Case Study Setup
                        </div>
                      )}

                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2.5">
                            <span className="text-base font-bold font-mono text-white group-hover:text-emerald-400 transition-colors">
                              {candidate.symbol}
                            </span>
                            <span className="text-xs text-slate-400 font-medium">
                              {candidate.name}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                              {candidate.sector}
                            </span>
                          </div>
                          <div className="text-xs text-slate-400 flex items-center gap-2">
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-md font-mono border ${stageMeta.color}`}
                            >
                              {stageMeta.title}
                            </span>
                            <span>• {candidate.ignitionDate}</span>
                          </div>
                        </div>

                        {/* Price & Target Ribbon */}
                        <div className="flex items-center gap-4 text-right">
                          <div>
                            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">
                              Live CMP
                            </div>
                            <div className="text-base font-bold font-mono text-white">
                              ₹{candidate.cmp.toLocaleString()}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">
                              Asymmetric R:R
                            </div>
                            <div className="text-sm font-bold font-mono text-emerald-400 flex items-center gap-1 justify-end">
                              <Crosshair className="w-3.5 h-3.5 text-emerald-400" />
                              {candidate.rewardRisk}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">
                              Upside Target
                            </div>
                            <div className="text-sm font-bold font-mono text-cyan-300">
                              +₹{(candidate.target2 - candidate.entryPrice).toFixed(1)} (+{candidate.potentialGainPct}%)
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 4 Quantitative Validation Footprints */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-3 border-t border-slate-800/60 text-xs">
                        <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/40">
                          <div className="text-[10px] text-slate-500 font-mono">1. Delivery Custody</div>
                          <div className="font-mono font-semibold text-slate-200 mt-0.5 flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-emerald-400" />
                            {candidate.deliveryPct}% ({candidate.deliverySpikeX}x Spike)
                          </div>
                        </div>

                        <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/40">
                          <div className="text-[10px] text-slate-500 font-mono">2. MA Ribbon Pinch</div>
                          <div className="font-mono font-semibold text-purple-300 mt-0.5 flex items-center gap-1">
                            <Layers className="w-3 h-3 text-purple-400" />
                            {candidate.ribbonSpreadPct}% spread (Coiled)
                          </div>
                        </div>

                        <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/40">
                          <div className="text-[10px] text-slate-500 font-mono">3. 48h Supply Dry-Up</div>
                          <div className="font-mono font-semibold text-amber-300 mt-0.5 flex items-center gap-1">
                            <TrendingUp className="w-3 h-3 text-amber-400" />
                            {candidate.vduDropPct > 0 ? `-${candidate.vduDropPct}% VDU` : "Ignition Day"}
                          </div>
                        </div>

                        <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/40">
                          <div className="text-[10px] text-slate-500 font-mono">4. Institutional Sizing</div>
                          <div className="font-mono font-semibold text-cyan-300 mt-0.5 flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-cyan-400" />
                            +{candidate.institutionalBacking.mfSchemesAdded} MF Schemes
                          </div>
                        </div>
                      </div>

                      {/* Brief rationale */}
                      <p className="text-xs text-slate-400 mt-2.5 italic">
                        "{candidate.storyContext}"
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right 4 Cols: Selected Candidate Live Execution Card */}
            <div className="lg:col-span-4 space-y-4">
              {selectedCandidate ? (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 sticky top-6 space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div>
                      <div className="text-xs text-emerald-400 font-mono font-semibold tracking-wider uppercase">
                        Execution Blueprint
                      </div>
                      <h2 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                        {selectedCandidate.symbol}
                      </h2>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-slate-400 font-mono">Genesis Score</div>
                      <div className="text-lg font-bold font-mono text-emerald-400">
                        {selectedCandidate.genesisScore} / 100
                      </div>
                    </div>
                  </div>

                  {/* Visual Setup Mechanics */}
                  <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/80 space-y-3 font-mono text-xs">
                    <div className="flex justify-between items-center text-slate-400 pb-2 border-b border-slate-900">
                      <span>Proposed Action</span>
                      <span className="text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                        BUY STOP ON HIGH BREAK
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-500">Buy Stop Trigger:</span>
                        <div className="text-white font-bold text-sm">
                          ₹{selectedCandidate.entryPrice.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-500">Tight Stop Loss:</span>
                        <div className="text-rose-400 font-bold text-sm">
                          ₹{selectedCandidate.stopLoss.toLocaleString()} (-{selectedCandidate.riskPct}%)
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-900">
                      <div>
                        <span className="text-slate-500">Target 1 (1st Shelf):</span>
                        <div className="text-cyan-300 font-bold">
                          ₹{selectedCandidate.target1.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-500">Target 2 (Pivot Ceiling):</span>
                        <div className="text-emerald-400 font-bold">
                          ₹{selectedCandidate.target2.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Institutional Catalyst Checklist */}
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono">
                      Institutional Confluence
                    </div>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex items-center justify-between p-2 rounded bg-slate-950/60 border border-slate-800/50">
                        <span className="text-slate-400">Quarterly Sales YoY</span>
                        <span className="font-mono text-emerald-400 font-semibold">
                          +{selectedCandidate.institutionalBacking.salesYoY}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded bg-slate-950/60 border border-slate-800/50">
                        <span className="text-slate-400">Quarterly PAT YoY</span>
                        <span className="font-mono text-emerald-400 font-semibold">
                          +{selectedCandidate.institutionalBacking.patYoY}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded bg-slate-950/60 border border-slate-800/50">
                        <span className="text-slate-400">ROCE Efficiency</span>
                        <span className="font-mono text-cyan-300 font-semibold">
                          {selectedCandidate.institutionalBacking.roce}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-2 rounded bg-slate-950/60 border border-slate-800/50">
                        <span className="text-slate-400">DII / Mutual Fund Buys</span>
                        <span className="font-mono text-purple-300 font-semibold">
                          +{selectedCandidate.institutionalBacking.mfSchemesAdded} Funds Entering
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-1">
                    <div className="text-xs font-semibold text-emerald-300 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-400" />
                      The "Never Look Back" Guarantee
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      By entering at the 48h Anchor Shelf, your maximum capital risk is strictly capped at{" "}
                      <span className="text-emerald-400 font-mono font-semibold">
                        {selectedCandidate.riskPct}%
                      </span>
                      . If the stock breaks below the low of the volume spike, you exit immediately with negligible damage.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-500">
                  Select a candidate to view execution plan
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* Tab 2: Welspun Living Deep-Dive Case Study */}
        {/* ==================================================================== */}
        {activeTab === "CASE_STUDY" && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <span className="text-xs font-mono uppercase font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                  Real Market Blueprint
                </span>
                <h2 className="text-xl font-bold text-white mt-1">
                  WELSPUNLIV: The August Ignition & Absorption Footprint
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  How the system captures the move at ₹162–₹168 instead of waiting for the ₹225 pivot.
                </p>
              </div>
              <div className="flex items-center gap-3 font-mono text-xs">
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <div className="text-slate-500">Pre-Pivot Gain</div>
                  <div className="text-emerald-400 font-bold text-sm">+34.5%</div>
                </div>
                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <div className="text-slate-500">Actual Drawdown</div>
                  <div className="text-white font-bold text-sm">0.8%</div>
                </div>
              </div>
            </div>

            {/* Visual Step-by-Step Flow */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 font-mono text-xs">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="text-purple-400 font-bold flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center text-[10px]">1</span>
                  July: The Incubation
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                  Stock went dormant between ₹155–₹165. 10 EMA, 20 EMA, and 50 EMA pinched to 1.8% spread. Daily volume dropped by 55% as floating supply dried up.
                </p>
                <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-900">
                  Signal: Placed on Incubation Watchlist
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="text-amber-400 font-bold flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-[10px]">2</span>
                  August: The Shock Spike
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                  The red box in your screenshot: 4.8x volume surge at the 50-EMA. Institutional block absorption occurred. Price closed in the upper 80% of range.
                </p>
                <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-900">
                  Signal: Day-0 Genesis Alert Triggered
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-emerald-500/40 ring-1 ring-emerald-500/20 space-y-2">
                <div className="text-emerald-400 font-bold flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-[10px]">3</span>
                  Day 1–3: The Anchor Shelf
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                  Volume shrank by -64% (VDU). Price held above ₹162 without retreating. Inside Day formed. This confirmed the float was 100% absorbed.
                </p>
                <div className="text-[10px] text-emerald-300 font-bold pt-1 border-t border-slate-900">
                  Action: Buy Stop ₹168 | Stop ₹162.5
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="text-cyan-400 font-bold flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-cyan-500/20 flex items-center justify-center text-[10px]">4</span>
                  Sept: The Markup Run
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed font-sans">
                  Stock launched effortlessly from ₹168 to ₹225 with zero drawdowns, because overhead supply was locked. You captured +34% before the VCP pivot!
                </p>
                <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-900">
                  Result: +34.5% Profit / 1:5.8 R:R
                </div>
              </div>
            </div>

            {/* Comparison Matrix: Naive Volume Shocker vs Trend Genesis Engine */}
            <div className="space-y-3 pt-2">
              <h3 className="text-sm font-bold text-white uppercase font-mono tracking-wider">
                Why Standard Screeners Fail vs How Trend Genesis Wins
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono border border-slate-800 rounded-xl overflow-hidden">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-3">Dimension</th>
                      <th className="p-3 text-rose-400">Ordinary "Volume Shocker"</th>
                      <th className="p-3 text-emerald-400">Alpha India "Trend Genesis"</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 bg-slate-900/60">
                    <tr>
                      <td className="p-3 text-slate-300 font-sans font-medium">When it alerts</td>
                      <td className="p-3 text-slate-400">After any random volume spike anywhere</td>
                      <td className="p-3 text-emerald-300">Only when Ribbon is pinched &lt; 2.5% at 50 EMA</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-slate-300 font-sans font-medium">False Positives</td>
                      <td className="p-3 text-rose-400">85%+ (traps in intraday pump & dumps)</td>
                      <td className="p-3 text-emerald-300">&lt; 15% (delivery &gt; 60% + 48h shelf check)</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-slate-300 font-sans font-medium">Entry Timing</td>
                      <td className="p-3 text-slate-400">Chases top of green candle (high risk)</td>
                      <td className="p-3 text-emerald-300">Buys the quiet inside day re-test (3% stop)</td>
                    </tr>
                    <tr>
                      <td className="p-3 text-slate-300 font-sans font-medium">Institutional Filter</td>
                      <td className="p-3 text-slate-400">Zero fundamental or delivery awareness</td>
                      <td className="p-3 text-emerald-300">Requires MF Accumulation &amp; High Delivery %</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* Tab 3: System Logic & Mathematical Rules */}
        {/* ==================================================================== */}
        {activeTab === "BLUEPRINT" && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-6 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                The 4-Pillar Algorithmic Definition
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Mathematical rules programmed into the Alpha India engine to identify the exact inflection point.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="text-purple-400 font-bold text-sm">Pillar 1: Base Incubation (The Coiled Spring)</div>
                <ul className="space-y-1.5 text-slate-300 list-disc list-inside">
                  <li><span className="text-white">Ribbon Spread:</span> <code className="text-purple-300">abs(EMA10 - EMA21) / EMA21 &lt;= 0.025</code></li>
                  <li><span className="text-white">50-SMA Floor:</span> <code className="text-purple-300">abs(CMP - SMA50) / SMA50 &lt;= 0.035</code></li>
                  <li><span className="text-white">Pre-Spike VDU:</span> 10-day volume average &lt; 0.65x 50-day average</li>
                </ul>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="text-amber-400 font-bold text-sm">Pillar 2: Genuine Ignition Footprint</div>
                <ul className="space-y-1.5 text-slate-300 list-disc list-inside">
                  <li><span className="text-white">Delivery Ratio:</span> <code className="text-amber-300">Delivery % &gt;= 55.0% to 70.0%</code></li>
                  <li><span className="text-white">Delivery Spike:</span> <code className="text-amber-300">Delivery Qty &gt;= 2.5x 10-day SMA</code></li>
                  <li><span className="text-white">Wick Dominance:</span> <code className="text-amber-300">(Close - Low) / (High - Low) &gt;= 0.75</code></li>
                </ul>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="text-emerald-400 font-bold text-sm">Pillar 3: The 48h Anchor Hold</div>
                <ul className="space-y-1.5 text-slate-300 list-disc list-inside">
                  <li><span className="text-white">Volume Collapse:</span> <code className="text-emerald-300">Vol(T+1) &lt;= 0.50 * Vol(T0)</code></li>
                  <li><span className="text-white">No-Giveback Shelf:</span> <code className="text-emerald-300">Low(T+1..T+3) &gt;= 50% Body of T0 Candle</code></li>
                  <li><span className="text-white">Volatility Contraction:</span> Inside Day or NR7 on Day +2 or +3</li>
                </ul>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="text-cyan-400 font-bold text-sm">Pillar 4: Institutional Fuel</div>
                <ul className="space-y-1.5 text-slate-300 list-disc list-inside">
                  <li><span className="text-white">DII / Mutual Fund:</span> &gt;= 2 new schemes added in last 2 disclosure cycles</li>
                  <li><span className="text-white">Growth Engine:</span> YoY Sales &gt; 15% OR YoY PAT &gt; 20%</li>
                  <li><span className="text-white">Clean Balance Sheet:</span> Debt-to-Equity &lt; 0.6 and Zero Promoter Pledging</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

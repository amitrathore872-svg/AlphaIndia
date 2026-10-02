"use client";

import React from "react";
import {
  Flame,
  CloudSun,
  Snowflake,
  TrendingUp,
  Activity,
  MessageSquare,
  BarChart2,
  Users,
  Eye,
  Info,
} from "lucide-react";

interface MarketSentimentRadarProps {
  symbol?: string;
  sentimentStatus?: "HOT" | "WARM" | "COLD";
  sentimentScore?: number;
  bullishPolarityPct?: number;
  bearishPolarityPct?: number;
  buzzVelocityPct?: number;
  putCallRatio?: number;
  institutionalBuzz?: string;
}

export default function MarketSentimentRadar({
  symbol = "STOCK",
  sentimentStatus = "HOT",
  sentimentScore = 88,
  bullishPolarityPct = 82,
  bearishPolarityPct = 18,
  buzzVelocityPct = 310,
  putCallRatio = 1.34,
  institutionalBuzz = "Aggressive Block Accumulation",
}: MarketSentimentRadarProps) {
  const isHot = sentimentStatus === "HOT";
  const isWarm = sentimentStatus === "WARM";

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#070F1E] p-6 shadow-xs dark:shadow-xl flex flex-col justify-between h-full">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            {isHot ? (
              <Flame size={18} className="text-orange-500 animate-pulse" />
            ) : isWarm ? (
              <CloudSun size={18} className="text-amber-500" />
            ) : (
              <Snowflake size={18} className="text-cyan-500" />
            )}
            <div>
              <div className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
                Social & Derivative Signals
              </div>
              <h3 className="text-base font-black text-slate-900 dark:text-white font-mono">
                Market Sentiment Radar
              </h3>
            </div>
          </div>

          {/* Thermometer Status Badge */}
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black font-mono border shadow-xs ${
              isHot
                ? "bg-gradient-to-r from-orange-500/10 to-rose-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30 dark:border-orange-500/40"
                : isWarm
                ? "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30"
                : "bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 border-cyan-500/30"
            }`}
          >
            {isHot ? "🔥 HOT TOPIC" : isWarm ? "⛅ WARM SETUP" : "❄️ COLD / DORMANT"}
          </span>
        </div>

        {/* Sentiment Score Gauge Bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-slate-500 dark:text-slate-400">Institutional & Retail Heat Index:</span>
            <span className="font-extrabold text-orange-600 dark:text-orange-400 text-sm">
              {sentimentScore} / 100
            </span>
          </div>
          <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div
              className={`h-full transition-all duration-700 ${
                isHot
                  ? "bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500"
                  : isWarm
                  ? "bg-gradient-to-r from-cyan-500 to-amber-500"
                  : "bg-slate-500"
              }`}
              style={{ width: `${sentimentScore}%` }}
            />
          </div>
        </div>

        {/* 4 Sentiment Pillars */}
        <div className="mt-4 grid grid-cols-2 gap-3 text-xs font-mono">
          {/* Polarity */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-3">
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-sans flex items-center gap-1 font-semibold uppercase">
              <Users size={12} className="text-cyan-500" />
              <span>Consensus Polarity</span>
            </div>
            <div className="mt-1 flex items-center justify-between font-bold">
              <span className="text-emerald-600 dark:text-emerald-400">{bullishPolarityPct}% Bull</span>
              <span className="text-rose-600 dark:text-rose-400">{bearishPolarityPct}% Bear</span>
            </div>
          </div>

          {/* Social Buzz Velocity */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-3">
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-sans flex items-center gap-1 font-semibold uppercase">
              <MessageSquare size={12} className="text-purple-500" />
              <span>Buzz Velocity</span>
            </div>
            <div className="mt-1 text-sm font-bold text-purple-600 dark:text-purple-300">
              +{buzzVelocityPct}% <span className="text-[10px] text-slate-400 font-normal">vs 7D</span>
            </div>
          </div>

          {/* Derivative PCR Ratio */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-3">
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-sans flex items-center gap-1 font-semibold uppercase">
              <BarChart2 size={12} className="text-emerald-500" />
              <span>F&O Put-Call Ratio</span>
            </div>
            <div className="mt-1 text-sm font-bold text-emerald-600 dark:text-emerald-300 flex items-center gap-1">
              <span>{putCallRatio}</span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-normal">(Bullish Bias)</span>
            </div>
          </div>

          {/* Institutional Buzz */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-3">
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-sans flex items-center gap-1 font-semibold uppercase">
              <Activity size={12} className="text-amber-500" />
              <span>Institutional Pulse</span>
            </div>
            <div className="mt-1 text-xs font-bold text-amber-600 dark:text-amber-300 truncate">
              {institutionalBuzz}
            </div>
          </div>
        </div>
      </div>

      {/* Footer Takeaway */}
      <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800/80 text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed font-sans flex items-start gap-1.5">
        <Info size={13} className="text-cyan-500 shrink-0 mt-0.5" />
        <span>
          Social media mentions and analyst upgrades for <strong className="text-slate-800 dark:text-slate-200 font-mono">{symbol}</strong> have surged 3.1x over the past week, with derivative open interest pointing to aggressive call-side accumulation.
        </span>
      </div>
    </div>
  );
}

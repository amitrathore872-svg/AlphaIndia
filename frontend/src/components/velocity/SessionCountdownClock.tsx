"use client";

import React, { useState, useEffect } from "react";
import { Clock, ShieldCheck, Sun, Moon, AlertCircle } from "lucide-react";

export default function SessionCountdownClock() {
  const [now, setNow] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Compute Indian Standard Time (IST = UTC + 5:30)
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
  const istDate = new Date(utcMs + istOffsetMs);

  const hours = istDate.getHours();
  const minutes = istDate.getMinutes();
  const seconds = istDate.getSeconds();
  const day = istDate.getDay(); // 0 is Sunday, 6 is Saturday
  const isWeekend = day === 0 || day === 6;

  const currentMinutesFromMidnight = hours * 60 + minutes;

  // Session markers (in minutes from midnight)
  const MARKET_OPEN = 9 * 60 + 15; // 09:15
  const MORNING_EXEC_END = 9 * 60 + 30; // 09:30
  const BTST_WINDOW_START = 14 * 60 + 45; // 14:45
  const BTST_PRIME_START = 15 * 60 + 15; // 15:15
  const MARKET_CLOSE = 15 * 60 + 30; // 15:30

  let sessionPhase: "PRE_MARKET" | "MORNING_HARVEST" | "MID_SESSION" | "BTST_ACCUMULATION" | "BTST_PRIME" | "POST_MARKET" = "POST_MARKET";
  let badgeText = "Market Closed";
  let countdownLabel = "";
  let targetMinutes = MARKET_OPEN;
  let isAlertTone = false;

  if (isWeekend) {
    sessionPhase = "POST_MARKET";
    badgeText = "Weekend (Market Closed)";
    countdownLabel = "Opens Monday 09:15 IST";
  } else if (currentMinutesFromMidnight < MARKET_OPEN) {
    sessionPhase = "PRE_MARKET";
    badgeText = "Pre-Market / Setup Phase";
    countdownLabel = "Opens In";
    targetMinutes = MARKET_OPEN;
  } else if (currentMinutesFromMidnight <= MORNING_EXEC_END) {
    sessionPhase = "MORNING_HARVEST";
    badgeText = "☀️ Morning Gap Harvest (9:15-9:30)";
    countdownLabel = "Gap Window Closes In";
    targetMinutes = MORNING_EXEC_END;
    isAlertTone = true;
  } else if (currentMinutesFromMidnight < BTST_WINDOW_START) {
    sessionPhase = "MID_SESSION";
    badgeText = "⚡ Live Breakout Session Active";
    countdownLabel = "BTST Window in";
    targetMinutes = BTST_PRIME_START;
  } else if (currentMinutesFromMidnight < BTST_PRIME_START) {
    sessionPhase = "BTST_ACCUMULATION";
    badgeText = "🌙 BTST Early Watch (2:45-3:15)";
    countdownLabel = "Prime Window in";
    targetMinutes = BTST_PRIME_START;
    isAlertTone = true;
  } else if (currentMinutesFromMidnight <= MARKET_CLOSE) {
    sessionPhase = "BTST_PRIME";
    badgeText = "🔥 BTST PRIME SURGE WINDOW (3:15-3:30)";
    countdownLabel = "Closing Bell in";
    targetMinutes = MARKET_CLOSE;
    isAlertTone = true;
  } else {
    sessionPhase = "POST_MARKET";
    badgeText = "Post-Market / Evening Scan";
    countdownLabel = "Opens Tomorrow 09:15";
    targetMinutes = 24 * 60 + MARKET_OPEN;
  }

  // Calculate remaining seconds
  const remainingTotalSeconds = Math.max(0, targetMinutes * 60 - (currentMinutesFromMidnight * 60 + seconds));
  const remH = Math.floor(remainingTotalSeconds / 3600);
  const remM = Math.floor((remainingTotalSeconds % 3600) / 60);
  const remS = remainingTotalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");

  const formattedTime = `${pad(hours)}:${pad(minutes)}:${pad(seconds)} IST`;

  return (
    <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-slate-800 bg-slate-900/90 px-3 py-1.5 shadow-inner">
      <div className="flex items-center gap-1.5">
        <Clock className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
        <span className="font-mono text-xs font-bold text-white">{formattedTime}</span>
      </div>

      <div className="h-3.5 w-[1px] bg-slate-800" />

      {/* Phase status badge */}
      <span
        className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-wider border ${
          sessionPhase === "BTST_PRIME"
            ? "bg-amber-500/20 text-amber-300 border-amber-500/40 animate-pulse"
            : sessionPhase === "BTST_ACCUMULATION"
            ? "bg-purple-500/20 text-purple-300 border-purple-500/40"
            : sessionPhase === "MORNING_HARVEST"
            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
            : sessionPhase === "MID_SESSION"
            ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/30"
            : "bg-slate-800 text-slate-400 border-slate-700"
        }`}
      >
        {sessionPhase === "BTST_PRIME" && <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />}
        {sessionPhase === "MORNING_HARVEST" && <Sun className="h-3 w-3 text-emerald-400" />}
        {sessionPhase === "BTST_ACCUMULATION" && <Moon className="h-3 w-3 text-purple-300" />}
        {badgeText}
      </span>

      {/* Countdown pill */}
      {countdownLabel && (
        <span className="font-mono text-[11px] text-slate-400">
          {countdownLabel}:{" "}
          <strong className="text-white">
            {remH > 0 ? `${remH}h ` : ""}
            {pad(remM)}m {pad(remS)}s
          </strong>
        </span>
      )}
    </div>
  );
}

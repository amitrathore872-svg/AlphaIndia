"use client";

import { useEffect, useState } from "react";
import { Search, Bell, Clock3, Wifi } from "lucide-react";

export default function TopHeader() {
  const [currentTime, setCurrentTime] = useState("");

  useEffect(() => {
    const updateClock = () => {
      const indiaTime = new Date().toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });

      setCurrentTime(indiaTime);
    };

    updateClock();
    const timer = setInterval(updateClock, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
      <div className="flex h-20 items-center justify-between px-6 lg:px-8">
        {/* Left */}
        <div className="flex flex-1 items-center gap-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Growth Screener</h1>
            <p className="text-sm text-slate-400">
              Discover India's fastest-growing listed companies.
            </p>
          </div>

          <div className="hidden xl:flex xl:flex-1 xl:max-w-xl">
            <div className="flex w-full items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 focus-within:border-emerald-500">
              <Search className="h-5 w-5 text-slate-400" />

              <input
                type="text"
                placeholder="Search company, symbol, sector..."
                className="w-full bg-transparent text-sm text-white placeholder:text-slate-500 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2">
            <Wifi className="h-4 w-4 text-emerald-400" />
            <span className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
              LIVE MARKET ENGINE
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2">
            <Clock3 className="h-4 w-4 text-cyan-400" />
            <span className="text-sm font-medium text-cyan-300">
              {currentTime} IST
            </span>
          </div>

          <button className="relative rounded-xl border border-slate-700 bg-slate-900 p-3 hover:border-emerald-500">
            <Bell className="h-5 w-5 text-slate-300" />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500"></span>
          </button>

          <div className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 text-sm font-bold text-white">
              A
            </div>

            <div className="hidden lg:block">
              <p className="text-sm font-semibold text-white">Amit</p>
              <p className="text-xs text-slate-400">Alpha India Admin</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
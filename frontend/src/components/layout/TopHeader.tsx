"use client";

import { useEffect, useState } from "react";
import {
  Search,
  Bell,
  Activity,
  ShieldCheck,
  Clock3,
} from "lucide-react";

export default function TopHeader() {
  const [time, setTime] = useState("");

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          timeZone: "Asia/Kolkata",
        })
      );
    };

    updateClock();

    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-800 bg-[#081225]/95 backdrop-blur-xl">
      <div className="flex items-center justify-between px-6 py-4">
        {/* LEFT */}
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-white">
              Growth Screener
            </h2>
            <p className="text-xs text-slate-400">
              Discover India's fastest-growing listed companies.
            </p>
          </div>
        </div>

        {/* CENTER SEARCH */}
        <div className="hidden w-full max-w-xl lg:block">
          <div className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900/80 px-4 py-3">
            <Search size={18} className="text-slate-500" />

            <input
              placeholder="Search company, symbol, sector..."
              className="w-full bg-transparent text-sm text-white placeholder:text-slate-500 outline-none"
            />
          </div>
        </div>

        {/* RIGHT STATUS */}
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 lg:flex">
            <Activity size={15} className="text-emerald-400" />
            <span className="text-xs font-semibold text-emerald-400">
              LIVE MARKET ENGINE
            </span>
          </div>

          <div className="hidden items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 lg:flex">
            <ShieldCheck size={15} className="text-cyan-400" />
            <span className="text-xs font-semibold text-cyan-400">
              AUDIT READY
            </span>
          </div>

          <div className="hidden items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-2 lg:flex">
            <Clock3 size={15} className="text-amber-400" />
            <span className="text-xs font-semibold text-white">
              {time} IST
            </span>
          </div>

          <button className="rounded-xl border border-slate-700 bg-slate-900 p-2 text-slate-300 hover:bg-slate-800">
            <Bell size={18} />
          </button>

          <div className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 font-bold text-black">
              A
            </div>

            <div className="hidden lg:block">
              <p className="text-sm font-semibold text-white">
                Amit
              </p>
              <p className="text-[11px] text-slate-400">
                Alpha India Admin
              </p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

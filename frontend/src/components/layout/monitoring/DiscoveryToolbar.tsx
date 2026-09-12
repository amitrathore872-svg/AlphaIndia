"use client";

// =======================================================
// Alpha India Mission Control
// Sprint 33.4 Phase 4B.1
// Discovery Queue Toolbar
// =======================================================

import { Search, RefreshCw, Filter } from "lucide-react";

interface DiscoveryToolbarProps {
  search: string;
  setSearch: (value: string) => void;
  status: string;
  setStatus: (value: string) => void;
  total: number;
  onRefresh: () => void;
}

const STATUS_OPTIONS = [
  "ALL",
  "PENDING",
  "RUNNING",
  "COMPLETED",
  "FAILED",
];

export default function DiscoveryToolbar({
  search,
  setSearch,
  status,
  setStatus,
  total,
  onRefresh,
}: DiscoveryToolbarProps) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-cyan-400">
            Discovery Queue Viewer
          </p>

          <h2 className="mt-2 text-2xl font-bold text-white">
            Company Discovery Pipeline
          </h2>

          <p className="mt-2 text-sm text-slate-400">
            Monitor quarterly filing discovery across all NSE & BSE companies.
          </p>
        </div>

        <button
          onClick={onRefresh}
          className="flex items-center justify-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm font-medium text-cyan-400 transition hover:bg-cyan-500/20"
        >
          <RefreshCw size={16} />
          Refresh Queue
        </button>
      </div>

      {/* Search + Counter */}
      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_180px]">
        <div className="relative">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
          />

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search company name or NSE symbol..."
            className="w-full rounded-xl border border-slate-700 bg-slate-950 py-3 pl-10 pr-4 text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
          />
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-950 p-3 text-center">
          <p className="text-xs uppercase tracking-wider text-slate-500">
            Total Queue
          </p>

          <p className="mt-1 text-2xl font-bold text-white">
            {total.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Status Filters */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500">
          <Filter size={15} />
          Filter
        </div>

        {STATUS_OPTIONS.map((option) => {
          const active = status === option;

          return (
            <button
              key={option}
              onClick={() => setStatus(option)}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                active
                  ? "bg-cyan-500 text-slate-950"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}
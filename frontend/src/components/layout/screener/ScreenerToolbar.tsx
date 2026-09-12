"use client";

import { Search, SlidersHorizontal, Filter } from "lucide-react";

interface Props {
  search: string;
  setSearch: (value: string) => void;
  onSearch: () => void;
}

export default function ScreenerToolbar({
  search,
  setSearch,
  onSearch,
}: Props) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">
            Growth Screener Filters
          </h2>

          <p className="text-sm text-slate-400">
            Discover companies using Alpha India's Financial Warehouse.
          </p>
        </div>

        <div className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-400">
          LIVE FILTERS
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <label className="mb-2 block text-xs uppercase tracking-widest text-slate-500">
            Company Search
          </label>

          <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-3 py-3">
            <Search size={18} className="text-slate-500" />

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSearch();
              }}
              placeholder="INFY, RELIANCE, Banking..."
              className="w-full bg-transparent text-white placeholder:text-slate-500 outline-none"
            />
          </div>
        </div>

        <Dropdown title="Sector" />
        <Dropdown title="Exchange" />
        <Dropdown title="Health Score" />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          onClick={onSearch}
          className="rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white hover:bg-emerald-700"
        >
          Search
        </button>

        <button className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 text-slate-300 hover:border-slate-600">
          <Filter size={18} />
          Audit Status
        </button>

        <button className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 text-slate-300 hover:border-slate-600">
          <SlidersHorizontal size={18} />
          Advanced Filters
        </button>
      </div>
    </section>
  );
}

function Dropdown({ title }: { title: string }) {
  return (
    <div>
      <label className="mb-2 block text-xs uppercase tracking-widest text-slate-500">
        {title}
      </label>

      <select className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-emerald-500">
        <option>All</option>
      </select>
    </div>
  );
}
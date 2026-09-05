"use client";

interface FiltersProps {
  search: string;
  setSearch: (value: string) => void;
}

export default function Filters({ search, setSearch }: FiltersProps) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <label className="block text-sm font-medium text-slate-300 mb-2">
        Search NSE Companies
      </label>

      <input
        type="text"
        value={search}
        placeholder="Search by company name or symbol (e.g. RELIANCE, TCS, BANK)..."
        onChange={(e) => setSearch(e.target.value)}
        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none"
      />

      <p className="mt-2 text-xs text-slate-500">
        Search works across all NSE listed companies.
      </p>
    </div>
  );
}
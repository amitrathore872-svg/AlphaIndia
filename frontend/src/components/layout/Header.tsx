import { Search } from 'lucide-react';

export default function Header() {
  return (
    <header className="flex items-center justify-between border-b border-slate-800 pb-5 mb-6">
      <div>
        <h2 className="text-2xl font-semibold text-white">
          Growth Screener Dashboard
        </h2>
        <p className="text-slate-400 text-sm">
          Discover India's fastest-growing companies.
        </p>
      </div>

      <div className="relative w-80">
        <Search
          className="absolute left-3 top-3 text-slate-500"
          size={18}
        />

        <input
          placeholder="Search NSE Company..."
          className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white outline-none focus:border-emerald-400"
        />
      </div>
    </header>
  );
}
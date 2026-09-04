"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { fetchQuarterlyResults } from "@/lib/api";
import { QuarterlyResult } from "@/types/result";

export default function ResultsTable() {
  const [results, setResults] = useState<QuarterlyResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [growthOnly, setGrowthOnly] = useState(false);
  const [score90Only, setScore90Only] = useState(false);

  async function loadResults() {
    try {
      const data = await fetchQuarterlyResults();
      setResults(data);
      setError("");
    } catch (err) {
      console.error(err);
      setError("Unable to connect to Alpha India API.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadResults();

    const interval = setInterval(loadResults, 5000);

    return () => clearInterval(interval);
  }, []);

  const filteredResults = useMemo(() => {
    return results.filter((stock) => {
      const matchesSearch = stock.company
        .toLowerCase()
        .includes(search.toLowerCase());

      const matchesGrowth = growthOnly
        ? stock.revenueGrowth >= 25
        : true;

      const matchesScore = score90Only
        ? stock.score >= 90
        : true;

      return matchesSearch && matchesGrowth && matchesScore;
    });
  }, [results, search, growthOnly, score90Only]);

  function getScoreBadge(score: number) {
    if (score >= 95) {
      return "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40";
    }

    if (score >= 90) {
      return "bg-lime-500/20 text-lime-400 border border-lime-500/40";
    }

    if (score >= 80) {
      return "bg-yellow-500/20 text-yellow-400 border border-yellow-500/40";
    }

    return "bg-red-500/20 text-red-400 border border-red-500/40";
  }

  if (loading) {
    return (
      <div className="py-12 text-center text-slate-400">
        Loading quarterly results...
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12 text-center text-red-400">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="relative w-full lg:w-96">
          <Search
            size={18}
            className="absolute left-3 top-3 text-slate-500"
          />

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search NSE company..."
            className="w-full bg-slate-950 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white outline-none focus:border-emerald-400"
          />
        </div>

        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => setGrowthOnly(!growthOnly)}
            className={`px-4 py-2 rounded-full text-sm transition border ${
              growthOnly
                ? "bg-emerald-500 text-black border-emerald-500"
                : "border-slate-700 text-slate-300 hover:border-emerald-400"
            }`}
          >
            Revenue ≥ 25%
          </button>

          <button
            onClick={() => setScore90Only(!score90Only)}
            className={`px-4 py-2 rounded-full text-sm transition border ${
              score90Only
                ? "bg-lime-500 text-black border-lime-500"
                : "border-slate-700 text-slate-300 hover:border-lime-400"
            }`}
          >
            AI Score ≥ 90
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-950 sticky top-0 z-10">
            <tr className="border-b border-slate-700 text-slate-400">
              <th className="text-left py-4 px-4">Company</th>
              <th className="text-left px-4">Sector</th>
              <th className="text-left px-4">Revenue</th>
              <th className="text-left px-4">PAT</th>
              <th className="text-left px-4">ROCE</th>
              <th className="text-left px-4">Market Cap</th>
              <th className="text-left px-4">AI Score</th>
            </tr>
          </thead>

          <tbody>
            {filteredResults.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="py-10 text-center text-slate-500"
                >
                  No companies match the selected filters.
                </td>
              </tr>
            ) : (
              filteredResults.map((stock) => (
                <tr
                  key={stock.company}
                  className="border-b border-slate-800 hover:bg-slate-800/70 transition"
                >
                  <td className="py-4 px-4">
                    <div>
                      <p className="font-semibold text-white">
                        {stock.company}
                      </p>
                      <p className="text-xs text-slate-500">
                        NSE Listed Company
                      </p>
                    </div>
                  </td>

                  <td className="px-4 text-slate-300">
                    {stock.sector}
                  </td>

                  <td className="px-4">
                    <span className="text-emerald-400 font-semibold">
                      ▲ {stock.revenueGrowth}%
                    </span>
                  </td>

                  <td className="px-4">
                    <span className="text-emerald-400 font-semibold">
                      ▲ {stock.patGrowth}%
                    </span>
                  </td>

                  <td className="px-4 text-white font-medium">
                    {stock.roce}%
                  </td>

                  <td className="px-4 text-slate-300">
                    {stock.marketCap}
                  </td>

                  <td className="px-4">
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${getScoreBadge(
                        stock.score
                      )}`}
                    >
                      {stock.score}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between items-center text-xs text-slate-500">
        <span>
          Showing {filteredResults.length} of {results.length} companies.
        </span>

        <span>Auto refresh every 5 seconds.</span>
      </div>
    </div>
  );
}
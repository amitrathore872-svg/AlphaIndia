"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Search, TrendingUp } from "lucide-react";
import StatCard from "@/components/cards/StatCard";
import { fetchGrowthCompanies, GrowthCompany } from "@/lib/api";

export default function GrowthTable() {
  const [companies, setCompanies] = useState<GrowthCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sector, setSector] = useState("All sectors");
  const [highGrowthOnly, setHighGrowthOnly] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  async function loadData() {
    try {
      const data = await fetchGrowthCompanies();
      setCompanies(data);
      setError("");
      setLastUpdated(new Date());
    } catch (err) {
      console.error(err);
      setError("Unable to refresh the Growth Screener. Showing the latest available data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadData(), 0);
    const timer = window.setInterval(() => void loadData(), 5000);

    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(timer);
    };
  }, []);

  const sectors = useMemo(
    () => ["All sectors", ...Array.from(new Set(companies.map((company) => company.sector))).sort()],
    [companies],
  );

  const filteredCompanies = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return companies.filter((company) => {
      const matchesSearch = [company.company, company.symbol, company.sector]
        .some((value) => value.toLowerCase().includes(normalizedSearch));
      const matchesSector = sector === "All sectors" || company.sector === sector;
      const matchesHighGrowth = !highGrowthOnly || company.growthScore >= 80;

      return matchesSearch && matchesSector && matchesHighGrowth;
    });
  }, [companies, highGrowthOnly, search, sector]);

  const averageScore = companies.length
    ? (companies.reduce((total, company) => total + company.growthScore, 0) / companies.length).toFixed(1)
    : "--";
  const topCompany = companies[0];

  if (loading) {
    return <div className="py-16 text-center text-slate-400">Loading the live Growth Dashboard...</div>;
  }

  return (
    <section className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Companies tracked" value={String(companies.length)} />
        <StatCard title="Average growth score" value={averageScore} />
        <StatCard title="Current leader" value={topCompany?.symbol ?? "--"} />
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search aria-hidden="true" className="absolute left-3 top-3 text-slate-500" size={18} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search company, symbol, or sector"
              className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2.5 pl-10 pr-4 text-sm text-white outline-none transition focus:border-emerald-400"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <select
              aria-label="Filter by sector"
              value={sector}
              onChange={(event) => setSector(event.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-emerald-400"
            >
              {sectors.map((item) => <option key={item}>{item}</option>)}
            </select>
            <button
              type="button"
              onClick={() => setHighGrowthOnly((active) => !active)}
              className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition ${
                highGrowthOnly
                  ? "border-emerald-400 bg-emerald-400 text-slate-950"
                  : "border-slate-700 text-slate-300 hover:border-emerald-400 hover:text-emerald-300"
              }`}
            >
              Score 80+
            </button>
          </div>
        </div>
      </div>

      {error && <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">{error}</p>}

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/70">
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div>
            <h3 className="font-semibold text-white">NSE Growth Radar</h3>
            <p className="mt-1 text-xs text-slate-400">{filteredCompanies.length} matching companies · Refreshes every 5 seconds</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-emerald-300"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Live</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm text-white">
            <thead className="bg-slate-950/70 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-5 py-3 text-left">Company</th>
                <th className="px-4 py-3 text-left">Sector</th>
                <th className="px-4 py-3 text-right">Revenue</th>
                <th className="px-4 py-3 text-right">PAT</th>
                <th className="px-4 py-3 text-right">ROCE</th>
                <th className="px-5 py-3 text-right">Growth score</th>
              </tr>
            </thead>
            <tbody>
              {filteredCompanies.map((company) => (
                <tr key={company.symbol} className="border-t border-slate-800 transition hover:bg-slate-800/70">
                  <td className="px-5 py-4"><p className="font-medium text-white">{company.company}</p><p className="mt-1 text-xs text-slate-500">{company.symbol} · {company.quarter}</p></td>
                  <td className="px-4 py-4 text-slate-300">{company.sector}</td>
                  <td className="px-4 py-4 text-right font-medium text-emerald-300">+{company.revenueGrowth}%</td>
                  <td className="px-4 py-4 text-right font-medium text-emerald-300">+{company.patGrowth}%</td>
                  <td className="px-4 py-4 text-right text-slate-200">{company.roce}%</td>
                  <td className="px-5 py-4 text-right"><span className="inline-flex rounded-full bg-emerald-400/15 px-3 py-1 font-semibold text-emerald-300">{company.growthScore}</span></td>
                </tr>
              ))}
              {filteredCompanies.length === 0 && <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-400">No companies match these filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs text-slate-500">
        <TrendingUp size={14} />
        {lastUpdated ? `Last updated ${lastUpdated.toLocaleTimeString()}` : "Waiting for the first update"}
        <ArrowUpRight size={14} className="ml-auto" aria-hidden="true" />
        <span>Growth Score combines revenue, PAT, ROCE, and margin signals.</span>
      </div>
    </section>
  );
}

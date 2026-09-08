"use client";

import { useEffect, useState } from "react";
import KPICards from "@/components/layout/KPICards";
import { fetchCompanies, Company } from "@/lib/api";

export default function HomePage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  // IMPORTANT: page is a NUMBER, never a string.
  const [page, setPage] = useState<number>(1);
  const [search, setSearch] = useState("");

  const [totalCompanies, setTotalCompanies] = useState(0);
  const limit = 25;

  useEffect(() => {
    loadCompanies();
  }, [page]);

  async function loadCompanies(searchValue: string = search) {
    setLoading(true);

    try {
      const data = await fetchCompanies(page, limit, searchValue);

      setCompanies(data.results);
      setTotalCompanies(data.total);
    } catch (error) {
      console.error("Failed to load companies:", error);
      setCompanies([]);
      setTotalCompanies(0);
    }

    setLoading(false);
  }

  function handleSearch() {
    setPage(1);
    loadCompanies(search);
  }

  const totalPages = Math.max(1, Math.ceil(totalCompanies / limit));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Growth Screener Dashboard
          </h1>
          <p className="text-slate-400">
            Discover India's fastest-growing companies.
          </p>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search company or symbol..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-72 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-white outline-none focus:border-emerald-500"
          />

          <button
            onClick={handleSearch}
            className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700"
          >
            Search
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <KPICards />

      {/* Companies Table */}
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
        <table className="w-full">
          <thead className="bg-slate-950 text-left text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Symbol</th>
              <th className="px-4 py-3">Exchange</th>
              <th className="px-4 py-3">Sector</th>
              <th className="px-4 py-3 text-right">Market Cap</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={5}
                  className="py-8 text-center text-slate-400"
                >
                  Loading companies...
                </td>
              </tr>
            ) : companies.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="py-8 text-center text-slate-400"
                >
                  No companies found.
                </td>
              </tr>
            ) : (
              companies.map((company) => (
                <tr
                  key={company.id}
                  className="border-t border-slate-800 hover:bg-slate-800/40"
                >
                  <td className="px-4 py-3 font-medium text-white">
                    <a
                      href={`https://www.screener.in/company/${company.symbol}/`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-cyan-400 hover:text-cyan-300 hover:underline"
                    >
                      {company.company_name}
                    </a>
                  </td>

                  <td className="px-4 py-3 text-cyan-400">
                    {company.symbol}
                  </td>

                  <td className="px-4 py-3 text-slate-300">
                    {company.exchange}
                  </td>

                  <td className="px-4 py-3 text-slate-300">
                    {company.sector}
                  </td>

                  <td className="px-4 py-3 text-right text-slate-300">
                    {company.market_cap}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="flex items-center justify-between border-t border-slate-800 px-4 py-4">
          <p className="text-sm text-slate-400">
            Showing {(page - 1) * limit + 1} –{" "}
            {Math.min(page * limit, totalCompanies)} of {totalCompanies}
          </p>

          <div className="flex items-center gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
              className="rounded-lg border border-slate-700 px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>

            <span className="rounded-lg bg-slate-800 px-3 py-2 text-white">
              {page} / {totalPages}
            </span>

            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="rounded-lg border border-slate-700 px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
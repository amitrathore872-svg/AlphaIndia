"use client";

import { Company } from "@/lib/api";
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";

interface GrowthTableProps {
  companies: Company[];
  loading: boolean;
  page: number;
  totalPages: number;
  totalCompanies: number;
  limit: number;
  onPrevious: () => void;
  onNext: () => void;
}

export default function GrowthTable({
  companies,
  loading,
  page,
  totalPages,
  totalCompanies,
  limit,
  onPrevious,
  onNext,
}: GrowthTableProps) {
  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/70 shadow-xl">
      {/* Table Header */}
      <div className="border-b border-slate-800 px-6 py-5">
        <h2 className="text-xl font-semibold text-white">
          Growth Screener Companies
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          Live NSE & BSE companies monitored by Alpha India.
        </p>
      </div>


      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-950 text-xs uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-5 py-4 text-left">Company</th>
              <th className="px-5 py-4 text-left">Symbol</th>
              <th className="px-5 py-4 text-left">Exchange</th>
              <th className="px-5 py-4 text-left">Sector</th>
              <th className="px-5 py-4 text-right">Market Cap</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-400">
                  Loading companies...
                </td>
              </tr>
            ) : companies.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-400">
                  No companies found.
                </td>
              </tr>
            ) : (
              companies.map((company) => (
                <tr
                  key={company.id}
                  className="border-t border-slate-800 transition hover:bg-slate-800/40"
                >
                  {/* Company Name */}
                  <td className="px-5 py-4">
                    <div className="flex flex-col">
                      <a
                        href={`https://www.screener.in/company/${company.symbol}/`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 font-medium text-cyan-400 hover:text-cyan-300 hover:underline"
                      >
                        {company.company_name}
                        <ExternalLink size={14} />
                      </a>

                      <span className="mt-1 text-xs text-slate-500">
                        Alpha India Coverage
                      </span>
                    </div>
                  </td>

                  {/* Symbol */}
                  <td className="px-5 py-4 font-medium text-cyan-300">
                    {company.symbol}
                  </td>

                  {/* Exchange Badge */}
                  <td className="px-5 py-4">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        company.exchange === "NSE"
                          ? "bg-emerald-500/15 text-emerald-400"
                          : company.exchange === "BSE"
                          ? "bg-blue-500/15 text-blue-400"
                          : "bg-purple-500/15 text-purple-400"
                      }`}
                    >
                      {company.exchange}
                    </span>
                  </td>

                  {/* Sector */}
                  <td className="px-5 py-4 text-slate-300">
                    {company.sector || "Unknown"}
                  </td>

                  {/* Market Cap */}
                  <td className="px-5 py-4 text-right font-medium text-slate-300">
                    {company.market_cap || "Unknown"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-800 p-5 lg:flex-row">
        <p className="text-sm text-slate-400">
          Showing {(page - 1) * limit + 1} –{" "}
          {Math.min(page * limit, totalCompanies)} of {totalCompanies} companies
        </p>

        <div className="flex items-center gap-3">
          <button
            disabled={page === 1}
            onClick={onPrevious}
            className="flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-white transition hover:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft size={16} />
            Previous
          </button>

          <div className="rounded-lg bg-slate-800 px-4 py-2 font-semibold text-white">
            Page {page} / {totalPages}
          </div>

          <button
            disabled={page >= totalPages}
            onClick={onNext}
            className="flex items-center gap-2 rounded-lg border border-slate-700 px-4 py-2 text-white transition hover:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}
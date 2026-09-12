"use client";

// =======================================================
// Alpha India Growth Screener PRO
// Sprint 33.4.1 — GAP-03
// Enterprise Server-Side Sorting Table
// =======================================================

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import type { GrowthCompany } from "@/lib/api";

interface GrowthTableProps {
  companies: GrowthCompany[];
  loading: boolean;

  page: number;
  totalPages: number;
  totalCompanies: number;
  limit: number;

  sortBy: string;
  sortOrder: "asc" | "desc";
  onSort: (column: string) => void;

  onPrevious: () => void;
  onNext: () => void;
}

// =======================================================
// Sortable Header Component
// =======================================================

function SortHeader({
  label,
  column,
  sortBy,
  sortOrder,
  onSort,
}: {
  label: string;
  column: string;
  sortBy: string;
  sortOrder: "asc" | "desc";
  onSort: (column: string) => void;
}) {
  const active = sortBy === column;

  return (
    <button
      onClick={() => onSort(column)}
      className="flex items-center gap-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-400 transition hover:text-cyan-400"
    >
      {label}

      {!active && <ArrowUpDown size={14} className="text-slate-600" />}

      {active &&
        (sortOrder === "asc" ? (
          <ArrowUp size={14} className="text-cyan-400" />
        ) : (
          <ArrowDown size={14} className="text-cyan-400" />
        ))}
    </button>
  );
}

// =======================================================
// Helpers
// =======================================================

function formatPercent(value?: number | null) {
  if (value === null || value === undefined) return "--";
  return `${value.toFixed(2)}%`;
}

function formatMarketCap(value?: number | string | null) {
  if (value === null || value === undefined || value === "") {
    return "--";
  }

  // Convert API string/decimal to number safely
  const marketCap =
    typeof value === "string" ? Number(value.replace(/,/g, "")) : Number(value);

  if (Number.isNaN(marketCap)) {
    return "--";
  }

  // Format in Indian units
  if (marketCap >= 10000000) {
    return `₹ ${(marketCap / 10000000).toFixed(2)} Cr`;
  }

  if (marketCap >= 100000) {
    return `₹ ${(marketCap / 100000).toFixed(2)} Lakh`;
  }

  return `₹ ${marketCap.toLocaleString("en-IN")}`;
}

function healthBadge(score?: number | null) {
  if (score === null || score === undefined) {
    return (
      <span className="rounded-full bg-slate-700 px-3 py-1 text-xs text-slate-300">
        --
      </span>
    );
  }

  if (score >= 90) {
    return (
      <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-400">
        {score}
      </span>
    );
  }

  if (score >= 80) {
    return (
      <span className="rounded-full bg-cyan-500/20 px-3 py-1 text-xs font-semibold text-cyan-400">
        {score}
      </span>
    );
  }

  if (score >= 70) {
    return (
      <span className="rounded-full bg-yellow-500/20 px-3 py-1 text-xs font-semibold text-yellow-400">
        {score}
      </span>
    );
  }

  return (
    <span className="rounded-full bg-red-500/20 px-3 py-1 text-xs font-semibold text-red-400">
      {score}
    </span>
  );
}

// =======================================================
// Table
// =======================================================

export default function GrowthTable({
  companies,
  loading,

  page,
  totalPages,
  totalCompanies,
  limit,

  sortBy,
  sortOrder,
  onSort,

  onPrevious,
  onNext,
}: GrowthTableProps) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-900">
      {/* Header */}

      <div className="flex flex-col gap-3 border-b border-slate-800 p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-cyan-400">
            Growth Screener PRO
          </p>

          <h2 className="mt-2 text-2xl font-bold text-white">
            Quarterly Growth Ranking
          </h2>

          <p className="mt-2 text-sm text-slate-400">
            Showing{" "}
            <span className="font-semibold text-white">
              {companies.length}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-cyan-400">
              {totalCompanies.toLocaleString()}
            </span>{" "}
            companies.
          </p>
        </div>

        <div className="rounded-full bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-400">
          Page {page} / {totalPages}
        </div>
      </div>

      {/* Table */}

      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="border-b border-slate-800 bg-slate-950/60">
            <tr className="text-left">
              <th className="px-5 py-4">
                <SortHeader
                  label="Company"
                  column="company"
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  onSort={onSort}
                />
              </th>

              <th className="px-5 py-4">
                <SortHeader
                  label="Revenue Growth"
                  column="revenue_growth"
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  onSort={onSort}
                />
              </th>

              <th className="px-5 py-4">
                <SortHeader
                  label="PAT Growth"
                  column="pat_growth"
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  onSort={onSort}
                />
              </th>

              <th className="px-5 py-4">
                <SortHeader
                  label="Market Cap"
                  column="market_cap"
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  onSort={onSort}
                />
              </th>

              <th className="px-5 py-4">
                <SortHeader
                  label="Health Score"
                  column="health_score"
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  onSort={onSort}
                />
              </th>

              <th className="px-5 py-4">Sector</th>
              <th className="px-5 py-4">Exchange</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={7}
                  className="py-14 text-center text-slate-400"
                >
                  Loading Growth Screener...
                </td>
              </tr>
            ) : companies.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="py-14 text-center text-slate-500"
                >
                  No companies found.
                </td>
              </tr>
            ) : (
              companies.map((company) => (
                <tr
                  key={company.symbol}
                  className="border-b border-slate-800/50 transition hover:bg-slate-800/30"
                >
                  <td className="px-5 py-4">
                    <div>
                      <div className="font-semibold text-white">
                        {company.company}
                      </div>

                      <div className="mt-1 text-xs text-slate-500">
                        {company.symbol}
                      </div>
                    </div>
                  </td>

                  <td className="px-5 py-4 font-medium text-emerald-400">
                    {formatPercent(company.revenue_growth)}
                  </td>

                  <td className="px-5 py-4 font-medium text-cyan-400">
                    {formatPercent(company.pat_growth)}
                  </td>

                  <td className="px-5 py-4 text-slate-300">
                    {formatMarketCap(company.market_cap)}
                  </td>

                  <td className="px-5 py-4">
                    {healthBadge(company.health_score)}
                  </td>

                  <td className="px-5 py-4 text-slate-300">
                    {company.sector || "--"}
                  </td>

                  <td className="px-5 py-4 text-slate-400">
                    {company.exchange || "--"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Pagination */}

      <div className="flex flex-col gap-4 border-t border-slate-800 p-6 md:flex-row md:items-center md:justify-between">
        <p className="text-sm text-slate-400">
          Showing{" "}
          <span className="font-semibold text-white">
            {(page - 1) * limit + 1}
          </span>{" "}
          –
          <span className="font-semibold text-white">
            {Math.min(page * limit, totalCompanies)}
          </span>{" "}
          of{" "}
          <span className="font-semibold text-cyan-400">
            {totalCompanies.toLocaleString()}
          </span>
        </p>

        <div className="flex gap-3">
          <button
            onClick={onPrevious}
            disabled={page === 1}
            className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-cyan-400 hover:text-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>

          <button
            onClick={onNext}
            disabled={page === totalPages}
            className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
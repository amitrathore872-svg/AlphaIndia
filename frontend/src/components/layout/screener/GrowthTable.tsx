"use client";

// =======================================================
// Alpha India Growth Screener PRO
// Sprint 32.8.1
// Bloomberg Style Table + Sorting + Sticky Header
// =======================================================

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import type { GrowthCompany } from "@/lib/api";

import GrowthTableHeader, {
  SortField,
} from "./GrowthTableHeader";
import GrowthTableRow from "./GrowthTableRow";

interface GrowthTableProps {
  companies: GrowthCompany[];
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
  const [sortField, setSortField] =
    useState<SortField>("ai_score");

  const [sortDirection, setSortDirection] = useState<
    "asc" | "desc"
  >("desc");

  function handleSort(field: SortField) {
    if (field === sortField) {
      setSortDirection((prev) =>
        prev === "asc" ? "desc" : "asc"
      );
      return;
    }

    setSortField(field);
    setSortDirection("desc");
  }

  const sortedCompanies = useMemo(() => {
    const data = [...companies];

    data.sort((a: any, b: any) => {
      let valueA = a[sortField];
      let valueB = b[sortField];

      if (sortField === "company" || sortField === "sector") {
        valueA = String(valueA || "").toLowerCase();
        valueB = String(valueB || "").toLowerCase();

        return sortDirection === "asc"
          ? valueA.localeCompare(valueB)
          : valueB.localeCompare(valueA);
      }

      valueA = Number(valueA ?? 0);
      valueB = Number(valueB ?? 0);

      return sortDirection === "asc"
        ? valueA - valueB
        : valueB - valueA;
    });

    return data;
  }, [companies, sortField, sortDirection]);

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-950 overflow-hidden shadow-2xl">

      {/* Header */}
      <div className="border-b border-slate-800 bg-gradient-to-r from-slate-900 to-slate-950 px-6 py-5">

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

          <div>
            <h2 className="text-2xl font-bold text-white">
              Growth Screener PRO
            </h2>

            <p className="mt-1 text-sm text-slate-400">
              AI-powered ranking of India's fastest growing listed companies.
            </p>
          </div>

          <div className="flex items-center gap-6 text-sm">

            <div>
              <p className="text-slate-500 uppercase text-xs">
                Total Companies
              </p>

              <p className="text-xl font-bold text-emerald-400">
                {totalCompanies.toLocaleString()}
              </p>
            </div>

            <div>
              <p className="text-slate-500 uppercase text-xs">
                Page
              </p>

              <p className="text-xl font-bold text-cyan-400">
                {page} / {totalPages}
              </p>
            </div>

          </div>

        </div>

      </div>

      {/* Scrollable Table */}
      <div className="overflow-x-auto">

        <div className="max-h-[700px] overflow-y-auto">

          <table className="w-full min-w-[1250px] border-collapse">

            <GrowthTableHeader
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={handleSort}
            />

            <tbody>

              {loading ? (
                Array.from({ length: 12 }).map((_, index) => (
                  <tr
                    key={index}
                    className="border-b border-slate-800 animate-pulse"
                  >
                    {Array.from({ length: 9 }).map((_, cell) => (
                      <td key={cell} className="px-4 py-5">
                        <div className="h-4 rounded bg-slate-800" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : sortedCompanies.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="py-16 text-center text-slate-500"
                  >
                    No companies found.
                  </td>
                </tr>
              ) : (
                sortedCompanies.map((company, index) => (
                  <GrowthTableRow
                    key={company.id ?? company.symbol}
                    company={company}
                    index={(page - 1) * limit + index}
                  />
                ))
              )}

            </tbody>

          </table>

        </div>

      </div>

      {/* Footer / Pagination */}
      <div className="flex flex-col gap-4 border-t border-slate-800 bg-slate-900 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">

        <div className="text-sm text-slate-400">
          Showing{" "}
          <span className="font-semibold text-white">
            {(page - 1) * limit + 1}
          </span>{" "}
          –{" "}
          <span className="font-semibold text-white">
            {Math.min(page * limit, totalCompanies)}
          </span>{" "}
          of{" "}
          <span className="font-semibold text-emerald-400">
            {totalCompanies.toLocaleString()}
          </span>{" "}
          companies.
        </div>

        <div className="flex items-center gap-3">

          <button
            onClick={onPrevious}
            disabled={page === 1}
            className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-white transition hover:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </button>

          <div className="rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-semibold text-emerald-400">
            {page}
          </div>

          <button
            onClick={onNext}
            disabled={page === totalPages}
            className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-white transition hover:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </button>

        </div>

      </div>

    </section>
  );
}
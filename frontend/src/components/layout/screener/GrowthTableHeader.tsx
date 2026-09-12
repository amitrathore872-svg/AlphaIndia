"use client";

import {
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from "lucide-react";

export type SortField =
  | "company"
  | "sector"
  | "revenue_growth"
  | "pat_growth"
  | "roce"
  | "ai_score"
  | "health_score";

interface Props {
  sortField: SortField;
  sortDirection: "asc" | "desc";
  onSort: (field: SortField) => void;
}

const columns = [
  { label: "COMPANY", field: "company" },
  { label: "SECTOR", field: "sector" },
  { label: "REVENUE", field: "revenue_growth" },
  { label: "PAT", field: "pat_growth" },
  { label: "ROCE", field: "roce" },
  { label: "AI SCORE", field: "ai_score" },
  { label: "HEALTH", field: "health_score" },
] as const;

export default function GrowthTableHeader({
  sortField,
  sortDirection,
  onSort,
}: Props) {
  return (
    <thead className="sticky top-0 z-20 bg-slate-950/95 backdrop-blur">
      <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-400">
        <th className="px-4 py-4 text-left">#</th>

        {columns.map((col) => (
          <th key={col.field} className="px-4 py-4 text-center">
            <button
              onClick={() => onSort(col.field)}
              className={`flex items-center justify-center gap-2 w-full transition ${
                sortField === col.field
                  ? "text-emerald-400"
                  : "hover:text-white"
              }`}
            >
              {col.label}

              {sortField !== col.field ? (
                <ArrowUpDown className="h-3.5 w-3.5 text-slate-600" />
              ) : sortDirection === "asc" ? (
                <ArrowUp className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <ArrowDown className="h-3.5 w-3.5 text-emerald-400" />
              )}
            </button>
          </th>
        ))}

        <th className="px-4 py-4 text-center">MARKET CAP</th>
        <th className="px-4 py-4"></th>
      </tr>
    </thead>
  );
}
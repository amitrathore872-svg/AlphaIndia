"use client";

// =======================================================
// Alpha India Mission Control
// Sprint 33.4 Phase 4B.2
// Discovery Queue Table
// =======================================================

import { useMemo } from "react";
import { Eye, RotateCcw } from "lucide-react";

export interface DiscoveryQueueRow {
  symbol: string;
  company: string;
  exchange: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  filings_discovered: number;
  updated_at: string;
}

interface DiscoveryQueueTableProps {
  rows: DiscoveryQueueRow[];
  search: string;
  statusFilter: string;
}

export default function DiscoveryQueueTable({
  rows,
  search,
  statusFilter,
}: DiscoveryQueueTableProps) {
  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const matchesSearch =
        row.company.toLowerCase().includes(search.toLowerCase()) ||
        row.symbol.toLowerCase().includes(search.toLowerCase());

      const matchesStatus =
        statusFilter === "ALL" || row.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [rows, search, statusFilter]);

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 px-6 py-5">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-cyan-400">
            Live Queue
          </p>

          <h2 className="mt-2 text-xl font-bold text-white">
            Discovery Processing Table
          </h2>
        </div>

        <div className="rounded-full bg-slate-800 px-4 py-2 text-sm text-slate-300">
          {filteredRows.length} Records
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[950px]">
          <thead className="bg-slate-950 text-left text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-5 py-4">Company</th>
              <th className="px-5 py-4">Symbol</th>
              <th className="px-5 py-4">Exchange</th>
              <th className="px-5 py-4">Status</th>
              <th className="px-5 py-4 text-center">Filings</th>
              <th className="px-5 py-4">Updated</th>
              <th className="px-5 py-4 text-center">Actions</th>
            </tr>
          </thead>

          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="py-12 text-center text-slate-500"
                >
                  No companies found.
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => (
                <tr
                  key={`${row.symbol}-${row.updated_at}`}
                  className="border-t border-slate-800 transition hover:bg-slate-800/40"
                >
                  <td className="px-5 py-4">
                    <div>
                      <p className="font-semibold text-white">
                        {row.company}
                      </p>

                      <p className="text-xs text-slate-500">
                        Quarterly Filing Discovery
                      </p>
                    </div>
                  </td>

                  <td className="px-5 py-4 font-mono text-cyan-400">
                    {row.symbol}
                  </td>

                  <td className="px-5 py-4 text-slate-300">
                    {row.exchange}
                  </td>

                  <td className="px-5 py-4">
                    <StatusBadge status={row.status} />
                  </td>

                  <td className="px-5 py-4 text-center font-semibold text-white">
                    {row.filings_discovered}
                  </td>

                  <td className="px-5 py-4 text-sm text-slate-400">
                    {row.updated_at}
                  </td>

                  <td className="px-5 py-4">
                    <div className="flex justify-center gap-2">
                      <button className="rounded-lg bg-slate-800 p-2 text-cyan-400 transition hover:bg-cyan-500/20">
                        <Eye size={16} />
                      </button>

                      <button className="rounded-lg bg-slate-800 p-2 text-orange-400 transition hover:bg-orange-500/20">
                        <RotateCcw size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// =======================================================
// Status Badge
// =======================================================

function StatusBadge({
  status,
}: {
  status: DiscoveryQueueRow["status"];
}) {
  const styles = {
    PENDING: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    RUNNING: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
    COMPLETED: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    FAILED: "bg-red-500/15 text-red-400 border-red-500/30",
  };

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-semibold ${styles[status]}`}
    >
      {status}
    </span>
  );
}

// =======================================================
// Temporary Mock Queue Generator
// Will be replaced by backend pagination in Phase 4B.5
// =======================================================

export function generateMockQueue(total = 50): DiscoveryQueueRow[] {
  const companies = [
    ["INFY", "Infosys Limited"],
    ["TCS", "Tata Consultancy Services"],
    ["RELIANCE", "Reliance Industries Limited"],
    ["HDFCBANK", "HDFC Bank Limited"],
    ["ICICIBANK", "ICICI Bank Limited"],
    ["SBIN", "State Bank of India"],
    ["LT", "Larsen & Toubro Limited"],
    ["ITC", "ITC Limited"],
    ["BAJFINANCE", "Bajaj Finance Limited"],
    ["BHARTIARTL", "Bharti Airtel Limited"],
  ];

  const statuses: DiscoveryQueueRow["status"][] = [
    "COMPLETED",
    "PENDING",
    "RUNNING",
    "FAILED",
  ];

  return Array.from({ length: total }, (_, index) => {
    const company = companies[index % companies.length];

    return {
      symbol: company[0],
      company: company[1],
      exchange: "NSE",
      status: statuses[index % statuses.length],
      filings_discovered: (index % 7) + 1,
      updated_at: new Date(
        Date.now() - index * 60000
      ).toLocaleString("en-IN"),
    };
  });
}
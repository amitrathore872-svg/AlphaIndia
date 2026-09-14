"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Database,
  Building2,
  FileBarChart,
  ShieldCheck,
} from "lucide-react";

import {
  fetchWarehouseStatus,
  fetchAuditSummary,
} from "@/lib/importDashboardApi";

interface WarehouseStatus {
  warehouse: string;
  companies_imported: number;
  quarter_records: number;
}

interface AuditSummary {
  total_companies: number;
  companies_imported: number;
  coverage_percent: number;
  quarter_records: number;
}

export default function KPICards() {
  const [warehouse, setWarehouse] = useState<WarehouseStatus | null>(null);
  const [audit, setAudit] = useState<AuditSummary | null>(null);

  const loadDashboard = useCallback(async () => {
    try {
      const warehouseData = await fetchWarehouseStatus();
      const auditData = await fetchAuditSummary();

      setWarehouse(warehouseData);
      setAudit(auditData as unknown as AuditSummary);
    } catch (error) {
      console.error("Failed to load dashboard KPIs", error);
    }
  }, []);

  useEffect(() => {
    loadDashboard();

    const interval = setInterval(loadDashboard, 5000);
    return () => clearInterval(interval);
  }, [loadDashboard]);

  const cards = [
    {
      title: "WAREHOUSE COVERAGE",
      value: audit
        ? `${Number(audit.coverage_percent ?? 0).toFixed(2)}%`
        : "--",
      subtitle: "Imported vs Universe",
      icon: ShieldCheck,
      color: "emerald",
    },
    {
      title: "COMPANIES IMPORTED",
      value: warehouse
        ? warehouse.companies_imported.toLocaleString()
        : "--",
      subtitle: "Financial Warehouse",
      icon: Building2,
      color: "blue",
    },
    {
      title: "QUARTERLY RECORDS",
      value: warehouse
        ? warehouse.quarter_records.toLocaleString()
        : "--",
      subtitle: "Financial Statements",
      icon: FileBarChart,
      color: "amber",
    },
    {
      title: "WAREHOUSE STATUS",
      value: warehouse?.warehouse ?? "--",
      subtitle: "Backend Health",
      icon: Database,
      color: "emerald",
    },
  ];

  const colorClasses: Record<string, string> = {
    emerald:
      "border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400",
    blue: "border-blue-500/20 bg-blue-500/5 text-blue-600 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-400",
    amber:
      "border-amber-500/20 bg-amber-500/5 text-amber-600 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400",
  };

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;

        return (
          <div
            key={card.title}
            className={`rounded-2xl border p-5 ${colorClasses[card.color]}`}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold tracking-wider text-slate-500 dark:text-slate-400">
                {card.title}
              </p>

              <Icon className="h-5 w-5" />
            </div>

            <h3 className="mt-4 text-3xl font-bold text-slate-900 dark:text-white">
              {card.value}
            </h3>

            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {card.subtitle}
            </p>
          </div>
        );
      })}
    </section>
  );
}
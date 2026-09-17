// =======================================================
// Alpha India Screener.in API Client
// Parallel Architecture - Dedicated Client for Screener.in Endpoints
// =======================================================

import type {
  ScreenerGrowthResponse,
  ScreenerFiltersResponse,
  ScreenerMonitoringStatus,
  ScreenerMonitoringStats,
  ScreenerPerformanceMetrics,
  ScreenerLiveEvent,
  ScreenerImportRunRow,
} from "@/types/screener";

import { API_BASE } from "@/lib/apiConfig";


export interface ScreenerQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  sector?: string;
  category?: string;
  min_roce?: number;
  min_sales_growth_3yr?: number;
  min_profit_growth_3yr?: number;
  min_promoter_holding?: number;
  sort_by?: string;
  sort_order?: "asc" | "desc";
}

export async function fetchScreenerGrowth(
  params: ScreenerQueryParams = {}
): Promise<ScreenerGrowthResponse> {
  const query = new URLSearchParams();

  if (params.page) query.append("page", params.page.toString());
  if (params.limit) query.append("limit", params.limit.toString());
  if (params.search?.trim()) query.append("search", params.search.trim());
  if (params.sector && params.sector !== "ALL") query.append("sector", params.sector);
  if (params.category && params.category !== "ALL") query.append("category", params.category);
  if (params.min_roce !== undefined && params.min_roce !== null)
    query.append("min_roce", params.min_roce.toString());
  if (params.min_sales_growth_3yr !== undefined && params.min_sales_growth_3yr !== null)
    query.append("min_sales_growth_3yr", params.min_sales_growth_3yr.toString());
  if (params.min_profit_growth_3yr !== undefined && params.min_profit_growth_3yr !== null)
    query.append("min_profit_growth_3yr", params.min_profit_growth_3yr.toString());
  if (params.min_promoter_holding !== undefined && params.min_promoter_holding !== null)
    query.append("min_promoter_holding", params.min_promoter_holding.toString());
  if (params.sort_by) query.append("sort_by", params.sort_by);
  if (params.sort_order) query.append("sort_order", params.sort_order);

  const res = await fetch(`${API_BASE}/screener-growth?${query.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch Screener growth data: ${res.statusText}`);
  return res.json();
}

export async function fetchScreenerFilters(): Promise<ScreenerFiltersResponse> {
  const res = await fetch(`${API_BASE}/screener-growth/filters`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch Screener filters: ${res.statusText}`);
  return res.json();
}

export async function fetchScreenerMonitoringStatus(): Promise<ScreenerMonitoringStatus> {
  const res = await fetch(`${API_BASE}/screener-monitoring/status`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch Screener status: ${res.statusText}`);
  return res.json();
}

export async function fetchScreenerMonitoringStats(): Promise<ScreenerMonitoringStats> {
  const res = await fetch(`${API_BASE}/screener-monitoring/stats`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch Screener stats: ${res.statusText}`);
  return res.json();
}

export async function fetchScreenerLiveActivity(
  limit: number = 50
): Promise<{ success: boolean; count: number; events: ScreenerLiveEvent[] }> {
  const res = await fetch(`${API_BASE}/screener-monitoring/activity?limit=${limit}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch live activity: ${res.statusText}`);
  return res.json();
}

export async function fetchScreenerPerformance(): Promise<ScreenerPerformanceMetrics> {
  const res = await fetch(`${API_BASE}/screener-monitoring/performance`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch performance: ${res.statusText}`);
  return res.json();
}

export async function fetchScreenerErrors(): Promise<{
  success: boolean;
  count: number;
  errors: { symbol?: string; event_type: string; message: string; timestamp: string }[];
}> {
  const res = await fetch(`${API_BASE}/screener-monitoring/errors`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch errors: ${res.statusText}`);
  return res.json();
}

export async function fetchScreenerRuns(
  page: number = 1,
  limit: number = 10,
  status?: string
): Promise<{
  success: boolean;
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  results: ScreenerImportRunRow[];
}> {
  const query = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });
  if (status && status !== "ALL") query.append("status", status);

  const res = await fetch(`${API_BASE}/screener-monitoring/runs?${query.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Failed to fetch runs: ${res.statusText}`);
  return res.json();
}

export async function startScreenerImport(
  batchSize: number = 50,
  delaySeconds: number = 0.8,
  symbols?: string[]
): Promise<{ success: boolean; status: string; run_id?: string; message?: string }> {
  const res = await fetch(`${API_BASE}/screener-monitoring/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      batch_size: batchSize,
      delay_seconds: delaySeconds,
      symbols: symbols && symbols.length > 0 ? symbols : undefined,
    }),
  });
  if (!res.ok) throw new Error(`Failed to start import: ${res.statusText}`);
  return res.json();
}

export async function stopScreenerImport(): Promise<{
  success: boolean;
  status: string;
  message?: string;
}> {
  const res = await fetch(`${API_BASE}/screener-monitoring/stop`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`Failed to stop import: ${res.statusText}`);
  return res.json();
}

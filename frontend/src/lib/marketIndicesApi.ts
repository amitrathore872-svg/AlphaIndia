// =============================================================================
// Alpha India — Market Indices Radar API Client
// Sprint 42 — Institutional 12-Month Performance & Seasonality Heatmap
// =============================================================================

import { fetchJson } from "@/lib/apiConfig";

export interface MonthlyReturn {
  month_index: number; // 1 to 12
  month_label: string; // e.g. "Nov 2025" or "Oct 2026 (MTD)"
  month_short: string; // e.g. "Nov 25"
  year: number;
  month_num: number;
  return_pct: number;
  is_green: boolean;
  color_intensity: "deep-green" | "soft-green" | "soft-red" | "deep-red";
  close_price: number;
}

export interface IndexPerformance {
  symbol: string;
  name: string;
  nifty_name?: string | null;
  category: "BROAD" | "SECTORAL" | "THEMATIC";
  exchange: "NSE" | "BSE";
  description: string;
  cmp: number;
  change_1d: number;
  change_pct_1d: number;
  year_high: number;
  year_low: number;
  pct_off_high: number;

  // Monthly breakdown
  months: MonthlyReturn[];

  // Statistics
  green_count: number;
  red_count: number;
  win_rate_pct: number;
  return_1m: number;
  return_3m: number;
  return_6m: number;
  return_12m: number;
  return_ytd: number;
  best_month?: { month: string; return_pct: number } | null;
  worst_month?: { month: string; return_pct: number } | null;
  streak: string;
}

export interface IndicesSummary {
  total_indices: number;
  broad_count: number;
  sectoral_count: number;
  thematic_count: number;
  green_1d_count: number;
  red_1d_count: number;
  avg_12m_return: number;
  top_12m_leader: { name: string; return_12m: number };
  top_1m_leader: { name: string; return_1m: number };
  most_consistent: { name: string; win_rate_pct: number; green_months: number };
}

export interface IndicesResponse {
  status: string;
  timestamp: string;
  timestamp_epoch: number;
  duration_seconds: number;
  summary: IndicesSummary;
  month_headers: string[];
  total_count: number;
  indices: IndexPerformance[];
}

export interface FetchIndicesParams {
  category?: "ALL" | "BROAD" | "SECTORAL" | "THEMATIC" | string;
  search?: string;
  sort_by?: string;
  sort_order?: "asc" | "desc";
  force_refresh?: boolean;
}

export async function fetchMarketIndices(
  params: FetchIndicesParams = {}
): Promise<IndicesResponse> {
  const query = new URLSearchParams();
  if (params.category && params.category !== "ALL") query.append("category", params.category);
  if (params.search) query.append("search", params.search);
  if (params.sort_by) query.append("sort_by", params.sort_by);
  if (params.sort_order) query.append("sort_order", params.sort_order);
  if (params.force_refresh) query.append("force_refresh", "true");

  const qs = query.toString();
  const url = `/indices${qs ? `?${qs}` : ""}`;
  return fetchJson<IndicesResponse>(url);
}

export async function refreshMarketIndices(): Promise<{ status: string; message: string }> {
  return fetchJson<{ status: string; message: string }>("/indices/refresh", {
    method: "POST",
  });
}

export interface CandlePoint {
  time: string; // YYYY-MM-DD
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface LinePoint {
  time: string;
  value: number;
}

export interface IndexChartResponse {
  status: string;
  symbol: string;
  name: string;
  category: string;
  exchange: string;
  description: string;
  period: string;
  period_change_pct: number;
  latest_close: number;
  candles: CandlePoint[];
  line_data: LinePoint[];
  dma_50: LinePoint[];
  dma_200: LinePoint[];
  total_bars: number;
}

export async function fetchIndexChart(
  symbol: string,
  period = "1Y"
): Promise<IndexChartResponse> {
  return fetchJson<IndexChartResponse>(`/indices/${encodeURIComponent(symbol)}/chart?period=${period}`);
}


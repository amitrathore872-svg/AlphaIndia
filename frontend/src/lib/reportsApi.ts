/**
 * Alpha India - Institutional Market Reports API Client
 */

export interface BreadthPoint {
  date: string;
  total_stocks: number;
  above_dma: number;
  below_dma: number;
  pct_above_dma: number;
  above_20dma?: number;
  below_20dma?: number;
  pct_above_20dma?: number;
  zone: "GREEN" | "RED";
  change_1d: number;
}

export interface SectorBreadthItem {
  sector: string;
  total_stocks: number;
  above_dma: number;
  below_dma: number;
  pct_above_dma: number;
  above_20dma?: number;
  below_20dma?: number;
  pct_above_20dma?: number;
  zone: "GREEN" | "RED";
}

export interface BreadthCurrentMetrics {
  latest_date: string;
  dma_period?: number;
  current_pct_above_dma: number;
  current_count_above_dma: number;
  current_pct_above_20dma?: number;
  current_count_above_20dma?: number;
  total_universe_count: number;
  current_zone: "GREEN" | "RED";
  regime_label: string;
  regime_description: string;
  change_1d: number;
  change_5d: number;
  change_20d: number;
  highest_pct: number;
  lowest_pct: number;
  avg_pct: number;
  green_days_count: number;
  red_days_count: number;
  green_days_pct: number;
}

export interface BreadthReportData {
  dma_period: number;
  dma_title: string;
  universe: string;
  universe_name: string;
  timeframe: string;
  threshold_line: number;
  current_metrics: BreadthCurrentMetrics;
  data_points_count: number;
  series: BreadthPoint[];
  sector_breadth: SectorBreadthItem[];
  multi_dma_latest?: {
    "20_dma_pct": number;
    "50_dma_pct": number;
    "200_dma_pct": number;
  };
  last_updated: string;
}

export interface MultiDmaPoint {
  date: string;
  pct_above_20dma: number;
  pct_above_50dma: number;
  pct_above_200dma: number;
  all_above_50: boolean;
  all_below_50: boolean;
}

export interface MultiDmaResponse {
  timeframe: string;
  threshold_line: number;
  series: MultiDmaPoint[];
  latest: MultiDmaPoint;
  last_updated: string;
}

export interface ReportCatalogItem {
  id: string;
  title: string;
  category: string;
  status: "LIVE" | "PIPELINE";
  description: string;
  badge: string;
  frequency: string;
  key_metrics: string[];
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export async function fetchBreadthDma(
  dma: number = 20,
  universe: string = "all",
  timeframe: string = "1Y",
  refresh: boolean = false
): Promise<BreadthReportData> {
  const url = `${API_BASE}/reports/breadth?dma=${dma}&universe=${encodeURIComponent(
    universe
  )}&timeframe=${encodeURIComponent(timeframe)}${refresh ? "&refresh=true" : ""}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${dma} DMA breadth data: ${res.statusText}`);
  }
  const json = await res.json();
  return json.data;
}

// Backwards-compatible alias for 20 DMA
export async function fetchBreadth20Dma(
  universe: string = "all",
  timeframe: string = "1Y",
  refresh: boolean = false
): Promise<BreadthReportData> {
  return fetchBreadthDma(20, universe, timeframe, refresh);
}

export async function fetchMultiDmaBreadth(
  timeframe: string = "1Y",
  refresh: boolean = false
): Promise<MultiDmaResponse> {
  const url = `${API_BASE}/reports/breadth/multi-dma?timeframe=${encodeURIComponent(
    timeframe
  )}${refresh ? "&refresh=true" : ""}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch multi-DMA breadth data: ${res.statusText}`);
  }
  const json = await res.json();
  return json.data;
}

export async function fetchReportCatalog(): Promise<ReportCatalogItem[]> {
  const url = `${API_BASE}/reports/catalog`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch reports catalog: ${res.statusText}`);
  }
  const json = await res.json();
  return json.reports;
}

export async function triggerBreadthRefresh(): Promise<any> {
  const url = `${API_BASE}/reports/breadth/refresh`;
  const res = await fetch(url, { method: "POST" });
  if (!res.ok) {
    throw new Error(`Failed to refresh breadth cache: ${res.statusText}`);
  }
  return await res.json();
}

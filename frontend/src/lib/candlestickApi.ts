/**
 * Alpha India - Candlestick Pattern Radar API Client
 * Connects to /api/v1/candlesticks for Single, Double, and Triple pattern setups.
 */

import { getBackendUrl } from "./apiConfig";

export interface CandlestickBar {
  o: number;
  h: number;
  l: number;
  c: number;
}

export interface CandlestickSignal {
  symbol: string;
  pattern_key: string;
  pattern_name: string;
  category: "TRIPLE" | "DOUBLE" | "SINGLE";
  direction: "BULLISH" | "BEARISH" | "NEUTRAL";
  reliability: "VERY_HIGH" | "HIGH" | "MODERATE";
  bar_count: number;
  description: string;
  timestamp: string;
  cmp: number;
  trigger_price: number;
  stop_loss: number;
  target_1: number;
  target_2: number;
  risk_reward: number;
  ai_conviction_score: number;
  volume_surge_ratio: number;
  pattern_range_pct: number;
  trend_context: string;
  dma_confluence: string;
  rsi_14: number;
  bars?: CandlestickBar[];
}

export interface CandlestickMetadata {
  scanned_at: string;
  scanned_at_epoch: number;
  duration_seconds: number;
  total_signals: number;
  universe_scanned: number;
  bullish_signals: number;
  bearish_signals: number;
  triple_patterns: number;
  double_patterns: number;
  single_patterns: number;
}

export interface CandlestickResponse {
  metadata: CandlestickMetadata;
  total_count: number;
  page: number;
  limit: number;
  total_pages: number;
  signals: CandlestickSignal[];
}

export interface CandlestickSummaryResponse {
  metadata: CandlestickMetadata;
  top_patterns: { pattern: string; count: number }[];
  category_breakdown: {
    triple: number;
    double: number;
    single: number;
  };
  direction_breakdown: {
    bullish: number;
    bearish: number;
  };
}

export async function fetchCandlesticks(params: {
  direction?: string;
  category?: string;
  pattern_key?: string;
  min_score?: number;
  search?: string;
  sort_by?: string;
  sort_order?: "asc" | "desc";
  page?: number;
  limit?: number;
  force_refresh?: boolean;
}): Promise<CandlestickResponse> {
  const baseUrl = getBackendUrl();
  const searchParams = new URLSearchParams();

  if (params.direction && params.direction !== "ALL") searchParams.set("direction", params.direction);
  if (params.category && params.category !== "ALL") searchParams.set("category", params.category);
  if (params.pattern_key) searchParams.set("pattern_key", params.pattern_key);
  if (params.min_score !== undefined) searchParams.set("min_score", params.min_score.toString());
  if (params.search) searchParams.set("search", params.search);
  if (params.sort_by) searchParams.set("sort_by", params.sort_by);
  if (params.sort_order) searchParams.set("sort_order", params.sort_order);
  if (params.page) searchParams.set("page", params.page.toString());
  if (params.limit) searchParams.set("limit", params.limit.toString());
  if (params.force_refresh) searchParams.set("force_refresh", "true");

  const url = `${baseUrl}/api/v1/candlesticks?${searchParams.toString()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch candlesticks: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchCandlestickSummary(): Promise<CandlestickSummaryResponse> {
  const baseUrl = getBackendUrl();
  const res = await fetch(`${baseUrl}/api/v1/candlesticks/summary`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch candlestick summary: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchSymbolCandlesticks(symbol: string): Promise<{ symbol: string; signals: CandlestickSignal[] }> {
  const baseUrl = getBackendUrl();
  const res = await fetch(`${baseUrl}/api/v1/candlesticks/symbol/${encodeURIComponent(symbol)}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch candlesticks for ${symbol}: ${res.statusText}`);
  }
  return res.json();
}

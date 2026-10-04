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
  company_name?: string;
  sector?: string;
  current_stage?: string;
  stage_code?: string;
  stage_badge?: string;
  sparkline?: number[];
  return_90d_pct?: number;
  day_change_pct?: number;
  conviction_tier?: "ELITE" | "HIGH" | "MODERATE" | "SPECULATIVE";
  conviction_reasons?: string[];
  universe?: string;
  volume_confirmation_level?: string;
  patterns_count?: number;
  patterns?: CandlestickSignal[];
  all_pattern_names?: string[];
  multi_pattern_confluence?: boolean;
  confluence_bonus?: number;
}

export interface CandlestickMetadata {
  scanned_at: string;
  scanned_at_epoch: number;
  duration_seconds: number;
  total_signals: number;
  universe_scanned: number;
  universe_name?: string;
  bullish_signals: number;
  bearish_signals: number;
  triple_patterns: number;
  double_patterns: number;
  single_patterns: number;
  elite_signals?: number;
  high_conviction_signals?: number;
  moderate_signals?: number;
  speculative_signals?: number;
  avg_conviction_score?: number;
  group_by_stock?: boolean;
  total_unique_stocks?: number;
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
  conviction_breakdown?: {
    elite: number;
    high: number;
    moderate: number;
    speculative: number;
  };
  volume_breakdown?: {
    explosive_2x: number;
    strong_1_5x: number;
  };
  total_unique_stocks?: number;
  multi_pattern_stocks?: number;
  avg_conviction_score?: number;
}

export async function fetchCandlesticks(params: {
  universe?: string;
  group_by_stock?: boolean;
  conviction_tier?: string;
  direction?: string;
  category?: string;
  pattern_key?: string;
  min_score?: number;
  min_volume_ratio?: number;
  min_risk_reward?: number;
  stage?: string;
  search?: string;
  sort_by?: string;
  sort_order?: "asc" | "desc";
  page?: number;
  limit?: number;
  force_refresh?: boolean;
}): Promise<CandlestickResponse> {
  const baseUrl = getBackendUrl();
  const searchParams = new URLSearchParams();

  if (params.universe) searchParams.set("universe", params.universe);
  if (params.group_by_stock !== undefined) searchParams.set("group_by_stock", params.group_by_stock ? "true" : "false");
  if (params.conviction_tier && params.conviction_tier !== "ALL") searchParams.set("conviction_tier", params.conviction_tier);
  if (params.direction && params.direction !== "ALL") searchParams.set("direction", params.direction);
  if (params.category && params.category !== "ALL") searchParams.set("category", params.category);
  if (params.pattern_key) searchParams.set("pattern_key", params.pattern_key);
  if (params.min_score !== undefined) searchParams.set("min_score", params.min_score.toString());
  if (params.min_volume_ratio !== undefined && params.min_volume_ratio > 0) searchParams.set("min_volume_ratio", params.min_volume_ratio.toString());
  if (params.min_risk_reward !== undefined && params.min_risk_reward > 0) searchParams.set("min_risk_reward", params.min_risk_reward.toString());
  if (params.stage && params.stage !== "ALL") searchParams.set("stage", params.stage);
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

export async function fetchCandlestickSummary(universe: string = "NIFTY_500"): Promise<CandlestickSummaryResponse> {
  const baseUrl = getBackendUrl();
  const res = await fetch(`${baseUrl}/api/v1/candlesticks/summary?universe=${encodeURIComponent(universe)}`, { cache: "no-store" });
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

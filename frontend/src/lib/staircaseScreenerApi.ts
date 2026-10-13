/**
 * Alpha India - Staircase Momentum & Creeping Bull Radar API Client
 * Interfaces and fetchers for querying institutional low-volatility staircase runners (The Cupid Archetype).
 */

import { fetchJson } from "@/lib/apiConfig";

export interface StaircaseMetrics {
  ker_10d: number;
  ker_20d: number;
  green_days_10d: number;
  green_ratio_pct: number;
  avg_daily_gain_pct: number;
  std_daily_gain_pct: number;
  avg_close_to_high: number;
  worst_intraday_dip_pct: number;
  estimated_delivery_pct: number;
  up_down_vol_ratio: number;
  vol_ratio: number;
  distance_from_base_pct: number;
  base_pivot_high: number;
  base_depth_pct: number;
  ema_5: number;
  ema_10: number;
  ema_20: number;
  sma_50: number;
  sma_200: number;
  is_ribbon_aligned: boolean;
  down_day_rs_ratio_pct: number;
  down_day_green_count: number;
  down_day_total_red: number;
  down_day_alpha_pct: number;
  is_tennis_ball: boolean;
}

export interface StaircaseBlueprint {
  trailing_stop_10ema: number;
  distance_to_stop_pct: number;
  target_1: number;
  target_2: number;
  exit_rule: string;
}

export type StaircaseTier =
  | "ALL"
  | "STEALTH_ACCUMULATOR"
  | "CUPID_ARCHETYPE"
  | "EARLY_STAIRCASE"
  | "ESTABLISHED_RUNNER"
  | "EXTENDED_RUNNER"
  | "WATCHLIST_STAIRCASE";

export interface StaircaseOpportunity {
  symbol: string;
  cmp: number;
  day_change: number;
  day_change_pct: number;
  conviction_score: number;
  setup_tier: StaircaseTier;
  tier_badge: string;
  metrics: StaircaseMetrics;
  blueprint: StaircaseBlueprint;
  tradingview_url: string;
  techno_funda_url: string;
}

export interface StaircaseMetadata {
  total_scanned: number;
  total_opportunities: number;
  stealth_accumulator_count?: number;
  cupid_archetype_count?: number;
  early_staircase_count: number;
  established_count: number;
  tennis_ball_count?: number;
  avg_ker_10d: number;
  last_scan_time?: string;
  total_filtered?: number;
  page?: number;
  limit?: number;
  total_pages?: number;
}

export interface StaircaseResponse {
  opportunities: StaircaseOpportunity[];
  metadata: StaircaseMetadata;
  cached?: boolean;
}

export interface StaircaseQueryParams {
  min_score?: number;
  tier?: StaircaseTier | string;
  tennis_ball_only?: boolean;
  search?: string;
  sort_by?: "conviction_score" | "ker_10d" | "green_days_10d" | "cmp" | "day_change_pct" | "distance_from_base_pct" | "down_day_alpha_pct" | "down_day_rs_ratio_pct";
  sort_order?: "asc" | "desc";
  page?: number;
  limit?: number;
}

/**
 * Fetch filtered staircase opportunities from backend
 */
export async function fetchStaircaseOpportunities(
  params: StaircaseQueryParams = {}
): Promise<StaircaseResponse> {
  const query = new URLSearchParams();

  if (params.min_score !== undefined) query.set("min_score", params.min_score.toString());
  if (params.tier && params.tier !== "ALL") query.set("tier", params.tier);
  if (params.tennis_ball_only) query.set("tennis_ball_only", "true");
  if (params.search && params.search.trim()) query.set("search", params.search.trim());
  if (params.sort_by) query.set("sort_by", params.sort_by);
  if (params.sort_order) query.set("sort_order", params.sort_order);
  if (params.page !== undefined) query.set("page", params.page.toString());
  if (params.limit !== undefined) query.set("limit", params.limit.toString());

  const qs = query.toString();
  const endpoint = `/api/v1/staircase-screener${qs ? `?${qs}` : ""}`;

  return fetchJson<StaircaseResponse>(endpoint);
}

/**
 * Force live rescan of the staircase universe
 */
export async function refreshStaircaseScan(): Promise<{
  status: string;
  message: string;
  metadata: StaircaseMetadata;
}> {
  return fetchJson<{
    status: string;
    message: string;
    metadata: StaircaseMetadata;
  }>("/api/v1/staircase-screener/refresh", {
    method: "POST",
  });
}

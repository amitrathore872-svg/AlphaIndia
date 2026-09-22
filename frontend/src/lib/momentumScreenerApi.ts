/**
 * Alpha India - Multi-Timeframe Bollinger Band & Triple-RSI Momentum Screener API
 */

import { fetchJson } from "@/lib/apiConfig";

export interface FilterStatus {
  vol_gt_sma20: boolean;
  daily_close_gt_bb_upper: boolean;
  weekly_close_gt_bb_upper: boolean;
  daily_rsi_gt_60: boolean;
  weekly_rsi_gt_60: boolean;
  monthly_rsi_gt_60: boolean;
  weekly_wma_cross: boolean;
  weekly_wma30_gt_60: boolean;
  weekly_wma50_gt_60: boolean;
  daily_close_gt_open: boolean;
  fresh_crossover?: boolean;
  wma_bullish_aligned?: boolean;
}

export interface IndicatorValues {
  daily_volume: number;
  daily_volume_sma20: number;
  volume_surge_ratio: number;
  daily_bb_upper: number;
  daily_bb_mid: number;
  daily_rsi: number;
  weekly_close: number;
  weekly_bb_upper: number;
  weekly_rsi: number;
  monthly_rsi: number;
  weekly_wma30: number;
  weekly_wma50: number;
  daily_open: number;
  daily_high: number;
  daily_low: number;
}

export interface MomentumTradeBlueprint {
  entry_trigger: number;
  stop_loss: number;
  target_1: number;
  target_2: number;
  risk_reward: number;
}

export interface MomentumOpportunity {
  symbol: string;
  company_name: string;
  sector: string;
  cmp: number;
  day_change: number;
  day_change_pct: number;
  match_count: number;
  conviction_score?: number;
  is_perfect_match: boolean;
  core_9_passed: boolean;
  setup_tier: string;
  tier_badge: string;
  filters: FilterStatus;
  indicators: IndicatorValues;
  trade_blueprint: MomentumTradeBlueprint;
  tradingview_url: string;
  techno_funda_url: string;
}

export interface MomentumRadarMetadata {
  total_scanned: number;
  perfect_10_count: number;
  core_9_count: number;
  high_conviction_count: number;
  conviction_79_count?: number;
  avg_daily_rsi: number;
  scan_duration_seconds: number;
  last_scan_time: string;
}

export interface MomentumOpportunitiesResponse {
  metadata: MomentumRadarMetadata;
  total_count: number;
  page: number;
  limit: number;
  total_pages: number;
  items: MomentumOpportunity[];
}

export interface ConditionConfig {
  id: string;
  label: string;
  timeframe: string;
  default_active: boolean;
}

export interface FilterOptionsResponse {
  sectors: string[];
  conditions: ConditionConfig[];
  metadata: MomentumRadarMetadata;
}

export interface FetchMomentumParams {
  min_matches?: number;
  require_strict?: boolean;
  search?: string;
  sector?: string;
  sort_by?: string;
  sort_order?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export async function fetchMomentumOpportunities(
  params: FetchMomentumParams = {}
): Promise<MomentumOpportunitiesResponse> {
  const query = new URLSearchParams();
  if (params.min_matches !== undefined) query.set("min_matches", String(params.min_matches));
  if (params.require_strict !== undefined) query.set("require_strict", String(params.require_strict));
  if (params.search) query.set("search", params.search);
  if (params.sector) query.set("sector", params.sector);
  if (params.sort_by) query.set("sort_by", params.sort_by);
  if (params.sort_order) query.set("sort_order", params.sort_order);
  if (params.page !== undefined) query.set("page", String(params.page));
  if (params.limit !== undefined) query.set("limit", String(params.limit));

  return fetchJson<MomentumOpportunitiesResponse>(
    `/api/v1/momentum-screener?${query.toString()}`
  );
}

export async function triggerMomentumScan(): Promise<any> {
  return fetchJson(`/api/v1/momentum-screener/scan`, {
    method: "POST",
  });
}

export async function fetchMomentumFilterOptions(): Promise<FilterOptionsResponse> {
  return fetchJson<FilterOptionsResponse>(`/api/v1/momentum-screener/filters`);
}

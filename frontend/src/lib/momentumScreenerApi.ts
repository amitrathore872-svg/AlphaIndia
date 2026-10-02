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
  market_cap_cr?: number | null;
  turnover_lakhs?: number | null;
}

export interface MomentumStageFunnelStage {
  stage_index: number;
  condition_id: string;
  condition_label: string;
  timeframe: string;
  candidates_in: number;
  passed_count: number;
  filtered_out_count: number;
  attrition_pct: number;
  retention_pct: number;
  cumulative_survival_pct: number;
}

export interface MomentumIndependentCondition {
  stage_index: number;
  condition_id: string;
  condition_label: string;
  timeframe: string;
  total_evaluated: number;
  passed_count: number;
  filtered_out_count: number;
  filter_rate_pct: number;
  pass_rate_pct: number;
}

export interface MomentumStageFunnel {
  summary: {
    initial_universe: number;
    final_matched_stocks: number;
    total_filtered_out: number;
    overall_survival_rate_pct: number;
    overall_attrition_pct: number;
  };
  sequential_waterfall: MomentumStageFunnelStage[];
  independent_conditions: MomentumIndependentCondition[];
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
  stage_funnel?: MomentumStageFunnel;
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
    `/api/v1/momentum-screener?${query.toString()}`,
    { timeoutMs: 35000 }
  );
}

export async function triggerMomentumScan(): Promise<any> {
  return fetchJson(`/api/v1/momentum-screener/scan`, {
    method: "POST",
    timeoutMs: 35000,
  });
}

export async function fetchMomentumFilterOptions(): Promise<FilterOptionsResponse> {
  return fetchJson<FilterOptionsResponse>(`/api/v1/momentum-screener/filters`, {
    timeoutMs: 35000,
  });
}

// ─── Universe Scan Types ─────────────────────────────────────────────────────

export interface UniverseScanMetadata {
  universe_size: number;
  scanned_count: number;
  valid_results: number;
  near_breakout_count: number;
  high_conviction_count: number;
  perfect_10_count: number;
  error_count: number;
  scan_duration_seconds: number;
  scan_date: string;
  last_scan_time: string;
  scan_type: string;
  near_breakout_threshold: number;
  promoted_to_watchlist?: number;
}

export interface UniverseScanStatusResponse {
  is_market_hours: boolean;
  is_off_market_window: boolean;
  universe_scan_in_progress: boolean;
  near_breakout_threshold: number;
  breakout_trigger_threshold: number;
  last_universe_scan: UniverseScanMetadata | null;
  watchlist_summary: WatchlistSummaryResponse;
}

export interface WatchlistCandidate {
  id: number;
  symbol: string;
  company_name: string;
  sector: string;
  market_cap_cr?: number | null;
  match_count: number;
  conviction_score: number;
  conditions_passed: Record<string, boolean>;
  cmp_at_scan: number | null;
  intraday_cmp: number | null;
  intraday_match_count: number | null;
  daily_rsi_at_scan: number | null;
  weekly_rsi_at_scan: number | null;
  monthly_rsi_at_scan: number | null;
  vol_surge_ratio_at_scan: number | null;
  entry_trigger: number | null;
  stop_loss: number | null;
  target_1: number | null;
  target_2: number | null;
  risk_reward: number | null;
  breakout_triggered: boolean;
  breakout_triggered_at: string | null;
  last_intraday_check: string | null;
  scanned_at: string | null;
  scan_type: string;
  universe_size: number | null;
  promoted_date: string | null;
}

export interface WatchlistSummaryResponse {
  today: string;
  total_watchlist: number;
  breakout_triggered_count: number;
  monitoring_count: number;
  candidates: WatchlistCandidate[];
  breakouts: WatchlistCandidate[];
}

export interface IntradayBreakoutResponse {
  is_market_hours: boolean;
  status: string;
  metadata: {
    watchlist_size: number;
    breakout_count: number;
    near_breakout_count: number;
    scan_duration_seconds: number;
    last_scan_time: string;
    breakout_trigger_threshold: number;
    is_market_hours: boolean;
  };
  breakouts: (MomentumOpportunity & { intraday_status: string; prior_match_count: number | null })[];
  near_breakouts: (MomentumOpportunity & { intraday_status: string; prior_match_count: number | null })[];
}

// ─── Universe Scan API Functions ─────────────────────────────────────────────

export async function fetchUniverseScanStatus(): Promise<UniverseScanStatusResponse> {
  return fetchJson<UniverseScanStatusResponse>(`/api/v1/momentum-screener/universe/status`, {
    timeoutMs: 20000,
  });
}

export async function triggerUniverseScan(): Promise<any> {
  return fetchJson(`/api/v1/momentum-screener/universe/scan`, {
    method: "POST",
    timeoutMs: 20000,
  });
}

export async function fetchUniverseScanResults(params: {
  min_matches?: number;
  sector?: string;
  min_mcap?: number;
  min_price?: number;
  min_turnover_lakhs?: number;
  page?: number;
  limit?: number;
} = {}): Promise<any> {
  const query = new URLSearchParams();
  if (params.min_matches !== undefined) query.set("min_matches", String(params.min_matches));
  if (params.sector) query.set("sector", params.sector);
  if (params.min_mcap !== undefined) query.set("min_mcap", String(params.min_mcap));
  if (params.min_price !== undefined) query.set("min_price", String(params.min_price));
  if (params.min_turnover_lakhs !== undefined) query.set("min_turnover_lakhs", String(params.min_turnover_lakhs));
  if (params.page !== undefined) query.set("page", String(params.page));
  if (params.limit !== undefined) query.set("limit", String(params.limit));
  return fetchJson(`/api/v1/momentum-screener/universe/results?${query.toString()}`, {
    timeoutMs: 20000,
  });
}

export async function fetchMomentumWatchlist(): Promise<WatchlistSummaryResponse & { is_market_hours: boolean }> {
  return fetchJson(`/api/v1/momentum-screener/watchlist`, { timeoutMs: 20000 });
}

export async function fetchIntradayBreakouts(): Promise<IntradayBreakoutResponse> {
  return fetchJson<IntradayBreakoutResponse>(`/api/v1/momentum-screener/intraday-breakouts`, {
    timeoutMs: 30000,
  });
}

export async function refreshIntradayBreakouts(): Promise<any> {
  return fetchJson(`/api/v1/momentum-screener/intraday-breakouts/refresh`, {
    method: "POST",
    timeoutMs: 20000,
  });
}

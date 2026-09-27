/**
 * Narrow CPR Compression Scanner API Client
 * Sprint 38.5 Institutional Quant Scanner (Engine #11)
 */

import { fetchJson } from "@/lib/apiConfig";

export interface CPRStockItem {
  id: number;
  symbol: string;
  date: string;
  company_name: string;
  sector: string;
  market_cap: number;
  market_cap_category: string;
  current_price: number;
  pivot: number;
  bc: number;
  tc: number;
  cpr_width_pct: number;
  category: "Ultra Compression" | "Very Strong" | "Strong" | "Average" | "Ignore" | string;
  cpr_rank: number;
  cpr_percentile: number;
  is_top_1_pct: boolean;
  is_top_5_pct: boolean;
  is_top_10_pct: boolean;
  compression_score: number;
  breakout_score: number;
  is_nr7: boolean;
  is_nr4: boolean;
  is_inside_bar: boolean;
  is_bollinger_squeeze: boolean;
  is_atr_compression: boolean;
  is_volume_dryup: boolean;
  is_supertrend_bullish: boolean;
  is_ema_aligned: boolean;
  is_adx_rising: boolean;
  is_triple_cpr: boolean;
  daily_narrow: boolean;
  weekly_narrow: boolean;
  monthly_narrow: boolean;
  entry_price: number;
  stop_loss: number;
  target1: number;
  target2: number;
  target3: number;
  risk_reward: string;
  dma_20?: number;
  dma_50?: number;
  dma_200?: number;
  volume_ratio_20d?: number;
  rsi_14?: number;
  adx_14?: number;
  atr_14?: number;
  alert_status?: string;
}

export interface CPRSummary {
  date: string;
  total_universe: number;
  ultra_compression: number;
  very_strong: number;
  triple_cpr: number;
  volume_dryup: number;
}

export interface CPRDiscoverySummary {
  engine_id: string;
  engine_name: string;
  status: string;
  stocks_scanned: number;
  ultra_compression_stocks: number;
  very_strong_stocks: number;
  triple_cpr_stocks: number;
  volume_dryup_stocks: number;
  breakout_today: number;
  alerts_triggered_count: number;
  top_compression_stock: {
    symbol: string;
    cpr_width_pct: number;
    category: string;
    compression_score: number;
    breakout_score: number;
    cmp: number;
    tc: number;
    target1: number;
  } | null;
  last_scan_date: string;
}

export interface CPRScannerResponse {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  items: CPRStockItem[];
  summary: CPRSummary;
}

export interface CPRStockDetail {
  symbol: string;
  company_name: string;
  sector: string;
  market_cap: number;
  date: string;
  current_price: number;
  cpr_daily: {
    pivot: number;
    bc: number;
    tc: number;
    width_pct: number;
    category: string;
    cpr_rank: number;
    percentile: number;
    zone: string;
    zone_color: string;
    zone_desc: string;
  };
  cpr_weekly: {
    pivot: number;
    bc: number;
    tc: number;
    width_pct: number;
    is_narrow: boolean;
  };
  cpr_monthly: {
    pivot: number;
    bc: number;
    tc: number;
    width_pct: number;
    is_narrow: boolean;
  };
  scores: {
    compression_score: number;
    breakout_score: number;
  };
  quality_filters: {
    is_nr7: boolean;
    is_nr4: boolean;
    is_inside_bar: boolean;
    is_bollinger_squeeze: boolean;
    is_atr_compression: boolean;
    is_volume_dryup: boolean;
    is_supertrend_bullish: boolean;
    is_ema_aligned: boolean;
    is_adx_rising: boolean;
    is_triple_cpr: boolean;
  };
  trading_plan: {
    buy_level: number;
    stop_loss: number;
    target_1: number;
    target_2: number;
    target_3: number;
    risk_reward: string;
    atr_14: number;
  };
  technical_context: {
    dma_20: number;
    dma_50: number;
    dma_200: number;
    rsi_14: number;
    adx_14: number;
    volume_ratio_20d: number;
  };
  alert_status: string;
}

export interface CPRAlertItem {
  symbol: string;
  company_name: string;
  sector: string;
  cpr_width_pct: number;
  category: string;
  compression_score: number;
  alert_type: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "WARNING" | "INFO";
  headline: string;
  description: string;
  cmp: number;
  tc: number;
  bc: number;
  pivot: number;
  target_1: number;
  stop_loss: number;
  risk_reward: string;
  time: string;
  timestamp: string;
}

export async function fetchCPRScannerResults(params: {
  width_max?: number;
  score_min?: number;
  sector?: string;
  marketcap?: string;
  min_marketcap_cr?: number;
  min_price?: number;
  min_volume?: number;
  category?: string;
  triple_cpr_only?: boolean;
  volume_dryup_only?: boolean;
  bullish_trend_only?: boolean;
  search?: string;
  sort_by?: string;
  sort_order?: string;
  page?: number;
  limit?: number;
}): Promise<CPRScannerResponse> {
  const q = new URLSearchParams();
  if (params.width_max !== undefined) q.append("width_max", String(params.width_max));
  if (params.score_min !== undefined) q.append("score_min", String(params.score_min));
  if (params.sector && params.sector !== "ALL") q.append("sector", params.sector);
  if (params.marketcap && params.marketcap !== "ALL") q.append("marketcap", params.marketcap);
  if (params.min_marketcap_cr !== undefined) q.append("min_marketcap_cr", String(params.min_marketcap_cr));
  if (params.min_price !== undefined) q.append("min_price", String(params.min_price));
  if (params.min_volume !== undefined) q.append("min_volume", String(params.min_volume));
  if (params.category && params.category !== "ALL") q.append("category", params.category);
  if (params.triple_cpr_only) q.append("triple_cpr_only", "true");
  if (params.volume_dryup_only) q.append("volume_dryup_only", "true");
  if (params.bullish_trend_only) q.append("bullish_trend_only", "true");
  if (params.search) q.append("search", params.search);
  if (params.sort_by) q.append("sort_by", params.sort_by);
  if (params.sort_order) q.append("sort_order", params.sort_order);
  if (params.page) q.append("page", String(params.page));
  if (params.limit) q.append("limit", String(params.limit));

  return fetchJson<CPRScannerResponse>(`/scanner/cpr?${q.toString()}`);
}

export async function fetchTopCPR(limit: number = 25): Promise<CPRStockItem[]> {
  return fetchJson<CPRStockItem[]>(`/scanner/cpr/top?limit=${limit}`);
}

export async function fetchTripleCPR(limit: number = 50): Promise<CPRStockItem[]> {
  return fetchJson<CPRStockItem[]>(`/scanner/cpr/triple?limit=${limit}`);
}

export async function fetchCPRWatchlist(limit: number = 50): Promise<CPRStockItem[]> {
  return fetchJson<CPRStockItem[]>(`/scanner/cpr/watchlist?limit=${limit}`);
}

export async function fetchCPRSummary(): Promise<CPRDiscoverySummary> {
  return fetchJson<CPRDiscoverySummary>("/scanner/cpr/summary");
}

export async function fetchCPRAlerts(limit: number = 50): Promise<CPRAlertItem[]> {
  return fetchJson<CPRAlertItem[]>(`/scanner/cpr/alerts?limit=${limit}`);
}

export async function fetchStockCPRDetail(symbol: string): Promise<CPRStockDetail> {
  return fetchJson<CPRStockDetail>(`/scanner/cpr/${symbol}`);
}

export async function triggerCPRUniverseScan(): Promise<any> {
  return fetchJson("/scanner/cpr/scan", {
    method: "POST",
  });
}

export interface ZerodhaCPRItem {
  symbol: string;
  company_name: string;
  sector: string;
  cmp: number;
  timeframe: "hourly" | "daily" | "weekly" | "monthly";
  pivot: number;
  bc: number;
  tc: number;
  cpr_top: number;
  cpr_bottom: number;
  cpr_width: number;
  cpr_width_pct: number;
  dist_to_cpr_pct: number;
  cpr_position: "INSIDE_CPR" | "AT_TC" | "AT_BC" | "AT_PIVOT" | "ABOVE_CPR" | "BELOW_CPR" | string;
  market_cap_cr: number;
  market_cap_category: string;
  turnover_cr: number;
}

export async function fetchZerodhaCPR(
  timeframe: "hourly" | "daily" | "weekly" | "monthly" = "daily",
  maxWidthPct?: number,
  maxDistPct?: number,
  minTurnoverCr: number = 1.0,
  minMarketCapCr: number = 1000.0,
  minPrice: number = 30.0,
  sortBy: string = "cpr_width_pct",
  limit: number = 60
): Promise<ZerodhaCPRItem[]> {
  const q = new URLSearchParams();
  q.append("timeframe", timeframe);
  if (maxWidthPct !== undefined && maxWidthPct !== null) q.append("max_width_pct", String(maxWidthPct));
  if (maxDistPct !== undefined && maxDistPct !== null) q.append("max_dist_pct", String(maxDistPct));
  q.append("min_turnover_cr", String(minTurnoverCr));
  q.append("min_marketcap_cr", String(minMarketCapCr));
  q.append("min_price", String(minPrice));
  q.append("sort_by", sortBy);
  q.append("limit", String(limit));

  return fetchJson<ZerodhaCPRItem[]>(`/scanner/cpr/zerodha?${q.toString()}`, { timeoutMs: 30000 });
}

export interface CPRTransitionItem {
  symbol: string;
  company_name: string;
  sector: string;
  cmp: number;
  timeframe: "hourly" | "daily" | "weekly" | "monthly";
  dist_to_cpr_pct: number;
  cpr_spread_pct: number;
  prev_cpr_width: number;
  curr_cpr_width: number;
  compression_ratio: number;
  pivot: number;
  tc: number;
  bc: number;
  breakout_trigger: number;
  breakdown_trigger: number;
  entry_price?: number;
  stop_loss?: number;
  target_1?: number;
  target_2?: number;
  target_3?: number;
  risk_reward?: string;
  volume_ratio_20d?: number;
  breakout_pct?: number;
  value_relationship?: "HIGHER_VALUE" | "INSIDE_VALUE" | "LOWER_VALUE";
  gap_open_pct?: number;
  is_coiled_open?: boolean;
  upper_wick_pct?: number;
  is_solid_candle?: boolean;
  has_clear_runway?: boolean;
  clearance_pct?: number;
  is_uptrend?: boolean;
  is_gap_free_elite?: boolean;
  grade?: string;
  market_cap_cr?: number;
  market_cap_category?: string;
  avg_volume_20d?: number;
  turnover_cr: number;
  status: "BREAKOUT_ACTIVE" | "RETEST_CONFIRMED" | "SQUEEZED_AT_CPR" | "BREAKDOWN";
}

export async function fetchCPRTransitions(
  timeframe: "hourly" | "daily" | "weekly" | "monthly" = "monthly",
  min_turnover_cr: number = 1.0,
  min_marketcap_cr: number = 1000.0,
  min_price: number = 30.0,
  limit: number = 50,
  filter_mode: "elite_only" | "breakout_only" | "retest_only" | "coiled_only" | "all" = "elite_only"
): Promise<CPRTransitionItem[]> {
  return fetchJson<CPRTransitionItem[]>(
    `/scanner/cpr/transitions?timeframe=${timeframe}&min_turnover_cr=${min_turnover_cr}&min_marketcap_cr=${min_marketcap_cr}&min_price=${min_price}&filter_mode=${filter_mode}&limit=${limit}`,
    { timeoutMs: 30000 }
  );
}


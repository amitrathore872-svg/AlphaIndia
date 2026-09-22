/**
 * Delivery Breakout & Institutional Radar API Client
 * Alpha India - 2-Year Empirically Backtested Radar
 */

import { fetchJson } from "@/lib/apiConfig";

export interface TradeBlueprint {
  entry_price: number;
  stop_loss: number;
  target_1: number;
  target_2: number;
  risk_pct: number;
  reward_pct: number;
  rr_ratio: string;
  recommended_slot_allocation: string;
  holding_horizon: string;
  trail_rule: string;
}

export interface DeliveryOpportunity {
  symbol: string;
  company_name: string;
  sector: string;
  signal_date: string;
  current_price: number;
  day_change_pct: number;
  turnover_cr: number;
  delivery_per: number;
  delivery_spike_x: number;
  vol_dryup_ratio: number;
  rsi_14: number;
  "50d_high": number;
  pivot_distance_pct: number;
  is_50d_breakout: boolean;
  setup_type: "50D_BREAKOUT" | "NEAR_PIVOT_BASE";
  conviction_score: number;
  conviction_tier: "ELITE_ACCUMULATION" | "HIGH_CONVICTION" | "DEVELOPING_SETUP";
  blueprint: TradeBlueprint;
}

export interface DeliveryRadarMetadata {
  latest_session_date: string;
  total_scanned_symbols: number;
  qualifying_setups_count: number;
  elite_setups_count: number;
  confirmed_breakouts_count: number;
  near_pivot_count: number;
  scan_duration_seconds: number;
  backtest_proven_stats: {
    profit_factor: number;
    cagr_2y: number;
    max_drawdown: number;
    sharpe: number;
    risk_reward: string;
  };
}

export interface DeliveryOpportunitiesResponse {
  metadata: DeliveryRadarMetadata;
  total_count: number;
  page: number;
  limit: number;
  total_pages: number;
  items: DeliveryOpportunity[];
}

export interface DeliveryOpportunitiesParams {
  lookback_sessions?: number;
  min_spike?: number;
  min_deliv_per?: number;
  search?: string;
  sector?: string;
  setup_type?: string;
  min_conviction?: number;
  sort_by?: string;
  sort_order?: string;
  page?: number;
  limit?: number;
}

export async function fetchDeliveryOpportunities(
  params: DeliveryOpportunitiesParams = {}
): Promise<DeliveryOpportunitiesResponse> {
  const query = new URLSearchParams();
  if (params.lookback_sessions) query.append("lookback_sessions", String(params.lookback_sessions));
  if (params.min_spike !== undefined) query.append("min_spike", String(params.min_spike));
  if (params.min_deliv_per !== undefined) query.append("min_deliv_per", String(params.min_deliv_per));
  if (params.search) query.append("search", params.search);
  if (params.sector) query.append("sector", params.sector);
  if (params.setup_type) query.append("setup_type", params.setup_type);
  if (params.min_conviction !== undefined) query.append("min_conviction", String(params.min_conviction));
  if (params.sort_by) query.append("sort_by", params.sort_by);
  if (params.sort_order) query.append("sort_order", params.sort_order);
  if (params.page) query.append("page", String(params.page));
  if (params.limit) query.append("limit", String(params.limit));

  return fetchJson<DeliveryOpportunitiesResponse>(`/api/v1/delivery-radar/opportunities?${query.toString()}`);
}

export async function triggerDeliveryScan(
  params: { lookback_sessions?: number; min_spike?: number; min_deliv_per?: number } = {}
): Promise<{ message: string; metadata: DeliveryRadarMetadata; total_opportunities: number }> {
  const query = new URLSearchParams();
  if (params.lookback_sessions) query.append("lookback_sessions", String(params.lookback_sessions));
  if (params.min_spike) query.append("min_spike", String(params.min_spike));
  if (params.min_deliv_per) query.append("min_deliv_per", String(params.min_deliv_per));

  return fetchJson(`/api/v1/delivery-radar/scan?${query.toString()}`, { method: "POST" });
}

export async function fetchDeliveryStats(): Promise<DeliveryRadarMetadata> {
  return fetchJson<DeliveryRadarMetadata>("/api/v1/delivery-radar/stats");
}

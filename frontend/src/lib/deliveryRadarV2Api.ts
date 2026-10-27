/**
 * Delivery Radar 2.0 API Client
 * Alpha India - Free Float Absorption & Multi-Day Trend Radar
 */

import { fetchJson } from "@/lib/apiConfig";

export interface TradeBlueprint {
  entry_corridor_min: number;
  entry_corridor_max: number;
  stop_loss: number;
  risk_pct: number;
  breakeven_trigger: number;
  breakeven_gain_pct: number;
  target_1: number;
  target_1_gain_pct: number;
  target_2: number;
  target_2_gain_pct: number;
  rr_ratio: string;
  suggested_holding_days: string;
  execution_protocol: string;
}

export interface MarketRegime {
  status: "BULLISH" | "DEFENSIVE" | string;
  label: string;
  breadth_pct: number;
  recommendation: string;
}

export interface DeliveryV2Opportunity {
  symbol: string;
  company_name: string;
  sector: string;
  current_price: number;
  day_change_pct: number;
  market_cap_cr: number;
  free_float_pct: number;
  free_float_mcap_cr: number;
  promoter_holding: number;
  float_absorb_1d_pct: number;
  float_absorb_5d_pct: number;
  float_absorb_10d_pct: number;
  net_deliv_cr_5d: number;
  net_deliv_cr_10d: number;
  delivery_per: number;
  delivery_spike_x: number;
  deliv_days_5d: number;
  deliv_days_10d: number;
  deliv_flow_10d: number;
  buyer_demand_ratio: number;
  vol_dryup_ratio: number;
  range_contraction: number;
  ticket_spike: number;
  pivot_distance_pct: number;
  dist_to_ema20_pct?: number;
  peak_drawdown_20d?: number;
  ema_20?: number;
  vol_expansion_3d?: number;
  vol_expansion_5d?: number;
  turnover_expansion_3d?: number;
  turnover_expansion_5d?: number;
  return_3d_pct?: number;
  return_5d_pct?: number;
  is_multi_day_expansion?: boolean;
  archetype: "VOLUME_EXPANSION_SURGE" | "ASYMMETRIC_COIL" | "STEALTH_FLOAT_LOCK" | "COIL_SUPPLY_EXHAUSTION" | "BREAKOUT_EXPANSION" | "CLIMAX_SHOCK_WARNING" | "MULTI_DAY_ACCUMULATION" | string;
  archetype_label: string;
  badge_color: string;
  trigger_status?: "EXPANSION_BUY" | "ASYMMETRIC_BUY" | "BUY_TRIGGERED" | "COILING_WATCHLIST" | "CLIMAX_AVOID" | string;
  trigger_status_label?: string;
  status_badge_color?: string;
  institutional_verdict: string;
  conviction_score: number;
  is_climax_shock: boolean;
  is_sweetspot_demand: boolean;
  is_asymmetric_coil?: boolean;
  blueprint?: TradeBlueprint;
}

export interface DeliveryV2Metadata {
  latest_session_date?: string;
  total_scanned_symbols?: number;
  qualifying_setups_count?: number;
  asymmetric_coil_count?: number;
  volume_expansion_count?: number;
  buy_triggered_count?: number;
  coiling_count?: number;
  climax_avoid_count?: number;
  stealth_lock_count?: number;
  coil_dryup_count?: number;
  breakout_expansion_count?: number;
  climax_warnings_count?: number;
  sweetspot_demand_count?: number;
  market_regime?: MarketRegime;
  scan_duration_seconds?: number;
  algorithm_version?: string;
}

export interface DeliveryV2Response {
  timestamp: number;
  metadata: DeliveryV2Metadata;
  total: number;
  page: number;
  limit: number;
  opportunities: DeliveryV2Opportunity[];
}

export async function fetchDeliveryV2Opportunities(params: {
  min_float_mcap?: number;
  min_float_absorb_5d?: number;
  archetype?: string;
  trigger_status?: string;
  sweetspot_only?: boolean;
  sort_by?: string;
  sort_order?: string;
  page?: number;
  limit?: number;
}): Promise<DeliveryV2Response> {
  const query = new URLSearchParams();
  if (params.min_float_mcap !== undefined) query.set("min_float_mcap", params.min_float_mcap.toString());
  if (params.min_float_absorb_5d !== undefined) query.set("min_float_absorb_5d", params.min_float_absorb_5d.toString());
  if (params.trigger_status && params.trigger_status !== "ALL") query.set("trigger_status", params.trigger_status);
  if (params.archetype && params.archetype !== "ALL") query.set("archetype", params.archetype);
  if (params.sweetspot_only) query.set("sweetspot_only", "true");
  if (params.sort_by) query.set("sort_by", params.sort_by);
  if (params.sort_order) query.set("sort_order", params.sort_order);
  if (params.page) query.set("page", params.page.toString());
  if (params.limit) query.set("limit", params.limit.toString());

  return fetchJson<DeliveryV2Response>(`/api/v1/delivery-radar-v2/opportunities?${query.toString()}`);
}

export async function fetchDeliveryV2Stats(): Promise<{ timestamp: number; metadata: DeliveryV2Metadata; total_opportunities: number }> {
  return fetchJson<{ timestamp: number; metadata: DeliveryV2Metadata; total_opportunities: number }>("/api/v1/delivery-radar-v2/stats");
}

export async function triggerDeliveryV2Scan(params: { min_float_mcap?: number; min_float_absorb_5d?: number }): Promise<any> {
  const query = new URLSearchParams();
  if (params.min_float_mcap) query.set("min_float_mcap", params.min_float_mcap.toString());
  if (params.min_float_absorb_5d) query.set("min_float_absorb_5d", params.min_float_absorb_5d.toString());
  return fetchJson(`/api/v1/delivery-radar-v2/scan?${query.toString()}`, { method: "POST" });
}

export async function fetchSymbolFloatProfile(symbol: string): Promise<{ symbol: string; profile: DeliveryV2Opportunity }> {
  return fetchJson(`/api/v1/delivery-radar-v2/float-profile/${symbol}`);
}

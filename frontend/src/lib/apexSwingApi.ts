/**
 * Alpha India — Apex Swing Sniper API Client
 * Official Sprint 40
 * Combines Delivery Radar, PEAD, Concalls, Brokerages, MF Absorption, and Risk Shields.
 */

import { fetchJson } from "@/lib/apiConfig";

export interface GapMetrics {
  open_price: number;
  prev_close: number;
  gap_pct: number;
  gap_type: "GAP_AND_GO" | "BREAKAWAY_GAP" | "RUNAWAY_GAP" | "GAP_DOWN" | "NORMAL_OPEN";
  chase_margin_pct: number;
  chase_status: "IN_CORRIDOR" | "NEAR_CEILING" | "OVEREXTENDED";
  room_to_chase_rupees: number;
}

export interface DiamondCatalyst {
  archetype: string;
  headline: string;
  metric_highlight: string;
  conviction_tier: string;
  diamond_score: number;
  verbatim_quote?: string | null;
}

export interface ApexSwingBlueprint {
  entry_price: number;
  buy_corridor_min: number;
  buy_corridor_max: number;
  max_chase_price: number;
  stop_loss: number;
  risk_pct: number;
  target_1: number;
  target_2: number;
  target_3: number;
  reward_pct_t1: number;
  reward_pct_t2: number;
  reward_pct_t3: number;
  rr_ratio: string;
  trail_rule: string;
  holding_horizon: string;
}

export interface OrderFlowMetrics {
  delivery_spike_x: number;
  delivery_per: number;
  buyer_demand_ratio: number;
  turnover_cr: number;
  setup_type: string;
}

export interface ThesesBreakdown {
  catalyst: string;
  sponsorship: string;
  street_consensus: string;
  order_flow: string;
}

export interface ApexSwingTicket {
  symbol: string;
  company_name: string;
  sector: string;
  market_cap_cr: number;
  current_price: number;
  open_price?: number;
  prev_close?: number;
  day_change_pct: number;
  dist_52w_high_pct?: number;
  high_52_week?: number;
  conviction_score: number;
  conviction_tier: "APEX_SNIPER" | "HIGH_SWING" | "ACCUMULATE";
  archetype: "RUNAWAY_CATALYST" | "TRIPLE_ALPHA_PEAD" | "ORDER_WIN_CATALYST" | "STEALTH_FLOAT_COIL" | "EMA20_DEFENDER" | "CONSENSUS_RE_RATING" | "MOMENTUM_DRIFT";
  archetype_label: string;
  win_rate_expectation: string;
  macro_regime: string;
  recommended_sizing_multiplier: number;
  event_shield_passed: boolean;
  next_earnings_risk: string;
  execution_blueprint: ApexSwingBlueprint;
  gap_metrics: GapMetrics;
  order_flow_metrics: OrderFlowMetrics;
  diamond_catalyst?: DiamondCatalyst | null;
  theses: ThesesBreakdown;
  sparkline?: number[];
  dma_50?: number;
}

export interface MacroTelemetry {
  market_bias: string;
  regime_score: number;
  risk_level: string;
  sizing_multiplier: number;
  nifty_trend: string;
  total_apex_setups: number;
  avg_risk_reward: string;
  blacklisted_event_count: number;
}

export interface FunnelStats {
  universe_scanned: number;
  passed_liquidity: number;
  passed_event_shield: number;
  passed_extension_filter: number;
  passed_catalyst_validation: number;
  apex_setups_selected: number;
}

export interface ApexSwingResponse {
  status: string;
  as_of_time: string;
  macro_telemetry: MacroTelemetry;
  funnel: FunnelStats;
  available_sectors?: string[];
  setups: ApexSwingTicket[];
}

export interface FetchApexSwingParams {
  archetype?: string;
  sector?: string;
  min_conviction?: number;
  search?: string;
  force_refresh?: boolean;
}

export async function fetchApexSwingSetups(
  params: FetchApexSwingParams = {}
): Promise<ApexSwingResponse> {
  const query = new URLSearchParams();
  if (params.archetype && params.archetype !== "ALL") query.append("archetype", params.archetype);
  if (params.sector && params.sector !== "ALL") query.append("sector", params.sector);
  if (params.min_conviction && params.min_conviction > 0) query.append("min_conviction", params.min_conviction.toString());
  if (params.search && params.search.trim()) query.append("search", params.search.trim());
  if (params.force_refresh) query.append("force_refresh", "true");

  const qs = query.toString();
  const endpoint = `/api/v1/apex-swing/setups${qs ? `?${qs}` : ""}`;
  return fetchJson<ApexSwingResponse>(endpoint);
}

export async function fetchSingleApexTicket(symbol: string): Promise<{ status: string; ticket: ApexSwingTicket }> {
  return fetchJson<{ status: string; ticket: ApexSwingTicket }>(`/api/v1/apex-swing/ticket/${symbol}`);
}

/**
 * Delivery Breakout & Institutional Radar API Client
 * Alpha India - 2-Year Empirically Backtested Radar
 */

import { fetchJson } from "@/lib/apiConfig";

export interface TradeBlueprint {
  entry_price: number;
  pivot_price?: number;
  buy_corridor_min?: number;
  buy_corridor_max?: number;
  max_chase_price?: number;
  buy_status?: "IN_BUY_ZONE" | "EXTENDED_WAIT_DIP" | "RETEST_CONFIRMED" | "ACCUMULATION_BASE" | string;
  stop_loss: number;
  breakeven_trigger: number;
  target_1: number;
  target_2: number;
  risk_pct: number;
  reward_pct: number;
  rr_ratio: string;
  win_rate_expectation?: string;
  recommended_slot_allocation: string;
  holding_horizon: string;
  trail_rule: string;
  market_cap_cr?: number;
  breakout_price?: number;
  breakout_date?: string;
  breakout_margin_pct?: number;
}

export interface DeliveryOpportunity {
  symbol: string;
  company_name: string;
  sector: string;
  market_cap_cr?: number;
  signal_date: string;
  current_price: number;
  day_change_pct: number;
  turnover_cr: number;
  delivery_per: number;
  delivery_spike_x: number;
  deliv_flow_20d: number;
  ticket_spike_x?: number;
  range_contraction_ratio?: number;
  deliv_cluster_5d?: number;
  roc_60d?: number;
  dist_to_ema20_pct: number;
  close_location: number;
  upper_wick_pct?: number;
  vol_dryup_ratio: number;
  rsi_14: number;
  "50d_high": number;
  breakout_price?: number;
  breakout_date?: string;
  breakout_margin_pct?: number;
  pivot_distance_pct: number;
  is_50d_breakout: boolean;
  setup_type: "50D_BREAKOUT" | "EMA20_PULLBACK" | "NEAR_PIVOT_BASE" | "CIRCUIT_LOCKED" | "PRE_CIRCUIT_SURGE" | string;
  conviction_score: number;
  conviction_tier: "APEX_SNIPER" | "ACTIVE_SWING" | "BASE_ACCUMULATION" | string;
  // Out-of-the-Box Multi-Session & Buyer Dominance Intelligence
  net_deliv_cr_5d?: number;
  net_deliv_cr_10d?: number;
  net_deliv_cr_20d?: number;
  net_deliv_cr_30d?: number;
  deliv_persist_10d?: number;
  avg_deliv_per_30d?: number;
  buyer_demand_ratio?: number;
  is_circuit_locked?: boolean;
  circuit_band?: string;
  is_pre_circuit?: boolean;
  decision_archetype?: "CIRCUIT_LOCK" | "PRE_CIRCUIT" | "STEALTH_FLOAT_LOCK" | "HIGH_BUYER_DOMINANCE" | "SUPPORT_DEFENDER" | "MOMENTUM_BREAKOUT" | "BASE_ACCUMULATION" | string;
  archetype_label?: string;
  institutional_verdict?: string;
  sparkline?: number[];
  return_90d_pct?: number;
  current_stage?: string;
  stage_code?: string;
  stage_badge?: string;
  blueprint: TradeBlueprint;
}

export interface DeliveryRadarMetadata {
  latest_session_date: string;
  total_scanned_symbols: number;
  qualifying_setups_count: number;
  apex_sniper_count?: number;
  active_swing_count?: number;
  base_accumulation_count?: number;
  confirmed_breakouts_count: number;
  ema_pullback_count?: number;
  near_pivot_count: number;
  circuit_locked_count?: number;
  pre_circuit_count?: number;
  high_buyer_count?: number;
  stealth_lock_count?: number;
  scan_duration_seconds: number;
  filters_applied?: Record<string, string>;
  backtest_proven_stats: {
    win_rate_apex?: string;
    win_rate_swing?: string;
    profit_factor: number;
    avg_net_pnl?: string;
    cagr_2y?: number;
    max_drawdown?: number;
    be_lock_efficiency?: string;
    sharpe?: number;
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
  tier?: string;
  setup_type?: string;
  archetype?: string;
  min_buyer_ratio?: number;
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
  if (params.tier) query.append("tier", params.tier);
  if (params.setup_type) query.append("setup_type", params.setup_type);
  if (params.archetype) query.append("archetype", params.archetype);
  if (params.min_buyer_ratio !== undefined) query.append("min_buyer_ratio", String(params.min_buyer_ratio));
  if (params.min_conviction !== undefined) query.append("min_conviction", String(params.min_conviction));
  if (params.sort_by) query.append("sort_by", params.sort_by);
  if (params.sort_order) query.append("sort_order", params.sort_order);
  if (params.page) query.append("page", String(params.page));
  if (params.limit) query.append("limit", String(params.limit));

  return fetchJson<DeliveryOpportunitiesResponse>(
    `/api/v1/delivery-radar/opportunities?${query.toString()}`,
    { timeoutMs: 60000 }
  );
}

export interface LiveBuyerRatioResponse {
  symbol: string;
  cmp: number;
  day_change_pct: number;
  total_buy_quantity: number;
  total_sell_quantity: number;
  buyer_ratio: number;
  seller_ratio: number;
  is_upper_circuit_locked: boolean;
  source: string;
  status: string;
  error?: string;
}

export async function fetchLiveBuyerRatio(symbol: string): Promise<LiveBuyerRatioResponse> {
  return fetchJson<LiveBuyerRatioResponse>(
    `/api/v1/delivery-radar/live-buyer-ratio/${encodeURIComponent(symbol)}`,
    { timeoutMs: 15000 }
  );
}

export async function triggerDeliveryScan(
  params: { lookback_sessions?: number; min_spike?: number; min_deliv_per?: number } = {}
): Promise<{ message: string; metadata: DeliveryRadarMetadata; total_opportunities: number }> {
  const query = new URLSearchParams();
  if (params.lookback_sessions) query.append("lookback_sessions", String(params.lookback_sessions));
  if (params.min_spike) query.append("min_spike", String(params.min_spike));
  if (params.min_deliv_per) query.append("min_deliv_per", String(params.min_deliv_per));

  return fetchJson(`/api/v1/delivery-radar/scan?${query.toString()}`, {
    method: "POST",
    timeoutMs: 60000,
  });
}

export async function fetchDeliveryStats(): Promise<DeliveryRadarMetadata> {
  return fetchJson<DeliveryRadarMetadata>("/api/v1/delivery-radar/stats", {
    timeoutMs: 60000,
  });
}

export interface DeliveryDayNode {
  date: string;
  day_label: string;
  day_name: string;
  open: number;
  high: number;
  low: number;
  close: number;
  return_pct: number;
  drawdown_from_month_peak_pct: number;
  drawdown_from_week_high_pct: number;
  delivery_per: number;
  delivery_qty: number;
  delivery_spike_x: number;
  turnover_cr: number;
  delivery_turnover_cr: number;
  is_green: boolean;
  candle_type: string;
  candle_label: string;
  candle_color: string;
}

export interface DeliveryWeekNode {
  week_index: number;
  week_key: string;
  week_label: string;
  start_date: string;
  end_date: string;
  week_open: number;
  week_close: number;
  week_high: number;
  week_low: number;
  week_return_pct: number;
  week_drawdown_pct: number;
  avg_delivery_per: number;
  total_delivery_cr: number;
  green_days_count: number;
  red_days_count: number;
  net_flow_bias: "ACCUMULATION" | "CONSOLIDATION" | string;
  days: DeliveryDayNode[];
}

export interface DeliveryMonthSummary {
  start_date: string;
  end_date: string;
  start_price: number;
  end_price: number;
  month_peak_price: number;
  month_trough_price: number;
  month_return_pct: number;
  month_max_drawdown_pct: number;
  current_drawdown_from_peak_pct: number;
  total_delivery_cr: number;
  avg_delivery_per: number;
  delivery_clusters_55_count: number;
  green_days_count: number;
  red_days_count: number;
  delivery_flow_imbalance_ratio: number;
  range_squeeze_ratio: number;
  blast_status: string;
  blast_badge: string;
  blast_description: string;
}

export interface DeliveryTreeResponse {
  symbol: string;
  lookback_sessions: number;
  month_summary: DeliveryMonthSummary;
  weeks: DeliveryWeekNode[];
}

export async function fetchDeliveryTreeBreakdown(
  symbol: string,
  lookbackSessions: number = 30
): Promise<DeliveryTreeResponse> {
  return fetchJson<DeliveryTreeResponse>(
    `/api/v1/delivery-radar/tree-breakdown?symbol=${encodeURIComponent(symbol)}&lookback_sessions=${lookbackSessions}`,
    { timeoutMs: 30000 }
  );
}

export interface BhavcopySyncStatus {
  status: "UP_TO_DATE" | "PENDING_SYNC" | "SYNCING" | string;
  is_up_to_date: boolean;
  latest_bhavcopy_date: string;
  latest_bhavcopy_display: string;
  last_sync_time: string;
  last_sync_display: string;
  total_sessions: number;
  is_syncing: boolean;
  market_bhavcopy_ready: boolean;
  today_date: string;
  message?: string;
  downloaded_count?: number;
  success?: boolean;
}

export async function fetchBhavcopyStatus(): Promise<BhavcopySyncStatus> {
  return fetchJson<BhavcopySyncStatus>("/api/v1/delivery-radar/bhavcopy/status", {
    timeoutMs: 15000,
  });
}

export async function triggerBhavcopySync(force: boolean = true): Promise<BhavcopySyncStatus> {
  return fetchJson<BhavcopySyncStatus>(`/api/v1/delivery-radar/bhavcopy/sync?force=${force}`, {
    method: "POST",
    timeoutMs: 45000,
  });
}



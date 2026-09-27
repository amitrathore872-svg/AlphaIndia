import { fetchJson } from "@/lib/apiConfig";

export interface DhanStatus {
  configured: boolean;
  trading_api_active: boolean;
  data_api_subscribed: boolean;
  client_id?: string;
  message: string;
}

export interface IntradaySetup {
  symbol: string;
  company_name: string;
  sector: string;
  cmp: number;
  day_change_pct: number;
  funnel_stage: string;
  conviction_score: number;
  conviction_tier: string;
  // CPR
  cpr_width_pct: number;
  is_narrow_cpr: boolean;
  is_super_narrow: boolean;
  pivot: number;
  cpr_top: number;
  cpr_bottom: number;
  r1: number;
  r2: number;
  s1: number;
  s2: number;
  // 15M ORB
  orb_high: number;
  orb_low: number;
  orb_range_pct: number;
  orb_body_ratio: number;
  gap_pct: number;
  rs_vs_nifty: number;
  // Indicators
  vwap: number;
  vwap_dist_pct: number;
  rvol: number;
  has_orb_break: boolean;
  holds_above_vwap: boolean;
  // Execution Plan
  trigger_entry: number;
  stop_loss: number;
  target_1: number;
  target_2: number;
  risk_per_share: number;
  risk_reward: number;
  tradingview_url: string;
  source: string;
}

export interface FunnelMetrics {
  total_universe: number;
  stage_1_narrow_cpr_count: number;
  stage_2_sector_aligned_count: number;
  stage_3_triggered_count: number;
  stage_4_qualified_count: number;
  stage_5_elite_count: number;
}

export interface ApexSniperTrade {
  active: boolean;
  status: "ACTIVE_TRADE" | "CAPITAL_PRESERVED" | "WAITING_TRIGGER";
  symbol?: string;
  company_name?: string;
  sector?: string;
  cmp?: number;
  day_change_pct?: number;
  setup_type?: string;
  historical_win_rate?: string;
  profit_factor?: number;
  conviction_score?: number;
  entry_price?: number;
  stop_loss?: number;
  target_1?: number;
  target_2?: number;
  risk_pct?: number;
  risk_reward?: string;
  rules?: {
    float_lock: string;
    open_low_drive: string;
    profit_lock: string;
    overnight_carry: string;
  };
  headline?: string;
  reason?: string;
  summary?: string;
}

export interface PremarketImbalance {
  symbol: string;
  company_name: string;
  sector: string;
  prev_close: number;
  indicative_open: number;
  cmp: number;
  gap_pct: number;
  imbalance_ratio: number;
  buy_quantity_pct: number;
  sell_quantity_pct: number;
  imbalance_tier: "HEAVY_ACCUMULATION" | "MODERATE_DEMAND" | "BALANCED" | "DISTRIBUTION";
  order_deficit: boolean;
  action_recommendation: string;
}

export interface SniperWatchlistCandidate {
  symbol: string;
  company_name: string;
  sector: string;
  cmp: number;
  day_change_pct: number;
  is_nr4: boolean;
  is_inside_day: boolean;
  contraction_type: string;
  open_equals_low: boolean;
  open_low_wick_pct: number;
  vwap: number;
  above_vwap: boolean;
  historical_win_rate: string;
  profit_factor: number;
  expectancy: string;
  action_status: "ARMED_TRIGGER" | "MONITORING_PULLBACK" | "COILED_WATCH" | "NO_SETUP";
  yest_high: number;
  yest_low: number;
  yest_range: number;
  today_open: number;
  tradingview_url: string;
}

export interface FunnelStatusResponse {
  last_scanned_at: string;
  data_source: string;
  dhan_connection: DhanStatus;
  nifty_benchmark: {
    cmp: number;
    day_change_pct: number;
    is_bullish: boolean;
  };
  apex_sniper_trade_of_the_day?: ApexSniperTrade;
  sniper_watchlist?: SniperWatchlistCandidate[];
  premarket_auction_imbalances?: PremarketImbalance[];
  funnel_metrics: FunnelMetrics;
  elite_picks: IntradaySetup[];
  all_setups: IntradaySetup[];
  narrow_cpr_watchlist: Array<{
    symbol: string;
    sector: string;
    cpr_width_pct: number;
    pivot: number;
    r1: number;
    s1: number;
  }>;
}

export async function fetchFunnelStatus(forceRefresh = false): Promise<FunnelStatusResponse> {
  const query = forceRefresh ? "?force_refresh=true" : "";
  return fetchJson<FunnelStatusResponse>(`/live-intraday/funnel-status${query}`);
}

export async function triggerFunnelScan(): Promise<{
  status: string;
  message: string;
  funnel_metrics: FunnelMetrics;
  elite_picks_count: number;
}> {
  return fetchJson<{
    status: string;
    message: string;
    funnel_metrics: FunnelMetrics;
    elite_picks_count: number;
  }>(`/live-intraday/scan`, { method: "POST" });
}

export async function broadcastTelegramAlert(symbol: string): Promise<{
  status: string;
  symbol: string;
  message: string;
}> {
  return fetchJson<{
    status: string;
    symbol: string;
    message: string;
  }>(`/live-intraday/broadcast-telegram/${encodeURIComponent(symbol)}`, { method: "POST" });
}

export async function fetchDhanStatus(): Promise<DhanStatus> {
  return fetchJson<DhanStatus>(`/live-intraday/dhan-status`);
}

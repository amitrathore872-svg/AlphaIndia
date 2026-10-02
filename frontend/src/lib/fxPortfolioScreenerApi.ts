// frontend/src/lib/fxPortfolioScreenerApi.ts
import { API_BASE } from "./apiConfig";

export interface FxIndicatorDetail {
  name: string;
  category: string;
  value: number;
  status: string;
  is_bullish: boolean;
  display: string;
  weight: number;
}

export interface FxTradeLevels {
  buy_zone_min: number;
  buy_zone_max: number;
  buy_zone_display: string;
  stop_loss: number;
  target_1: number;
  target_2: number;
  risk_per_share: number;
  reward_per_share: number;
  risk_pct: number;
  target_1_gain_pct: number;
  target_2_gain_pct: number;
  reward_risk_ratio: string;
  rr_number: number;
}

export interface FxTopExhaustion {
  probability: number;
  is_exhaustion: boolean;
  reasons: string[];
}

export interface FxPortfolioContext {
  quantity: number;
  avg_buy_price: number;
  invested_value: number;
  current_value: number;
  unrealized_pnl: number;
  unrealized_pnl_pct: number;
  core_shares: number;
  swing_shares: number;
}

export interface FxWatchlistContext {
  confidence_score: number;
  comment?: string | null;
  target_price?: number | null;
}

export interface FxFastScalpData {
  is_scalp_ready: boolean;
  ema_stack: string;
  support_tested: string;
  reversal_bar: string;
  supertrend_green: boolean;
  scalp_target: number;
  scalp_stop: number;
  scalp_gain_pct: number;
  scalp_risk_pct: number;
  max_hold_days: string;
  expected_win_rate: number;
  verdict: "FAST_SCALP_BUY" | "SCALP_TAKE_PROFIT" | "SCALP_STOP_OUT" | "WAIT_FOR_DIP" | string;
}

export interface FxFastScalpSummary {
  scalp_ready_count: number;
  ema_stack_aligned_count: number;
  supertrend_green_count: number;
  avg_scalp_gain_pct: number;
  avg_scalp_risk_pct: number;
  expected_win_rate: number;
  avg_holding_days: number;
}

export interface FxPortfolioStock {
  symbol: string;
  company_name: string;
  sector: string;
  industry: string;
  cmp: number;
  day_change: number;
  day_change_pct: number;
  signal:
    | "STRONG_BUY"
    | "BUY"
    | "ACCUMULATE_DIP"
    | "HOLD_TREND"
    | "HOLD_WATCH"
    | "TRIM_PROFIT_50%"
    | "STRONG_SELL"
    | "STOP_LOSS_EXIT";
  badge_color: string;
  confluence_score: number;
  bullish_fx_count: number;
  total_fx_count: number;
  headline: string;
  action_text: string;
  recommended_swing_pct: number;
  fast_scalp?: FxFastScalpData;
  trade_levels: FxTradeLevels;
  top_exhaustion: FxTopExhaustion;
  fx_indicators: Record<string, FxIndicatorDetail>;
  portfolio_context?: FxPortfolioContext | null;
  watchlist_context?: FxWatchlistContext | null;
}

export interface FxPortfolioOption {
  id: number;
  name: string;
  holdings_count: number;
  color: string;
}

export interface FxWatchlistOption {
  id: number;
  name: string;
  items_count: number;
  color: string;
}

export interface FxScreenerKpi {
  total_holdings_count: number;
  filtered_count: number;
  strong_buy_count: number;
  buy_count: number;
  accumulate_count: number;
  hold_count: number;
  trim_profit_count: number;
  sell_count: number;
  avg_confluence_score: number;
  total_invested: number;
  current_portfolio_value: number;
  total_unrealized_pnl: number;
  total_unrealized_pnl_pct: number;
}

export interface FxIndicatorMeta {
  id: string;
  name: string;
  category: string;
  description: string;
}

export interface FxPortfolioScreenerResponse {
  source: "portfolio" | "watchlist";
  strategy_mode?: "swing" | "fast_scalp";
  portfolio?: {
    id?: number;
    name?: string;
    description?: string;
    benchmark?: string;
    cash_balance?: number;
    color?: string;
  };
  watchlist?: {
    id?: number;
    name?: string;
    description?: string;
    color?: string;
    items_count?: number;
  };
  portfolios_list: FxPortfolioOption[];
  watchlists_list: FxWatchlistOption[];
  kpis: FxScreenerKpi;
  fast_scalp_summary?: FxFastScalpSummary;
  fx_indicator_names: FxIndicatorMeta[];
  stocks: FxPortfolioStock[];
}

export async function fetchFxPortfolioScreener(params?: {
  source?: "portfolio" | "watchlist";
  strategy_mode?: "swing" | "fast_scalp";
  portfolio_id?: number;
  watchlist_id?: number;
  signal_filter?: string;
  min_confluence?: number;
  sort_by?: string;
  sort_order?: string;
}): Promise<FxPortfolioScreenerResponse> {
  const q = new URLSearchParams();
  if (params?.source) q.set("source", params.source);
  if (params?.strategy_mode) q.set("strategy_mode", params.strategy_mode);
  if (params?.portfolio_id) q.set("portfolio_id", String(params.portfolio_id));
  if (params?.watchlist_id) q.set("watchlist_id", String(params.watchlist_id));
  if (params?.signal_filter && params.signal_filter !== "ALL") q.set("signal_filter", params.signal_filter);
  if (params?.min_confluence) q.set("min_confluence", String(params.min_confluence));
  if (params?.sort_by) q.set("sort_by", params.sort_by);
  if (params?.sort_order) q.set("sort_order", params.sort_order);

  const url = `${API_BASE}/portfolio/fx-swing-screener${q.toString() ? `?${q.toString()}` : ""}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch FX portfolio screener: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchFxStockDiagnostic(symbol: string): Promise<FxPortfolioStock> {
  const url = `${API_BASE}/portfolio/fx-swing-screener/diagnostic/${encodeURIComponent(symbol)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch FX diagnostic for ${symbol}: ${res.statusText}`);
  }
  return res.json();
}

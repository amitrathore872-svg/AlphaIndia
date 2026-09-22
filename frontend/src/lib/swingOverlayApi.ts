// frontend/src/lib/swingOverlayApi.ts
import { API_BASE } from "./apiConfig";

export interface StructureLevels {
  last_swing_high: number;
  last_swing_low: number;
  swing_range: number;
  golden_pocket_min: number;
  golden_pocket_max: number;
  buy_zone: string;
  stop_loss: number;
  target_1: number;
  target_2: number;
  reward_risk: string;
}

export interface TopExhaustionInfo {
  probability: number;
  is_exhaustion: boolean;
  reasons: string[];
}

export interface IndicatorDNA {
  best_indicator: string;
  weights: Record<string, number>;
}

export interface HoldingDetails {
  total_shares: number;
  avg_buy_price: number;
  core_shares: number;
  swing_shares: number;
  unrealized_bnh_pnl: number;
}

export interface SwingOpportunityCard {
  symbol: string;
  cmp: number;
  status: string; // BUY_READY, PROFIT_EXHAUSTION_SELL, ACCUMULATE_DIP, PULLBACK_WATCH, DOWNTREND_PAUSED
  badge_color: string;
  headline: string;
  action: string;
  quant_score: number;
  recommended_swing_pct: number;
  daily_trend_up: boolean;
  supertrend: {
    state: string;
    value: number;
    is_green: boolean;
  };
  ema20: number;
  ema50: number;
  rsi: number;
  atr: number;
  vol_ratio: number;
  structure: StructureLevels;
  top_exhaustion: TopExhaustionInfo;
  indicator_dna: IndicatorDNA;
  holding_details?: HoldingDetails | null;
}

export interface SwingKPIs {
  active_swing_alpha_cash: number;
  active_swing_alpha_pct: number;
  global_win_rate: number;
  profit_factor: number;
  reward_risk: string;
  monitored_stocks_count: number;
  buy_ready_count: number;
  exhaustion_sell_count: number;
  total_invested: number;
  current_portfolio_value: number;
  bnh_pnl: number;
  bnh_pnl_pct: number;
}

export interface SwingDashboardResponse {
  source: string;
  portfolio: {
    id?: number;
    name?: string;
    benchmark?: string;
    cash_balance?: number;
  };
  kpi: SwingKPIs;
  opportunities: SwingOpportunityCard[];
}

export interface SwingBacktestResponse {
  symbol: string;
  cmp: number;
  total_trades: number;
  wins_count: number;
  losses_count: number;
  win_rate: number;
  profit_factor: number;
  avg_win_pct: number;
  avg_loss_pct: number;
  reward_risk: number;
  net_cumulative_return_pct: number;
  best_dna: string;
  indicator_weights: Record<string, number>;
  equity_curve: number[];
  recent_trades: Array<{
    entry_time: string;
    exit_time: string;
    entry_price: number;
    exit_price: number;
    gain_pct: number;
    tag: string;
    holding_bars: number;
  }>;
}

export async function fetchSwingDashboard(
  source: string = "holdings",
  portfolioId?: number,
  watchlistId?: number
): Promise<SwingDashboardResponse> {
  const params = new URLSearchParams({ source });
  if (portfolioId) params.append("portfolio_id", portfolioId.toString());
  if (watchlistId) params.append("watchlist_id", watchlistId.toString());

  const res = await fetch(`${API_BASE}/swing-overlay/dashboard?${params.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch swing dashboard: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchStockDiagnostic(symbol: string): Promise<SwingOpportunityCard> {
  const res = await fetch(`${API_BASE}/swing-overlay/diagnostic/${encodeURIComponent(symbol)}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch diagnostic for ${symbol}: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchStockBacktest(
  symbol: string,
  period: string = "90d"
): Promise<SwingBacktestResponse> {
  const res = await fetch(
    `${API_BASE}/swing-overlay/backtest/${encodeURIComponent(symbol)}?period=${encodeURIComponent(period)}`,
    { cache: "no-store" }
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch backtest for ${symbol}: ${res.statusText}`);
  }
  return res.json();
}

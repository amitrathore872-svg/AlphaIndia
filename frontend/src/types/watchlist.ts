// =======================================================
// Alpha India Watchlist Types
// Multi-Watchlist, Confidence Ranking (1-5), and Comments
// =======================================================

export interface WatchlistSummary {
  id: number;
  name: string;
  description: string;
  color: string;
  is_default: boolean;
  items_count: number;
  avg_confidence: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface WatchlistItem {
  id: number;
  watchlist_id: number;
  symbol: string;
  company_name: string;
  confidence_score: number; // 1 to 5
  comment: string;
  target_price: number | null;
  added_at: string | null;
  updated_at: string | null;

  // Live Fundamentals
  current_price: number | null;
  sector: string;
  industry: string;
  exchange: string;
  market_cap: number | null;
  market_cap_category: string;
  stock_pe: number | null;
  roce: number | null;
  roe: number | null;
  sales_growth_3yr: number | null;
  profit_growth_3yr: number | null;
  return_3m: number | null;
  return_1y: number | null;
  dma_50: number | null;
  dma_200: number | null;
  ai_score: number | null;
}

export interface WatchlistDetailResponse {
  success: boolean;
  watchlist: WatchlistSummary;
  summary: {
    items_count: number;
    avg_confidence: number;
    avg_roce: number | null;
    high_conviction_count: number;
  };
  items: WatchlistItem[];
}

export interface StockSearchResult {
  symbol: string;
  company_name: string;
  sector: string;
  exchange: string;
  current_price: number | null;
  roce: number | null;
  stock_pe: number | null;
  market_cap: number | null;
}

export interface CreateWatchlistPayload {
  name: string;
  description?: string;
  color?: string;
}

export interface AddStockPayload {
  symbol: string;
  company_name?: string;
  confidence_score?: number;
  comment?: string;
  target_price?: number;
}

export interface UpdateStockPayload {
  confidence_score?: number;
  comment?: string;
  target_price?: number;
}

export interface WatchlistAlertItem {
  id: number;
  watchlist_id: number;
  user_id: number | null;
  symbol: string;
  rule_type: string;
  threshold_value: number | null;
  timeframe: string;
  notes: string | null;
  is_active: boolean;
  status: "ACTIVE" | "TRIGGERED" | "SNOOZED" | "MUTED";
  notify_in_app: boolean;
  notify_telegram: boolean;
  trigger_count: number;
  last_triggered_at: string | null;
  last_triggered_price: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface CreateWatchlistAlertPayload {
  symbol: string;
  rule_type: string;
  threshold_value?: number;
  timeframe?: string;
  notes?: string;
  notify_in_app?: boolean;
  notify_telegram?: boolean;
}

export interface PersonalTelegramConfig {
  id?: number;
  user_id?: number | null;
  channel_name: string;
  bot_token?: string | null;
  has_custom_bot?: boolean;
  chat_id: string;
  telegram_username?: string | null;
  is_enabled: boolean;
  is_configured: boolean;
  notify_price_cross: boolean;
  notify_dma_reclaim: boolean;
  notify_vcp_breakout: boolean;
  notify_volume_surge: boolean;
  notify_target_stop: boolean;
  notify_portfolio_buy?: boolean;
  notify_portfolio_sell?: boolean;
  notify_portfolio_rebalance?: boolean;
  notify_watchlist_buy?: boolean;
  notify_watchlist_sell?: boolean;
  min_conviction_score?: number;
  last_dispatched_at?: string | null;
  total_dispatched_count?: number;
}

export interface UpdatePersonalTelegramPayload {
  chat_id: string;
  channel_name?: string;
  bot_token?: string;
  telegram_username?: string;
  is_enabled?: boolean;
  notify_price_cross?: boolean;
  notify_dma_reclaim?: boolean;
  notify_vcp_breakout?: boolean;
  notify_volume_surge?: boolean;
  notify_target_stop?: boolean;
  notify_portfolio_buy?: boolean;
  notify_portfolio_sell?: boolean;
  notify_portfolio_rebalance?: boolean;
  notify_watchlist_buy?: boolean;
  notify_watchlist_sell?: boolean;
  min_conviction_score?: number;
}



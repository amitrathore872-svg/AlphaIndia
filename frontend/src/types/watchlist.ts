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

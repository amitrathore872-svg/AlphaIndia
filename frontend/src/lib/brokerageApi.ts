// =======================================================
// Alpha India — Institutional Brokerage Intelligence API Client
// Typed client for tracking 60+ Indian brokerage reports,
// target revisions, consensus corridors, and hit-rate scorecards.
// =======================================================

import { fetchJson } from "@/lib/apiConfig";

export interface BrokerageReportItem {
  id: number;
  symbol: string;
  company_name: string;
  sector: string;
  market_cap_category?: "LARGE_CAP" | "MID_CAP" | "SMALL_CAP" | string;
  market_cap?: number | null;
  brokerage_house: string;
  broker_tier: string;
  broker_star_rating: number;
  broker_hit_rate_pct: number;
  report_date: string | null;
  report_type: string;
  action: "UPGRADE" | "TARGET_UP" | "INITIATION" | "MAINTAINED" | "DOWNGRADE" | "EXIT" | string;
  previous_rating: string | null;
  current_rating: string;
  price_at_reco: number;
  previous_target_price: number | null;
  target_price: number;
  upside_pct: number;
  target_revision_pct: number | null;
  target_horizon?: string;
  horizon_months?: number;
  fy1_eps_est?: number | null;
  fy2_eps_est?: number | null;
  eps_revision_pct?: number | null;
  conviction_score: number;
  is_hot_pick: boolean;
  headline?: string | null;
  investment_thesis?: string | null;
  key_catalysts?: string[];
  key_risks?: string[];
  concall_grill_question?: string | null;
  concall_mgmt_answer?: string | null;
  mgmt_clarity_rating?: "HIGH" | "MEDIUM" | "EVASIVE" | string;
  target_achieved?: boolean;
  days_to_target?: number | null;
  max_gain_pct?: number;
  max_drawdown_pct?: number;
}

export interface BrokerScorecardItem {
  id: number;
  brokerage_house: string;
  tier: string;
  star_rating: number;
  specialization?: string | null;
  total_calls_tracked: number;
  calls_hit_target: number;
  hit_rate_pct: number;
  avg_days_to_target: number;
  avg_max_drawdown_pct: number;
}

export interface BrokerageFeedResponse {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  items: BrokerageReportItem[];
}

export interface HotPickItem {
  id: number;
  symbol: string;
  company_name: string;
  sector: string;
  brokerage_house: string;
  broker_star_rating: number;
  broker_hit_rate_pct: number;
  action: string;
  current_rating: string;
  price_at_reco: number;
  target_price: number;
  upside_pct: number;
  target_horizon?: string;
  horizon_months?: number;
  conviction_score: number;
  headline?: string | null;
  investment_thesis?: string | null;
  key_catalysts?: string[];
  report_date: string | null;
}

export interface StockConsensusResponse {
  symbol: string;
  has_coverage: boolean;
  company_name?: string;
  sector?: string;
  current_price?: number;
  total_reports: number;
  consensus_target: number | null;
  consensus_upside_pct: number | null;
  consensus_horizon?: string;
  target_corridor: {
    low: number | null;
    median: number | null;
    high: number | null;
  };
  ratings_breakdown: {
    buy: number;
    accumulate: number;
    hold: number;
    reduce: number;
    sell: number;
  };
  consensus_stance: string;
  avg_conviction_score: number | null;
  synthesized_thesis: {
    bull_thesis: string[];
    bear_risks: string[];
  };
  concall_highlights?: {
    question: string;
    answer: string;
    clarity_rating: string;
    broker: string;
    date: string | null;
  } | null;
  history: BrokerageReportItem[];
}

export interface BrokerageMetricsRibbon {
  total_active_calls: number;
  hot_picks_count: number;
  large_cap_count?: number;
  mid_cap_count?: number;
  small_cap_count?: number;
  avg_consensus_upside_pct: number;
  net_revision_breadth_bull_pct: number;
  top_broker_name: string;
  top_broker_hit_rate: number;
  tracked_houses_count: number;
}

// ---------------- API Methods ----------------

export async function fetchBrokerageFeed(params?: {
  page?: number;
  limit?: number;
  symbol?: string;
  brokerage_house?: string;
  broker_tier?: string;
  action?: string;
  market_cap_category?: string;
  target_horizon?: string;
  min_conviction?: number;
  is_hot_pick?: boolean;
  search?: string;
  sort_by?: string;
  sort_order?: "asc" | "desc";
}): Promise<BrokerageFeedResponse> {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.limit) q.set("limit", String(params.limit));
  if (params?.symbol) q.set("symbol", params.symbol);
  if (params?.brokerage_house) q.set("brokerage_house", params.brokerage_house);
  if (params?.broker_tier) q.set("broker_tier", params.broker_tier);
  if (params?.action) q.set("action", params.action);
  if (params?.market_cap_category && params.market_cap_category !== "ALL") {
    q.set("market_cap_category", params.market_cap_category);
  }
  if (params?.target_horizon && params.target_horizon !== "ALL") {
    q.set("target_horizon", params.target_horizon);
  }
  if (params?.min_conviction !== undefined) q.set("min_conviction", String(params.min_conviction));
  if (params?.is_hot_pick !== undefined) q.set("is_hot_pick", String(params.is_hot_pick));
  if (params?.search) q.set("search", params.search);
  if (params?.sort_by) q.set("sort_by", params.sort_by);
  if (params?.sort_order) q.set("sort_order", params.sort_order);

  const qs = q.toString();
  return fetchJson<BrokerageFeedResponse>(`/api/v1/brokerage/feed${qs ? `?${qs}` : ""}`);
}

export async function fetchHotPicks(limit: number = 6): Promise<{ status: string; count: number; data: HotPickItem[] }> {
  return fetchJson<{ status: string; count: number; data: HotPickItem[] }>(`/api/v1/brokerage/hot-picks?limit=${limit}`);
}

export async function fetchStockBrokerageConsensus(symbol: string): Promise<{ status: string; data: StockConsensusResponse }> {
  return fetchJson<{ status: string; data: StockConsensusResponse }>(`/api/v1/brokerage/stock/${encodeURIComponent(symbol)}`);
}

export async function fetchBrokerScorecards(): Promise<{ status: string; count: number; data: BrokerScorecardItem[] }> {
  return fetchJson<{ status: string; count: number; data: BrokerScorecardItem[] }>("/api/v1/brokerage/scorecards");
}

export async function fetchBrokerageMetrics(): Promise<{ status: string; data: BrokerageMetricsRibbon }> {
  return fetchJson<{ status: string; data: BrokerageMetricsRibbon }>("/api/v1/brokerage/metrics");
}

export async function triggerBrokerageIngestion(daysBack: number = 7): Promise<{
  status: string;
  total_discovered: number;
  new_reports: number;
  updated_reports: number;
}> {
  return fetchJson<{
    status: string;
    total_discovered: number;
    new_reports: number;
    updated_reports: number;
  }>(`/api/v1/brokerage/ingest?days_back=${daysBack}`, {
    method: "POST",
  });
}

export async function fetchBrokerageIngestionStatus(): Promise<{
  status: string;
  data: {
    total_reports: number;
    tracked_houses: number;
    newest_report_date: string | null;
    oldest_report_date: string | null;
    reports_last_3_days: number;
    is_feed_live: boolean;
    last_ingested_at: string;
  };
}> {
  return fetchJson<{
    status: string;
    data: {
      total_reports: number;
      tracked_houses: number;
      newest_report_date: string | null;
      oldest_report_date: string | null;
      reports_last_3_days: number;
      is_feed_live: boolean;
      last_ingested_at: string;
    };
  }>("/api/v1/brokerage/ingestion/status");
}

export interface StockConsensusGroupItem {
  symbol: string;
  company_name: string;
  sector: string;
  market_cap_category: "LARGE_CAP" | "MID_CAP" | "SMALL_CAP" | string;
  market_cap?: number | null;
  current_price: number;
  total_reports: number;
  broker_count: number;
  brokers: string[];
  consensus_target: number;
  consensus_upside_pct: number;
  target_corridor: {
    low: number;
    median: number;
    high: number;
  };
  ratings_breakdown: {
    buy: number;
    accumulate: number;
    hold: number;
    reduce: number;
    sell: number;
  };
  consensus_stance: string;
  avg_conviction_score: number;
  latest_report_date: string | null;
  reports: BrokerageReportItem[];
}

export async function fetchAllStocksConsensus(params?: {
  market_cap_category?: string;
  min_brokers?: number;
  search?: string;
  sort_by?: string;
  sort_order?: "asc" | "desc";
}): Promise<{ status: string; count: number; data: StockConsensusGroupItem[] }> {
  const q = new URLSearchParams();
  if (params?.market_cap_category && params.market_cap_category !== "ALL") {
    q.set("market_cap_category", params.market_cap_category);
  }
  if (params?.min_brokers !== undefined) q.set("min_brokers", String(params.min_brokers));
  if (params?.search) q.set("search", params.search);
  if (params?.sort_by) q.set("sort_by", params.sort_by);
  if (params?.sort_order) q.set("sort_order", params.sort_order);

  const qs = q.toString();
  return fetchJson<{ status: string; count: number; data: StockConsensusGroupItem[] }>(
    `/api/v1/brokerage/stocks-consensus${qs ? `?${qs}` : ""}`
  );
}



// frontend/src/lib/technoFundaApi.ts

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface TechnoFundaItem {
  id: number;
  symbol: string;
  company_name: string;
  sector: string;
  industry: string;
  market_cap?: number;
  market_cap_category?: string;
  current_price: number;
  dma_50?: number;
  dma_200?: number;
  pivot_reference: number;
  distance_to_pivot_pct: number;
  is_stage_2: boolean;
  rsi_14: number;
  vol_q: number;
  base_q: number;
  pattern: string;
  pattern_tag: string;
  setup_score: number;
  signal: string;
  signal_tier: string;
  signal_color: string;
  downside_reference: number;
  downside_pct: number;
  scenario_trigger: number;
  scenario_distance: number;
  target_1: number;
  target_2: number;
  risk_reward: number;
  health_score: number;
  piotroski_score?: number;
  sales_growth_ttm?: number;
  profit_growth_ttm?: number;
  roce?: number;
  stock_pe?: number;
  return_3m?: number;
  return_6m?: number;
}

export interface TechnoFundaScreenerResponse {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  items: TechnoFundaItem[];
}

export interface TechnoFundaStockAnalysis {
  symbol: string;
  company_name: string;
  sector: string;
  industry: string;
  exchange: string;
  market_cap?: number;
  market_cap_category?: string;
  tradingview_symbol: string;
  setup_status: string;
  status_desc: string;
  bullish_factors: string[];
  risk_factors: string[];
  technical: {
    current_price: number;
    dma_50?: number;
    dma_200?: number;
    pivot_reference: number;
    distance_to_pivot_pct: number;
    is_stage_2: boolean;
    rsi_14: number;
    vol_q: number;
    base_q: number;
    pattern: string;
    pattern_tag: string;
    setup_score: number;
    signal: string;
    signal_tier: string;
    signal_color: string;
    downside_reference: number;
    downside_pct: number;
    scenario_trigger: number;
    scenario_distance: number;
    target_1: number;
    target_2: number;
    risk_reward: number;
  };
  fundamentals: {
    health_score?: number;
    piotroski_score?: number;
    sales_growth_ttm?: number;
    profit_growth_ttm?: number;
    sales_growth_3yr?: number;
    profit_growth_3yr?: number;
    roce?: number;
    roe?: number;
    stock_pe?: number;
    industry_pe?: number;
    price_to_book?: number;
    debt_to_equity?: number;
    dividend_yield?: number;
    pat_12m?: number;
  };
}

export interface TechnoFundaSummary {
  total_screened: number;
  stage_2_count: number;
  stage_2_ratio_pct: number;
  top_setups: TechnoFundaItem[];
}

export async function fetchTechnoFundaScreener(params: {
  page?: number;
  limit?: number;
  search?: string;
  sector?: string;
  signal_filter?: string;
  pattern_filter?: string;
  min_health_score?: number;
  max_pivot_distance?: number;
  sort_by?: string;
  sort_order?: string;
}): Promise<TechnoFundaScreenerResponse> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", params.page.toString());
  if (params.limit) query.set("limit", params.limit.toString());
  if (params.search) query.set("search", params.search);
  if (params.sector && params.sector !== "ALL") query.set("sector", params.sector);
  if (params.signal_filter && params.signal_filter !== "ALL") query.set("signal_filter", params.signal_filter);
  if (params.pattern_filter && params.pattern_filter !== "ALL") query.set("pattern_filter", params.pattern_filter);
  if (params.min_health_score) query.set("min_health_score", params.min_health_score.toString());
  if (params.max_pivot_distance) query.set("max_pivot_distance", params.max_pivot_distance.toString());
  if (params.sort_by) query.set("sort_by", params.sort_by);
  if (params.sort_order) query.set("sort_order", params.sort_order);

  const res = await fetch(`${API_BASE}/api/techno-funda/screener?${query.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch techno-funda screener: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchTechnoFundaStock(symbol: string): Promise<TechnoFundaStockAnalysis> {
  const res = await fetch(`${API_BASE}/api/techno-funda/stock/${encodeURIComponent(symbol)}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch stock analysis for ${symbol}: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchTechnoFundaSummary(): Promise<TechnoFundaSummary> {
  const res = await fetch(`${API_BASE}/api/techno-funda/summary`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch techno-funda summary: ${res.statusText}`);
  }
  return res.json();
}

export interface CandleData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface LineDataPoint {
  time: string;
  value: number;
}

export interface TechnoFundaChartResponse {
  candles: CandleData[];
  dma_50: LineDataPoint[];
  dma_200: LineDataPoint[];
}

export async function fetchTechnoFundaCandles(
  symbol: string,
  period: string = "6mo"
): Promise<TechnoFundaChartResponse> {
  const res = await fetch(
    `${API_BASE}/api/techno-funda/chart/${encodeURIComponent(symbol)}?period=${period}`,
    {
      cache: "no-store",
    }
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch chart candles for ${symbol}: ${res.statusText}`);
  }
  return res.json();
}

export interface TomorrowOpportunity {
  symbol: string;
  company_name: string;
  sector: string;
  cmp: number;
  direction: "BULLISH UP" | "BEARISH DOWN" | "CONSOLIDATION";
  direction_tier: "BULLISH" | "BEARISH" | "NEUTRAL";
  probability: number;
  expected_move_pct: number;
  entry_trigger: number;
  target_price: number;
  stop_loss: number;
  close_location_pct: number;
  vwap: number;
  vwap_pct: number;
  vol_surge_ratio: number;
  is_squeeze: boolean;
  rsi_5m: number;
  catalysts: string[];
  day_high: number;
  day_low: number;
  tradingview_5m_url: string;
}

export interface TomorrowMoversResponse {
  total: number;
  bullish_count: number;
  bearish_count: number;
  squeezes_count: number;
  items: TomorrowOpportunity[];
}

export async function fetchTomorrowMovers(params?: {
  direction?: string;
  force_refresh?: boolean;
}): Promise<TomorrowMoversResponse> {
  const query = new URLSearchParams();
  if (params?.direction && params.direction !== "ALL") query.set("direction", params.direction);
  if (params?.force_refresh) query.set("force_refresh", "true");

  const res = await fetch(`${API_BASE}/api/techno-funda/tomorrow-movers?${query.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch tomorrow movers: ${res.statusText}`);
  }
  return res.json();
}

export interface TomorrowDeepDiveItem extends TomorrowOpportunity {
  sector_bullish_ratio_pct: number;
  sector_status: string;
  sector_bullish_count: number;
  trend_1d: string;
  trend_1d_desc: string;
  rsi_1d: number;
  pct_from_20d_high: number;
  trend_1h: string;
  rsi_1h: number;
  confluence_grade: string;
  confluence_badge: string;
  mtf_score: number;
  conviction_score: number;
  conviction_tier: string;
  tradingview_1d_url: string;
  // Phase 1: Volatility & ATR fields
  atr_14: number;
  atr_pct: number;
  is_nr7: boolean;
  is_inside_day: boolean;
  pattern_contraction: string;
  contraction_badge: string;
  target_1: number;
  target_2: number;
  risk_reward: number;
  // Phase 2: Relative Strength vs NIFTY 50
  stock_ret_5d: number;
  nifty_ret_5d: number;
  rs_score: number;
  rs_status: string;
  nifty_regime: string;
}

export interface SectorMatrixItem {
  sector: string;
  total_stocks: number;
  bullish_stocks: number;
  bullish_ratio_pct: number;
  is_leading: boolean;
}

export interface TomorrowDeepDiveResponse {
  last_calculated_at?: string;
  data_source?: string;
  total_bullish_analyzed: number;
  triple_confluence_count: number;
  nr7_coils_count?: number;
  inside_days_count?: number;
  nifty_outperformers_count?: number;
  nifty_benchmark?: {
    cmp: number;
    ret_5d: number;
    regime: string;
    is_bullish: boolean;
  };
  elite_candidates: TomorrowDeepDiveItem[];
  all_bullish_mtf: TomorrowDeepDiveItem[];
  sector_matrix: SectorMatrixItem[];
}

export async function fetchTomorrowDeepDive(force_refresh: boolean = false): Promise<TomorrowDeepDiveResponse> {
  const query = force_refresh ? "?force_refresh=true" : "";
  const res = await fetch(`${API_BASE}/api/techno-funda/tomorrow-deep-dive${query}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch tomorrow deep dive: ${res.statusText}`);
  }
  return res.json();
}

export interface BacktestSessionWinner {
  symbol: string;
  direction: string;
  cmp: number;
  max_move_pct: number;
  close_ret_pct: number;
  status: string;
}

export interface BacktestSessionLoser {
  symbol: string;
  direction: string;
  cmp: number;
  loss_pct: number;
  status: string;
}

export interface BacktestSessionItem {
  session: string;
  market_regime: string;
  total_recs: number;
  bullish_count: number;
  bearish_count: number;
  winners: number;
  win_rate_pct: number;
  top_winners: BacktestSessionWinner[];
  top_losers: BacktestSessionLoser[];
}

export interface BacktestSummaryResponse {
  summary: {
    total_sessions: number;
    total_trades: number;
    total_wins: number;
    win_rate_pct: number;
    target_5pct_hits: number;
    trap_failure_rate_pct: number;
    avg_max_favorable_gain_pct: number;
  };
  sessions: BacktestSessionItem[];
  key_takeaways: string[];
}

export async function fetchBacktestSummary(): Promise<BacktestSummaryResponse> {
  const res = await fetch(`${API_BASE}/api/techno-funda/backtest-summary`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch backtest summary: ${res.statusText}`);
  }
  return res.json();
}



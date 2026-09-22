// frontend/src/lib/stocksApi.ts

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface StockTechnicalOverview {
  symbol: string;
  company_name: string;
  sector: string;
  industry: string;
  exchange: string;
  market_cap?: number;
  market_cap_category?: string;
  tradingview_symbol: string;
  current_price: number;
  day_change: number;
  day_change_pct: number;
  as_of_date: string;
  moving_averages: {
    ema_20: number;
    dma_50: number;
    dma_200: number;
    year_high: number;
    year_low: number;
  };
  setup_readiness: {
    score: number;
    grade: string;
    status: string;
    status_color: "emerald" | "cyan" | "amber" | "rose" | string;
    status_desc: string;
    overall_view: string;
    bullish_factors: string[];
    risk_factors: string[];
  };
  scenario_references: {
    current_price: number;
    pivot_reference: number;
    scenario_trigger: number;
    downside_reference: number;
    downside_pct: number;
    scenario_distance: number;
    scenario_distance_pct: number;
    target_1: number;
    target_1_pct: number;
    target_2: number;
    target_2_pct: number;
    risk_reward_ratio: number;
  };
  context_regime: {
    market_regime: string;
    trend_stage: string;
    is_stage_2: boolean;
    sector_rank: string;
    rs_rank: number;
    adx_strength: number;
    rsi_14: number;
  };
  market_structure_smc: {
    structure_bos: {
      trend: string;
      last_bos_price: number;
      last_bos_date: string;
      character: string;
      status: string;
    };
    premium_discount: {
      equilibrium: number;
      current_zone: string;
      range_position_pct: number;
      range_low: number;
      range_high: number;
    };
    fair_value_gaps: {
      has_fvg: boolean;
      type: string;
      gap_low: number;
      gap_high: number;
      status: string;
    };
    order_blocks: {
      has_ob: boolean;
      type: string;
      ob_low: number;
      ob_high: number;
      volume_surge: string;
    };
    liquidity_sweeps: {
      swept_level: number;
      sweep_side: string;
      reclaim: string;
    };
    breaker_levels: {
      level: number;
      converted: string;
    };
    volume_profile: {
      poc: number;
      vah: number;
      val: number;
      institutional_footprint: string;
      dry_up_score: number;
    };
  };
  setup_quality_gauges: {
    base_vcp: {
      depth_pct: number;
      contractions: string;
      days_in_base: number;
      quality_grade: string;
    };
    overhead_supply: {
      ceiling_distance_pct: number;
      supply_intensity: string;
      cleared_levels_pct: number;
    };
    chase_risk: {
      distance_from_20_ema_pct: number;
      distance_from_50_dma_pct: number;
      risk_rating: string;
    };
    smart_money_flow: {
      score_60d: number;
      state: string;
      surge_ratio: string;
    };
    radar_axes: Array<{
      subject: string;
      score: number;
    }>;
  };
  seasonality: Array<{
    month: string;
    avg_return_pct: number;
    win_rate_pct: number;
    is_bullish: boolean;
  }>;
  ai_insights: {
    verdict: string;
    breakout_criteria: string;
    invalidation_level: string;
    position_sizing: string;
    institutional_summary: string;
  };
  peer_comparison: Array<{
    symbol: string;
    company_name: string;
    current_price: number;
    day_change_pct: number;
    rs_rank: number;
    trend_stage: string;
    pivot_distance_pct: number;
    setup_score: number;
    sales_growth_ttm?: number;
    profit_growth_ttm?: number;
    health_score?: number;
  }>;
  faq: Array<{
    question: string;
    answer: string;
  }>;
  fundamentals: {
    health_score?: number;
    sales_growth_ttm?: number;
    profit_growth_ttm?: number;
    roce?: number;
  };
}

export interface StockSearchResult {
  symbol: string;
  company_name: string;
  sector: string;
  current_price: number;
}

export async function fetchStockTechnicalOverview(symbol: string): Promise<StockTechnicalOverview> {
  const res = await fetch(`${API_BASE}/api/stocks/${encodeURIComponent(symbol)}/technical-overview`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to load technical overview for ${symbol} (HTTP ${res.status})`);
  }
  return res.json();
}

export async function searchStocks(query: string): Promise<StockSearchResult[]> {
  if (!query || query.trim().length === 0) return [];
  const res = await fetch(`${API_BASE}/api/stocks/search?q=${encodeURIComponent(query)}&limit=8`, {
    cache: "no-store",
  });
  if (!res.ok) return [];
  return res.json();
}

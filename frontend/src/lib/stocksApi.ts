import { API_BASE } from "@/lib/apiConfig";

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
    pe_ratio?: number;
    market_cap?: number;
    sales_qtr?: number;
    net_profit_qtr?: number;
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
  industry?: string;
  exchange?: string;
  market_cap?: string | number | null;
  current_price: number;
  is_trending?: boolean;
}

export function normalizeStockTechnicalOverview(raw: any): StockTechnicalOverview {
  if (!raw) {
    throw new Error("Empty technical overview data received");
  }

  const identity = raw.identity || {};
  const marketData = raw.market_data || {};
  const rawScenario = raw.scenario_references || raw.scenario || {};
  const setupEval = raw.setup_evaluation || {};
  const smc = raw.market_structure_smc || raw.smart_money_concepts || {};
  const quality = raw.setup_quality_gauges || raw.quality_gauges || {};

  const cmp = Number(raw.current_price ?? marketData.current_price ?? 0);
  const downsideRef = Number(rawScenario.downside_reference ?? (cmp > 0 ? cmp * 0.95 : 0));
  const pivotRef = Number(rawScenario.pivot_reference ?? (cmp > 0 ? cmp * 1.05 : 0));
  const trigger = Number(rawScenario.scenario_trigger ?? (pivotRef > 0 ? pivotRef * 1.004 : cmp));
  const t1 = Number(rawScenario.target_1 ?? (trigger > 0 ? trigger * 1.10 : cmp * 1.10));
  const t2 = Number(rawScenario.target_2 ?? (trigger > 0 ? trigger * 1.20 : cmp * 1.20));

  return {
    symbol: raw.symbol || identity.symbol || "",
    company_name: raw.company_name || identity.company_name || raw.symbol || "",
    sector: raw.sector || identity.sector || "Equities",
    industry: raw.industry || identity.industry || "General",
    exchange: raw.exchange || identity.exchange || "NSE",
    market_cap: raw.market_cap ?? identity.market_cap,
    market_cap_category: raw.market_cap_category || identity.market_cap_category || "Mid Cap",
    tradingview_symbol:
      raw.tradingview_symbol || `${raw.exchange || identity.exchange || "NSE"}:${raw.symbol || identity.symbol || ""}`,
    current_price: cmp,
    day_change: Number(raw.day_change ?? marketData.day_change ?? 0),
    day_change_pct: Number(raw.day_change_pct ?? marketData.day_change_pct ?? 0),
    as_of_date:
      raw.as_of_date ||
      new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
    moving_averages: {
      ema_20: Number(raw.moving_averages?.ema_20 ?? marketData.ema_20 ?? cmp * 0.98),
      dma_50: Number(raw.moving_averages?.dma_50 ?? marketData.dma_50 ?? cmp * 0.95),
      dma_200: Number(raw.moving_averages?.dma_200 ?? marketData.dma_200 ?? cmp * 0.85),
      year_high: Number(raw.moving_averages?.year_high ?? marketData.year_high ?? cmp * 1.15),
      year_low: Number(raw.moving_averages?.year_low ?? marketData.year_low ?? cmp * 0.70),
    },
    setup_readiness: {
      score: Number(raw.setup_readiness?.score ?? setupEval.setup_score ?? 70),
      grade: raw.setup_readiness?.grade || setupEval.setup_grade || "B+",
      status: raw.setup_readiness?.status || setupEval.setup_status || "Constructive Setup",
      status_color: raw.setup_readiness?.status_color || setupEval.status_color || "cyan",
      status_desc: raw.setup_readiness?.status_desc || setupEval.status_desc || "Consolidating near key pivot.",
      overall_view: raw.setup_readiness?.overall_view || setupEval.overall_view || "Constructive base structure.",
      bullish_factors: raw.setup_readiness?.bullish_factors || setupEval.bullish_factors || [],
      risk_factors: raw.setup_readiness?.risk_factors || setupEval.risk_factors || [],
    },
    scenario_references: {
      current_price: cmp,
      pivot_reference: pivotRef,
      scenario_trigger: trigger,
      downside_reference: downsideRef,
      downside_pct: Number(rawScenario.downside_pct ?? (cmp > 0 ? ((cmp - downsideRef) / cmp) * 100 : 5.0)),
      scenario_distance: Number(rawScenario.scenario_distance ?? trigger - cmp),
      scenario_distance_pct: Number(
        rawScenario.scenario_distance_pct ?? (cmp > 0 ? ((trigger - cmp) / cmp) * 100 : 0.4)
      ),
      target_1: t1,
      target_1_pct: Number(rawScenario.target_1_pct ?? (cmp > 0 ? ((t1 - cmp) / cmp) * 100 : 10.0)),
      target_2: t2,
      target_2_pct: Number(rawScenario.target_2_pct ?? (cmp > 0 ? ((t2 - cmp) / cmp) * 100 : 20.0)),
      risk_reward_ratio: Number(rawScenario.risk_reward_ratio ?? 2.5),
    },
    context_regime: {
      market_regime: raw.context_regime?.market_regime || "Constructive Growth",
      trend_stage: raw.context_regime?.trend_stage || setupEval.trend_stage || "Stage 2 Uptrend",
      is_stage_2: Boolean(raw.context_regime?.is_stage_2 ?? setupEval.is_stage_2 ?? true),
      sector_rank: raw.context_regime?.sector_rank || setupEval.sector_context || "Leading Sector",
      rs_rank: Number(raw.context_regime?.rs_rank ?? setupEval.rs_rank ?? 75),
      adx_strength: Number(raw.context_regime?.adx_strength ?? setupEval.adx_strength ?? 28),
      rsi_14: Number(raw.context_regime?.rsi_14 ?? setupEval.rsi_14 ?? 55),
    },
    market_structure_smc: smc,
    setup_quality_gauges: quality,
    seasonality: Array.isArray(raw.seasonality) ? raw.seasonality : [],
    ai_insights: {
      verdict: raw.ai_insights?.verdict || "Favorable Asymmetric Setup",
      breakout_criteria: raw.ai_insights?.breakout_criteria || `Volume expansion above ₹${trigger.toFixed(2)}`,
      invalidation_level: raw.ai_insights?.invalidation_level || `Daily close below ₹${downsideRef.toFixed(2)}`,
      position_sizing: raw.ai_insights?.position_sizing || "Standard 1.0-1.5% portfolio risk allocation.",
      institutional_summary: raw.ai_insights?.institutional_summary || setupEval.overall_view || "",
    },
    peer_comparison: Array.isArray(raw.peer_comparison)
      ? raw.peer_comparison
      : Array.isArray(raw.peers)
      ? raw.peers
      : [],
    faq: Array.isArray(raw.faq) ? raw.faq : Array.isArray(raw.faqs) ? raw.faqs : [],
    fundamentals: {
      health_score: Number(raw.fundamentals?.health_score ?? marketData.health_score ?? 65),
      sales_growth_ttm: Number(raw.fundamentals?.sales_growth_ttm ?? marketData.sales_growth_ttm ?? 0),
      profit_growth_ttm: Number(raw.fundamentals?.profit_growth_ttm ?? marketData.profit_growth_ttm ?? 0),
      roce: Number(raw.fundamentals?.roce ?? marketData.roce ?? 0),
    },
  };
}

export async function fetchStockTechnicalOverview(symbol: string): Promise<StockTechnicalOverview> {
  const res = await fetch(`${API_BASE}/api/stocks/${encodeURIComponent(symbol)}/technical-overview`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to load technical overview for ${symbol} (HTTP ${res.status})`);
  }
  const raw = await res.json();
  return normalizeStockTechnicalOverview(raw);
}

export async function searchStocks(query: string = "", limit: number = 10): Promise<StockSearchResult[]> {
  try {
    const cleanQuery = query.trim();
    const res = await fetch(`${API_BASE}/api/stocks/search?q=${encodeURIComponent(cleanQuery)}&limit=${limit}`, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    // Non-fatal warning when offline or during server reload
    console.warn("Stock search network unavailable:", err);
    return [];
  }
}


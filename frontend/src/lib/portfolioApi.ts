import { API_BASE, fetchJson } from "./apiConfig";

export interface PortfolioSummary {
  portfolio_id: number;
  portfolio_name: string;
  benchmark: string;
  cash_balance: number;
  total_invested: number;
  current_value: number;
  total_pnl: number;
  total_pnl_pct: number;
  total_stocks: number;
  health_score: number;
  health_status: "EXCELLENT" | "GOOD" | "NEEDS_ATTENTION";
  portfolio_beta: number;
  xirr_estimate: number;
  quality_meter: {
    financial_strength: number;
    growth_quality: number;
    valuation_score: number;
    technical_strength: number;
    momentum: number;
    risk_score: number;
    governance: number;
  };
  sector_distribution: Record<string, number>;
  concentration_warnings: string[];
  ai_summary: string;
}

export interface PortfolioItem {
  id: number;
  name: string;
  description?: string;
  color?: string;
  benchmark: string;
  cash_balance: number;
  is_default: boolean;
  holdings_count: number;
  total_invested: number;
  current_value: number;
  total_pnl: number;
  total_pnl_pct: number;
  health_score: number;
}

export interface PortfolioHolding {
  id: number;
  portfolio_id: number;
  symbol: string;
  company_name: string;
  sector: string;
  quantity: number;
  avg_buy_price: number;
  cmp: number;
  prev_close?: number;
  day_change?: number;
  day_change_pct?: number;
  invested_value: number;
  current_value: number;
  pnl: number;
  pnl_pct: number;
  weight_pct: number;
  buy_date?: string;
  notes?: string;
  verdict: "STRONG_BUY" | "BUY" | "ACCUMULATE" | "HOLD" | "REDUCE" | "EXIT";
  conviction_score: number;
  horizon: string;
  risk_level: string;
  best_buy_zone: string;
  accumulate_zone: string;
  profit_booking?: number;
  stop_loss?: number;
  fair_value?: number;
  valuation_status: string;
  expected_result: "GOOD" | "AVERAGE" | "BAD";
  beat_probability: number;
  quality_score: number;
  growth_score: number;
  ai_thesis: string;
  when_to_buy: string;
  when_not_to_buy: string;
}

export interface Stock360Analysis {
  symbol: string;
  live_price: {
    cmp: number;
    pe_ratio?: number;
    market_cap?: number;
    sector: string;
    company_name: string;
    roce?: number;
    revenue_growth?: number;
    pat_growth?: number;
  };
  analysis: {
    id: number;
    symbol: string;
    company_name: string;
    sector: string;
    verdict: string;
    conviction_score: number;
    horizon: string;
    risk_level: string;
    best_buy_min: number;
    best_buy_max: number;
    accumulate_min: number;
    accumulate_max: number;
    profit_booking: number;
    stop_loss: number;
    fair_value: number;
    overvaluation_pct: number;
    valuation_status: string;
    expected_result: string;
    beat_probability: number;
    earnings_countdown_days: number;
    quality_score: number;
    growth_score: number;
    valuation_score: number;
    technical_score: number;
    momentum_score: number;
    governance_score: number;
    ai_thesis: string;
    when_to_buy: string;
    when_not_to_buy: string;
    company_dna_moat: string;
    growth_catalysts: string;
  };
}

export interface RebalanceRecommendation {
  current_sector_allocation: Record<string, number>;
  suggested_sector_targets: Record<string, number>;
  rebalance_actions: Array<{
    type: "ADD_MORE" | "TRIM";
    symbol: string;
    reason: string;
    suggested_action: string;
    suggested_allocation_pct: number;
  }>;
  tax_efficiency_note: string;
}

export interface OpportunityPick {
  symbol: string;
  company_name: string;
  sector?: string;
  category: string;
  cmp: number;
  price_to_buy: string;
  target_price: number;
  upside_pct: number;
  stop_loss: number;
  downside_pct: number;
  risk_reward_ratio: string;
  horizon: string;
  conviction: number;
  allocated_amount: number;
  suggested_qty: number;
  weight_in_portfolio?: number;
  rationale: string;
  triggers?: string;
}

export interface OpportunityData {
  deployment_amount: number;
  currency: string;
  recommended_split: Array<{
    bucket: string;
    amount: number;
    description?: string;
    picks: OpportunityPick[];
  }>;
  all_picks?: OpportunityPick[];
  ai_verdict: string;
}

export const portfolioApi = {
  async getPortfolios(): Promise<PortfolioItem[]> {
    return fetchJson<PortfolioItem[]>("/portfolio/list");
  },

  async createPortfolio(data: {
    name: string;
    description?: string;
    color?: string;
    benchmark?: string;
    cash_balance?: number;
    is_default?: boolean;
  }): Promise<{ success: boolean; portfolio: PortfolioItem }> {
    return fetchJson("/portfolio/create", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updatePortfolio(
    id: number,
    data: {
      name?: string;
      description?: string;
      color?: string;
      benchmark?: string;
      cash_balance?: number;
      is_default?: boolean;
    }
  ): Promise<{ success: boolean }> {
    return fetchJson(`/portfolio/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  async deletePortfolio(id: number): Promise<{ success: boolean }> {
    return fetchJson(`/portfolio/${id}`, {
      method: "DELETE",
    });
  },

  async getSummary(id: number, refresh?: boolean): Promise<PortfolioSummary> {
    const url = refresh ? `/portfolio/${id}/summary?refresh=true&_t=${Date.now()}` : `/portfolio/${id}/summary`;
    return fetchJson<PortfolioSummary>(url);
  },

  async getHoldings(id: number, refresh?: boolean): Promise<PortfolioHolding[]> {
    const url = refresh ? `/portfolio/${id}/holdings?refresh=true&_t=${Date.now()}` : `/portfolio/${id}/holdings`;
    return fetchJson<PortfolioHolding[]>(url);
  },

  async refreshPrices(id: number): Promise<{
    success: boolean;
    refreshed_count: number;
    refreshed_at: string;
    summary: PortfolioSummary;
    holdings: PortfolioHolding[];
  }> {
    return fetchJson(`/portfolio/${id}/refresh-prices`, {
      method: "POST",
    });
  },

  async addManualHolding(
    portfolioId: number,
    data: {
      symbol: string;
      quantity: number;
      avg_buy_price: number;
      buy_date?: string;
      notes?: string;
    }
  ): Promise<{ success: boolean; holding_id: number; symbol: string }> {
    return fetchJson(`/portfolio/${portfolioId}/holdings`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async updateHolding(
    portfolioId: number,
    holdingId: number,
    data: {
      quantity?: number;
      avg_buy_price?: number;
      notes?: string;
    }
  ): Promise<{ success: boolean }> {
    return fetchJson(`/portfolio/${portfolioId}/holdings/${holdingId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  async deleteHolding(
    portfolioId: number,
    holdingId: number
  ): Promise<{ success: boolean }> {
    return fetchJson(`/portfolio/${portfolioId}/holdings/${holdingId}`, {
      method: "DELETE",
    });
  },

  async importCsv(
    portfolioId: number,
    file: File
  ): Promise<{
    success: boolean;
    added_count: number;
    skipped_count: number;
    errors: string[];
  }> {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${API_BASE}/portfolio/${portfolioId}/import-csv`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`CSV Import failed: ${errorText}`);
    }

    return res.json();
  },

  async importCsvText(
    portfolioId: number,
    csvContent: string
  ): Promise<{
    success: boolean;
    added_count: number;
    skipped_count: number;
    errors: string[];
  }> {
    return fetchJson(`/portfolio/${portfolioId}/import-csv-text`, {
      method: "POST",
      body: JSON.stringify({ csv_content: csvContent }),
    });
  },

  async getStock360(portfolioId: number, symbol: string): Promise<Stock360Analysis> {
    return fetchJson<Stock360Analysis>(`/portfolio/${portfolioId}/analysis/${symbol}`);
  },

  async getRebalance(portfolioId: number): Promise<RebalanceRecommendation> {
    return fetchJson<RebalanceRecommendation>(`/portfolio/${portfolioId}/rebalance`);
  },

  async getOpportunities(portfolioId: number, amount: number = 100000): Promise<OpportunityData> {
    return fetchJson<OpportunityData>(`/portfolio/${portfolioId}/opportunities?amount=${amount}`);
  },
};

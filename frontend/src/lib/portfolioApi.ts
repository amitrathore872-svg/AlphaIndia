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
  total_day_pnl?: number;
  total_day_pnl_pct?: number;
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
  // Tranche Targets & Dynamic Stop Loss (Phase 1)
  target_t1?: number;
  target_t2?: number;
  target_stage?: "TARGET_1_PENDING" | "TARGET_1_HIT" | "TARGET_2_HIT";
  profit_booking?: number;
  stop_loss?: number;
  stop_loss_type?: string;
  distance_to_target_pct?: number;
  distance_to_sl_pct?: number;
  // Technical Indicators & Regime (Phase 2)
  dma_50?: number;
  dma_200?: number;
  dist_50_dma_pct?: number;
  dist_200_dma_pct?: number;
  is_above_50_dma?: boolean;
  is_above_200_dma?: boolean;
  trend_regime?: string;
  fifty_two_week_high?: number;
  fifty_two_week_low?: number;
  // 360 Diagnostics
  verdict: "STRONG_BUY" | "BUY" | "ACCUMULATE" | "HOLD" | "REDUCE" | "EXIT";
  conviction_score: number;
  horizon: string;
  risk_level: string;
  best_buy_zone: string;
  accumulate_zone: string;
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

  async executeTrade(
    portfolioId: number,
    holdingId: number,
    data: {
      action: "BUY" | "SELL";
      quantity: number;
      price: number;
      notes?: string;
    }
  ): Promise<{
    success: boolean;
    closed: boolean;
    symbol: string;
    message: string;
    holding?: {
      id: number;
      symbol: string;
      quantity: number;
      avg_buy_price: number;
      notes?: string;
    };
  }> {
    return fetchJson(`/portfolio/${portfolioId}/holdings/${holdingId}/execute-trade`, {
      method: "POST",
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

  async bulkDeleteHoldings(
    portfolioId: number,
    holdingIds: number[]
  ): Promise<{ success: boolean; deleted_count: number }> {
    return fetchJson(`/portfolio/${portfolioId}/holdings/bulk-delete`, {
      method: "POST",
      body: JSON.stringify({ holding_ids: holdingIds }),
    });
  },

  async clearAllHoldings(
    portfolioId: number
  ): Promise<{ success: boolean; deleted_count: number }> {
    return fetchJson(`/portfolio/${portfolioId}/holdings/clear-all`, {
      method: "DELETE",
    });
  },

  downloadTemplate(): void {
    const csvContent =
      "Instrument,Qty,Avg. cost,Buy Date,Notes\n" +
      "RELIANCE,10,2950.50,2024-01-15,Core energy & retail holding\n" +
      "TCS,15,3850.00,2024-02-10,Large-cap IT leader\n" +
      "INFY,25,1620.75,2024-03-01,Tech allocation\n" +
      "HDFCBANK,20,1540.20,2024-03-15,Private banking compounder\n" +
      "TATAMOTORS,50,980.40,2024-04-05,Auto & EV growth\n" +
      "BHARTIARTL,30,1280.00,2024-04-20,Telecom & data growth\n";

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "alpha_india_portfolio_import_template.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },


  async importCsv(
    portfolioId: number,
    file: File
  ): Promise<{
    success: boolean;
    added_count: number;
    skipped_count: number;
    errors: string[];
    is_mutual_fund?: boolean;
    message?: string;
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
    is_mutual_fund?: boolean;
    message?: string;
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

  // -------------------------------------------------------------
  // DEDICATED TELEGRAM RADAR & BUY/SELL SIGNAL METHODS
  // -------------------------------------------------------------
  async getTelegramConfig(): Promise<{ success: boolean; config: PortfolioTelegramConfig }> {
    return fetchJson<{ success: boolean; config: PortfolioTelegramConfig }>("/portfolio/telegram/config");
  },

  async updateTelegramConfig(
    data: Partial<PortfolioTelegramConfig>
  ): Promise<{ success: boolean; message: string; config: PortfolioTelegramConfig }> {
    return fetchJson<{ success: boolean; message: string; config: PortfolioTelegramConfig }>(
      "/portfolio/telegram/config",
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    );
  },

  async testTelegramPing(data?: {
    chat_id?: string;
    bot_token?: string;
  }): Promise<{ success: boolean; message: string; details: any }> {
    return fetchJson("/portfolio/telegram/test-ping", {
      method: "POST",
      body: JSON.stringify(data || {}),
    });
  },

  async getSignals(portfolioId: number, refresh?: boolean): Promise<PortfolioSignalsResponse> {
    const url = refresh
      ? `/portfolio/${portfolioId}/alerts/signals?refresh=true&_t=${Date.now()}`
      : `/portfolio/${portfolioId}/alerts/signals`;
    return fetchJson<PortfolioSignalsResponse>(url);
  },

  async dispatchAlerts(
    portfolioId: number,
    forceBroadcast: boolean = true
  ): Promise<PortfolioDispatchResponse> {
    return fetchJson<PortfolioDispatchResponse>(
      `/portfolio/${portfolioId}/alerts/dispatch?force_broadcast=${forceBroadcast}`,
      {
        method: "POST",
      }
    );
  },

  async getAlertHistory(
    portfolioId: number,
    limit: number = 50
  ): Promise<{ success: boolean; portfolio_id: number; count: number; history: any[] }> {
    return fetchJson(`/portfolio/${portfolioId}/alerts/history?limit=${limit}`);
  },
};

export interface PortfolioTelegramConfig {
  id: number;
  user_id?: number | null;
  channel_name: string;
  bot_token?: string | null;
  has_custom_bot: boolean;
  chat_id?: string | null;
  telegram_username?: string | null;
  is_enabled: boolean;
  is_configured: boolean;
  notify_portfolio_buy: boolean;
  notify_portfolio_sell: boolean;
  notify_portfolio_rebalance: boolean;
  notify_watchlist_buy: boolean;
  notify_watchlist_sell: boolean;
  min_conviction_score: number;
  notify_price_cross?: boolean;
  notify_dma_reclaim?: boolean;
  notify_vcp_breakout?: boolean;
  notify_volume_surge?: boolean;
  notify_target_stop?: boolean;
  last_dispatched_at?: string | null;
  total_dispatched_count?: number;
}

export interface PortfolioSignal {
  portfolio_id: number;
  holding_id?: number | null;
  symbol: string;
  company_name: string;
  sector: string;
  signal_type: "BUY" | "SELL";
  trigger_category: string;
  headline: string;
  cmp: number;
  avg_buy_price: number;
  target_price: number;
  stop_loss: number;
  pnl_pct: number;
  conviction_score: number;
  weight_pct: number;
  quantity: number;
  invested_value: number;
  current_value: number;
  action_guidance: string;
  urgency: "CRITICAL" | "HIGH" | "MEDIUM";
  created_at?: string;
}

export interface PortfolioSignalsResponse {
  success: boolean;
  portfolio_id: number;
  total_signals: number;
  buy_signals_count: number;
  sell_signals_count: number;
  buy_signals: PortfolioSignal[];
  sell_signals: PortfolioSignal[];
  all_signals: PortfolioSignal[];
}

export interface PortfolioDispatchResponse {
  success: boolean;
  portfolio_id: number;
  total_signals_detected: number;
  buy_signals_count: number;
  sell_signals_count: number;
  dispatched_count: number;
  skipped_count: number;
  signals: PortfolioSignal[];
}


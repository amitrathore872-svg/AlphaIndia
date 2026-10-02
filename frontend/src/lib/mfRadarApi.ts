/**
 * Alpha India - Mutual Fund Alpha Radar API Client
 * Sprint 39
 */

import { fetchJson, API_BASE } from "@/lib/apiConfig";

export interface MFRadarScheme {
  id: number;
  scheme_code: string;
  scheme_name: string;
  amc_name: string;
  category: string;
  benchmark_index: string;
  plan_type: string;
  option_type: string;
  fund_manager?: string | null;
  aum_cr: number;
  ter: number;
  current_nav: number | null;
  nav_date: string | null;
  prev_nav: number | null;
  day_change_pct: number;
  return_1m_pct: number | null;
  return_3m_pct: number | null;
  return_6m_pct: number | null;
  return_1y_pct: number | null;
  return_3y_pct: number | null;
  return_5y_pct: number | null;
  alpha_1y: number;
  beta: number;
  sharpe_ratio: number;
  sortino_ratio: number;
  category_rank: number | null;
  category_total: number | null;
  nav_52w_high: number | null;
  nav_52w_low: number | null;
  dip_from_52w_high_pct: number;
  dip_count_1y: number;
  last_dip_date: string | null;
  is_top_universe: boolean;
  is_active: boolean;
  updated_at: string | null;
}

export interface MFRadarNavPoint {
  time: string;
  value: number;
  day_change_pct: number;
  is_dip: boolean;
}

export interface MFDmaPoint {
  time: string;
  value: number;
}

export interface MFDipMarker {
  time: string;
  position: "belowBar" | "aboveBar" | "inBar";
  color: string;
  shape: "arrowUp" | "arrowDown" | "circle";
  text: string;
}

export interface MFRadarNavResponse {
  scheme: MFRadarScheme;
  period: string;
  points: MFRadarNavPoint[];
  dma_50: MFDmaPoint[];
  dma_200: MFDmaPoint[];
  dip_markers: MFDipMarker[];
  count: number;
}

export interface MFRadarSummary {
  total_schemes: number;
  today_dips_count: number;
  dip_opportunities: MFRadarScheme[];
  momentum_leaders: MFRadarScheme[];
  category_breakdown: Record<string, number>;
}

export interface MFLiveIndexItem {
  name: string;
  category: string;
  last_price: number;
  prev_close: number;
  change_pct: number;
  beta: number;
  is_dip: boolean;
}

export interface MFLiveIndicesResponse {
  status: string;
  ist_time: string;
  is_lumpsum_window_open: boolean;
  cutoff_target: string;
  indices: Record<string, MFLiveIndexItem>;
}

export interface MFDipAlertItem {
  id: number;
  alert_date: string;
  detected_at: string;
  index_name: string;
  category: string;
  index_drop_pct: number;
  estimated_nav_drop_pct: number;
  flagship_schemes: string | null;
  cutoff_time: string;
  urgency: string;
  is_cutoff_active: boolean;
  actual_eod_nav_drop_pct: number | null;
  is_alert_dispatched: boolean;
  message: string;
}

export interface MFActiveDipAlertsResponse {
  is_lumpsum_window_open: boolean;
  cutoff_target: string;
  active_alerts_count: number;
  alerts: MFDipAlertItem[];
}

export interface SchemesQueryParams {
  category?: string;
  search?: string;
  sort_by?: string;
  sort_order?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export const mfRadarApi = {
  getSchemes: async (params?: SchemesQueryParams): Promise<{
    total: number;
    page: number;
    limit: number;
    total_pages: number;
    data: MFRadarScheme[];
  }> => {
    const q = new URLSearchParams();
    if (params?.category) q.set("category", params.category);
    if (params?.search) q.set("search", params.search);
    if (params?.sort_by) q.set("sort_by", params.sort_by);
    if (params?.sort_order) q.set("sort_order", params.sort_order);
    if (params?.page) q.set("page", String(params.page));
    if (params?.limit) q.set("limit", String(params.limit));

    const qs = q.toString();
    return fetchJson(`/api/v1/mf-radar/schemes${qs ? `?${qs}` : ""}`);
  },

  getNavSeries: async (schemeCode: string, period: string = "6M"): Promise<MFRadarNavResponse> => {
    return fetchJson(`/api/v1/mf-radar/nav/${schemeCode}?period=${period}`);
  },

  getSummary: async (): Promise<MFRadarSummary> => {
    return fetchJson("/api/v1/mf-radar/summary");
  },

  getLiveIndices: async (): Promise<MFLiveIndicesResponse> => {
    return fetchJson("/api/v1/mf-radar/dip-alerts/live-indices");
  },

  getActiveDipAlerts: async (): Promise<MFActiveDipAlertsResponse> => {
    return fetchJson("/api/v1/mf-radar/dip-alerts/active");
  },

  getDipHistory: async (limit: number = 50): Promise<MFDipAlertItem[]> => {
    return fetchJson(`/api/v1/mf-radar/dip-alerts/history?limit=${limit}`);
  },

  triggerDipScan: async (force: boolean = false): Promise<any> => {
    return fetchJson(`/api/v1/mf-radar/dip-alerts/scan-now?force=${force}`, {
      method: "POST",
    });
  },

  triggerDailySync: async (): Promise<any> => {
    return fetchJson("/api/v1/mf-radar/sync/daily", {
      method: "POST",
    });
  },

  // ── Phase 4: Momentum & Rotation Radar ──
  getCategoryHeatmap: async (): Promise<{
    status: string;
    macro_commentary: string;
    heatmap: {
      category: string;
      fund_count: number;
      total_aum_cr: number;
      avg_1m_pct: number;
      avg_3m_pct: number;
      avg_6m_pct: number;
      avg_1y_pct: number;
      regime: string;
      regime_color: string;
      signal_message: string;
      top_fund_name: string;
      top_fund_code: string | null;
      top_fund_6m: number | null;
    }[];
  }> => {
    return fetchJson("/api/v1/mf-radar/momentum/heatmap");
  },

  getMomentumRankings: async (category?: string): Promise<{
    scheme_code: string;
    scheme_name: string;
    amc_name: string;
    category: string;
    category_rank: number;
    category_total: number;
    percentile: number;
    current_nav: number | null;
    return_3m_pct: number | null;
    return_6m_pct: number | null;
    return_1y_pct: number | null;
    benchmark_index: string;
    alpha_3m: number;
    alpha_6m: number;
    composite_momentum_score: number;
    momentum_tier: string;
    tier_label: string;
    tier_color: string;
    aum_cr: number;
    ter: number;
  }[]> => {
    const q = category && category !== "All" ? `?category=${encodeURIComponent(category)}` : "";
    return fetchJson(`/api/v1/mf-radar/momentum/rankings${q}`);
  },

  getDilutionAlerts: async (): Promise<{
    type: string;
    severity: string;
    scheme_code: string;
    scheme_name: string;
    category: string;
    aum_cr: number;
    ter: number;
    headline: string;
    reason: string;
    suggested_action: string;
  }[]> => {
    return fetchJson("/api/v1/mf-radar/momentum/dilution-alerts");
  },

  // ── Phase 5: Portfolio & Smart Swap Radar ──
  getPortfolio: async (): Promise<MFPortfolioSummary> => {
    return fetchJson("/api/v1/mf-radar/portfolio");
  },

  addPortfolioHolding: async (data: {
    scheme_code: string;
    units: number;
    purchase_date: string;
    purchase_nav: number;
    folio_number?: string;
    notes?: string;
  }): Promise<MFPortfolioHolding> => {
    return fetchJson("/api/v1/mf-radar/portfolio/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  },

  deletePortfolioHolding: async (holdingId: number): Promise<{ status: string; deleted_id: number }> => {
    return fetchJson(`/api/v1/mf-radar/portfolio/${holdingId}`, {
      method: "DELETE",
    });
  },

  getSmartSwaps: async (): Promise<MFSmartSwapCard[]> => {
    return fetchJson("/api/v1/mf-radar/portfolio/swaps");
  },

  seedSamplePortfolio: async (): Promise<any> => {
    return fetchJson("/api/v1/mf-radar/portfolio/seed-sample", {
      method: "POST",
    });
  },

  importHoldingsFile: async (
    file: File,
    replaceExisting: boolean = false,
    sheetName?: string
  ): Promise<{
    success: boolean;
    added_count: number;
    updated_count: number;
    skipped_count: number;
    errors: string[];
    candidate_sheets?: string[];
  }> => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("replace_existing", String(replaceExisting));
    if (sheetName) {
      formData.append("sheet_name", sheetName);
    }

    const res = await fetch(`${API_BASE}/api/v1/mf-radar/portfolio/import-file`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`MF File Import failed: ${errorText}`);
    }
    return res.json();
  },

  importHoldingsCsv: async (
    file: File,
    replaceExisting: boolean = false,
    sheetName?: string
  ) => {
    return mfRadarApi.importHoldingsFile(file, replaceExisting, sheetName);
  },

  importHoldingsCsvText: async (
    csvContent: string,
    replaceExisting: boolean = false
  ): Promise<{
    success: boolean;
    added_count: number;
    updated_count: number;
    skipped_count: number;
    errors: string[];
    candidate_sheets?: string[];
  }> => {
    return fetchJson("/api/v1/mf-radar/portfolio/import-csv-text", {
      method: "POST",
      body: JSON.stringify({
        csv_content: csvContent,
        replace_existing: replaceExisting,
      }),
    });
  },
};

export interface MFPortfolioHolding {
  id: number;
  scheme_code: string;
  scheme_name: string;
  folio_number: string | null;
  units: number;
  purchase_date: string;
  purchase_nav: number;
  invested_amt: number;
  current_nav: number | null;
  current_value: number | null;
  unrealized_pnl: number | null;
  unrealized_pnl_pct: number | null;
  holding_days: number;
  exit_load_active: boolean;
  exit_load_pct: number;
  exit_load_amt: number;
  tax_bracket: "STCG_20" | "LTCG_12_5" | string;
  tax_amt_est: number;
  net_redemption_proceeds: number;
  notes: string | null;
}

export interface MFPortfolioSummary {
  total_invested: number;
  total_current_val: number;
  overall_pnl: number;
  overall_pnl_pct: number;
  total_exit_load_amt: number;
  total_tax_liability: number;
  net_portfolio_liquidity: number;
  locked_in_exit_load_count: number;
  holdings_count: number;
  holdings: MFPortfolioHolding[];
}

export interface MFSmartSwapCard {
  holding_id: number;
  current_scheme: {
    code: string;
    name: string;
    amc: string;
    category: string;
    units: number;
    current_nav: number | null;
    invested_amt: number;
    current_value: number;
    unrealized_pnl: number;
    return_6m_pct: number;
    holding_days: number;
    exit_load_active: boolean;
    drawdown_from_peak_pct?: number;
    peak_nav?: number | null;
    dip_status?: string;
  };
  target_scheme: {
    code: string;
    name: string;
    amc: string;
    category: string;
    current_nav: number | null;
    return_6m_pct: number;
    alpha_1y: number;
    aum_cr: number;
    ter: number;
    drawdown_from_peak_pct?: number;
    peak_nav?: number | null;
    dip_status?: string;
    dip_label?: string;
  };
  friction_breakdown: {
    exit_load_pct: number;
    exit_load_amt: number;
    tax_bracket: string;
    tax_amt_est: number;
    total_friction_pct: number;
    net_proceeds: number;
  };
  alpha_metrics: {
    gross_alpha_spread: number;
    net_alpha_gain: number;
    hurdle_cleared: boolean;
    drawdown_advantage_pct?: number;
    target_dip_label?: string;
    target_dip_status?: string;
  };
  execution: {
    type: string;
    headline: string;
    settlement_timeline: string;
    recommendation: string;
  };
}


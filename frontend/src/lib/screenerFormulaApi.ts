import { fetchJson } from "./apiConfig";

export interface FormulaValidationResponse {
  valid: boolean;
  formula?: string;
  metrics_detected?: string[];
  token_count?: number;
  message?: string;
  error?: string;
  position?: number;
}

export interface FormulaPreset {
  id: string;
  title: string;
  badge: string;
  description: string;
  formula: string;
}

export interface MetricItem {
  name: string;
  token: string;
  desc: string;
}

export interface MetricCategory {
  category: string;
  items: MetricItem[];
}

export interface FormulaRunResult {
  symbol: string;
  company_name: string;
  sector: string;
  industry?: string;
  current_price: number | null;
  market_cap: number | null;
  market_cap_category?: string;
  stock_pe: number | null;
  price_to_book: number | null;
  roce: number | null;
  roe: number | null;
  opm: number | null;
  quarterly_sales_yoy: number | null;
  quarterly_pat_yoy: number | null;
  sales_growth_3yr: number | null;
  profit_growth_3yr: number | null;
  debt_to_equity: number | null;
  piotroski_score: number | null;
  health_score: number | null;
  fcf_yield: number | null;
  rsi_14: number | null;
  beta: number | null;
  distance_52w_high: number | null;
  cfo_to_pat: number | null;
  promoter_holding: number | null;
  techno_funda_url: string;
}

export interface FormulaRunResponse {
  success: boolean;
  formula: string;
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  execution_time_ms: number;
  results: FormulaRunResult[];
}

export async function validateFormula(formula: string): Promise<FormulaValidationResponse> {
  return fetchJson<FormulaValidationResponse>("/api/v1/screener-formula/validate", {
    method: "POST",
    body: JSON.stringify({ formula }),
  });
}

export async function getFormulaPresets(): Promise<{ success: boolean; presets: FormulaPreset[] }> {
  return fetchJson<{ success: boolean; presets: FormulaPreset[] }>("/api/v1/screener-formula/presets");
}

export async function getFormulaMetrics(): Promise<{ success: boolean; categories: MetricCategory[] }> {
  return fetchJson<{ success: boolean; categories: MetricCategory[] }>("/api/v1/screener-formula/metrics");
}

export async function runFormulaQuery(params: {
  formula: string;
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: string;
}): Promise<FormulaRunResponse> {
  return fetchJson<FormulaRunResponse>("/api/v1/screener-formula/run", {
    method: "POST",
    body: JSON.stringify({
      formula: params.formula,
      page: params.page ?? 1,
      limit: params.limit ?? 25,
      sort_by: params.sort_by ?? "market_cap",
      sort_order: params.sort_order ?? "desc",
    }),
  });
}

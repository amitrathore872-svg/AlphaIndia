// =======================================================
// Alpha India Screener.in TypeScript Definitions
// Parallel Architecture - Isolated Types for Screener.in Pipeline
// =======================================================

export interface ScreenerGrowthCompany {
  id: number;
  symbol: string;
  company_name: string;
  sector: string | null;
  industry: string | null;
  exchange: string;
  current_price: number | null;
  market_cap: number | null;
  market_cap_category: "LARGE" | "MID" | "SMALL" | "MICRO" | null;
  stock_pe: number | null;
  industry_pe: number | null;
  price_to_book: number | null;
  book_value: number | null;
  dividend_yield: number | null;
  pat_12m: number | null;
  eps_12m: number | null;
  roce: number | null;
  roe: number | null;
  opm_latest: number | null;
  sales_growth_ttm: number | null;
  profit_growth_ttm: number | null;
  sales_growth_3yr: number | null;
  sales_growth_5yr: number | null;
  profit_growth_3yr: number | null;
  profit_growth_5yr: number | null;
  stock_cagr_3yr: number | null;
  return_3m: number | null;
  return_6m: number | null;
  return_1y: number | null;
  dma_50: number | null;
  dma_200: number | null;
  piotroski_score: number | null;
  latest_quarter_name: string | null;
  latest_quarter_sales: number | null;
  latest_quarter_net_profit: number | null;
  quarterly_sales_yoy: number | null;
  quarterly_pat_yoy: number | null;
  debt_to_equity: number | null;
  cfo_latest: number | null;
  free_cash_flow: number | null;
  debtor_days: number | null;
  inventory_days: number | null;
  cash_conversion_cycle: number | null;
  promoter_holding: number | null;
  fii_holding: number | null;
  dii_holding: number | null;
  public_holding: number | null;
  high_52_week: number | null;
  low_52_week: number | null;
  health_score: number | null;
  data_completeness_score: number | null;
  last_updated: string | null;
  import_source: string;
}

export interface ScreenerGrowthResponse {
  success: boolean;
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  results: ScreenerGrowthCompany[];
}

export interface ScreenerFiltersResponse {
  success: boolean;
  sectors: string[];
  categories: string[];
  summary: {
    total_companies: number;
    avg_roce: number;
    avg_sales_growth_3yr: number;
  };
}

export interface ScreenerMonitoringStatus {
  success: boolean;
  importer_status: "IDLE" | "RUNNING" | "FAILED";
  current_run_id: string | null;
  current_symbol: string | null;
  current_duration_seconds: number;
  last_successful_import: string | null;
  scheduler_status: "ACTIVE" | "PAUSED";
  next_scheduled_run: string | null;
  next_run_countdown: string;
}

export interface ScreenerMonitoringStats {
  success: boolean;
  total_companies_in_db: number;
  total_universe_eligible?: number;
  unimported_remaining?: number;
  coverage_percent?: number;
  imported_today: number;
  new_added_today: number;
  existing_updated_today: number;
  failed_today: number;
  skipped_today: number;
  success_rate_percent: number;
}

export interface ScreenerPerformanceMetrics {
  success: boolean;
  avg_response_time_ms: number;
  avg_parse_time_ms: number;
  avg_write_time_ms: number;
  avg_total_execution_ms: number;
  records_per_second: number;
}

export interface ScreenerLiveEvent {
  id: number;
  run_id: string | null;
  symbol: string | null;
  event_type: string;
  level: "INFO" | "WARNING" | "ERROR" | "SUCCESS";
  message: string;
  response_time_ms?: number | null;
  parse_time_ms?: number | null;
  db_write_time_ms?: number | null;
  timestamp: string;
  created_at: string;
}

export interface ScreenerImportRunRow {
  id: number;
  run_id: string;
  status: "RUNNING" | "SUCCESS" | "PARTIAL" | "FAILED" | "ABORTED";
  start_time: string | null;
  end_time: string | null;
  duration_seconds: number;
  total_target: number;
  imported_count: number;
  updated_count: number;
  failed_count: number;
  skipped_count: number;
  success_rate_percent: number;
  error_summary: string | null;
}

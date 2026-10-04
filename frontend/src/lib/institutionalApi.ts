/**
 * Mutual Fund & Institutional Smart Money API Client
 * Alpha India - Full-Universe AMC Scheme Matrix & Fresh Entries Radar
 */

import { fetchJson } from "@/lib/apiConfig";


export interface CapCounts {
  ALL: number;
  LARGE: number;
  MID: number;
  SMALL: number;
  MICRO: number;
}

export interface MacroTelemetry {
  smart_money_avg: number;
  total_inflows_cr: number;
  active_schemes_inflow_cr: number;
  stealth_alerts_count: number;
  report_date: string | null;
}

export interface ScreenerItem {
  company_id: number;
  symbol: string;
  company_name: string;
  sector: string;
  market_cap_category?: string;
  report_date: string;
  smart_money_score: number;
  active_alpha_schemes: number;
  total_schemes: number;
  total_value_cr: number;
  net_shares_flow_mom: number;
  net_value_flow_mom_cr: number;
  pct_of_equity: number;
  float_absorption_pct: number;
  star_manager_count: number;
  is_stealth_accumulation: boolean;
  is_consensus_bet: boolean;
  current_price: number;
  action_recommendation: string;
  target_price: number;
  signal_type: string;
  current_stage?: string;
  stage_code?: string;
  stage_badge?: string;
  sparkline?: number[];
  dma_50?: number | null;
  dma_200?: number | null;
}

export interface ScreenerResponse {
  items: ScreenerItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  cap_counts?: CapCounts;
  latest_report_date: string | null;
}

export interface SchemeInfo {
  id: number;
  scheme_code: string;
  scheme_name: string;
  amc_name: string;
  category: string;
  aum_cr: number;
  fund_manager_name: string | null;
  is_active_alpha?: boolean;
}

export interface MatrixHolding {
  weight_pct: number;
  market_value_cr: number;
  shares_held: number;
  holding_status: string;
  mom_shares_change_pct: number;
  trend: "UP" | "DOWN" | "NEW" | "FLAT";
}

export interface MatrixStockItem {
  company_id: number;
  symbol: string;
  company_name: string;
  sector: string;
  industry: string;
  market_cap_category: "LARGE" | "MID" | "SMALL" | "MICRO" | string;
  market_cap_cr: number;
  current_price: number;
  smart_money_score: number;
  total_mf_weight_pct: number;
  total_mf_value_cr: number;
  total_schemes_holding: number;
  holdings: Record<string, MatrixHolding>;
}

export interface MatrixResponse {
  schemes: SchemeInfo[];
  items: MatrixStockItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  cap_counts: CapCounts;
  latest_report_date: string | null;
}

export interface FreshEntryItem {
  id: number;
  company_id: number;
  symbol: string;
  company_name: string;
  sector: string;
  market_cap_category: "LARGE" | "MID" | "SMALL" | "MICRO" | string;
  market_cap_cr: number;
  current_price: number;
  scheme_id: number;
  scheme_name: string;
  amc_name: string;
  scheme_category: string;
  fund_manager_name: string;
  shares_held: number;
  market_value_cr: number;
  weight_pct: number;
  report_date: string;
  current_stage?: string;
  stage_code?: string;
  stage_badge?: string;
  sparkline?: number[];
  dma_50?: number | null;
  dma_200?: number | null;
}

export interface FreshEntriesResponse {
  items: FreshEntryItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  cap_counts: CapCounts;
  summary: {
    total_fresh_entries: number;
    total_deployment_cr: number;
    max_deployment_cr: number;
    max_weight_pct: number;
    top_sector: string;
  };
  latest_report_date: string | null;
}

export interface SchemeHoldingItem {
  scheme_id: number;
  scheme_name: string;
  amc_name: string;
  category: string;
  is_active_alpha: boolean;
  fund_manager_name: string;
  shares_held: number;
  market_value_cr: number;
  weight_pct: number;
  mom_shares_change_pct: number;
  holding_status: "NEW_ENTRY" | "AGGRESSIVE_ADD" | "ADD" | "HOLD" | "TRIMMED" | "HEAVY_TRIM" | "EXIT";
}

export interface TimelinePoint {
  report_date: string;
  month_label: string;
  pct_of_equity: number;
  total_shares: number;
  total_value_cr: number;
  total_schemes: number;
  smart_money_score: number;
}

export interface ActionZone {
  current_price: number;
  entry_zone_low: number;
  entry_zone_high: number;
  target_price: number;
  stop_loss: number;
  upside_pct: number;
  action: string;
  confidence: number;
}

export interface StockInstitutionalDetail {
  company: {
    id: number;
    symbol: string;
    name: string;
    sector: string;
    industry: string;
    market_cap: string;
    market_cap_category?: string;
  };
  latest_stats: {
    report_date: string | null;
    smart_money_score: number;
    total_schemes: number;
    active_alpha_schemes: number;
    total_shares_held: number;
    total_value_cr: number;
    pct_of_equity: number;
    pct_of_free_float: number;
    net_value_flow_mom_cr: number;
    float_absorption_pct: number;
    is_stealth_accumulation: boolean;
    is_consensus_bet: boolean;
  };
  flow_tracker: {
    buyers_count: number;
    sellers_count: number;
    new_entries_count: number;
    exits_count: number;
  };
  holdings: SchemeHoldingItem[];
  timeline: TimelinePoint[];
  ai_reasoning: {
    thesis: string;
    primary_driver: string;
    signal_type: string;
  };
  action_zone: ActionZone;
}

export interface SectorFlowItem {
  id: number;
  sector_name: string;
  report_date: string;
  net_inflow_cr: number;
  prev_month_inflow_cr: number;
  mom_delta_pct: number;
  trend: "UP" | "DOWN" | "STABLE";
  top_accumulated_stock: string | null;
  top_trimmed_stock: string | null;
}

export interface StarFundManager {
  manager_name: string;
  amc: string;
  flagship_scheme: string;
  philosophy: string;
  recent_accumulations: Array<{
    symbol: string;
    company_name: string;
    mom_change_pct: number;
    status: string;
    weight_pct: number;
  }>;
}

// -------------------------------------------------------------
// Fetch Client Functions
// -------------------------------------------------------------

export async function fetchMacroTelemetry(): Promise<MacroTelemetry> {
  return fetchJson<MacroTelemetry>("/api/v1/institutional/stats");
}

export async function fetchInstitutionalRadar(params: {
  page?: number;
  limit?: number;
  search?: string;
  sector?: string;
  market_cap_category?: string;
  filter_type?: string;
  sort_by?: string;
  sort_order?: string;
}): Promise<ScreenerResponse> {
  const q = new URLSearchParams();
  if (params.page) q.set("page", params.page.toString());
  if (params.limit) q.set("limit", params.limit.toString());
  if (params.search) q.set("search", params.search);
  if (params.sector) q.set("sector", params.sector);
  if (params.market_cap_category) q.set("market_cap_category", params.market_cap_category);
  if (params.filter_type) q.set("filter_type", params.filter_type);
  if (params.sort_by) q.set("sort_by", params.sort_by);
  if (params.sort_order) q.set("sort_order", params.sort_order);

  const qs = q.toString();
  return fetchJson<ScreenerResponse>(`/api/v1/institutional/radar${qs ? `?${qs}` : ""}`);
}

export async function fetchInstitutionalMatrix(params: {
  market_cap_category?: string;
  search?: string;
  sector?: string;
  scheme_category?: string;
  scheme_ids?: string;
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: string;
}): Promise<MatrixResponse> {
  const q = new URLSearchParams();
  if (params.market_cap_category) q.set("market_cap_category", params.market_cap_category);
  if (params.search) q.set("search", params.search);
  if (params.sector) q.set("sector", params.sector);
  if (params.scheme_category) q.set("scheme_category", params.scheme_category);
  if (params.scheme_ids) q.set("scheme_ids", params.scheme_ids);
  if (params.page) q.set("page", params.page.toString());
  if (params.limit) q.set("limit", params.limit.toString());
  if (params.sort_by) q.set("sort_by", params.sort_by);
  if (params.sort_order) q.set("sort_order", params.sort_order);

  const qs = q.toString();
  return fetchJson<MatrixResponse>(`/api/v1/institutional/matrix${qs ? `?${qs}` : ""}`);
}

export async function fetchFreshEntries(params: {
  market_cap_category?: string;
  search?: string;
  sector?: string;
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: string;
}): Promise<FreshEntriesResponse> {
  const q = new URLSearchParams();
  if (params.market_cap_category) q.set("market_cap_category", params.market_cap_category);
  if (params.search) q.set("search", params.search);
  if (params.sector) q.set("sector", params.sector);
  if (params.page) q.set("page", params.page.toString());
  if (params.limit) q.set("limit", params.limit.toString());
  if (params.sort_by) q.set("sort_by", params.sort_by);
  if (params.sort_order) q.set("sort_order", params.sort_order);

  const qs = q.toString();
  return fetchJson<FreshEntriesResponse>(`/api/v1/institutional/fresh-entries${qs ? `?${qs}` : ""}`);
}

export async function fetchSchemesList(): Promise<SchemeInfo[]> {
  return fetchJson<SchemeInfo[]>("/api/v1/institutional/schemes");
}

export async function fetchStockInstitutionalDetail(symbol: string): Promise<StockInstitutionalDetail> {
  return fetchJson<StockInstitutionalDetail>(`/api/v1/institutional/stock/${encodeURIComponent(symbol)}`);
}

export async function fetchSectorRotation(): Promise<SectorFlowItem[]> {
  return fetchJson<SectorFlowItem[]>("/api/v1/institutional/sector-rotation");
}

export async function fetchStarFundManagers(): Promise<StarFundManager[]> {
  return fetchJson<StarFundManager[]>("/api/v1/institutional/fund-managers");
}

export interface FilingStatusResponse {
  status: string;
  database_snapshot: {
    latest_holding_date: string;
    distinct_periods_ingested: string[];
    total_schemes_registered: number;
    total_holdings_rows: number;
    active_signals_count: number;
  };
  filing_lifecycle: {
    filings_available: boolean;
    filing_state: string;
    status_description: string;
    target_period_end: string;
    target_period_name: string;
    posting_window_start: string;
    sebi_filing_deadline: string;
    sebi_filing_deadline_ist: string;
    quarterly_shareholding_pattern_deadline: string;
    days_until_filing_window: number;
    days_until_sebi_deadline: number;
  };
  regulatory_framework: {
    amfi_monthly_rule: string;
    shp_quarterly_rule: string;
    sast_threshold_rule: string;
  };
  scheduler_schedule: {
    engine_name: string;
    status: string;
    poll_frequency: string;
    next_scheduled_run: string;
  };
}

export async function fetchFilingStatus(): Promise<FilingStatusResponse> {
  return fetchJson<FilingStatusResponse>("/api/v1/institutional/filing-status");
}

export async function triggerFilingSync(force: boolean = false): Promise<any> {
  return fetchJson(`/api/v1/institutional/schedule-sync?force=${force}`, {
    method: "POST",
  });
}


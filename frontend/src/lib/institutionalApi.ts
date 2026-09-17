/**
 * Mutual Fund & Institutional Smart Money API Client
 * Alpha India - Full-Universe AMC Scheme Matrix & Fresh Entries Radar
 */

import { API_BASE } from "@/lib/apiConfig";


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
  const res = await fetch(`${API_BASE}/api/v1/institutional/stats`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
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
  const url = new URL(`${API_BASE}/api/v1/institutional/radar`);
  if (params.page) url.searchParams.set("page", params.page.toString());
  if (params.limit) url.searchParams.set("limit", params.limit.toString());
  if (params.search) url.searchParams.set("search", params.search);
  if (params.sector) url.searchParams.set("sector", params.sector);
  if (params.market_cap_category) url.searchParams.set("market_cap_category", params.market_cap_category);
  if (params.filter_type) url.searchParams.set("filter_type", params.filter_type);
  if (params.sort_by) url.searchParams.set("sort_by", params.sort_by);
  if (params.sort_order) url.searchParams.set("sort_order", params.sort_order);

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
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
  const url = new URL(`${API_BASE}/api/v1/institutional/matrix`);
  if (params.market_cap_category) url.searchParams.set("market_cap_category", params.market_cap_category);
  if (params.search) url.searchParams.set("search", params.search);
  if (params.sector) url.searchParams.set("sector", params.sector);
  if (params.scheme_category) url.searchParams.set("scheme_category", params.scheme_category);
  if (params.scheme_ids) url.searchParams.set("scheme_ids", params.scheme_ids);
  if (params.page) url.searchParams.set("page", params.page.toString());
  if (params.limit) url.searchParams.set("limit", params.limit.toString());
  if (params.sort_by) url.searchParams.set("sort_by", params.sort_by);
  if (params.sort_order) url.searchParams.set("sort_order", params.sort_order);

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
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
  const url = new URL(`${API_BASE}/api/v1/institutional/fresh-entries`);
  if (params.market_cap_category) url.searchParams.set("market_cap_category", params.market_cap_category);
  if (params.search) url.searchParams.set("search", params.search);
  if (params.sector) url.searchParams.set("sector", params.sector);
  if (params.page) url.searchParams.set("page", params.page.toString());
  if (params.limit) url.searchParams.set("limit", params.limit.toString());
  if (params.sort_by) url.searchParams.set("sort_by", params.sort_by);
  if (params.sort_order) url.searchParams.set("sort_order", params.sort_order);

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchSchemesList(): Promise<SchemeInfo[]> {
  const res = await fetch(`${API_BASE}/api/v1/institutional/schemes`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchStockInstitutionalDetail(symbol: string): Promise<StockInstitutionalDetail> {
  const res = await fetch(`${API_BASE}/api/v1/institutional/stock/${encodeURIComponent(symbol)}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchSectorRotation(): Promise<SectorFlowItem[]> {
  const res = await fetch(`${API_BASE}/api/v1/institutional/sector-rotation`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchStarFundManagers(): Promise<StarFundManager[]> {
  const res = await fetch(`${API_BASE}/api/v1/institutional/fund-managers`, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

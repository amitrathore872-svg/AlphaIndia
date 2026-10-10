// =======================================================
// Alpha India — Exchange Quarterly Results & PEAD API Client
// Sprint 36.4 — Dual-Feed Intelligence Upgrade
// =======================================================

import { fetchJson } from "@/lib/apiConfig";


export interface PillarBreakdown {
  rank1_operating_leverage?: number;
  rank2_run_rate_surprise?: number;
  rank3_pat_velocity?: number;
  rank4_sales_expansion?: number;
  rank5_operating_margin?: number;
  rank6_capital_quality?: number;
  rank7_freshness_drift?: number;
  trap_penalties?: number;
  earnings_power?: number;
  operating_leverage?: number;
  capital_efficiency?: number;
  trend_drift?: number;
}

export interface QuarterlyResultItem {
  id: number;
  company_id: number;
  symbol: string;
  company_name: string;
  exchange: string;
  sector: string | null;
  market_cap: number | null;
  market_cap_category: string | null;
  filing_type: string | null;
  period: string;
  announcement_date: string | null;
  discovered_at: string | null;
  pdf_url: string | null;
  download_status: string;
  parse_status: string;
  tradingview_url?: string;

  // Feed classification (Sprint 36.4)
  feed_type: "RESULT" | "ANNOUNCEMENT";
  is_pre_announcement: boolean;

  // Financial metrics
  revenue: number | null;
  net_profit: number | null;
  eps: number | null;
  opm: number | null;
  revenue_growth: number | null;
  pat_growth: number | null;
  revenue_growth_qoq?: number | null;
  pat_growth_qoq?: number | null;
  roce: number | null;
  current_price: number | null;
  dma_50: number | null;

  // Valuation & Multiples
  stock_pe?: number | null;
  industry_pe?: number | null;
  price_to_book?: number | null;
  book_value?: number | null;
  dividend_yield?: number | null;
  face_value?: number | null;
  peg_ratio?: number | null;

  // Trailing 12M & Profitability
  pat_12m?: number | null;
  eps_12m?: number | null;
  opm_latest?: number | null;
  opm_ttm?: number | null;
  sales_growth_ttm?: number | null;
  profit_growth_ttm?: number | null;

  // Historical Multi-Year Growth
  sales_growth_3yr?: number | null;
  sales_growth_5yr?: number | null;
  sales_growth_10yr?: number | null;
  profit_growth_3yr?: number | null;
  profit_growth_5yr?: number | null;
  profit_growth_10yr?: number | null;

  // Returns & Technicals
  return_3m?: number | null;
  return_6m?: number | null;
  return_1y?: number | null;
  stock_cagr_3yr?: number | null;
  stock_cagr_5yr?: number | null;
  dma_200?: number | null;
  high_52_week?: number | null;
  low_52_week?: number | null;
  distance_52w_high?: number | null;
  rsi_14?: number | null;
  beta?: number | null;

  // Ratios, Solvency & Health
  roe?: number | null;
  debt_to_equity?: number | null;
  interest_coverage?: number | null;
  debtor_days?: number | null;
  inventory_days?: number | null;
  cash_conversion_cycle?: number | null;
  cfo_to_pat?: number | null;
  piotroski_score?: number | null;
  health_score?: number | null;

  // Balance Sheet & Cash Flows
  borrowings?: number | null;
  reserves?: number | null;
  total_assets?: number | null;
  cfo_latest?: number | null;
  free_cash_flow?: number | null;
  fcf_yield?: number | null;

  // Shareholding
  promoter_holding?: number | null;
  fii_holding?: number | null;
  dii_holding?: number | null;
  public_holding?: number | null;

  // Quarterly specifics
  latest_quarter_sales?: number | null;
  latest_quarter_net_profit?: number | null;
  operating_profit?: number | null;
  latest_quarter_eps?: number | null;
  quarterly_sales_yoy?: number | null;
  quarterly_pat_yoy?: number | null;
  quarterly_eps_yoy?: number | null;

  // Post-results PEAD Intelligence
  pead_score: number;
  pead_tier: string;
  pead_tier_label: string;
  pead_color: string;
  drift_days: string;
  operating_leverage_ratio: number;
  run_rate_beat_pct?: number | null;
  is_turnaround?: boolean | null;
  is_pead_candidate: boolean;
  is_elite_pead: boolean;
  guard_status?: "PASSED" | "FLAGGED" | string | null;
  is_techno_funda_confirmed?: boolean | null;
  guard_flags?: string[] | null;
  pead_thesis: string;
  pillar_breakdown: PillarBreakdown;

  // Pre-announcement Pre-Beat Intelligence (Sprint 36.4)
  pre_beat_score: number | null;
  beat_tier: string | null;
  beat_tier_label: string | null;
  beat_color: string | null;
  beat_velocity: string | null;
  beat_thesis: string | null;
  beat_count_of_4: number | null;
  avg_pat_growth_trailing: number | null;

  // Athena Omega Intelligence
  athena_conviction_score?: number | null;
  athena_conviction_grade?: string | null;
  athena_signal?: string | null;

  // Combo B: Earnings Alpha Lifecycle Engine (Sprint 36.6)
  quarterly_trend_5q?: QuarterlyTrend5QItem[];
  acceleration_streak?: number;
  is_ath_quarter?: boolean;
  day1_reaction?: Day1ReactionInfo;
  pead_drift?: PeadDriftInfo;
}

export interface QuarterlyTrend5QItem {
  period: string;
  revenue?: number | null;
  net_profit?: number | null;
  opm?: number | null;
  qoq_growth?: number | null;
}

export interface Day1ReactionInfo {
  gap_pct?: number | null;
  rvol?: number | null;
  close_range_pct?: number | null;
  signature: "GAP_AND_GO" | "ABSORPTION" | "EXHAUSTION_TRAP" | "IN_LINE" | string;
  signature_label: string;
  day1_open?: number | null;
  day1_high?: number | null;
  day1_low?: number | null;
  day1_close?: number | null;
}

export interface PeadDriftInfo {
  drift_pct?: number | null;
  drift_days: number;
  zone_status: "IN_BUY_ZONE" | "EXTENDED" | "DRIFT_FAILED" | "ACCELERATING" | string;
  zone_label: string;
  distance_from_d1_high_pct?: number | null;
  d1_high_anchor?: number | null;
  stop_loss_level?: number | null;
}


export interface QuarterlyResultsResponse {
  total: number;
  page: number;
  limit: number;
  pages: number;
  pead_candidates_count: number;
  elite_pead_count: number;
  results_count: number;         // Sprint 36.4
  announcements_count: number;   // Sprint 36.4
  results: QuarterlyResultItem[];
}

export interface QuarterlySummaryResponse {
  total_filings: number;
  pead_candidates: number;
  elite_pead: number;
  nse_count: number;
  bse_count: number;
  results_filings_count: number;        // Sprint 36.4
  announcements_filings_count: number;  // Sprint 36.4
  latest_discovered_at: string | null;
  available_periods: string[];
  recent_announcement_dates?: string[];
  top_pead_pick: {
    symbol: string;
    company: string;
    pat_growth: number | null;
    revenue_growth: number | null;
    pead_score: number;
    pead_tier: string;
    drift_days: string;
    tradingview_url?: string;
  } | null;
}

export interface QuarterlyResultsFilters {
  page?: number;
  limit?: number;
  search?: string;
  exchange?: string;
  period?: string;
  announcement_date?: string;  // YYYY-MM-DD
  from_date?: string;          // YYYY-MM-DD
  to_date?: string;            // YYYY-MM-DD
  feed_type?: "RESULTS" | "ANNOUNCEMENTS" | "ALL";  // Sprint 36.4
  pead_only?: boolean;
  pead_tier?: string;
  sort_by?: string;
  sort_order?: string;
}

export async function fetchQuarterlyResults(
  filters: QuarterlyResultsFilters = {}
): Promise<QuarterlyResultsResponse> {
  const params = new URLSearchParams();

  if (filters.page) params.set("page", String(filters.page));
  if (filters.limit) params.set("limit", String(filters.limit));
  if (filters.search) params.set("search", filters.search);
  if (filters.exchange && filters.exchange !== "ALL")
    params.set("exchange", filters.exchange);
  if (filters.period && filters.period !== "ALL")
    params.set("period", filters.period);
  if (filters.announcement_date && filters.announcement_date !== "ALL")
    params.set("announcement_date", filters.announcement_date);
  if (filters.from_date)
    params.set("from_date", filters.from_date);
  if (filters.to_date)
    params.set("to_date", filters.to_date);
  if (filters.feed_type && filters.feed_type !== "ALL")
    params.set("feed_type", filters.feed_type);
  if (filters.pead_only) params.set("pead_only", "true");
  if (filters.pead_tier && filters.pead_tier !== "ALL")
    params.set("pead_tier", filters.pead_tier);
  if (filters.sort_by) params.set("sort_by", filters.sort_by);
  if (filters.sort_order) params.set("sort_order", filters.sort_order);

  const qs = params.toString();
  return fetchJson<QuarterlyResultsResponse>(`/quarterly-results${qs ? `?${qs}` : ""}`);
}

export async function fetchQuarterlySummary(): Promise<QuarterlySummaryResponse> {
  return fetchJson<QuarterlySummaryResponse>("/quarterly-results/summary");
}

export async function triggerExchangeScan(
  limit: number = 10
): Promise<{ success: boolean; companies_scanned?: number; high_growth_breakouts?: number; [key: string]: unknown }> {
  return fetchJson<{ success: boolean; companies_scanned?: number; high_growth_breakouts?: number; [key: string]: unknown }>(
    `/quarterly-results/scan-exchange?limit=${limit}`,
    {
      method: "POST",
    }
  );
}

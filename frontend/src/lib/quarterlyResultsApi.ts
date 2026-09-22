// =======================================================
// Alpha India — Exchange Quarterly Results & PEAD API Client
// Sprint 36.4 — Dual-Feed Intelligence Upgrade
// =======================================================

import { API_BASE } from "@/lib/apiConfig";


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
  if (filters.feed_type && filters.feed_type !== "ALL")
    params.set("feed_type", filters.feed_type);
  if (filters.pead_only) params.set("pead_only", "true");
  if (filters.pead_tier && filters.pead_tier !== "ALL")
    params.set("pead_tier", filters.pead_tier);
  if (filters.sort_by) params.set("sort_by", filters.sort_by);
  if (filters.sort_order) params.set("sort_order", filters.sort_order);

  const url = `${API_BASE}/quarterly-results?${params.toString()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch quarterly results: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchQuarterlySummary(): Promise<QuarterlySummaryResponse> {
  const url = `${API_BASE}/quarterly-results/summary`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch quarterly summary: ${res.statusText}`);
  }
  return res.json();
}

export async function triggerExchangeScan(
  limit: number = 10
): Promise<{ success: boolean; companies_scanned?: number; high_growth_breakouts?: number; [key: string]: unknown }> {
  const url = `${API_BASE}/quarterly-results/scan-exchange?limit=${limit}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Failed to trigger exchange scan: ${res.statusText}`);
  }
  return res.json();
}

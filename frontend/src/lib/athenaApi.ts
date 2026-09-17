/**
 * Alpha India — ATHENA OMEGA v3.0 API Client
 * Official Sprint 24
 */

import { API_BASE as BASE_URL } from "@/lib/apiConfig";


export interface PeadInfo {
  score: number;
  tier: string;
  tier_label: string;
  color: string;
  drift_days: string;
  operating_leverage: number;
  is_candidate: boolean;
  is_elite: boolean;
  thesis?: string;
  pillar_breakdown?: {
    earnings_power: number;
    operating_leverage: number;
    capital_efficiency: number;
    trend_drift: number;
  };
}

export interface FlashDecisionItem {
  id: number;
  filing_id: number;
  symbol: string;
  company_name: string;
  exchange: string;
  fiscal_period: string;
  period_end?: string;
  athena_conviction_score: number;
  conviction_grade: "AAA+" | "AAA" | "AA" | "A" | "BELOW_A";
  confidence_pct: number;
  growth_category: string;
  flash_signal: "BUY IMMEDIATELY" | "BUY" | "ACCUMULATE" | "WATCHLIST" | "AVOID";
  expected_moves: {
    gap_up: string;
    move_1d: string;
    move_1w: string;
    move_1m: string;
  };
  decision_drivers: {
    financial_shock: number;
    earnings_quality: number;
    valuation_opportunity: number;
    risk_level: string;
  };
  pead?: PeadInfo | null;
  current_price?: number;
  estimated_fair_value?: number;
  upside_potential_pct?: number;
  ai_investment_summary: string;
  detected_at?: string;
  published_at?: string;
  processing_time_sec: number;
  sla_met: boolean;
  pdf_url?: string;
}

export interface FilingFeedItem {
  id: number;
  symbol: string;
  company_name: string;
  exchange: string;
  fiscal_period: string;
  filing_type: string;
  priority: "AAA+" | "AAA" | "AA" | "ARCHIVE";
  status: string;
  processing_time_sec: number;
  sla_met: boolean;
  detected_at?: string;
  shock_score?: number;
  conviction_score?: number;
  conviction_grade?: string;
  flash_signal?: string;
  pdf_url?: string;
}

export interface GateBreakdown {
  filing: {
    id: number;
    symbol: string;
    company_name: string;
    exchange: string;
    fiscal_period: string;
    filing_type: string;
    priority: string;
    status: string;
    processing_time_sec: number;
    sla_met: boolean;
    pdf_url?: string;
    detected_at?: string;
    published_at?: string;
  };
  gate_1_shock: {
    raw_score_200: number;
    normalized_score: number;
    tier: string;
    action: string;
    primary_driver: string;
    breakdown: Record<string, { score: number; max: number }>;
  };
  gate_2_quality: {
    quality_score: number;
    quality_grade: string;
    piotroski_score: number;
    checks: Record<string, string | number | boolean | null | undefined>;
    forensic_flags: string[];
  };
  gate_3_valuation_risk: {
    current_price: number;
    estimated_fair_value: number;
    upside_potential_pct: number;
    post_result_pe: number;
    industry_pe: number;
    peg_ratio: number;
    valuation_score: number;
    risk_score: number;
    risk_level: string;
  };
  gate_4_5_flash: {
    conviction_score: number;
    conviction_grade: string;
    confidence_pct: number;
    flash_signal: string;
    growth_category: string;
    expected_moves: Record<string, string>;
    ai_investment_summary: string;
  };
  metrics: Record<string, string | number | boolean | null | undefined>;
  pead_analysis?: PeadInfo | null;
}



// -------------------------------------------------------------
// API Calls
// -------------------------------------------------------------

export async function fetchFlashDecisions(params?: {
  grade?: string;
  signal?: string;
  search?: string;
  freshness?: string;
  sort_by?: string;
  limit?: number;
}): Promise<{ count: number; results: FlashDecisionItem[] }> {
  const query = new URLSearchParams();
  if (params?.grade) query.append("grade", params.grade);
  if (params?.signal) query.append("signal", params.signal);
  if (params?.search) query.append("search", params.search);
  if (params?.freshness) query.append("freshness", params.freshness);
  if (params?.sort_by) query.append("sort_by", params.sort_by);
  if (params?.limit) query.append("limit", params.limit.toString());

  const res = await fetch(`${BASE_URL}/athena-omega/flash?${query.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch FLASH decisions");
  return res.json();
}

export async function fetchFilingsFeed(params?: {
  exchange?: string;
  freshness?: string;
  limit?: number;
}): Promise<{ count: number; filings: FilingFeedItem[] }> {
  const query = new URLSearchParams();
  if (params?.exchange) query.append("exchange", params.exchange);
  if (params?.freshness) query.append("freshness", params.freshness);
  if (params?.limit) query.append("limit", params.limit.toString());

  const res = await fetch(`${BASE_URL}/athena-omega/feed?${query.toString()}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch filings feed");
  return res.json();
}

export async function fetchFullAnalysis(idOrSymbol: string | number): Promise<GateBreakdown> {
  const res = await fetch(`${BASE_URL}/athena-omega/analysis/${idOrSymbol}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch full 5-gate analysis");
  return res.json();
}

export async function triggerExchangeScan(): Promise<{ status: string; message: string }> {
  const res = await fetch(`${BASE_URL}/athena-omega/trigger-scan`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to trigger exchange scan");
  return res.json();
}

export async function fetchShareableBrief(id: number): Promise<{ symbol: string; brief_text: string }> {
  const res = await fetch(`${BASE_URL}/athena-omega/share/${id}/brief`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch shareable brief");
  return res.json();
}

export async function sendTelegramBroadcast(id: number): Promise<{ status: string; symbol: string }> {
  const res = await fetch(`${BASE_URL}/athena-omega/share/${id}/telegram`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to broadcast alert to Telegram");
  return res.json();
}

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
  metrics?: {
    revenue?: number | null;
    pat?: number | null;
    operating_profit?: number | null;
    ebitda_margin_pct?: number | null;
    ebitda_margin_change_bps?: number | null;
    eps?: number | null;
    eps_growth_yoy?: number | null;
    other_income?: number | null;
    interest_expense?: number | null;
    depreciation?: number | null;
    effective_tax_rate_pct?: number | null;
    operating_cash_flow?: number | null;
    total_debt?: number | null;
    revenue_growth_yoy?: number | null;
    pat_growth_yoy?: number | null;
    revenue_growth_qoq?: number | null;
    pat_growth_qoq?: number | null;
    roce?: number | null;
  } | null;
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
  priority: "AAA+" | "AAA" | "AA" | "A" | "ARCHIVE" | string;
  status: string;
  processing_time_sec: number;
  sla_met: boolean;
  detected_at?: string;
  published_at?: string;
  shock_score?: number;
  conviction_score?: number;
  conviction_grade?: string;
  flash_signal?: string;
  forensic_status?: "CLEAN" | "FLAGGED";
  pdf_url?: string;
}

export interface FilingAuditCalculation {
  metric: string;
  reported_q0: string;
  baseline_q4: string;
  calculated_delta: string;
  formula: string;
  audit_proof: string;
  status: "VERIFIED" | "PASSED" | "FLAGGED" | "INFO" | string;
}

export interface FilingAuditData {
  fiscal_period: string;
  source_filing_pdf?: string | null;
  filing_detected_at?: string | null;
  processing_time_sec?: number | null;
  sla_met?: boolean | null;
  q0_reported: {
    period: string;
    revenue?: number | null;
    pat?: number | null;
    operating_profit?: number | null;
    opm?: number | null;
    eps?: number | null;
    other_income?: number | null;
    interest_expense?: number | null;
    depreciation?: number | null;
    effective_tax_rate_pct?: number | null;
    cfo?: number | null;
    debt?: number | null;
    roce?: number | null;
  };
  q_minus_4_baseline: {
    period?: string | null;
    revenue?: number | null;
    pat?: number | null;
    opm?: number | null;
    eps?: number | null;
  };
  q_minus_1_baseline: {
    period?: string | null;
    revenue?: number | null;
    pat?: number | null;
    opm?: number | null;
    eps?: number | null;
  };
  calculation_audit_trail: FilingAuditCalculation[];
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
  filing_audit?: FilingAuditData;
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

export async function fetchShareableBrief(
  idOrSymbol: number | string,
  symbol?: string
): Promise<{ symbol: string; brief_text: string }> {
  const query = symbol ? `?symbol=${encodeURIComponent(symbol)}` : "";
  const res = await fetch(`${BASE_URL}/athena-omega/share/${idOrSymbol}/brief${query}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch shareable brief");
  return res.json();
}

export async function sendTelegramBroadcast(
  idOrSymbol: number | string,
  symbol?: string
): Promise<{ status: string; symbol: string; delivery?: any }> {
  const query = symbol ? `?symbol=${encodeURIComponent(symbol)}` : "";
  const res = await fetch(`${BASE_URL}/athena-omega/share/${idOrSymbol}/telegram${query}`, {
    method: "POST",
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(errData?.detail || "Failed to broadcast alert to Telegram");
  }
  return res.json();
}

/**
 * Normalizes any fiscal period representation (e.g. "Jun 2026", "June 2026", "Q1 FY27")
 * to the institutional month standard (e.g. "Jun 2026", "Sep 2026", "Dec 2026", "Mar 2027").
 */
export function formatFiscalPeriod(period?: string | null): string {
  if (!period || !period.trim()) return "—";
  const p = period.trim();

  // If already standard month-year: "Jun 2026", "June 2026", "September 2025", "Jun-26", "Sep 26"
  const mMatch = p.match(/^([A-Za-z]{3,9})[\s-]+(\d{2,4})$/);
  if (mMatch) {
    const rawMonth = mMatch[1].slice(0, 3).toLowerCase();
    const capitalized = rawMonth.charAt(0).toUpperCase() + rawMonth.slice(1);
    let yr = parseInt(mMatch[2], 10);
    if (yr < 100) yr += 2000;
    return `${capitalized} ${yr}`;
  }

  // ISO or date format like "2026-06-30", "2026-09-30", "2026-03-31"
  const isoMatch = p.match(/^(\d{4})-(\d{2})(?:-\d{2})?/);
  if (isoMatch) {
    const yr = isoMatch[1];
    const monthNum = parseInt(isoMatch[2], 10);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    if (monthNum >= 1 && monthNum <= 12) {
      return `${months[monthNum - 1]} ${yr}`;
    }
  }

  // Match quarterly codes: "Q1 FY27", "Q1FY27", "Q1 FY 2027", "Q1 2026-27"
  const qMatch = p.match(/^Q([1-4])\s*(?:FY\s*)?(\d{2,4})/i);
  if (qMatch) {
    const qNum = parseInt(qMatch[1], 10);
    let fy = parseInt(qMatch[2], 10);
    if (fy < 100) fy += 2000;

    // In Indian Fiscal Calendar:
    // Q1 FY27 -> ends June 2026 (FY - 1)
    // Q2 FY27 -> ends September 2026 (FY - 1)
    // Q3 FY27 -> ends December 2026 (FY - 1)
    // Q4 FY27 -> ends March 2027 (FY)
    const quarterMap: Record<number, { month: string; yrOffset: number }> = {
      1: { month: "Jun", yrOffset: -1 },
      2: { month: "Sep", yrOffset: -1 },
      3: { month: "Dec", yrOffset: -1 },
      4: { month: "Mar", yrOffset: 0 },
    };

    const mapping = quarterMap[qNum];
    if (mapping) {
      return `${mapping.month} ${fy + mapping.yrOffset}`;
    }
  }

  return p;
}

export function getQuarterCode(period?: string | null): string {
  if (!period || !period.trim()) return "";
  const p = period.trim();
  const qMatch = p.match(/^Q([1-4])\s*(?:FY\s*)?(\d{2,4})/i);
  if (qMatch) {
    const yr = qMatch[2].length === 4 ? qMatch[2].slice(-2) : qMatch[2];
    return `Q${qMatch[1]} FY${yr}`;
  }
  return "";
}

/**
 * Resolves the direct quarterly results source file / exchange PDF URL,
 * falling back to the official exchange/screener statement if direct PDF is not yet available.
 */
export function getQuarterlyResultFileUrl(item: {
  symbol?: string;
  pdf_url?: string | null;
  exchange?: string | null;
}): { url: string; isPdf: boolean; label: string } {
  const sym = (item.symbol || "").trim().toUpperCase();
  const rawUrl = item.pdf_url?.trim();

  if (rawUrl && (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) && rawUrl !== "-") {
    const isDirectPdf =
      rawUrl.toLowerCase().endsWith(".pdf") ||
      rawUrl.includes("AttachLive") ||
      rawUrl.includes("nsearchives");
    return {
      url: rawUrl,
      isPdf: isDirectPdf,
      label: isDirectPdf ? "Filing PDF" : "Exchange Filing",
    };
  }

  // Fallback to Screener.in consolidated quarterly statement where official numbers are aggregated
  const lookupSym = sym === "CPCL" ? "CHENNPETRO" : sym;
  return {
    url: `https://www.screener.in/company/${lookupSym}/consolidated/`,
    isPdf: false,
    label: "Statement",
  };
}

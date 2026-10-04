// =======================================================
// Alpha India — Investor Intelligence & Concall API Client
// Typed client for senior buy-side analyst insights,
// investor presentations, and concall transcripts.
// =======================================================

import { fetchJson } from "@/lib/apiConfig";

export interface InvestorInsightItem {
  id: number;
  document_id: number;
  symbol: string;
  company_name: string | null;
  fiscal_period: string | null;
  doc_type: "INVESTOR_PRESENTATION" | "CONCALL_TRANSCRIPT" | "CONCALL_NOTES" | string;
  institutional_stance:
    | "STRONG_GROWTH_LEADER"
    | "ACCUMULATE_ON_DIPS"
    | "STEADY_COMPOUNDER"
    | "TURNAROUND_CANDIDATE"
    | "CYCLICAL_PEAK"
    | "AVOID_OR_HEADWINDS"
    | string;
  growth_conviction_score: number;
  management_sentiment_score: number;
  management_credibility_rating?: string;
  management_tone: "VERY_BULLISH" | "PRAGMATIC_BULLISH" | "NEUTRAL" | "CAUTIOUS" | "DEFENSIVE" | string;
  executive_thesis: string | null;

  // Transformational / Exponential Catalyst Radar (10x Triggers)
  is_transformational_catalyst?: boolean | null;
  transformational_category?: string | null;
  catalyst_headline?: string | null;
  immediate_reaction_rationale?: string | null;
  exponential_growth_multiple?: string | null;

  // Pillar 1: Operating Leverage & Capex
  capacity_utilization_pct: number | null;
  cwip_amount_cr: number | null;
  capex_guidance_fy: string | null;
  commissioning_timeline_cod: string | null;
  expected_asset_turnover: string | null;
  volume_vs_price_driver: string | null;

  // Pillar 2: Margins & Pricing Power
  ebitda_margin_guidance_corridor: string | null;
  margin_drivers: string | null;
  input_cost_pass_through: string | null;
  value_added_mix_pct: number | null;

  // Pillar 3: Order Book & Execution Runway
  executable_order_book_cr: number | null;
  book_to_bill_ratio: number | null;
  bid_pipeline_cr: number | null;
  execution_duration_months: number | null;

  // Pillar 4: Balance Sheet & Cash Quality
  ocf_to_ebitda_ratio_pct: number | null;
  working_capital_days: number | null;
  working_capital_trend: string | null;
  debt_outlook: string | null;

  // Pillar 5: Analyst Grill & Concall Q&A
  key_overhang_questioned_by_analysts: string | null;
  management_direct_answer: string | null;
  evasiveness_detected: string | null;
  guidance_change: string | null;

  // Plain English & Direct Quotes
  layman_summary?: string | null;
  direct_quotes?: Array<{ speaker: string; quote: string; theme?: string }> | null;
  analyst_grill_quotes?: Array<{
    analyst: string;
    question: string;
    executive: string;
    answer_quote: string;
    verdict?: string;
  }> | null;
  actionable_gameplan?: {
    verdict: string;
    stance: string;
    risk_rating: string;
    key_trigger: string;
    plain_english_advice: string;
  } | null;

  // Pillar 6: Monitorables & Meta
  critical_monitorables: string[] | null;
  pdf_url: string | null;
  headline: string | null;
  analyzed_at: string | null;
  llm_model?: string;
}

export interface InvestorDocumentItem {
  id: number;
  doc_type: string;
  fiscal_period: string;
  announcement_date: string | null;
  headline: string | null;
  pdf_url: string | null;
  status: string;
  raw_text_length: number;
  created_at: string | null;
}

export interface CompanyIntelligenceResponse {
  symbol: string;
  total_documents: number;
  total_insights: number;
  latest_insight: InvestorInsightItem | null;
  insights_history: InvestorInsightItem[];
  documents: InvestorDocumentItem[];
}

export interface InvestorFeedResponse {
  total: number;
  page: number;
  limit: number;
  items: InvestorInsightItem[];
}

export async function fetchInvestorFeed(params?: {
  stance?: string;
  doc_type?: string;
  symbol?: string;
  min_score?: number;
  transformational_only?: boolean;
  page?: number;
  limit?: number;
}): Promise<InvestorFeedResponse> {
  const query = new URLSearchParams();
  if (params?.stance) query.append("stance", params.stance);
  if (params?.doc_type) query.append("doc_type", params.doc_type);
  if (params?.symbol) query.append("symbol", params.symbol);
  if (params?.min_score !== undefined) query.append("min_score", params.min_score.toString());
  if (params?.transformational_only) query.append("transformational_only", "true");
  if (params?.page) query.append("page", params.page.toString());
  if (params?.limit) query.append("limit", params.limit.toString());

  const qs = query.toString();
  return fetchJson<InvestorFeedResponse>(`/api/v1/investor-intelligence/feed${qs ? `?${qs}` : ""}`);
}

export async function fetchCompanyInvestorIntelligence(symbol: string): Promise<CompanyIntelligenceResponse> {
  return fetchJson<CompanyIntelligenceResponse>(`/api/v1/investor-intelligence/company/${encodeURIComponent(symbol)}`);
}

export async function triggerCompanyHarvest(symbol: string): Promise<{ symbol: string; discovered: number; status: string }> {
  return fetchJson(`/api/v1/investor-intelligence/harvest/${encodeURIComponent(symbol)}`, {
    method: "POST",
  });
}

export async function triggerAnalyzeDocument(documentId: number): Promise<any> {
  return fetchJson(`/api/v1/investor-intelligence/analyze/${documentId}`, {
    method: "POST",
  });
}

export async function triggerAnalyzeLatest(symbol: string): Promise<InvestorInsightItem> {
  return fetchJson(`/api/v1/investor-intelligence/analyze-latest/${encodeURIComponent(symbol)}`, {
    method: "POST",
  });
}

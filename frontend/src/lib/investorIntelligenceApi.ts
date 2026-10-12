// =======================================================
// Alpha India — Investor Intelligence & Concall API Client
// Typed client for senior buy-side analyst insights,
// investor presentations, concall transcripts & management commitment tracking.
// =======================================================

import { fetchJson } from "@/lib/apiConfig";

export interface ForensicDiscrepancy {
  category: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | string;
  claim: string;
  financial_reality: string;
  impact: string;
}

export interface DirectQuote {
  speaker: string;
  quote: string;
  theme?: string;
}

export interface AnalystGrillQuote {
  analyst: string;
  question: string;
  executive: string;
  answer_quote: string;
  verdict?: string;
}

export interface ActionableGameplan {
  verdict: string;
  stance: string;
  risk_rating: string;
  key_trigger: string;
  plain_english_advice: string;
}

export interface GuidanceChangesObj {
  trend?: string | null;
  margin_corridor?: string | null;
  capex_plan?: string | null;
  order_book?: number | string | null;
  [key: string]: any;
}

export function formatGuidanceChanges(gc: GuidanceChangesObj | string | null | undefined): string {
  if (!gc) return "";
  if (typeof gc === "string") return gc;
  if (typeof gc === "object") {
    const parts: string[] = [];
    if (gc.trend) parts.push(`Trend: ${gc.trend}`);
    if (gc.margin_corridor) parts.push(`Margin Corridor: ${gc.margin_corridor}`);
    if (gc.capex_plan) parts.push(`Capex Outlay: ${gc.capex_plan}`);
    if (gc.order_book) parts.push(`Order Book: ₹${typeof gc.order_book === "number" ? gc.order_book.toLocaleString() : gc.order_book} Cr`);
    if (parts.length > 0) return parts.join(" · ");
    return Object.entries(gc)
      .filter(([_, v]) => v !== null && v !== undefined && v !== "")
      .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`)
      .join(" · ");
  }
  return String(gc);
}

export interface InvestorInsightItem {
  id: number;
  document_id: number;
  symbol: string;
  company_name: string | null;
  sector?: string | null;
  fiscal_period: string | null;
  financial_year?: string | null;
  financial_quarter?: string | null;
  announcement_date?: string | null;
  doc_type: "INVESTOR_PRESENTATION" | "CONCALL_TRANSCRIPT" | "CONCALL_NOTES" | string;
  pdf_url: string | null;
  headline: string | null;
  status?: string;
  download_status?: string;
  extraction_status?: string;
  ai_analysis_status?: "ANALYZED" | "PENDING" | "FAILED" | string;
  analysis_completed_at?: string | null;
  processing_error?: string | null;

  // Stance & Thesis Impact
  institutional_stance:
    | "STRONG_GROWTH_LEADER"
    | "ACCUMULATE_ON_DIPS"
    | "STEADY_COMPOUNDER"
    | "TURNAROUND_CANDIDATE"
    | "CYCLICAL_PEAK"
    | "AVOID_OR_HEADWINDS"
    | "PENDING_ANALYSIS"
    | string;
  thesis_impact: "STRENGTHENING" | "NEUTRAL" | "WEAKENING" | "PENDING" | string;
  growth_conviction_score: number | null;
  management_sentiment_score: number | null;
  management_credibility_rating?: string | null;
  management_tone: "VERY_BULLISH" | "PRAGMATIC_BULLISH" | "NEUTRAL" | "CAUTIOUS" | "DEFENSIVE" | "PENDING" | string | null;
  executive_thesis: string | null;

  // Major Developments & Evidence
  positive_developments?: string[];
  negative_developments?: string[];
  guidance_changes?: GuidanceChangesObj | string | null;
  growth_implications?: string | null;
  thesis_evidence?: any;
  qoq_comparison?: any;
  operational_kpis?: any;
  commitments_count?: number;

  // Transformational / Exponential Catalyst Radar
  is_transformational_catalyst?: boolean | null;
  transformational_category?: string | null;
  catalyst_headline?: string | null;
  immediate_reaction_rationale?: string | null;
  exponential_growth_multiple?: string | null;

  // Operating Metrics
  capacity_utilization_pct: number | null;
  cwip_amount_cr: number | null;
  capex_guidance_fy: string | null;
  commissioning_timeline_cod: string | null;
  expected_asset_turnover: string | null;
  volume_vs_price_driver: string | null;

  // Margins & Pricing Power
  ebitda_margin_guidance_corridor: string | null;
  margin_drivers: string | null;
  input_cost_pass_through: string | null;
  value_added_mix_pct: number | null;

  // Order Book & Execution Runway
  executable_order_book_cr: number | null;
  book_to_bill_ratio: number | null;
  bid_pipeline_cr: number | null;
  execution_duration_months: number | null;

  // Balance Sheet & Cash Quality
  ocf_to_ebitda_ratio_pct: number | null;
  working_capital_days: number | null;
  working_capital_trend: string | null;
  debt_outlook: string | null;

  // Analyst Grill & Concall Q&A
  key_overhang_questioned_by_analysts: string | null;
  management_direct_answer: string | null;
  evasiveness_detected: string | null;
  guidance_change: string | null;

  // Forensic Tension
  evasiveness_score?: number | null;
  analyst_tension_score?: number | null;
  hot_seat_question?: string | null;
  management_defense_strategy?: string | null;
  forensic_discrepancies?: ForensicDiscrepancy[] | null;

  // Quotes & Narrative
  layman_summary?: string | null;
  direct_quotes?: DirectQuote[] | null;
  analyst_grill_quotes?: AnalystGrillQuote[] | null;
  actionable_gameplan?: ActionableGameplan | null;

  critical_monitorables: string[] | null;
  analyzed_at: string | null;
  llm_model?: string;
}

export interface InvestorDocumentItem {
  id: number;
  doc_type: string;
  fiscal_period: string;
  financial_year?: string | null;
  financial_quarter?: string | null;
  announcement_date: string | null;
  headline: string | null;
  pdf_url: string | null;
  source_url?: string | null;
  status: string;
  download_status?: string;
  extraction_status?: string;
  ai_analysis_status?: string;
  raw_text_length: number;
  created_at: string | null;
  analysis_completed_at?: string | null;
  processing_error?: string | null;
}

export interface CommitmentItem {
  id: number;
  commitment_id: string;
  symbol: string;
  company_name: string;
  statement: string;
  exact_quote: string | null;
  document_id: number;
  page_or_slide: string | null;
  original_publication_date: string | null;
  category: "FINANCIAL_TARGET" | "CAPEX_EXPANSION" | "OPERATIONAL_METRIC" | "STRATEGIC_INITIATIVE" | "PRODUCT_LAUNCH" | "DEBT_REDUCTION" | string;
  is_financial_target: boolean;
  metric: string | null;
  baseline_value: string | null;
  target_value: string | null;
  target_period: string | null;
  unit: string | null;
  comparison_basis: string | null;
  confidence_score: number;
  status:
    | "NEW"
    | "IN_PROGRESS"
    | "ON_TRACK"
    | "MET"
    | "PARTIALLY_MET"
    | "MISSED"
    | "DELAYED"
    | "REVISED"
    | "WITHDRAWN"
    | "NOT_YET_DUE"
    | "UNABLE_TO_VERIFY"
    | string;
  revisions: Array<{
    date?: string;
    revised_target?: string;
    reason?: string;
    source_quarter?: string;
  }>;
  actual_result: string | null;
  assessment_rationale: string | null;
  evidence_quote: string | null;
  evidence_links: string[];
  last_evaluated_at: string | null;
  created_at: string | null;
}

export interface CommitmentSummaryResponse {
  symbol: string;
  total_recorded: number;
  commitments_due: number;
  commitments_met: number;
  commitments_partially_met: number;
  commitments_missed: number;
  commitments_delayed: number;
  commitments_revised: number;
  commitments_withdrawn: number;
  awaiting_evidence_unverified: number;
  not_yet_due: number;
  assessable_denominator: number;
  delivery_rate_pct: number | null;
  formula_note?: string;
}

export interface AvailableQuarterItem {
  fiscal_period: string;
  financial_year: number;
  financial_quarter: number;
  count: number;
}

export interface QuarterlyCoverageResponse {
  selected_quarter: string;
  available_quarters: AvailableQuarterItem[];
  total_discovered: number;
  analyzed_count: number;
  analyzed_percentage: number;
  pending_count: number;
  failed_count: number;
  companies_covered: number;
  commitments_extracted: number;
  commitments_due: number;
  commitments_met: number;
  commitments_partially_met: number;
  commitments_missed: number;
  drilldown_records: {
    DISCOVERED_NOT_DOWNLOADED: Array<{ id: number; symbol: string; company_name: string; announcement_date?: string; pdf_url?: string; status?: string; error?: string }>;
    DOWNLOADED_NOT_EXTRACTED: Array<{ id: number; symbol: string; company_name: string; announcement_date?: string; pdf_url?: string; status?: string; error?: string }>;
    EXTRACTED_NOT_ANALYZED: Array<{ id: number; symbol: string; company_name: string; announcement_date?: string; pdf_url?: string; status?: string; error?: string }>;
    ANALYZED: Array<{ id: number; symbol: string; company_name: string; announcement_date?: string; pdf_url?: string; status?: string; error?: string }>;
    FAILED: Array<{ id: number; symbol: string; company_name: string; announcement_date?: string; pdf_url?: string; status?: string; error?: string }>;
  };
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

export interface CommitmentsLedgerResponse {
  total: number;
  page: number;
  limit: number;
  items: CommitmentItem[];
}

export interface DocumentDetailResponse {
  document: InvestorDocumentItem;
  insight: InvestorInsightItem | null;
  commitments: CommitmentItem[];
}

export async function fetchQuarterlyCoverage(quarter?: string): Promise<QuarterlyCoverageResponse> {
  const query = quarter ? `?quarter=${encodeURIComponent(quarter)}` : "";
  return fetchJson<QuarterlyCoverageResponse>(`/api/v1/investor-intelligence/coverage${query}`);
}

export async function fetchInvestorFeed(params?: {
  quarter?: string;
  stance?: string;
  thesis_impact?: string;
  analysis_status?: string;
  doc_type?: string;
  symbol?: string;
  sector?: string;
  min_score?: number;
  transformational_only?: boolean;
  page?: number;
  limit?: number;
}): Promise<InvestorFeedResponse> {
  const query = new URLSearchParams();
  if (params?.quarter && params.quarter !== "ALL") query.append("quarter", params.quarter);
  if (params?.stance && params.stance !== "ALL") query.append("stance", params.stance);
  if (params?.thesis_impact && params.thesis_impact !== "ALL") query.append("thesis_impact", params.thesis_impact);
  if (params?.analysis_status && params.analysis_status !== "ALL") query.append("analysis_status", params.analysis_status);
  if (params?.doc_type && params.doc_type !== "ALL") query.append("doc_type", params.doc_type);
  if (params?.symbol) query.append("symbol", params.symbol);
  if (params?.sector && params.sector !== "ALL") query.append("sector", params.sector);
  if (params?.min_score !== undefined) query.append("min_score", params.min_score.toString());
  if (params?.transformational_only) query.append("transformational_only", "true");
  if (params?.page) query.append("page", params.page.toString());
  if (params?.limit) query.append("limit", params.limit.toString());

  const qs = query.toString();
  return fetchJson<InvestorFeedResponse>(`/api/v1/investor-intelligence/feed${qs ? `?${qs}` : ""}`);
}

export async function fetchCommitmentsLedger(params?: {
  symbol?: string;
  quarter?: string;
  status?: string;
  category?: string;
  is_financial_target?: boolean;
  page?: number;
  limit?: number;
}): Promise<CommitmentsLedgerResponse> {
  const query = new URLSearchParams();
  if (params?.symbol) query.append("symbol", params.symbol);
  if (params?.quarter && params.quarter !== "ALL") query.append("quarter", params.quarter);
  if (params?.status && params.status !== "ALL") query.append("status", params.status);
  if (params?.category && params.category !== "ALL") query.append("category", params.category);
  if (params?.is_financial_target !== undefined) query.append("is_financial_target", params.is_financial_target.toString());
  if (params?.page) query.append("page", params.page.toString());
  if (params?.limit) query.append("limit", params.limit.toString());

  const qs = query.toString();
  return fetchJson<CommitmentsLedgerResponse>(`/api/v1/investor-intelligence/commitments${qs ? `?${qs}` : ""}`);
}

export async function fetchCommitmentsSummary(symbol?: string): Promise<CommitmentSummaryResponse> {
  const url = symbol
    ? `/api/v1/investor-intelligence/commitments/summary/${encodeURIComponent(symbol)}`
    : `/api/v1/investor-intelligence/commitments/summary`;
  return fetchJson<CommitmentSummaryResponse>(url);
}

export async function fetchDocumentDetails(documentId: number): Promise<DocumentDetailResponse> {
  return fetchJson<DocumentDetailResponse>(`/api/v1/investor-intelligence/document/${documentId}`);
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

export async function reprocessDocument(documentId: number): Promise<any> {
  return fetchJson(`/api/v1/investor-intelligence/reprocess/${documentId}`, {
    method: "POST",
  });
}

export async function triggerBackfill(limit: number = 10): Promise<any> {
  return fetchJson(`/api/v1/investor-intelligence/backfill?limit=${limit}`, {
    method: "POST",
  });
}

export async function triggerAnalyzeLatest(symbol: string): Promise<InvestorInsightItem> {
  return fetchJson(`/api/v1/investor-intelligence/analyze-latest/${encodeURIComponent(symbol)}`, {
    method: "POST",
  });
}

export interface InvestorTelemetry {
  total_documents: number;
  total_insights: number;
  pending_documents: number;
  analyzed_documents: number;
  strong_growth_count: number;
  latest_document_created_at: string | null;
  latest_document_updated_at: string | null;
  latest_insight_analyzed_at: string | null;
}

export async function fetchInvestorTelemetry(): Promise<InvestorTelemetry> {
  return fetchJson<InvestorTelemetry>(`/api/v1/investor-intelligence/telemetry`);
}

export async function triggerBatchScan(
  target: "LATEST_RESULTS" | "NIFTY50" | "PENDING_QUEUE" = "LATEST_RESULTS",
  limit: number = 5
): Promise<{ status: string; target: string; processed_count: number; results: any[] }> {
  return fetchJson(`/api/v1/investor-intelligence/batch-scan?target=${target}&limit=${limit}`, {
    method: "POST",
  });
}

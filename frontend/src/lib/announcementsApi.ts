// =======================================================
// Alpha India — Announcements & Catalyst AI Radar API Client
// Ingests high-alpha corporate filings & AI insights
// =======================================================

import { API_BASE } from "@/lib/apiConfig";


// -------------------------------------------------------
// Types
// -------------------------------------------------------

export type CatalystType =
  | "CAPEX_COMMISSIONING"
  | "ORDER_WIN"
  | "USFDA_REGULATORY"
  | "DELEVERAGING"
  | "DEMERGER_UNLOCK"
  | "GENERAL";

export type ImpactLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "NOISE";
export type RecommendationType = "STRONG_BUY" | "TACTICAL_BUY" | "ACCUMULATE" | "WATCHLIST_ONLY" | "PRICED_IN";

export type VerticalArchetype =
  | "EARNINGS_ACCELERATION"
  | "BASE_BREAKOUT"
  | "OPERATING_LEVERAGE"
  | "INSTITUTIONAL_CONSENSUS"
  | "TURNAROUND_INFLECTION"
  | "EXCHANGE_CATALYST";

export type AbsorptionStatus = "FRESH_TRIGGER" | "IN_EXPANSION" | "PRICED_IN" | "STOPPED_OUT";
export type TrendRegime = "GOLDEN_TREND" | "EARLY_BREAKOUT" | "CONSOLIDATING" | "DOWNTREND_TRAP";
export type OrderSignificanceTier = "TRANSFORMATIONAL" | "HIGH_IMPACT" | "MODERATE" | "ROUTINE";

export interface AnnouncementRadarItem {
  id: number;
  symbol: string | null;
  company_name: string;
  is_listed: boolean;
  category: string | null;
  headline: string;
  filing_description: string | null;
  catalyst_type: CatalystType | string;
  impact_level: ImpactLevel;
  impact_score: number;
  ai_insight: string | null;
  deal_value_cr: number | null;
  synergy_cwip_cr?: number | null;
  synergy_rev_addition_cr?: number | null;
  synergy_rev_pct_ttm?: number | null;
  synergy_ebitda_addition_cr?: number | null;
  synergy_ebitda_margin_pct?: number | null;
  synergy_interest_saved_cr?: number | null;
  synergy_pat_accretion_pct?: number | null;
  post_catalyst_return_1w?: number | null;
  momentum_status?: "EARLY" | "ACCUMULATING" | "PRICED_IN" | string | null;
  recommendation?: RecommendationType | string | null;
  conviction_score?: number | null;
  current_price?: number | null;
  target_price?: number | null;
  upside_pct?: number | null;
  stop_loss?: number | null;
  current_eps?: number | null;
  forward_eps?: number | null;
  valuation_pe?: number | null;
  fair_pe?: number | null;
  buy_thesis?: string | null;
  source_url: string | null;
  pdf_url: string | null;
  published_at: string;
  announcement_date?: string | null;
  recommendation_date?: string | null;
  vertical_archetype?: VerticalArchetype | string | null;
  trend_regime?: TrendRegime | string | null;
  price_at_announcement?: number | null;
  realized_move_pct?: number | null;
  absorption_status?: AbsorptionStatus | string | null;
  est_velocity_days?: string | null;
  dma_50?: number | null;
  dma_200?: number | null;

  // Order Win Quantitative Intelligence (Sprint 36.5)
  order_execution_months?: number | null;
  order_quarterly_rev_cr?: number | null;
  order_quarterly_rev_pct?: number | null;
  order_earnings_impact_cr?: number | null;
  order_significance_score?: number | null;
  order_significance_tier?: OrderSignificanceTier | string | null;
  order_upside_prob_pct?: number | null;
  order_target_price_low?: number | null;
  order_target_price_high?: number | null;
  order_confidence_score?: number | null;
  order_client_counterparty?: string | null;
  order_historical_comparison?: string | null;
  order_intelligence?: any;
}

export interface AnnouncementStats {
  total: number;
  by_catalyst: Record<string, number>;
  by_impact: Record<string, number>;
  by_recommendation?: Record<string, number>;
  by_vertical?: Record<string, number>;
  by_absorption?: Record<string, number>;
  by_velocity?: Record<string, number>;
  by_feed_source?: Record<string, number>;
  latest_published_at: string | null;
}

export interface AnnouncementQueryParams {
  page?: number;
  limit?: number;
  catalyst_type?: string | string[];
  vertical_archetype?: string | string[];
  absorption_status?: string | string[];
  trend_regime?: string;
  impact_level?: string;
  recommendation?: string | string[];
  velocity?: string | string[];
  order_tier?: OrderSignificanceTier | string | string[];
  feed_source?: "ALL" | "POLL_WIRE" | "CATALYST" | string;
  category?: string;
  search?: string;
  listed_only?: boolean;
  announcement_date_from?: string;
  announcement_date_to?: string;
  recommendation_date_from?: string;
  recommendation_date_to?: string;
  sort_by?: string;
  sort_order?: "asc" | "desc";
}

// -------------------------------------------------------
// Helper
// -------------------------------------------------------

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    cache: "no-store",
    ...options,
  });
  if (!res.ok) throw new Error(`API Error (${res.status}): ${endpoint}`);
  return res.json();
}

// -------------------------------------------------------
// API functions
// -------------------------------------------------------

export async function fetchAnnouncements(
  params: AnnouncementQueryParams = {}
): Promise<AnnouncementRadarItem[]> {
  const qs = new URLSearchParams();
  if (params.page)               qs.set("page",               String(params.page));
  if (params.limit)              qs.set("limit",              String(params.limit));
  if (params.catalyst_type) {
    const v = Array.isArray(params.catalyst_type) ? params.catalyst_type.join(",") : params.catalyst_type;
    if (v) qs.set("catalyst_type", v);
  }
  if (params.vertical_archetype) {
    const v = Array.isArray(params.vertical_archetype) ? params.vertical_archetype.join(",") : params.vertical_archetype;
    if (v) qs.set("vertical_archetype", v);
  }
  if (params.absorption_status) {
    const v = Array.isArray(params.absorption_status) ? params.absorption_status.join(",") : params.absorption_status;
    if (v) qs.set("absorption_status", v);
  }
  if (params.velocity) {
    const v = Array.isArray(params.velocity) ? params.velocity.join(",") : params.velocity;
    if (v) qs.set("velocity", v);
  }
  if (params.order_tier) {
    const v = Array.isArray(params.order_tier) ? params.order_tier.join(",") : params.order_tier;
    if (v) qs.set("order_tier", v);
  }
  if (params.feed_source && params.feed_source !== "ALL") {
    qs.set("feed_source", params.feed_source);
  }
  if (params.category)           qs.set("category",           params.category);
  if (params.trend_regime)       qs.set("trend_regime",       params.trend_regime);
  if (params.impact_level)       qs.set("impact_level",       params.impact_level);
  if (params.recommendation) {
    const v = Array.isArray(params.recommendation) ? params.recommendation.join(",") : params.recommendation;
    if (v) qs.set("recommendation", v);
  }
  if (params.search)                   qs.set("search",                   params.search);
  if (params.listed_only)              qs.set("listed_only",              "true");
  if (params.announcement_date_from)   qs.set("announcement_date_from",   params.announcement_date_from);
  if (params.announcement_date_to)     qs.set("announcement_date_to",     params.announcement_date_to);
  if (params.recommendation_date_from) qs.set("recommendation_date_from", params.recommendation_date_from);
  if (params.recommendation_date_to)   qs.set("recommendation_date_to",   params.recommendation_date_to);
  if (params.sort_by)                  qs.set("sort_by",                  params.sort_by);
  if (params.sort_order)               qs.set("sort_order",               params.sort_order);

  return request<AnnouncementRadarItem[]>(`/announcements/radar?${qs.toString()}`);
}

export async function fetchAnnouncementStats(): Promise<AnnouncementStats> {
  return request<AnnouncementStats>("/announcements/stats");
}

export interface LiveWireTelemetry {
  is_running: boolean;
  poll_interval_seconds: number;
  last_poll_time: string | null;
  total_filings_scanned: number;
  catalysts_discovered: number;
  current_cursor_offset: number;
}

export async function fetchLiveWireStatus(): Promise<LiveWireTelemetry> {
  return request<LiveWireTelemetry>("/announcements/live-wire/status");
}

export async function triggerLiveWirePoll(): Promise<{ status: string; result: Record<string, unknown>; telemetry: LiveWireTelemetry }> {
  return request<{ status: string; result: Record<string, unknown>; telemetry: LiveWireTelemetry }>("/announcements/live-wire/poll", {
    method: "POST",
  });
}


export async function triggerAnnouncementsSync(): Promise<{ status: string; message: string }> {
  return request<{ status: string; message: string }>("/announcements/run", {
    method: "POST",
  });
}

export async function sendTelegramAlert(
  announcementId: number
): Promise<{ status: string; message: string }> {
  return request<{ status: string; message: string }>(
    `/announcements/${announcementId}/alert/telegram`,
    { method: "POST" }
  );
}

export async function addCatalystToWatchlist(
  announcementId: number
): Promise<{ status: string; message: string; symbol?: string }> {
  return request<{ status: string; message: string; symbol?: string }>(
    `/announcements/${announcementId}/watchlist`,
    { method: "POST" }
  );
}

export async function triggerOrderWinsAnalysis(
  limit: number = 1000
): Promise<{ status: string; message: string; result: Record<string, unknown> }> {
  return request<{ status: string; message: string; result: Record<string, unknown> }>(
    `/announcements/order-wins/analyze-all?limit=${limit}`,
    { method: "POST" }
  );
}

export async function analyzeSingleOrderWin(
  announcementId: number
): Promise<AnnouncementRadarItem> {
  return request<AnnouncementRadarItem>(
    `/announcements/order-wins/${announcementId}/analyze`,
    { method: "POST" }
  );
}

export async function fetchAnnouncementById(
  announcementId: number
): Promise<AnnouncementRadarItem> {
  return request<AnnouncementRadarItem>(`/announcements/${announcementId}`);
}


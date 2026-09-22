/**
 * Alpha India - Pre-Breakout Cheat Radar API Client
 */

import { fetchJson } from "@/lib/apiConfig";

export interface PreBreakoutMetrics {
  dist_to_pivot_pct: number;
  vdu_ratio: number;
  volume_today: number;
  volume_sma20: number;
  daily_range_pct: number;
  bb_bandwidth: number;
  rsi_14: number;
  is_stage_2: boolean;
  is_nr7: boolean;
  is_inside_day: boolean;
  is_vdu: boolean;
  is_bb_squeeze: boolean;
  today_high: number;
  today_low: number;
  pivot_20d: number;
}

export interface PreBreakoutBlueprint {
  cheat_entry: number;
  stop_loss: number;
  target_1: number;
  target_2: number;
  risk_pct: number;
  reward_pct: number;
  risk_reward: number;
  plan: string;
}

export interface PreBreakoutOpportunity {
  symbol: string;
  company_name: string;
  sector: string;
  cmp: number;
  day_change: number;
  day_change_pct: number;
  conviction_score: number;
  setup_tier: string;
  tier_badge: string;
  primary_pattern: string;
  pattern_tag: string;
  pattern_badges: string[];
  metrics: PreBreakoutMetrics;
  blueprint: PreBreakoutBlueprint;
  tradingview_url: string;
  techno_funda_url: string;
}

export interface PreBreakoutMetadata {
  total_scanned: number;
  super_coils_count: number;
  high_conviction_count: number;
  nr7_count: number;
  inside_day_count: number;
  vdu_count: number;
  avg_risk_reward: number;
  scan_duration_seconds: number;
  last_scan_time: string;
}

export interface PreBreakoutResponse {
  metadata: PreBreakoutMetadata;
  total_count: number;
  page: number;
  limit: number;
  total_pages: number;
  items: PreBreakoutOpportunity[];
}

export interface PatternConfig {
  id: string;
  label: string;
}

export interface PrebreakoutFilterOptionsResponse {
  sectors: string[];
  patterns: PatternConfig[];
  metadata: PreBreakoutMetadata;
}

export interface FetchPrebreakoutParams {
  min_score?: number;
  pattern?: string;
  sector?: string;
  search?: string;
  sort_by?: string;
  sort_order?: "asc" | "desc";
  page?: number;
  limit?: number;
}

export async function fetchPrebreakoutOpportunities(
  params: FetchPrebreakoutParams = {}
): Promise<PreBreakoutResponse> {
  const query = new URLSearchParams();
  if (params.min_score !== undefined) query.set("min_score", String(params.min_score));
  if (params.pattern) query.set("pattern", params.pattern);
  if (params.sector) query.set("sector", params.sector);
  if (params.search) query.set("search", params.search);
  if (params.sort_by) query.set("sort_by", params.sort_by);
  if (params.sort_order) query.set("sort_order", params.sort_order);
  if (params.page !== undefined) query.set("page", String(params.page));
  if (params.limit !== undefined) query.set("limit", String(params.limit));

  return fetchJson<PreBreakoutResponse>(
    `/api/v1/pre-breakout-radar?${query.toString()}`
  );
}

export async function triggerPrebreakoutScan(): Promise<any> {
  return fetchJson(`/api/v1/pre-breakout-radar/scan`, {
    method: "POST",
  });
}

export async function fetchPrebreakoutFilterOptions(): Promise<PrebreakoutFilterOptionsResponse> {
  return fetchJson<PrebreakoutFilterOptionsResponse>(`/api/v1/pre-breakout-radar/filters`);
}

/**
 * Alpha India - Breakout Execution Engine API Client
 * REST client for the live Breakout Watcher & Execution Engine.
 */

import { fetchJson } from "@/lib/apiConfig";

export type BreakoutExecutionStatus =
  | "COILING"
  | "READY"
  | "TRIGGERED"
  | "EXTENDED"
  | "FAILED";

export interface BreakoutExecutionCandidate {
  id: number;
  symbol: string;
  company_name: string;
  sector: string;
  pattern_tag: string;
  conviction_score: number;
  setup_tier: string;
  added_at_cmp: number;
  current_cmp: number;
  day_change_pct: number;
  trigger_price: number;
  stop_loss: number;
  target_1: number;
  target_2: number;
  buy_zone_max: number;
  risk_reward: number;
  distance_to_trigger_pct: number;
  volume_pace_ratio: number;
  execution_status: BreakoutExecutionStatus;
  triggered_at: string | null;
  alert_dispatched: boolean;
  is_active: boolean;
  auto_enrolled: boolean;
  notes?: string | null;
  updated_at: string | null;
  tradingview_url: string;
  techno_funda_url: string;
}

export interface BreakoutExecutionStats {
  total_watched: number;
  triggered_count: number;
  ready_count: number;
  coiling_count: number;
  extended_count: number;
  failed_count: number;
  avg_risk_reward: number;
  last_check_time: string;
}

export interface BreakoutExecutionResponse {
  stats: BreakoutExecutionStats;
  total_count: number;
  items: BreakoutExecutionCandidate[];
}

export interface WatchCandidatePayload {
  symbol: string;
  company_name?: string;
  sector?: string;
  pattern_tag?: string;
  conviction_score?: number;
  setup_tier?: string;
  cmp: number;
  day_change_pct?: number;
  trigger_price?: number;
  stop_loss?: number;
  target_1?: number;
  target_2?: number;
  notes?: string;
}

export async function fetchBreakoutCandidates(
  status: string = "ALL"
): Promise<BreakoutExecutionResponse> {
  const query = new URLSearchParams();
  if (status && status !== "ALL") {
    query.set("status", status);
  }
  return fetchJson<BreakoutExecutionResponse>(
    `/api/v1/breakout-execution/candidates?${query.toString()}`,
    { timeoutMs: 25000 }
  );
}

export async function watchBreakoutCandidate(
  payload: WatchCandidatePayload
): Promise<any> {
  return fetchJson(`/api/v1/breakout-execution/watch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    timeoutMs: 25000,
  });
}

export async function removeBreakoutCandidate(symbol: string): Promise<any> {
  return fetchJson(`/api/v1/breakout-execution/watch/${symbol}`, {
    method: "DELETE",
    timeoutMs: 25000,
  });
}

export async function autoEnrollTopBreakoutCandidates(
  limit: number = 10,
  minConviction: number = 70
): Promise<any> {
  return fetchJson(`/api/v1/breakout-execution/auto-enroll`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ limit, min_conviction: minConviction }),
    timeoutMs: 35000,
  });
}

export async function checkBreakoutStatusNow(): Promise<any> {
  return fetchJson(`/api/v1/breakout-execution/check-now`, {
    method: "POST",
    timeoutMs: 35000,
  });
}

export async function resetBreakoutCandidateAlert(symbol: string): Promise<any> {
  return fetchJson(`/api/v1/breakout-execution/reset/${symbol}`, {
    method: "POST",
    timeoutMs: 25000,
  });
}

export async function fetchBreakoutStats(): Promise<BreakoutExecutionStats> {
  return fetchJson<BreakoutExecutionStats>(`/api/v1/breakout-execution/stats`, {
    timeoutMs: 25000,
  });
}

export async function testBreakoutTelegramAlert(symbol: string): Promise<any> {
  return fetchJson(`/api/v1/breakout-execution/test-telegram/${symbol}`, {
    method: "POST",
    timeoutMs: 25000,
  });
}

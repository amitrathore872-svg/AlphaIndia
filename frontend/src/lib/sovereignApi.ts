/**
 * Alpha India - Sovereign Alpha & Velocity Cockpit API Client
 * Sprint 42.0 Institutional Apex Trading System
 */

export interface ExecutionParameters {
  buy_box_range: [number, number];
  pilot_allocation_pct: number;
  pyramid_trigger_price: number;
  hard_stop_loss: number;
  hard_stop_pct: number;
  time_stop_sessions: number;
  target_1_harvest: number;
  target_1_pct: number;
  target_2_harvest: number;
  target_2_pct: number;
  target_runner: number;
  risk_reward_ratio: string;
  recommended_portfolio_weight_pct: number;
}

export interface CandidateFundamentals {
  roce: number;
  roe: number;
  quarterly_pat_yoy: number;
  quarterly_sales_yoy: number;
  opm_latest: number;
  debt_to_equity: number;
  cfo_to_pat: number;
  pe_ratio: number | null;
}

export interface CandidateTechnicals {
  distance_52w_high: number;
  dma_50: number;
  dma_200: number;
  rsi_14: number;
}

export interface SovereignCandidate {
  symbol: string;
  company_name: string;
  sector: string;
  industry: string;
  market_cap_cr: number;
  current_price: number;
  chamber: "COMPOUNDER" | "TURNAROUND";
  conviction_bias: string;
  composite_score: number;
  stage: "IGNITION_READY" | "INCUBATING_COIL" | "STAGE_2_EXPANSION";
  stage_description: string;
  fundamentals: CandidateFundamentals;
  technicals: CandidateTechnicals;
  execution: ExecutionParameters;
}

export interface ChamberData {
  count: number;
  label: string;
  win_rate_expectation: string;
  candidates: SovereignCandidate[];
}

export interface SovereignCockpitResponse {
  timestamp: string;
  status: string;
  universe_scanned: number;
  total_qualified: number;
  average_conviction: number;
  chamber_1_compounders: ChamberData;
  chamber_2_turnarounds: ChamberData;
  execution_rules_summary: {
    pilot_allocation_pct: number;
    pyramid_allocation_pct: number;
    hard_stop_loss_pct: number;
    time_stop_days: number;
    target_1_harvest_pct: number;
    target_2_harvest_pct: number;
    runner_trail: string;
  };
}

export interface AIDossierResponse {
  symbol: string;
  company_name: string;
  sector: string;
  industry: string;
  current_price: number;
  ai_conviction_score: number;
  verdict: string;
  macro_tailwinds: string[];
  macro_headwinds: string[];
  bull_case: string[];
  bear_case: string[];
  forensic_integrity: {
    pledge_risk: string;
    cash_flow_integrity: string;
    accounting_red_flags: string;
    concall_sentiment: string;
  };
  recent_announcements: Array<{
    date: string;
    headline: string;
    category: string;
    growth_impact: string;
  }>;
  invalidation_anchor: string;
  concall_takeaway: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function fetchSovereignCockpit(chamber?: string): Promise<SovereignCockpitResponse> {
  const queryParam = chamber && chamber !== "ALL" ? `?chamber=${encodeURIComponent(chamber)}` : "";
  const res = await fetch(`${API_BASE}/api/sovereign/cockpit${queryParam}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch Sovereign Cockpit: ${res.statusText}`);
  }
  return res.json();
}

export async function fetchAIDossier(symbol: string): Promise<AIDossierResponse> {
  const res = await fetch(`${API_BASE}/api/sovereign/dossier/${encodeURIComponent(symbol)}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch AI Dossier for ${symbol}: ${res.statusText}`);
  }
  return res.json();
}

export async function dispatchSovereignAlert(
  symbol: string,
  alert_type: string,
  custom_note?: string
): Promise<{ ok: boolean; title: string; telegram_dispatched: boolean; in_app_created: boolean }> {
  const res = await fetch(`${API_BASE}/api/sovereign/dispatch-alert`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symbol, alert_type, custom_note }),
  });
  if (!res.ok) {
    throw new Error(`Alert dispatch failed: ${res.statusText}`);
  }
  return res.json();
}

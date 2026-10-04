/**
 * Alpha India - Sovereign Intraday Cockpit API Client
 * Sprint 42.5 Flagship Institutional Day-Trading Terminal
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface FeedStatus {
  provider: string;
  latency: string;
  active_quotes: number;
  rate_limit_usage: string;
}

export interface TemporalWindow {
  current_ist: string;
  current_time_str: string;
  is_market_open: boolean;
  window_id: string;
  window_name: string;
  remaining_seconds: number;
  remaining_formatted: string;
  active_chambers: string[];
  in_chop_zone: boolean;
  status_description: string;
}

export interface ActiveSignal {
  id: number;
  symbol: string;
  company_name: string;
  sector: string;
  chamber: string;
  chamber_label: string;
  window_name: string;
  window_end: string;
  status: "ARMED" | "TRIGGERED" | "RUNNING" | "EXPIRED";
  cmp: number;
  day_change_pct: number;
  trigger_entry: number;
  stop_loss: number;
  target_1: number;
  target_2: number;
  risk_per_share: number;
  risk_pct: number;
  rvol: number;
  open_low_wick_pct: number;
  cpr_width_pct: number;
  conviction_score: number;
  source: string;
  current_r: number;
  is_breakeven_locked: boolean;
  action_hint: string;
}

export interface ChamberSection {
  label: string;
  target_move: string;
  candidates: ActiveSignal[];
}

export interface SovereignIntradayRadarResponse {
  timestamp: string;
  feed_status: FeedStatus;
  temporal_window: TemporalWindow;
  summary_stats: {
    total_active_candidates: number;
    chamber_a_count: number;
    chamber_b_count: number;
    chamber_c_count: number;
    triggered_count: number;
  };
  chamber_a_titans: ChamberSection;
  chamber_b_cash_movers: ChamberSection;
  chamber_c_london_breakout: ChamberSection;
}

export interface ExecutionLogTrade {
  id: number;
  date: string;
  symbol: string;
  company_name: string;
  chamber: string;
  entry_time: string;
  exit_time: string;
  entry_price: number;
  exit_price: number;
  stop_loss: number;
  realized_r: number;
  shares: number;
  position_val_inr: number;
  gross_pnl_inr: number;
  friction_inr: number;
  net_pnl_inr: number;
  account_balance_inr: number;
  outcome: "WIN" | "LOSS" | "BREAKEVEN" | "EXPIRED_UNTRIGGERED" | "VELOCITY_STALL";
  close_reason: string;
}

export interface MonthlyStats {
  month: string;
  total_trades: number;
  wins: number;
  losses: number;
  win_rate_pct: number;
  net_profit_inr: number;
}

export interface SovereignIntradayLogResponse {
  summary: {
    initial_capital_inr: number;
    current_capital_inr: number;
    total_net_profit_inr: number;
    total_roi_pct: number;
    total_trades: number;
    wins: number;
    losses: number;
    win_rate_pct: number;
    profit_factor: number;
    max_drawdown_pct: number;
  };
  monthly_breakdown: MonthlyStats[];
  recent_trades: ExecutionLogTrade[];
}

export async function fetchSovereignIntradayRadar(force = false): Promise<SovereignIntradayRadarResponse> {
  const url = `${API_BASE_URL}/api/v1/sovereign-intraday/radar${force ? "?force_refresh=true" : ""}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch Sovereign Intraday Radar: HTTP ${res.status}`);
  }
  return res.json();
}

export async function fetchSovereignIntradayLog(limit = 100): Promise<SovereignIntradayLogResponse> {
  const url = `${API_BASE_URL}/api/v1/sovereign-intraday/log?limit=${limit}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch Sovereign Intraday Log: HTTP ${res.status}`);
  }
  return res.json();
}

export async function refreshSovereignIntradayQuotes(): Promise<{ ok: boolean; feed_status?: FeedStatus }> {
  const url = `${API_BASE_URL}/api/v1/sovereign-intraday/refresh`;
  const res = await fetch(url, { method: "POST" });
  if (!res.ok) {
    throw new Error(`Failed to refresh 5Paisa quotes: HTTP ${res.status}`);
  }
  return res.json();
}

export async function broadcastSovereignIntradaySignal(signalId: number): Promise<{ ok: boolean; title: string; telegram_sent: boolean }> {
  const url = `${API_BASE_URL}/api/v1/sovereign-intraday/broadcast/${signalId}`;
  const res = await fetch(url, { method: "POST" });
  if (!res.ok) {
    throw new Error(`Failed to broadcast signal alert: HTTP ${res.status}`);
  }
  return res.json();
}

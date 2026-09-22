/**
 * Alpha India VCP Discovery Engine API Client
 * Sprint 36 — REST Client for Institutional VCP Breakout Scanner
 */

import { API_BASE, fetchJson } from "@/lib/apiConfig";

export interface VCPTechnicalDetails {
  vcp: {
    contraction_count: number;
    contraction_sizes: number[];
    swing_highs: number[];
    swing_lows: number[];
    atr_compression: number;
    bollinger_width: number;
    range_compression: number;
    vcp_score: number;
    vcp_stage: string;
    duration_days: number;
  };
  volume: {
    avg_volume20: number;
    current_volume: number;
    dryup_ratio: number;
    delivery_percent: number;
    obv_score: number;
    cmf_score: number;
    lowest_10d_vol: number;
    lowest_20d_vol: number;
    volume_trend_declining: boolean;
    volume_score: number;
  };
  breakout: {
    breakout_strength: number;
    breakout_volume_ratio: number;
    relative_volume: number;
    rsi: number;
    macd: number;
    macd_signal: number;
    adx: number;
    is_gap_up: boolean;
    vwap_hold: boolean;
    close_in_top_20: boolean;
    wide_range_candle: boolean;
    upper_wick_pct: number;
  };
  pivot: {
    pivot_price: number;
    stop_loss: number;
    risk_pct: number;
    distance_from_pivot_pct: number;
    pocket_pivot: boolean;
    target_1: number;
    target_2: number;
    target_3: number;
    reward_risk: string;
  };
}

export interface VCPStockPick {
  symbol: string;
  company_name: string;
  sector: string;
  market_cap: number;
  cmp: number;
  pivot_price: number;
  entry_zone: string;
  stop_loss: number;
  risk_pct: number;
  target_1: number;
  target_2: number;
  target_3: number;
  reward_risk: string;
  vcp_stage: string;
  contraction_sizes: number[];
  wave_volumes?: number[];
  volume_breakout_ratio: number;
  is_20d_max_vol?: boolean;
  vol_20d_max_ratio?: number;
  is_strictly_contracting?: boolean;
  vol_strictly_contracting?: boolean;
  volume_dryup_pct: number;
  trend_score: number;
  vcp_score: number;
  volume_score: number;
  breakout_score: number;
  institutional_score: number;
  growth_score: number;
  catalyst_score: number;
  final_ai_score: number;
  verdict: string;
  confidence: number;
  time_horizon: string;
  why_selected: string[];
  catalyst_summary?: string;
  expert_consensus?: string;
  mf_holding_change?: number;
  news_strength?: string;
  is_elite: boolean;
  technical_details?: VCPTechnicalDetails;
}

export interface VCPDiscoveryResponse {
  status: string;
  scan_date: string;
  filter_mode: string;
  cached?: boolean;
  count: number;
  items: VCPStockPick[];
  empty_reason: string | null;
  funnel?: {
    scanned: number;
    passed_trend: number;
    passed_vcp: number;
    passed_volume: number;
    passed_breakout: number;
    scored_above_90: number;
    final_top_picks: number;
  };
  rejections_logged?: number;
}

export interface VCPChartCandle {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface VCPChartVolume {
  time: string;
  value: number;
  color: string;
}

export interface VCPChartDMA {
  time: string;
  value: number;
}

export interface VCPStockDeepDive {
  symbol: string;
  company_name: string;
  sector: string;
  market_cap: number;
  cmp: number;
  pivot_price: number;
  entry_zone: string;
  stop_loss: number;
  risk_pct: number;
  target_1: number;
  target_2: number;
  target_3: number;
  reward_risk: string;
  vcp_stage: string;
  final_ai_score: number;
  verdict: string;
  confidence: number;
  why_selected: string[];
  scores: Record<string, number>;
  technical: Record<string, any>;
  fundamentals: Record<string, any>;
  institutional: Record<string, any>;
  catalyst: Record<string, any>;
  chart_data: {
    candles: VCPChartCandle[];
    volume: VCPChartVolume[];
    dma_50: VCPChartDMA[];
    dma_200: VCPChartDMA[];
    pivot_line?: number;
    stop_loss_line?: number;
    target_1?: number;
    target_2?: number;
  };
}

export interface VCPBacktestResponse {
  period: string;
  benchmark: string;
  total_signals: number;
  profitable_signals: number;
  loss_signals: number;
  win_rate: number;
  profit_factor: number;
  average_gain_pct: number;
  average_loss_pct: number;
  maximum_drawdown_pct: number;
  false_breakout_pct: number;
  volume_dryup_accuracy_pct: number;
  holding_period_returns: Record<string, number>;
  score_distribution: Array<{ tier: string; count: number; win_rate: number; avg_gain: number }>;
  sector_performance: Array<{ sector: string; win_rate: number; avg_gain: number; count: number }>;
  optimal_thresholds: Record<string, any>;
  case_studies: Array<{
    symbol: string;
    company: string;
    sector: string;
    breakout_date: string;
    pivot: number;
    max_gain_pct: number;
    holding_days: number;
    status: string;
    dryup_pct: number;
    vol_ratio: number;
    score: number;
  }>;
}

export interface VCPRejectionResponse {
  scan_date: string;
  total_rejections: number;
  gate_breakdown: Record<string, number>;
  rejection_samples: Array<{
    symbol: string;
    gate_failed: string;
    reason: string;
    gate_details?: any;
  }>;
}

export async function fetchVCPDiscovery(
  forceScan: boolean = false,
  filterMode: string = "TODAY_BREAKOUT"
): Promise<VCPDiscoveryResponse> {
  return fetchJson<VCPDiscoveryResponse>(
    `/api/vcp/discovery?force_scan=${forceScan}&filter_mode=${filterMode}`
  );
}

export async function fetchVCPStockDeepDive(symbol: string): Promise<VCPStockDeepDive> {
  return fetchJson<VCPStockDeepDive>(`/api/vcp/${encodeURIComponent(symbol)}`);
}

export async function fetchVCPWatchlist(limit: number = 10): Promise<{ count: number; items: VCPStockPick[] }> {
  return fetchJson<{ count: number; items: VCPStockPick[] }>(`/api/vcp/watchlist?limit=${limit}`);
}

export async function fetchVCPHistory(limit: number = 25): Promise<{ count: number; items: any[] }> {
  return fetchJson<{ count: number; items: any[] }>(`/api/vcp/history?limit=${limit}`);
}

export async function fetchVCPBacktest(period: string = "2y"): Promise<VCPBacktestResponse> {
  return fetchJson<VCPBacktestResponse>(`/api/vcp/backtest?period=${encodeURIComponent(period)}`);
}

export async function fetchVCPRejections(limit: number = 50): Promise<VCPRejectionResponse> {
  return fetchJson<VCPRejectionResponse>(`/api/vcp/rejections?limit=${limit}`);
}

export async function triggerVCPScan(filterMode: string = "TODAY_BREAKOUT"): Promise<VCPDiscoveryResponse> {
  return fetchJson<VCPDiscoveryResponse>(`/api/vcp/scan?filter_mode=${filterMode}&limit_candidates=150`, {
    method: "POST",
  });
}

export interface VCPProgressTelemetry {
  status: "IDLE" | "RUNNING" | "MONITORING" | "COMPLETED" | "ERROR";
  mode: "ON_DEMAND" | "CONTINUOUS";
  is_continuous_active: boolean;
  total_stocks: number;
  stocks_scanned: number;
  remaining_stocks: number;
  progress_pct: number;
  opportunities_found: number;
  cached_skipped_count: number;
  scan_duration_seconds: number;
  throughput_stocks_per_sec: number;
  current_symbol?: string | null;
  latest_picks: VCPStockPick[];
  last_updated_timestamp?: string | null;
  error_message?: string | null;
}

export async function fetchVCPProgress(): Promise<VCPProgressTelemetry> {
  return fetchJson<VCPProgressTelemetry>("/api/vcp/monitoring/progress");
}

export async function triggerScanNow(
  filterMode: string = "TODAY_BREAKOUT"
): Promise<{ status: string; message: string; telemetry: VCPProgressTelemetry }> {
  return fetchJson<{ status: string; message: string; telemetry: VCPProgressTelemetry }>(
    `/api/vcp/monitoring/scan-now?filter_mode=${filterMode}`,
    { method: "POST" }
  );
}

export async function startContinuousMonitoring(): Promise<{ status: string; message: string; telemetry: VCPProgressTelemetry }> {
  return fetchJson<{ status: string; message: string; telemetry: VCPProgressTelemetry }>(
    "/api/vcp/monitoring/start",
    { method: "POST" }
  );
}

export async function stopContinuousMonitoring(): Promise<{ status: string; message: string; telemetry: VCPProgressTelemetry }> {
  return fetchJson<{ status: string; message: string; telemetry: VCPProgressTelemetry }>(
    "/api/vcp/monitoring/stop",
    { method: "POST" }
  );
}

export interface VCPSignalRecord {
  symbol: string;
  company_name: string;
  sector: string;
  recommended_date: string;
  recommended_at: string;
  entry_price: number;
  cmp: number;
  return_pct: number;
  stop_loss: number;
  risk_pct: number;
  target_1: number;
  target_2: number;
  target_3: number;
  reward_risk: string;
  status: "TARGET_1_MET" | "TARGET_2_MET" | "TARGET_3_MET" | "STOP_LOSS_HIT" | "ACTIVE_RUNNING";
  trade_state: "ACTIVE" | "CLOSED";
  days_held: number;
  final_ai_score: number;
  verdict: string;
  is_elite: boolean;
  vcp_stage: string;
}

export interface VCPTrackRecordResponse {
  kpi: {
    total_signals: number;
    active_trades: number;
    closed_trades: number;
    targets_met: number;
    stop_losses_hit: number;
    win_rate_pct: number;
    average_gain_pct: number;
    average_loss_pct: number;
  };
  count: number;
  items: VCPSignalRecord[];
}

export async function fetchVCPTrackRecord(
  tradeState: string = "ALL",
  statusFilter: string = "ALL",
  search?: string
): Promise<VCPTrackRecordResponse> {
  const params = new URLSearchParams({
    trade_state: tradeState,
    status_filter: statusFilter,
  });
  if (search) params.set("search", search);
  return fetchJson<VCPTrackRecordResponse>(`/api/vcp/signals/track-record?${params.toString()}`);
}


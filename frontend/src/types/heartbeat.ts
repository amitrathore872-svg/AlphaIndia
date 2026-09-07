export interface MonitoringHeartbeat {
  id: number;

  engine_status: string;
  current_session: string;

  last_scan_time: string | null;
  next_scan_time: string | null;

  companies_scanned_today: number;
  results_found_today: number;
  parser_failures_today: number;

  heartbeat_at: string;
}
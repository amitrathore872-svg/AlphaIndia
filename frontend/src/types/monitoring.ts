// =======================================================
// Alpha India Mission Control Types
// Sprint 33.3 Phase 1.1
// =======================================================

// ---------------- Heartbeat ----------------

export interface MonitoringHeartbeat {
  status: "ONLINE" | "OFFLINE";

  engine: string;

  collector_status: string;

  last_scan: string;

  next_scan: string;

  scan_interval_seconds: number;

  companies_scanned_today: number;

  results_found_today: number;

  pdf_downloaded_today: number;

  parser_failures_today: number;
}

// ---------------- Warehouse Summary ----------------

export interface WarehouseSummary {
  warehouse: {
    total_companies: number;
    imported_companies: number;
    pending_companies: number;
    coverage_percent: number;
    quarterly_records: number;
  };

  audit: {
    total_audited: number;
    pass: number;
    warning: number;
    fail: number;
  };
}

// ---------------- Discovery Engine ----------------

export interface DiscoveryStatus {
  engine_status: string;

  current_session: string;

  next_scan_time: string;

  last_scan_time: string;

  companies_scanned_today: number;

  results_found_today: number;

  parser_failures_today: number;
}

// ---------------- Audit Engine ----------------

export interface AuditBackfillStatus {
  running: boolean;

  thread_alive: boolean;

  progress_percent: number;

  processed: number;

  passed: number;

  warning: number;

  failed: number;

  total: number;

  started_at: string | null;

  last_symbol: string | null;

  last_error?: string | null;
}

// ---------------- Combined Mission Control ----------------

export interface MissionControlStatus {
  heartbeat: MonitoringHeartbeat;

  warehouse: WarehouseSummary;

  discovery: DiscoveryStatus;

  audit: AuditBackfillStatus;
}
// =======================================================
// Discovery Queue Types
// Sprint 33.4
// =======================================================

export interface DiscoveryQueueItem {
  symbol: string;
  company: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  updated_at: string;
}

export interface DiscoveryQueueResponse {
  pending: number;
  completed: number;
  running: string[];
  queue: DiscoveryQueueItem[];
}
// =======================================================
// Discovery Queue Summary
// Sprint 33.4 Phase A
// =======================================================

export interface DiscoveryQueueSummary {
  success: boolean;
  pending: number;
  completed: number;
  running: string[] | null;
  total: number;
}
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

// =======================================================
// Scanner Timeline Event Types (Real Filing Events)
// =======================================================

export type ScannerEventType =
  | "ALL"
  | "DISCOVERY"
  | "DOWNLOAD"
  | "IMPORT"
  | "AUDIT"
  | "AI";

export interface TimelineFilingEvent {
  id: number;
  symbol: string;
  company: string;
  type: "DISCOVERY" | "DOWNLOAD" | "IMPORT" | "AUDIT" | "AI";
  filing_type: string;
  period: string;
  exchange: string;
  download_status: string;
  parse_status: string;
  pdf_url?: string | null;
  time: string;
  time_display: string;
  date_display?: string;
  message: string;
}

export interface TimelineEventsResponse {
  success: boolean;
  count: number;
  total_filings: number;
  events: TimelineFilingEvent[];
}

// =======================================================
// Sprint 23 — Validation Scorecard & Pipeline Types
// =======================================================

export interface ReconciliationFieldResult {
  field_name: string;
  field_key: string;
  screener_value: number | null;
  nse_value: number | null;
  variance_pct: number | null;
  status: "EXACT_MATCH" | "WITHIN_TOLERANCE" | "DIFFERENCE_FOUND" | "MISSING_IN_SCREENER" | "PARSE_ERROR";
  diagnosis: string;
  action_taken: string;
  notes: string | null;
}

export interface ValidationCompanyRecord {
  index: number;
  symbol: string;
  company_name: string;
  quarter: string;
  sector: string;
  industry: string;
  market_cap_category: string;
  discovery: {
    status: string;
    session: string;
    filing_type: string;
    pdf_url: string;
  };
  reconciliation: {
    overall_status: "EXACT_MATCH" | "WITHIN_TOLERANCE" | "DIFFERENCE_FOUND" | "MISSING_IN_SCREENER";
    overall_action: "UPDATED_FROM_NSE" | "UNCHANGED";
    max_variance: number;
    field_results: ReconciliationFieldResult[];
  };
  import: {
    action: "IMPORTED_NEW" | "UPDATED_FROM_NSE" | "UNCHANGED";
    source: string;
    active_fields: Record<string, string | number | boolean | null>;
  };
  audit: {
    status: "PASS" | "WARNING" | "FAIL";
    checks: Array<{ check: string; passed: boolean }>;
    passed_checks: number;
    total_checks: number;
  };
  ai_growth: {
    growth_score: number;
    discovery_strength: number;
    hot_topic_score: number;
    ai_summary: string[];
    revenue_analysis: string;
    pat_analysis: string;
    eps_analysis: string;
  };
}

export interface ValidationScorecardResponse {
  success: boolean;
  summary: {
    total_companies: number;
    target_companies: number;
    passed_audit: number;
    pass_rate: number;
    avg_growth_score: number;
    avg_discovery_strength: number;
    status: string;
    is_running: boolean;
    current_company: string;
    total_reconciled_fields: number;
  };
  engine_metrics: {
    discovery: Record<string, string | number | boolean | null>;
    import: Record<string, string | number | boolean | null>;
    reconciliation: Record<string, string | number | boolean | null>;
    audit: Record<string, string | number | boolean | null>;
    ai: Record<string, string | number | boolean | null>;
  };
  records: ValidationCompanyRecord[];
}

export interface Sprint23EngineCardItem {
  name: string;
  status: string;
  color: "green" | "blue" | "cyan" | "amber" | "violet";
  metrics: [string, string][];
}

export interface Sprint23EnginesResponse {
  success: boolean;
  engines: Sprint23EngineCardItem[];
}

export interface ReplayStatePayload {
  is_running: boolean;
  current_index: number;
  total_companies: number;
  current_company: string;
  status: string;
  start_time?: string | null;
  completed_time?: string | null;
  discovery?: Record<string, string | number | boolean | null>;
  import?: Record<string, string | number | boolean | null>;
  reconciliation?: Record<string, string | number | boolean | null>;
  audit?: Record<string, string | number | boolean | null>;
  ai?: Record<string, string | number | boolean | null>;
}

export interface ReplayStatusResponse {
  success: boolean;
  state: ReplayStatePayload;
}
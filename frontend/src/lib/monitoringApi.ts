const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

/* ============================================================
   Alpha India Monitoring API
   Sprint 33.3 — Mission Control
   Backend Compatible: v0.9.5+
============================================================ */

// -------------------- Interfaces --------------------

export interface HeartbeatStatus {
  status: string;
  engine: string;
  collector_status: string;
  last_scan: string | null;
  next_scan: string | null;
  scan_interval_seconds: number;
  companies_scanned_today: number;
  results_found_today: number;
  pdf_downloaded_today: number;
  parser_failures_today: number;
}

export interface DiscoveryStatus {
  engine_status: string;
  current_session: string;
  next_scan_time: string | null;
  last_scan_time: string | null;
  companies_scanned_today: number;
  results_found_today: number;
  parser_failures_today: number;
}

export interface DiscoveryQueueItem {
  id?: number;
  symbol: string;
  company_name?: string;
  exchange?: string;
  status: string;
  discovered_at?: string;
  updated_at?: string;
}

export interface DiscoveryQueueResponse {
  pending: number;
  completed: number;
  running: number;
  total: number;
  queue: DiscoveryQueueItem[];
}

export interface WarehouseStatus {
  total_companies: number;
  imported_companies: number;
  pending_companies: number;
  failed_companies: number;
  quarterly_records: number;
  coverage_percent: number;
}

export interface AuditStatus {
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

export interface ImportEngineStatus {
  running: boolean;
  thread_alive?: boolean;
  processed: number;
  imported: number;
  skipped: number;
  failed: number;
  pending: number;
  total: number;
  started_at?: string | null;
  last_symbol?: string | null;
}

export interface EngineResponse {
  running: boolean;
  batch_size?: number;
  sleep_seconds?: number;
  message?: string;
}

// -------------------- Generic Request --------------------

async function request<T>(
  endpoint: string,
  method: "GET" | "POST" = "GET"
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`Monitoring API Error (${response.status})`, error);
    throw new Error(`API Error (${response.status})`);
  }

  return response.json();
}

// -------------------- Heartbeat --------------------

export const fetchHeartbeat = () =>
  request<HeartbeatStatus>("/system/heartbeat");

// -------------------- Discovery Engine --------------------

export const fetchDiscoveryStatus = () =>
  request<DiscoveryStatus>("/discovery/status");

export const fetchDiscoveryQueue = () =>
  request<DiscoveryQueueResponse>("/discovery/queue");

export const bootstrapDiscoveryQueue = () =>
  request("/discovery/bootstrap", "POST");

export const runNextDiscovery = () =>
  request("/discovery/run-next", "POST");

// -------------------- Warehouse --------------------

export async function fetchWarehouseStatus(): Promise<WarehouseStatus> {
  const data: any = await request("/financials/status");

  return {
    total_companies:
      data.total_companies ??
      data.total ??
      data.universe_companies ??
      8588,

    imported_companies:
      data.imported_companies ??
      data.completed ??
      data.imported ??
      0,

    pending_companies:
      data.pending_companies ??
      data.pending ??
      0,

    failed_companies:
      data.failed_companies ??
      data.failed ??
      0,

    quarterly_records:
      data.quarterly_records ??
      data.financial_records ??
      data.records ??
      0,

    coverage_percent:
      data.coverage_percent ??
      data.coverage ??
      0,
  };
}

// -------------------- Import Engine --------------------

export const fetchImportEngineStatus = () =>
  request<ImportEngineStatus>("/financials/engine/status");

export function startImportEngine(batch = 5, sleep = 2) {
  return request<EngineResponse>(
    `/financials/engine/start?batch_size=${batch}&sleep_seconds=${sleep}`,
    "POST"
  );
}

export const stopImportEngine = () =>
  request<EngineResponse>("/financials/engine/stop", "POST");

// -------------------- Audit Engine --------------------

export const fetchAuditStatus = () =>
  request<AuditStatus>("/financials/audit/backfill/status");

export function startAuditEngine(batch = 25, sleep = 1) {
  return request<EngineResponse>(
    `/financials/audit/backfill/start?batch_size=${batch}&sleep_seconds=${sleep}`,
    "POST"
  );
}

export const stopAuditEngine = () =>
  request<EngineResponse>("/financials/audit/backfill/stop", "POST");

// -------------------- Combined Dashboard --------------------

export interface MonitoringDashboard {
  heartbeat: HeartbeatStatus;
  discovery: DiscoveryStatus;
  warehouse: WarehouseStatus;
  audit: AuditStatus;
  importEngine: ImportEngineStatus;
}

export async function fetchMonitoringDashboard(): Promise<MonitoringDashboard> {
  const [heartbeat, discovery, warehouse, audit, importEngine] =
    await Promise.all([
      fetchHeartbeat(),
      fetchDiscoveryStatus(),
      fetchWarehouseStatus(),
      fetchAuditStatus(),
      fetchImportEngineStatus(),
    ]);

  return {
    heartbeat,
    discovery,
    warehouse,
    audit,
    importEngine,
  };
}

// -------------------- Helpers --------------------

export function getEngineColor(status?: string) {
  if (!status) return "gray";

  const value = status.toUpperCase();

  if (
    value.includes("ONLINE") ||
    value.includes("RUNNING") ||
    value.includes("READY") ||
    value.includes("ACTIVE")
  ) {
    return "emerald";
  }

  if (value.includes("WARNING") || value.includes("PAUSED")) {
    return "amber";
  }

  if (value.includes("FAIL") || value.includes("STOP")) {
    return "red";
  }

  return "gray";
}

export function formatDateTime(value?: string | null) {
  if (!value) return "--";

  try {
    return new Date(value).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return value;
  }
}
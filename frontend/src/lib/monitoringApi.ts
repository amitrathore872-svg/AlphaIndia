// =======================================================
// Alpha India Mission Control API
// Sprint 33.4 (Stable Enterprise Version)
// Compatible with Sprint 32 Home + Sprint 33 Mission Control
// =======================================================

import type {
  MonitoringHeartbeat,
  WarehouseSummary,
  DiscoveryStatus,
  AuditBackfillStatus,
  MissionControlStatus,
  DiscoveryQueueSummary,
  TimelineEventsResponse,
  ValidationScorecardResponse,
  Sprint23EnginesResponse,
  ReplayStatusResponse,
} from "@/types/monitoring";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

// =======================================================
// Generic Request Helper
// =======================================================

async function request<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`API Error (${response.status}): ${endpoint}`);
  }

  return response.json();
}

// =======================================================
// HEARTBEAT
// GET /system/heartbeat
// =======================================================

export async function fetchHeartbeat(): Promise<MonitoringHeartbeat> {
  return request("/system/heartbeat");
}

// =======================================================
// WAREHOUSE SUMMARY
// GET /import-dashboard/summary
// Supports Sprint 32 + Sprint 33 response formats.
// =======================================================

// =======================================================
// WAREHOUSE SUMMARY
// GET /import-dashboard/summary
// Compatible with current backend payload.
// =======================================================

interface RawWarehouseSummary {
  warehouse?: WarehouseSummary["warehouse"];
  audit?: WarehouseSummary["audit"];
  total_companies?: number;
  imported_companies?: number;
  quarterly_records?: number;
  filings_discovered?: number;
  ai_scores_generated?: number;
  total_audited?: number;
  pass?: number;
  warning?: number;
  fail?: number;
}

export async function fetchWarehouseSummary(): Promise<WarehouseSummary> {
  const data = await request<RawWarehouseSummary>(
    "/import-dashboard/summary"
  );

  // Sprint 33 nested response with full real data
  if (data?.warehouse && data?.audit) {
    return {
      warehouse: data.warehouse,
      audit: data.audit,
    };
  }

  // Backward-compatible fallback
  const totalCompanies = data.total_companies ?? 0;
  const importedCompanies = data.imported_companies ?? 0;

  return {
    warehouse: {
      total_companies: totalCompanies,
      imported_companies: importedCompanies,
      pending_companies: Math.max(totalCompanies - importedCompanies, 0),
      coverage_percent:
        totalCompanies === 0
          ? 0
          : (importedCompanies / totalCompanies) * 100,
      quarterly_records: data.quarterly_records ?? data.filings_discovered ?? 0,
    },
    audit: {
      total_audited: data.audit?.total_audited ?? data.total_audited ?? data.ai_scores_generated ?? 0,
      pass: data.audit?.pass ?? data.pass ?? data.ai_scores_generated ?? 0,
      warning: data.audit?.warning ?? data.warning ?? 0,
      fail: data.audit?.fail ?? data.fail ?? 0,
    },
  };
}

// =======================================================
// DISCOVERY ENGINE STATUS
// GET /discovery/status
// =======================================================

export async function fetchDiscoveryStatus(): Promise<DiscoveryStatus> {
  return request("/discovery/status");
}

// =======================================================
// AUDIT BACKFILL ENGINE
// GET /financials/audit/backfill/status
// =======================================================

export async function fetchAuditBackfillStatus(): Promise<AuditBackfillStatus> {
  return request("/financials/audit/backfill/status");
}

// =======================================================
// MISSION CONTROL
// Combined backend payload for /monitoring
// =======================================================

export async function fetchMissionControlStatus(): Promise<MissionControlStatus> {
  const [heartbeat, warehouse, discovery, audit] = await Promise.all([
    fetchHeartbeat(),
    fetchWarehouseSummary(),
    fetchDiscoveryStatus(),
    fetchAuditBackfillStatus(),
  ]);

  return {
    heartbeat,
    warehouse,
    discovery,
    audit,
  };
}

// =======================================================
// DISCOVERY QUEUE SUMMARY
// GET /discovery/queue
// Current backend returns queue counters only.
// =======================================================

export async function fetchDiscoveryQueueSummary(): Promise<DiscoveryQueueSummary> {
  return request("/discovery/queue");
}

// =======================================================
// AUDIT ENGINE CONTROLS
// =======================================================

export async function startAuditBackfill(
  batchSize = 25,
  sleepSeconds = 1
) {
  const response = await fetch(
    `${API_BASE}/financials/audit/backfill/start?batch_size=${batchSize}&sleep_seconds=${sleepSeconds}`,
    {
      method: "POST",
    }
  );

  if (!response.ok) {
    throw new Error("Failed to start Audit Backfill Engine.");
  }

  return response.json();
}

export async function stopAuditBackfill() {
  const response = await fetch(
    `${API_BASE}/financials/audit/backfill/stop`,
    {
      method: "POST",
    }
  );

  if (!response.ok) {
    throw new Error("Failed to stop Audit Backfill Engine.");
  }

  return response.json();
}

// =======================================================
// SPRINT 32 BACKWARD COMPATIBILITY
// Used by existing Home Page and MonitoringRibbon.
// =======================================================

// =======================================================
// Warehouse Status (Sprint 32 + Sprint 33 Compatible)
// =======================================================

// =======================================================
// Warehouse Status (Used by MonitoringRibbon)
// =======================================================

export async function fetchWarehouseStatus() {
  const summary = await fetchWarehouseSummary();

  return {
    total_companies: summary.warehouse.total_companies,
    imported_companies: summary.warehouse.imported_companies,
    pending_companies: summary.warehouse.pending_companies,
    failed_companies: summary.audit.fail,
    coverage_percent: summary.warehouse.coverage_percent,
    quarterly_records: summary.warehouse.quarterly_records,
  };
}
// Audit Status (MonitoringRibbon)

export async function fetchAuditStatus() {
  return fetchAuditBackfillStatus();
}

// Legacy names retained.

export async function startAuditEngine(
  batchSize = 25,
  sleepSeconds = 1
) {
  return startAuditBackfill(batchSize, sleepSeconds);
}

export async function stopAuditEngine() {
  return stopAuditBackfill();
}

// =======================================================
// SPRINT 33 HELPERS
// =======================================================

export type MonitoringDashboard = MissionControlStatus;

export async function fetchMonitoringDashboard(): Promise<MonitoringDashboard> {
  return fetchMissionControlStatus();
}

// Date formatter used across Mission Control.

export function formatDateTime(value?: string | null) {
  if (!value) return "--";

  try {
    return new Date(value).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "medium",
    });
  } catch {
    return value;
  }
}
// =======================================================
// Mission Control Queue Types
// Sprint 33.4 Phase 4C.2
// =======================================================

export interface MissionControlQueueRow {
  symbol: string;
  company: string;
  exchange: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  filings_discovered: number;
  updated_at: string | null;
}

export interface MissionControlQueueResponse {
  success: boolean;
  summary: {
    pending: number;
    completed: number;
    running: number;
    total: number;
  };
  page: number;
  limit: number;
  total_pages: number;
  search: string;
  status_filter: string;
  results: MissionControlQueueRow[];
}
// =======================================================
// Mission Control Queue API
// Sprint 33.4 Phase 4C.2
// =======================================================

export async function fetchMissionControlQueue(
  page = 1,
  limit = 50,
  search = "",
  status = "ALL"
): Promise<MissionControlQueueResponse> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    search,
    status,
  });

  const response = await fetch(
    `${API_BASE}/mission-control/queue?${params.toString()}`,
    {
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch Mission Control Queue.");
  }

  return response.json();
}

// =======================================================
// Scanner Timeline Events API (Real Filing Events)
// =======================================================

export async function fetchScannerEvents(
  limit = 50,
  eventType = "ALL",
  symbol = ""
): Promise<TimelineEventsResponse> {
  const params = new URLSearchParams({
    limit: String(limit),
    event_type: eventType,
    symbol,
  });

  return request(`/mission-control/events?${params.toString()}`);
}

// =======================================================
// Sprint 23 — Pipeline Validation & Replay Controls API
// =======================================================

export async function fetchValidationScorecard(): Promise<ValidationScorecardResponse> {
  return request("/mission-control/validation/scorecard");
}

export async function fetchSprint23Engines(): Promise<Sprint23EnginesResponse> {
  return request("/mission-control/engines");
}

export async function startReplayPipeline(
  intervalSeconds = 5.0
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(
    `${API_BASE}/mission-control/replay/start?interval_seconds=${intervalSeconds}`,
    {
      method: "POST",
    }
  );

  if (!response.ok) {
    throw new Error("Failed to start replay pipeline.");
  }

  return response.json();
}

export async function resetReplayPipeline(): Promise<{
  success: boolean;
  message: string;
}> {
  const response = await fetch(`${API_BASE}/mission-control/replay/reset`, {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("Failed to reset replay pipeline.");
  }

  return response.json();
}

export async function fetchReplayStatus(): Promise<ReplayStatusResponse> {
  return request("/mission-control/replay/status");
}

export async function fetchReconciliationLogs(
  symbol = "",
  limit = 100
): Promise<{ success: boolean; total: number; logs: Record<string, unknown>[] }> {
  const params = new URLSearchParams({
    symbol,
    limit: String(limit),
  });
  return request(`/mission-control/reconciliation/logs?${params.toString()}`);
}
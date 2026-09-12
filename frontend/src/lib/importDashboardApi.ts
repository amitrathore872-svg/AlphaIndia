// ==========================================================
// Alpha India Import Dashboard API
// Sprint 32.6
// ==========================================================

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export interface WarehouseStatus {
  warehouse: string;
  companies_imported: number;
  quarter_records: number;

  queue: {
    total: number;
    pending: number;
    completed: number;
    failed: number;
    unavailable: number;
    progress_percent: number;
  };

  progress: {
    status: string;
    total_companies: number;
    completed: number;
    pending: number;
    failed: number;
    unavailable: number;
    completion_percent: number;
  };

  engine: {
    running: boolean;
    thread_alive: boolean;
  };

  latest_import: string | null;
}

async function request<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API ${response.status}: ${text}`);
  }

  return response.json();
}

// Warehouse Status
export function fetchWarehouseStatus() {
  return request<WarehouseStatus>("/financials/status");
}

// Queue Status
export function fetchQueueStatus() {
  return request("/financials/queue");
}

// Audit Summary
export function fetchAuditSummary() {
  return request("/financials/audit/summary");
}

// Audit Failures
export function fetchAuditFailures(limit = 20) {
  return request(`/financials/audit/failures?limit=${limit}`);
}

// Engine Status
export function fetchEngineStatus() {
  return request("/financials/engine/status");
}
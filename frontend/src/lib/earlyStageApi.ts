// =======================================================
// Alpha India — Early Stage Discovery API Client
// Sprint 23 — Phase 6
// =======================================================

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

// -------------------------------------------------------
// Types
// -------------------------------------------------------

export interface EarlyStageCandidate {
  id: number;
  company_name: string;
  tentative_ticker: string | null;
  source: string;
  mention_count: number;
  trend_score: number;
  sentiment: "positive" | "neutral" | "negative";
  status: "suggested" | "imported" | "ignored";
  sector: string | null;
  first_seen: string;
  last_seen: string;
}

export interface EarlyStageStats {
  total_candidates: number;
  by_status: Record<string, number>;
  cache_rows_pending: number;
  feature_enabled: boolean;
}

export interface EarlyStageMonitoringHealth {
  feature_enabled: boolean;
  retention_days: number;
  candidates: {
    total: number;
    by_status: Record<string, number>;
    top_sources: { source: string; count: number }[];
  };
  cache: {
    pending_rows: number;
    latest_fetch: string | null;
  };
  archive: {
    total_archived: number;
    latest_archived: string | null;
  };
  imports: {
    total_imported: number;
    latest_import: string | null;
  };
}

export interface BulkImportResult {
  total: number;
  created: number;
  reused: number;
  errors: number;
  details: { candidate_id: number; status: string; ticker?: string }[];
}

// -------------------------------------------------------
// Helpers
// -------------------------------------------------------

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    cache: "no-store",
    ...options,
  });
  if (!res.ok) throw new Error(`API Error (${res.status}): ${endpoint}`);
  return res.json();
}

// -------------------------------------------------------
// API functions
// -------------------------------------------------------

export async function fetchCandidates(params: {
  page?: number;
  limit?: number;
  status?: string;
  source?: string;
  sentiment?: string;
  sort_by?: string;
  sort_order?: string;
}): Promise<EarlyStageCandidate[]> {
  const qs = new URLSearchParams();
  if (params.page)       qs.set("page",       String(params.page));
  if (params.limit)      qs.set("limit",      String(params.limit));
  if (params.status)     qs.set("status",     params.status);
  if (params.source)     qs.set("source",     params.source);
  if (params.sentiment)  qs.set("sentiment",  params.sentiment);
  if (params.sort_by)    qs.set("sort_by",    params.sort_by);
  if (params.sort_order) qs.set("sort_order", params.sort_order);
  return request<EarlyStageCandidate[]>(`/early-stage/candidates?${qs}`);
}

export async function fetchStats(): Promise<EarlyStageStats> {
  return request<EarlyStageStats>("/early-stage/stats");
}

export async function triggerDiscoveryRun(): Promise<{ message: string }> {
  return request<{ message: string }>("/early-stage/run", { method: "POST" });
}

export async function updateCandidateStatus(
  id: number,
  status: "suggested" | "ignored" | "imported"
): Promise<void> {
  await request(`/early-stage/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
}

export async function bulkImportCandidates(
  candidateIds: number[]
): Promise<BulkImportResult> {
  return request<BulkImportResult>("/early-stage/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ candidate_ids: candidateIds }),
  });
}

export async function fetchEarlyStageHealth(): Promise<EarlyStageMonitoringHealth> {
  return request<EarlyStageMonitoringHealth>("/monitoring/early-stage");
}

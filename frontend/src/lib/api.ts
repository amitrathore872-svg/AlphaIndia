// =======================================================
// Alpha India API Client
// Sprint 33.4.1
// Enterprise API Layer
// =======================================================

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

// =======================================================
// Growth Screener Types
// =======================================================

export interface GrowthCompany {
  symbol: string;
  company: string;
  sector: string | null;
  exchange: string | null;

  market_cap: number | string | null;

  revenue_growth: number | string | null;
  pat_growth: number | string | null;
  eps_growth: number | string | null;

  health_score: number | string | null;
  result_date: string | null;
}

export interface GrowthScreenerResponse {
  success: boolean;
  page: number;
  limit: number;
  total: number;
  total_pages: number;

  sort_by?: string;
  sort_order?: string;

  results: GrowthCompany[];
}

// =======================================================
// Growth Screener API
// Server-side Search + Sorting + Pagination
// =======================================================

// =======================================================
// Growth Screener API (Sprint 33.4.1)
// Server-side Sorting + Pagination
// =======================================================

export async function fetchGrowthScreener(
  page = 1,
  limit = 25,
  search = "",
  sortBy = "revenue_growth",
  sortOrder: "asc" | "desc" = "desc"
) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    search,
    sort_by: sortBy,
    sort_order: sortOrder,
  });

  const response = await fetch(
    `${API_BASE}/growth-screener?${params.toString()}`,
    {
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error(`Growth Screener API Error (${response.status})`);
  }

  const data = await response.json();

  return {
    results: data.results ?? [],
    total: data.total ?? 0,
    page: data.page ?? page,
    limit: data.limit ?? limit,
    total_pages: data.total_pages ?? 1,
    success: data.success ?? true,
  };
}

// =======================================================
// Growth Screener Filters (Future GAP-02)
// =======================================================

export interface GrowthFilters {
  success: boolean;
  sectors: string[];
  exchanges: string[];
  health_scores: string[];
}

export async function fetchGrowthFilters(): Promise<GrowthFilters> {
  const response = await fetch(`${API_BASE}/growth-screener/filters`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch Growth Screener filters.");
  }

  return response.json();
}

// =======================================================
// Mission Control Types
// =======================================================

export interface MissionHeartbeat {
  status: string;
  last_scan: string;
  next_scan: string;

  companies_scanned_today: number;
  results_found_today: number;
  pdf_downloaded_today: number;
  parser_failures_today: number;
}

export interface WarehouseSnapshot {
  warehouse: {
    total_companies: number;
    imported_companies: number;
    progress_percent: number;

    filings_discovered: number;
    pdf_downloaded: number;
    pending_downloads: number;
    parsed_filings: number;
    ai_scores_generated: number;
  };
}

export interface DiscoverySnapshot {
  current_session: string;
}

export interface MissionControlStatus {
  heartbeat: MissionHeartbeat;
  warehouse: WarehouseSnapshot;
  discovery: DiscoverySnapshot;
}

// =======================================================
// Mission Control Dashboard
// =======================================================

export async function fetchMissionControlStatus(): Promise<MissionControlStatus> {
  const response = await fetch(`${API_BASE}/mission-control/dashboard`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch Mission Control dashboard.");
  }

  return response.json();
}

// =======================================================
// Discovery Queue Types
// =======================================================

export interface MissionControlQueueRow {
  symbol: string;
  company: string;
  exchange: string;

  status: "PENDING" | "RUNNING" | "COMPLETED";

  filings_discovered: number;
  updated_at: string | null;
}

export interface MissionControlQueueResponse {
  success: boolean;

  summary: {
    pending: number;
    running: number;
    completed: number;
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
// Mission Control Queue
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
    throw new Error("Failed to fetch Discovery Queue.");
  }

  return response.json();
}

// =======================================================
// Warehouse Monitoring Snapshot
// =======================================================

export async function fetchWarehouseStatus() {
  const response = await fetch(`${API_BASE}/warehouse/status`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch Warehouse status.");
  }

  return response.json();
}
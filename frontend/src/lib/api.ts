// =======================================================
// Alpha India API Client
// Sprint 33.4.1
// Enterprise API Layer
// =======================================================

import { API_BASE } from "@/lib/apiConfig";


// =======================================================
// Growth Screener Types
// =======================================================

export interface GrowthCompany {
  index: number;
  symbol: string;
  company: string;
  sector: string | null;
  industry: string | null;
  exchange: string | null;

  cmp: number | null;
  market_cap: number | null;
  market_cap_category: string | null;
  pe_ratio: number | null;
  industry_pe: number | null;
  pb_ratio: number | null;
  peg_ratio: number | null;

  roce: number | null;
  roe: number | null;
  opm: number | null;

  sales_growth_yoy: number | null;
  sales_growth_qoq: number | null;

  profit_growth_yoy: number | null;
  profit_growth_qoq: number | null;

  sales_cagr_3y: number | null;
  profit_cagr_3y: number | null;

  health_score: number | null;
  result_date: string | null;
  last_updated?: string | null;

  // Watchlist & Conviction
  in_watchlist?: boolean;
  watchlist_item_id?: number | null;
  watchlist_id?: number | null;
  watchlist_name?: string | null;
  conviction_score?: number | null; // 1 to 5
  watchlist_comment?: string | null;
  target_price?: number | null;

  // Backward-compatibility
  revenue_growth?: number | string | null;
  pat_growth?: number | string | null;
  eps_growth?: number | string | null;
  series?: string | null;
  ai_score?: number | null;
  health_status?: string | null;
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

export interface ScreenerFiltersState {
  sector: string;
  exchange: string;
  market_cap_category: string;
  pe_range: string;
  pb_range: string;
  roce_min: string;
  roe_min: string;
  health_score_range: string;
  watchlist_only?: boolean;
  watchlist_id?: number | null;
  min_conviction?: string;
}

export async function fetchGrowthScreener(
  page = 1,
  limit = 25,
  search = "",
  sortBy = "market_cap",
  sortOrder: "asc" | "desc" = "desc",
  filters?: Partial<ScreenerFiltersState>
) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    search,
    sort_by: sortBy,
    sort_order: sortOrder,
  });

  if (filters?.sector && filters.sector !== "ALL") {
    params.set("sector", filters.sector);
  }
  if (filters?.exchange && filters.exchange !== "ALL") {
    params.set("exchange", filters.exchange);
  }
  if (filters?.market_cap_category && filters.market_cap_category !== "ALL") {
    params.set("market_cap_category", filters.market_cap_category);
  }

  // Watchlist & Conviction filters
  if (filters?.watchlist_only) {
    params.set("watchlist_only", "true");
  }
  if (filters?.watchlist_id) {
    params.set("watchlist_id", String(filters.watchlist_id));
  }
  if (filters?.min_conviction && filters.min_conviction !== "ALL") {
    params.set("min_conviction", filters.min_conviction);
  }

  // P/E Range
  if (filters?.pe_range && filters.pe_range !== "ALL") {
    if (filters.pe_range === "lt15") {
      params.set("max_pe", "15");
    } else if (filters.pe_range === "15-30") {
      params.set("min_pe", "15");
      params.set("max_pe", "30");
    } else if (filters.pe_range === "30-50") {
      params.set("min_pe", "30");
      params.set("max_pe", "50");
    } else if (filters.pe_range === "gt50") {
      params.set("min_pe", "50");
    }
  }

  // P/B Range
  if (filters?.pb_range && filters.pb_range !== "ALL") {
    if (filters.pb_range === "lt2") {
      params.set("max_pb", "2");
    } else if (filters.pb_range === "2-5") {
      params.set("min_pb", "2");
      params.set("max_pb", "5");
    } else if (filters.pb_range === "gt5") {
      params.set("min_pb", "5");
    }
  }

  if (filters?.roce_min && filters.roce_min !== "ALL") {
    params.set("min_roce", filters.roce_min);
  }
  if (filters?.roe_min && filters.roe_min !== "ALL") {
    params.set("min_roe", filters.roe_min);
  }

  // Health Score Range
  if (filters?.health_score_range && filters.health_score_range !== "ALL") {
    if (filters.health_score_range === "80-100") {
      params.set("min_health_score", "80");
    } else if (filters.health_score_range === "60-79") {
      params.set("min_health_score", "60");
      params.set("max_health_score", "79");
    } else if (filters.health_score_range === "lt60") {
      params.set("max_health_score", "59");
    }
  }

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
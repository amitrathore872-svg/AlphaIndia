// ======================================================
// Alpha India Frontend API Layer
// Sprint 32.6.4 — Growth Screener Integration
// Backend Compatible: v0.9.5 Recovery
// ======================================================

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

// ======================================================
// Company Master Interface
// ======================================================

export interface Company {
  id: number;
  company_name: string;
  symbol: string;
  exchange: string;
  sector: string;
  market_cap: string;
  listing_status?: string;
  ai_score?: number;
}

// ======================================================
// Dashboard Summary Interface
// ======================================================

export interface DashboardSummary {
  total_companies: number;
  active_companies: number;
  nse_companies: number;
  bse_companies: number;
}

// ======================================================
// Growth Screener Interfaces
// ======================================================

export interface GrowthCompany {
  id: number;

  symbol: string;
  company: string;

  exchange: string;
  series: string;

  sector: string;
  industry: string;

  market_cap: number | string;

  revenue_growth: number;
  pat_growth: number;
  roce: number;

  ai_score: number;

  health_score: number | null;
  health_status: "PASS" | "WARNING" | "FAIL" | "PENDING";
}

export interface GrowthScreenerResponse {
  page: number;
  limit: number;
  total: number;
  results: GrowthCompany[];
}

// ======================================================
// Dashboard Summary API
// ======================================================

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const response = await fetch(`${API_URL}/companies/dashboard-summary`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch dashboard summary");
  }

  const data = await response.json();

  return {
    total_companies: data.total_companies ?? data.total ?? 0,

    active_companies:
      data.active_companies ??
      data.total_active ??
      data.total_companies ??
      0,

    nse_companies: data.nse_companies ?? data.nse ?? 0,
    bse_companies: data.bse_companies ?? data.bse ?? 0,
  };
}

// ======================================================
// Company Master API (Legacy)
// ======================================================

export async function fetchCompanies(
  page = 1,
  limit = 25,
  search = ""
): Promise<{
  page: number;
  total: number;
  results: Company[];
}> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    search,
  });

  const response = await fetch(
    `${API_URL}/companies?${params.toString()}`,
    {
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const text = await response.text();
    console.error("Companies API Error:", text);
    throw new Error(`Failed to fetch companies (${response.status})`);
  }

  const data = await response.json();

  const companies = data.results ?? data.companies ?? [];

  return {
    page: data.page ?? page,
    total: data.total ?? companies.length,

    results: companies.map((company: any) => ({
      id: company.id,
      company_name: company.company_name,
      symbol: company.symbol,
      exchange: company.exchange ?? "NSE",
      sector: company.sector ?? "Unknown",
      market_cap: company.market_cap ?? "Unknown",
      listing_status: company.listing_status ?? "ACTIVE",
      ai_score: Number(company.ai_score ?? 0),
    })),
  };
}

// ======================================================
// Growth Screener API
// Sprint 32
// ======================================================

export async function fetchGrowthScreener(
  page = 1,
  limit = 25,
  search = "",
  sector = "",
  health = ""
): Promise<GrowthScreenerResponse> {

  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  if (search.trim()) {
    params.append("search", search.trim());
  }

  if (sector && sector !== "All") {
    params.append("sector", sector);
  }

  if (health && health !== "All") {
    params.append("health", health);
  }

  const response = await fetch(
    `${API_URL}/screener/growth?${params.toString()}`,
    {
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const text = await response.text();
    console.error("Growth Screener API Error:", text);
    throw new Error(`Growth Screener API failed (${response.status})`);
  }

  const data = await response.json();

  return {
    page: data.page,
    limit: data.limit,
    total: data.total,

    results: data.results.map((company: any) => ({
      id: company.id,

      symbol: company.symbol,
      company: company.company,

      exchange: company.exchange ?? "NSE",
      series: company.series ?? "EQ",

      sector: company.sector ?? "Unknown",
      industry: company.industry ?? "Unknown",

      market_cap: company.market_cap ?? "Unknown",

      revenue_growth: Number(company.revenue_growth ?? 0),
      pat_growth: Number(company.pat_growth ?? 0),
      roce: Number(company.roce ?? 0),

      ai_score: Number(company.ai_score ?? 0),

      // IMPORTANT FIX
      health_score:
        company.health_score === null ||
        company.health_score === undefined
          ? null
          : Number(company.health_score),

      health_status: company.health_status ?? "PENDING",
    })),
  };
}

// ======================================================
// Sector List API
// ======================================================

export async function fetchSectors(): Promise<string[]> {
  const response = await fetch(`${API_URL}/screener/sectors`, {
    cache: "force-cache",
  });

  if (!response.ok) {
    return [];
  }

  const data = await response.json();

  return data.results ?? [];
}

// ======================================================
// Screener Filter Metadata API
// ======================================================

export async function fetchScreenerFilters() {
  const response = await fetch(`${API_URL}/screener/filters`, {
    cache: "force-cache",
  });

  if (!response.ok) {
    throw new Error("Failed to load screener filters");
  }

  return response.json();
}
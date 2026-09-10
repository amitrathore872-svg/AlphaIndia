// ======================================================
// Alpha India Frontend API Layer
// Compatible with Sprint 28 Backend (v0.9.5 Recovery)
// ======================================================

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

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

export interface DashboardSummary {
  total_companies: number;
  active_companies: number;
  nse_companies: number;
  bse_companies: number;
}

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

export async function fetchCompanies(
  page = 1,
  limit = 25,
  search = ""
): Promise<{ page: number; total: number; results: Company[] }> {
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

  // Sprint 28 backend compatibility
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
      market_cap: company.market_cap ?? "N/A",
      listing_status: company.listing_status ?? "ACTIVE",
      ai_score: company.ai_score ?? 0,
    })),
  };
}